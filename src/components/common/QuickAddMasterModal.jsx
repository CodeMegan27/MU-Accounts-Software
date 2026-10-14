import React, { useState, useEffect, useRef } from 'react';
import { X, Plus, Building2, Layers, Tag, CreditCard, Sparkles } from 'lucide-react';

export default function QuickAddMasterModal({ isOpen = true, type, onClose, onAdd }) {
  const [val, setVal] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setVal('');
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const config = {
    branch: {
      title: 'Add New Branch / Location',
      label: 'Branch Code / Name',
      placeholder: 'e.g. MDU or COIMBATORE',
      description: 'Create a new business branch location for billing and expense tracking.',
      icon: Building2,
      color: 'blue'
    },
    department: {
      title: 'Add New Department',
      label: 'Department / Cost Center Name',
      placeholder: 'e.g. DIGITAL SIGNAGE or LED BOARDS',
      description: 'Assign orders, staff, and operating costs to this department.',
      icon: Layers,
      color: 'purple'
    },
    category: {
      title: 'Add New Expense Category',
      label: 'Expense Head / Category',
      placeholder: 'e.g. Generator Diesel, Facebook Ads, Software Subscription',
      description: 'Categorize indirect operating costs for P&L tracking.',
      icon: Tag,
      color: 'emerald'
    },
    paymentMethod: {
      title: 'Add Payment Method / Bank Account',
      label: 'Payment Method or Bank Name',
      placeholder: 'e.g. HDFC BANK, CANARA GPAY, PHONEPE, CASH-2',
      description: 'Record customer collections or disbursements to this payment channel.',
      icon: CreditCard,
      color: 'indigo'
    },
    item: {
      title: 'Quick Add Product to Catalog',
      label: 'Product / Item Name',
      placeholder: 'e.g. ACRYLIC SIGN BOARD or LED LETTER',
      description: 'Add a new product to master catalog so it syncs across both Sales & Purchases.',
      icon: Layers,
      color: 'indigo'
    }
  }[type] || {
    title: 'Add New Master Option',
    label: 'Name',
    placeholder: 'Enter name',
    description: '',
    icon: Plus,
    color: 'brand'
  };

  const Icon = config.icon;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!val.trim()) return;
    onAdd(val.trim());
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center text-white">
              <Icon className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold">{config.title}</h3>
              <p className="text-[10px] text-slate-400">Master Record Configuration</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors p-1 rounded-lg"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1.5">
              {config.label} <span className="text-red-500">*</span>
            </label>
            <input
              ref={inputRef}
              type="text"
              required
              value={val}
              onChange={(e) => setVal(e.target.value)}
              placeholder={config.placeholder}
              className="w-full py-2.5 px-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500 font-semibold text-slate-900 uppercase"
            />
            {config.description && (
              <p className="text-[11px] text-slate-400 mt-1.5">{config.description}</p>
            )}
          </div>

          <div className="pt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex items-center gap-1.5 px-5 py-2 bg-brand-600 hover:bg-brand-700 active:bg-brand-800 text-white rounded-xl font-bold shadow-md transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add & Select</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
