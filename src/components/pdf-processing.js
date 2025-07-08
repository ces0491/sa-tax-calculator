// FIXED PDF Processing for Standard Bank Format
// Replace your src/components/pdf-processing.js with this corrected version

export const createPDFProcessor = (logMessage, debugMode, statementPeriod) => {
  
  // Detect the period covered by transactions
  const detectStatementPeriod = (transactions) => {
    if (transactions.length === 0) return null;

    const dates = transactions.map(t => {
      const parts = t.date.split(' ');
      if (parts.length >= 2) {
        const day = parseInt(parts[0]);
        const monthStr = parts[1];
        const monthMap = {
          'Jan': 0, 'Feb': 1, 'Mar': 2, 'Apr': 3, 'May': 4, 'Jun': 5,
          'Jul': 6, 'Aug': 7, 'Sep': 8, 'Oct': 9, 'Nov': 10, 'Dec': 11
        };
        const month = monthMap[monthStr];
        if (month !== undefined) {
          // Use 2024 for Nov/Dec dates, 2025 for Jan-May dates (cross-year period)
          const year = (month >= 10) ? 2024 : 2025;
          return new Date(year, month, day);
        }
      }
      return null;
    }).filter(d => d !== null);

    if (dates.length === 0) return null;

    const sortedDates = dates.sort((a, b) => a - b);
    const startDate = sortedDates[0];
    const endDate = sortedDates[sortedDates.length - 1];
    
    const daysDiff = Math.floor((endDate - startDate) / (1000 * 60 * 60 * 24));
    const monthsDiff = Math.max(1, Math.round(daysDiff / 30.44));

    logMessage('info', 'period-detection', `Period detected: ${startDate.toLocaleDateString()} to ${endDate.toLocaleDateString()}`, {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      daysDiff,
      monthsDiff,
      transactionCount: dates.length
    });

    return {
      startDate,
      endDate,
      monthsCovered: monthsDiff,
      isPartialYear: monthsDiff < 12,
      annualizationFactor: 12 / monthsDiff
    };
  };

  // FIXED: Parse amount and balance from space-separated string
  const parseAmountBalance = (amountBalanceStr) => {
    const tokens = amountBalanceStr.split(/\s+/);
    
    if (tokens.length === 2) {
      // Simple case: "199.98 56199.52" 
      return {
        amount: tokens[0].replace(/,/g, ''),
        balance: tokens[1].replace(/,/g, '')
      };
    } else if (tokens.length === 3) {
      // Case: "199.98 56 199.52" -> amount: "199.98", balance: "56199.52"
      return {
        amount: tokens[0].replace(/,/g, ''),
        balance: tokens.slice(1).join('').replace(/,/g, '')
      };
    } else if (tokens.length === 4) {
      // Case: "1 304.60 54 296.72" -> amount: "1304.60", balance: "54296.72"
      return {
        amount: tokens.slice(0, 2).join('').replace(/,/g, ''),
        balance: tokens.slice(2).join('').replace(/,/g, '')
      };
    } else if (tokens.length > 4) {
      // More complex case - split roughly in half
      const midPoint = Math.ceil(tokens.length / 2);
      return {
        amount: tokens.slice(0, midPoint).join('').replace(/,/g, ''),
        balance: tokens.slice(midPoint).join('').replace(/,/g, '')
      };
    } else {
      // Single token or empty
      return {
        amount: tokens[0]?.replace(/,/g, '') || '0',
        balance: '0'
      };
    }
  };

  // FIXED: Extract transactions from PDF text using Standard Bank format
  const extractTransactions = (text, sourceFile) => {
    logMessage('info', 'transaction-parse', `Starting transaction extraction from ${sourceFile}`, {
      textLength: text.length,
      sourceFile
    });

    const transactions = [];
    const lines = text.split('\n').filter(line => line.trim().length > 0);
    
    let successfulParses = 0;
    let failedParses = 0;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Skip header lines and invalid lines
      if (line.length < 20 || 
          line.includes('Date') || 
          line.includes('Description') || 
          line.includes('Balance') ||
          line.includes('Customer Care') ||
          line.includes('Website') ||
          line.includes('Account holder') ||
          line.includes('Transaction date range') ||
          line.includes('Account:') ||
          line.includes('Available balance:') ||
          !line.match(/\d{1,2}\s+\w{3}/)) {
        continue;
      }
      
      try {
        // FIXED: Handle Standard Bank format
        // Pattern: "Date Description - Type - Amount Balance" or "Date Description - Type + Amount Balance"
        
        // Split by " - " to get main parts
        const parts = line.split(' - ');
        
        if (parts.length >= 2) {
          const datePart = parts[0].trim();
          let typePart = parts[1].trim();
          let amountBalancePart = parts.length > 2 ? parts.slice(2).join(' - ').trim() : '';
          
          // Extract date (first word group like "30 Nov")
          const dateMatch = datePart.match(/^(\d{1,2}\s+\w{3})/);
          if (!dateMatch) continue;
          
          const date = dateMatch[1];
          const description = datePart.replace(dateMatch[1], '').trim();
          
          // Handle credits where amount is in typePart (like "credit transfer + 61 011.71 61 799.33")
          const creditMatch = typePart.match(/^(.+?)\s*\+\s*([\d\s,.]+)$/);
          if (creditMatch) {
            typePart = creditMatch[1].trim();
            amountBalancePart = creditMatch[2].trim();
          }
          
          // Parse amount and balance
          if (amountBalancePart) {
            const { amount, balance } = parseAmountBalance(amountBalancePart);
            
            const numAmount = parseFloat(amount);
            const numBalance = parseFloat(balance);
            
            if (!isNaN(numAmount) && numAmount > 0) {
              // Determine if credit or debit
              const isCredit = creditMatch || typePart.includes('credit') || line.includes(' + ');
              const finalAmount = isCredit ? numAmount : -numAmount;
              
              const transaction = {
                id: Date.now() + Math.random(),
                date: date,
                originalDescription: `${description} - ${typePart}`.replace(/\s+/g, ' ').trim(),
                amount: finalAmount,
                balance: numBalance || 0,
                type: isCredit ? 'credit' : 'debit',
                sourceFile,
                lineNumber: i + 1,
                matchedPattern: 'standard-bank-fixed',
                rawLine: line,
                rawAmount: amountBalancePart
              };
              
              transactions.push(transaction);
              successfulParses++;
              
              if (debugMode && (successfulParses <= 15 || Math.abs(finalAmount) > 50000)) {
                logMessage('debug', 'transaction-parse', `Transaction extracted successfully`, {
                  transaction: {
                    date: transaction.date,
                    description: transaction.originalDescription.substring(0, 60),
                    amount: transaction.amount,
                    isCredit,
                    rawAmountBalance: amountBalancePart
                  },
                  parsedAmount: amount,
                  parsedBalance: balance
                });
              }
            } else {
              failedParses++;
              if (debugMode && failedParses <= 5) {
                logMessage('warn', 'transaction-parse', `Invalid amount in line`, {
                  line: line.substring(0, 100),
                  amountBalancePart,
                  parsedAmount: amount
                });
              }
            }
          } else {
            failedParses++;
            if (debugMode && failedParses <= 5) {
              logMessage('warn', 'transaction-parse', `No amount/balance found in line`, {
                line: line.substring(0, 100),
                parts: parts.length,
                typePart
              });
            }
          }
        }
        
      } catch (parseError) {
        failedParses++;
        if (debugMode && failedParses <= 5) {
          logMessage('warn', 'transaction-parse', `Error parsing line`, {
            line: line.substring(0, 100),
            error: parseError.message
          });
        }
      }
    }
    
    logMessage('info', 'transaction-parse', `Transaction extraction completed`, {
      totalLinesProcessed: lines.length,
      transactionsExtracted: transactions.length,
      successfulParses,
      failedParses,
      extractionRate: `${((successfulParses / (successfulParses + failedParses)) * 100).toFixed(1)}%`,
      largestTransaction: transactions.length > 0 ? Math.max(...transactions.map(t => Math.abs(t.amount))) : 0,
      totalCreditAmount: transactions.filter(t => t.amount > 0).reduce((sum, t) => sum + t.amount, 0),
      totalDebitAmount: transactions.filter(t => t.amount < 0).reduce((sum, t) => sum + Math.abs(t.amount), 0)
    });
    
    return transactions;
  };

  return {
    detectStatementPeriod,
    extractTransactions
  };
};