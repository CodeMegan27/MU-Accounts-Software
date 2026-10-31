import React, { useState, useMemo } from 'react';
import { 
  BarChart3, 
  Printer, 
  FileSpreadsheet, 
  Calendar, 
  TrendingUp, 
  TrendingDown, 
  ArrowUpRight, 
  ArrowDownRight, 
  Receipt, 
  Layers, 
  Building2, 
  Percent,
  CheckCircle2
} from 'lucide-react';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { normalizeDateToISO } from '../../utils/salesParser';
import { useData } from '../../context/DataContext';
import { useSettings } from '../../context/SettingsContext';
import { useToast } from '../../context/ToastContext';
import * as XLSX from 'xlsx';

// Fast cached ISO date converter to prevent CPU stutter on thousands of records
const fastDateCache = new Map();
function getFastDateISO(val) {
  if (!val) return '';
  if (typeof val === 'string') {
    if (val.length === 10 && val[4] === '-' && val[7] === '-') return val;
    if (val.length >= 10 && /^\d{4}-\d{2}-\d{2}/.test(val)) return val.slice(0, 10);
  }
  const cached = fastDateCache.get(val);
  if (cached !== undefined) return cached;
  const res = normalizeDateToISO(val);
  fastDateCache.set(val, res);
  return res;
}

