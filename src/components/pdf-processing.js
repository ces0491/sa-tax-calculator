// Fixed PDF Processing for Standard Bank Statements
// This replaces src/components/pdf-processing.js

export const createPDFProcessor = (logMessage, debugMode) => {
  
  // Simplified and more reliable text extraction
  const extractTextFromPDFPage = async (page) => {
    try {
      const textContent = await page.getTextContent();
      
      if (!textContent.items || textContent.items.length === 0) {
        return { text: '', lines: [] };
      }
      
      // Extract text items with position
      const items = textContent.items
        .filter(item => item.str && item.str.trim().length > 0)
        .map(item => ({
          text: item.str.trim(),
          x: item.transform ? item.transform[4] : 0,
          y: item.transform ? item.transform[5] : 0
        }));
      
      if (items.length === 0) {
        return { text: '', lines: [] };
      }
      
      // Sort by Y position (top to bottom), then X position (left to right)
      items.sort((a, b) => {
        const yDiff = Math.abs(a.y - b.y);
        if (yDiff < 2) { // Same line
          return a.x - b.x;
        }
        return b.y - a.y; // Top to bottom
      });
      
      // Group into lines based on Y position
      const lines = [];
      let currentLine = [];
      let lastY = null;
      
      for (const item of items) {
        if (lastY === null || Math.abs(item.y - lastY) > 2) {
          // New line
          if (currentLine.length > 0) {
            lines.push(currentLine.join(' '));
          }
          currentLine = [item.text];
          lastY = item.y;
        } else {
          // Same line
          currentLine.push(item.text);
        }
      }
      
      // Add last line
      if (currentLine.length > 0) {
        lines.push(currentLine.join(' '));
      }
      
      return {
        text: lines.join('\n'),
        lines: lines.filter(line => line.trim().length > 0)
      };
      
    } catch (error) {
      logMessage('error', 'text-extract', `Error extracting text from page: ${error.message}`);
      return { text: '', lines: [] };
    }
  };
  
  // Extract text from entire PDF
  const extractTextFromPDF = async (pdf, sourceFile) => {
    logMessage('info', 'text-extract', `Extracting text from ${sourceFile} (${pdf.numPages} pages)`);
    
    let allLines = [];
    
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      try {
        const page = await pdf.getPage(pageNum);
        const pageResult = await extractTextFromPDFPage(page);
        
        if (pageResult.lines.length > 0) {
          allLines.push(...pageResult.lines);
        }
        
        logMessage('debug', 'text-extract', `Page ${pageNum}: ${pageResult.lines.length} lines extracted`);
        
      } catch (error) {
        logMessage('error', 'text-extract', `Error processing page ${pageNum}: ${error.message}`);
      }
    }
    
    const finalText = allLines.join('\n');
    
    logMessage('info', 'text-extract', `Text extraction completed for ${sourceFile}`, {
      totalLines: allLines.length,
      textLength: finalText.length
    });
    
    return {
      text: finalText,
      lines: allLines
    };
  };
  
  // Parse Standard Bank transaction with simplified logic
  const parseStandardBankTransaction = (line) => {
    // Clean the line
    line = line.trim();
    
    // Skip obvious non-transaction lines
    if (line.length < 10 || 
        line.includes('Date') && line.includes('Description') ||
        line.includes('Account holder') ||
        line.includes('Available balance') ||
        line.includes('Customer Care') ||
        line.includes('Standard Bank') ||
        line.match(/^(2024|2025)$/) ||
        line.includes('In (R)') && line.includes('Out (R)')) {
      return null;
    }
    
    // Standard Bank format: DD MMM Description [+/-] Amount Balance
    const dateMatch = line.match(/^(\d{1,2})\s+(\w{3})\s+(.+)/);
    if (!dateMatch) {
      return null;
    }
    
    const day = dateMatch[1];
    const month = dateMatch[2];
    const remainder = dateMatch[3].trim();
    
    // Look for amount patterns with + or - signs
    // Handle South African number format with spaces as thousands separators
    
    // Pattern for credit transactions (with +)
    const creditMatch = remainder.match(/^(.+?)\s*\+\s*([\d\s,]+\.?\d*)\s+([\d\s,]+\.?\d*)$/);
    if (creditMatch) {
      const description = creditMatch[1].trim();
      const amountStr = creditMatch[2].replace(/\s/g, '').replace(/,/g, '');
      const balanceStr = creditMatch[3].replace(/\s/g, '').replace(/,/g, '');
      
      const amount = parseFloat(amountStr);
      const balance = parseFloat(balanceStr);
      
      if (!isNaN(amount) && amount > 0) {
        return {
          date: `${day} ${month}`,
          description: description,
          amount: amount, // Positive for credit
          balance: balance || 0,
          type: 'credit'
        };
      }
    }
    
    // Pattern for debit transactions (with -)
    const debitMatch = remainder.match(/^(.+?)\s*-\s*([\d\s,]+\.?\d*)\s+([\d\s,]+\.?\d*)$/);
    if (debitMatch) {
      const description = debitMatch[1].trim();
      const amountStr = debitMatch[2].replace(/\s/g, '').replace(/,/g, '');
      const balanceStr = debitMatch[3].replace(/\s/g, '').replace(/,/g, '');
      
      const amount = parseFloat(amountStr);
      const balance = parseFloat(balanceStr);
      
      if (!isNaN(amount) && amount > 0) {
        return {
          date: `${day} ${month}`,
          description: description,
          amount: -amount, // Negative for debit
          balance: balance || 0,
          type: 'debit'
        };
      }
    }
    
    return null;
  };
  
  // Main transaction extraction function
  const extractTransactions = async (text, sourceFile) => {
    logMessage('info', 'transaction-parse', `Starting transaction extraction from ${sourceFile}`);
    
    if (!text || text.length < 50) {
      logMessage('error', 'transaction-parse', 'Insufficient text for processing');
      return [];
    }
    
    const lines = text.split(/[\r\n]+/).filter(line => line.trim().length > 0);
    
    logMessage('debug', 'transaction-parse', `Processing ${lines.length} lines from ${sourceFile}`);
    
    const transactions = [];
    let successCount = 0;
    let skipCount = 0;
    
    // Process each line
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Try to parse as transaction
      const parsed = parseStandardBankTransaction(line);
      
      if (parsed && !isNaN(parsed.amount) && Math.abs(parsed.amount) > 0) {
        const transaction = {
          id: Date.now() + Math.random(),
          date: parsed.date,
          originalDescription: parsed.description,
          amount: parsed.amount,
          balance: parsed.balance,
          type: parsed.type,
          sourceFile: sourceFile,
          lineNumber: i + 1,
          rawLine: line
        };
        
        transactions.push(transaction);
        successCount++;
        
        if (debugMode && successCount <= 10) {
          logMessage('debug', 'transaction-parse', `Transaction parsed: ${parsed.description.substring(0, 50)}... = ${parsed.amount}`);
        }
      } else {
        skipCount++;
      }
    }
    
    // Try to handle multi-line transactions if we didn't get many results
    if (transactions.length < 5 && lines.length > 20) {
      logMessage('warn', 'transaction-parse', 'Few transactions found, attempting multi-line reconstruction');
      
      const multiLineTransactions = reconstructMultiLineTransactions(lines, sourceFile);
      transactions.push(...multiLineTransactions);
    }
    
    // Calculate summary
    const totalCredit = transactions.filter(t => t.amount > 0).reduce((sum, t) => sum + t.amount, 0);
    const totalDebit = Math.abs(transactions.filter(t => t.amount < 0).reduce((sum, t) => sum + t.amount, 0));
    
    logMessage('info', 'transaction-parse', `Transaction extraction completed for ${sourceFile}`, {
      totalLines: lines.length,
      transactionsParsed: transactions.length,
      successRate: `${((successCount / Math.max(1, lines.length)) * 100).toFixed(1)}%`,
      totalCredit: totalCredit,
      totalDebit: totalDebit,
      dateRange: transactions.length > 0 ? {
        first: transactions[0].date,
        last: transactions[transactions.length - 1].date
      } : null
    });
    
    return transactions;
  };
  
  // Handle multi-line transactions (fallback method)
  const reconstructMultiLineTransactions = (lines, sourceFile) => {
    logMessage('debug', 'transaction-reconstruct', 'Attempting multi-line transaction reconstruction');
    
    const transactions = [];
    let currentTransaction = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Skip empty lines and headers
      if (!line || line.length < 5) continue;
      
      // Check if line starts with date
      const dateMatch = line.match(/^(\d{1,2})\s+(\w{3})\b/);
      
      if (dateMatch) {
        // Process previous transaction if exists
        if (currentTransaction.length > 0) {
          const reconstructed = currentTransaction.join(' ').replace(/\s+/g, ' ');
          const parsed = parseStandardBankTransaction(reconstructed);
          
          if (parsed && !isNaN(parsed.amount) && Math.abs(parsed.amount) > 0) {
            transactions.push({
              id: Date.now() + Math.random(),
              date: parsed.date,
              originalDescription: parsed.description,
              amount: parsed.amount,
              balance: parsed.balance,
              type: parsed.type,
              sourceFile: sourceFile,
              lineNumber: i,
              rawLine: reconstructed,
              multiLine: true
            });
          }
        }
        
        // Start new transaction
        currentTransaction = [line];
      } else if (currentTransaction.length > 0) {
        // Add to current transaction
        currentTransaction.push(line);
        
        // Check if we now have a complete transaction
        const testLine = currentTransaction.join(' ').replace(/\s+/g, ' ');
        if (testLine.match(/[+-]\s*[\d\s,]+\.?\d*\s+[\d\s,]+\.?\d*$/)) {
          // Looks complete
          const parsed = parseStandardBankTransaction(testLine);
          
          if (parsed && !isNaN(parsed.amount) && Math.abs(parsed.amount) > 0) {
            transactions.push({
              id: Date.now() + Math.random(),
              date: parsed.date,
              originalDescription: parsed.description,
              amount: parsed.amount,
              balance: parsed.balance,
              type: parsed.type,
              sourceFile: sourceFile,
              lineNumber: i,
              rawLine: testLine,
              multiLine: true
            });
            currentTransaction = [];
          }
        }
      }
    }
    
    // Process final transaction
    if (currentTransaction.length > 0) {
      const reconstructed = currentTransaction.join(' ').replace(/\s+/g, ' ');
      const parsed = parseStandardBankTransaction(reconstructed);
      
      if (parsed && !isNaN(parsed.amount) && Math.abs(parsed.amount) > 0) {
        transactions.push({
          id: Date.now() + Math.random(),
          date: parsed.date,
          originalDescription: parsed.description,
          amount: parsed.amount,
          balance: parsed.balance,
          type: parsed.type,
          sourceFile: sourceFile,
          lineNumber: lines.length,
          rawLine: reconstructed,
          multiLine: true
        });
      }
    }
    
    logMessage('info', 'transaction-reconstruct', `Multi-line reconstruction found ${transactions.length} additional transactions`);
    
    return transactions;
  };
  
  // Detect statement period from transactions
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
        if (month !== undefined && day >= 1 && day <= 31) {
          // Determine year based on month (Nov-Dec = 2024, others = 2025)
          const year = (month >= 10) ? 2024 : 2025;
          return new Date(year, month, day);
        }
      }
      return null;
    }).filter(d => d !== null);

    if (dates.length === 0) return null;

    dates.sort((a, b) => a - b);
    const startDate = dates[0];
    const endDate = dates[dates.length - 1];
    
    const timeDiff = endDate - startDate;
    const daysDiff = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
    const monthsDiff = Math.max(1, Math.round(daysDiff / 30.44));

    logMessage('info', 'period-detection', `Statement period detected`, {
      startDate: startDate.toDateString(),
      endDate: endDate.toDateString(),
      daysCovered: daysDiff,
      monthsCovered: monthsDiff,
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
    parseStandardBankTransaction
  };
};