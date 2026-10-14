import React, { useMemo, useRef } from 'react';
import { useData } from '../../context/DataContext';
import { useSettings } from '../../context/SettingsContext';
import { useToast } from '../../context/ToastContext';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { exportSingleVendorLedgerToExcel, exportAllVendorLedgersMultiSheet } from '../../utils/exportUtils';
import { ArrowLeft, Printer, Building2, Phone, Mail, MapPin, FileSpreadsheet, BookOpen } from 'lucide-react';

export default function VendorLedger({ vendor, onBack, onViewBill }) {
  const { bills, vendors, expenses, assets } = useData();
  const { profile } = useSettings();
  const { showToast } = useToast();
  const printRef = useRef(null);

  // Compute vendor bills, expenses, assets, and chronological ledger
  const { transactions, summary } = useMemo(() => {
    if (!vendor) return { transactions: [], summary: { billed: 0, paid: 0, balance: 0, billCount: 0 } };

    const vendorBills = bills.filter(b => b.vendorId === vendor.id || b.vendorName === vendor.name);
    
    // Find matching expenses where payee or vendorName or vendorId matches vendor
    const vNameLower = (vendor.name || '').trim().toLowerCase();
    const vendorExpenses = (expenses || []).filter(e => {
      if (e.vendorId && vendor.id && e.vendorId === vendor.id) return true;
      const payee = (e.payee || e.vendorName || '').trim().toLowerCase();
      if (!payee || !vNameLower) return false;
      return payee === vNameLower || payee.includes(vNameLower) || vNameLower.includes(payee);
    });

    // Find matching asset GST bills where vendorId or vendorName matches
    const vendorAssets = (assets || []).filter(a => {
      if (a.vendorId && vendor.id && a.vendorId === vendor.id) return true;
      const aVendor = (a.vendorName || '').trim().toLowerCase();
      if (!aVendor || !vNameLower) return false;
      return aVendor === vNameLower || aVendor.includes(vNameLower) || vNameLower.includes(aVendor);
    });

    const txs = [];
    let totalBilled = 0;
    let totalPaid = 0;

    // 1. Process Bills
    vendorBills.forEach(b => {
      const gTotal = parseFloat(b.grandTotal) || 0;
      totalBilled += gTotal;

      // Add Bill Transaction
      txs.push({
        date: b.date || '',
        type: 'INVOICE',
        ref: b.invoiceNo || b.id,
        billId: b.id,
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
        description: `Expense: ${e.category || 'Direct Expense'} - ${e.description || e.payee || 'Expense Voucher'}`,
        debit: eAmt,
        credit: 0
      });

      // Expense Credit entry (Paid)
      txs.push({
        date: e.date || '',
        type: 'EXPENSE PAYMENT',
        ref: e.voucherNo || e.id,
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
            description: `Paid via ${a.paymentMethod || 'Bank'} (Asset Inv #${a.invoiceNo || a.voucherNo})`,
            debit: 0,
            credit: pAmt
          });
        }
      }
    });

    // Sort chronologically
    txs.sort((a, b) => new Date(a.date) - new Date(b.date));

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
        billCount: vendorBills.length + vendorExpenses.length + vendorAssets.length
      }
    };
  }, [vendor, bills, expenses, assets]);

  const handleExportThisLedger = () => {
    const ok = exportSingleVendorLedgerToExcel(vendor, transactions, summary);
    if (ok) showToast(`Ledger statement for ${vendor.name} exported to Excel`, 'success');
  };

  const handleExportAllMultiSheet = () => {
    if (!vendors || vendors.length === 0) {
      showToast('No vendors found to export', 'error');
      return;
    }
    const ok = exportAllVendorLedgersMultiSheet(vendors, bills);
    if (ok) showToast(`All Vendors Ledger Workbook exported (${vendors.length} sheets)`, 'success');
  };

  if (!vendor) return null;

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-24">
      {/* Header Bar */}
      <div className="no-print flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm sticky top-0 z-20">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-slate-500 hover:text-slate-900 font-semibold text-xs transition-colors px-2 py-1"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Vendors
        </button>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end">
          <button
            onClick={handleExportThisLedger}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold shadow-sm transition-colors border border-slate-200"
            title="Export this vendor statement to Excel"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" /> Export Statement
          </button>
          <button
            onClick={handleExportAllMultiSheet}
            className="flex items-center gap-1.5 px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-xl text-xs font-semibold shadow-sm transition-colors border border-emerald-300"
            title="Export all vendors ledger with one sheet per vendor"
          >
            <BookOpen className="w-3.5 h-3.5 text-emerald-600" /> All Ledgers (Multi-Sheet)
          </button>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-black text-white rounded-xl text-xs font-semibold shadow-sm transition-colors"
          >
            <Printer className="w-4 h-4" /> Print Statement
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
        <div className="bg-slate-50 p-5 rounded-xl border border-slate-200">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Statement For Supplier</p>
          <h3 className="text-lg font-bold text-slate-900">{vendor.name}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2 text-xs text-slate-600">
            {vendor.gstin && (
              <p>GSTIN: <span className="font-mono font-semibold text-slate-800">{vendor.gstin}</span></p>
            )}
            {vendor.phone && <p>Phone: <span className="font-medium text-slate-800">{vendor.phone}</span></p>}
            {vendor.address && <p className="sm:col-span-2">Address: {vendor.address}</p>}
          </div>
        </div>

        {/* KPI Strip */}
        <div className="grid grid-cols-3 gap-4 text-center">
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
            <p className="text-[10px] uppercase font-bold text-slate-400">Total Invoiced</p>
            <p className="text-base sm:text-lg font-bold text-slate-900 mt-1">{formatCurrency(summary.billed)}</p>
          </div>
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
            <p className="text-[10px] uppercase font-bold text-slate-400">Total Settled</p>
            <p className="text-base sm:text-lg font-bold text-emerald-700 mt-1">{formatCurrency(summary.paid)}</p>
          </div>
          <div className="p-4 bg-amber-50/50 rounded-xl border border-amber-200">
            <p className="text-[10px] uppercase font-bold text-amber-700">Net Balance Due</p>
            <p className="text-base sm:text-lg font-extrabold text-amber-700 mt-1">{formatCurrency(summary.balance)}</p>
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
                <th className="py-3 px-4 text-right">Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {transactions.length === 0 ? (
                <tr>
                  <td colSpan="5" className="text-center py-8 text-slate-400">
                    No transactions recorded for this vendor.
                  </td>
                </tr>
              ) : (
                transactions.map((t, idx) => (
                  <tr key={idx} className="hover:bg-slate-50">
                    <td className="py-2.5 px-4 font-mono text-slate-600">{formatDate(t.date)}</td>
                    <td className="py-2.5 px-4">
                      {t.billId ? (
                        <button
                          onClick={() => onViewBill(t.billId)}
                          className="font-medium text-brand-600 hover:underline text-left"
                        >
                          {t.description}
                        </button>
                      ) : (
                        <span className="font-medium text-slate-700">{t.description}</span>
                      )}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono font-medium text-slate-900">
                      {t.debit > 0 ? formatCurrency(t.debit) : '-'}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono font-medium text-emerald-700">
                      {t.credit > 0 ? formatCurrency(t.credit) : '-'}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono font-bold text-slate-900">
                      {formatCurrency(t.balance)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