export default function ProfitAndLoss() {
  const { sales, bills, expenses, daybookTransactions, restoreDefaultSales } = useData();
  const { profile } = useSettings();
  const { showToast } = useToast();

  // Extract all unique months from sales, bills, expenses & daybook
  const availableMonths = useMemo(() => {
    const set = new Set();
    const addDate = (d) => {
      const iso = getFastDateISO(d);
      if (iso && iso.length >= 7) {
        const ym = iso.substring(0, 7);
        if (/^\d{4}-\d{2}$/.test(ym)) set.add(ym);
      }
    };
    (sales || []).forEach(s => addDate(s.orderDate || s.invDate || s.date));
    (bills || []).forEach(b => addDate(b.date));
    (expenses || []).forEach(e => addDate(e.date));
    (daybookTransactions || []).forEach(d => addDate(d.date));
    return Array.from(set).sort().reverse();
  }, [sales, bills, expenses, daybookTransactions]);

  const latestMonth = availableMonths[0] || '2026-09';
  const [datePeriod, setDatePeriod] = useState(() => `month_${latestMonth}`);
  const [dateFrom, setDateFrom] = useState(() => `${latestMonth}-01`);
  const [dateTo, setDateTo] = useState(() => {
    const [y, m] = latestMonth.split('-');
    const lastDay = new Date(parseInt(y, 10), parseInt(m, 10), 0).getDate();
    return `${latestMonth}-${String(lastDay).padStart(2, '0')}`;
  });
  const [specificDate, setSpecificDate] = useState('');

  // Handle Quick Date Period Change
  const handlePeriodChange = (period) => {
    setDatePeriod(period);
    const today = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const toISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

    if (period === 'all') {
      setDateFrom('');
      setDateTo('');
      setSpecificDate('');
    } else if (period === 'specific') {
      const initial = specificDate || dateFrom || '2026-09-01';
      setSpecificDate(initial);
      setDateFrom(initial);
      setDateTo(initial);
    } else if (period.startsWith('month_')) {
      const ym = period.replace('month_', '');
      const [y, m] = ym.split('-');
      const lastDay = new Date(parseInt(y, 10), parseInt(m, 10), 0).getDate();
      setDateFrom(`${ym}-01`);
      setDateTo(`${ym}-${String(lastDay).padStart(2, '0')}`);
      setSpecificDate('');
    } else if (period === 'sept2026') {
      setDateFrom('2026-09-01');
      setDateTo('2026-09-30');
      setSpecificDate('');
    } else if (period === 'thisMonth') {
      const first = new Date(today.getFullYear(), today.getMonth(), 1);
      const last = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      setDateFrom(toISO(first));
      setDateTo(toISO(last));
      setSpecificDate('');
    } else if (period === 'lastMonth') {
      const first = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const last = new Date(today.getFullYear(), today.getMonth(), 0);
      setDateFrom(toISO(first));
      setDateTo(toISO(last));
      setSpecificDate('');
    } else if (period === 'fy2627') {
      setDateFrom('2026-04-01');
      setDateTo('2027-03-31');
      setSpecificDate('');
    }
  };

  // Profit and Loss Aggregations (Optimized with Fast Date Cache for Instant Live Switching)
  const pnlData = useMemo(() => {
    // 1. Filter Sales within selected period
    const periodSales = (sales || []).filter(s => {
      const d = getFastDateISO(s.orderDate || s.invDate);
      if (!d) return true;
      if (dateFrom && d < dateFrom) return false;
      if (dateTo && d > dateTo) return false;
      return true;
    });

    let totalSalesTurnover = 0;
    let totalSalesPaid = 0;
    let totalSalesPending = 0;
    let totalSalesOutputGst = 0;
    let totalSalesTaxableRevenue = 0;
    const salesByDept = {};
    const salesByBranch = {};

    periodSales.forEach(s => {
      const amt = parseFloat(s.finalAmount !== undefined ? s.finalAmount : s.subtotal) || 0;
      const paid = parseFloat(s.paidAmount) || 0;
      const bal = parseFloat(s.balanceAmount !== undefined ? s.balanceAmount : Math.max(0, amt - paid)) || 0;

      // Back-calculate and separate 18% inclusive GST
      let gst = parseFloat(s.gstAmount) || 0;
      if (!gst && amt > 0) {
        gst = Math.round(((amt * 18) / 118) * 100) / 100;
      }
      const taxable = parseFloat(s.taxableAmount) || Math.round((amt - gst) * 100) / 100;

      totalSalesTurnover += amt;
      totalSalesOutputGst += gst;
      totalSalesTaxableRevenue += taxable;
      totalSalesPaid += paid;
      totalSalesPending += bal;

      const dept = s.department || 'OTHER';
      salesByDept[dept] = (salesByDept[dept] || 0) + amt;

      const br = s.branch || 'OTHER';
      salesByBranch[br] = (salesByBranch[br] || 0) + amt;
    });

    // 2. Filter Purchases within selected period
    const periodPurchases = (bills || []).filter(b => {
      const d = getFastDateISO(b.date);
      if (!d) return true;
      if (dateFrom && d < dateFrom) return false;
      if (dateTo && d > dateTo) return false;
      return true;
    });

    let totalPurchases = 0;
    let totalPurchasesPaid = 0;
    let totalPurchasesBalance = 0;

    periodPurchases.forEach(b => {
      const amt = parseFloat(b.grandTotal) || 0;
      const paid = parseFloat(b.paidAmount) || 0;
      const bal = parseFloat(b.balanceAmount) || 0;

      totalPurchases += amt;
      totalPurchasesPaid += paid;
      totalPurchasesBalance += bal;
    });

    // 3. Other Incomes from Daybook (Non-Sales Receipts: Other Income, Service, etc.)
    let totalOtherIncome = 0;
    const otherIncomesByCategory = {};
    (daybookTransactions || []).forEach(e => {
      const d = getFastDateISO(e.date);
      if (!d) return;
      if (dateFrom && d < dateFrom) return;
      if (dateTo && d > dateTo) return;

      const credit = (parseFloat(e.cashCredit) || 0) + (parseFloat(e.bankCredit) || 0);
      const cat = (e.category || '').toUpperCase();
      if (credit > 0 && cat !== 'SALES' && cat !== 'INTERCASH' && cat !== 'RS CAPITAL') {
        totalOtherIncome += credit;
        const displayCat = e.category || 'Other Operating Income';
        otherIncomesByCategory[displayCat] = (otherIncomesByCategory[displayCat] || 0) + credit;
      }
    });

    // 4. Gross Profit ((Turnover + Other Incomes) - Material Purchases)
    const grossRevenue = totalSalesTurnover + totalOtherIncome;
    const grossProfit = grossRevenue - totalPurchases;
    const grossProfitMargin = grossRevenue > 0 ? (grossProfit / grossRevenue) * 100 : 0;

    // 5. Operating Expenses within selected period
    const periodExpenses = (expenses || []).filter(e => {
      const d = getFastDateISO(e.date);
      if (!d) return true;
      if (dateFrom && d < dateFrom) return false;
      if (dateTo && d > dateTo) return false;
      return true;
    });

    let totalExpenses = 0;
    const expensesByCategory = {};

    periodExpenses.forEach(e => {
      const amt = parseFloat(e.amount) || 0;
      totalExpenses += amt;
      const cat = e.category || 'General Operating';
      expensesByCategory[cat] = (expensesByCategory[cat] || 0) + amt;
    });

    // 6. Net Profit (Gross Profit - Operating Expenses)
    const netProfit = grossProfit - totalExpenses;
    const netProfitMargin = grossRevenue > 0 ? (netProfit / grossRevenue) * 100 : 0;

    return {
      periodSalesCount: periodSales.length,
      totalSalesTurnover,
      totalSalesOutputGst,
      totalSalesTaxableRevenue,
      totalSalesPaid,
      totalSalesPending,
      salesByDept,
      salesByBranch,

      totalOtherIncome,
      otherIncomesByCategory,

      periodPurchasesCount: periodPurchases.length,
      totalPurchases,
      totalPurchasesPaid,
      totalPurchasesBalance,

      grossProfit,
      grossProfitMargin,

      periodExpensesCount: periodExpenses.length,
      totalExpenses,
      expensesByCategory,

      netProfit,
      netProfitMargin
    };
  }, [sales, bills, expenses, daybookTransactions, dateFrom, dateTo]);

  const handleExportExcel = () => {
    const wb = XLSX.utils.book_new();

    // Summary Sheet
    const summaryData = [
      ['PROFIT & LOSS STATEMENT'],
      ['Business Name', profile.businessName || 'RS Purchase Enterprise'],
      ['Period', `${dateFrom || 'Beginning'} to ${dateTo || 'Present'}`],
      [''],
      ['PARTICULARS', 'AMOUNT (INR)'],
      ['1. REVENUE FROM OPERATIONS (SALES)', pnlData.totalSalesTurnover],
      ['   - Gross Turnover (Tax Inclusive)', pnlData.totalSalesTurnover],
      ['   - Less: Output GST Liability (18% Separated)', pnlData.totalSalesOutputGst],
      ['   - Net Operating Revenue (Taxable Base)', pnlData.totalSalesTaxableRevenue],
      ['   - Collections Received', pnlData.totalSalesPaid],
      ['   - Customer Receivables', pnlData.totalSalesPending],
      [''],
      ['2. COST OF MATERIALS (PURCHASES)', pnlData.totalPurchases],
      ['   - Paid to Vendors', pnlData.totalPurchasesPaid],
      ['   - Payables Outstanding', pnlData.totalPurchasesBalance],
      [''],
      ['GROSS PROFIT (1 - 2)', pnlData.grossProfit],
      ['Gross Profit Margin (%)', `${pnlData.grossProfitMargin.toFixed(2)}%`],
      [''],
      ['3. OPERATING EXPENSES', pnlData.totalExpenses],
      ...Object.entries(pnlData.expensesByCategory).map(([cat, amt]) => [`   - ${cat}`, amt]),
      [''],
      ['NET PROFIT / (LOSS) (GP - Expenses)', pnlData.netProfit],
      ['Net Profit Margin (%)', `${pnlData.netProfitMargin.toFixed(2)}%`]
    ];

    const ws = XLSX.utils.aoa_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, ws, 'Profit and Loss');
    XLSX.writeFile(wb, `Profit_And_Loss_${new Date().toISOString().slice(0, 10)}.xlsx`);
    showToast('Profit & Loss statement exported to Excel', 'success');
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-emerald-50 border border-emerald-200 text-emerald-950 p-3 rounded-2xl flex items-center justify-between text-xs shadow-2xs">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="font-extrabold uppercase tracking-wide text-emerald-900">Live Real-Time P&L Statement</span>
          <span className="text-emerald-700 hidden sm:inline">• Reconciled across {pnlData.periodSalesCount} Sales Orders, {pnlData.periodPurchasesCount} Purchases, and {pnlData.periodExpensesCount} Expenses</span>
        </div>
        <span className="text-[10px] font-mono font-bold bg-white text-emerald-800 border border-emerald-200 px-2.5 py-0.5 rounded-full shadow-2xs shrink-0">
          Live Synced
        </span>
      </div>


      {/* Header and Controls */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
            <BarChart3 className="w-7 h-7 text-indigo-600" />
            <span>Profit & Loss Account</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Real-time Trading & P&L Statement for RS Purchase & Media Enterprise
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap justify-end">
          <button
            onClick={handleExportExcel}
            className="flex items-center gap-1.5 px-3.5 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-xl text-xs font-bold shadow-sm transition-all"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Export Excel</span>
          </button>

          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white rounded-xl text-xs font-bold shadow-sm transition-all"
          >
            <Printer className="w-4 h-4" />
            <span>Print P&L Statement</span>
          </button>
        </div>
      </div>

      {/* Period Selector Card */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Calendar className="w-4 h-4 text-slate-400" />
          <span className="font-bold text-slate-700">Reporting Period:</span>
          <select
            value={datePeriod}
            onChange={(e) => handlePeriodChange(e.target.value)}
            className="py-1.5 px-3 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            {availableMonths.map(m => {
              const d = new Date(m + '-01');
              const label = d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
              return (
                <option key={m} value={`month_${m}`}>
                  🗓️ {label}
                </option>
              );
            })}
            <option value="specific">🎯 Specific Date (Single Day)</option>
            <option value="custom">📆 Custom Date Range...</option>
            <option value="fy2627">Financial Year 2026-27</option>
            <option value="all">Full History (All Dates)</option>
          </select>
        </div>

        {datePeriod === 'specific' && (
          <div className="flex items-center gap-2 w-full sm:w-auto bg-indigo-50/70 p-1.5 px-3 rounded-xl border border-indigo-200 animate-in fade-in duration-150">
            <span className="font-bold text-indigo-950 text-xs">Select Date:</span>
            <input
              type="date"
              value={specificDate}
              onChange={(e) => {
                const val = e.target.value;
                setSpecificDate(val);
                setDateFrom(val);
                setDateTo(val);
              }}
              className="py-1 px-2.5 bg-white border border-indigo-200 rounded-lg text-xs font-mono font-bold text-slate-900 shadow-2xs"
            />
          </div>
        )}

        {datePeriod === 'custom' && (
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="py-1 px-2 border border-slate-200 rounded-lg text-xs font-mono"
            />
            <span className="text-slate-400">to</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="py-1 px-2 border border-slate-200 rounded-lg text-xs font-mono"
            />
          </div>
        )}
      </div>

      {/* Key Metric Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Sales */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex justify-between items-center text-slate-500 text-[10px] font-bold uppercase">
            <span>Gross Turnover (Tax-Inclusive)</span>
            <TrendingUp className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-xl font-black text-slate-900 mt-1">{formatCurrency(pnlData.totalSalesTurnover)}</p>
          <div className="mt-1 pt-1 border-t border-slate-100 flex items-center justify-between text-[10px]">
            <span className="text-slate-500">Output GST (18%):</span>
            <span className="font-mono font-bold text-indigo-700">{formatCurrency(pnlData.totalSalesOutputGst)}</span>
          </div>
          <div className="flex items-center justify-between text-[10px] text-slate-500">
            <span>Net Taxable Base:</span>
            <span className="font-mono font-semibold text-slate-700">{formatCurrency(pnlData.totalSalesTaxableRevenue)}</span>
          </div>
        </div>

        {/* Purchases */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex justify-between items-center text-slate-500 text-[10px] font-bold uppercase">
            <span>Material Purchases</span>
            <TrendingDown className="w-4 h-4 text-rose-600" />
          </div>
          <p className="text-xl font-black text-slate-900 mt-1">{formatCurrency(pnlData.totalPurchases)}</p>
          <p className="text-[10px] text-slate-400 mt-0.5">{pnlData.periodPurchasesCount} purchase bills</p>
        </div>

        {/* Gross Profit */}
        <div className={`p-4 rounded-2xl border shadow-xs ${
          pnlData.grossProfit >= 0 ? 'bg-indigo-50/60 border-indigo-200' : 'bg-rose-50 border-rose-200'
        }`}>
          <div className="flex justify-between items-center text-[10px] font-bold uppercase text-indigo-900">
            <span>Gross Profit (GP)</span>
            <span className="text-xs font-extrabold">{pnlData.grossProfitMargin.toFixed(1)}%</span>
          </div>
          <p className="text-xl font-black text-indigo-950 mt-1">{formatCurrency(pnlData.grossProfit)}</p>
          <p className="text-[10px] text-indigo-700/80 mt-0.5">Turnover − Material Purchases</p>
        </div>

        {/* Net Profit */}
        <div className={`p-4 rounded-2xl border shadow-xs ${
          pnlData.netProfit >= 0 ? 'bg-emerald-50/80 border-emerald-200' : 'bg-rose-50 border-rose-200'
        }`}>
          <div className="flex justify-between items-center text-[10px] font-bold uppercase text-emerald-900">
            <span>Net Profit (NP)</span>
            <span className="text-xs font-extrabold">{pnlData.netProfitMargin.toFixed(1)}%</span>
          </div>
          <p className="text-xl font-black text-emerald-950 mt-1">{formatCurrency(pnlData.netProfit)}</p>
          <p className="text-[10px] text-emerald-700/80 mt-0.5">GP − Operating Expenses</p>
        </div>
      </div>

      {/* Official P&L Statement Document */}
      <div id="pnl-printable-document" className="printable-document bg-white rounded-2xl border border-slate-200 p-6 sm:p-10 shadow-xs space-y-6">
        {/* Letterhead */}
        <div className="border-b-2 border-slate-900 pb-5 flex flex-col sm:flex-row justify-between items-start gap-4">
          <div>
            <h2 className="text-2xl font-black text-slate-950 tracking-tight">
              {profile.businessName || 'RS Purchase Enterprise'}
            </h2>
            <p className="text-xs text-slate-600 mt-1">{profile.address || 'Enterprise Procurement & Media Division'}</p>
            <p className="text-xs font-medium text-slate-600 mt-1"><strong>GSTIN:</strong> {profile.gstin || 'UNREGISTERED'}</p>
          </div>
          <div className="sm:text-right">
            <span className="inline-block bg-indigo-900 text-white text-xs font-extrabold uppercase px-3 py-1 rounded-md tracking-wider">
              Trading & Profit and Loss Account
            </span>
            <p className="text-xs text-slate-500 mt-2">For the Period:</p>
            <p className="text-xs font-bold text-slate-900">
              {dateFrom ? formatDate(dateFrom) : 'Beginning'} to {dateTo ? formatDate(dateTo) : 'Present'}
            </p>
          </div>
        </div>

        {/* Detailed Financial Ledger Breakdown (Clean Vertical Statement) */}
        <div className="border border-slate-300 rounded-xl overflow-hidden text-xs bg-white shadow-xs">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-300 text-slate-900 font-bold uppercase tracking-wider text-[11px]">
                <th className="p-3.5">Particulars / Account Head</th>
                <th className="p-3.5 text-right w-40">Subtotal (₹)</th>
                <th className="p-3.5 text-right w-48">Amount (₹)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {/* Section A: Revenue from Operations */}
              <tr className="bg-slate-50 font-extrabold text-slate-900">
                <td colSpan="3" className="p-3 uppercase tracking-wide text-xs">
                  A. Revenue from Operations
                </td>
              </tr>
              <tr>
                <td className="p-3 pl-6">
                  <p className="font-bold text-slate-900">Gross Sales Turnover (Tax Inclusive)</p>
                  <p className="text-[11px] text-slate-500">
                    Paid / Collected: {formatCurrency(pnlData.totalSalesPaid)} | Pending: {formatCurrency(pnlData.totalSalesPending)}
                  </p>
                </td>
                <td className="p-3 text-right font-mono text-slate-700">{formatCurrency(pnlData.totalSalesTurnover)}</td>
                <td className="p-3 text-right font-mono text-slate-400">-</td>
              </tr>
              <tr className="text-slate-600 bg-slate-50/40">
                <td className="p-2.5 pl-9">
                  <p className="font-semibold text-xs">Less: Output GST Liability (18% Included)</p>
                  <p className="text-[10px] text-slate-400">CGST (9%) + SGST (9%)</p>
                </td>
                <td className="p-2.5 text-right font-mono text-rose-700 font-semibold">({formatCurrency(pnlData.totalSalesOutputGst)})</td>
                <td className="p-2.5 text-right font-mono text-slate-400">-</td>
              </tr>
              <tr className="font-bold text-slate-900 bg-indigo-50/40">
                <td className="p-3 pl-6">Net Revenue from Operations (Taxable Base)</td>
                <td className="p-3 text-right font-mono text-slate-400">-</td>
                <td className="p-3 text-right font-mono font-bold text-emerald-800 text-sm">{formatCurrency(pnlData.totalSalesTaxableRevenue)}</td>
              </tr>

              {pnlData.totalOtherIncome > 0 && (
                <>
                  <tr className="bg-slate-50 font-extrabold text-slate-900">
                    <td colSpan="3" className="p-3 uppercase tracking-wide text-xs">
                      B. Other Incomes & Receipts
                    </td>
                  </tr>
                  {Object.entries(pnlData.otherIncomesByCategory).map(([k, v]) => (
                    <tr key={k}>
                      <td className="p-2.5 pl-6 text-slate-700">{k}</td>
                      <td className="p-2.5 text-right font-mono text-slate-700">{formatCurrency(v)}</td>
                      <td className="p-2.5 text-right font-mono text-slate-400">-</td>
                    </tr>
                  ))}
                  <tr className="font-bold text-slate-900 bg-emerald-50/40">
                    <td className="p-3 pl-6">Total Other Incomes</td>
                    <td className="p-3 text-right font-mono text-slate-400">-</td>
                    <td className="p-3 text-right font-mono font-bold text-emerald-800 text-sm">+{formatCurrency(pnlData.totalOtherIncome)}</td>
                  </tr>
                </>
              )}

              {/* Section C: Cost of Materials & Purchases */}
              <tr className="bg-slate-50 font-extrabold text-slate-900">
                <td colSpan="3" className="p-3 uppercase tracking-wide text-xs">
                  {pnlData.totalOtherIncome > 0 ? 'C' : 'B'}. Cost of Materials & Purchases
                </td>
              </tr>
              <tr>
                <td className="p-3 pl-6">
                  <p className="font-bold text-slate-900">Material Purchases (Purchase Register)</p>
                  <p className="text-[11px] text-slate-500">
                    Paid: {formatCurrency(pnlData.totalPurchasesPaid)} | Payables: {formatCurrency(pnlData.totalPurchasesBalance)}
                  </p>
                </td>
                <td className="p-3 text-right font-mono text-slate-700">{formatCurrency(pnlData.totalPurchases)}</td>
                <td className="p-3 text-right font-mono font-bold text-rose-800 text-sm">({formatCurrency(pnlData.totalPurchases)})</td>
              </tr>

              {/* Gross Profit Subtotal */}
              <tr className="bg-indigo-50/80 font-black text-indigo-950 border-t-2 border-b-2 border-indigo-200">
                <td className="p-3.5 pl-6 flex justify-between items-center">
                  <span>GROSS PROFIT (GP)</span>
                  <span className="text-[11px] bg-indigo-200/90 text-indigo-950 px-2.5 py-0.5 rounded font-bold">
                    GP Margin: {pnlData.grossProfitMargin.toFixed(1)}%
                  </span>
                </td>
                <td className="p-3.5 text-right font-mono text-slate-400">-</td>
                <td className={`p-3.5 text-right font-mono text-base font-black ${
                  pnlData.grossProfit >= 0 ? 'text-indigo-950' : 'text-rose-700'
                }`}>
                  {formatCurrency(pnlData.grossProfit)}
                </td>
              </tr>

              {/* Section D: Operating & Administrative Expenses */}
              <tr className="bg-slate-50 font-extrabold text-slate-900">
                <td colSpan="3" className="p-3 uppercase tracking-wide text-xs">
                  {pnlData.totalOtherIncome > 0 ? 'D' : 'C'}. Operating & Administrative Expenses
                </td>
              </tr>
              {Object.keys(pnlData.expensesByCategory).length === 0 ? (
                <tr>
                  <td colSpan="3" className="p-3 pl-6 text-slate-400 italic">
                    No operating expenses logged in this period.
                  </td>
                </tr>
              ) : (
                Object.entries(pnlData.expensesByCategory).map(([cat, amt]) => (
                  <tr key={cat}>
                    <td className="p-2.5 pl-6 text-slate-700">{cat}</td>
                    <td className="p-2.5 text-right font-mono text-slate-700">{formatCurrency(amt)}</td>
                    <td className="p-2.5 text-right font-mono text-slate-400">-</td>
                  </tr>
                ))
              )}
              <tr className="font-bold text-slate-900 bg-slate-50/60">
                <td className="p-3 pl-6">Total Operating Expenses</td>
                <td className="p-3 text-right font-mono text-slate-400">-</td>
                <td className="p-3 text-right font-mono font-bold text-rose-800 text-sm">({formatCurrency(pnlData.totalExpenses)})</td>
              </tr>

              {/* Net Profit Final Row */}
              <tr className={`border-t-2 font-black text-sm ${
                pnlData.netProfit >= 0 ? 'bg-emerald-100 text-emerald-950 border-emerald-300' : 'bg-rose-100 text-rose-950 border-rose-300'
              }`}>
                <td className="p-4 pl-6 flex justify-between items-center">
                  <span className="text-sm uppercase tracking-wide">NET PROFIT / (LOSS) FOR THE PERIOD</span>
                  <span className="text-xs bg-white/90 text-slate-900 px-3 py-1 rounded-full font-bold shadow-2xs">
                    Net Margin: {pnlData.netProfitMargin.toFixed(1)}%
                  </span>
                </td>
                <td className="p-4 text-right font-mono text-slate-400">-</td>
                <td className="p-4 text-right font-mono text-lg font-black">
                  {formatCurrency(pnlData.netProfit)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Department & Branch Contribution Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
          {/* Sales by Department */}
          <div className="border border-slate-200 rounded-xl p-4 space-y-2">
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wide flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-indigo-600" />
              <span>Department Sales Contribution</span>
            </h4>
            <div className="divide-y divide-slate-100 text-xs">
              {Object.entries(pnlData.salesByDept).map(([dept, amt]) => {
                const pct = pnlData.totalSalesTurnover > 0 ? (amt / pnlData.totalSalesTurnover) * 100 : 0;
                return (
                  <div key={dept} className="py-2 flex justify-between items-center">
                    <span className="font-semibold text-slate-800">{dept}</span>
                    <div className="text-right">
                      <span className="font-mono font-bold text-slate-900">{formatCurrency(amt)}</span>
                      <span className="ml-2 text-[10px] text-slate-400 font-semibold">({pct.toFixed(1)}%)</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Sales by Branch */}
          <div className="border border-slate-200 rounded-xl p-4 space-y-2">
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wide flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-brand-600" />
              <span>Branch Sales Contribution</span>
            </h4>
            <div className="divide-y divide-slate-100 text-xs">
              {Object.entries(pnlData.salesByBranch).map(([br, amt]) => {
                const pct = pnlData.totalSalesTurnover > 0 ? (amt / pnlData.totalSalesTurnover) * 100 : 0;
                return (
                  <div key={br} className="py-2 flex justify-between items-center">
                    <span className="font-semibold text-slate-800">{br === 'KLK' ? 'Kilakarai (KLK)' : br === 'RMD' ? 'Ramanathapuram (RMD)' : br}</span>
                    <div className="text-right">
                      <span className="font-mono font-bold text-slate-900">{formatCurrency(amt)}</span>
                      <span className="ml-2 text-[10px] text-slate-400 font-semibold">({pct.toFixed(1)}%)</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
