import React, { useState, useMemo } from 'react';
import { useData } from '../../context/DataContext';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { formatCurrency } from '../../utils/formatters';
import { 
  Package, 
  Plus, 
  Search, 
  Trash2, 
  Edit2, 
  Sparkles, 
  Layers, 
  CheckCircle2, 
  Filter,
  RefreshCw,
  Box,
  Wrench
} from 'lucide-react';

export default function ItemsList({ onOpenCreateItem, onEditItem, onRequestDelete }) {
  const { items, syncItemsFromSalesData } = useData();
  const { isAdmin } = useAuth();
  const { showToast } = useToast();
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [isSyncing, setIsSyncing] = useState(false);

  // Available categories in the current item master
  const categories = useMemo(() => {
    const set = new Set();
    items.forEach(i => {
      if (i.category) set.add(i.category);
    });
    return ['ALL', ...Array.from(set).sort()];
  }, [items]);

  const filtered = useMemo(() => {
    return items.filter(i => {
      const matchesSearch = !search ||
        (i.name && i.name.toLowerCase().includes(search.toLowerCase())) ||
        (i.category && i.category.toLowerCase().includes(search.toLowerCase())) ||
        (i.uqc && i.uqc.toLowerCase().includes(search.toLowerCase()));

      const matchesCat = selectedCategory === 'ALL' || i.category === selectedCategory;

      return matchesSearch && matchesCat;
    });
  }, [items, search, selectedCategory]);

  const handleSyncFromSales = async () => {
    if (!isAdmin) {
      showToast('Admin privilege required to refresh item master', 'warning');
      return;
    }
    setIsSyncing(true);
    try {
      const count = await syncItemsFromSalesData();
      showToast(`Successfully synced ${count} clean items from previous sales records!`, 'success');
    } catch (e) {
      showToast('Failed to sync items: ' + e.message, 'error');
    } finally {
      setIsSyncing(false);
    }
  };

  // Unit badge coloring
  const getUnitBadgeStyle = (uqc) => {
    switch (uqc) {
      case 'SQFT':
        return 'bg-teal-50 text-teal-700 border-teal-200';
      case 'NOS':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'PAC':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'BOK':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'SHT':
      case 'RIM':
        return 'bg-orange-50 text-orange-700 border-orange-200';
      case 'SRV':
        return 'bg-slate-100 text-slate-700 border-slate-300';
      default:
        return 'bg-slate-50 text-slate-600 border-slate-200';
    }
  };

  const totalStockItems = items.filter(i => i.uqc !== 'SRV').length;
  const totalServiceItems = items.filter(i => i.uqc === 'SRV').length;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <Package className="w-6 h-6 text-brand-600" />
            <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">Item Master Catalog</h2>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Standardized products and units populated from previous sales data — clean stock grouping with no duplicate dimensions
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleSyncFromSales}
            disabled={isSyncing}
            className="flex items-center gap-1.5 px-3.5 py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-bold transition-all shadow-xs disabled:opacity-50 cursor-pointer"
            title="Reload clean items catalog from previous sales data"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'Syncing...' : 'Sync from Sales Data'}</span>
          </button>
          <button
            onClick={onOpenCreateItem}
            className="flex items-center gap-2 px-4 py-2.5 bg-brand-600 hover:bg-brand-700 active:bg-brand-800 text-white rounded-xl text-xs font-semibold transition-all shadow-sm hover:shadow-md cursor-pointer"
          >
            <Plus className="w-4 h-4" /> Add Item
          </button>
        </div>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Catalog Items</p>
          <p className="text-xl font-black text-slate-900 mt-1">{items.length}</p>
          <p className="text-[11px] text-slate-400 mt-0.5">Standardized catalog</p>
        </div>
        <div className="bg-emerald-50/60 p-4 rounded-xl border border-emerald-200 shadow-xs">
          <p className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider">Physical Products</p>
          <p className="text-xl font-black text-emerald-950 mt-1">{totalStockItems}</p>
          <p className="text-[11px] text-emerald-700 mt-0.5">Rolls, frames, books & boards</p>
        </div>
        <div className="bg-indigo-50/60 p-4 rounded-xl border border-indigo-200 shadow-xs">
          <p className="text-[11px] font-bold text-indigo-800 uppercase tracking-wider">Labour & Services</p>
          <p className="text-xl font-black text-indigo-950 mt-1">{totalServiceItems}</p>
          <p className="text-[11px] text-indigo-700 mt-0.5">Design, pasting, prints & cuts</p>
        </div>
        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 shadow-xs">
          <p className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">Categories</p>
          <p className="text-xl font-black text-slate-900 mt-1">{categories.length - 1}</p>
          <p className="text-[11px] text-slate-500 mt-0.5">Organized departments</p>
        </div>
      </div>

      {/* Search & Category Filter Toolbar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search items by product name, category, or unit (SQFT, NOS, PAC)..."
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>
          {search && (
            <button
              onClick={() => setSearch('')}
              className="text-xs text-slate-500 hover:text-slate-800 px-2 py-1 font-semibold"
            >
              Clear
            </button>
          )}
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 pt-1 text-xs">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1 mr-1">
            <Filter className="w-3 h-3" /> Filter:
          </span>
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                selectedCategory === cat
                  ? 'bg-brand-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {cat === 'ALL' ? 'All Items' : cat}
            </button>
          ))}
        </div>
      </div>

      {/* Items Table */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <span className="text-xs font-bold text-slate-700">
            Showing {filtered.length} of {items.length} Items
          </span>
          <span className="text-[11px] text-slate-500">
            GST Compliant UQC Units
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse whitespace-nowrap">
            <thead>
              <tr className="bg-slate-50 text-slate-500 border-b border-slate-200 text-xs uppercase font-semibold tracking-wider">
                <th className="px-6 py-3.5">Item Name</th>
                <th className="px-6 py-3.5">Category</th>
                <th className="px-6 py-3.5">UQC (Unit)</th>
                <th className="px-6 py-3.5 text-right">Default Rate (₹)</th>
                <th className="px-6 py-3.5 text-center w-24">Actions</th>
              </tr>
            </thead>
            <tbody className="text-sm divide-y divide-slate-100 text-slate-700">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan="5" className="text-center py-12 text-slate-400">
                    <Package className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                    <p className="text-base font-semibold text-slate-700">No items match your search</p>
                    <p className="text-xs text-slate-400 mt-1">Try clearing your filters or click "Sync from Sales Data"</p>
                  </td>
                </tr>
              ) : (
                filtered.map(item => (
                  <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-6 py-3.5">
                      <div className="font-bold text-slate-900">{item.name || 'N/A'}</div>
                    </td>
                    <td className="px-6 py-3.5">
                      <span className="inline-block px-2.5 py-0.5 rounded-md text-[11px] font-semibold bg-slate-100 text-slate-700">
                        {item.category || '-'}
                      </span>
                    </td>
                    <td className="px-6 py-3.5">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-[11px] font-mono font-bold border ${getUnitBadgeStyle(item.uqc)}`}>
                        {item.uqc || 'NOS'}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 text-right font-mono font-bold text-slate-900">
                      {item.defaultRate ? formatCurrency(item.defaultRate) : '-'}
                    </td>
                    <td className="px-6 py-3.5 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => onEditItem(item)}
                            className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors cursor-pointer"
                            title="Edit Item (Admin PIN Required)"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => onRequestDelete('items', item.id, item.name)}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                            title="Delete Item (Admin PIN Required)"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
