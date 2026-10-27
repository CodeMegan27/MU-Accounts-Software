import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useData } from '../../context/DataContext';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { formatCurrency } from '../../utils/formatters';
import { exportVendorsToExcel, exportAllVendorLedgersMultiSheet } from '../../utils/exportUtils';
import { 
  Users, 
  Search, 
  Plus, 
  FileSpreadsheet, 
  BookOpen, 
  Edit2, 
  Trash2, 
  MapPin, 
  Phone, 
  CheckCircle2,
  Filter,
  ArrowUpAZ,
  ArrowDownZA,
  ArrowUp,
  ArrowDown,
  RotateCcw,
  X,
  Check
} from 'lucide-react';

const COLUMNS = [
  { key: 'name', label: 'Vendor Name', type: 'text', align: 'left' },
  { key: 'gstStatus', label: 'GST Status', type: 'text', align: 'left' },
  { key: 'gstin', label: 'GSTIN', type: 'text', align: 'left' },
  { key: 'address', label: 'Location / Address', type: 'text', align: 'left' },
  { key: 'openingBalance', label: 'Opening Bal', type: 'numeric', align: 'right' },
  { key: 'totalBilled', label: 'Total Billed', type: 'numeric', align: 'right' },
  { key: 'balance', label: 'Net Payable', type: 'numeric', align: 'right' },
];

