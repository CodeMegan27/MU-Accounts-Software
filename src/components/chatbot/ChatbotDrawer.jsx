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
  Database,
  RotateCcw,
  GripHorizontal,
  Search,
  Eye,
  Calendar
} from 'lucide-react';
import AIMascotCharacter from './AIMascotCharacter';

const DEFAULT_GEMINI_KEY = import.meta.env.VITE_GEMINI_API_KEY || '';
const GEMINI_MODELS = [
  'gemini-3.5-flash',
  'gemini-3-flash-preview',
  'gemini-3.5-flash-lite'
];

// Rich Markdown Message Formatter (handles tables, bold text, bullet lists without layout collapse)
function FormattedMessage({ text }) {
  if (!text) return null;

  const lines = String(text).split('\n');
  const blocks = [];
  let currentTable = null;
  let currentTextLines = [];

  const flushText = () => {
    if (currentTextLines.length > 0) {
      blocks.push({ type: 'text', lines: [...currentTextLines] });
      currentTextLines = [];
    }
  };

  const flushTable = () => {
    if (currentTable) {
      blocks.push({ type: 'table', ...currentTable });
      currentTable = null;
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    const isTableRow = trimmed.startsWith('|') && trimmed.endsWith('|') && trimmed.includes('|');

    if (isTableRow) {
      const isSep = /^\|[\s\-:|]+\|$/.test(trimmed);
      if (!currentTable) {
        flushText();
        const headers = trimmed.split('|').slice(1, -1).map(c => c.trim());
        currentTable = { headers, rows: [] };
      } else if (isSep) {
        // separator row, skip
      } else {
        const rowCells = trimmed.split('|').slice(1, -1).map(c => c.trim());
        currentTable.rows.push(rowCells);
      }
    } else {
      if (currentTable) {
        flushTable();
      }
      currentTextLines.push(line);
    }
  }

  flushText();
  flushTable();

  return (
    <div className="space-y-1.5 text-xs">
      {blocks.map((block, bIdx) => {
        if (block.type === 'table') {
          return (
            <div key={bIdx} className="my-2.5 overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-xs max-w-full">
              <table className="min-w-full divide-y divide-slate-200 text-left text-[11px]">
                <thead className="bg-slate-100 text-slate-800 font-bold">
                  <tr>
                    {block.headers.map((h, hIdx) => (
                      <th key={hIdx} className="px-3 py-2 font-bold whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {block.rows.map((row, rIdx) => (
                    <tr key={rIdx} className={rIdx % 2 === 0 ? 'bg-white hover:bg-slate-50' : 'bg-slate-50/70 hover:bg-indigo-50/30'}>
                      {row.map((cell, cIdx) => (
                        <td key={cIdx} className="px-3 py-1.5 whitespace-nowrap text-slate-700 font-medium">{cell}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }

        return (
          <div key={bIdx} className="space-y-1">
            {block.lines.map((l, lIdx) => {
              const trimmedLine = l.trim();
              if (!trimmedLine) return <div key={lIdx} className="h-1.5" />;

              const renderInline = (str) => {
                const parts = str.split(/(\*\*[^*]+\*\*)/g);
                return parts.map((part, pIdx) => {
                  if (part.startsWith('**') && part.endsWith('**')) {
                    return <strong key={pIdx} className="font-extrabold text-slate-900">{part.slice(2, -2)}</strong>;
                  }
                  return part;
                });
              };

              if (trimmedLine.startsWith('### ')) {
                return <h5 key={lIdx} className="font-bold text-slate-900 text-xs mt-2 mb-0.5">{trimmedLine.slice(4)}</h5>;
              }
              if (trimmedLine.startsWith('## ')) {
                return <h4 key={lIdx} className="font-extrabold text-slate-900 text-sm mt-2.5 mb-1">{trimmedLine.slice(3)}</h4>;
              }
              if (trimmedLine.startsWith('- ') || trimmedLine.startsWith('* ')) {
                return (
                  <div key={lIdx} className="flex items-start gap-1.5 pl-1.5">
                    <span className="text-indigo-500 font-bold mt-0.5">•</span>
                    <span>{renderInline(trimmedLine.slice(2))}</span>
                  </div>
                );
              }

              return <p key={lIdx} className="leading-relaxed">{renderInline(l)}</p>;
            })}
          </div>
        );
      })}
    </div>
  );
}

// --- Report Card Normalization & Formatting Helpers ---

const getCanonicalHeaders = (rows) => {
  if (!rows || !Array.isArray(rows) || rows.length === 0) return [];
  const keySet = new Set();
  rows.forEach(r => {
    if (r && typeof r === 'object') {
      Object.keys(r).forEach(k => {
        if (k && typeof k === 'string' && k.trim()) {
          keySet.add(k.trim());
        }
      });
    }
  });

  const allKeys = Array.from(keySet);

  const priorityOrder = [
    's.no', 'sno', '#', 'sr', 'serial',
    'date', 'invdate', 'orderdate', 'billdate',
    'invoice', 'invoiceno', 'billno', 'estno', 'ref', 'voucherno',
    'vendor', 'vendorname', 'customer', 'customername', 'party', 'name', 'payee',
    'description', 'particulars', 'item', 'category', 'branch', 'dept', 'department',
    'qty', 'quantity', 'rate', 'price',
    'taxable', 'taxableamount', 'tax', 'cgst', 'sgst', 'igst', 'gst',
    'total', 'grandtotal', 'amount', 'billed', 'totalbilled',
    'paid', 'paidamount', 'received', 'advance',
    'balance', 'due', 'balancedue', 'pending',
    'status', 'paymentstatus'
  ];

  return allKeys.sort((a, b) => {
    const na = a.toLowerCase().replace(/[^a-z0-9]/g, '');
    const nb = b.toLowerCase().replace(/[^a-z0-9]/g, '');
    const ia = priorityOrder.indexOf(na);
    const ib = priorityOrder.indexOf(nb);
    if (ia !== -1 && ib !== -1) return ia - ib;
    if (ia !== -1) return -1;
    if (ib !== -1) return 1;
    return a.localeCompare(b);
  });
};

const normalizeReportCardData = (rawCard) => {
  if (!rawCard) return null;
  const metrics = Array.isArray(rawCard.metrics) ? rawCard.metrics : [];
  const rawRows = Array.isArray(rawCard.tableRows) ? rawCard.tableRows : [];
  
  const headers = getCanonicalHeaders(rawRows);

  const normalizedRows = rawRows.map(r => {
    if (!r || typeof r !== 'object') return {};
    const normalized = {};
    headers.forEach(h => {
      let val = r[h];
      if (val === undefined) {
        const lowerH = h.toLowerCase();
        const matchingKey = Object.keys(r).find(k => k.toLowerCase() === lowerH);
        if (matchingKey) val = r[matchingKey];
      }
      normalized[h] = val !== undefined && val !== null ? val : '';
    });
    return normalized;
  });

  return {
    ...rawCard,
    id: rawCard.id || `card-${Date.now()}`,
    title: rawCard.title || 'Financial Report',
    subtitle: rawCard.subtitle || 'Live Server Data',
    metrics,
    headers,
    tableRows: normalizedRows
  };
};

const getColumnAlignment = (key = '') => {
  const l = key.toLowerCase();
  if (
    l.includes('amount') || 
    l.includes('total') || 
    l.includes('billed') || 
    l.includes('paid') || 
    l.includes('balance') || 
    l.includes('due') || 
    l.includes('qty') || 
    l.includes('rate') || 
    l.includes('price') || 
    l.includes('tax')
  ) {
    return 'text-right';
  }
  if (l.includes('status') || l.includes('date') || l.includes('s.no') || l.includes('sno') || l === '#') {
    return 'text-center';
  }
  return 'text-left';
};

const renderCellContent = (key = '', val) => {
  if (val === undefined || val === null || val === '') {
    return <span className="text-slate-300 font-mono text-center block">-</span>;
  }

  const sVal = String(val).trim();
  const lowerKey = key.toLowerCase();

  // Status Badge
  if (lowerKey.includes('status')) {
    const sLower = sVal.toLowerCase();
    if (sLower === 'paid') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          Paid
        </span>
      );
    }
    if (sLower === 'partial' || sLower === 'partially paid') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-50 text-amber-700 border border-amber-200 shadow-2xs">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
          Partial
        </span>
      );
    }
    if (sLower === 'unpaid' || sLower === 'due' || sLower === 'pending' || sLower === 'overdue') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-50 text-rose-700 border border-rose-200 shadow-2xs">
          <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
          {sVal}
        </span>
      );
    }
    return (
      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-700">
        {sVal}
      </span>
    );
  }

  // Currency amounts
  const isCurrency = 
    lowerKey.includes('amount') || 
    lowerKey.includes('total') || 
    lowerKey.includes('billed') || 
    lowerKey.includes('paid') || 
    lowerKey.includes('balance') || 
    lowerKey.includes('due') || 
    lowerKey.includes('tax') ||
    lowerKey.includes('rate') ||
    lowerKey.includes('price');

  if (isCurrency) {
    const rawDigits = sVal.replace(/[^0-9.-]/g, '');
    const num = parseFloat(rawDigits);
    if (!isNaN(num) && sVal !== '') {
      const formatted = `₹${Math.round(num).toLocaleString('en-IN')}`;
      return <span className="font-bold font-mono text-slate-900">{formatted}</span>;
    }
  }

  // Dates
  if (lowerKey.includes('date')) {
    return <span className="font-mono text-slate-600 text-[11px] whitespace-nowrap">{sVal}</span>;
  }

  // Invoices & References
  if (lowerKey.includes('invoice') || lowerKey.includes('bill') || lowerKey.includes('est') || lowerKey.includes('voucher') || lowerKey.includes('ref')) {
    return (
      <span className="font-mono font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded border border-slate-200/70 inline-block text-[11px]">
        {sVal}
      </span>
    );
  }

  return <span className="text-slate-700 font-medium">{sVal}</span>;
};

const getMetricCardStyle = (label = '') => {
  const l = label.toLowerCase();
  if (l.includes('paid') || l.includes('received') || l.includes('collection')) {
    return {
      bg: 'bg-gradient-to-br from-emerald-50 to-emerald-100/30',
      border: 'border-emerald-200',
      labelColor: 'text-emerald-700',
      valueColor: 'text-emerald-950'
    };
  }
  if (l.includes('balance') || l.includes('due') || l.includes('pending') || l.includes('urgent') || l.includes('overdue')) {
    return {
      bg: 'bg-gradient-to-br from-amber-50 to-amber-100/30',
      border: 'border-amber-200',
      labelColor: 'text-amber-700',
      valueColor: 'text-amber-950'
    };
  }
  if (l.includes('billed') || l.includes('sales') || l.includes('purchase') || l.includes('grand') || l.includes('amount')) {
    return {
      bg: 'bg-gradient-to-br from-blue-50 to-indigo-100/30',
      border: 'border-blue-200',
      labelColor: 'text-blue-700',
      valueColor: 'text-blue-950'
    };
  }
  return {
    bg: 'bg-gradient-to-br from-slate-50 to-slate-100/40',
    border: 'border-slate-200',
    labelColor: 'text-slate-500',
    valueColor: 'text-slate-900'
  };
};

const formatMetricValue = (val, label = '') => {
  if (val === undefined || val === null || val === '') return '-';
  const s = String(val).trim();
  if (s.startsWith('₹') || s.startsWith('$')) return s;
  const l = label.toLowerCase();
  const isCurrency = 
    l.includes('amount') || 
    l.includes('total') || 
    l.includes('billed') || 
    l.includes('paid') || 
    l.includes('balance') || 
    l.includes('due') || 
    l.includes('payable') || 
    l.includes('receivable') || 
    l.includes('expense') || 
    l.includes('sales') || 
    l.includes('purchase');

  if (isCurrency) {
    const rawDigits = s.replace(/[^0-9.-]/g, '');
    const num = parseFloat(rawDigits);
    if (!isNaN(num) && s !== '') {
      return `₹${Math.round(num).toLocaleString('en-IN')}`;
    }
  }
  return s;
};

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
    const saved = localStorage.getItem('rsp_gemini_api_key');
    if (!saved || saved.startsWith('AIzaSyB0Zel74grr') || saved.startsWith('AIzaSy')) {
      localStorage.setItem('rsp_gemini_api_key', DEFAULT_GEMINI_KEY);
      return DEFAULT_GEMINI_KEY;
    }
    return saved || import.meta.env.VITE_GEMINI_API_KEY || DEFAULT_GEMINI_KEY;
  });
  const [tempKeyInput, setTempKeyInput] = useState(apiKey);

  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [statusLabel, setStatusLabel] = useState('');
  const [fullReportModalData, setFullReportModalData] = useState(null);

  const messagesEndRef = useRef(null);
  const chatContainerRef = useRef(null);

  // Draggable / Movable Chatbot Coordinates
  const [chatPos, setChatPos] = useState(() => {
    try {
      const saved = localStorage.getItem('rsp_chatbot_chat_pos');
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      return null;
    }
  });

  const [isDraggingChat, setIsDraggingChat] = useState(false);

  const chatWindowRef = useRef(null);
  const dragDataRef = useRef({
    startX: 0,
    startY: 0,
    originX: 0,
    originY: 0,
    hasMoved: false,
    width: 0,
    height: 0
  });

  // Clamp positions within screen on window resize
  useEffect(() => {
    const handleResize = () => {
      setChatPos(pos => {
        if (!pos) return pos;
        const width = chatWindowRef.current?.offsetWidth || 450;
        const height = chatWindowRef.current?.offsetHeight || 600;
        const maxX = Math.max(10, window.innerWidth - width - 10);
        const maxY = Math.max(10, window.innerHeight - height - 10);
        const clampedX = Math.max(10, Math.min(pos.x, maxX));
        const clampedY = Math.max(10, Math.min(pos.y, maxY));
        if (clampedX !== pos.x || clampedY !== pos.y) {
          return { x: clampedX, y: clampedY };
        }
        return pos;
      });
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Drag handler for Open Chat Window (Header)
  const handleChatDragStart = (e) => {
    if (e.button !== undefined && e.button !== 0) return;
    if (e.target.closest('button, select, input, textarea, a')) return;

    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;

    if (!chatWindowRef.current) return;
    const rect = chatWindowRef.current.getBoundingClientRect();

    dragDataRef.current = {
      startX: clientX,
      startY: clientY,
      originX: rect.left,
      originY: rect.top,
      hasMoved: false,
      width: rect.width,
      height: rect.height
    };

    setIsDraggingChat(true);

    const onMove = (moveEvt) => {
      const currentX = moveEvt.touches ? moveEvt.touches[0].clientX : moveEvt.clientX;
      const currentY = moveEvt.touches ? moveEvt.touches[0].clientY : moveEvt.clientY;
      const dx = currentX - dragDataRef.current.startX;
      const dy = currentY - dragDataRef.current.startY;

      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
        dragDataRef.current.hasMoved = true;
      }

      let newX = dragDataRef.current.originX + dx;
      let newY = dragDataRef.current.originY + dy;

      const maxX = Math.max(10, window.innerWidth - dragDataRef.current.width - 10);
      const maxY = Math.max(10, window.innerHeight - dragDataRef.current.height - 10);

      newX = Math.max(10, Math.min(newX, maxX));
      newY = Math.max(10, Math.min(newY, maxY));

      setChatPos({ x: Math.round(newX), y: Math.round(newY) });
    };

    const onEnd = () => {
      setIsDraggingChat(false);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onEnd);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onEnd);

      setChatPos(latestPos => {
        if (latestPos) {
          localStorage.setItem('rsp_chatbot_chat_pos', JSON.stringify(latestPos));
        }
        return latestPos;
      });
    };

    window.addEventListener('mousemove', onMove, { passive: false });
    window.addEventListener('mouseup', onEnd);
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('touchend', onEnd);
  };

  // Clean AI Initial Greeting (Megan AI Executive Assistant)
  const [messages, setMessages] = useState([
    {
      id: 'init-1',
      sender: 'bot',
      text: 'Hello! I am Megan AI, your financial assistant with full access to all live company data across RS Purchase. Ask me anything about your sales, purchase bills, vendors, inventory items, expenses, day book, bank statements, assets, or activity logs.',
      timestamp: new Date()
    }
  ]);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (isOpen && !isMinimized) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen, isMinimized, isTyping]);

  const handleSaveApiKey = () => {
    const trimmed = tempKeyInput.trim();
    if (trimmed) {
      localStorage.setItem('rsp_gemini_api_key', trimmed);
      setApiKey(trimmed);
      setShowKeyModal(false);
      setMessages(prev => [
        ...prev,
        {
          id: `bot-keysaved-${Date.now()}`,
          sender: 'bot',
          text: '✅ New Gemini API key saved successfully for Megan AI! You can now ask questions or generate live reports.',
          timestamp: new Date()
        }
      ]);
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

    if (collection === 'payables' || collection === 'payable' || collection === 'vendor_payables' || collection === 'accounts_payable') {
      const now = new Date();
      const vendorMap = {};
      bills.forEach(b => {
        if (!b) return;
        const g = parseFloat(b.grandTotal) || 0;
        const p = parseFloat(b.paidAmount) || 0;
        const bal = b.balanceAmount !== undefined ? parseFloat(b.balanceAmount) : Math.max(0, g - p);
        if (bal <= 0.01) return;

        const vName = b.vendorName || 'Unknown Vendor';
        let daysPending = 0;
        if (b.date) {
          const bd = new Date(b.date);
          if (!isNaN(bd.getTime())) {
            daysPending = Math.max(0, Math.floor((now.getTime() - bd.getTime()) / (1000 * 60 * 60 * 24)));
          }
        }

        if (!vendorMap[vName]) {
          vendorMap[vName] = {
            vendorName: vName,
            balanceDue: 0,
            unpaidBillsCount: 0,
            maxDaysPending: 0,
            urgentBillsCount: 0,
            bills: []
          };
        }
        vendorMap[vName].balanceDue += bal;
        vendorMap[vName].unpaidBillsCount += 1;
        if (daysPending > vendorMap[vName].maxDaysPending) vendorMap[vName].maxDaysPending = daysPending;
        if (daysPending >= 31) vendorMap[vName].urgentBillsCount += 1;
        vendorMap[vName].bills.push({ invoiceNo: b.invoiceNo, date: b.date, balance: bal, daysPending });
      });

      const list = Object.values(vendorMap).filter(v => matchSearch(v));
      const totalPayable = list.reduce((s, v) => s + v.balanceDue, 0);
      const gt60 = list.filter(v => v.maxDaysPending >= 61);
      const g3160 = list.filter(v => v.maxDaysPending >= 31 && v.maxDaysPending <= 60);
      const g1530 = list.filter(v => v.maxDaysPending >= 15 && v.maxDaysPending <= 30);
      const lt15 = list.filter(v => v.maxDaysPending < 15);

      return {
        collection: 'payables',
        totalMatchingRecords: list.length,
        summary: {
          totalOutstandingPayable: Math.round(totalPayable * 100) / 100,
          totalVendorsToRepay: list.length,
          urgentVendorsCount: list.filter(v => v.urgentBillsCount > 0).length,
          agingBuckets: {
            gt60Days: { count: gt60.length, amount: Math.round(gt60.reduce((s, v) => s + v.balanceDue, 0) * 100) / 100 },
            days31to60: { count: g3160.length, amount: Math.round(g3160.reduce((s, v) => s + v.balanceDue, 0) * 100) / 100 },
            days15to30: { count: g1530.length, amount: Math.round(g1530.reduce((s, v) => s + v.balanceDue, 0) * 100) / 100 },
            under15Days: { count: lt15.length, amount: Math.round(lt15.reduce((s, v) => s + v.balanceDue, 0) * 100) / 100 }
          }
        },
        records: list.slice(0, limit)
      };
    }

    if (collection === 'receivables' || collection === 'receivable' || collection === 'customer_receivables' || collection === 'accounts_receivable') {
      const now = new Date();
      const customerMap = {};
      sales.forEach(s => {
        if (!s) return;
        const bal = parseFloat(s.balanceAmount);
        if (isNaN(bal) || bal <= 0.01) return;

        const name = (s.customerName || 'Cash Customer').trim();
        const phone = s.customerPhone || s.contact || s.mobile || s.phone || '';
        const key = phone ? `${name}_${phone}` : name;
        let daysPending = 0;
        const dStr = s.orderDate || s.invDate || s.date || '';
        if (dStr) {
          const sd = new Date(dStr);
          if (!isNaN(sd.getTime())) {
            daysPending = Math.max(0, Math.floor((now.getTime() - sd.getTime()) / (1000 * 60 * 60 * 24)));
          }
        }

        if (!customerMap[key]) {
          customerMap[key] = {
            customerName: name,
            phone,
            branch: s.branch || '',
            balanceDue: 0,
            unpaidOrdersCount: 0,
            maxDaysPending: 0,
            criticalCount: 0,
            orders: []
          };
        }
        customerMap[key].balanceDue += bal;
        customerMap[key].unpaidOrdersCount += 1;
        if (daysPending > customerMap[key].maxDaysPending) customerMap[key].maxDaysPending = daysPending;
        if (daysPending >= 25) customerMap[key].criticalCount += 1;
        customerMap[key].orders.push({ estNo: s.estNo || s.orderNo, date: dStr, balance: bal, daysPending });
      });

      const list = Object.values(customerMap).filter(c => matchSearch(c));
      const totalReceivable = list.reduce((s, c) => s + c.balanceDue, 0);
      const gt25 = list.filter(c => c.maxDaysPending >= 25);
      const g1524 = list.filter(c => c.maxDaysPending >= 15 && c.maxDaysPending <= 24);
      const g714 = list.filter(c => c.maxDaysPending >= 7 && c.maxDaysPending <= 14);
      const lt7 = list.filter(c => c.maxDaysPending < 7);

      return {
        collection: 'receivables',
        totalMatchingRecords: list.length,
        summary: {
          totalCustomerReceivable: Math.round(totalReceivable * 100) / 100,
          totalCustomersPending: list.length,
          criticalOverdueCustomers: gt25.length,
          agingBuckets: {
            gt25DaysCritical: { count: gt25.length, amount: Math.round(gt25.reduce((s, c) => s + c.balanceDue, 0) * 100) / 100 },
            days15to24: { count: g1524.length, amount: Math.round(g1524.reduce((s, c) => s + c.balanceDue, 0) * 100) / 100 },
            days7to14: { count: g714.length, amount: Math.round(g714.reduce((s, c) => s + c.balanceDue, 0) * 100) / 100 },
            under7Days: { count: lt7.length, amount: Math.round(lt7.reduce((s, c) => s + c.balanceDue, 0) * 100) / 100 }
          }
        },
        records: list.slice(0, limit)
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
    const payableVendors = vendorLedgers.filter(v => v.balanceDue > 0.01);

    // 1b. Customer Receivables & Aging Summary
    const pendingSales = sales.filter(s => {
      const b = parseFloat(s.balanceAmount);
      return !isNaN(b) && b > 0.01;
    });
    const totalReceivablesDue = pendingSales.reduce((s, sItem) => s + (parseFloat(sItem.balanceAmount) || 0), 0);

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
You are Megan AI, the intelligent executive AI financial and business assistant for "RS Purchase & Accounts" website with FULL READ ACCESS to every database collection, voucher, register, master, and log on the server.
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
   - Customer Receivables Ageing: ${pendingSales.length} orders pending totalling ₹${Math.round(totalReceivablesDue).toLocaleString('en-IN')}. Can generate "Customer Receivables & Ageing Report" with buckets >25d, 15-24d, 7-14d, <7d.
   - Sales by Year: ${JSON.stringify(salesByYear)}
   - Sales by Year-Month (YYYY-MM): ${JSON.stringify(salesByMonth)}
   - Sales by Branch: ${JSON.stringify(salesByBranch)}
   - Sales by Department: ${JSON.stringify(salesByDept)}

2. PURCHASE BILLS REGISTER (\`bills\` collection: ${bills.length} total bills)
   - Total Purchases Grand Total: ₹${Math.round(totalPurchaseGross).toLocaleString('en-IN')} (Taxable: ₹${Math.round(totalPurchaseTaxable).toLocaleString('en-IN')}, GST: ₹${Math.round(totalPurchaseGst).toLocaleString('en-IN')})
   - Total Paid: ₹${Math.round(totalPurchasePaid).toLocaleString('en-IN')} | Balance Payable: ₹${Math.round(totalPurchaseDue).toLocaleString('en-IN')}
   - Purchases by Year-Month: ${JSON.stringify(billsByMonth)}
   - All Purchase Bills List: ${JSON.stringify(bills.map(b => ({ inv: b.invoiceNo, date: b.date, vendor: b.vendorName, total: b.grandTotal, paid: b.paidAmount, due: b.balanceAmount, status: b.paymentStatus })))}

3. VENDORS / SUPPLIERS & ACCOUNTS PAYABLE (\`vendors\` & \`payables\` collections: ${vendorLedgers.length} registered vendors)
   - Total Outstanding Payable to Vendors: ₹${Math.round(totalVendorBalanceDue).toLocaleString('en-IN')} across ${payableVendors.length} vendors with pending balances.
   - Vendor Payables Ageing: Can generate "Vendor Payables & Ageing Report" with buckets >60d, 31-60d, 15-30d, <15d and urgent invoice clearing.
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
          description: 'Read, search, and filter records from any collection in the website server: sales, bills, vendors, payables, receivables, expenses, daybook, items, assets, customVouchers, bankStatements, recycleBin, logs, or masters.',
          parameters: {
            type: 'OBJECT',
            properties: {
              collection: {
                type: 'STRING',
                description: 'Collection to query: "sales", "bills", "vendors", "payables", "receivables", "expenses", "daybook", "items", "assets", "customVouchers", "bankStatements", "recycleBin", "logs", or "masters"'
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
            const err = new Error(`HTTP ${res.status}: ${errBody}`);
            if (res.status === 403 || res.status === 400) {
              err.isFatalKeyError = true;
            }
            throw err;
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
                const rawCard = {
                  id: `card-${Date.now()}`,
                  title: fc.args?.title || 'Financial Report',
                  subtitle: fc.args?.subtitle || 'Live Server Data',
                  metrics: Array.isArray(fc.args?.metrics) ? fc.args.metrics : [],
                  tableRows: Array.isArray(fc.args?.tableRows) ? fc.args.tableRows : []
                };
                generatedReportCard = normalizeReportCardData(rawCard);
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
        if (err.isFatalKeyError) {
          throw err;
        }
      }
    }

    setStatusLabel('');
    throw lastError || new Error('Unable to reach Gemini AI service.');
  };

  // --- Professional Clean Report Downloads (Excel, PDF, JPG) ---
  const handleDownloadExcel = (rawReport) => {
    try {
      const report = normalizeReportCardData(rawReport);
      if (!report) return;
      const wb = XLSX.utils.book_new();

      // Sheet 1: Executive Summary
      const summaryData = [
        ["RS PURCHASE & ACCOUNTS • MEGAN AI FINANCIAL REPORT", ""],
        ["Report Title:", report.title || 'Financial Report'],
        ["Subtitle / Scope:", report.subtitle || 'Live Server Data'],
        ["Generated On:", new Date().toLocaleString('en-IN')],
        ["Generated By:", "Megan AI Financial Assistant"],
        [],
      ];

      if (Array.isArray(report.metrics) && report.metrics.length > 0) {
        summaryData.push(["KEY SUMMARY METRICS", ""]);
        summaryData.push(["Metric", "Value"]);
        report.metrics.forEach(m => {
          summaryData.push([m.label || '', m.value || '']);
        });
        summaryData.push([]);
      }

      if (Array.isArray(report.tableRows) && report.tableRows.length > 0 && report.headers.length > 0) {
        summaryData.push(["DETAILED BREAKDOWN DATA", ""]);
        summaryData.push(report.headers);
        report.tableRows.forEach(r => {
          summaryData.push(report.headers.map(h => r[h] !== undefined ? r[h] : ''));
        });
      }

      const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
      const colWidths = [];
      summaryData.forEach(row => {
        row.forEach((cell, colIdx) => {
          const len = String(cell ?? '').length;
          colWidths[colIdx] = Math.max(colWidths[colIdx] || 14, len + 3);
        });
      });
      wsSummary['!cols'] = colWidths.map(w => ({ wch: Math.min(w, 45) }));
      XLSX.utils.book_append_sheet(wb, wsSummary, "Executive Summary");

      // Sheet 2: Clean Data Table (Ideal for filters, pivot tables, and formulas)
      if (Array.isArray(report.tableRows) && report.tableRows.length > 0 && report.headers.length > 0) {
        const rowsForSheet = report.tableRows.map(r => {
          const orderedRow = {};
          report.headers.forEach(h => {
            orderedRow[h] = r[h] !== undefined ? r[h] : '';
          });
          return orderedRow;
        });
        const wsData = XLSX.utils.json_to_sheet(rowsForSheet);
        const dataColWidths = report.headers.map(h => {
          let maxL = h.length;
          report.tableRows.forEach(r => {
            const l = String(r[h] ?? '').length;
            if (l > maxL) maxL = l;
          });
          return { wch: Math.min(Math.max(maxL + 3, 14), 50) };
        });
        wsData['!cols'] = dataColWidths;
        XLSX.utils.book_append_sheet(wb, wsData, "Data Table");
      }

      const safeTitle = (report.title || 'Report').replace(/[^a-zA-Z0-9]/g, '_');
      const filename = `${safeTitle}_MeganAI_${Date.now()}.xlsx`;
      XLSX.writeFile(wb, filename);
    } catch (e) {
      console.error('handleDownloadExcel failed', e);
    }
  };

  const handleDownloadPdf = (rawReport) => {
    try {
      const report = normalizeReportCardData(rawReport);
      if (!report) return;
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pageWidth = 210;
      const pageHeight = 297;
      const margin = 14;
      const contentWidth = pageWidth - (margin * 2);

      // Corporate Header Banner (Dark Navy)
      doc.setFillColor(15, 23, 42); // slate-900
      doc.rect(margin, 12, contentWidth, 22, 'F');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.setTextColor(255, 255, 255);
      doc.text(report.title || 'Financial Report', margin + 6, 21);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(203, 213, 225);
      doc.text(`Generated by Megan AI Financial Assistant • ${new Date().toLocaleString('en-IN')}`, margin + 6, 28);

      let y = 42;

      // Subtitle / Scope
      if (report.subtitle) {
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(8.5);
        doc.setTextColor(100, 116, 139);
        doc.text(report.subtitle, margin, y);
        y += 6;
      }

      // Key Metrics Grid Badges
      if (Array.isArray(report.metrics) && report.metrics.length > 0) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(15, 23, 42);
        doc.text("KEY PERFORMANCE METRICS", margin, y);
        y += 4;

        const cardWidth = (contentWidth - 6) / 2;
        const cardHeight = 12;

        report.metrics.forEach((m, idx) => {
          if (y + cardHeight > pageHeight - 16) {
            doc.addPage();
            y = 20;
          }
          const col = idx % 2;
          const x = margin + (col * (cardWidth + 6));

          doc.setFillColor(248, 250, 252);
          doc.setDrawColor(226, 232, 240);
          doc.roundedRect(x, y, cardWidth, cardHeight, 1.5, 1.5, 'FD');

          doc.setFont('helvetica', 'normal');
          doc.setFontSize(7.5);
          doc.setTextColor(100, 116, 139);
          doc.text(String(m.label || '').toUpperCase().slice(0, 32), x + 3, y + 4.5);

          doc.setFont('helvetica', 'bold');
          doc.setFontSize(9);
          doc.setTextColor(15, 23, 42);
          doc.text(String(m.value || ''), x + 3, y + 9.5);

          if (col === 1 || idx === report.metrics.length - 1) {
            y += cardHeight + 3;
          }
        });
        y += 4;
      }

      // Breakdown Table with True Column Grid
      if (Array.isArray(report.tableRows) && report.tableRows.length > 0 && report.headers.length > 0) {
        const headers = report.headers;
        const numCols = Math.min(headers.length, 6);
        const activeHeaders = headers.slice(0, numCols);
        const colW = contentWidth / numCols;

        if (y + 20 > pageHeight - 16) {
          doc.addPage();
          y = 20;
        }

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(15, 23, 42);
        doc.text("DETAILED BREAKDOWN", margin, y);
        y += 4;

        const drawTableHeader = (curY) => {
          doc.setFillColor(241, 245, 249);
          doc.setDrawColor(203, 213, 225);
          doc.rect(margin, curY, contentWidth, 7, 'FD');

          doc.setFont('helvetica', 'bold');
          doc.setFontSize(8);
          doc.setTextColor(51, 65, 85);
          activeHeaders.forEach((h, hIdx) => {
            const colX = margin + (hIdx * colW) + 2;
            doc.text(String(h).slice(0, 18), colX, curY + 4.8);
          });
          return curY + 7;
        };

        y = drawTableHeader(y);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);

        report.tableRows.forEach((row, rIdx) => {
          if (y + 6 > pageHeight - 16) {
            doc.addPage();
            y = 20;
            y = drawTableHeader(y);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(7.5);
          }

          if (rIdx % 2 === 0) {
            doc.setFillColor(255, 255, 255);
          } else {
            doc.setFillColor(248, 250, 252);
          }
          doc.setDrawColor(241, 245, 249);
          doc.rect(margin, y, contentWidth, 6, 'FD');

          doc.setTextColor(51, 65, 85);
          activeHeaders.forEach((h, cIdx) => {
            const colX = margin + (cIdx * colW) + 2;
            const val = String(row[h] ?? '');
            doc.text(val.slice(0, 22), colX, y + 4.2);
          });
          y += 6;
        });
      }

      // Add Footer with Page Numbers
      const totalPages = doc.internal.getNumberOfPages();
      for (let p = 1; p <= totalPages; p++) {
        doc.setPage(p);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(148, 163, 184);
        doc.text(
          `Page ${p} of ${totalPages} • Confidential • RS Purchase & Accounts System • Megan AI`,
          margin,
          pageHeight - 8
        );
      }

      const safeTitle = (report.title || 'Report').replace(/[^a-zA-Z0-9]/g, '_');
      const filename = `${safeTitle}_MeganAI_${Date.now()}.pdf`;
      doc.save(filename);
    } catch (e) {
      console.error('handleDownloadPdf failed', e);
    }
  };

  const handleDownloadImage = async (cardId, reportTitle) => {
    try {
      const el = document.getElementById(cardId);
      if (!el) return;

      // Create an offscreen desktop-width container (940px)
      const clone = el.cloneNode(true);
      clone.id = `${cardId}-capture-clone`;
      clone.style.width = '940px';
      clone.style.maxWidth = '940px';
      clone.style.position = 'fixed';
      clone.style.left = '-9999px';
      clone.style.top = '0';
      clone.style.zIndex = '-9999';
      clone.style.backgroundColor = '#ffffff';
      clone.style.padding = '32px';
      clone.style.borderRadius = '24px';
      clone.style.border = '1px solid #e2e8f0';
      clone.style.boxShadow = 'none';

      // Remove interactive UI buttons not needed in export image
      const nonExportEls = clone.querySelectorAll('.no-export, .report-actions-bar');
      nonExportEls.forEach(n => n.remove());

      // Ensure metrics grid takes full width in desktop grid
      const metricsGrid = clone.querySelector('.metrics-grid');
      if (metricsGrid) {
        metricsGrid.style.display = 'grid';
        metricsGrid.style.gridTemplateColumns = 'repeat(4, minmax(0, 1fr))';
        metricsGrid.style.gap = '14px';
      }

      // Ensure full width for tables and expand scrollbars
      const tables = clone.querySelectorAll('table');
      tables.forEach(t => {
        t.style.width = '100%';
        t.style.fontSize = '12px';
      });
      const scrollContainers = clone.querySelectorAll('.overflow-x-auto');
      scrollContainers.forEach(sc => {
        sc.style.overflow = 'visible';
      });

      document.body.appendChild(clone);

      const canvas = await html2canvas(clone, {
        scale: 2,
        backgroundColor: '#ffffff',
        useCORS: true,
        logging: false
      });

      document.body.removeChild(clone);

      const link = document.createElement('a');
      const safeTitle = (reportTitle || 'Report').replace(/[^a-zA-Z0-9]/g, '_');
      link.download = `${safeTitle}_MeganAI_${Date.now()}.jpg`;
      link.href = canvas.toDataURL('image/jpeg', 0.95);
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

    if (!apiKey || !apiKey.trim()) {
      setShowKeyModal(true);
      setMessages(prev => [
        ...prev,
        {
          id: `bot-err-${Date.now()}`,
          sender: 'bot',
          text: `⚠️ A Google Gemini API key is required to use AI features.\n\nPlease click the button below to enter your API key or get a free key from Google AI Studio.`,
          timestamp: new Date(),
          isKeyError: true
        }
      ]);
      return;
    }

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
      const errStr = String(err?.message || '');
      const isKeyErr = errStr.includes('leaked') || errStr.includes('403') || errStr.includes('PERMISSION_DENIED') || errStr.includes('API_KEY_INVALID') || errStr.includes('API key');

      setMessages(prev => [
        ...prev,
        {
          id: `bot-err-${Date.now()}`,
          sender: 'bot',
          text: isKeyErr
            ? `⚠️ Your Gemini API key was reported as leaked or revoked by Google.\n\nPlease enter a new Gemini API key using the button below or the key icon (🔑) in the header.`
            : `⚠️ Unable to reach Gemini AI right now (${errStr || 'Network error'}). Please verify your internet connection.`,
          timestamp: new Date(),
          isKeyError: isKeyErr
        }
      ]);

      if (isKeyErr) {
        setShowKeyModal(true);
      }
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
      case 'payables_ageing':
        handleSendMessage('Generate a vendor accounts payable and ageing report with a downloadable report card showing unpaid bills, aging days (>60d, 31-60d, 15-30d, <15d), urgent vendors, and outstanding balances.');
        break;
      case 'receivables_ageing':
        handleSendMessage('Generate a customer accounts receivable and ageing report with a downloadable report card showing overdue customer balances, aging days (>25d, 15-24d, 7-14d, <7d), critical overdue clients, and collections priority.');
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
      {/* Modern 3D Vector AI Mascot Character (Movable, Roaming & Conversational) */}
      {!isOpen && (
        <AIMascotCharacter 
          onOpenChat={() => {
            setIsOpen(true);
            setIsMinimized(false);
          }} 
        />
      )}

      {/* Floating Chat Drawer Window (Movable Anywhere) */}
      {isOpen && (
        <div 
          id="megan-ai-drawer"
          ref={chatWindowRef}
          style={
            chatPos
              ? { left: `${chatPos.x}px`, top: `${chatPos.y}px`, right: 'auto', bottom: 'auto' }
              : undefined
          }
          className={`fixed z-50 flex flex-col bg-white rounded-3xl border border-slate-200 shadow-2xl overflow-hidden no-print print:hidden megan-ai-element ${
            !chatPos ? 'bottom-6 right-6' : ''
          } ${
            isDraggingChat ? 'transition-none select-none shadow-indigo-500/25' : 'transition-all duration-200'
          } ${
            isMinimized 
              ? 'w-72 sm:w-80 h-16' 
              : 'w-[94vw] sm:w-[460px] h-[600px] sm:h-[660px] max-h-[85vh]'
          }`}
        >
          {/* Header (Draggable by User) */}
          <div 
            onMouseDown={handleChatDragStart}
            onTouchStart={handleChatDragStart}
            className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white p-3.5 px-4 flex items-center justify-between shadow-xs select-none cursor-grab active:cursor-grabbing touch-none"
            title="Click and drag here to move Megan AI anywhere on the screen"
          >
            <div className="flex items-center gap-2 pointer-events-none">
              <GripHorizontal className="w-4 h-4 text-slate-400/80 mr-0.5 shrink-0" />
              <div className="relative w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-500 to-indigo-500 flex items-center justify-center shadow-inner text-white shrink-0">
                <Bot className="w-5 h-5" />
                <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-400 border-2 border-slate-900 rounded-full" />
              </div>
              <div className="min-w-0">
                <h3 className="font-extrabold text-sm tracking-tight flex items-center gap-1.5 truncate">
                  <span>Megan AI</span>
                  <span className="px-1.5 py-0.2 bg-gradient-to-r from-emerald-500/20 to-blue-500/20 text-emerald-300 text-[10px] font-mono rounded border border-emerald-400/30 flex items-center gap-1 shrink-0">
                    <Database className="w-2.5 h-2.5 text-emerald-400" /> Full Data Read
                  </span>
                </h3>
                <p className="text-[10px] text-slate-300 font-medium truncate">Financial Assistant • Drag header to move</p>
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              {chatPos && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setChatPos(null);
                    localStorage.removeItem('rsp_chatbot_chat_pos');
                  }}
                  className="p-1.5 text-slate-400 hover:text-amber-300 hover:bg-white/10 rounded-lg transition-colors"
                  title="Reset position to default bottom-right"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              )}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowKeyModal(true);
                }}
                className="p-1.5 text-slate-400 hover:text-amber-300 hover:bg-white/10 rounded-lg transition-colors"
                title="API Key Settings"
              >
                <Key className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleClearHistory();
                }}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                title="Clear conversation"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsMinimized(prev => !prev);
                }}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                title={isMinimized ? "Expand" : "Minimize"}
              >
                {isMinimized ? <Maximize2 className="w-3.5 h-3.5" /> : <Minimize2 className="w-3.5 h-3.5" />}
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsOpen(false);
                }}
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
                  <option value="vendor_balances">👥 Vendor Ledger & Balances Report</option>
                  <option value="payables_ageing">⏳ Vendor Payables & Ageing Report</option>
                  <option value="receivables_ageing">💰 Customer Receivables & Ageing Report</option>
                  <option value="expense_summary">💸 Operating Expenses Report</option>
                  <option value="daybook_summary">📒 Day Book Cash & Bank Report</option>
                </select>
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
                        className={`max-w-[94%] p-3.5 rounded-2xl leading-relaxed shadow-xs ${
                          msg.sender === 'user'
                            ? 'bg-indigo-600 text-white rounded-br-xs font-medium whitespace-pre-line'
                            : 'bg-white border border-slate-200 text-slate-800 rounded-bl-xs'
                        }`}
                      >
                        {msg.sender === 'user' ? msg.text : <FormattedMessage text={msg.text} />}
                      </div>

                      {/* Quick API Key Action Button if error is key-related */}
                      {msg.isKeyError && (
                        <button
                          onClick={() => setShowKeyModal(true)}
                          className="mt-1 inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors"
                        >
                          <Key className="w-3.5 h-3.5" /> Enter New Gemini API Key
                        </button>
                      )}

                      {/* Report Card (When Generated by AI) */}
                      {msg.reportData && (() => {
                        const card = normalizeReportCardData(msg.reportData);
                        if (!card) return null;

                        return (
                          <div 
                            id={card.id || `card-${msg.id}`}
                            className="w-full max-w-[98%] bg-white rounded-3xl border border-slate-200/90 shadow-lg p-4 sm:p-5 mt-2 space-y-4 overflow-hidden relative"
                          >
                            {/* Top Gradient Accent Bar */}
                            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 via-blue-500 to-emerald-500" />

                            {/* Header Banner */}
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3 pt-1">
                              <div>
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-indigo-600 text-white shadow-2xs tracking-wide">
                                    <Sparkles className="w-3 h-3 text-indigo-200" />
                                    MEGAN AI REPORT
                                  </span>
                                  <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200/80">
                                    Verified Server Data
                                  </span>
                                  {card.tableRows.length > 5 && (
                                    <button
                                      type="button"
                                      onClick={() => setFullReportModalData(card)}
                                      className="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-2.5 py-0.5 rounded-md transition-colors border border-indigo-200/70 no-export shadow-2xs"
                                      title="Open full expanded table in modal"
                                    >
                                      <Eye className="w-3 h-3" /> Expand Full Table ({card.tableRows.length} rows)
                                    </button>
                                  )}
                                </div>
                                <h4 className="font-black text-slate-900 text-base sm:text-lg tracking-tight mt-1.5">
                                  {card.title}
                                </h4>
                                {card.subtitle && (
                                  <p className="text-xs text-slate-500 font-medium mt-0.5">{card.subtitle}</p>
                                )}
                              </div>

                              <div className="flex items-center gap-1.5 self-start sm:self-auto bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-xl text-slate-600 text-[11px] font-mono font-bold shrink-0">
                                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                                <span>{new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                              </div>
                            </div>

                            {/* Metrics Grid */}
                            {Array.isArray(card.metrics) && card.metrics.length > 0 && (
                              <div className="report-metrics-grid grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                                {card.metrics.map((m, idx) => {
                                  const style = getMetricCardStyle(m.label);
                                  return (
                                    <div 
                                      key={idx} 
                                      className={`p-3 rounded-2xl border ${style.bg} ${style.border} flex flex-col justify-between shadow-2xs`}
                                    >
                                      <span className={`text-[10px] uppercase font-bold tracking-wider ${style.labelColor}`}>
                                        {m.label}
                                      </span>
                                      <span className={`font-extrabold text-sm sm:text-base font-mono mt-1 tracking-tight ${style.valueColor}`}>
                                        {formatMetricValue(m.value, m.label)}
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            )}

                            {/* Breakdown Table Preview */}
                            {Array.isArray(card.tableRows) && card.tableRows.length > 0 && card.headers.length > 0 && (
                              <div className="space-y-1.5">
                                <div className="overflow-x-auto border border-slate-200/90 rounded-2xl text-[11px] bg-white shadow-2xs">
                                  <table className="min-w-full divide-y divide-slate-200">
                                    <thead className="bg-slate-100/90 text-slate-800">
                                      <tr>
                                        {card.headers.map((h, i) => (
                                          <th 
                                            key={i} 
                                            className={`p-2.5 px-3 whitespace-nowrap font-black text-slate-700 tracking-wide uppercase text-[10px] ${getColumnAlignment(h)}`}
                                          >
                                            {h}
                                          </th>
                                        ))}
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                      {card.tableRows.slice(0, 8).map((row, rIdx) => (
                                        <tr 
                                          key={rIdx} 
                                          className={rIdx % 2 === 0 ? 'bg-white hover:bg-slate-50/80 transition-colors' : 'bg-slate-50/50 hover:bg-slate-100/80 transition-colors'}
                                        >
                                          {card.headers.map((h, cIdx) => (
                                            <td 
                                              key={cIdx} 
                                              className={`p-2.5 px-3 whitespace-nowrap text-slate-700 ${getColumnAlignment(h)}`}
                                            >
                                              {renderCellContent(h, row[h])}
                                            </td>
                                          ))}
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              {card.tableRows.length > 8 && (
                                  <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1 px-1">
                                    <span className="font-medium">Showing 8 of {card.tableRows.length} rows</span>
                                    <button
                                      type="button"
                                      onClick={() => setFullReportModalData(card)}
                                      className="font-bold text-indigo-600 hover:text-indigo-800 hover:underline flex items-center gap-1 cursor-pointer"
                                    >
                                      View all {card.tableRows.length} rows &rarr;
                                    </button>
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Download Report Actions Bar */}
                            <div className="report-actions-bar pt-2 border-t border-slate-100 flex items-center justify-between gap-1.5 flex-wrap">
                              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Export Report:</span>
                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleDownloadExcel(card)}
                                  className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-xl font-bold text-[10px] border border-emerald-200 transition-colors shadow-2xs cursor-pointer"
                                  title="Download clean Excel spreadsheet (.xlsx)"
                                >
                                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                                  <span>Excel</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDownloadPdf(card)}
                                  className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-800 rounded-xl font-bold text-[10px] border border-rose-200 transition-colors shadow-2xs cursor-pointer"
                                  title="Download structured PDF report"
                                >
                                  <FileText className="w-3.5 h-3.5 text-rose-600" />
                                  <span>PDF</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDownloadImage(card.id || `card-${msg.id}`, card.title)}
                                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-800 rounded-xl font-bold text-[10px] border border-blue-200 transition-colors shadow-2xs cursor-pointer"
                                  title="Save clean JPG desktop report"
                                >
                                  <ImageIcon className="w-3.5 h-3.5 text-blue-600" />
                                  <span>JPG</span>
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })()}

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

                <div className="text-[11px] text-slate-600 space-y-1.5 leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <p>
                    Get a free API key directly from{' '}
                    <a
                      href="https://aistudio.google.com/app/apikey"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-indigo-600 font-bold underline hover:text-indigo-800"
                    >
                      Google AI Studio ↗
                    </a>
                  </p>
                  <p className="text-[10px] text-slate-400">
                    Your key is saved locally in your browser and used only to power this AI assistant.
                  </p>
                </div>

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

      {/* Expanded Full Report Table Modal */}
      {fullReportModalData && (() => {
        const modalReport = normalizeReportCardData(fullReportModalData);
        if (!modalReport) return null;

        return (
          <div className="fixed inset-0 bg-slate-950/75 backdrop-blur-xs z-[9999] flex items-center justify-center p-3 sm:p-6 no-print print:hidden megan-ai-element">
            <div className="bg-white rounded-3xl w-full max-w-5xl max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in duration-150">
              {/* Header */}
              <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between border-b border-white/10">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-indigo-600/90 border border-indigo-400/30 flex items-center justify-center text-white shadow-inner">
                    <Sparkles className="w-5 h-5 text-indigo-200" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-base sm:text-lg text-white flex items-center gap-2">
                      {modalReport.title}
                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                        Megan AI Full Table
                      </span>
                    </h3>
                    <p className="text-xs text-slate-300 font-medium">{modalReport.subtitle}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleDownloadExcel(modalReport)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-xs shadow-xs transition-colors cursor-pointer"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5" />
                    <span>Excel</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDownloadPdf(modalReport)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl font-bold text-xs shadow-xs transition-colors cursor-pointer"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>PDF</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setFullReportModalData(null)}
                    className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-xl transition-colors ml-1 cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Metrics Bar */}
              {Array.isArray(modalReport.metrics) && modalReport.metrics.length > 0 && (
                <div className="bg-slate-50 border-b border-slate-200 p-3 sm:px-6 flex flex-wrap gap-2.5 items-center">
                  {modalReport.metrics.map((m, idx) => {
                    const style = getMetricCardStyle(m.label);
                    return (
                      <div key={idx} className={`px-3 py-2 rounded-xl border ${style.bg} ${style.border} text-xs flex items-center gap-2 shadow-2xs`}>
                        <span className={`font-bold uppercase text-[10px] tracking-wider ${style.labelColor}`}>{m.label}:</span>
                        <span className={`font-extrabold font-mono text-sm ${style.valueColor}`}>{formatMetricValue(m.value, m.label)}</span>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Scrollable Table Body */}
              <div className="flex-1 overflow-auto p-4 sm:p-6 bg-slate-50/50">
                {Array.isArray(modalReport.tableRows) && modalReport.tableRows.length > 0 && modalReport.headers.length > 0 ? (
                  <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-xs">
                    <table className="min-w-full divide-y divide-slate-200 text-xs">
                      <thead className="bg-slate-100 text-slate-800 font-bold sticky top-0 z-10 shadow-2xs">
                        <tr>
                          {modalReport.headers.map((h, i) => (
                            <th 
                              key={i} 
                              className={`px-3.5 py-3 font-black text-slate-700 whitespace-nowrap bg-slate-100 uppercase tracking-wider text-[10px] ${getColumnAlignment(h)}`}
                            >
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {modalReport.tableRows.map((row, rIdx) => (
                          <tr 
                            key={rIdx} 
                            className={rIdx % 2 === 0 ? 'bg-white hover:bg-slate-50/90 transition-colors' : 'bg-slate-50/60 hover:bg-indigo-50/40 transition-colors'}
                          >
                            {modalReport.headers.map((h, cIdx) => (
                              <td 
                                key={cIdx} 
                                className={`px-3.5 py-2.5 whitespace-nowrap text-slate-700 font-medium ${getColumnAlignment(h)}`}
                              >
                                {renderCellContent(h, row[h])}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="p-8 text-center text-slate-400">No tabular rows found in this report.</div>
                )}
              </div>

              {/* Footer */}
              <div className="p-3 sm:px-6 bg-white border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
                <span className="font-medium">Total Live Records: <strong className="text-slate-800 font-mono">{modalReport.tableRows.length}</strong> rows</span>
                <button
                  type="button"
                  onClick={() => setFullReportModalData(null)}
                  className="px-4 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors cursor-pointer"
                >
                  Close Full Table
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </>
  );
}
