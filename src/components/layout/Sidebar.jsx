import React, { useState } from 'react';
import { 
  LayoutDashboard, 
  FileText, 
  Users, 
  Package, 
  Receipt, 
  Building, 
  FileSpreadsheet, 
  Settings, 
  Box,
  X,
  History,
  TrendingUp,
  BarChart3,
  ClipboardList,
  BookOpen,
  CreditCard,
  Landmark,
  ChevronDown,
  ChevronRight,
  ArrowDownLeft
} from 'lucide-react';

export default function Sidebar({ activeTab, onSelectTab, isCollapsed, isMobileOpen, onCloseMobile }) {
  const [gstMenuOpen, setGstMenuOpen] = useState(true);

  const navSections = [
    {
      title: "Core",
      items: [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { id: 'vendors', label: 'Vendor List', icon: Users },
        { id: 'items', label: 'Product List', icon: Package },
        { id: 'expenses', label: 'Expenses', icon: Receipt },
      ]
    },

    {
      title: "Registers",
      items: [
        { id: 'bills', label: 'Purchase Register', icon: FileText },
        { id: 'payables', label: 'Vendor Payables', icon: CreditCard },
        { id: 'sales', label: 'Sales Register', icon: TrendingUp },
        { id: 'receivables', label: 'Customer Receivables', icon: ArrowDownLeft },
        { id: 'salesOrders', label: 'Sales Orders', icon: ClipboardList },
        { id: 'vouchers', label: 'Payment & Receipt Book', icon: Receipt },
      ]
    },
    {
      title: "Reports & Assets",
      items: [
        { id: 'daybook', label: 'Day Book', icon: BookOpen },
        { id: 'bankAccounts', label: 'Bank Accounts & BRS', icon: Landmark },
        { id: 'assets', label: 'Fixed Assets', icon: Building },
        { id: 'pnl', label: 'Profit & Loss A/C', icon: BarChart3 },
        { 
          id: 'reports', 
          label: 'GST Reports', 
          icon: FileSpreadsheet,
          subItems: [
            { id: 'gstr1', label: 'GSTR-1 (Sales)' },
            { id: 'gstr2b', label: 'GSTR-2B (Purchases ITC)' },
            { id: 'gstr3b', label: 'GSTR-3B (Monthly Summary)' }
          ]
        },
      ]
    },
    {
      title: "Audit & Config",
      items: [
        { id: 'logs', label: 'Activity Logs', icon: History },
        { id: 'profile', label: 'Profile & Settings', icon: Settings },
      ]
    }
  ];

  const handleItemClick = (id) => {
    onSelectTab(id);
    if (onCloseMobile) {
      onCloseMobile();
    }
  };

  const isGstActive = activeTab === 'reports' || activeTab === 'gstr1' || activeTab === 'gstr2b' || activeTab === 'gstr3b';

  const NavContent = ({ mobile = false }) => (
    <>
      {/* Brand Header */}
      <div className="h-16 flex items-center justify-between px-3.5 border-b border-slate-800 gap-2.5">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center p-0.5 flex-shrink-0 shadow-sm border border-slate-700 overflow-hidden">
            <img 
              src="/rs_designs_logo.jpg" 
              alt="RS DESIGNS" 
              className="w-full h-full object-contain"
            />
          </div>
          {(!isCollapsed || mobile) && (
            <div className="overflow-hidden whitespace-nowrap">
              <h2 className="font-black text-white text-base tracking-wide flex items-center gap-1.5">
                <span>RS DESIGNS</span>
              </h2>
              <p className="text-[10px] text-rose-400 font-bold tracking-wider uppercase">Enterprise Edition</p>
            </div>
          )}
        </div>

        {mobile && (
          <button
            onClick={onCloseMobile}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            title="Close menu"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-6">
        {navSections.map((sec, idx) => (
          <div key={idx} className="space-y-1">
            {(!isCollapsed || mobile) && (
              <p className="px-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                {sec.title}
              </p>
            )}
            {sec.items.map((item) => {
              const Icon = item.icon;
              const hasSubItems = Boolean(item.subItems && item.subItems.length > 0);
              const isItemActive = hasSubItems 
                ? (activeTab === item.id || item.subItems.some(sub => sub.id === activeTab))
                : activeTab === item.id;

              return (
                <div key={item.id} className="space-y-1">
                  <button
                    onClick={() => {
                      if (hasSubItems && (!isCollapsed || mobile)) {
                        setGstMenuOpen(prev => !prev);
                        handleItemClick(item.id);
                      } else {
                        handleItemClick(item.id);
                      }
                    }}
                    title={isCollapsed && !mobile ? item.label : undefined}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                      isItemActive
                        ? 'bg-brand-600 text-white font-semibold shadow-md shadow-brand-900/30'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800/70'
                    } ${isCollapsed && !mobile ? 'justify-center' : ''}`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Icon className={`w-4 h-4 flex-shrink-0 ${isItemActive ? 'text-white' : 'text-slate-400'}`} />
                      {(!isCollapsed || mobile) && <span className="truncate">{item.label}</span>}
                    </div>

                    {hasSubItems && (!isCollapsed || mobile) && (
                      <div className="text-slate-400">
                        {gstMenuOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                      </div>
                    )}
                  </button>

                  {/* Nested Sub-items (GSTR-1, GSTR-2B, GSTR-3B) */}
                  {hasSubItems && (!isCollapsed || mobile) && gstMenuOpen && (
                    <div className="ml-4 pl-3 border-l border-slate-800 space-y-1 py-1">
                      {item.subItems.map((sub) => {
                        const isSubActive = activeTab === sub.id;
                        return (
                          <button
                            key={sub.id}
                            onClick={() => handleItemClick(sub.id)}
                            className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                              isSubActive
                                ? 'bg-slate-800 text-rose-400 font-bold border border-slate-700'
                                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                            }`}
                          >
                            <span className="truncate">{sub.label}</span>
                            {isSubActive && (
                              <span className="w-1.5 h-1.5 rounded-full bg-rose-500 flex-shrink-0" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Footer Branding */}
      <div className="mt-auto p-4 border-t border-slate-800/80 text-center">
        {(!isCollapsed || mobile) ? (
          <div className="text-[10px] text-slate-500 font-medium tracking-wider opacity-75">
            Built by <span className="text-slate-300 font-semibold">Meganathan</span>
          </div>
        ) : (
          <div className="w-2 h-2 rounded-full bg-brand-500 mx-auto" title="Built by Meganathan" />
        )}
      </div>
    </>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <aside
        className={`no-print hidden md:flex bg-slate-900 text-slate-300 flex-col h-full flex-shrink-0 transition-all duration-300 z-30 select-none ${
          isCollapsed ? 'w-16' : 'w-64'
        }`}
      >
        <NavContent mobile={false} />
      </aside>

      {/* Mobile Drawer Backdrop */}
      {isMobileOpen && (
        <div
          className="no-print fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-40 md:hidden animate-in fade-in duration-200"
          onClick={onCloseMobile}
        />
      )}

      {/* Mobile Slide-Over Drawer */}
      <aside
        className={`no-print fixed inset-y-0 left-0 z-50 w-72 bg-slate-900 text-slate-300 flex flex-col h-full shadow-2xl transition-transform duration-300 ease-in-out md:hidden select-none ${
          isMobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <NavContent mobile={true} />
      </aside>
    </>
  );
}