export default function VendorsList({ onOpenCreateVendor, onEditVendor, onOpenLedger, onRequestDelete }) {
  const { vendors, bills, expenses, assets } = useData();
  const { isAdmin } = useAuth();
  const { showToast } = useToast();
  
  // Search state
  const [search, setSearch] = useState('');

  // Column Sort & Filter states
  const [sortConfig, setSortConfig] = useState({ column: 'name', direction: 'asc' });
  const [columnFilters, setColumnFilters] = useState({});
  const [openFilterCol, setOpenFilterCol] = useState(null);
  const [dropdownSearch, setDropdownSearch] = useState('');
  const filterDropdownRef = useRef(null);

  // Close dropdown on click outside
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (filterDropdownRef.current && !filterDropdownRef.current.contains(e.target)) {
        setOpenFilterCol(null);
      }
    };
    if (openFilterCol) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [openFilterCol]);

  // Calculate Vendor Spend & Outstanding dynamically from bills, expenses, AND asset GST bills
  const vendorStats = useMemo(() => {
    const map = {};

    // 0. Initialize from Vendor Master with Opening Balances
    (vendors || []).forEach(v => {
      const opBal = parseFloat(v.openingBalance) || 0;
      const opType = v.openingBalanceType || 'payable';
      let billed = opType === 'payable' ? opBal : 0;
      let paid = opType === 'advance' ? opBal : 0;

      let extraPaid = 0;
      (v.paymentHistory || []).forEach(p => {
        extraPaid += (parseFloat(p.amount) || 0);
      });
      paid += extraPaid;
      const bal = (opType === 'payable' ? opBal : -opBal) - extraPaid;

      const obj = { totalBilled: billed, totalPaid: paid, balance: bal, billsCount: (opBal > 0 ? 1 : 0) + (v.paymentHistory?.length || 0) };
      map[v.id] = obj;
      if (v.name) {
        map[v.name] = obj;
      }
    });

    // 1. Accumulate from Purchase Bills
    bills.forEach(bill => {
      const vId = bill.vendorId || bill.vendorName;
      if (!vId) return;
      if (!map[vId]) {
        map[vId] = { totalBilled: 0, totalPaid: 0, balance: 0, billsCount: 0 };
      }
      const gTotal = parseFloat(bill.grandTotal) || 0;
      const pAmt = parseFloat(bill.paidAmount) || 0;
      const bal = bill.balanceAmount !== undefined ? parseFloat(bill.balanceAmount) : (gTotal - pAmt);
      map[vId].totalBilled += gTotal;
      map[vId].totalPaid += pAmt;
      map[vId].balance += (bal > 0 ? bal : 0);
      map[vId].billsCount += 1;
    });

    // 2. Accumulate from Expense Vouchers where payee/vendor matches
    (expenses || []).forEach(exp => {
      const party = (exp.payee || exp.vendorName || '').trim();
      if (!party) return;

      const matchedVendor = (vendors || []).find(v => 
        (v.name && v.name.trim().toLowerCase() === party.toLowerCase()) ||
        (v.id && exp.vendorId && v.id === exp.vendorId)
      );

      const targetKey = matchedVendor ? matchedVendor.id : party;
      if (!map[targetKey]) {
        map[targetKey] = { totalBilled: 0, totalPaid: 0, balance: 0, billsCount: 0 };
      }

      const amt = parseFloat(exp.amount) || 0;
      map[targetKey].totalBilled += amt;
      map[targetKey].totalPaid += amt;
      map[targetKey].billsCount += 1;
    });

    // 3. Accumulate from Asset GST Bills
    (assets || []).forEach(ast => {
      const vKey = ast.vendorId || ast.vendorName;
      if (!vKey) return;

      const matchedVendor = (vendors || []).find(v => 
        (v.id && ast.vendorId && v.id === ast.vendorId) ||
        (v.name && ast.vendorName && v.name.trim().toLowerCase() === ast.vendorName.trim().toLowerCase())
      );

      const targetKey = matchedVendor ? matchedVendor.id : vKey;
      if (!map[targetKey]) {
        map[targetKey] = { totalBilled: 0, totalPaid: 0, balance: 0, billsCount: 0 };
      }

      const gTotal = parseFloat(ast.grandTotal !== undefined ? ast.grandTotal : ast.value) || 0;
      const pAmt = parseFloat(ast.paidAmount) || 0;
      const bal = ast.balanceAmount !== undefined ? parseFloat(ast.balanceAmount) : Math.max(0, gTotal - pAmt);

      map[targetKey].totalBilled += gTotal;
      map[targetKey].totalPaid += pAmt;
      map[targetKey].balance += (bal > 0 ? bal : 0);
      map[targetKey].billsCount += 1;
    });

    return map;
  }, [bills, expenses, assets, vendors]);

  // Helper: Get canonical string representation for a vendor column
  const getVendorColValue = (v, key, stat) => {
    if (key === 'name') return (v.name || '').trim() || 'N/A';
    if (key === 'gstStatus') return v.gstStatus === 'GST' ? 'GST REGISTERED' : 'UNREGISTERED';
    if (key === 'gstin') return (v.gstin || '').trim() || '(Blanks)';
    if (key === 'address') return (v.address || '').trim() || '(Blanks)';
    if (key === 'openingBalance') {
      const op = parseFloat(v.openingBalance) || 0;
      return op === 0 ? '₹0.00' : `${formatCurrency(op)} (${v.openingBalanceType === 'advance' ? 'Cr' : 'Dr'})`;
    }
    if (key === 'totalBilled') {
      return formatCurrency(stat?.totalBilled || 0);
    }
    if (key === 'balance') {
      const b = stat?.balance || 0;
      return formatCurrency(b);
    }
    return '';
  };

  // Helper: Get raw comparable value for sorting
  const getVendorSortValue = (v, key, stat) => {
    if (key === 'name') return (v.name || '').toLowerCase();
    if (key === 'gstStatus') return v.gstStatus === 'GST' ? 'GST' : 'UNREG';
    if (key === 'gstin') return (v.gstin || '').toLowerCase();
    if (key === 'address') return (v.address || '').toLowerCase();
    if (key === 'openingBalance') return parseFloat(v.openingBalance) || 0;
    if (key === 'totalBilled') return parseFloat(stat?.totalBilled) || 0;
    if (key === 'balance') return parseFloat(stat?.balance) || 0;
    return 0;
  };

  // Distinct unique values per column without duplicate or repeated entries
  const distinctValuesByCol = useMemo(() => {
    const result = {};
    COLUMNS.forEach(col => {
      const set = new Set();
      (vendors || []).forEach(v => {
        const stat = vendorStats[v.id] || vendorStats[v.name] || { totalBilled: 0, balance: 0, billsCount: 0 };
        const val = getVendorColValue(v, col.key, stat);
        if (val) set.add(val);
      });
      const arr = Array.from(set);
      if (col.type === 'numeric') {
        arr.sort((a, b) => {
          const numA = parseFloat(a.replace(/[^0-9.-]+/g, '')) || 0;
          const numB = parseFloat(b.replace(/[^0-9.-]+/g, '')) || 0;
          return numA - numB;
        });
      } else {
        arr.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
      }
      result[col.key] = arr;
    });
    return result;
  }, [vendors, vendorStats]);

  // Filter and Sort vendors
  const filteredVendors = useMemo(() => {
    const q = search.toLowerCase().trim();
    let list = (vendors || []).filter(v => {
      // 1. General search box
      if (q) {
        const matchesQuery = 
          (v.name && v.name.toLowerCase().includes(q)) ||
          (v.gstin && v.gstin.toLowerCase().includes(q)) ||
          (v.address && v.address.toLowerCase().includes(q)) ||
          (v.phone && v.phone.toLowerCase().includes(q));
        if (!matchesQuery) return false;
      }

      // 2. Column-specific Excel filters
      const stat = vendorStats[v.id] || vendorStats[v.name] || { totalBilled: 0, balance: 0, billsCount: 0 };
      for (const [colKey, allowedValues] of Object.entries(columnFilters)) {
        if (Array.isArray(allowedValues) && allowedValues.length > 0) {
          const vendorVal = getVendorColValue(v, colKey, stat);
          if (!allowedValues.includes(vendorVal)) {
            return false;
          }
        }
      }

      return true;
    });

    // 3. Sorting
    if (sortConfig.column) {
      list.sort((a, b) => {
        const statA = vendorStats[a.id] || vendorStats[a.name] || { totalBilled: 0, balance: 0, billsCount: 0 };
        const statB = vendorStats[b.id] || vendorStats[b.name] || { totalBilled: 0, balance: 0, billsCount: 0 };
        const valA = getVendorSortValue(a, sortConfig.column, statA);
        const valB = getVendorSortValue(b, sortConfig.column, statB);

        let cmp = 0;
        if (typeof valA === 'number' && typeof valB === 'number') {
          cmp = valA - valB;
        } else {
          cmp = String(valA).localeCompare(String(valB), undefined, { numeric: true, sensitivity: 'base' });
        }
        return sortConfig.direction === 'desc' ? -cmp : cmp;
      });
    }

    return list;
  }, [vendors, search, columnFilters, sortConfig, vendorStats]);

  // Handle setting sort
  const handleSetSort = (colKey, direction) => {
    setSortConfig({ column: colKey, direction });
    setOpenFilterCol(null);
  };

  // Handle toggling specific value in Excel filter pick-list
  const handleToggleValue = (colKey, value, allDistinct) => {
    setColumnFilters(prev => {
      const current = prev[colKey] ? [...prev[colKey]] : [...allDistinct];
      let updated;
      if (current.includes(value)) {
        updated = current.filter(item => item !== value);
      } else {
        updated = [...current, value];
      }
      
      // If all items are selected, delete the filter to save memory
      if (updated.length === allDistinct.length) {
        const next = { ...prev };
        delete next[colKey];
        return next;
      }
      return { ...prev, [colKey]: updated };
    });
  };

  // Select all values for a column
  const handleSelectAll = (colKey) => {
    setColumnFilters(prev => {
      const next = { ...prev };
      delete next[colKey];
      return next;
    });
  };

  // Clear/Deselect all values for a column
  const handleDeselectAll = (colKey) => {
    setColumnFilters(prev => ({
      ...prev,
      [colKey]: []
    }));
  };

  // Clear a specific column filter
  const handleClearColumnFilter = (colKey) => {
    setColumnFilters(prev => {
      const next = { ...prev };
      delete next[colKey];
      return next;
    });
  };

  // Reset all filters and sorting back to default
  const handleResetAllFilters = () => {
    setSearch('');
    setColumnFilters({});
    setSortConfig({ column: 'name', direction: 'asc' });
    setOpenFilterCol(null);
  };

  const hasActiveFilters = Object.keys(columnFilters).length > 0 || search.trim() !== '' || sortConfig.column !== 'name' || sortConfig.direction !== 'asc';

  const handleExport = () => {
    if (vendors.length === 0) {
      showToast('No vendors to export', 'error');
      return;
    }
    const ok = exportVendorsToExcel(vendors);
    if (ok) showToast('Vendors directory exported to Excel', 'success');
  };

  const handleExportMultiSheetLedger = () => {
    if (vendors.length === 0) {
      showToast('No vendors available to generate ledger workbook', 'error');
      return;
    }
    const ok = exportAllVendorLedgersMultiSheet(vendors, bills, expenses, assets);
    if (ok) {
      showToast(`Multi-Sheet Ledger Workbook exported (${vendors.length} vendor sheets)`, 'success');
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">Vendor Register & Directory</h2>
          <p className="text-xs text-slate-500 mt-0.5">Click any vendor name to open their statement of account instantly</p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
          <button
            onClick={handleExportMultiSheetLedger}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-3.5 py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-xl text-xs font-semibold transition-colors shadow-sm"
            title="Export complete master ledger with each vendor in their own sheet"
          >
            <BookOpen className="w-4 h-4 text-emerald-600" /> All Ledgers (Multi-Sheet Excel)
          </button>
          <button
            onClick={handleExport}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors border border-slate-200 shadow-sm"
          >
            <FileSpreadsheet className="w-4 h-4 text-slate-600" /> Export Directory
          </button>
          <button
            onClick={onOpenCreateVendor}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-semibold transition-all shadow-md hover:shadow-lg"
          >
            <Plus className="w-4 h-4" /> Add Vendor
          </button>
        </div>
      </div>

      {/* Search Toolbar & Filter Status Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search vendor by name, GSTIN, city or mobile..."
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 self-end sm:self-center">
          <span className="text-xs text-slate-500 font-medium">
            Showing <strong className="text-slate-800">{filteredVendors.length}</strong> of {vendors.length} vendors
          </span>

          {hasActiveFilters && (
            <button
              onClick={handleResetAllFilters}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold transition-all shadow-xs"
              title="Reset all active column filters and sorting"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* Vendors Table with Excel-Like Column Filters */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-visible">
        <div className="overflow-x-auto min-h-[420px]">
          <table className="w-full text-left border-collapse whitespace-nowrap">
            <thead>
              <tr className="bg-slate-50 text-slate-600 border-b border-slate-200 text-xs uppercase font-bold tracking-wider">
                {COLUMNS.map((col, index) => {
                  const isSorted = sortConfig.column === col.key;
                  const isFiltered = Boolean(columnFilters[col.key]);
                  const isRight = col.align === 'right';
                  const distinctList = distinctValuesByCol[col.key] || [];
                  const activeFilter = columnFilters[col.key];

                  // Filter distinct options inside dropdown by dropdownSearch
                  const filteredDistinct = distinctList.filter(item => 
                    !dropdownSearch || item.toLowerCase().includes(dropdownSearch.toLowerCase())
                  );

                  return (
                    <th 
                      key={col.key} 
                      className={`px-6 py-4 relative select-none ${isRight ? 'text-right' : 'text-left'}`}
                    >
                      <div className={`flex items-center gap-1.5 ${isRight ? 'justify-end' : 'justify-between'}`}>
                        <span className="truncate">{col.label}</span>
                        
                        {/* Excel Header Filter & Sort Trigger Button */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenFilterCol(openFilterCol === col.key ? null : col.key);
                            setDropdownSearch('');
                          }}
                          className={`p-1 rounded-md transition-all ${
                            isFiltered || isSorted
                              ? 'bg-brand-600 text-white shadow-xs'
                              : 'text-slate-400 hover:text-slate-800 hover:bg-slate-200/70'
                          }`}
                          title={`Sort & Filter by ${col.label}`}
                        >
                          <Filter className="w-3 h-3" />
                        </button>
                      </div>

                      {/* Dropdown Menu when clicked */}
                      {openFilterCol === col.key && (
                        <div
                          ref={filterDropdownRef}
                          onClick={(e) => e.stopPropagation()}
                          className={`absolute top-full mt-1 ${
                            index >= COLUMNS.length - 3 ? 'right-2' : 'left-2'
                          } z-50 bg-white rounded-2xl shadow-2xl border border-slate-200 p-3.5 w-64 text-xs font-normal normal-case tracking-normal text-slate-700 space-y-3 animate-in fade-in duration-150`}
                        >
                          {/* Sort Options */}
                          <div className="space-y-1">
                            <div className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Sort</div>
                            
                            <button
                              type="button"
                              onClick={() => handleSetSort(col.key, 'asc')}
                              className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left text-xs font-semibold transition-colors ${
                                isSorted && sortConfig.direction === 'asc'
                                  ? 'bg-brand-50 text-brand-700 font-bold border border-brand-200'
                                  : 'hover:bg-slate-100 text-slate-700'
                              }`}
                            >
                              {col.type === 'numeric' ? (
                                <ArrowUp className="w-3.5 h-3.5 text-brand-600" />
                              ) : (
                                <ArrowUpAZ className="w-3.5 h-3.5 text-brand-600" />
                              )}
                              <span>{col.type === 'numeric' ? 'Low → High (Smallest first)' : 'Sort A to Z'}</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleSetSort(col.key, 'desc')}
                              className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left text-xs font-semibold transition-colors ${
                                isSorted && sortConfig.direction === 'desc'
                                  ? 'bg-brand-50 text-brand-700 font-bold border border-brand-200'
                                  : 'hover:bg-slate-100 text-slate-700'
                              }`}
                            >
                              {col.type === 'numeric' ? (
                                <ArrowDown className="w-3.5 h-3.5 text-brand-600" />
                              ) : (
                                <ArrowDownZA className="w-3.5 h-3.5 text-brand-600" />
                              )}
                              <span>{col.type === 'numeric' ? 'High → Low (Largest first)' : 'Sort Z to A'}</span>
                            </button>
                          </div>

                          {/* Excel Filter by Pick Specific */}
                          <div className="border-t border-slate-100 pt-2.5 space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">
                                Filter by Specific ({distinctList.length})
                              </span>
                              {isFiltered && (
                                <button
                                  type="button"
                                  onClick={() => handleClearColumnFilter(col.key)}
                                  className="text-[10px] text-brand-600 hover:underline font-bold"
                                >
                                  Clear
                                </button>
                              )}
                            </div>

                            {/* Dropdown search if more than 5 distinct values */}
                            {distinctList.length > 5 && (
                              <div className="relative">
                                <Search className="w-3 h-3 text-slate-400 absolute left-2 top-1/2 -translate-y-1/2" />
                                <input
                                  type="text"
                                  value={dropdownSearch}
                                  onChange={(e) => setDropdownSearch(e.target.value)}
                                  placeholder="Search list..."
                                  className="w-full pl-6 pr-2 py-1 bg-slate-50 border border-slate-200 rounded-md text-[11px] focus:bg-white focus:outline-none focus:ring-1 focus:ring-brand-500"
                                />
                              </div>
                            )}

                            {/* Quick Select All / Deselect All */}
                            <div className="flex items-center justify-between text-[11px] px-1 text-slate-500 font-semibold">
                              <button
                                type="button"
                                onClick={() => handleSelectAll(col.key)}
                                className="text-brand-600 hover:underline"
                              >
                                Select All
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeselectAll(col.key)}
                                className="text-slate-500 hover:underline"
                              >
                                Clear All
                              </button>
                            </div>

                            {/* Scrollable Checkbox List of Unique Entries */}
                            <div className="max-h-40 overflow-y-auto space-y-1 pr-1 border border-slate-100 rounded-lg p-1.5 bg-slate-50/60">
                              {filteredDistinct.length === 0 ? (
                                <div className="text-center py-2 text-[11px] text-slate-400">No match</div>
                              ) : (
                                filteredDistinct.map(val => {
                                  const isChecked = !activeFilter || activeFilter.includes(val);
                                  return (
                                    <label
                                      key={val}
                                      className="flex items-center gap-2 px-1.5 py-1 rounded hover:bg-white cursor-pointer text-xs select-none"
                                    >
                                      <input
                                        type="checkbox"
                                        checked={isChecked}
                                        onChange={() => handleToggleValue(col.key, val, distinctList)}
                                        className="w-3.5 h-3.5 text-brand-600 rounded border-slate-300 focus:ring-brand-500 cursor-pointer"
                                      />
                                      <span className="truncate text-slate-800 text-[11px] font-medium" title={val}>
                                        {val}
                                      </span>
                                    </label>
                                  );
                                })
                              )}
                            </div>
                          </div>

                          {/* Footer Apply/Done */}
                          <div className="border-t border-slate-100 pt-2 flex items-center justify-between">
                            <span className="text-[10px] text-slate-400 font-medium">
                              {activeFilter ? `${activeFilter.length} selected` : 'All selected'}
                            </span>
                            <button
                              type="button"
                              onClick={() => setOpenFilterCol(null)}
                              className="px-3 py-1 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-xs font-bold transition-colors"
                            >
                              Apply
                            </button>
                          </div>
                        </div>
                      )}
                    </th>
                  );
                })}
                <th className="px-6 py-4 text-center w-28">Actions</th>
              </tr>
            </thead>
            <tbody className="text-sm divide-y divide-slate-100 text-slate-700">
              {filteredVendors.length === 0 ? (
                <tr>
                  <td colSpan="8" className="text-center py-12 text-slate-400">
                    <p className="text-base font-semibold text-slate-700">No matching vendors</p>
                    <p className="text-xs text-slate-400 mt-1">Try adjusting search or column filter criteria</p>
                    {hasActiveFilters && (
                      <button
                        onClick={handleResetAllFilters}
                        className="mt-3 px-3.5 py-1.5 bg-brand-50 hover:bg-brand-100 text-brand-700 font-bold text-xs rounded-xl transition-colors inline-flex items-center gap-1.5"
                      >
                        <RotateCcw className="w-3.5 h-3.5" /> Clear All Filters
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                filteredVendors.map(v => {
                  const stat = vendorStats[v.id] || vendorStats[v.name] || { totalBilled: 0, balance: 0, billsCount: 0 };
                  const vOpBal = parseFloat(v.openingBalance) || 0;
                  return (
                    <tr key={v.id} className="hover:bg-slate-50/80 transition-colors">
                      {/* Clickable Vendor Name to open Statement of Account directly */}
                      <td className="px-6 py-4">
                        <button
                          type="button"
                          onClick={() => onOpenLedger(v)}
                          className="font-bold text-slate-900 hover:text-brand-600 hover:underline transition-colors text-left flex items-center gap-1.5 group cursor-pointer"
                          title={`Click to open ${v.name} Statement of Account`}
                        >
                          <span className="group-hover:text-brand-600">{v.name || 'N/A'}</span>
                          <BookOpen className="w-3.5 h-3.5 text-slate-400 group-hover:text-brand-600 transition-colors opacity-0 group-hover:opacity-100 shrink-0" />
                        </button>
                        {v.phone && (
                          <div className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                            <Phone className="w-3 h-3" /> {v.phone}
                          </div>
                        )}
                      </td>

                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                          v.gstStatus === 'GST'
                            ? 'bg-brand-100 text-brand-700'
                            : 'bg-slate-100 text-slate-600'
                        }`}>
                          {v.gstStatus === 'GST' ? 'GST REGISTERED' : 'UNREGISTERED'}
                        </span>
                      </td>

                      <td className="px-6 py-4 font-mono text-xs font-semibold text-slate-600">
                        {v.gstin || '-'}
                      </td>

                      <td className="px-6 py-4 text-xs text-slate-500 max-w-xs truncate" title={v.address || ''}>
                        {v.address || '-'}
                      </td>

                      <td className="px-6 py-4 text-right">
                        {vOpBal > 0 ? (
                          <div className="flex items-center justify-end gap-1 font-mono text-xs font-bold text-slate-800">
                            <span>{formatCurrency(vOpBal)}</span>
                            <span className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded ${
                              v.openingBalanceType === 'advance' 
                                ? 'bg-blue-100 text-blue-800' 
                                : 'bg-amber-100 text-amber-900'
                            }`}>
                              {v.openingBalanceType === 'advance' ? 'Cr' : 'Dr'}
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-400 font-mono text-xs">₹0.00</span>
                        )}
                      </td>

                      <td className="px-6 py-4 text-right font-mono font-bold text-slate-900">
                        {formatCurrency(stat.totalBilled)}
                      </td>

                      <td className="px-6 py-4 text-right font-mono font-bold text-amber-600">
                        {formatCurrency(stat.balance)}
                      </td>

                      <td className="px-6 py-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => onOpenLedger(v)}
                            className="flex items-center gap-1 px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors"
                            title="Statement of Account"
                          >
                            <BookOpen className="w-3.5 h-3.5 text-brand-600" /> Ledger
                          </button>
                          <button
                            onClick={() => onEditVendor(v)}
                            className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                            title="Edit Vendor (Admin PIN Required)"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => onRequestDelete('vendors', v.id, `Vendor ${v.name}`)}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Delete Vendor (Admin PIN Required)"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
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
      </div>
    </div>
  );
}
