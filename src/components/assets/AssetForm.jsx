import React, { useState, useEffect, useMemo } from 'react';
import { useData } from '../../context/DataContext';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { formatCurrency, getTodayDate } from '../../utils/formatters';
import { isInterStateSupply } from '../../utils/gstCalculations';
import { 
  ArrowLeft, 
  Check, 
  Building2, 
  Lock, 
  Receipt, 
  CreditCard, 
  ShieldCheck, 
  Calculator, 
  UserPlus, 
  Sparkles,
  Info,
  Truck,
  RotateCcw
} from 'lucide-react';

export default function AssetForm({ asset, onBack }) {
  const { 
    saveAsset, 
    vendors, 
    branches, 
    departments, 
    paymentMethods 
  } = useData();
  const { isAdmin, openLoginModal } = useAuth();
  const { showToast } = useToast();

  const isEditing = Boolean(asset);

  // Form State
  const [name, setName] = useState('');
  const [category, setCategory] = useState('Machinery & Equipment');
  const [invoiceNo, setInvoiceNo] = useState('');
  const [date, setDate] = useState(getTodayDate());
  const [branch, setBranch] = useState('KLK');
  const [department, setDepartment] = useState('OFFSET');
  const [location, setLocation] = useState('');

  // Vendor Details
  const [vendorId, setVendorId] = useState('');
  const [vendorName, setVendorName] = useState('');
  const [vendorGstin, setVendorGstin] = useState('');
  const [isInterState, setIsInterState] = useState(false);

  // Capital Goods Itemization
  const [hsn, setHsn] = useState('8443');
  const [qty, setQty] = useState(1);
  const [uqc, setUqc] = useState('NOS');
  const [taxableAmount, setTaxableAmount] = useState('');
  const [transportCharges, setTransportCharges] = useState('');
  const [gstOnTransport, setGstOnTransport] = useState(true);
  const [discount, setDiscount] = useState('');
  const [isRoundOff, setIsRoundOff] = useState(true);

  // GST & Tax Options
  const [isGst, setIsGst] = useState(true);
  const [taxType, setTaxType] = useState('exclusive'); // 'exclusive' | 'inclusive'
  const [taxRate, setTaxRate] = useState(18);
  const [itcEligibility, setItcEligibility] = useState('Inputs Capital Goods');

  // Payment Settlement
  const [paymentOption, setPaymentOption] = useState('paid'); // 'paid' | 'partial' | 'unpaid'
  const [paidAmount, setPaidAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('BANK TRANSFER');
  const [paymentRef, setPaymentRef] = useState('');
  const [syncToDaybook, setSyncToDaybook] = useState(true);
  const [notes, setNotes] = useState('');

  const [isSaving, setIsSaving] = useState(false);

  // Initialize or populate from existing asset
  useEffect(() => {
    if (asset) {
      setName(asset.name || '');
      setCategory(asset.category || 'Machinery & Equipment');
      setInvoiceNo(asset.invoiceNo || '');
      setDate(asset.date || getTodayDate());
      setBranch(asset.branch || 'KLK');
      setDepartment(asset.department || 'OFFSET');
      setLocation(asset.location || '');

      setVendorId(asset.vendorId || '');
      setVendorName(asset.vendorName || '');
      setVendorGstin(asset.vendorGstin || '');
      setIsInterState(Boolean(asset.isInterState));

      setHsn(asset.hsn || '8443');
      setQty(asset.qty || 1);
      setUqc(asset.uqc || 'NOS');
      setTaxableAmount(asset.baseCost !== undefined ? String(asset.baseCost) : (asset.taxableAmount !== undefined ? String(asset.taxableAmount) : (asset.value ? String(asset.value) : '')));
      setTransportCharges(asset.transportCharges !== undefined && asset.transportCharges !== null ? String(asset.transportCharges) : '');
      setGstOnTransport(asset.gstOnTransport !== undefined ? Boolean(asset.gstOnTransport) : true);
      setDiscount(asset.discount !== undefined && asset.discount !== null ? String(asset.discount) : '');
      setIsRoundOff(asset.isRoundOff !== undefined ? Boolean(asset.isRoundOff) : true);

      setIsGst(asset.isGst !== undefined ? Boolean(asset.isGst) : true);
      setTaxType(asset.taxType || 'exclusive');
      setTaxRate(asset.taxRate !== undefined ? asset.taxRate : 18);
      setItcEligibility(asset.itcEligibility || 'Inputs Capital Goods');

      const pStatus = asset.paymentStatus || (asset.balanceAmount <= 0.01 ? 'paid' : (asset.paidAmount > 0 ? 'partial' : 'unpaid'));
      setPaymentOption(pStatus);
      setPaidAmount(asset.paidAmount !== undefined ? String(asset.paidAmount) : '');
      setPaymentMethod(asset.paymentMethod || 'BANK TRANSFER');
      setPaymentRef('');
      setNotes(asset.notes || '');
    } else {
      setName('');
      setCategory('Machinery & Equipment');
      setInvoiceNo('');
      setDate(getTodayDate());
      setBranch(branches[0] || 'KLK');
      setDepartment(departments[0] || 'OFFSET');
      setLocation('');

      setVendorId('');
      setVendorName('');
      setVendorGstin('');
      setIsInterState(false);

      setHsn('8443');
      setQty(1);
      setUqc('NOS');
      setTaxableAmount('');
      setTransportCharges('');
      setGstOnTransport(true);
      setDiscount('');
      setIsRoundOff(true);

      setIsGst(true);
      setTaxType('exclusive');
      setTaxRate(18);
      setItcEligibility('Inputs Capital Goods');

      setPaymentOption('paid');
      setPaidAmount('');
      setPaymentMethod(paymentMethods[0] || 'BANK TRANSFER');
      setPaymentRef('');
      setSyncToDaybook(true);
      setNotes('');
    }
  }, [asset, branches, departments, paymentMethods]);

  // Handle Vendor Selection from Registered Vendors Dropdown
  const handleSelectVendor = (vId) => {
    setVendorId(vId);
    if (!vId) {
      return;
    }
    const found = vendors.find(v => v.id === vId);
    if (found) {
      setVendorName(found.name || '');
      const g = (found.gstin || '').trim().toUpperCase();
      setVendorGstin(g);
      if (g) {
        setIsGst(true);
        // Interstate check against Tamil Nadu (33)
        const interState = isInterStateSupply('33', g);
        setIsInterState(interState);
      }
    }
  };

  // Live GST Tax, Transport & Round-Off Calculations
  const calculations = useMemo(() => {
    const rawVal = parseFloat(taxableAmount) || 0;
    const transportVal = parseFloat(transportCharges) || 0;
    const discountVal = parseFloat(discount) || 0;
    const rate = isGst ? (parseFloat(taxRate) || 0) : 0;

    let baseAsset = rawVal;
    let netTaxable = 0;

    if (isGst && rate > 0) {
      if (taxType === 'inclusive') {
        const totalGross = Math.max(0, rawVal + (gstOnTransport ? transportVal : 0) - discountVal);
        netTaxable = Math.round((totalGross / (1 + (rate / 100))) * 100) / 100;
        baseAsset = netTaxable;
      } else {
        baseAsset = rawVal;
        netTaxable = Math.max(0, rawVal + (gstOnTransport ? transportVal : 0) - discountVal);
      }
    } else {
      baseAsset = rawVal;
      netTaxable = Math.max(0, rawVal + transportVal - discountVal);
    }

    // Exact Symmetrical CGST & SGST (Indian GST Rule: CGST % = SGST % = rate / 2)
    const halfRate = rate / 2;
    const cgst = (isInterState || !isGst) ? 0 : Math.round((netTaxable * (halfRate / 100)) * 100) / 100;
    const sgst = (isInterState || !isGst) ? 0 : cgst; // 100% Guaranteed Exact Symmetrical Match
    const igst = (isInterState && isGst) ? Math.round((netTaxable * (rate / 100)) * 100) / 100 : 0;
    const totalTax = isInterState ? igst : (cgst + sgst);

    // Non-GST Transport (if transport is not subject to GST, it gets added directly to invoice total)
    const nonGstTransport = (!gstOnTransport && isGst) ? transportVal : 0;
    const unroundedTotal = Math.round((netTaxable + totalTax + nonGstTransport) * 100) / 100;

    // Round Off (Nearest Rupee)
    let roundOff = 0;
    let grandTotal = unroundedTotal;
    if (isRoundOff) {
      const rounded = Math.round(unroundedTotal);
      roundOff = parseFloat((rounded - unroundedTotal).toFixed(2));
      grandTotal = rounded;
    } else {
      grandTotal = parseFloat(unroundedTotal.toFixed(2));
      roundOff = 0;
    }

    // Payment & Balance computations
    const userPaidNum = parseFloat(paidAmount);
    let computedPaid = 0;
    if (!isNaN(userPaidNum)) {
      computedPaid = Math.max(0, userPaidNum);
    } else if (paymentOption === 'paid') {
      computedPaid = grandTotal;
    } else {
      computedPaid = 0;
    }

    const balanceAmount = Math.max(0, Math.round((grandTotal - computedPaid) * 100) / 100);

    return {
      rawVal,
      transportVal,
      discountVal,
      baseAsset,
      netTaxable,
      taxAmount: totalTax,
      cgst,
      sgst,
      igst,
      unroundedTotal,
      roundOff,
      grandTotal,
      computedPaid,
      balanceAmount
    };
  }, [taxableAmount, transportCharges, gstOnTransport, discount, isGst, taxRate, taxType, isInterState, isRoundOff, paidAmount, paymentOption]);

  // Keep paidAmount in sync when in 'paid' mode
  useEffect(() => {
    if (paymentOption === 'paid' && calculations.grandTotal > 0) {
      setPaidAmount(String(calculations.grandTotal));
    }
  }, [calculations.grandTotal, paymentOption]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isAdmin) {
      showToast('Admin PIN required to record asset GST bills', 'error');
      openLoginModal();
      return;
    }
    if (!name.trim()) {
      showToast('Please enter asset name or description', 'error');
      return;
    }
    if (!taxableAmount || parseFloat(taxableAmount) <= 0) {
      showToast('Please enter a valid purchase/taxable value', 'error');
      return;
    }
    if (isGst && !invoiceNo.trim()) {
      showToast('Please enter vendor invoice number for GSTR-2B compliance', 'error');
      return;
    }

    setIsSaving(true);
    try {
      const {
        baseAsset,
        netTaxable,
        transportVal,
        discountVal,
        taxAmount,
        cgst,
        sgst,
        igst,
        unroundedTotal,
        roundOff,
        grandTotal,
        computedPaid,
        balanceAmount
      } = calculations;

      const pStatus = balanceAmount <= 0.01 ? 'paid' : (computedPaid > 0 ? 'partial' : 'unpaid');

      const existingHistory = Array.isArray(asset?.paymentHistory) ? [...asset.paymentHistory] : [];
      if (!isEditing && computedPaid > 0 && existingHistory.length === 0) {
        existingHistory.push({
          id: `PAY_AST_${Date.now()}`,
          date,
          amount: computedPaid,
          mode: paymentMethod,
          reference: paymentRef || (invoiceNo ? `Inv #${invoiceNo}` : 'Initial Settlement'),
          notes: notes || 'Initial Payment on Asset Purchase'
        });
      }

      const assetPayload = {
        id: asset ? asset.id : `A_${Date.now()}`,
        voucherNo: asset?.voucherNo || `AST-${Date.now().toString().slice(-4)}`,
        invoiceNo: invoiceNo.trim(),
        date,
        branch,
        department,
        location: location.trim(),
        name: name.trim(),
        category,
        vendorId: vendorId || '',
        vendorName: vendorName.trim(),
        vendorGstin: vendorGstin.trim().toUpperCase(),
        hsn: hsn.trim(),
        qty: parseFloat(qty) || 1,
        uqc,
        rate: baseAsset,
        baseCost: baseAsset,
        taxableAmount: netTaxable,
        transportCharges: transportVal,
        gstOnTransport,
        discount: discountVal,
        isGst,
        taxType,
        taxRate: isGst ? parseFloat(taxRate) : 0,
        isInterState,
        cgst,
        sgst,
        igst,
        totalTax: taxAmount,
        unroundedTotal,
        roundOff,
        isRoundOff,
        grandTotal,
        value: grandTotal,
        itcEligibility: isGst ? itcEligibility : 'Ineligible',
        paidAmount: computedPaid,
        balanceAmount,
        paymentStatus: pStatus,
        paymentMethod,
        paymentHistory: existingHistory,
        notes: notes.trim(),
        syncToDaybook
      };

      await saveAsset(assetPayload);
      showToast(isEditing ? 'Asset GST Bill updated!' : 'Asset GST Bill recorded successfully!', 'success');
      onBack();
    } catch (err) {
      console.error('Error saving asset GST bill:', err);
      showToast(err.message || 'Failed to save asset bill', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-24">
      {!isAdmin && (
        <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center flex-shrink-0">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-amber-900">Read-Only Guest Mode</h4>
              <p className="text-[11px] text-amber-700">Admin PIN is required to record or edit Asset GST Bills.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={openLoginModal}
            className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-colors shadow-xs flex items-center gap-1.5"
          >
            <Lock className="w-3.5 h-3.5" /> Unlock Admin Access
          </button>
        </div>
      )}

      {/* Top Action Header */}
      <div className="flex items-center justify-between bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-2 text-slate-500 hover:text-slate-900 font-semibold text-xs transition-colors px-2 py-1"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Assets Register
        </button>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onBack}
            className="px-4 py-2 border border-slate-300 text-slate-700 rounded-xl text-xs font-semibold hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="assetGstForm"
            disabled={!isAdmin || isSaving}
            className={`flex items-center gap-1.5 px-6 py-2 rounded-xl text-xs font-bold shadow-md transition-all ${
              !isAdmin ? 'bg-slate-300 text-slate-500 cursor-not-allowed' : 'bg-brand-600 hover:bg-brand-700 text-white shadow-brand-500/20'
            }`}
          >
            <Check className="w-4 h-4" /> {isSaving ? 'Saving...' : isEditing ? 'Update Asset Bill' : 'Save Asset Bill'}
          </button>
        </div>
      </div>

      <form id="assetGstForm" onSubmit={handleSubmit} className="space-y-6 text-xs">
        {/* Section 1: Bill Header & Vendor Details */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
            <div>
              <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                <Receipt className="w-4 h-4 text-brand-600" />
                {isEditing ? 'Edit Asset GST Bill' : 'New Capital Asset GST Bill'}
              </h3>
              <p className="text-slate-400 text-xs mt-0.5">
                Record purchase invoice with vendor, GSTIN, and GSTR-2B Input Tax Credit
              </p>
            </div>
            <span className="px-2.5 py-1 bg-purple-50 text-purple-700 border border-purple-200 rounded-lg text-[10px] font-extrabold uppercase tracking-wide">
              GSTR-2B Capital Goods
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Vendor Invoice No <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                disabled={!isAdmin}
                value={invoiceNo}
                onChange={(e) => setInvoiceNo(e.target.value)}
                placeholder="e.g. INV-2026/901"
                className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-1 focus:ring-brand-500 font-mono font-semibold"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Invoice Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                required
                disabled={!isAdmin}
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Branch</label>
              <select
                disabled={!isAdmin}
                value={branch}
                onChange={(e) => setBranch(e.target.value)}
                className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-1 focus:ring-brand-500"
              >
                {branches.map(b => (
                  <option key={b} value={b}>{b} Branch</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Department</label>
              <select
                disabled={!isAdmin}
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-1 focus:ring-brand-500"
              >
                {departments.map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Vendor Picker Strip */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-indigo-600" /> Supplier / Vendor Account
              </span>
              <span className="text-[11px] text-slate-500">
                Syncs with Vendor List & Ledger
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Choose Existing Vendor</label>
                <select
                  disabled={!isAdmin}
                  value={vendorId}
                  onChange={(e) => handleSelectVendor(e.target.value)}
                  className="w-full py-2 px-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-500 font-medium"
                >
                  <option value="">-- Or enter custom vendor below --</option>
                  {vendors.map(v => (
                    <option key={v.id} value={v.id}>
                      {v.name} {v.gstin ? `(${v.gstin.slice(0, 5)}...)` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Vendor / Payee Name</label>
                <input
                  type="text"
                  disabled={!isAdmin}
                  value={vendorName}
                  onChange={(e) => setVendorName(e.target.value)}
                  placeholder="e.g. Heidelberg India Pvt Ltd"
                  className="w-full py-2 px-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-500 font-semibold text-slate-900"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Supplier GSTIN (for GSTR-2B ITC)
                </label>
                <input
                  type="text"
                  disabled={!isAdmin}
                  maxLength={15}
                  value={vendorGstin}
                  onChange={(e) => {
                    const val = e.target.value.toUpperCase();
                    setVendorGstin(val);
                    if (val.length >= 2) {
                      setIsInterState(isInterStateSupply('33', val));
                    }
                  }}
                  placeholder="e.g. 33AABCH1234F1Z5"
                  className="w-full py-2 px-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono font-bold text-slate-900 tracking-wider"
                />
              </div>
            </div>

            <div className="flex items-center gap-4 pt-1">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  disabled={!isAdmin}
                  checked={isInterState}
                  onChange={(e) => setIsInterState(e.target.checked)}
                  className="rounded text-brand-600 focus:ring-brand-500 w-4 h-4"
                />
                <span className="text-[11px] font-semibold text-slate-700">
                  Inter-State Supply (Apply IGST instead of CGST+SGST)
                </span>
              </label>
            </div>
          </div>
        </div>

        {/* Section 2: Asset Specification & Capital Goods Details */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="border-b border-slate-100 pb-2">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-slate-600" /> Capital Asset Specifications
            </h3>
            <p className="text-slate-400 text-xs">Specify equipment description, HSN code, and facility location</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <label className="block font-bold text-slate-700 mb-1">
                Asset Description / Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                disabled={!isAdmin}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Heidelberg SM 74 4-Color Printing Press"
                className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-1 focus:ring-brand-500 font-semibold text-slate-900"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Asset Category</label>
              <select
                disabled={!isAdmin}
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-1 focus:ring-brand-500 font-medium"
              >
                <option value="Machinery & Equipment">Machinery & Equipment</option>
                <option value="Computers & Electronics">Computers & Electronics</option>
                <option value="Furniture & Fixtures">Furniture & Fixtures</option>
                <option value="Vehicles">Vehicles</option>
                <option value="Building & Improvements">Building & Improvements</option>
                <option value="Office Equipment">Office Equipment</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block font-bold text-slate-700 mb-1">HSN / SAC Code</label>
              <input
                type="text"
                disabled={!isAdmin}
                value={hsn}
                onChange={(e) => setHsn(e.target.value)}
                placeholder="e.g. 8443 (Machinery) or 8471"
                className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-1 focus:ring-brand-500 font-mono font-medium"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Quantity & Unit</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  min="1"
                  step="1"
                  disabled={!isAdmin}
                  value={qty}
                  onChange={(e) => setQty(e.target.value)}
                  className="w-20 py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl font-mono text-center font-bold"
                />
                <select
                  disabled={!isAdmin}
                  value={uqc}
                  onChange={(e) => setUqc(e.target.value)}
                  className="flex-1 py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl bg-white focus:outline-none font-medium"
                >
                  <option value="NOS">NOS (Numbers)</option>
                  <option value="SET">SET (Sets)</option>
                  <option value="UNT">UNT (Units)</option>
                  <option value="PCS">PCS (Pieces)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Location / Shop Floor</label>
              <input
                type="text"
                disabled={!isAdmin}
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. Press Shop Bay 2"
                className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-1 focus:ring-brand-500 font-medium"
              />
            </div>
          </div>
        </div>

        {/* Section 3: GST Valuation, Transport Freight & GSTR-2B ITC Calculation */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="border-b border-slate-100 pb-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Calculator className="w-4 h-4 text-emerald-600" /> Valuation, Transport & GST Tax Breakup
              </h3>
              <p className="text-slate-400 text-xs">
                Calculate taxable base, transport freight, symmetrical CGST/SGST, and auto round-off
              </p>
            </div>
            <div className="flex items-center gap-2">
              {/* Tax Mode Switch */}
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-bold border border-slate-200">
                <button
                  type="button"
                  disabled={!isAdmin}
                  onClick={() => setTaxType('exclusive')}
                  className={`px-2.5 py-1 rounded-lg transition-all ${
                    taxType === 'exclusive' ? 'bg-white text-brand-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Tax Exclusive
                </button>
                <button
                  type="button"
                  disabled={!isAdmin}
                  onClick={() => setTaxType('inclusive')}
                  className={`px-2.5 py-1 rounded-lg transition-all ${
                    taxType === 'inclusive' ? 'bg-white text-purple-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Tax Inclusive (MRP)
                </button>
              </div>

              <label className="flex items-center gap-2 cursor-pointer bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200">
                <input
                  type="checkbox"
                  disabled={!isAdmin}
                  checked={isGst}
                  onChange={(e) => setIsGst(e.target.checked)}
                  className="rounded text-brand-600 focus:ring-brand-500 w-4 h-4"
                />
                <span className="text-xs font-bold text-slate-800">GST Invoice</span>
              </label>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                {taxType === 'inclusive' ? 'Gross Price (Incl. GST) *' : 'Basic Asset Price (₹) *'}
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                required
                disabled={!isAdmin}
                value={taxableAmount}
                onChange={(e) => setTaxableAmount(e.target.value)}
                placeholder="0.00"
                className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl font-mono text-base font-extrabold focus:bg-white focus:outline-none focus:ring-1 focus:ring-brand-500 text-right"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block font-bold text-slate-700 flex items-center gap-1">
                  <Truck className="w-3.5 h-3.5 text-indigo-600" /> Transport / Freight (₹)
                </label>
                <label className="text-[10px] text-slate-500 flex items-center gap-1 cursor-pointer">
                  <input
                    type="checkbox"
                    disabled={!isAdmin}
                    checked={gstOnTransport}
                    onChange={(e) => setGstOnTransport(e.target.checked)}
                    className="rounded text-brand-600 w-3 h-3"
                  />
                  <span>Taxable</span>
                </label>
              </div>
              <input
                type="number"
                step="0.01"
                min="0"
                disabled={!isAdmin}
                value={transportCharges}
                onChange={(e) => setTransportCharges(e.target.value)}
                placeholder="0.00"
                className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl font-mono text-base font-bold focus:bg-white focus:outline-none focus:ring-1 focus:ring-brand-500 text-right text-indigo-700"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Discount / Rebate (₹)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                disabled={!isAdmin}
                value={discount}
                onChange={(e) => setDiscount(e.target.value)}
                placeholder="0.00"
                className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl font-mono text-base font-bold focus:bg-white focus:outline-none focus:ring-1 focus:ring-brand-500 text-right text-rose-700"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Round Off To Rupee
              </label>
              <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 h-[42px]">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    disabled={!isAdmin}
                    checked={isRoundOff}
                    onChange={(e) => setIsRoundOff(e.target.checked)}
                    className="rounded text-brand-600 focus:ring-brand-500 w-4 h-4"
                  />
                  <span className="text-xs font-semibold text-slate-700">Auto Nearest ₹</span>
                </label>
                <span className={`font-mono font-bold text-xs ${calculations.roundOff >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {calculations.roundOff >= 0 ? `+₹${calculations.roundOff.toFixed(2)}` : `-₹${Math.abs(calculations.roundOff).toFixed(2)}`}
                </span>
              </div>
            </div>
          </div>

          {isGst && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
              <div>
                <label className="block font-bold text-slate-700 mb-1">GST Tax Rate</label>
                <select
                  disabled={!isAdmin}
                  value={taxRate}
                  onChange={(e) => setTaxRate(Number(e.target.value))}
                  className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-1 focus:ring-brand-500 font-bold"
                >
                  <option value={18}>18% (Standard Capital Machinery & IT)</option>
                  <option value={12}>12% (Equipment & Printing Accessories)</option>
                  <option value={28}>28% (Commercial Vehicles / Heavy Plant)</option>
                  <option value={5}>5% (Specialized Industrial Goods)</option>
                  <option value={0}>0% (Nil / Exempted)</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">GSTR-2B ITC Eligibility</label>
                <select
                  disabled={!isAdmin}
                  value={itcEligibility}
                  onChange={(e) => setItcEligibility(e.target.value)}
                  className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-1 focus:ring-brand-500 font-semibold text-purple-900"
                >
                  <option value="Inputs Capital Goods">Table 4(A)(5) - Eligible Capital Goods ITC</option>
                  <option value="Ineligible">Table 4(D) - Ineligible / Blocked Credit</option>
                </select>
              </div>
            </div>
          )}

          {/* Live Tax Calculation Summary Box */}
          <div className="bg-gradient-to-br from-slate-900 to-indigo-950 text-white p-5 rounded-2xl shadow-md space-y-3">
            <div className="flex items-center justify-between border-b border-white/10 pb-2">
              <span className="text-[11px] uppercase font-bold text-indigo-300 tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-indigo-400" /> Statutory GST Voucher Summary
              </span>
              <div className="flex items-center gap-3">
                <span className="text-[11px] font-mono text-indigo-300">
                  Base Taxable: <strong className="text-white">{formatCurrency(calculations.netTaxable)}</strong>
                </span>
                <span className="text-[11px] font-mono text-emerald-400 font-bold px-2 py-0.5 bg-emerald-500/10 rounded-md border border-emerald-500/20">
                  {isInterState ? 'Inter-State (IGST)' : 'Intra-State (CGST + SGST)'}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
              <div className="bg-white/5 p-3 rounded-xl border border-white/10">
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Asset Cost</span>
                <span className="font-extrabold text-sm font-mono text-white">
                  {formatCurrency(calculations.baseAsset)}
                </span>
                {calculations.transportVal > 0 && (
                  <span className="text-[10px] text-indigo-300 block font-mono">
                    + Freight: {formatCurrency(calculations.transportVal)}
                  </span>
                )}
              </div>

              {!isInterState ? (
                <>
                  <div className="bg-white/5 p-3 rounded-xl border border-white/10">
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">CGST ({taxRate / 2}%)</span>
                    <span className="font-extrabold text-sm font-mono text-indigo-300">
                      {formatCurrency(calculations.cgst)}
                    </span>
                  </div>
                  <div className="bg-white/5 p-3 rounded-xl border border-white/10">
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">SGST ({taxRate / 2}%)</span>
                    <span className="font-extrabold text-sm font-mono text-indigo-300">
                      {formatCurrency(calculations.sgst)}
                    </span>
                  </div>
                </>
              ) : (
                <div className="bg-white/5 p-3 rounded-xl border border-white/10 sm:col-span-2">
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">IGST ({taxRate}%)</span>
                  <span className="font-extrabold text-sm font-mono text-indigo-300">
                    {formatCurrency(calculations.igst)}
                  </span>
                </div>
              )}

              <div className="bg-white/5 p-3 rounded-xl border border-white/10">
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Round Off</span>
                <span className={`font-extrabold text-sm font-mono ${calculations.roundOff >= 0 ? 'text-emerald-300' : 'text-amber-300'}`}>
                  {calculations.roundOff >= 0 ? `+₹${calculations.roundOff.toFixed(2)}` : `-₹${Math.abs(calculations.roundOff).toFixed(2)}`}
                </span>
                <span className="text-[10px] text-slate-400 block">
                  Net: {formatCurrency(calculations.unroundedTotal)}
                </span>
              </div>

              <div className="bg-emerald-500/20 p-3 rounded-xl border border-emerald-500/30">
                <span className="text-emerald-300 block text-[10px] uppercase font-bold">Grand Total</span>
                <span className="font-black text-base font-mono text-emerald-400">
                  {formatCurrency(calculations.grandTotal)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Section 4: Payment Settlement & Vendor Outstanding Sync */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="border-b border-slate-100 pb-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-emerald-600" /> Payment Settlement & Vendor Balance
              </h3>
              <p className="text-slate-400 text-xs">
                Record initial payment made to supplier or retain payable balance (manually editable)
              </p>
            </div>
            <div className="flex gap-2 bg-slate-100 p-1 rounded-xl text-xs font-bold">
              <button
                type="button"
                disabled={!isAdmin}
                onClick={() => {
                  setPaymentOption('paid');
                  setPaidAmount(String(calculations.grandTotal));
                }}
                className={`px-3 py-1 rounded-lg transition-all ${
                  paymentOption === 'paid' ? 'bg-white text-emerald-800 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Paid in Full
              </button>
              <button
                type="button"
                disabled={!isAdmin}
                onClick={() => {
                  setPaymentOption('partial');
                  if (!paidAmount || parseFloat(paidAmount) === calculations.grandTotal || parseFloat(paidAmount) === 0) {
                    setPaidAmount(String((calculations.grandTotal / 2).toFixed(2)));
                  }
                }}
                className={`px-3 py-1 rounded-lg transition-all ${
                  paymentOption === 'partial' ? 'bg-white text-amber-800 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Partial Paid
              </button>
              <button
                type="button"
                disabled={!isAdmin}
                onClick={() => {
                  setPaymentOption('unpaid');
                  setPaidAmount('0');
                }}
                className={`px-3 py-1 rounded-lg transition-all ${
                  paymentOption === 'unpaid' ? 'bg-white text-rose-800 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Credit / Unpaid
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block font-bold text-slate-700">Paid Amount (₹)</label>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    disabled={!isAdmin}
                    onClick={() => {
                      setPaidAmount(String(calculations.grandTotal));
                      setPaymentOption('paid');
                    }}
                    className="text-[10px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-1.5 py-0.5 rounded transition-colors"
                  >
                    Full
                  </button>
                  <button
                    type="button"
                    disabled={!isAdmin}
                    onClick={() => {
                      setPaidAmount(String((calculations.grandTotal / 2).toFixed(2)));
                      setPaymentOption('partial');
                    }}
                    className="text-[10px] font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 px-1.5 py-0.5 rounded transition-colors"
                  >
                    50%
                  </button>
                  <button
                    type="button"
                    disabled={!isAdmin}
                    onClick={() => {
                      setPaidAmount('0');
                      setPaymentOption('unpaid');
                    }}
                    className="text-[10px] font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 px-1.5 py-0.5 rounded transition-colors"
                  >
                    Nil
                  </button>
                </div>
              </div>
              <input
                type="number"
                step="0.01"
                min="0"
                disabled={!isAdmin}
                value={paidAmount}
                onChange={(e) => {
                  const val = e.target.value;
                  setPaidAmount(val);
                  const num = parseFloat(val);
                  if (!isNaN(num)) {
                    if (num >= calculations.grandTotal - 0.01 && calculations.grandTotal > 0) {
                      setPaymentOption('paid');
                    } else if (num <= 0) {
                      setPaymentOption('unpaid');
                    } else {
                      setPaymentOption('partial');
                    }
                  }
                }}
                placeholder="0.00"
                className="w-full py-2 px-3 bg-white border border-slate-300 rounded-xl font-mono text-base font-bold focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500 text-right shadow-2xs"
              />
              <span className="text-[10px] text-slate-500 mt-0.5 block">
                Type any custom payment amount freely
              </span>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Payment Method / Bank</label>
              <select
                disabled={!isAdmin || (parseFloat(paidAmount) || 0) <= 0}
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-1 focus:ring-brand-500 font-medium disabled:opacity-50"
              >
                {paymentMethods.map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Payment Ref / Cheque / UTR</label>
              <input
                type="text"
                disabled={!isAdmin || (parseFloat(paidAmount) || 0) <= 0}
                value={paymentRef}
                onChange={(e) => setPaymentRef(e.target.value)}
                placeholder="e.g. UTR-982104 or Chq #4410"
                className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-1 focus:ring-brand-500 font-mono disabled:opacity-50"
              />
            </div>
          </div>

          {/* Balance Due Notice */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <Info className="w-4 h-4 text-slate-500" />
              <span className="text-slate-600 font-medium">
                Outstanding Balance Due to Vendor ({vendorName || 'Supplier'}):
              </span>
            </div>
            <span className={`font-mono font-extrabold text-sm ${calculations.balanceAmount > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
              {formatCurrency(calculations.balanceAmount)}
            </span>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Remarks / Warranty / Serial Numbers</label>
            <input
              type="text"
              disabled={!isAdmin}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Machine Sr. No: HD-2026-X, 2 Years Comprehensive Warranty"
              className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none font-medium"
            />
          </div>
        </div>
      </form>
    </div>
  );
}
