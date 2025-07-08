// COMPREHENSIVE PDF Processing Fix for Standard Bank Format
// Replace your src/components/pdf-processing.js with this version

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

  // Enhanced amount and balance parsing for Standard Bank format
  const parseAmountBalance = (amountStr, isCredit = false) => {
    if (!amountStr) return { amount: '0', balance: '0' };
    
    // Clean the string and remove +/- indicators
    const cleanStr = amountStr.replace(/^[+\-]\s*/, '').trim();
    const tokens = cleanStr.split(/\s+/).filter(t => t.length > 0);
    
    if (tokens.length === 0) return { amount: '0', balance: '0' };
    
    let amount = '0', balance = '0';
    
    if (tokens.length === 1) {
      // Single number - treat as amount, no balance info
      amount = tokens[0].replace(/,/g, '');
    } else if (tokens.length === 2) {
      // Two numbers - first is amount, second is balance  
      amount = tokens[0].replace(/,/g, '');
      balance = tokens[1].replace(/,/g, '');
    } else if (tokens.length === 3) {
      // Three numbers like "199.98 56 199.52" → amount: "199.98", balance: "56199.52"
      amount = tokens[0].replace(/,/g, '');
      balance = tokens[1].replace(/,/g, '') + tokens[2].replace(/,/g, '');
    } else if (tokens.length === 4) {
      // Four numbers like "61 011.71 61 799.33" → amount: "61011.71", balance: "61799.33"
      amount = tokens[0].replace(/,/g, '') + tokens[1].replace(/,/g, '');
      balance = tokens[2].replace(/,/g, '') + tokens[3].replace(/,/g, '');
    } else if (tokens.length === 5) {
      // Five numbers - split point depends on decimal positions
      // Look for decimal points to determine grouping
      const decimalPositions = tokens.map((t, i) => ({ index: i, hasDecimal: t.includes('.') }))
                                   .filter(t => t.hasDecimal);
      
      if (decimalPositions.length === 2) {
        // Two decimals - split at the second decimal
        const splitPoint = decimalPositions[1].index;
        amount = tokens.slice(0, splitPoint + 1).join('').replace(/,/g, '');
        balance = tokens.slice(splitPoint + 1).join('').replace(/,/g, '');
      } else {
        // Default split roughly in half
        const midPoint = Math.ceil(tokens.length / 2);
        amount = tokens.slice(0, midPoint).join('').replace(/,/g, '');
        balance = tokens.slice(midPoint).join('').replace(/,/g, '');
      }
    } else {
      // More than 5 tokens - split roughly in half
      const midPoint = Math.ceil(tokens.length / 2);
      amount = tokens.slice(0, midPoint).join('').replace(/,/g, '');
      balance = tokens.slice(midPoint).join('').replace(/,/g, '');
    }
    
    return { amount, balance };
  };

  // Reconstruct multi-line transactions with better boundary detection
  const reconstructTransactions = (lines) => {
    const reconstructed = [];
    let currentTransaction = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Skip empty lines and headers
      if (!line || 
          line.includes('Date') && line.includes('Description') ||
          line.includes('Account holder') ||
          line.includes('Transaction date range') ||
          line.includes('Available balance') ||
          line.includes('Customer Care') ||
          line.includes('Website') ||
          line.includes('Account:') ||
          line === '2024' || line === '2025') {
        continue;
      }
      
      // Check if this line starts a new transaction (has date at start)
      const dateMatch = line.match(/^(\d{1,2}\s+\w{3})\s+(.+)/);
      
      if (dateMatch) {
        // If we have a current transaction being built, finish it
        if (currentTransaction.length > 0) {
          reconstructed.push(currentTransaction.join(' '));
        }
        
        // Start new transaction
        currentTransaction = [line];
        
        // Check if this line already contains an amount pattern - if so, it's complete
        const remainder = dateMatch[2];
        if (remainder.match(/[+\-]\s*[\d\s,.]+$/) || remainder.match(/\d+\.\d+\s+\d+/) || remainder.match(/[\d\s,.]+\s+[\d\s,.]+$/)) {
          // This transaction appears complete on one line
          reconstructed.push(line);
          currentTransaction = [];
        }
      } else if (currentTransaction.length > 0) {
        // This line might be a continuation of the current transaction
        currentTransaction.push(line);
        
        // Check if this line completes the transaction (contains amount pattern)
        if (line.match(/^[+\-]\s*[\d\s,.]+$/) || line.match(/^\d+\.\d+\s+\d+/) || line.match(/^[\d\s,.]+\s+[\d\s,.]+$/)) {
          // This line appears to complete the transaction
          reconstructed.push(currentTransaction.join(' '));
          currentTransaction = [];
        }
      }
    }
    
    // Add any remaining transaction
    if (currentTransaction.length > 0) {
      reconstructed.push(currentTransaction.join(' '));
    }
    
    return reconstructed;
  };

  // Main transaction extraction function
  const extractTransactions = (text, sourceFile) => {
    logMessage('info', 'transaction-parse', `Starting enhanced transaction extraction from ${sourceFile}`, {
      textLength: text.length,
      sourceFile
    });

    const transactions = [];
    const rawLines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    
    // First, reconstruct multi-line transactions
    const reconstructedLines = reconstructTransactions(rawLines);
    
    logMessage('debug', 'transaction-parse', `Reconstructed ${reconstructedLines.length} potential transactions from ${rawLines.length} lines`);
    
    let successfulParses = 0;
    let failedParses = 0;
    
    for (let i = 0; i < reconstructedLines.length; i++) {
      const line = reconstructedLines[i];
      
      try {
        // Look for date pattern at the start
        const dateMatch = line.match(/^(\d{1,2}\s+\w{3})\s+(.+)/);
        if (!dateMatch) continue;
        
        const date = dateMatch[1];
        const remainder = dateMatch[2];
        
        // Skip obvious non-transaction lines
        if (remainder.includes('##') && (remainder.includes('fee') || remainder.includes('charge'))) {
          continue; // Skip bank fees for now
        }
        
        // Look for amount patterns in the remainder
        // Pattern 1: "Description - Type - Amount Balance"
        // Pattern 2: "Description - Type + Amount Balance" 
        // Pattern 3: "Description - Amount Balance" (no explicit type)
        
        let description = '', transactionType = '', amountBalanceStr = '', isCredit = false;
        
        // Try to find credit pattern first (with +)
        const creditMatch = remainder.match(/^(.+?)\s+-\s+(.+?)\s*\+\s+([\d\s,.]+)$/);
        if (creditMatch) {
          description = creditMatch[1].trim();
          transactionType = creditMatch[2].trim();
          amountBalanceStr = creditMatch[3].trim();
          isCredit = true;
        } else {
          // Try debit pattern with explicit type
          const debitWithTypeMatch = remainder.match(/^(.+?)\s+-\s+(.+?)\s+-\s+([\d\s,.]+)$/);
          if (debitWithTypeMatch) {
            description = debitWithTypeMatch[1].trim();
            transactionType = debitWithTypeMatch[2].trim();
            amountBalanceStr = debitWithTypeMatch[3].trim();
            isCredit = false;
          } else {
            // Try simpler debit pattern without explicit type
            const simpleDebitMatch = remainder.match(/^(.+?)\s+-\s+([\d\s,.]+)$/);
            if (simpleDebitMatch) {
              description = simpleDebitMatch[1].trim();
              transactionType = 'transaction';
              amountBalanceStr = simpleDebitMatch[2].trim();
              isCredit = false;
            } else {
              // Last resort - look for any amount pattern at the end
              const amountMatch = remainder.match(/^(.+?)\s+([+\-]?\s*[\d\s,.]+)$/);
              if (amountMatch) {
                description = amountMatch[1].trim();
                transactionType = 'transaction';
                amountBalanceStr = amountMatch[2].trim();
                isCredit = amountMatch[2].includes('+');
              } else {
                continue; // Skip if no amount found
              }
            }
          }
        }
        
        // Parse the amount and balance
        const { amount, balance } = parseAmountBalance(amountBalanceStr, isCredit);
        const numAmount = parseFloat(amount);
        const numBalance = parseFloat(balance);
        
        if (!isNaN(numAmount) && numAmount > 0) {
          const finalAmount = isCredit ? numAmount : -numAmount;
          
          const transaction = {
            id: Date.now() + Math.random(),
            date: date,
            originalDescription: `${description} - ${transactionType}`.replace(/\s+/g, ' ').trim(),
            amount: finalAmount,
            balance: numBalance || 0,
            type: isCredit ? 'credit' : 'debit',
            sourceFile,
            lineNumber: i + 1,
            matchedPattern: isCredit ? 'credit-enhanced' : 'debit-enhanced',
            rawLine: line.substring(0, 200), // Limit for storage
            rawAmountBalance: amountBalanceStr
          };
          
          transactions.push(transaction);
          successfulParses++;
          
          if (debugMode && (successfulParses <= 20 || Math.abs(finalAmount) > 50000)) {
            logMessage('debug', 'transaction-parse', `Transaction extracted successfully`, {
              transaction: {
                date: transaction.date,
                description: transaction.originalDescription.substring(0, 60),
                amount: transaction.amount,
                isCredit,
                parsedAmount: amount,
                parsedBalance: balance
              }
            });
          }
        } else {
          failedParses++;
          if (debugMode && failedParses <= 10) {
            logMessage('warn', 'transaction-parse', `Invalid amount in line`, {
              line: line.substring(0, 100),
              amountBalanceStr,
              parsedAmount: amount
            });
          }
        }
        
      } catch (parseError) {
        failedParses++;
        if (debugMode && failedParses <= 10) {
          logMessage('warn', 'transaction-parse', `Error parsing line`, {
            line: line.substring(0, 100),
            error: parseError.message
          });
        }
      }
    }
    
    logMessage('info', 'transaction-parse', `Enhanced transaction extraction completed`, {
      totalLinesProcessed: rawLines.length,
      reconstructedLines: reconstructedLines.length,
      transactionsExtracted: transactions.length,
      successfulParses,
      failedParses,
      extractionRate: `${((successfulParses / Math.max(1, successfulParses + failedParses)) * 100).toFixed(1)}%`,
      largestTransaction: transactions.length > 0 ? Math.max(...transactions.map(t => Math.abs(t.amount))) : 0,
      totalCreditAmount: transactions.filter(t => t.amount > 0).reduce((sum, t) => sum + t.amount, 0),
      totalDebitAmount: transactions.filter(t => t.amount < 0).reduce((sum, t) => sum + Math.abs(t.amount), 0),
      sampleTransactions: transactions.slice(0, 3).map(t => ({
        date: t.date,
        description: t.originalDescription.substring(0, 40),
        amount: t.amount
      }))
    });
    
    return transactions;
  };

  return {
    detectStatementPeriod,
    extractTransactions
  };
};