import React, { useState, useMemo, useRef } from 'react';
import { useData } from '../../context/DataContext';
import { useAuth } from '../../context/AuthContext';
import { useSettings } from '../../context/SettingsContext';
import { useToast } from '../../context/ToastContext';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { exportSingleVendorLedgerToExcel, exportAllVendorLedgersMultiSheet } from '../../utils/exportUtils';
import { 
  ArrowLeft, 
  Printer, 
  Building2, 
  Phone, 
  Mail, 
  MapPin, 
  FileSpreadsheet, 
  BookOpen, 
  CreditCard, 
  Edit3, 
  Edit2, 
  PlusCircle, 
  Trash2, 
  Sparkles,
  ExternalLink,
  Eye,
  X,
  Check,
  Calendar,
  Layers,
  FileText,
  DollarSign
} from 'lucide-react';
import VendorPaymentModal from './VendorPaymentModal';
import VendorEditModal from './VendorEditModal';

export default function VendorLedger({ 
  vendor, 
  onBack, 
  onCreateBill,
  onViewBill, 
  onEditBill, 
  onEditExpense, 
  onEditAsset, 
  onEditVendor 
}) {
  const { 
    bills, 
    vendors, 
    expenses, 
    assets, 
    deleteBill,
    updateBillPayment,
    deleteBillPayment,
    updateVendorPayment,
    deleteVendorPayment,
    deleteExpense,
    deleteAsset,
    paymentMethods
  } = useData();
  const { isAdmin, openLoginModal } = useAuth();
  const { profile } = useSettings();
  const { showToast } = useToast();
  const printRef = useRef(null);

  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentBillId, setPaymentBillId] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);

  // Modals for Altering Voucher Entries
  const [editPaymentModal, setEditPaymentModal] = useState({ isOpen: false, tx: null });
  const [viewVoucherModal, setViewVoucherModal] = useState({ isOpen: false, tx: null });

  // Keep vendor data continuously reactive to live edits in vendor master
  const currentVendor = useMemo(() => {
    if (!vendor) return null;
    return vendors.find(v => v.id === vendor.id) || vendor;
  }, [vendor, vendors]);

  // Compute vendor bills, expenses, assets, on-account payments, and chronological ledger
  const { transactions, summary } = useMemo(() => {
    if (!currentVendor) return { transactions: [], summary: { billed: 0, paid: 0, balance: 0, billCount: 0 } };

    const vendorBills = bills.filter(b => b.vendorId === currentVendor.id || b.vendorName === currentVendor.name);
    
    // Find matching expenses where payee or vendorName or vendorId matches vendor
    const vNameLower = (currentVendor.name || '').trim().toLowerCase();
    const vendorExpenses = (expenses || []).filter(e => {
      if (e.vendorId && currentVendor.id && e.vendorId === currentVendor.id) return true;
      const payee = (e.payee || e.vendorName || '').trim().toLowerCase();
      if (!payee || !vNameLower) return false;
      return payee === vNameLower || payee.includes(vNameLower) || vNameLower.includes(payee);
    });

    // Find matching asset GST bills where vendorId or vendorName matches
    const vendorAssets = (assets || []).filter(a => {
      if (a.vendorId && currentVendor.id && a.vendorId === currentVendor.id) return true;
      const aVendor = (a.vendorName || '').trim().toLowerCase();
      if (!aVendor || !vNameLower) return false;
      return aVendor === vNameLower || aVendor.includes(vNameLower) || vNameLower.includes(aVendor);
    });

    const txs = [];
    let totalBilled = 0;
    let totalPaid = 0;

    // 0. Process Opening Balance if present
    const opBal = parseFloat(currentVendor.openingBalance) || 0;
    const opType = currentVendor.openingBalanceType || 'payable';
    const opDate = currentVendor.openingBalanceDate || '2026-04-01';

    if (opBal > 0) {
      if (opType === 'payable') {
        totalBilled += opBal;
        txs.push({
          date: opDate,
          type: 'OPENING BALANCE',
          ref: 'OP-BAL',
          description: 'Opening Balance (Payable / B/F)',
          debit: opBal,
          credit: 0,
          isOpeningBalance: true
        });
      } else {
        totalPaid += opBal;
        txs.push({
          date: opDate,
          type: 'OPENING BALANCE',
          ref: 'OP-BAL',
          description: 'Opening Balance (Advance Paid / Cr)',
          debit: 0,
          credit: opBal,
          isOpeningBalance: true
        });
      }
    }

    // 0.5. Process Direct Advance / On-Account Payments recorded on Vendor
    if (Array.isArray(currentVendor.paymentHistory) && currentVendor.paymentHistory.length > 0) {
      currentVendor.paymentHistory.forEach(p => {
        const pAmt = parseFloat(p.amount) || 0;
        totalPaid += pAmt;
        txs.push({
          date: p.date || '',
          type: 'ADVANCE PAYMENT',
          ref: p.reference || p.id,
          paymentId: p.id,
          rawPayment: p,
          description: `On-Account / Advance Payment via ${p.mode || 'Bank'}${p.notes ? ` (${p.notes})` : ''}`,
          debit: 0,
          credit: pAmt,
          isVendorPayment: true
        });
      });
    }

    // 1. Process Bills
    vendorBills.forEach(b => {
      const gTotal = parseFloat(b.grandTotal) || 0;
      const pTotal = parseFloat(b.paidAmount) || 0;
      const bal = b.balanceAmount !== undefined ? parseFloat(b.balanceAmount) : Math.max(0, gTotal - pTotal);
      totalBilled += gTotal;

      // Add Bill Transaction
      txs.push({
        date: b.date || '',
        type: 'INVOICE',
        ref: b.invoiceNo || b.id,
        billId: b.id,
        rawBill: b,
        unpaidBalance: bal,
        description: `Purchase Bill #${b.invoiceNo || 'N/A'}`,
        debit: gTotal,
        credit: 0
      });

      // Add Payments
      if (b.paymentHistory && b.paymentHistory.length > 0) {
        b.paymentHistory.forEach(p => {
          const pAmt = parseFloat(p.amount) || 0;
          totalPaid += pAmt;
          txs.push({
            date: p.date || b.date,
            type: 'PAYMENT',
            ref: p.reference || p.id,
            billId: b.id,
            paymentId: p.id,
            rawPayment: p,
            rawBill: b,
            isBillPayment: true,
            description: `Payment via ${p.mode || 'Bank'} (Inv #${b.invoiceNo})`,
            debit: 0,
            credit: pAmt
          });
        });
      }
    });

    // 2. Process Expenses associated with Vendor
    vendorExpenses.forEach(e => {
      const eAmt = parseFloat(e.amount) || 0;
      totalBilled += eAmt;
      totalPaid += eAmt; // Expense vouchers are paid directly

      // Expense Debit entry
      txs.push({
        date: e.date || '',
        type: 'EXPENSE VOUCHER',
        ref: e.voucherNo || e.id,
        expenseId: e.id,
        rawExpense: e,
        isExpense: true,
        description: `Expense: ${e.category || 'Direct Expense'} - ${e.description || e.payee || 'Expense Voucher'}`,
        debit: eAmt,
        credit: 0
      });

      // Expense Credit entry (Paid)
      txs.push({
        date: e.date || '',
        type: 'EXPENSE PAYMENT',
        ref: e.voucherNo || e.id,
        expenseId: e.id,
        rawExpense: e,
        isExpense: true,
        description: `Paid via ${e.paymentMethod || 'Cash'} (Vch #${e.voucherNo || 'N/A'})`,
        debit: 0,
        credit: eAmt
      });
    });

    // 3. Process Asset GST Bills associated with Vendor
    vendorAssets.forEach(a => {
      const gTotal = parseFloat(a.grandTotal !== undefined ? a.grandTotal : a.value) || 0;
      totalBilled += gTotal;

      // Asset Bill Debit entry
      txs.push({
        date: a.date || '',
        type: 'ASSET BILL',
        ref: a.invoiceNo || a.voucherNo || a.id,
        assetId: a.id,
        rawAsset: a,
        isAsset: true,
        description: `Fixed Asset: ${a.name} (Inv #${a.invoiceNo || a.voucherNo || 'N/A'}) - ${a.category || 'Capital Goods'}`,
        debit: gTotal,
        credit: 0
      });

      // Asset Payments
      if (Array.isArray(a.paymentHistory) && a.paymentHistory.length > 0) {
        a.paymentHistory.forEach(p => {
          const pAmt = parseFloat(p.amount) || 0;
          totalPaid += pAmt;
          txs.push({
            date: p.date || a.date,
            type: 'ASSET PAYMENT',
            ref: p.reference || p.id,
            assetId: a.id,
            paymentId: p.id,
            rawPayment: p,
            rawAsset: a,
            isAsset: true,
            description: `Payment via ${p.mode || 'Bank'} (Asset Inv #${a.invoiceNo || a.voucherNo})`,
            debit: 0,
            credit: pAmt
          });
        });
      } else {
        const pAmt = parseFloat(a.paidAmount) || 0;
        if (pAmt > 0) {
          totalPaid += pAmt;
          txs.push({
            date: a.date || '',
            type: 'ASSET PAYMENT',
            ref: a.voucherNo || a.id,
            assetId: a.id,
            rawAsset: a,
            isAsset: true,
            description: `Paid via ${a.paymentMethod || 'Bank'} (Asset Inv #${a.invoiceNo || a.voucherNo})`,
            debit: 0,
            credit: pAmt
          });
        }
      }
    });

    // Sort chronologically (placing OPENING BALANCE first if on the same date)
    txs.sort((a, b) => {
      const diff = new Date(a.date || '1970-01-01') - new Date(b.date || '1970-01-01');
      if (diff !== 0) return diff;
      if (a.type === 'OPENING BALANCE') return -1;
      if (b.type === 'OPENING BALANCE') return 1;
      return 0;
    });

    // Calculate running balance
    let running = 0;
    const ledger = txs.map(t => {
      running += (t.debit - t.credit);
      return {
        ...t,
        balance: running
      };
    });

    return {
      transactions: ledger,
      summary: {
        billed: totalBilled,
        paid: totalPaid,
        balance: totalBilled - totalPaid,
        openingBalance: opBal,
        openingBalanceType: opType,
        openingBalanceDate: opDate,
        billCount: vendorBills.length + vendorExpenses.length + vendorAssets.length + (opBal > 0 ? 1 : 0) + (currentVendor.paymentHistory?.length || 0)
      }
    };
  }, [currentVendor, bills, expenses, assets]);

  const handleOpenPayment = (targetBillId = null) => {
    setPaymentBillId(targetBillId);
    setShowPaymentModal(true);
  };

  const handleOpenEdit = () => {
    if (onEditVendor) {
      // If parent has dedicated edit handler
      setShowEditModal(true);
    } else {
      setShowEditModal(true);
    }
  };

  const canEdit = (t) => {
    if (!t) return false;
    if (t.isOpeningBalance) return true;
    if (t.billId && t.type === 'INVOICE') return true;
    if (t.isBillPayment || t.isVendorPayment) return true;
    if (t.isExpense) return true;
    if (t.isAsset) return true;
    return false;
  };

  const canDelete = (t) => {
    if (!t) return false;
    if (t.isOpeningBalance) return false;
    if (t.billId && t.type === 'INVOICE') return true;
    if (t.isBillPayment || t.isVendorPayment) return true;
    if (t.isExpense) return true;
    if (t.isAsset) return true;
    return false;
  };

  const handleViewEntry = (t) => {
    if (t.billId && t.type === 'INVOICE') {
      if (onViewBill) onViewBill(t.billId);
      return;
    }
    setViewVoucherModal({ isOpen: true, tx: t });
  };

  const handleEditEntry = (t) => {
    if (!isAdmin) {
      showToast('Admin PIN required to edit voucher entries', 'error');
      openLoginModal();
      return;
    }

    if (t.isOpeningBalance) {
      setShowEditModal(true);
      return;
    }

    if (t.billId && t.type === 'INVOICE') {
      if (onEditBill) onEditBill(t.billId);
      else if (onViewBill) onViewBill(t.billId);
      return;
    }

    if (t.isBillPayment || t.isVendorPayment) {
      setEditPaymentModal({
        isOpen: true,
        tx: t,
        amount: String(t.credit || t.debit || ''),
        date: t.date || '',
        mode: t.rawPayment?.mode || 'Bank Transfer',
        reference: t.ref || t.rawPayment?.reference || '',
        notes: t.rawPayment?.notes || ''
      });
      return;
    }

    if (t.isExpense) {
      if (onEditExpense) onEditExpense(t.rawExpense);
      else showToast('Expense voucher editing unavailable', 'info');
      return;
    }

    if (t.isAsset) {
      if (onEditAsset) onEditAsset(t.rawAsset);
      else showToast('Asset record editing unavailable', 'info');
      return;
    }
  };

  const handleDeleteEntry = async (t) => {
    if (!isAdmin) {
      showToast('Admin PIN required to delete voucher entries', 'error');
      openLoginModal();
      return;
    }

    const typeLabel = t.type || 'Voucher';
    if (!window.confirm(`Are you sure you want to delete this ${typeLabel} entry (${t.description})? This will update the vendor balance immediately.`)) {
      return;
    }

    try {
      if (t.billId && t.type === 'INVOICE') {
        await deleteBill(t.billId);
        showToast('Purchase bill moved to recycle bin', 'success');
      } else if (t.isBillPayment && t.billId) {
        await deleteBillPayment(t.billId, t.paymentId);
        showToast('Payment voucher removed; bill balance updated', 'success');
      } else if (t.isVendorPayment) {
        await deleteVendorPayment(currentVendor.id, t.paymentId);
        showToast('On-account payment voucher deleted', 'success');
      } else if (t.isExpense && t.expenseId) {
        await deleteExpense(t.expenseId);
        showToast('Expense voucher deleted', 'success');
      } else if (t.isAsset && t.assetId) {
        await deleteAsset(t.assetId);
        showToast('Asset record deleted', 'success');
      }
    } catch (err) {
      console.error('Delete entry error:', err);
      showToast('Failed to delete voucher entry', 'error');
    }
  };

  const handleSavePaymentEdit = async () => {
    const { tx, amount, date, mode, reference, notes } = editPaymentModal;
    if (!tx) return;

    const parsedAmt = parseFloat(amount) || 0;
    if (parsedAmt <= 0) {
      showToast('Please enter a valid payment amount', 'error');
      return;
    }

    try {
      const updatedPayload = {
        amount: parsedAmt,
        date: date || tx.date,
        mode: mode || 'Bank Transfer',
        reference: reference || '',
        notes: notes || '',
        updatedAt: new Date().toISOString()
      };

      if (tx.isVendorPayment) {
        await updateVendorPayment(currentVendor.id, tx.paymentId, updatedPayload);
        showToast('On-account payment updated successfully', 'success');
      } else if (tx.billId) {
        await updateBillPayment(tx.billId, tx.paymentId, updatedPayload);
        showToast('Bill payment updated successfully', 'success');
      }

      setEditPaymentModal({ isOpen: false, tx: null });
    } catch (err) {
      console.error('Update payment error:', err);
      showToast('Failed to update payment voucher', 'error');
    }
  };

  const handleExportThisLedger = () => {
    const ok = exportSingleVendorLedgerToExcel(currentVendor, transactions, summary);
    if (ok) showToast(`Ledger statement for ${currentVendor.name} exported to Excel`, 'success');
  };

  const handleExportAllMultiSheet = () => {
    if (!vendors || vendors.length === 0) {
      showToast('No vendors found to export', 'error');
      return;
    }
    const ok = exportAllVendorLedgersMultiSheet(vendors, bills, expenses, assets);
    if (ok) showToast(`All Vendors Ledger Workbook exported (${vendors.length} sheets)`, 'success');
  };

  if (!currentVendor) return null;

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-24">
      {/* Top Header Bar */}
      <div className="no-print flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm sticky top-0 z-20">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-slate-500 hover:text-slate-900 font-semibold text-xs transition-colors px-2 py-1"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Vendors
        </button>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end">
          {/* Add Purchase Bill Button */}
          {onCreateBill && (
            <button
              onClick={() => onCreateBill(currentVendor)}
              className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm transition-colors cursor-pointer"
              title="Add a new purchase invoice for this vendor"
            >
              <FileText className="w-4 h-4" /> Add Purchase Bill
            </button>
          )}

          {/* Record Payment Button */}
          <button
            onClick={() => handleOpenPayment(null)}
            className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm transition-colors"
            title="Record payment to this vendor"
          >
            <CreditCard className="w-4 h-4" /> Make Payment
          </button>

          {/* Edit Vendor Button */}
          <button
            onClick={handleOpenEdit}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold shadow-sm transition-colors border border-slate-200"
            title="Edit vendor profile and opening balance"
          >
            <Edit3 className="w-3.5 h-3.5 text-slate-600" /> Edit Vendor
          </button>

          {/* Export Statement */}
          <button
            onClick={handleExportThisLedger}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold shadow-sm transition-colors border border-slate-200"
            title="Export this vendor statement to Excel"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" /> Export Excel
          </button>

          {/* All Ledgers Multi-Sheet */}
          <button
            onClick={handleExportAllMultiSheet}
            className="flex items-center gap-1.5 px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-xl text-xs font-semibold shadow-sm transition-colors border border-emerald-300"
            title="Export all vendors ledger with one sheet per vendor"
          >
            <BookOpen className="w-3.5 h-3.5 text-emerald-600" /> All Ledgers
          </button>

          {/* Print Button */}
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 hover:bg-black text-white rounded-xl text-xs font-semibold shadow-sm transition-colors"
          >
            <Printer className="w-4 h-4" /> Print
          </button>
        </div>
      </div>

      {/* Statement Sheet */}
      <div
        ref={printRef}
        className="bg-white p-8 sm:p-10 rounded-2xl border border-slate-200 shadow-lg text-slate-800 space-y-6 print-shadow-none"
      >
        {/* Company Header */}
        <div className="border-b border-slate-200 pb-6 flex justify-between items-start">
          <div>
            <h2 className="text-xl font-extrabold text-slate-900">{profile.businessName || 'RS Purchase'}</h2>
            <p className="text-xs text-slate-500 mt-0.5">{profile.address || 'Ramnad, Tamil Nadu'}</p>
            {profile.gstin && <p className="text-xs text-slate-600">GSTIN: {profile.gstin}</p>}
          </div>
          <div className="text-right">
            <span className="px-3 py-1 bg-slate-100 text-slate-700 text-[10px] font-bold uppercase rounded-full tracking-wider">
              Vendor Statement of Account
            </span>
            <p className="text-xs text-slate-400 mt-2">Generated on: {new Date().toLocaleDateString('en-GB')}</p>
          </div>
        </div>

        {/* Vendor Profile Banner */}
        <div className="bg-slate-50 p-5 rounded-xl border border-slate-200 relative group">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Statement For Supplier</p>
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                {currentVendor.name}
              </h3>
            </div>
            {/* Quick Edit in Ledger Banner */}
            <button
              onClick={handleOpenEdit}
              className="no-print inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-brand-700 bg-white hover:bg-brand-50 border border-slate-200 rounded-lg shadow-2xs transition-colors"
              title="Edit Vendor Details"
            >
              <Edit2 className="w-3.5 h-3.5" /> Edit Profile
            </button>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2 text-xs text-slate-600">
            {currentVendor.gstin && (
              <p>GSTIN: <span className="font-mono font-semibold text-slate-800">{currentVendor.gstin}</span></p>
            )}
            {currentVendor.phone && <p>Phone: <span className="font-medium text-slate-800">{currentVendor.phone}</span></p>}
            {currentVendor.email && <p>Email: <span className="font-medium text-slate-800">{currentVendor.email}</span></p>}
            {currentVendor.address && <p className="sm:col-span-2">Address: {currentVendor.address}</p>}
          </div>
        </div>

        {/* KPI Strip */}
        <div className={`grid ${summary.openingBalance > 0 ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-3'} gap-3 text-center`}>
          {summary.openingBalance > 0 && (
            <div className="p-3.5 bg-blue-50/60 rounded-xl border border-blue-200">
              <p className="text-[10px] uppercase font-bold text-blue-700">Opening Balance</p>
              <p className="text-base sm:text-lg font-bold text-blue-900 mt-1">
                {formatCurrency(summary.openingBalance)}
              </p>
              <p className="text-[10px] font-semibold text-blue-600 mt-0.5">
                {summary.openingBalanceType === 'advance' ? 'Advance Paid (Cr)' : 'Payable (Dr)'}
              </p>
            </div>
          )}
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
            <p className="text-[10px] uppercase font-bold text-slate-400">Total Billed</p>
            <p className="text-base sm:text-lg font-bold text-slate-900 mt-1">{formatCurrency(summary.billed)}</p>
          </div>
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
            <p className="text-[10px] uppercase font-bold text-slate-400">Total Settled</p>
            <p className="text-base sm:text-lg font-bold text-emerald-700 mt-1">{formatCurrency(summary.paid)}</p>
          </div>
          <div className="p-3.5 bg-amber-50/50 rounded-xl border border-amber-200 flex flex-col justify-between items-center">
            <div>
              <p className="text-[10px] uppercase font-bold text-amber-700">Net Balance Due</p>
              <p className={`text-base sm:text-lg font-extrabold mt-1 ${summary.balance > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>
                {formatCurrency(summary.balance)}
              </p>
            </div>
            {summary.balance > 0 && (
              <button
                onClick={() => handleOpenPayment(null)}
                className="no-print mt-2 inline-flex items-center gap-1 text-[11px] font-bold text-amber-800 bg-amber-100 hover:bg-amber-200 px-2.5 py-0.5 rounded-full transition-colors"
              >
                <CreditCard className="w-3 h-3" /> Pay Now
              </button>
            )}
          </div>
        </div>

        {/* Ledger Transactions Table */}
        <div className="overflow-hidden border border-slate-200 rounded-xl text-xs">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-100 text-slate-700 font-bold uppercase tracking-wider border-b border-slate-200">
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Transaction / Description</th>
                <th className="py-3 px-4 text-right">Billed (Dr)</th>
                <th className="py-3 px-4 text-right">Paid (Cr)</th>
                <th className="py-3 px-4 text-right">Running Balance</th>
                <th className="py-3 px-3 text-center no-print w-28">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {transactions.length === 0 ? (
                <tr>
                  <td colSpan="6" className="text-center py-8 text-slate-400">
                    No transactions recorded for this vendor.
                  </td>
                </tr>
              ) : (
                transactions.map((t, idx) => (
                  <tr key={idx} className="hover:bg-slate-50 transition-colors">
                    <td className="py-2.5 px-4 font-mono text-slate-600 whitespace-nowrap">{formatDate(t.date)}</td>
                    <td className="py-2.5 px-4">
                      {t.billId ? (
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <button
                            onClick={() => handleViewEntry(t)}
                            className="font-medium text-brand-600 hover:underline text-left inline-flex items-center gap-1"
                          >
                            {t.description}
                            <ExternalLink className="w-3 h-3 no-print text-slate-400" />
                          </button>
                          {t.unpaidBalance > 0 && (
                            <span className="no-print text-[10px] bg-amber-50 text-amber-800 border border-amber-200 font-mono px-1.5 py-0.2 rounded-full font-semibold">
                              Due: {formatCurrency(t.unpaidBalance)}
                            </span>
                          )}
                        </div>
                      ) : t.isVendorPayment ? (
                        <div className="flex items-center gap-1.5">
                          <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                          <span className="font-semibold text-emerald-800">{t.description}</span>
                          <span className="text-[10px] text-slate-400 font-mono">Ref: {t.ref}</span>
                        </div>
                      ) : (
                        <span className="font-medium text-slate-700">{t.description}</span>
                      )}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono font-medium text-slate-900 whitespace-nowrap">
                      {t.debit > 0 ? formatCurrency(t.debit) : '-'}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono font-medium text-emerald-700 whitespace-nowrap">
                      {t.credit > 0 ? formatCurrency(t.credit) : '-'}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono font-bold text-slate-900 whitespace-nowrap">
                      {formatCurrency(t.balance)}
                    </td>
                    <td className="py-2.5 px-3 text-center no-print whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1">
                        {/* View Voucher / Bill */}
                        <button
                          onClick={() => handleViewEntry(t)}
                          className="p-1 text-slate-500 hover:text-blue-600 rounded hover:bg-blue-50 transition-colors"
                          title="View voucher details"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>

                        {/* Edit Voucher / Bill */}
                        {canEdit(t) && (
                          <button
                            onClick={() => handleEditEntry(t)}
                            className="p-1 text-slate-500 hover:text-indigo-600 rounded hover:bg-indigo-50 transition-colors"
                            title="Edit voucher / entry"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {/* Delete Voucher / Bill */}
                        {canDelete(t) && (
                          <button
                            onClick={() => handleDeleteEntry(t)}
                            className="p-1 text-slate-400 hover:text-rose-600 rounded hover:bg-rose-50 transition-colors"
                            title="Delete voucher entry"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {/* Direct Pay for Unpaid Invoices */}
                        {t.billId && t.unpaidBalance > 0 && (
                          <button
                            onClick={() => handleOpenPayment(t.billId)}
                            className="px-2 py-0.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded text-[11px] font-bold transition-colors inline-flex items-center gap-1 ml-0.5"
                            title="Pay this invoice directly"
                          >
                            <CreditCard className="w-3 h-3" /> Pay
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Payment Voucher Modal */}
      {editPaymentModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full overflow-hidden p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
                  <Edit2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Edit Payment Voucher</h3>
                  <p className="text-[11px] text-slate-500">
                    {editPaymentModal.tx?.isVendorPayment ? 'On-Account Advance Payment' : `Payment for Bill #${editPaymentModal.tx?.rawBill?.invoiceNo || editPaymentModal.tx?.ref}`}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setEditPaymentModal({ isOpen: false, tx: null })}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-600 mb-1">Payment Date</label>
                <input
                  type="date"
                  value={editPaymentModal.date}
                  onChange={(e) => setEditPaymentModal(prev => ({ ...prev, date: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-600 mb-1">Amount Paid (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  value={editPaymentModal.amount}
                  onChange={(e) => setEditPaymentModal(prev => ({ ...prev, amount: e.target.value }))}
                  placeholder="0.00"
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-mono text-sm font-bold text-slate-900"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-600 mb-1">Payment Method / Mode</label>
                <select
                  value={editPaymentModal.mode}
                  onChange={(e) => setEditPaymentModal(prev => ({ ...prev, mode: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                >
                  {(paymentMethods && paymentMethods.length > 0 ? paymentMethods : ['Bank Transfer', 'Cash', 'GPAY- SBI', 'GPAY- IDBI', 'Cheque', 'RTGS/NEFT']).map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-600 mb-1">Reference / UTR / Cheque No</label>
                <input
                  type="text"
                  value={editPaymentModal.reference}
                  onChange={(e) => setEditPaymentModal(prev => ({ ...prev, reference: e.target.value }))}
                  placeholder="e.g. UTR12345678 or Cheque 00123"
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-600 mb-1">Notes / Narration</label>
                <textarea
                  rows={2}
                  value={editPaymentModal.notes}
                  onChange={(e) => setEditPaymentModal(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Optional remarks..."
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setEditPaymentModal({ isOpen: false, tx: null })}
                className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSavePaymentEdit}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm transition-colors flex items-center gap-1.5"
              >
                <Check className="w-4 h-4" /> Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Voucher Details Modal */}
      {viewVoucherModal.isOpen && viewVoucherModal.tx && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full overflow-hidden p-6 space-y-4">
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="text-[10px] uppercase font-bold text-emerald-600 tracking-wider">
                  Official Voucher Record
                </span>
                <h3 className="font-extrabold text-slate-900 text-base mt-0.5">
                  {viewVoucherModal.tx.type || 'Voucher Slip'}
                </h3>
                <p className="text-xs text-slate-400 font-mono">Ref #{viewVoucherModal.tx.ref || 'N/A'}</p>
              </div>
              <button
                onClick={() => setViewVoucherModal({ isOpen: false, tx: null })}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-2 text-xs">
              <div className="flex justify-between border-b border-slate-200/60 pb-2">
                <span className="text-slate-500 font-medium">Party / Vendor</span>
                <span className="font-bold text-slate-900">{currentVendor.name}</span>
              </div>
              <div className="flex justify-between border-b border-slate-200/60 pb-2">
                <span className="text-slate-500 font-medium">Voucher Date</span>
                <span className="font-mono font-bold text-slate-800">{formatDate(viewVoucherModal.tx.date)}</span>
              </div>
              <div className="flex justify-between border-b border-slate-200/60 pb-2">
                <span className="text-slate-500 font-medium">Description</span>
                <span className="font-semibold text-slate-800 text-right max-w-[260px]">{viewVoucherModal.tx.description}</span>
              </div>
              {viewVoucherModal.tx.debit > 0 && (
                <div className="flex justify-between border-b border-slate-200/60 pb-2">
                  <span className="text-slate-500 font-medium">Billed Amount (Dr)</span>
                  <span className="font-mono font-extrabold text-slate-900 text-sm">{formatCurrency(viewVoucherModal.tx.debit)}</span>
                </div>
              )}
              {viewVoucherModal.tx.credit > 0 && (
                <div className="flex justify-between border-b border-slate-200/60 pb-2">
                  <span className="text-slate-500 font-medium">Paid Amount (Cr)</span>
                  <span className="font-mono font-extrabold text-emerald-700 text-sm">{formatCurrency(viewVoucherModal.tx.credit)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Running Balance</span>
                <span className="font-mono font-bold text-slate-900">{formatCurrency(viewVoucherModal.tx.balance)}</span>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <div className="flex items-center gap-1.5">
                {canEdit(viewVoucherModal.tx) && (
                  <button
                    onClick={() => {
                      const target = viewVoucherModal.tx;
                      setViewVoucherModal({ isOpen: false, tx: null });
                      handleEditEntry(target);
                    }}
                    className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-bold transition-colors inline-flex items-center gap-1"
                  >
                    <Edit2 className="w-3.5 h-3.5" /> Edit Voucher
                  </button>
                )}
                {canDelete(viewVoucherModal.tx) && (
                  <button
                    onClick={() => {
                      const target = viewVoucherModal.tx;
                      setViewVoucherModal({ isOpen: false, tx: null });
                      handleDeleteEntry(target);
                    }}
                    className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-xl text-xs font-bold transition-colors inline-flex items-center gap-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Delete
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors inline-flex items-center gap-1"
                >
                  <Printer className="w-3.5 h-3.5" /> Print Slip
                </button>
                <button
                  type="button"
                  onClick={() => setViewVoucherModal({ isOpen: false, tx: null })}
                  className="px-4 py-1.5 bg-slate-900 hover:bg-black text-white rounded-xl text-xs font-bold transition-colors"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Vendor Payment Modal */}
      {showPaymentModal && (
        <VendorPaymentModal
          vendor={currentVendor}
          isOpen={showPaymentModal}
          onClose={() => setShowPaymentModal(false)}
          defaultBillId={paymentBillId}
        />
      )}

      {/* Vendor Edit Modal */}
      {showEditModal && (
        <VendorEditModal
          vendor={currentVendor}
          isOpen={showEditModal}
          onClose={() => setShowEditModal(false)}
        />
      )}
    </div>
  );
}
