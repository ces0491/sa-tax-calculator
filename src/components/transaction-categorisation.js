// Fixed Transaction Categorization Logic
// This replaces src/components/transaction-categorisation.js

export const createCategorizer = (logMessage, debugMode, homeOfficePercentage, calculateAnnualAmount) => {
  
  const categorizeTransactions = (transactions) => {
    logMessage('info', 'categorization', `Starting categorization of ${transactions.length} transactions`);
    
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
      const desc = transaction.originalDescription.toLowerCase();
      
      // 1. AUTO-EXCLUDE obvious bank fees and internal transfers
      const excludePatterns = [
        /fixed monthly fee|overdraft service fee|ucount.*membership fee/i,
        /fee.*mu primary sms|administration fee|fee.*account.*validation/i,
        /honouring fee|electronic pmt.*fee|inter acc transfer fee/i,
        /international txn fee|prepaid fee|#.*fee/i,
        /cash finance charge|finance charge|credit interest|excess interest/i,
        /rtd.not provided for|debit order reversal|reversal/i,
        /ces.*ib transfer|fund transfers.*marsh|int acnt trf.*ces|autobank transfer/i,
        /jackie.*ib payment|ib payment.*jackie/i,
        /withdraw.*real time transfer|autobank cash withdrawal/i
      ];
      
      for (const pattern of excludePatterns) {
        if (pattern.test(transaction.originalDescription)) {
          excludedCount++;
          wasProcessed = true;
          if (debugMode) {
            logMessage('debug', 'categorization', `Auto-excluded: ${transaction.originalDescription.substring(0, 50)}`);
          }
          break;
        }
      }
      
      if (wasProcessed) return;

      // 2. INCOME SOURCES - Based on your specific patterns
      const incomePatterns = [
        { 
          pattern: /precise digit.*teletransmission.*inward/i, 
          category: "Freelance", 
          source: "NZ Company Contractor Payment", 
          groupKey: "nz-contractor",
          confidence: 0.98
        },
        { 
          pattern: /cashfocus salary.*credit transfer/i, 
          category: "Employment", 
          source: "Employment Salary", 
          groupKey: "employment-salary",
          confidence: 0.95
        }
      ];

      for (const rule of incomePatterns) {
        if (rule.pattern.test(transaction.originalDescription) && transaction.amount > 0) {
          // Group similar income transactions
          if (!groupedIncome.has(rule.groupKey)) {
            groupedIncome.set(rule.groupKey, {
              id: Date.now() + Math.random(),
              description: rule.source,
              amount: 0,
              period: 'actual',
              source: rule.category,
              dataSource: 'auto-detected',
              confidence: rule.confidence,
              sourceTransactions: [],
              notes: `Auto-detected and grouped from multiple transactions`
            });
          }
          
          const groupedEntry = groupedIncome.get(rule.groupKey);
          groupedEntry.amount += Math.abs(transaction.amount);
          groupedEntry.sourceTransactions.push(transaction);
          
          wasProcessed = true;
          logMessage('debug', 'categorization', `Income grouped: ${rule.category} - ${transaction.amount}`);
          break;
        }
      }

      if (wasProcessed) return;

      // 3. BUSINESS EXPENSES - Based on your specific patterns
      const businessPatterns = [
        // Retirement/Pension
        { 
          pattern: /10xra col.*service agreement|10x retirement ann.*ib payment/i, 
          category: "Retirement", 
          description: "Retirement Annuity Contribution (10X)",
          confidence: 0.98
        },
        
        // Medical Aid
        { 
          pattern: /disc prem.*medical aid.*contribution/i, 
          category: "Medical", 
          description: "Medical Aid Contribution",
          confidence: 0.98
        },
        
        // Professional Services
        { 
          pattern: /personal tax service.*provtax.*ib payment/i, 
          category: "Professional", 
          description: "Tax Advisory Services",
          confidence: 0.98
        },
        
        // Printing
        { 
          pattern: /rozprint.*cheque card purchase/i, 
          category: "Office", 
          description: "Printing Services",
          confidence: 0.95
        },
        
        // Coffee/Business meals
        { 
          pattern: /bootlegger.*cheque card purchase|shift espress.*cheque card purchase/i, 
          category: "Office", 
          description: "Coffee/Business Meeting Expenses",
          confidence: 0.90
        },
        
        // Garden maintenance (office maintenance)
        { 
          pattern: /point garden service.*garden.*ib payment/i, 
          category: "Office", 
          description: "Garden Maintenance (Office Property)",
          confidence: 0.90
        },
        
        // Medical expenses
        { 
          pattern: /dr malcol.*cheque card purchase/i, 
          category: "Medical", 
          description: "Medical Consultation",
          confidence: 0.95
        },
        
        // Education
        { 
          pattern: /payu \* uc.*cheque card purchase/i, 
          category: "Education", 
          description: "University of Cape Town - Education Expense",
          confidence: 0.95
        },
        
        // Internet/Hosting
        { 
          pattern: /afrihost.*debit transfer/i, 
          category: "Office", 
          description: "Internet/Hosting Services",
          confidence: 0.90
        }
      ];

      for (const rule of businessPatterns) {
        if (rule.pattern.test(transaction.originalDescription) && transaction.amount < 0) {
          const expenseEntry = {
            id: Date.now() + Math.random(),
            description: rule.description,
            amount: Math.abs(transaction.amount),
            period: 'actual',
            category: rule.category,
            dataSource: 'auto-detected',
            confidence: rule.confidence,
            sourceTransactions: [transaction],
            notes: `Auto-detected: ${transaction.originalDescription.substring(0, 80)}`
          };
          
          categorized.business.push(expenseEntry);
          wasProcessed = true;
          logMessage('debug', 'categorization', `Business expense: ${rule.description} - ${Math.abs(transaction.amount)}`);
          break;
        }
      }

      if (wasProcessed) return;

      // 4. HOME EXPENSES (for home office calculation)
      const homeExpensePatterns = [
        { 
          pattern: /sbsa homel.*std bank bond repayment/i, 
          category: "Mortgage", 
          description: "Home Loan Payment",
          confidence: 0.98
        },
        { 
          pattern: /system interest debit.*id/i, 
          category: "Mortgage", 
          description: "Mortgage Interest",
          confidence: 0.98
        },
        { 
          pattern: /insurance premium.*ip/i, 
          category: "Insurance", 
          description: "Home Insurance Premium",
          confidence: 0.95
        },
        { 
          pattern: /discinsure.*insurance premium/i, 
          category: "Insurance", 
          description: "Home/Contents Insurance",
          confidence: 0.95
        }
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
            confidence: rule.confidence,
            sourceTransactions: [transaction],
            notes: `Auto-detected home expense: ${transaction.originalDescription.substring(0, 80)}`
          };
          
          categorized.home.push(expenseEntry);
          wasProcessed = true;
          logMessage('debug', 'categorization', `Home expense: ${rule.description} - ${Math.abs(transaction.amount)}`);
          break;
        }
      }

      if (wasProcessed) return;

      // 5. PERSONAL EXPENSES (to exclude)
      const personalExpensePatterns = [
        { 
          pattern: /netflix|youtube|virgin.*netcash|apple\.com|sabc/i, 
          reason: "Personal entertainment/subscriptions",
          confidence: 0.95
        },
        { 
          pattern: /woolworths|pnp|checkers|mcd|engen|bp.*pineland/i, 
          reason: "Personal shopping/fuel",
          confidence: 0.90
        },
        { 
          pattern: /old mutual.*unit trust|om unittru/i, 
          reason: "Personal investments (not retirement)",
          confidence: 0.95
        },
        { 
          pattern: /claude\.ai subscription/i, 
          reason: "Personal AI subscription",
          confidence: 0.90
        }
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
            confidence: rule.confidence,
            sourceTransactions: [transaction],
            isExcluded: true,
            exclusionReason: rule.reason,
            notes: `Auto-categorized as personal: ${rule.reason}`
          };
          
          categorized.personal.push(expenseEntry);
          wasProcessed = true;
          logMessage('debug', 'categorization', `Personal expense excluded: ${rule.reason} - ${Math.abs(transaction.amount)}`);
          break;
        }
      }

      if (wasProcessed) return;

      // 6. Everything else goes to uncategorized for manual review
      if (Math.abs(transaction.amount) > 10) { // Only include significant amounts
        categorized.uncategorized.push({
          ...transaction,
          reason: 'Requires manual categorization - potential income or business expense'
        });
        
        if (debugMode && categorized.uncategorized.length <= 10) {
          logMessage('debug', 'categorization', `Uncategorized: ${transaction.originalDescription.substring(0, 50)} - ${transaction.amount}`);
        }
      }
    });

    // Add grouped income entries to results
    groupedIncome.forEach((incomeEntry) => {
      categorized.income.push(incomeEntry);
    });

    // Calculate home office deductions based on your specified percentage
    if (categorized.home.length > 0 && homeOfficePercentage > 0) {
      logMessage('info', 'categorization', `Calculating home office deductions at ${homeOfficePercentage}%`);
      
      // Mortgage interest deduction
      const mortgageInterest = categorized.home
        .filter(expense => expense.category === 'Mortgage' && expense.description.includes('Interest'))
        .reduce((sum, expense) => sum + expense.amount, 0);
      
      if (mortgageInterest > 0) {
        const homeOfficeInterest = (mortgageInterest * homeOfficePercentage / 100);
        categorized.business.push({
          id: Date.now() + Math.random(),
          description: `Home Office Deduction - Mortgage Interest (${homeOfficePercentage}%)`,
          amount: homeOfficeInterest,
          period: 'actual',
          category: 'Office',
          dataSource: 'calculated',
          confidence: 1.0,
          notes: `${homeOfficePercentage}% of R${mortgageInterest.toFixed(2)} mortgage interest`,
          isHomeOfficeDeduction: true
        });
        
        logMessage('info', 'categorization', `Added mortgage interest home office deduction: R${homeOfficeInterest.toFixed(2)}`);
      }

      // Home insurance deduction
      const homeInsurance = categorized.home
        .filter(expense => expense.category === 'Insurance')
        .reduce((sum, expense) => sum + expense.amount, 0);

      if (homeInsurance > 0) {
        const homeOfficeInsurance = (homeInsurance * homeOfficePercentage / 100);
        categorized.business.push({
          id: Date.now() + Math.random(),
          description: `Home Office Deduction - Home Insurance (${homeOfficePercentage}%)`,
          amount: homeOfficeInsurance,
          period: 'actual',
          category: 'Office',
          dataSource: 'calculated',
          confidence: 1.0,
          notes: `${homeOfficePercentage}% of R${homeInsurance.toFixed(2)} home insurance`,
          isHomeOfficeDeduction: true
        });
        
        logMessage('info', 'categorization', `Added home insurance home office deduction: R${homeOfficeInsurance.toFixed(2)}`);
      }
    }

    // Calculate summary statistics
    const summary = {
      totalTransactions: transactions.length,
      autoIncome: categorized.income.length,
      autoBusiness: categorized.business.length,
      autoPersonal: categorized.personal.length,
      autoHome: categorized.home.length,
      excluded: excludedCount,
      uncategorized: categorized.uncategorized.length,
      requiresReview: categorized.uncategorized.length,
      totalIncomeAmount: categorized.income.reduce((sum, item) => sum + item.amount, 0),
      totalBusinessAmount: categorized.business.reduce((sum, item) => sum + item.amount, 0),
      totalPersonalAmount: categorized.personal.reduce((sum, item) => sum + item.amount, 0),
      homeOfficeDeductions: categorized.business.filter(item => item.isHomeOfficeDeduction).length
    };

    logMessage('info', 'categorization', 'Categorization completed successfully', summary);

    return categorized;
  };

  return {
    categorizeTransactions
  };
};