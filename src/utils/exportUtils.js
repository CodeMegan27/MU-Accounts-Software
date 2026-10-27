import * as XLSX from 'xlsx';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

// Export Standard Bills Register to Excel
export function exportBillsToExcel(bills) {
  if (!bills || bills.length === 0) return false;

  const exportData = [];
  bills.forEach(bill => {
    const items = bill.items || [];
    if (items.length === 0) {
      exportData.push({
        "Date": bill.date || '',
        "Invoice No": bill.invoiceNo || '',
        "Vendor": bill.vendorName || '',
        "GSTIN": bill.isGst ? (bill.gstin || 'UNREG') : 'UNREG',
        "Payment Status": bill.paymentStatus || 'Unpaid',
        "Item": '',
        "UQC": '',
        "Qty": '',
        "Rate": '',
        "Amount": '',
        "Subtotal": bill.subtotal || 0,
        "Packing": bill.packing || 0,
        "Discount": bill.discount || 0,
        "Tax Mode": bill.taxType || '',
        "GST Rate (%)": bill.taxRate || 0,
        "Tax Amount": bill.taxAmount || 0,
        "Grand Total": bill.grandTotal || 0,
        "Paid Amount": bill.paidAmount || 0,
        "Balance Due": bill.balanceAmount ?? (bill.grandTotal || 0)
      });
    } else {
      items.forEach((item, index) => {
        exportData.push({
          "Date": bill.date || '',
          "Invoice No": bill.invoiceNo || '',
          "Vendor": bill.vendorName || '',
          "GSTIN": bill.isGst ? (bill.gstin || 'UNREG') : 'UNREG',
          "Payment Status": bill.paymentStatus || 'Unpaid',
          "Item": item.name || '',
          "UQC": item.uqc || '',
          "Qty": item.qty || 0,
          "Rate": item.rate || 0,
          "Amount": item.amount || 0,
          "Subtotal": index === 0 ? (bill.subtotal || 0) : '',
          "Packing": index === 0 ? (bill.packing || 0) : '',
          "Discount": index === 0 ? (bill.discount || 0) : '',
          "Tax Mode": index === 0 ? (bill.taxType || '') : '',
          "GST Rate (%)": index === 0 ? (bill.taxRate || 0) : '',
          "Tax Amount": index === 0 ? (bill.taxAmount || 0) : '',
          "Grand Total": index === 0 ? (bill.grandTotal || 0) : '',
          "Paid Amount": index === 0 ? (bill.paidAmount || 0) : '',
          "Balance Due": index === 0 ? (bill.balanceAmount ?? (bill.grandTotal || 0)) : ''
        });
      });
    }
  });

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(exportData);
  XLSX.utils.book_append_sheet(wb, ws, "Purchases");
  XLSX.writeFile(wb, `Purchases_${new Date().toISOString().slice(0, 10)}.xlsx`);
  return true;
}

// Export Purchase Register as Specific Report:
// Date, Invoice No, Merchant, Product, Amount, Packing Chg, Taxes, Total Amnt
export function exportPurchaseRegisterReportExcel(bills, dateRangeLabel = '') {
  if (!bills || bills.length === 0) return false;

  let totalAmount = 0;
  let totalPacking = 0;
  let totalTaxes = 0;
  let totalGrand = 0;

  const exportData = bills.map((b) => {
    const productList = (b.items && b.items.length > 0)
      ? b.items.map(i => `${i.name || 'Item'} (${i.qty} ${i.uqc || 'NOS'})`).join(', ')
      : (b.productName || 'General Goods');

    const baseAmount = parseFloat(b.taxableBase ?? b.subtotal ?? 0);
    const packingChg = parseFloat(b.packing || 0);
    const taxes = parseFloat(b.taxAmount || 0);
    const grandTotal = parseFloat(b.grandTotal || 0);

    totalAmount += baseAmount;
    totalPacking += packingChg;
    totalTaxes += taxes;
    totalGrand += grandTotal;

    return {
      "Date": b.date || '',
      "Invoice No": b.invoiceNo || 'N/A',
      "Merchant": b.vendorName || 'Unknown Vendor',
      "Product": productList,
      "Amount": Number(baseAmount.toFixed(2)),
      "Packing Chg": Number(packingChg.toFixed(2)),
      "Taxes": Number(taxes.toFixed(2)),
      "Total Amnt": Number(grandTotal.toFixed(2))
    };
  });

  // Summary Row at the bottom
  exportData.push({
    "Date": "TOTAL",
    "Invoice No": "",
    "Merchant": `${bills.length} Invoices`,
    "Product": "",
    "Amount": Number(totalAmount.toFixed(2)),
    "Packing Chg": Number(totalPacking.toFixed(2)),
    "Taxes": Number(totalTaxes.toFixed(2)),
    "Total Amnt": Number(totalGrand.toFixed(2))
  });

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(exportData);
  XLSX.utils.book_append_sheet(wb, ws, "Purchase_Report");
  const filename = `Purchase_Register_Report_${dateRangeLabel ? dateRangeLabel.replace(/[^a-zA-Z0-9]/g, '_') + '_' : ''}${new Date().toISOString().slice(0, 10)}.xlsx`;
  XLSX.writeFile(wb, filename);
  return true;
}

