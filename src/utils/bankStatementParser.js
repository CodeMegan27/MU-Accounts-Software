import * as XLSX from 'xlsx';

/**
 * Normalizes date values from Excel (serial codes, ISO, DMY, MDY) to YYYY-MM-DD
 */
export function normalizeDate(val) {
  if (val === null || val === undefined) return '';
  const str = String(val).trim();
  if (!str || str === '-' || str === 'NIL') return '';

  // 1. ISO YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;

  // 2. Numeric Excel date serial code (e.g. 45565)
  const num = Number(str);
  if (!isNaN(num) && num > 20000 && num < 70000) {
    try {
      const parsed = XLSX.SSF.parse_date_code(num);
      if (parsed && parsed.y && parsed.m && parsed.d) {
        const y = String(parsed.y);
        const m = String(parsed.m).padStart(2, '0');
        const d = String(parsed.d).padStart(2, '0');
        return `${y}-${m}-${d}`;
      }
    } catch (e) {}
  }

  // 3. String timestamp e.g. 2026-09-30T10:00:00
  if (/^\d{4}-\d{2}-\d{2}T/.test(str)) {
    return str.substring(0, 10);
  }

  // 4. Split by slash, dash or dot
  const parts = str.split(/[-/.]/);
  if (parts.length === 3) {
    let [p1, p2, p3] = parts.map(p => p.trim());
    if (p1.length === 4) {
      // YYYY-MM-DD
      return `${p1}-${String(p2).padStart(2, '0')}-${String(p3).padStart(2, '0')}`;
    }

    let year = p3;
    if (year.length === 2) year = '20' + year;

    // Handle month name like "01-Sep-2026"
    const monthNames = {
      jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
      jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12'
    };
    const mLower = p2.toLowerCase().substring(0, 3);
    if (monthNames[mLower]) {
      const day = String(p1).padStart(2, '0');
      return `${year}-${monthNames[mLower]}-${day}`;
    }

    // Default Indian banking convention: DD/MM/YYYY
    const d = String(p1).padStart(2, '0');
    const m = String(p2).padStart(2, '0');
    return `${year}-${m}-${d}`;
  }

  return str;
}

/**
 * Normalizes number/amount values from Excel strings, removing currency symbols, commas, etc.
 */
export function parseAmount(val) {
  if (val === null || val === undefined || val === '') return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;

  let str = String(val).trim();
  if (!str || str === '-' || str === 'NIL') return 0;

  // Handle accounting parentheses: (500.00) -> -500.00
  let isNegative = false;
  if (str.startsWith('(') && str.endsWith(')')) {
    isNegative = true;
    str = str.substring(1, str.length - 1).trim();
  }

  // Strip INR, Rs, ₹, commas, spaces
  str = str.replace(/[₹RsINR,\s]/gi, '');
  const parsed = parseFloat(str);
  if (isNaN(parsed)) return 0;
  return isNegative ? -Math.abs(parsed) : parsed;
}

/**
 * Parse SBI Statement from 2D array of rows
 * Expected columns:
 * Txn Date | Value Date | Description | Ref No./Cheque No. | Branch Code | Debit | Credit | Balance | Remark | Description
 */
