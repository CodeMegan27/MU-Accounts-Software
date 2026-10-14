import React, { useState, useMemo } from 'react';
import { useData } from '../../context/DataContext';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { Receipt, Plus, Search, Trash2, Edit2, RotateCcw, ChevronLeft, ChevronRight, CheckCircle2 } from 'lucide-react';

export default function ExpensesList({ onOpenCreateExpense, onEditExpense, onRequestDelete }) {
  const { expenses, branches, departments, expenseCategories, syncExpensesFromDaybook } = useData();
  const { isAdmin } = useAuth();
  const { showToast } = useToast();
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [branchFilter, setBranchFilter] = useState('all');
  const [deptFilter, setDeptFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [isSyncing, setIsSyncing] = useState(false);

  const handleSyncDaybook = async () => {
    setIsSyncing(true);
    try {
      const count = await syncExpensesFromDaybook();
      showToast(`Successfully synced ${count} expenses from Day Book register`, 'success');
    } catch (e) {
      showToast('Error syncing expenses from Day Book', 'error');
    } finally {
      setIsSyncing(false);
    }
  };

  const allBranches = useMemo(() => {
    const set = new Set([...(branches || [])]);
    expenses.forEach(e => { if (e.branch) set.add(e.branch); });
    return Array.from(set);
  }, [branches, expenses]);

  const allDepts = useMemo(() => {
    const set = new Set([...(departments || [])]);
    expenses.forEach(e => { if (e.department) set.add(e.department); });
    return Array.from(set);
  }, [departments, expenses]);

  const allCategories = useMemo(() => {
    const set = new Set([...(expenseCategories || [])]);
    expenses.forEach(e => { if (e.category) set.add(e.category); });
    return Array.from(set);
  }, [expenseCategories, expenses]);

  const filtered = useMemo(() => {
    return expenses.filter(e => {
      const q = search.toLowerCase();
      const matchesSearch = !search ||
        (e.voucherNo && e.voucherNo.toLowerCase().includes(q)) ||
        (e.payee && e.payee.toLowerCase().includes(q)) ||
        (e.description && e.description.toLowerCase().includes(q)) ||
        (e.category && e.category.toLowerCase().includes(q));

      const matchesCategory = !categoryFilter || e.category === categoryFilter;
      const matchesBranch = branchFilter === 'all' || (e.branch || 'KLK') === branchFilter;
      const matchesDept = deptFilter === 'all' || (e.department || 'GENERAL ADMIN') === deptFilter;

      return matchesSearch && matchesCategory && matchesBranch && matchesDept;
    });
  }, [expenses, search, categoryFilter, branchFilter, deptFilter]);

  const totalExpense = useMemo(() => {
    return filtered.reduce((acc, curr) => acc + (parseFloat(curr.amount) || 0), 0);
  }, [filtered]);

  const totalPages = Math.ceil(filtered.length / pageSize) || 1;
  const paginatedExpenses = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, currentPage, pageSize]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">Expense Register</h2>
          <p className="text-xs text-slate-500 mt-0.5">Enterprise Operational & Administrative Overhead Journal</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleSyncDaybook}
            disabled={isSyncing}
            className="flex items-center gap-1.5 px-3.5 py-2.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl text-xs font-bold transition-all border border-blue-200 shadow-xs"
            title="Sync all categorized operational expenses from Day Book register"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'Syncing...' : 'Sync Day Book Expenses'}</span>
          </button>
          <button
            onClick={onOpenCreateExpense}
            className="flex items-center gap-2 px-4 py-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-semibold transition-all shadow-md hover:shadow-lg"
          >
            <Plus className="w-4 h-4" /> Record Expense
          </button>
        </div>
      </div>

      {/* Summary Strip */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
        <div>
          <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Total Indirect Expenses</p>
          <p className="text-xl font-bold text-red-600 mt-0.5">{formatCurrency(totalExpense)}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400 font-medium">{filtered.length} of {expenses.length} expenses logged</span>
        </div>
      </div>

      {/* Filter toolbar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by payee, voucher, description..."
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </div>

        <select
          value={branchFilter}
          onChange={(e) => setBranchFilter(e.target.value)}
          className="w-full sm:w-36 py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs bg-white focus:outline-none focus:ring-1 focus:ring-brand-500 font-semibold text-slate-800"
        >
          <option value="all">🏢 All Branches</option>
          {allBranches.map(b => (
            <option key={b} value={b}>{b}</option>
          ))}
        </select>

        <select
          value={deptFilter}
          onChange={(e) => setDeptFilter(e.target.value)}
          className="w-full sm:w-44 py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs bg-white focus:outline-none focus:ring-1 focus:ring-brand-500 font-semibold text-slate-800"
        >
          <option value="all">📂 All Depts</option>
          {allDepts.map(d => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>

        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="w-full sm:w-44 py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs bg-white focus:outline-none focus:ring-1 focus:ring-brand-500 font-semibold text-slate-800"
        >
          <option value="">All Categories</option>
          {allCategories.map(c => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse whitespace-nowrap">
            <thead>
              <tr className="bg-slate-50 text-slate-500 border-b border-slate-200 text-xs uppercase font-semibold tracking-wider">
                <th className="px-5 py-3.5">Date & Voucher</th>
                <th className="px-5 py-3.5">Branch & Dept</th>
                <th className="px-5 py-3.5">Payee / Category</th>
                <th className="px-5 py-3.5">Payment Method</th>
                <th className="px-5 py-3.5">Description</th>
                <th className="px-5 py-3.5 text-right">Amount (₹)</th>
                <th className="px-5 py-3.5 text-center w-20">Actions</th>
              </tr>
            </thead>
            <tbody className="text-sm divide-y divide-slate-100 text-slate-700">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan="7" className="text-center py-12 text-slate-400">
                    <Receipt className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                    <p className="text-base font-semibold text-slate-700">No expenses recorded</p>
                  </td>
                </tr>
              ) : (
                paginatedExpenses.map(exp => {
                  const method = exp.paymentMethod || 'CASH';
                  const isCash = method.toUpperCase().includes('CASH');
                  return (
                    <tr key={exp.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-5 py-3.5">
                        <div className="font-mono text-xs font-semibold text-slate-800">{formatDate(exp.date)}</div>
                        <div className="font-mono text-[10px] text-slate-400">{exp.voucherNo || '-'}</div>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={`px-2 py-0.5 text-[10px] font-bold rounded-md ${
                            (exp.branch || 'KLK') === 'RMD' ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'
                          }`}>
                            {exp.branch || 'KLK'}
                          </span>
                          <span className="text-[10px] font-semibold text-slate-500">
                            {exp.department || 'GENERAL ADMIN'}
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="font-bold text-xs text-slate-900">{exp.payee || exp.category}</div>
                        <span className="inline-block mt-0.5 px-2 py-0.2 bg-slate-100 text-slate-600 text-[10px] font-semibold rounded">
                          {exp.category || 'General'}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold ${
                          isCash ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                        }`}>
                          <span>{isCash ? '💵' : '🏦'}</span>
                          <span>{method}</span>
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-slate-600 text-xs max-w-xs truncate" title={exp.description}>
                        {exp.description || '-'}
                      </td>
                      <td className="px-5 py-3.5 text-right font-mono font-bold text-red-600">
                        {formatCurrency(exp.amount)}
                      </td>
                      <td className="px-5 py-3.5 text-center">
                        {isAdmin && (
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => onEditExpense(exp)}
                              className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                              title="Edit Expense"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => onRequestDelete('expenses', exp.id, exp.description || exp.category)}
                              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="Delete Expense"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        {filtered.length > pageSize && (
          <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            <span className="text-slate-500 font-medium">
              Showing <strong className="text-slate-800 font-bold">{(currentPage - 1) * pageSize + 1}</strong> to <strong className="text-slate-800 font-bold">{Math.min(currentPage * pageSize, filtered.length)}</strong> of <strong className="text-slate-800 font-bold">{filtered.length}</strong> expenses
            </span>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="px-3 py-1 font-mono font-bold text-slate-700 bg-white border border-slate-200 rounded-lg">
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
