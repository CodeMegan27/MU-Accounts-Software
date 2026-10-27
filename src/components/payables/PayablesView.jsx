import React, { useState, useMemo } from 'react';
import { useData } from '../../context/DataContext';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { 
  CreditCard, 
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
  Calculator
} from 'lucide-react';
import * as XLSX from 'xlsx';

export default function PayablesView({ onOpenLedger, onViewBill, onOpenPaymentModal, onNavigate }) {
  const { bills = [], vendors = [] } = useData();

  const [activeSubTab, setActiveSubTab] = useState('vendors'); // 'vendors' | 'bills'
  const [searchTerm, setSearchTerm] = useState('');
  const [agingFilter, setAgingFilter] = useState('all'); // 'all', 'gt60', '31_60', '15_30', 'lt15', 'urgent'
  const [sortBy, setSortBy] = useState('balance_desc'); // 'balance_desc', 'days_desc', 'name_asc', 'date_desc'
  const [selectedVendorIds, setSelectedVendorIds] = useState([]);
  const [selectedBillIds, setSelectedBillIds] = useState([]);

  // Compute Full Vendor Payables & Ageing System
  const payablesData = useMemo(() => {
    const now = new Date();
    const vendorMap = {};

    // Initialize all registered vendors
    vendors.forEach(v => {
      if (!v) return;
      vendorMap[v.id] = {
        vendorId: v.id,
        vendorName: v.name || 'Unnamed Vendor',
        phone: v.phone || v.mobile || v.contact || '',
        gstin: v.gstin || '',
        totalBilled: 0,
        totalPaid: 0,
        balanceDue: 0,
        unpaidBills: [],
        oldestBillDate: null,
        maxDaysPending: 0,
        urgentCount: 0,
        urgentAmount: 0
      };
    });

    // Populate from Bills
    bills.forEach(b => {
      if (!b) return;
      const gTotal = parseFloat(b.grandTotal) || 0;
      const pAmt = parseFloat(b.paidAmount) || 0;
      const bal = b.balanceAmount !== undefined ? parseFloat(b.balanceAmount) : Math.max(0, gTotal - pAmt);

      const vId = b.vendorId || b.vendorName;
      if (!vendorMap[vId]) {
        vendorMap[vId] = {
          vendorId: vId,
          vendorName: b.vendorName || 'Unknown Vendor',
          phone: '',
          gstin: '',
          totalBilled: 0,
          totalPaid: 0,
          balanceDue: 0,
          unpaidBills: [],
          oldestBillDate: null,
          maxDaysPending: 0,
          urgentCount: 0,
          urgentAmount: 0
        };
      }

      vendorMap[vId].totalBilled += gTotal;
      vendorMap[vId].totalPaid += pAmt;

      if (bal > 0.01) {
        vendorMap[vId].balanceDue += bal;

        let daysPending = 0;
        const bDateStr = b.date || b.billDate || '';
        if (bDateStr) {
          const bDate = new Date(bDateStr);
          if (!isNaN(bDate.getTime())) {
            const diff = now.getTime() - bDate.getTime();
            daysPending = Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
          }
        }

        const enrichedBill = {
          ...b,
          balance: bal,
          grandTotalNum: gTotal,
          paidAmountNum: pAmt,
          daysPending,
          billDateFormatted: bDateStr
        };

        vendorMap[vId].unpaidBills.push(enrichedBill);

        if (daysPending > vendorMap[vId].maxDaysPending) {
          vendorMap[vId].maxDaysPending = daysPending;
        }

        if (!vendorMap[vId].oldestBillDate || (bDateStr && bDateStr < vendorMap[vId].oldestBillDate)) {
          vendorMap[vId].oldestBillDate = bDateStr;
        }

        if (daysPending >= 31) {
          vendorMap[vId].urgentCount += 1;
          vendorMap[vId].urgentAmount += bal;
        }
      }
    });

    // Convert map to list of vendors with balances
    const allVendorsWithBalance = Object.values(vendorMap).filter(v => v.balanceDue > 0.01);

    // Flatten all unpaid bills
    const allUnpaidBills = [];
    allVendorsWithBalance.forEach(v => {
      v.unpaidBills.forEach(b => {
        allUnpaidBills.push({
          ...b,
          vendorPhone: v.phone
        });
      });
    });

    // Summary Totals
    let totalPayable = 0;
    let criticalAmount = 0; // > 60 days
    let due31to60Amount = 0;
    let due15to30Amount = 0;
    let currentAmount = 0; // < 15 days

    let gt60Count = 0;
    let g3160Count = 0;
    let g1530Count = 0;
    let lt15Count = 0;
    let singleBillVendorCount = 0;

    allVendorsWithBalance.forEach(v => {
      totalPayable += v.balanceDue;

      if (v.unpaidBills.length === 1) {
        singleBillVendorCount += 1;
      }

      if (v.maxDaysPending > 60) {
        gt60Count += 1;
        criticalAmount += v.balanceDue;
      } else if (v.maxDaysPending >= 31) {
        g3160Count += 1;
        due31to60Amount += v.balanceDue;
      } else if (v.maxDaysPending >= 15) {
        g1530Count += 1;
        due15to30Amount += v.balanceDue;
      } else {
        lt15Count += 1;
        currentAmount += v.balanceDue;
      }
    });

    return {
      vendorsList: allVendorsWithBalance,
      billsList: allUnpaidBills,
      totalPayable,
      totalVendors: allVendorsWithBalance.length,
      totalBills: allUnpaidBills.length,
      singleBillVendorCount,
      multiBillVendorCount: allVendorsWithBalance.length - singleBillVendorCount,
      criticalAmount,
      due31to60Amount,
      due15to30Amount,
      currentAmount,
      gt60Count,
      g3160Count,
      g1530Count,
      lt15Count,
      urgentCount: gt60Count + g3160Count
    };
  }, [bills, vendors]);

  // Filtered Vendors List
  const filteredVendors = useMemo(() => {
    let result = [...payablesData.vendorsList];

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase().trim();
      result = result.filter(v => 
        v.vendorName.toLowerCase().includes(q) ||
        (v.phone && v.phone.includes(q)) ||
        (v.gstin && v.gstin.toLowerCase().includes(q))
      );
    }

    if (agingFilter === 'gt60') {
      result = result.filter(v => v.maxDaysPending > 60);
    } else if (agingFilter === '31_60') {
      result = result.filter(v => v.maxDaysPending >= 31 && v.maxDaysPending <= 60);
    } else if (agingFilter === '15_30') {
      result = result.filter(v => v.maxDaysPending >= 15 && v.maxDaysPending <= 30);
    } else if (agingFilter === 'lt15') {
      result = result.filter(v => v.maxDaysPending < 15);
    } else if (agingFilter === 'urgent') {
      result = result.filter(v => v.maxDaysPending >= 31);
    }

    result.sort((a, b) => {
      if (sortBy === 'balance_desc') return b.balanceDue - a.balanceDue;
      if (sortBy === 'days_desc') return b.maxDaysPending - a.maxDaysPending;
      if (sortBy === 'name_asc') return a.vendorName.localeCompare(b.vendorName);
      if (sortBy === 'bills_desc') return b.unpaidBills.length - a.unpaidBills.length;
      return 0;
    });

    return result;
  }, [payablesData.vendorsList, searchTerm, agingFilter, sortBy]);

  // Filtered Bills List
  const filteredBills = useMemo(() => {
    let result = [...payablesData.billsList];

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase().trim();
      result = result.filter(b => 
        (b.invoiceNo && b.invoiceNo.toLowerCase().includes(q)) ||
        (b.vendorName && b.vendorName.toLowerCase().includes(q)) ||
        (b.vendorPhone && b.vendorPhone.includes(q))
      );
    }

    if (agingFilter === 'gt60') {
      result = result.filter(b => b.daysPending > 60);
    } else if (agingFilter === '31_60') {
      result = result.filter(b => b.daysPending >= 31 && b.daysPending <= 60);
    } else if (agingFilter === '15_30') {
      result = result.filter(b => b.daysPending >= 15 && b.daysPending <= 30);
    } else if (agingFilter === 'lt15') {
      result = result.filter(b => b.daysPending < 15);
    } else if (agingFilter === 'urgent') {
      result = result.filter(b => b.daysPending >= 31);
    }

    result.sort((a, b) => {
      if (sortBy === 'balance_desc') return b.balance - a.balance;
      if (sortBy === 'days_desc') return b.daysPending - a.daysPending;
      if (sortBy === 'date_desc') return new Date(b.date || 0) - new Date(a.date || 0);
      if (sortBy === 'name_asc') return (a.vendorName || '').localeCompare(b.vendorName || '');
      return 0;
    });

    return result;
  }, [payablesData.billsList, searchTerm, agingFilter, sortBy]);

  // Selected Amount for Repayment Planner
  const selectedRepayTotal = useMemo(() => {
    if (activeSubTab === 'vendors') {
      return filteredVendors
        .filter(v => selectedVendorIds.includes(v.vendorId))
        .reduce((sum, v) => sum + v.balanceDue, 0);
    } else {
      return filteredBills
        .filter(b => selectedBillIds.includes(b.id))
        .reduce((sum, b) => sum + b.balance, 0);
    }
  }, [activeSubTab, filteredVendors, selectedVendorIds, filteredBills, selectedBillIds]);

  const toggleSelectAll = () => {
    if (activeSubTab === 'vendors') {
      if (selectedVendorIds.length === filteredVendors.length) {
        setSelectedVendorIds([]);
      } else {
        setSelectedVendorIds(filteredVendors.map(v => v.vendorId));
      }
    } else {
      if (selectedBillIds.length === filteredBills.length) {
        setSelectedBillIds([]);
      } else {
        setSelectedBillIds(filteredBills.map(b => b.id));
      }
    }
  };

  const handleExportExcel = () => {
    try {
      const wb = XLSX.utils.book_new();

      // Sheet 1: Vendors Summary
      const vendorRows = payablesData.vendorsList.map((v, i) => ({
        "S.No": i + 1,
        "Vendor Name": v.vendorName,
        "Contact Phone": v.phone || 'N/A',
        "GSTIN": v.gstin || 'N/A',
        "Pending Invoices Count": v.unpaidBills.length,
        "Oldest Bill Date": v.oldestBillDate || 'N/A',
        "Max Days Pending": v.maxDaysPending,
        "Urgent Status": v.maxDaysPending > 60 ? 'Critical Overdue (>60d)' : v.maxDaysPending >= 31 ? 'Urgent (31-60d)' : 'Normal',
        "Total Billed (₹)": v.totalBilled,
        "Total Paid (₹)": v.totalPaid,
        "Outstanding Balance (₹)": v.balanceDue
      }));
      const wsVendors = XLSX.utils.json_to_sheet(vendorRows);
      XLSX.utils.book_append_sheet(wb, wsVendors, "Vendor Payables");

      // Sheet 2: Invoice-by-Invoice Details
      const billRows = payablesData.billsList.map((b, i) => ({
        "S.No": i + 1,
        "Bill / Inv #": b.invoiceNo || 'N/A',
        "Bill Date": b.date || '',
        "Vendor Name": b.vendorName || '',
        "Contact Phone": b.vendorPhone || 'N/A',
        "Days Pending": b.daysPending,
        "Aging Bucket": b.daysPending > 60 ? '> 60 Days' : b.daysPending >= 31 ? '31-60 Days' : b.daysPending >= 15 ? '15-30 Days' : '< 15 Days',
        "Bill Total (₹)": b.grandTotalNum,
        "Paid Amount (₹)": b.paidAmountNum,
        "Balance Due (₹)": b.balance
      }));
      const wsBills = XLSX.utils.json_to_sheet(billRows);
      XLSX.utils.book_append_sheet(wb, wsBills, "Pending Invoices");

      XLSX.writeFile(wb, `Accounts_Payable_Master_${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-6 rounded-3xl text-white shadow-md">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-mono text-[11px] font-bold border border-amber-400/30">
              ACCOUNTS PAYABLE REGISTER
            </span>
            <span className="text-xs text-slate-300">• Live Supplier Aging System</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight mt-1">Vendor Outstandings & Ageing</h2>
          <p className="text-slate-300 text-xs sm:text-sm mt-0.5">
            Track urgent invoice settlements, plan vendor repayments, and manage credit aging.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            onClick={handleExportExcel}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow-sm"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Export Master Excel</span>
          </button>
          <button
            onClick={() => onNavigate && onNavigate('bills')}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold transition-all border border-white/20"
          >
            <span>Purchase Register</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* KPI Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Outstanding */}
        <div className="bg-white p-5 rounded-2xl border border-amber-200 bg-gradient-to-br from-white to-amber-50/40 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-amber-600 uppercase tracking-wider">Total Outstanding</span>
            <h3 className="text-2xl font-black text-amber-600 mt-1">{formatCurrency(payablesData.totalPayable)}</h3>
            <p className="text-xs text-slate-500 mt-1">
              Across <strong className="text-slate-800">{payablesData.totalVendors}</strong> vendors ({payablesData.totalBills} bills)
            </p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center flex-shrink-0">
            <CreditCard className="w-6 h-6" />
          </div>
        </div>

        {/* Critical Overdue >60 Days */}
        <div className="bg-white p-5 rounded-2xl border border-rose-200 bg-gradient-to-br from-white to-rose-50/40 shadow-sm flex items-center justify-between">
          <div>
            <div className="flex items-center gap-1">
              <span className="text-[11px] font-bold text-rose-600 uppercase tracking-wider">Critical Overdue (&gt;60d)</span>
              {payablesData.gt60Count > 0 && <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />}
            </div>
            <h3 className="text-2xl font-black text-rose-600 mt-1">{formatCurrency(payablesData.criticalAmount)}</h3>
            <p className="text-xs text-rose-700 font-medium mt-1">
              {payablesData.gt60Count} vendors need urgent clearance
            </p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center flex-shrink-0">
            <AlertTriangle className="w-6 h-6" />
          </div>
        </div>

        {/* Due 31 - 60 Days */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Due 31 - 60 Days</span>
            <h3 className="text-2xl font-black text-slate-900 mt-1">{formatCurrency(payablesData.due31to60Amount)}</h3>
            <p className="text-xs text-slate-500 mt-1">
              {payablesData.g3160Count} suppliers awaiting payment
            </p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center flex-shrink-0">
            <Clock className="w-6 h-6" />
          </div>
        </div>

        {/* Single Vendor Quick Clearing */}
        <div className="bg-white p-5 rounded-2xl border border-emerald-200 bg-gradient-to-br from-white to-emerald-50/30 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider">Single Invoice Vendors</span>
            <h3 className="text-2xl font-black text-emerald-700 mt-1">{payablesData.singleBillVendorCount}</h3>
            <p className="text-xs text-slate-500 mt-1">
              Clear with single quick payment
            </p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center flex-shrink-0">
            <CheckCircle2 className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Main Table Container */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Navigation Tabs Bar */}
        <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/70">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveSubTab('vendors')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                activeSubTab === 'vendors'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>By Vendor Summary ({payablesData.totalVendors})</span>
            </button>
            <button
              onClick={() => setActiveSubTab('bills')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                activeSubTab === 'bills'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              <Receipt className="w-4 h-4" />
              <span>By Individual Bills ({payablesData.totalBills})</span>
            </button>
          </div>

          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
            <button
              onClick={toggleSelectAll}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl transition-colors"
            >
              <CheckSquare className="w-3.5 h-3.5 text-indigo-600" />
              <span>Select All</span>
            </button>
          </div>
        </div>

        {/* Toolbar: Search & Ageing Pills */}
        <div className="p-4 border-b border-slate-100 flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-white">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={activeSubTab === 'vendors' ? "Search vendor name, phone, gstin..." : "Search invoice #, vendor name, phone..."}
              className="w-full pl-9 pr-8 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-medium"
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

          <div className="flex flex-wrap items-center gap-2">
            {/* Ageing Filter Pills */}
            <div className="flex items-center p-0.5 bg-slate-100 rounded-xl text-xs font-semibold text-slate-600">
              <button
                onClick={() => setAgingFilter('all')}
                className={`px-2.5 py-1 rounded-lg transition-all ${
                  agingFilter === 'all' ? 'bg-white text-slate-900 shadow-2xs font-bold' : 'hover:text-slate-900'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setAgingFilter('gt60')}
                className={`px-2.5 py-1 rounded-lg transition-all ${
                  agingFilter === 'gt60' ? 'bg-rose-600 text-white shadow-2xs font-bold' : 'text-rose-700 hover:text-rose-900'
                }`}
              >
                &gt; 60 Days ({payablesData.gt60Count})
              </button>
              <button
                onClick={() => setAgingFilter('31_60')}
                className={`px-2.5 py-1 rounded-lg transition-all ${
                  agingFilter === '31_60' ? 'bg-amber-600 text-white shadow-2xs font-bold' : 'text-amber-700 hover:text-amber-900'
                }`}
              >
                31 - 60 Days ({payablesData.g3160Count})
              </button>
              <button
                onClick={() => setAgingFilter('15_30')}
                className={`px-2.5 py-1 rounded-lg transition-all ${
                  agingFilter === '15_30' ? 'bg-indigo-600 text-white shadow-2xs font-bold' : 'text-indigo-700 hover:text-indigo-900'
                }`}
              >
                15 - 30 Days ({payablesData.g1530Count})
              </button>
              <button
                onClick={() => setAgingFilter('lt15')}
                className={`px-2.5 py-1 rounded-lg transition-all ${
                  agingFilter === 'lt15' ? 'bg-slate-700 text-white shadow-2xs font-bold' : 'hover:text-slate-900'
                }`}
              >
                &lt; 15 Days ({payablesData.lt15Count})
              </button>
            </div>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-slate-700 font-medium cursor-pointer"
            >
              <option value="balance_desc">Sort: Balance (High to Low)</option>
              <option value="days_desc">Sort: Days Pending (Oldest First)</option>
              <option value="name_asc">Sort: Vendor Name (A-Z)</option>
              {activeSubTab === 'vendors' && <option value="bills_desc">Sort: Bill Count (High to Low)</option>}
              {activeSubTab === 'bills' && <option value="date_desc">Sort: Invoice Date (Newest First)</option>}
            </select>
          </div>
        </div>

        {/* Tab 1: Vendor Summary Table */}
        {activeSubTab === 'vendors' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse whitespace-nowrap">
              <thead>
                <tr className="bg-slate-50 text-slate-500 border-b border-slate-200 text-xs uppercase font-semibold tracking-wider">
                  <th className="px-4 py-3 text-center w-10">Select</th>
                  <th className="px-4 py-3">Vendor Name</th>
                  <th className="px-4 py-3">Contact No</th>
                  <th className="px-4 py-3 text-center">Unpaid Bills</th>
                  <th className="px-4 py-3">Oldest Bill Date</th>
                  <th className="px-4 py-3 text-center">Days Pending</th>
                  <th className="px-4 py-3 text-right">Total Billed</th>
                  <th className="px-4 py-3 text-right">Total Paid</th>
                  <th className="px-4 py-3 text-right font-bold text-amber-700">Balance Due</th>
                  <th className="px-4 py-3 text-center w-28">Actions</th>
                </tr>
              </thead>
              <tbody className="text-sm divide-y divide-slate-100 text-slate-700">
                {filteredVendors.length === 0 ? (
                  <tr>
                    <td colSpan="10" className="text-center py-12 text-slate-400">
                      <div className="flex flex-col items-center justify-center gap-1">
                        <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                        <p className="text-sm font-semibold text-slate-700">All vendors cleared!</p>
                        <p className="text-xs text-slate-400">No outstanding payables match your filter criteria.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredVendors.map((v, idx) => {
                    const isSelected = selectedVendorIds.includes(v.vendorId);
                    const isCritical = v.maxDaysPending > 60;
                    const isUrgent = v.maxDaysPending >= 31 && !isCritical;

                    return (
                      <tr
                        key={v.vendorId || idx}
                        className={`hover:bg-indigo-50/20 transition-colors ${
                          isSelected ? 'bg-indigo-50/50' : isCritical ? 'bg-rose-50/20' : ''
                        }`}
                      >
                        {/* Checkbox */}
                        <td className="px-4 py-3.5 text-center">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {
                              setSelectedVendorIds(prev => 
                                isSelected ? prev.filter(id => id !== v.vendorId) : [...prev, v.vendorId]
                              );
                            }}
                            className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                          />
                        </td>

                        {/* Vendor Name */}
                        <td className="px-4 py-3.5 font-bold text-slate-900">
                          <button
                            onClick={() => onOpenLedger && onOpenLedger({ id: v.vendorId, name: v.vendorName })}
                            className="hover:text-indigo-600 text-left truncate max-w-[220px] inline-block font-bold hover:underline"
                            title="Click to view full vendor ledger"
                          >
                            {v.vendorName}
                          </button>
                        </td>

                        {/* Phone */}
                        <td className="px-4 py-3.5">
                          {v.phone ? (
                            <a
                              href={`tel:${v.phone}`}
                              className="inline-flex items-center gap-1 text-xs text-slate-700 hover:text-indigo-600 font-mono"
                            >
                              <Phone className="w-3.5 h-3.5 text-slate-400" />
                              <span>{v.phone}</span>
                            </a>
                          ) : (
                            <span className="text-slate-400 text-xs italic">N/A</span>
                          )}
                        </td>

                        {/* Unpaid Bills count */}
                        <td className="px-4 py-3.5 text-center">
                          <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-800 text-xs font-mono font-bold">
                            {v.unpaidBills.length} {v.unpaidBills.length === 1 ? 'bill' : 'bills'}
                          </span>
                        </td>

                        {/* Oldest Bill Date */}
                        <td className="px-4 py-3.5 text-xs text-slate-600 font-mono">
                          {v.oldestBillDate ? formatDate(v.oldestBillDate) : 'N/A'}
                        </td>

                        {/* Days Pending Badge */}
                        <td className="px-4 py-3.5 text-center">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                            isCritical 
                              ? 'bg-rose-100 text-rose-800 border border-rose-200' 
                              : isUrgent 
                              ? 'bg-amber-100 text-amber-800 border border-amber-200' 
                              : 'bg-slate-100 text-slate-700'
                          }`}>
                            {v.maxDaysPending} days
                          </span>
                        </td>

                        {/* Billed */}
                        <td className="px-4 py-3.5 text-right font-medium text-slate-700">
                          {formatCurrency(v.totalBilled)}
                        </td>

                        {/* Paid */}
                        <td className="px-4 py-3.5 text-right font-medium text-emerald-700">
                          {formatCurrency(v.totalPaid)}
                        </td>

                        {/* Balance Due */}
                        <td className="px-4 py-3.5 text-right font-black text-amber-700 text-sm">
                          {formatCurrency(v.balanceDue)}
                        </td>

                        {/* Actions */}
                        <td className="px-4 py-3.5 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => {
                                const firstBill = v.unpaidBills[0];
                                if (firstBill && onOpenPaymentModal) {
                                  onOpenPaymentModal(firstBill);
                                } else if (onOpenLedger) {
                                  onOpenLedger({ id: v.vendorId, name: v.vendorName });
                                }
                              }}
                              className="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-bold shadow-2xs transition-colors flex items-center gap-1"
                              title="Record payment to this vendor"
                            >
                              <CreditCard className="w-3 h-3" />
                              <span>Pay</span>
                            </button>
                            <button
                              onClick={() => onOpenLedger && onOpenLedger({ id: v.vendorId, name: v.vendorName })}
                              className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 rounded-lg transition-colors"
                              title="View Vendor Statement / Ledger"
                            >
                              <ArrowUpRight className="w-4 h-4" />
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
        )}

        {/* Tab 2: Individual Invoices Table */}
        {activeSubTab === 'bills' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse whitespace-nowrap">
              <thead>
                <tr className="bg-slate-50 text-slate-500 border-b border-slate-200 text-xs uppercase font-semibold tracking-wider">
                  <th className="px-4 py-3 text-center w-10">Select</th>
                  <th className="px-4 py-3">Invoice #</th>
                  <th className="px-4 py-3">Invoice Date</th>
                  <th className="px-4 py-3">Vendor Name</th>
                  <th className="px-4 py-3 text-center">Days Pending</th>
                  <th className="px-4 py-3 text-right">Invoice Total</th>
                  <th className="px-4 py-3 text-right">Paid</th>
                  <th className="px-4 py-3 text-right font-bold text-amber-700">Balance Due</th>
                  <th className="px-4 py-3 text-center w-28">Actions</th>
                </tr>
              </thead>
              <tbody className="text-sm divide-y divide-slate-100 text-slate-700">
                {filteredBills.length === 0 ? (
                  <tr>
                    <td colSpan="9" className="text-center py-12 text-slate-400">
                      No unpaid bills match your search criteria.
                    </td>
                  </tr>
                ) : (
                  filteredBills.map((b, idx) => {
                    const isSelected = selectedBillIds.includes(b.id);
                    const isCritical = b.daysPending > 60;
                    const isUrgent = b.daysPending >= 31 && !isCritical;

                    return (
                      <tr
                        key={b.id || idx}
                        className={`hover:bg-indigo-50/20 transition-colors ${
                          isSelected ? 'bg-indigo-50/50' : isCritical ? 'bg-rose-50/20' : ''
                        }`}
                      >
                        <td className="px-4 py-3.5 text-center">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {
                              setSelectedBillIds(prev => 
                                isSelected ? prev.filter(id => id !== b.id) : [...prev, b.id]
                              );
                            }}
                            className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                          />
                        </td>
                        <td className="px-4 py-3.5 font-bold font-mono text-slate-900">
                          {b.invoiceNo || 'N/A'}
                        </td>
                        <td className="px-4 py-3.5 text-xs text-slate-600 font-mono">
                          {formatDate(b.date)}
                        </td>
                        <td className="px-4 py-3.5 font-semibold text-slate-800">
                          {b.vendorName || 'Unknown Vendor'}
                        </td>
                        <td className="px-4 py-3.5 text-center">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                            isCritical ? 'bg-rose-100 text-rose-800' : isUrgent ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-700'
                          }`}>
                            {b.daysPending} days
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-right font-medium text-slate-700">
                          {formatCurrency(b.grandTotalNum)}
                        </td>
                        <td className="px-4 py-3.5 text-right font-medium text-emerald-700">
                          {formatCurrency(b.paidAmountNum)}
                        </td>
                        <td className="px-4 py-3.5 text-right font-black text-amber-700 text-sm">
                          {formatCurrency(b.balance)}
                        </td>
                        <td className="px-4 py-3.5 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => onOpenPaymentModal && onOpenPaymentModal(b)}
                              className="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-bold transition-colors"
                              title="Record payment for this bill"
                            >
                              Pay
                            </button>
                            <button
                              onClick={() => onViewBill && onViewBill(b.id)}
                              className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 rounded-lg"
                              title="View tax invoice"
                            >
                              <ArrowUpRight className="w-4 h-4" />
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
        )}
      </div>

      {/* Multiple-Vendor Repayment Planner Floating Dock */}
      {selectedRepayTotal > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-slate-900/95 backdrop-blur-md text-white border border-indigo-500/50 shadow-2xl rounded-2xl px-6 py-3 flex items-center gap-6 animate-in fade-in slide-in-from-bottom-4 duration-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500 flex items-center justify-center text-slate-950 font-bold">
              <Calculator className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] uppercase font-bold text-amber-400">
                {activeSubTab === 'vendors' ? `${selectedVendorIds.length} Vendors Selected` : `${selectedBillIds.length} Bills Selected`}
              </p>
              <h4 className="text-lg font-black text-white">
                Total Required to Clear: {formatCurrency(selectedRepayTotal)}
              </h4>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setSelectedVendorIds([]);
                setSelectedBillIds([]);
              }}
              className="px-3 py-1.5 text-xs text-slate-400 hover:text-white rounded-lg"
            >
              Clear
            </button>
            <button
              onClick={handleExportExcel}
              className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow-sm"
            >
              Export Batch Schedule
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
