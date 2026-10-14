import * as XLSX from 'xlsx';

export function normalizeDateToISO(dateVal, preferredFormat = 'DMY') {
  if (dateVal === null || dateVal === undefined) return '';
  const str = String(dateVal).trim();
  if (!str || str === 'NIL' || str === '-') return '';
  
  // 1. If already ISO YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;

  // 2. Handle numeric Excel date serial numbers (e.g. 46246 or 46266)
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

  // 3. Handle ISO timestamp strings (e.g. "2026-08-12T00:00:00.000Z")
  if (/^\d{4}-\d{2}-\d{2}T/.test(str)) {
    return str.substring(0, 10);
  }

  // 4. Handle formatted dates like DD-MM-YYYY, M/D/YY, MM/DD/YYYY
  const parts = str.split(/[-/.]/);
  if (parts.length === 3) {
    let [p1, p2, p3] = parts.map(p => p.trim());

    // Case A: YYYY-MM-DD
    if (p1.length === 4) {
      const year = p1;
      const month = String(p2).padStart(2, '0');
      const day = String(p3).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }

    // Case B: 2 or 4 digit year at the end
    let year = p3;
    if (year.length === 2) year = '20' + year;

    const n1 = parseInt(p1, 10);
    const n2 = parseInt(p2, 10);

    let day, month;
    if (n1 > 12) {
      // First part is > 12, CANNOT be a month (e.g. 25-09-2026, 13/09/2026) -> DMY
      day = String(n1).padStart(2, '0');
      month = String(n2).padStart(2, '0');
    } else if (n2 > 12) {
      // Second part is > 12, CANNOT be a month (e.g. 9/25/26, 09/13/2026) -> MDY
      month = String(n1).padStart(2, '0');
      day = String(n2).padStart(2, '0');
    } else if (preferredFormat === 'MDY') {
      // If dataset convention is MDY (e.g. 9/1/26 ... 9/12/26 in September)
      month = String(n1).padStart(2, '0');
      day = String(n2).padStart(2, '0');
    } else {
      // Standard Indian format: DD-MM-YYYY (e.g., 12-08-2026 -> 12 Aug 2026)
      day = String(n1).padStart(2, '0');
      month = String(n2).padStart(2, '0');
    }

    return `${year}-${month}-${day}`;
  }

  return str;
}

/**
 * Intelligent Sales CSV & Excel Parser for Composite Bills
 * Groups multiple rows with the same EST NO into a single composite invoice.
 */
