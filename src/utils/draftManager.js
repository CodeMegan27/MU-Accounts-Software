/**
 * draftManager.js
 * Automatic draft preservation system (Gmail-like auto-save)
 * Prevents loss of sales orders and purchase bills during power cuts or browser crashes.
 */

import { getServerTimeISO } from './serverTime';

const ACTIVE_SALE_DRAFT_KEY = 'rsp_active_draft_sale';
const ACTIVE_BILL_DRAFT_KEY = 'rsp_active_draft_bill';
const DRAFTS_COLLECTION_KEY = 'rsp_all_drafts_collection';

// Counter key for human-readable draft numbering (e.g. DRAFT-1001)
const DRAFT_SEQ_KEY = 'rsp_draft_seq_counter';

const getNextDraftNumber = (type) => {
  try {
    const raw = localStorage.getItem(DRAFT_SEQ_KEY);
    let count = raw ? parseInt(raw, 10) : 1000;
    if (isNaN(count)) count = 1000;
    count += 1;
    localStorage.setItem(DRAFT_SEQ_KEY, String(count));
    const prefix = type === 'sale' ? 'DFT-ORD' : 'DFT-PUR';
    return `${prefix}-${count}`;
  } catch (e) {
    return `${type === 'sale' ? 'DFT-ORD' : 'DFT-PUR'}-${Date.now().toString().slice(-4)}`;
  }
};

export const createNewDraft = (type) => {
  try {
    const key = type === 'sale' ? ACTIVE_SALE_DRAFT_KEY : ACTIVE_BILL_DRAFT_KEY;
    const timestamp = getServerTimeISO();
    const draftId = `draft_${type}_${Date.now()}`;
    const draftNumber = getNextDraftNumber(type);

    const newDraft = {
      _draftId: draftId,
      _draftNumber: draftNumber,
      _draftType: type,
      _createdAt: timestamp,
      _updatedAt: timestamp
    };

    localStorage.setItem(key, JSON.stringify(newDraft));
    return newDraft;
  } catch (e) {
    console.warn('Error creating new draft:', e);
    return null;
  }
};

export const getActiveDraft = (type) => {
  try {
    const key = type === 'sale' ? ACTIVE_SALE_DRAFT_KEY : ACTIVE_BILL_DRAFT_KEY;
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    console.warn('Error reading active draft:', e);
    return null;
  }
};

export const saveActiveDraft = (type, data, logActivityFn) => {
  try {
    if (!data) return;
    const key = type === 'sale' ? ACTIVE_SALE_DRAFT_KEY : ACTIVE_BILL_DRAFT_KEY;
    const timestamp = getServerTimeISO();
    
    // Check if form has meaningful content before saving
    const hasContent = type === 'sale' 
      ? Boolean(data.customerName || data.estNo || (data.items && data.items.length > 0 && (data.items[0].description || data.items[0].amount > 0)))
      : Boolean(data.vendorName || data.invoiceNo || (data.items && data.items.length > 0 && (data.items[0].name || data.items[0].rate > 0)));

    if (!hasContent) return;

    // Reuse existing draft ID or create a single stable draft ID with human-readable draft number
    let existingActive = getActiveDraft(type);
    const draftId = data._draftId || existingActive?._draftId || `draft_${type}_${Date.now()}`;
    const draftNumber = data._draftNumber || existingActive?._draftNumber || getNextDraftNumber(type);

    const draftPayload = {
      ...data,
      _draftId: draftId,
      _draftNumber: draftNumber,
      _draftType: type,
      _updatedAt: timestamp
    };

    // 1. Save active draft
    localStorage.setItem(key, JSON.stringify(draftPayload));

    // 2. Save into all drafts collection (update in-place so only 1 record exists per draft)
    let allDrafts = getAllDrafts();
    const existingIdx = allDrafts.findIndex(d => d._draftId === draftId);
    if (existingIdx >= 0) {
      allDrafts[existingIdx] = draftPayload;
    } else {
      allDrafts = [draftPayload, ...allDrafts.slice(0, 19)]; // Keep latest 20 drafts
    }
    localStorage.setItem(DRAFTS_COLLECTION_KEY, JSON.stringify(allDrafts));

    // 3. Log to activity logs with a single stable entry (updates in-place by draftId)
    if (typeof logActivityFn === 'function') {
      const party = type === 'sale' ? (data.customerName || 'Walk-in Customer') : (data.vendorName || 'Vendor');
      const itemsCount = (data.items || []).length;
      const amt = type === 'sale' ? (data.finalAmount || data.subtotal || 0) : (data.grandTotal || 0);

      logActivityFn({
        action: 'DRAFT_SAVED',
        entityType: type === 'sale' ? 'sale_draft' : 'bill_draft',
        entityId: draftId,
        title: `Auto-saved ${type === 'sale' ? 'Sales Order' : 'Purchase Bill'} [${draftNumber}]`,
        details: `${party} • ${itemsCount} Item(s) • ₹${parseFloat(amt).toLocaleString('en-IN')}`
      });
    }

    return draftPayload;
  } catch (e) {
    console.warn('Error saving draft:', e);
  }
};

export const clearActiveDraft = (type) => {
  try {
    const key = type === 'sale' ? ACTIVE_SALE_DRAFT_KEY : ACTIVE_BILL_DRAFT_KEY;
    localStorage.removeItem(key);
  } catch (e) {
    console.warn('Error clearing active draft:', e);
  }
};

export const getAllDrafts = (typeFilter = null) => {
  try {
    const raw = localStorage.getItem(DRAFTS_COLLECTION_KEY);
    const drafts = raw ? JSON.parse(raw) : [];
    if (!typeFilter) return drafts;
    return drafts.filter(d => d._draftType === typeFilter);
  } catch (e) {
    console.warn('Error fetching all drafts:', e);
    return [];
  }
};

export const deleteDraftById = (draftId, logActivityFn) => {
  try {
    let allDrafts = getAllDrafts();
    const target = allDrafts.find(d => d._draftId === draftId);
    allDrafts = allDrafts.filter(d => d._draftId !== draftId);
    localStorage.setItem(DRAFTS_COLLECTION_KEY, JSON.stringify(allDrafts));

    // Also clear active draft if matching
    const activeSale = getActiveDraft('sale');
    if (activeSale && activeSale._draftId === draftId) clearActiveDraft('sale');
    const activeBill = getActiveDraft('bill');
    if (activeBill && activeBill._draftId === draftId) clearActiveDraft('bill');

    if (typeof logActivityFn === 'function' && target) {
      logActivityFn({
        action: 'DELETE',
        entityType: target._draftType === 'sale' ? 'sale_draft' : 'bill_draft',
        entityId: draftId,
        title: `Deleted ${target._draftType === 'sale' ? 'Sales' : 'Purchase'} Draft`,
        details: `Removed draft from local memory`
      });
    }

    return allDrafts;
  } catch (e) {
    console.warn('Error deleting draft:', e);
    return [];
  }
};

export const clearAllDrafts = () => {
  try {
    localStorage.removeItem(DRAFTS_COLLECTION_KEY);
    localStorage.removeItem(ACTIVE_SALE_DRAFT_KEY);
    localStorage.removeItem(ACTIVE_BILL_DRAFT_KEY);
    return [];
  } catch (e) {
    console.warn('Error clearing all drafts:', e);
    return [];
  }
};
