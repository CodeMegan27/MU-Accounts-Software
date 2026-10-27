import React, { useRef } from 'react';
import { useData } from '../../context/DataContext';
import { useSettings } from '../../context/SettingsContext';
import { useToast } from '../../context/ToastContext';
import { formatCurrency, formatDate, numberToWords } from '../../utils/formatters';
import { downloadElementAsPDF } from '../../utils/exportUtils';
import { 
  ArrowLeft, 
  Printer, 
  Download, 
  CreditCard, 
  CheckCircle2, 
  Clock, 
  FileText
} from 'lucide-react';

export default function BillDetail({ billId, onBack, onOpenPaymentModal }) {
  const { bills } = useData();
  const { profile } = useSettings();
  const { showToast } = useToast();
  const printRef = useRef(null);

  const bill = bills.find(b => b.id === billId);

  if (!bill) {
    return (
      <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 shadow-sm max-w-xl mx-auto my-12">
        <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
        <h3 className="text-lg font-bold text-slate-800">Purchase Bill Not Found</h3>
        <p className="text-xs text-slate-400 mt-1 mb-6">The requested invoice record could not be loaded.</p>
        <button
          onClick={onBack}
          className="px-4 py-2 bg-brand-600 text-white rounded-xl text-xs font-semibold"
        >
          Back to Bills
        </button>
      </div>
    );
  }

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPDF = async () => {
    showToast('Generating PDF...', 'info');
    const ok = await downloadElementAsPDF(printRef.current, `Invoice_${bill.invoiceNo || 'Purchase'}.pdf`);
    if (ok) {
      showToast('PDF downloaded successfully', 'success');
    } else {
      showToast('Could not generate PDF. You can also use Print -> Save as PDF', 'error');
    }
  };

  const subtotal = parseFloat(bill.subtotal) || 0;
  const grandTotal = parseFloat(bill.grandTotal) || 0;
  const paidAmount = parseFloat(bill.paidAmount) || 0;
  const balance = bill.balanceAmount !== undefined ? parseFloat(bill.balanceAmount) : (grandTotal - paidAmount);
  const roundOff = parseFloat(bill.roundOff) || 0;

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-24">
      {/* Action Header - Hidden when printing */}
      <div className="no-print flex items-center justify-between bg-white p-4 rounded-2xl border border-slate-200 shadow-sm sticky top-0 z-20">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-slate-500 hover:text-slate-900 font-semibold text-xs transition-colors px-2 py-1"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Register
        </button>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => onOpenPaymentModal(bill)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-sm transition-colors"
          >
            <CreditCard className="w-4 h-4" /> Record Payment
          </button>
          <button
            onClick={handleDownloadPDF}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold shadow-sm transition-colors"
          >
            <Download className="w-4 h-4" /> Download PDF
          </button>
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-black text-white rounded-xl text-xs font-semibold shadow-sm transition-colors"
          >
            <Printer className="w-4 h-4" /> Print
          </button>
        </div>
      </div>

      {/* Invoice Document Canvas */}
      <div
        ref={printRef}
        className="bg-white p-4 sm:p-8 lg:p-12 rounded-2xl sm:rounded-3xl border-2 border-slate-300 shadow-lg text-slate-800 space-y-8 print-shadow-none overflow-hidden relative"
      >
        {/* Top Decorative Gradient Accent Bar */}
        <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-red-600 via-rose-500 to-blue-600" />

        {/* Top Header: Business Info & Invoice Badge */}
        <div className="flex flex-col sm:flex-row justify-between items-start border-b-2 border-slate-900 pb-6 sm:pb-8 pt-2 gap-4">
          <div className="flex flex-col sm:flex-row items-start gap-4 w-full sm:w-auto">
            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-white border border-slate-200 p-1 flex items-center justify-center flex-shrink-0 shadow-sm overflow-hidden">
              <img 
                src="/rs_designs_logo.jpg" 
                alt="RS DESIGNS" 
                className="w-full h-full object-contain"
              />
            </div>
            <div>
              <span className="px-3 py-1 bg-red-100 text-red-900 text-[10px] font-black uppercase rounded-full tracking-widest inline-block mb-1.5 border border-red-200">
                Official Purchase Bill
              </span>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-950">
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-600 via-rose-600 to-blue-700">
                  {profile.businessName || 'RS DESIGNS'}
                </span>
              </h1>
              <p className="text-[11px] font-bold text-slate-700 uppercase mt-0.5">
                {profile.tagline || 'CREATIVE DESIGNING • DIGITAL PRINTING • FLEX BANNER & PACKAGING'}
              </p>
              <p className="text-xs text-slate-500 mt-1">{profile.address || 'Main Road, Ramanathapuram, Tamil Nadu'}</p>
              {profile.gstin && (
                <p className="text-xs text-slate-600 mt-0.5">
                  GSTIN: <span className="font-mono font-bold text-slate-800">{profile.gstin}</span>
                </p>
              )}
              {profile.phone && <p className="text-xs text-slate-500">Phone: {profile.phone}</p>}
            </div>
          </div>

          <div className="text-right">
            <h2 className="text-xl font-black text-slate-900 tracking-wider">PURCHASE BILL</h2>
            <p className="text-sm font-mono font-bold text-indigo-700 mt-1"># {bill.invoiceNo || 'N/A'}</p>
            <p className="text-xs text-slate-500 mt-1">Date: <span className="font-medium text-slate-800">{formatDate(bill.date)}</span></p>
            
            <div className="mt-3">
              <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                bill.paymentStatus === 'paid'
                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                  : bill.paymentStatus === 'partial'
                  ? 'bg-blue-100 text-blue-800 border border-blue-300'
                  : 'bg-amber-100 text-amber-800 border border-amber-300'
              }`}>
                {bill.paymentStatus === 'paid' ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />}
                {bill.paymentStatus || 'UNPAID'}
              </span>
            </div>
          </div>
        </div>

        {/* Vendor Section */}
        <div className="bg-slate-50 p-5 rounded-xl border border-slate-200">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Supplier / Vendor Details</p>
          <h3 className="text-base font-bold text-slate-900">{bill.vendorName || 'Unknown Vendor'}</h3>
          {bill.isGst ? (
            <p className="text-xs text-slate-600 mt-1">
              GSTIN: <span className="font-mono font-bold text-slate-800">{bill.gstin}</span>
              <span className="ml-2 px-2 py-0.5 bg-brand-100 text-brand-700 text-[10px] font-semibold rounded">Registered</span>
            </p>
          ) : (
            <p className="text-xs text-slate-500 mt-1">Tax Status: Unregistered Business</p>
          )}
        </div>

        {/* Items Table */}
        <div className="overflow-hidden border-2 border-slate-800 rounded-xl shadow-xs">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white font-extrabold uppercase tracking-wider text-[11px] print:bg-slate-100 print:text-black print:border-b-2 print:border-black">
                <th className="py-3 px-4 w-12 text-center text-slate-300 print:text-black print:bg-slate-100 print:border print:border-slate-800">#</th>
                <th className="py-3 px-4 text-white print:text-black print:bg-slate-100 print:border print:border-slate-800">Item / Description</th>
                <th className="py-3 px-4 w-28 text-right text-white print:text-black print:bg-slate-100 print:border print:border-slate-800">Quantity</th>
                <th className="py-3 px-4 w-32 text-right text-white print:text-black print:bg-slate-100 print:border print:border-slate-800">Rate</th>
                <th className="py-3 px-4 w-36 text-right text-white print:text-black print:bg-slate-100 print:border print:border-slate-800">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(bill.items || []).map((item, idx) => (
                <tr key={idx} className="hover:bg-slate-50">
                  <td className="py-3 px-4 text-center text-slate-400 font-medium">{idx + 1}</td>
                  <td className="py-3 px-4 font-semibold text-slate-800">{item.name || '-'}</td>
                  <td className="py-3 px-4 text-right font-mono text-slate-600">
                    {item.qty} {item.uqc || ''}
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-slate-600">
                    ₹{(parseFloat(item.rate) || 0).toFixed(2)}
                  </td>
                  <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                    ₹{(parseFloat(item.amount) || 0).toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals & Calculations Breakdown */}
        <div className="flex flex-col sm:flex-row justify-between items-start gap-6 pt-2">
          {/* Amount in Words */}
          <div className="w-full sm:w-1/2 space-y-2">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Amount in Words</p>
            <p className="text-xs font-semibold text-slate-700 italic bg-slate-50 p-3 rounded-lg border border-slate-200">
              {numberToWords(grandTotal)}
            </p>
            {bill.notes && (
              <div className="pt-2">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Remarks / Notes</p>
                <p className="text-xs text-slate-600 mt-0.5">{bill.notes}</p>
              </div>
            )}
          </div>

          {/* Pricing Summary */}
          <div className="w-full sm:w-80 bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2 text-xs font-medium text-slate-600">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span className="font-mono font-bold text-slate-800">{formatCurrency(subtotal)}</span>
            </div>

            {(parseFloat(bill.packing) || 0) > 0 && (
              <div className="flex justify-between">
                <span>Freight / Packing</span>
                <span className="font-mono">{formatCurrency(bill.packing)}</span>
              </div>
            )}

            {(parseFloat(bill.discount) || 0) > 0 && (
              <div className="flex justify-between text-emerald-600">
                <span>Discount Received</span>
                <span className="font-mono">- {formatCurrency(bill.discount)}</span>
              </div>
            )}

            {bill.isGst && (parseFloat(bill.taxAmount) || 0) > 0 && (
              <div className="pt-2 border-t border-slate-200 space-y-1 text-brand-700">
                <div className="flex justify-between font-semibold">
                  <span>GST ({bill.taxRate}% {bill.taxType})</span>
                  <span className="font-mono font-bold">{formatCurrency(bill.taxAmount)}</span>
                </div>
                {bill.isInterState ? (
                  <div className="flex justify-between text-[11px] text-slate-500">
                    <span>IGST</span>
                    <span className="font-mono">{formatCurrency(bill.igst || bill.taxAmount)}</span>
                  </div>
                ) : (
                  <>
                    <div className="flex justify-between text-[11px] text-slate-500">
                      <span>CGST ({(bill.taxRate / 2)}%)</span>
                      <span className="font-mono">{formatCurrency(bill.cgst || (bill.taxAmount / 2))}</span>
                    </div>
                    <div className="flex justify-between text-[11px] text-slate-500">
                      <span>SGST ({(bill.taxRate / 2)}%)</span>
                      <span className="font-mono">{formatCurrency(bill.sgst || (bill.taxAmount / 2))}</span>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Round Off Line if applicable */}
            {Math.abs(roundOff) > 0 && (
              <div className="flex justify-between text-[11px] text-slate-500 pt-1">
                <span>Round Off</span>
                <span className="font-mono font-semibold text-brand-700">
                  {roundOff >= 0 ? `+₹${roundOff.toFixed(2)}` : `-₹${Math.abs(roundOff).toFixed(2)}`}
                </span>
              </div>
            )}

            <div className="pt-2.5 border-t-2 border-slate-300 flex justify-between items-center text-sm font-extrabold text-slate-900">
              <span>Grand Total</span>
              <span className="font-mono text-base text-brand-700">{formatCurrency(grandTotal)}</span>
            </div>

            {/* Payment Balance Strip */}
            <div className="pt-2 border-t border-slate-200 space-y-1 text-xs">
              <div className="flex justify-between text-emerald-700">
                <span>Amount Paid</span>
                <span className="font-mono font-bold">{formatCurrency(paidAmount)}</span>
              </div>
              <div className="flex justify-between text-amber-700 font-bold">
                <span>Balance Due</span>
                <span className="font-mono">{formatCurrency(balance)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Payment History Record */}
        {bill.paymentHistory && bill.paymentHistory.length > 0 && (
          <div className="pt-6 border-t border-slate-200">
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-3">Settlement / Payment History</h4>
            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 border-b border-slate-200 font-semibold uppercase">
                    <th className="py-2.5 px-4">Date</th>
                    <th className="py-2.5 px-4">Payment Mode</th>
                    <th className="py-2.5 px-4">Reference #</th>
                    <th className="py-2.5 px-4 text-right">Amount Paid</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {bill.paymentHistory.map((p, pIdx) => (
                    <tr key={pIdx}>
                      <td className="py-2.5 px-4 font-mono text-slate-600">{formatDate(p.date)}</td>
                      <td className="py-2.5 px-4 font-medium text-slate-800">{p.mode || 'Bank Transfer'}</td>
                      <td className="py-2.5 px-4 font-mono text-slate-500">{p.reference || '-'}</td>
                      <td className="py-2.5 px-4 text-right font-mono font-bold text-emerald-700">
                        {formatCurrency(p.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Footer Sign-off */}
        <div className="pt-8 border-t border-slate-200 flex justify-between items-end text-[11px] text-slate-400">
          <div>
            <p className="font-semibold text-slate-600">Verification & Audit Note</p>
            <p>Goods received in sound condition. Entered in stock registry.</p>
          </div>
          <div className="text-center">
            <div className="w-40 border-b border-slate-300 pb-1 mb-1 font-bold text-slate-700">
              Authorized Signatory
            </div>
            <p>{profile.businessName || 'RS Purchase'}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
