import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useData } from '../../context/DataContext';
import { useAuth } from '../../context/AuthContext';
import { useSettings } from '../../context/SettingsContext';
import { useToast } from '../../context/ToastContext';
import { calculateBillTotals, isInterStateSupply } from '../../utils/gstCalculations';
import { formatCurrency, getTodayDate } from '../../utils/formatters';
import { 
  saveActiveDraft, 
  getActiveDraft, 
  clearActiveDraft, 
  getAllDrafts, 
  deleteDraftById 
} from '../../utils/draftManager';
import { 
  ArrowLeft, 
  Plus, 
  Trash2, 
  Check, 
  UserPlus, 
  Receipt, 
  Lock, 
  CheckCircle2, 
  Sparkles, 
  Calculator,
  AlertTriangle,
  Eye,
  Save,
  Clock,
  RotateCcw,
  X,
  FileText
} from 'lucide-react';

export default function BillForm({ billId, draftBill, onBack, onQuickAddVendor, onViewBill }) {
  const { bills, vendors, items: catalogItems, saveBill, logActivity, removeDraftActivityLog } = useData();
  const { isAdmin, openLoginModal } = useAuth();
  const { profile } = useSettings();
  const { showToast } = useToast();

  const isEditing = Boolean(billId);
  const canEdit = !isEditing || isAdmin;
  const existingBill = useMemo(() => bills.find(b => b.id === billId), [bills, billId]);

  // Draft Management State
  const initialDraft = useRef(!isEditing ? getActiveDraft('bill') : null).current;
  const [activeDraftId, setActiveDraftId] = useState(initialDraft?._draftId || null);
  const [activeDraftNumber, setActiveDraftNumber] = useState(initialDraft?._draftNumber || null);
  const [showDraftBanner, setShowDraftBanner] = useState(Boolean(!isEditing && initialDraft && (initialDraft.vendorName || initialDraft.invoiceNo)));
  const [lastSavedTime, setLastSavedTime] = useState(initialDraft?._updatedAt || null);
  const [showDraftsModal, setShowDraftsModal] = useState(false);
  const [draftsList, setDraftsList] = useState(() => getAllDrafts('bill'));

  // Form State
  const [date, setDate] = useState(getTodayDate());
  const [invoiceNo, setInvoiceNo] = useState('');
  const [vendorId, setVendorId] = useState('');
  const [vendorName, setVendorName] = useState('');
  const [isGst, setIsGst] = useState(false);
  const [gstin, setGstin] = useState('');
  const [taxType, setTaxType] = useState('exclusive');
  const [taxRate, setTaxRate] = useState(18);
  const [packing, setPacking] = useState(0);
  const [discount, setDiscount] = useState(0);
  const [isRoundOff, setIsRoundOff] = useState(true);
  const [customSubtotal, setCustomSubtotal] = useState('');
  const [outstandingAmount, setOutstandingAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState([
    { name: '', uqc: 'NOS', qty: 1, rate: 0, amount: 0 }
  ]);
  const [isSaving, setIsSaving] = useState(false);
  const [showGreenTick, setShowGreenTick] = useState(false);
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);

  // Restore Draft function
  const restoreDraftData = (draft) => {
    if (!draft) return;
    if (draft.date) setDate(draft.date);
    if (draft.invoiceNo) setInvoiceNo(draft.invoiceNo);
    if (draft.vendorId) setVendorId(draft.vendorId);
    if (draft.vendorName) setVendorName(draft.vendorName);
    if (draft.isGst !== undefined) setIsGst(draft.isGst);
    if (draft.gstin) setGstin(draft.gstin);
    if (draft.taxType) setTaxType(draft.taxType);
    if (draft.taxRate !== undefined) setTaxRate(draft.taxRate);
    if (draft.packing !== undefined) setPacking(draft.packing);
    if (draft.discount !== undefined) setDiscount(draft.discount);
    if (draft.isRoundOff !== undefined) setIsRoundOff(draft.isRoundOff);
    if (draft.customSubtotal !== undefined) setCustomSubtotal(draft.customSubtotal);
    if (draft.outstandingAmount !== undefined) setOutstandingAmount(draft.outstandingAmount);
    if (draft.items && draft.items.length > 0) setItems(draft.items);
    if (draft._draftId) setActiveDraftId(draft._draftId);
    if (draft._draftNumber) setActiveDraftNumber(draft._draftNumber);
    setLastSavedTime(draft._updatedAt || new Date().toISOString());
    showToast(`Restored purchase bill draft ${draft._draftNumber ? '[' + draft._draftNumber + ']' : ''} for ${draft.vendorName || 'bill'}!`, 'success');
    setShowDraftBanner(false);
    setShowDraftsModal(false);
  };

  useEffect(() => {
    if (draftBill) {
      restoreDraftData(draftBill);
    }
  }, [draftBill]);

  const handleDiscardDraft = () => {
    clearActiveDraft('bill');
    setShowDraftBanner(false);
    showToast('Active purchase draft discarded', 'info');
  };

  // Real-Time Duplicate Voucher Detection (Same Vendor + Same Invoice Number)
  const duplicateBill = useMemo(() => {
    if (!invoiceNo.trim() || !vendorId) return null;
    const cleanInv = invoiceNo.trim().toUpperCase();
    return bills.find(b => 
      b.id !== (isEditing ? existingBill?.id : null) &&
      b.vendorId === vendorId &&
      b.invoiceNo && b.invoiceNo.trim().toUpperCase() === cleanInv
    );
  }, [invoiceNo, vendorId, bills, isEditing, existingBill]);

  // Load existing bill data if editing
  useEffect(() => {
    if (existingBill) {
      setDate(existingBill.date || getTodayDate());
      setInvoiceNo(existingBill.invoiceNo || '');
      setVendorId(existingBill.vendorId || '');
      setVendorName(existingBill.vendorName || '');
      setIsGst(Boolean(existingBill.isGst));
      setGstin(existingBill.gstin || '');
      setTaxType(existingBill.taxType || 'exclusive');
      setTaxRate(existingBill.taxRate ?? 18);
      setPacking(existingBill.packing || 0);
      setDiscount(existingBill.discount || 0);
      setIsRoundOff(existingBill.isRoundOff !== undefined ? existingBill.isRoundOff : true);
      setCustomSubtotal(existingBill.customSubtotal !== undefined && existingBill.customSubtotal !== null ? String(existingBill.customSubtotal) : '');
      setOutstandingAmount(existingBill.outstandingAmount !== undefined && existingBill.outstandingAmount !== null ? String(existingBill.outstandingAmount) : '');
      setNotes(existingBill.notes || '');
      if (existingBill.items && existingBill.items.length > 0) {
        setItems(existingBill.items.map(i => {
          const q = parseFloat(i.qty) || 1;
          const r = parseFloat(i.rate) || 0;
          const amt = i.amount !== undefined ? parseFloat(i.amount) : (q * r);
          return {
            name: i.name || '',
            uqc: i.uqc || 'NOS',
            qty: q,
            rate: r,
            amount: amt
          };
        }));
      }
    }
  }, [existingBill]);

  const handleVendorChange = (id) => {
    setVendorId(id);
    const selected = vendors.find(v => v.id === id);
    if (selected) {
      setVendorName(selected.name || '');
      const hasGst = selected.gstStatus === 'GST';
      setIsGst(hasGst);
      setGstin(selected.gstin || '');
    } else {
      setVendorName('');
      setIsGst(false);
      setGstin('');
    }
  };

  // Line Item Handlers
  const handleItemChange = (index, field, value) => {
    setItems(prev => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      if (field === 'qty' || field === 'rate') {
        const q = parseFloat(field === 'qty' ? value : copy[index].qty) || 0;
        const r = parseFloat(field === 'rate' ? value : copy[index].rate) || 0;
        copy[index].amount = parseFloat((q * r).toFixed(2));
      }
      return copy;
    });
  };

  // Admin Manual Alter of Amount Field
  const handleAmountChange = (index, newAmountVal) => {
    setItems(prev => {
      const copy = [...prev];
      const newAmt = parseFloat(newAmountVal) || 0;
      copy[index].amount = newAmt;
      const q = parseFloat(copy[index].qty) || 1;
      // Auto-recalculate unit rate to match the manual amount
      if (q > 0) {
        copy[index].rate = parseFloat((newAmt / q).toFixed(2));
      }
      return copy;
    });
  };

  const handleCatalogSelect = (index, catalogItemName) => {
    const found = catalogItems.find(c => c.name === catalogItemName);
    if (found) {
      setItems(prev => {
        const copy = [...prev];
        const q = copy[index].qty || 1;
        const r = found.defaultRate || copy[index].rate || 0;
        copy[index] = {
          ...copy[index],
          name: found.name,
          uqc: found.uqc || copy[index].uqc || 'NOS',
          rate: r,
          amount: parseFloat((q * r).toFixed(2))
        };
        return copy;
      });
    } else {
      handleItemChange(index, 'name', catalogItemName);
    }
  };

  const addItemRow = () => {
    setItems(prev => [...prev, { name: '', uqc: 'NOS', qty: 1, rate: 0, amount: 0 }]);
  };

  const removeItemRow = (index) => {
    if (items.length <= 1) {
      showToast('Bill must have at least one line item', 'error');
      return;
    }
    setItems(prev => prev.filter((_, i) => i !== index));
  };

  const isInterState = useMemo(() => {
    return isInterStateSupply(profile.gstin, gstin, profile.stateCode || "33");
  }, [profile.gstin, profile.stateCode, gstin]);

  // Vendor's current outstanding balance from system
  const vendorOutstanding = useMemo(() => {
    if (!vendorId) return 0;
    const v = vendors.find(x => x.id === vendorId);
    let bal = parseFloat(v?.openingBalance) || 0;
    bills.filter(b => b.vendorId === vendorId && b.id !== billId).forEach(b => {
      bal += (parseFloat(b.balanceAmount !== undefined ? b.balanceAmount : b.grandTotal) || 0);
    });
    return Math.max(0, bal);
  }, [vendorId, vendors, bills, billId]);

  // Recalculate totals with Round Off and optional custom/editable subtotal
  const totals = useMemo(() => {
    return calculateBillTotals({
      items,
      packing,
      discount,
      isGst,
      taxType,
      taxRate,
      isInterState,
      isRoundOff,
      customSubtotal
    });
  }, [items, packing, discount, isGst, taxType, taxRate, isInterState, isRoundOff, customSubtotal]);

  // Total Settlement Amount (Current Bill + Outstanding Payable)
  const totalWithOutstanding = useMemo(() => {
    const billTotal = parseFloat(totals.grandTotal) || 0;
    const outAmt = parseFloat(outstandingAmount) || 0;
    return billTotal + outAmt;
  }, [totals.grandTotal, outstandingAmount]);

  // Auto-Save Effect (Debounced 1000ms) - Silently preserves draft in localStorage without activity log spam
  useEffect(() => {
    if (isEditing) return; // Only auto-save for new purchase drafts
    const timer = setTimeout(() => {
      const draftData = {
        _draftId: activeDraftId,
        _draftNumber: activeDraftNumber,
        date,
        invoiceNo,
        vendorId,
        vendorName,
        isGst,
        gstin,
        taxType,
        taxRate,
        packing,
        discount,
        isRoundOff,
        customSubtotal: customSubtotal !== '' && customSubtotal !== null ? parseFloat(customSubtotal) : null,
        outstandingAmount: parseFloat(outstandingAmount) || 0,
        totalSettlementAmount: totalWithOutstanding,
        notes,
        items,
        grandTotal: totals.grandTotal
      };
      // Pass null for logActivity: Store draft silently while voucher is open
      const saved = saveActiveDraft('bill', draftData, null);
      if (saved) {
        if (!activeDraftId && saved._draftId) setActiveDraftId(saved._draftId);
        if (!activeDraftNumber && saved._draftNumber) setActiveDraftNumber(saved._draftNumber);
        setLastSavedTime(saved._updatedAt);
        setDraftsList(getAllDrafts('bill'));
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [
    isEditing, activeDraftId, activeDraftNumber, date, invoiceNo, vendorId, vendorName, isGst, gstin,
    taxType, taxRate, packing, discount, isRoundOff, customSubtotal, outstandingAmount, totalWithOutstanding, notes, items, totals.grandTotal
  ]);

  const handleManualSaveDraft = () => {
    const draftData = {
      _draftId: activeDraftId,
      _draftNumber: activeDraftNumber,
      date,
      invoiceNo,
      vendorId,
      vendorName,
      isGst,
      gstin,
      taxType,
      taxRate,
      packing,
      discount,
      isRoundOff,
      customSubtotal: customSubtotal !== '' && customSubtotal !== null ? parseFloat(customSubtotal) : null,
      outstandingAmount: parseFloat(outstandingAmount) || 0,
      totalSettlementAmount: totalWithOutstanding,
      notes,
      items,
      grandTotal: totals.grandTotal
    };
    const saved = saveActiveDraft('bill', draftData, logActivity);
    if (saved) {
      if (!activeDraftId && saved._draftId) setActiveDraftId(saved._draftId);
      if (!activeDraftNumber && saved._draftNumber) setActiveDraftNumber(saved._draftNumber);
      setLastSavedTime(saved._updatedAt);
      setDraftsList(getAllDrafts('bill'));
      showToast('Purchase bill draft saved to Activity Logs! You can resume anytime.', 'success');
    }
  };

  const handleBack = () => {
    // If voucher has entered content, save single draft log when exiting
    const hasContent = Boolean(vendorName || invoiceNo || (items && items.length > 0 && (items[0].name || items[0].rate > 0)));
    if (hasContent && !isEditing) {
      const draftData = {
        _draftId: activeDraftId,
        _draftNumber: activeDraftNumber,
        date,
        invoiceNo,
        vendorId,
        vendorName,
        isGst,
        gstin,
        taxType,
        taxRate,
        packing,
        discount,
        isRoundOff,
        notes,
        items,
        grandTotal: totals.grandTotal
      };
      saveActiveDraft('bill', draftData, logActivity);
    }
    if (onBack) onBack();
  };

  const handleRemoveDraftItem = (draftId) => {
    const updated = deleteDraftById(draftId, logActivity);
    setDraftsList(updated.filter(d => d._draftType === 'bill'));
    showToast('Draft deleted', 'info');
  };

  const handleSubmit = async (e, forceAllowDuplicate = false) => {
    if (e) e.preventDefault();
    if (isSaving) return;

    if (isEditing && !isAdmin) {
      showToast('Admin access required to save changes to existing bills. Please enter Admin PIN.', 'error');
      openLoginModal();
      return;
    }

    if (!invoiceNo.trim()) {
      showToast('Please enter an invoice number', 'error');
      return;
    }
    if (!vendorId && !vendorName.trim()) {
      showToast('Please select or specify a vendor', 'error');
      return;
    }

    // Intercept if duplicate voucher detected and user hasn't explicitly confirmed
    if (duplicateBill && !forceAllowDuplicate) {
      setShowDuplicateModal(true);
      return;
    }

    const validItems = items.filter(i => i.name && i.name.trim().length > 0 && i.qty > 0);
    if (validItems.length === 0) {
      showToast('Please enter valid items with quantity > 0', 'error');
      return;
    }

    setIsSaving(true);
    try {
      const billData = {
        id: isEditing ? existingBill.id : `B_${Date.now()}`,
        date,
        invoiceNo: invoiceNo.trim().toUpperCase(),
        vendorId,
        vendorName: vendorName.trim(),
        isGst,
        gstin: isGst ? gstin.trim().toUpperCase() : '',
        taxType: isGst ? taxType : '',
        taxRate: isGst ? parseFloat(taxRate) : 0,
        isInterState,
        packing: totals.packing,
        discount: totals.discount,
        subtotal: totals.subtotal,
        customSubtotal: customSubtotal !== '' && customSubtotal !== null ? parseFloat(customSubtotal) : null,
        outstandingAmount: parseFloat(outstandingAmount) || 0,
        totalSettlementAmount: totalWithOutstanding,
        taxableBase: totals.taxableBase,
        taxAmount: totals.taxAmount,
        cgst: totals.cgst,
        sgst: totals.sgst,
        igst: totals.igst,
        isRoundOff,
        roundOff: totals.roundOff,
        grandTotal: totals.grandTotal,
        paidAmount: existingBill ? (existingBill.paidAmount || 0) : 0,
        balanceAmount: existingBill ? (totals.grandTotal - (existingBill.paidAmount || 0)) : totals.grandTotal,
        paymentStatus: existingBill ? existingBill.paymentStatus : 'unpaid',
        paymentHistory: existingBill ? (existingBill.paymentHistory || []) : [],
        notes: notes.trim(),
        items: totals.items
      };

      await saveBill(billData);
      clearActiveDraft('bill');
      if (activeDraftId) {
        removeDraftActivityLog(activeDraftId);
      }

      // Trigger Green Tick Animation
      setShowGreenTick(true);
      setTimeout(() => {
        setShowGreenTick(false);
        showToast(isEditing ? 'Purchase bill updated!' : 'Purchase bill saved successfully!', 'success');
        onBack();
      }, 1200);

    } catch (err) {
      console.error('Failed to save bill:', err);
      showToast('Error saving purchase bill', 'error');
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-24 relative">
      {/* Draft Recovery Banner */}
      {showDraftBanner && initialDraft && (
        <div className="bg-amber-500/10 border-2 border-amber-400/50 p-4 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-amber-950 animate-in fade-in">
          <div className="flex items-center gap-2.5">
            <span className="text-xl">📝</span>
            <div>
              <p className="font-extrabold text-sm text-amber-900">Unsaved Purchase Draft Detected</p>
              <p className="text-amber-700">
                Found auto-saved purchase bill for <strong>{initialDraft.vendorName || 'Vendor'}</strong> ({initialDraft.items?.length || 1} items) from {initialDraft._updatedAt ? new Date(initialDraft._updatedAt).toLocaleTimeString() : 'earlier'}.
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

      {/* Saved Drafts Modal */}
      {showDraftsModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-5 space-y-4 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-indigo-600" />
                <h3 className="font-extrabold text-sm text-slate-900">Saved Purchase Bill Drafts</h3>
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
                      <p className="font-bold text-slate-900">{d.vendorName || 'Untitled Vendor'}</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Inv #{d.invoiceNo || 'Draft'} • {d.items?.length || 1} items • ₹{parseFloat(d.grandTotal || 0).toLocaleString('en-IN')}
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

      {/* Admin PIN Required Banner when editing an existing bill as guest */}
      {isEditing && !isAdmin && (
        <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center flex-shrink-0">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-amber-900">Admin PIN Required to Edit</h4>
              <p className="text-[11px] text-amber-700">Existing purchase bills can only be updated or altered with Admin Access.</p>
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

      {/* Top Header - No overlay clipping */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm relative z-10">
        <button
          type="button"
          onClick={handleBack}
          className="flex items-center gap-2 text-slate-500 hover:text-slate-900 font-semibold text-xs transition-colors px-2 py-1"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Register
        </button>

        {/* Draft status & Actions */}
        <div className="flex items-center gap-2 justify-end flex-wrap">
          {activeDraftNumber && !isEditing && (
            <span className="hidden sm:inline-flex items-center gap-1 font-mono text-[11px] font-black text-indigo-700 bg-indigo-50 border border-indigo-200 px-2.5 py-1 rounded-full">
              <span>{activeDraftNumber}</span>
            </span>
          )}

          {lastSavedTime && !isEditing && (
            <span className="hidden md:flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200/80 px-2.5 py-1 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>Auto-saved {new Date(lastSavedTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            </span>
          )}

          {!isEditing && (
            <>
              <button
                type="button"
                onClick={handleManualSaveDraft}
                className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors flex items-center gap-1.5"
                title="Save current progress as draft"
              >
                <Save className="w-3.5 h-3.5 text-slate-500" />
                <span>Save Draft</span>
              </button>

              {draftsList.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowDraftsModal(true)}
                  className="px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-semibold transition-colors flex items-center gap-1.5"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Drafts ({draftsList.length})</span>
                </button>
              )}
            </>
          )}

          <button
            type="button"
            onClick={handleBack}
            className="px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-xl text-xs font-semibold hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="billForm"
            disabled={!canEdit || isSaving}
            className={`flex items-center gap-2 px-6 py-2 rounded-xl text-xs font-semibold shadow-md transition-all ${
              !canEdit
                ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                : 'bg-brand-600 hover:bg-brand-700 text-white active:bg-brand-800'
            }`}
          >
            <Check className="w-4 h-4" /> {isSaving ? 'Saving...' : isEditing ? 'Update Bill' : 'Save Bill'}
          </button>
        </div>
      </div>

      <form id="billForm" onSubmit={handleSubmit} className="space-y-6">
        {/* Section 1: Vendor & Invoice Header */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-5">
          <h3 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-3 flex items-center gap-2">
            <Receipt className="w-4 h-4 text-brand-600" /> Vendor & Bill Information
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Vendor Selector */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Vendor Name <span className="text-red-500">*</span>
              </label>
              <div className="flex gap-2">
                <select
                  required
                  disabled={!canEdit}
                  value={vendorId}
                  onChange={(e) => handleVendorChange(e.target.value)}
                  className="flex-1 py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-1 focus:ring-brand-500 bg-white disabled:opacity-75"
                >
                  <option value="">Select a Vendor</option>
                  {vendors.map(v => (
                    <option key={v.id} value={v.id}>{v.name}</option>
                  ))}
                </select>
                {canEdit && (
                  <button
                    type="button"
                    onClick={onQuickAddVendor}
                    className="p-2 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-xl text-slate-700 transition-colors"
                    title="Quick Add Vendor"
                  >
                    <UserPlus className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Invoice Number */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Invoice Number <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                disabled={!canEdit}
                value={invoiceNo}
                onChange={(e) => setInvoiceNo(e.target.value)}
                placeholder="e.g. INV-1049"
                className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs uppercase font-mono focus:bg-white focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:opacity-75 font-semibold text-slate-800"
              />
            </div>

            {/* Bill Date */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Bill Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                required
                disabled={!canEdit}
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:opacity-75"
              />
            </div>
          </div>

          {/* Real-Time Duplicate Voucher Alert Banner */}
          {duplicateBill && (
            <div className="p-3.5 bg-amber-50 border-2 border-amber-300 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-in fade-in">
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h5 className="text-xs font-bold text-amber-900">⚠️ Duplicate Voucher Warning!</h5>
                  <p className="text-[11px] text-amber-800 mt-0.5 leading-relaxed">
                    Vendor <span className="font-bold underline">{vendorName}</span> already has an invoice with number <span className="font-mono font-bold bg-amber-200/70 px-1 py-0.5 rounded text-amber-950">#{duplicateBill.invoiceNo}</span> recorded on <span className="font-semibold">{duplicateBill.date}</span> (Amount: <span className="font-bold text-amber-950">₹{(parseFloat(duplicateBill.grandTotal) || 0).toLocaleString('en-IN')}</span>).
                  </p>
                </div>
              </div>
              {onViewBill && (
                <button
                  type="button"
                  onClick={() => onViewBill(duplicateBill.id)}
                  className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 flex-shrink-0 transition-all shadow-sm"
                >
                  <Eye className="w-3.5 h-3.5" /> View Existing Bill
                </button>
              )}
            </div>
          )}

          {/* GST Configuration */}
          <div className="pt-3 border-t border-slate-100">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="isGstChk"
                disabled={!canEdit}
                checked={isGst}
                onChange={(e) => setIsGst(e.target.checked)}
                className="w-4 h-4 text-brand-600 rounded border-slate-300 focus:ring-brand-500 cursor-pointer disabled:opacity-75"
              />
              <label htmlFor="isGstChk" className="text-xs font-semibold text-slate-700 select-none cursor-pointer">
                Vendor is GST Registered (Calculate Tax)
              </label>
            </div>

            {isGst && (
              <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-5 bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 uppercase mb-1">Vendor GSTIN</label>
                  <input
                    type="text"
                    disabled={!canEdit}
                    value={gstin}
                    onChange={(e) => setGstin(e.target.value)}
                    placeholder="33AAAAA0000A1Z5"
                    className="w-full py-1.5 px-3 bg-white border border-slate-200 rounded-lg text-xs font-mono uppercase focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:opacity-75"
                  />
                  {gstin && (
                    <p className="text-[10px] text-slate-500 mt-1">
                      {isInterState ? 'Inter-State Supply (IGST Applicable)' : 'Intra-State Supply (CGST + SGST Applicable)'}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 uppercase mb-1">Tax Mode</label>
                  <select
                    disabled={!canEdit}
                    value={taxType}
                    onChange={(e) => setTaxType(e.target.value)}
                    className="w-full py-1.5 px-3 bg-white border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:opacity-75"
                  >
                    <option value="exclusive">Exclusive (Added to Subtotal)</option>
                    <option value="inclusive">Inclusive (Included in Rate)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 uppercase mb-1">GST Rate (%)</label>
                  <select
                    disabled={!canEdit}
                    value={taxRate}
                    onChange={(e) => setTaxRate(e.target.value)}
                    className="w-full py-1.5 px-3 bg-white border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:opacity-75"
                  >
                    <option value="18">18% GST (Standard)</option>
                    <option value="12">12% GST</option>
                    <option value="5">5% GST (Concessional)</option>
                    <option value="28">28% GST (Luxury/Demerit)</option>
                    <option value="0">0% GST (Exempt)</option>
                  </select>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Section 2: Line Items with Editable Amount in Admin Mode */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-200 bg-slate-50/70 flex justify-between items-center">
            <div>
              <h3 className="text-base font-bold text-slate-900">Line Items & Products</h3>
              <p className="text-[11px] text-slate-500">
                {canEdit ? 'You can manually alter Qty, Rate, OR Amount directly.' : 'Admin PIN Required: View Only.'}
              </p>
            </div>
            <span className="text-xs text-slate-500 font-medium">{items.length} items entered</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse whitespace-nowrap min-w-[750px]">
              <thead>
                <tr className="bg-slate-100 text-slate-600 border-b border-slate-200 text-[11px] uppercase font-bold tracking-wider">
                  <th className="px-4 py-3 w-12 text-center">#</th>
                  <th className="px-4 py-3">Product / Service Name *</th>
                  <th className="px-4 py-3 w-28">UQC</th>
                  <th className="px-4 py-3 w-28 text-right">Qty *</th>
                  <th className="px-4 py-3 w-36 text-right">Rate (₹) *</th>
                  <th className="px-4 py-3 w-40 text-right">Amount (₹) {canEdit && <span className="text-brand-600 font-normal">(Editable)</span>}</th>
                  <th className="px-4 py-3 w-12 text-center"></th>
                </tr>
              </thead>
              <tbody className="text-xs divide-y divide-slate-100">
                {items.map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-2.5 text-center text-slate-400 font-medium">
                      {idx + 1}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex gap-1.5 items-center">
                        <input
                          type="text"
                          required
                          disabled={!canEdit}
                          value={item.name}
                          onChange={(e) => handleItemChange(idx, 'name', e.target.value)}
                          placeholder="Type or select product"
                          list={`catalog-list-${idx}`}
                          className="w-full py-1.5 px-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:bg-white focus:outline-none focus:ring-1 focus:ring-brand-500 font-medium text-slate-800 disabled:opacity-75"
                        />
                        <datalist id={`catalog-list-${idx}`}>
                          {catalogItems.map(c => (
                            <option key={c.id} value={c.name} />
                          ))}
                        </datalist>
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      <select
                        disabled={!canEdit}
                        value={item.uqc}
                        onChange={(e) => handleItemChange(idx, 'uqc', e.target.value)}
                        className="w-full py-1.5 px-2 bg-slate-50 border border-slate-200 rounded-lg text-xs bg-white focus:outline-none focus:ring-1 focus:ring-brand-500 uppercase font-mono disabled:opacity-75"
                      >
                        <option value="NOS">NOS</option>
                        <option value="KGS">KGS</option>
                        <option value="LTR">LTR</option>
                        <option value="MTR">MTR</option>
                        <option value="BOX">BOX</option>
                        <option value="PCS">PCS</option>
                        <option value="SET">SET</option>
                        <option value="PKT">PKT</option>
                      </select>
                    </td>
                    <td className="px-4 py-2.5">
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        required
                        disabled={!canEdit}
                        value={item.qty}
                        onChange={(e) => handleItemChange(idx, 'qty', e.target.value)}
                        className="w-full py-1.5 px-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-right font-mono focus:bg-white focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:opacity-75"
                      />
                    </td>
                    <td className="px-4 py-2.5">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        required
                        disabled={!canEdit}
                        value={item.rate}
                        onChange={(e) => handleItemChange(idx, 'rate', e.target.value)}
                        className="w-full py-1.5 px-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-right font-mono focus:bg-white focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:opacity-75"
                      />
                    </td>

                    {/* Amount Field: Editable when canEdit */}
                    <td className="px-4 py-2.5">
                      <div className="relative">
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 font-mono text-[10px]">₹</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          disabled={!canEdit}
                          value={item.amount}
                          onChange={(e) => handleAmountChange(idx, e.target.value)}
                          title={canEdit ? "You can manually alter the amount" : "Admin PIN Required"}
                          className={`w-full pl-5 pr-2.5 py-1.5 rounded-lg text-xs text-right font-mono font-bold focus:outline-none transition-all ${
                            canEdit 
                              ? 'bg-emerald-50/60 border border-emerald-300 text-emerald-900 focus:bg-white focus:ring-1 focus:ring-emerald-500' 
                              : 'bg-slate-100 border border-slate-200 text-slate-700 cursor-not-allowed opacity-80'
                          }`}
                        />
                      </div>
                    </td>

                    <td className="px-4 py-2.5 text-center">
                      {canEdit && (
                        <button
                          type="button"
                          onClick={() => removeItemRow(idx)}
                          className="p-1 text-slate-400 hover:text-red-500 rounded transition-colors"
                          title="Remove Item"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {canEdit && (
            <div className="p-3 bg-slate-50 border-t border-slate-200 flex justify-between items-center">
              <button
                type="button"
                onClick={addItemRow}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-50 hover:bg-brand-100 text-brand-700 rounded-lg text-xs font-semibold transition-colors"
              >
                <Plus className="w-4 h-4" /> Add Item Line
              </button>
            </div>
          )}
        </div>

        {/* Section 3: Totals, Round-Off & Pricing Breakdown */}
        <div className="flex flex-col lg:flex-row gap-6 justify-between items-start">
          {/* Notes & Round-Off Controls */}
          <div className="w-full lg:w-1/2 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Internal Remarks / Notes</label>
              <textarea
                rows="3"
                disabled={!canEdit}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Received via Transporter LR #1234, PO reference #987"
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:opacity-75"
              />
            </div>

            {/* Rounded-Off Feature Toggle */}
            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
              <div>
                <span className="font-bold text-xs text-slate-800 flex items-center gap-1.5">
                  <Calculator className="w-3.5 h-3.5 text-brand-600" /> Round Off Grand Total
                </span>
                <p className="text-[10px] text-slate-500">Automatically rounds invoice total to nearest integer rupee</p>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="roundOffToggle"
                  disabled={!canEdit}
                  checked={isRoundOff}
                  onChange={(e) => setIsRoundOff(e.target.checked)}
                  className="w-4 h-4 text-brand-600 rounded border-slate-300 focus:ring-brand-500 cursor-pointer disabled:opacity-75"
                />
                <label htmlFor="roundOffToggle" className="text-xs font-bold text-brand-700 select-none cursor-pointer">
                  {isRoundOff ? 'Rounded' : 'Exact (Paise)'}
                </label>
              </div>
            </div>
          </div>

          {/* Pricing Calculation Card */}
          <div className="w-full lg:w-1/2 bg-slate-900 text-white p-6 rounded-2xl shadow-xl space-y-3 text-xs">
            <div className="flex justify-between items-center text-slate-300">
              <div className="flex items-center gap-1.5">
                <span>Item Subtotal</span>
                {customSubtotal !== '' && customSubtotal !== null && (
                  <button
                    type="button"
                    onClick={() => setCustomSubtotal('')}
                    className="text-[9px] text-amber-300 hover:text-amber-200 underline cursor-pointer"
                    title="Reset to automatic item sum"
                  >
                    (Auto-Calc)
                  </button>
                )}
              </div>
              <div className="w-36 relative">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 font-mono">₹</span>
                <input
                  type="number"
                  step="0.01"
                  disabled={!canEdit}
                  value={customSubtotal !== '' && customSubtotal !== null ? customSubtotal : totals.subtotal.toFixed(2)}
                  onChange={(e) => setCustomSubtotal(e.target.value)}
                  className={`w-full pl-6 pr-2 py-1 bg-slate-800 border rounded-lg text-right font-mono text-white focus:outline-none focus:border-brand-500 disabled:opacity-75 ${
                    customSubtotal !== '' && customSubtotal !== null ? 'border-amber-400 text-amber-200 font-bold' : 'border-slate-700'
                  }`}
                  placeholder="0.00"
                  title="Item subtotal is editable. Edit here or line items to alter"
                />
              </div>
            </div>

            <div className="flex justify-between items-center text-slate-300">
              <span>Freight / Packing (+)</span>
              <div className="w-32 relative">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 font-mono">₹</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  disabled={!canEdit}
                  value={packing}
                  onChange={(e) => setPacking(e.target.value)}
                  className="w-full pl-6 pr-2 py-1 bg-slate-800 border border-slate-700 rounded-lg text-right font-mono text-white focus:outline-none focus:border-brand-500 disabled:opacity-75"
                />
              </div>
            </div>

            <div className="flex justify-between items-center text-slate-300">
              <span>Discount Received (-)</span>
              <div className="w-32 relative">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 font-mono">₹</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  disabled={!canEdit}
                  value={discount}
                  onChange={(e) => setDiscount(e.target.value)}
                  className="w-full pl-6 pr-2 py-1 bg-slate-800 border border-slate-700 rounded-lg text-right font-mono text-white focus:outline-none focus:border-brand-500 disabled:opacity-75"
                />
              </div>
            </div>

            {isGst && totals.taxAmount > 0 && (
              <div className="pt-2 border-t border-slate-800 space-y-1.5">
                <div className="flex justify-between text-slate-400 text-[11px]">
                  <span>Taxable Base</span>
                  <span className="font-mono">{formatCurrency(totals.taxableBase)}</span>
                </div>
                {isInterState ? (
                  <div className="flex justify-between text-brand-300 font-medium">
                    <span>IGST ({taxRate}%)</span>
                    <span className="font-mono font-bold">{formatCurrency(totals.igst)}</span>
                  </div>
                ) : (
                  <>
                    <div className="flex justify-between text-brand-300 font-medium">
                      <span>CGST ({(taxRate / 2)}%)</span>
                      <span className="font-mono font-bold">{formatCurrency(totals.cgst)}</span>
                    </div>
                    <div className="flex justify-between text-brand-300 font-medium">
                      <span>SGST ({(taxRate / 2)}%)</span>
                      <span className="font-mono font-bold">{formatCurrency(totals.sgst)}</span>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Round Off Line */}
            {isRoundOff && Math.abs(totals.roundOff) > 0 && (
              <div className="flex justify-between items-center text-slate-400 text-[11px] pt-1">
                <span>Round Off (+ / -)</span>
                <span className="font-mono font-semibold text-brand-300">
                  {totals.roundOff >= 0 ? `+₹${totals.roundOff.toFixed(2)}` : `-₹${Math.abs(totals.roundOff).toFixed(2)}`}
                </span>
              </div>
            )}

            <div className="pt-3 border-t border-slate-700 flex justify-between items-center text-base">
              <div>
                <span className="font-extrabold text-white">Grand Total (Bill)</span>
                {isRoundOff && (
                  <span className="block text-[10px] text-slate-400 font-normal">Rounded to nearest ₹</span>
                )}
              </div>
              <span className="font-extrabold text-brand-400 font-mono text-xl">
                {formatCurrency(totals.grandTotal)}
              </span>
            </div>

            {/* Outstanding Payable Entry Box */}
            <div className="pt-3 border-t border-slate-800 space-y-2">
              <div className="flex justify-between items-center text-slate-300">
                <div>
                  <span className="font-bold text-amber-300">Outstanding Payable (+)</span>
                  {vendorOutstanding > 0 && (
                    <span className="block text-[10px] text-slate-400 font-mono">
                      Current Due: ₹{vendorOutstanding.toLocaleString('en-IN')}
                    </span>
                  )}
                </div>
                <div className="w-36 relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 font-mono">₹</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    disabled={!canEdit}
                    value={outstandingAmount}
                    onChange={(e) => setOutstandingAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full pl-6 pr-2 py-1.5 bg-slate-800 border border-amber-500/60 rounded-lg text-right font-mono text-amber-200 font-bold focus:outline-none focus:border-amber-400 disabled:opacity-75"
                    title="Enter previous outstanding payable amount paid with this bill"
                  />
                </div>
              </div>

              {parseFloat(outstandingAmount) > 0 && (
                <div className="p-2.5 bg-amber-950/40 border border-amber-500/30 rounded-xl flex justify-between items-center text-amber-300">
                  <div>
                    <span className="font-black text-xs text-white">Total Settlement Amount</span>
                    <span className="block text-[10px] text-amber-400/80">Bill Total + Outstanding Paid</span>
                  </div>
                  <span className="font-mono text-lg font-black text-amber-300">
                    {formatCurrency(totalWithOutstanding)}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </form>

      {/* Duplicate Voucher Confirmation Modal */}
      {showDuplicateModal && duplicateBill && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl p-6 sm:p-7 shadow-2xl border border-slate-200 max-w-md w-full animate-in zoom-in-95 duration-200">
            <div className="w-14 h-14 rounded-2xl bg-amber-100 text-amber-600 border border-amber-200 flex items-center justify-center mx-auto mb-4 shadow-sm">
              <AlertTriangle className="w-7 h-7" />
            </div>
            <h3 className="text-lg font-black text-slate-900 text-center tracking-tight">Duplicate Voucher Alert</h3>
            <div className="bg-amber-50/80 border border-amber-200 rounded-2xl p-4 mt-3 text-left">
              <p className="text-xs text-amber-900 leading-relaxed font-medium">
                Vendor <span className="font-bold underline">{vendorName}</span> already has an invoice with number <span className="font-mono font-bold bg-amber-200/80 px-1.5 py-0.5 rounded text-amber-950">#{invoiceNo.toUpperCase()}</span> in your purchase register:
              </p>
              <div className="mt-2.5 pt-2 border-t border-amber-200/60 text-[11px] text-amber-800 space-y-1">
                <div>• Bill Date: <span className="font-semibold">{duplicateBill.date}</span></div>
                <div>• Grand Total: <span className="font-semibold text-amber-950 font-mono">₹{(parseFloat(duplicateBill.grandTotal) || 0).toLocaleString('en-IN')}</span></div>
                <div>• Payment Status: <span className="font-semibold uppercase">{duplicateBill.paymentStatus || 'paid'}</span></div>
              </div>
            </div>
            <p className="text-xs text-slate-500 text-center mt-3">
              Saving this will create a duplicate voucher under this vendor. Would you like to review or save anyway?
            </p>

            <div className="mt-6 flex flex-col sm:flex-row gap-2.5">
              <button
                type="button"
                onClick={() => setShowDuplicateModal(false)}
                className="flex-1 py-2.5 px-4 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-700 rounded-xl text-xs font-semibold transition-colors"
              >
                Cancel & Edit No
              </button>
              {onViewBill && (
                <button
                  type="button"
                  onClick={() => {
                    setShowDuplicateModal(false);
                    onViewBill(duplicateBill.id);
                  }}
                  className="py-2.5 px-3 bg-brand-50 hover:bg-brand-100 text-brand-700 rounded-xl text-xs font-semibold transition-colors flex items-center justify-center gap-1"
                >
                  <Eye className="w-3.5 h-3.5" /> Check Existing
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setShowDuplicateModal(false);
                  handleSubmit(null, true);
                }}
                className="flex-1 py-2.5 px-4 bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white rounded-xl text-xs font-semibold transition-colors shadow-sm"
              >
                Save Duplicate Anyway
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