// Export All Vendors Ledger into a SINGLE Excel file with EACH VENDOR in their OWN SHEET
export function exportAllVendorLedgersMultiSheet(vendors, bills, expenses = [], assets = []) {
  if (!vendors || vendors.length === 0) return false;

  const wb = XLSX.utils.book_new();
  const usedSheetNames = new Set();

  const sanitizeSheetName = (name) => {
    // Excel sheet name rules: max 31 chars, no \ / ? * [ ] :
    let clean = (name || 'Vendor')
      .replace(/[\\/?*\[\]:]/g, ' ')
      .trim()
      .substring(0, 26);
    if (!clean) clean = 'Vendor';
    
    let candidate = clean;
    let idx = 1;
    while (usedSheetNames.has(candidate.toLowerCase())) {
      candidate = `${clean.substring(0, 24)} (${idx})`;
      idx++;
    }
    usedSheetNames.add(candidate.toLowerCase());
    return candidate;
  };

  // Helper to match vendor expenses
  const getVendorExpenses = (v) => {
    const vNameLower = (v.name || '').trim().toLowerCase();
    return (expenses || []).filter(e => {
      if (e.vendorId && v.id && e.vendorId === v.id) return true;
      const payee = (e.payee || e.vendorName || '').trim().toLowerCase();
      if (!payee || !vNameLower) return false;
      return payee === vNameLower || payee.includes(vNameLower) || vNameLower.includes(payee);
    });
  };

  // Helper to match vendor assets
  const getVendorAssets = (v) => {
    const vNameLower = (v.name || '').trim().toLowerCase();
    return (assets || []).filter(a => {
      if (a.vendorId && v.id && a.vendorId === v.id) return true;
      const aVendor = (a.vendorName || '').trim().toLowerCase();
      if (!aVendor || !vNameLower) return false;
      return aVendor === vNameLower || aVendor.includes(vNameLower) || vNameLower.includes(aVendor);
    });
  };

  // 1. Sheet 1: Master Summary of All Vendors
  const summaryRows = [];
  let grandTotalBilled = 0;
  let grandTotalPaid = 0;
  let grandTotalBalance = 0;

  vendors.forEach(v => {
    const vBills = bills.filter(b => b.vendorId === v.id || b.vendorName === v.name);
    const vExpenses = getVendorExpenses(v);
    const vAssets = getVendorAssets(v);
    const opBal = parseFloat(v.openingBalance) || 0;
    const opType = v.openingBalanceType || 'payable';
    let vBilled = opType === 'payable' ? opBal : 0;
    let vPaid = opType === 'advance' ? opBal : 0;

    vBills.forEach(b => {
      const g = parseFloat(b.grandTotal) || 0;
      const p = parseFloat(b.paidAmount) || 0;
      vBilled += g;
      vPaid += p;
    });

    vExpenses.forEach(e => {
      const amt = parseFloat(e.amount) || 0;
      vBilled += amt;
      vPaid += amt;
    });

    vAssets.forEach(a => {
      const g = parseFloat(a.grandTotal !== undefined ? a.grandTotal : a.value) || 0;
      const p = parseFloat(a.paidAmount) || 0;
      vBilled += g;
      vPaid += p;
    });

    (v.paymentHistory || []).forEach(p => {
      const pAmt = parseFloat(p.amount) || 0;
      vPaid += pAmt;
    });

    const vBal = vBilled - vPaid;
    grandTotalBilled += vBilled;
    grandTotalPaid += vPaid;
    grandTotalBalance += vBal;

    summaryRows.push({
      "Vendor Name": v.name || '',
      "GSTIN": v.gstin || 'UNREGISTERED',
      "Phone": v.phone || '',
      "Opening Bal (₹)": opBal > 0 ? Number(opBal.toFixed(2)) : 0,
      "Bal Type": opBal > 0 ? (opType === 'advance' ? 'Cr (Adv)' : 'Dr (Payable)') : '-',
      "Bills Count": vBills.length + vExpenses.length + vAssets.length + (opBal > 0 ? 1 : 0),
      "Total Billed (₹)": Number(vBilled.toFixed(2)),
      "Total Paid (₹)": Number(vPaid.toFixed(2)),
      "Outstanding Balance (₹)": Number(vBal.toFixed(2)),
      "Status": vBal <= 0.01 ? "SETTLED" : "PENDING"
    });
  });

  // Footer summary
  summaryRows.push({
    "Vendor Name": "GRAND TOTAL",
    "GSTIN": "",
    "Phone": "",
    "Bills Count": bills.length + (assets || []).length,
    "Total Billed (₹)": Number(grandTotalBilled.toFixed(2)),
    "Total Paid (₹)": Number(grandTotalPaid.toFixed(2)),
    "Outstanding Balance (₹)": Number(grandTotalBalance.toFixed(2)),
    "Status": ""
  });

  const wsSummary = XLSX.utils.json_to_sheet(summaryRows);
  XLSX.utils.book_append_sheet(wb, wsSummary, "Vendors Summary");
  usedSheetNames.add("vendors summary");

  // 2. Individual Worksheet per Vendor
  vendors.forEach(v => {
    const vBills = bills.filter(b => b.vendorId === v.id || b.vendorName === v.name);
    const vExpenses = getVendorExpenses(v);
    const vAssets = getVendorAssets(v);
    const txs = [];
    const opBal = parseFloat(v.openingBalance) || 0;
    const opType = v.openingBalanceType || 'payable';
    const opDate = v.openingBalanceDate || '2026-04-01';
    let vBilled = opType === 'payable' ? opBal : 0;
    let vPaid = opType === 'advance' ? opBal : 0;

    if (opBal > 0) {
      txs.push({
        date: opDate,
        type: 'OPENING BALANCE',
        ref: 'OP-BAL',
        particulars: `Opening Balance (${opType === 'advance' ? 'Advance Paid / Cr' : 'Payable / B/F'})`,
        debit: opType === 'payable' ? opBal : 0,
        credit: opType === 'advance' ? opBal : 0
      });
    }

    // Process on-account advance payments
    if (Array.isArray(v.paymentHistory) && v.paymentHistory.length > 0) {
      v.paymentHistory.forEach(p => {
        const pAmt = parseFloat(p.amount) || 0;
        vPaid += pAmt;
        txs.push({
          date: p.date || '',
          type: 'PAYMENT',
          ref: p.reference || p.id,
          particulars: `On-Account Payment via ${p.mode || 'Bank Transfer'}${p.notes ? ' (' + p.notes + ')' : ''}`,
          debit: 0,
          credit: pAmt
        });
      });
    }

    vBills.forEach(b => {
      const gTotal = parseFloat(b.grandTotal) || 0;
      vBilled += gTotal;

      const prods = (b.items && b.items.length > 0)
        ? b.items.map(i => i.name).filter(Boolean).join(', ')
        : 'Goods';

      txs.push({
        date: b.date || '',
        type: 'PURCHASE BILL',
        ref: b.invoiceNo || b.id,
        particulars: `Purchase Bill #${b.invoiceNo || 'N/A'} - ${prods}`,
        debit: gTotal,
        credit: 0
      });

      if (b.paymentHistory && b.paymentHistory.length > 0) {
        b.paymentHistory.forEach(p => {
          const pAmt = parseFloat(p.amount) || 0;
          vPaid += pAmt;
          txs.push({
            date: p.date || b.date,
            type: 'PAYMENT',
            ref: p.reference || p.id,
            particulars: `Payment via ${p.mode || 'Bank Transfer'}${p.reference ? ' (Ref: ' + p.reference + ')' : ''}`,
            debit: 0,
            credit: pAmt
          });
        });
      }
    });

    vExpenses.forEach(e => {
      const eAmt = parseFloat(e.amount) || 0;
      vBilled += eAmt;
      vPaid += eAmt;

      txs.push({
        date: e.date || '',
        type: 'EXPENSE VOUCHER',
        ref: e.voucherNo || e.id,
        particulars: `Expense: ${e.category || 'Direct'} - ${e.description || e.payee || 'Expense Voucher'}`,
        debit: eAmt,
        credit: 0
      });

      txs.push({
        date: e.date || '',
        type: 'PAYMENT',
        ref: e.voucherNo || e.id,
        particulars: `Paid via ${e.paymentMethod || 'Cash'} (Vch #${e.voucherNo || 'N/A'})`,
        debit: 0,
        credit: eAmt
      });
    });

    vAssets.forEach(a => {
      const gTotal = parseFloat(a.grandTotal !== undefined ? a.grandTotal : a.value) || 0;
      vBilled += gTotal;

      txs.push({
        date: a.date || '',
        type: 'ASSET BILL',
        ref: a.invoiceNo || a.voucherNo || a.id,
        particulars: `Capital Asset: ${a.name} (Inv #${a.invoiceNo || a.voucherNo || 'N/A'})`,
        debit: gTotal,
        credit: 0
      });

      if (Array.isArray(a.paymentHistory) && a.paymentHistory.length > 0) {
        a.paymentHistory.forEach(p => {
          const pAmt = parseFloat(p.amount) || 0;
          vPaid += pAmt;
          txs.push({
            date: p.date || a.date,
            type: 'PAYMENT',
            ref: p.reference || p.id,
            particulars: `Asset Payment via ${p.mode || 'Bank'}`,
            debit: 0,
            credit: pAmt
          });
        });
      } else {
        const pAmt = parseFloat(a.paidAmount) || 0;
        if (pAmt > 0) {
          vPaid += pAmt;
          txs.push({
            date: a.date || '',
            type: 'PAYMENT',
            ref: a.voucherNo || a.id,
            particulars: `Paid via ${a.paymentMethod || 'Bank'}`,
            debit: 0,
            credit: pAmt
          });
        }
      }
    });

    // Chronological order (placing OPENING BALANCE first if on same date)
    txs.sort((a, b) => {
      const diff = new Date(a.date || '1970-01-01') - new Date(b.date || '1970-01-01');
      if (diff !== 0) return diff;
      if (a.type === 'OPENING BALANCE') return -1;
      if (b.type === 'OPENING BALANCE') return 1;
      return 0;
    });

    let running = 0;
    const vendorRows = [];

    // Header info rows
    vendorRows.push({
      "Date": `VENDOR: ${v.name || 'N/A'}`,
      "Voucher Type": `GSTIN: ${v.gstin || 'UNREGISTERED'}`,
      "Invoice / Ref": `PHONE: ${v.phone || 'N/A'}`,
      "Particulars / Details": `ADDRESS: ${v.address || 'N/A'}`,
      "Debit (Purchases ₹)": "",
      "Credit (Payments ₹)": "",
      "Running Balance (₹)": ""
    });
    vendorRows.push({
      "Date": "",
      "Voucher Type": "",
      "Invoice / Ref": "",
      "Particulars / Details": "",
      "Debit (Purchases ₹)": "",
      "Credit (Payments ₹)": "",
      "Running Balance (₹)": ""
    });

    if (txs.length === 0) {
      vendorRows.push({
        "Date": "-",
        "Voucher Type": "NO TRANSACTIONS",
        "Invoice / Ref": "-",
        "Particulars / Details": "No purchase bills or payments logged for this vendor yet.",
        "Debit (Purchases ₹)": 0,
        "Credit (Payments ₹)": 0,
        "Running Balance (₹)": 0
      });
    } else {
      txs.forEach(t => {
        running += (t.debit - t.credit);
        vendorRows.push({
          "Date": t.date,
          "Voucher Type": t.type,
          "Invoice / Ref": t.ref,
          "Particulars / Details": t.particulars,
          "Debit (Purchases ₹)": t.debit > 0 ? Number(t.debit.toFixed(2)) : 0,
          "Credit (Payments ₹)": t.credit > 0 ? Number(t.credit.toFixed(2)) : 0,
          "Running Balance (₹)": Number(running.toFixed(2))
        });
      });

      // Footer total for vendor sheet
      vendorRows.push({
        "Date": "TOTAL",
        "Voucher Type": "",
        "Invoice / Ref": "",
        "Particulars / Details": `Net Balance Due: ₹${running.toFixed(2)}`,
        "Debit (Purchases ₹)": Number(vBilled.toFixed(2)),
        "Credit (Payments ₹)": Number(vPaid.toFixed(2)),
        "Running Balance (₹)": Number(running.toFixed(2))
      });
    }

    const wsVendor = XLSX.utils.json_to_sheet(vendorRows);
    const sheetTitle = sanitizeSheetName(v.name);
    XLSX.utils.book_append_sheet(wb, wsVendor, sheetTitle);
  });

  const exportFilename = `All_Vendors_Ledger_${new Date().toISOString().slice(0, 10)}.xlsx`;
  XLSX.writeFile(wb, exportFilename);
  return true;
}

