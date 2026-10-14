import React, { useState, useEffect } from 'react';
import { useData } from '../../context/DataContext';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { ArrowLeft, Check, Users, Lock } from 'lucide-react';

export default function VendorForm({ vendor, onBack }) {
  const { saveVendor, vendors = [] } = useData();
  const { isAdmin, openLoginModal, tierConfig, isDeveloper } = useAuth();
  const { showToast } = useToast();

  const isEditing = Boolean(vendor);

  const [name, setName] = useState('');
  const [isGst, setIsGst] = useState(false);
  const [gstin, setGstin] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (vendor) {
      setName(vendor.name || '');
      setIsGst(vendor.gstStatus === 'GST');
      setGstin(vendor.gstin || '');
      setPhone(vendor.phone || '');
      setEmail(vendor.email || '');
      setAddress(vendor.address || '');
    } else {
      setName('');
      setIsGst(false);
      setGstin('');
      setPhone('');
      setEmail('');
      setAddress('');
    }
  }, [vendor]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isAdmin) {
      showToast('Admin PIN required to save vendor details', 'error');
      openLoginModal();
      return;
    }
    const maxV = tierConfig?.maxVendors || 20;
    if (!isEditing && vendors.length >= maxV) {
      showToast(`Vendor creation cap reached (${vendors.length}/${maxV}) on ${tierConfig?.name || 'current tier'}. Upgrade in Profile Settings to add more suppliers.`, 'warning');
      return;
    }
    if (!name.trim()) {
      showToast('Please enter the vendor party name', 'error');
      return;
    }

    setIsSaving(true);
    try {
      const data = {
        id: vendor ? vendor.id : `V_${Date.now()}`,
        name: name.trim().toUpperCase(),
        gstStatus: isGst ? 'GST' : 'UNREG',
        gstin: isGst ? gstin.trim().toUpperCase() : '',
        phone: phone.trim(),
        email: email.trim(),
        address: address.trim()
      };

      await saveVendor(data);
      showToast(isEditing ? 'Vendor updated successfully!' : 'Vendor added successfully!', 'success');
      onBack();
    } catch (err) {
      console.error('Error saving vendor:', err);
      showToast('Failed to save vendor', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-20">
      {!isAdmin && (
        <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center flex-shrink-0">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-amber-900">Read-Only Guest Mode</h4>
              <p className="text-[11px] text-amber-700">Vendor fields can be manually entered only with Admin Access.</p>
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
      <div className="flex items-center justify-between bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-2 text-slate-500 hover:text-slate-900 font-semibold text-xs transition-colors px-2 py-1"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Vendors
        </button>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onBack}
            className="px-4 py-2 border border-slate-300 text-slate-700 rounded-xl text-xs font-semibold hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="vendorForm"
            disabled={!isAdmin || isSaving}
            className={`flex items-center gap-1.5 px-6 py-2 rounded-xl text-xs font-semibold shadow-md transition-all ${
              !isAdmin ? 'bg-slate-300 text-slate-500 cursor-not-allowed' : 'bg-brand-600 hover:bg-brand-700 text-white'
            }`}
          >
            <Check className="w-4 h-4" /> {isSaving ? 'Saving...' : isEditing ? 'Update Vendor' : 'Save Vendor'}
          </button>
        </div>
      </div>

      {/* Form Content */}
      <form id="vendorForm" onSubmit={handleSubmit} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-5 text-xs">
        <div className="border-b border-slate-100 pb-3">
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Users className="w-4 h-4 text-brand-600" /> {isEditing ? 'Edit Vendor Details' : 'Add New Vendor'}
          </h3>
          <p className="text-slate-400 text-xs mt-0.5">Enter vendor registration details for bills and statutory compliance</p>
        </div>

        <div>
          <label className="block font-semibold text-slate-700 mb-1.5">
            Party / Vendor Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            required
            disabled={!isAdmin}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. SREE RAMAN AGENCIES"
            className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl uppercase font-semibold text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:opacity-75"
          />
        </div>

        {/* GST Switcher */}
        <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
          <div className="flex items-center gap-2.5">
            <input
              type="checkbox"
              id="vGst"
              disabled={!isAdmin}
              checked={isGst}
              onChange={(e) => setIsGst(e.target.checked)}
              className="w-4 h-4 text-brand-600 rounded border-slate-300 focus:ring-brand-500 cursor-pointer disabled:opacity-75"
            />
            <label htmlFor="vGst" className="font-semibold text-slate-800 cursor-pointer select-none">
              Vendor is GST Registered
            </label>
          </div>

          {isGst && (
            <div className="mt-3 pt-3 border-t border-slate-200">
              <label className="block font-semibold text-slate-700 mb-1">
                Vendor GSTIN Number <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required={isGst}
                disabled={!isAdmin}
                value={gstin}
                onChange={(e) => setGstin(e.target.value)}
                placeholder="33BMCPS7033J1ZY"
                className="w-full py-2 px-3 bg-white border border-slate-200 rounded-xl font-mono uppercase focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:opacity-75"
              />
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Contact Phone / Mobile</label>
            <input
              type="tel"
              disabled={!isAdmin}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="e.g. 9842012345"
              className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:opacity-75"
            />
          </div>
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Email Address</label>
            <input
              type="email"
              disabled={!isAdmin}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="vendor@company.com"
              className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:opacity-75"
            />
          </div>
        </div>

        <div>
          <label className="block font-semibold text-slate-700 mb-1">Billing Address & Location</label>
          <textarea
            rows="3"
            disabled={!isAdmin}
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Street address, City, District, PIN Code"
            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:opacity-75"
          />
        </div>
      </form>
    </div>
  );
}
