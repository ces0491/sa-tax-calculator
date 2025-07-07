'use client';

import React, { useState, useEffect } from 'react';
import { Upload, Download, FileText, DollarSign, TrendingUp, Calculator, CheckCircle, AlertCircle, X, Edit2, Save, Plus, Trash, Eye, EyeOff, Settings, RefreshCw, FileUp } from 'lucide-react';

// Import modular functions
import { createPDFProcessor } from './pdf-processing';
import { createCategorizer } from './transaction-categorisation';
import { calculateTax, taxBracketsData } from './tax-calculations';
import { formatCurrency, getCurrentTaxYear, calculateAnnualAmount, getDataSourceBadge } from './currency-formatters';

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

  // Period detection and annualization
  const [statementPeriod, setStatementPeriod] = useState(null);
  const [isProjectedIncome, setIsProjectedIncome] = useState(false);

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

  // Create modular processors
  const { detectStatementPeriod, extractTransactions } = createPDFProcessor(logMessage, debugMode, statementPeriod);
  const { categorizeTransactions } = createCategorizer(logMessage, debugMode, homeOfficePercentage, (amount, period) => calculateAnnualAmount(amount, period, statementPeriod));

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

  // Update period detection when transactions change
  useEffect(() => {
    if (rawTransactions.length > 0) {
      const period = detectStatementPeriod(rawTransactions);
      setStatementPeriod(period);
      setIsProjectedIncome(period?.isPartialYear || false);
    }
  }, [rawTransactions]);

  // Calculate totals using imported function
  const totalAnnualIncome = incomeEntries.reduce((sum, entry) => 
    sum + calculateAnnualAmount(entry.amount, entry.period, statementPeriod), 0);
  
  const totalDeductibleExpenses = businessExpenses
    .filter(expense => !expense.isExcluded)
    .reduce((sum, expense) => sum + calculateAnnualAmount(expense.amount, expense.period, statementPeriod), 0);
  
  const totalPersonalExpenses = personalExpenses
    .reduce((sum, expense) => sum + calculateAnnualAmount(expense.amount, expense.period, statementPeriod), 0);

  const taxableIncome = Math.max(0, totalAnnualIncome - totalDeductibleExpenses);

  // Use imported tax calculation
  const taxCalculation = calculateTax(taxableIncome, selectedTaxYear, userAge);
  const monthlyTaxRequired = taxCalculation.tax / 12;

  // PDF Processing using modular functions
  const processPDF = async (file) => {
    logMessage('info', 'pdf-load', `Starting PDF processing for: ${file.name}`);
    
    try {
      const arrayBuffer = await file.arrayBuffer();
      const loadingTask = window.pdfjsLib.getDocument({ data: arrayBuffer });
      const pdf = await loadingTask.promise;
      
      logMessage('info', 'pdf-load', `PDF loaded successfully`, {
        numPages: pdf.numPages,
        fileName: file.name
      });
      
      let allText = '';
      
      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        try {
          const page = await pdf.getPage(pageNum);
          const textContent = await page.getTextContent();
          
          const pageText = textContent.items
            .map(item => item.str)
            .join(' ')
            .replace(/\s+/g, ' ')
            .trim();
          
          allText += pageText + '\n';
          
        } catch (pageError) {
          logMessage('error', 'text-extract', `Error processing page ${pageNum}`, {
            error: pageError.message
          });
        }
      }
      
      setExtractedTexts(prev => [...prev, {
        fileName: file.name,
        pageCount: pdf.numPages,
        totalTextLength: allText.length,
        allText: allText,
        extractedAt: new Date()
      }]);
      
      logMessage('info', 'transaction-parse', 'Starting transaction extraction');
      const transactions = extractTransactions(allText, file.name);
      
      logMessage('info', 'categorization', 'Starting transaction categorization');
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
        processedAt: new Date(),
        textLength: allText.length
      }]);
      
      logMessage('info', 'pdf-load', `PDF processing completed successfully for: ${file.name}`);
      
    } catch (error) {
      logMessage('error', 'pdf-load', `Failed to process PDF: ${file.name}`, {
        error: error.message
      });
      throw error;
    }
  };

  const handleFileUpload = async (event) => {
    const files = Array.from(event.target.files);
    if (files.length === 0 || !pdfJsLoaded) return;

    setIsProcessing(true);
    setProcessingStatus('Starting PDF processing...');
    clearLogs();

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        setProcessingStatus(`Processing ${file.name} (${i + 1}/${files.length})...`);
        await processPDF(file);
      }
      
      setProcessingStatus(`Successfully processed ${files.length} file(s)`);
      setTimeout(() => setProcessingStatus(''), 3000);
      
    } catch (error) {
      const errorMessage = `Error processing files: ${error.message}`;
      setProcessingStatus(errorMessage);
    } finally {
      setIsProcessing(false);
      if (debugMode) {
        setShowLogs(true);
      }
    }
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
            {/* Period Information */}
            {statementPeriod && (
              <div className={`bg-white rounded-lg shadow-lg p-4 border-l-4 ${
                statementPeriod.isPartialYear ? 'border-orange-500' : 'border-green-500'
              }`}>
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-semibold text-gray-800">📅 Statement Period Analysis</h4>
                    <p className="text-sm text-gray-600">
                      Data covers: {statementPeriod.startDate.toLocaleDateString()} - {statementPeriod.endDate.toLocaleDateString()} 
                      ({statementPeriod.monthsCovered} month{statementPeriod.monthsCovered !== 1 ? 's' : ''})
                    </p>
                  </div>
                  {statementPeriod.isPartialYear && (
                    <div className="text-right">
                      <div className="text-orange-600 font-medium">⚠️ PROJECTED ANNUAL FIGURES</div>
                      <div className="text-sm text-gray-600">
                        Actual amounts multiplied by {statementPeriod.annualizationFactor.toFixed(1)}x for annual projection
                      </div>
                      <div className="text-xs text-orange-600 mt-1">
                        ⚡ For provisional tax: pay on projected amounts, reconcile at year-end
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Annual Income {isProjectedIncome ? '(Projected)' : ''}</p>
                    <p className="text-2xl font-bold text-green-600">
                      {formatCurrency(totalAnnualIncome)}
                      {isProjectedIncome && <span className="text-sm text-orange-600 ml-1">*</span>}
                    </p>
                    <p className="text-xs text-gray-500">
                      {incomeEntries.length} sources
                      {isProjectedIncome && statementPeriod && ` • Based on ${statementPeriod.monthsCovered} months`}
                    </p>
                  </div>
                  <DollarSign className="text-green-600" size={32} />
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Deductible Expenses {isProjectedIncome ? '(Projected)' : ''}</p>
                    <p className="text-2xl font-bold text-blue-600">
                      {formatCurrency(totalDeductibleExpenses)}
                      {isProjectedIncome && <span className="text-sm text-orange-600 ml-1">*</span>}
                    </p>
                    <p className="text-xs text-gray-500">
                      {businessExpenses.filter(e => !e.isExcluded).length} items
                      {isProjectedIncome && statementPeriod && ` • Based on ${statementPeriod.monthsCovered} months`}
                    </p>
                  </div>
                  <CheckCircle className="text-blue-600" size={32} />
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Taxable Income {isProjectedIncome ? '(Projected)' : ''}</p>
                    <p className="text-2xl font-bold text-orange-600">
                      {formatCurrency(taxableIncome)}
                      {isProjectedIncome && <span className="text-sm text-orange-600 ml-1">*</span>}
                    </p>
                    <p className="text-xs text-gray-500">Effective: {taxCalculation.effectiveRate.toFixed(1)}%</p>
                  </div>
                  <TrendingUp className="text-orange-600" size={32} />
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Annual Tax {isProjectedIncome ? '(Projected)' : ''}</p>
                    <p className="text-2xl font-bold text-red-600">
                      {formatCurrency(taxCalculation.tax)}
                      {isProjectedIncome && <span className="text-sm text-orange-600 ml-1">*</span>}
                    </p>
                    <p className="text-xs text-gray-500">Monthly: {formatCurrency(monthlyTaxRequired)}</p>
                  </div>
                  <Calculator className="text-red-600" size={32} />
                </div>
              </div>
            </div>

            {/* Upload Section */}
            {incomeEntries.length === 0 && businessExpenses.length === 0 && (
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
                    {incomeEntries.length} sources • {formatCurrency(totalAnnualIncome)} 
                    {isProjectedIncome ? ' projected annual' : ' annual'} total
                  </p>
                </div>
              </div>
              
              <div className="space-y-4">
                {incomeEntries.length === 0 ? (
                  <div className="text-center text-gray-500 py-12">
                    <DollarSign className="mx-auto mb-4" size={48} />
                    <p className="text-lg font-medium">No income sources found</p>
                    <p className="text-sm">Upload bank statements to get started</p>
                  </div>
                ) : (
                  incomeEntries.map((entry) => (
                    <div key={entry.id} className="p-4 bg-gray-50 rounded-lg border-l-4 border-green-500">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          {(() => {
                            const badge = getDataSourceBadge(entry.dataSource, entry.confidence, false);
                            return <span className={badge.className}>{badge.text}</span>;
                          })()}
                          <div>
                            <div className="font-medium text-lg">{entry.description}</div>
                            <div className="text-sm text-gray-600">{entry.source}</div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-xl font-bold text-green-600">
                            {formatCurrency(calculateAnnualAmount(entry.amount, entry.period, statementPeriod))}
                            {entry.period === 'actual' && isProjectedIncome && (
                              <span className="text-xs text-orange-600 ml-1">*</span>
                            )}
                          </div>
                          <div className="text-sm text-gray-500">
                            {entry.period === 'actual' ? (
                              <>
                                {formatCurrency(entry.amount)} actual
                                {isProjectedIncome && statementPeriod && (
                                  <div className="text-xs text-orange-600">
                                    *Projected from {statementPeriod.monthsCovered} months
                                  </div>
                                )}
                              </>
                            ) : (
                              `${formatCurrency(entry.amount)} ${entry.period}`
                            )}
                          </div>
                        </div>
                      </div>
                      
                      {entry.notes && (
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

        {/* Additional tabs would be similar - using imported functions */}
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
              </div>
              
              {processingLogs.length > 0 && (
                <div className="mt-6">
                  <div className="flex justify-between items-center mb-3">
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
                  
                  <button
                    onClick={() => setShowLogs(!showLogs)}
                    className={`flex items-center px-3 py-2 rounded-lg font-medium ${
                      showLogs ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'
                    }`}
                  >
                    <FileText className="mr-1" size={16} />
                    {showLogs ? 'Hide' : 'Show'} Logs
                  </button>
                </div>
              )}
              
              {showLogs && processingLogs.length > 0 && (
                <div className="mt-4 max-h-96 overflow-y-auto border border-gray-200 rounded-lg">
                  <div className="bg-gray-800 text-white p-3 font-mono text-sm">
                    {processingLogs.slice(-20).map((log) => (
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
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
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