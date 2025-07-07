"use client";

import React, { useState, useEffect } from 'react';
import { Upload, Download, FileText, DollarSign, TrendingUp, Calculator, CheckCircle, AlertCircle, X, Edit2, Save, Plus, Trash, Eye, EyeOff, Settings, RefreshCw, FileUp } from 'lucide-react';

const SATaxCalculator = () => {
  // Helper functions
  function getCurrentTaxYear() {
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth(); // 0-indexed: 0=Jan, 1=Feb, 2=Mar
    // SA tax year runs March 1 to Feb 28/29
    // If we're in March or later, we're in the next tax year
    return currentMonth >= 2 ? currentYear + 1 : currentYear;
  }

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
    },
    2026: {
      brackets: [
        { min: 0, max: 273450, rate: 0.18 },
        { min: 273450, max: 428550, rate: 0.26 },
        { min: 428550, max: 593300, rate: 0.31 },
        { min: 593300, max: 778150, rate: 0.36 },
        { min: 778150, max: 991300, rate: 0.39 },
        { min: 991300, max: 2100000, rate: 0.41 },
        { min: 2100000, max: Infinity, rate: 0.45 }
      ],
      rebates: {
        under65: 19920,
        under75: 19920 + 10920,
        over75: 19920 + 10920 + 3640
      }
    }
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
          
          // Extract text items with proper spacing and line breaks
          const pageText = textContent.items
            .map(item => item.str)
            .join(' ')
            .replace(/\s+/g, ' ') // Normalize multiple spaces
            .replace(/([A-Z]{2,})\s+([A-Z])/g, '$1 $2') // Fix spacing between words
            .replace(/(\d{2}\s+\w{3})\s+/g, '\n$1   ') // Add line breaks before dates
            .replace(/balance.*?\n/gi, '\n') // Remove balance header lines
            .replace(/date.*?description.*?\n/gi, '\n') // Remove header lines
            .trim();
          
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
    
    // Updated regex patterns for Standard Bank format
    const patterns = {
      // Standard Bank format: "02 Dec   DESCRIPTION   - type   - amount   balance"
      standardBank: /(\d{2}\s+\w{3})\s+(.+?)\s+-\s*(.+?)\s+-\s*([\d\s,.]+)\s+([\d\s,.]+)$/,
      // Standard Bank credit format: "02 Dec   DESCRIPTION   - type   + amount   balance"  
      standardBankCredit: /(\d{2}\s+\w{3})\s+(.+?)\s+-\s*(.+?)\s+\+\s*([\d\s,.]+)\s+([\d\s,.]+)$/,
      // Alternative Standard Bank format with more spaces
      standardBankAlt: /(\d{2}\s+\w{3})\s+(.+?)\s+([+-])\s*([\d\s,.]+)\s+([\d\s,.]+)$/,
      // Generic pattern for any date format
      genericTransaction: /(\d{1,2}\s+\w{3}|\d{1,2}[\/\-]\d{1,2})\s+(.+?)\s+([+-])\s*([\d\s,.]+)\s+([\d\s,.]+)$/
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
      
      // Skip header lines, short lines, and lines without amounts
      if (line.length < 20 || 
          line.includes('Date') || 
          line.includes('Description') || 
          line.includes('Balance') ||
          line.includes('Customer Care') ||
          line.includes('Website') ||
          !line.match(/[\d\s,.]+/)) {
        continue;
      }
      
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
            let date, description, transactionType, amount, balance, isCredit = false;
            
            if (patternName === 'standardBank') {
              [, date, description, transactionType, amount, balance] = match;
              isCredit = false;
            } else if (patternName === 'standardBankCredit') {
              [, date, description, transactionType, amount, balance] = match;
              isCredit = true;
            } else {
              [, date, description, sign, amount, balance] = match;
              isCredit = sign === '+';
              transactionType = isCredit ? 'credit' : 'debit';
            }
            
            // Clean and parse amounts - handle spaces in numbers
            const cleanAmount = amount.replace(/\s/g, '').replace(/[^\d.]/g, '');
            const cleanBalance = balance ? balance.replace(/\s/g, '').replace(/[^\d.-]/g, '') : '0';
            
            const numAmount = parseFloat(cleanAmount);
            const numBalance = parseFloat(cleanBalance);
            
            if (!isNaN(numAmount) && numAmount > 1) {
              const finalAmount = isCredit ? numAmount : -numAmount;
              
              const transaction = {
                id: Date.now() + Math.random(),
                date: date.trim(),
                originalDescription: `${description.trim()} - ${transactionType}`.replace(/\s+/g, ' '),
                amount: finalAmount,
                balance: numBalance || 0,
                type: isCredit ? 'credit' : 'debit',
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
              if (debugMode) {
                logMessage('debug', 'transaction-parse', `Invalid amount parsed: ${cleanAmount} from line: ${line.substring(0, 100)}`);
              }
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
      
      if (!matched && debugMode && i < 50 && line.length > 30) {
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
    logMessage('info', 'categorization', `Starting simplified categorization of ${transactions.length} transactions`);
    
    const categorized = {
      income: [],
      business: [],
      personal: [],
      home: [],
      uncategorized: []
    };

    let excludedCount = 0;

    transactions.forEach((transaction, index) => {
      let wasProcessed = false;
      
      // Only auto-exclude obvious bank fees and internal transfers
      const excludePatterns = [
        /fixed monthly fee|overdraft service fee|UCOUNT.*membership fee/i,
        /fee.*mu primary sms|ADMINISTRATION FEE HL|fee.*account.*validation/i,
        /honouring fee|ELECTRONIC PMT.*FEE|INTER ACC TRANSFER FEE/i,
        /INTERNATIONAL TXN FEE|PREPAID FEE|#.*FEE/i,
        /CASH FINANCE CHARGE|FINANCE CHARGE/i,
        /CREDIT INTEREST|excess interest|INTEREST.*CREDIT/i,
        /rtd.not provided for|DEBIT ORDER REVERSAL|reversal/i,
        /Ces.*ib transfer|FUND TRANSFERS.*MARSH|INT ACNT TRF.*Ces|AUTOBANK TRANSFER.*AC/i,
        /ib payment.*JACKIE|JACKIE.*ib payment/i,
        /Withdraw.*real time transfer/i,
        /autobank cash withdrawal/i
      ];
      
      for (const pattern of excludePatterns) {
        if (pattern.test(transaction.originalDescription)) {
          excludedCount++;
          wasProcessed = true;
          
          if (debugMode && excludedCount <= 10) {
            logMessage('debug', 'categorization', `Transaction auto-excluded`, {
              description: transaction.originalDescription,
              pattern: pattern.toString(),
              amount: transaction.amount
            });
          }
          break;
        }
      }
      
      if (wasProcessed) return;

      // Auto-detect only very obvious items
      // 1. Clear income patterns
      const obviousIncomePatterns = [
        { pattern: /PRECISE DIGIT.*teletransmission.*inward/i, category: "Freelance", source: "NZ Company Income (Precise Digitait)" },
        { pattern: /CASHFOCUS SALARY.*credit transfer/i, category: "Employment", source: "Employment Income" }
      ];

      for (const rule of obviousIncomePatterns) {
        if (rule.pattern.test(transaction.originalDescription) && transaction.amount > 0) {
          const incomeEntry = {
            id: Date.now() + Math.random(),
            description: rule.source,
            amount: Math.abs(transaction.amount),
            period: 'monthly',
            source: rule.category,
            dataSource: 'auto-detected',
            confidence: 0.95,
            sourceTransactions: [transaction],
            notes: `Auto-detected from: ${transaction.originalDescription}`
          };
          
          categorized.income.push(incomeEntry);
          wasProcessed = true;
          
          logMessage('debug', 'categorization', `Income auto-categorized`, {
            rule: rule.category,
            amount: transaction.amount,
            description: transaction.originalDescription.substring(0, 50)
          });
          
          break;
        }
      }

      if (wasProcessed) return;

      // 2. Very obvious business expenses (high confidence only)
      const obviousBusinessPatterns = [
        { pattern: /10XRA COL.*service agreement|10X RETIREMENT ANN.*ib payment/i, category: "Retirement", description: "Retirement Annuity Contribution" },
        { pattern: /DISC PREM.*medical aid.*contribution/i, category: "Medical", description: "Medical Aid Contribution" },
        { pattern: /PERSONAL TAX SERVICE.*PROVTAX.*ib payment/i, category: "Professional", description: "Tax Advisory Services" }
      ];

      for (const rule of obviousBusinessPatterns) {
        if (rule.pattern.test(transaction.originalDescription) && transaction.amount < 0) {
          const expenseEntry = {
            id: Date.now() + Math.random(),
            description: rule.description,
            amount: Math.abs(transaction.amount),
            period: 'monthly',
            category: rule.category,
            dataSource: 'auto-detected',
            confidence: 0.95,
            sourceTransactions: [transaction],
            notes: `Auto-detected from: ${transaction.originalDescription}`
          };
          
          categorized.business.push(expenseEntry);
          wasProcessed = true;
          
          logMessage('debug', 'categorization', `Business expense auto-categorized`, {
            rule: rule.category,
            amount: transaction.amount,
            description: transaction.originalDescription.substring(0, 50)
          });
          
          break;
        }
      }

      if (wasProcessed) return;

      // 3. Home expenses (for home office calculation)
      const homeExpensePatterns = [
        { pattern: /SBSA HOMEL.*std bank bond repayment/i, category: "Mortgage", description: "Home Loan Payment" },
        { pattern: /SYSTEM INTEREST DEBIT.*ID/i, category: "Mortgage", description: "Mortgage Interest" },
        { pattern: /INSURANCE PREMIUM.*IP/i, category: "Insurance", description: "Home Insurance" }
      ];

      for (const rule of homeExpensePatterns) {
        if (rule.pattern.test(transaction.originalDescription)) {
          const expenseEntry = {
            id: Date.now() + Math.random(),
            description: rule.description,
            amount: Math.abs(transaction.amount),
            period: 'monthly',
            category: rule.category,
            dataSource: 'auto-detected',
            confidence: 0.95,
            sourceTransactions: [transaction],
            notes: `Auto-detected from: ${transaction.originalDescription}`
          };
          
          categorized.home.push(expenseEntry);
          wasProcessed = true;
          
          logMessage('debug', 'categorization', `Home expense auto-categorized`, {
            rule: rule.category,
            amount: transaction.amount,
            description: transaction.originalDescription.substring(0, 50)
          });
          
          break;
        }
      }

      if (wasProcessed) return;

      // Everything else goes to uncategorized for manual review
      if (Math.abs(transaction.amount) > 10) { // Only significant amounts
        categorized.uncategorized.push({
          ...transaction,
          reason: 'Requires manual categorization - potential income or business expense'
        });
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
      }
    }

    const categorizationSummary = {
      totalTransactions: transactions.length,
      autoIncome: categorized.income.length,
      autoBusiness: categorized.business.length,
      autoHome: categorized.home.length,
      excluded: excludedCount,
      uncategorized: categorized.uncategorized.length,
      requiresReview: categorized.uncategorized.length
    };

    logMessage('info', 'categorization', 'Simplified categorization completed', categorizationSummary);

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

  // New guided categorization functions
  const categorizeAsIncome = (transaction) => {
    // Show a modal or dropdown to select income type
    const incomeType = prompt(`Categorize as income:\n\n1. Employment\n2. Freelance/Contract\n3. Investment\n4. Rental\n5. Business\n6. Other\n\nEnter number (1-6):`) || '6';
    
    const incomeTypes = {
      '1': 'Employment',
      '2': 'Freelance', 
      '3': 'Investment',
      '4': 'Rental',
      '5': 'Business',
      '6': 'Other'
    };

    const selectedType = incomeTypes[incomeType] || 'Other';
    
    const incomeEntry = {
      id: Date.now() + Math.random(),
      description: transaction.originalDescription,
      amount: Math.abs(transaction.amount),
      period: 'monthly',
      source: selectedType,
      dataSource: 'manual-categorized',
      confidence: 1.0,
      sourceTransactions: [transaction],
      notes: `Manually categorized as ${selectedType} income on ${new Date().toLocaleDateString()}`
    };

    setIncomeEntries(prev => [...prev, incomeEntry]);
    setUncategorizedTransactions(prev => prev.filter(t => t.id !== transaction.id));
    
    logMessage('info', 'manual-categorization', `Transaction categorized as ${selectedType} income`, {
      description: transaction.originalDescription,
      amount: transaction.amount
    });
  };

  const categorizeAsBusiness = (transaction) => {
    // Show options for business expense categories
    const expenseType = prompt(`Categorize as business expense:\n\n1. Office supplies/Equipment\n2. Software/Subscriptions\n3. Professional services\n4. Travel/Fuel\n5. Marketing\n6. Training/Education\n7. Insurance\n8. Medical aid\n9. Retirement contributions\n10. Other\n\nEnter number (1-10):`) || '10';
    
    const expenseTypes = {
      '1': 'Equipment',
      '2': 'Software',
      '3': 'Professional',
      '4': 'Travel',
      '5': 'Marketing',
      '6': 'Education',
      '7': 'Insurance',
      '8': 'Medical',
      '9': 'Retirement',
      '10': 'Other'
    };

    const selectedType = expenseTypes[expenseType] || 'Other';
    
    const expenseEntry = {
      id: Date.now() + Math.random(),
      description: transaction.originalDescription,
      amount: Math.abs(transaction.amount),
      period: 'monthly',
      category: selectedType,
      dataSource: 'manual-categorized',
      confidence: 1.0,
      sourceTransactions: [transaction],
      notes: `Manually categorized as ${selectedType} business expense on ${new Date().toLocaleDateString()}`
    };

    setBusinessExpenses(prev => [...prev, expenseEntry]);
    setUncategorizedTransactions(prev => prev.filter(t => t.id !== transaction.id));
    
    logMessage('info', 'manual-categorization', `Transaction categorized as ${selectedType} business expense`, {
      description: transaction.originalDescription,
      amount: transaction.amount
    });
  };

  const categorizeAsPersonal = (transaction) => {
    const expenseEntry = {
      id: Date.now() + Math.random(),
      description: transaction.originalDescription,
      amount: Math.abs(transaction.amount),
      period: 'monthly',
      category: 'Personal',
      dataSource: 'manual-categorized',
      confidence: 1.0,
      sourceTransactions: [transaction],
      isExcluded: true,
      exclusionReason: 'Personal expense - not deductible',
      notes: `Manually categorized as personal expense on ${new Date().toLocaleDateString()}`
    };

    setPersonalExpenses(prev => [...prev, expenseEntry]);
    setUncategorizedTransactions(prev => prev.filter(t => t.id !== transaction.id));
    
    logMessage('info', 'manual-categorization', `Transaction categorized as personal expense`, {
      description: transaction.originalDescription,
      amount: transaction.amount
    });
  };

  const skipTransaction = (transaction) => {
    // Remove from uncategorized - it won't be included in tax calculations
    setUncategorizedTransactions(prev => prev.filter(t => t.id !== transaction.id));
    
    logMessage('info', 'manual-categorization', `Transaction skipped`, {
      description: transaction.originalDescription,
      amount: transaction.amount,
      reason: 'User chose to skip this transaction'
    });
  };

  const skipAllRemaining = () => {
    if (confirm(`Skip all ${uncategorizedTransactions.length} remaining transactions? They won't be included in tax calculations.`)) {
      logMessage('info', 'manual-categorization', `All remaining transactions skipped`, {
        count: uncategorizedTransactions.length
      });
      setUncategorizedTransactions([]);
    }
  };

  const autoCategorizeSimilar = () => {
    // Simple auto-categorization for remaining items based on keywords
    let categorizedCount = 0;
    const remaining = [...uncategorizedTransactions];
    
    remaining.forEach(transaction => {
      const desc = transaction.originalDescription.toLowerCase();
      let categorized = false;
      
      // Auto-categorize obvious personal expenses
      const personalKeywords = ['netflix', 'youtube', 'virgin', 'woolworths', 'pnp', 'checkers', 'mcd', 'engen', 'bp'];
      if (personalKeywords.some(keyword => desc.includes(keyword)) && transaction.amount < 0) {
        categorizeAsPersonal(transaction);
        categorized = true;
        categorizedCount++;
      }
      
      // Auto-categorize obvious business expenses
      const businessKeywords = ['google', 'microsoft', 'software', 'office', 'claude', 'ai'];
      if (!categorized && businessKeywords.some(keyword => desc.includes(keyword)) && transaction.amount < 0) {
        const expenseEntry = {
          id: Date.now() + Math.random(),
          description: transaction.originalDescription,
          amount: Math.abs(transaction.amount),
          period: 'monthly',
          category: 'Software',
          dataSource: 'auto-categorized-similar',
          confidence: 0.7,
          sourceTransactions: [transaction],
          notes: `Auto-categorized based on keywords on ${new Date().toLocaleDateString()}`
        };
        setBusinessExpenses(prev => [...prev, expenseEntry]);
        setUncategorizedTransactions(prev => prev.filter(t => t.id !== transaction.id));
        categorizedCount++;
      }
    });
    
    if (categorizedCount > 0) {
      alert(`Auto-categorized ${categorizedCount} similar transactions. Please review them in the Income/Expenses tabs.`);
      logMessage('info', 'auto-categorization', `Auto-categorized similar transactions`, {
        count: categorizedCount
      });
    } else {
      alert('No obvious similar transactions found for auto-categorization.');
    }
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
      'manual-categorized': { color: 'bg-green-100 text-green-800', text: 'Manual' },
      'auto-categorized-similar': { color: 'bg-blue-100 text-blue-800', text: 'Auto' },
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

  // Tab navigation
  const tabs = [
    { id: 'overview', name: 'Overview', icon: TrendingUp },
    { id: 'income', name: 'Income', icon: DollarSign },
    { id: 'expenses', name: 'Expenses', icon: CheckCircle },
    { id: 'review', name: 'Review', icon: AlertCircle, count: uncategorizedTransactions.length },
    { id: 'settings', name: 'Settings', icon: Settings }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-800">SA Tax Calculator</h1>
              <p className="text-sm text-gray-600">Smart categorization for provisional tax payers</p>
            </div>
            
            {/* Quick Stats */}
            <div className="flex items-center space-x-6">
              <div className="text-right">
                <div className="text-sm text-gray-600">Annual Income</div>
                <div className="text-lg font-bold text-green-600">{formatCurrency(totalAnnualIncome)}</div>
              </div>
              <div className="text-right">
                <div className="text-sm text-gray-600">Tax Due</div>
                <div className="text-lg font-bold text-red-600">{formatCurrency(taxCalculation.tax)}</div>
              </div>
              <div className="text-right">
                <div className="text-sm text-gray-600">Effective Rate</div>
                <div className="text-lg font-bold text-orange-600">{taxCalculation.effectiveRate.toFixed(1)}%</div>
              </div>
            </div>
            
            {/* Status Indicators */}
            <div className="flex items-center space-x-2">
              <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs ${
                pdfJsLoaded ? 'bg-green-100 text-green-800' : 'bg-orange-100 text-orange-800'
              }`}>
                <CheckCircle className="mr-1" size={12} />
                PDF.js {pdfJsLoaded ? 'Ready' : 'Loading...'}
              </span>
              {uploadedFiles.length > 0 && (
                <span className="inline-flex items-center px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs">
                  <FileText className="mr-1" size={12} />
                  {uploadedFiles.length} files
                </span>
              )}
              {debugMode && (
                <span className="inline-flex items-center px-2 py-1 bg-orange-100 text-orange-800 rounded-full text-xs">
                  <AlertCircle className="mr-1" size={12} />
                  Debug
                </span>
              )}
            </div>
          </div>
          
          {/* Processing Status */}
          {processingStatus && (
            <div className="mt-3 flex items-center space-x-2">
              {isProcessing && <RefreshCw className="animate-spin" size={16} />}
              <span className={`text-sm ${isProcessing ? 'text-blue-600' : processingStatus.includes('Error') ? 'text-red-600' : 'text-green-600'}`}>
                {processingStatus}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4">
          <nav className="flex space-x-8" aria-label="Tabs">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center space-x-2`}
                >
                  <Icon size={16} />
                  <span>{tab.name}</span>
                  {tab.count > 0 && (
                    <span className="bg-red-100 text-red-800 text-xs rounded-full px-2 py-1 min-w-[20px] text-center">
                      {tab.count}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-4">
        {/* Tab Content */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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

            {/* Upload Section for New Users */}
            {incomeEntries.length === 0 && businessExpenses.length === 0 && personalExpenses.length === 0 && uploadedFiles.length === 0 && (
              <div className="bg-white rounded-lg shadow-lg p-12 text-center">
                <div className="flex items-center justify-center mb-6">
                  <FileUp className="text-blue-600" size={64} />
                </div>
                <h3 className="text-2xl font-bold text-gray-800 mb-4">Get Started with Your Tax Calculation</h3>
                <p className="text-gray-600 mb-6 max-w-2xl mx-auto">
                  Upload your bank statement PDFs for intelligent transaction extraction. 
                  The system will read all transactions and let you categorize them as income or business expenses.
                </p>
                
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
                
                <div className="mt-6">
                  <p className="text-sm text-gray-500">
                    Supports Standard Bank, FNB, ABSA, Nedbank, and Capitec<br/>
                    Auto-applies {homeOfficePercentage}% home office deduction • Manual categorization for accuracy
                  </p>
                </div>
              </div>
            )}

            {/* Additional Upload Section for Existing Users */}
            {(incomeEntries.length > 0 || businessExpenses.length > 0 || personalExpenses.length > 0 || uploadedFiles.length > 0) && (
              <div className="bg-white rounded-lg shadow-lg p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-800">Add More Documents</h3>
                    <p className="text-sm text-gray-600">Upload additional bank statements to extract more transactions</p>
                  </div>
                  <label className={`inline-flex items-center px-4 py-2 ${
                    pdfJsLoaded ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-400 cursor-not-allowed'
                  } text-white rounded-lg cursor-pointer`}>
                    <Upload className="mr-2" size={16} />
                    Upload More PDFs
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
            )}

            {/* File Processing Status */}
            {uploadedFiles.length > 0 && (
              <div className="bg-white rounded-lg shadow-lg p-6">
                <h3 className="text-lg font-semibold text-blue-700 mb-4">
                  📁 Processed Files ({uploadedFiles.length})
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {uploadedFiles.map((file, index) => (
                    <div key={index} className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                      <div className="font-medium text-sm truncate">{file.name}</div>
                      <div className="text-xs text-gray-600 mt-1">
                        {file.transactionCount} transactions • {file.pageCount} pages
                      </div>
                      <div className="text-xs text-gray-500">
                        {file.processedAt.toLocaleString()}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Income Tab */}
        {activeTab === 'income' && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow-lg p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-xl font-semibold text-green-700">Income Sources</h3>
                  <p className="text-sm text-gray-600">
                    {incomeEntries.length} sources • {formatCurrency(totalAnnualIncome)} annual total
                  </p>
                </div>
                <div className="flex space-x-3">
                  {editMode && (
                    <button
                      onClick={addIncomeEntry}
                      className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                    >
                      <Plus className="mr-2" size={16} />
                      Add Income
                    </button>
                  )}
                  <button
                    onClick={() => setEditMode(!editMode)}
                    className={`flex items-center px-4 py-2 rounded-lg font-medium ${
                      editMode ? 'bg-green-600 text-white' : 'bg-blue-600 text-white'
                    } hover:opacity-90`}
                  >
                    {editMode ? <Save className="mr-2" size={16} /> : <Edit2 className="mr-2" size={16} />}
                    {editMode ? 'Save Changes' : 'Edit Mode'}
                  </button>
                </div>
              </div>
              
              <div className="space-y-4">
                {incomeEntries.length === 0 ? (
                  <div className="text-center text-gray-500 py-12">
                    <DollarSign className="mx-auto mb-4" size={48} />
                    <p className="text-lg font-medium">No income sources found</p>
                    <p className="text-sm">Upload bank statements or add income manually</p>
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
                            <div>
                              <div className="font-medium text-lg">{entry.description}</div>
                              <div className="text-sm text-gray-600">{entry.source}</div>
                            </div>
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
                            <div className="text-sm text-gray-500">
                              {formatCurrency(entry.amount)} {entry.period}
                            </div>
                          </div>
                        </div>
                      )}
                      
                      {entry.notes && !editMode && (
                        <div className="mt-2 text-sm text-gray-600">💡 {entry.notes}</div>
                      )}
                      
                      {showTransactionDetails && entry.sourceTransactions && (
                        <div className="mt-3 p-3 bg-white rounded border">
                          <div className="text-xs font-medium text-gray-600 mb-2">Source Transactions:</div>
                          {entry.sourceTransactions.slice(0, 3).map((transaction, idx) => (
                            <div key={idx} className="text-xs text-gray-500 flex justify-between mb-1">
                              <span>{transaction.date}: {transaction.originalDescription.substring(0, 50)}...</span>
                              <span>{formatCurrency(transaction.amount)}</span>
                            </div>
                          ))}
                          {entry.sourceTransactions.length > 3 && (
                            <div className="text-xs text-gray-400">
                              ... and {entry.sourceTransactions.length - 3} more transactions
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* Expenses Tab */}
        {activeTab === 'expenses' && (
          <div className="space-y-6">
            {/* Business Expenses */}
            <div className="bg-white rounded-lg shadow-lg p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-xl font-semibold text-blue-700">Business Expenses (Deductible)</h3>
                  <p className="text-sm text-gray-600">
                    {businessExpenses.filter(e => !e.isExcluded).length} deductible items • {formatCurrency(totalDeductibleExpenses)} annual total
                  </p>
                </div>
                <div className="flex space-x-3">
                  {editMode && (
                    <button
                      onClick={() => addExpenseEntry('business')}
                      className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                      <Plus className="mr-2" size={16} />
                      Add Business Expense
                    </button>
                  )}
                  <button
                    onClick={() => setEditMode(!editMode)}
                    className={`flex items-center px-4 py-2 rounded-lg font-medium ${
                      editMode ? 'bg-green-600 text-white' : 'bg-blue-600 text-white'
                    } hover:opacity-90`}
                  >
                    {editMode ? <Save className="mr-2" size={16} /> : <Edit2 className="mr-2" size={16} />}
                    {editMode ? 'Save Changes' : 'Edit Mode'}
                  </button>
                </div>
              </div>
              
              <div className="space-y-4">
                {businessExpenses.length === 0 ? (
                  <div className="text-center text-gray-500 py-12">
                    <CheckCircle className="mx-auto mb-4" size={48} />
                    <p className="text-lg font-medium">No business expenses found</p>
                    <p className="text-sm">Upload bank statements or add expenses manually</p>
                  </div>
                ) : (
                  businessExpenses.map((expense) => (
                    <div key={expense.id} className={`p-4 rounded-lg border-l-4 ${
                      expense.isExcluded ? 'bg-red-50 border-red-500' : 'bg-gray-50 border-blue-500'
                    }`}>
                      {editMode && editingEntry?.type === 'expense' && editingEntry?.id === expense.id ? (
                        <div className="space-y-3">
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <input
                              type="text"
                              value={expense.description}
                              onChange={(e) => updateExpenseEntry(expense.id, 'description', e.target.value)}
                              className="p-2 border border-gray-300 rounded"
                              placeholder="Description"
                            />
                            <input
                              type="number"
                              step="0.01"
                              value={expense.amount}
                              onChange={(e) => updateExpenseEntry(expense.id, 'amount', e.target.value)}
                              className="p-2 border border-gray-300 rounded"
                              placeholder="Amount"
                            />
                            <select
                              value={expense.category}
                              onChange={(e) => updateExpenseEntry(expense.id, 'category', e.target.value)}
                              className="p-2 border border-gray-300 rounded"
                            >
                              {expenseCategories.map(cat => (
                                <option key={cat} value={cat}>{cat}</option>
                              ))}
                            </select>
                          </div>
                          <input
                            type="text"
                            value={expense.notes || ''}
                            onChange={(e) => updateExpenseEntry(expense.id, 'notes', e.target.value)}
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
                              onClick={() => deleteExpenseEntry(expense.id)}
                              className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700"
                            >
                              Delete
                            </button>
                            <button
                              onClick={() => moveExpenseToPersonal(expense)}
                              className="px-3 py-1 bg-gray-600 text-white rounded hover:bg-gray-700"
                            >
                              Move to Personal
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            {getDataSourceBadge(expense.dataSource, expense.confidence, expense.isExcluded)}
                            <div>
                              <div className={`font-medium text-lg ${expense.isExcluded ? 'text-red-600' : 'text-gray-900'}`}>
                                {expense.description}
                              </div>
                              <div className="text-sm text-gray-600">{expense.category}</div>
                              {expense.isExcluded && (
                                <div className="text-xs text-red-600 font-medium">
                                  ⚠️ EXCLUDED: {expense.exclusionReason}
                                </div>
                              )}
                            </div>
                            {editMode && (
                              <button
                                onClick={() => setEditingEntry({ type: 'expense', id: expense.id })}
                                className="p-1 text-blue-600 hover:bg-blue-100 rounded"
                              >
                                <Edit2 size={16} />
                              </button>
                            )}
                          </div>
                          <div className="text-right">
                            <div className={`text-xl font-bold ${expense.isExcluded ? 'text-red-600 line-through' : 'text-blue-600'}`}>
                              {formatCurrency(calculateAnnualAmount(expense.amount, expense.period))}
                            </div>
                            <div className="text-sm text-gray-500">
                              {formatCurrency(expense.amount)} {expense.period}
                            </div>
                          </div>
                        </div>
                      )}
                      
                      {expense.notes && !editMode && (
                        <div className="mt-2 text-sm text-gray-600">💡 {expense.notes}</div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Personal Expenses */}
            <div className="bg-white rounded-lg shadow-lg p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-xl font-semibold text-gray-700">Personal Expenses (Non-Deductible)</h3>
                  <p className="text-sm text-gray-600">
                    {personalExpenses.length} items • {formatCurrency(totalPersonalExpenses)} annual total
                  </p>
                </div>
                <div className="flex space-x-3">
                  {editMode && (
                    <button
                      onClick={() => addExpenseEntry('personal')}
                      className="flex items-center px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
                    >
                      <Plus className="mr-2" size={16} />
                      Add Personal Expense
                    </button>
                  )}
                </div>
              </div>
              
              <div className="space-y-4">
                {personalExpenses.length === 0 ? (
                  <div className="text-center text-gray-500 py-8">
                    <p>No personal expenses categorized</p>
                  </div>
                ) : (
                  personalExpenses.map((expense) => (
                    <div key={expense.id} className="p-4 bg-gray-50 rounded-lg border-l-4 border-gray-500">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          {getDataSourceBadge(expense.dataSource, expense.confidence, true)}
                          <div>
                            <div className="font-medium text-lg text-gray-600">{expense.description}</div>
                            <div className="text-sm text-gray-500">{expense.category}</div>
                          </div>
                          {editMode && (
                            <button
                              onClick={() => moveExpenseToBusiness(expense)}
                              className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                            >
                              Move to Business
                            </button>
                          )}
                        </div>
                        <div className="text-right">
                          <div className="text-xl font-bold text-gray-600 line-through">
                            {formatCurrency(calculateAnnualAmount(expense.amount, expense.period))}
                          </div>
                          <div className="text-sm text-gray-500">Not deductible</div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* Review Tab */}
        {activeTab === 'review' && (
          <div className="space-y-6">
            {uncategorizedTransactions.length > 0 ? (
              <div className="bg-white rounded-lg shadow-lg p-6">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="text-xl font-semibold text-orange-700">Transaction Categorization</h3>
                    <p className="text-sm text-gray-600">
                      {uncategorizedTransactions.length} transactions need categorization • Click buttons to categorize each item
                    </p>
                  </div>
                </div>
                
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                  <div className="flex items-start space-x-3">
                    <AlertCircle className="text-blue-600 mt-1" size={20} />
                    <div>
                      <h4 className="font-semibold text-blue-800 mb-1">Categorization Guide</h4>
                      <div className="text-blue-700 text-sm space-y-1">
                        <p><strong>Income:</strong> Money received for work, services, investments, or business activities</p>
                        <p><strong>Business Expense:</strong> Costs directly related to earning income (office supplies, software, professional fees, etc.)</p>
                        <p><strong>Personal:</strong> Personal spending not related to business (groceries, entertainment, personal shopping)</p>
                        <p><strong>Skip:</strong> Bank fees, transfers between accounts, or items you're unsure about</p>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="space-y-4">
                  {uncategorizedTransactions.map((transaction) => (
                    <div key={transaction.id} className="p-4 bg-gray-50 rounded-lg border-l-4 border-orange-500">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-lg mb-1">{transaction.originalDescription}</div>
                          <div className="flex items-center space-x-4 text-sm text-gray-600 mb-2">
                            <span><strong>Date:</strong> {transaction.date}</span>
                            <span><strong>Amount:</strong> {formatCurrency(Math.abs(transaction.amount))}</span>
                            <span className={`px-2 py-1 rounded text-xs ${
                              transaction.amount > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                            }`}>
                              {transaction.amount > 0 ? 'Money In' : 'Money Out'}
                            </span>
                          </div>
                          <div className="text-xs text-gray-400">
                            Source: {transaction.sourceFile} • Line {transaction.lineNumber}
                          </div>
                        </div>
                        
                        <div className="flex flex-col space-y-2 ml-6 min-w-max">
                          {transaction.amount > 0 ? (
                            // Money coming in - likely income
                            <>
                              <button
                                onClick={() => categorizeAsIncome(transaction)}
                                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium"
                              >
                                💰 Income
                              </button>
                              <button
                                onClick={() => skipTransaction(transaction)}
                                className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 text-sm"
                              >
                                ⏭️ Skip
                              </button>
                            </>
                          ) : (
                            // Money going out - could be business or personal
                            <>
                              <button
                                onClick={() => categorizeAsBusiness(transaction)}
                                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
                              >
                                💼 Business Expense
                              </button>
                              <button
                                onClick={() => categorizeAsPersonal(transaction)}
                                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 text-sm font-medium"
                              >
                                👤 Personal
                              </button>
                              <button
                                onClick={() => skipTransaction(transaction)}
                                className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 text-sm"
                              >
                                ⏭️ Skip
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                      
                      {/* Quick categorization hints */}
                      <div className="mt-3 p-3 bg-blue-50 rounded text-xs">
                        <strong>💡 Quick Hints:</strong>
                        {transaction.originalDescription.toLowerCase().includes('takealo') && 
                          " TAKEALOT - Review invoice: business items (stationery, office supplies) vs personal items"}
                        {transaction.originalDescription.toLowerCase().includes('google') && 
                          " Google services - Could be business software (GSuite, Cloud) or personal (YouTube, Play Store)"}
                        {transaction.originalDescription.toLowerCase().includes('microsoft') && 
                          " Microsoft - Likely business (Office 365) if used for work"}
                        {transaction.originalDescription.toLowerCase().includes('netflix') && 
                          " Netflix - Personal entertainment (not deductible)"}
                        {transaction.originalDescription.toLowerCase().includes('medical') && 
                          " Medical - Could be medical aid (business) or medical expenses"}
                        {transaction.originalDescription.toLowerCase().includes('fuel') && 
                          " Fuel - Business portion deductible if used for work travel"}
                      </div>
                    </div>
                  ))}
                </div>
                
                {/* Bulk actions */}
                <div className="mt-6 p-4 bg-gray-100 rounded-lg">
                  <h4 className="font-semibold text-gray-800 mb-3">Bulk Actions</h4>
                  <div className="flex space-x-3">
                    <button
                      onClick={() => skipAllRemaining()}
                      className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600"
                    >
                      Skip All Remaining
                    </button>
                    <button
                      onClick={() => autoCategorizeSimilar()}
                      className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                    >
                      Auto-categorize Similar
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow-lg p-12 text-center">
                <CheckCircle className="mx-auto mb-4 text-green-600" size={64} />
                <h3 className="text-2xl font-bold text-gray-800 mb-4">All Transactions Categorized!</h3>
                <p className="text-gray-600 mb-6">
                  Excellent! All transactions have been categorized. You can now review your income and expenses in their respective tabs.
                </p>
                <div className="flex justify-center space-x-4">
                  <button
                    onClick={() => setActiveTab('income')}
                    className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700"
                  >
                    Review Income →
                  </button>
                  <button
                    onClick={() => setActiveTab('expenses')}
                    className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    Review Expenses →
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Settings Tab */}
        {activeTab === 'settings' && (
          <div className="space-y-6">
            {/* Tax Settings */}
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h3 className="text-xl font-semibold text-gray-800 mb-6">Tax Settings</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Tax Year</label>
                  <select
                    value={selectedTaxYear}
                    onChange={(e) => setSelectedTaxYear(parseInt(e.target.value))}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
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
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="under65">Under 65</option>
                    <option value="under75">65 - 74</option>
                    <option value="over75">75 and older</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Home Office Percentage</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    value={homeOfficePercentage}
                    onChange={(e) => setHomeOfficePercentage(parseFloat(e.target.value) || 0)}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">Percentage of home expenses deductible for business use</p>
                </div>
              </div>
            </div>

            {/* File Upload */}
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h3 className="text-xl font-semibold text-gray-800 mb-6">Document Upload</h3>
              <div className="space-y-4">
                <label className={`w-full p-6 ${
                  pdfJsLoaded ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-400 cursor-not-allowed'
                } text-white rounded-lg cursor-pointer flex items-center justify-center text-lg font-medium`}>
                  <Upload className="mr-3" size={24} />
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
                <p className="text-sm text-gray-600 text-center">
                  Supports Standard Bank, FNB, ABSA, Nedbank, and Capitec • Multiple files supported
                </p>
              </div>
            </div>

            {/* Debug & Export */}
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h3 className="text-xl font-semibold text-gray-800 mb-6">Debug & Export</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <button
                  onClick={() => setDebugMode(!debugMode)}
                  className={`flex items-center justify-center px-4 py-3 rounded-lg font-medium ${
                    debugMode ? 'bg-orange-600 text-white' : 'bg-gray-200 text-gray-700'
                  }`}
                >
                  <AlertCircle className="mr-2" size={16} />
                  Debug {debugMode ? 'ON' : 'OFF'}
                </button>
                
                <button
                  onClick={() => setShowTransactionDetails(!showTransactionDetails)}
                  className={`flex items-center justify-center px-4 py-3 rounded-lg font-medium ${
                    showTransactionDetails ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'
                  }`}
                >
                  {showTransactionDetails ? <EyeOff className="mr-2" size={16} /> : <Eye className="mr-2" size={16} />}
                  Details
                </button>
                
                <button
                  onClick={exportToCSV}
                  className="flex items-center justify-center px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  <Download className="mr-2" size={16} />
                  Export CSV
                </button>
                
                <button
                  onClick={exportToPDF}
                  className="flex items-center justify-center px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700"
                >
                  <FileText className="mr-2" size={16} />
                  Export PDF
                </button>
              </div>
              
              {processingLogs.length > 0 && (
                <div className="mt-6 space-y-3">
                  <div className="flex justify-between items-center">
                    <h4 className="font-medium text-gray-800">Processing Logs ({processingLogs.length})</h4>
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
                    </div>
                  </div>
                  
                  <div className="flex space-x-3">
                    <button
                      onClick={() => setShowLogs(!showLogs)}
                      className={`flex items-center px-3 py-2 rounded-lg font-medium ${
                        showLogs ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'
                      }`}
                    >
                      <FileText className="mr-1" size={16} />
                      {showLogs ? 'Hide' : 'Show'} Logs
                    </button>
                    
                    <button
                      onClick={downloadLogs}
                      className="flex items-center px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                    >
                      <Download className="mr-1" size={16} />
                      Download Logs
                    </button>
                    
                    <button
                      onClick={clearLogs}
                      className="flex items-center px-3 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
                    >
                      <Trash className="mr-1" size={16} />
                      Clear Logs
                    </button>
                  </div>
                </div>
              )}
              
              {(rawTransactions.length > 0 || incomeEntries.length > 0 || businessExpenses.length > 0) && (
                <div className="mt-6 pt-6 border-t border-gray-200">
                  <button
                    onClick={clearAllData}
                    className="flex items-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                  >
                    <Trash className="mr-2" size={16} />
                    Clear All Data
                  </button>
                  <p className="text-xs text-gray-500 mt-2">This will remove all uploaded data and calculations</p>
                </div>
              )}
            </div>

            {/* Comprehensive Logging Viewer */}
            {showLogs && processingLogs.length > 0 && (
              <div className="bg-white rounded-lg shadow-lg p-6">
                <h3 className="text-lg font-semibold text-purple-700 mb-4">
                  🔍 Processing Logs & Debug Information
                </h3>
                
                {/* Processing Summary */}
                <div className="bg-gray-50 rounded-lg p-4 mb-6">
                  <h4 className="font-semibold mb-3 text-gray-800">Processing Summary</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div className="flex justify-between">
                      <span>Files Processed:</span>
                      <span className="font-medium">{uploadedFiles.length}</span>
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
                  </div>
                </div>
                
                {/* Detailed Logs */}
                <div className="max-h-96 overflow-y-auto border border-gray-200 rounded-lg">
                  <div className="bg-gray-800 text-white p-3 font-mono text-sm">
                    <div className="font-semibold mb-2">📋 Detailed Processing Logs</div>
                    {processingLogs.slice(-50).map((log) => (
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
              </div>
            )}
          </div>
        )}
      </div>
      
      {/* Footer */}
      <div className="text-center text-gray-600 text-sm py-8">
        <p>Current Tax Year: {getCurrentTaxYear()} • Please consult with a qualified tax practitioner for official tax filing and advice</p>
        <p className="mt-2 font-medium">Generated: {new Date().toLocaleString()}</p>
        {debugMode && (
          <p className="mt-1 text-orange-600 font-medium">🔍 Debug Mode: Comprehensive logging active</p>
        )}
      </div>
    </div>
  );
};

export default SATaxCalculator;