export function parseSbiRows(rows) {
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error('Statement file is empty');
  }

  // 1. Locate header row
  let headerRowIdx = -1;
  for (let i = 0; i < Math.min(rows.length, 30); i++) {
    const row = rows[i] || [];
    const rowStr = row.map(c => String(c).toLowerCase().trim()).join(' ');
    if (
      (rowStr.includes('txn date') || rowStr.includes('transaction date')) &&
      (rowStr.includes('debit') || rowStr.includes('credit') || rowStr.includes('balance') || rowStr.includes('ref no'))
    ) {
      headerRowIdx = i;
      break;
    }
  }

  if (headerRowIdx === -1) {
    // Check if row 0 has Debit and Credit
    const row0 = (rows[0] || []).map(c => String(c).toLowerCase().trim()).join(' ');
    if (row0.includes('debit') && row0.includes('credit')) {
      headerRowIdx = 0;
    } else {
      throw new Error(
        'Could not locate SBI statement header row. Expected columns: Txn Date, Value Date, Description, Ref No./Cheque No., Branch Code, Debit, Credit, Balance, Remark, Description'
      );
    }
  }

  const headerRow = rows[headerRowIdx] || [];
  
  // Map column indexes
  let colTxnDate = -1;
  let colValueDate = -1;
  let colDesc1 = -1;
  let colRefNo = -1;
  let colBranchCode = -1;
  let colDebit = -1;
  let colCredit = -1;
  let colBalance = -1;
  let colRemark = -1;
  let colDesc2 = -1;

  headerRow.forEach((col, idx) => {
    const name = String(col).toLowerCase().trim();
    if (name.includes('txn date') || name.includes('transaction date') || name === 'date') {
      if (colTxnDate === -1) colTxnDate = idx;
    } else if (name.includes('value date')) {
      colValueDate = idx;
    } else if (name.includes('ref no') || name.includes('cheque no') || name.includes('chq no')) {
      colRefNo = idx;
    } else if (name.includes('branch code') || name.includes('branch')) {
      colBranchCode = idx;
    } else if (name.includes('debit') || name === 'dr' || name.includes('withdrawal')) {
      colDebit = idx;
    } else if (name.includes('credit') || name === 'cr' || name.includes('deposit')) {
      colCredit = idx;
    } else if (name.includes('balance')) {
      colBalance = idx;
    } else if (name.includes('remark')) {
      colRemark = idx;
    } else if (name.includes('description') || name.includes('narration') || name.includes('particulars')) {
      if (colDesc1 === -1) {
        colDesc1 = idx;
      } else {
        colDesc2 = idx;
      }
    }
  });

  // Fallback defaults if exact match not found but positioned as per user's specification
  if (colTxnDate === -1) colTxnDate = 0;
  if (colValueDate === -1) colValueDate = 1;
  if (colDesc1 === -1) colDesc1 = 2;
  if (colRefNo === -1) colRefNo = 3;
  if (colBranchCode === -1) colBranchCode = 4;
  if (colDebit === -1) colDebit = 5;
  if (colCredit === -1) colCredit = 6;
  if (colBalance === -1) colBalance = 7;
  if (colRemark === -1) colRemark = 8;
  if (colDesc2 === -1 && headerRow.length > 9) colDesc2 = 9;

  const transactions = [];
  let totalDebit = 0;
  let totalCredit = 0;

  for (let i = headerRowIdx + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;

    const rawTxnDate = row[colTxnDate];
    const rawDesc = row[colDesc1];
    const rawDebit = row[colDebit];
    const rawCredit = row[colCredit];
    const rawBal = row[colBalance];

    // Check if empty row or summary row
    const firstCell = String(row[0] || '').toLowerCase().trim();
    if (
      firstCell.startsWith('total') ||
      firstCell.startsWith('grand total') ||
      firstCell.startsWith('closing balance') ||
      firstCell.startsWith('statement summary') ||
      firstCell.startsWith('**') ||
      (!rawTxnDate && !rawDesc && !rawDebit && !rawCredit)
    ) {
      continue;
    }

    const txnDate = normalizeDate(rawTxnDate);
    const valueDate = normalizeDate(row[colValueDate]) || txnDate;
    const description = String(rawDesc || '').trim();
    const refNo = String(row[colRefNo] || '').trim();
    const branchCode = String(row[colBranchCode] || '').trim();
    const debit = parseAmount(rawDebit);
    const credit = parseAmount(rawCredit);
    const balance = parseAmount(rawBal);
    const remark = String(row[colRemark] || '').trim();
    const secondaryDesc = colDesc2 !== -1 ? String(row[colDesc2] || '').trim() : '';

    // If completely empty of financial transaction data, skip
    if (!txnDate && !description && debit === 0 && credit === 0) continue;

    totalDebit += debit;
    totalCredit += credit;

    transactions.push({
      id: `sbi_stmt_${Date.now()}_${i}`,
      bank: 'SBI',
      txnDate: txnDate || new Date().toISOString().substring(0, 10),
      valueDate,
      description,
      refNo,
      branchCode,
      debit,
      credit,
      balance,
      remark,
      secondaryDescription: secondaryDesc,
      crDr: credit > 0 ? 'CR' : debit > 0 ? 'DR' : '',
      amount: credit > 0 ? credit : debit,
      importedAt: new Date().toISOString()
    });
  }

  if (transactions.length === 0) {
    throw new Error('No valid SBI statement transactions found in file');
  }

  return {
    bank: 'SBI',
    transactions,
    summary: {
      count: transactions.length,
      totalCredit,
      totalDebit,
      netFlow: totalCredit - totalDebit,
      closingBalance: transactions[transactions.length - 1]?.balance || 0,
      fromDate: transactions[0]?.txnDate || '',
      toDate: transactions[transactions.length - 1]?.txnDate || ''
    }
  };
}

