import React, { useState, useEffect } from 'react';
import { useData } from '../../context/DataContext';
import { useToast } from '../../context/ToastContext';
import { formatCurrency, getTodayDate } from '../../utils/formatters';
import { CreditCard, X, Check, Building2 } from 'lucide-react';

export default function AssetPaymentModal({ asset, isOpen, onClose }) {
  const { recordAssetPayment, paymentMethods } = useData();
  const { showToast } = useToast();

  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(getTodayDate());
  const [mode, setMode] = useState('BANK TRANSFER');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [syncToDaybook, setSyncToDaybook] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (asset) {
      const bal = asset.balanceAmount !== undefined ? asset.balanceAmount : Math.max(0, (asset.grandTotal || asset.value || 0) - (asset.paidAmount || 0));
      setAmount(bal > 0 ? bal.toFixed(2) : '0.00');
      setDate(getTodayDate());
      setMode(asset.paymentMethod || 'BANK TRANSFER');
      setReference('');
      setNotes('');
      setSyncToDaybook(true);
    }
  }, [asset, isOpen]);

  if (!isOpen || !asset) return null;

  const grandTotal = parseFloat(asset.grandTotal !== undefined ? asset.grandTotal : asset.value) || 0;
  const currentPaid = parseFloat(asset.paidAmount) || 0;
  const remainingBal = asset.balanceAmount !== undefined ? parseFloat(asset.balanceAmount) : Math.max(0, grandTotal - currentPaid);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const pAmt = parseFloat(amount);
    if (isNaN(pAmt) || pAmt <= 0) {
      showToast('Please enter a valid payment amount', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      await recordAssetPayment(asset.id, {
        amount: pAmt,
        date,
        mode,
        reference: reference.trim(),
        notes: notes.trim(),
        syncToDaybook
      });
      showToast('Asset payment recorded and synced with vendor ledger!', 'success');
      onClose();
    } catch (err) {
      console.error('Asset payment error:', err);
      showToast(err.message || 'Failed to record asset payment', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden transform transition-all">
        {/* Header */}
        <div className="bg-slate-900 p-5 text-white flex justify-between items-center">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center">
              <CreditCard className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold">Record Asset Bill Payment</h3>
              <p className="text-[11px] text-slate-400 font-mono">Inv #{asset.invoiceNo || asset.voucherNo}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Asset Summary Banner */}
        <div className="bg-slate-50 p-4 border-b border-slate-200 text-xs space-y-1.5">
          <div className="flex justify-between text-slate-600">
            <span>Asset Description:</span>
            <span className="font-bold text-slate-900 truncate max-w-[200px]">{asset.name}</span>
          </div>
          <div className="flex justify-between text-slate-600">
            <span>Supplier / Vendor:</span>
            <span className="font-bold text-slate-900 truncate max-w-[200px]">{asset.vendorName || 'Unassigned'}</span>
          </div>
          <div className="flex justify-between text-slate-600">
            <span>Total Bill Value:</span>
            <span className="font-bold text-slate-900">{formatCurrency(grandTotal)}</span>
          </div>
          <div className="flex justify-between text-slate-600">
            <span>Paid to Date:</span>
            <span className="font-medium text-emerald-700">{formatCurrency(currentPaid)}</span>
          </div>
          <div className="flex justify-between text-slate-800 font-bold border-t border-slate-200 pt-1.5">
            <span>Balance Due:</span>
            <span className="text-rose-600 font-mono text-sm">{formatCurrency(remainingBal)}</span>
          </div>
        </div>

        {/* Payment Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
          <div>
            <label className="block font-bold text-slate-700 mb-1">Payment Amount (₹)</label>
            <input
              type="number"
              step="0.01"
              max={remainingBal > 0 ? remainingBal : undefined}
              required
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full text-base font-extrabold font-mono border border-slate-300 rounded-xl px-3 py-2 outline-none focus:border-brand-600 text-right bg-slate-50 focus:bg-white"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Payment Date</label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full border border-slate-300 rounded-xl px-3 py-2 outline-none focus:border-brand-600"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Payment Mode</label>
              <select
                value={mode}
                onChange={(e) => setMode(e.target.value)}
                className="w-full border border-slate-300 rounded-xl px-3 py-2 outline-none focus:border-brand-600 bg-white font-medium"
              >
                {paymentMethods.map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Reference / UTR / Cheque #</label>
            <input
              type="text"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="e.g. UTR-908124 or Cheque 0021"
              className="w-full border border-slate-300 rounded-xl px-3 py-2 outline-none focus:border-brand-600 font-mono"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Notes / Remarks</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Part payment towards printing machine"
              className="w-full border border-slate-300 rounded-xl px-3 py-2 outline-none focus:border-brand-600"
            />
          </div>

          <div className="pt-2 flex items-center justify-between border-t border-slate-100">
            <label className="flex items-center gap-2 cursor-pointer text-slate-600 text-[11px]">
              <input
                type="checkbox"
                checked={syncToDaybook}
                onChange={(e) => setSyncToDaybook(e.target.checked)}
                className="rounded text-brand-600 focus:ring-brand-500 w-4 h-4"
              />
              <span>Record in Day Book (Cash / Bank Outflow)</span>
            </label>
          </div>

          <div className="pt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-300 text-slate-700 rounded-xl font-semibold hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold transition-all shadow-md flex items-center gap-1.5"
            >
              <Check className="w-4 h-4" /> {isSubmitting ? 'Recording...' : 'Record Payment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
