import React, { useState, useEffect, useMemo } from 'react';
import { useData } from '../../context/DataContext';
import { useAuth } from '../../context/AuthContext';
import { useSettings } from '../../context/SettingsContext';
import { useToast } from '../../context/ToastContext';
import { calculateBillTotals, isInterStateSupply } from '../../utils/gstCalculations';
import { formatCurrency, getTodayDate } from '../../utils/formatters';
import QuickAddMasterModal from '../common/QuickAddMasterModal';
import { 
  ArrowLeft, 
  Check, 
  Receipt, 
  Lock, 
  Plus, 
  Trash2, 
  CheckCircle2, 
  Sparkles,
  FileText,
  Calculator
} from 'lucide-react';

export default function ExpenseForm({ expense, onBack }) {
  const { 
    saveExpense, 
    vendors,
    branches,
    departments,
    expenseCategories,
    paymentMethods,
    addBranch,
    addDepartment,
    addExpenseCategory,
    addPaymentMethod
  } = useData();
  const { isAdmin, openLoginModal } = useAuth();
  const { profile } = useSettings();
  const { showToast } = useToast();

  const [masterModalType, setMasterModalType] = useState(null);

  const handleAddMaster = (name) => {
    if (masterModalType === 'branch') {
      const added = addBranch(name);
      setBranch(added);
      showToast(`Added branch: ${added}`, 'success');
    } else if (masterModalType === 'department') {
      const added = addDepartment(name);
      setDepartment(added);
      showToast(`Added department: ${added}`, 'success');
    } else if (masterModalType === 'category') {
      const added = addExpenseCategory(name);
      setCategory(added);
      showToast(`Added expense category: ${added}`, 'success');
    } else if (masterModalType === 'paymentMethod') {
      const added = addPaymentMethod(name);
      setPaymentMethod(added);
      showToast(`Added payment method: ${added}`, 'success');
    }
  };

  const isEditing = Boolean(expense);

  // Mode: 'voucher' (Itemized Purchase-like Voucher with GST) or 'quick' (Simple direct entry)
  const [formMode, setFormMode] = useState('voucher');

  // Basic Header Fields
  const [date, setDate] = useState(getTodayDate());
  const [voucherNo, setVoucherNo] = useState('');
  const [payee, setPayee] = useState('');
  const [category, setCategory] = useState('Office Rent');
  const [description, setDescription] = useState('');
  
  // Enterprise fields
  const [branch, setBranch] = useState('KLK');
  const [department, setDepartment] = useState('GENERAL ADMIN');
  const [paymentMethod, setPaymentMethod] = useState('CASH');

  // GST & Voucher Fields
  const [isGst, setIsGst] = useState(false);
  const [gstin, setGstin] = useState('');
  const [taxType, setTaxType] = useState('exclusive');
  const [taxRate, setTaxRate] = useState(18);
  const [packing, setPacking] = useState(0);
  const [discount, setDiscount] = useState(0);
  const [isRoundOff, setIsRoundOff] = useState(true);
  
  // Item rows for voucher
  const [items, setItems] = useState([
    { name: '', uqc: 'NOS', qty: 1, rate: 0, amount: 0 }
  ]);
  const [quickAmount, setQuickAmount] = useState('');

  const [isSaving, setIsSaving] = useState(false);
  const [showGreenTick, setShowGreenTick] = useState(false);

  useEffect(() => {
    if (expense) {
      setDate(expense.date || getTodayDate());
      setVoucherNo(expense.voucherNo || expense.invoiceNo || '');
      setPayee(expense.payee || expense.vendorName || '');
      setCategory(expense.category || 'Office Rent');
      setDescription(expense.description || '');
      setBranch(expense.branch || 'KLK');
      setDepartment(expense.department || 'GENERAL ADMIN');
      setPaymentMethod(expense.paymentMethod || 'CASH');
      setIsGst(Boolean(expense.isGst));
      setGstin(expense.gstin || '');
      setTaxType(expense.taxType || 'exclusive');
      setTaxRate(expense.taxRate ?? 18);
      setPacking(expense.packing || 0);
      setDiscount(expense.discount || 0);
      setIsRoundOff(expense.isRoundOff !== undefined ? expense.isRoundOff : true);

      if (expense.items && expense.items.length > 0) {
        setFormMode('voucher');
        setItems(expense.items.map(i => ({
          name: i.name || '',
          uqc: i.uqc || 'NOS',
          qty: parseFloat(i.qty) || 1,
          rate: parseFloat(i.rate) || 0,
          amount: parseFloat(i.amount) || ((parseFloat(i.qty) || 1) * (parseFloat(i.rate) || 0))
        })));
      } else {
        setQuickAmount(expense.amount ? expense.amount.toString() : '');
      }
    } else {
      setDate(getTodayDate());
      setVoucherNo(`EXP-${Date.now().toString().slice(-6)}`);
      setPayee('');
      setCategory('Office Rent');
      setDescription('');
      setBranch('KLK');
      setDepartment('GENERAL ADMIN');
      setPaymentMethod('CASH');
      setIsGst(false);
      setGstin('');
      setTaxType('exclusive');
      setTaxRate(18);
      setPacking(0);
      setDiscount(0);
      setIsRoundOff(true);
      setItems([{ name: '', uqc: 'NOS', qty: 1, rate: 0, amount: 0 }]);
      setQuickAmount('');
    }
  }, [expense]);

  const isInterState = useMemo(() => {
    return isInterStateSupply(profile.gstin, gstin, profile.stateCode || "33");
  }, [profile.gstin, profile.stateCode, gstin]);

  // Recalculate Voucher Totals
  const totals = useMemo(() => {
    if (formMode === 'quick') {
      const qAmt = parseFloat(quickAmount) || 0;
      return {
        subtotal: qAmt,
        taxableBase: qAmt,
        packing: 0,
        discount: 0,
        taxAmount: 0,
        cgst: 0,
        sgst: 0,
        igst: 0,
        roundOff: 0,
        grandTotal: qAmt,
        items: []
      };
    }

    return calculateBillTotals({
      items,
      packing,
      discount,
      isGst,
      taxType,
      taxRate,
      isInterState,
      isRoundOff
    });
  }, [formMode, quickAmount, items, packing, discount, isGst, taxType, taxRate, isInterState, isRoundOff]);

  const handleItemChange = (index, field, value) => {
    setItems(prev => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      if (field === 'qty' || field === 'rate') {
        const q = parseFloat(field === 'qty' ? value : copy[index].qty) || 0;
        const r = parseFloat(field === 'rate' ? value : copy[index].rate) || 0;
        copy[index].amount = parseFloat((q * r).toFixed(2));
      }
      return copy;
    });
  };

  const handleAmountChange = (index, newAmountVal) => {
    setItems(prev => {
      const copy = [...prev];
      const newAmt = parseFloat(newAmountVal) || 0;
      copy[index].amount = newAmt;
      const q = parseFloat(copy[index].qty) || 1;
      if (q > 0) {
        copy[index].rate = parseFloat((newAmt / q).toFixed(2));
      }
      return copy;
    });
  };

  const addItemRow = () => {
    setItems(prev => [...prev, { name: '', uqc: 'NOS', qty: 1, rate: 0, amount: 0 }]);
  };

  const removeItemRow = (index) => {
    if (items.length <= 1) {
      showToast('Voucher must have at least one line item', 'error');
      return;
    }
    setItems(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isAdmin) {
      showToast('Admin PIN required to record expenses', 'error');
      openLoginModal();
      return;
    }

    const finalAmount = totals.grandTotal;
    if (finalAmount <= 0) {
      showToast('Expense amount must be greater than zero', 'error');
      return;
    }

    setIsSaving(true);
    try {
      const data = {
        id: expense ? expense.id : `E_${Date.now()}`,
        voucherNo: voucherNo.trim().toUpperCase(),
        date,
        payee: payee.trim().toUpperCase(),
        amount: finalAmount,
        category,
        description: description.trim() || `${category} - ${payee || 'Expense Voucher'}`,
        branch,
        department,
        paymentMethod,
        isVoucher: formMode === 'voucher',
        isGst: formMode === 'voucher' ? isGst : false,
        gstin: isGst ? gstin.trim().toUpperCase() : '',
        taxType: isGst ? taxType : '',
        taxRate: isGst ? parseFloat(taxRate) : 0,
        isInterState,
        subtotal: totals.subtotal,
        packing: totals.packing,
        discount: totals.discount,
        taxAmount: totals.taxAmount,
        cgst: totals.cgst,
        sgst: totals.sgst,
        igst: totals.igst,
        roundOff: totals.roundOff,
        grandTotal: finalAmount,
        items: formMode === 'voucher' ? totals.items : []
      };

      await saveExpense(data);

      setShowGreenTick(true);
      setTimeout(() => {
        setShowGreenTick(false);
        showToast(isEditing ? 'Expense voucher updated!' : 'Expense voucher recorded!', 'success');
        onBack();
      }, 1200);

    } catch (err) {
      console.error('Error saving expense:', err);
      showToast('Failed to save expense voucher', 'error');
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-24 relative">
      {/* Green Tick Animation Overlay */}
      {showGreenTick && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl p-8 flex flex-col items-center justify-center shadow-2xl text-center max-w-xs w-full animate-in zoom-in-95 duration-300">
            <div className="w-20 h-20 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mb-4 shadow-lg shadow-emerald-500/20 animate-bounce">
              <CheckCircle2 className="w-12 h-12 stroke-[2.5]" />
            </div>
            <h3 className="text-xl font-black text-slate-900 tracking-tight">Expense Saved!</h3>
            <p className="text-xs text-slate-500 mt-1">{category} ({formatCurrency(totals.grandTotal)})</p>
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-600 mt-3">
              <Sparkles className="w-3.5 h-3.5" /> Synchronized with Records
            </div>
          </div>
        </div>
      )}

      {/* Guest Mode Restriction Notice */}
      {!isAdmin && (
        <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center flex-shrink-0">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-amber-900">Read-Only Guest Mode</h4>
              <p className="text-[11px] text-amber-700">Expenses can be manually entered only with Admin Access.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={openLoginModal}
            className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-colors shadow-sm flex items-center gap-1.5"
          >
            <Lock className="w-3.5 h-3.5" /> Unlock Admin Access
          </button>
        </div>
      )}

      {/* Action Header */}
      <div className="flex items-center justify-between bg-white p-4 rounded-2xl border border-slate-200 shadow-sm relative z-10">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-2 text-slate-500 hover:text-slate-900 font-semibold text-xs transition-colors px-2 py-1"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Expenses
        </button>

        <div className="flex items-center gap-3">
          {/* Mode Switcher */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs font-semibold">
            <button
              type="button"
              onClick={() => setFormMode('voucher')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                formMode === 'voucher' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Voucher View (GST)
            </button>
            <button
              type="button"
              onClick={() => setFormMode('quick')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                formMode === 'quick' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Quick Entry
            </button>
          </div>

          <button
            type="button"
            onClick={onBack}
            className="px-4 py-2 border border-slate-300 text-slate-700 rounded-xl text-xs font-semibold hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="expenseForm"
            disabled={!isAdmin || isSaving}
            className={`flex items-center gap-1.5 px-6 py-2 rounded-xl text-xs font-semibold shadow-md transition-all ${
              !isAdmin ? 'bg-slate-300 text-slate-500 cursor-not-allowed' : 'bg-brand-600 hover:bg-brand-700 text-white'
            }`}
          >
            <Check className="w-4 h-4" /> {isSaving ? 'Saving...' : isEditing ? 'Update Expense' : 'Save Expense'}
          </button>
        </div>
      </div>

      <form id="expenseForm" onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Header Details */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-5 text-xs">
          <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Receipt className="w-4 h-4 text-brand-600" />
              {formMode === 'voucher' ? 'Expense Purchase Voucher' : 'Quick Expense Record'}
            </h3>
            <span className="text-[11px] text-slate-400">
              {formMode === 'voucher' ? 'Itemized with GST tax calculations' : 'Simple direct ledger entry'}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block font-semibold text-slate-700 mb-1.5">
                Voucher / Bill No <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                disabled={!isAdmin}
                value={voucherNo}
                onChange={(e) => setVoucherNo(e.target.value)}
                placeholder="e.g. EXP-00123"
                className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl uppercase font-mono font-semibold text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:opacity-75"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1.5">
                Expense Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                required
                disabled={!isAdmin}
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:opacity-75"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="font-semibold text-slate-700">
                  Expense Category <span className="text-red-500">*</span>
                </label>
                <button
                  type="button"
                  onClick={() => setMasterModalType('category')}
                  className="text-[11px] font-bold text-brand-600 hover:text-brand-800 flex items-center gap-0.5 cursor-pointer"
                  title="Add new custom expense category"
                >
                  <Plus className="w-3 h-3" /> Add
                </button>
              </div>
              <select
                disabled={!isAdmin}
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:opacity-75"
              >
                {expenseCategories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1.5">Payee / Service Provider</label>
              <input
                type="text"
                disabled={!isAdmin}
                value={payee}
                onChange={(e) => setPayee(e.target.value)}
                placeholder="e.g. EB Office / Landlord"
                list="expense-vendor-list"
                className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl uppercase focus:bg-white focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:opacity-75 font-medium"
              />
              <datalist id="expense-vendor-list">
                {vendors.map(v => (
                  <option key={v.id} value={v.name} />
                ))}
              </datalist>
            </div>
          </div>

          {/* Enterprise Cost Center & Payment Mode Allocation */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-slate-50/90 rounded-xl border border-slate-200">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="font-semibold text-slate-700">
                  Branch / Location <span className="text-red-500">*</span>
                </label>
                <button
                  type="button"
                  onClick={() => setMasterModalType('branch')}
                  className="text-[11px] font-bold text-brand-600 hover:text-brand-800 flex items-center gap-0.5 cursor-pointer"
                  title="Add new branch location"
                >
                  <Plus className="w-3 h-3" /> Add
                </button>
              </div>
              <select
                disabled={!isAdmin}
                value={branch}
                onChange={(e) => setBranch(e.target.value)}
                className="w-full py-2 px-3 bg-white border border-slate-200 rounded-xl font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:opacity-75"
              >
                {branches.map(b => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="font-semibold text-slate-700">
                  Department / Cost Center <span className="text-red-500">*</span>
                </label>
                <button
                  type="button"
                  onClick={() => setMasterModalType('department')}
                  className="text-[11px] font-bold text-brand-600 hover:text-brand-800 flex items-center gap-0.5 cursor-pointer"
                  title="Add new department"
                >
                  <Plus className="w-3 h-3" /> Add
                </button>
              </div>
              <select
                disabled={!isAdmin}
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className="w-full py-2 px-3 bg-white border border-slate-200 rounded-xl font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:opacity-75"
              >
                {departments.map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="font-semibold text-slate-700">
                  Payment Method / Bank <span className="text-red-500">*</span>
                </label>
                <button
                  type="button"
                  onClick={() => setMasterModalType('paymentMethod')}
                  className="text-[11px] font-bold text-brand-600 hover:text-brand-800 flex items-center gap-0.5 cursor-pointer"
                  title="Add new payment method or bank"
                >
                  <Plus className="w-3 h-3" /> Add
                </button>
              </div>
              <select
                disabled={!isAdmin}
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full py-2 px-3 bg-white border border-slate-200 rounded-xl font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:opacity-75"
              >
                {paymentMethods.map(m => {
                  const isCash = m.toUpperCase().includes('CASH');
                  return (
                    <option key={m} value={m}>
                      {isCash ? '💵 ' : '🏦 '}{m} {isCash ? '(Cash Book)' : '(Bank Book)'}
                    </option>
                  );
                })}
              </select>
            </div>
          </div>

          {/* If Quick Mode: Single Amount Input */}
          {formMode === 'quick' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <div>
                <label className="block font-semibold text-slate-700 mb-1.5">
                  Expense Amount (₹) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  disabled={!isAdmin}
                  value={quickAmount}
                  onChange={(e) => setQuickAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold text-slate-900 text-lg focus:bg-white focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:opacity-75"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1.5">Description / Memo</label>
                <input
                  type="text"
                  disabled={!isAdmin}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Optional expense description"
                  className="w-full py-2.5 px-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:opacity-75"
                />
              </div>
            </div>
          )}

          {/* GST Configuration (If Voucher Mode) */}
          {formMode === 'voucher' && (
            <div className="pt-3 border-t border-slate-100">
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="expGstChk"
                  disabled={!isAdmin}
                  checked={isGst}
                  onChange={(e) => setIsGst(e.target.checked)}
                  className="w-4 h-4 text-brand-600 rounded border-slate-300 focus:ring-brand-500 cursor-pointer disabled:opacity-75"
                />
                <label htmlFor="expGstChk" className="text-xs font-semibold text-slate-700 select-none cursor-pointer">
                  Service Provider / Payee is GST Registered (Claim Inward GST)
                </label>
              </div>

              {isGst && (
                <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-5 bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 uppercase mb-1">Payee GSTIN</label>
                    <input
                      type="text"
                      disabled={!isAdmin}
                      value={gstin}
                      onChange={(e) => setGstin(e.target.value)}
                      placeholder="33AAAAA0000A1Z5"
                      className="w-full py-1.5 px-3 bg-white border border-slate-200 rounded-lg text-xs font-mono uppercase focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:opacity-75"
                    />
                    {gstin && (
                      <p className="text-[10px] text-slate-500 mt-1">
                        {isInterState ? 'Inter-State (IGST Applicable)' : 'Intra-State (CGST + SGST Applicable)'}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 uppercase mb-1">Tax Mode</label>
                    <select
                      disabled={!isAdmin}
                      value={taxType}
                      onChange={(e) => setTaxType(e.target.value)}
                      className="w-full py-1.5 px-3 bg-white border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:opacity-75"
                    >
                      <option value="exclusive">Exclusive (Added to Subtotal)</option>
                      <option value="inclusive">Inclusive (Included in Rate)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 uppercase mb-1">GST Rate (%)</label>
                    <select
                      disabled={!isAdmin}
                      value={taxRate}
                      onChange={(e) => setTaxRate(e.target.value)}
                      className="w-full py-1.5 px-3 bg-white border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:opacity-75"
                    >
                      <option value="18">18% GST (Standard Services)</option>
                      <option value="12">12% GST</option>
                      <option value="5">5% GST (Concessional)</option>
                      <option value="28">28% GST</option>
                      <option value="0">0% GST (Exempt)</option>
                    </select>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Voucher Line Items (If Voucher Mode) */}
        {formMode === 'voucher' && (
          <>
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden text-xs">
              <div className="p-4 border-b border-slate-200 bg-slate-50/70 flex justify-between items-center">
                <div>
                  <h3 className="text-base font-bold text-slate-900">Voucher Particulars / Items</h3>
                  <p className="text-[11px] text-slate-500">
                    {isAdmin ? 'Admin Mode: You can manually alter Qty, Rate, or Amount directly.' : 'Guest Mode: View Only.'}
                  </p>
                </div>
                <span className="text-xs text-slate-500 font-medium">{items.length} lines</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse whitespace-nowrap min-w-[700px]">
                  <thead>
                    <tr className="bg-slate-100 text-slate-600 border-b border-slate-200 text-[11px] uppercase font-bold tracking-wider">
                      <th className="px-4 py-3 w-12 text-center">#</th>
                      <th className="px-4 py-3">Expense Particulars / Description *</th>
                      <th className="px-4 py-3 w-28">UQC</th>
                      <th className="px-4 py-3 w-28 text-right">Qty *</th>
                      <th className="px-4 py-3 w-36 text-right">Rate (₹) *</th>
                      <th className="px-4 py-3 w-40 text-right">Amount (₹)</th>
                      <th className="px-4 py-3 w-12 text-center"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {items.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-2.5 text-center text-slate-400 font-medium">{idx + 1}</td>
                        <td className="px-4 py-2.5">
                          <input
                            type="text"
                            required
                            disabled={!isAdmin}
                            value={item.name}
                            onChange={(e) => handleItemChange(idx, 'name', e.target.value)}
                            placeholder="e.g. Monthly Office Rent for September"
                            className="w-full py-1.5 px-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:bg-white focus:outline-none focus:ring-1 focus:ring-brand-500 font-medium text-slate-800 disabled:opacity-75"
                          />
                        </td>
                        <td className="px-4 py-2.5">
                          <select
                            disabled={!isAdmin}
                            value={item.uqc}
                            onChange={(e) => handleItemChange(idx, 'uqc', e.target.value)}
                            className="w-full py-1.5 px-2 bg-slate-50 border border-slate-200 rounded-lg text-xs bg-white uppercase font-mono disabled:opacity-75"
                          >
                            <option value="NOS">NOS</option>
                            <option value="MTH">MTH</option>
                            <option value="SET">SET</option>
                            <option value="HRS">HRS</option>
                            <option value="JOB">JOB</option>
                            <option value="BOX">BOX</option>
                          </select>
                        </td>
                        <td className="px-4 py-2.5">
                          <input
                            type="number"
                            step="0.01"
                            min="0.01"
                            required
                            disabled={!isAdmin}
                            value={item.qty}
                            onChange={(e) => handleItemChange(idx, 'qty', e.target.value)}
                            className="w-full py-1.5 px-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-right font-mono focus:bg-white focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:opacity-75"
                          />
                        </td>
                        <td className="px-4 py-2.5">
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            required
                            disabled={!isAdmin}
                            value={item.rate}
                            onChange={(e) => handleItemChange(idx, 'rate', e.target.value)}
                            className="w-full py-1.5 px-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-right font-mono focus:bg-white focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:opacity-75"
                          />
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="relative">
                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 font-mono text-[10px]">₹</span>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              disabled={!isAdmin}
                              value={item.amount}
                              onChange={(e) => handleAmountChange(idx, e.target.value)}
                              className={`w-full pl-5 pr-2.5 py-1.5 rounded-lg text-xs text-right font-mono font-bold focus:outline-none transition-all ${
                                isAdmin 
                                  ? 'bg-emerald-50/60 border border-emerald-300 text-emerald-900 focus:bg-white focus:ring-1 focus:ring-emerald-500' 
                                  : 'bg-slate-100 border border-slate-200 text-slate-700 cursor-not-allowed opacity-80'
                              }`}
                            />
                          </div>
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          {isAdmin && (
                            <button
                              type="button"
                              onClick={() => removeItemRow(idx)}
                              className="p-1 text-slate-400 hover:text-red-500 rounded transition-colors"
                              title="Remove Line"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {isAdmin && (
                <div className="p-3 bg-slate-50 border-t border-slate-200 flex justify-between items-center">
                  <button
                    type="button"
                    onClick={addItemRow}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-50 hover:bg-brand-100 text-brand-700 rounded-lg text-xs font-semibold transition-colors"
                  >
                    <Plus className="w-4 h-4" /> Add Line
                  </button>
                </div>
              )}
            </div>

            {/* Pricing Summary */}
            <div className="flex flex-col lg:flex-row gap-6 justify-between items-start">
              <div className="w-full lg:w-1/2 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Expense Remarks / Description</label>
                  <textarea
                    rows="3"
                    disabled={!isAdmin}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="e.g. Paid online via NEFT for office lease"
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:opacity-75"
                  />
                </div>

                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                  <div>
                    <span className="font-bold text-xs text-slate-800 flex items-center gap-1.5">
                      <Calculator className="w-3.5 h-3.5 text-brand-600" /> Round Off Total
                    </span>
                    <p className="text-[10px] text-slate-500">Round voucher to nearest integer rupee</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="expRoundOff"
                      disabled={!isAdmin}
                      checked={isRoundOff}
                      onChange={(e) => setIsRoundOff(e.target.checked)}
                      className="w-4 h-4 text-brand-600 rounded border-slate-300 focus:ring-brand-500 cursor-pointer disabled:opacity-75"
                    />
                    <label htmlFor="expRoundOff" className="text-xs font-bold text-brand-700 select-none cursor-pointer">
                      {isRoundOff ? 'Rounded' : 'Exact'}
                    </label>
                  </div>
                </div>
              </div>

              {/* Pricing Calculation Card */}
              <div className="w-full lg:w-1/2 bg-slate-900 text-white p-6 rounded-2xl shadow-xl space-y-3 text-xs">
                <div className="flex justify-between items-center text-slate-300">
                  <span>Voucher Subtotal</span>
                  <span className="font-bold text-white font-mono text-sm">{formatCurrency(totals.subtotal)}</span>
                </div>

                {isGst && totals.taxAmount > 0 && (
                  <div className="pt-2 border-t border-slate-800 space-y-1.5">
                    <div className="flex justify-between text-slate-400 text-[11px]">
                      <span>Taxable Value</span>
                      <span className="font-mono">{formatCurrency(totals.taxableBase)}</span>
                    </div>
                    {isInterState ? (
                      <div className="flex justify-between text-brand-300 font-medium">
                        <span>IGST ({taxRate}%)</span>
                        <span className="font-mono font-bold">{formatCurrency(totals.igst)}</span>
                      </div>
                    ) : (
                      <>
                        <div className="flex justify-between text-brand-300 font-medium">
                          <span>CGST ({(taxRate / 2)}%)</span>
                          <span className="font-mono font-bold">{formatCurrency(totals.cgst)}</span>
                        </div>
                        <div className="flex justify-between text-brand-300 font-medium">
                          <span>SGST ({(taxRate / 2)}%)</span>
                          <span className="font-mono font-bold">{formatCurrency(totals.sgst)}</span>
                        </div>
                      </>
                    )}
                  </div>
                )}

                {isRoundOff && Math.abs(totals.roundOff) > 0 && (
                  <div className="flex justify-between items-center text-slate-400 text-[11px] pt-1">
                    <span>Round Off (+ / -)</span>
                    <span className="font-mono font-semibold text-brand-300">
                      {totals.roundOff >= 0 ? `+₹${totals.roundOff.toFixed(2)}` : `-₹${Math.abs(totals.roundOff).toFixed(2)}`}
                    </span>
                  </div>
                )}

                <div className="pt-3 border-t border-slate-700 flex justify-between items-center text-base">
                  <div>
                    <span className="font-extrabold text-white">Grand Total Expense</span>
                    {isRoundOff && <span className="block text-[10px] text-slate-400 font-normal">Rounded to nearest ₹</span>}
                  </div>
                  <span className="font-extrabold text-red-400 font-mono text-xl">
                    {formatCurrency(totals.grandTotal)}
                  </span>
                </div>
              </div>
            </div>
          </>
        )}
      </form>

      {/* Quick Add Master Modal */}
      <QuickAddMasterModal
        isOpen={Boolean(masterModalType)}
        type={masterModalType}
        onClose={() => setMasterModalType(null)}
        onAdd={handleAddMaster}
      />
    </div>
  );
}
