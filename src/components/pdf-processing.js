// PDF Processing and Transaction Extraction Functions
// This file contains the core PDF processing logic

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

  // Extract transactions from PDF text
  const extractTransactions = (text, sourceFile) => {
    logMessage('info', 'transaction-parse', `Starting transaction extraction from ${sourceFile}`, {
      textLength: text.length,
      sourceFile
    });

    const transactions = [];
    const lines = text.split('\n').filter(line => line.trim().length > 0);
    
    // Enhanced regex patterns for Standard Bank format - handle spaces in amounts
    const patterns = {
      standardBankCredit: /(\d{2}\s+\w{3})\s+(.+?)\s+-\s*(.+?)\s+\+\s*([\d\s,.\-]+)\s+([\d\s,.\-]+)$/,
      standardBankDebit: /(\d{2}\s+\w{3})\s+(.+?)\s+-\s*(.+?)\s+-\s*([\d\s,.\-]+)\s+([\d\s,.\-]+)$/,
      simpleCredit: /(\d{2}\s+\w{3})\s+(.+?)\s+\+\s*([\d\s,.\-]+)\s+([\d\s,.\-]+)$/,
      simpleDebit: /(\d{2}\s+\w{3})\s+(.+?)\s+-\s*([\d\s,.\-]+)\s+([\d\s,.\-]+)$/,
      genericTransaction: /(\d{1,2}\s+\w{3})\s+(.+?)\s+([+-])\s*([\d\s,.\-]+)\s+([\d\s,.\-]+)$/
    };
    
    let matchCounts = {};
    Object.keys(patterns).forEach(key => matchCounts[key] = 0);
    
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
          !line.match(/[\d\s,.]+/)) {
        continue;
      }
      
      let matched = false;
      
      for (const [patternName, pattern] of Object.entries(patterns)) {
        const match = line.match(pattern);
        
        if (match) {
          matched = true;
          matchCounts[patternName]++;
          
          try {
            let date, description, transactionType, amount, balance, isCredit = false;
            
            if (patternName === 'standardBankCredit') {
              [, date, description, transactionType, amount, balance] = match;
              isCredit = true;
            } else if (patternName === 'standardBankDebit') {
              [, date, description, transactionType, amount, balance] = match;
              isCredit = false;
            } else if (patternName === 'simpleCredit') {
              [, date, description, amount, balance] = match;
              isCredit = true;
              transactionType = 'credit transfer';
            } else if (patternName === 'simpleDebit') {
              [, date, description, amount, balance] = match;
              isCredit = false;
              transactionType = 'debit';
            } else {
              [, date, description, sign, amount, balance] = match;
              isCredit = sign === '+';
              transactionType = isCredit ? 'credit' : 'debit';
            }
            
            // Enhanced amount cleaning - properly handle spaces in large numbers
            const cleanAmount = amount
              .replace(/\s+/g, '') // Remove all spaces first
              .replace(/,/g, '') // Remove commas
              .replace(/[^\d.-]/g, ''); // Keep only digits, dots, and minus
            
            const cleanBalance = balance ? balance
              .replace(/\s+/g, '')
              .replace(/,/g, '')
              .replace(/[^\d.-]/g, '') : '0';
            
            const numAmount = parseFloat(cleanAmount);
            const numBalance = parseFloat(cleanBalance);
            
            if (!isNaN(numAmount) && numAmount > 0) {
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
                rawLine: line,
                rawAmount: amount
              };
              
              transactions.push(transaction);
              
              if (debugMode && (transactions.length <= 15 || numAmount > 50000)) {
                logMessage('debug', 'transaction-parse', `Transaction extracted (${patternName})`, {
                  transaction: {
                    date: transaction.date,
                    description: transaction.originalDescription.substring(0, 60),
                    amount: transaction.amount,
                    rawAmount: amount,
                    cleanedAmount: cleanAmount
                  },
                  originalLine: line.substring(0, 120)
                });
              }
            }
            
          } catch (parseError) {
            logMessage('warn', 'transaction-parse', `Error parsing matched line`, {
              line: line.substring(0, 100),
              pattern: patternName,
              error: parseError.message
            });
          }
          
          break;
        }
      }
    }
    
    logMessage('info', 'transaction-parse', `Transaction extraction completed`, {
      totalLinesProcessed: lines.length,
      transactionsExtracted: transactions.length,
      patternMatches: matchCounts,
      extractionRate: `${((transactions.length / lines.length) * 100).toFixed(1)}%`,
      largestTransaction: transactions.length > 0 ? Math.max(...transactions.map(t => Math.abs(t.amount))) : 0
    });
    
    return transactions;
  };

  return {
    detectStatementPeriod,
    extractTransactions
  };
};