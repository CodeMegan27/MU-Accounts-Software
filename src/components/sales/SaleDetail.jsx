import React from 'react';
import { 
  ArrowLeft, 
  Printer, 
  FileSpreadsheet, 
  X, 
  CheckCircle2, 
  Clock, 
  Layers, 
  Phone, 
  MapPin, 
  Calendar, 
  Building2, 
  CreditCard,
  Tag,
  Palette,
  Edit3,
  Check,
  FileCheck,
  ShieldCheck,
  Sparkles
} from 'lucide-react';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { useSettings } from '../../context/SettingsContext';
import { useData } from '../../context/DataContext';
import { useToast } from '../../context/ToastContext';

export default function SaleDetail({ sale, onBack, onRecordPayment, onEditSale }) {
  const { profile } = useSettings();
  const { convertToSalesInvoice } = useData();
  const { showToast } = useToast();

  const isInvoice = Boolean(sale?.isInvoice && sale?.invoiceNo);

  const [isEditingInvNo, setIsEditingInvNo] = React.useState(false);
  const [invNoVal, setInvNoVal] = React.useState(sale?.invoiceNo || `INV-26-${sale?.estNo}`);

  const [showInvoiceModal, setShowInvoiceModal] = React.useState(false);
  const [modalInvNo, setModalInvNo] = React.useState(`INV-26-${sale?.estNo}`);
  const [modalInvDate, setModalInvDate] = React.useState(sale?.invDate || new Date().toISOString().substring(0, 10));

  if (!sale) return null;

  // Tax-Inclusive Calculations: Separate GST from Sales Amount
  const finalAmt = parseFloat(sale.finalAmount !== undefined ? sale.finalAmount : sale.subtotal) || 0;
  const rawGst = parseFloat(sale.gstAmount) || 0;
  const rate = parseFloat(sale.gstRate) || 18;
  const totalGst = rawGst > 0 ? rawGst : Math.round(((finalAmt * rate) / (100 + rate)) * 100) / 100;
  const taxableVal = Math.round((finalAmt - totalGst) * 100) / 100;
  const cgstVal = Math.round((totalGst / 2) * 100) / 100;
  const sgstVal = Math.round((totalGst - cgstVal) * 100) / 100;

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Action Bar (Hidden during print) */}
      <div className="no-print flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors w-fit"
        >
          <ArrowLeft className="w-4 h-4 text-brand-600" />
          <span>Back to Sales Register</span>
        </button>

        <div className="flex items-center gap-2 justify-end flex-wrap">
          {!isInvoice && (
            <button
              onClick={() => {
                setModalInvNo(`INV-26-${sale.estNo}`);
                setModalInvDate(sale.invDate || new Date().toISOString().substring(0, 10));
                setShowInvoiceModal(true);
              }}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold shadow-sm transition-all"
              title="Convert this Sales Order into a Tax Sales Invoice"
            >
              <FileCheck className="w-4 h-4 text-emerald-400" />
              <span>Convert to Tax Invoice</span>
            </button>
          )}

          {sale.balanceAmount > 0 && onRecordPayment && (
            <button
              onClick={() => onRecordPayment(sale)}
              className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all"
            >
              <CreditCard className="w-4 h-4" />
              <span>Record Payment</span>
            </button>
          )}

          {onEditSale && (
            <button
              onClick={() => onEditSale(sale)}
              className="flex items-center gap-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all"
              title="Edit this Sales Order / Invoice"
            >
              <Edit3 className="w-4 h-4" />
              <span>Edit {isInvoice ? 'Invoice' : 'Order'}</span>
            </button>
          )}

          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-5 py-2 bg-gradient-to-r from-red-600 to-blue-600 hover:from-red-700 hover:to-blue-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all"
          >
            <Printer className="w-4 h-4" />
            <span>Print {isInvoice ? 'Tax Invoice' : 'Order Bill'}</span>
          </button>
        </div>
      </div>

      {/* Official Composite Sales Bill Document */}
      <div id="sales-bill-printable" className="printable-document bg-white rounded-2xl sm:rounded-3xl border-2 border-slate-300 p-4 sm:p-8 lg:p-10 shadow-lg space-y-6 overflow-hidden relative">
        {/* Top Decorative Gradient Accent Bar */}
        <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-red-600 via-rose-500 to-blue-600" />

        {/* Header & Letterhead with RS DESIGNS Wings Logo */}
        <div className="border-b-2 border-slate-900 pb-5 space-y-4 pt-2">
          {/* Top Line: Logo + Company Info Left, Identification Card Right */}
          <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
            <div className="flex flex-col sm:flex-row items-start gap-3.5 w-full sm:w-auto">
              {/* High-Resolution RS DESIGNS Wings Logo */}
              <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-white border border-slate-200 p-1 flex items-center justify-center flex-shrink-0 shadow-sm overflow-hidden">
                <img 
                  src="/rs_designs_logo.jpg" 
                  alt="RS DESIGNS" 
                  className="w-full h-full object-contain"
                />
              </div>

              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-2xl sm:text-3xl font-black tracking-tight flex items-center gap-1.5">
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-600 via-rose-600 to-blue-700">
                      RS DESIGNS
                    </span>
                  </h1>
                  <span className="bg-red-50 text-red-700 border border-red-200 text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                    {sale.branch || 'KLK'} Branch
                  </span>
                </div>
                <p className="text-[11px] font-black text-slate-800 tracking-wide mt-0.5 uppercase">
                  {profile.tagline || 'CREATIVE DESIGNING • DIGITAL PRINTING • FLEX BANNER & PACKAGING'}
                </p>
                <p className="text-xs text-slate-600 mt-1 max-w-md">
                  {profile.address || 'Main Road, Ramanathapuram, Tamil Nadu - 623501'}
                </p>
                <div className="flex flex-wrap gap-3 text-xs font-semibold text-slate-700 mt-1.5">
                  <span className="bg-slate-100 px-2.5 py-0.5 rounded border border-slate-200 font-mono">
                    <strong>GSTIN:</strong> {profile.gstin || '33BLQPM9171A1ZA'}
                  </span>
                  {profile.phone && (
                    <span className="bg-slate-100 px-2 py-0.5 rounded border border-slate-200 font-mono">
                      <strong>Phone:</strong> {profile.phone}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Top Right: Invoice Details (for Sales Invoice) OR Sales Order Details */}
            <div className="sm:text-right bg-gradient-to-br from-slate-50 to-indigo-50/60 p-3.5 rounded-2xl border-2 border-indigo-200/80 min-w-[220px] shadow-xs">
              {isInvoice ? (
                <div className="space-y-1 text-xs">
                  <div>
                    <div className="flex items-center justify-between sm:justify-end gap-1.5">
                      <p className="text-[10px] uppercase font-black tracking-wider text-indigo-700">Tax Invoice No.</p>
                      {!isEditingInvNo && (
                        <button
                          type="button"
                          onClick={() => setIsEditingInvNo(true)}
                          className="no-print p-0.5 text-slate-400 hover:text-indigo-600 transition-colors"
                          title="Alter Invoice Number"
                        >
                          <Edit3 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                    {isEditingInvNo ? (
                      <div className="flex items-center gap-1 mt-1 justify-end">
                        <input
                          type="text"
                          value={invNoVal}
                          onChange={(e) => setInvNoVal(e.target.value)}
                          className="w-32 py-0.5 px-1.5 border border-indigo-400 rounded bg-white text-xs font-mono font-bold text-slate-900"
                          autoFocus
                        />
                        <button
                          type="button"
                          onClick={() => {
                            convertToSalesInvoice(sale.id, invNoVal, sale.invDate);
                            setIsEditingInvNo(false);
                            showToast('Invoice number updated', 'success');
                          }}
                          className="p-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded"
                          title="Save Invoice Number"
                        >
                          <Check className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setIsEditingInvNo(false)}
                          className="p-1 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded"
                          title="Cancel"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <p className="text-base font-black text-indigo-950 font-mono tracking-tight">
                        {sale.invoiceNo}
                      </p>
                    )}
                  </div>
                  <div className="border-t border-indigo-100 pt-1">
                    <p className="text-[10px] uppercase font-bold text-slate-500">Invoice Date</p>
                    <p className="text-xs font-extrabold text-emerald-800 font-mono">
                      {sale.invDate ? formatDate(sale.invDate) : (sale.paymentStatus === 'paid' ? formatDate(sale.orderDate) : 'Pending Settlement')}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-1 text-xs">
                  <div>
                    <p className="text-[10px] uppercase font-black tracking-wider text-slate-500">Sales Order / Est No.</p>
                    <p className="text-base font-black text-slate-950 font-mono tracking-tight">
                      #{sale.estNo || 'N/A'}
                    </p>
                  </div>
                  <div className="border-t border-slate-200 pt-1">
                    <p className="text-[10px] uppercase font-bold text-slate-500">Order Date</p>
                    <p className="text-xs font-bold text-slate-800 font-mono">
                      {formatDate(sale.orderDate)}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Centered Document Title Ribbon with Colors */}
          <div className="text-center py-2 px-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-xl shadow-xs print:bg-white print:text-black print:border-2 print:border-black print-banner-title">
            <span className="text-xs sm:text-sm font-black tracking-widest uppercase print:text-black">
              {isInvoice ? '★ OFFICIAL TAX SALES INVOICE ★' : '★ COMPOSITE SALES ORDER / ESTIMATE ★'}
            </span>
          </div>
        </div>

        {/* Customer & Order Reference Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-gradient-to-br from-slate-50 via-white to-blue-50/30 p-4 sm:p-5 rounded-2xl border border-slate-200 text-xs">
          <div>
            <div className="flex items-center gap-1.5 text-blue-900 font-bold uppercase text-[10px] tracking-wider mb-1">
              <span>Billed To / Customer Details</span>
            </div>
            <h3 className="text-base font-black text-slate-900">{sale.customerName || 'Walk-in Customer'}</h3>
            {sale.contact && (
              <p className="text-slate-700 flex items-center gap-1.5 mt-1 font-mono font-medium">
                <Phone className="w-3.5 h-3.5 text-blue-600" />
                <span>{sale.contact}</span>
              </p>
            )}
            {sale.address && (
              <p className="text-slate-600 flex items-center gap-1.5 mt-0.5">
                <MapPin className="w-3.5 h-3.5 text-slate-400" />
                <span>{sale.address}</span>
              </p>
            )}
          </div>

          <div className="sm:text-right flex flex-col justify-between">
            {isInvoice ? (
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-indigo-700 uppercase tracking-wider">Order Reference</p>
                <p className="text-xs font-bold text-slate-900">
                  Sales Order No: <span className="font-mono text-sm text-indigo-950 font-black">#{sale.estNo || 'N/A'}</span>
                </p>
                <p className="text-slate-600">
                  Order Date: <span className="font-mono font-bold text-slate-800">{formatDate(sale.orderDate)}</span>
                </p>
                {sale.orderFormNo && sale.orderFormNo !== 'NA' && (
                  <p className="text-[11px] text-slate-600 font-mono">
                    Designer Form: <strong className="text-slate-900 font-bold">{sale.orderFormNo}</strong>
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Order Assignment</p>
                <p className="text-xs font-bold text-slate-800">
                  Branch: <span className="font-semibold text-slate-700">{sale.branch} - {sale.department}</span>
                </p>
                <p className="text-slate-600">
                  Attender: <span className="font-semibold text-slate-800">{sale.attender || 'Staff'}</span>
                </p>
                {sale.orderFormNo && sale.orderFormNo !== 'NA' && (
                  <p className="text-[11px] text-slate-600 font-mono">
                    Designer Form: <strong className="text-slate-900 font-bold">{sale.orderFormNo}</strong>
                  </p>
                )}
              </div>
            )}

            <div className="mt-2 sm:mt-0">
              <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider ${
                sale.paymentStatus === 'paid'
                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                  : sale.paymentStatus === 'partial'
                  ? 'bg-blue-100 text-blue-800 border border-blue-300'
                  : 'bg-amber-100 text-amber-800 border border-amber-300'
              }`}>
                {sale.paymentStatus === 'paid' ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />}
                <span>{sale.paymentStatus ? sale.paymentStatus.toUpperCase() : 'PENDING'}</span>
              </span>
            </div>
          </div>
        </div>

        {/* Composite Line Items Table with Professional Corporate Styling */}
        <div className="overflow-x-auto border-2 border-slate-800 rounded-xl overflow-hidden shadow-xs">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white font-extrabold uppercase tracking-wider text-[11px] print:bg-slate-100 print:text-black print:border-b-2 print:border-black">
                <th className="px-3.5 py-3 w-10 text-center text-slate-300 print:text-black print:bg-slate-100 print:border print:border-slate-800">#</th>
                <th className="px-3.5 py-3 text-white print:text-black print:bg-slate-100 print:border print:border-slate-800">Product</th>
                <th className="px-3.5 py-3 text-white print:text-black print:bg-slate-100 print:border print:border-slate-800">Specifications & Description</th>
                <th className="px-3.5 py-3 text-center text-white print:text-black print:bg-slate-100 print:border print:border-slate-800">Size</th>
                <th className="px-3.5 py-3 text-center text-white print:text-black print:bg-slate-100 print:border print:border-slate-800">Qty</th>
                <th className="px-3.5 py-3 text-right text-white print:text-black print:bg-slate-100 print:border print:border-slate-800">Rate (₹)</th>
                <th className="px-3.5 py-3 text-right text-white print:text-black print:bg-slate-100 print:border print:border-slate-800">Amount (₹)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {sale.items && sale.items.length > 0 ? (
                sale.items.map((item, idx) => (
                  <tr key={item.id || idx} className="hover:bg-slate-50/80 even:bg-slate-50/40 transition-colors">
                    <td className="px-3.5 py-3 text-center font-bold text-slate-400">{idx + 1}</td>
                    <td className="px-3.5 py-3 font-black text-slate-900">{item.product}</td>
                    <td className="px-3.5 py-3 text-slate-700 font-medium">{item.description}</td>
                    <td className="px-3.5 py-3 text-center font-mono font-bold text-slate-700">{item.size || '-'}</td>
                    <td className="px-3.5 py-3 text-center font-black text-slate-900">{item.quantity}</td>
                    <td className="px-3.5 py-3 text-right font-mono font-medium text-slate-700">
                      {item.rate > 0 ? formatCurrency(item.rate) : '-'}
                    </td>
                    <td className="px-3.5 py-3 text-right font-black text-slate-950 font-mono text-sm">
                      {formatCurrency(item.amount)}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="7" className="text-center py-6 text-slate-400">
                    No items in this sales order.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Calculation & Tax Summary */}
        <div className="flex flex-col sm:flex-row justify-between items-start gap-6 pt-2">
          {/* Payment Receipts Breakdown */}
          <div className="w-full sm:w-1/2 space-y-2">
            <p className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <CreditCard className="w-3.5 h-3.5 text-indigo-600" />
              <span>Settlement & Payment Breakdown</span>
            </p>
            {sale.payments && sale.payments.length > 0 ? (
              <div className="border border-slate-200 rounded-xl overflow-hidden text-xs shadow-2xs">
                <table className="w-full text-left">
                  <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200 text-[11px] uppercase print:bg-slate-100 print:text-black">
                    <tr>
                      <th className="px-3.5 py-2 print:text-black print:bg-slate-100 print:border print:border-slate-800">Receipt Type</th>
                      <th className="px-3.5 py-2 print:text-black print:bg-slate-100 print:border print:border-slate-800">Account / Method</th>
                      <th className="px-3.5 py-2 text-right print:text-black print:bg-slate-100 print:border print:border-slate-800">Amount (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {sale.payments.map((p, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/50">
                        <td className="px-3.5 py-2 text-slate-700">{p.type}</td>
                        <td className="px-3.5 py-2 font-bold text-slate-900">{p.method}</td>
                        <td className="px-3.5 py-2 text-right font-bold text-emerald-700 font-mono">
                          {formatCurrency(p.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-xs text-slate-400 italic">No payments logged yet.</p>
            )}
          </div>

          {/* Grand Totals Box with Separated Tax Breakdown */}
          <div className="w-full sm:w-80 bg-slate-50 p-4 rounded-2xl border-2 border-slate-200 space-y-2.5 text-xs shadow-xs">
            <div className="flex justify-between text-slate-600 font-medium">
              <span>Gross Order Subtotal:</span>
              <span className="font-mono font-bold">{formatCurrency(sale.subtotal)}</span>
            </div>
            {parseFloat(sale.discount) > 0 && (
              <div className="flex justify-between text-rose-600 font-semibold">
                <span>Discount / Rebate:</span>
                <span className="font-mono font-bold">- {formatCurrency(sale.discount)}</span>
              </div>
            )}

            {/* Separated Tax Breakdown (18% GST Separated from Inclusive Amount) */}
            <div className="bg-white p-3 rounded-xl border border-indigo-200 space-y-1.5 text-[11px] my-1 shadow-2xs">
              <div className="flex justify-between text-slate-600">
                <span>Taxable Value (Net):</span>
                <span className="font-mono font-bold text-slate-900">{formatCurrency(taxableVal)}</span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>CGST ({(rate / 2).toFixed(1)}%):</span>
                <span className="font-mono">{formatCurrency(cgstVal)}</span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>SGST ({(rate / 2).toFixed(1)}%):</span>
                <span className="font-mono">{formatCurrency(sgstVal)}</span>
              </div>
              <div className="flex justify-between text-indigo-900 font-black border-t border-indigo-100 pt-1.5">
                <span>Total 18% GST Included:</span>
                <span className="font-mono text-indigo-700">{formatCurrency(totalGst)}</span>
              </div>
            </div>

            {/* Final Bill Amount Accent Box */}
            <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white p-3 rounded-xl flex justify-between items-center shadow-xs print:bg-slate-100 print:text-black print:border-2 print:border-black">
              <div>
                <span className="text-xs font-black uppercase tracking-wider text-slate-200 print:text-black">Final Bill Amount</span>
                <p className="text-[10px] text-emerald-400 font-medium italic print:text-slate-600">(Inclusive of all taxes)</p>
              </div>
              <span className="text-xl font-black font-mono text-emerald-400 print:text-black">{formatCurrency(finalAmt)}</span>
            </div>

            <div className="border-t border-slate-200 pt-2 space-y-1">
              <div className="flex justify-between text-emerald-700 font-black">
                <span>Total Received:</span>
                <span className="font-mono text-sm">{formatCurrency(sale.paidAmount)}</span>
              </div>
              <div className="flex justify-between text-rose-700 font-black">
                <span>Balance Due:</span>
                <span className="font-mono text-sm">{formatCurrency(sale.balanceAmount)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Metadata Section */}
        <div className="border-t-2 border-dashed border-slate-300 pt-4 mt-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs">
            <div>
              <p className="text-[10px] font-bold text-slate-500 uppercase">Designer Order Form No.</p>
              <p className="text-xs font-black text-slate-900 font-mono mt-0.5">{sale.orderFormNo || 'NA'}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-500 uppercase">Customer Segment</p>
              <p className="text-xs font-bold text-indigo-700 mt-0.5">{sale.customerSegment || 'Standard'}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-500 uppercase">Segment Type</p>
              <p className="text-xs font-bold text-slate-800 mt-0.5">{sale.segmentType || 'General'}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-500 uppercase">Branch & Attender</p>
              <p className="text-xs font-bold text-slate-800 mt-0.5">
                {sale.branch} - {sale.attender || 'Staff'}
              </p>
            </div>
          </div>
        </div>

        {/* Terms & Authorized Signature with RS DESIGNS Company Stamp */}
        <div className="flex flex-col sm:flex-row justify-between items-end gap-6 pt-6 text-xs text-slate-500">
          <div className="max-w-xs space-y-1">
            <p className="font-black text-slate-800 uppercase tracking-wider text-[11px]">Notice & Terms:</p>
            <p className="text-[11px] leading-relaxed">
              1. This is a composite order for goods & related printing/finishing services.
            </p>
            <p className="text-[11px] leading-relaxed">
              2. Goods once printed and delivered cannot be returned or cancelled.
            </p>
          </div>
          <div className="text-center sm:text-right space-y-1">
            <p className="text-xs font-black text-slate-900 uppercase tracking-wider">For RS DESIGNS</p>
            <div className="h-14"></div>
            <p className="border-t-2 border-slate-800 pt-1 font-black text-slate-800 w-48 text-center sm:ml-auto uppercase text-[11px] tracking-wider">
              Authorized Signatory
            </p>
          </div>
        </div>
      </div>

      {/* Convert to Sales Invoice Modal for Sales Orders */}
      {showInvoiceModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                <FileCheck className="w-4 h-4 text-emerald-600" />
                <span>Convert to Official Tax Sales Invoice</span>
              </h3>
              <button onClick={() => setShowInvoiceModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                convertToSalesInvoice(sale.id, modalInvNo, modalInvDate);
                showToast(`Sales Invoice ${modalInvNo} generated!`, 'success');
                setShowInvoiceModal(false);
              }}
              className="mt-4 space-y-4 text-xs"
            >
              <div>
                <p className="text-slate-500">Sales Order / Estimate:</p>
                <p className="font-bold text-slate-900 text-sm">#{sale.estNo} - {sale.customerName}</p>
                <p className="text-slate-500 text-[11px] mt-0.5">Order Date: {formatDate(sale.orderDate)}</p>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Invoice Number (Alterable)</label>
                <input
                  type="text"
                  value={modalInvNo}
                  onChange={(e) => setModalInvNo(e.target.value)}
                  placeholder="e.g. INV-26-0001"
                  className="w-full py-2 px-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 font-mono text-sm font-bold"
                  required
                />
                <p className="text-[10px] text-slate-400 mt-1">This will be shown at the top-right of the tax sales invoice.</p>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Invoice Date (Payment Clearance Date)</label>
                <input
                  type="date"
                  value={modalInvDate}
                  onChange={(e) => setModalInvDate(e.target.value)}
                  className="w-full py-2 px-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 font-mono text-sm"
                  required
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowInvoiceModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold shadow-sm"
                >
                  Generate Tax Invoice
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
