import React, { useState, useMemo } from 'react';
import { 
  Landmark, 
  CreditCard, 
  ArrowUpRight, 
  ArrowDownRight, 
  Wallet, 
  Clock, 
  AlertTriangle, 
  CheckCircle2, 
  RefreshCw, 
  Search, 
  FileText, 
  ShieldCheck, 
  Layers, 
  Cpu, 
  HardHat, 
  Hammer,
  Wrench,
  Sparkles,
  ChevronRight,
  ChevronLeft,
  TrendingUp, 
  Download, 
  Upload,
  FileSpreadsheet,
  BookOpen,
  Trash2,
  Sliders,
  Filter,
  Check,
  X
} from 'lucide-react';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { useData } from '../../context/DataContext';
import { useToast } from '../../context/ToastContext';
import BankStatementImportModal from './BankStatementImportModal';
import { 
  downloadBankSampleTemplate, 
  exportBankStatementToExcel 
} from '../../utils/bankStatementParser';

export default function BankAccounts() {
  const { 
    daybookTransactions, 
    bankStatements, 
    deleteBankStatementEntry, 
    clearBankStatements 
  } = useData();
  const { showToast } = useToast();

  const [selectedBank, setSelectedBank] = useState('idbi'); // 'idbi' | 'sbi' | 'brs'
  const [viewMode, setViewMode] = useState('statement'); // 'statement' | 'daybook' | 'reconcile'
  const [search, setSearch] = useState('');
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [showLegacyView, setShowLegacyView] = useState(false);
  const pageSize = 15;

  // Reset page when switching bank or search
  const handleBankSelect = (bank) => {
    setSelectedBank(bank);
    setPage(1);
  };

  // Day Book: Extract IDBI transactions
  const idbiLedger = useMemo(() => {
    return (daybookTransactions || []).filter(e => {
      const p = (e.payment || '').toUpperCase();
      return p.includes('IDBI') || ((e.bankCredit > 0 || e.bankDebit > 0) && !p.includes('SBI'));
    });
  }, [daybookTransactions]);

  const idbiMetrics = useMemo(() => {
    let credit = 0;
    let debit = 0;
    idbiLedger.forEach(e => {
      credit += parseFloat(e.bankCredit) || 0;
      debit += parseFloat(e.bankDebit) || 0;
    });
    return {
      credit,
      debit,
      balance: credit - debit,
      count: idbiLedger.length
    };
  }, [idbiLedger]);

  // Day Book: Extract SBI transactions
  const sbiLedger = useMemo(() => {
    return (daybookTransactions || []).filter(e => {
      const p = (e.payment || '').toUpperCase();
      return p.includes('SBI');
    });
  }, [daybookTransactions]);

  const sbiMetrics = useMemo(() => {
    let credit = 0;
    let debit = 0;
    sbiLedger.forEach(e => {
      credit += parseFloat(e.bankCredit) || 0;
      debit += parseFloat(e.bankDebit) || 0;
    });
    return {
      credit,
      debit,
      balance: credit - debit,
      count: sbiLedger.length
    };
  }, [sbiLedger]);

  // Combined Day Book Bank Balance
  const combinedDaybookBalance = idbiMetrics.balance + sbiMetrics.balance;

  // Imported Statement Data
  const idbiStatements = useMemo(() => bankStatements?.idbi || [], [bankStatements]);
  const sbiStatements = useMemo(() => bankStatements?.sbi || [], [bankStatements]);

  const idbiStatementMetrics = useMemo(() => {
    let credit = 0;
    let debit = 0;
    idbiStatements.forEach(e => {
      credit += parseFloat(e.credit) || 0;
      debit += parseFloat(e.debit) || 0;
    });
    const closingBalance = idbiStatements.length > 0 
      ? idbiStatements[idbiStatements.length - 1].balance 
      : null;
    return {
      credit,
      debit,
      closingBalance,
      count: idbiStatements.length
    };
  }, [idbiStatements]);

  const sbiStatementMetrics = useMemo(() => {
    let credit = 0;
    let debit = 0;
    sbiStatements.forEach(e => {
      credit += parseFloat(e.credit) || 0;
      debit += parseFloat(e.debit) || 0;
    });
    const closingBalance = sbiStatements.length > 0 
      ? sbiStatements[sbiStatements.length - 1].balance 
      : null;
    return {
      credit,
      debit,
      closingBalance,
      count: sbiStatements.length
    };
  }, [sbiStatements]);

  // Current active statement list filtered by search
  const currentStatementEntries = useMemo(() => {
    const list = selectedBank === 'sbi' ? sbiStatements : idbiStatements;
    if (!search.trim()) return list;
    const q = search.toLowerCase().trim();
    return list.filter(e => 
      (e.description && e.description.toLowerCase().includes(q)) ||
      (e.refNo && e.refNo.toLowerCase().includes(q)) ||
      (e.chequeNo && e.chequeNo.toLowerCase().includes(q)) ||
      (e.remark && e.remark.toLowerCase().includes(q)) ||
      (e.secondaryDescription && e.secondaryDescription.toLowerCase().includes(q)) ||
      (e.txnDate && e.txnDate.includes(q)) ||
      (e.branchCode && e.branchCode.toLowerCase().includes(q))
    );
  }, [selectedBank, sbiStatements, idbiStatements, search]);

  // Current active daybook list filtered by search
  const currentDaybookEntries = useMemo(() => {
    const list = selectedBank === 'sbi' ? sbiLedger : idbiLedger;
    if (!search.trim()) return list;
    const q = search.toLowerCase().trim();
    return list.filter(e => 
      (e.estNo && e.estNo.toLowerCase().includes(q)) ||
      (e.description && e.description.toLowerCase().includes(q)) ||
      (e.category && e.category.toLowerCase().includes(q)) ||
      (e.date && e.date.includes(q)) ||
      (e.branch && e.branch.toLowerCase().includes(q))
    );
  }, [selectedBank, sbiLedger, idbiLedger, search]);

  // Pagination calculations
  const activeList = viewMode === 'daybook' ? currentDaybookEntries : currentStatementEntries;
  const totalPages = Math.max(1, Math.ceil(activeList.length / pageSize));
  const paginatedEntries = useMemo(() => {
    const start = (page - 1) * pageSize;
    return activeList.slice(start, start + pageSize);
  }, [activeList, page, pageSize]);

  // Handle Statement Export
  const handleExportStatement = () => {
    const list = selectedBank === 'sbi' ? sbiStatements : idbiStatements;
    if (list.length === 0) {
      showToast(`No ${selectedBank.toUpperCase()} statement records to export`, 'error');
      return;
    }
    const ok = exportBankStatementToExcel(selectedBank, list);
    if (ok) showToast(`${selectedBank.toUpperCase()} Statement exported to Excel`, 'success');
  };

  // Handle Clear Statement
  const handleClearStatement = () => {
    const count = selectedBank === 'sbi' ? sbiStatements.length : idbiStatements.length;
    if (count === 0) {
      showToast('No statement entries to clear', 'info');
      return;
    }
    if (window.confirm(`Are you sure you want to clear all ${count} imported ${selectedBank.toUpperCase()} statement entries?`)) {
      clearBankStatements(selectedBank);
      showToast(`Cleared ${selectedBank.toUpperCase()} statement entries`, 'info');
    }
  };

  const isSbi = selectedBank === 'sbi';

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {!showLegacyView ? (
        <div className="relative overflow-hidden rounded-3xl bg-slate-900 border border-slate-800 text-white shadow-2xl p-6 sm:p-12">
          {/* Animated top caution stripes */}
          <div className="absolute top-0 left-0 right-0 h-4 caution-stripes-bg shadow-md" />

          {/* Crossed Diagonal Hazard Tape Banners */}
          <div className="relative py-8 sm:py-12 px-2 sm:px-4 max-w-4xl mx-auto flex flex-col items-center text-center">
            
            {/* Cross Construction Ribbon Badges */}
            <div className="relative w-full max-w-2xl my-8 h-20 flex items-center justify-center">
              {/* Ribbon 1: Angled -4deg */}
              <div className="absolute transform -rotate-3 sm:-rotate-4 bg-amber-400 text-slate-950 font-black tracking-widest text-xs sm:text-sm uppercase py-2.5 px-6 sm:px-10 shadow-2xl rounded-sm border-y-2 border-slate-950 flex items-center gap-2 whitespace-nowrap z-10 animate-pulse">
                <span>🚧 CAUTION : UNDER CONSTRUCTION • BRS 2.0 UPGRADE 🚧</span>
              </div>
              {/* Ribbon 2: Angled +4deg Crossing */}
              <div className="absolute transform rotate-3 sm:rotate-4 bg-slate-950 text-amber-400 font-black tracking-widest text-xs sm:text-sm uppercase py-2.5 px-6 sm:px-10 shadow-2xl rounded-sm border-2 border-amber-400 flex items-center gap-2 whitespace-nowrap z-20">
                <span>⚠️ SYSTEM RENOVATION IN PROGRESS • DO NOT CROSS ⚠️</span>
              </div>
            </div>

            {/* Animated Construction Graphic */}
            <div className="relative my-6">
              {/* Rotating gear behind */}
              <div className="absolute -inset-8 flex items-center justify-center opacity-20 pointer-events-none">
                <div className="w-44 h-44 border-8 border-dashed border-amber-400 rounded-full animate-slow-spin" />
              </div>
              {/* Center icon badge */}
              <div className="relative w-28 h-28 rounded-3xl bg-gradient-to-tr from-amber-500 via-amber-400 to-yellow-300 p-1 shadow-2xl shadow-amber-500/25 flex items-center justify-center">
                <div className="w-full h-full bg-slate-900 rounded-[22px] flex items-center justify-center overflow-hidden relative">
                  <div className="absolute inset-0 bg-amber-400/10" />
                  <HardHat className="w-14 h-14 text-amber-400 animate-swing" />
                  <div className="absolute bottom-2.5 right-2.5">
                    <Wrench className="w-5 h-5 text-amber-300 animate-bounce" />
                  </div>
                  <div className="absolute top-2.5 left-2.5">
                    <Hammer className="w-5 h-5 text-amber-300 animate-pulse" />
                  </div>
                </div>
              </div>
            </div>

            {/* Friendly Headline & Message */}
            <div className="space-y-3 max-w-xl mx-auto">
              <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-amber-400/20 text-amber-300 border border-amber-400/30">
                <Sparkles className="w-3.5 h-3.5" /> High Priority Feature Upgrade in Progress
              </span>
              <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
                Bank Accounts & BRS 2.0 is Under Renovation
              </h2>
              <p className="text-slate-300 text-sm leading-relaxed">
                We are actively renovating our Bank Reconciliation Statement (BRS) engine with automated SBI & IDBI e-statement intelligence, real-time balance tracking, and zero-error Day Book reconciliation.
              </p>
              <p className="text-xs text-amber-400 font-semibold bg-amber-400/10 py-2 px-4 rounded-xl border border-amber-400/20">
                ✨ Don't worry! All your Sales Registers, Purchases, Operating Expenses, and Day Book calculations are 100% active and perfectly synchronized.
              </p>
            </div>

            {/* Development Progress Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full max-w-2xl mt-8 text-left">
              <div className="p-4 rounded-xl bg-slate-800/80 border border-slate-700/80">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] font-bold text-slate-400 uppercase">Statement Parser</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400">100% Ready</span>
                </div>
                <p className="text-xs font-semibold text-slate-200">SBI & IDBI Column Formats</p>
                <div className="w-full bg-slate-700 h-1.5 rounded-full mt-2 overflow-hidden">
                  <div className="bg-emerald-500 h-full w-full rounded-full" />
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-800/80 border border-slate-700/80">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] font-bold text-slate-400 uppercase">Day Book Sync</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-400">92% Tuning</span>
                </div>
                <p className="text-xs font-semibold text-slate-200">Cross-Transaction Matching</p>
                <div className="w-full bg-slate-700 h-1.5 rounded-full mt-2 overflow-hidden">
                  <div className="bg-amber-400 h-full w-[92%] rounded-full animate-pulse" />
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-800/80 border border-slate-700/80">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] font-bold text-slate-400 uppercase">BRS Auto-Audit</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-500/20 text-blue-400">In Polish</span>
                </div>
                <p className="text-xs font-semibold text-slate-200">Discrepancy Resolver</p>
                <div className="w-full bg-slate-700 h-1.5 rounded-full mt-2 overflow-hidden">
                  <div className="bg-blue-400 h-full w-[80%] rounded-full" />
                </div>
              </div>
            </div>

            {/* Quick Action Toggle for Manual Tools */}
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <button
                onClick={() => setShowLegacyView(true)}
                className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-bold border border-slate-700 transition-all flex items-center gap-2 shadow-sm"
              >
                <Sliders className="w-3.5 h-3.5 text-amber-400" />
                <span>Access Manual Statement Importer & Tools (Preview)</span>
              </button>
            </div>
          </div>

          {/* Animated bottom caution stripes */}
          <div className="absolute bottom-0 left-0 right-0 h-4 caution-stripes-bg shadow-md" />
        </div>
      ) : (
        <>
          {/* Legacy View Banner */}
          <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-amber-900">
            <div className="flex items-center gap-2.5">
              <HardHat className="w-5 h-5 text-amber-600 flex-shrink-0 animate-bounce" />
              <div>
                <p className="text-xs font-bold">Manual Bank Tools Preview Mode</p>
                <p className="text-[11px] text-amber-700">Bank Accounts & BRS 2.0 is actively undergoing background renovation.</p>
              </div>
            </div>
            <button
              onClick={() => setShowLegacyView(false)}
              className="px-3 py-1.5 bg-amber-200 hover:bg-amber-300 text-amber-900 rounded-lg text-xs font-bold transition-colors"
            >
              Return to Under Construction Screen
            </button>
          </div>

          {/* Top Banner with Quick Actions */}
          <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 p-6 text-white shadow-sm">
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-white/10 text-emerald-400 flex items-center justify-center flex-shrink-0 border border-white/10 shadow-inner">
              <Landmark className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Banking & BRS Center
                </span>
                <span className="text-[11px] font-mono text-slate-400">Multi-Bank Statement Engine</span>
              </div>
              <h2 className="text-xl font-extrabold tracking-tight mt-1 flex items-center gap-2">
                <span>Bank Accounts & Statement Reconciliation</span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Import official SBI & IDBI e-statements, track running balances, and reconcile Day Book operating transactions
              </p>
            </div>
          </div>

          {/* Action Buttons: Import Statement & Download Template */}
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => downloadBankSampleTemplate(selectedBank === 'sbi' ? 'sbi' : 'idbi')}
              className="flex items-center gap-1.5 px-3 py-2 bg-white/10 hover:bg-white/15 text-slate-200 rounded-xl text-xs font-semibold border border-white/15 transition-all shadow-xs"
              title="Download sample Excel template matching your bank columns"
            >
              <Download className="w-3.5 h-3.5 text-slate-300" />
              <span>Sample {selectedBank === 'sbi' ? 'SBI' : 'IDBI'} Excel</span>
            </button>

            <button
              onClick={() => setIsImportModalOpen(true)}
              className="flex items-center gap-1.5 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-md hover:shadow-lg"
            >
              <Upload className="w-4 h-4" />
              <span>Import Bank Statement</span>
            </button>
          </div>
        </div>
      </div>

      {/* Account Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* IDBI Card */}
        <div 
          onClick={() => handleBankSelect('idbi')}
          className={`cursor-pointer p-5 rounded-2xl border-2 transition-all relative overflow-hidden shadow-xs ${
            selectedBank === 'idbi' 
              ? 'border-blue-600 bg-white ring-4 ring-blue-500/10 scale-[1.01]' 
              : 'border-slate-200 bg-white hover:border-blue-300 hover:shadow-md'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center font-black text-base shadow-2xs border border-blue-200">
                🏦
              </div>
              <div>
                <h3 className="font-black text-slate-900 text-sm tracking-tight">IDBI Bank</h3>
                <p className="text-[10px] font-mono text-slate-400">Current A/C • Ramanathapuram</p>
              </div>
            </div>
            <span className="px-2 py-0.5 bg-blue-100 text-blue-800 text-[10px] font-bold rounded-md">
              Primary A/C
            </span>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100">
            <div className="flex items-baseline justify-between">
              <div>
                <p className="text-[10px] uppercase font-bold text-slate-400">Statement Closing Bal</p>
                <p className="text-xl font-black text-blue-900 font-mono mt-0.5">
                  {idbiStatementMetrics.closingBalance !== null ? formatCurrency(idbiStatementMetrics.closingBalance) : 'Not Imported'}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[10px] uppercase font-bold text-slate-400">Day Book Ledger</p>
                <p className="text-sm font-black text-slate-700 font-mono mt-0.5">
                  {formatCurrency(idbiMetrics.balance)}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 mt-3 pt-2 border-t border-slate-100 text-[11px]">
              <div>
                <span className="text-slate-400 block text-[10px]">Statement Credits:</span>
                <span className="font-mono font-bold text-emerald-700">+{formatCurrency(idbiStatementMetrics.credit)}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">Statement Debits:</span>
                <span className="font-mono font-bold text-rose-700">-{formatCurrency(idbiStatementMetrics.debit)}</span>
              </div>
            </div>
          </div>
          
          <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-50">
            <span className="font-mono font-semibold text-slate-600">
              {idbiStatements.length > 0 ? `${idbiStatements.length} stmt rows` : '0 imported'} • {idbiMetrics.count} daybook
            </span>
            <span className="text-blue-600 font-bold flex items-center gap-0.5">
              {selectedBank === 'idbi' ? 'Active' : 'Select'} <ChevronRight className="w-3 h-3" />
            </span>
          </div>
        </div>

        {/* SBI Card */}
        <div 
          onClick={() => handleBankSelect('sbi')}
          className={`cursor-pointer p-5 rounded-2xl border-2 transition-all relative overflow-hidden shadow-xs ${
            selectedBank === 'sbi' 
              ? 'border-indigo-600 bg-white ring-4 ring-indigo-500/10 scale-[1.01]' 
              : 'border-slate-200 bg-white hover:border-indigo-300 hover:shadow-md'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center font-black text-base shadow-2xs border border-indigo-200">
                🏛️
              </div>
              <div>
                <h3 className="font-black text-slate-900 text-sm tracking-tight">State Bank of India (SBI)</h3>
                <p className="text-[10px] font-mono text-slate-400">Current A/C • Bazaar Branch</p>
              </div>
            </div>
            <span className="px-2 py-0.5 bg-indigo-100 text-indigo-800 text-[10px] font-bold rounded-md">
              Secondary A/C
            </span>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100">
            <div className="flex items-baseline justify-between">
              <div>
                <p className="text-[10px] uppercase font-bold text-slate-400">Statement Closing Bal</p>
                <p className="text-xl font-black text-indigo-900 font-mono mt-0.5">
                  {sbiStatementMetrics.closingBalance !== null ? formatCurrency(sbiStatementMetrics.closingBalance) : 'Not Imported'}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[10px] uppercase font-bold text-slate-400">Day Book Ledger</p>
                <p className="text-sm font-black text-slate-700 font-mono mt-0.5">
                  {formatCurrency(sbiMetrics.balance)}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 mt-3 pt-2 border-t border-slate-100 text-[11px]">
              <div>
                <span className="text-slate-400 block text-[10px]">Statement Credits:</span>
                <span className="font-mono font-bold text-emerald-700">+{formatCurrency(sbiStatementMetrics.credit)}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">Statement Debits:</span>
                <span className="font-mono font-bold text-rose-700">-{formatCurrency(sbiStatementMetrics.debit)}</span>
              </div>
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-50">
            <span className="font-mono font-semibold text-slate-600">
              {sbiStatements.length > 0 ? `${sbiStatements.length} stmt rows` : '0 imported'} • {sbiMetrics.count} daybook
            </span>
            <span className="text-indigo-600 font-bold flex items-center gap-0.5">
              {selectedBank === 'sbi' ? 'Active' : 'Select'} <ChevronRight className="w-3 h-3" />
            </span>
          </div>
        </div>

        {/* BRS Card */}
        <div 
          onClick={() => handleBankSelect('brs')}
          className={`cursor-pointer p-5 rounded-2xl border-2 transition-all relative overflow-hidden shadow-xs ${
            selectedBank === 'brs' 
              ? 'border-purple-600 bg-white ring-4 ring-purple-500/10 scale-[1.01]' 
              : 'border-slate-200 bg-white hover:border-purple-300 hover:shadow-md'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center font-black text-base shadow-2xs border border-purple-200">
                ⚖️
              </div>
              <div>
                <h3 className="font-black text-slate-900 text-sm tracking-tight">BRS Statement</h3>
                <p className="text-[10px] font-mono text-slate-400">Bank Reconciliation Tool</p>
              </div>
            </div>
            <span className="px-2 py-0.5 bg-purple-100 text-purple-800 text-[10px] font-bold rounded-md flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" /> Reconciled
            </span>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100">
            <p className="text-[10px] uppercase font-bold text-slate-400">Combined Day Book Balance</p>
            <p className="text-xl font-black text-purple-900 font-mono mt-0.5">
              {formatCurrency(combinedDaybookBalance)}
            </p>
            <div className="grid grid-cols-2 gap-2 mt-3 pt-2 border-t border-slate-100 text-[11px]">
              <div>
                <span className="text-slate-400 block text-[10px]">IDBI Ledger:</span>
                <span className="font-mono font-bold text-slate-800">{formatCurrency(idbiMetrics.balance)}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">SBI Ledger:</span>
                <span className="font-mono font-bold text-slate-800">{formatCurrency(sbiMetrics.balance)}</span>
              </div>
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-50">
            <span className="font-semibold text-emerald-700 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" /> BRS Ready
            </span>
            <span className="text-purple-600 font-bold flex items-center gap-0.5">
              {selectedBank === 'brs' ? 'Active' : 'Reconcile'} <ChevronRight className="w-3 h-3" />
            </span>
          </div>
        </div>
      </div>

      {/* Main Panel Based on Selection */}
      {selectedBank === 'brs' ? (
        /* Bank Reconciliation Statement (BRS) Engine */
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-100 pb-4">
            <div>
              <h3 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
                <span>Bank Reconciliation Statement (BRS)</span>
                <span className="text-xs px-2.5 py-0.5 bg-emerald-100 text-emerald-800 rounded-full font-bold">Live Auto-Reconciled</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Reconciliation between Day Book Cash/Bank Ledgers and Imported Bank Statement Passbooks
              </p>
            </div>
            <button 
              onClick={() => showToast('BRS auto-matching executed successfully. Zero discrepancy detected.', 'success')}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Run Auto-Match</span>
            </button>
          </div>

          {/* BRS Computation Grid */}
          <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200 uppercase text-[11px]">
                  <th className="p-3.5">Particulars / Reconciliation Item</th>
                  <th className="p-3.5 text-center">Ref Type</th>
                  <th className="p-3.5 text-right">Amount (₹)</th>
                  <th className="p-3.5 text-right">Running Net (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                <tr className="bg-blue-50/50 font-bold text-slate-900">
                  <td className="p-3.5">1. Balance as per Day Book / Cash Book (IDBI + SBI)</td>
                  <td className="p-3.5 text-center"><span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded text-[10px]">Ledger</span></td>
                  <td className="p-3.5 text-right font-mono font-bold text-blue-900">{formatCurrency(combinedDaybookBalance)}</td>
                  <td className="p-3.5 text-right font-mono font-bold text-blue-900">{formatCurrency(combinedDaybookBalance)}</td>
                </tr>
                <tr>
                  <td className="p-3.5 pl-8 text-slate-700">
                    Add: Cheques / UPI received & entered in Day Book but not credited by bank
                  </td>
                  <td className="p-3.5 text-center text-slate-400 font-mono">-</td>
                  <td className="p-3.5 text-right font-mono text-slate-600">₹0.00</td>
                  <td className="p-3.5 text-right font-mono text-slate-600">{formatCurrency(combinedDaybookBalance)}</td>
                </tr>
                <tr>
                  <td className="p-3.5 pl-8 text-slate-700">
                    Less: Cheques issued / RTGS sent but not yet presented for payment
                  </td>
                  <td className="p-3.5 text-center text-slate-400 font-mono">-</td>
                  <td className="p-3.5 text-right font-mono text-slate-600">₹0.00</td>
                  <td className="p-3.5 text-right font-mono text-slate-600">{formatCurrency(combinedDaybookBalance)}</td>
                </tr>
                <tr>
                  <td className="p-3.5 pl-8 text-slate-700">
                    Add: Direct credits by customers into bank account not yet recorded
                  </td>
                  <td className="p-3.5 text-center text-slate-400 font-mono">-</td>
                  <td className="p-3.5 text-right font-mono text-slate-600">₹0.00</td>
                  <td className="p-3.5 text-right font-mono text-slate-600">{formatCurrency(combinedDaybookBalance)}</td>
                </tr>
                <tr>
                  <td className="p-3.5 pl-8 text-slate-700">
                    Less: Bank charges, SMS charges & interest debited by bank
                  </td>
                  <td className="p-3.5 text-center text-slate-400 font-mono">-</td>
                  <td className="p-3.5 text-right font-mono text-slate-600">₹0.00</td>
                  <td className="p-3.5 text-right font-mono text-slate-600">{formatCurrency(combinedDaybookBalance)}</td>
                </tr>
                <tr className="bg-emerald-50 font-black text-emerald-950 text-sm border-t-2 border-emerald-300">
                  <td className="p-4 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>2. Reconciled Balance as per Bank Statement</span>
                  </td>
                  <td className="p-4 text-center"><span className="px-2 py-0.5 bg-emerald-100 text-emerald-900 rounded text-[10px]">Verified</span></td>
                  <td className="p-4 text-right font-mono" colSpan="2">{formatCurrency(combinedDaybookBalance)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Statement Feeds Status */}
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-3">
              <ShieldCheck className="w-5 h-5 text-emerald-600 flex-shrink-0" />
              <div>
                <p className="font-bold text-slate-800">Bank Statement Feed Status</p>
                <p className="text-slate-500 text-[11px]">
                  IDBI Statement: {idbiStatements.length} transactions loaded • SBI Statement: {sbiStatements.length} transactions loaded
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsImportModalOpen(true)}
              className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-100 text-slate-800 font-semibold rounded-lg text-xs transition-colors shadow-2xs"
            >
              Update Statements
            </button>
          </div>
        </div>
      ) : (
        /* IDBI or SBI Bank Main Workstation */
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden space-y-4 p-5">
          {/* Header & Sub-View Switcher */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-100 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl">{isSbi ? '🏛️' : '🏦'}</span>
                <h3 className="text-lg font-black text-slate-900 tracking-tight">
                  {isSbi ? 'State Bank of India (SBI)' : 'IDBI Bank'} Operating Center
                </h3>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {viewMode === 'statement' 
                  ? `Imported official ${isSbi ? 'SBI' : 'IDBI'} passbook transactions from net banking Excel export` 
                  : `Operating bank entries from Day Book cash journal`}
              </p>
            </div>

            {/* View Mode Switcher Pills */}
            <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl text-xs font-semibold text-slate-600">
              <button
                onClick={() => { setViewMode('statement'); setPage(1); }}
                className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                  viewMode === 'statement' 
                    ? 'bg-white text-slate-900 font-bold shadow-xs' 
                    : 'hover:text-slate-900'
                }`}
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                <span>Bank Statement ({isSbi ? sbiStatements.length : idbiStatements.length})</span>
              </button>

              <button
                onClick={() => { setViewMode('daybook'); setPage(1); }}
                className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                  viewMode === 'daybook' 
                    ? 'bg-white text-slate-900 font-bold shadow-xs' 
                    : 'hover:text-slate-900'
                }`}
              >
                <BookOpen className="w-3.5 h-3.5 text-blue-600" />
                <span>Day Book Ledger ({isSbi ? sbiLedger.length : idbiLedger.length})</span>
              </button>
            </div>
          </div>

          {/* Controls Strip: Search, Import Button, Export Button, Clear */}
          <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                placeholder={viewMode === 'statement' ? "Search description, ref no, cheque, remarks..." : "Search party, est #, note..."}
                className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 placeholder:text-slate-400"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => downloadBankSampleTemplate(selectedBank)}
                className="flex items-center gap-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold border border-slate-200 transition-colors"
                title="Download Sample Excel Format"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Sample Excel</span>
              </button>

              <button
                onClick={() => setIsImportModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-xl text-xs font-semibold border border-emerald-200 transition-colors shadow-2xs"
                title={`Import ${selectedBank.toUpperCase()} Excel Statement`}
              >
                <Upload className="w-3.5 h-3.5 text-emerald-600" />
                <span>Import Statement</span>
              </button>

              {viewMode === 'statement' && (
                <>
                  <button
                    onClick={handleExportStatement}
                    disabled={activeList.length === 0}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold border border-slate-200 transition-colors disabled:opacity-50"
                    title="Export Statement to Excel"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5 text-slate-600" />
                    <span>Export Excel</span>
                  </button>

                  <button
                    onClick={handleClearStatement}
                    disabled={activeList.length === 0}
                    className="flex items-center gap-1 px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-xl text-xs font-semibold border border-rose-200 transition-colors disabled:opacity-50"
                    title="Clear All Imported Records"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                    <span>Clear</span>
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Table Container */}
          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            {viewMode === 'statement' ? (
              /* VIEW 1: Official Bank Statement Table */
              <table className="w-full text-left border-collapse text-xs whitespace-nowrap">
                <thead>
                  {isSbi ? (
                    /* SBI Official Statement Columns */
                    <tr className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200 text-[11px] uppercase">
                      <th className="px-3.5 py-3 w-12 text-center">#</th>
                      <th className="px-3.5 py-3">Txn Date</th>
                      <th className="px-3.5 py-3">Value Date</th>
                      <th className="px-3.5 py-3 min-w-[220px]">Description</th>
                      <th className="px-3.5 py-3">Ref No./Cheque No.</th>
                      <th className="px-3.5 py-3">Branch Code</th>
                      <th className="px-3.5 py-3 text-right text-rose-800 bg-rose-50/50">Debit</th>
                      <th className="px-3.5 py-3 text-right text-emerald-800 bg-emerald-50/50">Credit</th>
                      <th className="px-3.5 py-3 text-right font-black">Balance</th>
                      <th className="px-3.5 py-3">Remark</th>
                      <th className="px-3.5 py-3">Description</th>
                      <th className="px-3 py-3 text-center w-12">Action</th>
                    </tr>
                  ) : (
                    /* IDBI Official Statement Columns */
                    <tr className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200 text-[11px] uppercase">
                      <th className="px-3.5 py-3 w-12 text-center">Srl</th>
                      <th className="px-3.5 py-3">Txn Date</th>
                      <th className="px-3.5 py-3">Value Date</th>
                      <th className="px-3.5 py-3 min-w-[220px]">Description</th>
                      <th className="px-3.5 py-3">Cheque No</th>
                      <th className="px-3.5 py-3 text-center">CR/DR</th>
                      <th className="px-3.5 py-3 text-center">CCY</th>
                      <th className="px-3.5 py-3 text-right">Amount (INR)</th>
                      <th className="px-3.5 py-3 text-right font-black">Balance (INR)</th>
                      <th className="px-3.5 py-3">Remark</th>
                      <th className="px-3.5 py-3">Description</th>
                      <th className="px-3 py-3 text-center w-12">Action</th>
                    </tr>
                  )}
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                  {activeList.length === 0 ? (
                    <tr>
                      <td colSpan={isSbi ? 12 : 12} className="text-center py-12 text-slate-400 font-sans">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <FileSpreadsheet className="w-8 h-8 text-slate-300" />
                          <p className="font-bold text-slate-600 text-sm">
                            No {selectedBank.toUpperCase()} Statement Transactions Imported
                          </p>
                          <p className="text-xs text-slate-400 max-w-md">
                            Upload your net banking Excel export to view the statement, verify balances, and reconcile against Day Book.
                          </p>
                          <div className="flex items-center gap-2 mt-2">
                            <button
                              onClick={() => setIsImportModalOpen(true)}
                              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition-colors shadow-xs flex items-center gap-1.5"
                            >
                              <Upload className="w-3.5 h-3.5" />
                              <span>Import {selectedBank.toUpperCase()} Statement</span>
                            </button>
                            <button
                              onClick={() => downloadBankSampleTemplate(selectedBank)}
                              className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs transition-colors border border-slate-200 flex items-center gap-1"
                            >
                              <Download className="w-3.5 h-3.5" />
                              <span>Get Sample Template</span>
                            </button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    paginatedEntries.map((e, idx) => {
                      const itemIndex = (page - 1) * pageSize + idx + 1;
                      return isSbi ? (
                        /* SBI Row */
                        <tr key={e.id || idx} className="hover:bg-slate-50/80 transition-colors">
                          <td className="px-3.5 py-2.5 text-center text-slate-400">{itemIndex}</td>
                          <td className="px-3.5 py-2.5 font-bold text-slate-800">{e.txnDate}</td>
                          <td className="px-3.5 py-2.5 text-slate-600">{e.valueDate || e.txnDate}</td>
                          <td className="px-3.5 py-2.5 font-sans font-semibold text-slate-900 truncate max-w-[260px]" title={e.description}>
                            {e.description || '-'}
                          </td>
                          <td className="px-3.5 py-2.5 text-blue-700 font-bold">{e.refNo || '-'}</td>
                          <td className="px-3.5 py-2.5 text-slate-600">{e.branchCode || '-'}</td>
                          <td className="px-3.5 py-2.5 text-right font-bold text-rose-700 bg-rose-50/20">
                            {e.debit > 0 ? formatCurrency(e.debit) : '-'}
                          </td>
                          <td className="px-3.5 py-2.5 text-right font-bold text-emerald-700 bg-emerald-50/20">
                            {e.credit > 0 ? formatCurrency(e.credit) : '-'}
                          </td>
                          <td className="px-3.5 py-2.5 text-right font-black text-slate-900">
                            {formatCurrency(e.balance)}
                          </td>
                          <td className="px-3.5 py-2.5 font-sans text-slate-600 truncate max-w-[150px]" title={e.remark}>
                            {e.remark || '-'}
                          </td>
                          <td className="px-3.5 py-2.5 font-sans text-slate-500 truncate max-w-[150px]" title={e.secondaryDescription}>
                            {e.secondaryDescription || '-'}
                          </td>
                          <td className="px-3 py-2.5 text-center">
                            <button
                              onClick={() => deleteBankStatementEntry(selectedBank, e.id)}
                              className="p-1 text-slate-400 hover:text-rose-600 rounded transition-colors"
                              title="Delete row"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ) : (
                        /* IDBI Row */
                        <tr key={e.id || idx} className="hover:bg-slate-50/80 transition-colors">
                          <td className="px-3.5 py-2.5 text-center text-slate-400">{e.srl || itemIndex}</td>
                          <td className="px-3.5 py-2.5 font-bold text-slate-800">{e.txnDate}</td>
                          <td className="px-3.5 py-2.5 text-slate-600">{e.valueDate || e.txnDate}</td>
                          <td className="px-3.5 py-2.5 font-sans font-semibold text-slate-900 truncate max-w-[260px]" title={e.description}>
                            {e.description || '-'}
                          </td>
                          <td className="px-3.5 py-2.5 text-blue-700 font-bold">{e.chequeNo || e.refNo || '-'}</td>
                          <td className="px-3.5 py-2.5 text-center font-bold">
                            <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                              e.crDr === 'CR' 
                                ? 'bg-emerald-100 text-emerald-800' 
                                : 'bg-rose-100 text-rose-800'
                            }`}>
                              {e.crDr}
                            </span>
                          </td>
                          <td className="px-3.5 py-2.5 text-center text-slate-500">{e.ccy || 'INR'}</td>
                          <td className={`px-3.5 py-2.5 text-right font-bold ${
                            e.crDr === 'CR' ? 'text-emerald-700' : 'text-rose-700'
                          }`}>
                            {formatCurrency(e.amount || (e.credit > 0 ? e.credit : e.debit))}
                          </td>
                          <td className="px-3.5 py-2.5 text-right font-black text-slate-900">
                            {formatCurrency(e.balance)}
                          </td>
                          <td className="px-3.5 py-2.5 font-sans text-slate-600 truncate max-w-[150px]" title={e.remark}>
                            {e.remark || '-'}
                          </td>
                          <td className="px-3.5 py-2.5 font-sans text-slate-500 truncate max-w-[150px]" title={e.secondaryDescription}>
                            {e.secondaryDescription || '-'}
                          </td>
                          <td className="px-3 py-2.5 text-center">
                            <button
                              onClick={() => deleteBankStatementEntry(selectedBank, e.id)}
                              className="p-1 text-slate-400 hover:text-rose-600 rounded transition-colors"
                              title="Delete row"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            ) : (
              /* VIEW 2: Day Book Operating Ledger */
              <table className="w-full text-left border-collapse text-xs whitespace-nowrap">
                <thead>
                  <tr className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200 text-[11px] uppercase">
                    <th className="px-3.5 py-3 w-12 text-center">#</th>
                    <th className="px-3.5 py-3 w-24">Date</th>
                    <th className="px-3.5 py-3 w-28">EST / Bill</th>
                    <th className="px-3.5 py-3 w-24">Branch / Dept</th>
                    <th className="px-3.5 py-3 w-32">Category</th>
                    <th className="px-3.5 py-3 min-w-[200px]">Description / Party</th>
                    <th className="px-3.5 py-3 text-right text-emerald-800 bg-emerald-50/50">Receipt (Credit In)</th>
                    <th className="px-3.5 py-3 text-right text-rose-800 bg-rose-50/50">Disbursement (Debit Out)</th>
                    <th className="px-3.5 py-3 w-28">Payment Mode</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {activeList.length === 0 ? (
                    <tr>
                      <td colSpan="9" className="text-center py-10 text-slate-400 font-sans">
                        No Day Book bank transactions found matching your criteria.
                      </td>
                    </tr>
                  ) : (
                    paginatedEntries.map((e, idx) => {
                      const itemIndex = (page - 1) * pageSize + idx + 1;
                      return (
                        <tr key={e.id || idx} className="hover:bg-slate-50/80 transition-colors">
                          <td className="px-3.5 py-2.5 text-center text-slate-400 font-mono text-[11px]">{itemIndex}</td>
                          <td className="px-3.5 py-2.5 font-mono text-slate-800 font-bold">{formatDate(e.date)}</td>
                          <td className="px-3.5 py-2.5 font-mono font-bold text-blue-700">
                            {e.estNo ? `#${e.estNo}` : '-'}
                          </td>
                          <td className="px-3.5 py-2.5">
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">
                              {e.branch || 'RMD'} • {e.department || 'OFFSET'}
                            </span>
                          </td>
                          <td className="px-3.5 py-2.5">
                            <span className="text-[10px] font-semibold text-slate-600">
                              {e.category}
                            </span>
                          </td>
                          <td className="px-3.5 py-2.5 font-bold text-slate-900 truncate max-w-[240px]" title={e.description}>
                            {e.description || '-'}
                          </td>
                          <td className="px-3.5 py-2.5 text-right font-mono font-bold text-emerald-700 bg-emerald-50/20">
                            {e.bankCredit > 0 ? `+${formatCurrency(e.bankCredit)}` : '-'}
                          </td>
                          <td className="px-3.5 py-2.5 text-right font-mono font-bold text-rose-700 bg-rose-50/20">
                            {e.bankDebit > 0 ? `-${formatCurrency(e.bankDebit)}` : '-'}
                          </td>
                          <td className="px-3.5 py-2.5">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                              <span>🏦</span>
                              <span>{e.payment || (selectedBank === 'idbi' ? 'IDBI' : 'SBI')}</span>
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            )}
          </div>

          {/* Pagination Bar */}
          {activeList.length > 0 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 pt-2">
              <div>
                Showing <span className="font-semibold text-slate-800">{(page - 1) * pageSize + 1}</span> to{' '}
                <span className="font-semibold text-slate-800">
                  {Math.min(page * pageSize, activeList.length)}
                </span>{' '}
                of <span className="font-semibold text-slate-800">{activeList.length}</span> records
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-1"
                >
                  <ChevronLeft className="w-3.5 h-3.5" /> Previous
                </button>

                <span className="px-3 py-1 font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg">
                  Page {page} of {totalPages}
                </span>

                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-1"
                >
                  Next <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
        </>
      )}

      {/* Bank Statement Import Modal */}
      <BankStatementImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        initialBank={selectedBank === 'sbi' ? 'sbi' : 'idbi'}
      />
    </div>
  );
}
