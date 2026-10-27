import React, { useState, useEffect } from 'react';
import { useData } from '../../context/DataContext';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { ArrowLeft, Check, Package, Lock } from 'lucide-react';

export default function ItemForm({ item, onBack }) {
  const { saveItem } = useData();
  const { isAdmin, openLoginModal } = useAuth();
  const { showToast } = useToast();

  const isEditing = Boolean(item);
  const canEdit = !isEditing || isAdmin;

  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [uqc, setUqc] = useState('NOS');
  const [defaultRate, setDefaultRate] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (item) {
      setName(item.name || '');
      setCategory(item.category || '');
      setUqc(item.uqc || 'NOS');
      setDefaultRate(item.defaultRate ? item.defaultRate.toString() : '');
    } else {
      setName('');
      setCategory('');
      setUqc('NOS');
      setDefaultRate('');
    }
  }, [item]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isEditing && !isAdmin) {
      showToast('Admin PIN required to edit item catalog', 'error');
      openLoginModal();
      return;
    }
    if (!name.trim()) {
      showToast('Please enter item name', 'error');
      return;
    }

    setIsSaving(true);
    try {
      const data = {
        id: item ? item.id : `I_${Date.now()}`,
        name: name.trim(),
        category: category.trim(),
        uqc: uqc.trim().toUpperCase(),
        defaultRate: parseFloat(defaultRate) || 0
      };

      await saveItem(data);
      showToast(isEditing ? 'Item updated!' : 'Item added to catalog!', 'success');
      onBack();
    } catch (err) {
      console.error('Error saving item:', err);
      showToast('Failed to save item', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto space-y-6 pb-20">
      {isEditing && !isAdmin && (
        <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center flex-shrink-0">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-amber-900">Admin PIN Required to Edit</h4>
              <p className="text-[11px] text-amber-700">Existing catalog items can be updated only with Admin Access.</p>
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

      <div className="flex items-center justify-between bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-2 text-slate-500 hover:text-slate-900 font-semibold text-xs transition-colors px-2 py-1"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Items
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
            form="itemForm"
            disabled={!canEdit || isSaving}
            className={`flex items-center gap-1.5 px-6 py-2 rounded-xl text-xs font-semibold shadow-md transition-all ${
              !canEdit ? 'bg-slate-300 text-slate-500 cursor-not-allowed' : 'bg-brand-600 hover:bg-brand-700 text-white'
            }`}
          >
            <Check className="w-4 h-4" /> {isSaving ? 'Saving...' : isEditing ? 'Update Item' : 'Save Item'}
          </button>
        </div>
      </div>

      <form id="itemForm" onSubmit={handleSubmit} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4 text-xs">
        <div className="border-b border-slate-100 pb-3">
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Package className="w-4 h-4 text-brand-600" /> {isEditing ? 'Edit Item' : 'New Master Item'}
          </h3>
          <p className="text-slate-400 text-xs mt-0.5">Catalog products for automatic filling inside bills</p>
        </div>

        <div>
          <label className="block font-semibold text-slate-700 mb-1.5">
            Product / Item Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            required
            disabled={!canEdit}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Copper Wire 2.5 sq mm"
            className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-1 focus:ring-brand-500 font-medium disabled:opacity-75"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Category</label>
            <input
              type="text"
              disabled={!canEdit}
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="e.g. Raw Materials"
              className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:opacity-75"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">UQC (Standard Unit)</label>
            <select
              disabled={!canEdit}
              value={uqc}
              onChange={(e) => setUqc(e.target.value)}
              className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-1 focus:ring-brand-500 uppercase font-mono disabled:opacity-75"
            >
              <option value="NOS">NOS</option>
              <option value="KGS">KGS</option>
              <option value="LTR">LTR</option>
              <option value="MTR">MTR</option>
              <option value="BOX">BOX</option>
              <option value="PCS">PCS</option>
              <option value="SET">SET</option>
              <option value="PKT">PKT</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block font-semibold text-slate-700 mb-1">Default Purchase Rate (₹)</label>
          <input
            type="number"
            step="0.01"
            min="0"
            disabled={!canEdit}
            value={defaultRate}
            onChange={(e) => setDefaultRate(e.target.value)}
            placeholder="0.00"
            className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl font-mono focus:bg-white focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:opacity-75"
          />
        </div>
      </form>
    </div>
  );
}
