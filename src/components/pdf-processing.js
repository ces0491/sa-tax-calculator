// Enhanced PDF Processing with Robust Text Extraction for Standard Bank Statements
// This completely replaces src/components/pdf-processing.js

export const createPDFProcessor = (logMessage, debugMode, statementPeriod) => {
  
  // Enhanced text extraction from PDF pages that preserves structure
  const extractTextFromPDFPage = async (page) => {
    try {
      const textContent = await page.getTextContent();
      
      if (!textContent.items || textContent.items.length === 0) {
        return { text: '', lines: [], itemCount: 0 };
      }
      
      // Extract all text items with position information
      const items = textContent.items.map(item => ({
        text: item.str || '',
        x: item.transform ? item.transform[4] : 0,
        y: item.transform ? item.transform[5] : 0,
        width: item.width || 0,
        height: item.height || 0
      })).filter(item => item.text.trim().length > 0);
      
      if (items.length === 0) {
        return { text: '', lines: [], itemCount: 0 };
      }
      
      // Sort items by Y position (top to bottom), then X position (left to right)
      items.sort((a, b) => {
        const yDiff = Math.abs(a.y - b.y);
        if (yDiff < 3) { // Same line tolerance
          return a.x - b.x;
        }
        return b.y - a.y; // Top to bottom (PDF coordinates)
      });
      
      // Group items into lines based on Y position
      const lines = [];
      let currentLine = [];
      let currentY = null;
      const lineThreshold = 3; // Pixels difference to consider same line
      
      for (const item of items) {
        if (currentY === null || Math.abs(item.y - currentY) > lineThreshold) {
          // New line detected
          if (currentLine.length > 0) {
            const lineText = currentLine.map(i => i.text).join(' ').trim();
            if (lineText.length > 0) {
              lines.push(lineText);
            }
          }
          currentLine = [item];
          currentY = item.y;
        } else {
          // Same line - add to current line
          currentLine.push(item);
        }
      }
      
      // Don't forget the last line
      if (currentLine.length > 0) {
        const lineText = currentLine.map(i => i.text).join(' ').trim();
        if (lineText.length > 0) {
          lines.push(lineText);
        }
      }
      
      return {
        text: lines.join('\n'),
        lines: lines,
        itemCount: items.length
      };
      
    } catch (error) {
      logMessage('error', 'text-extract', 'Error extracting text from page', { error: error.message });
      return { text: '', lines: [], itemCount: 0, error: error.message };
    }
  };
  
  // Extract text from entire PDF document
  const extractTextFromPDF = async (pdf, sourceFile) => {
    logMessage('info', 'text-extract', `Starting enhanced text extraction from ${sourceFile}`, {
      numPages: pdf.numPages
    });
    
    let allLines = [];
    let totalItems = 0;
    
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      try {
        const page = await pdf.getPage(pageNum);
        const pageResult = await extractTextFromPDFPage(page);
        
        logMessage('debug', 'text-extract', `Page ${pageNum} extraction`, {
          linesFound: pageResult.lines.length,
          itemCount: pageResult.itemCount,
          hasError: !!pageResult.error
        });
        
        if (pageResult.lines.length > 0) {
          allLines.push(...pageResult.lines);
          totalItems += pageResult.itemCount;
        }
        
      } catch (pageError) {
        logMessage('error', 'text-extract', `Error processing page ${pageNum}`, {
          error: pageError.message
        });
      }
    }
    
    const finalText = allLines.join('\n');
    
    logMessage('info', 'text-extract', `Text extraction completed for ${sourceFile}`, {
      totalLines: allLines.length,
      totalItems: totalItems,
      textLength: finalText.length,
      sampleLines: allLines.slice(0, 10)
    });
    
    return {
      text: finalText,
      lines: allLines,
      totalItems: totalItems
    };
  };
  
  // Parse individual Standard Bank transaction line with improved number handling
  const parseStandardBankTransaction = (line, lineNumber = 0) => {
    // Standard Bank format: Date Description [+/-] Amount Balance
    const dateMatch = line.match(/^(\d{1,2})\s+(\w{3})\s+(.+)/);
    if (!dateMatch) {
      return null;
    }
    
    const date = `${dateMatch[1]} ${dateMatch[2]}`;
    const remainder = dateMatch[3].trim();
    
    // Handle credit transactions (with +)
    const creditMatch = remainder.match(/^(.+?)\s*\+\s*([\d\s,.]+)$/);
    if (creditMatch) {
      const description = creditMatch[1].trim();
      const amountAndBalance = creditMatch[2].trim();
      
      // More sophisticated parsing for space-separated amounts
      const parts = amountAndBalance.split(/\s+/);
      if (parts.length >= 2) {
        let bestAmount = null;
        let bestBalance = null;
        let bestScore = -1;
        
        // Try different split points and score them
        for (let split = 1; split < parts.length; split++) {
          const amountStr = parts.slice(0, split).join('').replace(/,/g, '');
          const balanceStr = parts.slice(split).join('').replace(/,/g, '');
          
          const amount = parseFloat(amountStr);
          const balance = parseFloat(balanceStr);
          
          if (!isNaN(amount) && !isNaN(balance) && amount > 0) {
            // Scoring: prefer larger amounts and reasonable balances
            let score = 0;
            if (amount > 1000) score += 2; // Substantial amounts get higher score
            if (Math.abs(balance) > amount) score += 3; // Balance should typically be larger
            if (Math.abs(balance) > 10000) score += 1; // Account balances are usually substantial
            if (amount.toString().includes('.')) score += 1; // Decimal amounts are common
            
            if (score > bestScore) {
              bestAmount = amount;
              bestBalance = balance;
              bestScore = score;
            }
          }
        }
        
        if (bestAmount !== null) {
          return {
            date,
            description,
            amount: bestAmount, // Positive for credit
            balance: bestBalance || 0,
            type: 'credit',
            lineNumber,
            rawAmountBalance: amountAndBalance
          };
        }
      }
    }
    
    // Handle debit transactions (with -)
    const debitMatch = remainder.match(/^(.+?)\s*-\s*([\d\s,.]+)$/);
    if (debitMatch) {
      const description = debitMatch[1].trim();
      const amountAndBalance = debitMatch[2].trim();
      
      const parts = amountAndBalance.split(/\s+/);
      
      if (parts.length >= 2) {
        let bestAmount = null;
        let bestBalance = null;
        let bestScore = -1;
        
        // Try different split points with improved scoring
        for (let split = 1; split < parts.length; split++) {
          const amountStr = parts.slice(0, split).join('').replace(/,/g, '');
          const balanceStr = parts.slice(split).join('').replace(/,/g, '');
          
          const amount = parseFloat(amountStr);
          const balance = parseFloat(balanceStr);
          
          if (!isNaN(amount) && !isNaN(balance) && amount > 0) {
            let score = 0;
            
            // For debits, amount should be reasonable transaction size
            if (amount > 10 && amount < 100000) score += 2;
            if (amount.toString().includes('.')) score += 1; // Decimal amounts
            
            // Balance should make sense as account balance
            if (Math.abs(balance) > 100) score += 1; // Reasonable account balance
            if (Math.abs(balance) < 10000000) score += 1; // Not impossibly large
            
            // Prefer when balance is larger than amount (typical for account balances)
            if (Math.abs(balance) > amount) score += 2;
            
            if (score > bestScore) {
              bestAmount = amount;
              bestBalance = balance;
              bestScore = score;
            }
          }
        }
        
        if (bestAmount !== null) {
          return {
            date,
            description,
            amount: -bestAmount, // Negative for debit
            balance: bestBalance || 0,
            type: 'debit',
            lineNumber,
            rawAmountBalance: amountAndBalance
          };
        }
      }
    }
    
    return null;
  };
  
  // Reconstruct multi-line transactions that span multiple PDF lines
  const reconstructTransactions = (lines) => {
    const reconstructed = [];
    let currentTransaction = [];
    let lineNumber = 0;
    
    logMessage('debug', 'transaction-reconstruct', `Starting reconstruction with ${lines.length} lines`);
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Skip empty lines and obvious headers/footers
      if (!line || 
          line.includes('Date') && line.includes('Description') ||
          line.includes('Account holder') ||
          line.includes('Transaction date range') ||
          line.includes('Available balance') ||
          line.includes('Customer Care') ||
          line.includes('Website') ||
          line.includes('Standard Bank') ||
          line.includes('Authorised financial') ||
          line.includes('In (R)') && line.includes('Out (R)') ||
          line === '2024' || line === '2025' ||
          line.length < 8) {
        continue;
      }
      
      // Check if this line starts a new transaction (has date pattern)
      const dateMatch = line.match(/^(\d{1,2})\s+(\w{3})\b/);
      
      if (dateMatch) {
        // Finish current transaction if exists
        if (currentTransaction.length > 0) {
          const reconstructedLine = currentTransaction.join(' ').replace(/\s+/g, ' ').trim();
          if (reconstructedLine.length > 20) {
            reconstructed.push({ 
              line: reconstructedLine, 
              lineNumber: lineNumber,
              sourceLines: currentTransaction.length 
            });
          }
        }
        
        // Start new transaction
        currentTransaction = [line];
        lineNumber = i;
        
        // Check if this line already contains a complete transaction pattern
        if (line.match(/[+\-]\s*[\d\s,.]+\s+[\d\s,.]+$/) || 
            line.match(/\d+\.\d{2}\s+[\d\s,.]+$/)) {
          // Complete transaction on one line
          reconstructed.push({ 
            line: line, 
            lineNumber: i,
            sourceLines: 1 
          });
          currentTransaction = [];
        }
      } else if (currentTransaction.length > 0) {
        // This might be a continuation of the current transaction
        currentTransaction.push(line);
        
        // Check if this continuation completes the transaction
        const testLine = currentTransaction.join(' ').replace(/\s+/g, ' ').trim();
        if (testLine.match(/[+\-]\s*[\d\s,.]+\s+[\d\s,.]+$/)) {
          // Transaction appears complete
          reconstructed.push({ 
            line: testLine, 
            lineNumber: lineNumber,
            sourceLines: currentTransaction.length 
          });
          currentTransaction = [];
        }
      }
    }
    
    // Add any remaining transaction
    if (currentTransaction.length > 0) {
      const reconstructedLine = currentTransaction.join(' ').replace(/\s+/g, ' ').trim();
      if (reconstructedLine.length > 20) {
        reconstructed.push({ 
          line: reconstructedLine, 
          lineNumber: lineNumber,
          sourceLines: currentTransaction.length 
        });
      }
    }
    
    logMessage('info', 'transaction-reconstruct', `Reconstruction completed`, {
      inputLines: lines.length,
      outputTransactions: reconstructed.length,
      multiLineTransactions: reconstructed.filter(r => r.sourceLines > 1).length
    });
    
    return reconstructed;
  };
  
  // Main transaction extraction function
  const extractTransactions = async (text, sourceFile) => {
    logMessage('info', 'transaction-parse', `Starting enhanced transaction extraction from ${sourceFile}`, {
      textLength: text.length
    });
    
    if (!text || text.length < 100) {
      logMessage('error', 'transaction-parse', `Insufficient text for processing`, {
        textLength: text.length || 0
      });
      return [];
    }
    
    // Split into lines and filter out empty ones
    const lines = text.split(/[\r\n]+/)
      .map(line => line.trim())
      .filter(line => line.length > 0);
    
    logMessage('debug', 'transaction-parse', `Text preprocessing completed`, {
      totalLines: lines.length,
      sampleLines: lines.slice(0, 15),
      linesWithDates: lines.filter(line => line.match(/^\d{1,2}\s+\w{3}/)).length
    });
    
    if (lines.length < 10) {
      logMessage('warn', 'transaction-parse', `Very few lines extracted`, {
        lineCount: lines.length,
        allLines: lines
      });
      return [];
    }
    
    // Reconstruct multi-line transactions
    const reconstructedTransactions = reconstructTransactions(lines);
    
    if (reconstructedTransactions.length === 0) {
      logMessage('warn', 'transaction-parse', `No transactions found after reconstruction`, {
        originalLines: lines.length,
        sampleLines: lines.slice(0, 20)
      });
      return [];
    }
    
    // Parse each reconstructed transaction
    const transactions = [];
    let successCount = 0;
    let failureCount = 0;
    
    for (const reconstructedTx of reconstructedTransactions) {
      try {
        const parsed = parseStandardBankTransaction(reconstructedTx.line, reconstructedTx.lineNumber);
        
        if (parsed && !isNaN(parsed.amount) && Math.abs(parsed.amount) > 0) {
          const transaction = {
            id: Date.now() + Math.random(),
            date: parsed.date,
            originalDescription: parsed.description,
            amount: parsed.amount,
            balance: parsed.balance,
            type: parsed.type,
            sourceFile: sourceFile,
            lineNumber: parsed.lineNumber,
            sourceLines: reconstructedTx.sourceLines,
            rawLine: reconstructedTx.line,
            rawAmountBalance: parsed.rawAmountBalance
          };
          
          transactions.push(transaction);
          successCount++;
          
          if (debugMode && (successCount <= 20 || Math.abs(parsed.amount) > 50000)) {
            logMessage('debug', 'transaction-parse', `Transaction parsed successfully`, {
              date: transaction.date,
              description: transaction.originalDescription.substring(0, 60),
              amount: transaction.amount,
              type: transaction.type,
              sourceLines: reconstructedTx.sourceLines
            });
          }
        } else {
          failureCount++;
          if (debugMode && failureCount <= 10) {
            logMessage('warn', 'transaction-parse', `Failed to parse transaction`, {
              line: reconstructedTx.line.substring(0, 100),
              parsed: parsed
            });
          }
        }
      } catch (parseError) {
        failureCount++;
        if (debugMode && failureCount <= 10) {
          logMessage('error', 'transaction-parse', `Error parsing transaction`, {
            line: reconstructedTx.line.substring(0, 100),
            error: parseError.message
          });
        }
      }
    }
    
    // Calculate summary statistics
    const totalCredit = transactions.filter(t => t.amount > 0).reduce((sum, t) => sum + t.amount, 0);
    const totalDebit = transactions.filter(t => t.amount < 0).reduce((sum, t) => sum + Math.abs(t.amount), 0);
    const dateRange = transactions.length > 0 ? {
      earliest: transactions.map(t => t.date).sort()[0],
      latest: transactions.map(t => t.date).sort().reverse()[0]
    } : null;
    
    logMessage('info', 'transaction-parse', `Enhanced transaction extraction completed`, {
      sourceFile,
      totalLinesProcessed: lines.length,
      reconstructedTransactions: reconstructedTransactions.length,
      successfullyParsed: successCount,
      failed: failureCount,
      extractionRate: `${((successCount / Math.max(1, successCount + failureCount)) * 100).toFixed(1)}%`,
      totalCredit,
      totalDebit,
      dateRange,
      largestTransaction: transactions.length > 0 ? Math.max(...transactions.map(t => Math.abs(t.amount))) : 0
    });
    
    return transactions;
  };
  
  // Detect statement period from extracted transactions
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
          // Assume year based on month (Nov-Dec = 2024, Jan-May = 2025)
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

    logMessage('info', 'period-detection', `Statement period detected`, {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      daysDiff,
      monthsDiff,
      transactionCount: dates.length,
      isPartialYear: monthsDiff < 12
    });

    return {
      startDate,
      endDate,
      monthsCovered: monthsDiff,
      isPartialYear: monthsDiff < 12,
      annualizationFactor: 12 / monthsDiff
    };
  };
  
  return {
    extractTextFromPDF,
    extractTransactions,
    detectStatementPeriod,
    parseStandardBankTransaction,
    reconstructTransactions
  };
};