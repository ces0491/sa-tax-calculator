// Calculate annual amount from different periods
export const calculateAnnualAmount = (amount, period, statementPeriod = null, useProjection = true) => {
  if (!amount) return 0;
  
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
  return new Intl.NumberFormat('en-ZA', {
    style: 'currency',
    currency: 'ZAR'
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
  const confidenceText = confidence ? ` (${Math.round(confidence * 100)}%)` : '';
  
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
export const exportToCSV = (incomeEntries, businessExpenses, personalExpenses, calculateAnnualAmount) => {
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
  a.download = `sa-tax-calculation-${new Date().toISOString().split('T')[0]}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
};