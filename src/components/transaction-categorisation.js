// Transaction Categorization Logic
// This file contains the smart categorization rules for transactions

export const createCategorizer = (logMessage, debugMode, homeOfficePercentage, calculateAnnualAmount) => {
  
  const categorizeTransactions = (transactions) => {
    logMessage('info', 'categorization', `Starting enhanced categorization of ${transactions.length} transactions`);
    
    const categorized = {
      income: [],
      business: [],
      personal: [],
      home: [],
      uncategorized: []
    };

    let excludedCount = 0;
    const groupedIncome = new Map();
    
    transactions.forEach((transaction, index) => {
      let wasProcessed = false;
      
      // Auto-exclude obvious bank fees and internal transfers
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

      // 1. Income patterns - Updated for contractor vs employment
      const obviousIncomePatterns = [
        { 
          pattern: /PRECISE DIGIT.*teletransmission.*inward/i, 
          category: "Freelance", 
          source: "NZ Company Contractor Payment (Precise Digitait)", 
          groupKey: "nz-contractor" 
        },
        { 
          pattern: /CASHFOCUS SALARY.*credit transfer/i, 
          category: "Employment", 
          source: "Employment Salary", 
          groupKey: "employment-salary" 
        }
      ];

      for (const rule of obviousIncomePatterns) {
        if (rule.pattern.test(transaction.originalDescription) && transaction.amount > 0) {
          
          // Group similar transactions together
          if (!groupedIncome.has(rule.groupKey)) {
            groupedIncome.set(rule.groupKey, {
              id: Date.now() + Math.random(),
              description: rule.source,
              amount: 0,
              period: 'actual',
              source: rule.category,
              dataSource: 'auto-detected',
              confidence: 0.95,
              sourceTransactions: [],
              notes: `Auto-detected and grouped from multiple transactions`
            });
          }
          
          const groupedEntry = groupedIncome.get(rule.groupKey);
          groupedEntry.amount += Math.abs(transaction.amount);
          groupedEntry.sourceTransactions.push(transaction);
          
          wasProcessed = true;
          
          logMessage('debug', 'categorization', `Income auto-categorized and grouped`, {
            rule: rule.category,
            amount: transaction.amount,
            groupKey: rule.groupKey,
            totalInGroup: groupedEntry.amount,
            transactionCount: groupedEntry.sourceTransactions.length,
            description: transaction.originalDescription.substring(0, 50)
          });
          
          break;
        }
      }

      if (wasProcessed) return;

      // 2. Business expenses (high confidence only)
      const obviousBusinessPatterns = [
        { pattern: /10XRA COL.*service agreement|10X RETIREMENT ANN.*ib payment/i, category: "Retirement", description: "Retirement Annuity Contribution" },
        { pattern: /DISC PREM.*medical aid.*contribution/i, category: "Medical", description: "Medical Aid Contribution" },
        { pattern: /PERSONAL TAX SERVICE.*PROVTAX.*ib payment/i, category: "Professional", description: "Tax Advisory Services" },
        { pattern: /ROZPRINT.*cheque card purchase/i, category: "Office", description: "Printing Services" },
        { pattern: /BOOTLEGGER.*cheque card purchase|SHIFT ESPRESS.*cheque card purchase/i, category: "Office", description: "Coffee Expenses" },
        { pattern: /POINT GARDEN SERVICE.*GARDEN.*ib payment/i, category: "Office", description: "Garden Maintenance (Office)" },
        { pattern: /Dr Malcol.*cheque card purchase/i, category: "Medical", description: "Medical Consultation" },
        { pattern: /PAYU \* UC.*cheque card purchase/i, category: "Education", description: "University of Cape Town - Education Expense" }
      ];

      for (const rule of obviousBusinessPatterns) {
        if (rule.pattern.test(transaction.originalDescription) && transaction.amount < 0) {
          const expenseEntry = {
            id: Date.now() + Math.random(),
            description: rule.description,
            amount: Math.abs(transaction.amount),
            period: 'actual',
            category: rule.category,
            dataSource: 'auto-detected',
            confidence: 0.95,
            sourceTransactions: [transaction],
            notes: `Auto-detected from: ${transaction.originalDescription.substring(0, 80)}`
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
        { pattern: /INSURANCE PREMIUM.*IP/i, category: "Insurance", description: "Home Insurance" },
        { pattern: /DISCINSURE.*insurance premium/i, category: "Insurance", description: "Home/Contents Insurance" }
      ];

      for (const rule of homeExpensePatterns) {
        if (rule.pattern.test(transaction.originalDescription)) {
          const expenseEntry = {
            id: Date.now() + Math.random(),
            description: rule.description,
            amount: Math.abs(transaction.amount),
            period: 'actual',
            category: rule.category,
            dataSource: 'auto-detected',
            confidence: 0.95,
            sourceTransactions: [transaction],
            notes: `Auto-detected from: ${transaction.originalDescription.substring(0, 80)}`
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

      // 4. Auto-exclude obvious personal expenses
      const personalExpensePatterns = [
        { pattern: /netflix|youtube|virgin.*netcash|apple\.com|sabc/i, reason: "Personal entertainment/subscriptions" },
        { pattern: /woolworths|pnp|checkers|mcd|engen|bp.*pineland/i, reason: "Personal shopping/fuel" },
        { pattern: /old mutual.*unit trust|om unittru/i, reason: "Personal investments (not retirement)" }
      ];

      for (const rule of personalExpensePatterns) {
        if (rule.pattern.test(transaction.originalDescription) && transaction.amount < 0) {
          const expenseEntry = {
            id: Date.now() + Math.random(),
            description: transaction.originalDescription,
            amount: Math.abs(transaction.amount),
            period: 'actual',
            category: 'Personal',
            dataSource: 'auto-detected',
            confidence: 0.9,
            sourceTransactions: [transaction],
            isExcluded: true,
            exclusionReason: rule.reason,
            notes: `Auto-categorized as personal: ${rule.reason}`
          };
          
          categorized.personal.push(expenseEntry);
          wasProcessed = true;
          
          logMessage('debug', 'categorization', `Personal expense auto-categorized`, {
            reason: rule.reason,
            amount: transaction.amount,
            description: transaction.originalDescription.substring(0, 50)
          });
          
          break;
        }
      }

      if (wasProcessed) return;

      // Everything else goes to uncategorized for manual review
      if (Math.abs(transaction.amount) > 10) {
        categorized.uncategorized.push({
          ...transaction,
          reason: 'Requires manual categorization - potential income or business expense'
        });
      }
    });

    // Add grouped income entries to the categorized results
    groupedIncome.forEach((incomeEntry) => {
      categorized.income.push(incomeEntry);
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
      autoPersonal: categorized.personal.length,
      autoHome: categorized.home.length,
      excluded: excludedCount,
      uncategorized: categorized.uncategorized.length,
      requiresReview: categorized.uncategorized.length,
      totalIncomeAmount: categorized.income.reduce((sum, item) => sum + item.amount, 0),
      totalBusinessAmount: categorized.business.reduce((sum, item) => sum + item.amount, 0)
    };

    logMessage('info', 'categorization', 'Enhanced categorization completed', categorizationSummary);

    return categorized;
  };

  return {
    categorizeTransactions
  };
};