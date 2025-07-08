// ROBUST PDF Processing with Better Text Extraction
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
      amount = tokens[0].replace(/,/g, '');
    } else if (tokens.length === 2) {
      amount = tokens[0].replace(/,/g, '');
      balance = tokens[1].replace(/,/g, '');
    } else if (tokens.length === 3) {
      amount = tokens[0].replace(/,/g, '');
      balance = tokens[1].replace(/,/g, '') + tokens[2].replace(/,/g, '');
    } else if (tokens.length === 4) {
      amount = tokens[0].replace(/,/g, '') + tokens[1].replace(/,/g, '');
      balance = tokens[2].replace(/,/g, '') + tokens[3].replace(/,/g, '');
    } else {
      const midPoint = Math.ceil(tokens.length / 2);
      amount = tokens.slice(0, midPoint).join('').replace(/,/g, '');
      balance = tokens.slice(midPoint).join('').replace(/,/g, '');
    }
    
    return { amount, balance };
  };

  // ENHANCED: Better text extraction from PDF pages
  const extractTextFromPDF = async (pdf, sourceFile) => {
    let allText = '';
    let allItems = [];
    
    logMessage('info', 'text-extract', `Extracting text from ${pdf.numPages} pages`, {
      fileName: sourceFile,
      numPages: pdf.numPages
    });
    
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      try {
        const page = await pdf.getPage(pageNum);
        const textContent = await page.getTextContent();
        
        logMessage('debug', 'text-extract', `Page ${pageNum} text extraction`, {
          itemCount: textContent.items.length,
          hasItems: textContent.items.length > 0
        });
        
        // Enhanced text extraction - preserve positioning and structure
        const pageItems = textContent.items.map(item => ({
          str: item.str,
          x: item.transform[4],
          y: item.transform[5],
          width: item.width,
          height: item.height
        }));
        
        allItems.push(...pageItems);
        
        // Method 1: Simple join with spaces
        const simpleText = textContent.items.map(item => item.str).join(' ');
        
        // Method 2: Try to preserve line structure based on Y coordinates
        const sortedItems = pageItems.sort((a, b) => b.y - a.y || a.x - b.x);
        let structuredText = '';
        let currentY = null;
        let currentLine = [];
        
        for (const item of sortedItems) {
          if (currentY === null || Math.abs(item.y - currentY) > 2) {
            // New line
            if (currentLine.length > 0) {
              structuredText += currentLine.join(' ') + '\n';
            }
            currentLine = [item.str];
            currentY = item.y;
          } else {
            // Same line
            currentLine.push(item.str);
          }
        }
        
        // Add the last line
        if (currentLine.length > 0) {
          structuredText += currentLine.join(' ') + '\n';
        }
        
        allText += structuredText;
        
        if (debugMode) {
          logMessage('debug', 'text-extract', `Page ${pageNum} extraction details`, {
            simpleTextLength: simpleText.length,
            structuredTextLength: structuredText.length,
            sampleItems: pageItems.slice(0, 5).map(item => ({ str: item.str, x: item.x, y: item.y })),
            lineCount: structuredText.split('\n').length
          });
        }
        
      } catch (pageError) {
        logMessage('error', 'text-extract', `Error processing page ${pageNum}`, {
          error: pageError.message
        });
      }
    }
    
    logMessage('info', 'text-extract', `Text extraction completed`, {
      totalTextLength: allText.length,
      totalItems: allItems.length,
      lineCount: allText.split('\n').length
    });
    
    return allText;
  };

  // Reconstruct multi-line transactions with better boundary detection
  const reconstructTransactions = (lines) => {
    const reconstructed = [];
    let currentTransaction = [];
    
    logMessage('debug', 'transaction-reconstruct', `Starting reconstruction with ${lines.length} lines`, {
      firstFewLines: lines.slice(0, 10),
      lastFewLines: lines.slice(-5)
    });
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Skip empty lines and common headers
      if (!line || 
          line.includes('Date') && line.includes('Description') ||
          line.includes('Account holder') ||
          line.includes('Transaction date range') ||
          line.includes('Available balance') ||
          line.includes('Customer Care') ||
          line.includes('Website') ||
          line.includes('Account:') ||
          line.includes('Transactions') ||
          line.includes('In (R)') ||
          line.includes('Out (R)') ||
          line.includes('Balance (R)') ||
          line === '2024' || line === '2025' ||
          line.length < 10) {
        continue;
      }
      
      // Check if this line starts a new transaction (has date at start)
      const dateMatch = line.match(/^(\d{1,2})\s+(\w{3})\b/);
      
      if (dateMatch) {
        // If we have a current transaction being built, finish it
        if (currentTransaction.length > 0) {
          const reconstructedLine = currentTransaction.join(' ').replace(/\s+/g, ' ').trim();
          if (reconstructedLine.length > 20) { // Only add substantial transactions
            reconstructed.push(reconstructedLine);
          }
        }
        
        // Start new transaction
        currentTransaction = [line];
        
        // Check if this line already contains an amount pattern - if so, it's likely complete
        if (line.match(/[+\-]\s*[\d\s,.]+\s+[\d\s,.]+$/) || 
            line.match(/\d+\.\d+\s+\d+/) || 
            line.match(/[\d\s,.]+\s+[\d\s,.]+$/)) {
          // This transaction appears complete on one line
          reconstructed.push(line);
          currentTransaction = [];
        }
      } else if (currentTransaction.length > 0) {
        // This line might be a continuation of the current transaction
        currentTransaction.push(line);
        
        // Check if this line completes the transaction (contains amount pattern)
        if (line.match(/^[+\-]\s*[\d\s,.]+$/) || 
            line.match(/^\d+\.\d+\s+\d+/) || 
            line.match(/^[\d\s,.]+\s+[\d\s,.]+$/)) {
          // This line appears to complete the transaction
          const reconstructedLine = currentTransaction.join(' ').replace(/\s+/g, ' ').trim();
          if (reconstructedLine.length > 20) {
            reconstructed.push(reconstructedLine);
          }
          currentTransaction = [];
        }
      }
    }
    
    // Add any remaining transaction
    if (currentTransaction.length > 0) {
      const reconstructedLine = currentTransaction.join(' ').replace(/\s+/g, ' ').trim();
      if (reconstructedLine.length > 20) {
        reconstructed.push(reconstructedLine);
      }
    }
    
    logMessage('info', 'transaction-reconstruct', `Reconstruction completed`, {
      inputLines: lines.length,
      outputTransactions: reconstructed.length,
      sampleReconstructions: reconstructed.slice(0, 5)
    });
    
    return reconstructed;
  };

  // Main transaction extraction function with enhanced text processing
  const extractTransactions = async (text, sourceFile) => {
    logMessage('info', 'transaction-parse', `Starting enhanced transaction extraction from ${sourceFile}`, {
      textLength: text.length,
      sourceFile
    });

    const transactions = [];
    
    // Split text into lines and clean them
    const rawLines = text.split(/[\r\n]+/).map(line => line.trim()).filter(line => line.length > 0);
    
    logMessage('debug', 'transaction-parse', `Raw text processing`, {
      totalTextLength: text.length,
      rawLineCount: rawLines.length,
      sampleRawLines: rawLines.slice(0, 10),
      hasDatePatterns: rawLines.filter(line => line.match(/\d{1,2}\s+\w{3}/)).length
    });
    
    // If we have very few lines, something went wrong with text extraction
    if (rawLines.length < 10) {
      logMessage('warn', 'transaction-parse', `Very few lines extracted from PDF`, {
        lineCount: rawLines.length,
        allLines: rawLines
      });
      return transactions; // Return empty array
    }
    
    // Reconstruct multi-line transactions
    const reconstructedLines = reconstructTransactions(rawLines);
    
    if (reconstructedLines.length === 0) {
      logMessage('warn', 'transaction-parse', `No transactions found after reconstruction`, {
        rawLines: rawLines.length,
        sampleLines: rawLines.slice(0, 20)
      });
      return transactions;
    }
    
    let successfulParses = 0;
    let failedParses = 0;
    
    for (let i = 0; i < reconstructedLines.length; i++) {
      const line = reconstructedLines[i];
      
      try {
        // Look for date pattern at the start
        const dateMatch = line.match(/^(\d{1,2})\s+(\w{3})\s+(.+)/);
        if (!dateMatch) {
          failedParses++;
          continue;
        }
        
        const date = `${dateMatch[1]} ${dateMatch[2]}`;
        const remainder = dateMatch[3];
        
        // Skip obvious bank fees and admin charges
        if (remainder.includes('##') || 
            remainder.toLowerCase().includes('fee') && remainder.toLowerCase().includes('monthly') ||
            remainder.toLowerCase().includes('overdraft') ||
            remainder.toLowerCase().includes('administration')) {
          continue;
        }
        
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
            // Try pattern without explicit debit sign
            const simplePatternMatch = remainder.match(/^(.+?)\s+-\s+(.+?)\s+([\d\s,.]+)$/);
            if (simplePatternMatch) {
              description = simplePatternMatch[1].trim();
              transactionType = simplePatternMatch[2].trim();
              amountBalanceStr = simplePatternMatch[3].trim();
              isCredit = false;
            } else {
              failedParses++;
              if (debugMode && failedParses <= 10) {
                logMessage('warn', 'transaction-parse', `No pattern match for line`, {
                  line: line.substring(0, 100),
                  remainder: remainder.substring(0, 50)
                });
              }
              continue;
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
            rawLine: line.substring(0, 200),
            rawAmountBalance: amountBalanceStr
          };
          
          transactions.push(transaction);
          successfulParses++;
          
          if (debugMode && (successfulParses <= 25 || Math.abs(finalAmount) > 50000)) {
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
      sampleTransactions: transactions.slice(0, 5).map(t => ({
        date: t.date,
        description: t.originalDescription.substring(0, 40),
        amount: t.amount
      }))
    });
    
    return transactions;
  };

  return {
    detectStatementPeriod,
    extractTransactions,
    extractTextFromPDF // Export the enhanced text extraction function
  };
};