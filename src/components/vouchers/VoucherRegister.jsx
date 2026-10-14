import React, { useState, useMemo } from 'react';
import { 
  BookOpen, 
  ArrowUpRight, 
  ArrowDownRight, 
  Printer, 
  FileSpreadsheet, 
  Search, 
  Calendar, 
  Building2, 
  Layers, 
  Wallet, 
  CreditCard, 
  Receipt, 
  TrendingUp, 
  TrendingDown, 
  CheckCircle2,
  DollarSign,
  ArrowRightLeft,
  Edit2,
  Trash2,
  Plus,
  X,
  AlertTriangle,
  Clock,
  Filter
} from 'lucide-react';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { normalizeDateToISO } from '../../utils/salesParser';
import { useData } from '../../context/DataContext';
import { useSettings } from '../../context/SettingsContext';
import { useToast } from '../../context/ToastContext';
import * as XLSX from 'xlsx';

export default function VoucherRegister() {
  const { 
    sales, 
    bills, 
    expenses, 
    branches, 
    departments, 
    paymentMethods,
    customVouchers,
    daybookTransactions,
    updateSalePayment,
    deleteSalePayment,
    updateBillPayment,
    deleteBillPayment,
    saveExpense,
    deleteExpense,
    addCustomVoucher,
    updateCustomVoucher,
    deleteCustomVoucher,
    updateDaybookTransaction,
    deleteDaybookTransaction
  } = useData();

  const { profile } = useSettings();
  const { showToast } = useToast();

  // Mode: 'all' | 'receipts' | 'payments' | 'cash' | 'bank'
  const [activeLedger, setActiveLedger] = useState('all');
  const [search, setSearch] = useState('');
  const [branchFilter, setBranchFilter] = useState('all');
  const [deptFilter, setDeptFilter] = useState('all');

  // Pagination for ultra smooth performance
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  // Date Filtering: 'sept2026' | 'specific' | 'dayOfMonth' | 'custom' | 'today' | 'thisMonth' | 'lastMonth' | 'all'
  const [datePeriod, setDatePeriod] = useState('sept2026');
  const [dateFrom, setDateFrom] = useState('2026-09-01');
  const [dateTo, setDateTo] = useState('2026-09-30');
  const [specificDate, setSpecificDate] = useState('');
  const [selectedDay, setSelectedDay] = useState('12');

  // Modals
  const [editingVoucher, setEditingVoucher] = useState(null);
  const [deletingVoucher, setDeletingVoucher] = useState(null);
  const [showNewModal, setShowNewModal] = useState(false);

  // New / Edit Voucher Form State
  const [formVoucherNo, setFormVoucherNo] = useState('');
  const [formDate, setFormDate] = useState('');
  const [formType, setFormType] = useState('RECEIPT');
  const [formBook, setFormBook] = useState('BANK');
  const [formMethod, setFormMethod] = useState('GPAY- SBI');
  const [formParty, setFormParty] = useState('');
  const [formBranch, setFormBranch] = useState('KLK');
  const [formDept, setFormDept] = useState('ADVERTISEMENT');
  const [formAmount, setFormAmount] = useState('');
  const [formRefNo, setFormRefNo] = useState('');
  const [formNotes, setFormNotes] = useState('');

  const handlePeriodChange = (period) => {
    setDatePeriod(period);
    const today = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const toISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

    if (period === 'all') {
      setDateFrom('');
      setDateTo('');
      setSpecificDate('');
    } else if (period === 'specific') {
      const initial = specificDate || dateFrom || '2026-09-01';
      setSpecificDate(initial);
      setDateFrom(initial);
      setDateTo(initial);
    } else if (period === 'dayOfMonth') {
      setDateFrom('');
      setDateTo('');
      setSpecificDate('');
    } else if (period === 'today') {
      const d = toISO(today);
      setDateFrom(d);
      setDateTo(d);
      setSpecificDate(d);
    } else if (period === 'sept2026') {
      setDateFrom('2026-09-01');
      setDateTo('2026-09-30');
      setSpecificDate('');
    } else if (period === 'thisMonth') {
      const first = new Date(today.getFullYear(), today.getMonth(), 1);
      const last = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      setDateFrom(toISO(first));
      setDateTo(toISO(last));
      setSpecificDate('');
    } else if (period === 'lastMonth') {
      const first = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const last = new Date(today.getFullYear(), today.getMonth(), 0);
      setDateFrom(toISO(first));
      setDateTo(toISO(last));
      setSpecificDate('');
    }
  };

  // Compile all vouchers from Sales, Purchases, Expenses, and Custom Standalone Vouchers
  const allVouchers = useMemo(() => {
    const list = [];

    // 1. Sales Receipts (Money IN)
    sales.forEach(s => {
      const branch = s.branch || 'KLK';
      const dept = s.department || 'ADVERTISEMENT';
      const cust = s.customerName || 'Walk-in Customer';
      const estNo = s.estNo ? `#${s.estNo}` : '';
      const invNo = s.invoiceNo ? ` (${s.invoiceNo})` : '';

      if (Array.isArray(s.payments) && s.payments.length > 0) {
        s.payments.forEach((p, idx) => {
          const amt = parseFloat(p.amount) || 0;
          if (amt <= 0) return;
          const method = p.method || 'CASH';
          const isCash = method.toUpperCase().includes('CASH');
          const d = normalizeDateToISO(p.date || s.invDate || s.orderDate);

          list.push({
            id: `v_sale_${s.id}_${idx}`,
            source: 'sale',
            saleId: s.id,
            paymentIdx: idx,
            paymentId: p.id,
            voucherNo: `REC-${s.estNo || s.id.slice(-4)}-${idx + 1}`,
            date: d,
            type: 'RECEIPT', // Inflow
            book: isCash ? 'CASH' : 'BANK',
            method,
            party: cust,
            contact: s.contact || '',
            branch,
            department: dept,
            refNo: `Sales Order ${estNo}${invNo}`,
            description: `${p.type || 'Customer Payment'} - Order Form: ${s.orderFormNo || 'NA'}`,
            inflow: amt,
            outflow: 0,
            rawPayment: p,
            parent: s
          });
        });
      } else {
        const paid = parseFloat(s.paidAmount) || 0;
        if (paid > 0) {
          const d = normalizeDateToISO(s.invDate || s.orderDate);
          list.push({
            id: `v_sale_${s.id}_direct`,
            source: 'sale',
            saleId: s.id,
            paymentIdx: 0,
            paymentId: null,
            voucherNo: `REC-${s.estNo || s.id.slice(-4)}`,
            date: d,
            type: 'RECEIPT',
            book: 'BANK',
            method: 'GPAY- SBI',
            party: cust,
            contact: s.contact || '',
            branch,
            department: dept,
            refNo: `Sales Order ${estNo}${invNo}`,
            description: `Advance / Full Payment - Order Form: ${s.orderFormNo || 'NA'}`,
            inflow: paid,
            outflow: 0,
            rawPayment: null,
            parent: s
          });
        }
      }
    });

    // 2. Purchase Bill Payments (Money OUT)
    bills.forEach(b => {
      const vendor = b.vendorName || 'Vendor';
      const billNo = b.invoiceNo ? `#${b.invoiceNo}` : '';
      const branch = b.branch || 'KLK';
      const dept = b.department || 'PRINT & PACK';

      const pHistory = Array.isArray(b.paymentHistory) && b.paymentHistory.length > 0
        ? b.paymentHistory
        : (Array.isArray(b.payments) ? b.payments : []);

      if (pHistory.length > 0) {
        pHistory.forEach((p, idx) => {
          const amt = parseFloat(p.amount) || 0;
          if (amt <= 0) return;
          const method = p.mode || p.method || 'Bank Transfer';
          const isCash = method.toUpperCase().includes('CASH');
          const d = normalizeDateToISO(p.date || b.date);

          list.push({
            id: `v_bill_${b.id}_${idx}`,
            source: 'bill',
            billId: b.id,
            paymentIdx: idx,
            paymentId: p.id,
            voucherNo: `PMT-PUR-${b.invoiceNo || b.id.slice(-4)}-${idx + 1}`,
            date: d,
            type: 'PAYMENT', // Outflow
            book: isCash ? 'CASH' : 'BANK',
            method,
            party: vendor,
            contact: b.vendorContact || '',
            branch,
            department: dept,
            refNo: `Purchase Bill ${billNo}`,
            description: p.notes || `Vendor Bill Payment ${p.reference ? '(' + p.reference + ')' : ''}`,
            inflow: 0,
            outflow: amt,
            rawPayment: p,
            parent: b
          });
        });
      } else {
        const paid = parseFloat(b.paidAmount) || 0;
        if (paid > 0) {
          const d = normalizeDateToISO(b.date);
          list.push({
            id: `v_bill_${b.id}_direct`,
            source: 'bill',
            billId: b.id,
            paymentIdx: 0,
            paymentId: null,
            voucherNo: `PMT-PUR-${b.invoiceNo || b.id.slice(-4)}`,
            date: d,
            type: 'PAYMENT',
            book: 'BANK',
            method: 'Bank Transfer',
            party: vendor,
            contact: b.vendorContact || '',
            branch,
            department: dept,
            refNo: `Purchase Bill ${billNo}`,
            description: `Payment for material purchase`,
            inflow: 0,
            outflow: paid,
            rawPayment: null,
            parent: b
          });
        }
      }
    });

    // 3. Operational Expenses (Money OUT)
    expenses.forEach(e => {
      const amt = parseFloat(e.amount) || 0;
      if (amt <= 0) return;
      const method = e.paymentMethod || 'CASH';
      const isCash = method.toUpperCase().includes('CASH');
      const d = normalizeDateToISO(e.date);

      list.push({
        id: `v_exp_${e.id}`,
        source: 'expense',
        expenseId: e.id,
        voucherNo: e.voucherNo || `EXP-${e.id.slice(-5)}`,
        date: d,
        type: 'PAYMENT', // Outflow
        book: isCash ? 'CASH' : 'BANK',
        method,
        party: e.payee || e.category || 'Office Expense',
        contact: '-',
        branch: e.branch || 'KLK',
        department: e.department || 'GENERAL ADMIN',
        refNo: `Expense: ${e.category || 'Operating'}`,
        description: e.description || `${e.category} voucher disbursement`,
        inflow: 0,
        outflow: amt,
        parent: e
      });
    });

    // 4. Standalone / Custom Vouchers
    (customVouchers || []).forEach(cv => {
      const amt = parseFloat(cv.amount) || 0;
      if (amt <= 0) return;
      const isReceipt = cv.type === 'RECEIPT';
      const method = cv.method || 'CASH';
      const isCash = cv.book === 'CASH' || method.toUpperCase().includes('CASH');
      const d = normalizeDateToISO(cv.date);

      list.push({
        id: cv.id,
        source: 'custom',
        sourceId: cv.id,
        voucherNo: cv.voucherNo || `VOUCH-${cv.id.slice(-5)}`,
        date: d,
        type: isReceipt ? 'RECEIPT' : 'PAYMENT',
        book: isCash ? 'CASH' : 'BANK',
        method,
        party: cv.party || 'General Account',
        contact: cv.contact || '',
        branch: cv.branch || 'KLK',
        department: cv.department || 'GENERAL ADMIN',
        refNo: cv.refNo || (isReceipt ? 'Direct Receipt' : 'Direct Payment'),
        description: cv.description || cv.notes || 'Standalone Voucher Entry',
        inflow: isReceipt ? amt : 0,
        outflow: isReceipt ? 0 : amt,
        raw: cv
      });
    });

    // 5. Day Book Operational & Non-Sales Transactions (Leaving non-duplicate transactions in Payment & Receipt Book)
    const expenseDbIds = new Set((expenses || []).map(e => e.daybookRefId || e.id));
    (daybookTransactions || []).forEach(db => {
      // Avoid duplicate listing with sales, bills, and expenses
      if (db.category === 'SALES' || db.matchedSaleId) return;
      if (db.category === 'PURCHASE' || db.matchedBillId) return;
      if (expenseDbIds.has(db.id) || expenseDbIds.has(`exp_${db.id}`)) return;
        const cashCr = parseFloat(db.cashCredit) || 0;
        const cashDr = parseFloat(db.cashDebit) || 0;
        const bankCr = parseFloat(db.bankCredit) || 0;
        const bankDr = parseFloat(db.bankDebit) || 0;

        const isInflow = (cashCr + bankCr) > 0;
        const isOutflow = (cashDr + bankDr) > 0;
        const amt = isInflow ? (cashCr + bankCr) : (cashDr + bankDr);
        if (amt <= 0) return;

        const isCash = (cashCr + cashDr) > 0;
        const method = db.payment || (isCash ? 'CASH' : 'BANK TRANSFER');
        const estNoStr = db.estNo ? `#${db.estNo}` : '';

        list.push({
          id: `v_db_${db.id}`,
          source: 'daybook',
          sourceId: db.id,
          voucherNo: `${isInflow ? 'REC-DB' : 'PMT-DB'}-${(db.date || '').replace(/-/g, '')}-${db.rowIdx || db.id.slice(-4)}`,
          date: normalizeDateToISO(db.date),
          type: isInflow ? 'RECEIPT' : 'PAYMENT',
          book: isCash ? 'CASH' : 'BANK',
          method,
          party: db.description || db.category || 'General Party',
          contact: '-',
          branch: db.branch || 'KLK',
          department: db.department || 'OFFSET',
          refNo: `Day Book: ${db.category}${estNoStr ? ' (' + estNoStr + ')' : ''}`,
          description: `${db.description || db.category} ${db.balanceNote ? '[' + db.balanceNote + ']' : ''}`,
          inflow: isInflow ? amt : 0,
          outflow: isInflow ? 0 : amt,
          rawDaybook: db
        });
      });

    // Sort descending by date
    return list.sort((a, b) => {
      const timeA = new Date(a.date).getTime() || 0;
      const timeB = new Date(b.date).getTime() || 0;
      return timeB - timeA;
    });
  }, [sales, bills, expenses, customVouchers, daybookTransactions]);

  const allBranches = useMemo(() => {
    const set = new Set([...(branches || [])]);
    allVouchers.forEach(v => { if (v.branch) set.add(v.branch); });
    return Array.from(set);
  }, [branches, allVouchers]);

  const allDepts = useMemo(() => {
    const set = new Set([...(departments || [])]);
    allVouchers.forEach(v => { if (v.department) set.add(v.department); });
    return Array.from(set);
  }, [departments, allVouchers]);

  // Filtered Vouchers
  const filteredVouchers = useMemo(() => {
    return allVouchers.filter(v => {
      // 1. Ledger Filter
      if (activeLedger === 'receipts' && v.type !== 'RECEIPT') return false;
      if (activeLedger === 'payments' && v.type !== 'PAYMENT') return false;
      if (activeLedger === 'cash' && v.book !== 'CASH') return false;
      if (activeLedger === 'bank' && v.book !== 'BANK') return false;

      // 2. Branch & Dept Filter
      if (branchFilter !== 'all' && v.branch !== branchFilter) return false;
      if (deptFilter !== 'all' && v.department !== deptFilter) return false;

      // 3. Date Filters
      if (datePeriod === 'specific') {
        if (specificDate) {
          const specISO = normalizeDateToISO(specificDate);
          if (v.date !== specISO) return false;
        }
      } else if (datePeriod === 'dayOfMonth') {
        if (selectedDay) {
          const dayStr = String(selectedDay).padStart(2, '0');
          // v.date is YYYY-MM-DD
          if (!v.date || !v.date.endsWith(`-${dayStr}`)) return false;
        }
      } else {
        if (dateFrom && v.date && v.date < dateFrom) return false;
        if (dateTo && v.date && v.date > dateTo) return false;
      }

      // 4. Search Filter
      if (search) {
        const q = search.toLowerCase();
        const matches = 
          (v.voucherNo && v.voucherNo.toLowerCase().includes(q)) ||
          (v.party && v.party.toLowerCase().includes(q)) ||
          (v.refNo && v.refNo.toLowerCase().includes(q)) ||
          (v.description && v.description.toLowerCase().includes(q)) ||
          (v.method && v.method.toLowerCase().includes(q));
        if (!matches) return false;
      }

      return true;
    });
  }, [allVouchers, activeLedger, branchFilter, deptFilter, datePeriod, specificDate, selectedDay, dateFrom, dateTo, search]);

  // Aggregate Book Metrics
  const metrics = useMemo(() => {
    let totalCashIn = 0;
    let totalCashOut = 0;
    let totalBankIn = 0;
    let totalBankOut = 0;

    filteredVouchers.forEach(v => {
      if (v.book === 'CASH') {
        totalCashIn += v.inflow;
        totalCashOut += v.outflow;
      } else {
        totalBankIn += v.inflow;
        totalBankOut += v.outflow;
      }
    });

    const netCash = totalCashIn - totalCashOut;
    const netBank = totalBankIn - totalBankOut;
    const totalInflow = totalCashIn + totalBankIn;
    const totalOutflow = totalCashOut + totalBankOut;
    const netSurplus = totalInflow - totalOutflow;

    return {
      count: filteredVouchers.length,
      totalCashIn,
      totalCashOut,
      netCash,
      totalBankIn,
      totalBankOut,
      netBank,
      totalInflow,
      totalOutflow,
      netSurplus
    };
  }, [filteredVouchers]);

  // Fast Client-Side Pagination for Silky Smooth Rendering
  const totalPages = Math.ceil(filteredVouchers.length / (pageSize === 'all' ? filteredVouchers.length || 1 : pageSize)) || 1;
  const paginatedVouchers = useMemo(() => {
    if (pageSize === 'all') return filteredVouchers;
    const start = (currentPage - 1) * pageSize;
    return filteredVouchers.slice(start, start + pageSize);
  }, [filteredVouchers, currentPage, pageSize]);

  const handlePageChange = (p) => {
    if (p >= 1 && p <= totalPages) {
      setCurrentPage(p);
    }
  };

  // Export Voucher Book to Excel
  const handleExportExcel = () => {
    if (filteredVouchers.length === 0) {
      showToast('No vouchers available to export', 'error');
      return;
    }

    const headers = [
      'VOUCHER NO',
      'DATE',
      'TYPE',
      'ACCOUNT BOOK',
      'PAYMENT METHOD',
      'PARTY / BENEFICIARY',
      'CONTACT',
      'BRANCH',
      'DEPARTMENT',
      'REFERENCE NO',
      'PARTICULARS / DESCRIPTION',
      'RECEIPT / INFLOW (₹)',
      'PAYMENT / OUTFLOW (₹)'
    ];

    const rows = [headers];

    filteredVouchers.forEach(v => {
      rows.push([
        v.voucherNo,
        v.date || '',
        v.type,
        v.book === 'CASH' ? 'Cash Book' : 'Bank Book',
        v.method,
        v.party,
        v.contact || '',
        v.branch,
        v.department,
        v.refNo,
        v.description,
        v.inflow > 0 ? v.inflow : '',
        v.outflow > 0 ? v.outflow : ''
      ]);
    });

    // Summary row
    rows.push([
      'TOTAL',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      'TOTAL INFLOW & OUTFLOW',
      metrics.totalInflow,
      metrics.totalOutflow
    ]);

    const worksheet = XLSX.utils.aoa_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Voucher Register');
    XLSX.writeFile(workbook, `Voucher_Register_${activeLedger.toUpperCase()}_${new Date().toISOString().substring(0, 10)}.xlsx`);
    showToast(`Exported ${filteredVouchers.length} vouchers to Excel`, 'success');
  };

  // Open Edit Modal
  const handleOpenEdit = (v) => {
    setEditingVoucher(v);
    setFormVoucherNo(v.voucherNo || '');
    setFormDate(v.date || new Date().toISOString().substring(0, 10));
    setFormType(v.type);
    setFormBook(v.book);
    setFormMethod(v.method || 'CASH');
    setFormParty(v.party || '');
    setFormBranch(v.branch || 'KLK');
    setFormDept(v.department || 'ADVERTISEMENT');
    setFormAmount(String(v.inflow > 0 ? v.inflow : v.outflow));
    setFormRefNo(v.refNo || '');
    setFormNotes(v.description || '');
  };

  // Save Voucher Edits
  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editingVoucher) return;

    const amt = parseFloat(formAmount) || 0;
    if (amt <= 0) {
      showToast('Please enter a valid amount greater than 0', 'error');
      return;
    }

    try {
      if (editingVoucher.source === 'sale') {
        updateSalePayment(editingVoucher.saleId, editingVoucher.paymentId ?? editingVoucher.paymentIdx, {
          amount: amt,
          date: formDate,
          method: formMethod,
          type: formType === 'RECEIPT' ? 'Advance Payment' : 'Refund',
          notes: formNotes
        });
        showToast('Sales receipt voucher updated successfully', 'success');
      } else if (editingVoucher.source === 'bill') {
        await updateBillPayment(editingVoucher.billId, editingVoucher.paymentId ?? editingVoucher.paymentIdx, {
          amount: amt,
          date: formDate,
          mode: formMethod,
          notes: formNotes
        });
        showToast('Purchase payment voucher updated successfully', 'success');
      } else if (editingVoucher.source === 'expense') {
        await saveExpense({
          ...editingVoucher.parent,
          amount: amt,
          date: formDate,
          payee: formParty,
          branch: formBranch,
          department: formDept,
          paymentMethod: formMethod,
          description: formNotes
        });
        showToast('Expense voucher updated successfully', 'success');
      } else if (editingVoucher.source === 'custom') {
        updateCustomVoucher(editingVoucher.id, {
          ...editingVoucher.raw,
          voucherNo: formVoucherNo,
          amount: amt,
          date: formDate,
          type: formType,
          book: formBook,
          method: formMethod,
          party: formParty,
          branch: formBranch,
          department: formDept,
          refNo: formRefNo,
          description: formNotes
        });
        showToast('Voucher updated successfully', 'success');
      } else if (editingVoucher.source === 'daybook') {
        const isCash = formBook === 'CASH' || formMethod.toUpperCase().includes('CASH');
        const isInflow = formType === 'RECEIPT';
        updateDaybookTransaction(editingVoucher.rawDaybook.id, {
          ...editingVoucher.rawDaybook,
          date: formDate,
          description: formParty,
          branch: formBranch,
          department: formDept,
          payment: formMethod,
          cashCredit: isInflow && isCash ? amt : 0,
          cashDebit: !isInflow && isCash ? amt : 0,
          bankCredit: isInflow && !isCash ? amt : 0,
          bankDebit: !isInflow && !isCash ? amt : 0
        });
        showToast('Day Book voucher updated successfully', 'success');
      }

      setEditingVoucher(null);
    } catch (err) {
      console.error('Error updating voucher:', err);
      showToast('Failed to update voucher', 'error');
    }
  };

  // Confirm Delete Voucher
  const handleConfirmDelete = async () => {
    if (!deletingVoucher) return;

    try {
      if (deletingVoucher.source === 'sale') {
        deleteSalePayment(deletingVoucher.saleId, deletingVoucher.paymentId ?? deletingVoucher.paymentIdx);
        showToast('Sales receipt deleted; order balance recalculated', 'success');
      } else if (deletingVoucher.source === 'bill') {
        await deleteBillPayment(deletingVoucher.billId, deletingVoucher.paymentId ?? deletingVoucher.paymentIdx);
        showToast('Purchase payment deleted; bill balance recalculated', 'success');
      } else if (deletingVoucher.source === 'expense') {
        await deleteExpense(deletingVoucher.expenseId);
        showToast('Expense voucher removed', 'success');
      } else if (deletingVoucher.source === 'custom') {
        deleteCustomVoucher(deletingVoucher.id);
        showToast('Voucher removed', 'success');
      } else if (deletingVoucher.source === 'daybook') {
        deleteDaybookTransaction(deletingVoucher.rawDaybook.id);
        showToast('Day Book voucher removed', 'success');
      }

      setDeletingVoucher(null);
    } catch (err) {
      console.error('Error deleting voucher:', err);
      showToast('Failed to delete voucher', 'error');
    }
  };

  // Open New Voucher Modal
  const handleOpenNew = () => {
    setFormVoucherNo(`VOUCH-${Date.now().toString().slice(-5)}`);
    setFormDate(new Date().toISOString().substring(0, 10));
    setFormType('RECEIPT');
    setFormBook('BANK');
    setFormMethod('GPAY- SBI');
    setFormParty('');
    setFormBranch('KLK');
    setFormDept('ADVERTISEMENT');
    setFormAmount('');
    setFormRefNo('Direct Voucher');
    setFormNotes('');
    setShowNewModal(true);
  };

  // Save New Voucher
  const handleSaveNew = (e) => {
    e.preventDefault();
    const amt = parseFloat(formAmount) || 0;
    if (amt <= 0) {
      showToast('Please enter a valid amount greater than 0', 'error');
      return;
    }

    addCustomVoucher({
      voucherNo: formVoucherNo,
      date: formDate,
      type: formType,
      book: formBook,
      method: formMethod,
      party: formParty || (formType === 'RECEIPT' ? 'Direct Receipt' : 'Direct Payment'),
      branch: formBranch,
      department: formDept,
      amount: amt,
      refNo: formRefNo,
      description: formNotes
    });

    showToast(`Created new ${formType.toLowerCase()} voucher #${formVoucherNo}`, 'success');
    setShowNewModal(false);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Top Banner */}
      <div className="bg-indigo-500/10 border border-indigo-500/30 text-indigo-900 p-3 rounded-2xl flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-indigo-600 animate-pulse" />
          <span className="font-extrabold uppercase tracking-wide">Enterprise Payment & Receipt Voucher Register</span>
          <span className="text-slate-500 hidden sm:inline">• Dual-Entry Cash & Bank Books with Full Edit, Delete & Specific-Date Filtering</span>
        </div>
        <div className="flex items-center gap-2 font-mono text-[11px]">
          <span>{filteredVouchers.length} Transactions</span>
        </div>
      </div>

      {/* Header and Controls */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
            <BookOpen className="w-7 h-7 text-indigo-600" />
            <span>Payment & Receipt Voucher Book</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Complete dual-entry cash & bank register with payment altering, voucher removal, and flexible multi-month date filters
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap justify-end">
          <button
            onClick={handleOpenNew}
            className="flex items-center gap-1.5 px-3.5 py-2.5 bg-brand-600 hover:bg-brand-700 active:bg-brand-800 text-white rounded-xl text-xs font-bold shadow-sm transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>New Voucher</span>
          </button>

          <button
            onClick={handleExportExcel}
            className="flex items-center gap-1.5 px-3.5 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-xl text-xs font-bold shadow-sm transition-all"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Export Register</span>
          </button>

          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-slate-700 hover:bg-slate-800 active:bg-slate-900 text-white rounded-xl text-xs font-bold shadow-sm transition-all"
          >
            <Printer className="w-4 h-4" />
            <span>Print Register</span>
          </button>
        </div>
      </div>

      {/* View Mode Tab Switcher */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-2.5 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl overflow-x-auto">
          <button
            onClick={() => setActiveLedger('all')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
              activeLedger === 'all'
                ? 'bg-white text-slate-900 shadow-xs border border-slate-200'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ArrowRightLeft className="w-3.5 h-3.5 text-slate-600" />
            <span>All Vouchers</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-200 text-slate-800 font-mono font-bold">
              {allVouchers.length}
            </span>
          </button>

          <button
            onClick={() => setActiveLedger('receipts')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
              activeLedger === 'receipts'
                ? 'bg-white text-emerald-950 shadow-xs border border-slate-200'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ArrowDownRight className="w-3.5 h-3.5 text-emerald-600" />
            <span>Receipts (In)</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-emerald-100 text-emerald-800 font-mono font-bold">
              {allVouchers.filter(v => v.type === 'RECEIPT').length}
            </span>
          </button>

          <button
            onClick={() => setActiveLedger('payments')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
              activeLedger === 'payments'
                ? 'bg-white text-rose-950 shadow-xs border border-slate-200'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ArrowUpRight className="w-3.5 h-3.5 text-rose-600" />
            <span>Payments (Out)</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-rose-100 text-rose-800 font-mono font-bold">
              {allVouchers.filter(v => v.type === 'PAYMENT').length}
            </span>
          </button>

          <button
            onClick={() => setActiveLedger('cash')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
              activeLedger === 'cash'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Wallet className="w-3.5 h-3.5" />
            <span>💵 Cash Book</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold ${
              activeLedger === 'cash' ? 'bg-emerald-700 text-white' : 'bg-slate-200 text-slate-800'
            }`}>
              {allVouchers.filter(v => v.book === 'CASH').length}
            </span>
          </button>

          <button
            onClick={() => setActiveLedger('bank')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
              activeLedger === 'bank'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <CreditCard className="w-3.5 h-3.5" />
            <span>🏦 Bank Book</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold ${
              activeLedger === 'bank' ? 'bg-indigo-700 text-white' : 'bg-slate-200 text-slate-800'
            }`}>
              {allVouchers.filter(v => v.book === 'BANK').length}
            </span>
          </button>
        </div>
      </div>

      {/* Dual Book Summary Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Cash Book Card */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex justify-between items-center text-slate-500 text-[10px] font-bold uppercase">
            <span>Cash in Hand (Net)</span>
            <Wallet className="w-4 h-4 text-emerald-600" />
          </div>
          <p className={`text-xl font-black mt-1 ${metrics.netCash >= 0 ? 'text-emerald-950' : 'text-rose-600'}`}>
            {formatCurrency(metrics.netCash)}
          </p>
          <div className="flex items-center justify-between text-[10px] text-slate-500 mt-1 pt-1 border-t border-slate-100">
            <span className="text-emerald-700 font-semibold">In: {formatCurrency(metrics.totalCashIn)}</span>
            <span className="text-rose-700 font-semibold">Out: {formatCurrency(metrics.totalCashOut)}</span>
          </div>
        </div>

        {/* Bank Book Card */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex justify-between items-center text-slate-500 text-[10px] font-bold uppercase">
            <span>Bank Balance (Net)</span>
            <CreditCard className="w-4 h-4 text-indigo-600" />
          </div>
          <p className={`text-xl font-black mt-1 ${metrics.netBank >= 0 ? 'text-indigo-950' : 'text-rose-600'}`}>
            {formatCurrency(metrics.netBank)}
          </p>
          <div className="flex items-center justify-between text-[10px] text-slate-500 mt-1 pt-1 border-t border-slate-100">
            <span className="text-emerald-700 font-semibold">In: {formatCurrency(metrics.totalBankIn)}</span>
            <span className="text-rose-700 font-semibold">Out: {formatCurrency(metrics.totalBankOut)}</span>
          </div>
        </div>

        {/* Total Inflows (Receipts) */}
        <div className="bg-emerald-50/70 p-4 rounded-2xl border border-emerald-200 shadow-xs">
          <div className="flex justify-between items-center text-emerald-800 text-[10px] font-bold uppercase">
            <span>Total Collections (In)</span>
            <TrendingUp className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-xl font-black text-emerald-950 mt-1">{formatCurrency(metrics.totalInflow)}</p>
          <p className="text-[10px] text-emerald-700 mt-0.5">Customer Advances + Balances</p>
        </div>

        {/* Total Outflows (Payments) */}
        <div className="bg-rose-50/70 p-4 rounded-2xl border border-rose-200 shadow-xs">
          <div className="flex justify-between items-center text-rose-800 text-[10px] font-bold uppercase">
            <span>Total Payments (Out)</span>
            <TrendingDown className="w-4 h-4 text-rose-600" />
          </div>
          <p className="text-xl font-black text-rose-950 mt-1">{formatCurrency(metrics.totalOutflow)}</p>
          <p className="text-[10px] text-rose-700 mt-0.5">Purchases + Operational Expenses</p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
          {/* Search Box */}
          <div className="sm:col-span-4 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by party, voucher no, ref, method..."
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>

          {/* Branch Filter */}
          <div className="sm:col-span-2">
            <select
              value={branchFilter}
              onChange={(e) => setBranchFilter(e.target.value)}
              className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-brand-500"
            >
              <option value="all">🏢 All Branches</option>
              {allBranches.map(b => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </div>

          {/* Department Filter */}
          <div className="sm:col-span-2">
            <select
              value={deptFilter}
              onChange={(e) => setDeptFilter(e.target.value)}
              className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-brand-500"
            >
              <option value="all">📂 All Depts</option>
              {allDepts.map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>

          {/* Date Period Selector */}
          <div className="sm:col-span-4">
            <select
              value={datePeriod}
              onChange={(e) => handlePeriodChange(e.target.value)}
              className="w-full py-2 px-3 bg-indigo-50/70 border border-indigo-200 rounded-xl text-xs font-bold text-indigo-950 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="sept2026">⭐ September 2026</option>
              <option value="specific">🎯 Specific Date (Exact Day)</option>
              <option value="dayOfMonth">📅 Day of Month (Filter All Months)</option>
              <option value="today">Today</option>
              <option value="thisMonth">This Month</option>
              <option value="lastMonth">Last Month</option>
              <option value="custom">Custom Date Range...</option>
              <option value="all">Full History (All Months)</option>
            </select>
          </div>
        </div>

        {/* Sub-toolbar for Specific Date */}
        {datePeriod === 'specific' && (
          <div className="flex items-center gap-3 pt-2 border-t border-slate-100 text-xs bg-indigo-50/60 p-2.5 rounded-xl animate-in fade-in duration-150">
            <Calendar className="w-4 h-4 text-indigo-600" />
            <span className="font-bold text-indigo-950">Pick Specific Date:</span>
            <input
              type="date"
              value={specificDate}
              onChange={(e) => {
                const val = e.target.value;
                setSpecificDate(val);
                setDateFrom(val);
                setDateTo(val);
              }}
              className="py-1 px-3 bg-white border border-indigo-200 rounded-lg text-xs font-mono font-bold text-slate-900 shadow-2xs"
            />
            {specificDate && (
              <span className="text-slate-500 text-[11px]">
                Showing transactions on <strong className="text-indigo-950">{formatDate(specificDate)}</strong>
              </span>
            )}
          </div>
        )}

        {/* Sub-toolbar for Day across All Months */}
        {datePeriod === 'dayOfMonth' && (
          <div className="flex items-center gap-3 pt-2 border-t border-slate-100 text-xs bg-amber-50/70 p-2.5 rounded-xl animate-in fade-in duration-150">
            <Calendar className="w-4 h-4 text-amber-600" />
            <span className="font-bold text-amber-950">Select Day of Month:</span>
            <select
              value={selectedDay}
              onChange={(e) => setSelectedDay(e.target.value)}
              className="py-1 px-3 bg-white border border-amber-300 rounded-lg text-xs font-mono font-bold text-amber-950 shadow-2xs"
            >
              {Array.from({ length: 31 }, (_, i) => i + 1).map(day => (
                <option key={day} value={String(day)}>Day {day} ({String(day).padStart(2, '0')})</option>
              ))}
            </select>
            <span className="text-amber-800 text-[11px] font-medium">
              Filters all records across <strong>August, September, October, and all other months</strong> on the <strong>{selectedDay}th</strong>!
            </span>
          </div>
        )}

        {/* Sub-toolbar for Custom Range */}
        {datePeriod === 'custom' && (
          <div className="flex items-center gap-2 pt-2 border-t border-slate-100 text-xs">
            <span className="font-semibold text-slate-600">From:</span>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="py-1 px-2 border border-slate-200 rounded-lg text-xs font-mono"
            />
            <span className="text-slate-400">to</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="py-1 px-2 border border-slate-200 rounded-lg text-xs font-mono"
            />
          </div>
        )}
      </div>

      {/* Main Voucher Table */}
      <div id="voucher-printable-table" className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse whitespace-nowrap text-xs">
            <thead>
              <tr className="bg-slate-50 text-slate-500 border-b border-slate-200 font-bold uppercase tracking-wider">
                <th className="px-4 py-3.5">Voucher & Date</th>
                <th className="px-4 py-3.5">Book & Method</th>
                <th className="px-4 py-3.5">Party / Beneficiary</th>
                <th className="px-4 py-3.5">Branch & Dept</th>
                <th className="px-4 py-3.5">Reference & Details</th>
                <th className="px-4 py-3.5 text-right text-emerald-700">Receipt / In (₹)</th>
                <th className="px-4 py-3.5 text-right text-rose-700">Payment / Out (₹)</th>
                <th className="px-4 py-3.5 text-center no-print">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
              {filteredVouchers.length === 0 ? (
                <tr>
                  <td colSpan="8" className="text-center py-14 text-slate-400">
                    <Receipt className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                    <p className="text-sm font-semibold text-slate-700">No voucher transactions found</p>
                    <p className="text-xs text-slate-400 mt-1">Try selecting a different date, day, branch, or ledger view.</p>
                  </td>
                </tr>
              ) : (
                paginatedVouchers.map(v => {
                  return (
                    <tr key={v.id} className="hover:bg-slate-50/80 transition-colors">
                      {/* Voucher No & Date */}
                      <td className="px-4 py-3.5">
                        <div className="font-mono font-bold text-slate-900">{v.voucherNo}</div>
                        <div className="font-mono text-[10px] text-slate-400">{formatDate(v.date)}</div>
                      </td>

                      {/* Book & Method */}
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-1.5">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            v.book === 'CASH'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-indigo-100 text-indigo-800'
                          }`}>
                            {v.book === 'CASH' ? '💵 Cash Book' : '🏦 Bank Book'}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono mt-0.5">{v.method}</div>
                      </td>

                      {/* Party */}
                      <td className="px-4 py-3.5">
                        <div className="font-bold text-slate-900">{v.party}</div>
                        {v.contact && <div className="text-[10px] font-mono text-slate-400">{v.contact}</div>}
                      </td>

                      {/* Branch & Dept */}
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-1">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            v.branch === 'RMD' ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'
                          }`}>
                            {v.branch}
                          </span>
                          <span className="text-[10px] text-slate-500 truncate max-w-[120px]">
                            {v.department}
                          </span>
                        </div>
                      </td>

                      {/* Reference & Particulars */}
                      <td className="px-4 py-3.5 max-w-xs">
                        <div className="font-semibold text-slate-800 truncate">{v.refNo}</div>
                        <div className="text-[10px] text-slate-400 truncate" title={v.description}>
                          {v.description}
                        </div>
                      </td>

                      {/* Inflow (Credit) */}
                      <td className="px-4 py-3.5 text-right font-mono font-bold text-emerald-700">
                        {v.inflow > 0 ? formatCurrency(v.inflow) : '-'}
                      </td>

                      {/* Outflow (Debit) */}
                      <td className="px-4 py-3.5 text-right font-mono font-bold text-rose-700">
                        {v.outflow > 0 ? formatCurrency(v.outflow) : '-'}
                      </td>

                      {/* Actions: Edit & Delete */}
                      <td className="px-4 py-3.5 text-center no-print">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => handleOpenEdit(v)}
                            className="p-1.5 text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded-lg transition-colors"
                            title="Edit / Alter Voucher"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>

                          <button
                            onClick={() => setDeletingVoucher(v)}
                            className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors"
                            title="Delete Voucher"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>

            {/* Table Footer Totals */}
            {filteredVouchers.length > 0 && (
              <tfoot className="bg-slate-100/90 font-bold border-t-2 border-slate-300">
                <tr>
                  <td colSpan="5" className="px-4 py-3 text-slate-900 text-right uppercase tracking-wider">
                    Total Inflow & Outflow:
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-emerald-800 font-extrabold text-sm">
                    {formatCurrency(metrics.totalInflow)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-rose-800 font-extrabold text-sm">
                    {formatCurrency(metrics.totalOutflow)}
                  </td>
                  <td className="no-print"></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {/* Pagination Toolbar */}
        {pageSize !== 'all' && totalPages > 1 && (
          <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600 no-print">
            <div className="flex items-center gap-2">
              <span>Showing {paginatedVouchers.length} of {filteredVouchers.length} vouchers</span>
              <div className="flex items-center gap-1 ml-4">
                <span>Rows:</span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(e.target.value === 'all' ? 'all' : parseInt(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="bg-slate-50 border border-slate-200 rounded px-1.5 py-0.5 font-bold"
                >
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                  <option value="all">All</option>
                </select>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className="px-2.5 py-1 rounded border border-slate-200 hover:bg-slate-50 disabled:opacity-40"
              >
                Previous
              </button>

              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let p = i + 1;
                if (totalPages > 5 && currentPage > 3) {
                  p = currentPage - 2 + i;
                  if (p > totalPages) p = totalPages - (4 - i);
                }
                return (
                  <button
                    key={p}
                    onClick={() => handlePageChange(p)}
                    className={`w-7 h-7 rounded font-mono font-bold ${
                      currentPage === p
                        ? 'bg-indigo-600 text-white'
                        : 'border border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {p}
                  </button>
                );
              })}

              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="px-2.5 py-1 rounded border border-slate-200 hover:bg-slate-50 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Edit Voucher Modal */}
      {editingVoucher && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50">
              <div className="flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-indigo-600" />
                <h3 className="font-bold text-slate-900">
                  Alter Voucher: <span className="font-mono text-indigo-700">{editingVoucher.voucherNo}</span>
                </h3>
              </div>
              <button 
                onClick={() => setEditingVoucher(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="p-5 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 font-bold mb-1">Voucher No</label>
                  <input
                    type="text"
                    value={formVoucherNo}
                    onChange={(e) => setFormVoucherNo(e.target.value)}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-slate-700 font-bold"
                  />
                </div>

                <div>
                  <label className="block text-slate-600 font-bold mb-1">Voucher Date *</label>
                  <input
                    type="date"
                    required
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    className="w-full p-2 bg-white border border-slate-200 rounded-xl font-mono font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 font-bold mb-1">Type</label>
                  <select
                    value={formType}
                    onChange={(e) => setFormType(e.target.value)}
                    className="w-full p-2 bg-white border border-slate-200 rounded-xl font-bold"
                  >
                    <option value="RECEIPT">📥 Receipt (Money In)</option>
                    <option value="PAYMENT">📤 Payment (Money Out)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-600 font-bold mb-1">Account Book</label>
                  <select
                    value={formBook}
                    onChange={(e) => setFormBook(e.target.value)}
                    className="w-full p-2 bg-white border border-slate-200 rounded-xl font-bold"
                  >
                    <option value="BANK">🏦 Bank Book</option>
                    <option value="CASH">💵 Cash Book</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 font-bold mb-1">Payment Method / Bank *</label>
                  <select
                    value={formMethod}
                    onChange={(e) => setFormMethod(e.target.value)}
                    className="w-full p-2 bg-white border border-slate-200 rounded-xl font-semibold"
                  >
                    {(paymentMethods || ['CASH', 'GPAY- SBI', 'GPAY- IDBI', 'BANK TRANSFER', 'CHEQUE']).map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-600 font-bold mb-1">Voucher Amount (₹) *</label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={formAmount}
                    onChange={(e) => setFormAmount(e.target.value)}
                    className="w-full p-2 bg-white border border-slate-200 rounded-xl font-mono font-black text-slate-900 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-600 font-bold mb-1">Party / Beneficiary</label>
                <input
                  type="text"
                  value={formParty}
                  onChange={(e) => setFormParty(e.target.value)}
                  className="w-full p-2 bg-white border border-slate-200 rounded-xl font-bold text-slate-800"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 font-bold mb-1">Branch</label>
                  <select
                    value={formBranch}
                    onChange={(e) => setFormBranch(e.target.value)}
                    className="w-full p-2 bg-white border border-slate-200 rounded-xl font-semibold"
                  >
                    {allBranches.map(b => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-600 font-bold mb-1">Department</label>
                  <select
                    value={formDept}
                    onChange={(e) => setFormDept(e.target.value)}
                    className="w-full p-2 bg-white border border-slate-200 rounded-xl font-semibold"
                  >
                    {allDepts.map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-600 font-bold mb-1">Particulars / Description</label>
                <textarea
                  rows="2"
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  className="w-full p-2 bg-white border border-slate-200 rounded-xl"
                  placeholder="Notes, transaction reference, or remarks..."
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingVoucher(null)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white rounded-xl font-bold shadow-sm"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingVoucher && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="p-5 text-center">
              <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 mx-auto flex items-center justify-center mb-3">
                <AlertTriangle className="w-6 h-6" />
              </div>

              <h3 className="text-base font-bold text-slate-900">Delete Voucher?</h3>
              <p className="text-xs text-slate-500 mt-1">
                Are you sure you want to remove Voucher <strong className="text-slate-800 font-mono">{deletingVoucher.voucherNo}</strong>?
              </p>

              <div className="bg-rose-50/70 border border-rose-200 rounded-xl p-3 my-4 text-left text-xs space-y-1">
                <div className="flex justify-between font-medium">
                  <span className="text-slate-500">Party:</span>
                  <span className="font-bold text-slate-800">{deletingVoucher.party}</span>
                </div>
                <div className="flex justify-between font-medium">
                  <span className="text-slate-500">Amount:</span>
                  <span className="font-bold font-mono text-rose-700">
                    {formatCurrency(deletingVoucher.inflow || deletingVoucher.outflow)}
                  </span>
                </div>
                <div className="flex justify-between font-medium">
                  <span className="text-slate-500">Account Book:</span>
                  <span className="font-bold text-slate-800">{deletingVoucher.book}</span>
                </div>
              </div>

              <p className="text-[11px] text-slate-400">
                Removing this payment voucher will automatically update and restore the outstanding balance on the linked invoice/bill.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 p-4 bg-slate-50 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setDeletingVoucher(null)}
                className="px-4 py-2 text-slate-600 hover:bg-slate-200 rounded-xl font-bold text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white rounded-xl font-bold text-xs shadow-sm"
              >
                Yes, Delete Voucher
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Standalone Voucher Modal */}
      {showNewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50">
              <div className="flex items-center gap-2">
                <Plus className="w-5 h-5 text-brand-600" />
                <h3 className="font-bold text-slate-900">Record New Payment / Receipt Voucher</h3>
              </div>
              <button 
                onClick={() => setShowNewModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveNew} className="p-5 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 font-bold mb-1">Voucher No</label>
                  <input
                    type="text"
                    value={formVoucherNo}
                    onChange={(e) => setFormVoucherNo(e.target.value)}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-slate-700 font-bold"
                  />
                </div>

                <div>
                  <label className="block text-slate-600 font-bold mb-1">Date *</label>
                  <input
                    type="date"
                    required
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    className="w-full p-2 bg-white border border-slate-200 rounded-xl font-mono font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 font-bold mb-1">Voucher Type *</label>
                  <select
                    value={formType}
                    onChange={(e) => {
                      setFormType(e.target.value);
                      if (e.target.value === 'RECEIPT') setFormRefNo('Direct Receipt');
                      else setFormRefNo('Direct Payment');
                    }}
                    className="w-full p-2 bg-white border border-slate-200 rounded-xl font-bold"
                  >
                    <option value="RECEIPT">📥 Receipt Voucher (Money In)</option>
                    <option value="PAYMENT">📤 Payment Voucher (Money Out)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-600 font-bold mb-1">Account Book *</label>
                  <select
                    value={formBook}
                    onChange={(e) => setFormBook(e.target.value)}
                    className="w-full p-2 bg-white border border-slate-200 rounded-xl font-bold"
                  >
                    <option value="BANK">🏦 Bank Book</option>
                    <option value="CASH">💵 Cash Book</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 font-bold mb-1">Payment Method / Bank *</label>
                  <select
                    value={formMethod}
                    onChange={(e) => setFormMethod(e.target.value)}
                    className="w-full p-2 bg-white border border-slate-200 rounded-xl font-semibold"
                  >
                    {(paymentMethods || ['CASH', 'GPAY- SBI', 'GPAY- IDBI', 'BANK TRANSFER', 'CHEQUE']).map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-600 font-bold mb-1">Amount (₹) *</label>
                  <input
                    type="number"
                    step="any"
                    required
                    placeholder="0.00"
                    value={formAmount}
                    onChange={(e) => setFormAmount(e.target.value)}
                    className="w-full p-2 bg-white border border-slate-200 rounded-xl font-mono font-black text-slate-900 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-600 font-bold mb-1">Party / Beneficiary / Account Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Capital Account, Cash Withdrawal, Customer Name, Vendor Name..."
                  value={formParty}
                  onChange={(e) => setFormParty(e.target.value)}
                  className="w-full p-2 bg-white border border-slate-200 rounded-xl font-bold text-slate-800"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 font-bold mb-1">Branch</label>
                  <select
                    value={formBranch}
                    onChange={(e) => setFormBranch(e.target.value)}
                    className="w-full p-2 bg-white border border-slate-200 rounded-xl font-semibold"
                  >
                    {allBranches.map(b => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-600 font-bold mb-1">Department</label>
                  <select
                    value={formDept}
                    onChange={(e) => setFormDept(e.target.value)}
                    className="w-full p-2 bg-white border border-slate-200 rounded-xl font-semibold"
                  >
                    {allDepts.map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-600 font-bold mb-1">Reference No / Purpose</label>
                <input
                  type="text"
                  value={formRefNo}
                  onChange={(e) => setFormRefNo(e.target.value)}
                  placeholder="e.g. Cheque No, Ref ID, Invoice No..."
                  className="w-full p-2 bg-white border border-slate-200 rounded-xl"
                />
              </div>

              <div>
                <label className="block text-slate-600 font-bold mb-1">Particulars / Description</label>
                <textarea
                  rows="2"
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="Details of the payment or receipt..."
                  className="w-full p-2 bg-white border border-slate-200 rounded-xl"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowNewModal(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-brand-600 hover:bg-brand-700 active:bg-brand-800 text-white rounded-xl font-bold shadow-sm"
                >
                  Create Voucher
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
