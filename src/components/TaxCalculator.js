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

  // Tab definitions
  const tabs = [
    { id: 'overview', name: 'Overview', icon: TrendingUp },
    { id: 'upload', name: 'Upload & Process', icon: Upload },
    { id: 'income', name: 'Income', icon: DollarSign },
    { id: 'expenses', name: 'Business Expenses', icon: CheckCircle },
    { id: 'personal', name: 'Personal Expenses', icon: X },
    { id: 'review', name: 'Review Required', icon: AlertCircle },
    { id: 'tax', name: 'Tax Calculation', icon: Calculator },
    { id: 'reports', name: 'Reports', icon: FileText }
  ];

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
      
      // Note: Removed ib payments, interest, and other items that should be excluded
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
      
      // Business equipment and supplies (from TAKEALOT - requires verification)
      // Note: TAKEALOT requires manual review as specified
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

  // Helper functions
  function getCurrentTaxYear() {
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth();
    return currentMonth >= 2 ? currentYear : currentYear - 1;
  }

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

  // PDF Processing
  const handleFileUpload = async (event) => {
    const files = Array.from(event.target.files);
    if (files.length === 0 || !pdfJsLoaded) return;

    setIsProcessing(true);
    setProcessingStatus('Starting PDF processing...');

    try {
      for (const file of files) {
        setProcessingStatus(`Processing ${file.name}...`);
        await processPDF(file);
      }
      setProcessingStatus(`Successfully processed ${files.length} file(s)`);
      setTimeout(() => setProcessingStatus(''), 3000);
    } catch (error) {
      console.error('Error processing files:', error);
      setProcessingStatus(`Error: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const processPDF = async (file) => {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    
    let allText = '';
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map(item => item.str).join(' ');
      allText += pageText + '\n';
    }

    const transactions = extractTransactions(allText, file.name);
    const processedData = categorizeTransactions(transactions);

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
      processedAt: new Date()
    }]);
  };

  const extractTransactions = (text, sourceFile) => {
    const transactions = [];
    const lines = text.split('\n').filter(line => line.trim().length > 0);
    
    // Standard Bank pattern
    const standardBankPattern = /(\d{2}\s+\w{3})\s+(.+?)\s+([\d\s,.+-]+)\s+([\d\s,.+-]+)/;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      const match = line.match(standardBankPattern);
      
      if (match) {
        const [, date, description, amount, balance] = match;
        const numAmount = parseFloat(amount.replace(/[^\d.-]/g, ''));
        
        if (!isNaN(numAmount) && Math.abs(numAmount) > 1) {
          transactions.push({
            id: Date.now() + Math.random(),
            date: date.trim(),
            originalDescription: description.trim(),
            amount: numAmount,
            balance: parseFloat(balance.replace(/[^\d.-]/g, '')) || 0,
            type: numAmount > 0 ? 'credit' : 'debit',
            sourceFile
          });
        }
      }
    }
    
    return transactions;
  };

  const categorizeTransactions = (transactions) => {
    const categorized = {
      income: [],
      business: [],
      personal: [],
      home: [],
      uncategorized: []
    };

    transactions.forEach(transaction => {
      // Skip excluded patterns first
      if (categorizationRules.excludePatterns.some(pattern => 
        pattern.test(transaction.originalDescription))) {
        return; // Skip this transaction entirely
      }

      // Check for TAKEALOT special handling
      if (categorizationRules.takealotPattern.test(transaction.originalDescription)) {
        categorized.uncategorized.push({
          ...transaction,
          category: 'takealot-review',
          reason: 'TAKEALOT purchase requires manual invoice review to separate business vs personal items'
        });
        return;
      }

      // Categorize income
      for (const rule of categorizationRules.income) {
        if (rule.pattern.test(transaction.originalDescription) && transaction.amount > 0) {
          const sourceTransactions = [transaction];
          categorized.income.push({
            id: Date.now() + Math.random(),
            description: rule.source,
            amount: Math.abs(transaction.amount),
            period: 'monthly',
            source: rule.category,
            dataSource: 'auto-detected',
            confidence: rule.confidence,
            sourceTransactions,
            notes: `Auto-detected from: ${transaction.originalDescription}`
          });
          return;
        }
      }

      // Categorize business expenses
      for (const rule of categorizationRules.businessExpenses) {
        if (rule.pattern.test(transaction.originalDescription) && transaction.amount < 0) {
          const sourceTransactions = [transaction];
          categorized.business.push({
            id: Date.now() + Math.random(),
            description: rule.description,
            amount: Math.abs(transaction.amount),
            period: 'monthly',
            category: rule.category,
            dataSource: 'auto-detected',
            confidence: rule.confidence,
            sourceTransactions,
            notes: `Auto-detected from: ${transaction.originalDescription}`
          });
          return;
        }
      }

      // Categorize personal expenses
      for (const rule of categorizationRules.personalExpenses) {
        if (rule.pattern.test(transaction.originalDescription) && transaction.amount < 0) {
          const sourceTransactions = [transaction];
          categorized.personal.push({
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
          });
          return;
        }
      }

      // Categorize home expenses
      for (const rule of categorizationRules.homeExpenses) {
        if (rule.pattern.test(transaction.originalDescription)) {
          const sourceTransactions = [transaction];
          categorized.home.push({
            id: Date.now() + Math.random(),
            description: rule.description,
            amount: Math.abs(transaction.amount),
            period: 'monthly',
            category: rule.category,
            dataSource: 'auto-detected',
            confidence: rule.confidence,
            sourceTransactions,
            notes: `Auto-detected from: ${transaction.originalDescription}`
          });
          return;
        }
      }

      // If not categorized, add to uncategorized (but only significant amounts)
      if (Math.abs(transaction.amount) > 50) {
        categorized.uncategorized.push({
          ...transaction,
          reason: 'Could not automatically categorize this transaction'
        });
      }
    });

    // Calculate home office deductions
    if (categorized.home.length > 0) {
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
      ["EXCLUSIONS APPLIED FOR PROVISIONAL TAX PAYER"],
      ["Inter-bank payments (ib payment)", "Excluded as internal transfers"],
      ["Interest income", "Excluded as not business income"],
      ["Finance charges & transaction fees", "Excluded as bank charges"],
      ["Virgin gym membership", "Excluded as personal expense"],
      ["Old Mutual unit trusts", "Excluded as investment, not retirement"],
      ["Netflix/Apple/YouTube/SABC", "Excluded as personal entertainment"],
      ["CARTRACK vehicle tracking", "Excluded as personal expense"],
      ["Cash withdrawals", "Excluded as personal transactions"],
      ["TAKEALOT purchases", "Require PDF invoice verification for business vs personal items"],
      [],
      ["PROVISIONAL TAX DEDUCTIBLE EXPENSES INCLUDED"],
      ["Retirement Annuity (10X)", "Fully deductible - Section 11(k)"],
      ["Medical Aid contributions", "Fully deductible - Section 11A"],
      ["Tax advisory services", "Professional fees - Section 11(a)"],
      ["Business software subscriptions", "Deductible business expense"],
      ["Home office expenses", homeOfficePercentage + "% of mortgage interest & insurance"],
      ["Business education (UCT)", "Training related to income generation"],
      ["Printing & business supplies", "Directly related to business operations"],
      ["Internet services", "Necessary for business operations"],
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
                  These expenses are NOT included in your business deductions as per provisional tax requirements: Personal expenses (Virgin gym, Old Mutual investments, Netflix, Apple, YouTube, SABC, CARTRACK), inter-bank payments, interest income, and bank charges.
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
                {uncategorizedTransactions.length > 0 && (
                  <div className="border-t pt-2 mt-2">
                    <div className="text-xs text-orange-600 font-medium">⚠️ {uncategorizedTransactions.length} items need review</div>
                    <div className="text-xs text-orange-700">Review TAKEALOT invoices for business vs personal items</div>
                  </div>
                )}
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
            <h3 className="text-2xl font-bold text-gray-800 mb-4">SA Provisional Tax Calculator with Smart Categorization</h3>
            <p className="text-gray-600 mb-6 max-w-2xl mx-auto">
              Upload your bank statement PDFs for intelligent transaction categorization optimized for provisional tax payers. 
              Automatically identifies Precise Digitait income, excludes inter-bank payments, interest income, and bank charges.
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
              Optimized for provisional tax payers • Supports Standard Bank, FNB, ABSA, Nedbank, and Capitec<br/>
              Automatically applies {homeOfficePercentage}% home office deduction • Excludes non-deductible personal expenses
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

export default SATaxCalculator;