/**
 * Parse IDBI Statement from 2D array of rows
 * Expected columns:
 * Srl | Txn Date | Value Date | Description | Cheque No | CR/DR | CCY | Amount (INR) | Balance (INR) | Remark | Description
 */
export function parseIdbiRows(rows) {
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error('Statement file is empty');
  }

  // 1. Locate header row
  let headerRowIdx = -1;
  for (let i = 0; i < Math.min(rows.length, 30); i++) {
    const row = rows[i] || [];
    const rowStr = row.map(c => String(c).toLowerCase().trim()).join(' ');
    if (
      (rowStr.includes('srl') || rowStr.includes('sr no') || rowStr.includes('sl no')) ||
      (rowStr.includes('txn date') && (rowStr.includes('cr/dr') || rowStr.includes('amount') || rowStr.includes('ccy')))
    ) {
      headerRowIdx = i;
      break;
    }
  }

  if (headerRowIdx === -1) {
    const row0 = (rows[0] || []).map(c => String(c).toLowerCase().trim()).join(' ');
    if (row0.includes('cr/dr') || (row0.includes('amount') && row0.includes('balance'))) {
      headerRowIdx = 0;
    } else {
      throw new Error(
        'Could not locate IDBI statement header row. Expected columns: Srl, Txn Date, Value Date, Description, Cheque No, CR/DR, CCY, Amount (INR), Balance (INR), Remark, Description'
      );
    }
  }

  const headerRow = rows[headerRowIdx] || [];

  // Map column indexes
  let colSrl = -1;
  let colTxnDate = -1;
  let colValueDate = -1;
  let colDesc1 = -1;
  let colChequeNo = -1;
  let colCrDr = -1;
  let colCcy = -1;
  let colAmount = -1;
  let colBalance = -1;
  let colRemark = -1;
  let colDesc2 = -1;

  headerRow.forEach((col, idx) => {
    const name = String(col).toLowerCase().trim();
    if (name === 'srl' || name.includes('sr no') || name.includes('s.no') || name.includes('sl no')) {
      colSrl = idx;
    } else if (name.includes('txn date') || name.includes('transaction date') || name === 'date') {
      if (colTxnDate === -1) colTxnDate = idx;
    } else if (name.includes('value date')) {
      colValueDate = idx;
    } else if (name.includes('cheque no') || name.includes('chq no') || name.includes('ref no')) {
      colChequeNo = idx;
    } else if (name.includes('cr/dr') || name.includes('cr / dr') || name === 'type' || name === 'crdr') {
      colCrDr = idx;
    } else if (name.includes('ccy') || name.includes('currency')) {
      colCcy = idx;
    } else if (name.includes('amount')) {
      colAmount = idx;
    } else if (name.includes('balance')) {
      colBalance = idx;
    } else if (name.includes('remark')) {
      colRemark = idx;
    } else if (name.includes('description') || name.includes('narration') || name.includes('particulars')) {
      if (colDesc1 === -1) {
        colDesc1 = idx;
      } else {
        colDesc2 = idx;
      }
    }
  });

  // Fallbacks if not detected by header name
  if (colSrl === -1) colSrl = 0;
  if (colTxnDate === -1) colTxnDate = 1;
  if (colValueDate === -1) colValueDate = 2;
  if (colDesc1 === -1) colDesc1 = 3;
  if (colChequeNo === -1) colChequeNo = 4;
  if (colCrDr === -1) colCrDr = 5;
  if (colCcy === -1) colCcy = 6;
  if (colAmount === -1) colAmount = 7;
  if (colBalance === -1) colBalance = 8;
  if (colRemark === -1) colRemark = 9;
  if (colDesc2 === -1 && headerRow.length > 10) colDesc2 = 10;

  const transactions = [];
  let totalDebit = 0;
  let totalCredit = 0;

  for (let i = headerRowIdx + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;

    const rawSrl = row[colSrl];
    const rawTxnDate = row[colTxnDate];
    const rawDesc = row[colDesc1];
    const rawAmount = row[colAmount];
    const rawBal = row[colBalance];

    const firstCell = String(row[0] || '').toLowerCase().trim();
    if (
      firstCell.startsWith('total') ||
      firstCell.startsWith('grand total') ||
      firstCell.startsWith('closing balance') ||
      firstCell.startsWith('statement summary') ||
      firstCell.startsWith('**') ||
      (!rawTxnDate && !rawDesc && !rawAmount)
    ) {
      continue;
    }

    const srl = String(rawSrl || i - headerRowIdx).trim();
    const txnDate = normalizeDate(rawTxnDate);
    const valueDate = normalizeDate(row[colValueDate]) || txnDate;
    const description = String(rawDesc || '').trim();
    const chequeNo = String(row[colChequeNo] || '').trim();
    const rawCrDr = String(row[colCrDr] || '').toUpperCase().trim();
    const ccy = String(row[colCcy] || 'INR').trim();
    const rawAmtParsed = parseAmount(rawAmount);
    const balance = parseAmount(rawBal);
    const remark = String(row[colRemark] || '').trim();
    const secondaryDesc = colDesc2 !== -1 ? String(row[colDesc2] || '').trim() : '';

    if (!txnDate && !description && rawAmtParsed === 0) continue;

    // Determine CR or DR
    let crDr = 'CR';
    let debit = 0;
    let credit = 0;
    const absAmt = Math.abs(rawAmtParsed);

    if (rawCrDr === 'DR' || rawCrDr.includes('DR') || rawCrDr.includes('DEBIT') || rawAmtParsed < 0) {
      crDr = 'DR';
      debit = absAmt;
      credit = 0;
      totalDebit += absAmt;
    } else {
      crDr = 'CR';
      credit = absAmt;
      debit = 0;
      totalCredit += absAmt;
    }

    transactions.push({
      id: `idbi_stmt_${Date.now()}_${i}`,
      bank: 'IDBI',
      srl,
      txnDate: txnDate || new Date().toISOString().substring(0, 10),
      valueDate,
      description,
      refNo: chequeNo,
      chequeNo,
      crDr,
      ccy,
      amount: absAmt,
      debit,
      credit,
      balance,
      remark,
      secondaryDescription: secondaryDesc,
      importedAt: new Date().toISOString()
    });
  }

  if (transactions.length === 0) {
    throw new Error('No valid IDBI statement transactions found in file');
  }

  return {
    bank: 'IDBI',
    transactions,
    summary: {
      count: transactions.length,
      totalCredit,
      totalDebit,
      netFlow: totalCredit - totalDebit,
      closingBalance: transactions[transactions.length - 1]?.balance || 0,
      fromDate: transactions[0]?.txnDate || '',
      toDate: transactions[transactions.length - 1]?.txnDate || ''
    }
  };
}

