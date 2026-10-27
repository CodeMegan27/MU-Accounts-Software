import React, { useState, useEffect, useMemo } from 'react';
import { useData } from '../../context/DataContext';
import { useToast } from '../../context/ToastContext';
import { formatCurrency, getTodayDate, formatDate } from '../../utils/formatters';
import { 
  CreditCard, 
  X, 
  Check, 
  AlertCircle, 
  Plus, 
  Calendar, 
  FileText, 
  Layers, 
  Sparkles, 
  ArrowRight,
  ShieldCheck,
  CheckCircle2
} from 'lucide-react';
import QuickAddMasterModal from '../common/QuickAddMasterModal';

export default function VendorPaymentModal({ vendor, isOpen, onClose, defaultBillId = null }) {
  const { bills, recordVendorPayment, paymentMethods, addPaymentMethod } = useData();
  const { showToast } = useToast();

  const [allocationMode, setAllocationMode] = useState('bill'); // 'bill' | 'fifo' | 'advance'
  const [selectedBillId, setSelectedBillId] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(getTodayDate());
  const [mode, setMode] = useState('Bank Transfer');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [syncToDaybook, setSyncToDaybook] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showAddMethodModal, setShowAddMethodModal] = useState(false);

  // Filter unpaid purchase bills for this vendor
  const unpaidBills = useMemo(() => {
    if (!vendor) return [];
    return bills
      .filter(b => {
        const matches = b.vendorId === vendor.id || b.vendorName === vendor.name;
        if (!matches) return false;
        const gTotal = parseFloat(b.grandTotal) || 0;
        const pAmt = parseFloat(b.paidAmount) || 0;
        const bal = b.balanceAmount !== undefined ? parseFloat(b.balanceAmount) : (gTotal - pAmt);
        return bal > 0.01;
      })
      .sort((a, b) => new Date(a.date || '1970-01-01') - new Date(b.date || '1970-01-01'));
  }, [vendor, bills]);

  const totalPendingDue = useMemo(() => {
    return unpaidBills.reduce((acc, b) => {
      const gTotal = parseFloat(b.grandTotal) || 0;
      const pAmt = parseFloat(b.paidAmount) || 0;
      const bal = b.balanceAmount !== undefined ? parseFloat(b.balanceAmount) : (gTotal - pAmt);
      return acc + bal;
    }, 0);
  }, [unpaidBills]);

  // Initial setup when modal opens
  useEffect(() => {
    if (!isOpen || !vendor) return;

    setDate(getTodayDate());
    setReference('');
    setNotes('');
    setSyncToDaybook(true);

    if (defaultBillId && unpaidBills.some(b => b.id === defaultBillId)) {
      setAllocationMode('bill');
      setSelectedBillId(defaultBillId);
      const b = unpaidBills.find(item => item.id === defaultBillId);
      const bal = b.balanceAmount !== undefined ? parseFloat(b.balanceAmount) : (parseFloat(b.grandTotal || 0) - parseFloat(b.paidAmount || 0));
      setAmount(bal > 0 ? bal.toFixed(2) : '');
    } else if (unpaidBills.length > 0) {
      setAllocationMode('bill');
      setSelectedBillId(unpaidBills[0].id);
      const bal = unpaidBills[0].balanceAmount !== undefined 
        ? parseFloat(unpaidBills[0].balanceAmount) 
        : (parseFloat(unpaidBills[0].grandTotal || 0) - parseFloat(unpaidBills[0].paidAmount || 0));
      setAmount(bal > 0 ? bal.toFixed(2) : '');
    } else {
      setAllocationMode('advance');
      setSelectedBillId('');
      setAmount('');
    }
  }, [isOpen, vendor, defaultBillId]);

  // When changing selected bill in 'bill' mode
  const handleSelectBill = (bId) => {
    setSelectedBillId(bId);
    const b = unpaidBills.find(item => item.id === bId);
    if (b) {
      const bal = b.balanceAmount !== undefined ? parseFloat(b.balanceAmount) : (parseFloat(b.grandTotal || 0) - parseFloat(b.paidAmount || 0));
      setAmount(bal > 0 ? bal.toFixed(2) : '');
    }
  };

  // Switch allocation mode
  const handleModeChange = (newMode) => {
    setAllocationMode(newMode);
    if (newMode === 'bill') {
      const bId = selectedBillId || (unpaidBills.length > 0 ? unpaidBills[0].id : '');
      setSelectedBillId(bId);
      const b = unpaidBills.find(item => item.id === bId);
      if (b) {
        const bal = b.balanceAmount !== undefined ? parseFloat(b.balanceAmount) : (parseFloat(b.grandTotal || 0) - parseFloat(b.paidAmount || 0));
        setAmount(bal > 0 ? bal.toFixed(2) : '');
      }
    } else if (newMode === 'fifo') {
      setAmount(totalPendingDue > 0 ? totalPendingDue.toFixed(2) : '');
    } else if (newMode === 'advance') {
      setSelectedBillId('');
      if (!amount || amount === totalPendingDue.toFixed(2)) {
        setAmount('');
      }
    }
  };

  const handleAddPaymentMethod = (name) => {
    const added = addPaymentMethod(name);
    setMode(added);
    showToast(`Added payment method: ${added}`, 'success');
  };

  // Calculate dynamic FIFO preview allocation
  const fifoPreview = useMemo(() => {
    if (allocationMode !== 'fifo') return [];
    const pAmt = parseFloat(amount) || 0;
    let rem = pAmt;

    return unpaidBills.map(b => {
      const gTotal = parseFloat(b.grandTotal) || 0;
      const currentPaid = parseFloat(b.paidAmount) || 0;
      const bal = b.balanceAmount !== undefined ? parseFloat(b.balanceAmount) : (gTotal - currentPaid);
      const allocated = Math.min(bal, rem);
      rem = Math.max(0, rem - allocated);
      const newBal = bal - allocated;

      return {
        id: b.id,
        invoiceNo: b.invoiceNo || 'N/A',
        date: b.date,
        due: bal,
        allocated,
        remaining: newBal,
        isCleared: newBal <= 0.01
      };
    });
  }, [allocationMode, amount, unpaidBills]);

  const surplusAdvance = useMemo(() => {
    if (allocationMode !== 'fifo') return 0;
    const pAmt = parseFloat(amount) || 0;
    return Math.max(0, pAmt - totalPendingDue);
  }, [allocationMode, amount, totalPendingDue]);

  if (!isOpen || !vendor) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    const pAmt = parseFloat(amount);
    if (isNaN(pAmt) || pAmt <= 0) {
      showToast('Please enter a valid payment amount greater than zero', 'error');
      return;
    }

    if (allocationMode === 'bill' && !selectedBillId) {
      showToast('Please select an invoice to apply the payment against', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      await recordVendorPayment(vendor.id, {
        amount: pAmt,
        date,
        mode,
        reference: reference.trim(),
        notes: notes.trim(),
        billId: allocationMode === 'bill' ? selectedBillId : null,
        allocationMode,
        syncToDaybook
      });

      showToast(`Payment of ${formatCurrency(pAmt)} recorded successfully!`, 'success');
      onClose();
    } catch (err) {
      console.error('Vendor payment error:', err);
      showToast(err.message || 'Failed to record vendor payment', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-xl overflow-hidden my-auto transform transition-all">
        {/* Modal Header */}
        <div className="bg-slate-900 px-6 py-4 text-white flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center shadow-inner">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                Record Vendor Payment
              </h3>
              <p className="text-xs text-slate-300 font-medium truncate max-w-[320px]">{vendor.name}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors p-1.5 hover:bg-slate-800 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Vendor Summary Card */}
        <div className="bg-slate-50 px-6 py-3.5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div>
            <span className="text-slate-500 uppercase tracking-wider text-[10px] font-bold block">Supplier Account</span>
            <span className="font-bold text-slate-900 text-sm">{vendor.name}</span>
            {vendor.gstin && (
              <span className="text-[11px] text-slate-500 ml-2 font-mono">({vendor.gstin})</span>
            )}
          </div>
          <div className="text-right">
            <span className="text-slate-500 uppercase tracking-wider text-[10px] font-bold block">Total Invoices Due</span>
            <span className={`font-mono text-sm font-extrabold ${totalPendingDue > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>
              {formatCurrency(totalPendingDue)}
            </span>
            <span className="text-[11px] text-slate-500 block">
              {unpaidBills.length} pending bill{unpaidBills.length === 1 ? '' : 's'}
            </span>
          </div>
        </div>

        {/* Payment Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Allocation Mode Selector */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-2">
              Payment Allocation Method
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <button
                type="button"
                disabled={unpaidBills.length === 0}
                onClick={() => handleModeChange('bill')}
                className={`flex flex-col items-center justify-center p-3 rounded-xl border text-center transition-all ${
                  allocationMode === 'bill'
                    ? 'border-brand-600 bg-brand-50/70 text-brand-900 shadow-sm ring-1 ring-brand-500'
                    : unpaidBills.length === 0
                    ? 'border-slate-200 bg-slate-50 text-slate-300 cursor-not-allowed opacity-60'
                    : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700'
                }`}
              >
                <FileText className="w-4 h-4 mb-1 text-brand-600" />
                <span className="text-xs font-bold">Specific Bill</span>
                <span className="text-[10px] text-slate-500 mt-0.5">Pay target invoice</span>
              </button>

              <button
                type="button"
                disabled={unpaidBills.length === 0}
                onClick={() => handleModeChange('fifo')}
                className={`flex flex-col items-center justify-center p-3 rounded-xl border text-center transition-all ${
                  allocationMode === 'fifo'
                    ? 'border-emerald-600 bg-emerald-50/70 text-emerald-900 shadow-sm ring-1 ring-emerald-500'
                    : unpaidBills.length === 0
                    ? 'border-slate-200 bg-slate-50 text-slate-300 cursor-not-allowed opacity-60'
                    : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700'
                }`}
              >
                <Layers className="w-4 h-4 mb-1 text-emerald-600" />
                <span className="text-xs font-bold">Auto FIFO</span>
                <span className="text-[10px] text-slate-500 mt-0.5">Oldest bills first</span>
              </button>

              <button
                type="button"
                onClick={() => handleModeChange('advance')}
                className={`flex flex-col items-center justify-center p-3 rounded-xl border text-center transition-all ${
                  allocationMode === 'advance'
                    ? 'border-blue-600 bg-blue-50/70 text-blue-900 shadow-sm ring-1 ring-blue-500'
                    : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700'
                }`}
              >
                <Sparkles className="w-4 h-4 mb-1 text-blue-600" />
                <span className="text-xs font-bold">On-Account</span>
                <span className="text-[10px] text-slate-500 mt-0.5">Direct advance</span>
              </button>
            </div>
          </div>

          {/* Mode 1: Specific Invoice Selection */}
          {allocationMode === 'bill' && (
            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2">
              <label className="block text-xs font-bold text-slate-700">
                Select Pending Purchase Bill <span className="text-rose-500">*</span>
              </label>
              <select
                value={selectedBillId}
                onChange={(e) => handleSelectBill(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-medium focus:ring-2 focus:ring-brand-500 focus:outline-none"
              >
                {unpaidBills.map(b => {
                  const bal = b.balanceAmount !== undefined ? parseFloat(b.balanceAmount) : (parseFloat(b.grandTotal || 0) - parseFloat(b.paidAmount || 0));
                  return (
                    <option key={b.id} value={b.id}>
                      Inv #{b.invoiceNo || 'N/A'} • {formatDate(b.date)} • Due: {formatCurrency(bal)} (Total: {formatCurrency(b.grandTotal)})
                    </option>
                  );
                })}
              </select>
            </div>
          )}

          {/* Mode 2: Auto FIFO Breakdown Preview */}
          {allocationMode === 'fifo' && fifoPreview.length > 0 && (
            <div className="bg-emerald-50/60 p-3.5 rounded-xl border border-emerald-200 space-y-2 text-xs">
              <div className="flex items-center justify-between text-emerald-900 font-bold">
                <span className="flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-emerald-600" />
                  FIFO Allocation Preview ({fifoPreview.length} Bills)
                </span>
                <span className="font-mono text-[11px] text-emerald-700">
                  Total Due: {formatCurrency(totalPendingDue)}
                </span>
              </div>
              <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1 divide-y divide-emerald-100">
                {fifoPreview.map(p => (
                  <div key={p.id} className="pt-1.5 flex items-center justify-between text-[11px]">
                    <div>
                      <span className="font-semibold text-slate-800">Inv #{p.invoiceNo}</span>
                      <span className="text-slate-500 ml-1.5">({formatDate(p.date)})</span>
                    </div>
                    <div className="flex items-center gap-2 font-mono">
                      <span className="text-slate-500">Due: {formatCurrency(p.due)}</span>
                      <ArrowRight className="w-3 h-3 text-slate-400" />
                      <span className="font-bold text-emerald-700">+{formatCurrency(p.allocated)}</span>
                      {p.isCleared && (
                        <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1 rounded font-sans font-semibold">Cleared</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              {surplusAdvance > 0 && (
                <div className="pt-2 border-t border-emerald-200 flex items-center justify-between text-xs text-blue-800 font-medium bg-blue-50/80 p-2 rounded-lg">
                  <span>Advance Surplus Balance:</span>
                  <span className="font-mono font-bold">+{formatCurrency(surplusAdvance)} (On-Account)</span>
                </div>
              )}
            </div>
          )}

          {/* Mode 3: Advance Info */}
          {allocationMode === 'advance' && (
            <div className="bg-blue-50/60 p-3.5 rounded-xl border border-blue-200 text-xs text-blue-900 flex items-start gap-2.5">
              <Sparkles className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Advance / On-Account Payment</p>
                <p className="text-[11px] text-blue-700 mt-0.5 leading-relaxed">
                  This payment will be credited directly to {vendor.name}'s ledger account as an advance payment, reducing the overall balance.
                </p>
              </div>
            </div>
          )}

          {/* Amount & Date Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="text-xs font-bold text-slate-700">
                  Payment Amount (₹) <span className="text-rose-500">*</span>
                </label>
                {allocationMode === 'fifo' && totalPendingDue > 0 && (
                  <button
                    type="button"
                    onClick={() => setAmount(totalPendingDue.toFixed(2))}
                    className="text-[10px] text-brand-600 hover:text-brand-800 font-semibold"
                  >
                    Full Balance ({formatCurrency(totalPendingDue)})
                  </button>
                )}
              </div>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-slate-400 font-bold text-sm">₹</span>
                <input
                  type="number"
                  step="0.01"
                  required
                  min="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full pl-8 pr-3 py-2 bg-white border border-slate-300 rounded-xl text-sm font-mono font-bold text-slate-900 focus:ring-2 focus:ring-brand-500 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Payment Date <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-medium text-slate-800 focus:ring-2 focus:ring-brand-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Payment Method & Reference Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="text-xs font-bold text-slate-700">Payment Mode</label>
                <button
                  type="button"
                  onClick={() => setShowAddMethodModal(true)}
                  className="text-[10px] text-brand-600 hover:text-brand-800 font-semibold flex items-center gap-0.5"
                >
                  <Plus className="w-3 h-3" /> Add Mode
                </button>
              </div>
              <select
                value={mode}
                onChange={(e) => setMode(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 focus:ring-2 focus:ring-brand-500 focus:outline-none"
              >
                {(paymentMethods && paymentMethods.length > 0 ? paymentMethods : [
                  'Bank Transfer', 'Cash', 'Cheque', 'UPI / GPay', 'RTGS / NEFT'
                ]).map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Reference / Cheque / UTR No.
              </label>
              <input
                type="text"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="e.g. UTR12345678, CHQ-00124"
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-brand-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Notes / Remarks */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Payment Remarks / Notes
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Paid via ICICI Bank towards pending balance"
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-brand-500 focus:outline-none"
            />
          </div>

          {/* Sync to Day Book Checkbox */}
          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="syncDaybook"
              checked={syncToDaybook}
              onChange={(e) => setSyncToDaybook(e.target.checked)}
              className="rounded text-brand-600 focus:ring-brand-500 w-4 h-4 cursor-pointer"
            />
            <label htmlFor="syncDaybook" className="text-xs text-slate-700 font-medium cursor-pointer select-none">
              Automatically record in Day Book cash/bank register
            </label>
          </div>

          {/* Submit & Cancel Buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-semibold transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md transition-colors disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Recording...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  Record Payment {amount ? `(${formatCurrency(parseFloat(amount) || 0)})` : ''}
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Quick Add Payment Method Modal */}
      {showAddMethodModal && (
        <QuickAddMasterModal
          title="Add Payment Mode"
          label="Payment Mode / Bank Name"
          placeholder="e.g. HDFC Bank, PhonePe"
          onAdd={handleAddPaymentMethod}
          onClose={() => setShowAddMethodModal(false)}
        />
      )}
    </div>
  );
}
