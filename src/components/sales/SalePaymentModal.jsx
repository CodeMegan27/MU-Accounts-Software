import React, { useState, useEffect } from 'react';
import { useData } from '../../context/DataContext';
import { useToast } from '../../context/ToastContext';
import { formatCurrency, getTodayDate } from '../../utils/formatters';
import { CreditCard, X, Check, Plus } from 'lucide-react';
import QuickAddMasterModal from '../common/QuickAddMasterModal';

export default function SalePaymentModal({ sale, isOpen, onClose, onPaymentRecorded }) {
  const { recordSalePayment, paymentMethods, addPaymentMethod } = useData();
  const { showToast } = useToast();

  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(getTodayDate());
  const [mode, setMode] = useState('Cash');
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
    if (sale) {
      const bal = parseFloat(sale.balanceAmount) || 0;
      setAmount(bal > 0 ? bal.toFixed(2) : '0.00');
      setDate(getTodayDate());
      setMode('Cash');
      setReference('');
      setNotes('');
    }
  }, [sale, isOpen]);

  if (!isOpen || !sale) return null;

  const grandTotal = parseFloat(sale.finalAmount || sale.grandTotal || sale.totalAmount) || 0;
  const currentPaid = parseFloat(sale.paidAmount || sale.advanceAmount) || 0;
  const remainingBal = parseFloat(sale.balanceAmount) || 0;

  const handleSubmit = (e) => {
    e.preventDefault();
    const pAmt = parseFloat(amount);
    if (isNaN(pAmt) || pAmt <= 0) {
      showToast('Please enter a valid payment amount', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      recordSalePayment(sale.id, {
        type: 'Balance Payment',
        amount: pAmt,
        method: mode,
        date,
        reference: reference.trim(),
        notes: notes.trim()
      });

      const updatedSale = {
        ...sale,
        paidAmount: currentPaid + pAmt,
        advanceAmount: currentPaid + pAmt,
        balanceAmount: Math.max(0, remainingBal - pAmt),
        paymentStatus: (remainingBal - pAmt) <= 0.01 ? 'paid' : 'partial'
      };

      if (onPaymentRecorded) {
        onPaymentRecorded(updatedSale);
      }

      showToast(`Payment of ₹${pAmt.toLocaleString('en-IN')} recorded for #${sale.estNo || sale.id}`, 'success');
      onClose();
    } catch (err) {
      console.error('Sale payment record error:', err);
      showToast(err.message || 'Failed to record customer payment', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden transform transition-all">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 to-slate-800 p-5 text-white flex justify-between items-center">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center">
              <CreditCard className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold">Record Customer Payment</h3>
              <p className="text-[11px] text-slate-400">Order / Est #{sale.estNo || sale.orderNo || sale.id}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Customer & Bill Summary Banner */}
        <div className="bg-slate-50 p-4 border-b border-slate-200 text-xs space-y-1.5">
          <div className="flex justify-between text-slate-600">
            <span>Customer:</span>
            <span className="font-bold text-slate-900 truncate max-w-[200px]">{sale.customerName || 'Cash Customer'}</span>
          </div>
          {(sale.contact || sale.customerPhone || sale.phone) && (
            <div className="flex justify-between text-slate-600">
              <span>Mobile / Contact:</span>
              <span className="font-mono text-slate-800 font-semibold">{sale.contact || sale.customerPhone || sale.phone}</span>
            </div>
          )}
          <div className="flex justify-between text-slate-600">
            <span>Order Grand Total:</span>
            <span className="font-bold text-slate-900">{formatCurrency(grandTotal)}</span>
          </div>
          <div className="flex justify-between text-slate-600">
            <span>Received to Date:</span>
            <span className="text-emerald-700 font-semibold">{formatCurrency(currentPaid)}</span>
          </div>
          <div className="flex justify-between text-slate-900 font-bold pt-1 border-t border-slate-200 text-sm">
            <span>Pending Balance:</span>
            <span className="text-rose-600 font-mono">{formatCurrency(remainingBal)}</span>
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
                max={remainingBal > 0 ? remainingBal : undefined}
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
            <label className="block font-semibold text-slate-700 mb-1">Reference / UTR / Cheque / Transaction No</label>
            <input
              type="text"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="e.g. UPI / UTR / Cheque #"
              className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl uppercase font-mono focus:bg-white focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Receipt Remarks</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional notes or collection remarks"
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
