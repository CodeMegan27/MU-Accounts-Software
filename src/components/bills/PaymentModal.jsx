import React, { useState, useEffect } from 'react';
import { useData } from '../../context/DataContext';
import { useToast } from '../../context/ToastContext';
import { formatCurrency, getTodayDate } from '../../utils/formatters';
import { CreditCard, X, Check, AlertCircle, Plus } from 'lucide-react';
import QuickAddMasterModal from '../common/QuickAddMasterModal';

export default function PaymentModal({ bill, isOpen, onClose }) {
  const { recordBillPayment, paymentMethods, addPaymentMethod } = useData();
  const { showToast } = useToast();

  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(getTodayDate());
  const [mode, setMode] = useState('Bank Transfer');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showAddMethodModal, setShowAddMethodModal] = useState(false);

  const handleAddPaymentMethod = (name) => {
    const added = addPaymentMethod(name);
    setMode(added);
    showToast(`Added payment method: ${added}`, 'success');
  };

  useEffect(() => {
    if (bill) {
      const bal = bill.balanceAmount !== undefined ? bill.balanceAmount : (bill.grandTotal - (bill.paidAmount || 0));
      setAmount(bal > 0 ? bal.toFixed(2) : '0.00');
      setDate(getTodayDate());
      setMode('Bank Transfer');
      setReference('');
      setNotes('');
    }
  }, [bill, isOpen]);

  if (!isOpen || !bill) return null;

  const grandTotal = parseFloat(bill.grandTotal) || 0;
  const currentPaid = parseFloat(bill.paidAmount) || 0;
  const remainingBal = bill.balanceAmount !== undefined ? parseFloat(bill.balanceAmount) : (grandTotal - currentPaid);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const pAmt = parseFloat(amount);
    if (isNaN(pAmt) || pAmt <= 0) {
      showToast('Please enter a valid payment amount', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      await recordBillPayment(bill.id, {
        amount: pAmt,
        date,
        mode,
        reference: reference.trim(),
        notes: notes.trim()
      });
      showToast('Payment recorded successfully!', 'success');
      onClose();
    } catch (err) {
      console.error('Payment record error:', err);
      showToast(err.message || 'Failed to record payment', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden transform transition-all">
        {/* Header */}
        <div className="bg-slate-900 p-5 text-white flex justify-between items-center">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center">
              <CreditCard className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold">Record Bill Payment</h3>
              <p className="text-[11px] text-slate-400">Invoice #{bill.invoiceNo}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Bill Summary Banner */}
        <div className="bg-slate-50 p-4 border-b border-slate-200 text-xs space-y-1.5">
          <div className="flex justify-between text-slate-600">
            <span>Vendor:</span>
            <span className="font-bold text-slate-900 truncate max-w-[200px]">{bill.vendorName}</span>
          </div>
          <div className="flex justify-between text-slate-600">
            <span>Invoice Total:</span>
            <span className="font-bold text-slate-900">{formatCurrency(grandTotal)}</span>
          </div>
          <div className="flex justify-between text-slate-600">
            <span>Already Paid:</span>
            <span className="text-emerald-700 font-semibold">{formatCurrency(currentPaid)}</span>
          </div>
          <div className="flex justify-between text-slate-900 font-bold pt-1 border-t border-slate-200 text-sm">
            <span>Remaining Due:</span>
            <span className="text-amber-600 font-mono">{formatCurrency(remainingBal)}</span>
          </div>
        </div>

        {/* Payment Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Payment Amount (₹) <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">₹</span>
              <input
                type="number"
                step="0.01"
                min="0.01"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full pl-7 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold font-mono focus:bg-white focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Payment Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block font-semibold text-slate-700">
                  Payment Mode <span className="text-red-500">*</span>
                </label>
                <button
                  type="button"
                  onClick={() => setShowAddMethodModal(true)}
                  className="text-[11px] font-bold text-brand-600 hover:text-brand-800 flex items-center gap-0.5 cursor-pointer"
                  title="Add new bank or payment method"
                >
                  <Plus className="w-3 h-3" /> Add
                </button>
              </div>
              <select
                value={mode}
                onChange={(e) => setMode(e.target.value)}
                className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-1 focus:ring-brand-500 font-semibold"
              >
                {paymentMethods.map(pm => (
                  <option key={pm} value={pm}>{pm}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Reference / UTR / Cheque No</label>
            <input
              type="text"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="e.g. UTR1029384756"
              className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl uppercase font-mono focus:bg-white focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Payment Remarks</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional notes or receipt memo"
              className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>

          <div className="pt-2 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 px-4 border border-slate-300 text-slate-700 rounded-xl font-semibold hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-xl font-semibold shadow-md transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              <Check className="w-4 h-4" /> {isSubmitting ? 'Recording...' : 'Confirm Payment'}
            </button>
          </div>
        </form>
      </div>

      {showAddMethodModal && (
        <QuickAddMasterModal
          type="paymentMethod"
          onClose={() => setShowAddMethodModal(false)}
          onAdd={handleAddPaymentMethod}
        />
      )}
    </div>
  );
}