// Export Single Vendor Ledger to Excel
export function exportSingleVendorLedgerToExcel(vendor, transactions, summary) {
  if (!vendor || !transactions) return false;

  const rows = [];
  // Vendor info header
  rows.push({
    "Date": `VENDOR STATEMENT: ${vendor.name || ''}`,
    "Voucher Type": `GSTIN: ${vendor.gstin || 'UNREGISTERED'}`,
    "Ref / Invoice No": `PHONE: ${vendor.phone || ''}`,
    "Particulars": `ADDRESS: ${vendor.address || ''}`,
    "Debit (Purchases ₹)": "",
    "Credit (Payments ₹)": "",
    "Running Balance (₹)": ""
  });
  rows.push({
    "Date": "",
    "Voucher Type": "",
    "Ref / Invoice No": "",
    "Particulars": "",
    "Debit (Purchases ₹)": "",
    "Credit (Payments ₹)": "",
    "Running Balance (₹)": ""
  });

  transactions.forEach(t => {
    rows.push({
      "Date": t.date,
      "Voucher Type": t.type,
      "Ref / Invoice No": t.ref,
      "Particulars": t.description,
      "Debit (Purchases ₹)": t.debit > 0 ? Number(t.debit.toFixed(2)) : 0,
      "Credit (Payments ₹)": t.credit > 0 ? Number(t.credit.toFixed(2)) : 0,
      "Running Balance (₹)": Number(t.balance.toFixed(2))
    });
  });

  rows.push({
    "Date": "TOTALS",
    "Voucher Type": "",
    "Ref / Invoice No": "",
    "Particulars": `Net Balance Due: ₹${(summary?.balance || 0).toFixed(2)}`,
    "Debit (Purchases ₹)": Number((summary?.billed || 0).toFixed(2)),
    "Credit (Payments ₹)": Number((summary?.paid || 0).toFixed(2)),
    "Running Balance (₹)": Number((summary?.balance || 0).toFixed(2))
  });

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, "Ledger");
  const filename = `Ledger_${(vendor.name || 'Vendor').replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().slice(0, 10)}.xlsx`;
  XLSX.writeFile(wb, filename);
  return true;
}

