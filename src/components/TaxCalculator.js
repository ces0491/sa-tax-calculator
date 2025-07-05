'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Download, Edit2, Save, Plus, Trash2, Calendar, Calculator, FileText, DollarSign, TrendingUp, AlertCircle, CheckCircle, Home, Settings, Upload } from 'lucide-react';

const DynamicTaxApp = () => {
  // Auto-detect current tax year
  const getCurrentTaxYear = () => {
    const now = new Date();
    const currentMonth = now.getMonth() + 1; // JavaScript months are 0-indexed
    const currentYear = now.getFullYear();
    
    // SA tax year runs from 1 March to 28 February
    if (currentMonth >= 3) {
      return currentYear + 1; // If March or later, we're in the next tax year
    } else {
      return currentYear; // If Jan/Feb, we're still in the current tax year
    }
  };

  // SARS Tax Brackets Data (updated with current rates)
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
    },
    2024: {
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
    2023: {
      brackets: [
        { min: 0, max: 226000, rate: 0.18, cumulative: 0 },
        { min: 226001, max: 353100, rate: 0.26, cumulative: 40680 },
        { min: 353101, max: 488700, rate: 0.31, cumulative: 73726 },
        { min: 488701, max: 641400, rate: 0.36, cumulative: 115762 },
        { min: 641401, max: 817600, rate: 0.39, cumulative: 170734 },
        { min: 817601, max: 1731600, rate: 0.41, cumulative: 239452 },
        { min: 1731601, max: Infinity, rate: 0.45, cumulative: 614192 }
      ],
      rebates: { primary: 16425, secondary: 9000, tertiary: 2997 },
      thresholds: { under65: 91250, under75: 141250, over75: 157900 }
    }
  };

  // State management
  const [selectedTaxYear, setSelectedTaxYear] = useState(getCurrentTaxYear());
  const [userAge, setUserAge] = useState('under65');
  const [editMode, setEditMode] = useState(false);
  const [homeOfficePercentage, setHomeOfficePercentage] = useState(8.2);

  // Predefined categories
  const incomeCategories = ["Employment", "Freelance", "Investment", "Rental", "Business", "Other"];
  const expenseCategories = ["Office", "Medical", "Retirement", "Professional", "Education", "Travel", "Equipment", "Software", "Insurance", "Utilities", "Marketing", "Training", "Other"];

  // State for editing
  const [editingEntry, setEditingEntry] = useState(null);
  const [showAddIncomeModal, setShowAddIncomeModal] = useState(false);
  const [showAddExpenseModal, setShowAddExpenseModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);

  // Income state
  const [incomeEntries, setIncomeEntries] = useState([
    { 
      id: 1, 
      description: "Salary from NZ Company", 
      amount: 547716.48, 
      period: "6months", 
      source: "Employment",
      dataSource: "auto-detected",
      notes: "From PRECISE DIGITAL NZ payments"
    },
  ]);

  // Business expenses state
  const [businessExpenses, setBusinessExpenses] = useState([
    { 
      id: 1, 
      description: "Retirement Annuity (10X)", 
      amount: 34650.00, 
      period: "6months", 
      category: "Retirement",
      dataSource: "auto-detected",
      notes: "10XRA COL transactions"
    },
    { 
      id: 2, 
      description: "Medical Aid", 
      amount: 24354.00, 
      period: "6months", 
      category: "Medical",
      dataSource: "auto-detected",
      notes: "DISC PREM medical aid contributions"
    },
    { 
      id: 3, 
      description: "Home Office Expenses", 
      amount: 26640.93, 
      period: "6months", 
      category: "Office",
      dataSource: "calculated",
      notes: `${homeOfficePercentage}% of home expenses`
    },
    { 
      id: 4, 
      description: "Business Coffee", 
      amount: 1078.00, 
      period: "6months", 
      category: "Business",
      dataSource: "auto-detected",
      notes: "Bootlegger and Shift coffee purchases"
    },
    { 
      id: 5, 
      description: "Printing Services", 
      amount: 819.50, 
      period: "6months", 
      category: "Business",
      dataSource: "auto-detected",
      notes: "Rozprint transactions"
    },
    { 
      id: 6, 
      description: "Tax Advisory Services", 
      amount: 700.00, 
      period: "6months", 
      category: "Professional",
      dataSource: "auto-detected",
      notes: "Personal Tax Service"
    },
    { 
      id: 7, 
      description: "Medical Expenses", 
      amount: 14830.00, 
      period: "6months", 
      category: "Medical",
      dataSource: "auto-detected",
      notes: "Dr Malcol medical fees"
    },
    { 
      id: 8, 
      description: "Education Expenses (UCT)", 
      amount: 32500.00, 
      period: "6months", 
      category: "Education",
      dataSource: "auto-detected",
      notes: "PAYU * UC University payments"
    },
  ]);

  // Personal expenses state (for reference)
  const [personalExpenses, setPersonalExpenses] = useState([
    { 
      id: 1, 
      description: "Gym Membership (Virgin)", 
      amount: 1037.50, 
      period: "6months", 
      category: "Personal",
      dataSource: "auto-detected",
      notes: "Virgin Active membership fees"
    },
    { 
      id: 2, 
      description: "Entertainment Subscriptions", 
      amount: 1500.00, 
      period: "6months", 
      category: "Personal",
      dataSource: "auto-detected",
      notes: "Netflix, Apple, YouTube Premium"
    },
  ]);

  // PDF Export Function
  const exportToPDF = async () => {
    try {
      // Dynamically import jsPDF to avoid SSR issues
      const { jsPDF } = await import('jspdf');
      
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.width;
      const pageHeight = doc.internal.pageSize.height;
      let yPosition = 20;
      
      // Helper function to add text with line breaks
      const addText = (text, fontSize = 12, isBold = false, color = [0, 0, 0]) => {
        doc.setFontSize(fontSize);
        doc.setTextColor(color[0], color[1], color[2]);
        if (isBold) doc.setFont("helvetica", "bold");
        else doc.setFont("helvetica", "normal");
        
        const lines = doc.splitTextToSize(text, pageWidth - 40);
        lines.forEach(line => {
          if (yPosition > pageHeight - 20) {
            doc.addPage();
            yPosition = 20;
          }
          doc.text(line, 20, yPosition);
          yPosition += fontSize * 0.5;
        });
        yPosition += 5;
      };

      // Add horizontal line
      const addLine = () => {
        doc.setDrawColor(150, 150, 150);
        doc.line(20, yPosition, pageWidth - 20, yPosition);
        yPosition += 10;
      };

      // Header
      addText("SOUTH AFRICAN TAX CALCULATION REPORT", 18, true, [0, 51, 153]);
      addText(`${selectedTaxYear} Tax Year Assessment`, 14, true);
      addText(`Generated: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`, 10);
      addText(`Taxpayer Age Category: ${userAge.replace('under', 'Under ').replace('over', 'Over ')}`, 10);
      addLine();

      // Executive Summary
      addText("EXECUTIVE SUMMARY", 14, true, [0, 102, 0]);
      
      const totalAnnualIncome = incomeEntries.reduce((sum, entry) => 
        sum + calculateAnnualAmount(entry.amount, entry.period), 0
      );
      
      const totalBusinessExpenses = businessExpenses.reduce((sum, expense) => 
        sum + calculateAnnualAmount(expense.amount, expense.period), 0
      );
      
      const taxableIncome = Math.max(0, totalAnnualIncome - totalBusinessExpenses);
      const taxCalculation = calculateTax(taxableIncome, selectedTaxYear, userAge);
      const monthlyTaxRequired = taxCalculation.tax / 12;

      addText(`Total Annual Income: ${formatCurrency(totalAnnualIncome)}`, 12, true);
      addText(`Total Business Expenses: ${formatCurrency(totalBusinessExpenses)}`, 12, true);
      addText(`Taxable Income: ${formatCurrency(taxableIncome)}`, 12, true);
      addText(`Annual Tax Liability: ${formatCurrency(taxCalculation.tax)}`, 12, true, [153, 0, 0]);
      addText(`Monthly Provisional Tax: ${formatCurrency(monthlyTaxRequired)}`, 12, true, [153, 0, 0]);
      addText(`Effective Tax Rate: ${taxCalculation.effectiveRate.toFixed(2)}%`, 12, true);
      addLine();

      // Income Details
      addText("INCOME BREAKDOWN", 14, true, [0, 102, 0]);
      incomeEntries.forEach((entry, index) => {
        const annualAmount = calculateAnnualAmount(entry.amount, entry.period);
        addText(`${index + 1}. ${entry.description}`, 11, true);
        addText(`   Amount: ${formatCurrency(annualAmount)} (${entry.period})`, 10);
        addText(`   Source: ${entry.source} | Data: ${entry.dataSource}`, 10);
        if (entry.notes) addText(`   Notes: ${entry.notes}`, 10);
        yPosition += 3;
      });
      addLine();

      // Business Expenses Details
      addText("BUSINESS EXPENSES BREAKDOWN", 14, true, [0, 102, 0]);
      businessExpenses.forEach((expense, index) => {
        const annualAmount = calculateAnnualAmount(expense.amount, expense.period);
        addText(`${index + 1}. ${expense.description}`, 11, true);
        addText(`   Amount: ${formatCurrency(annualAmount)} (${expense.period})`, 10);
        addText(`   Category: ${expense.category} | Data: ${expense.dataSource}`, 10);
        if (expense.notes) addText(`   Notes: ${expense.notes}`, 10);
        yPosition += 3;
      });
      addLine();

      // Tax Calculation Details
      addText("TAX CALCULATION DETAILS", 14, true, [0, 102, 0]);
      addText(`Tax Year: ${selectedTaxYear} (SARS Brackets)`, 12);
      addText(`Age Category: ${userAge}`, 12);
      addText(`Gross Tax (before rebates): ${formatCurrency(taxCalculation.grossTax)}`, 12);
      addText(`Tax Rebates Applied: ${formatCurrency(taxCalculation.rebates)}`, 12);
      addText(`Net Tax Liability: ${formatCurrency(taxCalculation.tax)}`, 12, true);
      addText(`Marginal Tax Rate: ${taxCalculation.marginalRate.toFixed(1)}%`, 12);
      addLine();

      // Personal Expenses (for reference)
      if (personalExpenses.length > 0) {
        addText("PERSONAL EXPENSES (NON-DEDUCTIBLE)", 14, true, [153, 76, 0]);
        personalExpenses.forEach((expense, index) => {
          const annualAmount = calculateAnnualAmount(expense.amount, expense.period);
          addText(`${index + 1}. ${expense.description}: ${formatCurrency(annualAmount)}`, 11);
          if (expense.notes) addText(`   Notes: ${expense.notes}`, 10);
        });
        addLine();
      }

      // Provisional Tax Schedule
      addText("PROVISIONAL TAX PAYMENT SCHEDULE", 14, true, [153, 0, 0]);
      const quarterlyTax = taxCalculation.tax / 4;
      addText(`1st Payment (31 August): ${formatCurrency(quarterlyTax)}`, 12);
      addText(`2nd Payment (28 February): ${formatCurrency(quarterlyTax)}`, 12);
      addText(`Annual Payment Total: ${formatCurrency(taxCalculation.tax)}`, 12, true);
      addLine();

      // Data Quality Summary
      addText("DATA QUALITY SUMMARY", 14, true, [0, 102, 0]);
      const autoDetected = incomeEntries.filter(e => e.dataSource === 'auto-detected').length + 
                          businessExpenses.filter(e => e.dataSource === 'auto-detected').length;
      const manual = incomeEntries.filter(e => e.dataSource === 'manual').length + 
                     businessExpenses.filter(e => e.dataSource === 'manual').length;
      const modified = incomeEntries.filter(e => e.dataSource === 'modified').length + 
                       businessExpenses.filter(e => e.dataSource === 'modified').length;

      addText(`Auto-detected entries: ${autoDetected}`, 11);
      addText(`Manual entries: ${manual}`, 11);
      addText(`Modified entries: ${modified}`, 11);
      addText(`Personal expenses tracked: ${personalExpenses.length}`, 11);
      addLine();

      // Important Notes
      addText("IMPORTANT NOTES", 14, true, [153, 0, 0]);
      addText("1. This calculation is based on SARS tax brackets for the selected tax year.", 10);
      addText("2. All amounts are in South African Rand (ZAR).", 10);
      addText("3. This is an estimate - consult with a qualified tax practitioner for official filing.", 10);
      addText("4. Keep all supporting documentation for business expense claims.", 10);
      addText("5. Provisional tax payments should be made by the due dates to avoid penalties.", 10);
      addText("6. Auto-detected entries were derived from financial statement analysis.", 10);

      // Footer
      yPosition = pageHeight - 30;
      doc.setFontSize(8);
      doc.setTextColor(100, 100, 100);
      doc.text("Generated by SA Tax Calculator - Professional Tax Planning Tool", 20, yPosition);
      doc.text(`Page ${doc.internal.getNumberOfPages()}`, pageWidth - 40, yPosition);

      // Save the PDF
      const fileName = `SA-Tax-Report-${selectedTaxYear}-${new Date().toISOString().split('T')[0]}.pdf`;
      doc.save(fileName);

      // Show success message
      alert(`PDF report generated successfully!\nFile: ${fileName}`);

    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Error generating PDF. Please try again.');
    }
  };

  // Import function
  const importFromCSV = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target.result;
        const lines = text.split('\n').slice(1); // Skip header
        let importedIncome = 0;
        let importedExpenses = 0;

        lines.forEach((line, index) => {
          if (!line.trim()) return;
          
          const [type, description, amount, period, , category, dataSource, notes] = line.split(',');
          
          if (!type || !description || !amount) {
            console.warn(`Skipping line ${index + 2}: Missing required fields`);
            return;
          }

          const entry = {
            id: Date.now() + index,
            description: description.trim(),
            amount: parseFloat(amount) || 0,
            period: period || 'annual',
            dataSource: dataSource || 'imported',
            notes: notes || ''
          };

          if (type.toLowerCase().includes('income')) {
            setIncomeEntries(prev => [...prev, {
              ...entry,
              source: category || 'Other'
            }]);
            importedIncome++;
          } else if (type.toLowerCase().includes('business') || type.toLowerCase().includes('expense')) {
            setBusinessExpenses(prev => [...prev, {
              ...entry,
              category: category || 'Other'
            }]);
            importedExpenses++;
          }
        });

        alert(`Import completed!\nIncome entries: ${importedIncome}\nExpense entries: ${importedExpenses}`);
      } catch (error) {
        alert('Error importing CSV: ' + error.message);
      }
    };
    reader.readAsText(file);
    event.target.value = ''; // Reset input
  };

  // Calculate annual amounts from period entries
  const calculateAnnualAmount = (amount, period) => {
    switch (period) {
      case '6months': return amount * 2;
      case '3months': return amount * 4;
      case 'monthly': return amount * 12;
      case 'weekly': return amount * 52;
      case 'annual': return amount;
      default: return amount;
    }
  };

  // Tax calculation function
  const calculateTax = useCallback((taxableIncome, taxYear, age) => {
    if (taxableIncome <= 0) return { tax: 0, effectiveRate: 0, marginalRate: 0 };
    
    const yearData = taxBracketsData[taxYear];
    if (!yearData) return { tax: 0, effectiveRate: 0, marginalRate: 0 };

    const { brackets, rebates, thresholds } = yearData;
    
    // Check if income is below threshold
    const threshold = age === 'under65' ? thresholds.under65 : 
                     age === 'under75' ? thresholds.under75 : thresholds.over75;
    
    if (taxableIncome <= threshold) {
      return { tax: 0, effectiveRate: 0, marginalRate: 0 };
    }

    let tax = 0;
    let marginalRate = 0;
    
    // Calculate tax using brackets
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
    
    // Apply rebates
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

  // Calculate totals
  const totalAnnualIncome = incomeEntries.reduce((sum, entry) => 
    sum + calculateAnnualAmount(entry.amount, entry.period), 0
  );
  
  const totalBusinessExpenses = businessExpenses.reduce((sum, expense) => 
    sum + calculateAnnualAmount(expense.amount, expense.period), 0
  );
  
  const taxableIncome = Math.max(0, totalAnnualIncome - totalBusinessExpenses);
  
  const taxCalculation = calculateTax(taxableIncome, selectedTaxYear, userAge);
  const monthlyTaxRequired = taxCalculation.tax / 12;
  const monthlyIncomeAfterTax = (totalAnnualIncome - taxCalculation.tax) / 12;

  // Format currency
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-ZA', {
      style: 'currency',
      currency: 'ZAR'
    }).format(amount);
  };

  // Add/Edit functions
  const addIncomeEntry = () => {
    const newEntry = {
      id: Date.now(),
      description: "New Income Source",
      amount: 0,
      period: "annual",
      source: "Employment",
      dataSource: "manual",
      notes: ""
    };
    setIncomeEntries([...incomeEntries, newEntry]);
    setEditingEntry({ type: 'income', id: newEntry.id });
  };

  const addExpenseEntry = () => {
    const newExpense = {
      id: Date.now(),
      description: "New Business Expense",
      amount: 0,
      period: "annual",
      category: "Business",
      dataSource: "manual",
      notes: ""
    };
    setBusinessExpenses([...businessExpenses, newExpense]);
    setEditingEntry({ type: 'expense', id: newExpense.id });
  };

  const addPersonalExpense = () => {
    const newExpense = {
      id: Date.now(),
      description: "New Personal Expense",
      amount: 0,
      period: "annual",
      category: "Personal",
      dataSource: "manual",
      notes: ""
    };
    setPersonalExpenses([...personalExpenses, newExpense]);
  };

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

  const deleteIncomeEntry = (id) => {
    setIncomeEntries(incomeEntries.filter(entry => entry.id !== id));
  };

  const deleteExpenseEntry = (id) => {
    setBusinessExpenses(businessExpenses.filter(expense => expense.id !== id));
  };

  const deletePersonalExpense = (id) => {
    setPersonalExpenses(personalExpenses.filter(expense => expense.id !== id));
  };

  // Bulk operations
  const deleteSelectedEntries = (type, selectedIds) => {
    if (type === 'income') {
      setIncomeEntries(incomeEntries.filter(entry => !selectedIds.includes(entry.id)));
    } else if (type === 'expense') {
      setBusinessExpenses(businessExpenses.filter(expense => !selectedIds.includes(expense.id)));
    }
  };

  // Move expense between business and personal
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

  // Validation
  const validateEntry = (entry) => {
    const errors = [];
    if (!entry.description.trim()) errors.push("Description is required");
    if (!entry.amount || entry.amount <= 0) errors.push("Amount must be greater than 0");
    return errors;
  };

  // Data source badge
  const getDataSourceBadge = (dataSource) => {
    const badges = {
      'auto-detected': { color: 'bg-blue-100 text-blue-800', text: 'Auto' },
      'manual': { color: 'bg-green-100 text-green-800', text: 'Manual' },
      'modified': { color: 'bg-orange-100 text-orange-800', text: 'Modified' },
      'calculated': { color: 'bg-purple-100 text-purple-800', text: 'Calc' },
      'moved-from-personal': { color: 'bg-gray-100 text-gray-800', text: 'Moved' },
      'moved-from-business': { color: 'bg-gray-100 text-gray-800', text: 'Moved' }
    };
    const badge = badges[dataSource] || badges['manual'];
    return (
      <span className={`px-2 py-1 text-xs rounded-full ${badge.color}`}>
        {badge.text}
      </span>
    );
  };

  // Export functions
  const exportToCSV = () => {
    const csvContent = [
      ["Type", "Description", "Amount", "Period", "Annual Amount", "Category/Source", "Data Source", "Notes"],
      ...incomeEntries.map(entry => [
        "Income", 
        entry.description, 
        entry.amount, 
        entry.period, 
        calculateAnnualAmount(entry.amount, entry.period), 
        entry.source,
        entry.dataSource,
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
        expense.notes || ""
      ]),
      ...personalExpenses.map(expense => [
        "Personal Expense (Non-Deductible)", 
        expense.description, 
        expense.amount, 
        expense.period,
        calculateAnnualAmount(expense.amount, expense.period), 
        expense.category,
        expense.dataSource,
        expense.notes || ""
      ]),
      [],
      ["Summary"],
      ["Total Annual Income", totalAnnualIncome],
      ["Total Business Expenses", totalBusinessExpenses],
      ["Taxable Income", taxableIncome],
      ["Tax Liability", taxCalculation.tax],
      ["Monthly Tax Required", monthlyTaxRequired],
      ["Effective Tax Rate", taxCalculation.effectiveRate.toFixed(2) + "%"],
      ["Marginal Tax Rate", taxCalculation.marginalRate.toFixed(1) + "%"],
      [],
      ["Data Quality"],
      ["Auto-detected entries", incomeEntries.filter(e => e.dataSource === 'auto-detected').length + businessExpenses.filter(e => e.dataSource === 'auto-detected').length],
      ["Manual entries", incomeEntries.filter(e => e.dataSource === 'manual').length + businessExpenses.filter(e => e.dataSource === 'manual').length],
      ["Modified entries", incomeEntries.filter(e => e.dataSource === 'modified').length + businessExpenses.filter(e => e.dataSource === 'modified').length],
      ["Personal expenses for review", personalExpenses.length]
    ].map(row => row.join(",")).join("\n");

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tax-calculation-detailed-${selectedTaxYear}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  const exportTaxSummary = () => {
    const autoDetectedIncome = incomeEntries.filter(e => e.dataSource === 'auto-detected');
    const manualIncome = incomeEntries.filter(e => e.dataSource === 'manual');
    const autoDetectedExpenses = businessExpenses.filter(e => e.dataSource === 'auto-detected');
    const manualExpenses = businessExpenses.filter(e => e.dataSource === 'manual');
    
    const summaryText = `
SOUTH AFRICAN TAX CALCULATION SUMMARY
${selectedTaxYear} TAX YEAR - DETAILED BREAKDOWN
Generated: ${new Date().toLocaleString()}
Application: Dynamic SA Tax Calculator

═══════════════════════════════════════════════════════════════════

TAXPAYER INFORMATION:
- Age Category: ${userAge}
- Tax Year: ${selectedTaxYear} (${selectedTaxYear-1} March - ${selectedTaxYear} February)
- Home Office Percentage: ${homeOfficePercentage}%

DATA QUALITY SUMMARY:
- Auto-detected entries: ${autoDetectedIncome.length + autoDetectedExpenses.length}
- Manual entries: ${manualIncome.length + manualExpenses.length}
- Modified entries: ${incomeEntries.filter(e => e.dataSource === 'modified').length + businessExpenses.filter(e => e.dataSource === 'modified').length}
- Personal expenses tracked: ${personalExpenses.length}

═══════════════════════════════════════════════════════════════════

INCOME SUMMARY (ANNUAL):

Auto-Detected Income Sources:
${autoDetectedIncome.map(entry => 
  `• ${entry.description}: ${formatCurrency(calculateAnnualAmount(entry.amount, entry.period))}
    Period: ${entry.period} | Source: ${entry.source}
    Notes: ${entry.notes || 'None'}
    Data Source: ${entry.dataSource}`
).join('\n')}

Manual Income Sources:
${manualIncome.map(entry => 
  `• ${entry.description}: ${formatCurrency(calculateAnnualAmount(entry.amount, entry.period))}
    Period: ${entry.period} | Source: ${entry.source}
    Notes: ${entry.notes || 'None'}
    Data Source: ${entry.dataSource}`
).join('\n')}

TOTAL ANNUAL INCOME: ${formatCurrency(totalAnnualIncome)}

═══════════════════════════════════════════════════════════════════

ALLOWABLE BUSINESS EXPENSES (ANNUAL):

Auto-Detected Business Expenses:
${autoDetectedExpenses.map(expense => 
  `• ${expense.description}: ${formatCurrency(calculateAnnualAmount(expense.amount, expense.period))}
    Period: ${expense.period} | Category: ${expense.category}
    Notes: ${expense.notes || 'None'}
    Data Source: ${expense.dataSource}`
).join('\n')}

Manual Business Expenses:
${manualExpenses.map(expense => 
  `• ${expense.description}: ${formatCurrency(calculateAnnualAmount(expense.amount, expense.period))}
    Period: ${expense.period} | Category: ${expense.category}
    Notes: ${expense.notes || 'None'}
    Data Source: ${expense.dataSource}`
).join('\n')}

TOTAL ALLOWABLE BUSINESS EXPENSES: ${formatCurrency(totalBusinessExpenses)}

═══════════════════════════════════════════════════════════════════

PERSONAL EXPENSES (NON-DEDUCTIBLE) - FOR REVIEW:
${personalExpenses.length > 0 ? personalExpenses.map(expense => 
  `• ${expense.description}: ${formatCurrency(calculateAnnualAmount(expense.amount, expense.period))}
    Period: ${expense.period} | Category: ${expense.category}
    Notes: ${expense.notes || 'None'}
    Data Source: ${expense.dataSource}`
).join('\n') : 'None tracked'}

═══════════════════════════════════════════════════════════════════

TAX CALCULATION (${selectedTaxYear} SARS TAX BRACKETS):

Taxable Income Calculation:
- Total Annual Income: ${formatCurrency(totalAnnualIncome)}
- Less: Total Business Expenses: ${formatCurrency(totalBusinessExpenses)}
- TAXABLE INCOME: ${formatCurrency(taxableIncome)}

Tax Calculation Details:
- Gross Tax (before rebates): ${formatCurrency(taxCalculation.grossTax)}
- Less: Tax Rebates (${userAge}): ${formatCurrency(taxCalculation.rebates)}
- NET TAX LIABILITY: ${formatCurrency(taxCalculation.tax)}

Tax Rates:
- Effective Tax Rate: ${taxCalculation.effectiveRate.toFixed(2)}%
- Marginal Tax Rate: ${taxCalculation.marginalRate.toFixed(1)}%

═══════════════════════════════════════════════════════════════════

PROVISIONAL TAX REQUIREMENTS:

Annual Tax Liability: ${formatCurrency(taxCalculation.tax)}
Monthly Provisional Tax Required: ${formatCurrency(monthlyTaxRequired)}
Monthly Net Income After Tax: ${formatCurrency(monthlyIncomeAfterTax)}

Percentage of Gross Income for Tax: ${((taxCalculation.tax / totalAnnualIncome) * 100).toFixed(1)}%

═══════════════════════════════════════════════════════════════════

SUPPORTING DOCUMENTATION REQUIRED:

Auto-Detected Entries:
- Bank statements covering the analysis period
- Salary advices and employment contracts
- Medical aid certificates
- Retirement annuity statements
- Invoice copies for business expenses

Manual Entries:
- Supporting receipts and invoices
- Contracts or agreements
- Additional documentation as per entry notes

Home Office Calculation:
- Floor plan or measurement verification
- Home-related expense receipts (bond, insurance, utilities)

═══════════════════════════════════════════════════════════════════

IMPORTANT NOTES FOR TAX PRACTITIONER:

1. This calculation is based on SARS ${selectedTaxYear} tax year brackets and rebates
2. All auto-detected entries were derived from bank statement analysis
3. Manual entries require additional verification and supporting documentation
4. Personal expenses listed may need review for potential business deductibility
5. Home office percentage (${homeOfficePercentage}%) should be verified against actual measurements
6. This is an estimate - final tax calculation should be verified by qualified tax practitioner

═══════════════════════════════════════════════════════════════════

Generated by Dynamic SA Tax Calculator
Date: ${new Date().toLocaleString()}
Version: Professional Tax Analysis Tool
    `;

    const blob = new Blob([summaryText], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tax-practitioner-summary-${selectedTaxYear}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">Dynamic SA Tax Calculator</h1>
          <p className="text-gray-600">Automated tax year detection with real-time calculations</p>
        </div>

        {/* Settings Panel */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold flex items-center">
              <Settings className="mr-2" size={20} />
              Settings & Configuration
            </h2>
            <div className="flex space-x-2">
              <button
                onClick={() => setEditMode(!editMode)}
                className={`flex items-center px-4 py-2 rounded-lg font-medium ${
                  editMode ? 'bg-green-600 text-white' : 'bg-blue-600 text-white'
                } hover:opacity-90 transition-opacity`}
              >
                {editMode ? <Save className="mr-2" size={16} /> : <Edit2 className="mr-2" size={16} />}
                {editMode ? 'Save Changes' : 'Edit Mode'}
              </button>
              <label className="flex items-center px-4 py-2 bg-orange-600 text-white rounded-lg font-medium hover:bg-orange-700 cursor-pointer">
                <Upload className="mr-2" size={16} />
                Import CSV
                <input
                  type="file"
                  accept=".csv"
                  onChange={importFromCSV}
                  className="hidden"
                />
              </label>
              <button
                onClick={exportToCSV}
                className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700"
              >
                <Download className="mr-2" size={16} />
                Export CSV
              </button>
              <button
                onClick={exportToPDF}
                className="flex items-center px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700"
              >
                <FileText className="mr-2" size={16} />
                Export PDF
              </button>
              <button
                onClick={exportTaxSummary}
                className="flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700"
              >
                <FileText className="mr-2" size={16} />
                Tax Summary
              </button>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Tax Year</label>
              <select
                value={selectedTaxYear}
                onChange={(e) => setSelectedTaxYear(parseInt(e.target.value))}
                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                {Object.keys(taxBracketsData).map(year => (
                  <option key={year} value={year}>
                    {year} Tax Year ({parseInt(year)-1} Mar - {year} Feb)
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
                placeholder="8.2"
              />
            </div>
          </div>
        </div>

        {/* Data Quality & Validation Panel */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4 flex items-center">
            <AlertCircle className="mr-2" size={20} />
            Data Quality & Review Status
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div className="bg-blue-50 rounded-lg p-4">
              <h3 className="font-semibold text-blue-800 mb-2">Auto-Detected Entries</h3>
              <div className="text-2xl font-bold text-blue-700">
                {incomeEntries.filter(e => e.dataSource === 'auto-detected').length + 
                 businessExpenses.filter(e => e.dataSource === 'auto-detected').length}
              </div>
              <p className="text-sm text-blue-600">Found from bank statements</p>
            </div>
            
            <div className="bg-green-50 rounded-lg p-4">
              <h3 className="font-semibold text-green-800 mb-2">Manual Entries</h3>
              <div className="text-2xl font-bold text-green-700">
                {incomeEntries.filter(e => e.dataSource === 'manual').length + 
                 businessExpenses.filter(e => e.dataSource === 'manual').length}
              </div>
              <p className="text-sm text-green-600">Added manually</p>
            </div>
            
            <div className="bg-orange-50 rounded-lg p-4">
              <h3 className="font-semibold text-orange-800 mb-2">Modified Entries</h3>
              <div className="text-2xl font-bold text-orange-700">
                {incomeEntries.filter(e => e.dataSource === 'modified').length + 
                 businessExpenses.filter(e => e.dataSource === 'modified').length}
              </div>
              <p className="text-sm text-orange-600">Auto-detected but edited</p>
            </div>
          </div>
          
          {/* Validation Warnings */}
          <div className="space-y-3">
            {incomeEntries.some(e => !e.description.trim() || !e.amount || e.amount <= 0) && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <div className="flex items-center space-x-2">
                  <AlertCircle className="text-red-600" size={16} />
                  <span className="font-medium text-red-800">Income Validation Issues</span>
                </div>
                <p className="text-red-700 text-sm mt-1">
                  Some income entries have missing descriptions or invalid amounts. Please review and correct.
                </p>
              </div>
            )}
            
            {businessExpenses.some(e => !e.description.trim() || !e.amount || e.amount <= 0) && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <div className="flex items-center space-x-2">
                  <AlertCircle className="text-red-600" size={16} />
                  <span className="font-medium text-red-800">Expense Validation Issues</span>
                </div>
                <p className="text-red-700 text-sm mt-1">
                  Some business expenses have missing descriptions or invalid amounts. Please review and correct.
                </p>
              </div>
            )}
            
            {personalExpenses.length > 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <div className="flex items-center space-x-2">
                  <AlertCircle className="text-yellow-600" size={16} />
                  <span className="font-medium text-yellow-800">Personal Expenses Need Review</span>
                </div>
                <p className="text-yellow-700 text-sm mt-1">
                  You have {personalExpenses.length} personal expenses. Review if any should be business deductible.
                </p>
              </div>
            )}
            
            {(incomeEntries.length === 0 || businessExpenses.length === 0) && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <div className="flex items-center space-x-2">
                  <AlertCircle className="text-blue-600" size={16} />
                  <span className="font-medium text-blue-800">Missing Data</span>
                </div>
                <p className="text-blue-700 text-sm mt-1">
                  {incomeEntries.length === 0 && "No income entries found. "}
                  {businessExpenses.length === 0 && "No business expenses found. "}
                  Add entries manually or upload bank statements.
                </p>
              </div>
            )}
          </div>
          
          {/* Quick Actions */}
          <div className="mt-4 pt-4 border-t">
            <h4 className="font-medium text-gray-800 mb-2">Quick Actions</h4>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setEditMode(true)}
                className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
              >
                Enable Edit Mode
              </button>
              <button
                onClick={addIncomeEntry}
                className="px-3 py-1 text-sm bg-green-100 text-green-700 rounded hover:bg-green-200"
              >
                Add Income
              </button>
              <button
                onClick={addExpenseEntry}
                className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
              >
                Add Business Expense
              </button>
              <label className="px-3 py-1 text-sm bg-orange-100 text-orange-700 rounded hover:bg-orange-200 cursor-pointer">
                Import CSV
                <input
                  type="file"
                  accept=".csv"
                  onChange={importFromCSV}
                  className="hidden"
                />
              </label>
              <button
                onClick={exportToPDF}
                className="px-3 py-1 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200"
              >
                Generate PDF Report
              </button>
              <button
                onClick={exportTaxSummary}
                className="px-3 py-1 text-sm bg-purple-100 text-purple-700 rounded hover:bg-purple-200"
              >
                Export for Tax Practitioner
              </button>
            </div>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Annual Income</p>
                <p className="text-2xl font-bold text-green-600">
                  {formatCurrency(totalAnnualIncome)}
                </p>
              </div>
              <DollarSign className="text-green-600" size={32} />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Business Expenses</p>
                <p className="text-2xl font-bold text-blue-600">
                  {formatCurrency(totalBusinessExpenses)}
                </p>
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
                {incomeEntries.filter(e => e.dataSource === 'auto-detected').length} auto-detected, 
                {incomeEntries.filter(e => e.dataSource === 'manual').length} manual
              </span>
            </div>
          </div>
          
          <div className="space-y-3">
            {incomeEntries.map((entry) => (
              <div key={entry.id} className="p-4 bg-gray-50 rounded-lg border-l-4 border-green-500">
                {editMode ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        {getDataSourceBadge(entry.dataSource)}
                        <span className="text-sm text-gray-600">ID: {entry.id}</span>
                      </div>
                      <button
                        onClick={() => deleteIncomeEntry(entry.id)}
                        className="p-1 text-red-600 hover:bg-red-100 rounded"
                        title="Delete Entry"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">Description</label>
                        <input
                          type="text"
                          value={entry.description}
                          onChange={(e) => updateIncomeEntry(entry.id, 'description', e.target.value)}
                          className="w-full p-2 border border-gray-300 rounded text-sm"
                          placeholder="Income description"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">Amount</label>
                        <input
                          type="number"
                          step="0.01"
                          value={entry.amount}
                          onChange={(e) => updateIncomeEntry(entry.id, 'amount', e.target.value)}
                          className="w-full p-2 border border-gray-300 rounded text-sm"
                          placeholder="0.00"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">Period</label>
                        <select
                          value={entry.period}
                          onChange={(e) => updateIncomeEntry(entry.id, 'period', e.target.value)}
                          className="w-full p-2 border border-gray-300 rounded text-sm"
                        >
                          <option value="annual">Annual</option>
                          <option value="6months">6 Months</option>
                          <option value="3months">3 Months</option>
                          <option value="monthly">Monthly</option>
                          <option value="weekly">Weekly</option>
                        </select>
                      </div>
                      
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">Category</label>
                        <select
                          value={entry.source}
                          onChange={(e) => updateIncomeEntry(entry.id, 'source', e.target.value)}
                          className="w-full p-2 border border-gray-300 rounded text-sm"
                        >
                          {incomeCategories.map(cat => (
                            <option key={cat} value={cat}>{cat}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Notes</label>
                      <input
                        type="text"
                        value={entry.notes || ''}
                        onChange={(e) => updateIncomeEntry(entry.id, 'notes', e.target.value)}
                        className="w-full p-2 border border-gray-300 rounded text-sm"
                        placeholder="Additional notes or source details"
                      />
                    </div>
                    
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-600">Annual Amount:</span>
                      <span className="font-semibold text-green-700">
                        {formatCurrency(calculateAnnualAmount(entry.amount, entry.period))}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        {getDataSourceBadge(entry.dataSource)}
                        <span className="font-medium text-lg">{entry.description}</span>
                      </div>
                      <div className="text-right">
                        <div className="text-xl font-bold text-green-600">
                          {formatCurrency(calculateAnnualAmount(entry.amount, entry.period))}
                        </div>
                        <div className="text-sm text-gray-600">
                          {formatCurrency(entry.amount)} per {entry.period}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex justify-between text-sm text-gray-600">
                      <span>Category: {entry.source}</span>
                      {entry.notes && (
                        <span className="italic">💡 {entry.notes}</span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
            
            <div className="border-t-2 pt-4 font-bold flex justify-between text-lg">
              <span>Total Annual Income:</span>
              <span className="text-green-700">{formatCurrency(totalAnnualIncome)}</span>
            </div>
          </div>
        </div>

        {/* Business Expenses Section */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-blue-700">Allowable Business Expenses</h3>
            <div className="flex space-x-2">
              {editMode && (
                <button
                  onClick={addExpenseEntry}
                  className="flex items-center px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  <Plus className="mr-1" size={16} />
                  Add Expense
                </button>
              )}
              <span className="text-sm text-gray-600">
                {businessExpenses.filter(e => e.dataSource === 'auto-detected').length} auto-detected, 
                {businessExpenses.filter(e => e.dataSource === 'manual').length} manual
              </span>
            </div>
          </div>
          
          <div className="space-y-3">
            {businessExpenses.map((expense) => (
              <div key={expense.id} className="p-4 bg-gray-50 rounded-lg border-l-4 border-blue-500">
                {editMode ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        {getDataSourceBadge(expense.dataSource)}
                        <span className="text-sm text-gray-600">ID: {expense.id}</span>
                        <button
                          onClick={() => moveExpenseToPersonal(expense)}
                          className="px-2 py-1 text-xs bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                          title="Move to Personal Expenses"
                        >
                          → Personal
                        </button>
                      </div>
                      <button
                        onClick={() => deleteExpenseEntry(expense.id)}
                        className="p-1 text-red-600 hover:bg-red-100 rounded"
                        title="Delete Entry"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">Description</label>
                        <input
                          type="text"
                          value={expense.description}
                          onChange={(e) => updateExpenseEntry(expense.id, 'description', e.target.value)}
                          className="w-full p-2 border border-gray-300 rounded text-sm"
                          placeholder="Expense description"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">Amount</label>
                        <input
                          type="number"
                          step="0.01"
                          value={expense.amount}
                          onChange={(e) => updateExpenseEntry(expense.id, 'amount', e.target.value)}
                          className="w-full p-2 border border-gray-300 rounded text-sm"
                          placeholder="0.00"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">Period</label>
                        <select
                          value={expense.period}
                          onChange={(e) => updateExpenseEntry(expense.id, 'period', e.target.value)}
                          className="w-full p-2 border border-gray-300 rounded text-sm"
                        >
                          <option value="annual">Annual</option>
                          <option value="6months">6 Months</option>
                          <option value="3months">3 Months</option>
                          <option value="monthly">Monthly</option>
                          <option value="weekly">Weekly</option>
                        </select>
                      </div>
                      
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">Category</label>
                        <select
                          value={expense.category}
                          onChange={(e) => updateExpenseEntry(expense.id, 'category', e.target.value)}
                          className="w-full p-2 border border-gray-300 rounded text-sm"
                        >
                          {expenseCategories.map(cat => (
                            <option key={cat} value={cat}>{cat}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Notes</label>
                      <input
                        type="text"
                        value={expense.notes || ''}
                        onChange={(e) => updateExpenseEntry(expense.id, 'notes', e.target.value)}
                        className="w-full p-2 border border-gray-300 rounded text-sm"
                        placeholder="Additional notes, receipts, or justification"
                      />
                    </div>
                    
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-600">Annual Amount:</span>
                      <span className="font-semibold text-blue-700">
                        {formatCurrency(calculateAnnualAmount(expense.amount, expense.period))}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        {getDataSourceBadge(expense.dataSource)}
                        <span className="font-medium text-lg">{expense.description}</span>
                      </div>
                      <div className="text-right">
                        <div className="text-xl font-bold text-blue-600">
                          {formatCurrency(calculateAnnualAmount(expense.amount, expense.period))}
                        </div>
                        <div className="text-sm text-gray-600">
                          {formatCurrency(expense.amount)} per {expense.period}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex justify-between text-sm text-gray-600">
                      <span>Category: {expense.category}</span>
                      {expense.notes && (
                        <span className="italic">💡 {expense.notes}</span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
            
            <div className="border-t-2 pt-4 font-bold flex justify-between text-lg">
              <span>Total Business Expenses:</span>
              <span className="text-blue-700">{formatCurrency(totalBusinessExpenses)}</span>
            </div>
          </div>
        </div>

        {/* Personal Expenses Section (Non-Deductible) */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-700">Personal Expenses (Non-Deductible)</h3>
            <div className="flex space-x-2">
              {editMode && (
                <button
                  onClick={addPersonalExpense}
                  className="flex items-center px-3 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
                >
                  <Plus className="mr-1" size={16} />
                  Add Personal
                </button>
              )}
              <span className="text-sm text-gray-600">
                {personalExpenses.length} items tracked
              </span>
            </div>
          </div>
          
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
            <div className="flex items-start space-x-3">
              <AlertCircle className="text-yellow-600 mt-1" size={20} />
              <div>
                <h4 className="font-semibold text-yellow-800 mb-1">Review These Expenses</h4>
                <p className="text-yellow-700 text-sm">
                  These expenses are currently classified as personal and won't reduce your tax liability. 
                  Review each item - if any should be business expenses, you can move them using the "→ Business" button.
                </p>
              </div>
            </div>
          </div>
          
          <div className="space-y-3">
            {personalExpenses.map((expense) => (
              <div key={expense.id} className="p-4 bg-gray-50 rounded-lg border-l-4 border-gray-400">
                {editMode ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        {getDataSourceBadge(expense.dataSource)}
                        <span className="text-sm text-gray-600">ID: {expense.id}</span>
                        <button
                          onClick={() => moveExpenseToBusiness(expense)}
                          className="px-2 py-1 text-xs bg-blue-200 text-blue-700 rounded hover:bg-blue-300"
                          title="Move to Business Expenses"
                        >
                          → Business
                        </button>
                      </div>
                      <button
                        onClick={() => deletePersonalExpense(expense.id)}
                        className="p-1 text-red-600 hover:bg-red-100 rounded"
                        title="Delete Entry"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">Description</label>
                        <input
                          type="text"
                          value={expense.description}
                          onChange={(e) => updatePersonalExpense(expense.id, 'description', e.target.value)}
                          className="w-full p-2 border border-gray-300 rounded text-sm"
                          placeholder="Expense description"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">Amount</label>
                        <input
                          type="number"
                          step="0.01"
                          value={expense.amount}
                          onChange={(e) => updatePersonalExpense(expense.id, 'amount', e.target.value)}
                          className="w-full p-2 border border-gray-300 rounded text-sm"
                          placeholder="0.00"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">Period</label>
                        <select
                          value={expense.period}
                          onChange={(e) => updatePersonalExpense(expense.id, 'period', e.target.value)}
                          className="w-full p-2 border border-gray-300 rounded text-sm"
                        >
                          <option value="annual">Annual</option>
                          <option value="6months">6 Months</option>
                          <option value="3months">3 Months</option>
                          <option value="monthly">Monthly</option>
                          <option value="weekly">Weekly</option>
                        </select>
                      </div>
                      
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">Category</label>
                        <select
                          value={expense.category}
                          onChange={(e) => updatePersonalExpense(expense.id, 'category', e.target.value)}
                          className="w-full p-2 border border-gray-300 rounded text-sm"
                        >
                          <option value="Personal">Personal</option>
                          <option value="Entertainment">Entertainment</option>
                          <option value="Health">Health</option>
                          <option value="Transport">Transport</option>
                          <option value="Food">Food</option>
                          <option value="Clothing">Clothing</option>
                          <option value="Other">Other</option>
                        </select>
                      </div>
                    </div>
                    
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Notes</label>
                      <input
                        type="text"
                        value={expense.notes || ''}
                        onChange={(e) => updatePersonalExpense(expense.id, 'notes', e.target.value)}
                        className="w-full p-2 border border-gray-300 rounded text-sm"
                        placeholder="Why this is personal vs business expense"
                      />
                    </div>
                    
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-600">Annual Amount:</span>
                      <span className="font-semibold text-gray-700">
                        {formatCurrency(calculateAnnualAmount(expense.amount, expense.period))}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        {getDataSourceBadge(expense.dataSource)}
                        <span className="font-medium text-lg">{expense.description}</span>
                        {editMode && (
                          <button
                            onClick={() => moveExpenseToBusiness(expense)}
                            className="px-2 py-1 text-xs bg-blue-200 text-blue-700 rounded hover:bg-blue-300"
                            title="Move to Business Expenses"
                          >
                            → Business
                          </button>
                        )}
                      </div>
                      <div className="text-right">
                        <div className="text-xl font-bold text-gray-600">
                          {formatCurrency(calculateAnnualAmount(expense.amount, expense.period))}
                        </div>
                        <div className="text-sm text-gray-500">
                          {formatCurrency(expense.amount)} per {expense.period}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex justify-between text-sm text-gray-600">
                      <span>Category: {expense.category}</span>
                      {expense.notes && (
                        <span className="italic">💡 {expense.notes}</span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
            
            {personalExpenses.length === 0 ? (
              <div className="text-center text-gray-500 py-8">
                <p>No personal expenses tracked.</p>
                <p className="text-sm">Add personal expenses here for complete financial tracking.</p>
              </div>
            ) : (
              <div className="border-t-2 pt-4 font-bold flex justify-between text-lg">
                <span>Total Personal Expenses:</span>
                <span className="text-gray-700">
                  {formatCurrency(personalExpenses.reduce((sum, expense) => 
                    sum + calculateAnnualAmount(expense.amount, expense.period), 0
                  ))}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Tax Calculation Breakdown */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h3 className="text-lg font-semibold mb-4 text-purple-700">
            📊 Tax Calculation Breakdown - {selectedTaxYear} Tax Year
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <div className="flex justify-between">
                <span>Total Annual Income:</span>
                <span className="font-semibold">{formatCurrency(totalAnnualIncome)}</span>
              </div>
              <div className="flex justify-between">
                <span>Less: Business Expenses:</span>
                <span className="font-semibold text-blue-600">({formatCurrency(totalBusinessExpenses)})</span>
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
                <span>Less: Tax Rebates:</span>
                <span className="font-semibold text-green-600">({formatCurrency(taxCalculation.rebates)})</span>
              </div>
              <div className="flex justify-between border-t-2 pt-2 text-lg font-bold">
                <span>Net Tax Liability:</span>
                <span className="text-red-600">{formatCurrency(taxCalculation.tax)}</span>
              </div>
            </div>
            
            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="font-semibold mb-3">Tax Rates & Info</h4>
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
                  <span className="font-medium text-green-600">{formatCurrency(monthlyIncomeAfterTax)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Tax Threshold ({userAge}):</span>
                  <span className="font-medium">{formatCurrency(taxBracketsData[selectedTaxYear].thresholds[userAge])}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center text-gray-600 text-sm">
          <p>This calculation is an estimate based on SARS tax brackets for the {selectedTaxYear} tax year.</p>
          <p>Please consult with a qualified tax practitioner for official tax filing and advice.</p>
          <p className="mt-2 font-medium">Generated: {new Date().toLocaleString()}</p>
        </div>
      </div>
    </div>
  );
};

export default DynamicTaxApp;