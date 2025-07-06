import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Download, Edit2, Save, Plus, Trash2, Calculator, FileText, DollarSign, TrendingUp, AlertCircle, CheckCircle, Settings, Upload, FileUp, RefreshCw, Eye, EyeOff, Trash, ArrowRight, ArrowLeft, ExternalLink, X } from 'lucide-react';

// PDF.js imports - In production, install with: npm install pdfjs-dist
// For now, we'll load from CDN
const PDFJS_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
const PDFJS_WORKER_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

const ProductionTaxCalculator = () => {
  // Auto-detect current tax year
  const getCurrentTaxYear = () => {
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();
    return currentMonth >= 3 ? currentYear + 1 : currentYear;
  };

  // SARS Tax Brackets Data
  const taxBracketsData = {
    2026: {
      brackets: [
        { min: 0, max: 237100, rate: 0.18, cumulative: 0 },
        { min: 237101, max: 370500, rate: 0.26, cumulative: 42678 },
        { min: 370501, max: 512800, rate: 0.31, cumulative: 77362 },
        { min: 512801, max: 673000, rate: 0.36, cumulative: 121475 },
        { min: 673001, max: 857900, rate: 0.39, cumulative: 179147 },
        { min: 857901, max: 1817000, rate: 0.41, cumulative: 251258 },
        { min: 1817001, max: Infinity, rate: 0.45, cumulative: 644489 }
      ],
      rebates: { primary: 17235, secondary: 9444, tertiary: 3145 },
      thresholds: { under65: 95750, under75: 148217, over75: 165689 }
    },
    2025: {
      brackets: [
        { min: 0, max: 237100, rate: 0.18, cumulative: 0 },
        { min: 237101, max: 370500, rate: 0.26, cumulative: 42678 },
        { min: 370501, max: 512800, rate: 0.31, cumulative: 77362 },
        { min: 512801, max: 673000, rate: 0.36, cumulative: 121475 },
        { min: 673001, max: 857900, rate: 0.39, cumulative: 179147 },
        { min: 857901, max: 1817000, rate: 0.41, cumulative: 251258 },
        { min: 1817001, max: Infinity, rate: 0.45, cumulative: 644489 }
      ],
      rebates: { primary: 17235, secondary: 9444, tertiary: 3145 },
      thresholds: { under65: 95750, under75: 148217, over75: 165689 }
    }
  };

  // State management
  const [selectedTaxYear, setSelectedTaxYear] = useState(getCurrentTaxYear());
  const [userAge, setUserAge] = useState('under65');
  const [editMode, setEditMode] = useState(false);
  const [homeOfficePercentage, setHomeOfficePercentage] = useState(8.2);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStatus, setProcessingStatus] = useState('');
  const [showTransactionDetails, setShowTransactionDetails] = useState(false);
  const [pdfJsLoaded, setPdfJsLoaded] = useState(false);

  // Data states
  const [incomeEntries, setIncomeEntries] = useState([]);
  const [businessExpenses, setBusinessExpenses] = useState([]);
  const [personalExpenses, setPersonalExpenses] = useState([]);
  const [homeExpenses, setHomeExpenses] = useState([]);
  const [rawTransactions, setRawTransactions] = useState([]);
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [uncategorizedTransactions, setUncategorizedTransactions] = useState([]);

  // Edit states
  const [editingEntry, setEditingEntry] = useState(null);
  const [showAddModal, setShowAddModal] = useState({ show: false, type: '' });

  // Categories
  const incomeCategories = ["Employment", "Freelance", "Investment", "Rental", "Business", "Other"];
  const expenseCategories = ["Office", "Medical", "Retirement", "Professional", "Education", "Travel", "Equipment", "Software", "Insurance", "Utilities", "Marketing", "Training", "Other"];

  // PDF.js reference
  const pdfjsLib = useRef(null);

  // Load PDF.js library
  useEffect(() => {
    const loadPdfJs = async () => {
      try {
        // Check if PDF.js is already loaded
        if (window.pdfjsLib) {
          pdfjsLib.current = window.pdfjsLib;
          pdfjsLib.current.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_CDN;
          setPdfJsLoaded(true);
          return;
        }

        // Load PDF.js from CDN
        const script = document.createElement('script');
        script.src = PDFJS_CDN;
        script.onload = () => {
          pdfjsLib.current = window.pdfjsLib;
          pdfjsLib.current.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_CDN;
          setPdfJsLoaded(true);
          console.log('PDF.js loaded successfully');
        };
        script.onerror = () => {
          console.error('Failed to load PDF.js');
          setProcessingStatus('Failed to load PDF processing library');
        };
        document.head.appendChild(script);
      } catch (error) {
        console.error('Error loading PDF.js:', error);
        setProcessingStatus('Error loading PDF processing library');
      }
    };

    loadPdfJs();
  }, []);

  // Updated categorization rules based on your specific requirements
  const categorizationRules = {
    income: [
      { pattern: /PRECISE DIGIT.*teletransmission inward/i, category: "Employment", source: "NZ Company Salary", confidence: 0.95 },
      { pattern: /CASHFOCUS SALARY/i, category: "Employment", source: "Cashfocus Salary", confidence: 0.9 },
      { pattern: /teletransmission inward/i, category: "Employment", source: "International Transfer", confidence: 0.8 },
      { pattern: /JACKIE.*ib payment/i, category: "Other Income", source: "Freelance/Contract", confidence: 0.8 },
      { pattern: /ADEYIGA.*ib payment/i, category: "Other Income", source: "Freelance/Contract", confidence: 0.8 },
      { pattern: /SALARY|WAGE/i, category: "Employment", source: "Salary/Wages", confidence: 0.7 },
      { pattern: /DIVIDEND/i, category: "Investment", source: "Dividend Income", confidence: 0.8 },
      { pattern: /INTEREST.*CREDIT/i, category: "Investment", source: "Interest Income", confidence: 0.7 }
    ],
    
    businessExpenses: [
      // Retirement contributions
      { pattern: /10XRA COL.*service agreement/i, category: "Retirement", description: "Retirement Annuity (10X)", confidence: 0.95 },
      
      // Medical expenses
      { pattern: /DISC PREM.*medical aid/i, category: "Medical", description: "Medical Aid Contribution", confidence: 0.95 },
      { pattern: /iK \*Dr Malcol|Dr\s+Malcol/i, category: "Medical", description: "Medical Professional Fees", confidence: 0.9 },
      
      // Business operations
      { pattern: /BOOTLEGGER|SHIFT.*ESPRESS/i, category: "Business", description: "Business Coffee Expenses", confidence: 0.9 },
      { pattern: /ROZPRINT/i, category: "Business", description: "Printing Services", confidence: 0.95 },
      { pattern: /PERSONAL TAX SERVICE|TAX.*ADVISOR/i, category: "Professional", description: "Tax Advisory Services", confidence: 0.9 },
      { pattern: /PAYU \* UC|I PAYU \* UC/i, category: "Education", description: "University of Cape Town", confidence: 0.9 },
      { pattern: /POINT GARDEN SERVICE|GARDEN.*SERVICE/i, category: "Office", description: "Gardening/Maintenance Services", confidence: 0.85 },
      
      // Insurance and professional fees
      { pattern: /DISCINSURE.*insurance|DISCINSURE.*debit transfer/i, category: "Insurance", description: "Insurance Premiums", confidence: 0.85 },
      { pattern: /fee.*teletransmission.*inward|teletransmission.*fee/i, category: "Professional", description: "International Transfer Fees", confidence: 0.9 },
      
      // Software subscriptions (from credit card)
      { pattern: /Google GSUITE|GOOGLE\*GSUITE/i, category: "Software", description: "Google Workspace", confidence: 0.9 },
      { pattern: /MSFT \*|Microsoft/i, category: "Software", description: "Microsoft Office", confidence: 0.9 },
      { pattern: /CLAUDE\.AI SUBSCRIPTION/i, category: "Software", description: "Claude AI", confidence: 0.9 },
      
      // Internet services
      { pattern: /AFRIHOST|INTERNET.*SERVICE/i, category: "Business", description: "Internet Services", confidence: 0.8 }
    ],
    
    personalExpenses: [
      // Explicitly excluded as per your requirements
      { pattern: /VIRGIN ACT.*NETCASH|GYM.*MEMBERSHIP/i, category: "Personal", description: "Gym Membership (EXCLUDED)", confidence: 0.9 },
      { pattern: /OM UNITTRU.*unit trust|OLD MUTUAL.*INVESTMENT/i, category: "Investment", description: "Unit Trust Investment (EXCLUDED)", confidence: 0.9 },
      { pattern: /Netflix|NETFLIX/i, category: "Entertainment", description: "Netflix Subscription (EXCLUDED)", confidence: 0.95 },
      { pattern: /APPLE\.COM|APPLE.*SERVICES/i, category: "Entertainment", description: "Apple Services (EXCLUDED)", confidence: 0.9 },
      { pattern: /YouTube|YOUTUBE|Google YouTube/i, category: "Entertainment", description: "YouTube Premium (EXCLUDED)", confidence: 0.9 },
      { pattern: /SABC.*TV.*LICE|U\*SABC TV/i, category: "Entertainment", description: "SABC TV License (EXCLUDED)", confidence: 0.9 },
      { pattern: /CARTRACK/i, category: "Personal", description: "Vehicle Tracking (EXCLUDED)", confidence: 0.9 },
      { pattern: /MTN PREPAID|CELL.*PHONE|MOBILE/i, category: "Personal", description: "Mobile Phone", confidence: 0.8 }
    ],

    homeExpenses: [
      { pattern: /SBSA HOMEL.*bond repayment|HOME.*LOAN|MORTGAGE/i, category: "Mortgage", description: "Home Loan Payment", confidence: 0.95 },
      { pattern: /SYSTEM INTEREST DEBIT.*ID|MORTGAGE.*INTEREST/i, category: "Mortgage", description: "Mortgage Interest", confidence: 0.95 },
      { pattern: /INSURANCE PREMIUM.*IP|HOME.*INSURANCE/i, category: "Insurance", description: "Home Insurance", confidence: 0.85 },
      { pattern: /MUNICIPAL.*RATES|CITY.*RATES/i, category: "Utilities", description: "Municipal Rates", confidence: 0.85 },
      { pattern: /ELECTRICITY|ESKOM/i, category: "Utilities", description: "Electricity", confidence: 0.9 }
    ],

    // Special handling for TAKEALOT
    takealotPattern: /M\*TAKEALO\*T|TAKEALO.*T/i,
    
    excludePatterns: [
      /Ces - ib transfer|FUND TRANSFERS|INT ACNT TRF|AUTOBANK TRANSFER/i,
      /fixed monthly fee|overdraft service fee|UCOUNT.*membership fee/i,
      /fee.*mu primary sms|ADMINISTRATION FEE HL|rtd-not provided for/i,
      /DEBIT ORDER REVERSAL|excess interest|HONOURING FEE/i,
      /rtd-not provided for|AUTOBANK TRANSFER|DEBIT ORDER REVERSAL/i,
      /INVESTECPB.*debit transfer/i // Investment transfers
    ]
  };

  // Real PDF Text Extraction Function
  const extractTextFromPDF = async (file) => {
    if (!pdfJsLoaded || !pdfjsLib.current) {
      throw new Error('PDF.js library not loaded');
    }

    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.current.getDocument({ data: arrayBuffer }).promise;
      
      let fullText = '';
      const pages = [];
      
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        
        // Extract text items and preserve positioning
        const textItems = textContent.items.map(item => ({
          text: item.str,
          x: item.transform[4],
          y: item.transform[5],
          width: item.width,
          height: item.height
        }));
        
        // Sort by Y position (top to bottom) then X position (left to right)
        textItems.sort((a, b) => {
          if (Math.abs(a.y - b.y) > 5) { // Different lines
            return b.y - a.y; // Top to bottom
          }
          return a.x - b.x; // Left to right on same line
        });
        
        // Group items by line and join
        let currentY = null;
        let currentLine = [];
        const lines = [];
        
        textItems.forEach(item => {
          if (currentY === null || Math.abs(item.y - currentY) > 5) {
            if (currentLine.length > 0) {
              lines.push(currentLine.map(i => i.text).join(' '));
            }
            currentLine = [item];
            currentY = item.y;
          } else {
            currentLine.push(item);
          }
        });
        
        if (currentLine.length > 0) {
          lines.push(currentLine.map(i => i.text).join(' '));
        }
        
        const pageText = lines.join('\n');
        pages.push(pageText);
        fullText += pageText + '\n';
      }
      
      return { fullText, pages, pageCount: pdf.numPages };
    } catch (error) {
      console.error('PDF extraction error:', error);
      throw new Error(`Failed to extract text from PDF: ${error.message}`);
    }
  };

  // Enhanced transaction parsing for multiple bank formats
  const parseTransactions = (text, fileName) => {
    const transactions = [];
    const lines = text.split('\n');
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Skip headers, empty lines, and non-transaction lines
      if (!line || 
          line.includes('Date') || 
          line.includes('Description') || 
          line.includes('Customer Care') || 
          line.includes('Account') ||
          line.includes('Transaction date range') ||
          line.includes('Available balance') ||
          line.length < 10) {
        continue;
      }
      
      // Multiple parsing patterns for different bank formats
      const patterns = [
        // Standard Bank format: "03 Mar PRECISE DIGITAIT25062ZA0706051 - teletransmission inward + 155 112.20 155 070.98"
        {
          regex: /^(\d{1,2}\s+\w{3})\s+(.+?)\s+([+-])\s*([\d\s,]+\.\d{2})\s+([\d\s,]+\.\d{2})$/,
          parse: (match) => {
            const [, date, description, sign, amount, balance] = match;
            return {
              date: date.trim(),
              description: description.trim(),
              amount: parseFloat(amount.replace(/[\s,]/g, '')),
              type: sign === '+' ? 'credit' : 'debit',
              balance: parseFloat(balance.replace(/[\s,]/g, ''))
            };
          }
        },
        
        // Standard Bank fee format: "03 Mar PRECISE DIGITAIT25035ZA0728536 # - fee-teletransmission inward - 542.69 108 413.43"
        {
          regex: /^(\d{1,2}\s+\w{3})\s+(.+?)\s+#\s+-\s+(.+?)\s+-\s+([\d\s,]+\.\d{2})\s+([\d\s,]+\.\d{2})$/,
          parse: (match) => {
            const [, date, reference, description, amount, balance] = match;
            return {
              date: date.trim(),
              description: `${reference.trim()} # - ${description.trim()}`,
              amount: parseFloat(amount.replace(/[\s,]/g, '')),
              type: 'debit',
              balance: parseFloat(balance.replace(/[\s,]/g, ''))
            };
          }
        },
        
        // Alternative format: "Date Description In (R) Out (R) Balance (R)"
        {
          regex: /^(\d{1,2}\s+\w{3})\s+(.+?)\s+(?:\+\s*)?([\d\s,.]+)?\s*-?\s*([\d\s,.]+)?\s*([\d\s,.]+)$/,
          parse: (match) => {
            const [, date, description, inAmount, outAmount, balance] = match;
            const inValue = inAmount ? parseFloat(inAmount.replace(/[\s,]/g, '')) : 0;
            const outValue = outAmount ? parseFloat(outAmount.replace(/[\s,]/g, '')) : 0;
            
            return {
              date: date.trim(),
              description: description.trim(),
              amount: inValue > 0 ? inValue : outValue,
              type: inValue > 0 ? 'credit' : 'debit',
              balance: balance ? parseFloat(balance.replace(/[\s,]/g, '')) : 0
            };
          }
        },
        
        // FNB/ABSA format with C/D indicators
        {
          regex: /^(\d{1,2}\/\d{1,2}\/\d{4})\s+(.+?)\s+([\d,.]+)\s*([CD])\s*([\d,.]+)$/,
          parse: (match) => {
            const [, date, description, amount, type, balance] = match;
            return {
              date: date.trim(),
              description: description.trim(),
              amount: parseFloat(amount.replace(/[,]/g, '')),
              type: type === 'C' ? 'credit' : 'debit',
              balance: parseFloat(balance.replace(/[,]/g, ''))
            };
          }
        }
      ];
      
      let transaction = null;
      
      for (const pattern of patterns) {
        const match = line.match(pattern.regex);
        if (match) {
          try {
            const parsed = pattern.parse(match);
            if (parsed.amount > 0) {
              transaction = {
                id: `${fileName}_${Date.now()}_${Math.random()}`,
                ...parsed,
                sourceFile: fileName,
                rawLine: line
              };
              break;
            }
          } catch (error) {
            console.warn('Error parsing transaction:', error, line);
          }
        }
      }
      
      if (transaction) {
        transactions.push(transaction);
      }
    }
    
    return transactions;
  };

  // Categorize transaction with confidence scoring and special handling
  const categorizeTransaction = (transaction) => {
    const { description, amount, type } = transaction;
    
    // Check exclusion patterns first
    for (const pattern of categorizationRules.excludePatterns) {
      if (pattern.test(description)) {
        return { 
          category: 'exclude', 
          reason: 'Inter-account transfer or bank fee',
          confidence: 0.95
        };
      }
    }

    // Special handling for TAKEALOT - requires manual verification
    if (categorizationRules.takealotPattern.test(description)) {
      return {
        category: 'takealot-review',
        subcategory: 'Supplies',
        confidence: 0.5,
        cleanDescription: 'TAKEALOT Purchase - REQUIRES INVOICE REVIEW',
        originalDescription: description,
        amount: amount,
        reason: 'TAKEALOT purchases need PDF invoice verification to separate business vs personal items',
        specialNote: 'Only include business items (stationery, computer equipment), exclude personal items'
      };
    }
    
    let bestMatch = null;
    let highestConfidence = 0;
    
    const ruleCategories = type === 'credit' ? 
      [categorizationRules.income] : 
      [categorizationRules.homeExpenses, categorizationRules.businessExpenses, categorizationRules.personalExpenses];
    
    for (const ruleSet of ruleCategories) {
      for (const rule of ruleSet) {
        if (rule.pattern.test(description) && rule.confidence > highestConfidence) {
          
          // Special handling for personal expenses - mark as excluded
          const isPersonalExpense = ruleSet === categorizationRules.personalExpenses;
          
          bestMatch = {
            category: type === 'credit' ? 'income' : 
                     ruleSet === categorizationRules.homeExpenses ? 'homeExpense' :
                     isPersonalExpense ? 'personalExpense' : 'businessExpense',
            subcategory: rule.category,
            confidence: rule.confidence,
            cleanDescription: rule.description || rule.source,
            originalDescription: description,
            amount: amount,
            matchedRule: rule.pattern.toString(),
            isExcluded: isPersonalExpense,
            exclusionReason: isPersonalExpense ? 'Personal expense - excluded as per requirements' : null
          };
          highestConfidence = rule.confidence;
        }
      }
    }
    
    return bestMatch || { 
      category: 'uncategorized', 
      originalDescription: description, 
      amount, 
      type, 
      confidence: 0,
      reason: 'No matching categorization rule found'
    };
  };

  // Process uploaded PDF files
  const processPDFFiles = async (files) => {
    if (!pdfJsLoaded) {
      setProcessingStatus('PDF.js library not loaded. Please refresh and try again.');
      return;
    }

    setIsProcessing(true);
    setProcessingStatus('Starting PDF processing...');
    
    const allTransactions = [];
    const processedFiles = [];
    const errors = [];
    
    try {
      for (let fileIndex = 0; fileIndex < files.length; fileIndex++) {
        const file = files[fileIndex];
        setProcessingStatus(`Processing ${file.name} (${fileIndex + 1}/${files.length})...`);
        
        try {
          const extractedData = await extractTextFromPDF(file);
          const transactions = parseTransactions(extractedData.fullText, file.name);
          
          allTransactions.push(...transactions);
          processedFiles.push({
            name: file.name,
            size: file.size,
            transactionCount: transactions.length,
            pageCount: extractedData.pageCount,
            processedAt: new Date()
          });
          
          console.log(`Processed ${file.name}: ${transactions.length} transactions found`);
          
        } catch (fileError) {
          console.error(`Error processing ${file.name}:`, fileError);
          errors.push(`${file.name}: ${fileError.message}`);
        }
      }
      
      if (allTransactions.length === 0) {
        setProcessingStatus('No transactions found in uploaded files. Please check PDF format.');
        return;
      }
      
      setUploadedFiles(prev => [...prev, ...processedFiles]);
      setProcessingStatus(`Categorizing ${allTransactions.length} transactions...`);
      
      // Categorize all transactions
      const categorizedTransactions = allTransactions.map(transaction => {
        const result = categorizeTransaction(transaction);
        return { ...transaction, ...result };
      });
      
      setRawTransactions(prev => [...prev, ...categorizedTransactions]);
      
      // Separate and aggregate transactions by category
      const income = categorizedTransactions.filter(t => t.category === 'income');
      const business = categorizedTransactions.filter(t => t.category === 'businessExpense');
      const personal = categorizedTransactions.filter(t => t.category === 'personalExpense');
      const home = categorizedTransactions.filter(t => t.category === 'homeExpense');
      const uncategorized = categorizedTransactions.filter(t => t.category === 'uncategorized');
      const takealotReview = categorizedTransactions.filter(t => t.category === 'takealot-review');
      
      // Aggregate similar transactions
      const aggregateTransactions = (transactions, excludePersonal = false) => {
        const grouped = {};
        transactions.forEach(t => {
          // Skip personal expenses if excludePersonal is true
          if (excludePersonal && t.isExcluded) {
            return;
          }
          
          const key = `${t.cleanDescription || t.originalDescription}_${t.subcategory}`;
          if (grouped[key]) {
            grouped[key].amount += t.amount;
            grouped[key].transactionCount += 1;
            grouped[key].sourceTransactions.push(t);
          } else {
            grouped[key] = {
              id: Date.now() + Math.random(),
              description: t.cleanDescription || t.originalDescription,
              amount: t.amount,
              period: 'extracted',
              category: t.subcategory,
              dataSource: t.isExcluded ? 'excluded' : 'auto-detected',
              confidence: t.confidence,
              notes: t.isExcluded ? `EXCLUDED: ${t.exclusionReason}` : `Auto-detected from: ${t.originalDescription}`,
              transactionCount: 1,
              sourceTransactions: [t],
              matchedRule: t.matchedRule,
              isExcluded: t.isExcluded || false,
              exclusionReason: t.exclusionReason
            };
          }
        });
        return Object.values(grouped);
      };
      
      // Update state with aggregated transactions
      const newIncome = aggregateTransactions(income).map(entry => ({ ...entry, source: entry.category }));
      const newBusiness = aggregateTransactions(business, true); // Exclude personal expenses
      const newPersonal = aggregateTransactions(personal); // Keep all personal for reference
      const newHome = aggregateTransactions(home);
      
      setIncomeEntries(prev => [...prev, ...newIncome]);
      setBusinessExpenses(prev => [...prev, ...newBusiness]);
      setPersonalExpenses(prev => [...prev, ...newPersonal]);
      setHomeExpenses(prev => [...prev, ...newHome]);
      setUncategorizedTransactions(prev => [...prev, ...uncategorized, ...takealotReview]);
      
      // Calculate home office expenses if home expenses found
      if (home.length > 0) {
        // Only calculate for mortgage interest and home insurance
        const mortgageInterest = home.filter(h => h.subcategory === 'Mortgage' && h.cleanDescription === 'Mortgage Interest');
        const homeInsurance = home.filter(h => h.subcategory === 'Insurance' && h.cleanDescription === 'Home Insurance');
        
        const totalMortgageInterest = mortgageInterest.reduce((sum, expense) => sum + expense.amount, 0);
        const totalHomeInsurance = homeInsurance.reduce((sum, expense) => sum + expense.amount, 0);
        
        const homeOfficeExpenses = [];
        
        if (totalMortgageInterest > 0) {
          const businessMortgageInterest = totalMortgageInterest * (homeOfficePercentage / 100);
          homeOfficeExpenses.push({
            id: Date.now() + Math.random(),
            description: "Home Office - Mortgage Interest",
            amount: businessMortgageInterest,
            period: 'calculated',
            category: 'Office',
            dataSource: 'calculated',
            confidence: 0.9,
            notes: `${homeOfficePercentage}% of mortgage interest (R${totalMortgageInterest.toFixed(2)})`
          });
        }
        
        if (totalHomeInsurance > 0) {
          const businessHomeInsurance = totalHomeInsurance * (homeOfficePercentage / 100);
          homeOfficeExpenses.push({
            id: Date.now() + Math.random(),
            description: "Home Office - Home Insurance",
            amount: businessHomeInsurance,
            period: 'calculated',
            category: 'Office',
            dataSource: 'calculated',
            confidence: 0.9,
            notes: `${homeOfficePercentage}% of home insurance (R${totalHomeInsurance.toFixed(2)})`
          });
        }
        
        if (homeOfficeExpenses.length > 0) {
          setBusinessExpenses(prev => [...prev, ...homeOfficeExpenses]);
        }
      }
      
      let statusMessage = `Successfully processed ${allTransactions.length} transactions from ${processedFiles.length} file(s)`;
      if (errors.length > 0) {
        statusMessage += `. Errors: ${errors.length}`;
      }
      
      setProcessingStatus(statusMessage);
      setTimeout(() => setProcessingStatus(''), 5000);
      
    } catch (error) {
      console.error('Error processing PDFs:', error);
      setProcessingStatus(`Error processing files: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle file upload
  const handleFileUpload = (event) => {
    const files = Array.from(event.target.files);
    if (files.length > 0) {
      // Validate file types
      const pdfFiles = files.filter(file => file.type === 'application/pdf');
      if (pdfFiles.length !== files.length) {
        alert('Please select only PDF files.');
        event.target.value = '';
        return;
      }
      
      processPDFFiles(pdfFiles);
    }
    event.target.value = '';
  };

  // Manual entry functions
  const addIncomeEntry = () => {
    const newEntry = {
      id: Date.now(),
      description: "New Income Source",
      amount: 0,
      period: "annual",
      source: "Employment",
      dataSource: "manual",
      notes: "",
      confidence: 1.0
    };
    setIncomeEntries([...incomeEntries, newEntry]);
    setEditingEntry({ type: 'income', id: newEntry.id });
  };

  const addExpenseEntry = (type = 'business') => {
    const newExpense = {
      id: Date.now(),
      description: type === 'business' ? "New Business Expense" : "New Personal Expense",
      amount: 0,
      period: "annual",
      category: type === 'business' ? "Business" : "Personal",
      dataSource: "manual",
      notes: "",
      confidence: 1.0
    };
    
    if (type === 'business') {
      setBusinessExpenses([...businessExpenses, newExpense]);
    } else {
      setPersonalExpenses([...personalExpenses, newExpense]);
    }
    
    setEditingEntry({ type: type === 'business' ? 'expense' : 'personal', id: newExpense.id });
  };

  // Update functions
  const updateIncomeEntry = (id, field, value) => {
    setIncomeEntries(incomeEntries.map(entry => 
      entry.id === id ? { 
        ...entry, 
        [field]: field === 'amount' ? parseFloat(value) || 0 : value,
        dataSource: entry.dataSource === 'auto-detected' ? 'modified' : entry.dataSource
      } : entry
    ));
  };

  const updateExpenseEntry = (id, field, value) => {
    setBusinessExpenses(businessExpenses.map(expense => 
      expense.id === id ? { 
        ...expense, 
        [field]: field === 'amount' ? parseFloat(value) || 0 : value,
        dataSource: expense.dataSource === 'auto-detected' ? 'modified' : expense.dataSource
      } : expense
    ));
  };

  const updatePersonalExpense = (id, field, value) => {
    setPersonalExpenses(personalExpenses.map(expense => 
      expense.id === id ? { 
        ...expense, 
        [field]: field === 'amount' ? parseFloat(value) || 0 : value,
        dataSource: expense.dataSource === 'auto-detected' ? 'modified' : expense.dataSource
      } : expense
    ));
  };

  // Delete functions
  const deleteIncomeEntry = (id) => {
    setIncomeEntries(incomeEntries.filter(entry => entry.id !== id));
  };

  const deleteExpenseEntry = (id) => {
    setBusinessExpenses(businessExpenses.filter(expense => expense.id !== id));
  };

  const deletePersonalExpense = (id) => {
    setPersonalExpenses(personalExpenses.filter(expense => expense.id !== id));
  };

  // Move functions
  const moveExpenseToBusiness = (personalExpense) => {
    const businessExpense = {
      ...personalExpense,
      id: Date.now(),
      category: "Business",
      dataSource: "moved-from-personal"
    };
    setBusinessExpenses([...businessExpenses, businessExpense]);
    deletePersonalExpense(personalExpense.id);
  };

  const moveExpenseToPersonal = (businessExpense) => {
    const personalExpense = {
      ...businessExpense,
      id: Date.now(),
      category: "Personal",
      dataSource: "moved-from-business"
    };
    setPersonalExpenses([...personalExpenses, personalExpense]);
    deleteExpenseEntry(businessExpense.id);
  };

  const moveTransactionToCategory = (transaction, targetCategory) => {
    const newEntry = {
      id: Date.now() + Math.random(),
      description: transaction.originalDescription,
      amount: transaction.amount,
      period: 'extracted',
      category: targetCategory === 'income' ? 'Other' : targetCategory === 'business' ? 'Other' : 'Personal',
      dataSource: 'manual',
      confidence: 0.8,
      notes: `Manually categorized from: ${transaction.originalDescription}`
    };
    
    if (targetCategory === 'income') {
      setIncomeEntries(prev => [...prev, { ...newEntry, source: 'Other' }]);
    } else if (targetCategory === 'business') {
      setBusinessExpenses(prev => [...prev, newEntry]);
    } else if (targetCategory === 'personal') {
      setPersonalExpenses(prev => [...prev, newEntry]);
    }
    
    setUncategorizedTransactions(prev => prev.filter(t => t.id !== transaction.id));
  };

  // Tax calculation function
  const calculateTax = useCallback((taxableIncome, taxYear, age) => {
    if (taxableIncome <= 0) return { tax: 0, effectiveRate: 0, marginalRate: 0, grossTax: 0, rebates: 0 };
    
    const yearData = taxBracketsData[taxYear];
    if (!yearData) return { tax: 0, effectiveRate: 0, marginalRate: 0, grossTax: 0, rebates: 0 };

    const { brackets, rebates, thresholds } = yearData;
    
    const threshold = age === 'under65' ? thresholds.under65 : 
                     age === 'under75' ? thresholds.under75 : thresholds.over75;
    
    if (taxableIncome <= threshold) {
      return { tax: 0, effectiveRate: 0, marginalRate: 0, grossTax: 0, rebates: 0 };
    }

    let tax = 0;
    let marginalRate = 0;
    
    for (const bracket of brackets) {
      if (taxableIncome > bracket.max) {
        continue;
      } else {
        const incomeInBracket = taxableIncome - (bracket.min - 1);
        tax = bracket.cumulative + (incomeInBracket * bracket.rate);
        marginalRate = bracket.rate;
        break;
      }
    }
    
    let totalRebates = rebates.primary;
    if (age === 'under75') totalRebates += rebates.secondary;
    if (age === 'over75') totalRebates += rebates.secondary + rebates.tertiary;
    
    const finalTax = Math.max(0, tax - totalRebates);
    const effectiveRate = taxableIncome > 0 ? (finalTax / taxableIncome) * 100 : 0;
    
    return { 
      tax: finalTax, 
      effectiveRate, 
      marginalRate: marginalRate * 100,
      grossTax: tax,
      rebates: totalRebates
    };
  }, []);

  // Calculate period amounts
  const calculateAnnualAmount = (amount, period) => {
    switch (period) {
      case 'extracted': return amount;
      case '6months': return amount * 2;
      case '3months': return amount * 4;
      case 'monthly': return amount * 12;
      case 'weekly': return amount * 52;
      case 'annual': return amount;
      default: return amount;
    }
  };

  // Calculate totals - exclude personal expenses from business calculations
  const totalAnnualIncome = incomeEntries.reduce((sum, entry) => 
    sum + calculateAnnualAmount(entry.amount, entry.period), 0);
  const totalBusinessExpenses = businessExpenses
    .filter(expense => !expense.isExcluded) // Only include non-excluded expenses
    .reduce((sum, expense) => sum + calculateAnnualAmount(expense.amount, expense.period), 0);
  const totalPersonalExpenses = personalExpenses.reduce((sum, expense) => 
    sum + calculateAnnualAmount(expense.amount, expense.period), 0);
  const totalDeductibleExpenses = totalBusinessExpenses; // Only business expenses are deductible
  const taxableIncome = Math.max(0, totalAnnualIncome - totalDeductibleExpenses);
  const taxCalculation = calculateTax(taxableIncome, selectedTaxYear, userAge);
  const monthlyTaxRequired = taxCalculation.tax / 12;

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
      ]),
      [],
      ["SUMMARY"],
      ["Total Annual Income", totalAnnualIncome],
      ["Total Deductible Business Expenses", totalDeductibleExpenses],
      ["Total Personal Expenses (Excluded)", totalPersonalExpenses],
      ["Taxable Income", taxableIncome],
      ["Tax Liability", taxCalculation.tax],
      ["Monthly Tax Required", monthlyTaxRequired],
      ["Effective Tax Rate", taxCalculation.effectiveRate.toFixed(2) + "%"],
      ["Marginal Tax Rate", taxCalculation.marginalRate.toFixed(1) + "%"],
      ["Home Office Percentage", homeOfficePercentage + "%"],
      [],
      ["EXCLUSIONS APPLIED"],
      ["Virgin Gym Membership", "Excluded as personal expense"],
      ["Old Mutual Unit Trusts", "Excluded as investment, not retirement"],
      ["Netflix/Apple/YouTube/SABC", "Excluded as personal entertainment"],
      ["CARTRACK Vehicle Tracking", "Excluded as not business expense"],
      ["TAKEALOT Purchases", "Require PDF invoice verification"],
      [],
      ["DATA SOURCES"],
      ["Uploaded PDF Files", uploadedFiles.length],
      ["Auto-detected Transactions", rawTransactions.filter(t => t.confidence > 0.7).length],
      ["Manual Entries", incomeEntries.filter(e => e.dataSource === 'manual').length + businessExpenses.filter(e => e.dataSource === 'manual').length],
      ["Uncategorized Items", uncategorizedTransactions.length]
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
    try {
      const { jsPDF } = await import('jspdf');
      
      const doc = new jsPDF();
      let y = 20;
      
      // Header
      doc.setFontSize(18);
      doc.setFont("helvetica", "bold");
      doc.text("SOUTH AFRICAN TAX CALCULATION REPORT", 20, y);
      y += 10;
      
      doc.setFontSize(14);
      doc.text(`${selectedTaxYear} Tax Year Assessment`, 20, y);
      y += 10;
      
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text(`Generated: ${new Date().toLocaleString()}`, 20, y);
      y += 5;
      doc.text(`PDF Sources: ${uploadedFiles.map(f => f.name).join(', ')}`, 20, y);
      y += 5;
      doc.text(`Transactions Processed: ${rawTransactions.length} | Manual Entries: ${incomeEntries.filter(e => e.dataSource === 'manual').length + businessExpenses.filter(e => e.dataSource === 'manual').length}`, 20, y);
      y += 10;
      
      // Executive Summary
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text("EXECUTIVE SUMMARY", 20, y);
      y += 8;
      
      doc.setFont("helvetica", "normal");
      const summaryItems = [
        `Total Annual Income: ${formatCurrency(totalAnnualIncome)}`,
        `Total Deductible Expenses: ${formatCurrency(totalDeductibleExpenses)}`,
        `Total Personal Expenses (Excluded): ${formatCurrency(totalPersonalExpenses)}`,
        `Taxable Income: ${formatCurrency(taxableIncome)}`,
        `Annual Tax Liability: ${formatCurrency(taxCalculation.tax)}`,
        `Monthly Provisional Tax: ${formatCurrency(monthlyTaxRequired)}`,
        `Effective Tax Rate: ${taxCalculation.effectiveRate.toFixed(2)}%`,
        `Marginal Tax Rate: ${taxCalculation.marginalRate.toFixed(1)}%`,
        `Home Office Deduction: ${homeOfficePercentage}%`
      ];
      
      summaryItems.forEach(item => {
        doc.text(item, 20, y);
        y += 6;
      });
      y += 10;
      
      // Income breakdown
      if (incomeEntries.length > 0) {
        doc.setFont("helvetica", "bold");
        doc.text("INCOME BREAKDOWN", 20, y);
        y += 8;
        
        incomeEntries.forEach((entry, index) => {
          if (y > 270) {
            doc.addPage();
            y = 20;
          }
          doc.setFont("helvetica", "normal");
          const annualAmount = calculateAnnualAmount(entry.amount, entry.period);
          doc.text(`${index + 1}. ${entry.description}: ${formatCurrency(annualAmount)}`, 25, y);
          y += 5;
          
          doc.setFontSize(9);
          doc.text(`   Source: ${entry.dataSource} | Confidence: ${entry.confidence ? Math.round(entry.confidence * 100) + '%' : 'N/A'} | Category: ${entry.source}`, 25, y);
          y += 4;
          
          if (entry.notes) {
            doc.text(`   Notes: ${entry.notes}`, 25, y);
            y += 4;
          }
          
          doc.setFontSize(10);
          y += 2;
        });
        y += 10;
      }
      
      // Business expenses breakdown
      if (businessExpenses.length > 0) {
        if (y > 200) {
          doc.addPage();
          y = 20;
        }
        
        doc.setFont("helvetica", "bold");
        doc.text("DEDUCTIBLE BUSINESS EXPENSES", 20, y);
        y += 8;
        
        businessExpenses.filter(e => !e.isExcluded).forEach((expense, index) => {
          if (y > 270) {
            doc.addPage();
            y = 20;
          }
          
          doc.setFont("helvetica", "normal");
          const annualAmount = calculateAnnualAmount(expense.amount, expense.period);
          doc.text(`${index + 1}. ${expense.description}: ${formatCurrency(annualAmount)}`, 25, y);
          y += 5;
          
          doc.setFontSize(9);
          doc.text(`   Source: ${expense.dataSource} | Confidence: ${expense.confidence ? Math.round(expense.confidence * 100) + '%' : 'N/A'} | Category: ${expense.category}`, 25, y);
          y += 4;
          
          if (expense.notes) {
            doc.text(`   Notes: ${expense.notes}`, 25, y);
            y += 4;
          }
          
          doc.setFontSize(10);
          y += 2;
        });
      }
      
      // Excluded expenses
      const excludedExpenses = personalExpenses.filter(e => e.isExcluded);
      if (excludedExpenses.length > 0) {
        if (y > 200) {
          doc.addPage();
          y = 20;
        }
        
        doc.setFont("helvetica", "bold");
        doc.text("EXCLUDED PERSONAL EXPENSES", 20, y);
        y += 8;
        
        excludedExpenses.forEach((expense, index) => {
          if (y > 270) {
            doc.addPage();
            y = 20;
          }
          
          doc.setFont("helvetica", "normal");
          const annualAmount = calculateAnnualAmount(expense.amount, expense.period);
          doc.text(`${index + 1}. ${expense.description}: ${formatCurrency(annualAmount)}`, 25, y);
          y += 5;
          
          doc.setFontSize(9);
          doc.text(`   Reason: ${expense.exclusionReason || 'Personal expense'}`, 25, y);
          y += 6;
        });
      }
      
      // Footer on all pages
      const pageCount = doc.internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.text(`Page ${i} of ${pageCount}`, 180, 290);
        doc.text("Generated by SA Tax Calculator with Smart Categorization", 20, 290);
      }
      
      doc.save(`SA-Tax-Report-${selectedTaxYear}-${new Date().toISOString().split('T')[0]}.pdf`);
      
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Error generating PDF. Please try again.');
    }
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
          <h1 className="text-4xl font-bold text-gray-800 mb-2">SA Tax Calculator with Smart Categorization</h1>
          <p className="text-gray-600">Real PDF.js integration with South African tax compliance</p>
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

        {/* Business Expenses Section */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-blue-700">Deductible Business Expenses</h3>
            <div className="flex space-x-2">
              {editMode && (
                <button
                  onClick={() => addExpenseEntry('business')}
                  className="flex items-center px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  <Plus className="mr-1" size={16} />
                  Add Expense
                </button>
              )}
              <span className="text-sm text-gray-600">
                {businessExpenses.filter(e => !e.isExcluded).length} items • {formatCurrency(totalDeductibleExpenses)} deductible
              </span>
            </div>
          </div>
          
          <div className="space-y-3">
            {businessExpenses.map((expense) => (
              <div key={expense.id} className={`p-4 rounded-lg border-l-4 ${expense.isExcluded ? 'bg-red-50 border-red-400' : 'bg-gray-50 border-blue-500'}`}>
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
                        className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
                      >
                        Save
                      </button>
                      {!expense.isExcluded && (
                        <button
                          onClick={() => moveExpenseToPersonal(expense)}
                          className="px-3 py-1 bg-gray-600 text-white rounded hover:bg-gray-700"
                        >
                          → Personal
                        </button>
                      )}
                      <button
                        onClick={() => deleteExpenseEntry(expense.id)}
                        className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      {getDataSourceBadge(expense.dataSource, expense.confidence, expense.isExcluded)}
                      <span className={`font-medium text-lg ${expense.isExcluded ? 'text-gray-400 line-through' : 'text-blue-700'}`}>
                        {expense.description}
                      </span>
                      {expense.isExcluded && (
                        <span className="px-2 py-1 bg-red-100 text-red-800 text-xs rounded-full">
                          NOT DEDUCTIBLE
                        </span>
                      )}
                      {editMode && (
                        <div className="flex space-x-1">
                          <button
                            onClick={() => setEditingEntry({ type: 'expense', id: expense.id })}
                            className="p-1 text-blue-600 hover:bg-blue-100 rounded"
                          >
                            <Edit2 size={16} />
                          </button>
                          {!expense.isExcluded && (
                            <button
                              onClick={() => moveExpenseToPersonal(expense)}
                              className="px-2 py-1 text-xs bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                            >
                              → Personal
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="text-right">
                      <div className={`text-xl font-bold ${expense.isExcluded ? 'text-gray-400 line-through' : 'text-blue-600'}`}>
                        {formatCurrency(calculateAnnualAmount(expense.amount, expense.period))}
                      </div>
                      <div className="text-sm text-gray-600">{expense.category}</div>
                      {expense.isExcluded && (
                        <div className="text-xs text-red-600 font-medium">Excluded from Tax Calc</div>
                      )}
                    </div>
                  </div>
                )}
                
                {expense.notes && !editMode && (
                  <div className="mt-2 text-sm text-gray-600">💡 {expense.notes}</div>
                )}
                
                {expense.exclusionReason && (
                  <div className="mt-2 text-sm text-red-600 bg-red-100 p-2 rounded">
                    <strong>Exclusion Reason:</strong> {expense.exclusionReason}
                  </div>
                )}
                
                {showTransactionDetails && expense.sourceTransactions && (
                  <div className="mt-3 p-3 bg-white rounded border">
                    <div className="text-xs font-medium text-gray-600 mb-2">Source Transactions:</div>
                    {expense.sourceTransactions.slice(0, 5).map((transaction, idx) => (
                      <div key={idx} className="text-xs text-gray-500 flex justify-between mb-1">
                        <span>{transaction.date}: {transaction.originalDescription}</span>
                        <span>{formatCurrency(transaction.amount)}</span>
                      </div>
                    ))}
                    {expense.sourceTransactions.length > 5 && (
                      <div className="text-xs text-gray-400">
                        ... and {expense.sourceTransactions.length - 5} more transactions
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Personal Expenses Section */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-700">Personal Expenses (Excluded from Business Deductions)</h3>
            <div className="flex space-x-2">
              {editMode && (
                <button
                  onClick={() => addExpenseEntry('personal')}
                  className="flex items-center px-3 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
                >
                  <Plus className="mr-1" size={16} />
                  Add Personal
                </button>
              )}
              <span className="text-sm text-gray-600">
                {personalExpenses.length} items • {formatCurrency(totalPersonalExpenses)} total (NOT deductible)
              </span>
            </div>
          </div>
          
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
            <div className="flex items-start space-x-3">
              <X className="text-red-600 mt-1" size={20} />
              <div>
                <h4 className="font-semibold text-red-800 mb-1">Excluded from Business Deductions</h4>
                <p className="text-red-700 text-sm">
                  These personal expenses are NOT included in your business deductions as per your requirements: Virgin gym, Old Mutual unit trusts, Netflix, Apple, YouTube, SABC, and CARTRACK.
                </p>
              </div>
            </div>
          </div>
          
          <div className="space-y-3">
            {personalExpenses.map((expense) => (
              <div key={expense.id} className={`p-4 rounded-lg border-l-4 ${
                expense.isExcluded ? 'bg-red-50 border-red-400' : 'bg-gray-50 border-gray-400'
              }`}>
                {editMode && editingEntry?.type === 'personal' && editingEntry?.id === expense.id ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <input
                        type="text"
                        value={expense.description}
                        onChange={(e) => updatePersonalExpense(expense.id, 'description', e.target.value)}
                        className="p-2 border border-gray-300 rounded"
                        placeholder="Description"
                      />
                      <input
                        type="number"
                        step="0.01"
                        value={expense.amount}
                        onChange={(e) => updatePersonalExpense(expense.id, 'amount', e.target.value)}
                        className="p-2 border border-gray-300 rounded"
                        placeholder="Amount"
                      />
                      <select
                        value={expense.category}
                        onChange={(e) => updatePersonalExpense(expense.id, 'category', e.target.value)}
                        className="p-2 border border-gray-300 rounded"
                      >
                        <option value="Personal">Personal</option>
                        <option value="Entertainment">Entertainment</option>
                        <option value="Health">Health</option>
                        <option value="Transport">Transport</option>
                        <option value="Investment">Investment</option>
                      </select>
                    </div>
                    <input
                      type="text"
                      value={expense.notes || ''}
                      onChange={(e) => updatePersonalExpense(expense.id, 'notes', e.target.value)}
                      className="w-full p-2 border border-gray-300 rounded"
                      placeholder="Notes"
                    />
                    <div className="flex space-x-2">
                      <button
                        onClick={() => setEditingEntry(null)}
                        className="px-3 py-1 bg-gray-600 text-white rounded hover:bg-gray-700"
                      >
                        Save
                      </button>
                      {!expense.isExcluded && (
                        <button
                          onClick={() => moveExpenseToBusiness(expense)}
                          className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
                        >
                          → Business
                        </button>
                      )}
                      <button
                        onClick={() => deletePersonalExpense(expense.id)}
                        className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      {getDataSourceBadge(expense.dataSource, expense.confidence, expense.isExcluded)}
                      <span className={`font-medium text-lg ${expense.isExcluded ? 'text-red-700' : 'text-gray-700'}`}>
                        {expense.description}
                      </span>
                      {expense.isExcluded && (
                        <span className="px-2 py-1 bg-red-100 text-red-800 text-xs rounded-full">
                          EXCLUDED
                        </span>
                      )}
                      {editMode && (
                        <div className="flex space-x-1">
                          <button
                            onClick={() => setEditingEntry({ type: 'personal', id: expense.id })}
                            className="p-1 text-gray-600 hover:bg-gray-100 rounded"
                          >
                            <Edit2 size={16} />
                          </button>
                          {!expense.isExcluded && (
                            <button
                              onClick={() => moveExpenseToBusiness(expense)}
                              className="px-2 py-1 text-xs bg-blue-200 text-blue-700 rounded hover:bg-blue-300"
                            >
                              → Business
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="text-right">
                      <div className={`text-xl font-bold ${expense.isExcluded ? 'text-red-600' : 'text-gray-600'}`}>
                        {formatCurrency(calculateAnnualAmount(expense.amount, expense.period))}
                      </div>
                      <div className="text-sm text-gray-500">{expense.category}</div>
                      {expense.isExcluded && (
                        <div className="text-xs text-red-600 font-medium">Not Deductible</div>
                      )}
                    </div>
                  </div>
                )}
                
                {expense.notes && !editMode && (
                  <div className="mt-2 text-sm text-gray-600">
                    💡 {expense.notes}
                  </div>
                )}
                
                {expense.exclusionReason && (
                  <div className="mt-2 text-sm text-red-600 bg-red-100 p-2 rounded">
                    <strong>Exclusion Reason:</strong> {expense.exclusionReason}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Tax Calculation */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h3 className="text-lg font-semibold mb-4 text-purple-700">
            📊 Tax Calculation - {selectedTaxYear} Tax Year
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <div className="flex justify-between">
                <span>Total Annual Income:</span>
                <span className="font-semibold">{formatCurrency(totalAnnualIncome)}</span>
              </div>
              <div className="flex justify-between">
                <span>Less: Deductible Business Expenses:</span>
                <span className="font-semibold text-blue-600">({formatCurrency(totalDeductibleExpenses)})</span>
              </div>
              <div className="flex justify-between border-t pt-2">
                <span>Taxable Income:</span>
                <span className="font-semibold">{formatCurrency(taxableIncome)}</span>
              </div>
              <div className="flex justify-between">
                <span>Gross Tax:</span>
                <span className="font-semibold">{formatCurrency(taxCalculation.grossTax)}</span>
              </div>
              <div className="flex justify-between">
                <span>Less: Tax Rebates ({userAge}):</span>
                <span className="font-semibold text-green-600">({formatCurrency(taxCalculation.rebates)})</span>
              </div>
              <div className="flex justify-between border-t-2 pt-2 text-lg font-bold">
                <span>Net Tax Liability:</span>
                <span className="text-red-600">{formatCurrency(taxCalculation.tax)}</span>
              </div>
              
              {/* Show excluded personal expenses */}
              <div className="mt-4 p-3 bg-red-50 rounded-lg border border-red-200">
                <div className="text-sm font-medium text-red-800 mb-1">Personal Expenses (Excluded):</div>
                <div className="text-sm text-red-700">
                  {formatCurrency(totalPersonalExpenses)} in personal expenses were excluded from business deductions
                </div>
                <div className="text-xs text-red-600 mt-1">
                  Includes: Virgin gym, Old Mutual investments, Netflix, Apple, YouTube, SABC, CARTRACK
                </div>
              </div>
            </div>
            
            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="font-semibold mb-3">Tax Information & Compliance</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Effective Tax Rate:</span>
                  <span className="font-medium">{taxCalculation.effectiveRate.toFixed(2)}%</span>
                </div>
                <div className="flex justify-between">
                  <span>Marginal Tax Rate:</span>
                  <span className="font-medium">{taxCalculation.marginalRate.toFixed(1)}%</span>
                </div>
                <div className="flex justify-between">
                  <span>Monthly Tax Required:</span>
                  <span className="font-medium text-red-600">{formatCurrency(monthlyTaxRequired)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Monthly After-Tax Income:</span>
                  <span className="font-medium text-green-600">{formatCurrency((totalAnnualIncome - taxCalculation.tax) / 12)}</span>
                </div>
                <div className="border-t pt-2 mt-2">
                  <div className="text-xs text-gray-600 mb-1">Home Office Deduction:</div>
                  <div className="text-xs">{homeOfficePercentage}% of mortgage interest & home insurance</div>
                </div>
                <div className="border-t pt-2 mt-2">
                  <div className="text-xs text-gray-600">Provisional Tax Payments:</div>
                  <div className="text-xs">1st: 31 Aug {selectedTaxYear} • 2nd: 28 Feb {selectedTaxYear + 1}</div>
                </div>
                <div className="border-t pt-2 mt-2">
                  <div className="text-xs text-orange-600 font-medium">⚠️ TAKEALOT Review Required</div>
                  <div className="text-xs text-orange-700">Review PDF invoices for business vs personal items</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Empty State */}
        {incomeEntries.length === 0 && businessExpenses.length === 0 && personalExpenses.length === 0 && uploadedFiles.length === 0 && (
          <div className="bg-white rounded-lg shadow-lg p-12 text-center">
            <div className="flex items-center justify-center mb-6">
              <FileUp className="mr-3 text-blue-600" size={64} />
              <div className={`px-3 py-1 rounded-full text-sm ${
                pdfJsLoaded ? 'bg-green-100 text-green-800' : 'bg-orange-100 text-orange-800'
              }`}>
                PDF.js {pdfJsLoaded ? 'Ready' : 'Loading...'}
              </div>
            </div>
            <h3 className="text-2xl font-bold text-gray-800 mb-4">SA Tax Calculator with Smart Categorization</h3>
            <p className="text-gray-600 mb-6 max-w-2xl mx-auto">
              Upload your bank statement PDFs for automatic transaction categorization following South African tax requirements. 
              Personal expenses (Virgin gym, Old Mutual investments, Netflix, Apple, YouTube, SABC, CARTRACK) are automatically excluded.
              TAKEALOT purchases require manual PDF invoice review to separate business items from personal.
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
            <p className="text-sm text-gray-500 mt-4">
              Supports Standard Bank, FNB, ABSA, Nedbank, and Capitec PDF statements<br/>
              Automatically applies 8.2% home office deduction to mortgage interest and home insurance
            </p>
          </div>
        )}

        {/* Footer */}
        <div className="text-center text-gray-600 text-sm">
          <p>⚖️ Please consult with a qualified tax practitioner for official tax filing and advice</p>
          <p className="mt-2 font-medium">Generated: {new Date().toLocaleString()}</p>
        </div>
      </div>
    </div>
  );
};

export default ProductionTaxCalculator;