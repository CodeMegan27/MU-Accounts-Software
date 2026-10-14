import React, { useState, useMemo } from 'react';
import { 
  Building2, 
  GitBranch, 
  Plus, 
  Edit2, 
  Trash2, 
  Search, 
  FileSpreadsheet, 
  MapPin, 
  Phone, 
  UserCheck, 
  ShieldCheck, 
  CheckCircle2, 
  Layers, 
  TrendingUp, 
  TrendingDown, 
  Wallet, 
  FileText, 
  BarChart3, 
  ChevronRight, 
  X, 
  Building,
  Briefcase,
  ExternalLink,
  SlidersHorizontal,
  Calendar
} from 'lucide-react';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { useData } from '../../context/DataContext';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import * as XLSX from 'xlsx';

export default function BranchDeptMaster({ onNavigateToSales, onNavigateToBills }) {
  const { 
    branches = [], 
    departments = [], 
    branchDetails = {}, 
    departmentDetails = {}, 
    saveBranchMaster, 
    removeBranchMaster, 
    saveDepartmentMaster, 
    removeDepartmentMaster,
    sales = [],
    bills = [],
    expenses = [],
    daybookTransactions = []
  } = useData();

  const { isAdmin, openLoginModal, tierConfig, isDeveloper } = useAuth();
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState('branches'); // 'branches' | 'departments' | 'analytics'
  const [searchQuery, setSearchQuery] = useState('');

  // Modals state
  const [showBranchModal, setShowBranchModal] = useState(false);
  const [editingBranch, setEditingBranch] = useState(null);
  const [branchForm, setBranchForm] = useState({
    code: '',
    name: '',
    address: '',
    phone: '',
    inCharge: '',
    gstin: '',
    status: 'ACTIVE'
  });

  const [showDeptModal, setShowDeptModal] = useState(false);
  const [editingDept, setEditingDept] = useState(null);
  const [deptForm, setDeptForm] = useState({
    code: '',
    name: '',
    inCharge: '',
    description: '',
    status: 'ACTIVE'
  });

  const [deletingTarget, setDeletingTarget] = useState(null); // { type: 'branch'|'dept', code: string }
  const [inspectingBranch, setInspectingBranch] = useState(null);
  const [inspectingDept, setInspectingDept] = useState(null);

  // 1. Calculate Real-Time Branch-Wise Aggregates
  const branchAnalytics = useMemo(() => {
    const map = {};
    branches.forEach(bCode => {
      const code = bCode.toUpperCase();
      map[code] = {
        code,
        salesCount: 0,
        salesAmount: 0,
        salesPaid: 0,
        billsCount: 0,
        billsAmount: 0,
        billsPaid: 0,
        expensesCount: 0,
        expensesAmount: 0,
        cashCredit: 0,
        cashDebit: 0,
        bankCredit: 0,
        bankDebit: 0,
        daybookCount: 0
      };
    });

    // Aggregate Sales
    (sales || []).forEach(s => {
      const b = (s.branch || 'KLK').toUpperCase();
      if (!map[b]) {
        map[b] = { code: b, salesCount: 0, salesAmount: 0, salesPaid: 0, billsCount: 0, billsAmount: 0, billsPaid: 0, expensesCount: 0, expensesAmount: 0, cashCredit: 0, cashDebit: 0, bankCredit: 0, bankDebit: 0, daybookCount: 0 };
      }
      map[b].salesCount += 1;
      map[b].salesAmount += parseFloat(s.finalAmount || s.subtotal || 0);
      map[b].salesPaid += parseFloat(s.paidAmount || 0);
    });

    // Aggregate Bills
    (bills || []).forEach(b => {
      const br = (b.branch || 'KLK').toUpperCase();
      if (!map[br]) {
        map[br] = { code: br, salesCount: 0, salesAmount: 0, salesPaid: 0, billsCount: 0, billsAmount: 0, billsPaid: 0, expensesCount: 0, expensesAmount: 0, cashCredit: 0, cashDebit: 0, bankCredit: 0, bankDebit: 0, daybookCount: 0 };
      }
      map[br].billsCount += 1;
      map[br].billsAmount += parseFloat(b.totalAmount || b.amount || 0);
      map[br].billsPaid += parseFloat(b.paidAmount || 0);
    });

    // Aggregate Expenses
    (expenses || []).forEach(e => {
      const br = (e.branch || 'KLK').toUpperCase();
      if (!map[br]) {
        map[br] = { code: br, salesCount: 0, salesAmount: 0, salesPaid: 0, billsCount: 0, billsAmount: 0, billsPaid: 0, expensesCount: 0, expensesAmount: 0, cashCredit: 0, cashDebit: 0, bankCredit: 0, bankDebit: 0, daybookCount: 0 };
      }
      map[br].expensesCount += 1;
      map[br].expensesAmount += parseFloat(e.amount || 0);
    });

    // Aggregate Day Book
    (daybookTransactions || []).forEach(db => {
      const br = (db.branch || 'KLK').toUpperCase();
      if (!map[br]) {
        map[br] = { code: br, salesCount: 0, salesAmount: 0, salesPaid: 0, billsCount: 0, billsAmount: 0, billsPaid: 0, expensesCount: 0, expensesAmount: 0, cashCredit: 0, cashDebit: 0, bankCredit: 0, bankDebit: 0, daybookCount: 0 };
      }
      map[br].daybookCount += 1;
      map[br].cashCredit += parseFloat(db.cashCredit || 0);
      map[br].cashDebit += parseFloat(db.cashDebit || 0);
      map[br].bankCredit += parseFloat(db.bankCredit || 0);
      map[br].bankDebit += parseFloat(db.bankDebit || 0);
    });

    return map;
  }, [branches, sales, bills, expenses, daybookTransactions]);

  // 2. Calculate Real-Time Department-Wise Aggregates
  const deptAnalytics = useMemo(() => {
    const map = {};
    departments.forEach(dCode => {
      const code = dCode.toUpperCase();
      map[code] = {
        code,
        salesCount: 0,
        salesAmount: 0,
        expensesCount: 0,
        expensesAmount: 0,
        daybookCount: 0
      };
    });

    (sales || []).forEach(s => {
      const dept = (s.department || 'OFFSET').toUpperCase();
      if (!map[dept]) {
        map[dept] = { code: dept, salesCount: 0, salesAmount: 0, expensesCount: 0, expensesAmount: 0, daybookCount: 0 };
      }
      map[dept].salesCount += 1;
      map[dept].salesAmount += parseFloat(s.finalAmount || s.subtotal || 0);
    });

    (expenses || []).forEach(e => {
      const dept = (e.department || 'GENERAL ADMIN').toUpperCase();
      if (!map[dept]) {
        map[dept] = { code: dept, salesCount: 0, salesAmount: 0, expensesCount: 0, expensesAmount: 0, daybookCount: 0 };
      }
      map[dept].expensesCount += 1;
      map[dept].expensesAmount += parseFloat(e.amount || 0);
    });

    (daybookTransactions || []).forEach(db => {
      const dept = (db.department || 'GENERAL ADMIN').toUpperCase();
      if (!map[dept]) {
        map[dept] = { code: dept, salesCount: 0, salesAmount: 0, expensesCount: 0, expensesAmount: 0, daybookCount: 0 };
      }
      map[dept].daybookCount += 1;
    });

    return map;
  }, [departments, sales, expenses, daybookTransactions]);

  // Totals
  const totalCompanySales = useMemo(() => {
    return Object.values(branchAnalytics).reduce((acc, b) => acc + b.salesAmount, 0);
  }, [branchAnalytics]);

  const totalCompanyPurchases = useMemo(() => {
    return Object.values(branchAnalytics).reduce((acc, b) => acc + b.billsAmount, 0);
  }, [branchAnalytics]);

  const totalCompanyExpenses = useMemo(() => {
    return Object.values(branchAnalytics).reduce((acc, b) => acc + b.expensesAmount, 0);
  }, [branchAnalytics]);

  // Filtered branches & departments
  const filteredBranches = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return branches.filter(b => {
      const meta = branchDetails[b] || {};
      return b.toLowerCase().includes(q) || 
        (meta.name && meta.name.toLowerCase().includes(q)) ||
        (meta.address && meta.address.toLowerCase().includes(q)) ||
        (meta.inCharge && meta.inCharge.toLowerCase().includes(q));
    });
  }, [branches, branchDetails, searchQuery]);

  const filteredDepts = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return departments.filter(d => {
      const meta = departmentDetails[d] || {};
      return d.toLowerCase().includes(q) || 
        (meta.name && meta.name.toLowerCase().includes(q)) ||
        (meta.inCharge && meta.inCharge.toLowerCase().includes(q)) ||
        (meta.description && meta.description.toLowerCase().includes(q));
    });
  }, [departments, departmentDetails, searchQuery]);

  // Handlers - Branch
  const handleOpenAddBranch = () => {
    if (!isAdmin) {
      showToast('Admin PIN required to configure branches', 'error');
      openLoginModal();
      return;
    }
    const maxB = tierConfig?.maxBranches || 1;
    if (branches.length >= maxB) {
      showToast(`Branch creation limit reached (${branches.length}/${maxB}) on your ${tierConfig?.name || 'current tier'}. Upgrade in Profile Settings to add more branches.`, 'warning');
      return;
    }
    setEditingBranch(null);
    setBranchForm({
      code: '',
      name: '',
      address: '',
      phone: '',
      inCharge: '',
      gstin: '33BLQPM9171A1ZA',
      status: 'ACTIVE'
    });
    setShowBranchModal(true);
  };

  const handleOpenEditBranch = (code) => {
    if (!isAdmin) {
      showToast('Admin PIN required to edit branches', 'error');
      openLoginModal();
      return;
    }
    const meta = branchDetails[code] || {};
    setEditingBranch(code);
    setBranchForm({
      code,
      name: meta.name || `${code} Branch`,
      address: meta.address || '',
      phone: meta.phone || '',
      inCharge: meta.inCharge || '',
      gstin: meta.gstin || '33BLQPM9171A1ZA',
      status: meta.status || 'ACTIVE'
    });
    setShowBranchModal(true);
  };

  const handleSubmitBranch = (e) => {
    e.preventDefault();
    if (!branchForm.code.trim()) {
      showToast('Please enter a branch code (e.g. KLK, RMD)', 'error');
      return;
    }
    saveBranchMaster({
      ...branchForm,
      code: branchForm.code.trim().toUpperCase()
    });
    showToast(`Branch ${branchForm.code.toUpperCase()} saved successfully!`, 'success');
    setShowBranchModal(false);
  };

  // Handlers - Department
  const handleOpenAddDept = () => {
    if (!isAdmin) {
      showToast('Admin PIN required to configure departments', 'error');
      openLoginModal();
      return;
    }
    const maxD = tierConfig?.maxDepartments || 1;
    if (departments.length >= maxD) {
      showToast(`Department creation limit reached (${departments.length}/${maxD}) on your ${tierConfig?.name || 'current tier'}. Upgrade in Profile Settings to add more departments.`, 'warning');
      return;
    }
    setEditingDept(null);
    setDeptForm({
      code: '',
      name: '',
      inCharge: '',
      description: '',
      status: 'ACTIVE'
    });
    setShowDeptModal(true);
  };

  const handleOpenEditDept = (code) => {
    if (!isAdmin) {
      showToast('Admin PIN required to edit departments', 'error');
      openLoginModal();
      return;
    }
    const meta = departmentDetails[code] || {};
    setEditingDept(code);
    setDeptForm({
      code,
      name: meta.name || `${code} Department`,
      inCharge: meta.inCharge || '',
      description: meta.description || '',
      status: meta.status || 'ACTIVE'
    });
    setShowDeptModal(true);
  };

  const handleSubmitDept = (e) => {
    e.preventDefault();
    if (!deptForm.code.trim()) {
      showToast('Please enter a department code (e.g. OFFSET, FLEX)', 'error');
      return;
    }
    saveDepartmentMaster({
      ...deptForm,
      code: deptForm.code.trim().toUpperCase()
    });
    showToast(`Department ${deptForm.code.toUpperCase()} saved successfully!`, 'success');
    setShowDeptModal(false);
  };

  // Confirm Delete
  const handleConfirmDelete = () => {
    if (!deletingTarget) return;
    if (deletingTarget.type === 'branch') {
      removeBranchMaster(deletingTarget.code);
      showToast(`Branch ${deletingTarget.code} deleted from masters`, 'success');
    } else {
      removeDepartmentMaster(deletingTarget.code);
      showToast(`Department ${deletingTarget.code} deleted from masters`, 'success');
    }
    setDeletingTarget(null);
  };

  // Export to Excel
  const handleExportDirectory = () => {
    const wb = XLSX.utils.book_new();

    // 1. Branches Sheet
    const branchRows = [
      ['BRANCH CODE', 'BRANCH NAME', 'IN-CHARGE', 'CONTACT PHONE', 'GSTIN', 'ADDRESS', 'TOTAL SALES (INR)', 'TOTAL PURCHASES (INR)', 'EXPENSES (INR)', 'STATUS'],
      ...branches.map(b => {
        const meta = branchDetails[b] || {};
        const stats = branchAnalytics[b] || {};
        return [
          b,
          meta.name || `${b} Branch`,
          meta.inCharge || 'N/A',
          meta.phone || 'N/A',
          meta.gstin || 'N/A',
          meta.address || 'N/A',
          stats.salesAmount || 0,
          stats.billsAmount || 0,
          stats.expensesAmount || 0,
          meta.status || 'ACTIVE'
        ];
      })
    ];
    const wsBranches = XLSX.utils.aoa_to_sheet(branchRows);
    XLSX.utils.book_append_sheet(wb, wsBranches, 'Branches Master');

    // 2. Departments Sheet
    const deptRows = [
      ['DEPT CODE', 'DEPARTMENT NAME', 'HEAD / IN-CHARGE', 'DESCRIPTION', 'TOTAL SALES (INR)', 'TOTAL EXPENSES (INR)', 'STATUS'],
      ...departments.map(d => {
        const meta = departmentDetails[d] || {};
        const stats = deptAnalytics[d] || {};
        return [
          d,
          meta.name || `${d} Division`,
          meta.inCharge || 'N/A',
          meta.description || 'N/A',
          stats.salesAmount || 0,
          stats.expensesAmount || 0,
          meta.status || 'ACTIVE'
        ];
      })
    ];
    const wsDepts = XLSX.utils.aoa_to_sheet(deptRows);
    XLSX.utils.book_append_sheet(wb, wsDepts, 'Departments Master');

    XLSX.writeFile(wb, `MU_Accounts_Masters_Directory_${new Date().toISOString().substring(0, 10)}.xlsx`);
    showToast('Exported Masters Directory to Excel successfully!', 'success');
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-20">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white p-5 sm:p-6 rounded-3xl shadow-lg border border-blue-700/30 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-400 animate-pulse" />
            <span className="text-[11px] font-extrabold uppercase tracking-widest text-blue-300">Core Architecture Masters</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight flex items-center gap-2.5">
            <Building2 className="w-8 h-8 text-blue-400" />
            <span>Branch & Department Master</span>
          </h1>
          <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
            Manage your multi-hub retail outlets, manufacturing print divisions, department units & view live branch-wise financial activity.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleExportDirectory}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-800/80 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold border border-slate-700 shadow-xs transition-all"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
            <span>Export Excel</span>
          </button>

          {activeTab === 'branches' ? (
            <button
              onClick={handleOpenAddBranch}
              className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-900/40 transition-all scale-100 active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>Add New Branch</span>
            </button>
          ) : activeTab === 'departments' ? (
            <button
              onClick={handleOpenAddDept}
              className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-900/40 transition-all scale-100 active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>Add New Department</span>
            </button>
          ) : null}
        </div>
      </div>

      {/* KPI Overview Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
            <span className="flex items-center gap-1">
              <Building className="w-3.5 h-3.5 text-blue-500" />
              <span>Active Outlets</span>
            </span>
            <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-blue-50 text-blue-700">
              Limit: {tierConfig?.maxBranches || 1}
            </span>
          </p>
          <p className="text-2xl font-black text-slate-900 font-mono mt-1">
            {branches.length} <span className="text-xs text-slate-400 font-normal">/ {tierConfig?.maxBranches >= 9000 ? '∞' : tierConfig?.maxBranches || 1} Hubs</span>
          </p>
          <span className="text-[10px] text-blue-600 font-semibold">{tierConfig?.badge || 'Plan'} Capacity</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
            <span className="flex items-center gap-1">
              <Briefcase className="w-3.5 h-3.5 text-indigo-500" />
              <span>Operating Divisions</span>
            </span>
            <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-indigo-50 text-indigo-700">
              Limit: {tierConfig?.maxDepartments || 1}
            </span>
          </p>
          <p className="text-2xl font-black text-slate-900 font-mono mt-1">
            {departments.length} <span className="text-xs text-slate-400 font-normal">/ {tierConfig?.maxDepartments >= 9000 ? '∞' : tierConfig?.maxDepartments || 1} Depts</span>
          </p>
          <span className="text-[10px] text-indigo-600 font-semibold">{tierConfig?.badge || 'Plan'} Capacity</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-emerald-100 shadow-xs">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
            <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
            <span>Multi-Branch Turnover</span>
          </p>
          <p className="text-2xl font-black text-emerald-700 font-mono mt-1">
            {formatCurrency(totalCompanySales)}
          </p>
          <span className="text-[10px] text-emerald-600 font-semibold">Consolidated Sales Inflow</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-rose-100 shadow-xs">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
            <TrendingDown className="w-3.5 h-3.5 text-rose-500" />
            <span>Branch Disbursements</span>
          </p>
          <p className="text-2xl font-black text-rose-700 font-mono mt-1">
            {formatCurrency(totalCompanyPurchases + totalCompanyExpenses)}
          </p>
          <span className="text-[10px] text-rose-600 font-semibold">Purchases & Overhead Costs</span>
        </div>
      </div>

      {/* Navigation Switcher & Search Bar */}
      <div className="bg-white p-3 sm:p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl">
          <button
            onClick={() => setActiveTab('branches')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === 'branches' 
                ? 'bg-white text-blue-700 shadow-xs' 
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            <span>Branch Directory</span>
            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-mono bg-blue-100 text-blue-700">
              {branches.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('departments')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === 'departments' 
                ? 'bg-white text-indigo-700 shadow-xs' 
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Department Master</span>
            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-mono bg-indigo-100 text-indigo-700">
              {departments.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('analytics')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === 'analytics' 
                ? 'bg-white text-emerald-700 shadow-xs' 
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>Cross-Unit Analytics</span>
          </button>
        </div>

        <div className="relative sm:w-64">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Filter branch / dept..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* 1. Branch Master View */}
      {activeTab === 'branches' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredBranches.map(bCode => {
            const meta = branchDetails[bCode] || {};
            const stats = branchAnalytics[bCode] || { salesAmount: 0, salesCount: 0, billsAmount: 0, expensesAmount: 0, cashCredit: 0, cashDebit: 0 };
            const netCashFlow = (stats.cashCredit + stats.bankCredit) - (stats.cashDebit + stats.bankDebit);

            return (
              <div 
                key={bCode}
                className="bg-white rounded-3xl border border-slate-200/90 shadow-sm hover:shadow-md transition-all overflow-hidden flex flex-col justify-between"
              >
                {/* Branch Header */}
                <div className="p-5 border-b border-slate-100">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-700 text-white flex items-center justify-center font-black font-mono text-base shadow-md">
                        {bCode}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-extrabold text-slate-900 text-base leading-tight">
                            {meta.name || `${bCode} Main Branch`}
                          </h3>
                        </div>
                        <span className="inline-block mt-0.5 px-2 py-0.5 rounded-md text-[10px] font-bold font-mono uppercase bg-blue-50 text-blue-700 border border-blue-200">
                          Branch Code: {bCode}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleOpenEditBranch(bCode)}
                        className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Edit Branch"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setDeletingTarget({ type: 'branch', code: bCode })}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                        title="Delete Branch"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Branch Metadata */}
                  <div className="mt-4 space-y-1.5 text-xs text-slate-600">
                    <div className="flex items-center gap-2 text-slate-500">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                      <span className="truncate">{meta.address || 'Address not specified'}</span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-500">
                      <UserCheck className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                      <span className="truncate">In-Charge: <strong className="text-slate-700">{meta.inCharge || 'Branch Manager'}</strong></span>
                    </div>
                    {meta.phone && (
                      <div className="flex items-center gap-2 text-slate-500">
                        <Phone className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                        <span className="font-mono">{meta.phone}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Branch Financial Statistics */}
                <div className="p-4 bg-slate-50/70 space-y-2.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 flex items-center gap-1.5">
                      <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
                      Sales Turnover:
                    </span>
                    <span className="font-black font-mono text-emerald-700">
                      {formatCurrency(stats.salesAmount)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5 text-blue-500" />
                      Purchases Incurred:
                    </span>
                    <span className="font-black font-mono text-slate-800">
                      {formatCurrency(stats.billsAmount)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 flex items-center gap-1.5">
                      <TrendingDown className="w-3.5 h-3.5 text-rose-500" />
                      Direct Expenses:
                    </span>
                    <span className="font-black font-mono text-rose-700">
                      {formatCurrency(stats.expensesAmount)}
                    </span>
                  </div>

                  <div className="pt-2 border-t border-slate-200/80 flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                      Orders Booked:
                    </span>
                    <span className="font-black font-mono px-2 py-0.5 rounded-lg bg-blue-100 text-blue-800 text-[11px]">
                      {stats.salesCount} Orders
                    </span>
                  </div>
                </div>

                {/* Card Footer Inspection Button */}
                <div className="p-3 bg-white border-t border-slate-100 flex items-center justify-between">
                  <span className="text-[10px] text-slate-400 font-medium">
                    {stats.daybookCount} Day Book Entries
                  </span>
                  <button
                    onClick={() => setInspectingBranch(bCode)}
                    className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 px-2.5 py-1 rounded-lg hover:bg-blue-50 transition-colors"
                  >
                    <span>View Branch Details</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 2. Department Master View */}
      {activeTab === 'departments' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredDepts.map(dCode => {
            const meta = departmentDetails[dCode] || {};
            const stats = deptAnalytics[dCode] || { salesAmount: 0, salesCount: 0, expensesAmount: 0, daybookCount: 0 };

            return (
              <div 
                key={dCode}
                className="bg-white rounded-3xl border border-slate-200/90 shadow-sm hover:shadow-md transition-all overflow-hidden flex flex-col justify-between"
              >
                <div className="p-5 border-b border-slate-100">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-700 text-white flex items-center justify-center font-black font-mono text-base shadow-md">
                        {dCode.substring(0, 3)}
                      </div>
                      <div>
                        <h3 className="font-extrabold text-slate-900 text-base leading-tight">
                          {meta.name || `${dCode} Division`}
                        </h3>
                        <span className="inline-block mt-0.5 px-2 py-0.5 rounded-md text-[10px] font-bold font-mono uppercase bg-indigo-50 text-indigo-700 border border-indigo-200">
                          Division Code: {dCode}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleOpenEditDept(dCode)}
                        className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                        title="Edit Department"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setDeletingTarget({ type: 'dept', code: dCode })}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                        title="Delete Department"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <p className="mt-3 text-xs text-slate-600 leading-relaxed line-clamp-2">
                    {meta.description || 'Production unit and accounting cost center for jobs and operational disbursements.'}
                  </p>

                  <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
                    <UserCheck className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                    <span>Unit Head: <strong className="text-slate-700">{meta.inCharge || 'Department Lead'}</strong></span>
                  </div>
                </div>

                {/* Department Financial Activity */}
                <div className="p-4 bg-slate-50/70 space-y-2.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 flex items-center gap-1.5">
                      <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
                      Division Sales:
                    </span>
                    <span className="font-black font-mono text-emerald-700">
                      {formatCurrency(stats.salesAmount)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 flex items-center gap-1.5">
                      <TrendingDown className="w-3.5 h-3.5 text-rose-500" />
                      Division Expenses:
                    </span>
                    <span className="font-black font-mono text-rose-700">
                      {formatCurrency(stats.expensesAmount)}
                    </span>
                  </div>

                  <div className="pt-2 border-t border-slate-200/80 flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                      Orders Produced:
                    </span>
                    <span className="font-black font-mono px-2 py-0.5 rounded-lg bg-indigo-100 text-indigo-800 text-[11px]">
                      {stats.salesCount} Jobs
                    </span>
                  </div>
                </div>

                <div className="p-3 bg-white border-t border-slate-100 flex items-center justify-between">
                  <span className="text-[10px] text-slate-400 font-medium">
                    {stats.daybookCount} Day Book Vouchers
                  </span>
                  <button
                    onClick={() => setInspectingDept(dCode)}
                    className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 px-2.5 py-1 rounded-lg hover:bg-indigo-50 transition-colors"
                  >
                    <span>View Division Stats</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 3. Cross-Unit Comparative Analytics */}
      {activeTab === 'analytics' && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-slate-100 pb-4">
            <div>
              <h3 className="font-black text-slate-900 text-lg">Branch-Wise Comparative Breakdown</h3>
              <p className="text-xs text-slate-500">Side-by-side performance audit across all active company branches</p>
            </div>
            <span className="text-xs font-mono font-bold text-blue-700 bg-blue-50 px-3 py-1 rounded-full border border-blue-200">
              Total Company Turnover: {formatCurrency(totalCompanySales)}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-4">Branch</th>
                  <th className="py-3 px-4">Orders Booked</th>
                  <th className="py-3 px-4 text-right">Sales Turnover (₹)</th>
                  <th className="py-3 px-4 text-right">Turnover Share</th>
                  <th className="py-3 px-4 text-right">Purchases (₹)</th>
                  <th className="py-3 px-4 text-right">Expenses (₹)</th>
                  <th className="py-3 px-4 text-right">Net Operating Margin (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {branches.map(b => {
                  const meta = branchDetails[b] || {};
                  const stats = branchAnalytics[b] || {};
                  const share = totalCompanySales > 0 ? Math.round((stats.salesAmount / totalCompanySales) * 100) : 0;
                  const netMargin = stats.salesAmount - (stats.billsAmount + stats.expensesAmount);

                  return (
                    <tr key={b} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3.5 px-4 font-bold text-slate-900">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-blue-500" />
                          <span>{meta.name || `${b} Branch`}</span>
                          <span className="font-mono text-[10px] text-slate-400">({b})</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 font-mono font-semibold text-slate-700">
                        {stats.salesCount} Orders
                      </td>
                      <td className="py-3.5 px-4 text-right font-black font-mono text-emerald-700">
                        {formatCurrency(stats.salesAmount)}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold font-mono bg-blue-100 text-blue-800">
                          {share}%
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono text-slate-700">
                        {formatCurrency(stats.billsAmount)}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono text-rose-700">
                        {formatCurrency(stats.expensesAmount)}
                      </td>
                      <td className="py-3.5 px-4 text-right font-black font-mono">
                        <span className={netMargin >= 0 ? 'text-emerald-700' : 'text-rose-700'}>
                          {netMargin >= 0 ? '+' : ''}{formatCurrency(netMargin)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL: Add / Edit Branch */}
      {showBranchModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-slate-900 text-base">
                    {editingBranch ? `Edit Branch (${editingBranch})` : 'Register New Branch'}
                  </h3>
                  <p className="text-[11px] text-slate-400">Configure company branch outlet details & accounting parameters</p>
                </div>
              </div>
              <button
                onClick={() => setShowBranchModal(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitBranch} className="space-y-4 pt-4 text-xs">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Branch Code <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    disabled={Boolean(editingBranch)}
                    placeholder="e.g. KLK, RMD, MDU"
                    value={branchForm.code}
                    onChange={(e) => setBranchForm(prev => ({ ...prev, code: e.target.value.toUpperCase() }))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold uppercase focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-60"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Branch Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Kilakarai Main Hub"
                    value={branchForm.name}
                    onChange={(e) => setBranchForm(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Address & Location</label>
                <textarea
                  rows="2"
                  placeholder="Street address, City, District & PIN Code"
                  value={branchForm.address}
                  onChange={(e) => setBranchForm(prev => ({ ...prev, address: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">In-Charge / Manager</label>
                  <input
                    type="text"
                    placeholder="e.g. Syed Ibrahim"
                    value={branchForm.inCharge}
                    onChange={(e) => setBranchForm(prev => ({ ...prev, inCharge: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Contact Phone</label>
                  <input
                    type="tel"
                    placeholder="e.g. +91 98424 00000"
                    value={branchForm.phone}
                    onChange={(e) => setBranchForm(prev => ({ ...prev, phone: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Branch GSTIN (Optional)</label>
                <input
                  type="text"
                  placeholder="33BLQPM9171A1ZA"
                  value={branchForm.gstin}
                  onChange={(e) => setBranchForm(prev => ({ ...prev, gstin: e.target.value.toUpperCase() }))}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono uppercase focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowBranchModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-900/30"
                >
                  Save Branch Master
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Add / Edit Department */}
      {showDeptModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <Layers className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-slate-900 text-base">
                    {editingDept ? `Edit Department (${editingDept})` : 'Register New Department'}
                  </h3>
                  <p className="text-[11px] text-slate-400">Configure operating division and job cost center</p>
                </div>
              </div>
              <button
                onClick={() => setShowDeptModal(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitDept} className="space-y-4 pt-4 text-xs">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Department Code <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    disabled={Boolean(editingDept)}
                    placeholder="e.g. OFFSET, FLEX, PACK"
                    value={deptForm.code}
                    onChange={(e) => setDeptForm(prev => ({ ...prev, code: e.target.value.toUpperCase() }))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold uppercase focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-60"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Department Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Offset Printing Division"
                    value={deptForm.name}
                    onChange={(e) => setDeptForm(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Department Head / In-Charge</label>
                <input
                  type="text"
                  placeholder="e.g. Senthil / Murugan"
                  value={deptForm.inCharge}
                  onChange={(e) => setDeptForm(prev => ({ ...prev, inCharge: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Description & Scope of Work</label>
                <textarea
                  rows="3"
                  placeholder="Specify services, machinery or production scope handled by this division"
                  value={deptForm.description}
                  onChange={(e) => setDeptForm(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowDeptModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-900/30"
                >
                  Save Department Master
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Confirm Delete */}
      {deletingTarget && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-200">
            <div className="w-10 h-10 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mb-3">
              <Trash2 className="w-5 h-5" />
            </div>
            <h4 className="font-bold text-slate-900 text-base mb-1">
              Delete {deletingTarget.type === 'branch' ? 'Branch' : 'Department'} ({deletingTarget.code})?
            </h4>
            <p className="text-xs text-slate-500 mb-5 leading-relaxed">
              Are you sure you want to delete this {deletingTarget.type}? Existing transactions tagged with this {deletingTarget.type} will retain their history, but it will be removed from future selection dropdowns.
            </p>
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setDeletingTarget(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-xs"
              >
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DRAWER / INSPECTION: Branch Detail */}
      {inspectingBranch && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center font-mono font-bold">
                  {inspectingBranch}
                </div>
                <div>
                  <h3 className="font-black text-slate-900 text-base">
                    {branchDetails[inspectingBranch]?.name || `${inspectingBranch} Branch`}
                  </h3>
                  <p className="text-[11px] text-slate-500">Live transaction summary for this branch</p>
                </div>
              </div>
              <button
                onClick={() => setInspectingBranch(null)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="py-4 space-y-4 text-xs">
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 bg-emerald-50 rounded-2xl border border-emerald-200">
                  <span className="text-[10px] font-bold text-emerald-800 uppercase">Sales Turnover</span>
                  <p className="text-lg font-black text-emerald-700 font-mono mt-0.5">
                    {formatCurrency(branchAnalytics[inspectingBranch]?.salesAmount || 0)}
                  </p>
                  <span className="text-[10px] text-emerald-600 font-medium">
                    {branchAnalytics[inspectingBranch]?.salesCount || 0} Invoices
                  </span>
                </div>

                <div className="p-3 bg-blue-50 rounded-2xl border border-blue-200">
                  <span className="text-[10px] font-bold text-blue-800 uppercase">Purchases</span>
                  <p className="text-lg font-black text-blue-700 font-mono mt-0.5">
                    {formatCurrency(branchAnalytics[inspectingBranch]?.billsAmount || 0)}
                  </p>
                  <span className="text-[10px] text-blue-600 font-medium">
                    {branchAnalytics[inspectingBranch]?.billsCount || 0} Bills
                  </span>
                </div>

                <div className="p-3 bg-rose-50 rounded-2xl border border-rose-200">
                  <span className="text-[10px] font-bold text-rose-800 uppercase">Direct Expenses</span>
                  <p className="text-lg font-black text-rose-700 font-mono mt-0.5">
                    {formatCurrency(branchAnalytics[inspectingBranch]?.expensesAmount || 0)}
                  </p>
                  <span className="text-[10px] text-rose-600 font-medium">
                    {branchAnalytics[inspectingBranch]?.expensesCount || 0} Vouchers
                  </span>
                </div>
              </div>

              <div>
                <h4 className="font-bold text-slate-900 mb-2">Branch Contact & Registration</h4>
                <div className="bg-slate-50 p-3.5 rounded-2xl space-y-1 text-slate-600">
                  <p><strong>Address:</strong> {branchDetails[inspectingBranch]?.address || 'Not specified'}</p>
                  <p><strong>In-Charge:</strong> {branchDetails[inspectingBranch]?.inCharge || 'Not assigned'}</p>
                  <p><strong>Phone:</strong> {branchDetails[inspectingBranch]?.phone || 'Not provided'}</p>
                  <p><strong>GSTIN:</strong> {branchDetails[inspectingBranch]?.gstin || '33BLQPM9171A1ZA'}</p>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setInspectingBranch(null)}
                className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DRAWER / INSPECTION: Dept Detail */}
      {inspectingDept && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-mono font-bold">
                  {inspectingDept.substring(0, 3)}
                </div>
                <div>
                  <h3 className="font-black text-slate-900 text-base">
                    {departmentDetails[inspectingDept]?.name || `${inspectingDept} Division`}
                  </h3>
                  <p className="text-[11px] text-slate-500">Division activity overview</p>
                </div>
              </div>
              <button
                onClick={() => setInspectingDept(null)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="py-4 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-emerald-50 rounded-2xl border border-emerald-200">
                  <span className="text-[10px] font-bold text-emerald-800 uppercase">Division Sales Turnover</span>
                  <p className="text-xl font-black text-emerald-700 font-mono mt-0.5">
                    {formatCurrency(deptAnalytics[inspectingDept]?.salesAmount || 0)}
                  </p>
                  <span className="text-[10px] text-emerald-600 font-medium">
                    {deptAnalytics[inspectingDept]?.salesCount || 0} Orders Produced
                  </span>
                </div>

                <div className="p-3 bg-rose-50 rounded-2xl border border-rose-200">
                  <span className="text-[10px] font-bold text-rose-800 uppercase">Operational Disbursements</span>
                  <p className="text-xl font-black text-rose-700 font-mono mt-0.5">
                    {formatCurrency(deptAnalytics[inspectingDept]?.expensesAmount || 0)}
                  </p>
                  <span className="text-[10px] text-rose-600 font-medium">
                    {deptAnalytics[inspectingDept]?.expensesCount || 0} Overhead Vouchers
                  </span>
                </div>
              </div>

              <div>
                <h4 className="font-bold text-slate-900 mb-2">Scope & Details</h4>
                <div className="bg-slate-50 p-3.5 rounded-2xl space-y-1.5 text-slate-600">
                  <p><strong>Department Head:</strong> {departmentDetails[inspectingDept]?.inCharge || 'Not assigned'}</p>
                  <p><strong>Description:</strong> {departmentDetails[inspectingDept]?.description || 'No description provided'}</p>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setInspectingDept(null)}
                className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