export function parseSalesData(sheetData) {
  if (!Array.isArray(sheetData) || sheetData.length === 0) return [];

  // Detect dataset-wide date format convention (MDY vs DMY)
  let hasDayOver12AtStart = false; // e.g. 25/09/2026 -> DMY
  let hasDayOver12AtMiddle = false; // e.g. 09/25/2026 or 9/25/26 -> MDY

  sheetData.forEach(row => {
    Object.keys(row).forEach(k => {
      const uk = k.trim().toUpperCase();
      if (uk.includes('DATE') || uk === 'TODAY') {
        const val = row[k];
        if (val && typeof val === 'string') {
          const s = val.trim();
          const parts = s.split(/[-/.]/);
          if (parts.length === 3 && parts[0].length <= 2 && parts[1].length <= 2) {
            const n1 = parseInt(parts[0], 10);
            const n2 = parseInt(parts[1], 10);
            if (n1 > 12 && n1 <= 31) hasDayOver12AtStart = true;
            if (n2 > 12 && n2 <= 31) hasDayOver12AtMiddle = true;
          }
        }
      }
    });
  });

  const preferredFormat = hasDayOver12AtMiddle && !hasDayOver12AtStart ? 'MDY' : 'DMY';

  // Group rows by unique job key (EST NO + Branch + Order Date)
  const orderMap = new Map();

  sheetData.forEach((row, index) => {
    // Normalise column keys (trim, remove non-printable characters)
    const cleanRow = {};
    Object.keys(row).forEach(k => {
      cleanRow[k.trim().toUpperCase()] = row[k];
    });

    const estNo = String(cleanRow['EST NO'] || cleanRow['EST NO.'] || cleanRow['ESTIMATE NO'] || `EST_${index}`).trim();
    const branch = String(cleanRow['BRANCH'] || 'KLK').trim().toUpperCase();
    const rawOrderDate = String(cleanRow['ORDER- DATE'] || cleanRow['ORDER DATE'] || cleanRow['DATE'] || '').trim();
    const orderDate = normalizeDateToISO(rawOrderDate, preferredFormat);
    const customerName = String(cleanRow['CUSTOMER NAME'] || cleanRow['CUSTOMER'] || 'Walk-in Customer').trim();

    // Unique key: estNo + branch + orderDate
    const groupKey = `${branch}_${orderDate}_${estNo}_${customerName}`;

    if (!orderMap.has(groupKey)) {
      // First row of order: initialise invoice container
      const total = parseFloat(cleanRow['TOTAL']) || 0;
      const discount = parseFloat(cleanRow['DISCOUNT']) || 0;
      const rawGst = parseFloat(cleanRow['GST  18%'] || cleanRow['GST 18%'] || cleanRow['GST'] || 0);
      let finalAmount = parseFloat(cleanRow['FINAL SALE AMOUNT'] || cleanRow['FINAL AMOUNT'] || cleanRow['GRAND TOTAL'] || (total - discount + rawGst));
      if (!finalAmount) finalAmount = Math.max(0, total - discount);

      // Tax is inclusive in sales amount: separate 18% GST
      let gstAmount = rawGst;
      if (gstAmount <= 0 && finalAmount > 0) {
        gstAmount = Math.round(((finalAmount * 18) / 118) * 100) / 100;
      }
      const taxableAmount = Math.round((finalAmount - gstAmount) * 100) / 100;
      const paid = parseFloat(cleanRow['PAID']) || 0;
      const balance = parseFloat(cleanRow['BALANCE AMOUNT'] || cleanRow['BALANCE'] || (finalAmount - paid));

      const rawStatus = String(cleanRow['BILL STATUS'] || '').trim().toUpperCase();
      const paymentStatus = (rawStatus === 'NIL' || balance <= 0) ? 'paid' : (paid > 0 ? 'partial' : 'pending');

      // Parse payment methods & amounts from final columns
      const payments = [];
      const rawAdvance = String(cleanRow['ADVANCE'] || '').trim();
      const rawAdvMethod = String(cleanRow['PAYMENT METHOD'] || cleanRow['PAYMENT METHOD_1'] || cleanRow['ADVANCE METHOD'] || '').trim();
      const rawBalPaid = String(cleanRow['BALANCE'] || cleanRow['BALANCE_1'] || cleanRow['BAL PAID'] || '').trim();
      const rawBalMethod = String(cleanRow['PAYMENT METHOD_2'] || cleanRow['PAYMENT METHOD_1'] || cleanRow['BALANCE METHOD'] || '').trim();

      // Process Advance payments (may contain multiple split payments like "2000, 3000")
      if (rawAdvance && rawAdvance !== 'NIL' && rawAdvance !== '0') {
        const advParts = rawAdvance.split(',').map(s => parseFloat(s.trim())).filter(n => !isNaN(n));
        const methodParts = rawAdvMethod.split(',').map(s => s.trim());
        advParts.forEach((amt, i) => {
          payments.push({
            id: `pay_adv_${Date.now()}_${i}`,
            type: 'Advance',
            amount: amt,
            method: methodParts[i] || methodParts[0] || 'CASH',
            date: orderDate
          });
        });
      }

      // Process Balance payments
      if (rawBalPaid && rawBalPaid !== 'NIL' && rawBalPaid !== '0') {
        const balParts = rawBalPaid.split(',').map(s => parseFloat(s.trim())).filter(n => !isNaN(n));
        const methodParts = rawBalMethod.split(',').map(s => s.trim());
        balParts.forEach((amt, i) => {
          payments.push({
            id: `pay_bal_${Date.now()}_${i}`,
            type: 'Balance Payment',
            amount: amt,
            method: methodParts[i] || methodParts[0] || 'CASH',
            date: normalizeDateToISO(cleanRow['INV- DATE'] || cleanRow['INV DATE'] || orderDate, preferredFormat)
          });
        });
      }

      const rawInvNo = String(cleanRow['INVOICE NO.'] || cleanRow['INVOICE NO'] || '').trim();
      const rawInvDate = normalizeDateToISO(cleanRow['INV- DATE'] || cleanRow['INV DATE'] || '', preferredFormat);
      const isCleared = paymentStatus === 'paid' || rawStatus === 'NIL' || balance <= 0;
      const isInvoice = Boolean(rawInvNo || rawInvDate || isCleared);
      const invoiceNo = rawInvNo || (isInvoice ? `INV-26-${estNo}` : '');
      const invDate = rawInvDate || (isCleared ? orderDate : '');

      orderMap.set(groupKey, {
        id: `sale_${estNo}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        estNo: estNo,
        orderDate: orderDate || new Date().toISOString().substring(0, 10),
        invDate: invDate,
        invoiceNo: invoiceNo,
        isInvoice: isInvoice,
        orderFormNo: String(cleanRow['ORDER FORM NO.'] || cleanRow['ORDER FORM NO'] || 'NA').trim(),
        branch: branch,
        department: String(cleanRow['DEPARTMENT'] || 'ADVERTISEMENT').trim().toUpperCase(),
        attender: String(cleanRow['ATTENDER'] || 'Staff').trim(),
        customerName: customerName,
        contact: String(cleanRow['CONTACT'] || '').trim(),
        address: String(cleanRow['ADDRESS'] || '').trim(),
        customerSegment: String(cleanRow['CUSTOMER SEGMENT'] || '').trim(),
        segmentType: String(cleanRow['SEGMENT TYPE'] || '').trim(),
        items: [],
        subtotal: total,
        discount: discount,
        gstRate: 18,
        gstAmount: gstAmount,
        taxableAmount: taxableAmount,
        finalAmount: finalAmount,
        paidAmount: paid,
        balanceAmount: balance < 0 ? 0 : balance,
        paymentStatus: paymentStatus,
        billStatus: rawStatus || (paymentStatus === 'paid' ? 'NIL' : 'PENDING'),
        dueDate: String(cleanRow['DUE DATE'] || 'NIL').trim(),
        payments: payments,
        createdAt: new Date().toISOString()
      });
    }


    // Add current line item to the order
    const order = orderMap.get(groupKey);
    const product = String(cleanRow['PRODUCT'] || 'Job Item').trim();
    const productDetails = String(cleanRow['PRODUCT DETAILS'] || cleanRow['DESCRIPTION'] || product).trim();
    const size = String(cleanRow['SIZE'] || '-').trim();
    const quantity = parseFloat(cleanRow['QUANTITY'] || cleanRow['QTY']) || 1;
    const rate = parseFloat(cleanRow['RATE']) || 0;
    const amount = parseFloat(cleanRow['AMOUNT']) || 0;

    order.items.push({
      id: `item_${index}_${Math.random().toString(36).substring(2, 6)}`,
      product: product,
      description: productDetails,
      size: size,
      quantity: quantity,
      rate: rate,
      amount: amount
    });
  });

  return Array.from(orderMap.values());
}

/**
 * Parses raw CSV string or File/ArrayBuffer into grouped Sales Orders
 */
export function parseSalesFile(fileContent, isCsv = false) {
  try {
    let workbook;
    if (isCsv || typeof fileContent === 'string') {
      workbook = XLSX.read(fileContent, { type: 'string', raw: true });
    } else {
      const dataArr = fileContent instanceof Uint8Array ? fileContent : new Uint8Array(fileContent);
      workbook = XLSX.read(dataArr, { type: 'array', cellDates: false });
    }

    let allRawRows = [];

    // Parse across all sheets in the Excel workbook
    workbook.SheetNames.forEach(sheetName => {
      const worksheet = workbook.Sheets[sheetName];
      if (!worksheet || !worksheet['!ref']) return;

      const range = XLSX.utils.decode_range(worksheet['!ref']);
      const dateCols = new Set();
      
      // Check headers in the first row
      for (let C = range.s.c; C <= range.e.c; ++C) {
        const colLetter = XLSX.utils.encode_col(C);
        const headerCell = worksheet[`${colLetter}${range.s.r + 1}`];
        if (headerCell && headerCell.v) {
          const h = String(headerCell.v).toUpperCase().trim();
          if (h.includes('DATE') || h === 'TODAY') {
            dateCols.add(colLetter);
          }
        }
      }

      // If date columns found, convert numeric Excel serials directly to ISO YYYY-MM-DD
      for (let R = range.s.r + 1; R <= range.e.r; ++R) {
        dateCols.forEach(col => {
          const cell = worksheet[`${col}${R + 1}`];
          if (cell) {
            const num = Number(cell.v);
            if (!isNaN(num) && num > 20000 && num < 70000) {
              try {
                const parsed = XLSX.SSF.parse_date_code(num);
                if (parsed && parsed.y && parsed.m && parsed.d) {
                  const iso = `${parsed.y}-${String(parsed.m).padStart(2, '0')}-${String(parsed.d).padStart(2, '0')}`;
                  cell.v = iso;
                  cell.w = iso;
                  cell.t = 's';
                }
              } catch (e) {}
            }
          }
        });
      }

      const rows = XLSX.utils.sheet_to_json(worksheet, { defval: '', raw: false });
      if (Array.isArray(rows) && rows.length > 0) {
        allRawRows.push(...rows);
      }
    });

    return parseSalesData(allRawRows);
  } catch (err) {
    console.error('Error parsing sales file:', err);
    throw err;
  }
}