/**
 * Universal Parser for Excel File (.xlsx, .xls, .csv)
 * Takes a File object and optional targetBank ('sbi' | 'idbi')
 */
export async function parseBankStatementFile(file, targetBank = null) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array', cellDates: false });
        
        if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
          throw new Error('Excel workbook has no sheets');
        }

        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

        if (!rows || rows.length === 0) {
          throw new Error('Sheet is empty');
        }

        // Auto-detect bank if not specified
        let bank = targetBank ? targetBank.toLowerCase() : null;
        if (!bank) {
          const sampleText = rows.slice(0, 20).map(r => r.join(' ')).join(' ').toLowerCase();
          if (sampleText.includes('idbi') || sampleText.includes('cr/dr') || sampleText.includes('srl')) {
            bank = 'idbi';
          } else if (sampleText.includes('sbi') || sampleText.includes('branch code')) {
            bank = 'sbi';
          } else {
            // Default to targetBank or sbi
            bank = 'sbi';
          }
        }

        if (bank === 'sbi') {
          const result = parseSbiRows(rows);
          resolve(result);
        } else {
          const result = parseIdbiRows(rows);
          resolve(result);
        }
      } catch (err) {
        reject(err);
      }
    };

    reader.onerror = (err) => {
      reject(new Error('Failed to read file: ' + err.message));
    };

    reader.readAsArrayBuffer(file);
  });
}

/**
 * Downloads a sample template Excel file with exact bank columns
 */
