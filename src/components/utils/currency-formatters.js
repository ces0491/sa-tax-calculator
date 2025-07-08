// Fixed Currency Formatters and Utilities
// This replaces src/components/utils/currency-formatters.js

// Calculate annual amount from different periods
export const calculateAnnualAmount = (amount, period, statementPeriod = null, useProjection = true) => {
  if (!amount || isNaN(amount)) return 0;
  
  const basePeriodMultipliers = { 
    daily: 365, 
    weekly: 52, 
    monthly: 12, 
    annually: 1,
    actual: 1
  };
  
  let baseAnnual = amount * (basePeriodMultipliers[period] || 1);
  
  // If we have statement period info and it's partial year data, apply annualization
  if (useProjection && statementPeriod?.isPartialYear && period === 'actual') {
    baseAnnual = amount * statementPeriod.annualizationFactor;
  }
  
  return baseAnnual;
};

// Format currency in South African Rand
export const formatCurrency = (amount) => {
  if (amount === null || amount === undefined || isNaN(amount)) {
    return 'R0.00';
  }
  
  return new Intl.NumberFormat('en-ZA', {
    style: 'currency',
    currency: 'ZAR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
};

// Get current tax year (SA tax year runs March 1 to Feb 28/29)
export const getCurrentTaxYear = () => {
  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth(); // 0-indexed: 0=Jan, 1=Feb, 2=Mar
  
  // SA tax year runs March 1 to Feb 28/29
  // If we're in March or later, we're in the next tax year
  return currentMonth >= 2 ? currentYear + 1 : currentYear;
};

// Data source badge helper
export const getDataSourceBadge = (dataSource, confidence, isExcluded = false) => {
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
  const confidenceText = (confidence && confidence < 1) ? ` (${Math.round(confidence * 100)}%)` : '';
  
  // Override with exclusion styling if excluded
  const finalBadge = isExcluded ? badges['excluded'] : badge;
  
  return {
    className: `px-2 py-1 text-xs rounded-full ${finalBadge.color}`,
    text: `${finalBadge.text}${confidenceText}`
  };
};

// Income and expense categories
export const incomeCategories = ["Employment", "Freelance", "Investment", "Rental", "Business", "Other"];
export const expenseCategories = ["Office", "Medical", "Retirement", "Professional", "Education", "Travel", "Equipment", "Software", "Insurance", "Utilities", "Marketing", "Training", "Other"];

// Export/import functions
export const exportToCSV = (incomeEntries, businessExpenses, personalExpenses, statementPeriod) => {
  const csvRows = [
    ["Type", "Description", "Amount", "Period", "Annual Amount", "Category/Source", "Data Source", "Confidence", "Excluded", "Notes"]
  ];
  
  // Add income entries
  incomeEntries.forEach(entry => {
    csvRows.push([
      "Income", 
      entry.description || '', 
      entry.amount || 0, 
      entry.period || 'actual', 
      calculateAnnualAmount(entry.amount, entry.period, statementPeriod), 
      entry.source || '',
      entry.dataSource || 'manual',
      entry.confidence || 'N/A',
      'No',
      entry.notes || ""
    ]);
  });
  
  // Add business expenses
  businessExpenses.forEach(expense => {
    csvRows.push([
      "Business Expense", 
      expense.description || '', 
      expense.amount || 0, 
      expense.period || 'actual',
      calculateAnnualAmount(expense.amount, expense.period, statementPeriod), 
      expense.category || '',
      expense.dataSource || 'manual',
      expense.confidence || 'N/A',
      expense.isExcluded ? 'Yes - Not Deductible' : 'No',
      expense.notes || ""
    ]);
  });
  
  // Add personal expenses
  personalExpenses.forEach(expense => {
    csvRows.push([
      "Personal Expense", 
      expense.description || '', 
      expense.amount || 0, 
      expense.period || 'actual',
      calculateAnnualAmount(expense.amount, expense.period, statementPeriod), 
      expense.category || '',
      expense.dataSource || 'manual',
      expense.confidence || 'N/A',
      expense.isExcluded ? 'Yes - Personal' : 'No',
      expense.notes || ""
    ]);
  });

  const csvContent = csvRows.map(row => 
    row.map(field => {
      // Escape fields that contain commas, quotes, or newlines
      const stringField = String(field);
      if (stringField.includes(',') || stringField.includes('"') || stringField.includes('\n')) {
        return `"${stringField.replace(/"/g, '""')}"`;
      }
      return stringField;
    }).join(",")
  ).join("\n");

  try {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sa-tax-calculation-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Error exporting CSV:', error);
    alert('Error exporting CSV file. Please try again.');
  }
};

// Format percentage
export const formatPercentage = (value, decimals = 1) => {
  if (value === null || value === undefined || isNaN(value)) {
    return '0.0%';
  }
  return `${value.toFixed(decimals)}%`;
};

// Format number with commas
export const formatNumber = (value, decimals = 0) => {
  if (value === null || value === undefined || isNaN(value)) {
    return '0';
  }
  return new Intl.NumberFormat('en-ZA', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  }).format(value);
};