import React, { useState, useMemo } from 'react';
import { 
  Plus, 
  Search, 
  Filter, 
  Eye, 
  Trash2, 
  Printer, 
  FileSpreadsheet, 
  UploadCloud, 
  CheckCircle2, 
  Clock, 
  ArrowUpDown, 
  CreditCard,
  Building2,
  Calendar,
  Layers,
  TrendingUp,
  X,
  Phone,
  RotateCcw,
  Check,
  AlertTriangle,
  FileCheck
} from 'lucide-react';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { normalizeDateToISO } from '../../utils/salesParser';
import { useData } from '../../context/DataContext';
import { useToast } from '../../context/ToastContext';
import ImportSalesModal from './ImportSalesModal';
import QuickAddMasterModal from '../common/QuickAddMasterModal';
import * as XLSX from 'xlsx';

export default function SalesList({ defaultMode = 'orders', onNewSale, onViewSale }) {
  const { 
    sales, 
    branches, 
    departments, 
    paymentMethods, 
    addPaymentMethod,
    deleteSale, 
    recordSalePayment, 
    convertToSalesInvoice, 
    importSalesBulk, 
    clearAllSales, 
    restoreDefaultSales,
    mergeDefaultSeptemberSales 
  } = useData();
  const { showToast } = useToast();

  const [registerMode, setRegisterMode] = useState(defaultMode); // 'orders' or 'invoices'
  const [showPaymentMethodModal, setShowPaymentMethodModal] = useState(false);

  const handleAddPaymentMethod = (name) => {
    const added = addPaymentMethod(name);
    setPaymentMethod(added);
    showToast(`Added payment method: ${added}`, 'success');
  };

  const [search, setSearch] = useState('');
  const [branchFilter, setBranchFilter] = useState('all');
  const [deptFilter, setDeptFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [datePreset, setDatePreset] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [specificDate, setSpecificDate] = useState('');
  const [selectedDay, setSelectedDay] = useState('12');

  const [sortField, setSortField] = useState('orderDate');
  const [sortDirection, setSortDirection] = useState('desc');

  // Fast Client-Side Pagination for Silky Smooth Rendering
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  const [showImportModal, setShowImportModal] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const [paymentSale, setPaymentSale] = useState(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('GPAY- SBI');

  // Convert to Invoice Modal
  const [invoicingSale, setInvoicingSale] = useState(null);
  const [customInvNo, setCustomInvNo] = useState('');
  const [customInvDate, setCustomInvDate] = useState('');


  // Extract all unique months from sales for dynamic month filtering
  const availableMonths = useMemo(() => {
    const set = new Set();
    sales.forEach(s => {
      const d = s.orderDate || s.invDate || s.date;
      if (d && d.length >= 7) {
        const ym = d.substring(0, 7);
        if (/^\d{4}-\d{2}$/.test(ym)) set.add(ym);
      }
    });
    return Array.from(set).sort().reverse();
  }, [sales]);

  // Handle Quick Date Presets
  const handleDatePresetChange = (preset) => {
    setDatePreset(preset);
    const today = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const toISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

    if (preset === 'all') {
      setDateFrom('');
      setDateTo('');
      setSpecificDate('');
    } else if (preset === 'specific') {
      const initial = specificDate || dateFrom || '2026-09-01';
      setSpecificDate(initial);
      setDateFrom(initial);
      setDateTo(initial);
    } else if (preset === 'dayOfMonth') {
      setDateFrom('');
      setDateTo('');
      setSpecificDate('');
    } else if (preset === 'custom') {
      setSpecificDate('');
    } else if (preset === 'today') {
      const d = toISO(today);
      setDateFrom(d);
      setDateTo(d);
      setSpecificDate(d);
    } else if (preset === 'yesterday') {
      const y = new Date(today);
      y.setDate(y.getDate() - 1);
      const d = toISO(y);
      setDateFrom(d);
      setDateTo(d);
      setSpecificDate(d);
    } else if (preset === 'last7Days') {
      const past = new Date(today);
      past.setDate(past.getDate() - 7);
      setDateFrom(toISO(past));
      setDateTo(toISO(today));
      setSpecificDate('');
    } else if (preset.startsWith('month_')) {
      const ym = preset.replace('month_', '');
      const [y, m] = ym.split('-');
      const lastDay = new Date(parseInt(y, 10), parseInt(m, 10), 0).getDate();
      setDateFrom(`${ym}-01`);
      setDateTo(`${ym}-${String(lastDay).padStart(2, '0')}`);
      setSpecificDate('');
    } else if (preset === 'sept2026') {
      setDateFrom('2026-09-01');
      setDateTo('2026-09-30');
      setSpecificDate('');
    }
  };

  // Filtered & Sorted Sales
  const filteredSales = useMemo(() => {
    return sales.filter(s => {
      const q = search.toLowerCase();
      const matchesSearch = !search ||
        (s.estNo && s.estNo.toLowerCase().includes(q)) ||
        (s.customerName && s.customerName.toLowerCase().includes(q)) ||
        (s.contact && s.contact.includes(q)) ||
        (s.orderFormNo && s.orderFormNo.toLowerCase().includes(q)) ||
        (s.items && s.items.some(i => i.product.toLowerCase().includes(q) || i.description.toLowerCase().includes(q)));

      const matchesBranch = branchFilter === 'all' || s.branch === branchFilter;
      const matchesDept = deptFilter === 'all' || s.department === deptFilter;
      const matchesStatus = statusFilter === 'all' || s.paymentStatus === statusFilter;

      let matchesDate = true;
      const orderDateISO = normalizeDateToISO(s.orderDate);
      const invDateISO = normalizeDateToISO(s.invDate);
      const activeDateISO = (registerMode === 'invoices' && invDateISO) ? invDateISO : orderDateISO;

      if (datePreset === 'specific') {
        if (specificDate) {
          const specISO = normalizeDateToISO(specificDate);
          if (activeDateISO !== specISO) matchesDate = false;
        }
      } else if (datePreset === 'dayOfMonth') {
        if (selectedDay) {
          const dayStr = String(selectedDay).padStart(2, '0');
          const isMatch = activeDateISO && (activeDateISO.endsWith(`-${dayStr}`) || activeDateISO.startsWith(`${dayStr}-`));
          if (!isMatch) matchesDate = false;
        }
      } else if (dateFrom || dateTo) {
        if (!activeDateISO) {
          matchesDate = false;
        } else {
          if (dateFrom && activeDateISO < dateFrom) matchesDate = false;
          if (dateTo && activeDateISO > dateTo) matchesDate = false;
        }
      }

      let matchesMode = true;
      if (registerMode === 'invoices') {
        matchesMode = Boolean(s.isInvoice || s.invoiceNo || s.invDate || s.paymentStatus === 'paid');
      }

      return matchesSearch && matchesBranch && matchesDept && matchesStatus && matchesDate && matchesMode;
    }).sort((a, b) => {
      let valA = a[sortField] || '';
      let valB = b[sortField] || '';

      if (sortField === 'finalAmount' || sortField === 'balanceAmount' || sortField === 'paidAmount') {
        valA = parseFloat(valA) || 0;
        valB = parseFloat(valB) || 0;
        return sortDirection === 'asc' ? valA - valB : valB - valA;
      }

      if (sortField === 'orderDate' || sortField === 'invDate') {
        valA = new Date(valA).getTime() || 0;
        valB = new Date(valB).getTime() || 0;
        return sortDirection === 'asc' ? valA - valB : valB - valA;
      }

      return sortDirection === 'asc'
        ? String(valA).localeCompare(String(valB))
        : String(valB).localeCompare(String(valA));
    });
  }, [sales, registerMode, search, branchFilter, deptFilter, statusFilter, dateFrom, dateTo, sortField, sortDirection]);


  // Aggregate Metrics
  const metrics = useMemo(() => {
    let totalSales = 0;
    let totalPaid = 0;
    let totalBalance = 0;

    filteredSales.forEach(s => {
      totalSales += (parseFloat(s.finalAmount) || 0);
      totalPaid += (parseFloat(s.paidAmount) || 0);
      totalBalance += (parseFloat(s.balanceAmount) || 0);
    });

    return {
      count: filteredSales.length,
      totalSales,
      totalPaid,
      totalBalance
    };
  }, [filteredSales]);

  // Fast Client-Side Pagination for Silky Smooth Rendering
  const totalPages = Math.ceil(filteredSales.length / (pageSize === 'all' ? filteredSales.length || 1 : pageSize)) || 1;
  const paginatedSales = useMemo(() => {
    if (pageSize === 'all') return filteredSales;
    const start = (currentPage - 1) * pageSize;
    return filteredSales.slice(start, start + pageSize);
  }, [filteredSales, currentPage, pageSize]);

  const handlePageChange = (p) => {
    if (p >= 1 && p <= totalPages) {
      setCurrentPage(p);
    }
  };

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const handleRecordPaymentSubmit = (e) => {
    e.preventDefault();
    if (!paymentSale) return;
    const amt = parseFloat(paymentAmount);
    if (isNaN(amt) || amt <= 0) {
      showToast('Please enter a valid payment amount', 'error');
      return;
    }

    recordSalePayment(paymentSale.id, {
      type: 'Balance Payment',
      amount: amt,
      method: paymentMethod,
      date: new Date().toISOString().substring(0, 10)
    });

    showToast(`Payment of ₹${amt.toLocaleString('en-IN')} recorded for #${paymentSale.estNo}`, 'success');
    setPaymentSale(null);
    setPaymentAmount('');
  };

  const handleExportExcel = () => {
    if (filteredSales.length === 0) {
      showToast('No sales records to export', 'error');
      return;
    }

    const COMPANY_EXCEL_HEADERS = [
      'ORDER- DATE',
      'INV- DATE',
      'EST NO ',
      'INVOICE NO.',
      'ORDER FORM NO.',
      'BRANCH',
      'DEPARTMENT',
      'ATTENDER',
      'CUSTOMER NAME',
      'CONTACT',
      'ADDRESS',
      'CUSTOMER SEGMENT',
      'SEGMENT TYPE',
      'PRODUCT',
      'PRODUCT DETAILS',
      'SIZE',
      'QUANTITY',
      'RATE',
      'AMOUNT',
      'TOTAL',
      'DISCOUNT',
      'GST  18%',
      'FINAL SALE AMOUNT',
      'PAID',
      'BALANCE AMOUNT',
      'BILL STATUS',
      'TODAY',
      'DUE DATE',
      'ADVANCE',
      'PAYMENT METHOD',
      'BALANCE',
      'PAYMENT METHOD'
    ];

    const today = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const todayFormatted = `${pad(today.getDate())}-${pad(today.getMonth() + 1)}-${today.getFullYear()}`;

    const formatToExcelDate = (dateStr) => {
      if (!dateStr) return '';
      const str = String(dateStr).trim();
      const m = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (m) {
        return `${m[3]}-${m[2]}-${m[1]}`;
      }
      return str;
    };

    const rows = [COMPANY_EXCEL_HEADERS];

    filteredSales.forEach(s => {
      const items = (s.items && s.items.length > 0) ? s.items : [
        { product: 'Job Item', description: 'General Printing', size: '-', quantity: 1, rate: s.subtotal, amount: s.subtotal }
      ];

      // Separate advance and balance payments
      const advPayments = (s.payments || []).filter(p => p.type === 'Advance' || p.type?.toLowerCase().includes('adv'));
      const balPayments = (s.payments || []).filter(p => p.type === 'Balance Payment' || p.type?.toLowerCase().includes('bal'));

      const advAmtStr = advPayments.map(p => p.amount).join(', ') || '';
      const advMethodStr = advPayments.map(p => p.method).join(', ') || '';
      const balAmtStr = balPayments.map(p => p.amount).join(', ') || '';
      const balMethodStr = balPayments.map(p => p.method).join(', ') || '';

      const isPaid = (parseFloat(s.balanceAmount) || 0) <= 0 || s.paymentStatus === 'paid' || s.billStatus === 'NIL';

      items.forEach((item, idx) => {
        rows.push([
          formatToExcelDate(s.orderDate),
          formatToExcelDate(s.invDate),
          s.estNo || '',
          s.invoiceNo || '',
          s.orderFormNo || 'NA',
          s.branch || 'KLK',
          s.department || 'ADVERTISEMENT',
          s.attender || '',
          s.customerName || '',
          s.contact || '',
          s.address || '',
          s.customerSegment || '',
          s.segmentType || '',
          item.product || '',
          item.description || item.productDetails || '',
          item.size || '-',
          parseFloat(item.quantity) || 1,
          parseFloat(item.rate) || 0,
          parseFloat(item.amount) || 0,
          parseFloat(s.subtotal) || 0,
          parseFloat(s.discount) || 0,
          parseFloat(s.gstAmount) || 0,
          parseFloat(s.finalAmount) || 0,
          parseFloat(s.paidAmount) || 0,
          parseFloat(s.balanceAmount) || 0,
          isPaid ? 'NIL' : 'PENDING',
          todayFormatted,
          s.dueDate || (isPaid ? 'NIL' : ''),
          idx === 0 ? advAmtStr : '',
          idx === 0 ? advMethodStr : '',
          idx === 0 ? balAmtStr : '',
          idx === 0 ? balMethodStr : ''
        ]);
      });
    });

    const worksheet = XLSX.utils.aoa_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');
    XLSX.writeFile(workbook, `Sales_Register_${todayFormatted}.xlsx`);
    showToast(`Exported ${rows.length - 1} rows to Excel matching your exact company format`, 'success');
  };

  return (
    <div className="space-y-6">
      {/* Top Professional System Status Banner */}
      <div className="bg-slate-900 border border-slate-800 text-slate-200 p-3 rounded-2xl flex items-center justify-between text-xs shadow-xs">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="font-extrabold uppercase tracking-wide text-white">Sales Register & P&L Engine</span>
          <span className="text-slate-400 hidden sm:inline">• Enterprise Real-Time Cloud Sync & Reporting</span>
        </div>
        <div className="flex items-center gap-2 font-mono text-[11px] text-emerald-400 font-bold">
          <span>{sales.length} Orders Active</span>
        </div>
      </div>

      {/* Header and Action Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
            <TrendingUp className="w-7 h-7 text-emerald-600" />
            <span>{registerMode === 'invoices' ? 'Official Sales Register (Tax Invoices)' : 'Sales Order Register (Estimates & Jobs)'}</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            {registerMode === 'invoices'
              ? 'Finalized sales invoices with payment clearance dates, invoice numbers, and tax ledger'
              : 'Incoming job estimates, customer orders, multi-item composite jobs, and advance collection'}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap justify-end">
          <button
            onClick={() => setShowImportModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white rounded-xl text-xs font-bold shadow-sm transition-all"
            title="Import Excel or CSV sales files"
          >
            <UploadCloud className="w-4 h-4" />
            <span>Import Excel</span>
          </button>

          <button
            onClick={handleExportExcel}
            className="flex items-center gap-1.5 px-3.5 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-xl text-xs font-bold shadow-sm transition-all"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Export Excel</span>
          </button>

          <button
            onClick={onNewSale}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-brand-600 hover:bg-brand-700 active:bg-brand-800 text-white rounded-xl text-xs font-bold shadow-sm transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>New Order</span>
          </button>
        </div>
      </div>

      {/* Dual Register View Switcher & Reset Button (Requirement 1, 4 & 5) */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-2.5 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl overflow-x-auto">
          <button
            onClick={() => setRegisterMode('orders')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
              registerMode === 'orders'
                ? 'bg-white text-indigo-950 shadow-xs border border-slate-200'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span>📋 Sales Order Register</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-200 text-slate-800 font-mono font-bold">
              {sales.length}
            </span>
          </button>

          <button
            onClick={() => setRegisterMode('invoices')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
              registerMode === 'invoices'
                ? 'bg-white text-emerald-950 shadow-xs border border-slate-200'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span>🧾 Sales Register (Invoices)</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-emerald-100 text-emerald-800 font-mono font-bold">
              {sales.filter(s => s.isInvoice || s.paymentStatus === 'paid').length}
            </span>
          </button>
        </div>

        {/* Reset Sales Data Button (Requirement 1) */}
        <div className="flex items-center gap-2 justify-end">
          <button
            onClick={() => setShowResetConfirm(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-xl text-xs font-bold border border-rose-200 transition-colors"
            title="Wipe test sales entries to re-check"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset All Sales Data</span>
          </button>
        </div>
      </div>


      {/* Metrics Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <p className="text-[10px] font-bold text-slate-500 uppercase">Total Sales Orders</p>
          <p className="text-xl font-black text-slate-900 mt-0.5">{metrics.count}</p>
          <p className="text-[10px] text-slate-400 mt-0.5">Orders in active filter</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <p className="text-[10px] font-bold text-slate-500 uppercase">Gross Sales Turnover</p>
          <p className="text-xl font-black text-indigo-950 mt-0.5">{formatCurrency(metrics.totalSales)}</p>
          <p className="text-[10px] text-slate-400 mt-0.5">Incl. Tax & Discounts</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <p className="text-[10px] font-bold text-emerald-700 uppercase">Total Collected (Paid)</p>
          <p className="text-xl font-black text-emerald-950 mt-0.5">{formatCurrency(metrics.totalPaid)}</p>
          <p className="text-[10px] text-emerald-600 font-semibold mt-0.5">Advances + Balances</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <p className="text-[10px] font-bold text-amber-700 uppercase">Outstanding Receivables</p>
          <p className="text-xl font-black text-amber-950 mt-0.5">{formatCurrency(metrics.totalBalance)}</p>
          <p className="text-[10px] text-amber-600 font-semibold mt-0.5">Pending Customer Balances</p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
          {/* Search Box */}
          <div className="sm:col-span-4 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search customer, Est No, phone, items..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-brand-500 focus:bg-white"
            />
          </div>

          {/* Quick Date Presets Dropdown */}
          <div className="sm:col-span-3">
            <select
              value={datePreset}
              onChange={(e) => handleDatePresetChange(e.target.value)}
              className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-brand-500 font-semibold text-slate-800"
            >
              <option value="all">📅 All Dates (Full History)</option>
              <option value="specific">🎯 Specific Date (Exact Day)</option>
              <option value="dayOfMonth">📅 Day of Month (Filter All Months)</option>
              {availableMonths.map(m => {
                const d = new Date(m + '-01');
                const label = d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
                return (
                  <option key={m} value={`month_${m}`}>
                    🗓️ {label}
                  </option>
                );
              })}
              <option value="custom">📆 Custom Date Range...</option>
              <option value="today">Today</option>
              <option value="yesterday">Yesterday</option>
              <option value="last7Days">Last 7 Days</option>
            </select>
          </div>

          {/* Branch Filter */}
          <div className="sm:col-span-2">
            <select
              value={branchFilter}
              onChange={(e) => setBranchFilter(e.target.value)}
              className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-brand-500 font-semibold text-slate-800"
            >
              <option value="all">🏢 All Branches</option>
              {branches.map(b => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </div>

          {/* Department Filter */}
          <div className="sm:col-span-3">
            <select
              value={deptFilter}
              onChange={(e) => setDeptFilter(e.target.value)}
              className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-brand-500 font-semibold text-slate-800"
            >
              <option value="all">📂 All Departments</option>
              {departments.map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Specific Date Picker Row */}
        {datePreset === 'specific' && (
          <div className="flex flex-wrap items-center gap-2.5 pt-2 border-t border-slate-100 bg-indigo-50/60 p-3 rounded-xl animate-in fade-in duration-150">
            <div className="flex items-center gap-1.5 text-indigo-950 font-bold text-xs">
              <Calendar className="w-4 h-4 text-indigo-600" />
              <span>Select Specific Date:</span>
            </div>
            <input
              type="date"
              value={specificDate}
              onChange={(e) => {
                const val = e.target.value;
                setSpecificDate(val);
                setDateFrom(val);
                setDateTo(val);
              }}
              className="py-1 px-3 bg-white border border-indigo-200 rounded-lg text-xs font-mono font-bold text-slate-900 shadow-2xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            {specificDate && (
              <span className="text-[11px] font-semibold text-indigo-900 bg-indigo-100/80 px-2.5 py-0.5 rounded-md border border-indigo-200">
                Found {filteredSales.length} {registerMode === 'invoices' ? 'invoices' : 'sales orders'} on {formatDate(specificDate)}
              </span>
            )}
            <button
              type="button"
              onClick={() => handleDatePresetChange('all')}
              className="ml-auto text-[11px] font-bold text-slate-600 hover:text-rose-600 flex items-center gap-1 py-1 px-2.5 rounded-lg hover:bg-white/80 transition-colors border border-transparent hover:border-slate-200"
            >
              <X className="w-3.5 h-3.5" />
              <span>Clear Date Filter</span>
            </button>
          </div>
        )}

        {/* Day of Month Filter Across All Months */}
        {datePreset === 'dayOfMonth' && (
          <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-100 bg-amber-50/70 p-3 rounded-xl animate-in fade-in duration-150">
            <div className="flex items-center gap-1.5 text-amber-950 font-bold text-xs">
              <Calendar className="w-4 h-4 text-amber-600" />
              <span>Select Day of Month:</span>
            </div>
            <select
              value={selectedDay}
              onChange={(e) => setSelectedDay(e.target.value)}
              className="py-1 px-3 bg-white border border-amber-300 rounded-lg text-xs font-mono font-bold text-amber-950 shadow-2xs focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              {Array.from({ length: 31 }, (_, i) => i + 1).map(day => (
                <option key={day} value={String(day)}>Day {day} ({String(day).padStart(2, '0')})</option>
              ))}
            </select>
            <span className="text-amber-900 text-[11px] font-semibold">
              Filtering all months for Day {selectedDay} ({filteredSales.length} orders found)
            </span>
            <button
              type="button"
              onClick={() => handleDatePresetChange('all')}
              className="ml-auto text-[11px] font-bold text-slate-600 hover:text-rose-600 flex items-center gap-1 py-1 px-2.5 rounded-lg hover:bg-white/80 transition-colors border border-transparent hover:border-slate-200"
            >
              <X className="w-3.5 h-3.5" />
              <span>Clear Date Filter</span>
            </button>
          </div>
        )}

        {/* Custom Range Picker Row */}
        {datePreset === 'custom' && (
          <div className="flex flex-wrap items-center gap-2.5 pt-2 border-t border-slate-100 bg-slate-50 p-3 rounded-xl animate-in fade-in duration-150">
            <div className="flex items-center gap-1.5 text-slate-800 font-bold text-xs">
              <Calendar className="w-4 h-4 text-slate-500" />
              <span>Custom Date Range:</span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="py-1 px-2.5 bg-white border border-slate-200 rounded-lg text-xs font-mono font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
              <span className="text-slate-400 text-xs">to</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="py-1 px-2.5 bg-white border border-slate-200 rounded-lg text-xs font-mono font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
            <button
              type="button"
              onClick={() => handleDatePresetChange('all')}
              className="ml-auto text-[11px] font-bold text-slate-600 hover:text-rose-600 flex items-center gap-1 py-1 px-2.5 rounded-lg hover:bg-white transition-colors"
            >
              <X className="w-3.5 h-3.5" />
              <span>Clear Range</span>
            </button>
          </div>
        )}
      </div>

      {/* Sales Orders / Invoices Table */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse whitespace-nowrap">
            <thead>
              <tr className="bg-slate-50 text-slate-500 border-b border-slate-200 font-bold uppercase tracking-wider text-[11px] select-none">
                {registerMode === 'invoices' ? (
                  <>
                    <th onClick={() => handleSort('invDate')} className="px-4 py-3.5 cursor-pointer hover:bg-slate-100">
                      <div className="flex items-center gap-1">Payment Date (Inv Date) <ArrowUpDown className="w-3 h-3" /></div>
                    </th>
                    <th onClick={() => handleSort('invoiceNo')} className="px-4 py-3.5 cursor-pointer hover:bg-slate-100">
                      <div className="flex items-center gap-1">Invoice No <ArrowUpDown className="w-3 h-3" /></div>
                    </th>
                    <th className="px-4 py-3.5">Customer & Phone</th>
                    <th className="px-4 py-3.5">Sales Order Ref</th>
                  </>
                ) : (
                  <>
                    <th onClick={() => handleSort('orderDate')} className="px-4 py-3.5 cursor-pointer hover:bg-slate-100">
                      <div className="flex items-center gap-1">Order Date <ArrowUpDown className="w-3 h-3" /></div>
                    </th>
                    <th onClick={() => handleSort('estNo')} className="px-4 py-3.5 cursor-pointer hover:bg-slate-100">
                      <div className="flex items-center gap-1">Est / Order No <ArrowUpDown className="w-3 h-3" /></div>
                    </th>
                    <th className="px-4 py-3.5">Branch / Dept</th>
                    <th className="px-4 py-3.5">Customer & Phone</th>
                  </>
                )}
                <th className="px-4 py-3.5">Composite Items</th>
                <th onClick={() => handleSort('finalAmount')} className="px-4 py-3.5 text-right cursor-pointer hover:bg-slate-100">
                  <div className="flex items-center justify-end gap-1">Final Amount <ArrowUpDown className="w-3 h-3" /></div>
                </th>
                <th onClick={() => handleSort('paidAmount')} className="px-4 py-3.5 text-right cursor-pointer hover:bg-slate-100">
                  <div className="flex items-center justify-end gap-1">Paid <ArrowUpDown className="w-3 h-3" /></div>
                </th>
                <th onClick={() => handleSort('balanceAmount')} className="px-4 py-3.5 text-right cursor-pointer hover:bg-slate-100">
                  <div className="flex items-center justify-end gap-1">Balance <ArrowUpDown className="w-3 h-3" /></div>
                </th>
                <th className="px-4 py-3.5 text-center">Status</th>
                <th className="px-4 py-3.5 text-center w-28">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {filteredSales.length === 0 ? (
                <tr>
                  <td colSpan="10" className="text-center py-12 text-slate-400">
                    <p className="font-semibold text-slate-600 text-sm">
                      {registerMode === 'invoices' ? 'No finalized sales invoices found' : 'No sales orders found'}
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                      {registerMode === 'invoices' 
                        ? 'Clear balance due on sales orders to convert them into finalized sales invoices' 
                        : 'Click "Import Excel" to load your file or "New Order" to create an entry'}
                    </p>
                  </td>
                </tr>
              ) : (
                filteredSales.map((s) => {
                  const invNum = s.invoiceNo || `INV-26-${s.estNo}`;
                  const paymentDate = s.invDate || (s.paymentStatus === 'paid' ? s.orderDate : null);

                  return (
                    <tr key={s.id} className="hover:bg-slate-50/80 transition-colors">
                      {registerMode === 'invoices' ? (
                        <>
                          <td className="px-4 py-3 font-mono text-emerald-800 font-bold">
                            {paymentDate ? formatDate(paymentDate) : 'Settlement Pending'}
                          </td>
                          <td className="px-4 py-3">
                            <span className="font-bold text-slate-900 font-mono text-sm bg-slate-100 px-2 py-0.5 rounded">
                              {invNum}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <p className="font-bold text-slate-900">{s.customerName}</p>
                            {s.contact && (
                              <p className="text-[10px] text-slate-500 font-mono flex items-center gap-1">
                                <Phone className="w-2.5 h-2.5 text-slate-400" />
                                <span>{s.contact}</span>
                              </p>
                            )}
                          </td>
                          <td className="px-4 py-3 font-mono text-slate-600">
                            #{s.estNo} <span className="text-[10px] text-slate-400">({formatDate(s.orderDate)})</span>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="px-4 py-3 font-mono text-slate-600">{formatDate(s.orderDate)}</td>
                          <td className="px-4 py-3">
                            <span className="font-bold text-slate-900 font-mono text-sm">#{s.estNo}</span>
                            {s.orderFormNo && s.orderFormNo !== 'NA' && (
                              <p className="text-[10px] text-slate-400 font-mono">Form: {s.orderFormNo}</p>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1.5">
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-extrabold bg-slate-100 text-slate-700">
                                {s.branch}
                              </span>
                              <span className="text-[11px] font-semibold text-slate-800">{s.department}</span>
                            </div>
                            <p className="text-[10px] text-slate-400">Attender: {s.attender || 'Staff'}</p>
                          </td>
                          <td className="px-4 py-3">
                            <p className="font-bold text-slate-900">{s.customerName}</p>
                            {s.contact && (
                              <p className="text-[10px] text-slate-500 font-mono flex items-center gap-1">
                                <Phone className="w-2.5 h-2.5 text-slate-400" />
                                <span>{s.contact}</span>
                              </p>
                            )}
                          </td>
                        </>
                      )}

                      <td className="px-4 py-3 max-w-xs">
                        <div className="truncate" title={(s.items || []).map(i => `${i.product}: ${i.description}`).join(', ')}>
                          <span className="font-semibold text-slate-800">
                            {s.items && s.items[0] ? `${s.items[0].product} - ${s.items[0].description}` : 'Custom Job'}
                          </span>
                          {s.items && s.items.length > 1 && (
                            <span className="ml-1.5 px-1.5 py-0.2 bg-indigo-50 text-indigo-700 rounded text-[10px] font-bold">
                              +{s.items.length - 1} more
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="px-4 py-3 text-right font-bold text-slate-950 font-mono">
                        {formatCurrency(s.finalAmount)}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-emerald-600 font-mono">
                        {formatCurrency(s.paidAmount)}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-amber-600 font-mono">
                        {formatCurrency(s.balanceAmount)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                          s.paymentStatus === 'paid'
                            ? 'bg-emerald-100 text-emerald-800'
                            : s.paymentStatus === 'partial'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}>
                          {s.paymentStatus === 'paid' ? <CheckCircle2 className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                          {s.paymentStatus ? s.paymentStatus.toUpperCase() : 'PENDING'}
                        </span>
                      </td>

                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => onViewSale(s)}
                            className="p-1.5 text-slate-400 hover:text-brand-600 hover:bg-slate-100 rounded-lg transition-colors"
                            title="View / Print Bill"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          {/* Convert to Sales Invoice button for Sales Orders */}
                          {registerMode === 'orders' && !s.isInvoice && (
                            <button
                              onClick={() => {
                                setInvoicingSale(s);
                                setCustomInvNo(`INV-26-${s.estNo}`);
                                setCustomInvDate(s.invDate || new Date().toISOString().substring(0, 10));
                              }}
                              className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                              title="Convert to Sales Invoice"
                            >
                              <FileCheck className="w-4 h-4" />
                            </button>
                          )}

                          {s.balanceAmount > 0 && (
                            <button
                              onClick={() => {
                                setPaymentSale(s);
                                setPaymentAmount(s.balanceAmount);
                              }}
                              className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-slate-100 rounded-lg transition-colors"
                              title="Record Payment"
                            >
                              <CreditCard className="w-4 h-4" />
                            </button>
                          )}

                          <button
                            onClick={() => {
                              if (window.confirm(`Delete record #${s.estNo} for ${s.customerName}?`)) {
                                deleteSale(s.id);
                                showToast('Record deleted', 'info');
                              }
                            }}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-slate-100 rounded-lg transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Toolbar */}
        {pageSize !== 'all' && totalPages > 1 && (
          <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600 no-print">
            <div className="flex items-center gap-2">
              <span>Showing {paginatedSales.length} of {filteredSales.length} orders</span>
              <div className="flex items-center gap-1 ml-4">
                <span>Rows:</span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(e.target.value === 'all' ? 'all' : parseInt(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="bg-slate-50 border border-slate-200 rounded px-1.5 py-0.5 font-bold"
                >
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                  <option value="all">All</option>
                </select>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className="px-2.5 py-1 rounded border border-slate-200 hover:bg-slate-50 disabled:opacity-40"
              >
                Previous
              </button>

              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let p = i + 1;
                if (totalPages > 5 && currentPage > 3) {
                  p = currentPage - 2 + i;
                  if (p > totalPages) p = totalPages - (4 - i);
                }
                return (
                  <button
                    key={p}
                    onClick={() => handlePageChange(p)}
                    className={`w-7 h-7 rounded font-mono font-bold ${
                      currentPage === p
                        ? 'bg-emerald-600 text-white'
                        : 'border border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {p}
                  </button>
                );
              })}

              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="px-2.5 py-1 rounded border border-slate-200 hover:bg-slate-50 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Convert to Sales Invoice Modal (Requirement 3 & 4) */}
      {invoicingSale && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                <FileCheck className="w-4 h-4 text-indigo-600" />
                <span>Generate / Update Sales Invoice</span>
              </h3>
              <button onClick={() => setInvoicingSale(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                convertToSalesInvoice(invoicingSale.id, customInvNo, customInvDate);
                showToast(`Sales Invoice ${customInvNo} generated for order #${invoicingSale.estNo}`, 'success');
                setInvoicingSale(null);
              }}
              className="mt-4 space-y-4 text-xs"
            >
              <div>
                <p className="text-slate-500">Order / Estimate:</p>
                <p className="font-bold text-slate-900 text-sm">#{invoicingSale.estNo} - {invoicingSale.customerName}</p>
                <p className="text-slate-500 text-[11px] mt-0.5">Order Date: {formatDate(invoicingSale.orderDate)}</p>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Invoice Number (Alterable)</label>
                <input
                  type="text"
                  value={customInvNo}
                  onChange={(e) => setCustomInvNo(e.target.value)}
                  placeholder="e.g. INV-26-0456"
                  className="w-full py-2 px-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 font-mono text-sm font-bold"
                  required
                />
                <p className="text-[10px] text-slate-400 mt-1">You can change or format this number according to your billing books.</p>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Invoice Date (Payment Date)</label>
                <input
                  type="date"
                  value={customInvDate}
                  onChange={(e) => setCustomInvDate(e.target.value)}
                  className="w-full py-2 px-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 font-mono text-sm"
                  required
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setInvoicingSale(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-sm"
                >
                  Confirm & Invoiced
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reset Confirmation Modal (Requirement 1) */}
      {showResetConfirm && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center gap-3 text-rose-600 mb-3">
              <div className="p-2.5 rounded-full bg-rose-100">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-slate-900 text-base">Reset All Sales Data?</h3>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              This will permanently wipe all {sales.length} sales orders and invoices from the database. 
              <strong> The Profit & Loss Account will automatically update to reflect zero sales immediately.</strong>
            </p>

            <p className="text-xs text-slate-400 mt-2">
              (You can re-import your Excel file anytime by clicking the "Import Excel" button.)
            </p>

            <div className="mt-6 flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowResetConfirm(false)}
                className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  clearAllSales();
                  setShowResetConfirm(false);
                  showToast('All sales records have been wiped out completely!', 'success');
                }}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white rounded-xl text-xs font-bold shadow-sm transition-all"
                title="Completely wipe out all sales data"
              >
                Wipe Out All Data
              </button>
              <button
                type="button"
                onClick={() => {
                  const count = restoreDefaultSales();
                  setShowResetConfirm(false);
                  showToast(`Reloaded original ${count} September 2026 sales orders!`, 'success');
                }}
                className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-medium transition-all"
                title="Restore default September demo dataset"
              >
                Reset to Default Demo
              </button>
            </div>
          </div>
        </div>
      )}


      {/* Record Payment Modal */}
      {paymentSale && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-sm">Record Customer Payment</h3>
              <button onClick={() => setPaymentSale(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleRecordPaymentSubmit} className="mt-4 space-y-4 text-xs">
              <div>
                <p className="text-slate-500">Order / Estimate:</p>
                <p className="font-bold text-slate-900 text-sm">#{paymentSale.estNo} - {paymentSale.customerName}</p>
                <p className="text-amber-600 font-semibold mt-0.5">
                  Remaining Balance: {formatCurrency(paymentSale.balanceAmount)}
                </p>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Payment Amount (₹)</label>
                <input
                  type="number"
                  step="any"
                  max={paymentSale.balanceAmount}
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  className="w-full py-2 px-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 font-mono text-sm"
                  required
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-slate-700 font-semibold">Payment Method</label>
                  <button
                    type="button"
                    onClick={() => setShowPaymentMethodModal(true)}
                    className="text-[11px] font-bold text-brand-600 hover:text-brand-800 flex items-center gap-0.5 cursor-pointer"
                    title="Add new bank or payment method"
                  >
                    <Plus className="w-3 h-3" /> Add
                  </button>
                </div>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full py-2 px-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 font-semibold"
                >
                  {paymentMethods.map(pm => (
                    <option key={pm} value={pm}>{pm}</option>
                  ))}
                </select>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setPaymentSale(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold shadow-sm"
                >
                  Confirm Payment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Quick Add Master Modal for Payment Method */}
      {showPaymentMethodModal && (
        <QuickAddMasterModal
          type="paymentMethod"
          onClose={() => setShowPaymentMethodModal(false)}
          onAdd={handleAddPaymentMethod}
        />
      )}

      {/* Import Modal */}
      <ImportSalesModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onImportSuccess={(newOrders) => {
          const count = importSalesBulk(newOrders);
          showToast(`Successfully imported ${count} composite sales orders!`, 'success');
        }}
        showToast={showToast}
      />
    </div>
  );
}
