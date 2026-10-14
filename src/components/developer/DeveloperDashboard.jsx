import React, { useState } from 'react';
import { useAuth, APP_TIERS } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import { useToast } from '../../context/ToastContext';
import { 
  Code2, 
  Bug, 
  CheckCircle2, 
  Clock, 
  Zap, 
  Layers, 
  Database, 
  ShieldCheck, 
  Sparkles, 
  X, 
  RefreshCw, 
  Building2, 
  Sliders,
  Mail,
  Send,
  Download,
  RotateCcw,
  AlertTriangle
} from 'lucide-react';

export default function DeveloperDashboard({ isOpen, onClose }) {
  const { 
    currentTier, 
    updateTier, 
    userRole, 
    currentUser, 
    activeTenantId, 
    switchTenant,
    developerEmail,
    companyDispatchEmail,
    sendEmailOtp,
    isDeveloperBypassEnabled,
    setIsDeveloperBypassEnabled
  } = useAuth();
  
  const { 
    bills, 
    vendors, 
    items, 
    expenses, 
    assets, 
    sales,
    daybookTransactions,
    isOnline, 
    pendingSyncCount,
    syncPendingQueue,
    createLiveServerBackup,
    restoreServerBackup,
    serverBackupsList
  } = useData();
  
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState('server_backups'); // 'server_backups' | 'updates' | 'bugs' | 'tiers' | 'diagnostics'
  
  // Snapshot creation state
  const [snapshotTitle, setSnapshotTitle] = useState('');
  const [isCreatingSnapshot, setIsCreatingSnapshot] = useState(false);
  const [isRestoringSnapshot, setIsRestoringSnapshot] = useState(false);

  // Email test state
  const [testUserEmail, setTestUserEmail] = useState('');
  const [testOtpResult, setTestOtpResult] = useState(null);
  const [isSendingTestOtp, setIsSendingTestOtp] = useState(false);

  if (!isOpen) return null;

  const ongoingUpdates = [
    {
      title: "Loading Screen Overhaul to MU Accounts & Logo",
      phase: "Phase 1 / 2",
      status: "COMPLETED",
      date: "Oct 2026",
      desc: "Replaced old legacy splash screen with high-performance vector MU Accounts brand, enterprise ERP subtitle and glowing cyan-blue theme."
    },
    {
      title: "Dedicated Full Login Gate (Loading -> Login -> Dashboard)",
      phase: "Phase 1 / 2",
      status: "COMPLETED",
      date: "Oct 2026",
      desc: "Added 6-digit security code unlock, email OTP sign-in, and multi-tenant isolated workspaces."
    },
    {
      title: "Official Developer Account & Company Email Configuration",
      phase: "Pre-Phase 3",
      status: "COMPLETED",
      date: "Oct 2026",
      desc: "Set meganfullsd@gmail.com as master Developer email and official company dispatch address for sending user OTPs and backups."
    },
    {
      title: "Permanent Server Backup & Cloud Snapshot System",
      phase: "Pre-Phase 3",
      status: "COMPLETED",
      date: "Oct 2026",
      desc: "Captured full live company snapshot in Firebase Firestore server to safeguard against future update changes."
    },
    {
      title: "Multi-Tenant Company Isolation per User ID",
      phase: "Phase 2",
      status: "COMPLETED",
      date: "Oct 2026",
      desc: "Isolated data namespaces in server (artifacts/mu-accounts-tenants/...) and scoped local database so users' data never merges."
    },
    {
      title: "Tier-Based Plan Feature Matrix (Free, Basic, Pro, Premium)",
      phase: "Phase 2",
      status: "COMPLETED",
      date: "Oct 2026",
      desc: "Defined 4 pricing tiers with feature caps on branches, departments, vendors, items, and AI tools."
    }
  ];

  const bugTasks = [
    {
      id: "TASK-DEV-01",
      title: "Master Developer Credentials Configuration",
      status: "RESOLVED",
      severity: "High",
      fix: "Assigned meganfullsd@gmail.com as primary developer authentication and OTP company sender."
    },
    {
      id: "TASK-DEV-02",
      title: "Pre-Phase 3 Server Snapshot Archive",
      status: "RESOLVED",
      severity: "High",
      fix: "Built server snapshot engine with permanent Firestore mirror and 1-click disaster recovery."
    },
    {
      id: "BUG-101",
      title: "TDZ ReferenceError on Activity Logger",
      status: "RESOLVED",
      severity: "High",
      fix: "Relocated logActivity definition before daybook initialization."
    },
    {
      id: "BUG-102",
      title: "Residual RS Designs branding references",
      status: "RESOLVED",
      severity: "Medium",
      fix: "Purged hardcoded strings across bill detail, sale detail, index.html and daybook."
    }
  ];

  const handleCreateSnapshot = async (e) => {
    e.preventDefault();
    setIsCreatingSnapshot(true);
    try {
      const res = await createLiveServerBackup(snapshotTitle || `Developer Live Snapshot - ${new Date().toLocaleTimeString()}`);
      showToast(`Server snapshot "${res.title}" created & mirrored to cloud!`, 'success');
      setSnapshotTitle('');
    } catch (err) {
      console.error(err);
      showToast('Failed to create server backup', 'error');
    } finally {
      setIsCreatingSnapshot(false);
    }
  };

  const handleRestoreSnapshot = async (snapshot) => {
    if (!window.confirm(`Are you sure you want to restore "${snapshot.title || snapshot.id}"? All records will be recovered to this exact point.`)) {
      return;
    }

    setIsRestoringSnapshot(true);
    try {
      const res = await restoreServerBackup(snapshot);
      showToast(`Successfully restored: ${res.salesCount || 0} sales, ${res.daybookCount || 0} daybook entries, ${res.itemsCount || 0} items!`, 'success');
    } catch (err) {
      console.error(err);
      showToast('Failed to restore server snapshot', 'error');
    } finally {
      setIsRestoringSnapshot(false);
    }
  };

  const handleTestSendOtp = async (e) => {
    e.preventDefault();
    if (!testUserEmail || !testUserEmail.includes('@')) {
      showToast('Enter a valid recipient user email', 'error');
      return;
    }

    setIsSendingTestOtp(true);
    try {
      const res = await sendEmailOtp(testUserEmail);
      setTestOtpResult(res);
      showToast(`Dispatched from ${companyDispatchEmail} to ${testUserEmail}`, 'info');
    } catch (err) {
      showToast('Error dispatching OTP', 'error');
    } finally {
      setIsSendingTestOtp(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden text-slate-200">
        
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-slate-800 flex items-center justify-between bg-slate-950/60 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-600/20 border border-blue-500/40 text-blue-400 flex items-center justify-center shadow-inner">
              <Code2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-black text-white">Developer Engine & Diagnostics</h3>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-extrabold uppercase tracking-wider border border-emerald-500/30">
                  {developerEmail || 'meganfullsd@gmail.com'}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Master Developer ID: <strong className="text-blue-400 font-mono">meganfullsd@gmail.com</strong> • Company Dispatch: <strong className="text-emerald-400 font-mono">meganfullsd@gmail.com</strong>
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-800 px-6 bg-slate-950/30 flex-shrink-0 overflow-x-auto text-xs font-bold">
          <button
            onClick={() => setActiveTab('server_backups')}
            className={`py-3 px-4 border-b-2 transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'server_backups'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Database className="w-4 h-4" />
            <span>Server Snapshots & Recovery (Phase 3 Safety)</span>
          </button>

          <button
            onClick={() => setActiveTab('updates')}
            className={`py-3 px-4 border-b-2 transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'updates'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            <span>Roadmap & Updates</span>
          </button>

          <button
            onClick={() => setActiveTab('bugs')}
            className={`py-3 px-4 border-b-2 transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'bugs'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Bug className="w-4 h-4" />
            <span>Task & Bug Tracker</span>
          </button>

          <button
            onClick={() => setActiveTab('tiers')}
            className={`py-3 px-4 border-b-2 transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'tiers'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sliders className="w-4 h-4" />
            <span>Live Tier Switcher</span>
          </button>

          <button
            onClick={() => setActiveTab('diagnostics')}
            className={`py-3 px-4 border-b-2 transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'diagnostics'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Email & System Diagnostics</span>
          </button>
        </div>

        {/* Tab Content Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4">
          
          {/* TAB 1: SERVER SNAPSHOTS & DISASTER RECOVERY (REQUIREMENT 2) */}
          {activeTab === 'server_backups' && (
            <div className="space-y-4 text-xs">
              <div className="p-4 bg-emerald-950/40 border border-emerald-800/60 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Database className="w-4 h-4 text-emerald-400" />
                    <h4 className="font-extrabold text-white text-sm">Server Snapshot Safety Engine</h4>
                    <span className="px-2 py-0.5 rounded bg-emerald-900/80 text-emerald-300 text-[10px] font-mono font-bold">
                      Permanent Cloud Mirror Active
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-300">
                    A complete master snapshot of all company data is stored in the server (<code className="text-emerald-400">artifacts/mu-accounts-system/server_backups</code>). If anything happens in future Phase 3 updates, you can restore full data with 1-click.
                  </p>
                </div>
              </div>

              {/* Create Instant Server Snapshot Form */}
              <form onSubmit={handleCreateSnapshot} className="p-4 bg-slate-950/60 border border-slate-800 rounded-2xl flex flex-col sm:flex-row items-center gap-3">
                <input
                  type="text"
                  value={snapshotTitle}
                  onChange={(e) => setSnapshotTitle(e.target.value)}
                  placeholder="Snapshot Name (e.g. Pre-Phase 3 Milestone Snapshot)"
                  className="flex-1 py-2 px-3.5 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-emerald-500"
                />
                <button
                  type="submit"
                  disabled={isCreatingSnapshot}
                  className="w-full sm:w-auto px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-sm disabled:opacity-50"
                >
                  <Database className="w-3.5 h-3.5" />
                  <span>{isCreatingSnapshot ? 'Saving Snapshot...' : 'Take Live Server Backup Now'}</span>
                </button>
              </form>

              {/* List of Registered Server Snapshots */}
              <div className="space-y-3">
                <h5 className="font-bold uppercase tracking-wider text-slate-400 text-[11px]">
                  Available Server Snapshots ({serverBackupsList?.length || 0})
                </h5>

                <div className="space-y-2.5">
                  {(serverBackupsList || []).map((snapshot) => (
                    <div
                      key={snapshot.id}
                      className="p-4 bg-slate-950/70 border border-slate-800 hover:border-slate-700 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-3 transition-colors"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-400 border border-blue-500/30 text-[10px] font-mono font-bold">
                            {snapshot.id === 'backup_pre_phase3_20261014' ? 'PRE-PHASE 3 MASTER' : 'SNAPSHOT'}
                          </span>
                          <h6 className="font-extrabold text-white text-sm">{snapshot.title}</h6>
                          <span className="text-[10px] text-slate-500 font-mono">
                            {new Date(snapshot.createdAt).toLocaleString()}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400">
                          Created by: <strong className="text-slate-300">{snapshot.createdBy || 'meganfullsd@gmail.com'}</strong> • 
                          Sales: <strong className="text-emerald-400">{snapshot.summary?.salesCount || snapshot.sales?.length || 0}</strong> • 
                          Daybook: <strong className="text-blue-400">{snapshot.summary?.daybookCount || snapshot.daybook?.length || 0}</strong> • 
                          Master Items: <strong className="text-amber-400">{snapshot.summary?.itemsCount || snapshot.items?.length || 0}</strong>
                        </p>
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button
                          type="button"
                          disabled={isRestoringSnapshot}
                          onClick={() => handleRestoreSnapshot(snapshot)}
                          className="px-3.5 py-1.5 bg-emerald-600/20 hover:bg-emerald-600 text-emerald-400 hover:text-white border border-emerald-500/40 rounded-xl font-bold transition-all cursor-pointer flex items-center gap-1.5 text-xs shadow-xs"
                          title="Restore live company data from this snapshot"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>Restore Snapshot</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: UPDATES & ROADMAP */}
          {activeTab === 'updates' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Release Milestones & Status
                </h4>
                <span className="text-[11px] text-blue-400 font-semibold">Version 2.4.0 (MU Accounts 2026)</span>
              </div>

              <div className="space-y-3">
                {ongoingUpdates.map((item, idx) => (
                  <div
                    key={idx}
                    className="p-4 bg-slate-950/60 border border-slate-800 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-slate-700 transition-colors"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase ${
                          item.status === 'COMPLETED'
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                        }`}>
                          {item.status}
                        </span>
                        <span className="text-xs text-slate-500 font-mono">{item.phase}</span>
                        <h5 className="text-sm font-bold text-white">{item.title}</h5>
                      </div>
                      <p className="text-xs text-slate-400">{item.desc}</p>
                    </div>

                    <div className="text-right flex-shrink-0 text-[11px] font-mono text-slate-500">
                      {item.date}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: BUGS & TASK TRACKER */}
          {activeTab === 'bugs' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Defect Resolution & Enhancement Tasks
                </h4>
                <span className="text-[11px] text-emerald-400 font-semibold">Pre-Phase 3 Protected</span>
              </div>

              <div className="space-y-2.5">
                {bugTasks.map((task) => (
                  <div
                    key={task.id}
                    className="p-3.5 bg-slate-950/60 border border-slate-800 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-bold text-blue-400">{task.id}</span>
                        <h5 className="text-xs font-bold text-white">{task.title}</h5>
                      </div>
                      <p className="text-[11px] text-slate-400"><strong className="text-slate-300">Fix/Resolution:</strong> {task.fix}</p>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400">
                        {task.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 4: LIVE TIER SWITCHER */}
          {activeTab === 'tiers' && (
            <div className="space-y-4">
              <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <h6 className="text-xs font-bold text-white flex items-center gap-2">
                    <span>Developer Rule Bypass:</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-extrabold ${isDeveloperBypassEnabled ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40' : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'}`}>
                      {isDeveloperBypassEnabled ? 'ON (Bypassing All Rules)' : 'OFF (Strict Tier Rules Enforced)'}
                    </span>
                  </h6>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    When OFF, tier caps on branches, vendors, products, pie charts, and GST returns apply to everyone including MD and Developers.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const next = !isDeveloperBypassEnabled;
                    setIsDeveloperBypassEnabled(next);
                    showToast(next ? 'Developer bypass enabled (unlimited mode)' : 'Developer bypass turned OFF (tier limits enforced!)', next ? 'warning' : 'success');
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    isDeveloperBypassEnabled 
                      ? 'bg-amber-600 hover:bg-amber-500 text-white' 
                      : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                  }`}
                >
                  {isDeveloperBypassEnabled ? 'Turn Bypass OFF' : 'Enable Bypass'}
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {Object.values(APP_TIERS).map((tier) => {
                  const isActive = currentTier === tier.id;
                  return (
                    <div
                      key={tier.id}
                      className={`p-5 rounded-2xl border transition-all ${
                        isActive
                          ? 'bg-blue-950/40 border-blue-500 shadow-lg shadow-blue-500/20 ring-1 ring-blue-500'
                          : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <h5 className="text-sm font-extrabold text-white">{tier.name}</h5>
                          <span className="text-[10px] font-bold text-blue-400 uppercase">{tier.badge}</span>
                        </div>
                        {isActive ? (
                          <span className="px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-[10px] font-extrabold">
                            Active
                          </span>
                        ) : (
                          <button
                            onClick={() => {
                              updateTier(tier.id);
                              showToast(`Switched to ${tier.name}`, 'info');
                            }}
                            className="px-3 py-1 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-colors cursor-pointer"
                          >
                            Activate
                          </button>
                        )}
                      </div>

                      <ul className="space-y-1.5 text-[11px] text-slate-300">
                        <li className="flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
                          <span>Branches: <strong>{tier.maxBranches === 9999 ? 'Unlimited' : tier.maxBranches}</strong></span>
                        </li>
                        <li className="flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
                          <span>Departments: <strong>{tier.maxDepartments === 9999 ? 'Unlimited' : tier.maxDepartments}</strong></span>
                        </li>
                        <li className="flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
                          <span>Vendors Cap: <strong>{tier.maxVendors > 1000 ? 'Unlimited' : tier.maxVendors}</strong></span>
                        </li>
                        <li className="flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
                          <span>AI Chatbot: <strong>{tier.hasAiChat ? 'Full Access' : 'Restricted'}</strong></span>
                        </li>
                      </ul>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 5: EMAIL & SYSTEM DIAGNOSTICS */}
          {activeTab === 'diagnostics' && (
            <div className="space-y-4 text-xs">
              {/* Email Dispatch Test Form */}
              <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl space-y-3">
                <h5 className="font-bold text-white text-xs uppercase tracking-wider flex items-center gap-2">
                  <Mail className="w-4 h-4 text-emerald-400" />
                  <span>Company Email Dispatch Test (meganfullsd@gmail.com)</span>
                </h5>
                <p className="text-[11px] text-slate-400">
                  Test dispatching a real 6-digit OTP from official company email <strong className="text-emerald-400 font-mono">{companyDispatchEmail}</strong> to any user email.
                </p>

                <form onSubmit={handleTestSendOtp} className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="email"
                    required
                    value={testUserEmail}
                    onChange={(e) => setTestUserEmail(e.target.value)}
                    placeholder="Enter recipient user email (e.g. client@company.com)"
                    className="flex-1 py-2 px-3.5 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-emerald-500 font-mono"
                  />
                  <button
                    type="submit"
                    disabled={isSendingTestOtp}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{isSendingTestOtp ? 'Sending...' : 'Dispatch OTP from meganfullsd@gmail.com'}</span>
                  </button>
                </form>

                {testOtpResult && (
                  <div className="p-3 bg-emerald-950/40 border border-emerald-800/60 rounded-xl space-y-1 font-mono text-[11px]">
                    <p className="text-emerald-400 font-bold">✓ {testOtpResult.message}</p>
                    <p className="text-slate-300">Sender: {testOtpResult.fromEmail}</p>
                    <p className="text-slate-300">Recipient: {testOtpResult.toEmail}</p>
                    <p className="text-amber-300 font-bold">Generated OTP Code: {testOtpResult.debugOtp}</p>
                  </div>
                )}
              </div>

              {/* Storage & Environment Diagnostics */}
              <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl space-y-3">
                <h5 className="font-bold text-white text-xs uppercase tracking-wider">Account & Storage Environment</h5>
                <div className="space-y-1 text-[11px] font-mono">
                  <p><span className="text-slate-400">Developer Master ID:</span> <span className="text-emerald-400 font-bold">{developerEmail}</span></p>
                  <p><span className="text-slate-400">Company Dispatch Mail:</span> <span className="text-emerald-400 font-bold">{companyDispatchEmail}</span></p>
                  <p><span className="text-slate-400">Current Role:</span> <span className="text-blue-400">{userRole}</span></p>
                  <p><span className="text-slate-400">Active Tenant ID:</span> <span className="text-blue-400 font-bold">{activeTenantId}</span></p>
                  <p><span className="text-slate-400">Cloud Sync Status:</span> <span className={isOnline ? 'text-emerald-400' : 'text-red-400'}>{isOnline ? 'ONLINE' : 'OFFLINE'}</span></p>
                  <p><span className="text-slate-400">Pending Sync Queue:</span> <span className="text-amber-400">{pendingSyncCount} operations</span></p>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={syncPendingQueue}
                  className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold cursor-pointer transition-colors flex items-center justify-center gap-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Force Cloud Sync Now</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between flex-shrink-0 text-xs">
          <span className="text-slate-500 font-mono text-[10px]">MU Accounts • Developer Portal ({developerEmail})</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-semibold cursor-pointer transition-colors"
          >
            Close Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}
