import React, { useState, useMemo, useEffect } from 'react';
import { useData } from '../../context/DataContext';
import { useAuth } from '../../context/AuthContext';
import { useSettings } from '../../context/SettingsContext';
import { useToast } from '../../context/ToastContext';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { exportBillsToExcel, exportPurchaseRegisterReportExcel } from '../../utils/exportUtils';
import { 
  Search, 
  Plus, 
  FileSpreadsheet, 
  ArrowUpDown, 
  Eye, 
  Edit2, 
  Trash2, 
  CreditCard, 
  CheckCircle2, 
  Clock, 
  AlertCircle,
  Filter,
  X,
  CloudOff,
  RotateCcw,
  Calendar,
  AlertTriangle,
  History,
  Sparkles,
  Printer,
  ArrowLeft
} from 'lucide-react';

export default function BillsList({ onOpenCreateBill, onEditBill, onViewBill, onOpenPaymentModal, onRequestDelete }) {
  const { bills, vendors, recycleBin, recycleBinCount, restoreBill, permanentDeleteBill } = useData();
  const { isAdmin, openLoginModal } = useAuth();
  const { profile } = useSettings();
  const { showToast } = useToast();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [vendorFilter, setVendorFilter] = useState('');
  const [datePreset, setDatePreset] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [specificDate, setSpecificDate] = useState('');
  
  const [sortField, setSortField] = useState('date');
  const [sortDirection, setSortDirection] = useState('desc');
  const [showRecycleBinModal, setShowRecycleBinModal] = useState(false);
  const [showPrintReportModal, setShowPrintReportModal] = useState(false);

  // Close print report modal on Escape key press
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setShowPrintReportModal(false);
      }
    };
    if (showPrintReportModal) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showPrintReportModal]);

  // Offline vouchers count
  const offlineBillsCount = useMemo(() => {
    return bills.filter(b => Boolean(b._isPendingSync)).length;
  }, [bills]);

  // Handle Quick Date Range Preset Dropdown
  const handleDatePresetChange = (preset) => {
    setDatePreset(preset);
    const today = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const toISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

    if (preset === 'all' || preset === 'offlineOnly') {
      setDateFrom('');
      setDateTo('');
      setSpecificDate('');
    } else if (preset === 'specific') {
      const initial = specificDate || dateFrom || toISO(today);
      setSpecificDate(initial);
      setDateFrom(initial);
      setDateTo(initial);
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
      setDateFrom(d);
      setDateTo(d);
    } else if (preset === 'last7Days') {
      const past = new Date(today);
      past.setDate(past.getDate() - 7);
      setDateFrom(toISO(past));
      setDateTo(toISO(today));
    } else if (preset === 'thisMonth') {
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
      const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      setDateFrom(toISO(firstDay));
      setDateTo(toISO(lastDay));
    } else if (preset === 'lastMonth') {
      const firstDay = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const lastDay = new Date(today.getFullYear(), today.getMonth(), 0);
      setDateFrom(toISO(firstDay));
      setDateTo(toISO(lastDay));
    } else if (preset === 'last3Months') {
      const past = new Date(today);
      past.setDate(past.getDate() - 90);
      setDateFrom(toISO(past));
      setDateTo(toISO(today));
    } else if (preset === 'last6Months') {
      const past = new Date(today);
      past.setDate(past.getDate() - 180);
      setDateFrom(toISO(past));
      setDateTo(toISO(today));
    } else if (preset === 'thisFY') {
      const currYear = today.getFullYear();
      const currMonth = today.getMonth(); // 0-indexed: 3 = April
      const fyStartYear = currMonth >= 3 ? currYear : currYear - 1;
      const start = `${fyStartYear}-04-01`;
      const end = `${fyStartYear + 1}-03-31`;
      setDateFrom(start);
      setDateTo(end);
    } else if (preset === 'last1Year') {
      const past = new Date(today);
      past.setDate(past.getDate() - 365);
      setDateFrom(toISO(past));
      setDateTo(toISO(today));
    }
  };

  // Multi-Filter and Search Logic
  const filteredBills = useMemo(() => {
    return bills.filter(bill => {
      const q = search.toLowerCase();
      const matchesSearch = !search || 
        (bill.invoiceNo && bill.invoiceNo.toLowerCase().includes(q)) ||
        (bill.vendorName && bill.vendorName.toLowerCase().includes(q)) ||
        (bill.items && bill.items.some(i => i.name && i.name.toLowerCase().includes(q)));

      const matchesStatus = statusFilter === 'all' || bill.paymentStatus === statusFilter;
      const matchesVendor = !vendorFilter || bill.vendorId === vendorFilter || bill.vendorName === vendorFilter;

      let matchesDate = true;
      if (datePreset === 'offlineOnly') {
        matchesDate = Boolean(bill._isPendingSync);
      } else {
        if (dateFrom && bill.date) {
          matchesDate = matchesDate && bill.date >= dateFrom;
        }
        if (dateTo && bill.date) {
          matchesDate = matchesDate && bill.date <= dateTo;
        }
      }

      return matchesSearch && matchesStatus && matchesVendor && matchesDate;
    }).sort((a, b) => {
      let valA = a[sortField] || '';
      let valB = b[sortField] || '';

      if (sortField === 'grandTotal' || sortField === 'balanceAmount' || sortField === 'paidAmount') {
        valA = parseFloat(valA) || 0;
        valB = parseFloat(valB) || 0;
        return sortDirection === 'asc' ? valA - valB : valB - valA;
      }

      if (sortField === 'date') {
        valA = new Date(valA).getTime() || 0;
        valB = new Date(valB).getTime() || 0;
        return sortDirection === 'asc' ? valA - valB : valB - valA;
      }

      return sortDirection === 'asc' 
        ? String(valA).localeCompare(String(valB))
        : String(valB).localeCompare(String(valA));
    });
  }, [bills, search, statusFilter, vendorFilter, datePreset, dateFrom, dateTo, sortField, sortDirection]);

  // Aggregate Metrics for Filtered Bills
  const summary = useMemo(() => {
    let totalAmt = 0;
    let totalBal = 0;
    filteredBills.forEach(b => {
      totalAmt += (parseFloat(b.grandTotal) || 0);
      totalBal += (parseFloat(b.balanceAmount) || 0);
    });
    return { count: filteredBills.length, totalAmt, totalBal };
  }, [filteredBills]);

  // Totals for the 8-column Purchase Register Report:
  // Date, Invoice No, Merchant, Product, Amount, Packing Chg, Taxes, Total Amnt
  const reportTotals = useMemo(() => {
    let baseAmount = 0;
    let packingChg = 0;
    let taxes = 0;
    let totalAmnt = 0;

    filteredBills.forEach(b => {
      baseAmount += parseFloat(b.taxableBase ?? b.subtotal ?? 0);
      packingChg += parseFloat(b.packing || 0);
      taxes += parseFloat(b.taxAmount || 0);
      totalAmnt += parseFloat(b.grandTotal || 0);
    });

    return {
      baseAmount,
      packingChg,
      taxes,
      totalAmnt
    };
  }, [filteredBills]);

  const handleExportPurchaseReport = () => {
    if (filteredBills.length === 0) {
      showToast('No bills available in current filter to export', 'error');
      return;
    }
    const label = datePreset !== 'all' ? datePreset : (dateFrom && dateTo ? `${dateFrom}_to_${dateTo}` : 'All_Dates');
    const ok = exportPurchaseRegisterReportExcel(filteredBills, label);
    if (ok) showToast('Purchase Register Report exported to Excel', 'success');
  };

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const handleExport = () => {
    if (filteredBills.length === 0) {
      showToast('No bills available to export', 'error');
      return;
    }
    const ok = exportBillsToExcel(filteredBills);
    if (ok) showToast('Purchases exported to Excel', 'success');
  };

  const clearFilters = () => {
    setSearch('');
    setStatusFilter('all');
    setVendorFilter('');
    setDatePreset('all');
    setDateFrom('');
    setDateTo('');
  };

  const hasActiveFilters = search || statusFilter !== 'all' || vendorFilter || datePreset !== 'all' || dateFrom || dateTo;

  // Restore Voucher Handler
  const handleRestore = async (id) => {
    try {
      await restoreBill(id);
      showToast('Voucher successfully restored to Purchase Register', 'success');
    } catch (err) {
      showToast('Failed to restore voucher', 'error');
    }
  };

  // Permanent Delete Handler
  const handlePermanentDelete = async (id) => {
    if (!isAdmin) {
      showToast('Admin access required to permanently delete records', 'error');
      openLoginModal();
      return;
    }
    try {
      await permanentDeleteBill(id);
      showToast('Voucher permanently removed from bin', 'success');
    } catch (err) {
      showToast('Failed to purge voucher', 'error');
    }
  };

  // Helper: Format countdown till expiry
  const getExpiryCountdown = (expiresAt) => {
    if (!expiresAt) return '3 days remaining';
    const diffMs = new Date(expiresAt).getTime() - Date.now();
    if (diffMs <= 0) return 'Expired (Purging soon)';
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);
    const remHours = hours % 24;
    if (days > 0) return `${days}d ${remHours}h remaining`;
    return `${hours}h remaining`;
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Offline Vouchers Notification Banner */}
      {offlineBillsCount > 0 && (
        <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm animate-in fade-in">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 border border-amber-300 flex items-center justify-center flex-shrink-0">
              <CloudOff className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-amber-950">
                📥 {offlineBillsCount} {offlineBillsCount === 1 ? 'Voucher' : 'Vouchers'} Entered While Offline
              </h4>
              <p className="text-[11px] text-amber-800 mt-0.5">
                Saved locally on this device. They will automatically synchronize to Google Firebase Cloud as soon as your internet reconnects.
              </p>
            </div>
          </div>
          <button
            onClick={() => handleDatePresetChange('offlineOnly')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 flex-shrink-0 ${
              datePreset === 'offlineOnly'
                ? 'bg-amber-900 text-white'
                : 'bg-amber-600 hover:bg-amber-700 text-white'
            }`}
          >
            <Eye className="w-3.5 h-3.5" /> 
            <span>{datePreset === 'offlineOnly' ? 'Showing Offline Vouchers' : `Filter Offline (${offlineBillsCount})`}</span>
          </button>
        </div>
      )}

      {/* Top Action Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">Purchase Register</h2>
          <p className="text-xs text-slate-500 mt-0.5">Track, filter, and settle your supplier procurement invoices</p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
          {/* Recycle Bin Button */}
          <button
            onClick={() => setShowRecycleBinModal(true)}
            className="flex items-center justify-center gap-1.5 px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-semibold transition-colors shadow-sm"
            title="Open Recycle Bin (3-day recovery)"
          >
            <Trash2 className="w-3.5 h-3.5 text-rose-600" />
            <span>Recycle Bin ({recycleBinCount || 0})</span>
          </button>

          {/* Print Purchase Report (8-column) */}
          <button
            onClick={() => setShowPrintReportModal(true)}
            className="flex items-center justify-center gap-1.5 px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-semibold transition-colors shadow-sm"
            title="Print structured 8-column Purchase Register Report"
          >
            <Printer className="w-3.5 h-3.5 text-indigo-600" />
            <span>Print Report</span>
          </button>

          <button
            onClick={handleExport}
            className="flex items-center justify-center gap-2 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors border border-slate-200 shadow-sm"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" /> Export Excel
          </button>
          <button
            onClick={onOpenCreateBill}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-semibold transition-all shadow-md hover:shadow-lg"
          >
            <Plus className="w-4 h-4" /> New Purchase Bill
          </button>
        </div>
      </div>

      {/* Summary KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Filtered Bills</p>
          <p className="text-xl font-bold text-slate-900 mt-0.5">{summary.count} Bills</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Total Value</p>
          <p className="text-xl font-bold text-slate-900 mt-0.5">{formatCurrency(summary.totalAmt)}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Unsettled Balance</p>
          <p className="text-xl font-bold text-amber-600 mt-0.5">{formatCurrency(summary.totalBal)}</p>
        </div>
      </div>

      {/* Search & Multi-Filters Toolbar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3">
        <div className="flex flex-col md:flex-row items-center gap-3">
          {/* Search Box */}
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by invoice number, vendor, or item name..."
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-1 focus:ring-brand-500 transition-all"
            />
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-1.5 w-full md:w-auto">
            {['all', 'unpaid', 'partial', 'paid'].map(status => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all ${
                  statusFilter === status
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {status}
              </button>
            ))}
          </div>
        </div>

        {/* Extended Filters: Vendor + Date Range Preset Dropdown */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 pt-2 border-t border-slate-100 text-xs">
          {/* Vendor Filter */}
          <div>
            <label className="block text-slate-500 font-semibold mb-1">Filter by Vendor</label>
            <select
              value={vendorFilter}
              onChange={(e) => setVendorFilter(e.target.value)}
              className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-brand-500 bg-white font-medium text-slate-800"
            >
              <option value="">All Vendors</option>
              {vendors.map(v => (
                <option key={v.id} value={v.name}>{v.name}</option>
              ))}
            </select>
          </div>

          {/* Date Range Preset Dropdown (Query 3) */}
          <div className={datePreset === 'custom' ? 'sm:col-span-1' : 'sm:col-span-2'}>
            <label className="block text-slate-500 font-semibold mb-1 flex items-center justify-between">
              <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5 text-brand-600" /> Date Period</span>
              {datePreset !== 'all' && (
                <span className="text-[10px] text-brand-600 font-bold uppercase">
                  {datePreset === 'offlineOnly' ? 'Offline Only' : dateFrom && dateTo ? `${dateFrom} to ${dateTo}` : datePreset}
                </span>
              )}
            </label>
            <div className="flex gap-2">
              <select
                value={datePreset}
                onChange={(e) => handleDatePresetChange(e.target.value)}
                className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-brand-500 bg-white font-medium text-slate-800"
              >
                <option value="all">📅 All Dates (Lifetime)</option>
                <option value="today">Today</option>
                <option value="yesterday">Yesterday</option>
                <option value="last7Days">Last 7 Days (1 Week)</option>
                <option value="thisMonth">This Month</option>
                <option value="lastMonth">Last Month</option>
                <option value="last3Months">Last 3 Months (90 Days)</option>
                <option value="last6Months">Last 6 Months (180 Days)</option>
                <option value="thisFY">This Financial Year (Apr - Mar)</option>
                <option value="last1Year">Last 1 Year (365 Days)</option>
                {offlineBillsCount > 0 && (
                  <option value="offlineOnly">📥 Pending Offline Vouchers ({offlineBillsCount})</option>
                )}
                <option value="specific">🎯 Specific Date (Single Day)</option>
                <option value="custom">⚙️ Custom Date Range (Pick Dates)...</option>
              </select>

              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="px-3 py-2 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-700 rounded-xl transition-colors flex items-center gap-1 flex-shrink-0 font-semibold text-xs"
                  title="Clear all filters"
                >
                  <X className="w-3.5 h-3.5" /> Clear
                </button>
              )}
            </div>
          </div>

          {/* Specific Date Picker */}
          {datePreset === 'specific' && (
            <div className="sm:col-span-3 p-3 bg-indigo-50/70 rounded-xl border border-indigo-200 animate-in fade-in flex items-center gap-3">
              <Calendar className="w-4 h-4 text-indigo-600" />
              <span className="font-bold text-indigo-950 text-xs">Select Specific Date:</span>
              <input
                type="date"
                value={specificDate}
                onChange={(e) => {
                  const val = e.target.value;
                  setSpecificDate(val);
                  setDateFrom(val);
                  setDateTo(val);
                }}
                className="py-1 px-3 bg-white border border-indigo-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono text-xs font-bold text-slate-900 shadow-2xs"
              />
            </div>
          )}

          {/* Custom Date Pickers (Only visible when 'custom' is selected) */}
          {datePreset === 'custom' && (
            <div className="sm:col-span-3 grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200 animate-in fade-in">
              <div>
                <label className="block text-slate-500 font-semibold mb-1 text-[11px]">From Date</label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="w-full py-1.5 px-3 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-500 font-mono text-xs"
                />
              </div>
              <div>
                <label className="block text-slate-500 font-semibold mb-1 text-[11px]">To Date</label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="w-full py-1.5 px-3 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-500 font-mono text-xs"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bills Data Table */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse whitespace-nowrap">
            <thead>
              <tr className="bg-slate-50 text-slate-500 border-b border-slate-200 text-xs uppercase font-semibold tracking-wider select-none">
                <th
                  onClick={() => handleSort('date')}
                  className="px-6 py-4 cursor-pointer hover:bg-slate-100 transition-colors"
                >
                  <div className="flex items-center gap-1.5">
                    Date <ArrowUpDown className="w-3.5 h-3.5" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('invoiceNo')}
                  className="px-6 py-4 cursor-pointer hover:bg-slate-100 transition-colors"
                >
                  <div className="flex items-center gap-1.5">
                    Invoice No <ArrowUpDown className="w-3.5 h-3.5" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('vendorName')}
                  className="px-6 py-4 cursor-pointer hover:bg-slate-100 transition-colors"
                >
                  <div className="flex items-center gap-1.5">
                    Vendor <ArrowUpDown className="w-3.5 h-3.5" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('grandTotal')}
                  className="px-6 py-4 text-right cursor-pointer hover:bg-slate-100 transition-colors"
                >
                  <div className="flex items-center justify-end gap-1.5">
                    Amount <ArrowUpDown className="w-3.5 h-3.5" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('balanceAmount')}
                  className="px-6 py-4 text-right cursor-pointer hover:bg-slate-100 transition-colors"
                >
                  <div className="flex items-center justify-end gap-1.5">
                    Balance <ArrowUpDown className="w-3.5 h-3.5" />
                  </div>
                </th>
                <th className="px-6 py-4 text-center">Payment Status</th>
                <th className="px-6 py-4 text-center w-32">Actions</th>
              </tr>
            </thead>
            <tbody className="text-sm divide-y divide-slate-100 text-slate-700">
              {filteredBills.length === 0 ? (
                <tr>
                  <td colSpan="7" className="text-center py-12 text-slate-400">
                    <p className="text-base font-semibold text-slate-700">No purchase bills match your criteria</p>
                    <p className="text-xs text-slate-400 mt-1">Try clearing filters or create a new purchase bill</p>
                  </td>
                </tr>
              ) : (
                filteredBills.map((b) => (
                  <tr key={b.id} className={`hover:bg-slate-50/80 transition-colors ${b._isPendingSync ? 'bg-amber-50/40' : ''}`}>
                    <td className="px-6 py-4 text-slate-600 text-xs font-mono">
                      {formatDate(b.date)}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 font-mono">
                          {b.invoiceNo || 'N/A'}
                        </span>
                        {/* Offline Visual Draft Badge (Query 1) */}
                        {b._isPendingSync && (
                          <span 
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300 shadow-xs"
                            title="Saved locally on this device. Will sync to Firebase once network reconnects."
                          >
                            <CloudOff className="w-2.5 h-2.5 text-amber-600" />
                            <span>Offline Draft</span>
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-semibold text-slate-800">{b.vendorName || 'Unknown Vendor'}</div>
                      <div className="text-[11px] text-slate-400">
                        {b.isGst ? `GSTIN: ${b.gstin || 'YES'}` : 'Unregistered'}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right font-bold text-slate-900">
                      {formatCurrency(b.grandTotal)}
                    </td>
                    <td className="px-6 py-4 text-right font-semibold text-amber-600 text-xs">
                      {formatCurrency(b.balanceAmount ?? b.grandTotal)}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                        b.paymentStatus === 'paid'
                          ? 'bg-emerald-100 text-emerald-800'
                          : b.paymentStatus === 'partial'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}>
                        {b.paymentStatus === 'paid' ? <CheckCircle2 className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                        {b.paymentStatus ? b.paymentStatus.toUpperCase() : 'UNPAID'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => onViewBill(b.id)}
                          className="p-1.5 text-slate-400 hover:text-brand-600 hover:bg-slate-100 rounded-lg transition-colors"
                          title="View Tax Invoice"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => onOpenPaymentModal(b)}
                          className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                          title="Record Payment"
                        >
                          <CreditCard className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => onEditBill(b.id)}
                          className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                          title="Edit Bill (Admin PIN Required)"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => onRequestDelete('bills', b.id, `Invoice #${b.invoiceNo || b.id}`)}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Move to Recycle Bin (Admin PIN Required)"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recycle Bin Modal (Query 4 - 3 Day Recovery) */}
      {showRecycleBinModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/75 backdrop-blur-md animate-in fade-in duration-200 overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden my-auto">
            {/* Modal Header */}
            <div className="p-5 sm:p-6 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center justify-center shadow-inner">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold">Voucher Recycle Bin</h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Deleted vouchers are held here for 3 days (72h) before permanent removal
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowRecycleBinModal(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-4 sm:p-6 flex-1 overflow-y-auto space-y-4">
              {recycleBin.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3">
                    <Trash2 className="w-8 h-8 text-slate-300" />
                  </div>
                  <h4 className="text-sm font-bold text-slate-700">Recycle Bin is Empty</h4>
                  <p className="text-xs text-slate-400 mt-1">No deleted vouchers currently pending recovery.</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100 border border-slate-200 rounded-2xl overflow-hidden">
                  {recycleBin.map((item) => (
                    <div key={item.id} className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 hover:bg-slate-50 transition-colors">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-slate-900 text-sm">
                            #{item.invoiceNo || item.id}
                          </span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700 border border-rose-200">
                            {getExpiryCountdown(item.expiresAt)}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 font-medium">
                          Vendor: <span className="font-semibold text-slate-800">{item.vendorName || 'N/A'}</span> • Amount: <span className="font-mono font-bold text-slate-900">₹{(parseFloat(item.grandTotal) || 0).toLocaleString('en-IN')}</span>
                        </p>
                        <p className="text-[11px] text-slate-400">
                          Deleted on {new Date(item.deletedAt || Date.now()).toLocaleString()}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 self-end sm:self-center">
                        <button
                          onClick={() => handleRestore(item.id)}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 active:bg-emerald-200 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-bold transition-all shadow-xs"
                          title="Restore back to Purchase Register"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>Restore</span>
                        </button>
                        <button
                          onClick={() => handlePermanentDelete(item.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                          title="Purge permanently (Admin PIN Required)"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-between items-center text-xs">
              <span className="text-slate-500 font-medium">
                {recycleBin.length} {recycleBin.length === 1 ? 'item' : 'items'} in trash
              </span>
              <button
                onClick={() => setShowRecycleBinModal(false)}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-semibold transition-colors shadow-sm"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Printable Purchase Register Report Modal (Exact 8 Columns) */}
      {showPrintReportModal && (
        <div 
          className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 overflow-hidden animate-in fade-in duration-150"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowPrintReportModal(false);
          }}
        >
          {/* Floating Emergency Close Button (Always visible at top-right corner of screen) */}
          <button
            onClick={() => setShowPrintReportModal(false)}
            className="no-print fixed top-3 right-3 sm:top-5 sm:right-5 z-[70] p-2.5 bg-slate-900/95 hover:bg-rose-600 text-white rounded-full shadow-2xl transition-all border border-slate-700 hover:scale-105 flex items-center gap-1.5 px-3.5 text-xs font-bold cursor-pointer"
            title="Cancel / Return to Register (or press Esc)"
          >
            <X className="w-4 h-4" />
            <span>Close (Esc)</span>
          </button>

          <div className="bg-white rounded-2xl max-w-6xl w-full max-h-[94vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-150 relative">
            {/* Top Fixed Action Bar (Always Visible, Hidden on Print) */}
            <div className="no-print bg-slate-900 text-white p-3.5 sm:p-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-b border-slate-800 flex-shrink-0 shadow-sm">
              <div className="flex items-center gap-2 sm:gap-3">
                <button
                  onClick={() => setShowPrintReportModal(false)}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-white rounded-xl text-xs font-bold transition-all border border-slate-700 shadow-sm"
                  title="Return to Purchase Register table"
                >
                  <ArrowLeft className="w-4 h-4 text-brand-400" />
                  <span>Back to Register</span>
                </button>
                <div className="h-5 w-px bg-slate-700 hidden sm:block" />
                <div>
                  <h3 className="font-bold text-xs sm:text-sm text-white leading-tight">
                    Purchase Register Report Preview
                  </h3>
                  <p className="text-[10px] sm:text-[11px] text-slate-400">
                    {filteredBills.length} {filteredBills.length === 1 ? 'record' : 'records'} matching current filter
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 justify-end flex-wrap">
                <button
                  onClick={() => window.print()}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white rounded-xl text-xs font-bold shadow-sm transition-all"
                  title="Open Print Dialog"
                >
                  <Printer className="w-4 h-4" />
                  <span>Print Report</span>
                </button>
                <button
                  onClick={handleExportPurchaseReport}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all"
                  title="Export to Excel"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>Export Excel</span>
                </button>
                <button
                  onClick={() => setShowPrintReportModal(false)}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-colors shadow-sm"
                  title="Cancel preview"
                >
                  <X className="w-4 h-4" />
                  <span>Cancel / Close</span>
                </button>
              </div>
            </div>

            {/* Scrollable Printable Report Document */}
            <div id="purchase-register-printable-area" className="printable-document flex-1 overflow-y-auto p-4 sm:p-8 space-y-6 text-slate-800 bg-white">
              {/* Report Header & Letterhead */}
              <div className="border-b-2 border-slate-900 pb-5 flex flex-col sm:flex-row justify-between items-start gap-4">

                <div>
                  <h1 className="text-2xl font-black text-slate-950 tracking-tight">
                    {profile.businessName || 'RS Purchase Enterprise'}
                  </h1>
                  <p className="text-xs text-slate-600 mt-1 max-w-lg">{profile.address || 'Enterprise Procurement Division'}</p>
                  <div className="flex flex-wrap gap-4 text-xs font-medium text-slate-600 mt-2">
                    <span><strong>GSTIN:</strong> {profile.gstin || 'UNREGISTERED'}</span>
                    {profile.phone && <span><strong>Phone:</strong> {profile.phone}</span>}
                    {profile.email && <span><strong>Email:</strong> {profile.email}</span>}
                  </div>
                </div>
                <div className="sm:text-right">
                  <span className="inline-block bg-indigo-50 text-indigo-900 text-xs font-extrabold uppercase px-3 py-1 rounded-md tracking-wider border border-indigo-200">
                    Official Purchase Register
                  </span>
                  <p className="text-xs text-slate-500 mt-2">Generated On:</p>
                  <p className="text-xs font-bold text-slate-900">
                    {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </p>
                  {(dateFrom || dateTo) && (
                    <p className="text-[11px] text-slate-500 mt-0.5 font-medium">
                      Period: {dateFrom ? formatDate(dateFrom) : 'Beginning'} to {dateTo ? formatDate(dateTo) : 'Present'}
                    </p>
                  )}
                </div>
              </div>

              {/* Summary Metric Strip */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div>
                  <p className="text-[10px] font-bold text-slate-500 uppercase">Total Invoices</p>
                  <p className="text-base font-extrabold text-slate-900 mt-0.5">{filteredBills.length}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-500 uppercase">Taxable / Base Amount</p>
                  <p className="text-base font-extrabold text-slate-900 mt-0.5">{formatCurrency(reportTotals.baseAmount)}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-500 uppercase">Packing & Taxes</p>
                  <p className="text-base font-extrabold text-slate-900 mt-0.5">{formatCurrency(reportTotals.packingChg + reportTotals.taxes)}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-indigo-600 uppercase">Grand Total Amount</p>
                  <p className="text-base font-black text-indigo-950 mt-0.5">{formatCurrency(reportTotals.totalAmnt)}</p>
                </div>
              </div>

              {/* Table with EXACT requested 8 columns:
                  1. Date
                  2. Invoice No
                  3. Merchant
                  4. Product
                  5. Amount
                  6. Packing Chg
                  7. Taxes
                  8. Total Amnt
              */}
              <div className="overflow-x-auto border border-slate-300 rounded-lg">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-100 border-b border-slate-300 font-bold text-slate-800 uppercase tracking-wider text-[11px]">
                      <th className="px-3 py-2.5 whitespace-nowrap">Date</th>
                      <th className="px-3 py-2.5 whitespace-nowrap">Invoice No</th>
                      <th className="px-3 py-2.5">Merchant</th>
                      <th className="px-3 py-2.5">Product</th>
                      <th className="px-3 py-2.5 text-right whitespace-nowrap">Amount</th>
                      <th className="px-3 py-2.5 text-right whitespace-nowrap">Packing Chg</th>
                      <th className="px-3 py-2.5 text-right whitespace-nowrap">Taxes</th>
                      <th className="px-3 py-2.5 text-right whitespace-nowrap">Total Amnt</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {filteredBills.length === 0 ? (
                      <tr>
                        <td colSpan="8" className="py-8 text-center text-slate-400 text-xs">
                          No purchase bills found matching current selection.
                        </td>
                      </tr>
                    ) : (
                      filteredBills.map((b, idx) => {
                        const productNames = (b.items && b.items.length > 0)
                          ? b.items.map(i => `${i.name || 'Item'} (${i.qty} ${i.uqc || 'NOS'})`).join(', ')
                          : (b.productName || 'Goods');
                        const baseAmt = parseFloat(b.taxableBase ?? b.subtotal ?? 0);
                        const packAmt = parseFloat(b.packing || 0);
                        const taxAmt = parseFloat(b.taxAmount || 0);
                        const grandAmt = parseFloat(b.grandTotal || 0);

                        return (
                          <tr key={b.id || idx} className="hover:bg-slate-50/70 transition-colors">
                            <td className="px-3 py-2.5 whitespace-nowrap font-medium text-slate-600">
                              {formatDate(b.date)}
                            </td>
                            <td className="px-3 py-2.5 whitespace-nowrap font-bold text-slate-900">
                              {b.invoiceNo || 'N/A'}
                            </td>
                            <td className="px-3 py-2.5 font-semibold text-slate-800">
                              {b.vendorName || 'Unknown Vendor'}
                            </td>
                            <td className="px-3 py-2.5 text-slate-600 max-w-xs truncate" title={productNames}>
                              {productNames}
                            </td>
                            <td className="px-3 py-2.5 text-right font-medium text-slate-800 whitespace-nowrap">
                              {formatCurrency(baseAmt)}
                            </td>
                            <td className="px-3 py-2.5 text-right text-slate-600 whitespace-nowrap">
                              {packAmt > 0 ? formatCurrency(packAmt) : '-'}
                            </td>
                            <td className="px-3 py-2.5 text-right text-slate-600 whitespace-nowrap">
                              {taxAmt > 0 ? formatCurrency(taxAmt) : '-'}
                            </td>
                            <td className="px-3 py-2.5 text-right font-bold text-slate-950 whitespace-nowrap">
                              {formatCurrency(grandAmt)}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-100 border-t-2 border-slate-900 font-black text-slate-950 text-xs">
                      <td className="px-3 py-3 font-bold uppercase" colSpan="2">
                        TOTAL
                      </td>
                      <td className="px-3 py-3 text-slate-700">
                        {filteredBills.length} Invoices
                      </td>
                      <td className="px-3 py-3"></td>
                      <td className="px-3 py-3 text-right">
                        {formatCurrency(reportTotals.baseAmount)}
                      </td>
                      <td className="px-3 py-3 text-right">
                        {formatCurrency(reportTotals.packingChg)}
                      </td>
                      <td className="px-3 py-3 text-right">
                        {formatCurrency(reportTotals.taxes)}
                      </td>
                      <td className="px-3 py-3 text-right text-indigo-950 text-sm">
                        {formatCurrency(reportTotals.totalAmnt)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Footnote */}
              <div className="flex justify-between items-center text-[10px] text-slate-400 border-t border-slate-100 pt-3">
                <span>RSPurchase Enterprise Offline-First System</span>
                <span>Page 1 of 1</span>
              </div>
            </div>

            {/* Bottom Fixed Navigation Bar (Always Visible, Hidden on Print) */}
            <div className="no-print bg-slate-100 border-t border-slate-200 p-3 sm:p-4 flex flex-col sm:flex-row items-center justify-between gap-3 flex-shrink-0">
              <button
                onClick={() => setShowPrintReportModal(false)}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2.5 bg-white hover:bg-slate-200 active:bg-slate-300 text-slate-800 font-bold rounded-xl text-xs border border-slate-300 shadow-sm transition-colors"
              >
                <ArrowLeft className="w-4 h-4 text-brand-600" />
                <span>Back to Purchase Register</span>
              </button>

              <div className="w-full sm:w-auto flex items-center justify-end gap-2">
                <button
                  onClick={handleExportPurchaseReport}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs shadow-sm transition-colors"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>Export Excel</span>
                </button>
                <button
                  onClick={() => window.print()}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs shadow-sm transition-colors"
                >
                  <Printer className="w-4 h-4" />
                  <span>Print Report Now</span>
                </button>
                <button
                  onClick={() => setShowPrintReportModal(false)}
                  className="flex items-center justify-center gap-1 px-4 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold rounded-xl text-xs transition-colors"
                >
                  <X className="w-4 h-4" />
                  <span>Cancel / Close</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