// Export Vendor Spending Distribution from Dashboard to Excel
export function exportVendorSpendingToExcel(vendorSpendData) {
  if (!vendorSpendData || vendorSpendData.length === 0) return false;

  const rows = vendorSpendData.map((v, i) => ({
    "Rank": i + 1,
    "Vendor Name": v.name,
    "Total Purchases (₹)": Number((v.amount || 0).toFixed(2)),
    "Spending Share (%)": Number((v.percent || 0).toFixed(2)) + "%",
    "Bills Count": v.billsCount || 0
  }));

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, "Vendor Share");
  XLSX.writeFile(wb, `Vendor_Spend_Distribution_${new Date().toISOString().slice(0, 10)}.xlsx`);
  return true;
}

// Export Vendors Master Directory to Excel
export function exportVendorsToExcel(vendors) {
  if (!vendors || vendors.length === 0) return false;

  const data = vendors.map((v, i) => ({
    "S.No": i + 1,
    "Vendor Name": v.name || '',
    "GSTIN": v.gstin || 'UNREGISTERED',
    "Phone": v.phone || '',
    "Email": v.email || '',
    "Address": v.address || '',
    "Opening Balance (₹)": parseFloat(v.openingBalance) || 0,
    "Balance Type": (v.openingBalanceType || 'payable').toUpperCase(),
    "Balance As Of": v.openingBalanceDate || '',
    "State": v.state || '',
    "Pincode": v.pincode || '',
    "Status": v.status || 'Active'
  }));

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(data);
  XLSX.utils.book_append_sheet(wb, ws, "Vendors_Directory");
  XLSX.writeFile(wb, `Vendors_Directory_${new Date().toISOString().slice(0, 10)}.xlsx`);
  return true;
}

// Download PDF from DOM element
export async function downloadElementAsPDF(element, filename = "document.pdf") {
  if (!element) return false;
  try {
    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff'
    });
    
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
    
    pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
    pdf.save(filename);
    return true;
  } catch (err) {
    console.error("PDF generation failed:", err);
    return false;
  }
}
