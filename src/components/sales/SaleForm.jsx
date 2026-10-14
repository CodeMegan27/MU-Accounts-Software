import React, { useState, useEffect, useRef } from 'react';
import { 
  ArrowLeft, 
  Plus, 
  Trash2, 
  Save, 
  Layers, 
  CreditCard, 
  Tag, 
  User, 
  Calendar,
  Building,
  CheckCircle2,
  Clock,
  FileText,
  X,
  AlertCircle,
  Sparkles,
  RotateCcw
} from 'lucide-react';
import { formatCurrency } from '../../utils/formatters';
import { useData } from '../../context/DataContext';
import { useToast } from '../../context/ToastContext';
import { 
  saveActiveDraft, 
  getActiveDraft, 
  clearActiveDraft, 
  getAllDrafts, 
  deleteDraftById 
} from '../../utils/draftManager';
import QuickAddMasterModal from '../common/QuickAddMasterModal';

export default function SaleForm({ sale, onBack, onSaved }) {
  const { 
    saveSale, 
    branches, 
    departments, 
    paymentMethods, 
    items: catalogItems = [],
    saveItem,
    addBranch, 
    addDepartment, 
    addPaymentMethod,
    logActivity,
    removeDraftActivityLog
  } = useData();
  const { showToast } = useToast();

  const [masterModalType, setMasterModalType] = useState(null);

  const handleAddMaster = async (name) => {
    if (masterModalType === 'branch') {
      const added = addBranch(name);
      setBranch(added);
      showToast(`Added branch: ${added}`, 'success');
    } else if (masterModalType === 'department') {
      const added = addDepartment(name);
      setDepartment(added);
      showToast(`Added department: ${added}`, 'success');
    } else if (masterModalType === 'paymentMethod') {
      const added = addPaymentMethod(name);
      setAdvanceMethod(added);
      showToast(`Added payment method: ${added}`, 'success');
    } else if (masterModalType === 'item') {
      await saveItem({ name, uqc: 'NOS', defaultRate: 0, category: department || 'GENERAL' });
      showToast(`Added product "${name}" to master catalog!`, 'success');
    }
    setMasterModalType(null);
  };

  const isDraftObj = Boolean(sale && (sale._draftId || sale._draftType));
  const existingSale = sale && !isDraftObj ? sale : null;

  // Draft Management State
  const initialDraft = useRef(isDraftObj ? sale : (!existingSale ? getActiveDraft('sale') : null)).current;
  const [activeDraftId, setActiveDraftId] = useState(initialDraft?._draftId || null);
  const [activeDraftNumber, setActiveDraftNumber] = useState(initialDraft?._draftNumber || null);
  const [showDraftBanner, setShowDraftBanner] = useState(Boolean(!existingSale && initialDraft && (initialDraft.customerName || initialDraft.estNo)));
  const [lastSavedTime, setLastSavedTime] = useState(initialDraft?._updatedAt || null);
  const [showDraftsModal, setShowDraftsModal] = useState(false);
  const [draftsList, setDraftsList] = useState(() => getAllDrafts('sale'));

  const [orderDate, setOrderDate] = useState(initialDraft?.orderDate || existingSale?.orderDate || new Date().toISOString().substring(0, 10));
  const [estNo, setEstNo] = useState(initialDraft?.estNo || existingSale?.estNo || '');
  const [orderFormNo, setOrderFormNo] = useState(initialDraft?.orderFormNo || existingSale?.orderFormNo || '');
  const [branch, setBranch] = useState(initialDraft?.branch || existingSale?.branch || 'KLK');
  const [department, setDepartment] = useState(initialDraft?.department || existingSale?.department || 'ADVERTISEMENT');
  const [attender, setAttender] = useState(initialDraft?.attender || existingSale?.attender || '');
  
  const [customerName, setCustomerName] = useState(initialDraft?.customerName || existingSale?.customerName || '');
  const [contact, setContact] = useState(initialDraft?.contact || existingSale?.contact || '');
  const [address, setAddress] = useState(initialDraft?.address || existingSale?.address || '');
  const [customerSegment, setCustomerSegment] = useState(initialDraft?.customerSegment || existingSale?.customerSegment || 'FAMILY EVENTS');
  const [segmentType, setSegmentType] = useState(initialDraft?.segmentType || existingSale?.segmentType || 'MARRIAGE');

  // Composite Line Items
  const [items, setItems] = useState(
    initialDraft?.items?.length > 0 ? initialDraft.items : (
      existingSale?.items?.length > 0 ? existingSale.items : [
        { id: '1', product: 'FLEX', description: 'NORMAL FLEX', size: '10X8', quantity: 1, rate: 800, amount: 800 }
      ]
    )
  );

  const [discount, setDiscount] = useState(initialDraft?.discount !== undefined ? initialDraft.discount : (existingSale?.discount || 0));
  const [gstRate, setGstRate] = useState(initialDraft?.gstRate !== undefined ? initialDraft.gstRate : (existingSale?.gstRate !== undefined ? existingSale.gstRate : 18));

  // Initial Advance Payment
  const [advanceAmount, setAdvanceAmount] = useState(initialDraft?.advanceAmount !== undefined ? initialDraft.advanceAmount : (existingSale?.payments?.[0]?.amount || 0));
  const [advanceMethod, setAdvanceMethod] = useState(initialDraft?.advanceMethod || existingSale?.payments?.[0]?.method || 'GPAY- SBI');

  // Restore Draft function
  const restoreDraftData = (draft) => {
    if (!draft) return;
    if (draft.orderDate) setOrderDate(draft.orderDate);
    if (draft.estNo) setEstNo(draft.estNo);
    if (draft.orderFormNo) setOrderFormNo(draft.orderFormNo);
    if (draft.branch) setBranch(draft.branch);
    if (draft.department) setDepartment(draft.department);
    if (draft.attender) setAttender(draft.attender);
    if (draft.customerName) setCustomerName(draft.customerName);
    if (draft.contact) setContact(draft.contact);
    if (draft.address) setAddress(draft.address);
    if (draft.customerSegment) setCustomerSegment(draft.customerSegment);
    if (draft.segmentType) setSegmentType(draft.segmentType);
    if (Array.isArray(draft.items) && draft.items.length > 0) setItems(draft.items);
    if (draft.discount !== undefined) setDiscount(draft.discount);
    if (draft.gstRate !== undefined) setGstRate(draft.gstRate);
    if (draft.advanceAmount !== undefined) setAdvanceAmount(draft.advanceAmount);
    if (draft.advanceMethod) setAdvanceMethod(draft.advanceMethod);
    if (draft._draftId) setActiveDraftId(draft._draftId);
    if (draft._draftNumber) setActiveDraftNumber(draft._draftNumber);
    setLastSavedTime(draft._updatedAt || new Date().toISOString());
    showToast(`Restored draft ${draft._draftNumber ? '[' + draft._draftNumber + ']' : ''} for ${draft.customerName || 'order'}!`, 'success');
    setShowDraftBanner(false);
    setShowDraftsModal(false);
  };

  const handleDiscardDraft = () => {
    clearActiveDraft('sale');
    setShowDraftBanner(false);
    showToast('Active draft discarded', 'info');
  };

  // Calculation logic - Sales is INCLUSIVE of all taxes
  const subtotal = items.reduce((acc, i) => acc + (parseFloat(i.amount) || 0), 0);
  const discountVal = parseFloat(discount) || 0;
  const finalSaleAmount = Math.max(0, subtotal - discountVal);
  const rate = parseFloat(gstRate) || 0;
  // Separate out the included GST from the final sale amount
  const gstVal = rate > 0 ? Math.round(((finalSaleAmount * rate) / (100 + rate)) * 100) / 100 : 0;
  const taxableVal = Math.round((finalSaleAmount - gstVal) * 100) / 100;
  const advVal = parseFloat(advanceAmount) || 0;
  const balanceDue = Math.max(0, finalSaleAmount - advVal);

  const handleItemChange = (index, field, value) => {
    const updated = [...items];
    updated[index][field] = value;
    if (field === 'quantity' || field === 'rate') {
      const q = parseFloat(updated[index].quantity) || 0;
      const r = parseFloat(updated[index].rate) || 0;
      updated[index].amount = parseFloat((q * r).toFixed(2));
    }
    setItems(updated);
  };

  const handleAmountChange = (index, newAmountVal) => {
    setItems(prev => {
      const copy = [...prev];
      const newAmt = parseFloat(newAmountVal) || 0;
      copy[index].amount = newAmt;
      const q = parseFloat(copy[index].quantity) || 1;
      if (q > 0) {
        copy[index].rate = parseFloat((newAmt / q).toFixed(2));
      }
      return copy;
    });
  };

  const handleCatalogSelect = (index, catalogItemName) => {
    const found = catalogItems.find(c => c.name === catalogItemName);
    if (!found) {
      handleItemChange(index, 'product', catalogItemName);
      return;
    }

    setItems(prev => {
      const copy = [...prev];
      const current = copy[index];
      const q = parseFloat(current.quantity) || 1;
      const r = (found.defaultRate !== undefined && found.defaultRate > 0) ? found.defaultRate : (parseFloat(current.rate) || 0);

      // Extract main product and description intelligently
      let mainProd = found.name;
      let desc = found.name;
      let detectedSize = current.size || '';

      const sizeMatch = found.name.match(/\(([^)]+)\)/);
      if (sizeMatch && sizeMatch[1]) {
        detectedSize = sizeMatch[1];
      }

      if (found.name.includes(' - ')) {
        const parts = found.name.split(' - ');
        mainProd = parts[0].trim();
        desc = parts.slice(1).join(' - ').trim();
      } else if (found.name.includes('FLEX')) {
        mainProd = 'FLEX';
        desc = found.name;
      } else if (found.name.includes('FRAME')) {
        mainProd = 'FRAME';
        desc = found.name;
      } else if (found.name.includes('STICKER')) {
        mainProd = 'STICKER';
        desc = found.name;
      } else if (found.name.includes('VISITING CARD')) {
        mainProd = 'VISITING CARD';
        desc = found.name;
      } else if (found.name.includes('BILL BOOK') || found.name.includes('DONATION BOOK')) {
        mainProd = 'BILLBOOK';
        desc = found.name;
      } else if (found.name.includes('STAMP')) {
        mainProd = 'STAMP';
        desc = found.name;
      } else if (found.name.includes('INVITATION')) {
        mainProd = 'INVITATION';
        desc = found.name;
      } else if (found.category) {
        if (found.category.includes('ADVERTISEMENT')) mainProd = 'FLEX';
        else if (found.category.includes('INVITATION')) mainProd = 'INVITATION';
        else if (found.category.includes('STATIONERY')) mainProd = 'STATIONERY';
      }

      copy[index] = {
        ...current,
        product: mainProd,
        description: desc,
        size: detectedSize || (found.uqc === 'SRV' ? '0' : current.size || ''),
        rate: r,
        amount: parseFloat((q * r).toFixed(2)),
        uqc: found.uqc || current.uqc || 'NOS'
      };
      return copy;
    });
  };

  const handleAddItem = () => {
    setItems(prev => [
      ...prev,
      { id: Date.now().toString(), product: '', description: '', size: '', quantity: 1, rate: 0, amount: 0, uqc: 'NOS' }
    ]);
  };

  const handleRemoveItem = (index) => {
    if (items.length <= 1) {
      showToast('A sales order must contain at least one line item', 'warning');
      return;
    }
    setItems(prev => prev.filter((_, i) => i !== index));
  };

  // Auto-Save Effect (Debounced 1000ms) - Silently preserves draft in localStorage without activity log spam
  useEffect(() => {
    if (existingSale) return; // Only auto-save for new sales order drafts
    const timer = setTimeout(() => {
      const draftData = {
        _draftId: activeDraftId,
        _draftNumber: activeDraftNumber,
        orderDate,
        estNo,
        orderFormNo,
        branch,
        department,
        attender,
        customerName,
        contact,
        address,
        customerSegment,
        segmentType,
        items,
        discount,
        gstRate,
        advanceAmount,
        advanceMethod,
        subtotal,
        finalAmount: finalSaleAmount
      };
      // Pass null for logActivity: Store draft silently while voucher is open
      const saved = saveActiveDraft('sale', draftData, null);
      if (saved) {
        if (!activeDraftId && saved._draftId) setActiveDraftId(saved._draftId);
        if (!activeDraftNumber && saved._draftNumber) setActiveDraftNumber(saved._draftNumber);
        setLastSavedTime(saved._updatedAt);
        setDraftsList(getAllDrafts('sale'));
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [
    existingSale, activeDraftId, activeDraftNumber, orderDate, estNo, orderFormNo, branch, department, attender,
    customerName, contact, address, customerSegment, segmentType, items,
    discount, gstRate, advanceAmount, advanceMethod, subtotal, finalSaleAmount
  ]);

  const handleManualSaveDraft = () => {
    const draftData = {
      _draftId: activeDraftId,
      _draftNumber: activeDraftNumber,
      orderDate,
      estNo,
      orderFormNo,
      branch,
      department,
      attender,
      customerName,
      contact,
      address,
      customerSegment,
      segmentType,
      items,
      discount,
      gstRate,
      advanceAmount,
      advanceMethod,
      subtotal,
      finalAmount: finalSaleAmount
    };
    const saved = saveActiveDraft('sale', draftData, logActivity);
    if (saved) {
      if (!activeDraftId && saved._draftId) setActiveDraftId(saved._draftId);
      if (!activeDraftNumber && saved._draftNumber) setActiveDraftNumber(saved._draftNumber);
      setLastSavedTime(saved._updatedAt);
      setDraftsList(getAllDrafts('sale'));
      showToast('Draft saved to Activity Logs! You can resume anytime.', 'success');
    }
  };

  const handleBack = () => {
    // If voucher has entered content, save single draft log when exiting
    const hasContent = Boolean(customerName || estNo || (items && items.length > 0 && (items[0].description || items[0].amount > 0)));
    if (hasContent && !existingSale) {
      const draftData = {
        _draftId: activeDraftId,
        _draftNumber: activeDraftNumber,
        orderDate,
        estNo,
        orderFormNo,
        branch,
        department,
        attender,
        customerName,
        contact,
        address,
        customerSegment,
        segmentType,
        items,
        discount,
        gstRate,
        advanceAmount,
        advanceMethod,
        subtotal,
        finalAmount: finalSaleAmount
      };
      saveActiveDraft('sale', draftData, logActivity);
    }
    if (onBack) onBack();
  };

  const handleRemoveDraftItem = (draftId) => {
    const updated = deleteDraftById(draftId, logActivity);
    setDraftsList(updated.filter(d => d._draftType === 'sale'));
    showToast('Draft deleted', 'info');
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!estNo) {
      showToast('Please provide an Estimate / Sales Order No.', 'error');
      return;
    }
    if (!customerName) {
      showToast('Please provide Customer Name', 'error');
      return;
    }

    const payments = [];
    if (advVal > 0) {
      payments.push({
        id: `pay_adv_${Date.now()}`,
        type: 'Advance',
        amount: advVal,
        method: advanceMethod,
        date: orderDate
      });
    }

    const payload = {
      ...(sale || {}),
      estNo,
      orderDate,
      orderFormNo: orderFormNo || 'NA',
      branch,
      department,
      attender,
      customerName,
      contact,
      address,
      customerSegment,
      segmentType,
      items,
      subtotal,
      discount: discountVal,
      gstRate: rate,
      gstAmount: gstVal,
      taxableAmount: taxableVal,
      finalAmount: finalSaleAmount,
      paidAmount: advVal,
      balanceAmount: balanceDue,
      paymentStatus: balanceDue <= 0 ? 'paid' : (advVal > 0 ? 'partial' : 'pending'),
      billStatus: balanceDue <= 0 ? 'NIL' : 'PENDING',
      payments,
      isInvoice: sale?.isInvoice || false,
      invoiceNo: sale?.isInvoice ? sale.invoiceNo : null,
      invDate: sale?.isInvoice ? sale.invDate : null
    };

    saveSale(payload);
    clearActiveDraft('sale');
    if (activeDraftId) {
      removeDraftActivityLog(activeDraftId);
    }
    showToast(`Sales Order #${estNo} saved successfully!`, 'success');
    if (onSaved) onSaved(payload);
    else onBack();
  };

  return (
    <div className="space-y-6">
      {/* Draft Recovery Banner */}
      {showDraftBanner && initialDraft && (
        <div className="bg-amber-500/10 border-2 border-amber-400/50 p-4 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-amber-950 animate-in fade-in">
          <div className="flex items-center gap-2.5">
            <span className="text-xl">📝</span>
            <div>
              <p className="font-extrabold text-sm text-amber-900">Unsaved Sales Draft Detected</p>
              <p className="text-amber-700">
                Found auto-saved draft for <strong>{initialDraft.customerName || 'Customer'}</strong> ({initialDraft.items?.length || 1} items) from {initialDraft._updatedAt ? new Date(initialDraft._updatedAt).toLocaleTimeString() : 'earlier'}.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => restoreDraftData(initialDraft)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold shadow-xs transition-all"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Resume Draft</span>
            </button>
            <button
              type="button"
              onClick={handleDiscardDraft}
              className="flex items-center gap-1 px-2.5 py-1.5 bg-white hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-xl font-semibold transition-all"
            >
              <X className="w-3.5 h-3.5" />
              <span>Discard</span>
            </button>
          </div>
        </div>
      )}

      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-2.5">
          <button
            onClick={handleBack}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors"
          >
            <ArrowLeft className="w-4 h-4 text-brand-600" />
            <span>Cancel & Back</span>
          </button>
          <h2 className="text-base font-extrabold text-slate-900">
            {existingSale ? `Edit Sales Order #${existingSale.estNo}` : (activeDraftNumber ? `New Sales Order (${activeDraftNumber})` : 'New Composite Sales Order')}
          </h2>
        </div>

        {/* Auto-Save Status & Draft Controls */}
        <div className="flex items-center gap-2 justify-end">
          {activeDraftNumber && !existingSale && (
            <span className="hidden sm:inline-flex items-center gap-1 font-mono text-[11px] font-black text-indigo-700 bg-indigo-50 border border-indigo-200 px-2.5 py-1 rounded-full">
              <span>{activeDraftNumber}</span>
            </span>
          )}

          {lastSavedTime && !existingSale && (
            <span className="hidden md:flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200/80 px-2.5 py-1 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>Auto-saved {new Date(lastSavedTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            </span>
          )}

          {!sale && (
            <>
              <button
                type="button"
                onClick={handleManualSaveDraft}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-700 rounded-xl text-xs font-bold transition-all"
                title="Save current progress as draft"
              >
                <Save className="w-3.5 h-3.5 text-slate-500" />
                <span>Save Draft</span>
              </button>

              {draftsList.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowDraftsModal(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-bold transition-all"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Drafts ({draftsList.length})</span>
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Saved Drafts Modal */}
      {showDraftsModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-5 space-y-4 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-indigo-600" />
                <h3 className="font-extrabold text-sm text-slate-900">Saved Sales Drafts</h3>
              </div>
              <button onClick={() => setShowDraftsModal(false)} className="p-1 hover:bg-slate-100 rounded-lg text-slate-400">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="max-h-72 overflow-y-auto divide-y divide-slate-100 text-xs">
              {draftsList.length === 0 ? (
                <p className="text-center py-8 text-slate-400">No saved drafts</p>
              ) : (
                draftsList.map(d => (
                  <div key={d._draftId} className="py-3 flex items-center justify-between gap-3">
                    <div>
                      <p className="font-bold text-slate-900">{d.customerName || 'Untitled Customer'}</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Est #{d.estNo || 'Draft'} • {d.items?.length || 1} items • ₹{parseFloat(d.finalAmount || 0).toLocaleString('en-IN')}
                      </p>
                      <p className="text-[10px] text-indigo-600 mt-0.5">
                        Saved: {d._updatedAt ? new Date(d._updatedAt).toLocaleString() : 'Recent'}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => restoreDraftData(d)}
                        className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold text-xs shadow-xs"
                      >
                        Resume
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemoveDraftItem(d._draftId)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                        title="Delete draft"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Section 1: Order Header & Branch */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <h3 className="font-extrabold text-xs uppercase tracking-wider text-slate-600 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-brand-600" />
            <span>Order & Branch Identification</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-5 gap-4 text-xs">
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Sales Order Date *</label>
              <input
                type="date"
                value={orderDate}
                onChange={(e) => setOrderDate(e.target.value)}
                className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 font-mono"
                required
              />
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">Estimate / Order No *</label>
              <input
                type="text"
                value={estNo}
                onChange={(e) => setEstNo(e.target.value)}
                placeholder="e.g. 742"
                className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 font-mono font-bold"
                required
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-slate-700 font-semibold">Branch *</label>
                <button
                  type="button"
                  onClick={() => setMasterModalType('branch')}
                  className="text-[11px] font-bold text-brand-600 hover:text-brand-800 flex items-center gap-0.5 cursor-pointer"
                  title="Add new branch location"
                >
                  <Plus className="w-3 h-3" /> Add
                </button>
              </div>
              <select
                value={branch}
                onChange={(e) => setBranch(e.target.value)}
                className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 font-bold"
              >
                {branches.map(b => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-slate-700 font-semibold">Department *</label>
                <button
                  type="button"
                  onClick={() => setMasterModalType('department')}
                  className="text-[11px] font-bold text-brand-600 hover:text-brand-800 flex items-center gap-0.5 cursor-pointer"
                  title="Add new department"
                >
                  <Plus className="w-3 h-3" /> Add
                </button>
              </div>
              <select
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 font-bold"
              >
                {departments.map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">Attender / Staff Name</label>
              <input
                type="text"
                value={attender}
                onChange={(e) => setAttender(e.target.value)}
                placeholder="e.g. SATHISH, YUVA"
                className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
          </div>
        </div>

        {/* Section 2: Customer Profile */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <h3 className="font-extrabold text-xs uppercase tracking-wider text-slate-600 flex items-center gap-2">
            <User className="w-4 h-4 text-emerald-600" />
            <span>Customer / Client Profile</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Customer / Organization Name *</label>
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="e.g. MUNICIPALITY, SIVA, HABEEB MOHAMED"
                className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 font-bold"
                required
              />
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">Contact Phone</label>
              <input
                type="text"
                value={contact}
                onChange={(e) => setContact(e.target.value)}
                placeholder="e.g. 9842215362"
                className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 font-mono"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">Town / Address</label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="e.g. KILAKARAI, RAMANATHAPURAM"
                className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
          </div>
        </div>

        {/* Section 3: Composite Line Items */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <h3 className="font-extrabold text-xs uppercase tracking-wider text-slate-600 flex items-center gap-2">
                <Layers className="w-4 h-4 text-indigo-600" />
                <span>Composite Line Items (Goods & Ancillary Charges)</span>
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Type directly or pick from master catalog. Qty × Rate auto-calculates, or alter Amount directly.
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => setMasterModalType('item')}
                className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                title="Add a new standardized product to catalog"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New Catalog Item</span>
              </button>
              <button
                type="button"
                onClick={handleAddItem}
                className="flex items-center gap-1 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-bold transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Line Item</span>
              </button>
            </div>
          </div>

          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-left text-xs border-collapse min-w-[760px]">
              <thead>
                <tr className="bg-slate-100 border-b border-slate-200 text-slate-700 font-bold uppercase text-[11px]">
                  <th className="p-2.5 w-10 text-center">#</th>
                  <th className="p-2.5 min-w-[240px]">Product (Select or Type) *</th>
                  <th className="p-2.5 min-w-[180px]">Description</th>
                  <th className="p-2.5 w-24 text-center">Size</th>
                  <th className="p-2.5 w-20 text-center">Qty *</th>
                  <th className="p-2.5 w-24 text-right">Rate (₹)</th>
                  <th className="p-2.5 w-32 text-right">Amount (₹) *</th>
                  <th className="p-2.5 w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((it, idx) => (
                  <tr key={it.id || idx} className="hover:bg-slate-50/50">
                    <td className="p-2 text-center font-bold text-slate-400">{idx + 1}</td>
                    
                    {/* Main Product: Typed Input + Autocomplete Datalist + 1-Click Dropdown Picker */}
                    <td className="p-2">
                      <div className="flex gap-1.5 items-center">
                        <input
                          type="text"
                          value={it.product}
                          onChange={(e) => handleItemChange(idx, 'product', e.target.value)}
                          placeholder="Type or select product..."
                          list={`sales-catalog-list-${idx}`}
                          className="w-full py-1.5 px-2 bg-slate-50 border border-slate-200 rounded-lg font-bold text-xs focus:bg-white focus:outline-none focus:ring-1 focus:ring-brand-500 text-slate-800"
                          required
                        />
                        <datalist id={`sales-catalog-list-${idx}`}>
                          {catalogItems.map(c => (
                            <option key={c.id} value={c.name}>
                              {c.category ? `[${c.category}] ` : ''}Rate: ₹{c.defaultRate} ({c.uqc})
                            </option>
                          ))}
                        </datalist>

                        <select
                          value=""
                          onChange={(e) => {
                            if (e.target.value) handleCatalogSelect(idx, e.target.value);
                          }}
                          className="py-1.5 px-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200 rounded-lg text-[11px] font-bold focus:outline-none cursor-pointer max-w-[105px] flex-shrink-0"
                          title="Click to select from standardized Product Catalog"
                        >
                          <option value="">Catalog...</option>
                          {catalogItems.map(c => (
                            <option key={c.id} value={c.name}>
                              {c.name} (₹{c.defaultRate})
                            </option>
                          ))}
                        </select>
                      </div>
                    </td>

                    {/* Description */}
                    <td className="p-2">
                      <input
                        type="text"
                        value={it.description}
                        onChange={(e) => handleItemChange(idx, 'description', e.target.value)}
                        placeholder="e.g. NORMAL FLEX, PASTING CHARGE"
                        className="w-full py-1.5 px-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:bg-white focus:outline-none focus:ring-1 focus:ring-brand-500"
                        required
                      />
                    </td>

                    {/* Size */}
                    <td className="p-2 w-24 text-center">
                      <input
                        type="text"
                        value={it.size}
                        onChange={(e) => handleItemChange(idx, 'size', e.target.value)}
                        placeholder="e.g. 10X8"
                        className="w-full py-1.5 px-2 bg-slate-50 border border-slate-200 rounded-lg text-center font-mono text-xs focus:bg-white focus:outline-none focus:ring-1 focus:ring-brand-500"
                      />
                    </td>

                    {/* Qty */}
                    <td className="p-2 w-20 text-center">
                      <input
                        type="number"
                        step="any"
                        value={it.quantity}
                        onChange={(e) => handleItemChange(idx, 'quantity', e.target.value)}
                        className="w-full py-1.5 px-2 bg-slate-50 border border-slate-200 rounded-lg text-center font-bold font-mono text-xs focus:bg-white focus:outline-none focus:ring-1 focus:ring-brand-500"
                        required
                      />
                    </td>

                    {/* Rate */}
                    <td className="p-2 w-24 text-right">
                      <input
                        type="number"
                        step="any"
                        value={it.rate}
                        onChange={(e) => handleItemChange(idx, 'rate', e.target.value)}
                        className="w-full py-1.5 px-2 bg-slate-50 border border-slate-200 rounded-lg text-right font-mono text-xs focus:bg-white focus:outline-none focus:ring-1 focus:ring-brand-500"
                      />
                    </td>

                    {/* Amount: Editable Lump Sum or Auto Qty * Rate */}
                    <td className="p-2 w-32 text-right">
                      <input
                        type="number"
                        step="any"
                        value={it.amount !== undefined ? it.amount : ''}
                        onChange={(e) => handleAmountChange(idx, e.target.value)}
                        placeholder="0"
                        title="Auto-calculated (Qty × Rate) or enter manual amount"
                        className="w-full py-1.5 px-2 bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 rounded-lg text-right font-bold font-mono text-xs text-brand-700 focus:outline-none focus:ring-1 focus:ring-brand-500"
                        required
                      />
                    </td>

                    {/* Delete Item */}
                    <td className="p-2 text-center">
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(idx)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                        title="Remove line item"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Section 4: Bottom Classification & Designer Purpose */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <h3 className="font-extrabold text-xs uppercase tracking-wider text-slate-600 flex items-center gap-2">
            <Tag className="w-4 h-4 text-amber-600" />
            <span>Bottom Bill Classification & Designer Form No</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Order Form No. (Designer Tracking)</label>
              <input
                type="text"
                value={orderFormNo}
                onChange={(e) => setOrderFormNo(e.target.value)}
                placeholder="e.g. 260902 or NA"
                className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 font-mono"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">Customer Segment</label>
              <input
                type="text"
                value={customerSegment}
                onChange={(e) => setCustomerSegment(e.target.value)}
                placeholder="e.g. FAMILY EVENTS, MSME, EDUCATION"
                className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 font-semibold"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">Segment Type</label>
              <input
                type="text"
                value={segmentType}
                onChange={(e) => setSegmentType(e.target.value)}
                placeholder="e.g. MARRIAGE, EAR PIERCING, SCHOOL"
                className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
          </div>
        </div>

        {/* Section 5: Calculations, Tax & Payment Settlements */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          {/* Left: Advance Collection */}
          <div className="space-y-4 text-xs">
            <h3 className="font-extrabold uppercase tracking-wider text-slate-600 flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-emerald-600" />
              <span>Initial Advance Payment</span>
            </h3>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">Advance Amount Received (₹)</label>
              <input
                type="number"
                step="any"
                value={advanceAmount}
                onChange={(e) => setAdvanceAmount(e.target.value)}
                className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 font-mono text-sm"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-slate-700 font-semibold">Payment Method</label>
                <button
                  type="button"
                  onClick={() => setMasterModalType('paymentMethod')}
                  className="text-[11px] font-bold text-brand-600 hover:text-brand-800 flex items-center gap-0.5 cursor-pointer"
                  title="Add new bank or payment method"
                >
                  <Plus className="w-3 h-3" /> Add
                </button>
              </div>
              <select
                value={advanceMethod}
                onChange={(e) => setAdvanceMethod(e.target.value)}
                className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 font-semibold"
              >
                {paymentMethods.map(pm => (
                  <option key={pm} value={pm}>{pm}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Right: Calculations & Totals */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3 text-xs">
            <div className="flex justify-between text-slate-600">
              <span>Items Subtotal:</span>
              <span className="font-mono font-bold">{formatCurrency(subtotal)}</span>
            </div>

            <div className="flex items-center justify-between gap-4">
              <span className="text-slate-600">Discount (₹):</span>
              <input
                type="number"
                step="any"
                value={discount}
                onChange={(e) => setDiscount(e.target.value)}
                className="w-28 py-1 px-2 text-right bg-white border border-slate-200 rounded-lg font-mono text-xs"
              />
            </div>

            <div className="flex items-center justify-between gap-4">
              <span className="text-slate-600">GST Rate (%):</span>
              <select
                value={gstRate}
                onChange={(e) => setGstRate(e.target.value)}
                className="w-28 py-1 px-2 bg-white border border-slate-200 rounded-lg text-xs font-semibold"
              >
                <option value="18">18% (Standard)</option>
                <option value="12">12%</option>
                <option value="5">5%</option>
                <option value="0">0% (Nil / Exempt)</option>
              </select>
            </div>

            {/* Separated Tax Breakdown Box (Tax-Inclusive Sales) */}
            {rate > 0 && (
              <div className="bg-white p-2.5 rounded-lg border border-slate-200 space-y-1.5 text-[11px]">
                <div className="flex justify-between text-slate-500">
                  <span>Taxable Base (Excl. Tax):</span>
                  <span className="font-mono font-medium">{formatCurrency(taxableVal)}</span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>CGST ({(rate / 2).toFixed(1)}%):</span>
                  <span className="font-mono">{formatCurrency(Math.round((gstVal / 2) * 100) / 100)}</span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>SGST ({(rate / 2).toFixed(1)}%):</span>
                  <span className="font-mono">{formatCurrency(Math.round((gstVal - Math.round((gstVal / 2) * 100) / 100) * 100) / 100)}</span>
                </div>
                <div className="flex justify-between text-indigo-700 font-bold border-t border-slate-100 pt-1">
                  <span>Total Included GST ({rate}%):</span>
                  <span className="font-mono">{formatCurrency(gstVal)}</span>
                </div>
              </div>
            )}

            <div className="border-t-2 border-slate-900 pt-2 flex justify-between items-center text-sm font-black text-slate-950">
              <div>
                <span>Final Sale Amount:</span>
                <p className="text-[10px] text-emerald-700 font-normal italic">(Inclusive of all taxes)</p>
              </div>
              <span className="text-base text-brand-700 font-mono">{formatCurrency(finalSaleAmount)}</span>
            </div>

            <div className="border-t border-slate-200 pt-2 space-y-1">
              <div className="flex justify-between text-emerald-700 font-bold">
                <span>Advance Paid:</span>
                <span className="font-mono">{formatCurrency(advVal)}</span>
              </div>
              <div className="flex justify-between text-amber-700 font-bold">
                <span>Remaining Balance Due:</span>
                <span className="font-mono">{formatCurrency(balanceDue)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Submit Actions */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={handleBack}
            className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-6 py-2.5 bg-brand-600 hover:bg-brand-700 active:bg-brand-800 text-white rounded-xl text-xs font-bold shadow-md transition-all flex items-center gap-2 cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>Save Composite Sales Order</span>
          </button>
        </div>
      </form>

      {masterModalType && (
        <QuickAddMasterModal
          type={masterModalType}
          onClose={() => setMasterModalType(null)}
          onAdd={handleAddMaster}
        />
      )}
    </div>
  );
}
