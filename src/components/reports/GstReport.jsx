import React, { useState, useMemo, useEffect } from 'react';
import { useData } from '../../context/DataContext';
import { useToast } from '../../context/ToastContext';
import { formatCurrency, formatDate, formatNumber } from '../../utils/formatters';
import * as XLSX from 'xlsx';
import { 
  FileSpreadsheet, 
  Download, 
  Calendar, 
  CheckCircle2, 
  AlertCircle, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Scale, 
  ShieldAlert, 
  Sparkles, 
  Filter, 
  Search, 
  TrendingUp, 
  FileText, 
  Building2, 
  CreditCard,
  Layers,
  ArrowRight
} from 'lucide-react';

// Helper to extract YYYY-MM safely from diverse date strings
function getYearMonth(dateStr) {
  if (!dateStr) return '';
  const str = String(dateStr).trim();
  const isoMatch = str.match(/^(\d{4})-(\d{1,2})/);
  if (isoMatch) {
    return `${isoMatch[1]}-${String(isoMatch[2]).padStart(2, '0')}`;
  }
  const dmyMatch = str.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})/);
  if (dmyMatch) {
    let d = parseInt(dmyMatch[1], 10);
    let m = parseInt(dmyMatch[2], 10);
    let y = dmyMatch[3];
    if (y.length === 2) y = '20' + y;
    if (m > 12 && d <= 12) {
      m = d;
    }
    return `${y}-${String(m).padStart(2, '0')}`;
  }
  return '';
}

