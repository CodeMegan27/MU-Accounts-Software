import React, { useState, useMemo } from 'react';
import { useData } from '../../context/DataContext';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { 
  ArrowDownLeft, 
  Search, 
  Filter, 
  FileSpreadsheet, 
  ArrowUpRight, 
  Phone, 
  AlertCircle, 
  Clock, 
  CheckCircle2, 
  ChevronRight, 
  Users, 
  Calendar,
  AlertTriangle,
  Receipt,
  X,
  CheckSquare,
  Square,
  Calculator,
  ShoppingBag
} from 'lucide-react';
import * as XLSX from 'xlsx';

export default function ReceivablesView({ onViewSale, onRecordPayment, onNavigate }) {
  const { sales = [] } = useData();

  const [activeSubTab, setActiveSubTab] = useState('customers'); // 'customers' | 'orders'
  const [searchTerm, setSearchTerm] = useState('');
  const [agingFilter, setAgingFilter] = useState('all'); // 'all', 'gt25', '15_24', '7_14', 'lt7'
  const [sortBy, setSortBy] = useState('balance_desc'); // 'balance_desc', 'days_desc', 'name_asc', 'date_desc'
  const [selectedCustomerKeys, setSelectedCustomerKeys] = useState([]);
  const [selectedOrderIds, setSelectedOrderIds] = useState([]);

  // Compute Full Customer Receivables & Aging System
  const receivablesData = useMemo(() => {
    const now = new Date();
    const customerMap = {};

    sales.forEach(s => {
      if (!s) return;
      const bal = parseFloat(s.balanceAmount);
      if (isNaN(bal) || bal <= 0.01) return;

      const total = parseFloat(s.grandTotal || s.totalAmount || s.finalAmount) || 0;
      const paid = parseFloat(s.paidAmount || s.advanceAmount) || 0;
      const dateStr = s.orderDate || s.invDate || s.date || '';
      const phone = s.contact || s.customerPhone || s.mobile || s.phone || s.contactNo || '';
      const customerName = (s.customerName || 'Cash Customer').trim();
      const customerKey = phone ? `${customerName}_${phone}` : customerName;

      let daysPending = 0;
      if (dateStr) {
        const oDate = new Date(dateStr);
        if (!isNaN(oDate.getTime())) {
          const diffMs = now.getTime() - oDate.getTime();
          daysPending = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
        }
      }

      if (!customerMap[customerKey]) {
        customerMap[customerKey] = {
          customerKey,
          customerName,
          phone,
          branch: s.branch || '',
          totalBilled: 0,
          totalPaid: 0,
          balanceDue: 0,
          unpaidOrders: [],
          oldestOrderDate: dateStr,
          maxDaysPending: daysPending,
          urgentCount: 0, // > 25 days
          urgentAmount: 0
        };
      }

      const c = customerMap[customerKey];
      c.totalBilled += total;
      c.totalPaid += paid;
      c.balanceDue += bal;
      c.unpaidOrders.push({
        id: s.id,
        estNumber: s.estNo || s.orderNo || s.invNo || ('#' + s.id),
        date: dateStr,
        total,
        paid,
        balance: bal,
        daysPending,
        branch: s.branch || '',
        raw: s
      });

      if (daysPending > c.maxDaysPending) {
        c.maxDaysPending = daysPending;
        c.oldestOrderDate = dateStr;
      }

      if (daysPending >= 25) {
        c.urgentCount += 1;
        c.urgentAmount += bal;
      }
    });

    const customerList = Object.values(customerMap);

    // Aging Buckets & Global Totals
    let totalReceivable = 0;
    let gt25Amount = 0;
    let g1524Amount = 0;
    let g714Amount = 0;
    let lt7Amount = 0;

    let gt25Count = 0;
    let g1524Count = 0;
    let g714Count = 0;
    let lt7Count = 0;

    let totalPendingDays = 0;
    let totalUnpaidOrders = 0;

    customerList.forEach(c => {
      totalReceivable += c.balanceDue;
      totalPendingDays += c.maxDaysPending;
      totalUnpaidOrders += c.unpaidOrders.length;

      if (c.maxDaysPending >= 25) {
        gt25Amount += c.balanceDue;
        gt25Count += 1;
      } else if (c.maxDaysPending >= 15) {
        g1524Amount += c.balanceDue;
        g1524Count += 1;
      } else if (c.maxDaysPending >= 7) {
        g714Amount += c.balanceDue;
        g714Count += 1;
      } else {
        lt7Amount += c.balanceDue;
        lt7Count += 1;
      }
    });

    const avgAgingDays = customerList.length > 0 ? Math.round(totalPendingDays / customerList.length) : 0;

    // Flatten all unpaid orders for the "By Order" sub-tab
    const allUnpaidOrders = [];
    customerList.forEach(c => {
      c.unpaidOrders.forEach(o => {
        allUnpaidOrders.push({
          ...o,
          customerName: c.customerName,
          phone: c.phone
        });
      });
    });

    return {
      customerList,
      allUnpaidOrders,
      totalReceivable,
      totalPendingCustomers: customerList.length,
      totalUnpaidOrders,
      avgAgingDays,
      buckets: {
        gt25: { count: gt25Count, amount: gt25Amount },
        g1524: { count: g1524Count, amount: g1524Amount },
        g714: { count: g714Count, amount: g714Amount },
        lt7: { count: lt7Count, amount: lt7Amount }
      }
    };
  }, [sales]);

  // Filter & Sort Customers
  const filteredCustomers = useMemo(() => {
    let list = [...receivablesData.customerList];

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase().trim();
      list = list.filter(c => 
        c.customerName.toLowerCase().includes(q) ||
        (c.phone && c.phone.includes(q)) ||
        (c.branch && c.branch.toLowerCase().includes(q)) ||
        c.unpaidOrders.some(o => o.estNumber.toLowerCase().includes(q))
      );
    }

    if (agingFilter === 'gt25') {
      list = list.filter(c => c.maxDaysPending >= 25);
    } else if (agingFilter === '15_24') {
      list = list.filter(c => c.maxDaysPending >= 15 && c.maxDaysPending <= 24);
    } else if (agingFilter === '7_14') {
      list = list.filter(c => c.maxDaysPending >= 7 && c.maxDaysPending <= 14);
    } else if (agingFilter === 'lt7') {
      list = list.filter(c => c.maxDaysPending < 7);
    }

    list.sort((a, b) => {
      if (sortBy === 'balance_desc') return b.balanceDue - a.balanceDue;
      if (sortBy === 'days_desc') return b.maxDaysPending - a.maxDaysPending;
      if (sortBy === 'name_asc') return a.customerName.localeCompare(b.customerName);
      if (sortBy === 'date_desc') {
        const dA = new Date(a.oldestOrderDate || 0);
        const dB = new Date(b.oldestOrderDate || 0);
        return dB - dA;
      }
      return 0;
    });

    return list;
  }, [receivablesData.customerList, searchTerm, agingFilter, sortBy]);

  // Filter & Sort Orders (For By-Order view)
  const filteredOrders = useMemo(() => {
    let list = [...receivablesData.allUnpaidOrders];

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase().trim();
      list = list.filter(o => 
        o.estNumber.toLowerCase().includes(q) ||
        o.customerName.toLowerCase().includes(q) ||
        (o.phone && o.phone.includes(q)) ||
        (o.branch && o.branch.toLowerCase().includes(q))
      );
    }

    if (agingFilter === 'gt25') {
      list = list.filter(o => o.daysPending >= 25);
    } else if (agingFilter === '15_24') {
      list = list.filter(o => o.daysPending >= 15 && o.daysPending <= 24);
    } else if (agingFilter === '7_14') {
      list = list.filter(o => o.daysPending >= 7 && o.daysPending <= 14);
    } else if (agingFilter === 'lt7') {
      list = list.filter(o => o.daysPending < 7);
    }

    list.sort((a, b) => {
      if (sortBy === 'balance_desc') return b.balance - a.balance;
      if (sortBy === 'days_desc') return b.daysPending - a.daysPending;
      if (sortBy === 'name_asc') return a.customerName.localeCompare(b.customerName);
      if (sortBy === 'date_desc') {
        const dA = new Date(a.date || 0);
        const dB = new Date(b.date || 0);
        return dB - dA;
      }
      return 0;
    });

    return list;
  }, [receivablesData.allUnpaidOrders, searchTerm, agingFilter, sortBy]);

  // Selection calculations
  const selectedCustomersTotal = useMemo(() => {
    const set = new Set(selectedCustomerKeys);
    return receivablesData.customerList
      .filter(c => set.has(c.customerKey))
      .reduce((sum, c) => sum + c.balanceDue, 0);
  }, [selectedCustomerKeys, receivablesData.customerList]);

  const selectedOrdersTotal = useMemo(() => {
    const set = new Set(selectedOrderIds);
    return receivablesData.allUnpaidOrders
      .filter(o => set.has(o.id))
      .reduce((sum, o) => sum + o.balance, 0);
  }, [selectedOrderIds, receivablesData.allUnpaidOrders]);

  // Selection toggle handlers
  const handleToggleSelectCustomer = (key) => {
    setSelectedCustomerKeys(prev => 
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  const handleSelectAllCustomers = () => {
    if (selectedCustomerKeys.length === filteredCustomers.length) {
      setSelectedCustomerKeys([]);
    } else {
      setSelectedCustomerKeys(filteredCustomers.map(c => c.customerKey));
    }
  };

  const handleToggleSelectOrder = (id) => {
    setSelectedOrderIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleSelectAllOrders = () => {
    if (selectedOrderIds.length === filteredOrders.length) {
      setSelectedOrderIds([]);
    } else {
      setSelectedOrderIds(filteredOrders.map(o => o.id));
    }
  };

  // Export to Excel
  const handleExportExcel = () => {
    if (activeSubTab === 'customers') {
      const rows = filteredCustomers.map((c, i) => ({
        'S.No': i + 1,
        'Customer Name': c.customerName,
        'Phone Number': c.phone || 'N/A',
        'Branch': c.branch || '',
        'Unpaid Orders Count': c.unpaidOrders.length,
        'Max Days Pending': c.maxDaysPending,
        'Aging Category': c.maxDaysPending >= 25 ? '> 25 Days (Critical)' : c.maxDaysPending >= 15 ? '15-24 Days' : c.maxDaysPending >= 7 ? '7-14 Days' : '< 7 Days',
        'Critical Orders (>25d)': c.urgentCount,
        'Total Billed (₹)': c.totalBilled,
        'Total Paid (₹)': c.totalPaid,
        'Pending Balance Due (₹)': c.balanceDue
      }));
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Customer_Receivables');
      XLSX.writeFile(wb, `Customer_Receivables_Summary_${new Date().toISOString().slice(0, 10)}.xlsx`);
    } else {
      const rows = filteredOrders.map((o, i) => ({
        'S.No': i + 1,
        'Order / Estimate #': o.estNumber,
        'Customer Name': o.customerName,
        'Phone Number': o.phone || 'N/A',
        'Order Date': o.date || '',
        'Branch': o.branch || '',
        'Days Pending': o.daysPending,
        'Aging Category': o.daysPending >= 25 ? '> 25 Days (Critical)' : o.daysPending >= 15 ? '15-24 Days' : o.daysPending >= 7 ? '7-14 Days' : '< 7 Days',
        'Total Order (₹)': o.total,
        'Paid (₹)': o.paid,
        'Pending Balance (₹)': o.balance
      }));
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Orders_Receivable');
      XLSX.writeFile(wb, `Orders_Receivable_Aging_${new Date().toISOString().slice(0, 10)}.xlsx`);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-24">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-rose-900 via-rose-800 to-slate-900 p-6 rounded-2xl text-white shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-500/30 text-rose-200 border border-rose-400/30">
              Accounts Receivable
            </span>
            <span className="text-xs text-rose-200">Customer Collections Tracker</span>
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight mt-1">Customer Receivables & Ageing</h1>
          <p className="text-rose-200/80 text-xs sm:text-sm mt-0.5">
            Track customer balances, overdue estimates, collection priority, and batch payment collection.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportExcel}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-xl text-xs sm:text-sm font-semibold transition-all shadow-sm"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Export Excel</span>
          </button>
          <button
            onClick={() => onNavigate && onNavigate('salesOrders')}
            className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 active:bg-white/30 text-white rounded-xl text-xs sm:text-sm font-semibold transition-all border border-white/20"
          >
            <ShoppingBag className="w-4 h-4" />
            <span>Sales Orders</span>
          </button>
        </div>
      </div>

      {/* 4 Summary Aging Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Receivable */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Receivables</p>
            <h3 className="text-2xl font-black text-rose-600 mt-1">{formatCurrency(receivablesData.totalReceivable)}</h3>
            <p className="text-[11px] text-slate-400 mt-1">
              <span className="font-semibold text-slate-700">{receivablesData.totalPendingCustomers}</span> customers • <span className="font-semibold text-slate-700">{receivablesData.totalUnpaidOrders}</span> orders
            </p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center border border-rose-100 flex-shrink-0">
            <ArrowDownLeft className="w-6 h-6" />
          </div>
        </div>

        {/* Card 2: Critical Overdue > 25 Days */}
        <div className="bg-white p-5 rounded-2xl border border-rose-200 bg-gradient-to-br from-white to-rose-50/40 shadow-xs flex items-center justify-between">
          <div>
            <div className="flex items-center gap-1.5">
              <p className="text-xs font-semibold text-rose-700 uppercase tracking-wider">&gt; 25 Days (Critical)</p>
              {receivablesData.buckets.gt25.count > 0 && (
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
              )}
            </div>
            <h3 className="text-2xl font-black text-rose-700 mt-1">{formatCurrency(receivablesData.buckets.gt25.amount)}</h3>
            <p className="text-[11px] text-rose-600 mt-1">
              <span className="font-bold">{receivablesData.buckets.gt25.count}</span> customers critically overdue
            </p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center border border-rose-200 flex-shrink-0">
            <AlertTriangle className="w-6 h-6" />
          </div>
        </div>

        {/* Card 3: 15-24 Days Moderate */}
        <div className="bg-white p-5 rounded-2xl border border-amber-200 bg-gradient-to-br from-white to-amber-50/30 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-amber-700 uppercase tracking-wider">15 - 24 Days Pending</p>
            <h3 className="text-2xl font-black text-amber-700 mt-1">{formatCurrency(receivablesData.buckets.g1524.amount)}</h3>
            <p className="text-[11px] text-amber-600 mt-1">
              <span className="font-bold">{receivablesData.buckets.g1524.count}</span> customers in follow-up stage
            </p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-100 flex-shrink-0">
            <Clock className="w-6 h-6" />
          </div>
        </div>

        {/* Card 4: Recent / Low Risk < 15 Days */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Under 15 Days (&lt;15d)</p>
            <h3 className="text-2xl font-black text-slate-800 mt-1">
              {formatCurrency(receivablesData.buckets.g714.amount + receivablesData.buckets.lt7.amount)}
            </h3>
            <p className="text-[11px] text-slate-400 mt-1">
              <span className="font-semibold text-slate-700">{receivablesData.buckets.g714.count + receivablesData.buckets.lt7.count}</span> customers current / regular
            </p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100 flex-shrink-0">
            <CheckCircle2 className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Main View Container */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Sub-tab Navigation */}
        <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/70">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveSubTab('customers')}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition-all ${
                activeSubTab === 'customers'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'bg-white text-slate-600 hover:text-slate-900 border border-slate-200'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>By Customer ({filteredCustomers.length})</span>
            </button>
            <button
              onClick={() => setActiveSubTab('orders')}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition-all ${
                activeSubTab === 'orders'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'bg-white text-slate-600 hover:text-slate-900 border border-slate-200'
              }`}
            >
              <Receipt className="w-4 h-4" />
              <span>By Unpaid Order ({filteredOrders.length})</span>
            </button>
          </div>

          <div className="text-xs text-slate-500 font-medium">
            Average collection aging: <span className="font-bold text-slate-800">{receivablesData.avgAgingDays} days</span>
          </div>
        </div>

        {/* Search & Filters Toolbar */}
        <div className="p-4 border-b border-slate-100 bg-white flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={activeSubTab === 'customers' ? "Search customer name, phone, branch..." : "Search estimate #, customer, phone..."}
              className="w-full pl-9 pr-8 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 placeholder:text-slate-400"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Aging Filter Pills & Sort Dropdown */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center p-0.5 bg-slate-100 rounded-xl text-xs font-semibold text-slate-600">
              <button
                onClick={() => setAgingFilter('all')}
                className={`px-2.5 py-1 rounded-lg transition-all ${
                  agingFilter === 'all'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'hover:text-slate-900'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setAgingFilter('gt25')}
                className={`px-2.5 py-1 rounded-lg transition-all ${
                  agingFilter === 'gt25'
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'text-rose-700 hover:text-rose-900'
                }`}
              >
                &gt; 25d ({receivablesData.buckets.gt25.count})
              </button>
              <button
                onClick={() => setAgingFilter('15_24')}
                className={`px-2.5 py-1 rounded-lg transition-all ${
                  agingFilter === '15_24'
                    ? 'bg-amber-500 text-white shadow-xs'
                    : 'text-amber-700 hover:text-amber-900'
                }`}
              >
                15-24d ({receivablesData.buckets.g1524.count})
              </button>
              <button
                onClick={() => setAgingFilter('7_14')}
                className={`px-2.5 py-1 rounded-lg transition-all ${
                  agingFilter === '7_14'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-blue-700 hover:text-blue-900'
                }`}
              >
                7-14d ({receivablesData.buckets.g714.count})
              </button>
              <button
                onClick={() => setAgingFilter('lt7')}
                className={`px-2.5 py-1 rounded-lg transition-all ${
                  agingFilter === 'lt7'
                    ? 'bg-slate-700 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                &lt; 7d ({receivablesData.buckets.lt7.count})
              </button>
            </div>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="text-xs bg-white border border-slate-200 rounded-xl px-2.5 py-2 text-slate-700 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 cursor-pointer font-medium"
            >
              <option value="balance_desc">Sort: Pending (High to Low)</option>
              <option value="days_desc">Sort: Aging Days (Oldest First)</option>
              <option value="name_asc">Sort: Customer Name (A-Z)</option>
              <option value="date_desc">Sort: Date (Newest First)</option>
            </select>
          </div>
        </div>

        {/* Content Table: By Customer View */}
        {activeSubTab === 'customers' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse whitespace-nowrap">
              <thead>
                <tr className="bg-slate-50 text-slate-500 border-b border-slate-200 text-xs uppercase font-semibold tracking-wider">
                  <th className="px-4 py-3 text-center w-12">
                    <button
                      onClick={handleSelectAllCustomers}
                      className="text-slate-400 hover:text-slate-600 inline-flex items-center"
                      title="Select all"
                    >
                      {selectedCustomerKeys.length > 0 && selectedCustomerKeys.length === filteredCustomers.length ? (
                        <CheckSquare className="w-4 h-4 text-rose-600" />
                      ) : (
                        <Square className="w-4 h-4" />
                      )}
                    </button>
                  </th>
                  <th className="px-4 py-3">Customer Details</th>
                  <th className="px-4 py-3">Phone / Contact</th>
                  <th className="px-4 py-3">Branch</th>
                  <th className="px-4 py-3 text-center">Unpaid Orders</th>
                  <th className="px-4 py-3 text-center">Max Aging</th>
                  <th className="px-4 py-3 text-right">Total Billed</th>
                  <th className="px-4 py-3 text-right font-bold text-rose-700">Pending Balance</th>
                  <th className="px-4 py-3 text-center w-32">Actions</th>
                </tr>
              </thead>
              <tbody className="text-sm divide-y divide-slate-100 text-slate-700">
                {filteredCustomers.length === 0 ? (
                  <tr>
                    <td colSpan="9" className="text-center py-12 text-slate-400">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <AlertCircle className="w-8 h-8 text-slate-300" />
                        <p className="text-sm font-medium text-slate-500">No customer receivables found matching criteria.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredCustomers.map((c, idx) => {
                    const isSelected = selectedCustomerKeys.includes(c.customerKey);
                    return (
                      <tr
                        key={c.customerKey || idx}
                        className={`hover:bg-rose-50/30 transition-colors ${
                          isSelected ? 'bg-rose-50/50' : c.maxDaysPending >= 25 ? 'bg-rose-50/10' : ''
                        }`}
                      >
                        {/* Checkbox */}
                        <td className="px-4 py-3.5 text-center">
                          <button
                            onClick={() => handleToggleSelectCustomer(c.customerKey)}
                            className="text-slate-400 hover:text-slate-600 inline-flex items-center"
                          >
                            {isSelected ? (
                              <CheckSquare className="w-4 h-4 text-rose-600" />
                            ) : (
                              <Square className="w-4 h-4" />
                            )}
                          </button>
                        </td>

                        {/* Customer Details */}
                        <td className="px-4 py-3.5">
                          <p className="font-bold text-slate-900 truncate max-w-[220px]">
                            {c.customerName}
                          </p>
                          {c.urgentCount > 0 && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-1.5 py-0.2 rounded mt-0.5">
                              <AlertTriangle className="w-3 h-3 text-rose-600" />
                              {c.urgentCount} order{c.urgentCount > 1 ? 's' : ''} &gt; 25d
                            </span>
                          )}
                        </td>

                        {/* Phone */}
                        <td className="px-4 py-3.5">
                          {c.phone ? (
                            <a
                              href={`tel:${c.phone}`}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-mono text-xs font-semibold border border-emerald-200 transition-colors"
                              title="Click to call customer"
                            >
                              <Phone className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                              <span>{c.phone}</span>
                            </a>
                          ) : (
                            <span className="text-slate-400 text-xs italic">N/A</span>
                          )}
                        </td>

                        {/* Branch */}
                        <td className="px-4 py-3.5 text-xs text-slate-600">
                          {c.branch || 'General'}
                        </td>

                        {/* Unpaid Orders Count */}
                        <td className="px-4 py-3.5 text-center">
                          <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">
                            {c.unpaidOrders.length}
                          </span>
                        </td>

                        {/* Max Aging Days */}
                        <td className="px-4 py-3.5 text-center">
                          <span
                            className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-extrabold ${
                              c.maxDaysPending >= 25
                                ? 'bg-rose-100 text-rose-800 border border-rose-200'
                                : c.maxDaysPending >= 15
                                ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                : c.maxDaysPending >= 7
                                ? 'bg-blue-100 text-blue-800 border border-blue-200'
                                : 'bg-slate-100 text-slate-700 border border-slate-200'
                            }`}
                          >
                            {c.maxDaysPending} days
                          </span>
                        </td>

                        {/* Total Billed */}
                        <td className="px-4 py-3.5 text-right font-medium text-slate-600">
                          {formatCurrency(c.totalBilled)}
                        </td>

                        {/* Balance Due */}
                        <td className="px-4 py-3.5 text-right font-bold text-rose-700">
                          {formatCurrency(c.balanceDue)}
                        </td>

                        {/* Actions */}
                        <td className="px-4 py-3.5 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            {c.unpaidOrders.length > 0 && (
                              <button
                                onClick={() => onViewSale && onViewSale(c.unpaidOrders[0].raw)}
                                className="px-2.5 py-1 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 shadow-2xs hover:text-brand-600 transition-colors"
                                title="View latest unpaid order"
                              >
                                View Order
                              </button>
                            )}
                            {c.unpaidOrders.length > 0 && onRecordPayment && (
                              <button
                                onClick={() => onRecordPayment(c.unpaidOrders[0].raw)}
                                className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white rounded-lg text-xs font-semibold shadow-2xs transition-colors"
                                title="Collect payment from customer"
                              >
                                Collect
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Content Table: By Unpaid Order View */}
        {activeSubTab === 'orders' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse whitespace-nowrap">
              <thead>
                <tr className="bg-slate-50 text-slate-500 border-b border-slate-200 text-xs uppercase font-semibold tracking-wider">
                  <th className="px-4 py-3 text-center w-12">
                    <button
                      onClick={handleSelectAllOrders}
                      className="text-slate-400 hover:text-slate-600 inline-flex items-center"
                      title="Select all"
                    >
                      {selectedOrderIds.length > 0 && selectedOrderIds.length === filteredOrders.length ? (
                        <CheckSquare className="w-4 h-4 text-rose-600" />
                      ) : (
                        <Square className="w-4 h-4" />
                      )}
                    </button>
                  </th>
                  <th className="px-4 py-3">Est / Order #</th>
                  <th className="px-4 py-3">Customer Name</th>
                  <th className="px-4 py-3">Phone</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3 text-center">Aging Days</th>
                  <th className="px-4 py-3 text-right">Total</th>
                  <th className="px-4 py-3 text-right">Paid</th>
                  <th className="px-4 py-3 text-right font-bold text-rose-700">Pending Balance</th>
                  <th className="px-4 py-3 text-center w-28">Actions</th>
                </tr>
              </thead>
              <tbody className="text-sm divide-y divide-slate-100 text-slate-700">
                {filteredOrders.length === 0 ? (
                  <tr>
                    <td colSpan="10" className="text-center py-12 text-slate-400">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <AlertCircle className="w-8 h-8 text-slate-300" />
                        <p className="text-sm font-medium text-slate-500">No unpaid orders match criteria.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredOrders.map((o, idx) => {
                    const isSelected = selectedOrderIds.includes(o.id);
                    return (
                      <tr
                        key={o.id || idx}
                        className={`hover:bg-rose-50/30 transition-colors ${
                          isSelected ? 'bg-rose-50/50' : o.daysPending >= 25 ? 'bg-rose-50/10' : ''
                        }`}
                      >
                        {/* Checkbox */}
                        <td className="px-4 py-3.5 text-center">
                          <button
                            onClick={() => handleToggleSelectOrder(o.id)}
                            className="text-slate-400 hover:text-slate-600 inline-flex items-center"
                          >
                            {isSelected ? (
                              <CheckSquare className="w-4 h-4 text-rose-600" />
                            ) : (
                              <Square className="w-4 h-4" />
                            )}
                          </button>
                        </td>

                        {/* Order Number */}
                        <td className="px-4 py-3.5">
                          <button
                            onClick={() => onViewSale && onViewSale(o.raw)}
                            className="font-mono font-bold text-slate-900 hover:text-brand-600 bg-slate-100 hover:bg-brand-50 px-2 py-0.5 rounded-md border border-slate-200 text-xs transition-colors inline-block text-left"
                            title="Click to view full sale order"
                          >
                            {o.estNumber}
                          </button>
                        </td>

                        {/* Customer Name */}
                        <td className="px-4 py-3.5">
                          <p className="font-semibold text-slate-900 truncate max-w-[200px]">
                            {o.customerName}
                          </p>
                        </td>

                        {/* Phone */}
                        <td className="px-4 py-3.5">
                          {o.phone ? (
                            <a
                              href={`tel:${o.phone}`}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-mono text-xs font-semibold border border-emerald-200 transition-colors"
                              title="Click to call customer"
                            >
                              <Phone className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                              <span>{o.phone}</span>
                            </a>
                          ) : (
                            <span className="text-slate-400 text-xs italic">N/A</span>
                          )}
                        </td>

                        {/* Date */}
                        <td className="px-4 py-3.5 text-xs text-slate-500 font-mono">
                          {formatDate(o.date)}
                        </td>

                        {/* Aging Days */}
                        <td className="px-4 py-3.5 text-center">
                          <span
                            className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-extrabold ${
                              o.daysPending >= 25
                                ? 'bg-rose-100 text-rose-800 border border-rose-200'
                                : o.daysPending >= 15
                                ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                : o.daysPending >= 7
                                ? 'bg-blue-100 text-blue-800 border border-blue-200'
                                : 'bg-slate-100 text-slate-700 border border-slate-200'
                            }`}
                          >
                            {o.daysPending} days
                          </span>
                        </td>

                        {/* Total */}
                        <td className="px-4 py-3.5 text-right font-medium text-slate-600">
                          {formatCurrency(o.total)}
                        </td>

                        {/* Paid */}
                        <td className="px-4 py-3.5 text-right font-medium text-slate-600">
                          {formatCurrency(o.paid)}
                        </td>

                        {/* Balance */}
                        <td className="px-4 py-3.5 text-right font-bold text-rose-700">
                          {formatCurrency(o.balance)}
                        </td>

                        {/* Actions */}
                        <td className="px-4 py-3.5 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => onViewSale && onViewSale(o.raw)}
                              className="px-2 py-1 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 hover:text-brand-600 transition-colors"
                              title="View Order"
                            >
                              View
                            </button>
                            {onRecordPayment && (
                              <button
                                onClick={() => onRecordPayment(o.raw)}
                                className="px-2 py-1 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white rounded-lg text-xs font-semibold shadow-2xs transition-colors"
                                title="Collect payment"
                              >
                                Collect
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Floating Selection Dock */}
      {((activeSubTab === 'customers' && selectedCustomerKeys.length > 0) ||
        (activeSubTab === 'orders' && selectedOrderIds.length > 0)) && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-slate-900 text-white px-5 py-3.5 rounded-2xl shadow-2xl flex items-center gap-4 border border-slate-700 animate-in fade-in slide-in-from-bottom-4 duration-200">
          <div className="flex items-center gap-2">
            <Calculator className="w-5 h-5 text-rose-400" />
            <span className="text-xs font-semibold text-slate-300">
              {activeSubTab === 'customers'
                ? `Selected ${selectedCustomerKeys.length} Customer${selectedCustomerKeys.length > 1 ? 's' : ''}`
                : `Selected ${selectedOrderIds.length} Order${selectedOrderIds.length > 1 ? 's' : ''}`}
            </span>
          </div>

          <div className="h-5 w-px bg-slate-700" />

          <div className="text-xs">
            <span className="text-slate-400">Total Pending: </span>
            <span className="font-extrabold text-sm text-rose-300">
              {formatCurrency(activeSubTab === 'customers' ? selectedCustomersTotal : selectedOrdersTotal)}
            </span>
          </div>

          <div className="flex items-center gap-2 ml-2">
            <button
              onClick={() => {
                if (activeSubTab === 'customers') setSelectedCustomerKeys([]);
                else setSelectedOrderIds([]);
              }}
              className="px-2.5 py-1 text-xs text-slate-400 hover:text-white transition-colors"
            >
              Clear
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
