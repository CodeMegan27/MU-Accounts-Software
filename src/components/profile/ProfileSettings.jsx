import React, { useState, useEffect } from 'react';
import { useSettings } from '../../context/SettingsContext';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import { useToast } from '../../context/ToastContext';
import { GST_STATE_CODES } from '../../utils/gstCalculations';
import { 
  Building2, 
  Save, 
  Lock, 
  ShieldCheck, 
  Download, 
  Upload, 
  Database,
  CheckCircle2,
  KeyRound
} from 'lucide-react';

export default function ProfileSettings() {
  const { profile, updateProfile } = useSettings();
  const { updateAdminPin, isAdmin, openLoginModal } = useAuth();
  const { exportAllDataJSON, restoreAllData, bills, vendors } = useData();
  const { showToast } = useToast();

  const [formData, setFormData] = useState({ ...profile });
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [isRestoring, setIsRestoring] = useState(false);

  useEffect(() => {
    setFormData({ ...profile });
  }, [profile]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
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
        showToast('Business profile updated successfully!', 'success');
      }
    } catch (err) {
      console.error('Failed to update profile:', err);
      showToast('Error saving business profile', 'error');
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handlePinChangeSubmit = (e) => {
    e.preventDefault();
    if (!isAdmin) {
      showToast('Unlock current Admin Access first', 'error');
      openLoginModal();
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
      showToast('Admin PIN updated successfully!', 'success');
      setNewPin('');
      setConfirmPin('');
    } else {
      showToast(res.error || 'Failed to update PIN', 'error');
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
    <div className="max-w-4xl mx-auto space-y-8 pb-24">
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
            className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-colors shadow-sm flex items-center gap-1.5"
          >
            <Lock className="w-3.5 h-3.5" /> Unlock Admin Access
          </button>
        </div>
      )}

      {/* Header */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">Business Profile & System Settings</h2>
          <p className="text-xs text-slate-500 mt-0.5">Customize your company details for tax invoices, PIN credentials, and backups</p>
        </div>
        <button
          type="submit"
          form="profileForm"
          disabled={!isAdmin || isSavingProfile}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold shadow-md transition-all ${
            !isAdmin
              ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
              : 'bg-brand-600 hover:bg-brand-700 active:bg-brand-800 text-white'
          }`}
        >
          <Save className="w-4 h-4" /> {isSavingProfile ? 'Saving...' : 'Save Profile Details'}
        </button>
      </div>

      {/* 1. Business Profile Form */}
      <form id="profileForm" onSubmit={handleProfileSubmit} className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-sm space-y-6 text-xs">
        <div className="border-b border-slate-100 pb-3 flex items-center gap-2">
          <Building2 className="w-5 h-5 text-brand-600" />
          <div>
            <h3 className="text-base font-bold text-slate-900">Company & Tax Details</h3>
            <p className="text-[11px] text-slate-400">These details will automatically appear on your printed purchase bills and reports</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div>
            <label className="block font-semibold text-slate-700 mb-1.5">
              Business / Company Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              disabled={!isAdmin}
              name="businessName"
              value={formData.businessName || ''}
              onChange={handleChange}
              placeholder="e.g. RS Purchase Enterprise"
              className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:opacity-75"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1.5">Owner / Contact Person</label>
            <input
              type="text"
              disabled={!isAdmin}
              name="ownerName"
              value={formData.ownerName || ''}
              onChange={handleChange}
              placeholder="e.g. Meganathan"
              className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:opacity-75"
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
              className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl font-mono uppercase focus:bg-white focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:opacity-75"
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
              className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:opacity-75"
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
              className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:opacity-75"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1.5">Email Address</label>
            <input
              type="email"
              disabled={!isAdmin}
              name="email"
              value={formData.email || ''}
              onChange={handleChange}
              placeholder="e.g. accounts@rspurchase.com"
              className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:opacity-75"
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
            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:opacity-75"
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
                className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:opacity-75"
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
                className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl font-mono focus:bg-white focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:opacity-75"
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
                className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl font-mono uppercase focus:bg-white focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:opacity-75"
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
                placeholder="e.g. Ramnad Main Branch"
                className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:opacity-75"
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
            placeholder="e.g. Computer generated inward purchase statement."
            className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:opacity-75"
          />
        </div>
      </form>

      {/* 2. Security & Admin PIN Change Form */}
      <div className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-sm space-y-5 text-xs">
        <div className="border-b border-slate-100 pb-3 flex items-center gap-2">
          <KeyRound className="w-5 h-5 text-brand-600" />
          <div>
            <h3 className="text-base font-bold text-slate-900">Admin PIN Security</h3>
            <p className="text-[11px] text-slate-400">Change your security PIN used to unlock Admin Mode</p>
          </div>
        </div>

        <form onSubmit={handlePinChangeSubmit} className="space-y-4 max-w-md">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-slate-700 mb-1.5">New Admin PIN</label>
              <input
                type="password"
                maxLength="10"
                required
                disabled={!isAdmin}
                value={newPin}
                onChange={(e) => setNewPin(e.target.value)}
                placeholder="4-10 Digits"
                className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-center font-mono tracking-widest text-base focus:bg-white focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:opacity-75"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1.5">Confirm New PIN</label>
              <input
                type="password"
                maxLength="10"
                required
                disabled={!isAdmin}
                value={confirmPin}
                onChange={(e) => setConfirmPin(e.target.value)}
                placeholder="Re-enter PIN"
                className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-center font-mono tracking-widest text-base focus:bg-white focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:opacity-75"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={!isAdmin}
            className={`px-5 py-2.5 rounded-xl text-xs font-semibold shadow-sm transition-all ${
              !isAdmin ? 'bg-slate-300 text-slate-500 cursor-not-allowed' : 'bg-slate-900 hover:bg-black text-white'
            }`}
          >
            Update Admin PIN
          </button>
        </form>
      </div>

      {/* 3. Safety, Backup & Disaster Recovery Center */}
      <div className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-sm space-y-5 text-xs">
        <div className="border-b border-slate-100 pb-3 flex items-center gap-2">
          <Database className="w-5 h-5 text-brand-600" />
          <div>
            <h3 className="text-base font-bold text-slate-900">Data Safety & Backup Center</h3>
            <p className="text-[11px] text-slate-400">Download offline snapshots of all your purchase records or restore data</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {/* Download JSON Backup */}
          <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200 flex flex-col justify-between space-y-3">
            <div>
              <h4 className="font-bold text-slate-900 text-sm">Download Full Backup (.json)</h4>
              <p className="text-slate-500 text-xs mt-1">
                Generates a complete standalone JSON archive of all {bills.length} bills, {vendors.length} vendors, items, and expenses.
              </p>
            </div>
            <button
              type="button"
              onClick={exportAllDataJSON}
              className="flex items-center justify-center gap-2 px-4 py-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-xl font-semibold shadow-sm transition-all"
            >
              <Download className="w-4 h-4" /> Download JSON Backup
            </button>
          </div>

          {/* Restore JSON Backup */}
          <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200 flex flex-col justify-between space-y-3">
            <div>
              <h4 className="font-bold text-slate-900 text-sm">Restore from File</h4>
              <p className="text-slate-500 text-xs mt-1">
                Upload a previous JSON backup file to sync or recover data into your Firebase database.
              </p>
            </div>
            <label className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-semibold shadow-sm transition-colors ${
              !isAdmin 
                ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 cursor-pointer'
            }`}>
              <Upload className="w-4 h-4 text-brand-600" /> {isRestoring ? 'Restoring...' : 'Select Backup File'}
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
    </div>
  );
}
