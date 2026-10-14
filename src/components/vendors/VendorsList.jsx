import React, { useState, useMemo } from 'react';
import { useData } from '../../context/DataContext';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { formatCurrency } from '../../utils/formatters';
import { exportVendorsToExcel, exportAllVendorLedgersMultiSheet } from '../../utils/exportUtils';
import { 
  Users, 
  Search, 
  Plus, 
  FileSpreadsheet, 
  BookOpen, 
  Edit2, 
  Trash2, 
  MapPin, 
  Phone, 
  CheckCircle2
} from 'lucide-react';

export default function VendorsList({ onOpenCreateVendor, onEditVendor, onOpenLedger, onRequestDelete }) {
  const { vendors, bills, expenses, assets } = useData();
  const { isAdmin, tierConfig, isDeveloper } = useAuth();
  const { showToast } = useToast();
  const [search, setSearch] = useState('');

  // Calculate Vendor Spend & Outstanding dynamically from bills, expenses, AND asset GST bills
  const vendorStats = useMemo(() => {
    const map = {};

    // 1. Accumulate from Purchase Bills
    bills.forEach(bill => {
      const vId = bill.vendorId || bill.vendorName;
      if (!vId) return;
      if (!map[vId]) {
        map[vId] = { totalBilled: 0, totalPaid: 0, balance: 0, billsCount: 0 };
      }
      const gTotal = parseFloat(bill.grandTotal) || 0;
      const pAmt = parseFloat(bill.paidAmount) || 0;
      const bal = bill.balanceAmount !== undefined ? parseFloat(bill.balanceAmount) : (gTotal - pAmt);
      map[vId].totalBilled += gTotal;
      map[vId].totalPaid += pAmt;
      map[vId].balance += (bal > 0 ? bal : 0);
      map[vId].billsCount += 1;
    });

    // 2. Accumulate from Expense Vouchers where payee/vendor matches
    (expenses || []).forEach(exp => {
      const party = (exp.payee || exp.vendorName || '').trim();
      if (!party) return;

      // Find matching vendor by name or ID
      const matchedVendor = (vendors || []).find(v => 
        (v.name && v.name.trim().toLowerCase() === party.toLowerCase()) ||
        (v.id && exp.vendorId && v.id === exp.vendorId)
      );

      const targetKey = matchedVendor ? matchedVendor.id : party;
      if (!map[targetKey]) {
        map[targetKey] = { totalBilled: 0, totalPaid: 0, balance: 0, billsCount: 0 };
      }

      const amt = parseFloat(exp.amount) || 0;
      map[targetKey].totalBilled += amt;
      map[targetKey].totalPaid += amt; // Expenses are paid vouchers
      map[targetKey].billsCount += 1;
    });

    // 3. Accumulate from Asset GST Bills
    (assets || []).forEach(ast => {
      const vKey = ast.vendorId || ast.vendorName;
      if (!vKey) return;

      // Find matching vendor by ID or name
      const matchedVendor = (vendors || []).find(v => 
        (v.id && ast.vendorId && v.id === ast.vendorId) ||
        (v.name && ast.vendorName && v.name.trim().toLowerCase() === ast.vendorName.trim().toLowerCase())
      );

      const targetKey = matchedVendor ? matchedVendor.id : vKey;
      if (!map[targetKey]) {
        map[targetKey] = { totalBilled: 0, totalPaid: 0, balance: 0, billsCount: 0 };
      }

      const gTotal = parseFloat(ast.grandTotal !== undefined ? ast.grandTotal : ast.value) || 0;
      const pAmt = parseFloat(ast.paidAmount) || 0;
      const bal = ast.balanceAmount !== undefined ? parseFloat(ast.balanceAmount) : Math.max(0, gTotal - pAmt);

      map[targetKey].totalBilled += gTotal;
      map[targetKey].totalPaid += pAmt;
      map[targetKey].balance += (bal > 0 ? bal : 0);
      map[targetKey].billsCount += 1;
    });

    return map;
  }, [bills, expenses, assets, vendors]);

  const filteredVendors = useMemo(() => {
    const q = search.toLowerCase();
    return vendors.filter(v => 
      !search ||
      (v.name && v.name.toLowerCase().includes(q)) ||
      (v.gstin && v.gstin.toLowerCase().includes(q)) ||
      (v.address && v.address.toLowerCase().includes(q))
    );
  }, [vendors, search]);

  const handleExport = () => {
    if (vendors.length === 0) {
      showToast('No vendors to export', 'error');
      return;
    }
    const ok = exportVendorsToExcel(vendors);
    if (ok) showToast('Vendors directory exported to Excel', 'success');
  };

  const handleExportMultiSheetLedger = () => {
    if (vendors.length === 0) {
      showToast('No vendors available to generate ledger workbook', 'error');
      return;
    }
    const ok = exportAllVendorLedgersMultiSheet(vendors, bills, expenses);
    if (ok) {
      showToast(`Multi-Sheet Ledger Workbook exported (${vendors.length} vendor sheets)`, 'success');
    }
  };

  const handleAddVendorClick = () => {
    const maxV = tierConfig?.maxVendors || 20;
    if (vendors.length >= maxV) {
      showToast(`Vendor limit reached (${vendors.length}/${maxV}) on ${tierConfig?.name || 'current tier'}. Upgrade in Profile Settings to register more suppliers.`, 'warning');
      return;
    }
    onOpenCreateVendor();
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">Vendor Register & Directory</h2>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-50 text-blue-700 border border-blue-200">
              {vendors.length} / {tierConfig?.maxVendors >= 9000 ? '∞' : tierConfig?.maxVendors || 20} ({tierConfig?.badge || 'Plan'})
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">Manage suppliers, GST compliance, and review account statements</p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
          <button
            onClick={handleExportMultiSheetLedger}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-3.5 py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-xl text-xs font-semibold transition-colors shadow-sm cursor-pointer"
            title="Export complete master ledger with each vendor in their own sheet"
          >
            <BookOpen className="w-4 h-4 text-emerald-600" /> All Ledgers (Multi-Sheet Excel)
          </button>
          <button
            onClick={handleExport}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors border border-slate-200 shadow-sm cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4 text-slate-600" /> Export Directory
          </button>
          <button
            onClick={handleAddVendorClick}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-semibold transition-all shadow-md hover:shadow-lg cursor-pointer"
          >
            <Plus className="w-4 h-4" /> Add Vendor
          </button>
        </div>
      </div>

      {/* Search Toolbar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search vendor by name, GSTIN, or city..."
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </div>
      </div>

      {/* Vendors Table */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse whitespace-nowrap">
            <thead>
              <tr className="bg-slate-50 text-slate-500 border-b border-slate-200 text-xs uppercase font-semibold tracking-wider">
                <th className="px-6 py-4">Vendor Name</th>
                <th className="px-6 py-4">GST Status</th>
                <th className="px-6 py-4">GSTIN</th>
                <th className="px-6 py-4">Location / Address</th>
                <th className="px-6 py-4 text-right">Total Billed</th>
                <th className="px-6 py-4 text-right">Net Payable</th>
                <th className="px-6 py-4 text-center w-28">Actions</th>
              </tr>
            </thead>
            <tbody className="text-sm divide-y divide-slate-100 text-slate-700">
              {filteredVendors.length === 0 ? (
                <tr>
                  <td colSpan="7" className="text-center py-12 text-slate-400">
                    <p className="text-base font-semibold text-slate-700">No vendors found</p>
                    <p className="text-xs text-slate-400 mt-1">Add your suppliers to maintain purchase bills and ledgers</p>
                  </td>
                </tr>
              ) : (
                filteredVendors.map(v => {
                  const stat = vendorStats[v.id] || vendorStats[v.name] || { totalBilled: 0, balance: 0, billsCount: 0 };
                  return (
                    <tr key={v.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-bold text-slate-900">{v.name || 'N/A'}</div>
                        {v.phone && (
                          <div className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                            <Phone className="w-3 h-3" /> {v.phone}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                          v.gstStatus === 'GST'
                            ? 'bg-brand-100 text-brand-700'
                            : 'bg-slate-100 text-slate-600'
                        }`}>
                          {v.gstStatus === 'GST' ? 'GST REGISTERED' : 'UNREGISTERED'}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-mono text-xs font-semibold text-slate-600">
                        {v.gstin || '-'}
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-500 max-w-xs truncate">
                        {v.address || '-'}
                      </td>
                      <td className="px-6 py-4 text-right font-mono font-bold text-slate-900">
                        {formatCurrency(stat.totalBilled)}
                      </td>
                      <td className="px-6 py-4 text-right font-mono font-bold text-amber-600">
                        {formatCurrency(stat.balance)}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => onOpenLedger(v)}
                            className="flex items-center gap-1 px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors"
                            title="Statement of Account"
                          >
                            <BookOpen className="w-3.5 h-3.5 text-brand-600" /> Ledger
                          </button>
                          {isAdmin && (
                            <>
                              <button
                                onClick={() => onEditVendor(v)}
                                className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                                title="Edit Vendor"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => onRequestDelete('vendors', v.id, `Vendor ${v.name}`)}
                                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                title="Delete Vendor"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
