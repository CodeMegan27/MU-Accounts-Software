import React, { useState, useEffect } from 'react';
import { useData } from '../../context/DataContext';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { X, Check, Building2, Phone, Mail, MapPin, Landmark, ShieldAlert } from 'lucide-react';

export default function VendorEditModal({ vendor, isOpen, onClose, onSuccess }) {
  const { saveVendor } = useData();
  const { isAdmin, openLoginModal } = useAuth();
  const { showToast } = useToast();

  const [name, setName] = useState('');
  const [isGst, setIsGst] = useState(false);
  const [gstin, setGstin] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [openingBalance, setOpeningBalance] = useState('');
  const [openingBalanceType, setOpeningBalanceType] = useState('payable');
  const [openingBalanceDate, setOpeningBalanceDate] = useState('2026-04-01');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (vendor && isOpen) {
      setName(vendor.name || '');
      setIsGst(vendor.gstStatus === 'GST');
      setGstin(vendor.gstin || '');
      setPhone(vendor.phone || '');
      setEmail(vendor.email || '');
      setAddress(vendor.address || '');
      setOpeningBalance(
        vendor.openingBalance !== undefined && vendor.openingBalance !== null && vendor.openingBalance !== ''
          ? String(vendor.openingBalance)
          : ''
      );
      setOpeningBalanceType(vendor.openingBalanceType || 'payable');
      setOpeningBalanceDate(vendor.openingBalanceDate || '2026-04-01');
    }
  }, [vendor, isOpen]);

  if (!isOpen || !vendor) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isAdmin) {
      showToast('Admin PIN required to edit vendor details', 'error');
      openLoginModal();
      return;
    }

    if (!name.trim()) {
      showToast('Please enter the vendor party name', 'error');
      return;
    }

    if (isGst && !gstin.trim()) {
      showToast('Please enter GSTIN or uncheck GST Registered', 'error');
      return;
    }

    setIsSaving(true);
    try {
      const updatedData = {
        ...vendor,
        name: name.trim().toUpperCase(),
        gstStatus: isGst ? 'GST' : 'UNREG',
        gstin: isGst ? gstin.trim().toUpperCase() : '',
        phone: phone.trim(),
        email: email.trim(),
        address: address.trim(),
        openingBalance: openingBalance ? parseFloat(openingBalance) : 0,
        openingBalanceType: openingBalanceType || 'payable',
        openingBalanceDate: openingBalanceDate || '2026-04-01'
      };

      const result = await saveVendor(updatedData);
      showToast('Vendor details updated successfully!', 'success');
      if (onSuccess) onSuccess(result);
      onClose();
    } catch (err) {
      console.error('Failed to update vendor:', err);
      showToast('Failed to update vendor', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-xl overflow-hidden my-auto transform transition-all">
        {/* Header */}
        <div className="bg-slate-900 px-6 py-4 text-white flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-brand-500/20 text-brand-400 border border-brand-500/30 flex items-center justify-center">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Edit Vendor Profile</h3>
              <p className="text-xs text-slate-300 font-medium truncate max-w-[320px]">{vendor.name}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors p-1.5 hover:bg-slate-800 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Security Warning if not admin */}
        {!isAdmin && (
          <div className="bg-amber-50 p-3 border-b border-amber-200 flex items-center gap-2 text-xs text-amber-800">
            <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
            <span>Admin PIN required to save edits to this vendor profile.</span>
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Party Name */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Vendor Party Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. BALAJI TRADERS, SRI MEENAKSHI PAPERS"
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-semibold text-slate-900 focus:bg-white focus:ring-2 focus:ring-brand-500 focus:outline-none uppercase"
            />
          </div>

          {/* GST Registered & GSTIN */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <label htmlFor="isGstModal" className="text-xs font-bold text-slate-800 cursor-pointer">
                  GST Registered Supplier
                </label>
                <p className="text-[11px] text-slate-500">Enable if vendor holds a valid 15-digit GSTIN</p>
              </div>
              <input
                type="checkbox"
                id="isGstModal"
                checked={isGst}
                onChange={(e) => setIsGst(e.target.checked)}
                className="rounded text-brand-600 focus:ring-brand-500 w-5 h-5 cursor-pointer"
              />
            </div>

            {isGst && (
              <div className="pt-2 border-t border-slate-200">
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  GSTIN Number <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  maxLength={15}
                  value={gstin}
                  onChange={(e) => setGstin(e.target.value.toUpperCase())}
                  placeholder="e.g. 33AAAAA0000A1Z5"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-mono font-bold text-slate-900 focus:ring-2 focus:ring-brand-500 focus:outline-none uppercase"
                />
              </div>
            )}
          </div>

          {/* Contact Details Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Phone Number
              </label>
              <div className="relative">
                <Phone className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="e.g. 9876543210"
                  className="w-full pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-brand-500 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Email Address
              </label>
              <div className="relative">
                <Mail className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. accounts@vendor.com"
                  className="w-full pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-brand-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Business Address */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Billing / Business Address
            </label>
            <div className="relative">
              <textarea
                rows={2}
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Door No, Street Name, City, State, PIN"
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-brand-500 focus:outline-none resize-none"
              />
            </div>
          </div>

          {/* Opening Balance Settings */}
          <div className="bg-amber-50/50 p-4 rounded-xl border border-amber-200/80 space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-amber-900">
              <Landmark className="w-4 h-4 text-amber-600" />
              <span>Financial Year Opening Balance</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Balance (₹)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={openingBalance}
                  onChange={(e) => setOpeningBalance(e.target.value)}
                  placeholder="0.00"
                  className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono font-bold text-slate-900 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Balance Type
                </label>
                <select
                  value={openingBalanceType}
                  onChange={(e) => setOpeningBalanceType(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                >
                  <option value="payable">Payable (Dr - We owe)</option>
                  <option value="advance">Advance Paid (Cr - Surplus)</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  As of Date
                </label>
                <input
                  type="date"
                  value={openingBalanceDate}
                  onChange={(e) => setOpeningBalanceDate(e.target.value)}
                  className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="px-4 py-2 border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-semibold transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="flex items-center gap-2 px-5 py-2.5 bg-slate-900 hover:bg-black text-white rounded-xl text-xs font-bold shadow-md transition-colors disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Saving Changes...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" /> Save Vendor Changes
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
