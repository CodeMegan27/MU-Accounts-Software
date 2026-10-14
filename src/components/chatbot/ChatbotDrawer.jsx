import React, { useState, useEffect, useRef } from 'react';
import { useData } from '../../context/DataContext';
import { formatCurrency, formatDate } from '../../utils/formatters';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { 
  Bot, 
  X, 
  Send, 
  FileSpreadsheet, 
  FileText, 
  Image as ImageIcon, 
  Sparkles, 
  Trash2, 
  Receipt, 
  Maximize2, 
  Minimize2,
  Zap,
  Key,
  Database
} from 'lucide-react';

const DEFAULT_GEMINI_KEY = 'AIzaSyB0Zel74grr7L2RFYe4idVfg5s2RD3Jtfw';
const GEMINI_MODELS = [
  'gemini-3.5-flash-lite',
  'gemini-2.5-flash',
  'gemini-flash-latest'
];

export default function ChatbotDrawer() {
  const dataContext = useData() || {};

  // Full Read Access to ALL Website Server Collections & States
  const sales = Array.isArray(dataContext.sales) ? dataContext.sales : [];
  const bills = Array.isArray(dataContext.bills) ? dataContext.bills : [];
  const expenses = Array.isArray(dataContext.expenses) ? dataContext.expenses : [];
  const vendors = Array.isArray(dataContext.vendors) ? dataContext.vendors : [];
  const items = Array.isArray(dataContext.items) ? dataContext.items : [];
  const assets = Array.isArray(dataContext.assets) ? dataContext.assets : [];
  const recycleBin = Array.isArray(dataContext.recycleBin) ? dataContext.recycleBin : [];
  const logs = Array.isArray(dataContext.logs) ? dataContext.logs : [];
  const customVouchers = Array.isArray(dataContext.customVouchers) ? dataContext.customVouchers : [];
  const daybookTransactions = Array.isArray(dataContext.daybookTransactions) ? dataContext.daybookTransactions : [];
  const bankStatements = dataContext.bankStatements || { idbi: [], sbi: [] };
  const branches = Array.isArray(dataContext.branches) ? dataContext.branches : [];
  const departments = Array.isArray(dataContext.departments) ? dataContext.departments : [];
  const expenseCategories = Array.isArray(dataContext.expenseCategories) ? dataContext.expenseCategories : [];
  const paymentMethods = Array.isArray(dataContext.paymentMethods) ? dataContext.paymentMethods : [];
  const isOnline = Boolean(dataContext.isOnline);
  const isCloudSynced = Boolean(dataContext.isCloudSynced);
  const pendingSyncCount = Number(dataContext.pendingSyncCount || 0);

  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [apiKey, setApiKey] = useState(() => {
    return localStorage.getItem('rsp_gemini_api_key') || import.meta.env.VITE_GEMINI_API_KEY || DEFAULT_GEMINI_KEY;
  });
  const [tempKeyInput, setTempKeyInput] = useState(apiKey);

  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [statusLabel, setStatusLabel] = useState('');

  const messagesEndRef = useRef(null);
  const chatContainerRef = useRef(null);

  // Clean AI Initial Greeting (No old hardcoded replies or buttons)
  const [messages, setMessages] = useState([
    {
      id: 'init-1',
      sender: 'bot',
      text: 'Hello! I am your Gemini AI Assistant with full read access to all live data across this website. Ask me anything about your sales, purchases, vendors, inventory items, expenses, day book, bank statements, assets, or activity logs.',
      timestamp: new Date()
    }
  ]);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (isOpen && !isMinimized) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen, isMinimized, isTyping]);

  // 2-Minute Inactivity Auto-Engagement
  useEffect(() => {
    let inactivityTimer;
    const INACTIVITY_LIMIT_MS = 120 * 1000;

    const triggerInactivityPrompt = () => {
      setIsOpen(true);
      setIsMinimized(false);
      setMessages(prev => {
        if (prev.length > 0 && prev[prev.length - 1].isInactivityPrompt) {
          return prev;
        }
        return [
          ...prev,
          {
            id: `inactivity-${Date.now()}`,
            sender: 'bot',
            text: 'Hi! Let me know if you need help looking up any records, invoices, vendor balances, or financial reports from the website.',
            timestamp: new Date(),
            isInactivityPrompt: true
          }
        ];
      });
    };

    const resetInactivityTimer = () => {
      clearTimeout(inactivityTimer);
      inactivityTimer = setTimeout(triggerInactivityPrompt, INACTIVITY_LIMIT_MS);
    };

    const userActivityEvents = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click'];
    userActivityEvents.forEach(evt => {
      window.addEventListener(evt, resetInactivityTimer, { passive: true });
    });

    resetInactivityTimer();

    return () => {
      clearTimeout(inactivityTimer);
      userActivityEvents.forEach(evt => {
        window.removeEventListener(evt, resetInactivityTimer);
      });
    };
  }, []);

  const handleSaveApiKey = () => {
    const trimmed = tempKeyInput.trim();
    if (trimmed) {
      localStorage.setItem('rsp_gemini_api_key', trimmed);
      setApiKey(trimmed);
      setShowKeyModal(false);
    }
  };

  // ============================================================================
  // DYNAMIC FULL-SERVER DATA READERS & QUERY ENGINE (ZERO HARDCODED ASSUMPTIONS)
  // ============================================================================

  const extractDateParts = (rawDate) => {
    const d = String(rawDate || '').trim();
    if (!d) return { year: 'Unknown', month: 'Unknown', ym: 'Unknown', date: '' };
    // Support YYYY-MM-DD or DD/MM/YYYY or ISO strings
    const isoMatch = d.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (isoMatch) {
      return { year: isoMatch[1], month: isoMatch[2], ym: `${isoMatch[1]}-${isoMatch[2]}`, date: `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}` };
    }
    const dmyMatch = d.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
    if (dmyMatch) {
      const m = dmyMatch[2].padStart(2, '0');
      const day = dmyMatch[1].padStart(2, '0');
      return { year: dmyMatch[3], month: m, ym: `${dmyMatch[3]}-${m}`, date: `${dmyMatch[3]}-${m}-${day}` };
    }
    return { year: d.slice(0, 4), month: d.slice(5, 7), ym: d.slice(0, 7), date: d.slice(0, 10) };
  };

  const normalizeMonthInput = (m) => {
    if (!m) return '';
    const str = String(m).toLowerCase().trim();
    const monthNames = {
      jan: '01', january: '01', '1': '01', '01': '01',
      feb: '02', february: '02', '2': '02', '02': '02',
      mar: '03', march: '03', '3': '03', '03': '03',
      apr: '04', april: '04', '4': '04', '04': '04',
      may: '05', '5': '05', '05': '05',
      jun: '06', june: '06', '6': '06', '06': '06',
      jul: '07', july: '07', '7': '07', '07': '07',
      aug: '08', august: '08', '8': '08', '08': '08',
      sep: '09', sept: '09', september: '09', '9': '09', '09': '09',
      oct: '10', october: '10', '10': '10',
      nov: '11', november: '11', '11': '11',
      dec: '12', december: '12', '12': '12'
    };
    return monthNames[str] || str.padStart(2, '0');
  };

  // Compute full vendor ledgers combining purchase bills + vendor expenses
  const computeAllVendorLedgers = () => {
    return vendors.map(v => {
      if (!v) return null;
      const vBills = bills.filter(b => b && (b.vendorId === v.id || (b.vendorName && v.name && b.vendorName.toLowerCase().trim() === v.name.toLowerCase().trim())));
      let purchaseBilled = 0;
      let purchasePaid = 0;
      vBills.forEach(b => {
        purchaseBilled += parseFloat(b.grandTotal) || 0;
        purchasePaid += parseFloat(b.paidAmount) || 0;
      });

      const vExpenses = expenses.filter(e => {
        if (!e) return false;
        const p = (e.payee || e.vendorName || '').toLowerCase().trim();
        const vn = (v.name || '').toLowerCase().trim();
        return p && vn && (p === vn || p.includes(vn) || vn.includes(p));
      });
      let expenseBilled = 0;
      vExpenses.forEach(e => {
        expenseBilled += parseFloat(e.amount) || 0;
      });

      const vAssets = assets.filter(a => {
        if (!a) return false;
        if (a.vendorId && v.id && a.vendorId === v.id) return true;
        const av = (a.vendorName || '').toLowerCase().trim();
        const vn = (v.name || '').toLowerCase().trim();
        return av && vn && (av === vn || av.includes(vn) || vn.includes(av));
      });
      let assetBilled = 0;
      let assetPaid = 0;
      vAssets.forEach(a => {
        const g = parseFloat(a.grandTotal !== undefined ? a.grandTotal : a.value) || 0;
        const p = parseFloat(a.paidAmount) || 0;
        assetBilled += g;
        assetPaid += p;
      });

      const totalBilled = purchaseBilled + expenseBilled + assetBilled;
      const totalPaid = purchasePaid + expenseBilled + assetPaid;
      const balanceDue = Math.max(0, totalBilled - totalPaid);

      return {
        id: v.id,
        name: v.name || 'Unnamed Vendor',
        gstin: v.gstin || '',
        phone: v.phone || v.mobile || '',
        email: v.email || '',
        address: v.address || '',
        city: v.city || '',
        state: v.state || '',
        purchaseBillsCount: vBills.length,
        expenseVouchersCount: vExpenses.length,
        assetBillsCount: vAssets.length,
        purchaseBilled: Math.round(purchaseBilled * 100) / 100,
        expenseAmount: Math.round(expenseBilled * 100) / 100,
        assetBilled: Math.round(assetBilled * 100) / 100,
        totalBilled: Math.round(totalBilled * 100) / 100,
        totalPaid: Math.round(totalPaid * 100) / 100,
        balanceDue: Math.round(balanceDue * 100) / 100
      };
    }).filter(Boolean);
  };

  // Tool 1: Query / Search / Filter ANY collection in the website server
  const executeQueryWebsiteData = (args = {}) => {
    const collection = String(args.collection || 'sales').toLowerCase().trim();
    const search = String(args.search || '').toLowerCase().trim();
    const yearFilter = args.year ? String(args.year).trim() : '';
    const monthFilter = args.month ? normalizeMonthInput(args.month) : '';
    const dateFrom = args.dateFrom ? String(args.dateFrom).trim() : '';
    const dateTo = args.dateTo ? String(args.dateTo).trim() : '';
    const branchFilter = args.branch ? String(args.branch).toUpperCase().trim() : '';
    const deptFilter = args.department ? String(args.department).toUpperCase().trim() : '';
    const categoryFilter = args.category ? String(args.category).toLowerCase().trim() : '';
    const statusFilter = args.status ? String(args.status).toLowerCase().trim() : '';
    const limit = Math.min(Math.max(Number(args.limit) || 50, 1), 200);

    const matchDate = (rawDate) => {
      if (!yearFilter && !monthFilter && !dateFrom && !dateTo) return true;
      const dp = extractDateParts(rawDate);
      if (yearFilter && dp.year !== yearFilter) return false;
      if (monthFilter && dp.month !== monthFilter) return false;
      if (dateFrom && dp.date < dateFrom) return false;
      if (dateTo && dp.date > dateTo) return false;
      return true;
    };

    const matchSearch = (obj) => {
      if (!search) return true;
      const serialized = JSON.stringify(obj).toLowerCase();
      return search.split(/\s+/).every(token => serialized.includes(token));
    };

    if (collection === 'sales' || collection === 'sale' || collection === 'orders' || collection === 'invoices') {
      const filtered = sales.filter(s => {
        if (!s) return false;
        if (!matchDate(s.invDate || s.orderDate || s.date)) return false;
        if (branchFilter && String(s.branch || 'KLK').toUpperCase() !== branchFilter) return false;
        if (deptFilter && !String(s.department || '').toUpperCase().includes(deptFilter)) return false;
        if (statusFilter && !String(s.status || s.paymentStatus || '').toLowerCase().includes(statusFilter)) return false;
        return matchSearch(s);
      });

      let totalGross = 0, totalTaxable = 0, totalGst = 0, totalPaid = 0, totalBalance = 0;
      const byBranch = {}, byDept = {};

      filtered.forEach(s => {
        const gross = parseFloat(s.finalAmount !== undefined ? s.finalAmount : s.subtotal) || 0;
        const paid = parseFloat(s.paidAmount !== undefined ? s.paidAmount : (s.advanceAmount || s.receivedAmount || 0)) || 0;
        const bal = parseFloat(s.balanceAmount !== undefined ? s.balanceAmount : Math.max(0, gross - paid)) || 0;
        totalGross += gross;
        totalTaxable += parseFloat(s.taxableAmount) || 0;
        totalGst += parseFloat(s.gstAmount) || 0;
        totalPaid += paid;
        totalBalance += bal;
        const br = String(s.branch || 'KLK').toUpperCase();
        byBranch[br] = Math.round(((byBranch[br] || 0) + gross) * 100) / 100;
        const dp = String(s.department || 'GENERAL').toUpperCase();
        byDept[dp] = Math.round(((byDept[dp] || 0) + gross) * 100) / 100;
      });

      return {
        collection: 'sales',
        totalMatchingRecords: filtered.length,
        summary: {
          totalGrossSales: Math.round(totalGross * 100) / 100,
          totalTaxable: Math.round(totalTaxable * 100) / 100,
          totalGst: Math.round(totalGst * 100) / 100,
          totalCollected: Math.round(totalPaid * 100) / 100,
          totalBalanceReceivable: Math.round(totalBalance * 100) / 100,
          branchBreakdown: byBranch,
          departmentBreakdown: byDept
        },
        records: filtered.slice(0, limit).map(s => ({
          id: s.id,
          estNo: s.estNo || '',
          invNo: s.invNo || s.invoiceNo || '',
          date: s.invDate || s.orderDate || s.date || '',
          customerName: s.customerName || '',
          customerPhone: s.customerPhone || s.contact || '',
          branch: s.branch || 'KLK',
          department: s.department || '',
          items: Array.isArray(s.items) ? s.items.map(i => `${i.description || i.name || 'Item'} (Qty:${i.qty || 1}, Amt:${i.amount || i.total || 0})`).join('; ') : (s.description || ''),
          taxableAmount: s.taxableAmount,
          gstAmount: s.gstAmount,
          finalAmount: s.finalAmount !== undefined ? s.finalAmount : s.subtotal,
          paidAmount: s.paidAmount !== undefined ? s.paidAmount : (s.advanceAmount || 0),
          balanceAmount: s.balanceAmount,
          paymentMethod: s.advanceMethod || s.paymentMethod || 'CASH',
          status: s.status || ''
        }))
      };
    }

    if (collection === 'bills' || collection === 'purchases' || collection === 'purchase') {
      const filtered = bills.filter(b => {
        if (!b) return false;
        if (!matchDate(b.date || b.invoiceDate)) return false;
        if (branchFilter && String(b.branch || '').toUpperCase() !== branchFilter) return false;
        if (statusFilter && !String(b.paymentStatus || '').toLowerCase().includes(statusFilter)) return false;
        return matchSearch(b);
      });

      let totalPurchases = 0, totalPaid = 0, totalBalance = 0, totalTaxable = 0, totalGst = 0;
      filtered.forEach(b => {
        totalPurchases += parseFloat(b.grandTotal) || 0;
        totalPaid += parseFloat(b.paidAmount) || 0;
        totalBalance += parseFloat(b.balanceAmount) || 0;
        totalTaxable += parseFloat(b.totalTaxable) || 0;
        totalGst += (parseFloat(b.totalCgst) || 0) + (parseFloat(b.totalSgst) || 0) + (parseFloat(b.totalIgst) || 0);
      });

      return {
        collection: 'bills',
        totalMatchingRecords: filtered.length,
        summary: {
          totalGrandTotal: Math.round(totalPurchases * 100) / 100,
          totalTaxable: Math.round(totalTaxable * 100) / 100,
          totalGst: Math.round(totalGst * 100) / 100,
          totalPaid: Math.round(totalPaid * 100) / 100,
          totalBalanceDue: Math.round(totalBalance * 100) / 100
        },
        records: filtered.slice(0, limit).map(b => ({
          id: b.id,
          invoiceNo: b.invoiceNo || '',
          date: b.date || '',
          vendorName: b.vendorName || '',
          vendorGstin: b.vendorGstin || '',
          totalTaxable: b.totalTaxable,
          totalCgst: b.totalCgst,
          totalSgst: b.totalSgst,
          totalIgst: b.totalIgst,
          grandTotal: b.grandTotal,
          paidAmount: b.paidAmount,
          balanceAmount: b.balanceAmount,
          paymentStatus: b.paymentStatus,
          items: Array.isArray(b.items) ? b.items.map(i => `${i.description || i.name || 'Item'} (Qty:${i.qty || 1}, Rate:${i.rate || 0}, Total:${i.total || i.taxableValue || 0})`).join('; ') : ''
        }))
      };
    }

    if (collection === 'vendors' || collection === 'suppliers' || collection === 'vendor') {
      const allLedgers = computeAllVendorLedgers();
      const filtered = allLedgers.filter(v => matchSearch(v));
      return {
        collection: 'vendors',
        totalMatchingRecords: filtered.length,
        summary: {
          totalVendors: filtered.length,
          totalBilledAcrossMatching: Math.round(filtered.reduce((s, v) => s + v.totalBilled, 0) * 100) / 100,
          totalPaidAcrossMatching: Math.round(filtered.reduce((s, v) => s + v.totalPaid, 0) * 100) / 100,
          totalBalanceDueAcrossMatching: Math.round(filtered.reduce((s, v) => s + v.balanceDue, 0) * 100) / 100
        },
        records: filtered.slice(0, limit)
      };
    }

    if (collection === 'expenses' || collection === 'expense') {
      const filtered = expenses.filter(e => {
        if (!e) return false;
        if (!matchDate(e.date)) return false;
        if (branchFilter && String(e.branch || '').toUpperCase() !== branchFilter) return false;
        if (deptFilter && !String(e.department || '').toUpperCase().includes(deptFilter)) return false;
        if (categoryFilter && !String(e.category || '').toLowerCase().includes(categoryFilter)) return false;
        return matchSearch(e);
      });

      let totalAmount = 0;
      const byCategory = {}, byBranch = {}, byDept = {};
      filtered.forEach(e => {
        const amt = parseFloat(e.amount) || 0;
        totalAmount += amt;
        const cat = e.category || 'Uncategorized';
        byCategory[cat] = Math.round(((byCategory[cat] || 0) + amt) * 100) / 100;
        const br = e.branch || 'KLK';
        byBranch[br] = Math.round(((byBranch[br] || 0) + amt) * 100) / 100;
        const dp = e.department || 'GENERAL ADMIN';
        byDept[dp] = Math.round(((byDept[dp] || 0) + amt) * 100) / 100;
      });

      return {
        collection: 'expenses',
        totalMatchingRecords: filtered.length,
        summary: {
          totalExpenseAmount: Math.round(totalAmount * 100) / 100,
          byCategory,
          byBranch,
          byDepartment: byDept
        },
        records: filtered.slice(0, limit).map(e => ({
          id: e.id,
          date: e.date,
          voucherNo: e.voucherNo,
          branch: e.branch,
          department: e.department,
          category: e.category,
          payee: e.payee || e.vendorName || '',
          description: e.description || '',
          paymentMethod: e.paymentMethod || '',
          amount: e.amount
        }))
      };
    }

    if (collection === 'daybook' || collection === 'daybooktransactions' || collection === 'cashbook') {
      const filtered = daybookTransactions.filter(t => {
        if (!t) return false;
        if (!matchDate(t.date)) return false;
        if (branchFilter && String(t.branch || '').toUpperCase() !== branchFilter) return false;
        if (deptFilter && !String(t.department || '').toUpperCase().includes(deptFilter)) return false;
        if (categoryFilter && !String(t.category || '').toLowerCase().includes(categoryFilter)) return false;
        return matchSearch(t);
      });

      let cashCr = 0, cashDr = 0, bankCr = 0, bankDr = 0;
      filtered.forEach(t => {
        cashCr += parseFloat(t.cashCredit) || 0;
        cashDr += parseFloat(t.cashDebit) || 0;
        bankCr += parseFloat(t.bankCredit) || 0;
        bankDr += parseFloat(t.bankDebit) || 0;
      });

      return {
        collection: 'daybook',
        totalMatchingRecords: filtered.length,
        summary: {
          cashCreditInflow: Math.round(cashCr * 100) / 100,
          cashDebitOutflow: Math.round(cashDr * 100) / 100,
          netCashFlow: Math.round((cashCr - cashDr) * 100) / 100,
          bankCreditInflow: Math.round(bankCr * 100) / 100,
          bankDebitOutflow: Math.round(bankDr * 100) / 100,
          netBankFlow: Math.round((bankCr - bankDr) * 100) / 100
        },
        records: filtered.slice(0, limit)
      };
    }

    if (collection === 'items' || collection === 'products' || collection === 'inventory') {
      const filtered = items.filter(i => i && matchSearch(i));
      return {
        collection: 'items',
        totalMatchingRecords: filtered.length,
        records: filtered.slice(0, limit)
      };
    }

    if (collection === 'assets' || collection === 'fixedassets') {
      const filtered = assets.filter(a => a && matchDate(a.date || a.purchaseDate) && matchSearch(a));
      let totalTaxable = 0, totalTax = 0, totalGrand = 0, totalPaid = 0, totalBalance = 0;
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
        collection: 'assets',
        totalMatchingRecords: filtered.length,
        summary: {
          totalTaxableBase: Math.round(totalTaxable * 100) / 100,
          totalGstInputCredit: Math.round(totalTax * 100) / 100,
          totalGrandTotal: Math.round(totalGrand * 100) / 100,
          totalPaidToVendors: Math.round(totalPaid * 100) / 100,
          totalOutstandingBalanceDue: Math.round(totalBalance * 100) / 100
        },
        records: filtered.slice(0, limit).map(a => ({
          id: a.id,
          voucherNo: a.voucherNo,
          invoiceNo: a.invoiceNo,
          date: a.date,
          name: a.name,
          category: a.category,
          vendorName: a.vendorName,
          vendorGstin: a.vendorGstin,
          hsn: a.hsn,
          taxableAmount: a.taxableAmount !== undefined ? a.taxableAmount : a.value,
          gstRate: a.taxRate,
          cgst: a.cgst,
          sgst: a.sgst,
          igst: a.igst,
          totalTax: a.totalTax,
          grandTotal: a.grandTotal !== undefined ? a.grandTotal : a.value,
          paidAmount: a.paidAmount,
          balanceAmount: a.balanceAmount,
          paymentStatus: a.paymentStatus,
          itcEligibility: a.itcEligibility
        }))
      };
    }

    if (collection === 'customvouchers' || collection === 'vouchers') {
      const filtered = customVouchers.filter(v => v && matchDate(v.date) && matchSearch(v));
      return {
        collection: 'customVouchers',
        totalMatchingRecords: filtered.length,
        records: filtered.slice(0, limit)
      };
    }

    if (collection === 'bankstatements' || collection === 'bank') {
      const idbiList = Array.isArray(bankStatements?.idbi) ? bankStatements.idbi : [];
      const sbiList = Array.isArray(bankStatements?.sbi) ? bankStatements.sbi : [];
      const combined = [
        ...idbiList.map(x => ({ ...x, bank: 'IDBI' })),
        ...sbiList.map(x => ({ ...x, bank: 'SBI' }))
      ].filter(x => matchDate(x.date) && matchSearch(x));
      return {
        collection: 'bankStatements',
        totalMatchingRecords: combined.length,
        idbiCount: idbiList.length,
        sbiCount: sbiList.length,
        records: combined.slice(0, limit)
      };
    }

    if (collection === 'recyclebin' || collection === 'trash' || collection === 'deleted') {
      const filtered = recycleBin.filter(r => r && matchSearch(r));
      return {
        collection: 'recycleBin',
        totalMatchingRecords: filtered.length,
        records: filtered.slice(0, limit)
      };
    }

    if (collection === 'logs' || collection === 'activitylogs' || collection === 'auditlogs') {
      const filtered = logs.filter(l => l && matchDate(l.timestamp) && matchSearch(l));
      return {
        collection: 'logs',
        totalMatchingRecords: filtered.length,
        records: filtered.slice(0, limit)
      };
    }

    return {
      collection: 'masters',
      branches,
      departments,
      expenseCategories,
      paymentMethods,
      isOnline,
      isCloudSynced,
      pendingSyncCount
    };
  };

  // Build Comprehensive Dynamic Live Server Snapshot for System Instruction
  const buildFullServerSnapshot = () => {
    // 1. Dynamically group Sales by Year-Month, Branch, Department
    const salesByMonth = {};
    const salesByYear = {};
    const salesByBranch = {};
    const salesByDept = {};
    let totalSalesGross = 0, totalSalesTaxable = 0, totalSalesGst = 0, totalSalesPaid = 0, totalSalesPending = 0;

    sales.forEach(s => {
      if (!s) return;
      const dp = extractDateParts(s.invDate || s.orderDate || s.date);
      const gross = parseFloat(s.finalAmount !== undefined ? s.finalAmount : s.subtotal) || 0;
      const taxable = parseFloat(s.taxableAmount) || 0;
      const gst = parseFloat(s.gstAmount) || 0;
      const paid = parseFloat(s.paidAmount !== undefined ? s.paidAmount : (s.advanceAmount || s.receivedAmount || 0)) || 0;
      const bal = parseFloat(s.balanceAmount !== undefined ? s.balanceAmount : Math.max(0, gross - paid)) || 0;

      totalSalesGross += gross;
      totalSalesTaxable += taxable;
      totalSalesGst += gst;
      totalSalesPaid += paid;
      totalSalesPending += bal;

      if (!salesByMonth[dp.ym]) {
        salesByMonth[dp.ym] = { count: 0, gross: 0, paid: 0, balance: 0, branches: {}, departments: {} };
      }
      salesByMonth[dp.ym].count += 1;
      salesByMonth[dp.ym].gross += gross;
      salesByMonth[dp.ym].paid += paid;
      salesByMonth[dp.ym].balance += bal;

      const br = String(s.branch || 'KLK').toUpperCase();
      const dept = String(s.department || 'GENERAL').toUpperCase();
      salesByMonth[dp.ym].branches[br] = (salesByMonth[dp.ym].branches[br] || 0) + gross;
      salesByMonth[dp.ym].departments[dept] = (salesByMonth[dp.ym].departments[dept] || 0) + gross;

      if (!salesByYear[dp.year]) salesByYear[dp.year] = { count: 0, gross: 0 };
      salesByYear[dp.year].count += 1;
      salesByYear[dp.year].gross += gross;

      salesByBranch[br] = (salesByBranch[br] || 0) + gross;
      salesByDept[dept] = (salesByDept[dept] || 0) + gross;
    });

    // 2. Dynamically group Purchases (bills) by Year-Month & Vendor
    const billsByMonth = {};
    let totalPurchaseGross = 0, totalPurchaseTaxable = 0, totalPurchaseGst = 0, totalPurchasePaid = 0, totalPurchaseDue = 0;
    bills.forEach(b => {
      if (!b) return;
      const dp = extractDateParts(b.date || b.invoiceDate);
      const g = parseFloat(b.grandTotal) || 0;
      const p = parseFloat(b.paidAmount) || 0;
      const due = parseFloat(b.balanceAmount !== undefined ? b.balanceAmount : Math.max(0, g - p)) || 0;
      const tax = parseFloat(b.totalTaxable) || 0;
      const gst = (parseFloat(b.totalCgst) || 0) + (parseFloat(b.totalSgst) || 0) + (parseFloat(b.totalIgst) || 0);

      totalPurchaseGross += g;
      totalPurchaseTaxable += tax;
      totalPurchaseGst += gst;
      totalPurchasePaid += p;
      totalPurchaseDue += due;

      if (!billsByMonth[dp.ym]) billsByMonth[dp.ym] = { count: 0, grandTotal: 0, paid: 0, due: 0 };
      billsByMonth[dp.ym].count += 1;
      billsByMonth[dp.ym].grandTotal += g;
      billsByMonth[dp.ym].paid += p;
      billsByMonth[dp.ym].due += due;
    });

    // 3. All Vendors Ledger
    const vendorLedgers = computeAllVendorLedgers();
    const totalVendorBalanceDue = vendorLedgers.reduce((acc, v) => acc + v.balanceDue, 0);

    // 4. Expenses by Month, Category, Branch, Department
    const expensesByMonth = {};
    const expensesByCategory = {};
    const expensesByBranch = {};
    let totalExpensesAmt = 0;
    expenses.forEach(e => {
      if (!e) return;
      const dp = extractDateParts(e.date);
      const amt = parseFloat(e.amount) || 0;
      totalExpensesAmt += amt;
      expensesByMonth[dp.ym] = (expensesByMonth[dp.ym] || 0) + amt;
      const cat = e.category || 'Uncategorized';
      expensesByCategory[cat] = (expensesByCategory[cat] || 0) + amt;
      const br = e.branch || 'KLK';
      expensesByBranch[br] = (expensesByBranch[br] || 0) + amt;
    });

    // 5. Day Book Cash & Bank Totals
    let cashCredit = 0, cashDebit = 0, bankCredit = 0, bankDebit = 0;
    daybookTransactions.forEach(t => {
      if (!t) return;
      cashCredit += parseFloat(t.cashCredit) || 0;
      cashDebit += parseFloat(t.cashDebit) || 0;
      bankCredit += parseFloat(t.bankCredit) || 0;
      bankDebit += parseFloat(t.bankDebit) || 0;
    });

    // 6. Assets, Items, Vouchers, Logs, Recycle Bin
    const totalAssetValue = assets.reduce((s, a) => s + (parseFloat(a.cost || a.amount || a.value) || 0), 0);

    return `
You are the live AI Assistant for "MU Accounts" ERP website with FULL READ ACCESS to every database collection, voucher, register, master, and log on the server.
Current Server Date & Time (IST): ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'full', timeStyle: 'medium' })}
Server Connection: ${isOnline ? 'Online' : 'Offline'} | Cloud Sync: ${isCloudSynced ? 'Synced' : 'Local'} | Pending Sync Queue: ${pendingSyncCount}

IMPORTANT INSTRUCTIONS:
1. You have FULL READ PERMISSION over all website server data. Whenever you need specific records (e.g., searching for a customer name, estimate number, invoice number, date, product item, vendor details, expense voucher, daybook entry, asset, recycle bin item, or audit log), call the \`queryWebsiteData\` tool to read the exact records from the server.
2. Whenever the user asks for a downloadable report or table summary, you can also call \`generateReportCard\` so the UI renders an interactive report card with Excel, PDF, and PNG download buttons.
3. Never use canned or robotic template replies. Answer naturally, intelligently, and directly based on the real server data. If a queried year/month/customer has 0 records on the server, state that clearly and show what periods or records DO exist.

LIVE SERVER DATABASE INDEX (REAL-TIME COUNTS & TOTALS):

1. SALES REGISTER (\`sales\` collection: ${sales.length} total records)
   - All-Time Gross Sales: ₹${Math.round(totalSalesGross).toLocaleString('en-IN')} (Taxable: ₹${Math.round(totalSalesTaxable).toLocaleString('en-IN')}, GST: ₹${Math.round(totalSalesGst).toLocaleString('en-IN')})
   - Total Received/Advance: ₹${Math.round(totalSalesPaid).toLocaleString('en-IN')} | Balance Receivable: ₹${Math.round(totalSalesPending).toLocaleString('en-IN')}
   - Sales by Year: ${JSON.stringify(salesByYear)}
   - Sales by Year-Month (YYYY-MM): ${JSON.stringify(salesByMonth)}
   - Sales by Branch: ${JSON.stringify(salesByBranch)}
   - Sales by Department: ${JSON.stringify(salesByDept)}

2. PURCHASE BILLS REGISTER (\`bills\` collection: ${bills.length} total bills)
   - Total Purchases Grand Total: ₹${Math.round(totalPurchaseGross).toLocaleString('en-IN')} (Taxable: ₹${Math.round(totalPurchaseTaxable).toLocaleString('en-IN')}, GST: ₹${Math.round(totalPurchaseGst).toLocaleString('en-IN')})
   - Total Paid: ₹${Math.round(totalPurchasePaid).toLocaleString('en-IN')} | Balance Payable: ₹${Math.round(totalPurchaseDue).toLocaleString('en-IN')}
   - Purchases by Year-Month: ${JSON.stringify(billsByMonth)}
   - All Purchase Bills List: ${JSON.stringify(bills.map(b => ({ inv: b.invoiceNo, date: b.date, vendor: b.vendorName, total: b.grandTotal, paid: b.paidAmount, due: b.balanceAmount, status: b.paymentStatus })))}

3. VENDORS / SUPPLIERS (\`vendors\` collection: ${vendorLedgers.length} registered vendors)
   - Total Outstanding Payable to Vendors: ₹${Math.round(totalVendorBalanceDue).toLocaleString('en-IN')}
   - Complete Vendor Ledger List: ${JSON.stringify(vendorLedgers)}

4. OPERATING EXPENSES (\`expenses\` collection: ${expenses.length} vouchers)
   - Total Operating Expenses: ₹${Math.round(totalExpensesAmt).toLocaleString('en-IN')}
   - Expenses by Year-Month: ${JSON.stringify(expensesByMonth)}
   - Expenses by Category: ${JSON.stringify(expensesByCategory)}
   - Expenses by Branch: ${JSON.stringify(expensesByBranch)}

5. DAY BOOK LEDGER (\`daybook\` collection: ${daybookTransactions.length} entries)
   - Cash Inflow (Credit): ₹${Math.round(cashCredit).toLocaleString('en-IN')} | Cash Outflow (Debit): ₹${Math.round(cashDebit).toLocaleString('en-IN')} | Net Cash in Hand: ₹${Math.round(cashCredit - cashDebit).toLocaleString('en-IN')}
   - Bank Inflow (Credit): ₹${Math.round(bankCredit).toLocaleString('en-IN')} | Bank Outflow (Debit): ₹${Math.round(bankDebit).toLocaleString('en-IN')} | Net Bank Balance: ₹${Math.round(bankCredit - bankDebit).toLocaleString('en-IN')}
   - Combined Liquid Balance: ₹${Math.round((cashCredit - cashDebit) + (bankCredit - bankDebit)).toLocaleString('en-IN')}

6. MASTER PRODUCT ITEMS / INVENTORY (\`items\` collection: ${items.length} items)
   - Items List: ${JSON.stringify(items.map(i => ({ name: i.name, category: i.category, hsn: i.hsn, uqc: i.uqc, gstRate: i.gstRate, price: i.rate || i.price || 0 })))}

7. FIXED ASSETS (\`assets\` collection: ${assets.length} assets, Total Value: ₹${Math.round(totalAssetValue).toLocaleString('en-IN')})
   - Assets List: ${JSON.stringify(assets)}

8. STANDALONE CUSTOM VOUCHERS (\`customVouchers\` collection: ${customVouchers.length} vouchers)
   - Custom Vouchers List: ${JSON.stringify(customVouchers)}

9. BANK STATEMENTS (\`bankStatements\`: IDBI=${(bankStatements?.idbi || []).length} entries, SBI=${(bankStatements?.sbi || []).length} entries)

10. RECYCLE BIN (\`recycleBin\` collection: ${recycleBin.length} deleted items)
    - Deleted Items: ${JSON.stringify(recycleBin.map(r => ({ id: r.id, invoiceNo: r.invoiceNo, vendorName: r.vendorName, grandTotal: r.grandTotal, deletedAt: r.deletedAt })))}

11. AUDIT & ACTIVITY LOGS (\`logs\` collection: ${logs.length} logs)
    - Recent 15 Logs: ${JSON.stringify(logs.slice(0, 15).map(l => ({ time: l.timestamp, action: l.action, type: l.entityType, title: l.title, details: l.details })))}

12. WEBSITE MASTER CONFIGURATIONS:
    - Branches: ${JSON.stringify(branches)}
    - Departments: ${JSON.stringify(departments)}
    - Expense Categories: ${JSON.stringify(expenseCategories)}
    - Payment Methods: ${JSON.stringify(paymentMethods)}
    - Net Operating Profit Estimate (Sales - Purchases - Expenses): ₹${Math.round(totalSalesGross - totalPurchaseGross - totalExpensesAmt).toLocaleString('en-IN')}
`.trim();
  };

  // Gemini Tool Declarations for Full Server Read & Report Generation
  const geminiTools = [
    {
      functionDeclarations: [
        {
          name: 'queryWebsiteData',
          description: 'Read, search, and filter records from any collection in the website server: sales, bills, vendors, expenses, daybook, items, assets, customVouchers, bankStatements, recycleBin, logs, or masters.',
          parameters: {
            type: 'OBJECT',
            properties: {
              collection: {
                type: 'STRING',
                description: 'Collection to query: "sales", "bills", "vendors", "expenses", "daybook", "items", "assets", "customVouchers", "bankStatements", "recycleBin", "logs", or "masters"'
              },
              search: {
                type: 'STRING',
                description: 'Optional keyword to search across any field (customer name, vendor name, invoice no, estimate no, phone, item name, description, etc.)'
              },
              year: {
                type: 'STRING',
                description: 'Optional 4-digit year filter, e.g. "2026" or "2025"'
              },
              month: {
                type: 'STRING',
                description: 'Optional month filter (name like "september" or number like "09" or "10")'
              },
              dateFrom: {
                type: 'STRING',
                description: 'Optional start date YYYY-MM-DD'
              },
              dateTo: {
                type: 'STRING',
                description: 'Optional end date YYYY-MM-DD'
              },
              branch: {
                type: 'STRING',
                description: 'Optional branch code filter, e.g. "KLK" or "RMD"'
              },
              department: {
                type: 'STRING',
                description: 'Optional department filter'
              },
              category: {
                type: 'STRING',
                description: 'Optional category filter'
              },
              status: {
                type: 'STRING',
                description: 'Optional payment status filter'
              },
              limit: {
                type: 'NUMBER',
                description: 'Max individual records to return (default 50, max 200)'
              }
            },
            required: ['collection']
          }
        },
        {
          name: 'generateReportCard',
          description: 'Attach a downloadable Report Card (Excel, PDF, PNG Image) to the chat message when the user asks to generate or download a report or table.',
          parameters: {
            type: 'OBJECT',
            properties: {
              title: {
                type: 'STRING',
                description: 'Report title'
              },
              subtitle: {
                type: 'STRING',
                description: 'Report subtitle or period description'
              },
              metrics: {
                type: 'ARRAY',
                description: 'Array of key summary metric objects { label, value }',
                items: {
                  type: 'OBJECT',
                  properties: {
                    label: { type: 'STRING' },
                    value: { type: 'STRING' }
                  }
                }
              },
              tableRows: {
                type: 'ARRAY',
                description: 'Array of row objects for the breakdown table (each object has column header keys and string/number values)',
                items: {
                  type: 'OBJECT'
                }
              }
            },
            required: ['title']
          }
        }
      ]
    }
  ];

  // Call Gemini API with Function Calling Loop & Model Fallback
  const callGeminiWithFullAccess = async (userText, recentMessages) => {
    const key = apiKey || DEFAULT_GEMINI_KEY;
    const systemInstruction = buildFullServerSnapshot();

    // Build clean alternating conversation history (must start with 'user')
    const rawHistory = recentMessages
      .filter(m => m && m.text && !m.isInactivityPrompt && m.id !== 'init-1')
      .slice(-10)
      .map(m => ({
        role: m.sender === 'user' ? 'user' : 'model',
        parts: [{ text: String(m.text) }]
      }));

    // Ensure history starts with 'user' and alternates properly
    const contents = [];
    for (const item of rawHistory) {
      if (contents.length === 0 && item.role !== 'user') continue;
      if (contents.length > 0 && contents[contents.length - 1].role === item.role) {
        contents[contents.length - 1].parts[0].text += `\n${item.parts[0].text}`;
      } else {
        contents.push(item);
      }
    }
    if (contents.length > 0 && contents[contents.length - 1].role === 'user') {
      contents[contents.length - 1].parts[0].text += `\n${userText}`;
    } else {
      contents.push({
        role: 'user',
        parts: [{ text: userText }]
      });
    }

    let generatedReportCard = null;
    let lastError = null;

    for (const modelName of GEMINI_MODELS) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${key}`;
        let workingContents = [...contents];

        // Allow up to 3 rounds of tool calling so the AI can query any data it needs
        for (let round = 0; round < 3; round++) {
          const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              system_instruction: {
                parts: [{ text: systemInstruction }]
              },
              tools: geminiTools,
              contents: workingContents,
              generationConfig: {
                temperature: 0.2,
                maxOutputTokens: 1200
              }
            })
          });

          if (!res.ok) {
            const errBody = await res.text();
            throw new Error(`HTTP ${res.status}: ${errBody}`);
          }

          const data = await res.json();
          const candidateContent = data?.candidates?.[0]?.content;
          const parts = candidateContent?.parts || [];

          // Check if Gemini requested any function calls
          const functionCalls = parts.filter(p => p.functionCall);
          if (functionCalls.length > 0) {
            workingContents.push(candidateContent);
            const responseParts = [];

            for (const fcPart of functionCalls) {
              const fc = fcPart.functionCall;
              if (fc.name === 'queryWebsiteData') {
                setStatusLabel(`Reading ${fc.args?.collection || 'database'}...`);
                const queryResult = executeQueryWebsiteData(fc.args || {});
                responseParts.push({
                  functionResponse: {
                    name: fc.name,
                    ...(fc.id ? { id: fc.id } : {}),
                    response: queryResult
                  }
                });
              } else if (fc.name === 'generateReportCard') {
                setStatusLabel('Preparing report card...');
                generatedReportCard = {
                  id: `card-${Date.now()}`,
                  title: fc.args?.title || 'Financial Report',
                  subtitle: fc.args?.subtitle || 'Live Server Data',
                  metrics: Array.isArray(fc.args?.metrics) ? fc.args.metrics : [],
                  tableRows: Array.isArray(fc.args?.tableRows) ? fc.args.tableRows : []
                };
                responseParts.push({
                  functionResponse: {
                    name: fc.name,
                    ...(fc.id ? { id: fc.id } : {}),
                    response: { status: 'Report card attached to UI with Excel, PDF, and Image download buttons.' }
                  }
                });
              }
            }

            workingContents.push({
              role: 'user',
              parts: responseParts
            });
            continue;
          }

          // Extract final text response
          const textParts = parts.filter(p => typeof p.text === 'string').map(p => p.text).join('\n').trim();
          if (textParts) {
            setStatusLabel('');
            return { text: textParts, reportCard: generatedReportCard };
          }
          break;
        }
      } catch (err) {
        lastError = err;
        console.warn(`Gemini model ${modelName} error:`, err);
      }
    }

    setStatusLabel('');
    throw lastError || new Error('Unable to reach Gemini AI service.');
  };

  // --- Downloads ---
  const handleDownloadExcel = (report) => {
    try {
      if (!report) return;
      const wb = XLSX.utils.book_new();
      const rows = [];

      rows.push({ "Report": report.title || 'Financial Report' });
      rows.push({ "Generated On": new Date().toLocaleString('en-IN') });
      rows.push({});

      if (Array.isArray(report.metrics) && report.metrics.length > 0) {
        rows.push({ "METRIC": "VALUE" });
        report.metrics.forEach(m => {
          rows.push({ "METRIC": m.label, "VALUE": m.value });
        });
        rows.push({});
      }

      if (Array.isArray(report.tableRows) && report.tableRows.length > 0) {
        rows.push({ "BREAKDOWN DETAILS": "" });
        report.tableRows.forEach(r => rows.push(r));
      }

      const ws = XLSX.utils.json_to_sheet(rows);
      XLSX.utils.book_append_sheet(wb, ws, "Report");
      const filename = `${(report.title || 'Report').replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}.xlsx`;
      XLSX.writeFile(wb, filename);
    } catch (e) {
      console.error('handleDownloadExcel failed', e);
    }
  };

  const handleDownloadPdf = (report) => {
    try {
      if (!report) return;
      const doc = new jsPDF();
      doc.setFontSize(16);
      doc.setTextColor(30, 41, 59);
      doc.text(report.title || 'Report', 14, 20);

      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139);
      doc.text(`Generated on: ${new Date().toLocaleString('en-IN')} | MU Gemini AI Assistant`, 14, 27);
      doc.line(14, 30, 196, 30);

      let y = 38;
      if (Array.isArray(report.metrics) && report.metrics.length > 0) {
        doc.setFontSize(12);
        doc.setTextColor(15, 23, 42);
        doc.text("Key Summary Metrics:", 14, y);
        y += 8;

        report.metrics.forEach(m => {
          if (y > 275) { doc.addPage(); y = 20; }
          doc.setFontSize(10);
          doc.setTextColor(71, 85, 105);
          doc.text(`${m.label}:`, 18, y);
          doc.setTextColor(15, 23, 42);
          doc.text(String(m.value), 90, y);
          y += 7;
        });
        y += 6;
      }

      if (Array.isArray(report.tableRows) && report.tableRows.length > 0) {
        doc.setFontSize(12);
        doc.setTextColor(15, 23, 42);
        doc.text("Details & Breakdown:", 14, y);
        y += 8;

        report.tableRows.slice(0, 35).forEach((r) => {
          if (y > 275) { doc.addPage(); y = 20; }
          doc.setFontSize(9);
          doc.setTextColor(71, 85, 105);
          const line = Object.entries(r || {}).map(([k, v]) => `${k}: ${v}`).join(' | ');
          doc.text(line.slice(0, 110), 18, y);
          y += 6;
        });
      }

      const filename = `${(report.title || 'Report').replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}.pdf`;
      doc.save(filename);
    } catch (e) {
      console.error('handleDownloadPdf failed', e);
    }
  };

  const handleDownloadImage = async (cardId, reportTitle) => {
    try {
      const el = document.getElementById(cardId);
      if (!el) return;
      const canvas = await html2canvas(el, { scale: 2, backgroundColor: '#ffffff' });
      const link = document.createElement('a');
      link.download = `${(reportTitle || 'Report').replace(/[^a-zA-Z0-9]/g, '_')}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (err) {
      console.error('Image capture failed', err);
    }
  };

  // --- Send Message Handler (Pure Gemini AI with Full Server Data Control) ---
  const handleSendMessage = async (textToSend) => {
    const userText = (textToSend || input || '').trim();
    if (!userText || isTyping) return;

    const userMsg = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: userText,
      timestamp: new Date()
    };

    const updatedHistory = [...messages, userMsg];
    setMessages(updatedHistory);
    setInput('');
    setIsTyping(true);
    setStatusLabel('Reading server data...');

    try {
      const { text: aiReplyText, reportCard } = await callGeminiWithFullAccess(userText, messages);

      const botMsg = {
        id: `bot-${Date.now()}`,
        sender: 'bot',
        text: aiReplyText,
        timestamp: new Date(),
        reportData: reportCard || null
      };

      setIsTyping(false);
      setStatusLabel('');
      setMessages(prev => [...prev, botMsg]);
    } catch (err) {
      console.error('Gemini AI error:', err);
      setIsTyping(false);
      setStatusLabel('');
      setMessages(prev => [
        ...prev,
        {
          id: `bot-err-${Date.now()}`,
          sender: 'bot',
          text: `⚠️ Unable to reach Gemini AI right now (${err?.message || 'Network or API Key error'}). Please verify your internet connection or click the key icon above to check your Gemini API key.`,
          timestamp: new Date()
        }
      ]);
    }
  };

  const handleDropdownSelectReport = (type) => {
    switch (type) {
      case 'website_report':
        handleSendMessage('Generate a complete website master audit report with a downloadable report card covering sales, purchases, expenses, vendor balances, daybook cash/bank, and net profit.');
        break;
      case 'sales_report':
        handleSendMessage('Generate a complete sales summary report with a downloadable report card showing total sales, branch breakdown, and department breakdown.');
        break;
      case 'branch_sales':
        handleSendMessage('Show me the branch-wise sales breakdown and generate a downloadable report card.');
        break;
      case 'dept_sales':
        handleSendMessage('Show me the department-wise sales breakdown and generate a downloadable report card.');
        break;
      case 'purchase_summary':
        handleSendMessage('Generate a purchase register summary report with a downloadable report card listing our purchase bills and totals.');
        break;
      case 'vendor_balances':
        handleSendMessage('Generate a vendor ledger and payables report with a downloadable report card showing billed, paid, and balance due for our vendors.');
        break;
      case 'expense_summary':
        handleSendMessage('Generate an operating expense summary report with a downloadable report card broken down by category and branch.');
        break;
      case 'daybook_summary':
        handleSendMessage('Generate a Day Book cash and bank liquidity summary report with a downloadable report card.');
        break;
      default:
        break;
    }
  };

  const handleClearHistory = () => {
    setMessages([
      {
        id: `init-${Date.now()}`,
        sender: 'bot',
        text: 'Conversation cleared. Ask me anything about your website data, registers, vouchers, or accounts.',
        timestamp: new Date()
      }
    ]);
  };

  return (
    <>
      {/* Floating Trigger Button (Bottom-Right Corner) */}
      {!isOpen && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 bg-white/95 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-slate-200 shadow-lg text-xs font-semibold text-slate-700 animate-in fade-in slide-in-from-right-4 duration-300">
            <Sparkles className="w-3.5 h-3.5 text-blue-600 animate-spin" />
            <span>Ask Gemini AI</span>
          </div>

          <button
            onClick={() => {
              setIsOpen(true);
              setIsMinimized(false);
            }}
            className="group relative flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-violet-600 text-white shadow-xl shadow-indigo-500/25 hover:shadow-indigo-500/40 hover:scale-105 active:scale-95 transition-all duration-200 border-2 border-white/20"
            aria-label="Open AI Assistant Chatbot"
            title="Open Gemini AI Assistant"
          >
            <Bot className="w-7 h-7 group-hover:rotate-6 transition-transform" />
            <span className="absolute top-1.5 right-1.5 w-3.5 h-3.5 rounded-full bg-emerald-400 border-2 border-white shadow-xs">
              <span className="absolute inset-0 rounded-full bg-emerald-400 animate-ping opacity-75" />
            </span>
          </button>
        </div>
      )}

      {/* Floating Chat Drawer Window */}
      {isOpen && (
        <div 
          className={`fixed bottom-6 right-6 z-50 flex flex-col bg-white rounded-3xl border border-slate-200 shadow-2xl transition-all duration-200 overflow-hidden ${
            isMinimized 
              ? 'w-72 sm:w-80 h-16' 
              : 'w-[94vw] sm:w-[450px] h-[600px] sm:h-[660px] max-h-[85vh]'
          }`}
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white p-3.5 px-4 flex items-center justify-between shadow-xs select-none">
            <div className="flex items-center gap-2.5">
              <div className="relative w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-500 to-indigo-500 flex items-center justify-center shadow-inner text-white">
                <Bot className="w-5 h-5" />
                <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-400 border-2 border-slate-900 rounded-full" />
              </div>
              <div>
                <h3 className="font-extrabold text-sm tracking-tight flex items-center gap-1.5">
                  <span>MU Gemini AI</span>
                  <span className="px-1.5 py-0.2 bg-gradient-to-r from-emerald-500/20 to-blue-500/20 text-emerald-300 text-[10px] font-mono rounded border border-emerald-400/30 flex items-center gap-1">
                    <Database className="w-2.5 h-2.5 text-emerald-400" /> Full Data Read
                  </span>
                </h3>
                <p className="text-[10px] text-slate-300 font-medium">Connected to All Website Server Records</p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => setShowKeyModal(true)}
                className="p-1.5 text-slate-400 hover:text-amber-300 hover:bg-white/10 rounded-lg transition-colors"
                title="API Key Settings"
              >
                <Key className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={handleClearHistory}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                title="Clear conversation"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setIsMinimized(prev => !prev)}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                title={isMinimized ? "Expand" : "Minimize"}
              >
                {isMinimized ? <Maximize2 className="w-3.5 h-3.5" /> : <Minimize2 className="w-3.5 h-3.5" />}
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-white/10 rounded-lg transition-colors"
                title="Close chat"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {!isMinimized && (
            <>
              {/* Quick Report Dropdown Selector Strip */}
              <div className="bg-slate-50 border-b border-slate-200 px-3 py-2 flex items-center justify-between text-xs gap-2">
                <span className="text-[11px] font-bold text-slate-500 uppercase flex items-center gap-1 whitespace-nowrap">
                  <Receipt className="w-3 h-3 text-indigo-600" /> Generate Report:
                </span>
                <select
                  onChange={(e) => {
                    if (e.target.value) {
                      handleDropdownSelectReport(e.target.value);
                      e.target.value = '';
                    }
                  }}
                  defaultValue=""
                  className="bg-white border border-slate-200 text-slate-700 text-xs rounded-lg px-2 py-1 outline-none focus:ring-1 focus:ring-indigo-500 w-full max-w-[250px] font-medium"
                >
                  <option value="" disabled>Select a live report to generate...</option>
                  <option value="website_report">📋 Full Website Master Audit Report</option>
                  <option value="sales_report">📊 All Sales Summary Report</option>
                  <option value="branch_sales">🏢 Branch-Wise Sales Report</option>
                  <option value="dept_sales">📑 Department-Wise Sales Report</option>
                  <option value="purchase_summary">📦 Purchase Bills Summary Report</option>
                  <option value="vendor_balances">👥 Vendor Ledger & Payables Report</option>
                  <option value="expense_summary">💸 Operating Expenses Report</option>
                  <option value="daybook_summary">📒 Day Book Cash & Bank Report</option>
                </select>
              </div>

              {/* Quick Action Prompt Pills Strip */}
              <div className="bg-slate-100/90 border-b border-slate-200 px-3 py-1.5 flex items-center gap-1.5 overflow-x-auto no-scrollbar scroll-smooth">
                <button
                  type="button"
                  onClick={() => handleSendMessage('Generate an instant Day Book cash and bank liquidity summary report with closing balances and downloadable report card.')}
                  className="whitespace-nowrap px-2.5 py-1 bg-white hover:bg-indigo-50 hover:text-indigo-700 text-slate-700 text-[10px] font-bold rounded-lg border border-slate-200 transition-colors shadow-2xs flex items-center gap-1 shrink-0 active:scale-95 cursor-pointer"
                >
                  <span>📊</span> Day Book Cash/Bank
                </button>
                <button
                  type="button"
                  onClick={() => handleSendMessage('Compare financial performance between Kulasekharam (KLK) and Ramanathapuram (RMD) branches across sales, purchases, and expenses with a report card.')}
                  className="whitespace-nowrap px-2.5 py-1 bg-white hover:bg-indigo-50 hover:text-indigo-700 text-slate-700 text-[10px] font-bold rounded-lg border border-slate-200 transition-colors shadow-2xs flex items-center gap-1 shrink-0 active:scale-95 cursor-pointer"
                >
                  <span>🏢</span> Branch (KLK vs RMD)
                </button>
                <button
                  type="button"
                  onClick={() => handleSendMessage('Calculate GSTR-3B tax liability and eligible ITC offset breakdown for current period with downloadable summary card.')}
                  className="whitespace-nowrap px-2.5 py-1 bg-white hover:bg-indigo-50 hover:text-indigo-700 text-slate-700 text-[10px] font-bold rounded-lg border border-slate-200 transition-colors shadow-2xs flex items-center gap-1 shrink-0 active:scale-95 cursor-pointer"
                >
                  <span>⚖️</span> GSTR-3B Tax Offset
                </button>
                <button
                  type="button"
                  onClick={() => handleSendMessage('List all overdue receivables and bills older than 25 days with customer names, pending amounts, and aging breakdown.')}
                  className="whitespace-nowrap px-2.5 py-1 bg-white hover:bg-indigo-50 hover:text-indigo-700 text-slate-700 text-[10px] font-bold rounded-lg border border-slate-200 transition-colors shadow-2xs flex items-center gap-1 shrink-0 active:scale-95 cursor-pointer"
                >
                  <span>🚨</span> Overdue Aging (&gt;25d)
                </button>
              </div>

              {/* Chat Conversation Scroll Area */}
              <div 
                ref={chatContainerRef}
                className="flex-1 overflow-y-auto p-4 space-y-4 bg-gradient-to-b from-slate-50/50 to-white text-xs"
              >
                {messages.map(msg => {
                  const safeTime = msg.timestamp instanceof Date 
                    ? msg.timestamp 
                    : new Date(msg.timestamp || Date.now());

                  return (
                    <div 
                      key={msg.id}
                      className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'} space-y-1`}
                    >
                      {/* Message Bubble */}
                      <div 
                        className={`max-w-[90%] p-3.5 rounded-2xl leading-relaxed whitespace-pre-line shadow-xs ${
                          msg.sender === 'user'
                            ? 'bg-indigo-600 text-white rounded-br-xs font-medium'
                            : 'bg-white border border-slate-200 text-slate-800 rounded-bl-xs'
                        }`}
                      >
                        {msg.text}
                      </div>

                      {/* Report Card (When Generated by AI) */}
                      {msg.reportData && (
                        <div 
                          id={msg.reportData.id || `card-${msg.id}`}
                          className="w-full max-w-[96%] bg-white rounded-2xl border-2 border-indigo-100 shadow-md p-3.5 mt-2 space-y-3"
                        >
                          <div className="flex items-start justify-between border-b border-slate-100 pb-2">
                            <div>
                              <span className="text-[10px] uppercase font-bold text-indigo-600 tracking-wider">
                                Live Server Report
                              </span>
                              <h4 className="font-extrabold text-slate-900 text-sm mt-0.5">
                                {msg.reportData.title}
                              </h4>
                              <p className="text-[10px] text-slate-400">{msg.reportData.subtitle}</p>
                            </div>
                            <span className="p-1 rounded-md bg-indigo-50 text-indigo-700 font-bold text-[10px]">
                              {new Date().toLocaleDateString('en-IN')}
                            </span>
                          </div>

                          {/* Metrics Grid */}
                          {Array.isArray(msg.reportData.metrics) && msg.reportData.metrics.length > 0 && (
                            <div className="grid grid-cols-2 gap-2 text-[11px]">
                              {msg.reportData.metrics.map((m, idx) => (
                                <div key={idx} className="p-2 rounded-xl bg-slate-50 border border-slate-100">
                                  <span className="text-slate-400 block text-[9px] uppercase font-bold">{m.label}</span>
                                  <span className="font-extrabold text-slate-900 text-xs font-mono">{m.value}</span>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Breakdown Table Preview */}
                          {Array.isArray(msg.reportData.tableRows) && msg.reportData.tableRows.length > 0 && msg.reportData.tableRows[0] && (
                            <div className="overflow-x-auto border border-slate-100 rounded-lg text-[10px]">
                              <table className="w-full text-left border-collapse">
                                <thead>
                                  <tr className="bg-slate-50 text-slate-600 font-bold border-b border-slate-100">
                                    {Object.keys(msg.reportData.tableRows[0]).map((h, i) => (
                                      <th key={i} className="p-1.5 px-2">{h}</th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                  {msg.reportData.tableRows.slice(0, 10).map((row, rIdx) => (
                                    <tr key={rIdx} className="hover:bg-slate-50/50">
                                      {Object.values(row || {}).map((val, cIdx) => (
                                        <td key={cIdx} className="p-1.5 px-2 font-medium text-slate-700">{String(val ?? '')}</td>
                                      ))}
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}

                          {/* Download Report Actions Bar */}
                          <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-1.5">
                            <span className="text-[10px] font-bold text-slate-400">Download Report:</span>
                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={() => handleDownloadExcel(msg.reportData)}
                                className="flex items-center gap-1 px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-lg font-bold text-[10px] border border-emerald-200 transition-colors shadow-2xs"
                                title="Download report as Excel (.xlsx)"
                              >
                                <FileSpreadsheet className="w-3 h-3 text-emerald-600" />
                                <span>Excel</span>
                              </button>
                              <button
                                onClick={() => handleDownloadPdf(msg.reportData)}
                                className="flex items-center gap-1 px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-800 rounded-lg font-bold text-[10px] border border-rose-200 transition-colors shadow-2xs"
                                title="Download report as PDF document"
                              >
                                <FileText className="w-3 h-3 text-rose-600" />
                                <span>PDF</span>
                              </button>
                              <button
                                onClick={() => handleDownloadImage(msg.reportData.id || `card-${msg.id}`, msg.reportData.title)}
                                className="flex items-center gap-1 px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-800 rounded-lg font-bold text-[10px] border border-blue-200 transition-colors shadow-2xs"
                                title="Save report as PNG image"
                              >
                                <ImageIcon className="w-3 h-3 text-blue-600" />
                                <span>Image</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Timestamp */}
                      <span className="text-[9px] text-slate-400 font-mono px-1">
                        {safeTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  );
                })}

                {/* Live AI Thinking / Database Query Indicator */}
                {isTyping && (
                  <div className="flex items-center gap-2 p-3 bg-white border border-slate-200 rounded-2xl rounded-bl-xs w-fit max-w-[80%] shadow-xs">
                    <Sparkles className="w-3.5 h-3.5 animate-spin text-indigo-500 flex-shrink-0" />
                    <span className="text-[11px] font-semibold text-indigo-600">
                      {statusLabel || 'Thinking...'}
                    </span>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Input Form Bar */}
              <form 
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSendMessage();
                }}
                className="p-3 bg-white border-t border-slate-200 flex items-center gap-2"
              >
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask anything about any data in the website..."
                  className="flex-1 bg-slate-100 hover:bg-slate-50 focus:bg-white text-slate-800 placeholder-slate-400 text-xs rounded-xl px-3.5 py-2.5 outline-none border border-transparent focus:border-indigo-500 transition-all"
                />
                <button
                  type="submit"
                  disabled={!input.trim() || isTyping}
                  className="w-9 h-9 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:hover:bg-indigo-600 text-white flex items-center justify-center transition-all shadow-sm active:scale-95 flex-shrink-0"
                  aria-label="Send Message"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </>
          )}

          {/* API Key Modal */}
          {showKeyModal && (
            <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-xs z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl p-5 max-w-sm w-full shadow-2xl space-y-4 border border-slate-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Key className="w-4 h-4 text-indigo-600" />
                    <h4 className="font-extrabold text-sm text-slate-900">Google Gemini API Key</h4>
                  </div>
                  <button 
                    onClick={() => setShowKeyModal(false)}
                    className="p-1 text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <p className="text-[11px] text-slate-500">
                  Connected to Google Gemini AI with full read access to all website collections.
                </p>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">API Key</label>
                  <input
                    type="password"
                    value={tempKeyInput}
                    onChange={(e) => setTempKeyInput(e.target.value)}
                    placeholder="AIzaSy..."
                    className="w-full text-xs font-mono border border-slate-300 rounded-xl px-3 py-2 outline-none focus:border-indigo-600"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    onClick={() => setShowKeyModal(false)}
                    className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveApiKey}
                    className="px-4 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm"
                  >
                    Save Key
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}