export default function GstReport({ initialReport = 'gstr1', onSwitchReport }) {
  const { bills, sales, assets = [] } = useData();
  const { showToast } = useToast();

  // Active sub-report: 'gstr1' | 'gstr2b' | 'gstr3b'
  const [activeReport, setActiveReport] = useState(initialReport);

  // Sync with prop when sidebar changes tab
  useEffect(() => {
    if (initialReport && ['gstr1', 'gstr2b', 'gstr3b'].includes(initialReport)) {
      setActiveReport(initialReport);
    }
  }, [initialReport]);

  const handleTabSelect = (tab) => {
    setActiveReport(tab);
    if (onSwitchReport) {
      onSwitchReport(tab);
    }
  };

  // Month extraction from Sales, Purchase Bills, and Asset GST Bills
  const availableMonths = useMemo(() => {
    const set = new Set();
    bills.forEach(b => {
      const ym = getYearMonth(b.date);
      if (ym) set.add(ym);
    });
    sales.forEach(s => {
      const ym = getYearMonth(s.orderDate || s.invDate || s.date);
      if (ym) set.add(ym);
    });
    (assets || []).forEach(a => {
      const ym = getYearMonth(a.date);
      if (ym) set.add(ym);
    });
    return Array.from(set).sort().reverse();
  }, [bills, sales, assets]);

  // Selected return period (defaults to 2026-09 if present, or first available)
  const [selectedMonth, setSelectedMonth] = useState(() => {
    return '2026-09';
  });

  // Additional Filters for GSTR-1
  const [gstr1SupplyType, setGstr1SupplyType] = useState('ALL'); // 'ALL' | 'B2B' | 'B2C'
  const [searchQuery, setSearchQuery] = useState('');
  const [branchFilter, setBranchFilter] = useState('ALL');

  // --- 1. PROCESSED GSTR-1 OUTWARD SUPPLIES DATASET ---
  const gstr1Dataset = useMemo(() => {
    return sales.map(s => {
      const dateStr = s.orderDate || s.invDate || s.date || '';
      const ym = getYearMonth(dateStr);
      const finalAmount = parseFloat(s.finalAmount !== undefined ? s.finalAmount : s.subtotal) || 0;
      const gstRate = parseFloat(s.gstRate) || 18;
      
      let gstAmount = parseFloat(s.gstAmount) || 0;
      let taxableAmount = parseFloat(s.taxableAmount) || 0;

      if ((!gstAmount || gstAmount === 0) && finalAmount > 0) {
        gstAmount = Math.round(((finalAmount * gstRate) / (100 + gstRate)) * 100) / 100;
        taxableAmount = Math.round((finalAmount - gstAmount) * 100) / 100;
      } else if (!taxableAmount && finalAmount > 0) {
        taxableAmount = Math.round((finalAmount - gstAmount) * 100) / 100;
      }

      const gstin = (s.gstin || '').trim().toUpperCase();
      const isB2B = Boolean(gstin && gstin.length >= 10);
      const isInterState = Boolean(s.isInterState || (gstin.length === 15 && !gstin.startsWith('33')));

      const igst = isInterState ? gstAmount : 0;
      const cgst = isInterState ? 0 : Math.round((gstAmount / 2) * 100) / 100;
      const sgst = isInterState ? 0 : Math.round((gstAmount - cgst) * 100) / 100;

      return {
        id: s.id,
        date: dateStr,
        yearMonth: ym,
        invoiceNo: s.invoiceNo || s.estNo || s.orderFormNo || s.id,
        isTaxInvoice: Boolean(s.invoiceNo || s.isInvoice),
        customerName: s.customerName || 'Cash Retail Customer',
        gstin: gstin || '',
        isB2B,
        branch: s.branch || 'KLK',
        department: s.department || 'GENERAL',
        taxableAmount,
        gstRate,
        cgst,
        sgst,
        igst,
        gstAmount,
        finalAmount,
        isInterState
      };
    });
  }, [sales]);

  // Filtered GSTR-1 records
  const filteredGstr1 = useMemo(() => {
    return gstr1Dataset.filter(s => {
      if (selectedMonth && s.yearMonth !== selectedMonth) return false;
      if (branchFilter !== 'ALL' && s.branch !== branchFilter) return false;
      if (gstr1SupplyType === 'B2B' && !s.isB2B) return false;
      if (gstr1SupplyType === 'B2C' && s.isB2B) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = s.customerName.toLowerCase().includes(q);
        const matchInv = s.invoiceNo.toLowerCase().includes(q);
        const matchGstin = s.gstin.toLowerCase().includes(q);
        if (!matchName && !matchInv && !matchGstin) return false;
      }
      return true;
    });
  }, [gstr1Dataset, selectedMonth, branchFilter, gstr1SupplyType, searchQuery]);

  // GSTR-1 Aggregations
  const gstr1Totals = useMemo(() => {
    let taxable = 0;
    let cgst = 0;
    let sgst = 0;
    let igst = 0;
    let totalTax = 0;
    let invoiceTotal = 0;
    let b2bCount = 0;
    let b2cCount = 0;

    filteredGstr1.forEach(s => {
      taxable += s.taxableAmount;
      cgst += s.cgst;
      sgst += s.sgst;
      igst += s.igst;
      totalTax += s.gstAmount;
      invoiceTotal += s.finalAmount;
      if (s.isB2B) b2bCount++;
      else b2cCount++;
    });

    return {
      count: filteredGstr1.length,
      b2bCount,
      b2cCount,
      taxable: Math.round(taxable * 100) / 100,
      cgst: Math.round(cgst * 100) / 100,
      sgst: Math.round(sgst * 100) / 100,
      igst: Math.round(igst * 100) / 100,
      totalTax: Math.round(totalTax * 100) / 100,
      invoiceTotal: Math.round(invoiceTotal * 100) / 100
    };
  }, [filteredGstr1]);

  // --- 2. PROCESSED GSTR-2B INWARD ITC DATASET (Purchases + Capital Goods Assets) ---
  const gstr2bDataset = useMemo(() => {
    // 1. Inward Purchase Bills
    const purchaseBills = bills.filter(b => {
      const isRegistered = b.isGst && parseFloat(b.taxAmount || 0) > 0;
      return isRegistered;
    }).map(b => {
      const ym = getYearMonth(b.date);
      const taxable = parseFloat(b.taxableBase || b.subtotal) || 0;
      const cgst = parseFloat(b.cgst) || 0;
      const sgst = parseFloat(b.sgst) || 0;
      const igst = parseFloat(b.igst) || 0;
      const totalTax = parseFloat(b.taxAmount) || (cgst + sgst + igst);
      const grandTotal = parseFloat(b.grandTotal) || (taxable + totalTax);

      return {
        id: b.id,
        date: b.date,
        yearMonth: ym,
        gstin: b.gstin || '',
        vendorName: b.vendorName || 'Registered Supplier',
        invoiceNo: b.invoiceNo || '-',
        taxable,
        taxRate: parseFloat(b.taxRate) || 0,
        cgst,
        sgst,
        igst,
        totalTax,
        grandTotal,
        isInterState: Boolean(b.isInterState),
        supplyType: 'Inputs / Services',
        isCapitalGoods: false
      };
    });

    // 2. Inward Asset GST Bills (Capital Goods ITC for GSTR-2B Table 4(A)(5))
    const assetBills = (assets || []).filter(a => {
      const isRegistered = a.isGst && (parseFloat(a.totalTax || a.taxAmount || 0) > 0 || parseFloat(a.taxRate || 0) > 0);
      return isRegistered;
    }).map(a => {
      const ym = getYearMonth(a.date);
      const taxable = parseFloat(a.taxableAmount !== undefined ? a.taxableAmount : (a.value || a.rate || 0)) || 0;
      const cgst = parseFloat(a.cgst) || 0;
      const sgst = parseFloat(a.sgst) || 0;
      const igst = parseFloat(a.igst) || 0;
      const totalTax = parseFloat(a.totalTax !== undefined ? a.totalTax : a.taxAmount) || (cgst + sgst + igst);
      const grandTotal = parseFloat(a.grandTotal !== undefined ? a.grandTotal : (taxable + totalTax)) || (taxable + totalTax);

      return {
        id: a.id,
        date: a.date,
        yearMonth: ym,
        gstin: a.vendorGstin || a.gstin || '',
        vendorName: a.vendorName || 'Capital Goods Supplier',
        invoiceNo: a.invoiceNo || a.voucherNo || '-',
        taxable,
        taxRate: parseFloat(a.taxRate) || 0,
        cgst,
        sgst,
        igst,
        totalTax,
        grandTotal,
        isInterState: Boolean(a.isInterState),
        supplyType: 'Capital Goods (Asset)',
        assetName: a.name || 'Fixed Asset',
        isCapitalGoods: true
      };
    });

    return [...purchaseBills, ...assetBills].sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
  }, [bills, assets]);

  // Filtered GSTR-2B records
  const filteredGstr2b = useMemo(() => {
    return gstr2bDataset.filter(b => {
      if (selectedMonth && b.yearMonth !== selectedMonth) return false;
      if (searchQuery.trim() && activeReport === 'gstr2b') {
        const q = searchQuery.toLowerCase();
        const matchName = b.vendorName.toLowerCase().includes(q);
        const matchInv = b.invoiceNo.toLowerCase().includes(q);
        const matchGstin = b.gstin.toLowerCase().includes(q);
        if (!matchName && !matchInv && !matchGstin) return false;
      }
      return true;
    });
  }, [gstr2bDataset, selectedMonth, searchQuery, activeReport]);

  // GSTR-2B Aggregations
  const gstr2bTotals = useMemo(() => {
    let taxable = 0;
    let cgst = 0;
    let sgst = 0;
    let igst = 0;
    let totalTax = 0;
    let invoiceTotal = 0;

    filteredGstr2b.forEach(b => {
      taxable += b.taxable;
      cgst += b.cgst;
      sgst += b.sgst;
      igst += b.igst;
      totalTax += b.totalTax;
      invoiceTotal += b.grandTotal;
    });

    return {
      count: filteredGstr2b.length,
      taxable: Math.round(taxable * 100) / 100,
      cgst: Math.round(cgst * 100) / 100,
      sgst: Math.round(sgst * 100) / 100,
      igst: Math.round(igst * 100) / 100,
      totalTax: Math.round(totalTax * 100) / 100,
      invoiceTotal: Math.round(invoiceTotal * 100) / 100
    };
  }, [filteredGstr2b]);

  // --- 3. CONSOLIDATED GSTR-3B RETURN COMPUTATION ---
  // Uses month-scoped datasets without text search filter
  const gstr3bComputation = useMemo(() => {
    // 1. Outward Supplies for Month
    const monthSales = gstr1Dataset.filter(s => !selectedMonth || s.yearMonth === selectedMonth);
    let outTaxable = 0;
    let outCgst = 0;
    let outSgst = 0;
    let outIgst = 0;
    let outTotalTax = 0;

    monthSales.forEach(s => {
      outTaxable += s.taxableAmount;
      outCgst += s.cgst;
      outSgst += s.sgst;
      outIgst += s.igst;
      outTotalTax += s.gstAmount;
    });

    // 2. Inward Eligible ITC for Month
    const monthBills = gstr2bDataset.filter(b => !selectedMonth || b.yearMonth === selectedMonth);
    let inTaxable = 0;
    let inCgst = 0;
    let inSgst = 0;
    let inIgst = 0;
    let inTotalTax = 0;

    monthBills.forEach(b => {
      inTaxable += b.taxable;
      inCgst += b.cgst;
      inSgst += b.sgst;
      inIgst += b.igst;
      inTotalTax += b.totalTax;
    });

    // 3. Tax Offset Matrix
    // IGST Offset
    const igstUtilized = Math.min(outIgst, inIgst);
    const igstCash = Math.max(0, outIgst - inIgst);
    const igstBalance = Math.max(0, inIgst - outIgst);

    // CGST Offset
    const cgstUtilized = Math.min(outCgst, inCgst);
    const cgstCash = Math.max(0, outCgst - inCgst);
    const cgstBalance = Math.max(0, inCgst - outCgst);

    // SGST Offset
    const sgstUtilized = Math.min(outSgst, inSgst);
    const sgstCash = Math.max(0, outSgst - inSgst);
    const sgstBalance = Math.max(0, inSgst - outSgst);

    const totalCashPayable = igstCash + cgstCash + sgstCash;
    const totalItcCarryForward = igstBalance + cgstBalance + sgstBalance;
    const totalItcUtilized = igstUtilized + cgstUtilized + sgstUtilized;

    return {
      table31: {
        taxable: Math.round(outTaxable * 100) / 100,
        cgst: Math.round(outCgst * 100) / 100,
        sgst: Math.round(outSgst * 100) / 100,
        igst: Math.round(outIgst * 100) / 100,
        total: Math.round(outTotalTax * 100) / 100,
        salesCount: monthSales.length
      },
      table4: {
        taxable: Math.round(inTaxable * 100) / 100,
        cgst: Math.round(inCgst * 100) / 100,
        sgst: Math.round(inSgst * 100) / 100,
        igst: Math.round(inIgst * 100) / 100,
        total: Math.round(inTotalTax * 100) / 100,
        billsCount: monthBills.length
      },
      table61: {
        igst: {
          liability: Math.round(outIgst * 100) / 100,
          itcAvailable: Math.round(inIgst * 100) / 100,
          utilized: Math.round(igstUtilized * 100) / 100,
          cash: Math.round(igstCash * 100) / 100,
          balance: Math.round(igstBalance * 100) / 100
        },
        cgst: {
          liability: Math.round(outCgst * 100) / 100,
          itcAvailable: Math.round(inCgst * 100) / 100,
          utilized: Math.round(cgstUtilized * 100) / 100,
          cash: Math.round(cgstCash * 100) / 100,
          balance: Math.round(cgstBalance * 100) / 100
        },
        sgst: {
          liability: Math.round(outSgst * 100) / 100,
          itcAvailable: Math.round(inSgst * 100) / 100,
          utilized: Math.round(sgstUtilized * 100) / 100,
          cash: Math.round(sgstCash * 100) / 100,
          balance: Math.round(sgstBalance * 100) / 100
        },
        totalCashPayable: Math.round(totalCashPayable * 100) / 100,
        totalItcUtilized: Math.round(totalItcUtilized * 100) / 100,
        totalItcCarryForward: Math.round(totalItcCarryForward * 100) / 100
      }
    };
  }, [gstr1Dataset, gstr2bDataset, selectedMonth]);

  // --- EXCEL EXPORTERS ---

  // Export GSTR-1
  const handleExportGstr1Excel = () => {
    if (filteredGstr1.length === 0) {
      showToast('No GSTR-1 sales records found for this period', 'error');
      return;
    }

    const b2bRows = filteredGstr1.filter(s => s.isB2B).map(s => ({
      "GSTIN/UIN of Recipient": s.gstin,
      "Receiver Name": s.customerName,
      "Invoice Number": s.invoiceNo,
      "Invoice Date": s.date,
      "Invoice Value (₹)": s.finalAmount,
      "Place of Supply": s.isInterState ? "Other State" : "33-Tamil Nadu",
      "Reverse Charge": "N",
      "Invoice Type": "Regular",
      "Rate (%)": s.gstRate,
      "Taxable Value (₹)": s.taxableAmount,
      "Integrated Tax (₹)": s.igst,
      "Central Tax (₹)": s.cgst,
      "State Tax (₹)": s.sgst
    }));

    const allSalesRows = filteredGstr1.map(s => ({
      "Date": s.date,
      "Invoice / Order #": s.invoiceNo,
      "Customer Name": s.customerName,
      "Customer GSTIN": s.gstin || "URP (Unregistered)",
      "Supply Type": s.isB2B ? "B2B" : "B2C",
      "Branch": s.branch,
      "Department": s.department,
      "Taxable Value (₹)": s.taxableAmount,
      "GST Rate (%)": s.gstRate,
      "CGST (₹)": s.cgst,
      "SGST (₹)": s.sgst,
      "IGST (₹)": s.igst,
      "Total GST (₹)": s.gstAmount,
      "Grand Total (₹)": s.finalAmount
    }));

    const wb = XLSX.utils.book_new();
    const wsAll = XLSX.utils.json_to_sheet(allSalesRows);
    XLSX.utils.book_append_sheet(wb, wsAll, "GSTR-1 Outward Supplies");

    if (b2bRows.length > 0) {
      const wsB2B = XLSX.utils.json_to_sheet(b2bRows);
      XLSX.utils.book_append_sheet(wb, wsB2B, "B2B Invoices");
    }

    XLSX.writeFile(wb, `GSTR1_Outward_Supplies_${selectedMonth || 'All'}.xlsx`);
    showToast('GSTR-1 Outward Supplies Excel exported!', 'success');
  };

  // Export GSTR-2B
  const handleExportGstr2bExcel = () => {
    if (filteredGstr2b.length === 0) {
      showToast('No GSTR-2B purchase records found for this period', 'error');
      return;
    }

    const rows = filteredGstr2b.map(b => ({
      "Supplier GSTIN": b.gstin,
      "Supplier Legal Name": b.vendorName,
      "Invoice Number": b.invoiceNo,
      "Invoice Date": b.date,
      "ITC Nature / Category": b.isCapitalGoods ? 'Capital Goods' : 'Inputs / Services',
      "Asset / Description": b.assetName || 'General Inputs',
      "Invoice Value (₹)": b.grandTotal,
      "Taxable Value (₹)": b.taxable,
      "GST Rate (%)": b.taxRate,
      "Integrated Tax (IGST ₹)": b.igst,
      "Central Tax (CGST ₹)": b.cgst,
      "State Tax (SGST ₹)": b.sgst,
      "Total ITC Claimable (₹)": b.totalTax,
      "Supply Type": b.isInterState ? 'Inter-State' : 'Intra-State'
    }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, "GSTR-2B ITC");
    XLSX.writeFile(wb, `GSTR2B_Inward_Supplies_${selectedMonth || 'All'}.xlsx`);
    showToast('GSTR-2B Input Tax Credit Excel exported!', 'success');
  };

  // Export GSTR-3B
  const handleExportGstr3bExcel = () => {
    const { table31, table4, table61 } = gstr3bComputation;

    const t31Rows = [
      {
        "Nature of Supplies": "3.1(a) Outward taxable supplies (other than zero rated, nil rated and exempted)",
        "Total Taxable Value (₹)": table31.taxable,
        "Integrated Tax (₹)": table31.igst,
        "Central Tax (₹)": table31.cgst,
        "State/UT Tax (₹)": table31.sgst,
        "Cess (₹)": 0
      }
    ];

    const t4Rows = [
      {
        "Details": "4(A)(5) All other ITC (Inward supplies from registered persons)",
        "Integrated Tax (₹)": table4.igst,
        "Central Tax (₹)": table4.cgst,
        "State/UT Tax (₹)": table4.sgst,
        "Cess (₹)": 0
      }
    ];

    const t61Rows = [
      {
        "Tax Head": "Integrated Tax (IGST)",
        "Tax Payable (Output) (₹)": table61.igst.liability,
        "Paid Through ITC (₹)": table61.igst.utilized,
        "Tax Paid in Cash (PMT-06) (₹)": table61.igst.cash,
        "ITC Carried Forward (₹)": table61.igst.balance
      },
      {
        "Tax Head": "Central Tax (CGST)",
        "Tax Payable (Output) (₹)": table61.cgst.liability,
        "Paid Through ITC (₹)": table61.cgst.utilized,
        "Tax Paid in Cash (PMT-06) (₹)": table61.cgst.cash,
        "ITC Carried Forward (₹)": table61.cgst.balance
      },
      {
        "Tax Head": "State/UT Tax (SGST)",
        "Tax Payable (Output) (₹)": table61.sgst.liability,
        "Paid Through ITC (₹)": table61.sgst.utilized,
        "Tax Paid in Cash (PMT-06) (₹)": table61.sgst.cash,
        "ITC Carried Forward (₹)": table61.sgst.balance
      },
      {
        "Tax Head": "TOTAL CONSOLIDATED",
        "Tax Payable (Output) (₹)": table31.total,
        "Paid Through ITC (₹)": table61.totalItcUtilized,
        "Tax Paid in Cash (PMT-06) (₹)": table61.totalCashPayable,
        "ITC Carried Forward (₹)": table61.totalItcCarryForward
      }
    ];

    const wb = XLSX.utils.book_new();
    const ws31 = XLSX.utils.json_to_sheet(t31Rows);
    const ws4 = XLSX.utils.json_to_sheet(t4Rows);
    const ws61 = XLSX.utils.json_to_sheet(t61Rows);

    XLSX.utils.book_append_sheet(wb, ws31, "Table 3.1 Outward Supplies");
    XLSX.utils.book_append_sheet(wb, ws4, "Table 4 Eligible ITC");
    XLSX.utils.book_append_sheet(wb, ws61, "Table 6.1 Tax Payment");

    XLSX.writeFile(wb, `GSTR3B_Monthly_Return_${selectedMonth || 'All'}.xlsx`);
    showToast('GSTR-3B Monthly Return Excel exported!', 'success');
  };

  const getMonthLabel = (m) => {
    if (!m) return 'All Periods';
    try {
      const d = new Date(m + '-01');
      return d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
    } catch (e) {
      return m;
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* MASTER TOP CONTROL BAR */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-rose-100 text-rose-800">
                GST Returns Center
              </span>
              <span className="text-xs text-slate-400 font-medium">|</span>
              <span className="text-xs font-semibold text-slate-600">Period: {getMonthLabel(selectedMonth)}</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight mt-1">
              Master GST Returns & ITC Filing Center
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Statutory reconciliation between Outward Supplies (GSTR-1), Input Tax Credit (GSTR-2B), and Monthly Liability (GSTR-3B)
            </p>
          </div>

          {/* Month Selector & Global Export */}
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5">
              <Calendar className="w-4 h-4 text-slate-500" />
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="bg-transparent text-xs font-bold text-slate-800 focus:outline-none cursor-pointer"
              >
                <option value="">All Return Periods</option>
                {availableMonths.map(m => (
                  <option key={m} value={m}>{getMonthLabel(m)}</option>
                ))}
              </select>
            </div>

            {/* Quick Export for Current Tab */}
            {activeReport === 'gstr1' && (
              <button
                onClick={handleExportGstr1Excel}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-sm transition-colors"
              >
                <Download className="w-3.5 h-3.5" /> GSTR-1 Excel
              </button>
            )}

            {activeReport === 'gstr2b' && (
              <button
                onClick={handleExportGstr2bExcel}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm transition-colors"
              >
                <Download className="w-3.5 h-3.5" /> GSTR-2B Excel
              </button>
            )}

            {activeReport === 'gstr3b' && (
              <button
                onClick={handleExportGstr3bExcel}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm transition-colors"
              >
                <Download className="w-3.5 h-3.5" /> GSTR-3B Excel
              </button>
            )}
          </div>
        </div>

        {/* MASTER SEGMENTED TAB SWITCHER */}
        <div className="mt-5 pt-4 border-t border-slate-100 flex flex-wrap gap-2">
          <button
            onClick={() => handleTabSelect('gstr1')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all shadow-sm ${
              activeReport === 'gstr1'
                ? 'bg-rose-600 text-white ring-2 ring-rose-600/30'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            <ArrowUpRight className="w-4 h-4" />
            <span>GSTR-1</span>
            <span className="text-[11px] opacity-80 font-normal hidden sm:inline">(Outward Supplies / Sales)</span>
            <span className={`ml-1 text-[10px] px-1.5 py-0.5 rounded-md font-extrabold ${
              activeReport === 'gstr1' ? 'bg-rose-700 text-white' : 'bg-slate-200 text-slate-700'
            }`}>
              {filteredGstr1.length}
            </span>
          </button>

          <button
            onClick={() => handleTabSelect('gstr2b')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all shadow-sm ${
              activeReport === 'gstr2b'
                ? 'bg-emerald-600 text-white ring-2 ring-emerald-600/30'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            <ArrowDownLeft className="w-4 h-4" />
            <span>GSTR-2B</span>
            <span className="text-[11px] opacity-80 font-normal hidden sm:inline">(Inward Supplies / Purchase ITC)</span>
            <span className={`ml-1 text-[10px] px-1.5 py-0.5 rounded-md font-extrabold ${
              activeReport === 'gstr2b' ? 'bg-emerald-700 text-white' : 'bg-slate-200 text-slate-700'
            }`}>
              {filteredGstr2b.length}
            </span>
          </button>

          <button
            onClick={() => handleTabSelect('gstr3b')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all shadow-sm ${
              activeReport === 'gstr3b'
                ? 'bg-indigo-600 text-white ring-2 ring-indigo-600/30'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            <Scale className="w-4 h-4" />
            <span>GSTR-3B</span>
            <span className="text-[11px] opacity-80 font-normal hidden sm:inline">(Consolidated Monthly Return)</span>
            <span className={`ml-1 text-[10px] px-1.5 py-0.5 rounded-md font-extrabold ${
              gstr3bComputation.table61.totalCashPayable > 0 
                ? 'bg-amber-100 text-amber-800' 
                : 'bg-emerald-100 text-emerald-800'
            }`}>
              {gstr3bComputation.table61.totalCashPayable > 0 ? 'Cash Due' : 'ITC Surplus'}
            </span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 1. GSTR-1 OUTWARD SUPPLIES & TAX LIABILITY VIEW                           */}
      {/* ========================================================================= */}
      {activeReport === 'gstr1' && (
        <div className="space-y-6">
          {/* KPI Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Outward Orders / Invoices</p>
                <TrendingUp className="w-4 h-4 text-rose-500" />
              </div>
              <p className="text-xl sm:text-2xl font-black text-slate-900 mt-1">
                {gstr1Totals.count}
              </p>
              <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-500 font-medium">
                <span className="text-rose-600 font-bold">{gstr1Totals.b2bCount} B2B</span>
                <span>•</span>
                <span className="text-slate-600">{gstr1Totals.b2cCount} B2C (Retail)</span>
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Outward Taxable Value</p>
                <Layers className="w-4 h-4 text-slate-400" />
              </div>
              <p className="text-xl sm:text-2xl font-black text-slate-900 mt-1">
                {formatCurrency(gstr1Totals.taxable)}
              </p>
              <p className="text-[11px] text-slate-500 font-medium mt-1">
                Total Value: <span className="font-bold text-slate-800">{formatCurrency(gstr1Totals.invoiceTotal)}</span>
              </p>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Central + State Tax (CGST + SGST)</p>
                <ShieldAlert className="w-4 h-4 text-indigo-500" />
              </div>
              <p className="text-xl sm:text-2xl font-black text-indigo-600 mt-1">
                {formatCurrency(gstr1Totals.cgst + gstr1Totals.sgst)}
              </p>
              <div className="flex items-center gap-3 mt-1 text-[11px] text-slate-500 font-mono">
                <span>C: {formatCurrency(gstr1Totals.cgst)}</span>
                <span>S: {formatCurrency(gstr1Totals.sgst)}</span>
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Output GST Liability</p>
                <ArrowUpRight className="w-4 h-4 text-rose-600" />
              </div>
              <p className="text-xl sm:text-2xl font-black text-rose-600 mt-1">
                {formatCurrency(gstr1Totals.totalTax)}
              </p>
              <p className="text-[11px] text-slate-500 font-medium mt-1">
                IGST: <span className="font-mono font-bold text-slate-800">{formatCurrency(gstr1Totals.igst)}</span>
              </p>
            </div>
          </div>

          {/* Sub-Filters: B2B vs B2C, Branch, Search */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex rounded-xl bg-slate-100 p-1 border border-slate-200 text-xs font-bold">
                <button
                  onClick={() => setGstr1SupplyType('ALL')}
                  className={`px-3 py-1.5 rounded-lg transition-all ${
                    gstr1SupplyType === 'ALL' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  All Supplies ({gstr1Dataset.length})
                </button>
                <button
                  onClick={() => setGstr1SupplyType('B2B')}
                  className={`px-3 py-1.5 rounded-lg transition-all ${
                    gstr1SupplyType === 'B2B' ? 'bg-white text-rose-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  B2B Registered ({gstr1Totals.b2bCount})
                </button>
                <button
                  onClick={() => setGstr1SupplyType('B2C')}
                  className={`px-3 py-1.5 rounded-lg transition-all ${
                    gstr1SupplyType === 'B2C' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  B2C Retail ({gstr1Totals.b2cCount})
                </button>
              </div>

              {/* Branch Filter */}
              <select
                value={branchFilter}
                onChange={(e) => setBranchFilter(e.target.value)}
                className="py-1.5 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none"
              >
                <option value="ALL">All Branches</option>
                <option value="KLK">KLK Branch</option>
                <option value="RMD">RMD Branch</option>
              </select>
            </div>

            {/* Search Box */}
            <div className="relative w-full md:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search customer, GSTIN, invoice..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-rose-500"
              />
            </div>
          </div>

          {/* Detailed Outward Supplies Table */}
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <span>Outward Supply Transactions</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-slate-200 font-mono font-bold text-slate-700">
                    {filteredGstr1.length} Records
                  </span>
                </h3>
                <p className="text-xs text-slate-500">
                  Tax invoices and sales orders with 18% inclusive GST separated for GSTR-1 Table 4 (B2B) & Table 7 (B2C)
                </p>
              </div>
              <button
                onClick={handleExportGstr1Excel}
                className="text-xs font-semibold text-rose-600 hover:text-rose-700 flex items-center gap-1"
              >
                <Download className="w-3.5 h-3.5" /> Export Table
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse whitespace-nowrap text-xs">
                <thead>
                  <tr className="bg-slate-100/80 text-slate-600 font-bold uppercase tracking-wider border-b border-slate-200">
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Invoice / Order #</th>
                    <th className="px-4 py-3">Customer Legal Name</th>
                    <th className="px-4 py-3">Customer GSTIN</th>
                    <th className="px-4 py-3">Branch</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3 text-right">Taxable (₹)</th>
                    <th className="px-4 py-3 text-right">Rate</th>
                    <th className="px-4 py-3 text-right">CGST (₹)</th>
                    <th className="px-4 py-3 text-right">SGST (₹)</th>
                    <th className="px-4 py-3 text-right">IGST (₹)</th>
                    <th className="px-4 py-3 text-right font-extrabold text-slate-900">Total Invoice (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {filteredGstr1.length === 0 ? (
                    <tr>
                      <td colSpan="12" className="text-center py-12 text-slate-400">
                        No sales transactions found matching the selected period and criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredGstr1.slice(0, 100).map(s => (
                      <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-2.5 font-mono text-slate-600">{formatDate(s.date)}</td>
                        <td className="px-4 py-2.5 font-mono font-bold text-slate-900">{s.invoiceNo}</td>
                        <td className="px-4 py-2.5 font-medium text-slate-800 max-w-[180px] truncate">{s.customerName}</td>
                        <td className="px-4 py-2.5 font-mono font-semibold text-slate-700">
                          {s.gstin ? (
                            <span className="px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200">
                              {s.gstin}
                            </span>
                          ) : (
                            <span className="text-slate-400">URP</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            s.branch === 'KLK' ? 'bg-blue-50 text-blue-700' : 'bg-emerald-50 text-emerald-700'
                          }`}>
                            {s.branch}
                          </span>
                        </td>
                        <td className="px-4 py-2.5">
                          <span className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded ${
                            s.isB2B ? 'bg-amber-100 text-amber-900' : 'bg-slate-100 text-slate-600'
                          }`}>
                            {s.isB2B ? 'B2B' : 'B2C'}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono font-medium text-slate-800">
                          {formatCurrency(s.taxableAmount)}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono">{s.gstRate}%</td>
                        <td className="px-4 py-2.5 text-right font-mono text-slate-600">{formatCurrency(s.cgst)}</td>
                        <td className="px-4 py-2.5 text-right font-mono text-slate-600">{formatCurrency(s.sgst)}</td>
                        <td className="px-4 py-2.5 text-right font-mono text-slate-600">{formatCurrency(s.igst)}</td>
                        <td className="px-4 py-2.5 text-right font-mono font-extrabold text-slate-900">
                          {formatCurrency(s.finalAmount)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {filteredGstr1.length > 100 && (
              <div className="p-3 bg-slate-50 border-t border-slate-200 text-center text-xs text-slate-500 font-medium">
                Showing first 100 of {filteredGstr1.length} sales entries. Download Excel to inspect full dataset.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. GSTR-2B INWARD SUPPLIES & INPUT TAX CREDIT VIEW                        */}
      {/* ========================================================================= */}
      {activeReport === 'gstr2b' && (
        <div className="space-y-6">
          {/* Summary KPI Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Eligible Invoices</p>
                <FileText className="w-4 h-4 text-emerald-500" />
              </div>
              <p className="text-xl sm:text-2xl font-black text-slate-900 mt-1">{gstr2bTotals.count} Inward Bills</p>
              <p className="text-[11px] text-slate-500 font-medium mt-1">From GST Registered Vendors</p>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Taxable Value</p>
                <Layers className="w-4 h-4 text-slate-400" />
              </div>
              <p className="text-xl sm:text-2xl font-black text-slate-900 mt-1">{formatCurrency(gstr2bTotals.taxable)}</p>
              <p className="text-[11px] text-slate-500 font-medium mt-1">
                Bill Value: <span className="font-bold text-slate-800">{formatCurrency(gstr2bTotals.invoiceTotal)}</span>
              </p>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Central + State Tax (CGST+SGST)</p>
                <ShieldAlert className="w-4 h-4 text-brand-500" />
              </div>
              <p className="text-xl sm:text-2xl font-black text-brand-600 mt-1">
                {formatCurrency(gstr2bTotals.cgst + gstr2bTotals.sgst)}
              </p>
              <div className="flex items-center gap-3 mt-1 text-[11px] text-slate-500 font-mono">
                <span>C: {formatCurrency(gstr2bTotals.cgst)}</span>
                <span>S: {formatCurrency(gstr2bTotals.sgst)}</span>
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Input Tax Credit (ITC)</p>
                <ArrowDownLeft className="w-4 h-4 text-emerald-600" />
              </div>
              <p className="text-xl sm:text-2xl font-black text-emerald-600 mt-1">{formatCurrency(gstr2bTotals.totalTax)}</p>
              <p className="text-[11px] text-slate-500 font-medium mt-1">
                IGST: <span className="font-mono font-bold text-slate-800">{formatCurrency(gstr2bTotals.igst)}</span>
              </p>
            </div>
          </div>

          {/* Search Box */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between gap-4">
            <div className="relative w-full max-w-sm">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search vendor, supplier GSTIN, invoice #..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>
            <button
              onClick={handleExportGstr2bExcel}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors"
            >
              <Download className="w-3.5 h-3.5" /> Download GSTR-2B Excel
            </button>
          </div>

          {/* Tax Breakdown Table */}
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
              <div>
                <h3 className="text-sm font-bold text-slate-900">B2B Inward Supply Transactions</h3>
                <p className="text-xs text-slate-500">Auto-populated for GSTR-3B Table 4(A)(5) Input Tax Credit claim</p>
              </div>
              <span className="text-xs font-mono font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                {filteredGstr2b.length} Purchase Bills
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse whitespace-nowrap text-xs">
                <thead>
                  <tr className="bg-slate-100 text-slate-600 font-bold uppercase tracking-wider border-b border-slate-200">
                    <th className="px-5 py-3">Date</th>
                    <th className="px-5 py-3">Supplier GSTIN</th>
                    <th className="px-5 py-3">Supplier Name</th>
                    <th className="px-5 py-3">Invoice No</th>
                    <th className="px-5 py-3">ITC Category</th>
                    <th className="px-5 py-3 text-right">Taxable (₹)</th>
                    <th className="px-5 py-3 text-right">Rate</th>
                    <th className="px-5 py-3 text-right">CGST (₹)</th>
                    <th className="px-5 py-3 text-right">SGST (₹)</th>
                    <th className="px-5 py-3 text-right">IGST (₹)</th>
                    <th className="px-5 py-3 text-right font-extrabold text-slate-900">Total ITC (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {filteredGstr2b.length === 0 ? (
                    <tr>
                      <td colSpan="11" className="text-center py-12 text-slate-400">
                        No GST registered inward supplies recorded for this period.
                      </td>
                    </tr>
                  ) : (
                    filteredGstr2b.map(b => (
                      <tr key={b.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-5 py-3 font-mono text-slate-600">{formatDate(b.date)}</td>
                        <td className="px-5 py-3 font-mono font-bold text-slate-800">{b.gstin || '-'}</td>
                        <td className="px-5 py-3 font-medium text-slate-800 max-w-[200px] truncate">{b.vendorName || '-'}</td>
                        <td className="px-5 py-3 font-mono font-semibold text-slate-900">{b.invoiceNo || '-'}</td>
                        <td className="px-5 py-3">
                          {b.isCapitalGoods ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-purple-100 text-purple-900 border border-purple-200" title={`Asset: ${b.assetName}`}>
                              Capital Goods
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium bg-slate-100 text-slate-600">
                              Inputs / Services
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-3 text-right font-mono font-medium">{formatCurrency(b.taxable)}</td>
                        <td className="px-5 py-3 text-right font-mono">{b.taxRate || 0}%</td>
                        <td className="px-5 py-3 text-right font-mono text-slate-600">{formatCurrency(b.cgst)}</td>
                        <td className="px-5 py-3 text-right font-mono text-slate-600">{formatCurrency(b.sgst)}</td>
                        <td className="px-5 py-3 text-right font-mono text-slate-600">{formatCurrency(b.igst)}</td>
                        <td className="px-5 py-3 text-right font-mono font-bold text-emerald-700">
                          {formatCurrency(b.totalTax)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. GSTR-3B CONSOLIDATED MONTHLY RETURN VIEW                               */}
      {/* ========================================================================= */}
      {activeReport === 'gstr3b' && (
        <div className="space-y-6">
          {/* Executive Tax Verdict Banner */}
          {gstr3bComputation.table61.totalCashPayable > 0 ? (
            <div className="bg-gradient-to-r from-amber-500 via-rose-500 to-rose-600 text-white p-5 rounded-2xl shadow-md">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center flex-shrink-0">
                    <Scale className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-wider bg-white/20 px-2 py-0.5 rounded-full">
                      Tax Liability Payable (Form PMT-06)
                    </span>
                    <h3 className="text-xl sm:text-2xl font-black mt-1">
                      Net Cash Tax Payable: {formatCurrency(gstr3bComputation.table61.totalCashPayable)}
                    </h3>
                    <p className="text-xs text-white/90 mt-0.5">
                      Output liability exceeds Input Tax Credit. Deposit via Challan PMT-06 before filing GSTR-3B.
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleExportGstr3bExcel}
                  className="px-4 py-2.5 bg-white text-rose-700 hover:bg-slate-100 rounded-xl text-xs font-black shadow-sm transition-colors whitespace-nowrap self-start sm:self-auto"
                >
                  Download CA Filing Excel
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white p-5 rounded-2xl shadow-md">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center flex-shrink-0">
                    <CheckCircle2 className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-wider bg-white/20 px-2 py-0.5 rounded-full">
                      Zero Cash Tax Due • ITC Surplus
                    </span>
                    <h3 className="text-xl sm:text-2xl font-black mt-1">
                      Surplus ITC Carried Forward: {formatCurrency(gstr3bComputation.table61.totalItcCarryForward)}
                    </h3>
                    <p className="text-xs text-white/90 mt-0.5">
                      Input Tax Credit completely covers output liability. Surplus is carried forward in Electronic Credit Ledger.
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleExportGstr3bExcel}
                  className="px-4 py-2.5 bg-white text-emerald-800 hover:bg-slate-100 rounded-xl text-xs font-black shadow-sm transition-colors whitespace-nowrap self-start sm:self-auto"
                >
                  Download CA Filing Excel
                </button>
              </div>
            </div>
          )}

          {/* Quick Comparison Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between text-rose-600">
                <span className="text-xs font-bold uppercase tracking-wider">Gross Output Tax (A)</span>
                <ArrowUpRight className="w-5 h-5" />
              </div>
              <p className="text-2xl font-black text-slate-900 mt-2">
                {formatCurrency(gstr3bComputation.table31.total)}
              </p>
              <p className="text-xs text-slate-500 mt-1 font-medium">
                From {gstr3bComputation.table31.salesCount} Outward Sales Orders
              </p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between text-emerald-600">
                <span className="text-xs font-bold uppercase tracking-wider">Eligible Input Credit (B)</span>
                <ArrowDownLeft className="w-5 h-5" />
              </div>
              <p className="text-2xl font-black text-slate-900 mt-2">
                {formatCurrency(gstr3bComputation.table4.total)}
              </p>
              <p className="text-xs text-slate-500 mt-1 font-medium">
                From {gstr3bComputation.table4.billsCount} Inward Purchase Bills
              </p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between text-indigo-600">
                <span className="text-xs font-bold uppercase tracking-wider">Net Cash / Balance</span>
                <CreditCard className="w-5 h-5" />
              </div>
              <p className={`text-2xl font-black mt-2 ${
                gstr3bComputation.table61.totalCashPayable > 0 ? 'text-rose-600' : 'text-emerald-600'
              }`}>
                {gstr3bComputation.table61.totalCashPayable > 0 
                  ? formatCurrency(gstr3bComputation.table61.totalCashPayable) 
                  : `+ ${formatCurrency(gstr3bComputation.table61.totalItcCarryForward)}`}
              </p>
              <p className="text-xs text-slate-500 mt-1 font-medium">
                {gstr3bComputation.table61.totalCashPayable > 0 ? 'Payable via Challan' : 'Surplus Carry Forward'}
              </p>
            </div>
          </div>

          {/* TABLE 3.1: OUTWARD SUPPLIES */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 bg-slate-50 border-b border-slate-200">
              <h3 className="text-sm font-bold text-slate-900">
                3.1 Details of Outward Supplies and Inward Supplies Liable to Reverse Charge
              </h3>
              <p className="text-xs text-slate-500">Summary of all sales orders and invoices for the selected return period</p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100 text-slate-600 font-bold uppercase tracking-wider border-b border-slate-200">
                    <th className="px-5 py-3">Nature of Supplies</th>
                    <th className="px-5 py-3 text-right">Total Taxable Value (₹)</th>
                    <th className="px-5 py-3 text-right">Integrated Tax (IGST ₹)</th>
                    <th className="px-5 py-3 text-right">Central Tax (CGST ₹)</th>
                    <th className="px-5 py-3 text-right">State/UT Tax (SGST ₹)</th>
                    <th className="px-5 py-3 text-right">Cess (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-800">
                  <tr className="hover:bg-slate-50 font-medium">
                    <td className="px-5 py-3.5">
                      <span className="font-bold text-slate-900">(a) Outward taxable supplies</span> (other than zero rated, nil rated & exempted)
                    </td>
                    <td className="px-5 py-3.5 text-right font-mono font-bold">{formatCurrency(gstr3bComputation.table31.taxable)}</td>
                    <td className="px-5 py-3.5 text-right font-mono text-slate-700">{formatCurrency(gstr3bComputation.table31.igst)}</td>
                    <td className="px-5 py-3.5 text-right font-mono text-slate-700">{formatCurrency(gstr3bComputation.table31.cgst)}</td>
                    <td className="px-5 py-3.5 text-right font-mono text-slate-700">{formatCurrency(gstr3bComputation.table31.sgst)}</td>
                    <td className="px-5 py-3.5 text-right font-mono text-slate-400">0.00</td>
                  </tr>
                  <tr className="hover:bg-slate-50 text-slate-500">
                    <td className="px-5 py-2.5">(b) Outward taxable supplies (zero rated)</td>
                    <td className="px-5 py-2.5 text-right font-mono">0.00</td>
                    <td className="px-5 py-2.5 text-right font-mono">0.00</td>
                    <td className="px-5 py-2.5 text-right font-mono">0.00</td>
                    <td className="px-5 py-2.5 text-right font-mono">0.00</td>
                    <td className="px-5 py-2.5 text-right font-mono">0.00</td>
                  </tr>
                  <tr className="hover:bg-slate-50 text-slate-500">
                    <td className="px-5 py-2.5">(c) Other outward supplies (nil rated, exempted)</td>
                    <td className="px-5 py-2.5 text-right font-mono">0.00</td>
                    <td className="px-5 py-2.5 text-right font-mono">-</td>
                    <td className="px-5 py-2.5 text-right font-mono">-</td>
                    <td className="px-5 py-2.5 text-right font-mono">-</td>
                    <td className="px-5 py-2.5 text-right font-mono">0.00</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* TABLE 4: ELIGIBLE INPUT TAX CREDIT */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 bg-slate-50 border-b border-slate-200">
              <h3 className="text-sm font-bold text-slate-900">
                4. Eligible Input Tax Credit (ITC)
              </h3>
              <p className="text-xs text-slate-500">ITC derived from GSTR-2B inward supplies from registered vendors</p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100 text-slate-600 font-bold uppercase tracking-wider border-b border-slate-200">
                    <th className="px-5 py-3">Details</th>
                    <th className="px-5 py-3 text-right">Integrated Tax (IGST ₹)</th>
                    <th className="px-5 py-3 text-right">Central Tax (CGST ₹)</th>
                    <th className="px-5 py-3 text-right">State/UT Tax (SGST ₹)</th>
                    <th className="px-5 py-3 text-right">Cess (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-800">
                  <tr className="bg-slate-50/50 font-bold text-slate-900">
                    <td colSpan="5" className="px-5 py-2.5 text-[11px] uppercase tracking-wider text-slate-500">
                      (A) ITC Available (whether in full or part)
                    </td>
                  </tr>
                  <tr className="hover:bg-slate-50 font-medium">
                    <td className="px-5 py-3.5 pl-8">
                      <span className="font-bold text-slate-900">(5) All other ITC</span> (Inward supplies from registered persons)
                    </td>
                    <td className="px-5 py-3.5 text-right font-mono text-emerald-700 font-bold">{formatCurrency(gstr3bComputation.table4.igst)}</td>
                    <td className="px-5 py-3.5 text-right font-mono text-emerald-700 font-bold">{formatCurrency(gstr3bComputation.table4.cgst)}</td>
                    <td className="px-5 py-3.5 text-right font-mono text-emerald-700 font-bold">{formatCurrency(gstr3bComputation.table4.sgst)}</td>
                    <td className="px-5 py-3.5 text-right font-mono text-slate-400">0.00</td>
                  </tr>
                  <tr className="hover:bg-slate-50 font-bold bg-slate-50/70 border-t border-slate-200">
                    <td className="px-5 py-3">Total Net ITC Available (4C = 4A - 4B)</td>
                    <td className="px-5 py-3 text-right font-mono text-emerald-800 font-black">{formatCurrency(gstr3bComputation.table4.igst)}</td>
                    <td className="px-5 py-3 text-right font-mono text-emerald-800 font-black">{formatCurrency(gstr3bComputation.table4.cgst)}</td>
                    <td className="px-5 py-3 text-right font-mono text-emerald-800 font-black">{formatCurrency(gstr3bComputation.table4.sgst)}</td>
                    <td className="px-5 py-3 text-right font-mono text-slate-400">0.00</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* TABLE 6.1: PAYMENT OF TAX (CASH & ITC UTILIZATION) */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  6.1 Payment of Tax (Net Cash Challan & ITC Offset Schedule)
                </h3>
                <p className="text-xs text-slate-500">
                  Statutory tax offset matching GST Network (gst.gov.in) rules
                </p>
              </div>
              <button
                onClick={handleExportGstr3bExcel}
                className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
              >
                <Download className="w-3.5 h-3.5" /> Download Schedule
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100 text-slate-600 font-bold uppercase tracking-wider border-b border-slate-200">
                    <th className="px-5 py-3">Description</th>
                    <th className="px-5 py-3 text-right">Tax Payable (Output) (₹)</th>
                    <th className="px-5 py-3 text-right">Paid Through ITC (₹)</th>
                    <th className="px-5 py-3 text-right font-extrabold text-rose-700">Tax Paid in Cash (PMT-06) (₹)</th>
                    <th className="px-5 py-3 text-right font-extrabold text-emerald-700">Surplus ITC Carried Fwd (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-800">
                  {/* IGST Row */}
                  <tr className="hover:bg-slate-50">
                    <td className="px-5 py-3 font-bold text-slate-900">Integrated Tax (IGST)</td>
                    <td className="px-5 py-3 text-right font-mono font-medium">{formatCurrency(gstr3bComputation.table61.igst.liability)}</td>
                    <td className="px-5 py-3 text-right font-mono text-indigo-600">{formatCurrency(gstr3bComputation.table61.igst.utilized)}</td>
                    <td className="px-5 py-3 text-right font-mono font-bold text-rose-700">
                      {formatCurrency(gstr3bComputation.table61.igst.cash)}
                    </td>
                    <td className="px-5 py-3 text-right font-mono font-bold text-emerald-700">
                      {formatCurrency(gstr3bComputation.table61.igst.balance)}
                    </td>
                  </tr>

                  {/* CGST Row */}
                  <tr className="hover:bg-slate-50">
                    <td className="px-5 py-3 font-bold text-slate-900">Central Tax (CGST)</td>
                    <td className="px-5 py-3 text-right font-mono font-medium">{formatCurrency(gstr3bComputation.table61.cgst.liability)}</td>
                    <td className="px-5 py-3 text-right font-mono text-indigo-600">{formatCurrency(gstr3bComputation.table61.cgst.utilized)}</td>
                    <td className="px-5 py-3 text-right font-mono font-bold text-rose-700">
                      {formatCurrency(gstr3bComputation.table61.cgst.cash)}
                    </td>
                    <td className="px-5 py-3 text-right font-mono font-bold text-emerald-700">
                      {formatCurrency(gstr3bComputation.table61.cgst.balance)}
                    </td>
                  </tr>

                  {/* SGST Row */}
                  <tr className="hover:bg-slate-50">
                    <td className="px-5 py-3 font-bold text-slate-900">State/UT Tax (SGST)</td>
                    <td className="px-5 py-3 text-right font-mono font-medium">{formatCurrency(gstr3bComputation.table61.sgst.liability)}</td>
                    <td className="px-5 py-3 text-right font-mono text-indigo-600">{formatCurrency(gstr3bComputation.table61.sgst.utilized)}</td>
                    <td className="px-5 py-3 text-right font-mono font-bold text-rose-700">
                      {formatCurrency(gstr3bComputation.table61.sgst.cash)}
                    </td>
                    <td className="px-5 py-3 text-right font-mono font-bold text-emerald-700">
                      {formatCurrency(gstr3bComputation.table61.sgst.balance)}
                    </td>
                  </tr>

                  {/* Totals Row */}
                  <tr className="bg-slate-100/90 font-black border-t-2 border-slate-300">
                    <td className="px-5 py-3.5 text-slate-900 uppercase tracking-wide">Total Net Summary</td>
                    <td className="px-5 py-3.5 text-right font-mono text-slate-900">{formatCurrency(gstr3bComputation.table31.total)}</td>
                    <td className="px-5 py-3.5 text-right font-mono text-indigo-700">{formatCurrency(gstr3bComputation.table61.totalItcUtilized)}</td>
                    <td className="px-5 py-3.5 text-right font-mono text-rose-700 text-sm">
                      {formatCurrency(gstr3bComputation.table61.totalCashPayable)}
                    </td>
                    <td className="px-5 py-3.5 text-right font-mono text-emerald-700 text-sm">
                      {formatCurrency(gstr3bComputation.table61.totalItcCarryForward)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
