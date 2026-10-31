import React, { useState, useMemo, useEffect } from 'react';
import { 
  BookOpen, 
  Calendar, 
  ArrowUpRight, 
  ArrowDownRight, 
  Search, 
  Filter, 
  FileSpreadsheet, 
  Printer, 
  Plus, 
  Edit2, 
  Trash2, 
  X, 
  ChevronLeft, 
  ChevronRight, 
  Wallet, 
  CreditCard, 
  TrendingUp, 
  TrendingDown, 
  Layers, 
  Building2, 
  ExternalLink, 
  CheckCircle2, 
  RotateCcw,
  Clock,
  ArrowRightLeft,
  ChevronDown
} from 'lucide-react';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { useData } from '../../context/DataContext';
import { useToast } from '../../context/ToastContext';
import * as XLSX from 'xlsx';

export default function DayBook({ onViewSale }) {
  const { 
    daybookTransactions, 
    addDaybookTransaction, 
    updateDaybookTransaction, 
    deleteDaybookTransaction, 
    deleteDaybookTransactions,
    resetDaybookToDefault,
    cleanNonRegisterDaybookEntries,
    isDaybookEntryAssociated,
    sales,
    branches,
    departments,
    paymentMethods
  } = useData();

  const { showToast } = useToast();

  // Mode: 'daily' (one specific day) | 'range' | 'all'
  const [viewMode, setViewMode] = useState('daily');
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().substring(0, 10));
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().substring(0, 10);
  });
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().substring(0, 10));

  // Multi-Select Bulk Delete State
  const [selectedEntryIds, setSelectedEntryIds] = useState(() => new Set());
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);

  // Filters
  const [search, setSearch] = useState('');
  const [branchFilter, setBranchFilter] = useState('all'); // 'all' | 'RMD' | 'KLK'
  const [deptFilter, setDeptFilter] = useState('all');     // 'all' | 'OFFSET' | 'FLEX'
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [accountFilter, setAccountFilter] = useState('all'); // 'all' | 'cash' | 'bank'

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  // Modals
  const [showNewModal, setShowNewModal] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);
  const [deletingEntry, setDeletingEntry] = useState(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showWipeNonRegisterConfirm, setShowWipeNonRegisterConfirm] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState({});
  const toggleCategoryExpand = (key) => setExpandedCategories(prev => ({ ...prev, [key]: !prev[key] }));

  // Form State for New / Edit Entry
  const [formDate, setFormDate] = useState(selectedDate);
  const [formBranch, setFormBranch] = useState('KLK');
  const [formDept, setFormDept] = useState('OFFSET');
  const [formPayment, setFormPayment] = useState('CASH');
  const [formCategory, setFormCategory] = useState('SALES');
  const [formEstNo, setFormEstNo] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formType, setFormType] = useState('CASH_CREDIT'); // 'CASH_CREDIT' | 'CASH_DEBIT' | 'BANK_CREDIT' | 'BANK_DEBIT' | 'CONTRA'
  const [formAmount, setFormAmount] = useState('');
  const [formNote, setFormNote] = useState('');

  // Extract all unique dates from Daybook
  const availableDates = useMemo(() => {
    const set = new Set();
    (daybookTransactions || []).forEach(e => {
      if (e.date && /^\d{4}-\d{2}-\d{2}$/.test(e.date)) set.add(e.date);
    });
    return Array.from(set).sort();
  }, [daybookTransactions]);

  // Auto-sync selectedDate to availableDates if selectedDate is not in the list
  useEffect(() => {
    if (availableDates.length > 0 && !availableDates.includes(selectedDate)) {
      setSelectedDate(availableDates[availableDates.length - 1]);
    }
  }, [availableDates, selectedDate]);

  // Extract all unique categories
  const allCategories = useMemo(() => {
    const set = new Set();
    (daybookTransactions || []).forEach(e => {
      if (e.category) set.add(e.category);
    });
    return Array.from(set).sort();
  }, [daybookTransactions]);

  // Handle Date Navigation
  const handlePrevDay = () => {
    const idx = availableDates.indexOf(selectedDate);
    if (idx > 0) {
      setSelectedDate(availableDates[idx - 1]);
      setCurrentPage(1);
    }
  };

  const handleNextDay = () => {
    const idx = availableDates.indexOf(selectedDate);
    if (idx >= 0 && idx < availableDates.length - 1) {
      setSelectedDate(availableDates[idx + 1]);
      setCurrentPage(1);
    }
  };

  // Filtered Daybook Entries
  const filteredEntries = useMemo(() => {
    return (daybookTransactions || []).filter(item => {
      // 1. Date Filter
      if (viewMode === 'daily') {
        if (item.date !== selectedDate) return false;
      } else if (viewMode === 'range') {
        if (dateFrom && item.date < dateFrom) return false;
        if (dateTo && item.date > dateTo) return false;
      }

      // 2. Branch & Dept Filter
      if (branchFilter !== 'all' && item.branch !== branchFilter) return false;
      if (deptFilter !== 'all') {
        const itemDept = (item.department || '').toUpperCase();
        if (deptFilter === 'OFFSET' && !itemDept.includes('OFFSET')) return false;
        if (deptFilter === 'FLEX' && !itemDept.includes('FLEX')) return false;
      }

      // 3. Category Filter
      if (categoryFilter !== 'all' && item.category !== categoryFilter) return false;

      // 4. Account Filter (Cash vs Bank)
      if (accountFilter === 'cash') {
        const hasCash = (item.cashCredit > 0 || item.cashDebit > 0 || (item.payment && item.payment.toUpperCase().includes('CASH')));
        if (!hasCash) return false;
      } else if (accountFilter === 'bank') {
        const hasBank = (item.bankCredit > 0 || item.bankDebit > 0 || (item.payment && !item.payment.toUpperCase().includes('CASH')));
        if (!hasBank) return false;
      }

      // 5. Search Filter
      if (search) {
        const q = search.toLowerCase();
        const matches = 
          (item.estNo && item.estNo.toLowerCase().includes(q)) ||
          (item.description && item.description.toLowerCase().includes(q)) ||
          (item.category && item.category.toLowerCase().includes(q)) ||
          (item.payment && item.payment.toLowerCase().includes(q)) ||
          (item.branch && item.branch.toLowerCase().includes(q)) ||
          (item.balanceNote && item.balanceNote.toLowerCase().includes(q));
        if (!matches) return false;
      }

      return true;
    });
  }, [daybookTransactions, viewMode, selectedDate, dateFrom, dateTo, branchFilter, deptFilter, categoryFilter, accountFilter, search]);

  // Daily Aggregate Metrics (Totals & Opening/Closing balances)
  const metrics = useMemo(() => {
    let cashIn = 0;
    let cashOut = 0;
    let bankIn = 0;
    let bankOut = 0;
    let salesCount = 0;
    let salesAmount = 0;

    filteredEntries.forEach(item => {
      const cCr = parseFloat(item.cashCredit) || 0;
      const cDr = parseFloat(item.cashDebit) || 0;
      const bCr = parseFloat(item.bankCredit) || 0;
      const bDr = parseFloat(item.bankDebit) || 0;

      cashIn += cCr;
      cashOut += cDr;
      bankIn += bCr;
      bankOut += bDr;

      if (item.category === 'SALES') {
        salesCount++;
        salesAmount += (cCr + bCr);
      }
    });

    // Opening & Closing cash balances if viewing a single day
    let openingNotes = [];
    let closingNotes = [];

    if (viewMode === 'daily') {
      const dayItems = (daybookTransactions || []).filter(e => e.date === selectedDate);
      dayItems.forEach(e => {
        if (e.balanceNote) {
          const note = e.balanceNote.trim();
          if (note.startsWith('O-')) {
            openingNotes.push(`${e.branch} ${e.department}: ₹${note.substring(2)}`);
          } else if (note.startsWith('C-')) {
            closingNotes.push(`${e.branch} ${e.department}: ₹${note.substring(2)}`);
          }
        }
      });
    }

    return {
      count: filteredEntries.length,
      cashIn,
      cashOut,
      netCash: cashIn - cashOut,
      bankIn,
      bankOut,
      netBank: bankIn - bankOut,
      totalInflow: cashIn + bankIn,
      totalOutflow: cashOut + bankOut,
      netTotal: (cashIn + bankIn) - (cashOut + bankOut),
      salesCount,
      salesAmount,
      openingNotes,
      closingNotes
    };
  }, [filteredEntries, viewMode, selectedDate, daybookTransactions]);

  // Categorized breakdown (All Credits as Income, All Debits as Expense)
  const categorizedBreakdown = useMemo(() => {
    const incomes = {};
    const expenses = {};
    let totalIncome = 0;
    let totalExpense = 0;

    filteredEntries.forEach(entry => {
      const credit = (parseFloat(entry.cashCredit) || 0) + (parseFloat(entry.bankCredit) || 0);
      const debit = (parseFloat(entry.cashDebit) || 0) + (parseFloat(entry.bankDebit) || 0);
      const cat = (entry.category || 'UNCATEGORIZED').trim();

      if (credit > 0) {
        totalIncome += credit;
        if (!incomes[cat]) {
          incomes[cat] = {
            category: cat,
            count: 0,
            cash: 0,
            bank: 0,
            total: 0,
            entries: []
          };
        }
        incomes[cat].count += 1;
        incomes[cat].cash += (parseFloat(entry.cashCredit) || 0);
        incomes[cat].bank += (parseFloat(entry.bankCredit) || 0);
        incomes[cat].total += credit;
        incomes[cat].entries.push(entry);
      }

      if (debit > 0) {
        totalExpense += debit;
        if (!expenses[cat]) {
          expenses[cat] = {
            category: cat,
            count: 0,
            cash: 0,
            bank: 0,
            total: 0,
            entries: []
          };
        }
        expenses[cat].count += 1;
        expenses[cat].cash += (parseFloat(entry.cashDebit) || 0);
        expenses[cat].bank += (parseFloat(entry.bankDebit) || 0);
        expenses[cat].total += debit;
        expenses[cat].entries.push(entry);
      }
    });

    const incomeList = Object.values(incomes).sort((a, b) => b.total - a.total);
    const expenseList = Object.values(expenses).sort((a, b) => b.total - a.total);

    return {
      incomeList,
      expenseList,
      totalIncome,
      totalExpense,
      netDifference: totalIncome - totalExpense
    };
  }, [filteredEntries]);

  // Paginated Sliced Entries (Zero Lag UI)
  const totalPages = Math.ceil(filteredEntries.length / pageSize) || 1;
  const paginatedEntries = useMemo(() => {
    if (pageSize === 'all') return filteredEntries;
    const start = (currentPage - 1) * pageSize;
    return filteredEntries.slice(start, start + pageSize);
  }, [filteredEntries, currentPage, pageSize]);

  // Reset to page 1 on filter changes
  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
    }
  };

  // Open Sale Detail if linked
  const handleViewSale = (saleId) => {
    if (!saleId || !onViewSale) return;
    const found = sales.find(s => s.id === saleId);
    if (found) {
      onViewSale(found);
    } else {
      showToast('Sale record not found', 'info');
    }
  };

  // Export Daybook to Excel
  const handleExportExcel = () => {
    if (filteredEntries.length === 0) {
      showToast('No Day Book entries to export', 'error');
      return;
    }

    const rows = [
      ['RS DESIGNS - DAY BOOK REGISTER'],
      [`Period: ${viewMode === 'daily' ? formatDate(selectedDate) : `${dateFrom} to ${dateTo}`} | Branch: ${branchFilter} | Dept: ${deptFilter}`],
      [],
      [
        'DATE',
        'EST NO',
        'PAYMENT METHOD',
        'BRANCH',
        'DEPARTMENT',
        'CATEGORY',
        'DESCRIPTION / PARTY',
        'CASH CREDIT (IN)',
        'CASH DEBIT (OUT)',
        'BANK CREDIT (IN)',
        'BANK DEBIT (OUT)',
        'BALANCE NOTE'
      ]
    ];

    filteredEntries.forEach(item => {
      rows.push([
        item.date,
        item.estNo || '',
        item.payment || '',
        item.branch || '',
        item.department || '',
        item.category || '',
        item.description || '',
        item.cashCredit || '',
        item.cashDebit || '',
        item.bankCredit || '',
        item.bankDebit || '',
        item.balanceNote || ''
      ]);
    });

    // Add Totals row
    rows.push([]);
    rows.push([
      'TOTAL',
      '',
      '',
      '',
      '',
      '',
      `Total Entries: ${filteredEntries.length}`,
      metrics.cashIn,
      metrics.cashOut,
      metrics.bankIn,
      metrics.bankOut,
      `Net Cash: ${metrics.netCash} | Net Bank: ${metrics.netBank}`
    ]);

    const workbook = XLSX.utils.book_new();

    if (viewMode === 'categorized') {
      const summaryRows = [
        ['RS DESIGNS - CATEGORIZED INCOMES & EXPENSES LEDGER'],
        [`Period: ${viewMode === 'daily' ? formatDate(selectedDate) : `${dateFrom} to ${dateTo}`} | Total Records: ${filteredEntries.length}`],
        [],
        ['PART A: INCOMES & RECEIPTS (CREDITS)'],
        ['CATEGORY', 'ENTRIES COUNT', 'CASH CREDIT (INR)', 'BANK CREDIT (INR)', 'TOTAL INFLOW (INR)'],
        ...categorizedBreakdown.incomeList.map(c => [
          c.category,
          c.count,
          c.cash,
          c.bank,
          c.total
        ]),
        ['TOTAL INCOMES', categorizedBreakdown.incomeList.reduce((acc, c) => acc + c.count, 0), metrics.cashIn, metrics.bankIn, categorizedBreakdown.totalIncome],
        [],
        ['PART B: EXPENSES & OUTFLOWS (DEBITS)'],
        ['CATEGORY', 'ENTRIES COUNT', 'CASH DEBIT (INR)', 'BANK DEBIT (INR)', 'TOTAL OUTFLOW (INR)'],
        ...categorizedBreakdown.expenseList.map(c => [
          c.category,
          c.count,
          c.cash,
          c.bank,
          c.total
        ]),
        ['TOTAL EXPENSES', categorizedBreakdown.expenseList.reduce((acc, c) => acc + c.count, 0), metrics.cashOut, metrics.bankOut, categorizedBreakdown.totalExpense],
        [],
        ['NET OPERATING CASH SURPLUS', '', '', '', categorizedBreakdown.netDifference]
      ];
      const summarySheet = XLSX.utils.aoa_to_sheet(summaryRows);
      XLSX.utils.book_append_sheet(workbook, summarySheet, 'Category Summary');
    }

    const worksheet = XLSX.utils.aoa_to_sheet(rows);
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Day Book Journal');
    XLSX.writeFile(workbook, `RS_Designs_DayBook_${viewMode === 'categorized' ? 'Categorized' : viewMode === 'daily' ? selectedDate : 'Range'}.xlsx`);
    showToast(`Exported ${filteredEntries.length} records to Excel`, 'success');
  };

  // Open New Entry Modal
  const handleOpenNewModal = () => {
    setFormDate(selectedDate || new Date().toISOString().substring(0, 10));
    setFormBranch('KLK');
    setFormDept('OFFSET');
    setFormPayment('CASH');
    setFormCategory('SALES');
    setFormEstNo('');
    setFormDesc('');
    setFormType('CASH_CREDIT');
    setFormAmount('');
    setFormNote('');
    setShowNewModal(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (entry) => {
    setEditingEntry(entry);
    setFormDate(entry.date);
    setFormBranch(entry.branch || 'KLK');
    setFormDept(entry.department || 'OFFSET');
    setFormPayment(entry.payment || 'CASH');
    setFormCategory(entry.category || 'SALES');
    setFormEstNo(entry.estNo || '');
    setFormDesc(entry.description || '');
    setFormNote(entry.balanceNote || '');

    if (entry.cashCredit > 0) {
      setFormType('CASH_CREDIT');
      setFormAmount(String(entry.cashCredit));
    } else if (entry.cashDebit > 0) {
      setFormType('CASH_DEBIT');
      setFormAmount(String(entry.cashDebit));
    } else if (entry.bankCredit > 0) {
      setFormType('BANK_CREDIT');
      setFormAmount(String(entry.bankCredit));
    } else if (entry.bankDebit > 0) {
      setFormType('BANK_DEBIT');
      setFormAmount(String(entry.bankDebit));
    } else {
      setFormType('CASH_CREDIT');
      setFormAmount('');
    }
  };

  // Save New / Edited Entry
  const handleSaveEntry = (e) => {
    e.preventDefault();
    const amt = parseFloat(formAmount) || 0;
    if (amt <= 0 && !formNote) {
      showToast('Please enter a valid amount greater than 0', 'error');
      return;
    }

    let cashCredit = 0;
    let cashDebit = 0;
    let bankCredit = 0;
    let bankDebit = 0;

    if (formType === 'CASH_CREDIT') cashCredit = amt;
    else if (formType === 'CASH_DEBIT') cashDebit = amt;
    else if (formType === 'BANK_CREDIT') bankCredit = amt;
    else if (formType === 'BANK_DEBIT') bankDebit = amt;
    else if (formType === 'CONTRA_DEPOSIT') {
      cashDebit = amt;
      bankCredit = amt;
    }

    const payload = {
      date: formDate,
      estNo: formEstNo.trim(),
      payment: formPayment,
      branch: formBranch,
      department: formDept,
      category: formCategory.toUpperCase(),
      description: formDesc.trim(),
      cashCredit,
      cashDebit,
      bankCredit,
      bankDebit,
      balanceNote: formNote.trim()
    };

    if (editingEntry) {
      updateDaybookTransaction(editingEntry.id, payload);
      showToast('Day Book transaction updated', 'success');
      setEditingEntry(null);
    } else {
      addDaybookTransaction(payload);
      showToast('New Day Book transaction recorded', 'success');
      setShowNewModal(false);
    }
  };

  // Delete Entry
  const handleConfirmDelete = () => {
    if (!deletingEntry) return;
    deleteDaybookTransaction(deletingEntry.id);
    setSelectedEntryIds(prev => {
      const next = new Set(prev);
      next.delete(deletingEntry.id);
      return next;
    });
    showToast('Day Book transaction removed and synchronized', 'success');
    setDeletingEntry(null);
  };

  // Multi-Select Handlers
  const handleToggleSelectEntry = (id) => {
    setSelectedEntryIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectAllCurrentPage = () => {
    const pageIds = paginatedEntries.map(e => e.id);
    const allSelected = pageIds.length > 0 && pageIds.every(id => selectedEntryIds.has(id));
    setSelectedEntryIds(prev => {
      const next = new Set(prev);
      if (allSelected) {
        pageIds.forEach(id => next.delete(id));
      } else {
        pageIds.forEach(id => next.add(id));
      }
      return next;
    });
  };

  const handleSelectAllFiltered = () => {
    const allIds = filteredEntries.map(e => e.id);
    setSelectedEntryIds(new Set(allIds));
  };

  const handleClearSelection = () => {
    setSelectedEntryIds(new Set());
  };

  const handleConfirmBulkDelete = async () => {
    if (selectedEntryIds.size === 0) return;
    const count = selectedEntryIds.size;
    const ids = Array.from(selectedEntryIds);
    await deleteDaybookTransactions(ids);
    setSelectedEntryIds(new Set());
    setShowBulkDeleteConfirm(false);
    showToast(`Successfully deleted ${count} selected Day Book transaction(s) and synchronized vouchers`, 'success');
  };

  // Wipe Demo Non-Register Entries
  const handleConfirmWipeNonRegister = () => {
    const removedCount = cleanNonRegisterDaybookEntries ? cleanNonRegisterDaybookEntries() : 0;
    showToast(`Wiped ${removedCount} demo transactions. Day Book now reflects only Purchase, Asset & Expense registers.`, 'success');
    setShowWipeNonRegisterConfirm(false);
  };

  // Reset to Default
  const handleConfirmReset = () => {
    resetDaybookToDefault();
    showToast('Day Book reset to verified Purchase, Asset & Expense ledger', 'success');
    setShowResetConfirm(false);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner indicating Day Book Engine */}
      <div className="bg-blue-500/10 border border-blue-500/30 text-blue-900 p-3 rounded-2xl flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
          <span className="font-extrabold uppercase tracking-wide">Day Book Register & Daily Cash Drawers</span>
          <span className="text-slate-500 hidden sm:inline">• Authoritative Daily Financial Ledger</span>
        </div>
        <div className="flex items-center gap-2 font-mono text-[11px]">
          <span>{daybookTransactions.length} Verified Ledger Rows</span>
        </div>
      </div>

      {/* Main Header & Actions */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
            <BookOpen className="w-7 h-7 text-blue-600" />
            <span>Day Book Space</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Daily chronological register of cash drawer movements, bank receipts, operating disbursements & closing balances
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap justify-end">
          <button
            onClick={() => setShowWipeNonRegisterConfirm(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-xl text-xs font-bold transition-all border border-rose-200"
            title="Wipe demo entries unassociated with Purchases, Fixed Assets, or Expenses"
          >
            <Trash2 className="w-3.5 h-3.5 text-rose-600" />
            <span>Wipe Demo Entries</span>
          </button>

          <button
            onClick={() => setShowResetConfirm(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all border border-slate-200"
            title="Reload default Day Book dataset"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Ledger</span>
          </button>

          <button
            onClick={handleExportExcel}
            className="flex items-center gap-1.5 px-3.5 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-xl text-xs font-bold shadow-xs transition-all"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Export Excel</span>
          </button>

          <button
            onClick={handleOpenNewModal}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-xl text-xs font-bold shadow-xs transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>New Day Entry</span>
          </button>
        </div>
      </div>

      {/* Date Navigation & View Switcher */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        {/* Row 1: View Modes & Date Picker */}
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl flex-wrap">
            <button
              onClick={() => { setViewMode('daily'); setCurrentPage(1); }}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                viewMode === 'daily'
                  ? 'bg-white text-blue-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Daily Register View
            </button>
            <button
              onClick={() => { setViewMode('range'); setCurrentPage(1); }}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                viewMode === 'range'
                  ? 'bg-white text-blue-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Date Range View
            </button>
            <button
              onClick={() => { setViewMode('all'); setCurrentPage(1); }}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                viewMode === 'all'
                  ? 'bg-white text-blue-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Full Ledger (All Dates)
            </button>
            <button
              onClick={() => { setViewMode('categorized'); setCurrentPage(1); }}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                viewMode === 'categorized'
                  ? 'bg-white text-blue-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              📊 Categorized Incomes & Expenses
            </button>
          </div>

          {/* Daily Stepper */}
          {viewMode === 'daily' && (
            <div className="flex items-center gap-2">
              <button
                onClick={handlePrevDay}
                disabled={availableDates.indexOf(selectedDate) <= 0}
                className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed text-slate-700"
                title="Previous Day"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-2 bg-blue-50/70 border border-blue-200 px-3 py-1.5 rounded-xl">
                <Calendar className="w-4 h-4 text-blue-600" />
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => {
                    setSelectedDate(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="bg-transparent text-xs font-mono font-black text-blue-950 focus:outline-none cursor-pointer"
                />
              </div>

              <button
                onClick={handleNextDay}
                disabled={availableDates.indexOf(selectedDate) >= availableDates.length - 1}
                className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed text-slate-700"
                title="Next Day"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Date Range Inputs */}
          {viewMode === 'range' && (
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => { setDateFrom(e.target.value); setCurrentPage(1); }}
                className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs font-mono font-bold"
              />
              <span className="text-slate-400 text-xs">to</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => { setDateTo(e.target.value); setCurrentPage(1); }}
                className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs font-mono font-bold"
              />
            </div>
          )}
        </div>

        {/* Quick Date Pills */}
        {viewMode === 'daily' && (
          <div className="flex items-center gap-1 overflow-x-auto pb-1.5 pt-1 border-t border-slate-100 scrollbar-thin">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mr-1.5 flex-shrink-0">
              Dates:
            </span>
            {availableDates.map(d => {
              const dayNum = d.split('-')[2];
              const isSelected = d === selectedDate;
              return (
                <button
                  key={d}
                  onClick={() => { setSelectedDate(d); setCurrentPage(1); }}
                  className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold flex-shrink-0 transition-all ${
                    isSelected
                      ? 'bg-blue-600 text-white shadow-xs scale-105'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
                  }`}
                >
                  {dayNum}
                </button>
              );
            })}
          </div>
        )}

        {/* Row 2: Search & Advanced Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-2 border-t border-slate-100">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search EST #, party, note..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
              className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <select
              value={branchFilter}
              onChange={(e) => { setBranchFilter(e.target.value); setCurrentPage(1); }}
              className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Branches (RMD & KLK)</option>
              <option value="RMD">RMD (Ramanathapuram)</option>
              <option value="KLK">KLK (Kilakarai)</option>
            </select>
          </div>

          <div>
            <select
              value={deptFilter}
              onChange={(e) => { setDeptFilter(e.target.value); setCurrentPage(1); }}
              className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Departments</option>
              <option value="OFFSET">OFFSET (Print & Pack / Invitation)</option>
              <option value="FLEX">FLEX (Advertisement)</option>
            </select>
          </div>

          <div>
            <select
              value={categoryFilter}
              onChange={(e) => { setCategoryFilter(e.target.value); setCurrentPage(1); }}
              className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Categories ({allCategories.length})</option>
              {allCategories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Aggregate Metric Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Cash Inflow */}
        <div className="bg-white p-3.5 rounded-2xl border border-emerald-100 shadow-2xs">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
            <ArrowUpRight className="w-3 h-3 text-emerald-500" />
            <span>Cash In (Credit)</span>
          </p>
          <p className="text-lg font-black text-emerald-700 font-mono mt-1">
            {formatCurrency(metrics.cashIn)}
          </p>
          <span className="text-[10px] text-emerald-600 font-medium">Physical Cash Received</span>
        </div>

        {/* Cash Outflow */}
        <div className="bg-white p-3.5 rounded-2xl border border-rose-100 shadow-2xs">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
            <ArrowDownRight className="w-3 h-3 text-rose-500" />
            <span>Cash Out (Debit)</span>
          </p>
          <p className="text-lg font-black text-rose-700 font-mono mt-1">
            {formatCurrency(metrics.cashOut)}
          </p>
          <span className="text-[10px] text-rose-600 font-medium">Cash Expenses & Disbursed</span>
        </div>

        {/* Net Cash Movement */}
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
            <Wallet className="w-3 h-3 text-blue-500" />
            <span>Net Cash Movement</span>
          </p>
          <p className={`text-lg font-black font-mono mt-1 ${metrics.netCash >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
            {metrics.netCash >= 0 ? '+' : ''}{formatCurrency(metrics.netCash)}
          </p>
          <span className="text-[10px] text-slate-500 font-medium">Drawer Net Balance Change</span>
        </div>

        {/* Bank Inflow */}
        <div className="bg-white p-3.5 rounded-2xl border border-blue-100 shadow-2xs">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
            <CreditCard className="w-3 h-3 text-blue-500" />
            <span>Bank In (Credit)</span>
          </p>
          <p className="text-lg font-black text-blue-700 font-mono mt-1">
            {formatCurrency(metrics.bankIn)}
          </p>
          <span className="text-[10px] text-blue-600 font-medium">IDBI / SBI UPI Receipts</span>
        </div>

        {/* Bank Outflow */}
        <div className="bg-white p-3.5 rounded-2xl border border-amber-100 shadow-2xs">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
            <ArrowDownRight className="w-3 h-3 text-amber-500" />
            <span>Bank Out (Debit)</span>
          </p>
          <p className="text-lg font-black text-amber-700 font-mono mt-1">
            {formatCurrency(metrics.bankOut)}
          </p>
          <span className="text-[10px] text-amber-600 font-medium">Bank Payments & Contra</span>
        </div>

        {/* Register Disbursements / Outflow */}
        <div className="bg-white p-3.5 rounded-2xl border border-indigo-100 shadow-2xs">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
            <TrendingDown className="w-3 h-3 text-indigo-500" />
            <span>Register Outflow</span>
          </p>
          <p className="text-lg font-black text-indigo-700 font-mono mt-1">
            {formatCurrency(metrics.cashOut + metrics.bankOut)}
          </p>
          <span className="text-[10px] text-indigo-600 font-medium">{filteredEntries.length} Register Entries</span>
        </div>
      </div>

      {/* Opening & Closing Balance Bar (When viewing single day) */}
      {viewMode === 'daily' && (metrics.openingNotes.length > 0 || metrics.closingNotes.length > 0) && (
        <div className="bg-slate-900 text-white p-4 rounded-2xl shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold">
              ₹
            </div>
            <div>
              <p className="text-[10px] font-bold text-blue-300 uppercase tracking-wider">
                Drawer Opening Balances ({formatDate(selectedDate)})
              </p>
              <div className="flex items-center gap-3 text-xs font-mono font-bold mt-0.5 flex-wrap">
                {metrics.openingNotes.map((note, idx) => (
                  <span key={idx} className="bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
                    {note}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 border-t md:border-t-0 md:border-l border-slate-800 pt-3 md:pt-0 md:pl-4">
            <div>
              <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">
                Drawer Closing Balances (Day End)
              </p>
              <div className="flex items-center gap-3 text-xs font-mono font-bold mt-0.5 flex-wrap">
                {metrics.closingNotes.map((note, idx) => (
                  <span key={idx} className="bg-emerald-950/60 text-emerald-300 px-2 py-0.5 rounded border border-emerald-800/60">
                    {note}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Categorized Incomes & Expenses View OR Transactions Table Container */}
      {viewMode === 'categorized' ? (
        <div className="space-y-6">
          {/* Categorized Summary Bar */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
                <span>Categorized Ledger Breakdown (Credits vs Debits)</span>
                <span className="text-xs px-2.5 py-0.5 bg-blue-100 text-blue-800 rounded-full font-bold">
                  {categorizedBreakdown.incomeList.length} Income Streams • {categorizedBreakdown.expenseList.length} Expense Categories
                </span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                All credit entries classified as Revenue & Inflows, and debit entries classified as Operating, Material & Financial Expenses
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => {
                  const allExpanded = {};
                  categorizedBreakdown.incomeList.forEach(c => { allExpanded[`inc_${c.category}`] = true; });
                  categorizedBreakdown.expenseList.forEach(c => { allExpanded[`exp_${c.category}`] = true; });
                  setExpandedCategories(allExpanded);
                }}
                className="px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-bold transition-all"
              >
                Expand All
              </button>
              <button
                onClick={() => setExpandedCategories({})}
                className="px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-bold transition-all"
              >
                Collapse All
              </button>
            </div>
          </div>

          {/* KPI Strip */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-gradient-to-br from-emerald-50 to-white p-5 rounded-2xl border-2 border-emerald-200 shadow-xs">
              <div className="flex justify-between items-center text-xs font-black uppercase text-emerald-800">
                <span>Total Credits (All Incomes)</span>
                <ArrowUpRight className="w-5 h-5 text-emerald-600" />
              </div>
              <p className="text-2xl font-black text-emerald-950 font-mono mt-1">
                {formatCurrency(categorizedBreakdown.totalIncome)}
              </p>
              <p className="text-[11px] text-emerald-700 mt-1">
                {categorizedBreakdown.incomeList.reduce((acc, c) => acc + c.count, 0)} Total Inflow Entries
              </p>
            </div>

            <div className="bg-gradient-to-br from-rose-50 to-white p-5 rounded-2xl border-2 border-rose-200 shadow-xs">
              <div className="flex justify-between items-center text-xs font-black uppercase text-rose-800">
                <span>Total Debits (All Expenses & Outflows)</span>
                <ArrowDownRight className="w-5 h-5 text-rose-600" />
              </div>
              <p className="text-2xl font-black text-rose-950 font-mono mt-1">
                {formatCurrency(categorizedBreakdown.totalExpense)}
              </p>
              <p className="text-[11px] text-rose-700 mt-1">
                {categorizedBreakdown.expenseList.reduce((acc, c) => acc + c.count, 0)} Total Outflow Entries
              </p>
            </div>

            <div className={`p-5 rounded-2xl border-2 shadow-xs bg-gradient-to-br ${
              categorizedBreakdown.netDifference >= 0 
                ? 'from-blue-50 to-white border-blue-200 text-blue-950' 
                : 'from-amber-50 to-white border-amber-200 text-amber-950'
            }`}>
              <div className="flex justify-between items-center text-xs font-black uppercase">
                <span>Net Operating Cash Difference</span>
                <TrendingUp className="w-5 h-5 text-blue-600" />
              </div>
              <p className="text-2xl font-black font-mono mt-1">
                {formatCurrency(categorizedBreakdown.netDifference)}
              </p>
              <p className="text-[11px] text-slate-500 mt-1">
                Surplus Inflow into Drawers & Bank Accounts
              </p>
            </div>
          </div>

          {/* Dual Columns: Incomes vs Expenses */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
            {/* Left Column: All Incomes */}
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-2 border-b-2 border-emerald-500">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-emerald-500" />
                  <h4 className="font-black text-slate-900 text-base">Incomes & Receipts (Credits)</h4>
                </div>
                <span className="text-xs font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                  {formatCurrency(categorizedBreakdown.totalIncome)}
                </span>
              </div>

              {categorizedBreakdown.incomeList.length === 0 ? (
                <div className="p-8 text-center bg-white rounded-2xl border border-slate-200 text-slate-400 text-xs">
                  No credit/income entries in this period.
                </div>
              ) : (
                categorizedBreakdown.incomeList.map(catItem => {
                  const key = `inc_${catItem.category}`;
                  const isExpanded = !!expandedCategories[key];
                  const pct = categorizedBreakdown.totalIncome > 0 ? ((catItem.total / categorizedBreakdown.totalIncome) * 100).toFixed(1) : 0;
                  return (
                    <div key={key} className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden transition-all hover:border-emerald-300">
                      <div 
                        onClick={() => toggleCategoryExpand(key)}
                        className="p-4 cursor-pointer flex items-center justify-between gap-3 hover:bg-slate-50/60"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold text-xs border border-emerald-200">
                            {catItem.category.substring(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-extrabold text-sm text-slate-900">{catItem.category}</span>
                              <span className="text-[10px] px-2 py-0.2 bg-emerald-100 text-emerald-800 rounded font-semibold">
                                {catItem.count} entries
                              </span>
                            </div>
                            <div className="flex items-center gap-3 text-[11px] text-slate-500 mt-0.5">
                              <span>Cash: <strong className="font-mono text-slate-700">{formatCurrency(catItem.cash)}</strong></span>
                              <span>•</span>
                              <span>Bank: <strong className="font-mono text-slate-700">{formatCurrency(catItem.bank)}</strong></span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <p className="font-mono font-black text-emerald-700 text-sm">{formatCurrency(catItem.total)}</p>
                            <span className="text-[10px] text-slate-400 font-bold">{pct}% of income</span>
                          </div>
                          <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                        </div>
                      </div>

                      {/* Collapsible Entries Drawer */}
                      {isExpanded && (
                        <div className="border-t border-slate-100 bg-slate-50/50 p-3 max-h-72 overflow-y-auto">
                          <table className="w-full text-left text-xs border-collapse">
                            <thead>
                              <tr className="text-[10px] uppercase font-bold text-slate-400 border-b border-slate-200">
                                <th className="pb-1.5">Date</th>
                                <th className="pb-1.5">EST / Ref</th>
                                <th className="pb-1.5">Party / Details</th>
                                <th className="pb-1.5">Mode</th>
                                <th className="pb-1.5 text-right">Amount (₹)</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {catItem.entries.map((e, idx) => (
                                <tr key={idx} className="hover:bg-white/80">
                                  <td className="py-1.5 font-mono text-[11px] text-slate-600">{formatDate(e.date)}</td>
                                  <td className="py-1.5 font-mono text-[11px] text-blue-700">{e.estNo ? `#${e.estNo}` : '-'}</td>
                                  <td className="py-1.5 font-medium text-slate-800">{e.description || '-'}</td>
                                  <td className="py-1.5 text-[10px] text-slate-500">{e.payment || 'CASH'}</td>
                                  <td className="py-1.5 text-right font-mono font-bold text-emerald-700">
                                    {formatCurrency((e.cashCredit || 0) + (e.bankCredit || 0))}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Right Column: All Expenses & Outflows */}
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-2 border-b-2 border-rose-500">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-rose-500" />
                  <h4 className="font-black text-slate-900 text-base">Expenses & Outflows (Debits)</h4>
                </div>
                <span className="text-xs font-mono font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
                  {formatCurrency(categorizedBreakdown.totalExpense)}
                </span>
              </div>

              {categorizedBreakdown.expenseList.length === 0 ? (
                <div className="p-8 text-center bg-white rounded-2xl border border-slate-200 text-slate-400 text-xs">
                  No debit/expense entries in this period.
                </div>
              ) : (
                categorizedBreakdown.expenseList.map(catItem => {
                  const key = `exp_${catItem.category}`;
                  const isExpanded = !!expandedCategories[key];
                  const pct = categorizedBreakdown.totalExpense > 0 ? ((catItem.total / categorizedBreakdown.totalExpense) * 100).toFixed(1) : 0;
                  return (
                    <div key={key} className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden transition-all hover:border-rose-300">
                      <div 
                        onClick={() => toggleCategoryExpand(key)}
                        className="p-4 cursor-pointer flex items-center justify-between gap-3 hover:bg-slate-50/60"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-700 flex items-center justify-center font-bold text-xs border border-rose-200">
                            {catItem.category.substring(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-extrabold text-sm text-slate-900">{catItem.category}</span>
                              <span className="text-[10px] px-2 py-0.2 bg-rose-100 text-rose-800 rounded font-semibold">
                                {catItem.count} entries
                              </span>
                            </div>
                            <div className="flex items-center gap-3 text-[11px] text-slate-500 mt-0.5">
                              <span>Cash: <strong className="font-mono text-slate-700">{formatCurrency(catItem.cash)}</strong></span>
                              <span>•</span>
                              <span>Bank: <strong className="font-mono text-slate-700">{formatCurrency(catItem.bank)}</strong></span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <p className="font-mono font-black text-rose-700 text-sm">{formatCurrency(catItem.total)}</p>
                            <span className="text-[10px] text-slate-400 font-bold">{pct}% of outflow</span>
                          </div>
                          <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                        </div>
                      </div>

                      {/* Collapsible Entries Drawer */}
                      {isExpanded && (
                        <div className="border-t border-slate-100 bg-slate-50/50 p-3 max-h-72 overflow-y-auto">
                          <table className="w-full text-left text-xs border-collapse">
                            <thead>
                              <tr className="text-[10px] uppercase font-bold text-slate-400 border-b border-slate-200">
                                <th className="pb-1.5">Date</th>
                                <th className="pb-1.5">EST / Ref</th>
                                <th className="pb-1.5">Party / Details</th>
                                <th className="pb-1.5">Mode</th>
                                <th className="pb-1.5 text-right">Amount (₹)</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {catItem.entries.map((e, idx) => (
                                <tr key={idx} className="hover:bg-white/80">
                                  <td className="py-1.5 font-mono text-[11px] text-slate-600">{formatDate(e.date)}</td>
                                  <td className="py-1.5 font-mono text-[11px] text-slate-500">{e.estNo ? `#${e.estNo}` : '-'}</td>
                                  <td className="py-1.5 font-medium text-slate-800">{e.description || '-'}</td>
                                  <td className="py-1.5 text-[10px] text-slate-500">{e.payment || 'CASH'}</td>
                                  <td className="py-1.5 text-right font-mono font-bold text-rose-700">
                                    {formatCurrency((e.cashDebit || 0) + (e.bankDebit || 0))}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      ) : (
        /* Regular Daybook Transactions Table Container */
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          {/* Table Toolbar */}
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <div className="flex items-center gap-2 font-medium">
              <span>Showing {paginatedEntries.length} of {filteredEntries.length} transactions</span>
              {viewMode === 'daily' && (
                <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full font-bold">
                  {formatDate(selectedDate)}
                </span>
              )}
            </div>

          <div className="flex items-center gap-2">
            <span>Rows per page:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(e.target.value === 'all' ? 'all' : parseInt(e.target.value));
                setCurrentPage(1);
              }}
              className="bg-slate-50 border border-slate-200 rounded px-2 py-0.5 text-xs font-bold"
            >
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value="all">All</option>
            </select>
          </div>
        </div>

        {/* Multi-Select Bulk Actions Bar */}
        {selectedEntryIds.size > 0 && (
          <div className="bg-rose-50 border-b border-rose-200 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 animate-in fade-in">
            <div className="flex items-center gap-3">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-rose-200 text-rose-800">
                {selectedEntryIds.size} SELECTED
              </span>
              <span className="text-xs text-rose-900 font-bold">
                {selectedEntryIds.size} Day Book transaction{selectedEntryIds.size > 1 ? 's' : ''} chosen
              </span>
              <button
                type="button"
                onClick={handleSelectAllFiltered}
                className="text-xs font-semibold text-rose-700 underline hover:text-rose-900 cursor-pointer"
              >
                Select all {filteredEntries.length} filtered
              </button>
              <span className="text-slate-300">|</span>
              <button
                type="button"
                onClick={handleClearSelection}
                className="text-xs font-semibold text-slate-500 hover:text-slate-800 cursor-pointer"
              >
                Clear selection
              </button>
            </div>
            <button
              type="button"
              onClick={() => setShowBulkDeleteConfirm(true)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Delete Selected ({selectedEntryIds.size})
            </button>
          </div>
        )}

        {/* The Daybook Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 font-bold text-slate-600">
                <th className="px-3 py-3 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={paginatedEntries.length > 0 && paginatedEntries.every(e => selectedEntryIds.has(e.id))}
                    onChange={handleSelectAllCurrentPage}
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer w-4 h-4"
                    title="Select all on this page"
                  />
                </th>
                <th className="px-3.5 py-3 w-12 text-center">#</th>
                <th className="px-3.5 py-3 w-24">Date</th>
                <th className="px-3.5 py-3 w-28">EST / Bill No</th>
                <th className="px-3.5 py-3 w-28">Payment</th>
                <th className="px-3.5 py-3 w-24">Branch / Dept</th>
                <th className="px-3.5 py-3 w-32">Category</th>
                <th className="px-3.5 py-3 min-w-[180px]">Description / Party</th>
                <th className="px-3.5 py-3 text-right text-emerald-800 bg-emerald-50/50">Cash Credit (In)</th>
                <th className="px-3.5 py-3 text-right text-rose-800 bg-rose-50/50">Cash Debit (Out)</th>
                <th className="px-3.5 py-3 text-right text-blue-800 bg-blue-50/50">Bank Credit (In)</th>
                <th className="px-3.5 py-3 text-right text-amber-800 bg-amber-50/50">Bank Debit (Out)</th>
                <th className="px-3.5 py-3 w-24 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {paginatedEntries.length === 0 ? (
                <tr>
                  <td colSpan="13" className="py-12 text-center text-slate-400">
                    <p className="font-bold text-slate-600 text-sm">No Day Book entries found</p>
                    <p className="text-xs text-slate-400 mt-1">Try selecting another date or adjusting your filters</p>
                  </td>
                </tr>
              ) : (
                paginatedEntries.map((item, idx) => {
                  const globalIdx = pageSize === 'all' ? idx + 1 : (currentPage - 1) * pageSize + idx + 1;
                  const isSales = item.category === 'SALES';
                  const hasNote = Boolean(item.balanceNote);

                  return (
                    <tr key={item.id} className={`hover:bg-slate-50/80 transition-colors ${selectedEntryIds.has(item.id) ? 'bg-blue-50/40' : ''}`}>
                      <td className="px-3 py-2.5 text-center">
                        <input
                          type="checkbox"
                          checked={selectedEntryIds.has(item.id)}
                          onChange={() => handleToggleSelectEntry(item.id)}
                          className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer w-4 h-4"
                        />
                      </td>
                      <td className="px-3.5 py-2.5 text-center font-mono text-[11px] text-slate-400">
                        {globalIdx}
                      </td>

                      <td className="px-3.5 py-2.5 font-mono text-[11px] whitespace-nowrap font-medium text-slate-700">
                        {formatDate(item.date)}
                      </td>

                      <td className="px-3.5 py-2.5 whitespace-nowrap">
                        {item.estNo ? (
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono font-bold text-slate-900 bg-slate-100 px-1.5 py-0.5 rounded text-[11px]">
                              #{item.estNo}
                            </span>
                            {item.matchedSaleId && (
                              <button
                                onClick={() => handleViewSale(item.matchedSaleId)}
                                className="text-blue-600 hover:text-blue-800 p-0.5 rounded hover:bg-blue-50"
                                title="View synced Sales Bill"
                              >
                                <ExternalLink className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-300">-</span>
                        )}
                      </td>

                      <td className="px-3.5 py-2.5 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-md font-bold text-[10px] ${
                          item.payment === 'CASH'
                            ? 'bg-emerald-100 text-emerald-800'
                            : (item.payment.includes('IDBI') ? 'bg-indigo-100 text-indigo-800' : 'bg-blue-100 text-blue-800')
                        }`}>
                          {item.payment || 'CASH'}
                        </span>
                      </td>

                      <td className="px-3.5 py-2.5 whitespace-nowrap">
                        <span className="font-bold text-slate-800">{item.branch}</span>
                        <span className="text-slate-400 text-[10px] ml-1">({item.department})</span>
                      </td>

                      <td className="px-3.5 py-2.5 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          isSales
                            ? 'bg-emerald-100 text-emerald-800'
                            : (item.category.includes('FINANCE') ? 'bg-purple-100 text-purple-800'
                            : (item.category.includes('TRANSPORT') ? 'bg-amber-100 text-amber-800'
                            : (item.category.includes('WELFARE') || item.category.includes('FUEL') ? 'bg-sky-100 text-sky-800'
                            : 'bg-slate-100 text-slate-700')))
                        }`}>
                          {item.category}
                        </span>
                      </td>

                      <td className="px-3.5 py-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold text-slate-900 truncate">
                            {item.description || '-'}
                          </span>
                          {hasNote && (
                            <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-800 text-amber-300 flex-shrink-0" title="Cash Drawer Note">
                              {item.balanceNote}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Cash Credit */}
                      <td className="px-3.5 py-2.5 text-right font-mono font-bold text-emerald-700 bg-emerald-50/20 whitespace-nowrap">
                        {item.cashCredit > 0 ? formatCurrency(item.cashCredit) : '-'}
                      </td>

                      {/* Cash Debit */}
                      <td className="px-3.5 py-2.5 text-right font-mono font-bold text-rose-700 bg-rose-50/20 whitespace-nowrap">
                        {item.cashDebit > 0 ? formatCurrency(item.cashDebit) : '-'}
                      </td>

                      {/* Bank Credit */}
                      <td className="px-3.5 py-2.5 text-right font-mono font-bold text-blue-700 bg-blue-50/20 whitespace-nowrap">
                        {item.bankCredit > 0 ? formatCurrency(item.bankCredit) : '-'}
                      </td>

                      {/* Bank Debit */}
                      <td className="px-3.5 py-2.5 text-right font-mono font-bold text-amber-700 bg-amber-50/20 whitespace-nowrap">
                        {item.bankDebit > 0 ? formatCurrency(item.bankDebit) : '-'}
                      </td>

                      {/* Actions */}
                      <td className="px-3.5 py-2.5 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => handleOpenEdit(item)}
                            className="p-1 rounded text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                            title="Edit Entry"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setDeletingEntry(item)}
                            className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                            title="Delete Entry"
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
            {/* Table Footer Totals */}
            {filteredEntries.length > 0 && (
              <tfoot>
                <tr className="bg-slate-100 border-t-2 border-slate-300 font-black text-slate-900 text-xs">
                  <td colSpan="8" className="px-4 py-3 text-right tracking-wider uppercase text-[11px] text-slate-600">
                    Day Book Totals ({filteredEntries.length} Items):
                  </td>
                  <td className="px-3.5 py-3 text-right font-mono text-emerald-800 bg-emerald-100/60 whitespace-nowrap">
                    {formatCurrency(metrics.cashIn)}
                  </td>
                  <td className="px-3.5 py-3 text-right font-mono text-rose-800 bg-rose-100/60 whitespace-nowrap">
                    {formatCurrency(metrics.cashOut)}
                  </td>
                  <td className="px-3.5 py-3 text-right font-mono text-blue-800 bg-blue-100/60 whitespace-nowrap">
                    {formatCurrency(metrics.bankIn)}
                  </td>
                  <td className="px-3.5 py-3 text-right font-mono text-amber-800 bg-amber-100/60 whitespace-nowrap">
                    {formatCurrency(metrics.bankOut)}
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {/* Pagination Bar */}
        {pageSize !== 'all' && totalPages > 1 && (
          <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
            <div>
              <span>Page {currentPage} of {totalPages}</span>
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
                        ? 'bg-blue-600 text-white'
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
      )}

      {/* New / Edit Day Book Modal */}
      {(showNewModal || editingEntry) && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-blue-600" />
                <span>{editingEntry ? 'Edit Day Book Entry' : 'Record New Day Book Transaction'}</span>
              </h3>
              <button
                onClick={() => { setShowNewModal(false); setEditingEntry(null); }}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEntry} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Date</label>
                  <input
                    type="date"
                    required
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Branch</label>
                  <select
                    value={formBranch}
                    onChange={(e) => setFormBranch(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold"
                  >
                    <option value="KLK">KLK (Kilakarai)</option>
                    <option value="RMD">RMD (Ramanathapuram)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Department</label>
                  <select
                    value={formDept}
                    onChange={(e) => setFormDept(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold"
                  >
                    <option value="OFFSET">OFFSET (Print & Pack / Invitation)</option>
                    <option value="FLEX">FLEX (Advertisement)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Category</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. SALES, STAFF WELFARE..."
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">EST / Bill No</label>
                  <input
                    type="text"
                    placeholder="Optional (e.g. 740)"
                    value={formEstNo}
                    onChange={(e) => setFormEstNo(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Transaction Nature</label>
                  <select
                    value={formType}
                    onChange={(e) => setFormType(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold"
                  >
                    <option value="CASH_CREDIT">Cash Inflow (Cash Credit)</option>
                    <option value="CASH_DEBIT">Cash Outflow (Cash Debit)</option>
                    <option value="BANK_CREDIT">Bank Inflow (Bank Credit)</option>
                    <option value="BANK_DEBIT">Bank Outflow (Bank Debit)</option>
                    <option value="CONTRA_DEPOSIT">Cash Deposit into Bank (Contra)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Payment Method</label>
                  <select
                    value={formPayment}
                    onChange={(e) => setFormPayment(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold"
                  >
                    <option value="CASH">CASH</option>
                    <option value="IDBI">GPAY- IDBI</option>
                    <option value="SBI">GPAY- SBI</option>
                    <option value="BANK TRANSFER">Bank Transfer</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Amount (₹)</label>
                  <input
                    type="number"
                    step="any"
                    required
                    placeholder="0.00"
                    value={formAmount}
                    onChange={(e) => setFormAmount(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-black text-slate-900"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Description / Party Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. NEXZON, BUS PARCEL, TEA EXPENSES..."
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Drawer Balance Note (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. O-47092 or C-1272"
                  value={formNote}
                  onChange={(e) => setFormNote(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-700"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => { setShowNewModal(false); setEditingEntry(null); }}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all"
                >
                  {editingEntry ? 'Save Changes' : 'Record Transaction'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingEntry && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-xl border border-slate-200">
            <h4 className="font-bold text-slate-900 text-base mb-2">Delete Day Book Entry?</h4>
            <p className="text-xs text-slate-500 mb-4 leading-relaxed">
              Are you sure you want to remove entry <span className="font-bold text-slate-800">#{deletingEntry.id}</span> ({deletingEntry.description} - {formatCurrency(deletingEntry.cashCredit + deletingEntry.cashDebit + deletingEntry.bankCredit + deletingEntry.bankDebit)})?
            </p>
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setDeletingEntry(null)}
                className="px-3.5 py-1.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-xs"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Delete Confirmation Modal */}
      {showBulkDeleteConfirm && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mb-4">
              <Trash2 className="w-6 h-6" />
            </div>
            <h4 className="font-bold text-slate-900 text-base mb-2">
              Bulk Delete {selectedEntryIds.size} Day Book Transaction{selectedEntryIds.size > 1 ? 's' : ''}?
            </h4>
            <p className="text-xs text-slate-500 mb-6 leading-relaxed">
              Are you sure you want to permanently delete <strong className="text-slate-800">{selectedEntryIds.size}</strong> selected Day Book transaction(s)?
              Any corresponding payments and vouchers in Payment & Receipt will also be automatically synchronized and removed. This action cannot be undone.
            </p>
            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setShowBulkDeleteConfirm(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmBulkDelete}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 active:bg-rose-800 shadow-sm transition-colors cursor-pointer"
              >
                Yes, Delete {selectedEntryIds.size} Entries
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reset Confirmation Modal */}
      {showResetConfirm && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-xl border border-slate-200">
            <h4 className="font-bold text-slate-900 text-base mb-2">Reset Day Book Ledger?</h4>
            <p className="text-xs text-slate-500 mb-4 leading-relaxed">
              This will restore the authoritative Day Book entries associated with Purchases, Fixed Assets, and Expenses (clearing unassociated demo entries).
            </p>
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setShowResetConfirm(false)}
                className="px-3.5 py-1.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmReset}
                className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs"
              >
                Confirm Reset
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Wipe Non-Register Demo Entries Modal */}
      {showWipeNonRegisterConfirm && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200">
            <div className="flex items-center gap-3 text-rose-600 mb-3">
              <div className="w-10 h-10 rounded-xl bg-rose-100 flex items-center justify-center flex-shrink-0">
                <Trash2 className="w-5 h-5 text-rose-600" />
              </div>
              <div>
                <h4 className="font-bold text-slate-900 text-base">Wipe Demo Entries from Day Book?</h4>
                <p className="text-xs text-rose-600 font-semibold">Clean unassociated demo records</p>
              </div>
            </div>
            <div className="text-xs text-slate-600 mb-4 leading-relaxed space-y-2">
              <p>
                This will permanently remove all unassociated demo entries (demo sales orders, private finance, contra cash deposits, intercash transfers, and security deposits) from your Day Book.
              </p>
              <div className="bg-slate-50 border border-slate-200 p-3 rounded-xl">
                <span className="font-bold text-slate-800 block mb-1">Retained Registers:</span>
                <ul className="list-disc pl-4 space-y-1 text-slate-700">
                  <li><strong className="text-emerald-700">Purchase Register</strong> (Bills & Vendor Payments)</li>
                  <li><strong className="text-blue-700">Fixed Asset Register</strong> (Capital Goods & Asset Invoices)</li>
                  <li><strong className="text-amber-700">Expense Register</strong> (Operational Vouchers & Disbursements)</li>
                </ul>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setShowWipeNonRegisterConfirm(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmWipeNonRegister}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all"
              >
                Confirm & Wipe Demo Entries
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
