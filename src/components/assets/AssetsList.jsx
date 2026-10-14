import React, { useState, useMemo } from 'react';
import { useData } from '../../context/DataContext';
import { useAuth } from '../../context/AuthContext';
import { formatCurrency, formatDate } from '../../utils/formatters';
import * as XLSX from 'xlsx';
import { 
  Building, 
  Plus, 
  Search, 
  Trash2, 
  Edit2, 
  MapPin, 
  CreditCard, 
  FileSpreadsheet, 
  Receipt, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  ShieldCheck,
  Layers,
  ArrowDownLeft
} from 'lucide-react';
import AssetPaymentModal from './AssetPaymentModal';

export default function AssetsList({ onOpenCreateAsset, onEditAsset, onRequestDelete }) {
  const { assets } = useData();
  const { isAdmin } = useAuth();

  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [selectedPaymentStatus, setSelectedPaymentStatus] = useState('ALL');
  const [paymentModalAsset, setPaymentModalAsset] = useState(null);

  // Filtered Assets
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return assets.filter(a => {
      if (selectedCategory !== 'ALL' && a.category !== selectedCategory) return false;
      const pStatus = a.paymentStatus || (a.balanceAmount <= 0.01 ? 'paid' : (a.paidAmount > 0 ? 'partial' : 'unpaid'));
      if (selectedPaymentStatus !== 'ALL' && pStatus !== selectedPaymentStatus) return false;

      if (!search) return true;
      return (
        (a.name && a.name.toLowerCase().includes(q)) ||
        (a.vendorName && a.vendorName.toLowerCase().includes(q)) ||
        (a.invoiceNo && a.invoiceNo.toLowerCase().includes(q)) ||
        (a.voucherNo && a.voucherNo.toLowerCase().includes(q)) ||
        (a.category && a.category.toLowerCase().includes(q)) ||
        (a.location && a.location.toLowerCase().includes(q)) ||
        (a.vendorGstin && a.vendorGstin.toLowerCase().includes(q))
      );
    });
  }, [assets, search, selectedCategory, selectedPaymentStatus]);

  // Financial KPIs
  const kpis = useMemo(() => {
    let totalTaxable = 0;
    let totalTax = 0;
    let totalGrand = 0;
    let totalPaid = 0;
    let totalBalance = 0;

    filtered.forEach(a => {
      const taxBase = parseFloat(a.taxableAmount !== undefined ? a.taxableAmount : (a.value || a.rate || 0)) || 0;
      const tax = parseFloat(a.totalTax !== undefined ? a.totalTax : a.taxAmount) || 0;
      const grand = parseFloat(a.grandTotal !== undefined ? a.grandTotal : (taxBase + tax)) || taxBase;
      const paid = parseFloat(a.paidAmount) || 0;
      const bal = a.balanceAmount !== undefined ? parseFloat(a.balanceAmount) : Math.max(0, grand - paid);

      totalTaxable += taxBase;
      totalTax += tax;
      totalGrand += grand;
      totalPaid += paid;
      totalBalance += bal;
    });

    return {
      totalTaxable,
      totalTax,
      totalGrand,
      totalPaid,
      totalBalance
    };
  }, [filtered]);

  // Export Assets to Excel
  const handleExportExcel = () => {
    if (filtered.length === 0) return;
    const rows = filtered.map(a => {
      const taxBase = parseFloat(a.taxableAmount !== undefined ? a.taxableAmount : (a.value || 0)) || 0;
      const tax = parseFloat(a.totalTax !== undefined ? a.totalTax : a.taxAmount) || 0;
      const grand = parseFloat(a.grandTotal !== undefined ? a.grandTotal : (taxBase + tax)) || taxBase;
      const paid = parseFloat(a.paidAmount) || 0;
      const bal = a.balanceAmount !== undefined ? parseFloat(a.balanceAmount) : Math.max(0, grand - paid);
      const pStatus = a.paymentStatus || (bal <= 0.01 ? 'paid' : (paid > 0 ? 'partial' : 'unpaid'));

      return {
        "Voucher No": a.voucherNo || a.id,
        "Invoice No": a.invoiceNo || 'N/A',
        "Invoice Date": a.date || '',
        "Supplier / Vendor": a.vendorName || '',
        "Vendor GSTIN": a.vendorGstin || '',
        "Asset Description": a.name || '',
        "Category": a.category || '',
        "Location / Department": a.location || a.department || '',
        "HSN Code": a.hsn || '',
        "Taxable Value (₹)": taxBase,
        "Transport Charges (₹)": a.transportCharges || 0,
        "GST Rate (%)": a.isGst ? (a.taxRate || 18) : 0,
        "CGST (₹)": a.cgst || 0,
        "SGST (₹)": a.sgst || 0,
        "IGST (₹)": a.igst || 0,
        "Total GST ITC (₹)": tax,
        "Round Off (₹)": a.roundOff || 0,
        "Grand Total Bill (₹)": grand,
        "Paid Amount (₹)": paid,
        "Balance Due (₹)": bal,
        "Payment Status": pStatus.toUpperCase(),
        "ITC Eligibility": a.itcEligibility || 'Inputs Capital Goods'
      };
    });

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, "Capital_Assets");
    XLSX.writeFile(wb, `Fixed_Assets_GST_Register_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-20">
      {/* Top Banner & Actions */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">Fixed Asset & Capital Goods Registry</h2>
            <span className="px-2 py-0.5 bg-purple-100 text-purple-800 text-[10px] font-extrabold uppercase rounded-full">
              GST Bill & GSTR-2B
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage capital investments, vendor GST bills, input tax credit, and payment settlements
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportExcel}
            className="flex items-center gap-1.5 px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-bold transition-all"
            title="Export Assets to Excel"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" /> Export Excel
          </button>
          <button
            onClick={onOpenCreateAsset}
            className="flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-brand-500/20"
          >
            <Plus className="w-4 h-4" /> Add Asset GST Bill
          </button>
        </div>
      </div>

      {/* KPI Cards Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Gross Capital Base</p>
            <Layers className="w-4 h-4 text-slate-400" />
          </div>
          <p className="text-lg sm:text-xl font-black text-slate-900 mt-1">{formatCurrency(kpis.totalTaxable)}</p>
          <p className="text-[11px] text-slate-500 font-medium mt-0.5">{filtered.length} Asset Vouchers</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">GSTR-2B Capital ITC</p>
            <ArrowDownLeft className="w-4 h-4 text-purple-600" />
          </div>
          <p className="text-lg sm:text-xl font-black text-purple-700 mt-1">{formatCurrency(kpis.totalTax)}</p>
          <p className="text-[11px] text-slate-500 font-medium mt-0.5">Table 4(A)(5) Eligible Credit</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Settled / Paid</p>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-lg sm:text-xl font-black text-emerald-700 mt-1">{formatCurrency(kpis.totalPaid)}</p>
          <p className="text-[11px] text-slate-500 font-medium mt-0.5">Disbursed to Suppliers</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Balance Due to Vendors</p>
            <Clock className="w-4 h-4 text-rose-600" />
          </div>
          <p className="text-lg sm:text-xl font-black text-rose-600 mt-1">{formatCurrency(kpis.totalBalance)}</p>
          <p className="text-[11px] text-slate-500 font-medium mt-0.5">Reflected in Vendor Ledgers</p>
        </div>
      </div>

      {/* Search & Filter Strip */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 text-xs">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by asset name, supplier, invoice #, GSTIN, location..."
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-1 focus:ring-brand-500 font-medium"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-700 focus:outline-none"
          >
            <option value="ALL">All Categories</option>
            <option value="Machinery & Equipment">Machinery & Equipment</option>
            <option value="Computers & Electronics">Computers & Electronics</option>
            <option value="Furniture & Fixtures">Furniture & Fixtures</option>
            <option value="Vehicles">Vehicles</option>
            <option value="Building & Improvements">Building & Improvements</option>
            <option value="Office Equipment">Office Equipment</option>
          </select>

          <select
            value={selectedPaymentStatus}
            onChange={(e) => setSelectedPaymentStatus(e.target.value)}
            className="py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-700 focus:outline-none"
          >
            <option value="ALL">All Payments</option>
            <option value="paid">Paid in Full</option>
            <option value="partial">Partial Balance</option>
            <option value="unpaid">Unpaid / Credit</option>
          </select>
        </div>
      </div>

      {/* Main Asset GST Bills Table */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse whitespace-nowrap text-xs">
            <thead>
              <tr className="bg-slate-50 text-slate-500 border-b border-slate-200 uppercase font-bold tracking-wider">
                <th className="px-5 py-3.5">Asset & Location</th>
                <th className="px-5 py-3.5">Supplier / Invoice</th>
                <th className="px-5 py-3.5">Category</th>
                <th className="px-5 py-3.5 text-right">Taxable (₹)</th>
                <th className="px-5 py-3.5 text-right">GST ITC (₹)</th>
                <th className="px-5 py-3.5 text-right">Grand Total (₹)</th>
                <th className="px-5 py-3.5 text-center">Payment Status</th>
                <th className="px-5 py-3.5 text-center w-28">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan="8" className="text-center py-12 text-slate-400">
                    <Building className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                    <p className="text-base font-bold text-slate-700">No fixed asset GST bills found</p>
                    <p className="text-xs text-slate-400 mt-1">Record machinery, equipment, and capital purchases with GSTIN</p>
                  </td>
                </tr>
              ) : (
                filtered.map(asset => {
                  const taxBase = parseFloat(asset.taxableAmount !== undefined ? asset.taxableAmount : (asset.value || 0)) || 0;
                  const tax = parseFloat(asset.totalTax !== undefined ? asset.totalTax : asset.taxAmount) || 0;
                  const grand = parseFloat(asset.grandTotal !== undefined ? asset.grandTotal : (taxBase + tax)) || taxBase;
                  const paid = parseFloat(asset.paidAmount) || 0;
                  const bal = asset.balanceAmount !== undefined ? parseFloat(asset.balanceAmount) : Math.max(0, grand - paid);
                  const pStatus = asset.paymentStatus || (bal <= 0.01 ? 'paid' : (paid > 0 ? 'partial' : 'unpaid'));

                  return (
                    <tr key={asset.id} className="hover:bg-slate-50/80 transition-colors">
                      {/* Asset & Location */}
                      <td className="px-5 py-3.5">
                        <div className="font-bold text-slate-900 text-xs">{asset.name || 'N/A'}</div>
                        <div className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                          <MapPin className="w-3 h-3 text-slate-400" />
                          <span>{asset.location || asset.department || 'Main Plant'}</span>
                          <span className="text-slate-300">•</span>
                          <span className="font-mono text-[10px] text-slate-500">{asset.voucherNo || ''}</span>
                        </div>
                      </td>

                      {/* Supplier & Invoice */}
                      <td className="px-5 py-3.5">
                        <div className="font-semibold text-slate-800 truncate max-w-[190px]">
                          {asset.vendorName || 'Direct Purchase'}
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          {asset.invoiceNo ? (
                            <span className="font-mono text-[10px] font-bold text-slate-600 bg-slate-100 px-1.5 py-0.2 rounded">
                              Inv #{asset.invoiceNo}
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-400">No Invoice #</span>
                          )}
                          {asset.vendorGstin && (
                            <span className="font-mono text-[10px] text-purple-700 font-bold bg-purple-50 px-1.5 py-0.2 rounded border border-purple-200">
                              GSTIN
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Category */}
                      <td className="px-5 py-3.5 text-slate-600 font-medium">
                        {asset.category || 'Machinery'}
                      </td>

                      {/* Taxable Value */}
                      <td className="px-5 py-3.5 text-right font-mono font-medium text-slate-800">
                        {formatCurrency(taxBase)}
                      </td>

                      {/* GST ITC Amount */}
                      <td className="px-5 py-3.5 text-right font-mono">
                        {asset.isGst && tax > 0 ? (
                          <div>
                            <span className="font-bold text-purple-700">{formatCurrency(tax)}</span>
                            <span className="text-[10px] text-slate-400 block">({asset.taxRate || 18}%)</span>
                          </div>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>

                      {/* Grand Total */}
                      <td className="px-5 py-3.5 text-right font-mono font-black text-slate-900">
                        {formatCurrency(grand)}
                      </td>

                      {/* Payment Status & Balance */}
                      <td className="px-5 py-3.5 text-center">
                        <div className="flex flex-col items-center gap-1">
                          {pStatus === 'paid' ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-emerald-100 text-emerald-800">
                              Full Paid
                            </span>
                          ) : pStatus === 'partial' ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-amber-100 text-amber-800">
                              Partial (Bal: {formatCurrency(bal)})
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-rose-100 text-rose-800">
                              Unpaid (Bal: {formatCurrency(bal)})
                            </span>
                          )}
                          {bal > 0 && isAdmin && (
                            <button
                              onClick={() => setPaymentModalAsset(asset)}
                              className="text-[10px] font-bold text-brand-700 hover:text-brand-900 flex items-center gap-1 hover:underline"
                            >
                              <CreditCard className="w-3 h-3" /> Pay Now
                            </button>
                          )}
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-3.5 text-center">
                        {isAdmin && (
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => onEditAsset(asset)}
                              className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                              title="Edit Asset GST Bill"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => onRequestDelete('assets', asset.id, asset.name)}
                              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="Delete Asset"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Asset Payment Modal */}
      {paymentModalAsset && (
        <AssetPaymentModal
          asset={paymentModalAsset}
          isOpen={Boolean(paymentModalAsset)}
          onClose={() => setPaymentModalAsset(null)}
        />
      )}
    </div>
  );
}
