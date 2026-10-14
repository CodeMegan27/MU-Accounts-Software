import React, { useState } from 'react';
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
  RefreshCw,
  LogOut,
  ChevronDown,
  Sparkles,
  Building2
} from 'lucide-react';

export default function Navbar({ activeTab, onToggleSidebar, onOpenCreateBill }) {
  const { 
    currentUser, 
    userRole, 
    availableRoles, 
    switchRole, 
    currentTier, 
    tierConfig, 
    logout 
  } = useAuth();
  
  const { isOnline, isCloudSynced, pendingSyncCount, syncPendingQueue } = useData();
  const { profile } = useSettings();
  const [isRoleMenuOpen, setIsRoleMenuOpen] = useState(false);

  const getPageTitle = (tab) => {
    switch (tab) {
      case 'dashboard': return 'Dashboard';
      case 'masters': return 'Branch & Department Master';
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
      default: return `${profile?.businessName || 'MU Accounts'} Enterprise`;
    }
  };

  const getRoleInitials = (role) => {
    if (!role) return 'MU';
    if (role.includes('MD')) return 'MD';
    if (role.includes('Accountant')) return 'AC';
    if (role.includes('Sales')) return 'SA';
    if (role.includes('Purchase')) return 'PA';
    if (role.includes('Developer')) return 'DV';
    return 'AD';
  };

  return (
    <header className="no-print h-16 bg-white border-b border-slate-200 flex items-center justify-between px-3 sm:px-6 z-20 flex-shrink-0 shadow-sm">
      <div className="flex items-center gap-2 sm:gap-4 min-w-0">
        <button
          onClick={onToggleSidebar}
          className="text-slate-500 hover:text-slate-900 p-2 -ml-1 rounded-xl hover:bg-slate-100 transition-colors flex-shrink-0 cursor-pointer"
          title="Toggle Navigation Menu"
          aria-label="Toggle navigation"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2 min-w-0">
          <img 
            src={profile?.logoUrl || "/mu_accounts_logo.svg"} 
            alt={profile?.businessName || "MU Accounts"} 
            className="w-7 h-7 object-contain rounded-md bg-white border border-slate-200 hidden sm:block" 
          />
          <div className="min-w-0">
            <h1 className="text-sm sm:text-lg font-extrabold text-slate-900 leading-tight truncate">
              {getPageTitle(activeTab)}
            </h1>
            <p className="text-[10px] sm:text-[11px] text-slate-500 font-semibold truncate hidden xs:block">
              {profile.businessName || 'MU Accounts'}
            </p>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1.5 sm:gap-3 flex-shrink-0">
        {/* Prominent Online / Offline / Cloud Sync Indication (Untouched) */}
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
              className="flex items-center gap-1 hover:underline text-[11px] cursor-pointer"
              title="Click to sync now"
            >
              <RefreshCw className="w-3 h-3 animate-spin" />
              <span>Sync ({pendingSyncCount})</span>
            </button>
          ) : (
            <span className="text-[11px] font-bold hidden sm:inline">Synced</span>
          )}
        </div>

        {/* User Identity & Staff Role Dropdown */}
        <div className="relative">
          <button
            onClick={() => setIsRoleMenuOpen(prev => !prev)}
            className="flex items-center gap-1.5 sm:gap-2 px-2.5 py-1 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl transition-all shadow-xs cursor-pointer text-left"
            title="Click to switch staff role"
          >
            {/* User Initials Avatar */}
            <div className="w-6 h-6 rounded-lg bg-blue-600 text-white font-extrabold text-[10px] flex items-center justify-center flex-shrink-0 shadow-xs">
              {getRoleInitials(userRole)}
            </div>

            <div className="hidden md:block leading-tight">
              <p className="text-[11px] font-bold text-slate-800 truncate max-w-[120px]">
                {currentUser?.name || 'Staff User'}
              </p>
              <p className="text-[9px] font-extrabold text-blue-600 uppercase tracking-wider truncate max-w-[120px]">
                {userRole}
              </p>
            </div>

            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-blue-100 text-blue-800 hidden lg:inline">
              {tierConfig?.badge || 'Premium'}
            </span>

            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          </button>

          {/* Role Switching Dropdown Menu */}
          {isRoleMenuOpen && (
            <>
              <div 
                className="fixed inset-0 z-30" 
                onClick={() => setIsRoleMenuOpen(false)} 
              />
              <div className="absolute right-0 mt-2 w-56 bg-white border border-slate-200 rounded-2xl shadow-xl p-2 z-40 animate-in fade-in zoom-in-95 duration-150">
                <div className="px-3 py-2 border-b border-slate-100 mb-1">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Active Workspace</p>
                  <p className="text-xs font-bold text-slate-900 truncate">{currentUser?.companyName || 'MU Accounts'}</p>
                  <p className="text-[10px] text-slate-500 font-mono truncate">{currentUser?.email || 'meganfullsd@gmail.com'}</p>
                </div>

                <div className="px-3 py-1">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Switch Staff Role</p>
                </div>

                <div className="space-y-0.5">
                  {availableRoles.map((role) => (
                    <button
                      key={role}
                      onClick={() => {
                        switchRole(role);
                        setIsRoleMenuOpen(false);
                      }}
                      className={`w-full text-left px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center justify-between cursor-pointer transition-colors ${
                        userRole === role 
                          ? 'bg-blue-50 text-blue-700 font-bold' 
                          : 'text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <span className="truncate">{role}</span>
                      {userRole === role && (
                        <ShieldCheck className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Dedicated Lock / Logout Button (Logs out to Login Page) */}
        <button
          onClick={logout}
          className="flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-bold bg-rose-50 hover:bg-rose-100 active:bg-rose-200 text-rose-700 border border-rose-200 transition-all shadow-xs cursor-pointer"
          title="Lock session & return to Login Page"
        >
          <Lock className="w-3.5 h-3.5 flex-shrink-0 text-rose-600" />
          <span className="hidden sm:inline">Lock</span>
        </button>
      </div>
    </header>
  );
}
