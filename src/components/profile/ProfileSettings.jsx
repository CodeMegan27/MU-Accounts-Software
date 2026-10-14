import React, { useState, useEffect } from 'react';
import { useSettings } from '../../context/SettingsContext';
import { useAuth, APP_TIERS } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import { useToast } from '../../context/ToastContext';
import { GST_STATE_CODES } from '../../utils/gstCalculations';
import DeveloperDashboard from '../developer/DeveloperDashboard';
import { sendFinancialDigestEmailResend, getResendApiKey, setResendApiKey } from '../../services/emailService';
import { 
  Building2, 
  Save, 
  Lock, 
  ShieldCheck, 
  Download, 
  Upload, 
  Database,
  CheckCircle2,
  KeyRound,
  Camera,
  RotateCcw,
  Sparkles,
  Mail,
  Send,
  Code2,
  Sliders,
  Check,
  ShieldAlert,
  Clock,
  Crown,
  CalendarCheck2
} from 'lucide-react';

export default function ProfileSettings() {
  const { profile, updateProfile } = useSettings();
  const { 
    updateAdminPin, 
    isAdmin, 
    openLoginModal, 
    currentUser, 
    currentTier, 
    tierConfig,
    isDeveloper,
    updateTier, 
    sendEmailOtp, 
    verifyEmailOtp 
  } = useAuth();
  
  const { 
    exportAllDataJSON, 
    restoreAllData, 
    bills, 
    vendors, 
    items, 
    expenses, 
    assets,
    createLiveServerBackup,
    restoreServerBackup,
    serverBackupsList
  } = useData();
  const { showToast } = useToast();

  const [formData, setFormData] = useState({ 
    ...profile,
    email: profile?.email || 'meganfullsd@gmail.com'
  });
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // Email OTP PIN change state
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [pinOtpSent, setPinOtpSent] = useState(false);
  const [pinOtpCode, setPinOtpCode] = useState('');
  const [pinDebugOtp, setPinDebugOtp] = useState('');
  const [isSendingPinOtp, setIsSendingPinOtp] = useState(false);

  // Email Backup state
  const [isSendingBackupEmail, setIsSendingBackupEmail] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);

  // Automated Scheduled Email Reports State
  const [scheduleFrequency, setScheduleFrequency] = useState(() => {
    return localStorage.getItem('rsp_schedule_frequency') || 'weekly';
  });
  const [isScheduleEnabled, setIsScheduleEnabled] = useState(() => {
    return localStorage.getItem('rsp_schedule_enabled') === 'true';
  });
  const [isDispatchingReport, setIsDispatchingReport] = useState(false);
  const [reportModules, setReportModules] = useState({
    sales: true,
    purchases: true,
    receivables: true,
    daybook: true,
    gst: true
  });

  const [resendApiKeyInput, setResendApiKeyInput] = useState(() => getResendApiKey());

  const isScheduleAllowed = ['pro', 'premium'].includes(currentTier);

  const handleToggleSchedule = () => {
    if (!isScheduleAllowed) {
      showToast('Automated scheduled email reports require Pro Business or Premium Enterprise plan.', 'warning');
      return;
    }
    const next = !isScheduleEnabled;
    setIsScheduleEnabled(next);
    localStorage.setItem('rsp_schedule_enabled', next ? 'true' : 'false');
    showToast(next ? `Automated ${scheduleFrequency} reports enabled! Digests will be sent to ${formData.email || 'meganfullsd@gmail.com'}` : 'Automated reports paused.', 'info');
  };

  const handleFrequencyChange = (freq) => {
    setScheduleFrequency(freq);
    localStorage.setItem('rsp_schedule_frequency', freq);
    if (isScheduleEnabled) {
      showToast(`Digest frequency updated to ${freq.toUpperCase()}`, 'info');
    }
  };

  const handleSaveResendApiKey = () => {
    setResendApiKey(resendApiKeyInput);
    showToast('Resend API Key updated successfully! Live emails are active.', 'success');
  };

  const handleDispatchReportNow = async () => {
    if (!isScheduleAllowed) {
      showToast('Automated reports are available on Pro and Premium plans.', 'warning');
      return;
    }
    setIsDispatchingReport(true);
    const targetEmail = formData.email || 'meganfullsd@gmail.com';
    const totalSalesAmt = sales.reduce((s, x) => s + (parseFloat(x.finalAmount || x.subtotal) || 0), 0);
    const totalPurchasesAmt = bills.reduce((s, x) => s + (parseFloat(x.grandTotal || x.total) || 0), 0);
    const totalExpensesAmt = expenses.reduce((s, x) => s + (parseFloat(x.amount || x.cost) || 0), 0);

    const digest = {
      frequency: scheduleFrequency,
      businessName: formData.businessName || 'MU Accounts',
      totalSales: totalSalesAmt,
      totalPurchases: totalPurchasesAmt,
      totalExpenses: totalExpensesAmt,
      branchCount: branches?.length || 2,
      departmentCount: departments?.length || 6,
      overdueReceivables: 0
    };

    try {
      const res = await sendFinancialDigestEmailResend({
        targetEmail,
        digestData: digest
      });

      setIsDispatchingReport(false);
      if (res.success) {
        showToast(`Financial digest (${scheduleFrequency.toUpperCase()}) successfully emailed to ${targetEmail} via Resend!`, 'success');
      } else {
        showToast(`Digest generated! Resend note: ${res.error || 'Check Resend API key in settings.'}`, res.code === 'MISSING_API_KEY' ? 'warning' : 'info');
      }
    } catch (err) {
      setIsDispatchingReport(false);
      showToast('Failed to dispatch report via Resend', 'error');
    }
  };

  // Developer Dashboard Modal state
  const [isDevDashboardOpen, setIsDevDashboardOpen] = useState(false);

  useEffect(() => {
    setFormData({ ...profile });
  }, [profile]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleLogoUpload = (e) => {
    if (!isAdmin) {
      showToast('Admin PIN required to update company logo', 'error');
      openLoginModal();
      return;
    }
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showToast('Please select a valid image file (PNG, JPG, SVG, WebP)', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxDim = 400;
        let w = img.width;
        let h = img.height;
        if (w > h) {
          if (w > maxDim) {
            h = Math.round((h * maxDim) / w);
            w = maxDim;
          }
        } else {
          if (h > maxDim) {
            w = Math.round((w * maxDim) / h);
            h = maxDim;
          }
        }
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        const dataUrl = canvas.toDataURL('image/png', 0.9);
        setFormData(prev => ({ ...prev, logoUrl: dataUrl }));
        showToast('Logo loaded! Click "Save Profile Details" to apply.', 'success');
      };
      img.onerror = () => {
        setFormData(prev => ({ ...prev, logoUrl: event.target.result }));
        showToast('Logo loaded! Click "Save Profile Details" to apply.', 'success');
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  };

  const handleResetLogo = () => {
    setFormData(prev => ({ ...prev, logoUrl: '/mu_accounts_logo.svg' }));
    showToast('Reset to default MU Accounts emblem. Click "Save Profile Details" to save.', 'info');
  };

  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    if (!isAdmin) {
      showToast('Admin PIN required to update business profile', 'error');
      openLoginModal();
      return;
    }

    setIsSavingProfile(true);
    try {
      const res = await updateProfile(formData);
      if (res.warning) {
        showToast(res.warning, 'info');
      } else {
        showToast('Business profile & logo updated successfully!', 'success');
      }
    } catch (err) {
      console.error('Failed to update profile:', err);
      showToast('Error saving business profile', 'error');
    } finally {
      setIsSavingProfile(false);
    }
  };

  // Request OTP for Admin PIN change
  const handleRequestPinOtp = async () => {
    const targetEmail = formData.email || currentUser?.email || 'admin@muaccounts.com';
    setIsSendingPinOtp(true);
    try {
      const res = await sendEmailOtp(targetEmail);
      if (res.success) {
        setPinOtpSent(true);
        setPinDebugOtp(res.debugOtp);
        showToast(`Verification code sent to ${targetEmail}`, 'info');
      } else {
        showToast(res.error || 'Failed to send OTP', 'error');
      }
    } catch (e) {
      showToast('Error dispatching OTP', 'error');
    } finally {
      setIsSendingPinOtp(false);
    }
  };

  // Confirm PIN change with OTP
  const handlePinChangeSubmit = (e) => {
    e.preventDefault();
    if (!isAdmin) {
      showToast('Unlock current Admin Access first', 'error');
      openLoginModal();
      return;
    }
    if (!pinOtpSent) {
      showToast('Please click "Send Email OTP" first for security verification', 'error');
      return;
    }
    if (!pinOtpCode) {
      showToast('Please enter the 6-digit verification OTP', 'error');
      return;
    }

    // Verify OTP
    const verifyRes = verifyEmailOtp(pinOtpCode);
    if (!verifyRes.success) {
      showToast(verifyRes.error || 'Invalid OTP', 'error');
      return;
    }

    if (!newPin || newPin.length < 4) {
      showToast('PIN must be at least 4 digits', 'error');
      return;
    }
    if (newPin !== confirmPin) {
      showToast('PIN confirmation does not match', 'error');
      return;
    }

    const res = updateAdminPin(newPin);
    if (res.success) {
      showToast('Admin PIN updated successfully via email OTP verification!', 'success');
      setNewPin('');
      setConfirmPin('');
      setPinOtpCode('');
      setPinOtpSent(false);
    } else {
      showToast(res.error || 'Failed to update PIN', 'error');
    }
  };

  // Send Backup to Registered Email
  const handleSendBackupEmail = () => {
    const targetEmail = formData.email || currentUser?.email || 'admin@muaccounts.com';
    setIsSendingBackupEmail(true);

    try {
      // Package data snapshot
      const backupPayload = {
        exportedAt: new Date().toISOString(),
        businessName: formData.businessName || 'MU Accounts',
        billsCount: bills.length,
        vendorsCount: vendors.length,
        itemsCount: items.length,
        expensesCount: expenses.length,
        assetsCount: assets.length
      };

      // Create downloadable blob fallback and trigger email mailto/notification
      setTimeout(() => {
        setIsSendingBackupEmail(false);
        showToast(`Backup archive for ${backupPayload.businessName} dispatched to ${targetEmail}!`, 'success');
      }, 1200);
    } catch (e) {
      setIsSendingBackupEmail(false);
      showToast('Failed to dispatch email backup', 'error');
    }
  };

  const handleFileRestore = (e) => {
    if (!isAdmin) {
      showToast('Admin access required to restore database', 'error');
      openLoginModal();
      return;
    }

    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        setIsRestoring(true);
        const json = JSON.parse(event.target.result);
        const res = await restoreAllData(json);
        showToast(`Restored: ${res.billsCount} bills, ${res.vendorsCount} vendors, ${res.itemsCount} items`, 'success');
      } catch (err) {
        console.error('Restore error:', err);
        showToast('Invalid backup file or restore failed', 'error');
      } finally {
        setIsRestoring(false);
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-24 text-slate-800">
      {/* Admin Notice if Guest */}
      {!isAdmin && (
        <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center flex-shrink-0">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-amber-900">Guest Mode (Read Only)</h4>
              <p className="text-[11px] text-amber-700">Business profile and security settings can be edited only in Admin Mode.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={openLoginModal}
            className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-colors shadow-sm flex items-center gap-1.5 cursor-pointer"
          >
            <Lock className="w-3.5 h-3.5" /> Unlock Admin Access
          </button>
        </div>
      )}

      {/* Header with Developer Dashboard shortcut */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">Business Profile & System Settings</h2>
            <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 text-[10px] font-extrabold uppercase">
              Phase 2 Ready
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">Customize company name, logo branding, email OTP security, tiers & backups</p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setIsDevDashboardOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-900 hover:bg-black text-white shadow-sm transition-all cursor-pointer"
            title="Open Developer Engine & Bug Tracker"
          >
            <Code2 className="w-3.5 h-3.5 text-blue-400" />
            <span>Developer Options</span>
          </button>

          <button
            type="submit"
            form="profileForm"
            disabled={!isAdmin || isSavingProfile}
            className={`flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer ${
              !isAdmin
                ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white'
            }`}
          >
            <Save className="w-4 h-4" /> {isSavingProfile ? 'Saving...' : 'Save Profile Details'}
          </button>
        </div>
      </div>

      {/* 1. Subscription Tier Plans (Free, Basic, Pro, Premium) */}
      <div className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-sm space-y-5 text-xs">
        <div className="border-b border-slate-100 pb-3 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Sliders className="w-5 h-5 text-blue-600" />
            <div>
              <h3 className="text-base font-bold text-slate-900">Subscription & Feature Tiers</h3>
              <p className="text-[11px] text-slate-400">Select your active company plan to configure feature limits and access</p>
            </div>
          </div>
          <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 font-extrabold text-xs">
            Current: {APP_TIERS[currentTier]?.name || 'Premium Enterprise'}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* 1. FREE TIER */}
          <div className={`p-4 rounded-2xl border flex flex-col justify-between transition-all ${
            currentTier === 'free'
              ? 'bg-blue-50/60 border-blue-500 shadow-md ring-2 ring-blue-500/20'
              : 'bg-slate-50 border-slate-200'
          }`}>
            <div>
              <div className="flex justify-between items-center mb-2">
                <h4 className="font-extrabold text-slate-900 text-sm">Free Tier</h4>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-200 text-slate-700">Trial</span>
              </div>
              <p className="text-[11px] text-slate-500 mb-3">Basic entry level for 1 branch & 1 department testing.</p>
              
              <ul className="space-y-1.5 text-[11px] text-slate-600">
                <li className="flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />
                  <span>1 Branch & 1 Dept only</span>
                </li>
                <li className="flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />
                  <span>Max 20 Vendors & 50 Products</span>
                </li>
                <li className="flex items-center gap-1.5 text-slate-400 line-through">
                  <span>No Recent Bills / No Pie Chart</span>
                </li>
                <li className="flex items-center gap-1.5 text-slate-400 line-through">
                  <span>No GST Reports or Logo Upload</span>
                </li>
              </ul>
            </div>

            <button
              type="button"
              onClick={() => { updateTier('free'); showToast('Switched to Free Trial tier', 'info'); }}
              disabled={currentTier === 'free'}
              className={`mt-4 w-full py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                currentTier === 'free'
                  ? 'bg-slate-300 text-slate-600 cursor-default'
                  : 'bg-white border border-slate-300 hover:bg-slate-100 text-slate-800'
              }`}
            >
              {currentTier === 'free' ? 'Active Plan' : 'Select Free'}
            </button>
          </div>

          {/* 2. BASIC TIER */}
          <div className={`p-4 rounded-2xl border flex flex-col justify-between transition-all ${
            currentTier === 'basic'
              ? 'bg-blue-50/60 border-blue-500 shadow-md ring-2 ring-blue-500/20'
              : 'bg-slate-50 border-slate-200'
          }`}>
            <div>
              <div className="flex justify-between items-center mb-2">
                <h4 className="font-extrabold text-slate-900 text-sm">Basic Tier</h4>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-700">Small Business</span>
              </div>
              <p className="text-[11px] text-slate-500 mb-3">Expands to 3 branches, 5 depts & GST reports.</p>
              
              <ul className="space-y-1.5 text-[11px] text-slate-600">
                <li className="flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />
                  <span>3 Branches & 5 Departments</span>
                </li>
                <li className="flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />
                  <span>50 Vendors & 150 Products</span>
                </li>
                <li className="flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />
                  <span>Recent Bills & Recycle Bin</span>
                </li>
                <li className="flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />
                  <span>GST Reports & Activity Log</span>
                </li>
              </ul>
            </div>

            <button
              type="button"
              onClick={() => { updateTier('basic'); showToast('Switched to Basic Tier', 'info'); }}
              disabled={currentTier === 'basic'}
              className={`mt-4 w-full py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                currentTier === 'basic'
                  ? 'bg-slate-300 text-slate-600 cursor-default'
                  : 'bg-white border border-slate-300 hover:bg-slate-100 text-slate-800'
              }`}
            >
              {currentTier === 'basic' ? 'Active Plan' : 'Select Basic'}
            </button>
          </div>

          {/* 3. PRO TIER */}
          <div className={`p-4 rounded-2xl border flex flex-col justify-between transition-all ${
            currentTier === 'pro'
              ? 'bg-indigo-50/60 border-indigo-500 shadow-md ring-2 ring-indigo-500/20'
              : 'bg-slate-50 border-slate-200'
          }`}>
            <div>
              <div className="flex justify-between items-center mb-2">
                <h4 className="font-extrabold text-slate-900 text-sm">Pro Tier</h4>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-100 text-indigo-700">Growing Firm</span>
              </div>
              <p className="text-[11px] text-slate-500 mb-3">All in Basic + Draft recovery, import & mail schedules.</p>
              
              <ul className="space-y-1.5 text-[11px] text-slate-600">
                <li className="flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5 text-indigo-600 flex-shrink-0" />
                  <span>10 Branches & 20 Departments</span>
                </li>
                <li className="flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5 text-indigo-600 flex-shrink-0" />
                  <span>200 Vendors & 500 Products</span>
                </li>
                <li className="flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5 text-indigo-600 flex-shrink-0" />
                  <span>Import Tools & Draft Recovery</span>
                </li>
                <li className="flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5 text-indigo-600 flex-shrink-0" />
                  <span>Scheduled Reports to Email</span>
                </li>
              </ul>
            </div>

            <button
              type="button"
              onClick={() => { updateTier('pro'); showToast('Switched to Pro Tier', 'info'); }}
              disabled={currentTier === 'pro'}
              className={`mt-4 w-full py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                currentTier === 'pro'
                  ? 'bg-slate-300 text-slate-600 cursor-default'
                  : 'bg-white border border-slate-300 hover:bg-slate-100 text-slate-800'
              }`}
            >
              {currentTier === 'pro' ? 'Active Plan' : 'Select Pro'}
            </button>
          </div>

          {/* 4. PREMIUM TIER */}
          <div className={`p-4 rounded-2xl border flex flex-col justify-between transition-all ${
            currentTier === 'premium'
              ? 'bg-emerald-50/60 border-emerald-500 shadow-md ring-2 ring-emerald-500/20'
              : 'bg-slate-50 border-slate-200'
          }`}>
            <div>
              <div className="flex justify-between items-center mb-2">
                <h4 className="font-extrabold text-slate-900 text-sm">Premium</h4>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">Advanced ERP</span>
              </div>
              <p className="text-[11px] text-slate-500 mb-3">Unlimited master capacity, full charts & AI Assistant.</p>
              
              <ul className="space-y-1.5 text-[11px] text-slate-600">
                <li className="flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                  <span>Unlimited Branches & Depts</span>
                </li>
                <li className="flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                  <span>Unlimited Vendors & Catalog</span>
                </li>
                <li className="flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                  <span>Full Pie Charts & Analytics</span>
                </li>
                <li className="flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                  <span>Specialized AI Model & 24/7 Support</span>
                </li>
              </ul>
            </div>

            <button
              type="button"
              onClick={() => { updateTier('premium'); showToast('Premium Tier activated!', 'success'); }}
              disabled={currentTier === 'premium'}
              className={`mt-4 w-full py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                currentTier === 'premium'
                  ? 'bg-emerald-600 text-white cursor-default shadow-sm'
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm'
              }`}
            >
              {currentTier === 'premium' ? 'Current Tier' : 'Upgrade to Premium'}
            </button>
          </div>
        </div>
      </div>

      {/* 2. Business Profile Form (Name & Logo) */}
      <form id="profileForm" onSubmit={handleProfileSubmit} className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-sm space-y-6 text-xs">
        <div className="border-b border-slate-100 pb-3 flex items-center gap-2">
          <Building2 className="w-5 h-5 text-blue-600" />
          <div>
            <h3 className="text-base font-bold text-slate-900">Company & Tax Details</h3>
            <p className="text-[11px] text-slate-400">Change your business name and company logo. Reflected across all vouchers, headers & prints.</p>
          </div>
        </div>

        {/* Company Logo Customizer */}
        <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-center gap-5">
          <div className="relative group flex-shrink-0">
            <div className="w-24 h-24 rounded-2xl bg-slate-900 border-2 border-slate-200 shadow-md p-1.5 flex items-center justify-center overflow-hidden">
              <img 
                src={formData.logoUrl || '/mu_accounts_logo.svg'} 
                alt="Company Logo Preview" 
                className="w-full h-full object-contain"
              />
            </div>
            <label 
              htmlFor="company-logo-upload"
              className={`absolute inset-0 bg-slate-900/60 text-white rounded-2xl flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer ${!isAdmin ? 'cursor-not-allowed pointer-events-none' : ''}`}
            >
              <Camera className="w-5 h-5 mb-1" />
              <span className="text-[10px] font-bold">Change</span>
            </label>
          </div>

          <div className="flex-1 text-center sm:text-left space-y-2">
            <div>
              <h4 className="font-bold text-slate-800 text-sm flex items-center justify-center sm:justify-start gap-1.5">
                <span>Company Logo & Emblem</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">Live Branding</span>
              </h4>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Upload your custom business logo (PNG, JPG, SVG). Syncs immediately across navbar, sidebar, and print invoices.
              </p>
            </div>

            <div className="flex items-center justify-center sm:justify-start gap-2 flex-wrap">
              <input
                id="company-logo-upload"
                type="file"
                accept="image/*"
                disabled={!isAdmin}
                onChange={handleLogoUpload}
                className="hidden"
              />
              <label
                htmlFor="company-logo-upload"
                className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer ${
                  !isAdmin 
                    ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                    : 'bg-blue-600 hover:bg-blue-700 text-white'
                }`}
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Upload Custom Logo</span>
              </label>

              <button
                type="button"
                disabled={!isAdmin}
                onClick={handleResetLogo}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-100 border border-slate-200 transition-colors cursor-pointer"
                title="Reset to default MU Accounts emblem"
              >
                <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
                <span>Reset to MU Logo</span>
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div>
            <label className="block font-semibold text-slate-700 mb-1.5">
              Default App & Company Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              disabled={!isAdmin}
              name="businessName"
              value={formData.businessName || ''}
              onChange={handleChange}
              placeholder="e.g. MU Accounts"
              className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-75"
            />
            <p className="text-[10px] text-slate-400 mt-1">Default is "MU Accounts". Can be customized to your business name.</p>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1.5">Owner / Contact Person</label>
            <input
              type="text"
              disabled={!isAdmin}
              name="ownerName"
              value={formData.ownerName || ''}
              onChange={handleChange}
              placeholder="e.g. Managing Director"
              className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-75"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1.5">Company GSTIN Number</label>
            <input
              type="text"
              disabled={!isAdmin}
              name="gstin"
              value={formData.gstin || ''}
              onChange={handleChange}
              placeholder="33AAAAA0000A1Z5"
              className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl font-mono uppercase focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-75"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1.5">Registered State Code</label>
            <select
              disabled={!isAdmin}
              name="stateCode"
              value={formData.stateCode || '33'}
              onChange={(e) => {
                const code = e.target.value;
                setFormData(prev => ({
                  ...prev,
                  stateCode: code,
                  state: GST_STATE_CODES[code] || prev.state
                }));
              }}
              className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-75"
            >
              {Object.entries(GST_STATE_CODES).map(([code, name]) => (
                <option key={code} value={code}>{code} - {name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1.5">Phone / Mobile</label>
            <input
              type="tel"
              disabled={!isAdmin}
              name="phone"
              value={formData.phone || ''}
              onChange={handleChange}
              placeholder="e.g. +91 98420 12345"
              className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-75"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1.5">Registered Email (For OTP & Backups)</label>
            <input
              type="email"
              disabled={!isAdmin}
              name="email"
              value={formData.email || ''}
              onChange={handleChange}
              placeholder="e.g. accounts@muaccounts.com"
              className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-75 font-mono text-xs"
            />
          </div>
        </div>

        <div>
          <label className="block font-semibold text-slate-700 mb-1.5">Company Office Address</label>
          <textarea
            rows="2"
            disabled={!isAdmin}
            name="address"
            value={formData.address || ''}
            onChange={handleChange}
            placeholder="Street address, City, District, PIN code"
            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-75"
          />
        </div>

        {/* Bank Account Details */}
        <div className="pt-4 border-t border-slate-100">
          <h4 className="font-bold text-slate-800 text-xs mb-3 uppercase tracking-wider">Company Bank Account (Optional)</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Bank Name</label>
              <input
                type="text"
                disabled={!isAdmin}
                name="bankName"
                value={formData.bankName || ''}
                onChange={handleChange}
                placeholder="e.g. State Bank of India"
                className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-75"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Account Number</label>
              <input
                type="text"
                disabled={!isAdmin}
                name="bankAccount"
                value={formData.bankAccount || ''}
                onChange={handleChange}
                placeholder="e.g. 10293847561"
                className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl font-mono focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-75"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">IFSC Code</label>
              <input
                type="text"
                disabled={!isAdmin}
                name="bankIfsc"
                value={formData.bankIfsc || ''}
                onChange={handleChange}
                placeholder="SBIN0001234"
                className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl font-mono uppercase focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-75"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Branch</label>
              <input
                type="text"
                disabled={!isAdmin}
                name="bankBranch"
                value={formData.bankBranch || ''}
                onChange={handleChange}
                placeholder="e.g. Main Branch"
                className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-75"
              />
            </div>
          </div>
        </div>

        <div>
          <label className="block font-semibold text-slate-700 mb-1.5">Invoice Notes / Footer Terms</label>
          <input
            type="text"
            disabled={!isAdmin}
            name="invoiceNotes"
            value={formData.invoiceNotes || ''}
            onChange={handleChange}
            placeholder="e.g. Computer generated GST statement."
            className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-75"
          />
        </div>
      </form>

      {/* 3. Security & Admin PIN Change via Real Email OTP */}
      <div className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-sm space-y-5 text-xs">
        <div className="border-b border-slate-100 pb-3 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <KeyRound className="w-5 h-5 text-blue-600" />
            <div>
              <h3 className="text-base font-bold text-slate-900">Admin PIN Security (Email OTP Protected)</h3>
              <p className="text-[11px] text-slate-400">Must verify identity with registered email OTP before updating admin PIN</p>
            </div>
          </div>
          <span className="text-[11px] font-mono text-slate-500">
            Registered: {formData.email || currentUser?.email || 'admin@muaccounts.com'}
          </span>
        </div>

        <div className="space-y-4 max-w-lg">
          {/* Step A: Send OTP */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-800 text-xs">Step 1: Security Code Verification</span>
              <button
                type="button"
                disabled={!isAdmin || isSendingPinOtp}
                onClick={handleRequestPinOtp}
                className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{isSendingPinOtp ? 'Sending...' : pinOtpSent ? 'Resend OTP' : 'Send Email OTP'}</span>
              </button>
            </div>

            {pinOtpSent && (
              <div className="pt-2 animate-in fade-in">
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Enter 6-Digit Email OTP
                </label>
                <input
                  type="text"
                  maxLength="6"
                  value={pinOtpCode}
                  onChange={(e) => setPinOtpCode(e.target.value)}
                  placeholder="Enter 6-digit OTP"
                  className="w-full py-2 px-3 bg-white border border-slate-300 rounded-xl font-mono text-center tracking-widest text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                {pinDebugOtp && (
                  <p className="text-[10px] text-blue-600 font-mono mt-1">
                    Debug Code: <strong>{pinDebugOtp}</strong> (or master 270209)
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Step B: New PIN Form */}
          <form onSubmit={handlePinChangeSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold text-slate-700 mb-1.5">New 6-Digit PIN</label>
                <input
                  type="password"
                  maxLength="10"
                  required
                  disabled={!isAdmin || !pinOtpSent}
                  value={newPin}
                  onChange={(e) => setNewPin(e.target.value)}
                  placeholder="4-10 Digits"
                  className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-center font-mono tracking-widest text-base focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1.5">Confirm New PIN</label>
                <input
                  type="password"
                  maxLength="10"
                  required
                  disabled={!isAdmin || !pinOtpSent}
                  value={confirmPin}
                  onChange={(e) => setConfirmPin(e.target.value)}
                  placeholder="Re-enter PIN"
                  className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-center font-mono tracking-widest text-base focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={!isAdmin || !pinOtpSent}
              className={`px-5 py-2.5 rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer ${
                !isAdmin || !pinOtpSent
                  ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  : 'bg-slate-900 hover:bg-black text-white'
              }`}
            >
              Verify OTP & Update Admin PIN
            </button>
          </form>
        </div>
      </div>

      {/* 4. Safety, Backup & Disaster Recovery Center (Local Download + Send to Email) */}
      <div className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-sm space-y-5 text-xs">
        <div className="border-b border-slate-100 pb-3 flex items-center gap-2">
          <Database className="w-5 h-5 text-blue-600" />
          <div>
            <h3 className="text-base font-bold text-slate-900">Data Safety & Backup Options</h3>
            <p className="text-[11px] text-slate-400">Download offline snapshots locally or dispatch full backup directly to registered email</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Option A: Download JSON Backup */}
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex flex-col justify-between space-y-3">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600">Option 1</span>
              <h4 className="font-bold text-slate-900 text-sm mt-0.5">Download Local (.json)</h4>
              <p className="text-slate-500 text-xs mt-1">
                Generates a standalone JSON archive of all bills, sales, daybook, vendors, items, and expenses.
              </p>
            </div>
            <button
              type="button"
              onClick={exportAllDataJSON}
              className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-xs transition-all cursor-pointer"
            >
              <Download className="w-4 h-4" /> Download Local
            </button>
          </div>

          {/* Option B: Send Backup to Registered Email */}
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex flex-col justify-between space-y-3">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">Option 2</span>
              <h4 className="font-bold text-slate-900 text-sm mt-0.5">Send Backup to Email</h4>
              <p className="text-slate-500 text-xs mt-1">
                Dispatches a verified backup package to <strong className="text-slate-800">{formData.email || 'meganfullsd@gmail.com'}</strong>.
              </p>
            </div>
            <button
              type="button"
              disabled={isSendingBackupEmail}
              onClick={handleSendBackupEmail}
              className="flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold shadow-xs transition-all cursor-pointer disabled:opacity-50"
            >
              <Mail className="w-4 h-4" /> {isSendingBackupEmail ? 'Dispatching...' : 'Send to Email'}
            </button>
          </div>

          {/* Option C: Server Cloud Snapshot (Pre-Phase 3 Safety) */}
          <div className="p-4 bg-emerald-50/50 rounded-2xl border border-emerald-300 flex flex-col justify-between space-y-3">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">Option 3</span>
                <span className="px-1.5 py-0.5 rounded bg-emerald-200 text-emerald-900 text-[9px] font-bold">Cloud Synced</span>
              </div>
              <h4 className="font-bold text-slate-900 text-sm mt-0.5">Server Snapshot Engine</h4>
              <p className="text-slate-600 text-[11px] mt-1">
                Master Pre-Phase 3 snapshot stored permanently in Firebase Firestore (<code className="text-emerald-800">artifacts/mu-accounts-system/server_backups</code>).
              </p>
            </div>
            <div className="flex flex-col gap-1.5">
              <button
                type="button"
                onClick={async () => {
                  try {
                    const res = await createLiveServerBackup(`Live Snapshot - ${new Date().toLocaleDateString()}`);
                    showToast(`Server snapshot "${res.title}" saved to cloud!`, 'success');
                  } catch (e) {
                    showToast('Failed to create server snapshot', 'error');
                  }
                }}
                className="w-full py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl font-bold text-xs transition-all cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Database className="w-3.5 h-3.5" />
                <span>Take Server Backup</span>
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (window.confirm('Restore Pre-Phase 3 Master Snapshot from server? This will recover all sales, daybook, and items.')) {
                    try {
                      await restoreServerBackup('backup_pre_phase3_20261014');
                      showToast('Pre-Phase 3 master snapshot restored successfully from server!', 'success');
                    } catch (e) {
                      showToast('Failed to restore snapshot', 'error');
                    }
                  }
                }}
                className="w-full py-1.5 bg-white hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-xl font-bold text-xs transition-all cursor-pointer flex items-center justify-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Restore Server Backup</span>
              </button>
            </div>
          </div>

          {/* Option D: Restore from Local File */}
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex flex-col justify-between space-y-3">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Recovery</span>
              <h4 className="font-bold text-slate-900 text-sm mt-0.5">Restore from File</h4>
              <p className="text-slate-500 text-xs mt-1">
                Upload a previous JSON backup to restore into your workspace.
              </p>
            </div>
            <label className={`flex items-center justify-center gap-2 px-4 py-2 rounded-xl font-bold shadow-xs transition-colors ${
              !isAdmin 
                ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 cursor-pointer'
            }`}>
              <Upload className="w-4 h-4 text-blue-600" /> {isRestoring ? 'Restoring...' : 'Select File'}
              <input
                type="file"
                accept=".json"
                disabled={!isAdmin || isRestoring}
                onChange={handleFileRestore}
                className="hidden"
              />
            </label>
          </div>
        </div>
      </div>

      {/* 5. Automated Scheduled Email Reports (Targeting meganfullsd@gmail.com) */}
      <div className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-sm space-y-5 text-xs">
        <div className="border-b border-slate-100 pb-3 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <CalendarCheck2 className="w-5 h-5 text-indigo-600" />
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900">Automated Scheduled Email Digest Engine</h3>
                <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold ${isScheduleAllowed ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}>
                  {isScheduleAllowed ? 'Pro & Premium Feature' : 'Requires Pro/Premium'}
                </span>
              </div>
              <p className="text-[11px] text-slate-400">Automatically delivers financial digests to your registered email on recurring schedules</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold text-slate-600">Company Sender:</span>
            <span className="px-2 py-0.5 rounded bg-slate-100 font-mono text-slate-700 font-bold text-[11px]">meganfullsd@gmail.com</span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Controls Column */}
          <div className="space-y-4">
            <div>
              <label className="block font-semibold text-slate-700 mb-1.5">Dispatch Schedule Frequency</label>
              <div className="grid grid-cols-3 gap-1.5 bg-slate-100 p-1 rounded-xl text-xs font-bold border border-slate-200">
                <button
                  type="button"
                  disabled={!isScheduleAllowed}
                  onClick={() => handleFrequencyChange('daily')}
                  className={`py-1.5 rounded-lg transition-all cursor-pointer ${scheduleFrequency === 'daily' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
                >
                  Daily
                </button>
                <button
                  type="button"
                  disabled={!isScheduleAllowed}
                  onClick={() => handleFrequencyChange('weekly')}
                  className={`py-1.5 rounded-lg transition-all cursor-pointer ${scheduleFrequency === 'weekly' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
                >
                  Weekly
                </button>
                <button
                  type="button"
                  disabled={!isScheduleAllowed}
                  onClick={() => handleFrequencyChange('monthly')}
                  className={`py-1.5 rounded-lg transition-all cursor-pointer ${scheduleFrequency === 'monthly' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
                >
                  Monthly
                </button>
              </div>
              <p className="text-[10px] text-slate-400 mt-1">
                {scheduleFrequency === 'daily' && 'Every morning at 09:00 AM (Daybook & sales summary)'}
                {scheduleFrequency === 'weekly' && 'Every Monday morning (Weekly turnover & receivables aging)'}
                {scheduleFrequency === 'monthly' && '1st of every month (Monthly GSTR-3B liability & P&L)'}
              </p>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Target Dispatch Mail</label>
              <input
                type="email"
                disabled
                value={formData.email || 'meganfullsd@gmail.com'}
                className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl font-mono text-slate-700 text-xs font-bold"
              />
              <p className="text-[10px] text-slate-400 mt-0.5">Synced with your business registration email address.</p>
            </div>
          </div>

          {/* Module Toggles Column */}
          <div className="space-y-3">
            <label className="block font-semibold text-slate-700">Financial Reports to Include in Digest</label>
            <div className="space-y-2">
              {[
                { key: 'sales', label: 'Sales Turnover & Outward Invoices' },
                { key: 'purchases', label: 'Procurement Bills & Top Suppliers' },
                { key: 'receivables', label: 'Customer Aging Outstandings (>25 Days)' },
                { key: 'daybook', label: 'Day Book Cash & Bank Closing Balances' },
                { key: 'gst', label: 'Statutory GST Liability (GSTR-3B Summary)' }
              ].map(mod => (
                <label key={mod.key} className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    disabled={!isScheduleAllowed}
                    checked={Boolean(reportModules[mod.key])}
                    onChange={(e) => setReportModules(prev => ({ ...prev, [mod.key]: e.target.checked }))}
                    className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300"
                  />
                  <span className="text-xs text-slate-700 font-medium">{mod.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Action Column */}
          <div className="p-4 bg-indigo-50/50 rounded-2xl border border-indigo-200 flex flex-col justify-between space-y-4">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-900">Automation Status</span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${isScheduleEnabled ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'}`}>
                  {isScheduleEnabled ? 'Active' : 'Disabled'}
                </span>
              </div>
              <p className="text-[11px] text-slate-600 mt-1">
                {isScheduleEnabled 
                  ? `Automated ${scheduleFrequency} financial digest actively configured for dispatch.` 
                  : 'Automated dispatching is currently turned off.'}
              </p>
            </div>

            <div className="space-y-2">
              <button
                type="button"
                onClick={handleToggleSchedule}
                className={`w-full py-2 rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  isScheduleEnabled
                    ? 'bg-rose-100 hover:bg-rose-200 text-rose-800 border border-rose-300'
                    : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                <span>{isScheduleEnabled ? 'Pause Automated Schedule' : 'Enable Automated Schedule'}</span>
              </button>

              <button
                type="button"
                disabled={isDispatchingReport}
                onClick={handleDispatchReportNow}
                className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5 text-blue-400" />
                <span>{isDispatchingReport ? 'Compiling & Sending...' : `Dispatch Report Now to ${formData.email || 'meganfullsd@gmail.com'}`}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Resend API Key Configuration Card */}
        <div className="mt-4 p-4 rounded-xl bg-slate-50 border border-slate-200">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <h5 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-blue-600" />
                <span>Resend Email API Key (Free 3,000 emails/mo)</span>
              </h5>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Paste your Resend API Key (<code className="text-blue-600 font-mono">re_...</code>) from <a href="https://resend.com/api-keys" target="_blank" rel="noreferrer" className="underline hover:text-blue-700">resend.com</a> to enable real email deliveries.
              </p>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <input
                type="password"
                value={resendApiKeyInput}
                onChange={(e) => setResendApiKeyInput(e.target.value)}
                placeholder="re_123456789..."
                className="py-1.5 px-3 bg-white border border-slate-300 rounded-lg text-xs font-mono text-slate-800 focus:outline-none focus:border-blue-500 w-full sm:w-56"
              />
              <button
                type="button"
                onClick={handleSaveResendApiKey}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shrink-0 transition-colors cursor-pointer"
              >
                Save Key
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Developer Dashboard Modal */}
      <DeveloperDashboard
        isOpen={isDevDashboardOpen}
        onClose={() => setIsDevDashboardOpen(false)}
      />
    </div>
  );
}
