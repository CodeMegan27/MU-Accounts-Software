import React, { useMemo, useState, useRef, useEffect } from 'react';
import { useData } from '../../context/DataContext';
import { useAuth } from '../../context/AuthContext';
import { useSettings } from '../../context/SettingsContext';
import { useToast } from '../../context/ToastContext';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { exportVendorSpendingToExcel } from '../../utils/exportUtils';
import { 
  ShoppingCart, 
  Users, 
  Receipt, 
  AlertCircle, 
  TrendingUp, 
  Plus, 
  ArrowUpRight,
  Eye,
  CheckCircle2,
  Clock,
  PieChart as PieChartIcon,
  Printer,
  Download,
  FileSpreadsheet,
  X,
  Building2,
  ArrowLeft,
  ArrowDownLeft,
  Search,
  ChevronLeft,
  ChevronRight,
  Filter,
  Phone,
  AlertTriangle,
  Calendar,
  CreditCard,
  Lock,
  Crown,
  Layers
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { Bar, Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
);

export default function Dashboard({ onNavigate, onViewBill, onOpenCreateBill, onViewSale, onRecordPayment }) {
  const { bills = [], vendors = [], expenses = [], sales = [], branches = [], departments = [] } = useData();
  const { currentTier, tierConfig, isDeveloper } = useAuth();
  const { profile } = useSettings();
  const { showToast } = useToast();
  const [showVendorPrintModal, setShowVendorPrintModal] = useState(false);
  const pieChartRef = useRef(null);
  const salesPieChartRef = useRef(null);

  // Dynamic Multi-Branch & Department Filters
  const [selectedBranch, setSelectedBranch] = useState('ALL');
  const [selectedDept, setSelectedDept] = useState('ALL');

  // Monthwise Filter for Vendor Spending Distribution
  const [vendorMonthFilter, setVendorMonthFilter] = useState('ALL');

  // Monthwise, Dimension Filter for Sales Pie Chart
  const [salesMonthFilter, setSalesMonthFilter] = useState('ALL');
  const [salesDimension, setSalesDimension] = useState('branch'); // 'branch' or 'department'

  // Filtered Collections based on selectedBranch and selectedDept
  const branchFilteredSales = useMemo(() => {
    return (sales || []).filter(s => {
      if (selectedBranch !== 'ALL' && (s.branch || 'KLK').toUpperCase() !== selectedBranch.toUpperCase()) return false;
      if (selectedDept !== 'ALL' && (s.department || '').toUpperCase() !== selectedDept.toUpperCase()) return false;
      return true;
    });
  }, [sales, selectedBranch, selectedDept]);

  const branchFilteredBills = useMemo(() => {
    return (bills || []).filter(b => {
      if (selectedBranch !== 'ALL' && (b.branch || 'KLK').toUpperCase() !== selectedBranch.toUpperCase()) return false;
      if (selectedDept !== 'ALL' && (b.department || '').toUpperCase() !== selectedDept.toUpperCase()) return false;
      return true;
    });
  }, [bills, selectedBranch, selectedDept]);

  const branchFilteredExpenses = useMemo(() => {
    return (expenses || []).filter(e => {
      if (selectedBranch !== 'ALL' && (e.branch || 'KLK').toUpperCase() !== selectedBranch.toUpperCase()) return false;
      return true;
    });
  }, [expenses, selectedBranch]);

  // Accounts Receivable (Customer Pending Balances) State
  const [receivableSearch, setReceivableSearch] = useState('');
  const [agingFilter, setAgingFilter] = useState('all'); // 'all', 'gt25', '15_24', '7_14', 'lt7'
  const [receivableSort, setReceivableSort] = useState('balance_desc'); // 'balance_desc', 'days_desc', 'date_desc', 'name_asc'
  const [receivablePage, setReceivablePage] = useState(1);
  const receivablePageSize = 10;

  // Customer Receivables calculation (Outstanding balances from sales/estimates)
  const receivablesData = useMemo(() => {
    if (!branchFilteredSales || !Array.isArray(branchFilteredSales)) {
      return { 
        list: [], 
        totalReceivable: 0, 
        count: 0, 
        criticalCount: 0, 
        criticalAmount: 0, 
        avgDays: 0, 
        gt25Count: 0, 
        g1524Count: 0, 
        g714Count: 0, 
        lt7Count: 0 
      };
    }

    const now = new Date();
    let totalReceivable = 0;
    let criticalCount = 0;
    let criticalAmount = 0;
    let totalDays = 0;
    let gt25Count = 0;
    let g1524Count = 0;
    let g714Count = 0;
    let lt7Count = 0;

    const list = branchFilteredSales
      .filter(s => {
        const bal = parseFloat(s.balanceAmount);
        return !isNaN(bal) && bal > 0.01;
      })
      .map(s => {
        const bal = parseFloat(s.balanceAmount) || 0;
        const total = parseFloat(s.grandTotal || s.totalAmount || s.finalAmount) || 0;
        const paid = parseFloat(s.paidAmount || s.advanceAmount) || 0;
        const dateStr = s.orderDate || s.invDate || s.date || '';
        const phone = s.contact || s.customerPhone || s.mobile || s.phone || s.contactNo || '';

        let daysPending = 0;
        if (dateStr) {
          const oDate = new Date(dateStr);
          if (!isNaN(oDate.getTime())) {
            const diffMs = now.getTime() - oDate.getTime();
            daysPending = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
          }
        }

        totalReceivable += bal;
        totalDays += daysPending;

        if (daysPending >= 25) {
          gt25Count++;
          criticalCount++;
          criticalAmount += bal;
        } else if (daysPending >= 15) {
          g1524Count++;
        } else if (daysPending >= 7) {
          g714Count++;
        } else {
          lt7Count++;
        }

        return {
          ...s,
          customerPhone: phone,
          contact: phone,
          phone: phone,
          balance: bal,
          grandTotalNum: total,
          paidAmountNum: paid,
          daysPending,
          estNumber: s.estNo || s.orderNo || s.invNo || ('#' + s.id)
        };
      });

    const avgDays = list.length > 0 ? Math.round(totalDays / list.length) : 0;

    return {
      list,
      totalReceivable,
      count: list.length,
      criticalCount,
      criticalAmount,
      avgDays,
      gt25Count,
      g1524Count,
      g714Count,
      lt7Count
    };
  }, [branchFilteredSales]);

  // Filtered & Sorted Receivables
  const filteredReceivables = useMemo(() => {
    let result = [...receivablesData.list];

    if (receivableSearch.trim()) {
      const q = receivableSearch.toLowerCase().trim();
      result = result.filter(r => 
        (r.customerName && r.customerName.toLowerCase().includes(q)) ||
        (r.estNumber && r.estNumber.toLowerCase().includes(q)) ||
        (r.customerPhone && String(r.customerPhone).includes(q)) ||
        (r.contact && String(r.contact).includes(q)) ||
        (r.phone && String(r.phone).includes(q)) ||
        (r.branch && r.branch.toLowerCase().includes(q))
      );
    }

    if (agingFilter === 'gt25') {
      result = result.filter(r => r.daysPending >= 25);
    } else if (agingFilter === '15_24') {
      result = result.filter(r => r.daysPending >= 15 && r.daysPending <= 24);
    } else if (agingFilter === '7_14') {
      result = result.filter(r => r.daysPending >= 7 && r.daysPending <= 14);
    } else if (agingFilter === 'lt7') {
      result = result.filter(r => r.daysPending < 7);
    }

    result.sort((a, b) => {
      if (receivableSort === 'balance_desc') return b.balance - a.balance;
      if (receivableSort === 'days_desc') return b.daysPending - a.daysPending;
      if (receivableSort === 'name_asc') return (a.customerName || '').localeCompare(b.customerName || '');
      if (receivableSort === 'date_desc') {
        const dateA = new Date(a.orderDate || a.invDate || a.date || 0);
        const dateB = new Date(b.orderDate || b.invDate || b.date || 0);
        return dateB - dateA;
      }
      return 0;
    });

    return result;
  }, [receivablesData.list, receivableSearch, agingFilter, receivableSort]);

  const totalReceivablePages = Math.max(1, Math.ceil(filteredReceivables.length / receivablePageSize));
  const paginatedReceivables = useMemo(() => {
    const start = (receivablePage - 1) * receivablePageSize;
    return filteredReceivables.slice(start, start + receivablePageSize);
  }, [filteredReceivables, receivablePage, receivablePageSize]);

  // Reset page when search or filter changes
  useEffect(() => {
    setReceivablePage(1);
  }, [receivableSearch, agingFilter, receivableSort]);

  // Export Receivables to Excel
  const handleExportReceivablesExcel = () => {
    if (filteredReceivables.length === 0) {
      showToast('No receivable records to export', 'error');
      return;
    }
    try {
      const rows = filteredReceivables.map((r, i) => ({
        'S.No': i + 1,
        'Estimate / Ref #': r.estNumber,
        'Customer Name': r.customerName || 'N/A',
        'Mobile Number': r.customerPhone || r.contact || r.phone || 'N/A',
        'Branch / Department': r.branch || '',
        'Order Date': r.orderDate || r.invDate || r.date || '',
        'Days Pending': r.daysPending,
        'Aging Category': r.daysPending >= 25 ? '> 25 Days (Critical)' : r.daysPending >= 15 ? '15-24 Days' : r.daysPending >= 7 ? '7-14 Days' : '< 7 Days',
        'Total Order (₹)': r.grandTotalNum,
        'Paid Amount (₹)': r.paidAmountNum,
        'Pending Balance (₹)': r.balance
      }));

      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Receivables');
      XLSX.writeFile(wb, `Accounts_Receivable_${new Date().toISOString().slice(0, 10)}.xlsx`);
      showToast(`Exported ${filteredReceivables.length} receivable records to Excel`, 'success');
    } catch (e) {
      console.error(e);
      showToast('Failed to export receivables', 'error');
    }
  };

  // Close print modal on Escape key press
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setShowVendorPrintModal(false);
      }
    };
    if (showVendorPrintModal) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showVendorPrintModal]);

  // Compute Dashboard Metrics
  const stats = useMemo(() => {
    let totalPurchases = 0;
    let totalPaid = 0;
    let totalOutstanding = 0;
    const vendorMap = {};
    const monthlyMap = {};

    branchFilteredBills.forEach(bill => {
      const gTotal = parseFloat(bill.grandTotal) || 0;
      const pAmt = parseFloat(bill.paidAmount) || 0;
      const bal = bill.balanceAmount !== undefined ? parseFloat(bill.balanceAmount) : (gTotal - pAmt);

      totalPurchases += gTotal;
      totalPaid += pAmt;
      totalOutstanding += (bal > 0 ? bal : 0);

      // Top Vendors aggregation
      const vName = bill.vendorName || 'Unknown Vendor';
      vendorMap[vName] = (vendorMap[vName] || 0) + gTotal;

      // Monthly aggregation
      let mKey = 'Unknown';
      if (bill.date && typeof bill.date === 'string' && bill.date.length >= 7) {
        mKey = bill.date.substring(0, 7);
      }
      monthlyMap[mKey] = (monthlyMap[mKey] || 0) + gTotal;
    });

    let totalExpenses = 0;
    branchFilteredExpenses.forEach(e => {
      totalExpenses += (parseFloat(e.amount) || 0);
    });

    // Top 5 Vendors sorted
    const topVendors = Object.entries(vendorMap)
      .map(([name, amount]) => ({ name, amount, percent: totalPurchases > 0 ? (amount / totalPurchases) * 100 : 0 }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);

    return {
      totalPurchases,
      totalPaid,
      totalOutstanding,
      totalExpenses,
      vendorCount: vendors.length,
      monthlyMap,
      topVendors,
      recentBills: branchFilteredBills.slice(0, 5)
    };
  }, [branchFilteredBills, vendors, branchFilteredExpenses]);

  // Chart Configuration for Monthly Bar Chart
  const chartData = useMemo(() => {
    const sortedKeys = Object.keys(stats.monthlyMap).sort();
    const labels = sortedKeys.map(k => {
      if (k === 'Unknown') return 'Unknown';
      const d = new Date(k + '-01');
      return d.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
    });
    const values = sortedKeys.map(k => stats.monthlyMap[k]);

    return {
      labels: labels.length > 0 ? labels : ['No Data'],
      datasets: [
        {
          label: 'Purchases (₹)',
          data: values.length > 0 ? values : [0],
          backgroundColor: '#0284c7',
          borderRadius: 8,
          hoverBackgroundColor: '#0369a1',
        }
      ]
    };
  }, [stats.monthlyMap]);

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (context) => ` Purchases: ₹${context.raw.toLocaleString('en-IN')}`
        }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          callback: (value) => `₹${(value / 1000).toFixed(0)}k`
        },
        grid: { color: '#f1f5f9' }
      },
      x: {
        grid: { display: false }
      }
    }
  };

  // Available Month Keys for Purchases
  const availablePurchaseMonths = useMemo(() => {
    const monthsSet = new Set();
    branchFilteredBills.forEach(b => {
      if (b.date && typeof b.date === 'string' && b.date.length >= 7) {
        monthsSet.add(b.date.substring(0, 7));
      }
    });
    return Array.from(monthsSet).sort().reverse();
  }, [branchFilteredBills]);

  // Available Month Keys for Sales
  const availableSalesMonths = useMemo(() => {
    const monthsSet = new Set();
    branchFilteredSales.forEach(s => {
      const d = s.orderDate || s.invDate || s.date;
      if (d && typeof d === 'string' && d.length >= 7) {
        monthsSet.add(d.substring(0, 7));
      }
    });
    return Array.from(monthsSet).sort().reverse();
  }, [branchFilteredSales]);

  // Vendor Spend Distribution for Doughnut / Pie Chart (Filtered by Month)
  const vendorDistribution = useMemo(() => {
    let totalPurchases = 0;
    const vendorMap = {};

    const filteredBills = vendorMonthFilter === 'ALL'
      ? branchFilteredBills
      : branchFilteredBills.filter(b => b.date && typeof b.date === 'string' && b.date.startsWith(vendorMonthFilter));

    filteredBills.forEach(bill => {
      const gTotal = parseFloat(bill.grandTotal) || 0;
      totalPurchases += gTotal;
      const vName = bill.vendorName || 'Unknown Vendor';
      if (!vendorMap[vName]) {
        vendorMap[vName] = { name: vName, amount: 0, billsCount: 0 };
      }
      vendorMap[vName].amount += gTotal;
      vendorMap[vName].billsCount += 1;
    });

    const sorted = Object.values(vendorMap)
      .map(item => ({
        ...item,
        percent: totalPurchases > 0 ? (item.amount / totalPurchases) * 100 : 0
      }))
      .sort((a, b) => b.amount - a.amount);

    const palette = [
      '#0284c7', // Sky 600
      '#10b981', // Emerald 500
      '#f59e0b', // Amber 500
      '#8b5cf6', // Violet 500
      '#ec4899', // Pink 500
      '#06b6d4', // Cyan 500
      '#64748b', // Slate 500 for Others
    ];

    let chartLabels = [];
    let chartValues = [];
    let chartColors = [];

    if (sorted.length === 0) {
      chartLabels = ['No Purchases Recorded'];
      chartValues = [1];
      chartColors = ['#e2e8f0'];
    } else if (sorted.length <= 6) {
      chartLabels = sorted.map(v => v.name);
      chartValues = sorted.map(v => v.amount);
      chartColors = palette.slice(0, sorted.length);
    } else {
      const top5 = sorted.slice(0, 5);
      const remaining = sorted.slice(5);
      const remainingTotal = remaining.reduce((sum, item) => sum + item.amount, 0);

      chartLabels = [...top5.map(v => v.name), `Other Suppliers (${remaining.length})`];
      chartValues = [...top5.map(v => v.amount), remainingTotal];
      chartColors = [...palette.slice(0, 5), '#64748b'];
    }

    return {
      totalPurchases,
      allVendors: sorted,
      chartData: {
        labels: chartLabels,
        datasets: [
          {
            data: chartValues,
            backgroundColor: chartColors,
            borderColor: '#ffffff',
            borderWidth: 2,
            hoverOffset: 8
          }
        ]
      }
    };
  }, [branchFilteredBills, vendorMonthFilter]);

  // Sales Distribution Pie Chart (Branchwise & Departmentwise + Monthwise Filtered)
  const salesDistribution = useMemo(() => {
    let totalSales = 0;
    const groupMap = {};

    const filteredSales = salesMonthFilter === 'ALL'
      ? branchFilteredSales
      : branchFilteredSales.filter(s => {
          const d = s.orderDate || s.invDate || s.date;
          return d && typeof d === 'string' && d.startsWith(salesMonthFilter);
        });

    filteredSales.forEach(s => {
      const amt = parseFloat(s.finalAmount) || parseFloat(s.subtotal) || 0;
      totalSales += amt;

      const groupName = salesDimension === 'branch'
        ? (s.branch ? String(s.branch).toUpperCase().trim() : 'UNSPECIFIED')
        : (s.department ? String(s.department).toUpperCase().trim() : 'GENERAL');

      if (!groupMap[groupName]) {
        groupMap[groupName] = { name: groupName, amount: 0, ordersCount: 0 };
      }
      groupMap[groupName].amount += amt;
      groupMap[groupName].ordersCount += 1;
    });

    const sorted = Object.values(groupMap)
      .map(item => ({
        ...item,
        percent: totalSales > 0 ? (item.amount / totalSales) * 100 : 0
      }))
      .sort((a, b) => b.amount - a.amount);

    const palette = [
      '#10b981', // Emerald 500
      '#6366f1', // Indigo 500
      '#f59e0b', // Amber 500
      '#06b6d4', // Cyan 500
      '#ec4899', // Pink 500
      '#8b5cf6', // Violet 500
      '#14b8a6', // Teal 500
      '#f97316', // Orange 500
      '#64748b'  // Slate 500
    ];

    let chartLabels = [];
    let chartValues = [];
    let chartColors = [];

    if (sorted.length === 0) {
      chartLabels = ['No Sales Recorded'];
      chartValues = [1];
      chartColors = ['#e2e8f0'];
    } else if (sorted.length <= 7) {
      chartLabels = sorted.map(g => g.name);
      chartValues = sorted.map(g => g.amount);
      chartColors = palette.slice(0, sorted.length);
    } else {
      const top6 = sorted.slice(0, 6);
      const remaining = sorted.slice(6);
      const remainingTotal = remaining.reduce((sum, item) => sum + item.amount, 0);

      chartLabels = [...top6.map(g => g.name), `Other (${remaining.length})`];
      chartValues = [...top6.map(g => g.amount), remainingTotal];
      chartColors = [...palette.slice(0, 6), '#64748b'];
    }

    return {
      totalSales,
      allGroups: sorted,
      chartData: {
        labels: chartLabels,
        datasets: [
          {
            data: chartValues,
            backgroundColor: chartColors,
            borderColor: '#ffffff',
            borderWidth: 2,
            hoverOffset: 8
          }
        ]
      }
    };
  }, [branchFilteredSales, salesMonthFilter, salesDimension]);


  const pieOptions = {
    responsive: true,
    maintainAspectRatio: false,
    layout: {
      padding: {
        top: 30,
        bottom: 30,
        left: 125,
        right: 125
      }
    },
    plugins: {
      legend: {
        display: false // Directly identified via slice arrows & vendor labels
      },
      tooltip: {
        callbacks: {
          label: (context) => {
            const val = context.raw || 0;
            const pct = vendorDistribution.totalPurchases > 0 
              ? ((val / vendorDistribution.totalPurchases) * 100).toFixed(1)
              : 0;
            return ` ${context.label}: ₹${val.toLocaleString('en-IN')} (${pct}%)`;
          }
        }
      }
    },
    cutout: 0 // True Pie Chart with direct slice arrows
  };

  // Custom Chart.js Plugin: Draws clear arrows and vendor names directly pointing to each slice
  const sliceArrowLabelsPlugin = useMemo(() => ({
    id: 'sliceArrowLabels',
    afterDraw(chart) {
      const { ctx } = chart;
      const meta = chart.getDatasetMeta(0);
      if (!meta || !meta.data || meta.data.length === 0) return;

      const dataset = chart.data.datasets[0];
      const total = dataset.data.reduce((acc, curr) => acc + (typeof curr === 'number' ? curr : 0), 0);
      if (total <= 0) return;

      const activeSlices = [];

      meta.data.forEach((element, index) => {
        const value = dataset.data[index] || 0;
        if (value <= 0) return;
        const label = chart.data.labels[index] || '';
        if (label === 'No Purchases Recorded') return;

        const percentage = ((value / total) * 100).toFixed(1);
        const { startAngle, endAngle, outerRadius, x, y } = element;
        const angle = (startAngle + endAngle) / 2;

        const edgeX = x + Math.cos(angle) * outerRadius;
        const edgeY = y + Math.sin(angle) * outerRadius;

        const isRight = Math.cos(angle) >= 0;
        const elbowRadius = outerRadius + 22;
        const elbowX = x + Math.cos(angle) * elbowRadius;
        const elbowY = y + Math.sin(angle) * elbowRadius;

        activeSlices.push({
          index,
          label,
          value,
          percentage,
          edgeX,
          edgeY,
          elbowX,
          elbowY,
          targetY: elbowY,
          isRight,
          angle,
          sliceColor: dataset.backgroundColor[index] || '#0284c7'
        });
      });

      if (activeSlices.length === 0) return;

      // Group into right and left side for anti-collision vertical spacing
      const rightSide = activeSlices.filter(s => s.isRight);
      const leftSide = activeSlices.filter(s => !s.isRight);

      const resolveCollisions = (items) => {
        items.sort((a, b) => a.targetY - b.targetY);
        const minGap = 32;
        for (let i = 1; i < items.length; i++) {
          if (items[i].targetY - items[i - 1].targetY < minGap) {
            items[i].targetY = items[i - 1].targetY + minGap;
          }
        }
      };

      resolveCollisions(rightSide);
      resolveCollisions(leftSide);

      ctx.save();

      activeSlices.forEach(item => {
        const { edgeX, edgeY, elbowX, targetY, isRight, label, percentage, value, sliceColor } = item;
        const armLength = 24;
        const endX = elbowX + (isRight ? armLength : -armLength);
        const endY = targetY;

        // 1. Draw pointer line (from slice edge -> elbow -> horizontal arm)
        ctx.beginPath();
        ctx.strokeStyle = '#475569';
        ctx.lineWidth = 1.5;
        ctx.moveTo(edgeX, edgeY);
        ctx.lineTo(elbowX, endY);
        ctx.lineTo(endX, endY);
        ctx.stroke();

        // 2. Draw crisp Arrow Head at (edgeX, edgeY) pointing inward directly into the slice
        const dx = edgeX - elbowX;
        const dy = edgeY - endY;
        const dist = Math.hypot(dx, dy) || 1;
        const ux = dx / dist;
        const uy = dy / dist;
        const headLen = 7;
        const headWidth = 4;

        ctx.beginPath();
        ctx.moveTo(edgeX, edgeY);
        ctx.lineTo(edgeX - headLen * ux - headWidth * -uy, edgeY - headLen * uy - headWidth * ux);
        ctx.lineTo(edgeX - headLen * ux + headWidth * -uy, edgeY - headLen * uy + headWidth * ux);
        ctx.closePath();
        ctx.fillStyle = '#0f172a';
        ctx.fill();

        // Indicator dot at elbow
        ctx.beginPath();
        ctx.arc(elbowX, endY, 2, 0, Math.PI * 2);
        ctx.fillStyle = sliceColor;
        ctx.fill();

        // 3. Draw Vendor Label & Percent with crisp background pill
        ctx.textAlign = isRight ? 'left' : 'right';
        ctx.textBaseline = 'middle';
        const textX = endX + (isRight ? 6 : -6);

        const displayName = label.length > 20 ? label.substring(0, 18) + '...' : label;
        const subText = `${percentage}% (₹${Math.round(value).toLocaleString('en-IN')})`;

        ctx.font = 'bold 11px Inter, system-ui, sans-serif';
        const nameWidth = ctx.measureText(displayName).width;
        ctx.font = '600 10px Inter, system-ui, sans-serif';
        const subWidth = ctx.measureText(subText).width;
        const pillWidth = Math.max(nameWidth, subWidth) + 10;
        const pillHeight = 28;
        const pillX = isRight ? textX - 4 : textX - pillWidth + 4;
        const pillY = endY - 14;

        // Subtle background pill
        ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
        ctx.strokeStyle = '#cbd5e1';
        ctx.lineWidth = 1;
        ctx.beginPath();
        if (ctx.roundRect) {
          ctx.roundRect(pillX, pillY, pillWidth, pillHeight, 4);
        } else {
          ctx.rect(pillX, pillY, pillWidth, pillHeight);
        }
        ctx.fill();
        ctx.stroke();

        // Line 1: Vendor Name (Bold Slate 900)
        ctx.font = 'bold 11px Inter, system-ui, sans-serif';
        ctx.fillStyle = '#0f172a';
        ctx.fillText(displayName, textX, endY - 6);

        // Line 2: Percentage & Amount
        ctx.font = '600 10px Inter, system-ui, sans-serif';
        ctx.fillStyle = '#0284c7';
        ctx.fillText(subText, textX, endY + 7);
      });

      ctx.restore();
    }
  }), []);

  const handleExportPiePNG = () => {
    if (!pieChartRef.current) return;
    const canvas = pieChartRef.current.canvas;
    if (!canvas) return;
    try {
      const url = canvas.toDataURL('image/png', 1.0);
      const link = document.createElement('a');
      link.download = `Vendor_Spending_Share_${new Date().toISOString().slice(0, 10)}.png`;
      link.href = url;
      link.click();
      showToast('Vendor pie chart downloaded as PNG image', 'success');
    } catch (e) {
      showToast('Failed to export chart image', 'error');
    }
  };

  const handleExportPieExcel = () => {
    if (!vendorDistribution.allVendors || vendorDistribution.allVendors.length === 0) {
      showToast('No vendor spending data available to export', 'error');
      return;
    }
    const ok = exportVendorSpendingToExcel(vendorDistribution.allVendors);
    if (ok) showToast('Vendor spending analysis exported to Excel', 'success');
  };

  const handleExportSalesPiePNG = () => {
    if (!salesPieChartRef.current) return;
    const canvas = salesPieChartRef.current.canvas;
    if (!canvas) return;
    try {
      const url = canvas.toDataURL('image/png', 1.0);
      const link = document.createElement('a');
      link.download = `Sales_Distribution_${salesDimension}_${new Date().toISOString().slice(0, 10)}.png`;
      link.href = url;
      link.click();
      showToast(`Sales (${salesDimension}) pie chart downloaded as PNG image`, 'success');
    } catch (e) {
      showToast('Failed to export chart image', 'error');
    }
  };

  const handleExportSalesPieExcel = () => {
    if (!salesDistribution.allGroups || salesDistribution.allGroups.length === 0) {
      showToast('No sales distribution data available to export', 'error');
      return;
    }
    try {
      const rows = salesDistribution.allGroups.map((g, i) => ({
        "Rank": i + 1,
        [salesDimension === 'branch' ? "Branch Name" : "Department Name"]: g.name,
        "Total Turnover (₹)": Number((g.amount || 0).toFixed(2)),
        "Share (%)": Number((g.percent || 0).toFixed(2)) + "%",
        "Orders Count": g.ordersCount || 0
      }));

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(rows);
      XLSX.utils.book_append_sheet(wb, ws, salesDimension === 'branch' ? "Branch Sales" : "Dept Sales");
      XLSX.writeFile(wb, `Sales_${salesDimension}_Distribution_${new Date().toISOString().slice(0, 10)}.xlsx`);
      showToast(`Exported sales distribution (${salesDimension}) to Excel`, 'success');
    } catch (e) {
      showToast('Failed to export sales distribution to Excel', 'error');
    }
  };


  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header Banner with Quick Actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 to-slate-800 p-6 rounded-2xl text-white shadow-sm">
        <div>
          <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight">Overview & Analytics</h2>
          <p className="text-slate-400 text-xs sm:text-sm mt-1">Real-time procurement metrics, supplier outstandings, and expense cash flows</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={onOpenCreateBill}
            className="flex items-center gap-2 px-4 py-2.5 bg-brand-500 hover:bg-brand-600 active:bg-brand-700 text-white rounded-xl text-sm font-semibold transition-all shadow-md hover:shadow-lg"
          >
            <Plus className="w-4 h-4" /> New Purchase Bill
          </button>
        </div>
      </div>

      {/* Quick Multi-Branch & Department Filter Toolbar */}
      <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
            <Filter className="w-4 h-4 text-brand-600" />
            <span>Filter Analytics:</span>
          </div>

          {/* Branch Selector */}
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs">
            <Building2 className="w-3.5 h-3.5 text-slate-500" />
            <span className="text-[11px] font-semibold text-slate-500">Branch:</span>
            <select
              value={selectedBranch}
              onChange={(e) => setSelectedBranch(e.target.value)}
              className="bg-transparent text-xs font-bold text-slate-800 focus:outline-none cursor-pointer"
            >
              <option value="ALL">All Branches ({branches.length || 2})</option>
              {branches.map(b => (
                <option key={b} value={b}>{b} Branch</option>
              ))}
            </select>
          </div>

          {/* Department Selector */}
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs">
            <Layers className="w-3.5 h-3.5 text-slate-500" />
            <span className="text-[11px] font-semibold text-slate-500">Dept:</span>
            <select
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              className="bg-transparent text-xs font-bold text-slate-800 focus:outline-none cursor-pointer"
            >
              <option value="ALL">All Departments ({departments.length || 7})</option>
              {departments.map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>

          {(selectedBranch !== 'ALL' || selectedDept !== 'ALL') && (
            <button
              onClick={() => { setSelectedBranch('ALL'); setSelectedDept('ALL'); }}
              className="px-2.5 py-1 text-[11px] font-bold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-lg transition-colors cursor-pointer"
            >
              Reset Filters
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${
            currentTier === 'premium' ? 'bg-emerald-100 text-emerald-800' :
            currentTier === 'pro' ? 'bg-indigo-100 text-indigo-800' :
            currentTier === 'basic' ? 'bg-blue-100 text-blue-800' :
            'bg-slate-100 text-slate-800'
          }`}>
            {tierConfig?.badge || 'Plan Tier'}
          </span>
          {isDeveloper && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-200">
              Developer Bypass Active
            </span>
          )}
        </div>
      </div>

      {/* KPI Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
        {/* Total Purchases YTD */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Purchases</p>
            <h3 className="text-xl sm:text-2xl font-bold text-slate-900 mt-1">{formatCurrency(stats.totalPurchases)}</h3>
            <p className="text-[11px] text-slate-400 mt-1">{bills.length} bills recorded</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-blue-50 text-brand-600 flex items-center justify-center border border-blue-100 flex-shrink-0">
            <ShoppingCart className="w-6 h-6" />
          </div>
        </div>

        {/* Outstanding Payables */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Outstanding Payables</p>
            <h3 className="text-xl sm:text-2xl font-bold text-amber-600 mt-1">{formatCurrency(stats.totalOutstanding)}</h3>
            <p className="text-[11px] text-slate-400 mt-1">Pending to vendors</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-100 flex-shrink-0">
            <AlertCircle className="w-6 h-6" />
          </div>
        </div>

        {/* Customer Receivables (NEW) */}
        <div className="bg-white p-5 rounded-2xl border border-rose-200 bg-gradient-to-br from-white to-rose-50/30 shadow-sm flex items-center justify-between">
          <div>
            <div className="flex items-center gap-1.5">
              <p className="text-xs font-semibold text-rose-600 uppercase tracking-wider">Customer Receivables</p>
              {receivablesData.criticalCount > 0 && (
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" title="Has orders pending > 25 days" />
              )}
            </div>
            <h3 className="text-xl sm:text-2xl font-bold text-rose-600 mt-1">{formatCurrency(receivablesData.totalReceivable)}</h3>
            <p className="text-[11px] text-slate-500 mt-1">
              <span className="font-semibold text-rose-700">{receivablesData.count}</span> clients pending
            </p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center border border-rose-200 flex-shrink-0">
            <ArrowDownLeft className="w-6 h-6" />
          </div>
        </div>

        {/* Total Expenses */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Expenses</p>
            <h3 className="text-xl sm:text-2xl font-bold text-slate-900 mt-1">{formatCurrency(stats.totalExpenses)}</h3>
            <p className="text-[11px] text-slate-400 mt-1">{expenses.length} expenses logged</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center border border-purple-100 flex-shrink-0">
            <Receipt className="w-6 h-6" />
          </div>
        </div>

        {/* Active Vendors */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Active Vendors</p>
            <h3 className="text-xl sm:text-2xl font-bold text-slate-900 mt-1">{stats.vendorCount}</h3>
            <p className="text-[11px] text-slate-400 mt-1">Suppliers registered</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100 flex-shrink-0">
            <Users className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Analytics Row: Monthly Chart + Top Vendors */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Monthly Purchases Chart */}
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-base font-bold text-slate-900">Purchases by Month</h3>
              <p className="text-xs text-slate-400">Monthly procurement spend trends</p>
            </div>
            <TrendingUp className="w-5 h-5 text-brand-600" />
          </div>
          <div className="h-72 w-full">
            <Bar data={chartData} options={chartOptions} />
          </div>
        </div>

        {/* Top Vendors by Volume */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-base font-bold text-slate-900">Top Vendors by Spend</h3>
              <p className="text-xs text-slate-400">Highest procurement concentration</p>
            </div>
            <button
              onClick={() => onNavigate('vendors')}
              className="text-xs text-brand-600 hover:text-brand-800 font-semibold flex items-center gap-1"
            >
              View All <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex-1 overflow-auto space-y-4">
            {stats.topVendors.length === 0 ? (
              <p className="text-center text-slate-400 text-sm py-12">No vendor purchases recorded yet</p>
            ) : (
              stats.topVendors.map((v, idx) => (
                <div key={idx} className="space-y-1">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-semibold text-slate-800 truncate max-w-[150px]">{v.name}</span>
                    <span className="font-bold text-slate-900">{formatCurrency(v.amount)}</span>
                  </div>
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-brand-500 h-full rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(v.percent, 100)}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] text-slate-400">
                    <span>Rank #{idx + 1}</span>
                    <span>{v.percent.toFixed(1)}% of total</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Distribution Analytics (Pie Charts) - Tier Gated for Pro & Premium */}
      {!tierConfig?.hasPieChart ? (
        <div className="bg-gradient-to-br from-slate-50 via-white to-indigo-50/30 p-8 rounded-3xl border border-indigo-200/80 shadow-sm text-center space-y-4">
          <div className="w-16 h-16 rounded-3xl bg-indigo-50 border border-indigo-200 text-indigo-600 flex items-center justify-center mx-auto shadow-inner">
            <PieChartIcon className="w-8 h-8" />
          </div>
          <div className="max-w-md mx-auto space-y-1.5">
            <span className="px-3 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-indigo-100 text-indigo-800">
              Distribution Analytics Locked on {tierConfig?.name || 'Free Trial'}
            </span>
            <h3 className="text-xl font-black text-slate-900 tracking-tight">
              Supplier & Sales Pie Chart Distribution
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Interactive 360° slices with arrow pointers, supplier share breakdowns, and branch vs department turnover distribution are unlocked on <strong>Pro Business</strong> and <strong>Premium Enterprise</strong> plans.
            </p>
          </div>
          <button
            onClick={() => onNavigate('profile')}
            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md transition-all inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Crown className="w-4 h-4 text-amber-300" />
            <span>Upgrade Plan in Profile Settings</span>
          </button>
        </div>
      ) : (
        <>
          {/* Vendor Spending Breakdown Section with Doughnut / Pie Chart */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <PieChartIcon className="w-5 h-5 text-brand-600" />
                  <h3 className="text-base font-bold text-slate-900">Vendor Spending Distribution</h3>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">Proportional procurement spend breakdown by supplier</p>
              </div>

          {/* Monthwise Filter & Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Month Filter Dropdown */}
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-2.5 py-1.5 rounded-xl text-xs">
              <Calendar className="w-3.5 h-3.5 text-slate-500" />
              <select
                value={vendorMonthFilter}
                onChange={(e) => setVendorMonthFilter(e.target.value)}
                className="bg-transparent border-none text-xs font-bold text-slate-800 focus:outline-none cursor-pointer"
              >
                <option value="ALL">All Months</option>
                {availablePurchaseMonths.map(m => {
                  const [yr, mo] = m.split('-');
                  const monthName = new Date(parseInt(yr, 10), parseInt(mo, 10) - 1, 1).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
                  return (
                    <option key={m} value={m}>
                      {monthName}
                    </option>
                  );
                })}
              </select>
            </div>

            <button
              onClick={() => setShowVendorPrintModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors border border-slate-200 shadow-sm"
              title="Print Supplier Breakdown Report"
            >
              <Printer className="w-3.5 h-3.5 text-slate-600" />
              <span>Print Report</span>
            </button>
            <button
              onClick={handleExportPiePNG}
              disabled={vendorDistribution.allVendors.length === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-sky-50 hover:bg-sky-100 text-sky-700 rounded-xl text-xs font-semibold transition-colors border border-sky-200 shadow-sm disabled:opacity-50"
              title="Download High-Resolution Chart Image"
            >
              <Download className="w-3.5 h-3.5 text-sky-600" />
              <span>Export Chart (PNG)</span>
            </button>
            <button
              onClick={handleExportPieExcel}
              disabled={vendorDistribution.allVendors.length === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-xl text-xs font-semibold transition-colors border border-emerald-200 shadow-sm disabled:opacity-50"
              title="Export Vendor Spending to Excel"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              <span>Export Excel</span>
            </button>
          </div>
        </div>

        {/* Content Grid: Left Chart with Direct Arrow Labels, Right Breakdown Table */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          <div className="lg:col-span-7 flex flex-col items-center justify-center p-2">
            <div className="h-80 sm:h-96 w-full max-w-xl relative">
              <Doughnut
                ref={pieChartRef}
                data={vendorDistribution.chartData}
                options={pieOptions}
                plugins={[sliceArrowLabelsPlugin]}
              />
            </div>
            {vendorDistribution.totalPurchases > 0 && (
              <p className="text-[11px] text-slate-400 mt-2 text-center">
                Slices directly labeled with arrow pointers. Total: <strong className="text-slate-700">{formatCurrency(vendorDistribution.totalPurchases)}</strong> across {vendorDistribution.allVendors.length} suppliers {vendorMonthFilter !== 'ALL' && <span className="font-semibold text-brand-600">({vendorMonthFilter})</span>}
              </p>
            )}
          </div>

          <div className="lg:col-span-5">
            <div className="border border-slate-100 rounded-xl overflow-hidden shadow-sm">
              <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-200 flex justify-between items-center text-xs font-bold text-slate-700 uppercase tracking-wider">
                <span>Top Suppliers Ranking</span>
                <span>Procurement Share</span>
              </div>
              <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto">
                {vendorDistribution.allVendors.length === 0 ? (
                  <div className="py-8 text-center text-xs text-slate-400">
                    No vendor transactions recorded for this period.
                  </div>
                ) : (
                  vendorDistribution.allVendors.map((v, i) => (
                    <div key={v.name} className="px-4 py-2.5 flex items-center justify-between text-xs hover:bg-slate-50 transition-colors">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-600 font-bold flex items-center justify-center text-[10px] flex-shrink-0">
                          {i + 1}
                        </span>
                        <div className="truncate">
                          <p className="font-semibold text-slate-800 truncate">{v.name}</p>
                          <p className="text-[10px] text-slate-400">{v.billsCount} {v.billsCount === 1 ? 'bill' : 'bills'}</p>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0 ml-3">
                        <p className="font-bold text-slate-900">{formatCurrency(v.amount)}</p>
                        <p className="text-[10px] font-semibold text-brand-600">{v.percent.toFixed(1)}%</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Sales Distribution Breakdown Section (Branchwise & Departmentwise + Monthwise Filter) */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <PieChartIcon className="w-5 h-5 text-emerald-600" />
              <h3 className="text-base font-bold text-slate-900">
                Sales Distribution ({salesDimension === 'branch' ? 'Branch-wise' : 'Department-wise'})
              </h3>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Turnover revenue share segmented by business {salesDimension === 'branch' ? 'branches' : 'departments'} with monthwise filtering
            </p>
          </div>

          {/* Dimension Selector, Month Filter & Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Branch vs Department Toggle */}
            <div className="flex items-center bg-slate-100 p-0.5 rounded-xl text-xs border border-slate-200 font-bold">
              <button
                type="button"
                onClick={() => setSalesDimension('branch')}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  salesDimension === 'branch'
                    ? 'bg-white text-emerald-800 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Branch-wise
              </button>
              <button
                type="button"
                onClick={() => setSalesDimension('department')}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  salesDimension === 'department'
                    ? 'bg-white text-emerald-800 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Department-wise
              </button>
            </div>

            {/* Month Filter Dropdown */}
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-2.5 py-1.5 rounded-xl text-xs">
              <Calendar className="w-3.5 h-3.5 text-slate-500" />
              <select
                value={salesMonthFilter}
                onChange={(e) => setSalesMonthFilter(e.target.value)}
                className="bg-transparent border-none text-xs font-bold text-slate-800 focus:outline-none cursor-pointer"
              >
                <option value="ALL">All Months</option>
                {availableSalesMonths.map(m => {
                  const [yr, mo] = m.split('-');
                  const monthName = new Date(parseInt(yr, 10), parseInt(mo, 10) - 1, 1).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
                  return (
                    <option key={m} value={m}>
                      {monthName}
                    </option>
                  );
                })}
              </select>
            </div>

            {/* Export PNG */}
            <button
              onClick={handleExportSalesPiePNG}
              disabled={salesDistribution.allGroups.length === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-sky-50 hover:bg-sky-100 text-sky-700 rounded-xl text-xs font-semibold transition-colors border border-sky-200 shadow-sm disabled:opacity-50"
              title="Download Sales Pie Chart Image (PNG)"
            >
              <Download className="w-3.5 h-3.5 text-sky-600" />
              <span>Export Chart (PNG)</span>
            </button>

            {/* Export Excel */}
            <button
              onClick={handleExportSalesPieExcel}
              disabled={salesDistribution.allGroups.length === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-xl text-xs font-semibold transition-colors border border-emerald-200 shadow-sm disabled:opacity-50"
              title="Export Sales Distribution to Excel"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              <span>Export Excel</span>
            </button>
          </div>
        </div>

        {/* Content Grid: Left Chart with Direct Arrow Labels, Right Breakdown Table */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          <div className="lg:col-span-7 flex flex-col items-center justify-center p-2">
            <div className="h-80 sm:h-96 w-full max-w-xl relative">
              <Doughnut
                ref={salesPieChartRef}
                data={salesDistribution.chartData}
                options={pieOptions}
                plugins={[sliceArrowLabelsPlugin]}
              />
            </div>
            {salesDistribution.totalSales > 0 && (
              <p className="text-[11px] text-slate-400 mt-2 text-center">
                Slices directly labeled with arrow pointers. Total Turnover: <strong className="text-emerald-700">{formatCurrency(salesDistribution.totalSales)}</strong> across {salesDistribution.allGroups.length} {salesDimension === 'branch' ? 'branches' : 'departments'} {salesMonthFilter !== 'ALL' && <span className="font-semibold text-brand-600">({salesMonthFilter})</span>}
              </p>
            )}
          </div>

          <div className="lg:col-span-5">
            <div className="border border-slate-100 rounded-xl overflow-hidden shadow-sm">
              <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-200 flex justify-between items-center text-xs font-bold text-slate-700 uppercase tracking-wider">
                <span>{salesDimension === 'branch' ? 'Branch' : 'Department'} Ranking</span>
                <span>Sales Share</span>
              </div>
              <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto">
                {salesDistribution.allGroups.length === 0 ? (
                  <div className="py-8 text-center text-xs text-slate-400">
                    No sales recorded for this selection.
                  </div>
                ) : (
                  salesDistribution.allGroups.map((g, i) => (
                    <div key={g.name} className="px-4 py-2.5 flex items-center justify-between text-xs hover:bg-slate-50 transition-colors">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-600 font-bold flex items-center justify-center text-[10px] flex-shrink-0">
                          {i + 1}
                        </span>
                        <div className="truncate">
                          <p className="font-semibold text-slate-800 truncate">{g.name}</p>
                          <p className="text-[10px] text-slate-400">{g.ordersCount} {g.ordersCount === 1 ? 'order' : 'orders'}</p>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0 ml-3">
                        <p className="font-bold text-slate-900">{formatCurrency(g.amount)}</p>
                        <p className="text-[10px] font-semibold text-emerald-600">{g.percent.toFixed(1)}%</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )}

      {/* Customer Accounts Receivable (Pending Payments from Clients) Table Section */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Header Strip */}
        <div className="p-5 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-rose-50/40 via-white to-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center border border-rose-200 flex-shrink-0">
              <ArrowDownLeft className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900">Customer Accounts Receivable</h3>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                  {receivablesData.count} Pending Orders
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Outstanding balances from estimates & sales orders with aging days tracker
              </p>
            </div>
          </div>

          {/* Quick Metrics & Actions */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <div className="hidden lg:flex items-center gap-3 bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-xs text-xs">
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">Total Pending</span>
                <span className="font-bold text-rose-600">{formatCurrency(receivablesData.totalReceivable)}</span>
              </div>
              <div className="h-6 w-px bg-slate-200" />
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">&gt; 25 Days Overdue</span>
                <span className="font-bold text-rose-700">{receivablesData.gt25Count} orders ({formatCurrency(receivablesData.criticalAmount)})</span>
              </div>
              <div className="h-6 w-px bg-slate-200" />
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">Avg Aging</span>
                <span className="font-bold text-slate-700">{receivablesData.avgDays} days</span>
              </div>
            </div>

            <button
              onClick={handleExportReceivablesExcel}
              disabled={filteredReceivables.length === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 active:bg-emerald-200 text-emerald-800 rounded-xl text-xs font-semibold transition-colors border border-emerald-200 shadow-xs disabled:opacity-50"
              title="Export Customer Receivables to Excel"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              <span>Export Excel</span>
            </button>

            <button
              onClick={() => onNavigate('salesOrders')}
              className="text-xs font-semibold text-brand-600 hover:text-brand-800 flex items-center gap-1 bg-white hover:bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl shadow-xs transition-colors"
            >
              <span>Sales Orders</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Filters & Search Toolbar */}
        <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={receivableSearch}
              onChange={(e) => setReceivableSearch(e.target.value)}
              placeholder="Search by customer name, Est #, phone, branch..."
              className="w-full pl-9 pr-8 py-1.5 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 placeholder:text-slate-400"
            />
            {receivableSearch && (
              <button
                onClick={() => setReceivableSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Aging Filters & Sort */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Filter Pills */}
            <div className="flex items-center p-0.5 bg-slate-200/70 rounded-xl text-xs font-medium text-slate-600">
              <button
                onClick={() => setAgingFilter('all')}
                className={`px-2.5 py-1 rounded-lg transition-all ${
                  agingFilter === 'all'
                    ? 'bg-white text-slate-900 font-bold shadow-xs'
                    : 'hover:text-slate-900'
                }`}
              >
                All ({receivablesData.count})
              </button>
              <button
                onClick={() => setAgingFilter('gt25')}
                className={`px-2.5 py-1 rounded-lg transition-all flex items-center gap-1 ${
                  agingFilter === 'gt25'
                    ? 'bg-rose-500 text-white font-bold shadow-xs'
                    : 'text-rose-700 hover:text-rose-900'
                }`}
              >
                &gt; 25 Days ({receivablesData.gt25Count})
              </button>
              <button
                onClick={() => setAgingFilter('15_24')}
                className={`px-2.5 py-1 rounded-lg transition-all ${
                  agingFilter === '15_24'
                    ? 'bg-amber-500 text-white font-bold shadow-xs'
                    : 'text-amber-700 hover:text-amber-900'
                }`}
              >
                15-24 Days ({receivablesData.g1524Count})
              </button>
              <button
                onClick={() => setAgingFilter('7_14')}
                className={`px-2.5 py-1 rounded-lg transition-all ${
                  agingFilter === '7_14'
                    ? 'bg-blue-600 text-white font-bold shadow-xs'
                    : 'text-blue-700 hover:text-blue-900'
                }`}
              >
                7-14 Days ({receivablesData.g714Count})
              </button>
              <button
                onClick={() => setAgingFilter('lt7')}
                className={`px-2.5 py-1 rounded-lg transition-all ${
                  agingFilter === 'lt7'
                    ? 'bg-slate-700 text-white font-bold shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                &lt; 7 Days ({receivablesData.lt7Count})
              </button>
            </div>

            {/* Sort Dropdown */}
            <select
              value={receivableSort}
              onChange={(e) => setReceivableSort(e.target.value)}
              className="text-xs bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-slate-700 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 cursor-pointer font-medium"
            >
              <option value="balance_desc">Sort: Pending (High to Low)</option>
              <option value="days_desc">Sort: Days Pending (Oldest First)</option>
              <option value="date_desc">Sort: Order Date (Newest First)</option>
              <option value="name_asc">Sort: Customer Name (A-Z)</option>
            </select>
          </div>
        </div>

        {/* Table Content */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse whitespace-nowrap">
            <thead>
              <tr className="bg-slate-50 text-slate-500 border-b border-slate-200 text-xs uppercase font-semibold tracking-wider">
                <th className="px-4 py-3 text-center w-12">#</th>
                <th className="px-4 py-3">Est / Ref #</th>
                <th className="px-4 py-3">Customer Name</th>
                <th className="px-4 py-3">Mobile No</th>
                <th className="px-4 py-3">Branch</th>
                <th className="px-4 py-3">Order Date</th>
                <th className="px-4 py-3 text-center">Days Pending</th>
                <th className="px-4 py-3 text-right">Order Total</th>
                <th className="px-4 py-3 text-right">Paid</th>
                <th className="px-4 py-3 text-right font-bold text-rose-700">Pending Balance</th>
                <th className="px-4 py-3 text-center w-24">Actions</th>
              </tr>
            </thead>
            <tbody className="text-sm divide-y divide-slate-100 text-slate-700">
              {filteredReceivables.length === 0 ? (
                <tr>
                  <td colSpan="11" className="text-center py-10 text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-1">
                      <AlertCircle className="w-6 h-6 text-slate-300" />
                      <p className="text-xs font-medium text-slate-500">No receivables match your selected filter or search.</p>
                      {agingFilter !== 'all' || receivableSearch ? (
                        <button
                          onClick={() => {
                            setAgingFilter('all');
                            setReceivableSearch('');
                          }}
                          className="mt-1 text-xs text-brand-600 hover:underline font-semibold"
                        >
                          Clear filters
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedReceivables.map((r, idx) => {
                  const itemIndex = (receivablePage - 1) * receivablePageSize + idx + 1;
                  return (
                    <tr 
                      key={r.id || idx} 
                      className={`hover:bg-rose-50/20 transition-colors ${
                        r.daysPending >= 25 ? 'bg-rose-50/10' : ''
                      }`}
                    >
                      {/* S.No */}
                      <td className="px-4 py-3.5 text-center text-xs text-slate-400 font-mono">
                        {itemIndex}
                      </td>

                      {/* Est No */}
                      <td className="px-4 py-3.5">
                        <button
                          onClick={() => onViewSale && onViewSale(r)}
                          className="font-mono font-bold text-slate-900 hover:text-brand-600 bg-slate-100 hover:bg-brand-50 px-2 py-0.5 rounded-md border border-slate-200 text-xs transition-colors inline-block text-left"
                          title="Click to view full sale order"
                        >
                          {r.estNumber}
                        </button>
                      </td>

                      {/* Customer Name */}
                      <td className="px-4 py-3.5">
                        <p className="font-semibold text-slate-900 truncate max-w-[200px]" title={r.customerName}>
                          {r.customerName || 'Cash Customer'}
                        </p>
                      </td>

                      {/* Mobile Number Column */}
                      <td className="px-4 py-3.5">
                        {(r.customerPhone || r.contact) ? (
                          <a
                            href={`tel:${r.customerPhone || r.contact}`}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-mono text-xs font-semibold border border-emerald-200 transition-colors"
                            title="Click to call customer"
                          >
                            <Phone className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                            <span>{r.customerPhone || r.contact}</span>
                          </a>
                        ) : (
                          <span className="text-slate-400 text-xs italic font-mono">N/A</span>
                        )}
                      </td>

                      {/* Branch */}
                      <td className="px-4 py-3.5">
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md text-[11px] font-medium border border-slate-200/60">
                          {r.branch || 'Main'}
                        </span>
                      </td>

                      {/* Order Date */}
                      <td className="px-4 py-3.5 text-slate-600 text-xs font-mono">
                        {formatDate(r.orderDate || r.invDate || r.date)}
                      </td>

                      {/* Days Pending with Aging Color Badge */}
                      <td className="px-4 py-3.5 text-center">
                        {r.daysPending >= 25 ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-300 shadow-2xs">
                            <AlertTriangle className="w-3 h-3 text-rose-600 animate-pulse" />
                            {r.daysPending} days
                          </span>
                        ) : r.daysPending >= 15 ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-300">
                            <Clock className="w-3 h-3 text-amber-600" />
                            {r.daysPending} days
                          </span>
                        ) : r.daysPending >= 7 ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 border border-blue-200">
                            {r.daysPending} days
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
                            {r.daysPending} days
                          </span>
                        )}
                      </td>

                      {/* Order Grand Total */}
                      <td className="px-4 py-3.5 text-right font-medium text-slate-600 text-xs">
                        {formatCurrency(r.grandTotalNum)}
                      </td>

                      {/* Paid Amount */}
                      <td className="px-4 py-3.5 text-right font-semibold text-emerald-700 text-xs">
                        {formatCurrency(r.paidAmountNum)}
                      </td>

                      {/* Pending Balance */}
                      <td className="px-4 py-3.5 text-right font-bold text-rose-600 text-sm">
                        {formatCurrency(r.balance)}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3.5 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => onViewSale && onViewSale(r)}
                            className="p-1.5 text-slate-400 hover:text-brand-600 hover:bg-slate-100 rounded-lg transition-colors"
                            title="View Sales Order Details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          {onRecordPayment && (
                            <button
                              onClick={() => onRecordPayment(r)}
                              className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                              title="Record Customer Payment"
                            >
                              <CreditCard className="w-4 h-4" />
                            </button>
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

        {/* Pagination Footer */}
        {filteredReceivables.length > 0 && (
          <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
            <div>
              Showing <span className="font-semibold text-slate-800">{(receivablePage - 1) * receivablePageSize + 1}</span> to{' '}
              <span className="font-semibold text-slate-800">
                {Math.min(receivablePage * receivablePageSize, filteredReceivables.length)}
              </span>{' '}
              of <span className="font-semibold text-slate-800">{filteredReceivables.length}</span> receivables
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setReceivablePage(p => Math.max(1, p - 1))}
                disabled={receivablePage === 1}
                className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-1"
              >
                <ChevronLeft className="w-3.5 h-3.5" /> Previous
              </button>

              <span className="px-3 py-1 font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg">
                Page {receivablePage} of {totalReceivablePages}
              </span>

              <button
                onClick={() => setReceivablePage(p => Math.min(totalReceivablePages, p + 1))}
                disabled={receivablePage === totalReceivablePages}
                className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-1"
              >
                Next <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Recent Bills Activity Table (Tier Gated: Basic, Pro & Premium) */}
      {!tierConfig?.hasRecentBills ? (
        <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-slate-200 text-slate-500 flex items-center justify-center mx-auto">
            <Lock className="w-6 h-6" />
          </div>
          <div className="max-w-md mx-auto space-y-1">
            <h4 className="text-sm font-bold text-slate-900">Recent Purchase Bills Stream Locked</h4>
            <p className="text-xs text-slate-500">
              Live recent bills activity stream is available on Basic, Pro, and Premium plans.
            </p>
          </div>
          <button
            onClick={() => onNavigate('profile')}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Crown className="w-3.5 h-3.5 text-amber-300" />
            <span>Upgrade to Basic Plan</span>
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-200 flex justify-between items-center bg-slate-50/50">
            <div>
              <h3 className="text-base font-bold text-slate-900">Recent Purchase Bills</h3>
              <p className="text-xs text-slate-400">Latest supplier invoices recorded in the system</p>
            </div>
            <button
              onClick={() => onNavigate('bills')}
              className="text-xs font-semibold text-brand-600 hover:text-brand-800 flex items-center gap-1 bg-white border border-slate-200 px-3 py-1.5 rounded-lg shadow-sm transition-colors"
            >
              All Bills <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse whitespace-nowrap">
              <thead>
                <tr className="bg-slate-50 text-slate-500 border-b border-slate-200 text-xs uppercase font-semibold tracking-wider">
                  <th className="px-6 py-3.5">Date</th>
                  <th className="px-6 py-3.5">Invoice #</th>
                  <th className="px-6 py-3.5">Vendor</th>
                  <th className="px-6 py-3.5 text-right">Amount</th>
                  <th className="px-6 py-3.5 text-center">Status</th>
                  <th className="px-6 py-3.5 text-center w-20">Action</th>
                </tr>
              </thead>
              <tbody className="text-sm divide-y divide-slate-100 text-slate-700">
                {stats.recentBills.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="text-center py-8 text-slate-400">
                      No purchase bills entered yet.
                    </td>
                  </tr>
                ) : (
                  stats.recentBills.map(b => (
                    <tr key={b.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-6 py-3.5 text-slate-600 text-xs">{formatDate(b.date)}</td>
                      <td className="px-6 py-3.5 font-bold text-slate-900">{b.invoiceNo || 'N/A'}</td>
                      <td className="px-6 py-3.5 font-medium text-slate-800">{b.vendorName || 'N/A'}</td>
                      <td className="px-6 py-3.5 text-right font-bold text-slate-900">{formatCurrency(b.grandTotal)}</td>
                      <td className="px-6 py-3.5 text-center">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                          b.paymentStatus === 'paid'
                            ? 'bg-emerald-100 text-emerald-800'
                            : b.paymentStatus === 'partial'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}>
                          {b.paymentStatus === 'paid' ? <CheckCircle2 className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                          {b.paymentStatus ? b.paymentStatus.toUpperCase() : 'UNPAID'}
                        </span>
                      </td>
                      <td className="px-6 py-3.5 text-center">
                        <button
                          onClick={() => onViewBill(b.id)}
                          className="p-1.5 text-slate-400 hover:text-brand-600 hover:bg-slate-100 rounded-lg transition-colors"
                          title="View Tax Invoice"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Printable Vendor Spending Distribution Modal */}
      {showVendorPrintModal && (
        <div 
          className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 overflow-hidden animate-in fade-in duration-150"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowVendorPrintModal(false);
          }}
        >
          {/* Floating Emergency Close Button (Always visible at top-right corner of screen) */}
          <button
            onClick={() => setShowVendorPrintModal(false)}
            className="no-print fixed top-3 right-3 sm:top-5 sm:right-5 z-[70] p-2.5 bg-slate-900/95 hover:bg-rose-600 text-white rounded-full shadow-2xl transition-all border border-slate-700 hover:scale-105 flex items-center gap-1.5 px-3.5 text-xs font-bold cursor-pointer"
            title="Cancel / Return to Dashboard (or press Esc)"
          >
            <X className="w-4 h-4" />
            <span>Close (Esc)</span>
          </button>

          <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[94vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-150 relative">
            {/* Top Fixed Action Bar (Always Visible, Hidden on Print) */}
            <div className="no-print bg-slate-900 text-white p-3.5 sm:p-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-b border-slate-800 flex-shrink-0 shadow-sm">
              <div className="flex items-center gap-2 sm:gap-3">
                <button
                  onClick={() => setShowVendorPrintModal(false)}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-white rounded-xl text-xs font-bold transition-all border border-slate-700 shadow-sm"
                  title="Return to Dashboard"
                >
                  <ArrowLeft className="w-4 h-4 text-brand-400" />
                  <span>Back to Dashboard</span>
                </button>
                <div className="h-5 w-px bg-slate-700 hidden sm:block" />
                <div className="flex items-center gap-2">
                  <PieChartIcon className="w-4 h-4 text-brand-400" />
                  <span className="font-bold text-xs sm:text-sm">Vendor Spending Report Preview</span>
                </div>
              </div>

              <div className="flex items-center gap-2 justify-end flex-wrap">
                <button
                  onClick={() => window.print()}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-brand-500 hover:bg-brand-600 active:bg-brand-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all"
                >
                  <Printer className="w-4 h-4" /> Print Now
                </button>
                <button
                  onClick={handleExportPieExcel}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-xl text-xs font-bold shadow-sm transition-all"
                >
                  <FileSpreadsheet className="w-4 h-4" /> Export Excel
                </button>
                <button
                  onClick={() => setShowVendorPrintModal(false)}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-colors shadow-sm"
                >
                  <X className="w-4 h-4" /> Cancel
                </button>
              </div>
            </div>

            {/* Scrollable Printable Report Document */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-8 space-y-6 text-slate-800 bg-white">
              {/* Formal Letterhead */}
              <div className="border-b-2 border-slate-900 pb-5 flex justify-between items-start">
                <div>
                  <h1 className="text-2xl font-black text-slate-950 tracking-tight">
                    {profile.businessName || 'RS Purchase Enterprise'}
                  </h1>
                  <p className="text-xs text-slate-600 mt-1 max-w-md">{profile.address || 'Enterprise Procurement Division'}</p>
                  <div className="flex flex-wrap gap-4 text-xs font-medium text-slate-600 mt-2">
                    <span><strong>GSTIN:</strong> {profile.gstin || 'UNREGISTERED'}</span>
                    {profile.phone && <span><strong>Phone:</strong> {profile.phone}</span>}
                    {profile.email && <span><strong>Email:</strong> {profile.email}</span>}
                  </div>
                </div>
                <div className="text-right">
                  <span className="inline-block bg-slate-100 text-slate-900 text-xs font-extrabold uppercase px-3 py-1 rounded-md tracking-wider border border-slate-300">
                    Vendor Analysis
                  </span>
                  <p className="text-xs text-slate-500 mt-2">Generated On:</p>
                  <p className="text-xs font-bold text-slate-800">{new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
                </div>
              </div>

              {/* Title & Key Metrics */}
              <div>
                <h2 className="text-lg font-bold text-slate-900 uppercase tracking-wide">
                  Supplier Procurement & Spending Distribution Report
                </h2>
                <div className="grid grid-cols-3 gap-4 mt-3">
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                    <p className="text-[10px] uppercase font-bold text-slate-500">Total Procurement Spend</p>
                    <p className="text-lg font-black text-slate-900 mt-0.5">{formatCurrency(vendorDistribution.totalPurchases)}</p>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                    <p className="text-[10px] uppercase font-bold text-slate-500">Active Suppliers</p>
                    <p className="text-lg font-black text-slate-900 mt-0.5">{vendorDistribution.allVendors.length} Vendors</p>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                    <p className="text-[10px] uppercase font-bold text-slate-500">Total Purchase Vouchers</p>
                    <p className="text-lg font-black text-slate-900 mt-0.5">{bills.length} Bills</p>
                  </div>
                </div>
              </div>

              {/* Chart with Direct Arrow Labels in Print Document */}
              <div className="flex flex-col items-center justify-center border border-slate-200 rounded-xl p-4 bg-slate-50/50">
                <p className="text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Procurement Share by Supplier (Direct Arrow Callouts)
                </p>
                <div className="h-72 w-full max-w-lg relative">
                  <Doughnut
                    data={vendorDistribution.chartData}
                    options={pieOptions}
                    plugins={[sliceArrowLabelsPlugin]}
                  />
                </div>
              </div>

              {/* Table */}
              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-100 border-b border-slate-200 font-bold text-slate-700 uppercase">
                      <th className="px-4 py-2.5 w-16 text-center">Rank</th>
                      <th className="px-4 py-2.5">Supplier / Vendor Name</th>
                      <th className="px-4 py-2.5 text-center">Invoices</th>
                      <th className="px-4 py-2.5 text-right">Total Purchases (₹)</th>
                      <th className="px-4 py-2.5 text-right">Share (%)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {vendorDistribution.allVendors.map((v, idx) => (
                      <tr key={v.name} className="hover:bg-slate-50/50">
                        <td className="px-4 py-2 text-center font-bold text-slate-500">#{idx + 1}</td>
                        <td className="px-4 py-2 font-semibold text-slate-900">{v.name}</td>
                        <td className="px-4 py-2 text-center text-slate-600">{v.billsCount}</td>
                        <td className="px-4 py-2 text-right font-bold text-slate-900">{formatCurrency(v.amount)}</td>
                        <td className="px-4 py-2 text-right font-semibold text-brand-700">{v.percent.toFixed(2)}%</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-100 border-t-2 border-slate-300 font-black text-slate-950">
                      <td colSpan="2" className="px-4 py-3 uppercase">Total Purchases (All Vendors)</td>
                      <td className="px-4 py-3 text-center">{bills.length}</td>
                      <td className="px-4 py-3 text-right">{formatCurrency(vendorDistribution.totalPurchases)}</td>
                      <td className="px-4 py-3 text-right">100.00%</td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Footnote */}
              <div className="text-[10px] text-slate-400 text-center pt-2">
                This is a computer-generated vendor distribution analysis from RSPurchase Enterprise.
              </div>
            </div>

            {/* Bottom Fixed Navigation Bar (Always Visible, Hidden on Print) */}
            <div className="no-print bg-slate-100 border-t border-slate-200 p-3 sm:p-4 flex flex-col sm:flex-row items-center justify-between gap-3 flex-shrink-0">
              <button
                onClick={() => setShowVendorPrintModal(false)}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2.5 bg-white hover:bg-slate-200 active:bg-slate-300 text-slate-800 font-bold rounded-xl text-xs border border-slate-300 shadow-sm transition-colors"
              >
                <ArrowLeft className="w-4 h-4 text-brand-600" />
                <span>Back to Dashboard</span>
              </button>

              <div className="w-full sm:w-auto flex items-center justify-end gap-2">
                <button
                  onClick={handleExportPieExcel}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs shadow-sm transition-colors"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>Export Excel</span>
                </button>
                <button
                  onClick={() => window.print()}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2.5 bg-brand-500 hover:bg-brand-600 text-white font-bold rounded-xl text-xs shadow-sm transition-colors"
                >
                  <Printer className="w-4 h-4" />
                  <span>Print Report Now</span>
                </button>
                <button
                  onClick={() => setShowVendorPrintModal(false)}
                  className="flex items-center justify-center gap-1 px-4 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold rounded-xl text-xs transition-colors"
                >
                  <X className="w-4 h-4" />
                  <span>Cancel / Close</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
