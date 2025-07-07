"use client";

import React, { useState, useEffect } from 'react';
import { Upload, Download, FileText, DollarSign, TrendingUp, Calculator, CheckCircle, AlertCircle, X, Edit2, Save, Plus, Trash, Eye, EyeOff, Settings, RefreshCw, FileUp } from 'lucide-react';

const SATaxCalculator = () => {
  // State management
  const [selectedTaxYear, setSelectedTaxYear] = useState(getCurrentTaxYear());
  const [userAge, setUserAge] = useState('under65');
  const [editMode, setEditMode] = useState(false);
  const [homeOfficePercentage, setHomeOfficePercentage] = useState(8.2);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStatus, setProcessingStatus] = useState('');
  const [showTransactionDetails, setShowTransactionDetails] = useState(false);
  const [pdfJsLoaded, setPdfJsLoaded] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  
  // Logging states
  const [debugMode, setDebugMode] = useState(false);
  const [processingLogs, setProcessingLogs] = useState([]);
  const [showLogs, setShowLogs] = useState(false);
  const [extractedTexts, setExtractedTexts] = useState([]);

  // Data states
  const [incomeEntries, setIncomeEntries] = useState([]);
  const [businessExpenses, setBusinessExpenses] = useState([]);
  const [personalExpenses, setPersonalExpenses] = useState([]);
  const [homeExpenses, setHomeExpenses] = useState([]);
  const [rawTransactions, setRawTransactions] = useState([]);
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [uncategorizedTransactions, setUncategorizedTransactions] = useState([]);
  const [editingEntry, setEditingEntry] = useState(null);

  // Categories
  const incomeCategories = ["Employment", "Freelance", "Investment", "Rental", "Business", "Other"];
  const expenseCategories = ["Office", "Medical", "Retirement", "Professional", "Education", "Travel", "Equipment", "Software", "Insurance", "Utilities", "Marketing", "Training", "Other"];

  // Helper functions
  function getCurrentTaxYear() {
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth();
    return currentMonth >= 2 ? currentYear : currentYear - 1;
  }

  // Comprehensive logging system
  const logMessage = (level, category, message, data = null) => {
    const timestamp = new Date().toISOString();
    const logEntry = {
      id: Date.now() + Math.random(),
      timestamp,
      level, // 'info', 'warn', 'error', 'debug'
      category, // 'pdf-load', 'text-extract', 'transaction-parse', 'categorization'
      message,
      data
    };
    
    setProcessingLogs(prev => [...prev, logEntry]);
    
    // Also log to console in debug mode
    if (debugMode) {
      console.log(`[${level.toUpperCase()}] ${category}: ${message}`, data);
    }
    
    return logEntry;
  };

  const clearLogs = () => {
    setProcessingLogs([]);
    setExtractedTexts([]);
  };

  const downloadLogs = () => {
    const logData = {
      timestamp: new Date().toISOString(),
      processingLogs,
      extractedTexts,
      summary: {
        totalLogs: processingLogs.length,
        errors: processingLogs.filter(log => log.level === 'error').length,
        warnings: processingLogs.filter(log => log.level === 'warn').length,
        filesProcessed: extractedTexts.length,
        transactionsFound: rawTransactions.length
      }
    };
    
    const blob = new Blob([JSON.stringify(logData, null, 2)], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pdf-processing-logs-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  // Load PDF.js
  useEffect(() => {
    const loadPdfJs = async () => {
      try {
        if (typeof window !== 'undefined' && !window.pdfjsLib) {
          const script = document.createElement('script');
          script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
          script.onload = () => {
            window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
            setPdfJsLoaded(true);
          };
          document.head.appendChild(script);
        } else if (window.pdfjsLib) {
          setPdfJsLoaded(true);
        }
      } catch (error) {
        console.error('Failed to load PDF.js:', error);
      }
    };
    loadPdfJs();
  }, []);

  // Tax brackets and rebates data
  const taxBracketsData = {
    2024: {
      brackets: [
        { min: 0, max: 237100, rate: 0.18 },
        { min: 237100, max: 370500, rate: 0.26 },
        { min: 370500, max: 512800, rate: 0.31 },
        { min: 512800, max: 673000, rate: 0.36 },
        { min: 673000, max: 857900, rate: 0.39 },
        { min: 857900, max: 1817600, rate: 0.41 },
        { min: 1817600, max: Infinity, rate: 0.45 }
      ],
      rebates: {
        under65: 17235,
        under75: 17235 + 9444,
        over75: 17235 + 9444 + 3145
      }
    },
    2025: {
      brackets: [
        { min: 0, max: 262250, rate: 0.18 },
        { min: 262250, max: 410460, rate: 0.26 },
        { min: 410460, max: 567890, rate: 0.31 },
        { min: 567890, max: 744800, rate: 0.36 },
        { min: 744800, max: 949320, rate: 0.39 },
        { min: 949320, max: 2011300, rate: 0.41 },
        { min: 2011300, max: Infinity, rate: 0.45 }
      ],
      rebates: {
        under65: 19071,
        under75: 19071 + 10455,
        over75: 19071 + 10455 + 3485
      }
    }
  };

  // Updated categorization rules for provisional tax payer
  const categorizationRules = {
    income: [
      // Primary income source - Precise Digitait (NZ company payments)
      { pattern: /PRECISE DIGIT.*teletransmission inward/i, category: "Freelance", source: "NZ Company Income (Precise Digitait)", confidence: 0.98 },
      { pattern: /teletransmission inward/i, category: "Freelance", source: "International Business Income", confidence: 0.9 },
      
      // Other legitimate business income
      { pattern: /CASHFOCUS SALARY/i, category: "Employment", source: "Employment Income", confidence: 0.9 },
    ],
    
    businessExpenses: [
      // Retirement contributions (RA) - highly deductible for provisional tax payers
      { pattern: /10XRA COL.*service agreement|10X RETIREMENT ANN/i, category: "Retirement", description: "Retirement Annuity Contribution", confidence: 0.98 },
      
      // Medical aid contributions - fully deductible
      { pattern: /DISC PREM.*medical aid/i, category: "Medical", description: "Medical Aid Contribution", confidence: 0.98 },
      { pattern: /iK \*Dr Malcol|Dr\s+Malcol/i, category: "Medical", description: "Medical Professional Fees", confidence: 0.9 },
      
      // Professional services - tax, legal, accounting
      { pattern: /PERSONAL TAX SERVICE|TAX.*ADVISOR|PROVTAX/i, category: "Professional", description: "Tax Advisory Services", confidence: 0.95 },
      { pattern: /fee.*teletransmission.*inward|teletransmission.*fee/i, category: "Professional", description: "International Transfer Fees (Business)", confidence: 0.9 },
      
      // Business education and training
      { pattern: /PAYU \* UC|I PAYU \* UC/i, category: "Education", description: "University of Cape Town (Business Education)", confidence: 0.9 },
      
      // Business software and subscriptions
      { pattern: /Google GSUITE|GOOGLE\*GSUITE/i, category: "Software", description: "Google Workspace (Business)", confidence: 0.95 },
      { pattern: /MSFT \*|Microsoft/i, category: "Software", description: "Microsoft Office 365 (Business)", confidence: 0.9 },
      { pattern: /CLAUDE\.AI SUBSCRIPTION/i, category: "Software", description: "Claude AI (Business Tool)", confidence: 0.9 },
      { pattern: /SHEET SOLVED/i, category: "Software", description: "Business Software/Tools", confidence: 0.85 },
      
      // Business communications and internet
      { pattern: /AFRIHOST|INTERNET.*SERVICE/i, category: "Office", description: "Internet Services (Business)", confidence: 0.85 },
      
      // Business meals and entertainment (limited deduction)
      { pattern: /BOOTLEGGER|SHIFT.*ESPRESS/i, category: "Business", description: "Business Coffee/Meals", confidence: 0.85 },
      
      // Business printing and stationery
      { pattern: /ROZPRINT/i, category: "Office", description: "Printing Services", confidence: 0.95 },
      
      // Property maintenance (business portion)
      { pattern: /POINT GARDEN SERVICE|GARDEN.*SERVICE/i, category: "Office", description: "Property Maintenance (Business Portion)", confidence: 0.8 },
      
      // Business insurance
      { pattern: /DISCINSURE.*insurance.*premium/i, category: "Insurance", description: "Business Insurance", confidence: 0.8 },
    ],
    
    personalExpenses: [
      // Explicitly excluded personal expenses as per requirements
      { pattern: /VIRGIN ACT.*NETCASH|GYM.*MEMBERSHIP/i, category: "Personal", description: "Gym Membership (EXCLUDED)", confidence: 0.95 },
      { pattern: /OM UNITTRU.*unit trust|OLD MUTUAL.*INVESTMENT/i, category: "Investment", description: "Unit Trust Investment (EXCLUDED)", confidence: 0.95 },
      { pattern: /Netflix|NETFLIX/i, category: "Entertainment", description: "Netflix Subscription (EXCLUDED)", confidence: 0.98 },
      { pattern: /APPLE\.COM|APPLE.*SERVICES/i, category: "Entertainment", description: "Apple Services (EXCLUDED)", confidence: 0.95 },
      { pattern: /YouTube|YOUTUBE|Google YouTube/i, category: "Entertainment", description: "YouTube Premium (EXCLUDED)", confidence: 0.95 },
      { pattern: /SABC.*TV.*LICE|U\*SABC TV/i, category: "Entertainment", description: "SABC TV License (EXCLUDED)", confidence: 0.95 },
      { pattern: /CARTRACK/i, category: "Personal", description: "Vehicle Tracking (EXCLUDED)", confidence: 0.95 },
      
      // Personal mobile and communications
      { pattern: /MTN PREPAID|MTN SP.*debicheck|CELL.*PHONE|MOBILE/i, category: "Personal", description: "Mobile Phone (Personal)", confidence: 0.8 },
      
      // Personal shopping and groceries
      { pattern: /WOOLWORTHS.*(?!.*BB5065|.*office|.*business)/i, category: "Personal", description: "Personal Shopping", confidence: 0.7 },
      { pattern: /PnP|Pick n Pay|CHECKERS|SPAR/i, category: "Personal", description: "Groceries", confidence: 0.8 },
      
      // Personal fuel and transport
      { pattern: /ENGEN|BP.*(?!.*business)|SHELL|CALTEX/i, category: "Personal", description: "Personal Fuel", confidence: 0.7 },
    ],

    homeExpenses: [
      { pattern: /SBSA HOMEL.*bond repayment|HOME.*LOAN|MORTGAGE/i, category: "Mortgage", description: "Home Loan Payment", confidence: 0.98 },
      { pattern: /SYSTEM INTEREST DEBIT.*ID|MORTGAGE.*INTEREST/i, category: "Mortgage", description: "Mortgage Interest", confidence: 0.98 },
      { pattern: /INSURANCE PREMIUM.*IP|HOME.*INSURANCE/i, category: "Insurance", description: "Home Insurance", confidence: 0.9 },
      { pattern: /MUNICIPAL.*RATES|CITY.*RATES/i, category: "Utilities", description: "Municipal Rates", confidence: 0.9 },
      { pattern: /ELECTRICITY|ESKOM/i, category: "Utilities", description: "Electricity", confidence: 0.9 }
    ],

    // Special handling for TAKEALOT
    takealotPattern: /M\*TAKEALO\*T|TAKEALO.*T/i,
    
    excludePatterns: [
      // Inter-account transfers and internal bank movements
      /Ces - ib transfer|FUND TRANSFERS|INT ACNT TRF|AUTOBANK TRANSFER/i,
      /ib payment|interbank.*payment|internal.*transfer|account.*transfer/i,
      
      // Bank fees and charges
      /fixed monthly fee|overdraft service fee|UCOUNT.*membership fee/i,
      /fee.*mu primary sms|ADMINISTRATION FEE HL|fee.*account.*validation/i,
      /HONOURING FEE|ELECTRONIC PMT.*FEE|INTER ACC TRANSFER FEE/i,
      /INTERNATIONAL TXN FEE|PREPAID FEE|#.*FEE/i,
      /CASH FINANCE CHARGE|FINANCE CHARGE/i,
      
      // Interest income (not business income for this user)
      /CREDIT INTEREST|excess interest|INTEREST.*CREDIT/i,
      
      // Reversed transactions and adjustments
      /rtd-not provided for|DEBIT ORDER REVERSAL|reversal/i,
      
      // Investment transfers (Old Mutual, Investec)
      /INVESTECPB.*debit transfer|OM UNITTRU/i,
      
      // Cash withdrawals (personal)
      /autobank cash withdrawal|ATM.*withdrawal|CASH.*WITHDRAWAL/i
    ]
  };

  const calculateAnnualAmount = (amount, period) => {
    if (!amount) return 0;
    const multipliers = { daily: 365, weekly: 52, monthly: 12, annually: 1 };
    return amount * (multipliers[period] || 1);
  };

  // Calculate totals
  const totalAnnualIncome = incomeEntries.reduce((sum, entry) => 
    sum + calculateAnnualAmount(entry.amount, entry.period), 0);
  
  const totalDeductibleExpenses = businessExpenses
    .filter(expense => !expense.isExcluded)
    .reduce((sum, expense) => sum + calculateAnnualAmount(expense.amount, expense.period), 0);
  
  const totalPersonalExpenses = personalExpenses
    .reduce((sum, expense) => sum + calculateAnnualAmount(expense.amount, expense.period), 0);

  const taxableIncome = Math.max(0, totalAnnualIncome - totalDeductibleExpenses);

  // Tax calculation
  const calculateTax = (income, year, ageCategory) => {
    const data = taxBracketsData[year];
    if (!data) return { tax: 0, grossTax: 0, rebates: 0, effectiveRate: 0, marginalRate: 0 };

    let grossTax = 0;
    let marginalRate = 0;

    for (const bracket of data.brackets) {
      if (income > bracket.min) {
        const taxableInBracket = Math.min(income, bracket.max) - bracket.min;
        grossTax += taxableInBracket * bracket.rate;
        marginalRate = bracket.rate * 100;
      }
    }

    const rebates = data.rebates[ageCategory] || 0;
    const netTax = Math.max(0, grossTax - rebates);
    const effectiveRate = income > 0 ? (netTax / income) * 100 : 0;

    return {
      tax: netTax,
      grossTax,
      rebates,
      effectiveRate,
      marginalRate
    };
  };

  const taxCalculation = calculateTax(taxableIncome, selectedTaxYear, userAge);
  const monthlyTaxRequired = taxCalculation.tax / 12;

  // PDF Processing with comprehensive logging
  const handleFileUpload = async (event) => {
    const files = Array.from(event.target.files);
    if (files.length === 0) {
      logMessage('warn', 'file-upload', 'No files selected');
      return;
    }
    
    if (!pdfJsLoaded) {
      logMessage('error', 'file-upload', 'PDF.js not loaded yet');
      return;
    }

    logMessage('info', 'file-upload', `Starting processing of ${files.length} file(s)`, { 
      fileNames: files.map(f => f.name),
      fileSizes: files.map(f => f.size)
    });

    setIsProcessing(true);
    setProcessingStatus('Starting PDF processing...');
    clearLogs();

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        logMessage('info', 'file-process', `Processing file ${i + 1}/${files.length}: ${file.name}`, {
          fileName: file.name,
          fileSize: file.size,
          fileType: file.type
        });
        
        setProcessingStatus(`Processing ${file.name} (${i + 1}/${files.length})...`);
        await processPDF(file);
      }
      
      const successMessage = `Successfully processed ${files.length} file(s)`;
      logMessage('info', 'file-upload', successMessage);
      setProcessingStatus(successMessage);
      setTimeout(() => setProcessingStatus(''), 3000);
      
    } catch (error) {
      const errorMessage = `Error processing files: ${error.message}`;
      logMessage('error', 'file-upload', errorMessage, { error: error.stack });
      console.error('File processing error:', error);
      setProcessingStatus(errorMessage);
    } finally {
      setIsProcessing(false);
      if (debugMode) {
        setShowLogs(true);
      }
    }
  };

  const processPDF = async (file) => {
    logMessage('info', 'pdf-load', `Starting PDF processing for: ${file.name}`);
    
    try {
      // Convert file to array buffer
      logMessage('debug', 'pdf-load', 'Converting file to ArrayBuffer');
      const arrayBuffer = await file.arrayBuffer();
      logMessage('debug', 'pdf-load', `ArrayBuffer created, size: ${arrayBuffer.byteLength} bytes`);
      
      // Load PDF document
      logMessage('debug', 'pdf-load', 'Loading PDF document with PDF.js');
      const loadingTask = window.pdfjsLib.getDocument({ data: arrayBuffer });
      const pdf = await loadingTask.promise;
      
      logMessage('info', 'pdf-load', `PDF loaded successfully`, {
        numPages: pdf.numPages,
        fileName: file.name
      });
      
      // Extract text from all pages
      let allText = '';
      const pageTexts = [];
      
      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        logMessage('debug', 'text-extract', `Processing page ${pageNum}/${pdf.numPages}`);
        
        try {
          const page = await pdf.getPage(pageNum);
          const textContent = await page.getTextContent();
          
          logMessage('debug', 'text-extract', `Page ${pageNum} text items found: ${textContent.items.length}`);
          
          // Extract text items
          const pageText = textContent.items.map(item => item.str).join(' ');
          pageTexts.push({
            page: pageNum,
            text: pageText,
            itemCount: textContent.items.length,
            rawItems: debugMode ? textContent.items.slice(0, 10) : null // First 10 items for debugging
          });
          
          allText += pageText + '\n';
          
          logMessage('debug', 'text-extract', `Page ${pageNum} text length: ${pageText.length} characters`);
          
        } catch (pageError) {
          logMessage('error', 'text-extract', `Error processing page ${pageNum}`, {
            error: pageError.message,
            stack: pageError.stack
          });
        }
      }
      
      logMessage('info', 'text-extract', `Text extraction completed`, {
        totalPages: pdf.numPages,
        totalTextLength: allText.length,
        averageTextPerPage: Math.round(allText.length / pdf.numPages)
      });
      
      // Store extracted text for debugging
      setExtractedTexts(prev => [...prev, {
        fileName: file.name,
        pageCount: pdf.numPages,
        totalTextLength: allText.length,
        allText: allText,
        pageTexts: pageTexts,
        extractedAt: new Date()
      }]);
      
      // Process transactions
      logMessage('info', 'transaction-parse', 'Starting transaction extraction');
      const transactions = extractTransactions(allText, file.name);
      
      logMessage('info', 'transaction-parse', `Transaction extraction completed`, {
        transactionsFound: transactions.length,
        fileName: file.name
      });
      
      // Categorize transactions
      logMessage('info', 'categorization', 'Starting transaction categorization');
      const processedData = categorizeTransactions(transactions);
      
      logMessage('info', 'categorization', `Categorization completed`, {
        income: processedData.income.length,
        business: processedData.business.length,
        personal: processedData.personal.length,
        home: processedData.home.length,
        uncategorized: processedData.uncategorized.length
      });

      // Update states
      setRawTransactions(prev => [...prev, ...transactions]);
      setIncomeEntries(prev => [...prev, ...processedData.income]);
      setBusinessExpenses(prev => [...prev, ...processedData.business]);
      setPersonalExpenses(prev => [...prev, ...processedData.personal]);
      setHomeExpenses(prev => [...prev, ...processedData.home]);
      setUncategorizedTransactions(prev => [...prev, ...processedData.uncategorized]);

      setUploadedFiles(prev => [...prev, {
        name: file.name,
        pageCount: pdf.numPages,
        transactionCount: transactions.length,
        processedAt: new Date(),
        textLength: allText.length
      }]);
      
      logMessage('info', 'pdf-load', `PDF processing completed successfully for: ${file.name}`);
      
    } catch (error) {
      logMessage('error', 'pdf-load', `Failed to process PDF: ${file.name}`, {
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  };

  const extractTransactions = (text, sourceFile) => {
    logMessage('info', 'transaction-parse', `Starting transaction extraction from ${sourceFile}`, {
      textLength: text.length,
      sourceFile
    });

    const transactions = [];
    const lines = text.split('\n').filter(line => line.trim().length > 0);
    
    logMessage('debug', 'transaction-parse', `Text split into ${lines.length} lines`);
    
    // Multiple regex patterns for different bank formats
    const patterns = {
      standardBank: /(\d{2}\s+\w{3})\s+(.+?)\s+([\d\s,.+-]+)\s+([\d\s,.+-]+)/,
      standardBankAlt: /(\d{2}\s+\w{3}\s+\d{4}|\d{2}\s+\w{3})\s+(.+?)\s+([+-]?\s*[\d\s,.]+)\s+([\d\s,.]+)/,
      genericDate: /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\d{2}\s+\w{3})\s+(.+?)\s+([+-]?\s*[\d\s,.]+)/,
      amountBalance: /(.+?)\s+([+-]?\s*R?\s*[\d\s,.]+)\s+(R?\s*[\d\s,.]+)$/
    };
    
    let matchCounts = {};
    Object.keys(patterns).forEach(key => matchCounts[key] = 0);
    
    // Sample first 20 lines for debugging
    if (debugMode && lines.length > 0) {
      logMessage('debug', 'transaction-parse', 'Sample lines for pattern matching', {
        sampleLines: lines.slice(0, 20),
        totalLines: lines.length
      });
    }
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      if (line.length < 10) continue; // Skip very short lines
      
      let matched = false;
      let matchedPattern = '';
      
      // Try each pattern
      for (const [patternName, pattern] of Object.entries(patterns)) {
        const match = line.match(pattern);
        
        if (match) {
          matched = true;
          matchedPattern = patternName;
          matchCounts[patternName]++;
          
          try {
            // Extract components based on pattern
            let date, description, amount, balance;
            
            if (patternName === 'amountBalance') {
              [, description, amount, balance] = match;
              date = 'Unknown';
            } else {
              [, date, description, amount, balance] = match;
            }
            
            // Clean and parse amounts
            const cleanAmount = amount.replace(/[^\d.-]/g, '');
            const cleanBalance = balance ? balance.replace(/[^\d.-]/g, '') : '0';
            
            const numAmount = parseFloat(cleanAmount);
            const numBalance = parseFloat(cleanBalance);
            
            if (!isNaN(numAmount) && Math.abs(numAmount) > 1) {
              const transaction = {
                id: Date.now() + Math.random(),
                date: date.trim(),
                originalDescription: description.trim(),
                amount: numAmount,
                balance: numBalance || 0,
                type: numAmount > 0 ? 'credit' : 'debit',
                sourceFile,
                lineNumber: i + 1,
                matchedPattern: patternName,
                rawLine: line
              };
              
              transactions.push(transaction);
              
              if (debugMode && transactions.length <= 10) {
                logMessage('debug', 'transaction-parse', `Transaction extracted (${patternName})`, {
                  transaction,
                  originalLine: line
                });
              }
            } else {
              logMessage('debug', 'transaction-parse', `Invalid amount parsed: ${cleanAmount} from line: ${line.substring(0, 100)}`);
            }
            
          } catch (parseError) {
            logMessage('warn', 'transaction-parse', `Error parsing matched line`, {
              line: line.substring(0, 100),
              pattern: patternName,
              error: parseError.message
            });
          }
          
          break; // Stop trying other patterns once we find a match
        }
      }
      
      if (!matched && debugMode && i < 50) {
        // Log some unmatched lines for debugging
        logMessage('debug', 'transaction-parse', `Line ${i + 1} did not match any pattern`, {
          line: line.substring(0, 100),
          lineLength: line.length
        });
      }
    }
    
    logMessage('info', 'transaction-parse', `Transaction extraction completed`, {
      totalLinesProcessed: lines.length,
      transactionsExtracted: transactions.length,
      patternMatches: matchCounts,
      extractionRate: `${((transactions.length / lines.length) * 100).toFixed(1)}%`
    });
    
    // Log sample transactions for review
    if (transactions.length > 0) {
      logMessage('info', 'transaction-parse', `Sample extracted transactions`, {
        sampleTransactions: transactions.slice(0, 5).map(t => ({
          date: t.date,
          description: t.originalDescription.substring(0, 50),
          amount: t.amount,
          pattern: t.matchedPattern
        }))
      });
    } else {
      logMessage('warn', 'transaction-parse', `No transactions extracted from ${sourceFile}`, {
        textSample: text.substring(0, 500),
        linesSample: lines.slice(0, 10)
      });
    }
    
    return transactions;
  };

  const categorizeTransactions = (transactions) => {
    logMessage('info', 'categorization', `Starting categorization of ${transactions.length} transactions`);
    
    const categorized = {
      income: [],
      business: [],
      personal: [],
      home: [],
      uncategorized: []
    };

    let categorizedCount = 0;
    let excludedCount = 0;

    transactions.forEach((transaction, index) => {
      let wasProcessed = false;
      
      // Skip excluded patterns first
      for (const pattern of categorizationRules.excludePatterns) {
        if (pattern.test(transaction.originalDescription)) {
          excludedCount++;
          wasProcessed = true;
          
          if (debugMode && excludedCount <= 10) {
            logMessage('debug', 'categorization', `Transaction excluded by pattern`, {
              description: transaction.originalDescription,
              pattern: pattern.toString(),
              amount: transaction.amount
            });
          }
          break;
        }
      }
      
      if (wasProcessed) return;

      // Check for TAKEALOT special handling
      if (categorizationRules.takealotPattern.test(transaction.originalDescription)) {
        categorized.uncategorized.push({
          ...transaction,
          category: 'takealot-review',
          reason: 'TAKEALOT purchase requires manual invoice review to separate business vs personal items'
        });
        
        logMessage('debug', 'categorization', `TAKEALOT transaction flagged for review`, {
          description: transaction.originalDescription,
          amount: transaction.amount
        });
        
        categorizedCount++;
        return;
      }

      // Categorize income
      for (const rule of categorizationRules.income) {
        if (rule.pattern.test(transaction.originalDescription) && transaction.amount > 0) {
          const sourceTransactions = [transaction];
          const incomeEntry = {
            id: Date.now() + Math.random(),
            description: rule.source,
            amount: Math.abs(transaction.amount),
            period: 'monthly',
            source: rule.category,
            dataSource: 'auto-detected',
            confidence: rule.confidence,
            sourceTransactions,
            notes: `Auto-detected from: ${transaction.originalDescription}`
          };
          
          categorized.income.push(incomeEntry);
          categorizedCount++;
          wasProcessed = true;
          
          logMessage('debug', 'categorization', `Income categorized`, {
            rule: rule.category,
            confidence: rule.confidence,
            amount: transaction.amount,
            description: transaction.originalDescription.substring(0, 50)
          });
          
          break;
        }
      }

      if (wasProcessed) return;

      // Categorize business expenses
      for (const rule of categorizationRules.businessExpenses) {
        if (rule.pattern.test(transaction.originalDescription) && transaction.amount < 0) {
          const sourceTransactions = [transaction];
          const expenseEntry = {
            id: Date.now() + Math.random(),
            description: rule.description,
            amount: Math.abs(transaction.amount),
            period: 'monthly',
            category: rule.category,
            dataSource: 'auto-detected',
            confidence: rule.confidence,
            sourceTransactions,
            notes: `Auto-detected from: ${transaction.originalDescription}`
          };
          
          categorized.business.push(expenseEntry);
          categorizedCount++;
          wasProcessed = true;
          
          logMessage('debug', 'categorization', `Business expense categorized`, {
            rule: rule.category,
            confidence: rule.confidence,
            amount: transaction.amount,
            description: transaction.originalDescription.substring(0, 50)
          });
          
          break;
        }
      }

      if (wasProcessed) return;

      // Categorize personal expenses
      for (const rule of categorizationRules.personalExpenses) {
        if (rule.pattern.test(transaction.originalDescription) && transaction.amount < 0) {
          const sourceTransactions = [transaction];
          const expenseEntry = {
            id: Date.now() + Math.random(),
            description: rule.description,
            amount: Math.abs(transaction.amount),
            period: 'monthly',
            category: rule.category,
            dataSource: 'auto-detected',
            confidence: rule.confidence,
            sourceTransactions,
            isExcluded: true,
            exclusionReason: 'Personal expense as per provisional tax requirements',
            notes: `Auto-detected from: ${transaction.originalDescription}`
          };
          
          categorized.personal.push(expenseEntry);
          categorizedCount++;
          wasProcessed = true;
          
          logMessage('debug', 'categorization', `Personal expense categorized (excluded)`, {
            rule: rule.category,
            confidence: rule.confidence,
            amount: transaction.amount,
            description: transaction.originalDescription.substring(0, 50)
          });
          
          break;
        }
      }

      if (wasProcessed) return;

      // Categorize home expenses
      for (const rule of categorizationRules.homeExpenses) {
        if (rule.pattern.test(transaction.originalDescription)) {
          const sourceTransactions = [transaction];
          const expenseEntry = {
            id: Date.now() + Math.random(),
            description: rule.description,
            amount: Math.abs(transaction.amount),
            period: 'monthly',
            category: rule.category,
            dataSource: 'auto-detected',
            confidence: rule.confidence,
            sourceTransactions,
            notes: `Auto-detected from: ${transaction.originalDescription}`
          };
          
          categorized.home.push(expenseEntry);
          categorizedCount++;
          wasProcessed = true;
          
          logMessage('debug', 'categorization', `Home expense categorized`, {
            rule: rule.category,
            confidence: rule.confidence,
            amount: transaction.amount,
            description: transaction.originalDescription.substring(0, 50)
          });
          
          break;
        }
      }

      // If not categorized and significant amount, add to uncategorized
      if (!wasProcessed && Math.abs(transaction.amount) > 50) {
        categorized.uncategorized.push({
          ...transaction,
          reason: 'Could not automatically categorize this transaction'
        });
        
        if (debugMode && categorized.uncategorized.length <= 10) {
          logMessage('debug', 'categorization', `Transaction uncategorized`, {
            description: transaction.originalDescription.substring(0, 50),
            amount: transaction.amount,
            reason: 'No matching categorization rule'
          });
        }
      }
    });

    // Calculate home office deductions
    if (categorized.home.length > 0) {
      logMessage('info', 'categorization', 'Calculating home office deductions');
      
      const mortgageInterest = categorized.home
        .filter(expense => expense.category === 'Mortgage' && expense.description.includes('Interest'))
        .reduce((sum, expense) => sum + calculateAnnualAmount(expense.amount, expense.period), 0);
      
      const homeInsurance = categorized.home
        .filter(expense => expense.category === 'Insurance')
        .reduce((sum, expense) => sum + calculateAnnualAmount(expense.amount, expense.period), 0);

      if (mortgageInterest > 0) {
        categorized.business.push({
          id: Date.now() + Math.random(),
          description: `Home Office Deduction - Mortgage Interest (${homeOfficePercentage}%)`,
          amount: (mortgageInterest * homeOfficePercentage / 100) / 12,
          period: 'monthly',
          category: 'Office',
          dataSource: 'calculated',
          confidence: 1.0,
          notes: `${homeOfficePercentage}% of R${mortgageInterest.toFixed(2)} annual mortgage interest`
        });
        
        logMessage('info', 'categorization', 'Home office mortgage interest deduction calculated', {
          annualMortgageInterest: mortgageInterest,
          homeOfficePercentage: homeOfficePercentage,
          monthlyDeduction: (mortgageInterest * homeOfficePercentage / 100) / 12
        });
      }

      if (homeInsurance > 0) {
        categorized.business.push({
          id: Date.now() + Math.random(),
          description: `Home Office Deduction - Home Insurance (${homeOfficePercentage}%)`,
          amount: (homeInsurance * homeOfficePercentage / 100) / 12,
          period: 'monthly',
          category: 'Office',
          dataSource: 'calculated',
          confidence: 1.0,
          notes: `${homeOfficePercentage}% of R${homeInsurance.toFixed(2)} annual home insurance`
        });
        
        logMessage('info', 'categorization', 'Home office insurance deduction calculated', {
          annualHomeInsurance: homeInsurance,
          homeOfficePercentage: homeOfficePercentage,
          monthlyDeduction: (homeInsurance * homeOfficePercentage / 100) / 12
        });
      }
    }

    const categorizationSummary = {
      totalTransactions: transactions.length,
      categorized: categorizedCount,
      excluded: excludedCount,
      uncategorized: categorized.uncategorized.length,
      income: categorized.income.length,
      business: categorized.business.length,
      personal: categorized.personal.length,
      home: categorized.home.length,
      categorizationRate: `${((categorizedCount / transactions.length) * 100).toFixed(1)}%`
    };

    logMessage('info', 'categorization', 'Categorization completed', categorizationSummary);

    return categorized;
  };

  // CRUD operations
  const addIncomeEntry = () => {
    const newEntry = {
      id: Date.now(),
      description: '',
      amount: 0,
      period: 'monthly',
      source: 'Other',
      dataSource: 'manual',
      notes: ''
    };
    setIncomeEntries([...incomeEntries, newEntry]);
    setEditingEntry({ type: 'income', id: newEntry.id });
  };

  const addExpenseEntry = (type) => {
    const newEntry = {
      id: Date.now(),
      description: '',
      amount: 0,
      period: 'monthly',
      category: type === 'business' ? 'Other' : 'Personal',
      dataSource: 'manual',
      notes: ''
    };
    
    if (type === 'business') {
      setBusinessExpenses([...businessExpenses, newEntry]);
    } else {
      setPersonalExpenses([...personalExpenses, newEntry]);
    }
    setEditingEntry({ type: type === 'business' ? 'expense' : 'personal', id: newEntry.id });
  };

  const updateIncomeEntry = (id, field, value) => {
    setIncomeEntries(prev => prev.map(entry =>
      entry.id === id ? { ...entry, [field]: value, dataSource: 'modified' } : entry
    ));
  };

  const updateExpenseEntry = (id, field, value) => {
    setBusinessExpenses(prev => prev.map(entry =>
      entry.id === id ? { ...entry, [field]: value, dataSource: 'modified' } : entry
    ));
  };

  const updatePersonalExpense = (id, field, value) => {
    setPersonalExpenses(prev => prev.map(entry =>
      entry.id === id ? { ...entry, [field]: value, dataSource: 'modified' } : entry
    ));
  };

  const deleteIncomeEntry = (id) => {
    setIncomeEntries(prev => prev.filter(entry => entry.id !== id));
    setEditingEntry(null);
  };

  const deleteExpenseEntry = (id) => {
    setBusinessExpenses(prev => prev.filter(entry => entry.id !== id));
    setEditingEntry(null);
  };

  const deletePersonalExpense = (id) => {
    setPersonalExpenses(prev => prev.filter(entry => entry.id !== id));
    setEditingEntry(null);
  };

  // Helper functions for moving transactions between categories
  const moveTransactionToCategory = (transaction, targetCategory) => {
    const baseEntry = {
      id: Date.now() + Math.random(),
      description: transaction.originalDescription,
      amount: Math.abs(transaction.amount),
      period: 'monthly',
      dataSource: 'moved-from-uncategorized',
      confidence: 0.5,
      sourceTransactions: [transaction],
      notes: `Moved from uncategorized on ${new Date().toLocaleDateString()}`
    };

    if (targetCategory === 'income') {
      setIncomeEntries(prev => [...prev, {
        ...baseEntry,
        source: 'Other'
      }]);
    } else if (targetCategory === 'business') {
      setBusinessExpenses(prev => [...prev, {
        ...baseEntry,
        category: 'Other'
      }]);
    } else if (targetCategory === 'personal') {
      setPersonalExpenses(prev => [...prev, {
        ...baseEntry,
        category: 'Personal'
      }]);
    }

    // Remove from uncategorized
    setUncategorizedTransactions(prev => prev.filter(t => t.id !== transaction.id));
  };

  const moveExpenseToPersonal = (expense) => {
    setPersonalExpenses(prev => [...prev, {
      ...expense,
      id: Date.now() + Math.random(),
      dataSource: 'moved-from-business',
      notes: `${expense.notes || ''} (Moved from business expenses on ${new Date().toLocaleDateString()})`
    }]);
    setBusinessExpenses(prev => prev.filter(e => e.id !== expense.id));
  };

  const moveExpenseToBusiness = (expense) => {
    setBusinessExpenses(prev => [...prev, {
      ...expense,
      id: Date.now() + Math.random(),
      dataSource: 'moved-from-personal',
      notes: `${expense.notes || ''} (Moved from personal expenses on ${new Date().toLocaleDateString()})`
    }]);
    setPersonalExpenses(prev => prev.filter(e => e.id !== expense.id));
  };

  // Format currency
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-ZA', {
      style: 'currency',
      currency: 'ZAR'
    }).format(amount);
  };

  // Export functions
  const exportToCSV = () => {
    const csvContent = [
      ["Type", "Description", "Amount", "Period", "Annual Amount", "Category/Source", "Data Source", "Confidence", "Excluded", "Notes"],
      ...incomeEntries.map(entry => [
        "Income", 
        entry.description, 
        entry.amount, 
        entry.period, 
        calculateAnnualAmount(entry.amount, entry.period), 
        entry.source,
        entry.dataSource,
        entry.confidence || 'N/A',
        'No',
        entry.notes || ""
      ]),
      ...businessExpenses.map(expense => [
        "Business Expense", 
        expense.description, 
        expense.amount, 
        expense.period,
        calculateAnnualAmount(expense.amount, expense.period), 
        expense.category,
        expense.dataSource,
        expense.confidence || 'N/A',
        expense.isExcluded ? 'Yes - Not Deductible' : 'No',
        expense.notes || ""
      ]),
      ...personalExpenses.map(expense => [
        "Personal Expense", 
        expense.description, 
        expense.amount, 
        expense.period,
        calculateAnnualAmount(expense.amount, expense.period), 
        expense.category,
        expense.dataSource,
        expense.confidence || 'N/A',
        expense.isExcluded ? 'Yes - Personal' : 'No',
        expense.notes || ""
      ])
    ].map(row => row.join(",")).join("\n");

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sa-tax-calculation-${selectedTaxYear}-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  const exportToPDF = async () => {
    alert('PDF export feature requires jsPDF library. For now, please use CSV export and convert to PDF using your preferred method.');
  };

  // Clear all data
  const clearAllData = () => {
    if (confirm('Are you sure you want to clear all data? This cannot be undone.')) {
      setIncomeEntries([]);
      setBusinessExpenses([]);
      setPersonalExpenses([]);
      setHomeExpenses([]);
      setRawTransactions([]);
      setUploadedFiles([]);
      setUncategorizedTransactions([]);
      setEditingEntry(null);
      clearLogs();
    }
  };

  // Data source badge with exclusion handling
  const getDataSourceBadge = (dataSource, confidence, isExcluded = false) => {
    const badges = {
      'auto-detected': { color: 'bg-blue-100 text-blue-800', text: 'Auto' },
      'manual': { color: 'bg-green-100 text-green-800', text: 'Manual' },
      'modified': { color: 'bg-orange-100 text-orange-800', text: 'Modified' },
      'calculated': { color: 'bg-purple-100 text-purple-800', text: 'Calc' },
      'moved-from-personal': { color: 'bg-gray-100 text-gray-800', text: 'Moved' },
      'moved-from-business': { color: 'bg-gray-100 text-gray-800', text: 'Moved' },
      'moved-from-uncategorized': { color: 'bg-gray-100 text-gray-800', text: 'Moved' },
      'excluded': { color: 'bg-red-100 text-red-800', text: 'Excluded' }
    };
    
    const badge = badges[dataSource] || badges['manual'];
    const confidenceText = confidence ? ` (${Math.round(confidence * 100)}%)` : '';
    
    // Override with exclusion styling if excluded
    const finalBadge = isExcluded ? badges['excluded'] : badge;
    
    return (
      <span className={`px-2 py-1 text-xs rounded-full ${finalBadge.color}`}>
        {finalBadge.text}{confidenceText}
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">SA Provisional Tax Calculator with Smart Categorization</h1>
          <p className="text-gray-600">Intelligent PDF analysis with provisional tax compliance for self-employed professionals</p>
          <div className="mt-2 flex justify-center space-x-4">
            <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm ${
              pdfJsLoaded ? 'bg-green-100 text-green-800' : 'bg-orange-100 text-orange-800'
            }`}>
              <CheckCircle className="mr-1" size={16} />
              PDF.js {pdfJsLoaded ? 'Ready' : 'Loading...'}
            </span>
            {uploadedFiles.length > 0 && (
              <span className="inline-flex items-center px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
                <FileText className="mr-1" size={16} />
                {uploadedFiles.length} files processed
              </span>
            )}
            <span className="inline-flex items-center px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-sm">
              <Calculator className="mr-1" size={16} />
              Provisional Tax Optimized
            </span>
            {debugMode && (
              <span className="inline-flex items-center px-3 py-1 bg-orange-100 text-orange-800 rounded-full text-sm">
                <AlertCircle className="mr-1" size={16} />
                Debug Mode Active
              </span>
            )}
          </div>
        </div>

        {/* Controls Panel */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold flex items-center">
              <Settings className="mr-2" size={20} />
              Controls & Settings
            </h2>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setDebugMode(!debugMode)}
                className={`flex items-center px-3 py-2 rounded-lg font-medium ${
                  debugMode ? 'bg-orange-600 text-white' : 'bg-gray-200 text-gray-700'
                }`}
              >
                <AlertCircle className="mr-1" size={16} />
                Debug {debugMode ? 'ON' : 'OFF'}
              </button>
              
              {processingLogs.length > 0 && (
                <>
                  <button
                    onClick={() => setShowLogs(!showLogs)}
                    className={`flex items-center px-3 py-2 rounded-lg font-medium ${
                      showLogs ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'
                    }`}
                  >
                    <FileText className="mr-1" size={16} />
                    Logs ({processingLogs.length})
                  </button>
                  
                  <button
                    onClick={downloadLogs}
                    className="flex items-center px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                  >
                    <Download className="mr-1" size={16} />
                    Export Logs
                  </button>
                  
                  <button
                    onClick={clearLogs}
                    className="flex items-center px-3 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
                  >
                    <Trash className="mr-1" size={16} />
                    Clear Logs
                  </button>
                </>
              )}
              
              <button
                onClick={() => setEditMode(!editMode)}
                className={`flex items-center px-3 py-2 rounded-lg font-medium ${
                  editMode ? 'bg-green-600 text-white' : 'bg-blue-600 text-white'
                } hover:opacity-90`}
              >
                {editMode ? <Save className="mr-1" size={16} /> : <Edit2 className="mr-1" size={16} />}
                {editMode ? 'Save Changes' : 'Edit Mode'}
              </button>
              
              <button
                onClick={() => setShowTransactionDetails(!showTransactionDetails)}
                className={`flex items-center px-3 py-2 rounded-lg font-medium ${
                  showTransactionDetails ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'
                }`}
              >
                {showTransactionDetails ? <EyeOff className="mr-1" size={16} /> : <Eye className="mr-1" size={16} />}
                Details
              </button>
              
              <button
                onClick={exportToCSV}
                className="flex items-center px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                <Download className="mr-1" size={16} />
                CSV
              </button>
              
              <button
                onClick={exportToPDF}
                className="flex items-center px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                <FileText className="mr-1" size={16} />
                PDF
              </button>
              
              {(rawTransactions.length > 0 || incomeEntries.length > 0 || businessExpenses.length > 0) && (
                <button
                  onClick={clearAllData}
                  className="flex items-center px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                >
                  <Trash className="mr-1" size={16} />
                  Clear
                </button>
              )}
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Tax Year</label>
              <select
                value={selectedTaxYear}
                onChange={(e) => setSelectedTaxYear(parseInt(e.target.value))}
                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                {Object.keys(taxBracketsData).map(year => (
                  <option key={year} value={year}>
                    {year} Tax Year
                  </option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Age Category</label>
              <select
                value={userAge}
                onChange={(e) => setUserAge(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="under65">Under 65</option>
                <option value="under75">65 - 74</option>
                <option value="over75">75 and older</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Home Office %</label>
              <input
                type="number"
                step="0.1"
                value={homeOfficePercentage}
                onChange={(e) => setHomeOfficePercentage(parseFloat(e.target.value) || 0)}
                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">PDF Upload</label>
              <label className={`w-full p-2 ${pdfJsLoaded ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-400 cursor-not-allowed'} text-white rounded-lg cursor-pointer flex items-center justify-center`}>
                <Upload className="mr-2" size={16} />
                Upload PDFs
                <input
                  type="file"
                  accept=".pdf"
                  multiple
                  onChange={handleFileUpload}
                  className="hidden"
                  disabled={isProcessing || !pdfJsLoaded}
                />
              </label>
            </div>
          </div>
          
          {processingStatus && (
            <div className="mt-4 flex items-center space-x-2">
              {isProcessing && <RefreshCw className="animate-spin" size={16} />}
              <span className={`text-sm ${isProcessing ? 'text-blue-600' : processingStatus.includes('Error') ? 'text-red-600' : 'text-green-600'}`}>
                {processingStatus}
              </span>
            </div>
          )}
        </div>

        {/* Comprehensive Logging Viewer */}
        {showLogs && processingLogs.length > 0 && (
          <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-purple-700">
                🔍 Processing Logs & Debug Information
              </h3>
              <div className="flex space-x-2 text-sm">
                <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded">
                  {processingLogs.filter(log => log.level === 'info').length} Info
                </span>
                <span className="px-2 py-1 bg-orange-100 text-orange-800 rounded">
                  {processingLogs.filter(log => log.level === 'warn').length} Warnings
                </span>
                <span className="px-2 py-1 bg-red-100 text-red-800 rounded">
                  {processingLogs.filter(log => log.level === 'error').length} Errors
                </span>
                <span className="px-2 py-1 bg-gray-100 text-gray-800 rounded">
                  {processingLogs.filter(log => log.level === 'debug').length} Debug
                </span>
              </div>
            </div>
            
            {/* Log Categories */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              {/* Processing Summary */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-semibold mb-3 text-gray-800">Processing Summary</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Files Processed:</span>
                    <span className="font-medium">{uploadedFiles.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Total Text Extracted:</span>
                    <span className="font-medium">
                      {extractedTexts.reduce((sum, file) => sum + file.totalTextLength, 0).toLocaleString()} chars
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Transactions Found:</span>
                    <span className="font-medium">{rawTransactions.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Income Items:</span>
                    <span className="font-medium text-green-600">{incomeEntries.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Business Expenses:</span>
                    <span className="font-medium text-blue-600">{businessExpenses.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Personal Expenses:</span>
                    <span className="font-medium text-gray-600">{personalExpenses.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Uncategorized:</span>
                    <span className="font-medium text-orange-600">{uncategorizedTransactions.length}</span>
                  </div>
                </div>
              </div>
              
              {/* Extracted Text Preview */}
              {extractedTexts.length > 0 && (
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-semibold mb-3 text-gray-800">Extracted Text Preview</h4>
                  <div className="space-y-3">
                    {extractedTexts.slice(0, 2).map((file, index) => (
                      <div key={index} className="bg-white rounded p-3 border">
                        <div className="font-medium text-sm mb-2">{file.fileName}</div>
                        <div className="text-xs text-gray-600 mb-2">
                          {file.pageCount} pages • {file.totalTextLength.toLocaleString()} characters
                        </div>
                        <div className="text-xs bg-gray-100 p-2 rounded max-h-32 overflow-y-auto font-mono">
                          {file.allText.substring(0, 500)}...
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            
            {/* Detailed Logs */}
            <div className="max-h-96 overflow-y-auto border border-gray-200 rounded-lg">
              <div className="bg-gray-800 text-white p-3 font-mono text-sm">
                <div className="font-semibold mb-2">📋 Detailed Processing Logs</div>
                {processingLogs.map((log) => (
                  <div key={log.id} className={`mb-2 p-2 rounded ${
                    log.level === 'error' ? 'bg-red-900' :
                    log.level === 'warn' ? 'bg-orange-900' :
                    log.level === 'info' ? 'bg-blue-900' :
                    'bg-gray-700'
                  }`}>
                    <div className="flex items-start space-x-2">
                      <span className="text-gray-300 text-xs">
                        {new Date(log.timestamp).toLocaleTimeString()}
                      </span>
                      <span className={`text-xs px-1 rounded ${
                        log.level === 'error' ? 'bg-red-600' :
                        log.level === 'warn' ? 'bg-orange-600' :
                        log.level === 'info' ? 'bg-blue-600' :
                        'bg-gray-600'
                      }`}>
                        {log.level.toUpperCase()}
                      </span>
                      <span className="text-xs text-purple-300">[{log.category}]</span>
                    </div>
                    <div className="mt-1 text-white">{log.message}</div>
                    {log.data && (
                      <details className="mt-2">
                        <summary className="text-gray-300 text-xs cursor-pointer hover:text-white">
                          📊 View Data
                        </summary>
                        <pre className="mt-1 text-xs bg-gray-900 p-2 rounded overflow-x-auto text-gray-300">
                          {JSON.stringify(log.data, null, 2)}
                        </pre>
                      </details>
                    )}
                  </div>
                ))}
              </div>
            </div>
            
            {/* Quick Actions */}
            <div className="mt-4 flex space-x-2">
              <button
                onClick={() => logMessage('info', 'manual', 'Manual test log entry')}
                className="px-3 py-1 bg-gray-600 text-white rounded text-sm hover:bg-gray-700"
              >
                Test Log
              </button>
              <button
                onClick={() => {
                  const errors = processingLogs.filter(log => log.level === 'error');
                  console.log('Error logs:', errors);
                }}
                className="px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700"
              >
                Console Errors
              </button>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(JSON.stringify(processingLogs, null, 2));
                  alert('Logs copied to clipboard');
                }}
                className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
              >
                Copy to Clipboard
              </button>
            </div>
          </div>
        )}

        {/* File Processing Status */}
        {uploadedFiles.length > 0 && (
          <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
            <h3 className="text-lg font-semibold text-blue-700 mb-4">
              Processing Status ({uploadedFiles.length} files)
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {uploadedFiles.map((file, index) => (
                <div key={index} className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="font-medium text-sm truncate">{file.name}</div>
                  <div className="text-xs text-gray-600 mt-1">
                    {file.transactionCount} transactions • {file.pageCount} pages
                  </div>
                  {file.textLength && (
                    <div className="text-xs text-gray-500">
                      {file.textLength.toLocaleString()} characters extracted
                    </div>
                  )}
                  <div className="text-xs text-gray-500">
                    {file.processedAt.toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Annual Income</p>
                <p className="text-2xl font-bold text-green-600">
                  {formatCurrency(totalAnnualIncome)}
                </p>
                <p className="text-xs text-gray-500">{incomeEntries.length} sources</p>
              </div>
              <DollarSign className="text-green-600" size={32} />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Deductible Expenses</p>
                <p className="text-2xl font-bold text-blue-600">
                  {formatCurrency(totalDeductibleExpenses)}
                </p>
                <p className="text-xs text-gray-500">{businessExpenses.filter(e => !e.isExcluded).length} items</p>
              </div>
              <CheckCircle className="text-blue-600" size={32} />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Taxable Income</p>
                <p className="text-2xl font-bold text-orange-600">
                  {formatCurrency(taxableIncome)}
                </p>
                <p className="text-xs text-gray-500">Effective: {taxCalculation.effectiveRate.toFixed(1)}%</p>
              </div>
              <TrendingUp className="text-orange-600" size={32} />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Annual Tax</p>
                <p className="text-2xl font-bold text-red-600">
                  {formatCurrency(taxCalculation.tax)}
                </p>
                <p className="text-xs text-gray-500">Monthly: {formatCurrency(monthlyTaxRequired)}</p>
              </div>
              <Calculator className="text-red-600" size={32} />
            </div>
          </div>
        </div>

        {/* Uncategorized Transactions */}
        {uncategorizedTransactions.length > 0 && (
          <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-orange-700">
                Review Required ({uncategorizedTransactions.length})
              </h3>
              <span className="text-sm text-gray-600">Manual review needed</span>
            </div>
            
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-4">
              <div className="flex items-start space-x-3">
                <AlertCircle className="text-orange-600 mt-1" size={20} />
                <div>
                  <h4 className="font-semibold text-orange-800 mb-1">Manual Review Required</h4>
                  <p className="text-orange-700 text-sm">
                    These transactions need your attention. TAKEALOT purchases require PDF invoice verification to separate business from personal items.
                    Inter-bank payments, interest income, and bank charges are automatically excluded from business calculations.
                  </p>
                </div>
              </div>
            </div>
            
            <div className="space-y-3">
              {uncategorizedTransactions.map((transaction) => (
                <div key={transaction.id} className={`p-4 rounded-lg border-l-4 ${
                  transaction.category === 'takealot-review' ? 'bg-yellow-50 border-yellow-500' : 'bg-gray-50 border-orange-500'
                }`}>
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="font-medium">{transaction.originalDescription}</div>
                      <div className="text-sm text-gray-600">
                        {transaction.date} • {formatCurrency(transaction.amount)} • {transaction.type}
                      </div>
                      {transaction.category === 'takealot-review' && (
                        <div className="mt-2 p-2 bg-yellow-100 rounded text-sm">
                          <strong>⚠️ TAKEALOT PURCHASE:</strong> Review PDF invoice to identify business items (stationery, computer equipment) vs personal items (e.g., football)
                        </div>
                      )}
                      {transaction.reason && (
                        <div className="text-xs text-gray-500 mt-1">
                          Reason: {transaction.reason}
                        </div>
                      )}
                      <div className="text-xs text-gray-500 mt-1">
                        From: {transaction.sourceFile}
                      </div>
                    </div>
                    
                    <div className="flex space-x-2 ml-4">
                      {transaction.category !== 'takealot-review' && (
                        <>
                          <button
                            onClick={() => moveTransactionToCategory(transaction, 'income')}
                            className="px-3 py-1 text-xs bg-green-200 text-green-700 rounded hover:bg-green-300"
                            title="Move to Income"
                          >
                            Income
                          </button>
                          <button
                            onClick={() => moveTransactionToCategory(transaction, 'business')}
                            className="px-3 py-1 text-xs bg-blue-200 text-blue-700 rounded hover:bg-blue-300"
                            title="Move to Business Expenses"
                          >
                            Business
                          </button>
                          <button
                            onClick={() => moveTransactionToCategory(transaction, 'personal')}
                            className="px-3 py-1 text-xs bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                            title="Move to Personal Expenses"
                          >
                            Personal
                          </button>
                        </>
                      )}
                      {transaction.category === 'takealot-review' && (
                        <div className="text-xs text-yellow-700 font-medium">
                          Manual Invoice Review Required
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Income Section */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-green-700">Income Sources</h3>
            <div className="flex space-x-2">
              {editMode && (
                <button
                  onClick={addIncomeEntry}
                  className="flex items-center px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  <Plus className="mr-1" size={16} />
                  Add Income
                </button>
              )}
              <span className="text-sm text-gray-600">
                {incomeEntries.length} sources • {formatCurrency(totalAnnualIncome)} total
              </span>
            </div>
          </div>
          
          <div className="space-y-3">
            {incomeEntries.length === 0 ? (
              <div className="text-center text-gray-500 py-8">
                <FileUp className="mx-auto mb-4" size={48} />
                <p>No income sources found.</p>
                <p className="text-sm">Upload PDF bank statements or add manually to get started.</p>
              </div>
            ) : (
              incomeEntries.map((entry) => (
                <div key={entry.id} className="p-4 bg-gray-50 rounded-lg border-l-4 border-green-500">
                  {editMode && editingEntry?.type === 'income' && editingEntry?.id === entry.id ? (
                    <div className="space-y-3">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <input
                          type="text"
                          value={entry.description}
                          onChange={(e) => updateIncomeEntry(entry.id, 'description', e.target.value)}
                          className="p-2 border border-gray-300 rounded"
                          placeholder="Description"
                        />
                        <input
                          type="number"
                          step="0.01"
                          value={entry.amount}
                          onChange={(e) => updateIncomeEntry(entry.id, 'amount', e.target.value)}
                          className="p-2 border border-gray-300 rounded"
                          placeholder="Amount"
                        />
                        <select
                          value={entry.source}
                          onChange={(e) => updateIncomeEntry(entry.id, 'source', e.target.value)}
                          className="p-2 border border-gray-300 rounded"
                        >
                          {incomeCategories.map(cat => (
                            <option key={cat} value={cat}>{cat}</option>
                          ))}
                        </select>
                      </div>
                      <input
                        type="text"
                        value={entry.notes || ''}
                        onChange={(e) => updateIncomeEntry(entry.id, 'notes', e.target.value)}
                        className="w-full p-2 border border-gray-300 rounded"
                        placeholder="Notes"
                      />
                      <div className="flex space-x-2">
                        <button
                          onClick={() => setEditingEntry(null)}
                          className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => deleteIncomeEntry(entry.id)}
                          className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        {getDataSourceBadge(entry.dataSource, entry.confidence, false)}
                        <span className="font-medium text-lg">{entry.description}</span>
                        {editMode && (
                          <button
                            onClick={() => setEditingEntry({ type: 'income', id: entry.id })}
                            className="p-1 text-blue-600 hover:bg-blue-100 rounded"
                          >
                            <Edit2 size={16} />
                          </button>
                        )}
                      </div>
                      <div className="text-right">
                        <div className="text-xl font-bold text-green-600">
                          {formatCurrency(calculateAnnualAmount(entry.amount, entry.period))}
                        </div>
                        <div className="text-sm text-gray-600">{entry.source}</div>
                      </div>
                    </div>
                  )}
                  
                  {entry.notes && !editMode && (
                    <div className="mt-2 text-sm text-gray-600">💡 {entry.notes}</div>
                  )}
                  
                  {showTransactionDetails && entry.sourceTransactions && (
                    <div className="mt-3 p-3 bg-white rounded border">
                      <div className="text-xs font-medium text-gray-600 mb-2">Source Transactions:</div>
                      {entry.sourceTransactions.slice(0, 5).map((transaction, idx) => (
                        <div key={idx} className="text-xs text-gray-500 flex justify-between mb-1">
                          <span>{transaction.date}: {transaction.originalDescription}</span>
                          <span>{formatCurrency(transaction.amount)}</span>
                        </div>
                      ))}
                      {entry.sourceTransactions.length > 5 && (
                        <div className="text-xs text-gray-400">
                          ... and {entry.sourceTransactions.length - 5} more transactions
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Empty State */}
        {incomeEntries.length === 0 && businessExpenses.length === 0 && personalExpenses.length === 0 && uploadedFiles.length === 0 && (
          <div className="bg-white rounded-lg shadow-lg p-12 text-center">
            <div className="flex items-center justify-center mb-6 space-x-4">
              <FileUp className="text-blue-600" size={64} />
              <div className={`px-3 py-1 rounded-full text-sm ${
                pdfJsLoaded ? 'bg-green-100 text-green-800' : 'bg-orange-100 text-orange-800'
              }`}>
                PDF.js {pdfJsLoaded ? 'Ready' : 'Loading...'}
              </div>
              {debugMode && (
                <div className="px-3 py-1 bg-orange-100 text-orange-800 rounded-full text-sm">
                  Debug Mode Active
                </div>
              )}
            </div>
            <h3 className="text-2xl font-bold text-gray-800 mb-4">SA Provisional Tax Calculator with Smart Categorization & Debugging</h3>
            <p className="text-gray-600 mb-6 max-w-2xl mx-auto">
              Upload your bank statement PDFs for intelligent transaction categorization optimized for provisional tax payers. 
              Automatically identifies Precise Digitait income, excludes inter-bank payments, interest income, and bank charges.
              Personal expenses (Virgin gym, Old Mutual investments, Netflix, Apple, YouTube, SABC, CARTRACK) are automatically excluded.
              TAKEALOT purchases require manual PDF invoice review to separate business items from personal.
            </p>
            
            {debugMode && (
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-6 max-w-2xl mx-auto">
                <div className="flex items-start space-x-3">
                  <AlertCircle className="text-orange-600 mt-1" size={20} />
                  <div className="text-left">
                    <h4 className="font-semibold text-orange-800 mb-1">🔍 Debug Mode Active</h4>
                    <p className="text-orange-700 text-sm">
                      Comprehensive logging is enabled. All PDF processing steps will be tracked including:
                      text extraction, regex pattern matching, transaction parsing, and categorization decisions.
                      Use this mode to troubleshoot PDF parsing issues.
                    </p>
                  </div>
                </div>
              </div>
            )}
            
            <label className={`inline-flex items-center px-6 py-3 ${
              pdfJsLoaded ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-400 cursor-not-allowed'
            } text-white rounded-lg cursor-pointer text-lg`}>
              <Upload className="mr-2" size={20} />
              Upload Bank Statement PDFs
              <input
                type="file"
                accept=".pdf"
                multiple
                onChange={handleFileUpload}
                className="hidden"
                disabled={isProcessing || !pdfJsLoaded}
              />
            </label>
            
            <div className="mt-6 space-y-2">
              <p className="text-sm text-gray-500">
                Optimized for provisional tax payers • Supports Standard Bank, FNB, ABSA, Nedbank, and Capitec<br/>
                Automatically applies {homeOfficePercentage}% home office deduction • Excludes non-deductible personal expenses
              </p>
              
              {!debugMode && (
                <p className="text-xs text-gray-400">
                  💡 Enable Debug Mode above if you're experiencing PDF parsing issues
                </p>
              )}
              
              <p className="text-xs text-gray-400">
                🔧 Debug features: comprehensive logging, text extraction preview, pattern matching analysis, categorization tracking
              </p>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="text-center text-gray-600 text-sm">
          <p>⚖️ Please consult with a qualified tax practitioner for official tax filing and advice</p>
          <p className="mt-2 font-medium">Generated: {new Date().toLocaleString()}</p>
          {debugMode && (
            <p className="mt-1 text-orange-600 font-medium">🔍 Debug Mode: Comprehensive logging active</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default SATaxCalculator;