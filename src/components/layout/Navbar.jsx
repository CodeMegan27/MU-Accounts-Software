import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import { useSettings } from '../../context/SettingsContext';
import { 
  Menu, 
  Lock, 
  Unlock, 
  Cloud, 
  Database, 
  WifiOff, 
  ShieldCheck, 
  User, 
  RefreshCw
} from 'lucide-react';

export default function Navbar({ activeTab, onToggleSidebar, onOpenCreateBill }) {
  const { isAdmin, openLoginModal, logout } = useAuth();
  const { isOnline, isCloudSynced, pendingSyncCount, syncPendingQueue } = useData();
  const { profile } = useSettings();

  const getPageTitle = (tab) => {
    switch (tab) {
      case 'dashboard': return 'Dashboard';
      case 'salesOrders': return 'Sales Orders (Estimates & Jobs)';
      case 'sales': return 'Sales Register & Invoices';
      case 'createSale': return 'Create Sales Order / Job';
      case 'saleDetail': return 'Sales Order & Tax Invoice';
      case 'vouchers': return 'Payment & Receipt Voucher Book';
      case 'pnl': return 'Profit & Loss Statement';
      case 'bills': return 'Purchase Register';
      case 'createBill': return 'Bill Entry';
      case 'billDetail': return 'Purchase Tax Bill';
      case 'vendors': return 'Vendor Directory';
      case 'createVendor': return 'Vendor Info';
      case 'vendorLedger': return 'Vendor Ledger';
      case 'items': return 'Item Master';
      case 'createItem': return 'Item Entry';
      case 'expenses': return 'Expense Register';
      case 'createExpense': return 'Record Expense';
      case 'assets': return 'Fixed Assets';
      case 'createAsset': return 'Record Asset';
      case 'reports': return 'Master GST Returns Center';
      case 'gstr1': return 'GSTR-1 Outward Supplies & Tax Liability';
      case 'gstr2b': return 'GSTR-2B Inward Supplies (Purchase ITC)';
      case 'gstr3b': return 'GSTR-3B Monthly Return & Tax Payment';
      case 'logs': return 'Audit & Activity Trail';
      case 'profile': return 'Profile & Settings';
      default: return 'RS DESIGNS Enterprise';
    }
  };

  return (
    <header className="no-print h-16 bg-white border-b border-slate-200 flex items-center justify-between px-3 sm:px-6 z-20 flex-shrink-0 shadow-sm">
      <div className="flex items-center gap-2 sm:gap-4 min-w-0">
        <button
          onClick={onToggleSidebar}
          className="text-slate-500 hover:text-slate-900 p-2 -ml-1 rounded-xl hover:bg-slate-100 transition-colors flex-shrink-0"
          title="Toggle Navigation Menu"
          aria-label="Toggle navigation"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2 min-w-0">
          <img 
            src="/rs_designs_logo.jpg" 
            alt="RS DESIGNS" 
            className="w-7 h-7 object-contain rounded-md bg-white border border-slate-200 hidden sm:block" 
          />
          <div className="min-w-0">
            <h1 className="text-sm sm:text-lg font-extrabold text-slate-900 leading-tight truncate">
              {getPageTitle(activeTab)}
            </h1>
            <p className="text-[10px] sm:text-[11px] text-slate-500 font-semibold truncate hidden xs:block">
              {profile.businessName || 'RS DESIGNS'}
            </p>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1.5 sm:gap-3 flex-shrink-0">
        {/* Prominent Online / Offline / Cloud Sync Indication */}
        <div
          className={`flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1 rounded-full text-xs font-semibold border transition-all ${
            !isOnline
              ? 'bg-red-50 text-red-700 border-red-200'
              : pendingSyncCount > 0
              ? 'bg-amber-50 text-amber-800 border-amber-300'
              : 'bg-emerald-50 text-emerald-700 border-emerald-200'
          }`}
          title={
            !isOnline
              ? "Offline mode - all changes saved locally and synced automatically when connected"
              : pendingSyncCount > 0
              ? `${pendingSyncCount} local changes queued for cloud sync`
              : "Connected and synchronized with Firebase Cloud"
          }
        >
          <span className="relative flex h-2 w-2 sm:h-2.5 sm:w-2.5 flex-shrink-0">
            <span
              className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                !isOnline ? 'bg-red-400' : pendingSyncCount > 0 ? 'bg-amber-400' : 'bg-emerald-400'
              }`}
            />
            <span
              className={`relative inline-flex rounded-full h-2 w-2 sm:h-2.5 sm:w-2.5 ${
                !isOnline ? 'bg-red-500' : pendingSyncCount > 0 ? 'bg-amber-500' : 'bg-emerald-500'
              }`}
            />
          </span>

          {!isOnline ? (
            <span className="text-[11px] font-bold">Offline</span>
          ) : pendingSyncCount > 0 ? (
            <button
              onClick={syncPendingQueue}
              className="flex items-center gap-1 hover:underline text-[11px]"
              title="Click to sync now"
            >
              <RefreshCw className="w-3 h-3 animate-spin" />
              <span>Sync ({pendingSyncCount})</span>
            </button>
          ) : (
            <span className="text-[11px] font-bold hidden sm:inline">Synced</span>
          )}
        </div>

        {/* Role Badge */}
        <div
          className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border ${
            isAdmin
              ? 'bg-brand-50 text-brand-700 border-brand-200'
              : 'bg-slate-100 text-slate-600 border-slate-200'
          }`}
        >
          {isAdmin ? (
            <>
              <ShieldCheck className="w-3.5 h-3.5 text-brand-600 flex-shrink-0" />
              <span className="hidden sm:inline">Admin</span>
            </>
          ) : (
            <>
              <User className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
              <span className="hidden sm:inline">Guest</span>
            </>
          )}
        </div>

        {/* Admin Login / Logout PIN Trigger Button */}
        {isAdmin ? (
          <button
            onClick={logout}
            className="flex items-center gap-1 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-semibold bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 transition-colors shadow-sm"
            title="Lock Admin Mode"
          >
            <Unlock className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Lock</span>
          </button>
        ) : (
          <button
            onClick={openLoginModal}
            className="flex items-center gap-1 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-semibold bg-brand-600 hover:bg-brand-700 active:bg-brand-800 text-white transition-all shadow-sm"
            title="Enter PIN for Admin Access"
          >
            <Lock className="w-3.5 h-3.5" />
            <span className="hidden xs:inline">PIN</span>
          </button>
        )}
      </div>
    </header>
  );
}