export function downloadBankSampleTemplate(bankType) {
  const isSbi = bankType.toLowerCase() === 'sbi';
  const wb = XLSX.utils.book_new();

  if (isSbi) {
    const headers = [
      'Txn Date',
      'Value Date',
      'Description',
      'Ref No./Cheque No.',
      'Branch Code',
      'Debit',
      'Credit',
      'Balance',
      'Remark',
      'Description'
    ];

    const sampleRows = [
      [
        '01/09/2026',
        '01/09/2026',
        'UPI/624512345678/MU ACCOUNTS/PAYMENT',
        'UPI624512345678',
        '00845',
        '',
        '25000.00',
        '125000.00',
        'CUSTOMER ADVANCE',
        'OFFSET PRINTING'
      ],
      [
        '03/09/2026',
        '03/09/2026',
        'CHQ WDL - PAPER MART SUPPLIES',
        'CHQ104822',
        '00845',
        '14500.00',
        '',
        '110500.00',
        'RAW MATERIAL',
        'BILL #10492'
      ],
      [
        '05/09/2026',
        '05/09/2026',
        'NEFT CR - SRI MURUGAN STORE',
        'NEFT9982310',
        '00845',
        '',
        '8500.00',
        '119000.00',
        'EST #9144 PAYMENT',
        'FLEX BOARD'
      ]
    ];

    const ws = XLSX.utils.aoa_to_sheet([headers, ...sampleRows]);
    XLSX.utils.book_append_sheet(wb, ws, 'SBI_Statement');
    XLSX.writeFile(wb, `SBI_Bank_Statement_Template.xlsx`);
  } else {
    const headers = [
      'Srl',
      'Txn Date',
      'Value Date',
      'Description',
      'Cheque No',
      'CR/DR',
      'CCY',
      'Amount (INR)',
      'Balance (INR)',
      'Remark',
      'Description'
    ];

    const sampleRows = [
      [
        '1',
        '01/09/2026',
        '01/09/2026',
        'BY CLG - KVT GRAPHICS COLLECTION',
        '004512',
        'CR',
        'INR',
        '35000.00',
        '185000.00',
        'JOB ORDER #8910',
        'LEDGER CREDIT'
      ],
      [
        '2',
        '02/09/2026',
        '02/09/2026',
        'TO RTGS - INK & CHEMICAL SUPPLIERS',
        'RTGS849102',
        'DR',
        'INR',
        '18200.00',
        '166800.00',
        'VENDOR VOUCHER',
        'MATERIALS'
      ],
      [
        '3',
        '04/09/2026',
        '04/09/2026',
        'BY UPI - ANBU AGENCIES EST SETTLE',
        'UPI771829',
        'CR',
        'INR',
        '12450.00',
        '179250.00',
        'EST #9182',
        'PRINTING JOB'
      ]
    ];

    const ws = XLSX.utils.aoa_to_sheet([headers, ...sampleRows]);
    XLSX.utils.book_append_sheet(wb, ws, 'IDBI_Statement');
    XLSX.writeFile(wb, `IDBI_Bank_Statement_Template.xlsx`);
  }

  return true;
}

/**
 * Export statement list to Excel formatted with official bank columns
 */
export function exportBankStatementToExcel(bankType, statementList) {
  if (!statementList || statementList.length === 0) return false;
  const isSbi = bankType.toLowerCase() === 'sbi';
  const wb = XLSX.utils.book_new();

  if (isSbi) {
    const headers = [
      'Txn Date',
      'Value Date',
      'Description',
      'Ref No./Cheque No.',
      'Branch Code',
      'Debit',
      'Credit',
      'Balance',
      'Remark',
      'Description'
    ];

    const rows = statementList.map(item => [
      item.txnDate || '',
      item.valueDate || item.txnDate || '',
      item.description || '',
      item.refNo || item.chequeNo || '',
      item.branchCode || '',
      item.debit > 0 ? item.debit : '',
      item.credit > 0 ? item.credit : '',
      item.balance !== undefined ? item.balance : '',
      item.remark || '',
      item.secondaryDescription || ''
    ]);

    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    XLSX.utils.book_append_sheet(wb, ws, 'SBI_Statement');
    XLSX.writeFile(wb, `SBI_Statement_Export_${new Date().toISOString().slice(0, 10)}.xlsx`);
  } else {
    const headers = [
      'Srl',
      'Txn Date',
      'Value Date',
      'Description',
      'Cheque No',
      'CR/DR',
      'CCY',
      'Amount (INR)',
      'Balance (INR)',
      'Remark',
      'Description'
    ];

    const rows = statementList.map((item, idx) => [
      item.srl || idx + 1,
      item.txnDate || '',
      item.valueDate || item.txnDate || '',
      item.description || '',
      item.chequeNo || item.refNo || '',
      item.crDr || (item.credit > 0 ? 'CR' : 'DR'),
      item.ccy || 'INR',
      item.amount || (item.credit > 0 ? item.credit : item.debit) || '',
      item.balance !== undefined ? item.balance : '',
      item.remark || '',
      item.secondaryDescription || ''
    ]);

    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    XLSX.utils.book_append_sheet(wb, ws, 'IDBI_Statement');
    XLSX.writeFile(wb, `IDBI_Statement_Export_${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  return true;
}
