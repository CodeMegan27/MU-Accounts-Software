import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { db, auth, BASE_COLLECTION_PATH } from '../config/firebase';
import { 
  collection, 
  doc, 
  setDoc, 
  deleteDoc, 
  onSnapshot 
} from 'firebase/firestore';
import { signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import septemberSalesFull from '../data/september2026FullSales.json';
import daybook2026Full from '../data/daybook2026Full.json';
import defaultMasterItems from '../data/defaultMasterItems.json';
import { 
  getServerTime, 
  getServerTimeISO, 
  syncServerTime, 
  getServerSyncStatus, 
  formatServerTimestamp 
} from '../utils/serverTime';

const DataContext = createContext(null);

export const DEFAULT_BRANCHES = ['KLK', 'RMD'];
export const DEFAULT_DEPARTMENTS = ['ADVERTISEMENT', 'INVITATION', 'PRINT & PACK', 'GENERAL ADMIN'];
export const DEFAULT_EXPENSE_CATEGORIES = [
  'Office Rent',
  'Salaries & Wages',
  'Electricity & Water',
  'Maintenance & Repairs',
  'Freight & Transport',
  'Tea & Refreshments',
  'Printing & Stationery',
  'Travel & Conveyance',
  'Audit & Legal Fees',
  'Other Indirect'
];
export const DEFAULT_PAYMENT_METHODS = ['CASH', 'GPAY- SBI', 'GPAY- IDBI', 'BANK TRANSFER', 'CHEQUE'];

export const ensureSaleTaxSeparated = (s) => {
  const finalAmount = parseFloat(s.finalAmount !== undefined ? s.finalAmount : s.subtotal) || 0;
  let gstRate = parseFloat(s.gstRate) || 18;
  let gstAmount = parseFloat(s.gstAmount) || 0;
  let taxableAmount = parseFloat(s.taxableAmount) || 0;

  if ((!gstAmount || gstAmount === 0) && finalAmount > 0) {
    gstRate = 18;
    gstAmount = Math.round(((finalAmount * gstRate) / (100 + gstRate)) * 100) / 100;
    taxableAmount = Math.round((finalAmount - gstAmount) * 100) / 100;
  } else if (!taxableAmount && finalAmount > 0) {
    taxableAmount = Math.round((finalAmount - gstAmount) * 100) / 100;
  }

  const phone = s.contact || s.customerPhone || s.mobile || s.phone || s.contactNo || '';

  return {
    ...s,
    customerPhone: phone,
    contact: phone,
    gstRate,
    gstAmount,
    taxableAmount,
    finalAmount
  };
};

export const isPaymentCash = (method) => {
  if (!method) return true;
  const m = String(method).trim().toUpperCase();
  return m === 'CASH' || m.includes('CASH');
};

export const generateDaybookEntriesFromSale = (sale) => {
  if (!sale) return [];
  const entries = [];
  const branch = sale.branch || 'KLK';
  const dept = sale.department || 'OFFSET';
  const cust = sale.customerName || 'Walk-in Customer';
  const estNo = sale.estNo ? String(sale.estNo) : '';
  const saleId = sale.id;

  if (Array.isArray(sale.payments) && sale.payments.length > 0) {
    sale.payments.forEach((p, idx) => {
      const amt = parseFloat(p.amount) || 0;
      if (amt <= 0) return;
      const method = p.method || sale.advanceMethod || 'CASH';
      const isCash = isPaymentCash(method);
      const date = p.date || sale.invDate || sale.orderDate || new Date().toISOString().substring(0, 10);

      entries.push({
        id: `db_sale_${saleId}_${p.id || idx}`,
        rowIdx: Date.now() + idx,
        date,
        estNo,
        payment: method,
        branch,
        department: dept,
        category: 'SALES',
        description: `${cust} (Est #${estNo || 'NA'})`,
        cashCredit: isCash ? amt : 0,
        cashDebit: 0,
        bankCredit: !isCash ? amt : 0,
        bankDebit: 0,
        balanceNote: sale.balanceAmount > 0 ? `Bal: ₹${sale.balanceAmount}` : 'FULL PAID',
        matchedSaleId: saleId,
        matchedCustomer: cust
      });
    });
  } else {
    const paid = parseFloat(sale.paidAmount) || 0;
    if (paid > 0) {
      const method = sale.advanceMethod || 'CASH';
      const isCash = isPaymentCash(method);
      const date = sale.invDate || sale.orderDate || new Date().toISOString().substring(0, 10);

      entries.push({
        id: `db_sale_${saleId}_adv`,
        rowIdx: Date.now(),
        date,
        estNo,
        payment: method,
        branch,
        department: dept,
        category: 'SALES',
        description: `${cust} (Est #${estNo || 'NA'})`,
        cashCredit: isCash ? paid : 0,
        cashDebit: 0,
        bankCredit: !isCash ? paid : 0,
        bankDebit: 0,
        balanceNote: sale.balanceAmount > 0 ? `Bal: ₹${sale.balanceAmount}` : 'FULL PAID',
        matchedSaleId: saleId,
        matchedCustomer: cust
      });
    }
  }
  return entries;
};


export const sanitizeProductItems = (list) => {
  if (!Array.isArray(list)) return [];
  return list.filter(it => {
    if (!it || !it.name) return false;
    if (it.category === 'SERVICES & LABOUR' || it.uqc === 'SRV') return false;
    const name = it.name.toUpperCase();
    if (
      name.includes('CHARGE') ||
      name.includes('COMPOSING') ||
      name.includes('BINDING') ||
      name.includes('OFFSET PRINT') ||
      name.includes('SCREEN PRINT') ||
      name.includes('TRANSPORT') ||
      name.includes('RENT')
    ) {
      return false;
    }
    return true;
  });
};

export const extractExpensesFromDaybook = (daybookList) => {
  if (!Array.isArray(daybookList)) return [];
  return daybookList
    .filter(e => ((parseFloat(e.cashDebit) || 0) + (parseFloat(e.bankDebit) || 0)) > 0)
    .map(e => {
      const cashDeb = parseFloat(e.cashDebit) || 0;
      const bankDeb = parseFloat(e.bankDebit) || 0;
      const totalAmount = cashDeb + bankDeb;
      const method = cashDeb > 0 ? 'CASH' : (e.payment || 'BANK TRANSFER');
      return {
        id: `exp_${e.id || e.rowIdx}`,
        date: e.date,
        voucherNo: e.estNo ? `DB-${e.estNo}` : `DB-VCH-${e.rowIdx}`,
        branch: e.branch || 'KLK',
        department: e.department || 'GENERAL ADMIN',
        category: e.category || 'General Operating',
        payee: e.description || e.category,
        description: e.description || e.category,
        paymentMethod: method,
        amount: totalAmount,
        daybookRefId: e.id,
        isSyncedFromDaybook: true
      };
    });
};

export const isDaybookEntryAssociated = (item, bills = [], assets = [], expenses = [], vendors = []) => {
  if (!item) return false;

  const cat = (item.category || '').trim().toUpperCase();

  // 1. Explicit non-associated demo entries to wipe out
  if (
    cat === 'SALES' ||
    Boolean(item.matchedSaleId) ||
    cat === 'PRIVATE FINANCE' ||
    cat === 'CASH DEPOSIT' ||
    cat === 'RS CAPITAL' ||
    cat === 'OTHER INCOME' ||
    cat === 'INTERCASH' ||
    cat === 'FRAME RETURN' ||
    cat === 'FRAME SECURITY DEPOSIT' ||
    cat === 'AMOUNT RETURN'
  ) {
    return false;
  }

  // 2. Associated with Purchase Register (Vendor Payments, Purchases, Bills)
  if (
    cat === 'VENDOR PAYMENT' ||
    cat === 'PURCHASE' ||
    cat === 'PURCHASE BILL' ||
    Boolean(item.billId) ||
    Boolean(item.matchedBillId) ||
    (typeof item.id === 'string' && (item.id.startsWith('db_bill_') || item.id.startsWith('db_pur_')))
  ) {
    return true;
  }

  // 3. Associated with Fixed Asset Register (Capital Goods, Machinery, Asset bills)
  if (
    cat === 'CAPITAL GOODS' ||
    cat === 'CAPITAL ASSETS' ||
    cat === 'ASSET BILL' ||
    cat === 'FIXED ASSET' ||
    Boolean(item.assetId) ||
    Boolean(item.matchedAssetId) ||
    (typeof item.id === 'string' && item.id.startsWith('db_ast_'))
  ) {
    return true;
  }

  // 4. Associated with Expense Register (Operational Expenses & Overhead Disbursements)
  const knownExpenseCats = [
    'STAFF WELFARE',
    'FUEL',
    'LOCAL TRANSPORT',
    'GOODS TRANSPORT',
    'PACKING EXPENSES',
    'STATIONERY',
    'INSTALLATION EXPENSES',
    'CLEANING',
    'WORKER REIMBURSEMENT',
    'TELECOM',
    'REPAIR & MAINTENANCE',
    'SALARY',
    'LEASE AMOUNT',
    'VEHICLE MAINTENANCE',
    'SYSTEM MAINTENANCE',
    'LABOUR WAGES',
    'LABOUR OFFICE PAYMENT',
    'RS SALARY',
    'OFFICE RENT',
    'SALARIES & WAGES',
    'ELECTRICITY & WATER',
    'MAINTENANCE & REPAIRS',
    'FREIGHT & TRANSPORT',
    'TEA & REFRESHMENTS',
    'PRINTING & STATIONERY',
    'TRAVEL & CONVEYANCE',
    'AUDIT & LEGAL FEES',
    'OTHER INDIRECT',
    'EXPENSE',
    'EXPENSES',
    'GENERAL OPERATING'
  ];

  if (
    Boolean(item.expenseId) ||
    Boolean(item.matchedExpenseId) ||
    item.isSyncedFromDaybook === true ||
    (typeof item.id === 'string' && item.id.startsWith('exp_')) ||
    knownExpenseCats.includes(cat) ||
    (Array.isArray(expenses) && expenses.some(e => e.daybookRefId === item.id || e.id === item.id || (e.category && e.category.toUpperCase() === cat)))
  ) {
    return true;
  }

  // If item is a debit expense that doesn't belong to any demo category
  const hasDebit = ((parseFloat(item.cashDebit) || 0) + (parseFloat(item.bankDebit) || 0)) > 0;
  if (hasDebit && (cat.includes('EXPENSE') || cat.includes('TRANSPORT') || cat.includes('MAINTENANCE') || cat.includes('SALARY') || cat.includes('WELFARE') || cat.includes('RENT') || cat.includes('WAGES'))) {
    return true;
  }

  return false;
};

export const sanitizeLogs = (logList) => {
  if (!Array.isArray(logList)) return [];
  const seenDrafts = new Set();
  const result = [];
  for (const log of logList) {
    if (log.action === 'DRAFT_SAVED') {
      const key = log.entityId || log.title;
      if (seenDrafts.has(key)) {
        continue;
      }
      seenDrafts.add(key);
    }
    result.push(log);
  }
  return result;
};

export function DataProvider({ children }) {
  const [bills, setBills] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [items, setItems] = useState(() => {
    try {
      const stored = localStorage.getItem('rspItems');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const sanitized = sanitizeProductItems(parsed);
          if (sanitized.length > 0) return sanitized;
        }
      }
      return defaultMasterItems;
    } catch (e) {
      return defaultMasterItems;
    }
  });
  const [expenses, setExpenses] = useState(() => {
    try {
      const stored = localStorage.getItem('rspExpenses');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
      return extractExpensesFromDaybook(daybook2026Full);
    } catch (e) {
      return extractExpensesFromDaybook(daybook2026Full);
    }
  });
  const [assets, setAssets] = useState([]);
  const [recycleBin, setRecycleBin] = useState([]);
  const [logs, setLogs] = useState([]);

  // Add an entry to Audit Activity Logs with Real-World Server Time (Declared early to prevent TDZ)
  const logActivity = useCallback(async ({ action, entityType, entityId, title, details, userRole = 'admin' }) => {
    const accurateTimestamp = getServerTimeISO();
    const accurateNow = getServerTime().getTime();
    const logId = `LOG_${accurateNow}_${Math.random().toString(36).substr(2, 4)}`;
    const logEntry = {
      id: logId,
      timestamp: accurateTimestamp,
      action, // 'CREATE' | 'UPDATE' | 'DELETE' | 'RESTORE' | 'PURGE' | 'PAYMENT' | 'DRAFT_SAVED'
      entityType, // 'bill' | 'vendor' | 'item' | 'expense' | 'asset' | 'sale_draft' | 'bill_draft'
      entityId,
      title: title || 'Activity Recorded',
      details: details || '',
      userRole
    };

    setLogs(prev => {
      // If updating a draft, replace the previous draft log for this entityId so only 1 single draft record exists
      let updated;
      if (action === 'DRAFT_SAVED' && entityId) {
        const existingIdx = prev.findIndex(l => 
          l.action === 'DRAFT_SAVED' && (l.entityId === entityId || (title && l.title === title))
        );
        if (existingIdx >= 0) {
          const copy = [...prev];
          copy[existingIdx] = {
            ...copy[existingIdx],
            ...logEntry,
            id: copy[existingIdx].id // Keep original ID for stability
          };
          updated = copy;
        } else {
          updated = [logEntry, ...prev.slice(0, 499)];
        }
      } else {
        updated = [logEntry, ...prev.slice(0, 499)]; // Keep latest 500 logs
      }
      const sanitized = sanitizeLogs(updated);
      try {
        localStorage.setItem('rspLogs', JSON.stringify(sanitized));
      } catch (e) {}
      return sanitized;
    });

    // Cloud persist with timeout
    if (navigator.onLine && db) {
      try {
        await setDoc(doc(db, BASE_COLLECTION_PATH, 'audit_logs', logId), logEntry);
      } catch (e) {
        // Fail silently for log persistence
      }
    }
  }, []);

  const removeDraftActivityLog = useCallback((draftId) => {
    if (!draftId) return;
    setLogs(prev => {
      const filtered = prev.filter(l => !(l.action === 'DRAFT_SAVED' && l.entityId === draftId));
      try {
        localStorage.setItem('rspLogs', JSON.stringify(filtered));
      } catch (e) {}
      return filtered;
    });
  }, []);
  const [sales, setSales] = useState(() => {
    try {
      const isWiped = localStorage.getItem('rsp_sales_wiped') === 'true';
      if (isWiped) return [];
      const stored = localStorage.getItem('rspSales');
      if (stored !== null) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          return parsed.map(ensureSaleTaxSeparated);
        }
      }
      return septemberSalesFull.map(ensureSaleTaxSeparated);
    } catch (e) {
      return [];
    }
  });

  // Enterprise Dynamic Masters
  const [branches, setBranches] = useState(() => {
    try {
      const s = localStorage.getItem('rsp_branches');
      return s ? JSON.parse(s) : DEFAULT_BRANCHES;
    } catch (e) {
      return DEFAULT_BRANCHES;
    }
  });

  const [departments, setDepartments] = useState(() => {
    try {
      const s = localStorage.getItem('rsp_departments');
      return s ? JSON.parse(s) : DEFAULT_DEPARTMENTS;
    } catch (e) {
      return DEFAULT_DEPARTMENTS;
    }
  });

  const [expenseCategories, setExpenseCategories] = useState(() => {
    try {
      const s = localStorage.getItem('rsp_expense_categories');
      return s ? JSON.parse(s) : DEFAULT_EXPENSE_CATEGORIES;
    } catch (e) {
      return DEFAULT_EXPENSE_CATEGORIES;
    }
  });

  const [paymentMethods, setPaymentMethods] = useState(() => {
    try {
      const s = localStorage.getItem('rsp_payment_methods');
      return s ? JSON.parse(s) : DEFAULT_PAYMENT_METHODS;
    } catch (e) {
      return DEFAULT_PAYMENT_METHODS;
    }
  });

  const [customVouchers, setCustomVouchers] = useState(() => {
    try {
      const s = localStorage.getItem('rsp_custom_vouchers');
      return s ? JSON.parse(s) : [];
    } catch (e) {
      return [];
    }
  });

  // Day Book Transactions (Chronological Cash & Bank Ledger)
  const [daybookTransactions, setDaybookTransactions] = useState(() => {
    try {
      const s = localStorage.getItem('rsp_daybook_transactions');
      if (s) {
        const parsed = JSON.parse(s);
        if (Array.isArray(parsed)) {
          // Filter to retain only verified entries associated with Purchases, Fixed Assets, and Expenses
          const cleaned = parsed.filter(e => isDaybookEntryAssociated(e));
          try {
            localStorage.setItem('rsp_daybook_transactions', JSON.stringify(cleaned));
            localStorage.setItem('rsp_daybook_demo_wiped', 'true');
          } catch (err) {}
          return cleaned;
        }
      }
      const initialCleaned = daybook2026Full.filter(e => isDaybookEntryAssociated(e));
      try {
        localStorage.setItem('rsp_daybook_transactions', JSON.stringify(initialCleaned));
        localStorage.setItem('rsp_daybook_demo_wiped', 'true');
      } catch (err) {}
      return initialCleaned;
    } catch (e) {
      return daybook2026Full.filter(e => isDaybookEntryAssociated(e));
    }
  });

  const addDaybookTransaction = useCallback((newEntry) => {
    const entry = {
      id: newEntry.id || `db_${newEntry.date || new Date().toISOString().substring(0, 10)}_${Date.now()}`,
      rowIdx: Date.now(),
      date: newEntry.date,
      estNo: newEntry.estNo || '',
      payment: newEntry.payment || 'CASH',
      branch: newEntry.branch || 'KLK',
      department: newEntry.department || 'OFFSET',
      category: newEntry.category || 'GENERAL OPERATING',
      description: newEntry.description || '',
      cashCredit: parseFloat(newEntry.cashCredit) || 0,
      cashDebit: parseFloat(newEntry.cashDebit) || 0,
      bankCredit: parseFloat(newEntry.bankCredit) || 0,
      bankDebit: parseFloat(newEntry.bankDebit) || 0,
      balanceNote: newEntry.balanceNote || '',
      billId: newEntry.billId || null,
      assetId: newEntry.assetId || null,
      expenseId: newEntry.expenseId || null,
      matchedSaleId: newEntry.matchedSaleId || null,
      matchedCustomer: newEntry.matchedCustomer || null
    };

    setDaybookTransactions(prev => {
      const updated = [entry, ...prev];
      try {
        localStorage.setItem('rsp_daybook_transactions', JSON.stringify(updated));
      } catch (err) {}
      return updated;
    });
    return entry;
  }, []);

  const updateDaybookTransaction = useCallback((id, updated) => {
    setDaybookTransactions(prev => {
      const mapped = prev.map(item => {
        if (item.id === id) {
          return {
            ...item,
            ...updated,
            cashCredit: parseFloat(updated.cashCredit) || 0,
            cashDebit: parseFloat(updated.cashDebit) || 0,
            bankCredit: parseFloat(updated.bankCredit) || 0,
            bankDebit: parseFloat(updated.bankDebit) || 0
          };
        }
        return item;
      });
      try {
        localStorage.setItem('rsp_daybook_transactions', JSON.stringify(mapped));
      } catch (err) {}
      return mapped;
    });
  }, []);

  const deleteDaybookTransaction = useCallback((id) => {
    setDaybookTransactions(prev => {
      const updated = prev.filter(item => item.id !== id);
      try {
        localStorage.setItem('rsp_daybook_transactions', JSON.stringify(updated));
      } catch (err) {}
      return updated;
    });
  }, []);

  const cleanNonRegisterDaybookEntries = useCallback(() => {
    let removedCount = 0;
    setDaybookTransactions(prev => {
      const initialCount = prev.length;
      const cleaned = prev.filter(e => isDaybookEntryAssociated(e, bills, assets, expenses, vendors));
      removedCount = initialCount - cleaned.length;
      try {
        localStorage.setItem('rsp_daybook_transactions', JSON.stringify(cleaned));
        localStorage.setItem('rsp_daybook_demo_wiped', 'true');
      } catch (e) {}
      return cleaned;
    });

    logActivity({
      action: 'CLEAN_DAYBOOK',
      entityType: 'daybook',
      entityId: 'ALL',
      title: 'Wiped Non-Register Demo Entries from Day Book',
      details: `Removed ${removedCount} demo transactions. Retained verified Purchase, Asset, and Expense ledger entries.`
    });

    return removedCount;
  }, [bills, assets, expenses, vendors, logActivity]);

  const resetDaybookToDefault = useCallback(() => {
    const cleanedDefault = daybook2026Full.filter(e => isDaybookEntryAssociated(e, bills, assets, expenses, vendors));
    setDaybookTransactions(cleanedDefault);
    try {
      localStorage.setItem('rsp_daybook_transactions', JSON.stringify(cleanedDefault));
      localStorage.setItem('rsp_daybook_demo_wiped', 'true');
    } catch (e) {}
    logActivity({
      action: 'RESET_DAYBOOK',
      entityType: 'daybook',
      entityId: 'ALL',
      title: 'Reset Day Book to Authoritative Ledger',
      details: `Initialized with ${cleanedDefault.length} verified Purchase, Asset, and Expense entries.`
    });
  }, [bills, assets, expenses, vendors, logActivity]);

  // Bank Statements (Imported official SBI & IDBI e-statements)
  const [bankStatements, setBankStatements] = useState(() => {
    try {
      const s = localStorage.getItem('rsp_bank_statements');
      return s ? JSON.parse(s) : { idbi: [], sbi: [] };
    } catch (e) {
      return { idbi: [], sbi: [] };
    }
  });

  const saveBankStatements = useCallback((bankKey, newEntries, mode = 'append') => {
    const key = (bankKey || 'idbi').toLowerCase();
    setBankStatements(prev => {
      const currentList = prev[key] || [];
      const updatedList = mode === 'replace' ? newEntries : [...currentList, ...newEntries];
      const next = { ...prev, [key]: updatedList };
      try {
        localStorage.setItem('rsp_bank_statements', JSON.stringify(next));
      } catch (e) {}
      return next;
    });
  }, []);

  const deleteBankStatementEntry = useCallback((bankKey, entryId) => {
    const key = (bankKey || 'idbi').toLowerCase();
    setBankStatements(prev => {
      const currentList = prev[key] || [];
      const updatedList = currentList.filter(e => e.id !== entryId);
      const next = { ...prev, [key]: updatedList };
      try {
        localStorage.setItem('rsp_bank_statements', JSON.stringify(next));
      } catch (e) {}
      return next;
    });
  }, []);

  const clearBankStatements = useCallback((bankKey) => {
    const key = (bankKey || 'idbi').toLowerCase();
    setBankStatements(prev => {
      const next = { ...prev, [key]: [] };
      try {
        localStorage.setItem('rsp_bank_statements', JSON.stringify(next));
      } catch (e) {}
      return next;
    });
  }, []);

  useEffect(() => {
    try { localStorage.setItem('rsp_custom_vouchers', JSON.stringify(customVouchers)); } catch (e) {}
  }, [customVouchers]);

  useEffect(() => {
    try { localStorage.setItem('rsp_branches', JSON.stringify(branches)); } catch (e) {}
  }, [branches]);

  useEffect(() => {
    try { localStorage.setItem('rsp_departments', JSON.stringify(departments)); } catch (e) {}
  }, [departments]);

  useEffect(() => {
    try { localStorage.setItem('rsp_expense_categories', JSON.stringify(expenseCategories)); } catch (e) {}
  }, [expenseCategories]);

  useEffect(() => {
    try { localStorage.setItem('rsp_payment_methods', JSON.stringify(paymentMethods)); } catch (e) {}
  }, [paymentMethods]);
  
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isCloudSynced, setIsCloudSynced] = useState(false);
  const [loading, setLoading] = useState(true);

  // Offline Sync Queue: stores { action: 'set'|'delete', col, id, data, timestamp }
  const [pendingSyncQueue, setPendingSyncQueue] = useState(() => {
    try {
      const q = localStorage.getItem('rsp_pending_sync_queue');
      return q ? JSON.parse(q) : [];
    } catch (e) {
      return [];
    }
  });

  const isSyncingRef = useRef(false);

  useEffect(() => {
    localStorage.setItem('rsp_pending_sync_queue', JSON.stringify(pendingSyncQueue));
  }, [pendingSyncQueue]);

  // Merge snapshot with local pending queue so offline entries are NEVER overwritten
  const mergeSnapshotWithPendingQueue = useCallback((snapshotList, colName, normalizeFn) => {
    let currentQueue = [];
    try {
      const raw = localStorage.getItem('rsp_pending_sync_queue');
      if (raw) currentQueue = JSON.parse(raw);
    } catch (e) {}

    const colQueue = currentQueue.filter(x => x.col === colName);
    const map = new Map();

    // 1. Add server/cached snapshot items
    snapshotList.forEach(item => {
      const isPending = colQueue.some(q => q.action === 'set' && q.id === item.id);
      map.set(item.id, { ...item, _isPendingSync: isPending });
    });

    // 2. Add or update items currently in pending offline queue
    colQueue.forEach(qItem => {
      if (qItem.action === 'set') {
        const normalized = normalizeFn ? normalizeFn(qItem.data, qItem.id) : qItem.data;
        map.set(qItem.id, { ...normalized, _isPendingSync: true });
      } else if (qItem.action === 'delete') {
        map.delete(qItem.id);
      }
    });

    return Array.from(map.values());
  }, []);

  // Normalize bill data ensuring previous historical entries default to PAID
  const normalizeBill = (data, docId) => {
    const grandTotal = parseFloat(data.grandTotal) || 0;
    let paymentStatus = data.paymentStatus;
    let paidAmount = data.paidAmount !== undefined ? parseFloat(data.paidAmount) : undefined;
    let balanceAmount = data.balanceAmount !== undefined ? parseFloat(data.balanceAmount) : undefined;

    if (!paymentStatus || paymentStatus === 'pending') {
      paymentStatus = 'paid';
      paidAmount = grandTotal;
      balanceAmount = 0;
    } else {
      paidAmount = paidAmount !== undefined ? paidAmount : (paymentStatus === 'paid' ? grandTotal : 0);
      balanceAmount = balanceAmount !== undefined ? balanceAmount : (grandTotal - paidAmount);
    }

    return {
      ...data,
      id: data.id || docId,
      grandTotal,
      paidAmount,
      balanceAmount: balanceAmount < 0 ? 0 : balanceAmount,
      paymentStatus,
      paymentHistory: data.paymentHistory || [],
      _isPendingSync: Boolean(data._isPendingSync)
    };
  };

  // Server time background synchronization (ensures activity logs and entries reflect real-world time)
  useEffect(() => {
    syncServerTime();
    const interval = setInterval(syncServerTime, 5 * 60 * 1000);
    window.addEventListener('online', syncServerTime);
    return () => {
      clearInterval(interval);
      window.removeEventListener('online', syncServerTime);
    };
  }, []);


  const clearAllDraftLogs = useCallback(() => {
    setLogs(prev => {
      const updated = prev.filter(l => l.action !== 'DRAFT_SAVED' && !l.entityType?.includes('draft'));
      try {
        localStorage.setItem('rspLogs', JSON.stringify(updated));
      } catch (e) {}
      return updated;
    });
  }, []);

  // Flush pending offline changes to Firestore
  const syncPendingQueue = useCallback(async () => {
    if (!navigator.onLine || !db || isSyncingRef.current || pendingSyncQueue.length === 0) {
      return;
    }

    isSyncingRef.current = true;
    const queueToProcess = [...pendingSyncQueue];
    const failedItems = [];

    for (const item of queueToProcess) {
      try {
        if (item.action === 'set') {
          await setDoc(doc(db, BASE_COLLECTION_PATH, item.col, item.id), item.data);
        } else if (item.action === 'delete') {
          await deleteDoc(doc(db, BASE_COLLECTION_PATH, item.col, item.id));
        }
      } catch (err) {
        console.warn(`Failed to sync item ${item.id} to ${item.col}, will retry:`, err);
        failedItems.push(item);
      }
    }

    setPendingSyncQueue(failedItems);
    isSyncingRef.current = false;
    setIsCloudSynced(true);

    // Update _isPendingSync flags in state
    setBills(prev => prev.map(b => ({
      ...b,
      _isPendingSync: failedItems.some(f => f.col === 'bills' && f.id === b.id)
    })));
  }, [pendingSyncQueue]);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      if (auth && !auth.currentUser) {
        signInAnonymously(auth).catch(() => {});
      }
      setTimeout(() => {
        syncPendingQueue();
      }, 500);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setIsCloudSynced(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [syncPendingQueue]);

  // Auto-purge recycle bin entries older than 3 days
  const cleanExpiredRecycleBin = useCallback(() => {
    try {
      const now = Date.now();
      setRecycleBin(prev => {
        const valid = [];
        const expiredIds = [];
        prev.forEach(item => {
          const expTime = new Date(item.expiresAt || item.deletedAt).getTime() + (3 * 24 * 60 * 60 * 1000);
          if (now > expTime) {
            expiredIds.push(item.id);
          } else {
            valid.push(item);
          }
        });

        if (expiredIds.length > 0) {
          localStorage.setItem('rspRecycleBin', JSON.stringify(valid));
          if (navigator.onLine && db) {
            expiredIds.forEach(id => {
              deleteDoc(doc(db, BASE_COLLECTION_PATH, 'recycle_bin', id)).catch(() => {});
            });
          }
        }
        return valid;
      });
    } catch (e) {
      console.warn('Auto purge notice:', e);
    }
  }, []);

  const loadFromLocalStorage = useCallback(() => {
    try {
      if (localStorage.getItem('rspBills')) {
        const raw = JSON.parse(localStorage.getItem('rspBills'));
        setBills(raw.map(b => normalizeBill(b, b.id)));
      }
      if (localStorage.getItem('rspVendors')) setVendors(JSON.parse(localStorage.getItem('rspVendors')));
      if (localStorage.getItem('rspItems')) {
        const parsed = JSON.parse(localStorage.getItem('rspItems'));
        if (Array.isArray(parsed) && parsed.length > 0) {
          const sanitized = sanitizeProductItems(parsed);
          setItems(sanitized.length > 0 ? sanitized : defaultMasterItems);
        } else {
          setItems(defaultMasterItems);
        }
      } else {
        setItems(defaultMasterItems);
      }
      if (localStorage.getItem('rspExpenses')) {
        const parsed = JSON.parse(localStorage.getItem('rspExpenses'));
        if (Array.isArray(parsed) && parsed.length > 0) {
          setExpenses(parsed);
        } else {
          setExpenses(extractExpensesFromDaybook(daybook2026Full));
        }
      } else {
        setExpenses(extractExpensesFromDaybook(daybook2026Full));
      }
      if (localStorage.getItem('rspAssets')) setAssets(JSON.parse(localStorage.getItem('rspAssets')));
      if (localStorage.getItem('rspRecycleBin')) setRecycleBin(JSON.parse(localStorage.getItem('rspRecycleBin')));
      if (localStorage.getItem('rspLogs')) setLogs(sanitizeLogs(JSON.parse(localStorage.getItem('rspLogs'))));
      const isSalesWiped = localStorage.getItem('rsp_sales_wiped') === 'true';
      if (isSalesWiped) {
        setSales([]);
      } else {
        const storedSales = localStorage.getItem('rspSales');
        if (storedSales !== null) {
          const parsed = JSON.parse(storedSales);
          if (Array.isArray(parsed)) {
            setSales(parsed);
          } else {
            setSales(septemberSalesFull);
          }
        } else {
          setSales(septemberSalesFull);
        }
      }
      if (localStorage.getItem('rsp_daybook_transactions')) {
        const parsedDb = JSON.parse(localStorage.getItem('rsp_daybook_transactions'));
        if (Array.isArray(parsedDb)) {
          if (isSalesWiped) {
            setDaybookTransactions(parsedDb.filter(e => e.category !== 'SALES' && !e.matchedSaleId));
          } else {
            setDaybookTransactions(parsedDb);
          }
        }
      }
    } catch (e) {
      console.warn('LocalStorage load notice:', e);
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('rspItems', JSON.stringify(items));
    } catch (e) {}
  }, [items]);

  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        localStorage.setItem('rspExpenses', JSON.stringify(expenses));
      } catch (e) {}
    }, 400);
    return () => clearTimeout(timer);
  }, [expenses]);

  // Debounced storage savers to eliminate UI frame drops & lag
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        if (localStorage.getItem('rsp_sales_wiped') === 'true') {
          localStorage.setItem('rspSales', JSON.stringify([]));
        } else {
          localStorage.setItem('rspSales', JSON.stringify(sales));
        }
      } catch (e) {}
    }, 400);
    return () => clearTimeout(timer);
  }, [sales]);

  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        localStorage.setItem('rsp_daybook_transactions', JSON.stringify(daybookTransactions));
      } catch (e) {}
    }, 400);
    return () => clearTimeout(timer);
  }, [daybookTransactions]);

  useEffect(() => {
    let unsubs = [];

    async function initFirestore() {
      // 1. Immediately load local storage data into state
      loadFromLocalStorage();
      cleanExpiredRecycleBin();

      // 2. Background preparation timer: 6 seconds for complete cache & database initialization
      const safetyTimer = setTimeout(() => {
        setLoading(false);
      }, 6000);

      // 3. If offline, exit immediately and let the user interact with the app right away
      if (!navigator.onLine || !db || !auth) {
        clearTimeout(safetyTimer);
        setLoading(false);
        setIsOnline(false);
        return;
      }

      // 4. Setup listeners so Firestore's persistent cache can populate
      setupListeners();

      try {
        await signInAnonymously(auth);
      } catch (authErr) {
        console.warn('Anonymous auth notice:', authErr);
      }

      onAuthStateChanged(auth, (user) => {
        if (user) {
          setIsCloudSynced(true);
          syncPendingQueue();
        } else {
          setIsCloudSynced(false);
        }
      });
    }

    function setupListeners() {
      try {
        // Bills Listener - Merges snapshot with pending offline items
        const unsubBills = onSnapshot(
          collection(db, BASE_COLLECTION_PATH, 'bills'),
          (snapshot) => {
            const rawList = [];
            snapshot.forEach(d => {
              rawList.push(normalizeBill(d.data(), d.id));
            });
            const merged = mergeSnapshotWithPendingQueue(rawList, 'bills', normalizeBill);
            merged.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
            setBills(merged);
            localStorage.setItem('rspBills', JSON.stringify(merged));
          },
          (err) => {
            console.warn('Bills listener fallback to local:', err);
          }
        );
        unsubs.push(unsubBills);

        // Vendors Listener
        const unsubVendors = onSnapshot(
          collection(db, BASE_COLLECTION_PATH, 'vendors'),
          (snapshot) => {
            const rawList = [];
            snapshot.forEach(d => rawList.push({ ...d.data(), id: d.data().id || d.id }));
            const merged = mergeSnapshotWithPendingQueue(rawList, 'vendors');
            merged.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
            setVendors(merged);
            localStorage.setItem('rspVendors', JSON.stringify(merged));
          },
          (err) => console.warn('Vendors listener note:', err)
        );
        unsubs.push(unsubVendors);

        // Items Listener
        const unsubItems = onSnapshot(
          collection(db, BASE_COLLECTION_PATH, 'items'),
          (snapshot) => {
            const rawList = [];
            snapshot.forEach(d => rawList.push({ ...d.data(), id: d.data().id || d.id }));
            const merged = mergeSnapshotWithPendingQueue(rawList, 'items');
            merged.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
            if (merged.length > 0) {
              setItems(merged);
              localStorage.setItem('rspItems', JSON.stringify(merged));
            } else {
              setItems(prev => (prev && prev.length > 0 ? prev : defaultMasterItems));
            }
          },
          (err) => console.warn('Items listener note:', err)
        );
        unsubs.push(unsubItems);

        // Expenses Listener
        const unsubExpenses = onSnapshot(
          collection(db, BASE_COLLECTION_PATH, 'expenses'),
          (snapshot) => {
            const rawList = [];
            snapshot.forEach(d => rawList.push({ ...d.data(), id: d.data().id || d.id }));
            const merged = mergeSnapshotWithPendingQueue(rawList, 'expenses');
            merged.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
            setExpenses(merged);
            localStorage.setItem('rspExpenses', JSON.stringify(merged));
          },
          (err) => console.warn('Expenses listener note:', err)
        );
        unsubs.push(unsubExpenses);

        // Assets Listener
        const unsubAssets = onSnapshot(
          collection(db, BASE_COLLECTION_PATH, 'assets'),
          (snapshot) => {
            const rawList = [];
            snapshot.forEach(d => rawList.push({ ...d.data(), id: d.data().id || d.id }));
            const merged = mergeSnapshotWithPendingQueue(rawList, 'assets');
            merged.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
            setAssets(merged);
            localStorage.setItem('rspAssets', JSON.stringify(merged));
          },
          (err) => console.warn('Assets listener note:', err)
        );
        unsubs.push(unsubAssets);

        // Recycle Bin Listener
        const unsubBin = onSnapshot(
          collection(db, BASE_COLLECTION_PATH, 'recycle_bin'),
          (snapshot) => {
            const list = [];
            snapshot.forEach(d => list.push({ ...d.data(), id: d.data().id || d.id }));
            list.sort((a, b) => new Date(b.deletedAt || 0) - new Date(a.deletedAt || 0));
            setRecycleBin(list);
            localStorage.setItem('rspRecycleBin', JSON.stringify(list));
          },
          (err) => console.warn('Recycle bin note:', err)
        );
        unsubs.push(unsubBin);

        // Audit Logs Listener
        const unsubLogs = onSnapshot(
          collection(db, BASE_COLLECTION_PATH, 'audit_logs'),
          (snapshot) => {
            const list = [];
            snapshot.forEach(d => list.push({ ...d.data(), id: d.data().id || d.id }));
            list.sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0));
            setLogs(list.slice(0, 500));
            localStorage.setItem('rspLogs', JSON.stringify(list.slice(0, 500)));
          },
          (err) => console.warn('Audit logs note:', err)
        );
        unsubs.push(unsubLogs);

      } catch (e) {
        console.error('Setup listeners error:', e);
        setLoading(false);
      }
    }

    initFirestore();

    return () => {
      unsubs.forEach(u => typeof u === 'function' && u());
    };
  }, [loadFromLocalStorage, cleanExpiredRecycleBin, mergeSnapshotWithPendingQueue, syncPendingQueue]);

  const persistDocument = async (col, id, data) => {
    if (!navigator.onLine || !db) {
      setPendingSyncQueue(prev => [
        ...prev.filter(x => !(x.col === col && x.id === id)),
        { action: 'set', col, id, data, timestamp: Date.now() }
      ]);
      return;
    }

    try {
      const savePromise = setDoc(doc(db, BASE_COLLECTION_PATH, col, id), data);
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Network save timeout')), 2500)
      );
      await Promise.race([savePromise, timeoutPromise]);
    } catch (err) {
      console.warn(`Cloud save failed/timed out for ${col}/${id}, queuing for offline sync:`, err);
      setPendingSyncQueue(prev => [
        ...prev.filter(x => !(x.col === col && x.id === id)),
        { action: 'set', col, id, data, timestamp: Date.now() }
      ]);
    }
  };

  const removeDocument = async (col, id) => {
    if (!navigator.onLine || !db) {
      setPendingSyncQueue(prev => [
        ...prev.filter(x => !(x.col === col && x.id === id)),
        { action: 'delete', col, id, timestamp: Date.now() }
      ]);
      return;
    }

    try {
      const deletePromise = deleteDoc(doc(db, BASE_COLLECTION_PATH, col, id));
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Network delete timeout')), 2500)
      );
      await Promise.race([deletePromise, timeoutPromise]);
    } catch (err) {
      console.warn(`Cloud delete failed/timed out for ${col}/${id}, queuing for offline sync:`, err);
      setPendingSyncQueue(prev => [
        ...prev.filter(x => !(x.col === col && x.id === id)),
        { action: 'delete', col, id, timestamp: Date.now() }
      ]);
    }
  };

  // --- CRUD Operations ---

  const saveBill = async (billData) => {
    const isNew = !bills.some(b => b.id === billData.id);
    const id = billData.id || `B_${Date.now()}`;
    const grandTotal = parseFloat(billData.grandTotal) || 0;
    const paidAmount = parseFloat(billData.paidAmount) || 0;
    const balanceAmount = grandTotal - paidAmount;
    const paymentStatus = balanceAmount <= 0.01 ? 'paid' : (paidAmount > 0 ? 'partial' : 'unpaid');

    const cleanBill = {
      ...billData,
      id,
      grandTotal,
      paidAmount,
      balanceAmount: balanceAmount < 0 ? 0 : balanceAmount,
      paymentStatus,
      paymentHistory: billData.paymentHistory || [],
      updatedAt: new Date().toISOString(),
      _isPendingSync: !navigator.onLine
    };

    setBills(prev => {
      const idx = prev.findIndex(b => b.id === id);
      let updated;
      if (idx > -1) {
        updated = [...prev];
        updated[idx] = cleanBill;
      } else {
        updated = [cleanBill, ...prev];
      }
      localStorage.setItem('rspBills', JSON.stringify(updated));
      return updated;
    });

    await persistDocument('bills', id, cleanBill);

    // Audit Log
    logActivity({
      action: isNew ? 'CREATE' : 'UPDATE',
      entityType: 'bill',
      entityId: id,
      title: `${isNew ? 'Created' : 'Updated'} Bill #${cleanBill.invoiceNo || id}`,
      details: `Vendor: ${cleanBill.vendorName} • Amount: ₹${grandTotal.toLocaleString('en-IN')}`
    });

    return cleanBill;
  };

  const recordBillPayment = async (billId, paymentDetails) => {
    const bill = bills.find(b => b.id === billId);
    if (!bill) throw new Error('Bill not found');

    const pAmt = parseFloat(paymentDetails.amount) || 0;
    if (pAmt <= 0) throw new Error('Payment amount must be greater than zero');

    const newPaymentRecord = {
      id: `PAY_${Date.now()}`,
      date: paymentDetails.date || new Date().toISOString().slice(0, 10),
      amount: pAmt,
      mode: paymentDetails.mode || 'Bank Transfer',
      reference: paymentDetails.reference || '',
      notes: paymentDetails.notes || '',
      recordedAt: new Date().toISOString()
    };

    const updatedHistory = [...(bill.paymentHistory || []), newPaymentRecord];
    const newPaidAmount = (parseFloat(bill.paidAmount) || 0) + pAmt;
    const grandTotal = parseFloat(bill.grandTotal) || 0;
    const newBalance = grandTotal - newPaidAmount;
    const newStatus = newBalance <= 0.01 ? 'paid' : 'partial';

    const updatedBill = {
      ...bill,
      paidAmount: newPaidAmount,
      balanceAmount: newBalance < 0 ? 0 : newBalance,
      paymentStatus: newStatus,
      paymentHistory: updatedHistory,
      updatedAt: new Date().toISOString()
    };

    // Synchronize to Day Book cash/bank ledger
    if (paymentDetails.syncToDaybook !== false) {
      const isCash = isPaymentCash(paymentDetails.mode);
      addDaybookTransaction({
        id: `db_bill_pay_${billId}_${Date.now()}`,
        date: newPaymentRecord.date,
        estNo: bill.invoiceNo || '',
        payment: newPaymentRecord.mode,
        branch: bill.branch || 'KLK',
        department: bill.department || 'GENERAL ADMIN',
        category: 'VENDOR PAYMENT',
        description: `Payment to ${bill.vendorName || 'Supplier'} (Bill #${bill.invoiceNo || 'N/A'})`,
        cashCredit: 0,
        cashDebit: isCash ? pAmt : 0,
        bankCredit: 0,
        bankDebit: !isCash ? pAmt : 0,
        balanceNote: '',
        billId: bill.id
      });
    }

    logActivity({
      action: 'PAYMENT',
      entityType: 'bill',
      entityId: billId,
      title: `Payment for Bill #${bill.invoiceNo}`,
      details: `Paid ₹${pAmt.toLocaleString('en-IN')} via ${paymentDetails.mode || 'Transfer'}`
    });

    return await saveBill(updatedBill);
  };

  const updateBillPayment = async (billId, paymentIdOrIdx, updatedPayment) => {
    const bill = bills.find(b => b.id === billId);
    if (!bill) return;

    let history = Array.isArray(bill.paymentHistory) ? [...bill.paymentHistory] : [];
    let targetIdx = -1;
    if (typeof paymentIdOrIdx === 'number') {
      targetIdx = paymentIdOrIdx;
    } else {
      targetIdx = history.findIndex(p => p.id === paymentIdOrIdx);
    }

    if (targetIdx >= 0 && targetIdx < history.length) {
      history[targetIdx] = {
        ...history[targetIdx],
        ...updatedPayment,
        amount: parseFloat(updatedPayment.amount !== undefined ? updatedPayment.amount : history[targetIdx].amount) || 0
      };
    }

    const totalPaid = history.reduce((acc, p) => acc + (parseFloat(p.amount) || 0), 0);
    const grandTotal = parseFloat(bill.grandTotal) || 0;
    const balance = Math.max(0, grandTotal - totalPaid);
    const paymentStatus = balance <= 0.01 ? 'paid' : (totalPaid > 0 ? 'partial' : 'unpaid');

    const updated = {
      ...bill,
      paymentHistory: history,
      paidAmount: totalPaid,
      balanceAmount: balance,
      paymentStatus,
      updatedAt: new Date().toISOString()
    };

    setBills(prev => prev.map(b => b.id === billId ? updated : b));
    localStorage.setItem('rspBills', JSON.stringify(bills.map(b => b.id === billId ? updated : b)));
    await persistDocument('bills', billId, updated);

    logActivity({
      action: 'PAYMENT',
      entityType: 'bill',
      entityId: billId,
      title: `Updated Payment for Bill #${bill.invoiceNo || billId}`,
      details: `New Paid Amount: ₹${totalPaid.toLocaleString('en-IN')}`
    });
    return updated;
  };

  const deleteBillPayment = async (billId, paymentIdOrIdx) => {
    const bill = bills.find(b => b.id === billId);
    if (!bill) return;

    let history = Array.isArray(bill.paymentHistory) ? [...bill.paymentHistory] : [];
    if (typeof paymentIdOrIdx === 'number') {
      history.splice(paymentIdOrIdx, 1);
    } else {
      history = history.filter(p => p.id !== paymentIdOrIdx);
    }

    const totalPaid = history.reduce((acc, p) => acc + (parseFloat(p.amount) || 0), 0);
    const grandTotal = parseFloat(bill.grandTotal) || 0;
    const balance = Math.max(0, grandTotal - totalPaid);
    const paymentStatus = balance <= 0.01 ? 'paid' : (totalPaid > 0 ? 'partial' : 'unpaid');

    const updated = {
      ...bill,
      paymentHistory: history,
      paidAmount: totalPaid,
      balanceAmount: balance,
      paymentStatus,
      updatedAt: new Date().toISOString()
    };

    setBills(prev => prev.map(b => b.id === billId ? updated : b));
    localStorage.setItem('rspBills', JSON.stringify(bills.map(b => b.id === billId ? updated : b)));
    await persistDocument('bills', billId, updated);

    logActivity({
      action: 'DELETE',
      entityType: 'bill',
      entityId: billId,
      title: `Deleted Payment for Bill #${bill.invoiceNo || billId}`,
      details: `Recalculated balance: ₹${balance.toLocaleString('en-IN')}`
    });
    return updated;
  };

  const recordVendorAdvancePayment = async (vendorId, paymentDetails) => {
    const v = vendors.find(item => item.id === vendorId);
    if (!v) throw new Error('Vendor not found');

    const pAmt = parseFloat(paymentDetails.amount) || 0;
    if (pAmt <= 0) throw new Error('Payment amount must be greater than zero');

    const newPaymentRecord = {
      id: `VPAY_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      date: paymentDetails.date || new Date().toISOString().slice(0, 10),
      amount: pAmt,
      mode: paymentDetails.mode || 'Bank Transfer',
      reference: paymentDetails.reference || '',
      notes: paymentDetails.notes || '',
      recordedAt: new Date().toISOString()
    };

    const updatedHistory = [...(v.paymentHistory || []), newPaymentRecord];
    const updatedVendor = {
      ...v,
      paymentHistory: updatedHistory,
      updatedAt: new Date().toISOString()
    };

    if (paymentDetails.syncToDaybook !== false) {
      const isCash = isPaymentCash(paymentDetails.mode);
      addDaybookTransaction({
        id: `db_vpay_${vendorId}_${Date.now()}`,
        date: newPaymentRecord.date,
        estNo: newPaymentRecord.reference || '',
        payment: newPaymentRecord.mode,
        branch: 'KLK',
        department: 'GENERAL ADMIN',
        category: 'VENDOR PAYMENT',
        description: `Advance/On-Account Payment to ${v.name}${newPaymentRecord.notes ? ' - ' + newPaymentRecord.notes : ''}`,
        cashCredit: 0,
        cashDebit: isCash ? pAmt : 0,
        bankCredit: 0,
        bankDebit: !isCash ? pAmt : 0,
        balanceNote: 'Advance / On-Account',
        vendorId: v.id
      });
    }

    logActivity({
      action: 'PAYMENT',
      entityType: 'vendor',
      entityId: vendorId,
      title: `Advance Payment to ${v.name}`,
      details: `Paid ₹${pAmt.toLocaleString('en-IN')} via ${paymentDetails.mode || 'Transfer'}`
    });

    return await saveVendor(updatedVendor);
  };

  const recordVendorPayment = async (vendorId, paymentDetails) => {
    // 1. Direct payment against a specific invoice
    if (paymentDetails.billId) {
      return await recordBillPayment(paymentDetails.billId, paymentDetails);
    }

    const pAmt = parseFloat(paymentDetails.amount) || 0;
    if (pAmt <= 0) throw new Error('Payment amount must be greater than zero');

    const v = vendors.find(item => item.id === vendorId);
    if (!v) throw new Error('Vendor not found');

    // 2. Auto-allocation across oldest unpaid invoices (FIFO)
    if (paymentDetails.allocationMode === 'fifo') {
      const vBills = bills
        .filter(b => (b.vendorId === v.id || b.vendorName === v.name) && (b.paymentStatus !== 'paid'))
        .sort((a, b) => new Date(a.date || '1970-01-01') - new Date(b.date || '1970-01-01'));

      let remaining = pAmt;
      for (const bill of vBills) {
        if (remaining <= 0) break;
        const grandTotal = parseFloat(bill.grandTotal) || 0;
        const currentPaid = parseFloat(bill.paidAmount) || 0;
        const billBalance = bill.balanceAmount !== undefined ? parseFloat(bill.balanceAmount) : (grandTotal - currentPaid);
        if (billBalance <= 0) continue;

        const allocatedAmt = Math.min(billBalance, remaining);
        await recordBillPayment(bill.id, {
          ...paymentDetails,
          amount: allocatedAmt,
          notes: `${paymentDetails.notes ? paymentDetails.notes + ' • ' : ''}FIFO payment allocation`
        });
        remaining -= allocatedAmt;
      }

      // If surplus amount exists after clearing all bills, record as advance payment
      if (remaining > 0.01) {
        await recordVendorAdvancePayment(v.id, {
          ...paymentDetails,
          amount: remaining,
          notes: `${paymentDetails.notes ? paymentDetails.notes + ' • ' : ''}Advance balance surplus`
        });
      }
      return true;
    }

    // 3. Direct Advance / On-Account payment
    return await recordVendorAdvancePayment(v.id, paymentDetails);
  };

  const deleteVendorPayment = async (vendorId, paymentId) => {
    const v = vendors.find(item => item.id === vendorId);
    if (!v) throw new Error('Vendor not found');

    const updatedHistory = (v.paymentHistory || []).filter(p => p.id !== paymentId);
    const updatedVendor = {
      ...v,
      paymentHistory: updatedHistory,
      updatedAt: new Date().toISOString()
    };
    return await saveVendor(updatedVendor);
  };

  const updateVendorPayment = async (vendorId, paymentId, updatedPayment) => {
    const v = vendors.find(item => item.id === vendorId);
    if (!v) throw new Error('Vendor not found');

    const updatedHistory = (v.paymentHistory || []).map(p => {
      if (p.id === paymentId) {
        return {
          ...p,
          ...updatedPayment,
          amount: parseFloat(updatedPayment.amount !== undefined ? updatedPayment.amount : p.amount) || 0
        };
      }
      return p;
    });

    const updatedVendor = {
      ...v,
      paymentHistory: updatedHistory,
      updatedAt: new Date().toISOString()
    };
    return await saveVendor(updatedVendor);
  };

  // Move Bill to 3-Day Recycle Bin instead of permanent destruction
  const deleteBill = async (billId) => {
    const billToTrash = bills.find(b => b.id === billId);
    if (!billToTrash) return;

    const trashedRecord = {
      ...billToTrash,
      deletedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days (72 hours)
      isDeleted: true
    };

    // Remove from active bills
    setBills(prev => {
      const updated = prev.filter(b => b.id !== billId);
      localStorage.setItem('rspBills', JSON.stringify(updated));
      return updated;
    });

    // Add to Recycle Bin
    setRecycleBin(prev => {
      const updated = [trashedRecord, ...prev.filter(b => b.id !== billId)];
      localStorage.setItem('rspRecycleBin', JSON.stringify(updated));
      return updated;
    });

    await removeDocument('bills', billId);
    await persistDocument('recycle_bin', billId, trashedRecord);

    logActivity({
      action: 'DELETE',
      entityType: 'bill',
      entityId: billId,
      title: `Moved Bill #${billToTrash.invoiceNo} to Recycle Bin`,
      details: `Can be restored within 3 days (Expires: ${new Date(trashedRecord.expiresAt).toLocaleDateString()})`
    });
  };

  // Restore Bill from 3-Day Recycle Bin
  const restoreBill = async (billId) => {
    const trashedRecord = recycleBin.find(b => b.id === billId);
    if (!trashedRecord) throw new Error('Voucher not found in Recycle Bin');

    const { deletedAt, expiresAt, isDeleted, ...restoredBill } = trashedRecord;
    const cleanRestored = {
      ...restoredBill,
      updatedAt: new Date().toISOString(),
      _isPendingSync: !navigator.onLine
    };

    // Remove from recycle bin
    setRecycleBin(prev => {
      const updated = prev.filter(b => b.id !== billId);
      localStorage.setItem('rspRecycleBin', JSON.stringify(updated));
      return updated;
    });

    // Add back to active bills
    setBills(prev => {
      const updated = [cleanRestored, ...prev.filter(b => b.id !== billId)];
      updated.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
      localStorage.setItem('rspBills', JSON.stringify(updated));
      return updated;
    });

    await removeDocument('recycle_bin', billId);
    await persistDocument('bills', billId, cleanRestored);

    logActivity({
      action: 'RESTORE',
      entityType: 'bill',
      entityId: billId,
      title: `Restored Bill #${cleanRestored.invoiceNo} from Recycle Bin`,
      details: `Returned to active Purchase Register`
    });

    return cleanRestored;
  };

  // Permanently Purge Bill from Recycle Bin
  const permanentDeleteBill = async (billId) => {
    const item = recycleBin.find(b => b.id === billId);

    setRecycleBin(prev => {
      const updated = prev.filter(b => b.id !== billId);
      localStorage.setItem('rspRecycleBin', JSON.stringify(updated));
      return updated;
    });

    await removeDocument('recycle_bin', billId);

    if (item) {
      logActivity({
        action: 'PURGE',
        entityType: 'bill',
        entityId: billId,
        title: `Permanently Purged Bill #${item.invoiceNo}`,
        details: `Deleted forever from cloud and local storage`
      });
    }
  };

  // Mark all historical bills as Paid
  const markAllBillsAsPaid = async () => {
    const updated = bills.map(b => ({
      ...b,
      paidAmount: b.grandTotal,
      balanceAmount: 0,
      paymentStatus: 'paid'
    }));
    setBills(updated);
    localStorage.setItem('rspBills', JSON.stringify(updated));

    for (const b of updated) {
      await persistDocument('bills', b.id, b);
    }

    logActivity({
      action: 'UPDATE',
      entityType: 'bill',
      entityId: 'ALL',
      title: 'Batch Action: Marked All Bills as Paid',
      details: `Processed ${updated.length} bills`
    });
  };

  const saveVendor = async (vendorData) => {
    const isNew = !vendors.some(v => v.id === vendorData.id);
    const id = vendorData.id || `V_${Date.now()}`;
    const cleanVendor = {
      ...vendorData,
      id,
      name: (vendorData.name || '').trim().toUpperCase(),
      updatedAt: new Date().toISOString()
    };

    setVendors(prev => {
      const idx = prev.findIndex(v => v.id === id);
      let updated;
      if (idx > -1) {
        updated = [...prev];
        updated[idx] = cleanVendor;
      } else {
        updated = [...prev, cleanVendor];
      }
      updated.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      localStorage.setItem('rspVendors', JSON.stringify(updated));
      return updated;
    });

    await persistDocument('vendors', id, cleanVendor);

    logActivity({
      action: isNew ? 'CREATE' : 'UPDATE',
      entityType: 'vendor',
      entityId: id,
      title: `${isNew ? 'Added' : 'Updated'} Vendor: ${cleanVendor.name}`,
      details: `GSTIN: ${cleanVendor.gstin || 'Unregistered'}`
    });

    return cleanVendor;
  };

  const deleteVendor = async (vendorId) => {
    const vendor = vendors.find(v => v.id === vendorId);
    setVendors(prev => {
      const updated = prev.filter(v => v.id !== vendorId);
      localStorage.setItem('rspVendors', JSON.stringify(updated));
      return updated;
    });
    await removeDocument('vendors', vendorId);

    if (vendor) {
      logActivity({
        action: 'DELETE',
        entityType: 'vendor',
        entityId: vendorId,
        title: `Deleted Vendor: ${vendor.name}`,
        details: `Vendor removed from master catalog`
      });
    }
  };

  const saveItem = async (itemData) => {
    const isNew = !items.some(i => i.id === itemData.id);
    const id = itemData.id || `I_${Date.now()}`;
    const cleanItem = {
      ...itemData,
      id,
      name: (itemData.name || '').trim(),
      uqc: (itemData.uqc || 'NOS').trim().toUpperCase(),
      updatedAt: new Date().toISOString()
    };

    setItems(prev => {
      const idx = prev.findIndex(i => i.id === id);
      let updated;
      if (idx > -1) {
        updated = [...prev];
        updated[idx] = cleanItem;
      } else {
        updated = [...prev, cleanItem];
      }
      localStorage.setItem('rspItems', JSON.stringify(updated));
      return updated;
    });

    await persistDocument('items', id, cleanItem);

    logActivity({
      action: isNew ? 'CREATE' : 'UPDATE',
      entityType: 'item',
      entityId: id,
      title: `${isNew ? 'Cataloged' : 'Updated'} Item: ${cleanItem.name}`,
      details: `UQC: ${cleanItem.uqc}`
    });

    return cleanItem;
  };

  const deleteItem = async (itemId) => {
    const item = items.find(i => i.id === itemId);
    setItems(prev => {
      const updated = prev.filter(i => i.id !== itemId);
      localStorage.setItem('rspItems', JSON.stringify(updated));
      return updated;
    });
    await removeDocument('items', itemId);

    if (item) {
      logActivity({
        action: 'DELETE',
        entityType: 'item',
        entityId: itemId,
        title: `Deleted Item: ${item.name}`,
        details: `Item removed from product master`
      });
    }
  };

  const syncItemsFromSalesData = useCallback(async () => {
    setItems(defaultMasterItems);
    localStorage.setItem('rspItems', JSON.stringify(defaultMasterItems));
    logActivity({
      action: 'UPDATE',
      entityType: 'item',
      entityId: 'ALL',
      title: 'Synced Items Catalog from Previous Sales Data',
      details: `Populated ${defaultMasterItems.length} standardized master products with proper units`
    });
    return defaultMasterItems.length;
  }, [logActivity]);

  const syncExpensesFromDaybook = useCallback(async () => {
    const list = extractExpensesFromDaybook(daybookTransactions && daybookTransactions.length > 0 ? daybookTransactions : daybook2026Full);
    setExpenses(list);
    try {
      localStorage.setItem('rspExpenses', JSON.stringify(list));
    } catch (e) {}
    logActivity({
      action: 'UPDATE',
      entityType: 'expense',
      entityId: 'ALL',
      title: 'Synced All Expenses from Day Book',
      details: `Populated ${list.length} categorized operational expenses from Day Book register`
    });
    return list.length;
  }, [daybookTransactions, logActivity]);

  const saveExpense = async (expenseData) => {
    const isNew = !expenses.some(e => e.id === expenseData.id);
    const id = expenseData.id || `E_${Date.now()}`;
    const cleanExpense = {
      ...expenseData,
      id,
      amount: parseFloat(expenseData.amount) || 0,
      updatedAt: new Date().toISOString()
    };

    setExpenses(prev => {
      const idx = prev.findIndex(e => e.id === id);
      let updated;
      if (idx > -1) {
        updated = [...prev];
        updated[idx] = cleanExpense;
      } else {
        updated = [cleanExpense, ...prev];
      }
      localStorage.setItem('rspExpenses', JSON.stringify(updated));
      return updated;
    });

    await persistDocument('expenses', id, cleanExpense);

    // Synchronize to Day Book cash/bank ledger
    if (expenseData.syncToDaybook !== false && cleanExpense.amount > 0 && !cleanExpense.isSyncedFromDaybook) {
      const isCash = isPaymentCash(cleanExpense.paymentMethod);
      addDaybookTransaction({
        id: `db_exp_${id}_${Date.now()}`,
        date: cleanExpense.date || new Date().toISOString().substring(0, 10),
        estNo: cleanExpense.voucherNo || '',
        payment: cleanExpense.paymentMethod || 'CASH',
        branch: cleanExpense.branch || 'KLK',
        department: cleanExpense.department || 'GENERAL ADMIN',
        category: cleanExpense.category || 'General Operating',
        description: cleanExpense.description || cleanExpense.payee || cleanExpense.category,
        cashCredit: 0,
        cashDebit: isCash ? cleanExpense.amount : 0,
        bankCredit: 0,
        bankDebit: !isCash ? cleanExpense.amount : 0,
        balanceNote: '',
        expenseId: id
      });
    }

    logActivity({
      action: isNew ? 'CREATE' : 'UPDATE',
      entityType: 'expense',
      entityId: id,
      title: `${isNew ? 'Recorded' : 'Updated'} Expense: ${cleanExpense.category || 'General'}`,
      details: `Amount: ₹${cleanExpense.amount.toLocaleString('en-IN')}`
    });

    return cleanExpense;
  };

  const deleteExpense = async (expenseId) => {
    const exp = expenses.find(e => e.id === expenseId);
    setExpenses(prev => {
      const updated = prev.filter(e => e.id !== expenseId);
      localStorage.setItem('rspExpenses', JSON.stringify(updated));
      return updated;
    });
    await removeDocument('expenses', expenseId);

    if (exp) {
      logActivity({
        action: 'DELETE',
        entityType: 'expense',
        entityId: expenseId,
        title: `Deleted Expense: ${exp.category}`,
        details: `Amount: ₹${exp.amount}`
      });
    }
  };

  const saveAsset = async (assetData) => {
    const isNew = !assets.some(a => a.id === assetData.id);
    const id = assetData.id || `A_${Date.now()}`;

    // Normalize financial & GST metrics
    const isGst = Boolean(assetData.isGst);
    const taxableAmount = parseFloat(assetData.taxableAmount !== undefined ? assetData.taxableAmount : (assetData.value || assetData.rate || 0)) || 0;
    const baseCost = parseFloat(assetData.baseCost !== undefined ? assetData.baseCost : taxableAmount) || 0;
    const transportCharges = parseFloat(assetData.transportCharges) || 0;
    const gstOnTransport = assetData.gstOnTransport !== undefined ? Boolean(assetData.gstOnTransport) : true;
    const discount = parseFloat(assetData.discount) || 0;
    const isRoundOff = assetData.isRoundOff !== undefined ? Boolean(assetData.isRoundOff) : true;
    const roundOff = parseFloat(assetData.roundOff) || 0;
    const taxRate = isGst ? (parseFloat(assetData.taxRate) || 0) : 0;
    const isInterState = Boolean(assetData.isInterState);

    let cgst = parseFloat(assetData.cgst) || 0;
    let sgst = parseFloat(assetData.sgst) || 0;
    let igst = parseFloat(assetData.igst) || 0;
    let totalTax = parseFloat(assetData.totalTax !== undefined ? assetData.totalTax : assetData.taxAmount) || 0;

    if (isGst && taxRate > 0) {
      if (!totalTax && taxableAmount > 0) {
        totalTax = Math.round((taxableAmount * (taxRate / 100)) * 100) / 100;
        if (isInterState) {
          igst = totalTax;
          cgst = 0;
          sgst = 0;
        } else {
          const halfRate = taxRate / 2;
          cgst = Math.round((taxableAmount * (halfRate / 100)) * 100) / 100;
          sgst = cgst;
          totalTax = cgst + sgst;
          igst = 0;
        }
      }
    } else {
      cgst = 0;
      sgst = 0;
      igst = 0;
      totalTax = 0;
    }

    const grandTotal = parseFloat(assetData.grandTotal) || (taxableAmount + totalTax + roundOff);
    let paidAmount = assetData.paidAmount !== undefined ? parseFloat(assetData.paidAmount) : (parseFloat(assetData.initialPaid) || 0);
    let balanceAmount = assetData.balanceAmount !== undefined ? parseFloat(assetData.balanceAmount) : Math.max(0, grandTotal - paidAmount);
    
    // Auto-derive payment status
    let paymentStatus = assetData.paymentStatus;
    if (!paymentStatus) {
      paymentStatus = balanceAmount <= 0.01 ? 'paid' : (paidAmount > 0 ? 'partial' : 'unpaid');
    }

    // Auto-initialize payment history if initially paid
    let paymentHistory = Array.isArray(assetData.paymentHistory) ? [...assetData.paymentHistory] : [];
    if (paymentHistory.length === 0 && paidAmount > 0) {
      paymentHistory.push({
        id: `PAY_INIT_${Date.now()}`,
        date: assetData.date || new Date().toISOString().substring(0, 10),
        amount: paidAmount,
        mode: assetData.paymentMethod || 'BANK TRANSFER',
        reference: assetData.invoiceNo ? `Init Payment - Inv #${assetData.invoiceNo}` : 'Initial Settlement',
        notes: 'Recorded on asset purchase'
      });
    }

    const cleanAsset = {
      ...assetData,
      id,
      voucherNo: assetData.voucherNo || `AST-${String(id).replace(/[^0-9]/g, '').slice(-4) || '001'}`,
      invoiceNo: assetData.invoiceNo || '',
      vendorId: assetData.vendorId || '',
      vendorName: (assetData.vendorName || '').trim(),
      vendorGstin: (assetData.vendorGstin || '').trim().toUpperCase(),
      name: (assetData.name || '').trim(),
      category: assetData.category || 'Machinery & Equipment',
      location: assetData.location || '',
      branch: assetData.branch || 'KLK',
      department: assetData.department || 'OFFSET',
      hsn: assetData.hsn || '',
      uqc: assetData.uqc || 'NOS',
      qty: parseFloat(assetData.qty) || 1,
      rate: parseFloat(assetData.rate) || baseCost,
      baseCost,
      taxableAmount,
      transportCharges,
      gstOnTransport,
      discount,
      isRoundOff,
      roundOff,
      isGst,
      taxType: assetData.taxType || 'exclusive',
      taxRate,
      isInterState,
      cgst,
      sgst,
      igst,
      totalTax,
      unroundedTotal: parseFloat(assetData.unroundedTotal) || (taxableAmount + totalTax),
      grandTotal,
      value: grandTotal, // Preserve .value for backwards-compatibility
      itcEligibility: assetData.itcEligibility || (isGst ? 'Inputs Capital Goods' : 'Ineligible'),
      paidAmount,
      balanceAmount: balanceAmount < 0 ? 0 : balanceAmount,
      paymentStatus,
      paymentMethod: assetData.paymentMethod || 'BANK TRANSFER',
      paymentHistory,
      notes: assetData.notes || '',
      updatedAt: new Date().toISOString()
    };

    setAssets(prev => {
      const idx = prev.findIndex(a => a.id === id);
      let updated;
      if (idx > -1) {
        updated = [...prev];
        updated[idx] = cleanAsset;
      } else {
        updated = [cleanAsset, ...prev];
      }
      localStorage.setItem('rspAssets', JSON.stringify(updated));
      return updated;
    });

    await persistDocument('assets', id, cleanAsset);

    logActivity({
      action: isNew ? 'CREATE' : 'UPDATE',
      entityType: 'asset',
      entityId: id,
      title: `${isNew ? 'Registered' : 'Updated'} Asset Bill: ${cleanAsset.name} (#${cleanAsset.invoiceNo || cleanAsset.voucherNo})`,
      details: `Vendor: ${cleanAsset.vendorName || 'N/A'} | Taxable: ₹${cleanAsset.taxableAmount.toLocaleString('en-IN')} | Total: ₹${cleanAsset.grandTotal.toLocaleString('en-IN')} | Bal: ₹${cleanAsset.balanceAmount.toLocaleString('en-IN')}`
    });

    return cleanAsset;
  };

  const recordAssetPayment = async (assetId, paymentDetails) => {
    const asset = assets.find(a => a.id === assetId);
    if (!asset) throw new Error('Asset voucher not found');

    const pAmt = parseFloat(paymentDetails.amount);
    if (isNaN(pAmt) || pAmt <= 0) throw new Error('Invalid payment amount');

    const newPayment = {
      id: `PAY_AST_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      date: paymentDetails.date || new Date().toISOString().substring(0, 10),
      amount: pAmt,
      mode: paymentDetails.mode || 'BANK TRANSFER',
      reference: paymentDetails.reference || '',
      notes: paymentDetails.notes || ''
    };

    const currentHistory = Array.isArray(asset.paymentHistory) ? asset.paymentHistory : [];
    const updatedHistory = [...currentHistory, newPayment];
    const newPaidAmount = updatedHistory.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
    const grandTotal = parseFloat(asset.grandTotal || asset.value || 0);
    const newBalance = Math.max(0, grandTotal - newPaidAmount);
    const newStatus = newBalance <= 0.01 ? 'paid' : 'partial';

    const updatedAsset = {
      ...asset,
      paidAmount: newPaidAmount,
      balanceAmount: newBalance,
      paymentStatus: newStatus,
      paymentHistory: updatedHistory,
      updatedAt: new Date().toISOString()
    };

    // Optionally record payment into Day Book cash / bank ledger
    if (paymentDetails.syncToDaybook !== false) {
      const isCash = isPaymentCash(paymentDetails.mode);
      addDaybookTransaction({
        id: `db_ast_pay_${assetId}_${Date.now()}`,
        date: newPayment.date,
        estNo: asset.voucherNo || '',
        payment: newPayment.mode,
        branch: asset.branch || 'KLK',
        department: asset.department || 'OFFSET',
        category: 'CAPITAL ASSETS',
        description: `Payment to ${asset.vendorName || 'Supplier'} for Asset: ${asset.name} (Inv #${asset.invoiceNo || 'N/A'})`,
        cashCredit: 0,
        cashDebit: isCash ? pAmt : 0,
        bankCredit: 0,
        bankDebit: !isCash ? pAmt : 0,
        balanceNote: newBalance > 0 ? `Asset Bal: ₹${newBalance}` : 'ASSET FULL PAID'
      });
    }

    logActivity({
      action: 'PAYMENT',
      entityType: 'asset',
      entityId: assetId,
      title: `Payment for Asset: ${asset.name} (Inv #${asset.invoiceNo || asset.voucherNo})`,
      details: `Paid ₹${pAmt.toLocaleString('en-IN')} via ${paymentDetails.mode || 'Bank'} | Balance: ₹${newBalance.toLocaleString('en-IN')}`
    });

    return await saveAsset(updatedAsset);
  };

  const deleteAsset = async (assetId) => {
    const asset = assets.find(a => a.id === assetId);
    setAssets(prev => {
      const updated = prev.filter(a => a.id !== assetId);
      localStorage.setItem('rspAssets', JSON.stringify(updated));
      return updated;
    });
    await removeDocument('assets', assetId);

    if (asset) {
      logActivity({
        action: 'DELETE',
        entityType: 'asset',
        entityId: assetId,
        title: `Deleted Asset: ${asset.name}`,
        details: `Value: ₹${asset.grandTotal || asset.value}`
      });
    }
  };

  const exportAllDataJSON = () => {
    const backup = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      bills,
      vendors,
      items,
      expenses,
      assets,
      recycleBin,
      logs
    };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `RSPurchase_Backup_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const restoreAllData = async (jsonData) => {
    if (!jsonData || typeof jsonData !== 'object') throw new Error('Invalid JSON format');
    
    const bList = jsonData.bills || [];
    const vList = jsonData.vendors || [];
    const iList = jsonData.items || [];
    const eList = jsonData.expenses || [];
    const aList = jsonData.assets || [];

    for (const b of bList) await saveBill(b);
    for (const v of vList) await saveVendor(v);
    for (const i of iList) await saveItem(i);
    for (const e of eList) await saveExpense(e);
    for (const a of aList) await saveAsset(a);

    return {
      billsCount: bList.length,
      vendorsCount: vList.length,
      itemsCount: iList.length,
      expensesCount: eList.length,
      assetsCount: aList.length
    };
  };

  // --- SALES REGISTER (LOCAL DEMO ENVIRONMENT) ---
  const saveSale = (saleData) => {
    const id = saleData.id || `sale_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const finalAmount = parseFloat(saleData.finalAmount) || 0;
    const paidAmount = parseFloat(saleData.paidAmount) || 0;
    const balanceAmount = parseFloat(saleData.balanceAmount) !== undefined 
      ? parseFloat(saleData.balanceAmount) 
      : Math.max(0, finalAmount - paidAmount);
    const paymentStatus = balanceAmount <= 0 ? 'paid' : (paidAmount > 0 ? 'partial' : 'pending');

    const normalized = {
      ...saleData,
      id,
      finalAmount,
      paidAmount,
      balanceAmount,
      paymentStatus,
      billStatus: paymentStatus === 'paid' ? 'NIL' : 'PENDING',
      updatedAt: new Date().toISOString()
    };

    setSales(prev => {
      const idx = prev.findIndex(s => s.id === id);
      let updated;
      if (idx >= 0) {
        updated = [...prev];
        updated[idx] = normalized;
      } else {
        updated = [normalized, ...prev];
      }
      try {
        localStorage.setItem('rspSales', JSON.stringify(updated));
      } catch (e) {}
      return updated;
    });

    // Synchronize seamlessly into Day Book (Chained record for Cash & Bank)
    setDaybookTransactions(prev => {
      const filtered = prev.filter(item => item.matchedSaleId !== id);
      const newDbEntries = generateDaybookEntriesFromSale(normalized);
      const updated = [...newDbEntries, ...filtered];
      try {
        localStorage.setItem('rsp_daybook_transactions', JSON.stringify(updated));
      } catch (e) {}
      return updated;
    });

    logActivity('CREATE_SALE', `Saved sales invoice #${normalized.estNo} for ${normalized.customerName}`);
    return normalized;
  };

  const deleteSale = (id) => {
    setSales(prev => {
      const updated = prev.filter(s => s.id !== id);
      try {
        localStorage.setItem('rspSales', JSON.stringify(updated));
      } catch (e) {}
      return updated;
    });

    // Remove chained transactions from Day Book
    setDaybookTransactions(prev => {
      const updated = prev.filter(item => item.matchedSaleId !== id);
      try {
        localStorage.setItem('rsp_daybook_transactions', JSON.stringify(updated));
      } catch (e) {}
      return updated;
    });

    logActivity('DELETE_SALE', `Deleted sales order ID ${id}`);
  };

  const recordSalePayment = (id, payment) => {
    let updatedSale = null;
    setSales(prev => {
      const updated = prev.map(s => {
        if (s.id !== id) return s;
        const newPayments = [...(s.payments || []), {
          id: `pay_${Date.now()}`,
          ...payment,
          date: payment.date || new Date().toISOString().substring(0, 10)
        }];
        const totalPaid = newPayments.reduce((acc, p) => acc + (parseFloat(p.amount) || 0), 0);
        const finalAmt = parseFloat(s.finalAmount) || 0;
        const balance = Math.max(0, finalAmt - totalPaid);
        const paymentStatus = balance <= 0 ? 'paid' : (totalPaid > 0 ? 'partial' : 'pending');
        const isNowCleared = balance <= 0;

        const nextSale = {
          ...s,
          payments: newPayments,
          paidAmount: totalPaid,
          balanceAmount: balance,
          paymentStatus,
          billStatus: isNowCleared ? 'NIL' : 'PENDING',
          isInvoice: isNowCleared ? true : s.isInvoice,
          invoiceNo: s.invoiceNo || (isNowCleared ? `INV-26-${s.estNo}` : ''),
          invDate: isNowCleared ? (payment.date || new Date().toISOString().substring(0, 10)) : s.invDate,
          updatedAt: new Date().toISOString()
        };
        updatedSale = nextSale;
        return nextSale;
      });
      try {
        localStorage.setItem('rspSales', JSON.stringify(updated));
      } catch (e) {}
      return updated;
    });

    // Synchronize payment into Day Book (reflects cash or bank immediately)
    if (updatedSale) {
      setDaybookTransactions(prev => {
        const filtered = prev.filter(item => item.matchedSaleId !== id);
        const newDbEntries = generateDaybookEntriesFromSale(updatedSale);
        const updated = [...newDbEntries, ...filtered];
        try {
          localStorage.setItem('rsp_daybook_transactions', JSON.stringify(updated));
        } catch (e) {}
        return updated;
      });
    }

    logActivity('RECORD_SALE_PAYMENT', `Recorded payment of ₹${payment.amount} (${payment.method || 'CASH'}) for sales order ID ${id}`);
  };

  const updateSalePayment = (saleId, paymentIdOrIdx, updatedPayment) => {
    let updatedSale = null;
    setSales(prev => {
      const updated = prev.map(s => {
        if (s.id !== saleId) return s;
        const payments = Array.isArray(s.payments) ? [...s.payments] : [];
        let targetIdx = -1;
        if (typeof paymentIdOrIdx === 'number') {
          targetIdx = paymentIdOrIdx;
        } else {
          targetIdx = payments.findIndex(p => p.id === paymentIdOrIdx);
        }

        if (targetIdx >= 0 && targetIdx < payments.length) {
          payments[targetIdx] = {
            ...payments[targetIdx],
            ...updatedPayment,
            amount: parseFloat(updatedPayment.amount !== undefined ? updatedPayment.amount : payments[targetIdx].amount) || 0
          };
        } else if (payments.length === 0) {
          payments.push({
            id: `pay_${Date.now()}`,
            ...updatedPayment,
            amount: parseFloat(updatedPayment.amount) || 0
          });
        }

        const totalPaid = payments.reduce((acc, p) => acc + (parseFloat(p.amount) || 0), 0);
        const finalAmt = parseFloat(s.finalAmount) || 0;
        const balance = Math.max(0, finalAmt - totalPaid);
        const paymentStatus = balance <= 0 ? 'paid' : (totalPaid > 0 ? 'partial' : 'pending');
        const isNowCleared = balance <= 0;

        const nextSale = {
          ...s,
          payments,
          paidAmount: totalPaid,
          balanceAmount: balance,
          paymentStatus,
          billStatus: isNowCleared ? 'NIL' : 'PENDING',
          updatedAt: new Date().toISOString()
        };
        updatedSale = nextSale;
        return nextSale;
      });
      try {
        localStorage.setItem('rspSales', JSON.stringify(updated));
      } catch (e) {}
      return updated;
    });

    if (updatedSale) {
      setDaybookTransactions(prev => {
        const filtered = prev.filter(item => item.matchedSaleId !== saleId);
        const newDbEntries = generateDaybookEntriesFromSale(updatedSale);
        const updated = [...newDbEntries, ...filtered];
        try {
          localStorage.setItem('rsp_daybook_transactions', JSON.stringify(updated));
        } catch (e) {}
        return updated;
      });
    }

    logActivity('UPDATE_PAYMENT', `Updated payment on sales order ID ${saleId}`);
  };

  const deleteSalePayment = (saleId, paymentIdOrIdx) => {
    let updatedSale = null;
    setSales(prev => {
      const updated = prev.map(s => {
        if (s.id !== saleId) return s;
        let payments = Array.isArray(s.payments) ? [...s.payments] : [];
        if (typeof paymentIdOrIdx === 'number') {
          payments.splice(paymentIdOrIdx, 1);
        } else {
          payments = payments.filter(p => p.id !== paymentIdOrIdx);
        }

        const totalPaid = payments.reduce((acc, p) => acc + (parseFloat(p.amount) || 0), 0);
        const finalAmt = parseFloat(s.finalAmount) || 0;
        const balance = Math.max(0, finalAmt - totalPaid);
        const paymentStatus = balance <= 0 ? 'paid' : (totalPaid > 0 ? 'partial' : 'pending');

        const nextSale = {
          ...s,
          payments,
          paidAmount: totalPaid,
          balanceAmount: balance,
          paymentStatus,
          billStatus: balance <= 0 ? 'NIL' : 'PENDING',
          updatedAt: new Date().toISOString()
        };
        updatedSale = nextSale;
        return nextSale;
      });
      try {
        localStorage.setItem('rspSales', JSON.stringify(updated));
      } catch (e) {}
      return updated;
    });

    if (updatedSale) {
      setDaybookTransactions(prev => {
        const filtered = prev.filter(item => item.matchedSaleId !== saleId);
        const newDbEntries = generateDaybookEntriesFromSale(updatedSale);
        const updated = [...newDbEntries, ...filtered];
        try {
          localStorage.setItem('rsp_daybook_transactions', JSON.stringify(updated));
        } catch (e) {}
        return updated;
      });
    }

    logActivity('DELETE_PAYMENT', `Deleted payment from sales order ID ${saleId}`);
  };

  const addCustomVoucher = (voucherData) => {
    const id = voucherData.id || `v_manual_${Date.now()}`;
    const newVoucher = {
      ...voucherData,
      id,
      voucherNo: voucherData.voucherNo || `VOUCH-${Date.now().toString().slice(-5)}`,
      createdAt: new Date().toISOString()
    };
    setCustomVouchers(prev => [newVoucher, ...prev]);
    logActivity({
      action: 'CREATE',
      entityType: 'voucher',
      entityId: id,
      title: `Created ${newVoucher.type || 'Manual'} Voucher #${newVoucher.voucherNo}`,
      details: `${newVoucher.party} • ₹${parseFloat(newVoucher.amount || 0).toLocaleString('en-IN')}`
    });
    return newVoucher;
  };

  const updateCustomVoucher = (id, updatedData) => {
    setCustomVouchers(prev => prev.map(v => v.id === id ? { ...v, ...updatedData, updatedAt: new Date().toISOString() } : v));
    logActivity({
      action: 'UPDATE',
      entityType: 'voucher',
      entityId: id,
      title: `Updated Voucher #${updatedData.voucherNo || id}`,
      details: `${updatedData.party} • ₹${parseFloat(updatedData.amount || 0).toLocaleString('en-IN')}`
    });
  };

  const deleteCustomVoucher = (id) => {
    const v = customVouchers.find(x => x.id === id);
    setCustomVouchers(prev => prev.filter(x => x.id !== id));
    logActivity({
      action: 'DELETE',
      entityType: 'voucher',
      entityId: id,
      title: `Deleted Voucher #${v?.voucherNo || id}`,
      details: `Removed manual voucher entry`
    });
  };

  const convertToSalesInvoice = (id, customInvoiceNo, customInvDate) => {
    setSales(prev => {
      return prev.map(s => {
        if (s.id !== id) return s;
        const invNo = customInvoiceNo || s.invoiceNo || `INV-26-${s.estNo}`;
        const invD = customInvDate || s.invDate || new Date().toISOString().substring(0, 10);
        return {
          ...s,
          isInvoice: true,
          invoiceNo: invNo,
          invDate: invD,
          updatedAt: new Date().toISOString()
        };
      });
    });
    logActivity('CONVERT_TO_INVOICE', `Generated Sales Invoice for order ID ${id}`);
  };


  const importSalesBulk = (newSales) => {
    if (!Array.isArray(newSales) || newSales.length === 0) return 0;
    const processed = newSales.map(ensureSaleTaxSeparated);
    setSales(prev => {
      // Avoid duplicate by branch, orderDate, estNo, customerName
      const map = new Map();
      prev.forEach(s => map.set(`${s.branch}_${s.orderDate}_${s.estNo}_${s.customerName || ''}`, s));
      processed.forEach(s => map.set(`${s.branch}_${s.orderDate}_${s.estNo}_${s.customerName || ''}`, s));
      const merged = Array.from(map.values()).sort((a, b) => new Date(b.orderDate) - new Date(a.orderDate));
      try {
        localStorage.setItem('rspSales', JSON.stringify(merged));
      } catch (e) {}
      return merged;
    });

    setDaybookTransactions(prev => {
      const dbEntriesToAdd = [];
      processed.forEach(s => {
        dbEntriesToAdd.push(...generateDaybookEntriesFromSale(s));
      });
      if (dbEntriesToAdd.length === 0) return prev;
      const existingMatchedIds = new Set(dbEntriesToAdd.map(e => e.matchedSaleId));
      const filtered = prev.filter(e => !existingMatchedIds.has(e.matchedSaleId));
      const merged = [...dbEntriesToAdd, ...filtered];
      try {
        localStorage.setItem('rsp_daybook_transactions', JSON.stringify(merged));
      } catch (e) {}
      return merged;
    });

    logActivity('IMPORT_SALES', `Imported ${newSales.length} sales orders from Excel`);
    return newSales.length;
  };

  const clearAllSales = () => {
    const backupSnapshot = [...sales];
    const salesDbEntries = daybookTransactions.filter(e => e.category === 'SALES' || e.matchedSaleId);

    setSales([]);
    setDaybookTransactions(prev => {
      const updated = prev.filter(e => e.category !== 'SALES' && !e.matchedSaleId);
      try {
        localStorage.setItem('rsp_daybook_transactions', JSON.stringify(updated));
      } catch (e) {}
      return updated;
    });
    try {
      localStorage.setItem('rsp_sales_wiped', 'true');
      localStorage.setItem('rspSales', JSON.stringify([]));
    } catch (e) {}

    logActivity({
      action: 'CLEAR_SALES',
      entityType: 'sale',
      entityId: `wipe_${Date.now()}`,
      title: 'Wiped All Sales Register Data',
      details: `Cleared ${backupSnapshot.length} sales orders. Archived snapshot for restore via Activity Logs.`,
      snapshot: backupSnapshot,
      daybookSnapshot: salesDbEntries
    });
  };

  const restoreSalesFromLog = (snapshot, daybookSnapshot) => {
    if (!Array.isArray(snapshot)) return 0;
    const processed = snapshot.map(ensureSaleTaxSeparated);
    setSales(processed);
    localStorage.removeItem('rsp_sales_wiped');
    localStorage.setItem('rspSales', JSON.stringify(processed));

    setDaybookTransactions(prev => {
      const nonSales = prev.filter(e => e.category !== 'SALES' && !e.matchedSaleId);
      let toRestore = [];
      if (Array.isArray(daybookSnapshot) && daybookSnapshot.length > 0) {
        toRestore = daybookSnapshot;
      } else {
        processed.forEach(s => {
          toRestore.push(...generateDaybookEntriesFromSale(s));
        });
      }
      const combined = [...toRestore, ...nonSales];
      try {
        localStorage.setItem('rsp_daybook_transactions', JSON.stringify(combined));
      } catch (e) {}
      return combined;
    });

    logActivity({
      action: 'RESTORE_SALES',
      entityType: 'sale',
      entityId: `restore_${Date.now()}`,
      title: 'Restored Sales Register Data from Activity Log',
      details: `Recovered ${processed.length} sales orders and chained Day Book / Cash & Bank records.`
    });
    return processed.length;
  };

  const restoreDefaultSales = () => {
    const septProcessed = septemberSalesFull.map(ensureSaleTaxSeparated);
    setSales(septProcessed);
    localStorage.removeItem('rsp_sales_wiped');
    localStorage.setItem('rspSales', JSON.stringify(septProcessed));
    logActivity({
      action: 'RESTORE_SALES',
      entityType: 'sale',
      entityId: `restore_default_${Date.now()}`,
      title: 'Restored Default September 2026 Sales',
      details: `Restored ${septProcessed.length} original orders.`
    });
    return septProcessed.length;
  };

  const mergeDefaultSeptemberSales = () => {
    const septProcessed = septemberSalesFull.map(ensureSaleTaxSeparated);
    setSales(prev => {
      const map = new Map();
      prev.forEach(s => map.set(`${s.branch}_${s.orderDate}_${s.estNo}_${s.customerName || ''}`, s));
      septProcessed.forEach(s => map.set(`${s.branch}_${s.orderDate}_${s.estNo}_${s.customerName || ''}`, s));
      const merged = Array.from(map.values()).sort((a, b) => new Date(b.orderDate) - new Date(a.orderDate));
      try {
        localStorage.removeItem('rsp_sales_wiped');
        localStorage.setItem('rspSales', JSON.stringify(merged));
      } catch (e) {
        console.warn('localStorage quota notice:', e);
      }
      return merged;
    });
    logActivity({
      action: 'RESTORE_SALES',
      entityType: 'sale',
      entityId: `merge_${Date.now()}`,
      title: 'Merged September 2026 Sales Records',
      details: `Merged ${septProcessed.length} default records into current register.`
    });
    return septProcessed.length;
  };

  // Dynamic Masters Management
  const addBranch = (name) => {
    if (!name) return '';
    const clean = name.trim().toUpperCase();
    if (!clean) return '';
    setBranches(prev => prev.includes(clean) ? prev : [...prev, clean]);
    logActivity('ADD_BRANCH', `Added new branch: ${clean}`);
    return clean;
  };

  const deleteBranch = (name) => {
    setBranches(prev => prev.filter(b => b !== name));
    logActivity('DELETE_BRANCH', `Removed branch: ${name}`);
  };

  const addDepartment = (name) => {
    if (!name) return '';
    const clean = name.trim().toUpperCase();
    if (!clean) return '';
    setDepartments(prev => prev.includes(clean) ? prev : [...prev, clean]);
    logActivity('ADD_DEPARTMENT', `Added new department: ${clean}`);
    return clean;
  };

  const deleteDepartment = (name) => {
    setDepartments(prev => prev.filter(d => d !== name));
    logActivity('DELETE_DEPARTMENT', `Removed department: ${name}`);
  };

  const addExpenseCategory = (name) => {
    if (!name) return '';
    const clean = name.trim();
    if (!clean) return '';
    setExpenseCategories(prev => {
      if (prev.some(c => c.toLowerCase() === clean.toLowerCase())) return prev;
      return [...prev, clean];
    });
    logActivity('ADD_EXPENSE_CATEGORY', `Added new expense category: ${clean}`);
    return clean;
  };

  const deleteExpenseCategory = (name) => {
    setExpenseCategories(prev => prev.filter(c => c !== name));
    logActivity('DELETE_EXPENSE_CATEGORY', `Removed expense category: ${name}`);
  };

  const addPaymentMethod = (name) => {
    if (!name) return '';
    const clean = name.trim().toUpperCase();
    if (!clean) return '';
    setPaymentMethods(prev => prev.includes(clean) ? prev : [...prev, clean]);
    logActivity('ADD_PAYMENT_METHOD', `Added new payment method / bank: ${clean}`);
    return clean;
  };

  const deletePaymentMethod = (name) => {
    setPaymentMethods(prev => prev.filter(m => m !== name));
    logActivity('DELETE_PAYMENT_METHOD', `Removed payment method: ${name}`);
  };

  return (

    <DataContext.Provider
      value={{
        bills,
        vendors,
        items,
        expenses,
        assets,
        recycleBin,
        recycleBinCount: recycleBin.length,
        logs,
        loading,
        dismissLoading: () => setLoading(false),
        isOnline,
        isCloudSynced,
        pendingSyncCount: pendingSyncQueue.length,
        syncPendingQueue,
        saveBill,
        deleteBill,
        restoreBill,
        permanentDeleteBill,
        recordBillPayment,
        updateBillPayment,
        deleteBillPayment,
        markAllBillsAsPaid,
        saveVendor,
        deleteVendor,
        recordVendorPayment,
        recordVendorAdvancePayment,
        updateVendorPayment,
        deleteVendorPayment,
        saveItem,
        deleteItem,
        syncItemsFromSalesData,
        saveExpense,
        deleteExpense,
        syncExpensesFromDaybook,
        saveAsset,
        deleteAsset,
        recordAssetPayment,
        logActivity,
        removeDraftActivityLog,
        clearAllDraftLogs,
        syncServerTime,
        getServerSyncStatus,
        getServerTimeISO,
        formatServerTimestamp,
        exportAllDataJSON,
        restoreAllData,
        // Sales module (local demo)
        sales,
        saveSale,
        deleteSale,
        recordSalePayment,
        updateSalePayment,
        deleteSalePayment,
        convertToSalesInvoice,
        importSalesBulk,
        clearAllSales,
        restoreDefaultSales,
        restoreSalesFromLog,
        mergeDefaultSeptemberSales,
        // Standalone Vouchers
        customVouchers,
        addCustomVoucher,
        updateCustomVoucher,
        deleteCustomVoucher,
        // Day Book Space & Transactions
        daybookTransactions,
        addDaybookTransaction,
        updateDaybookTransaction,
        deleteDaybookTransaction,
        resetDaybookToDefault,
        cleanNonRegisterDaybookEntries,
        isDaybookEntryAssociated,
        // Bank Statements
        bankStatements,
        saveBankStatements,
        deleteBankStatementEntry,
        clearBankStatements,
        // Dynamic Masters
        branches,
        departments,
        expenseCategories,
        paymentMethods,
        addBranch,
        deleteBranch,
        addDepartment,
        deleteDepartment,
        addExpenseCategory,
        deleteExpenseCategory,
        addPaymentMethod,
        deletePaymentMethod
      }}

    >
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
}
