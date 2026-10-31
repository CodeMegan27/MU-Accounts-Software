import React, { useState, useMemo, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SettingsProvider } from './context/SettingsContext';
import { DataProvider, useData } from './context/DataContext';
import { ToastProvider, useToast } from './context/ToastContext';

// Layout Components
import Navbar from './components/layout/Navbar';
import Sidebar from './components/layout/Sidebar';
import AdminLoginModal from './components/layout/AdminLoginModal';
import ConfirmModal from './components/layout/ConfirmModal';
import LoadingScreen from './components/layout/LoadingScreen';

// Module Components
import Dashboard from './components/dashboard/Dashboard';
import BillsList from './components/bills/BillsList';
import BillForm from './components/bills/BillForm';
import BillDetail from './components/bills/BillDetail';
import PaymentModal from './components/bills/PaymentModal';

import VendorsList from './components/vendors/VendorsList';
import VendorForm from './components/vendors/VendorForm';
import VendorLedger from './components/vendors/VendorLedger';

import ItemsList from './components/items/ItemsList';
import ItemForm from './components/items/ItemForm';

import ExpensesList from './components/expenses/ExpensesList';
import ExpenseForm from './components/expenses/ExpenseForm';

import AssetsList from './components/assets/AssetsList';
import AssetForm from './components/assets/AssetForm';

import GstReport from './components/reports/GstReport';
import ProfitAndLoss from './components/reports/ProfitAndLoss';
import AuditLogs from './components/logs/AuditLogs';
import ProfileSettings from './components/profile/ProfileSettings';

// Sales Register Components (Local Demo)
import SalesList from './components/sales/SalesList';
import SaleForm from './components/sales/SaleForm';
import SaleDetail from './components/sales/SaleDetail';
import SalePaymentModal from './components/sales/SalePaymentModal';
import VoucherRegister from './components/vouchers/VoucherRegister';
import DayBook from './components/daybook/DayBook';
import { createNewDraft } from './utils/draftManager';
import BankAccounts from './components/bank/BankAccounts';
import ChatbotDrawer from './components/chatbot/ChatbotDrawer';
import PayablesView from './components/payables/PayablesView';
import ReceivablesView from './components/receivables/ReceivablesView';


function AppContent() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  const handleToggleSidebar = () => {
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      setIsMobileOpen(prev => !prev);
    } else {
      setIsSidebarCollapsed(prev => !prev);
    }
  };

  // Sub-view entities
  const [activeBillId, setActiveBillId] = useState(null);
  const [activeBillDraft, setActiveBillDraft] = useState(null);
  const [activeVendor, setActiveVendor] = useState(null);
  const [activeItem, setActiveItem] = useState(null);
  const [activeExpense, setActiveExpense] = useState(null);
  const [activeAsset, setActiveAsset] = useState(null);
  const [activeSale, setActiveSale] = useState(null);

  // Modals
  const [paymentBill, setPaymentBill] = useState(null);
  const [paymentSale, setPaymentSale] = useState(null);
  const [deleteDialog, setDeleteDialog] = useState({ isOpen: false, col: null, id: null, title: '' });
  const [vendorSourceTab, setVendorSourceTab] = useState('vendors');
  const [billSourceTab, setBillSourceTab] = useState('bills');

  const { loading, dismissLoading, deleteBill, deleteVendor, deleteItem, deleteExpense, deleteAsset, vendors } = useData();
  const { isAdmin, openLoginModal } = useAuth();
  const { showToast } = useToast();

  const currentActiveVendor = useMemo(() => {
    if (!activeVendor) return null;
    return (vendors || []).find(v => v.id === activeVendor.id) || activeVendor;
  }, [activeVendor, vendors]);

  if (loading) {
    return <LoadingScreen onSkip={dismissLoading} />;
  }

  // Navigation Handlers
  const handleSelectTab = (tab) => {
    setActiveTab(tab);
    if (tab !== 'createBill' && tab !== 'billDetail') {
      setActiveBillId(null);
      setActiveBillDraft(null);
    }
    if (tab !== 'createVendor' && tab !== 'vendorLedger') setActiveVendor(null);
    if (tab !== 'createItem') setActiveItem(null);
    if (tab !== 'createExpense') setActiveExpense(null);
    if (tab !== 'createAsset') setActiveAsset(null);
    if (tab !== 'createSale' && tab !== 'saleDetail') setActiveSale(null);
  };


  // Bill Actions
  const handleOpenCreateBill = (prefilledVendor = null, source = 'bills') => {
    setActiveBillId(null);
    const newDraft = createNewDraft('bill');
    if (prefilledVendor) {
      newDraft.vendorId = prefilledVendor.id || '';
      newDraft.vendorName = prefilledVendor.name || '';
      newDraft.gstin = prefilledVendor.gstin || '';
      newDraft.isGst = prefilledVendor.gstStatus === 'GST';
    }
    setActiveBillDraft(newDraft);
    setBillSourceTab(source);
    setActiveTab('createBill');
  };

  const handleEditBill = (id, source = 'bills') => {
    if (!isAdmin) {
      showToast('Admin PIN required to edit purchase bills', 'info');
      openLoginModal();
      return;
    }
    setActiveBillId(id);
    setBillSourceTab(source);
    setActiveTab('createBill');
  };

  const handleViewBill = (id, source = 'bills') => {
    setActiveBillId(id);
    setBillSourceTab(source);
    setActiveTab('billDetail');
  };

  // Vendor Actions
  const handleOpenCreateVendor = () => {
    setActiveVendor(null);
    setActiveTab('createVendor');
  };

  const handleEditVendor = (vendor, source = 'vendors') => {
    if (!isAdmin) {
      showToast('Admin PIN required to edit vendors', 'info');
      openLoginModal();
      return;
    }
    setActiveVendor(vendor);
    setVendorSourceTab(source);
    setActiveTab('createVendor');
  };

  const handleOpenVendorLedger = (vendor) => {
    setActiveVendor(vendor);
    setActiveTab('vendorLedger');
  };

  // Item Actions
  const handleOpenCreateItem = () => {
    setActiveItem(null);
    setActiveTab('createItem');
  };
  const handleEditItem = (item) => {
    if (!isAdmin) {
      showToast('Admin PIN required to edit items', 'info');
      openLoginModal();
      return;
    }
    setActiveItem(item);
    setActiveTab('createItem');
  };

  // Expense Actions
  const handleOpenCreateExpense = () => {
    setActiveExpense(null);
    setActiveTab('createExpense');
  };
  const handleEditExpense = (expense) => {
    if (!isAdmin) {
      showToast('Admin PIN required to edit expenses', 'info');
      openLoginModal();
      return;
    }
    setActiveExpense(expense);
    setActiveTab('createExpense');
  };

  // Asset Actions
  const handleOpenCreateAsset = () => {
    setActiveAsset(null);
    setActiveTab('createAsset');
  };
  const handleEditAsset = (asset) => {
    if (!isAdmin) {
      showToast('Admin PIN required to edit assets', 'info');
      openLoginModal();
      return;
    }
    setActiveAsset(asset);
    setActiveTab('createAsset');
  };

  // Payment modal triggers (Purchase Bills & Sales Orders)
  const handleOpenPaymentModal = (bill) => {
    setPaymentBill(bill);
  };

  const handleOpenSalePaymentModal = (sale) => {
    setPaymentSale(sale);
  };

  // Delete Request Modal Trigger
  const handleRequestDelete = (col, id, title) => {
    if (!isAdmin) {
      showToast('Admin access required to delete records', 'error');
      openLoginModal();
      return;
    }
    setDeleteDialog({
      isOpen: true,
      col,
      id,
      title: `Delete ${title || 'Record'}?`
    });
  };

  // Confirm Delete Execution
  const handleConfirmDelete = async () => {
    const { col, id } = deleteDialog;
    try {
      if (col === 'bills') await deleteBill(id);
      else if (col === 'vendors') await deleteVendor(id);
      else if (col === 'items') await deleteItem(id);
      else if (col === 'expenses') await deleteExpense(id);
      else if (col === 'assets') await deleteAsset(id);

      showToast('Record deleted successfully', 'success');
    } catch (err) {
      console.error('Delete error:', err);
      showToast('Failed to delete record', 'error');
    } finally {
      setDeleteDialog({ isOpen: false, col: null, id: null, title: '' });
    }
  };

  return (
    <div className="h-screen flex overflow-hidden bg-slate-50 text-slate-800">
      {/* Sidebar Navigation */}
      <Sidebar
        activeTab={activeTab}
        onSelectTab={handleSelectTab}
        isCollapsed={isSidebarCollapsed}
        isMobileOpen={isMobileOpen}
        onCloseMobile={() => setIsMobileOpen(false)}
      />

      {/* Main Content Workspace */}
      <div className="flex-1 flex flex-col h-full overflow-hidden relative">
        <Navbar
          activeTab={activeTab}
          onToggleSidebar={handleToggleSidebar}
          onOpenCreateBill={handleOpenCreateBill}
        />

        <main className="flex-1 overflow-y-auto p-3 sm:p-6 lg:p-8">
          {/* Router Views */}
          {activeTab === 'dashboard' && (
            <Dashboard
              onNavigate={handleSelectTab}
              onViewBill={handleViewBill}
              onOpenCreateBill={handleOpenCreateBill}
              onViewSale={(sale) => {
                setActiveSale(sale);
                setActiveTab('saleDetail');
              }}
              onRecordPayment={handleOpenSalePaymentModal}
              onOpenVendorLedger={handleOpenVendorLedger}
              onOpenPaymentModal={handleOpenPaymentModal}
            />
          )}

          {/* Accounts Payable & Vendor Aging Register */}
          {activeTab === 'payables' && (
            <PayablesView
              onOpenLedger={handleOpenVendorLedger}
              onViewBill={(id) => handleViewBill(id, 'payables')}
              onOpenPaymentModal={handleOpenPaymentModal}
              onNavigate={handleSelectTab}
            />
          )}

          {/* Accounts Receivable & Customer Aging Register */}
          {activeTab === 'receivables' && (
            <ReceivablesView
              onViewSale={(sale) => {
                setActiveSale(sale);
                setActiveTab('saleDetail');
              }}
              onRecordPayment={handleOpenSalePaymentModal}
              onNavigate={handleSelectTab}
            />
          )}

          {/* Day Book Space (Chronological Daily Cash & Bank Register) */}
          {activeTab === 'daybook' && (
            <DayBook
              onViewSale={(sale) => {
                setActiveSale(sale);
                setActiveTab('saleDetail');
              }}
            />
          )}

          {/* Bank Accounts & BRS Space */}
          {activeTab === 'bankAccounts' && (
            <BankAccounts />
          )}

          {/* Sales Order Register (Estimates & Jobs) */}
          {activeTab === 'salesOrders' && (
            <SalesList
              key="sales_orders"
              defaultMode="orders"
              onNewSale={() => {
                const newDraft = createNewDraft('sale');
                setActiveSale(newDraft);
                setActiveTab('createSale');
              }}
              onViewSale={(sale) => {
                setActiveSale(sale);
                setActiveTab('saleDetail');
              }}
            />
          )}

          {/* Official Sales Register (Invoices) */}
          {activeTab === 'sales' && (
            <SalesList
              key="sales_invoices"
              defaultMode="invoices"
              onNewSale={() => {
                const newDraft = createNewDraft('sale');
                setActiveSale(newDraft);
                setActiveTab('createSale');
              }}
              onViewSale={(sale) => {
                setActiveSale(sale);
                setActiveTab('saleDetail');
              }}
            />
          )}


          {activeTab === 'createSale' && (
            <SaleForm
              sale={activeSale}
              onBack={() => setActiveTab('sales')}
              onSaved={(savedSale) => {
                setActiveSale(savedSale);
                setActiveTab('saleDetail');
              }}
            />
          )}

          {activeTab === 'saleDetail' && (
            <SaleDetail
              sale={activeSale}
              onBack={() => setActiveTab('sales')}
              onRecordPayment={handleOpenSalePaymentModal}
              onEditSale={(sale) => {
                setActiveSale(sale);
                setActiveTab('createSale');
              }}
            />
          )}

          {/* Profit & Loss Account */}
          {activeTab === 'pnl' && (
            <ProfitAndLoss />
          )}

          {/* Payment & Receipt Voucher Register */}
          {activeTab === 'vouchers' && (
            <VoucherRegister />
          )}


          {activeTab === 'bills' && (
            <BillsList
              onOpenCreateBill={handleOpenCreateBill}
              onEditBill={handleEditBill}
              onViewBill={handleViewBill}
              onOpenPaymentModal={handleOpenPaymentModal}
              onRequestDelete={handleRequestDelete}
            />
          )}

          {activeTab === 'createBill' && (
            <BillForm
              billId={activeBillId}
              draftBill={activeBillDraft}
              onBack={() => handleSelectTab(billSourceTab === 'vendorLedger' ? 'vendorLedger' : 'bills')}
              onQuickAddVendor={() => handleSelectTab('createVendor')}
              onViewBill={(id) => handleViewBill(id, billSourceTab)}
            />
          )}

          {activeTab === 'billDetail' && (
            <BillDetail
              billId={activeBillId}
              onBack={() => handleSelectTab(billSourceTab === 'vendorLedger' ? 'vendorLedger' : 'bills')}
              onOpenPaymentModal={handleOpenPaymentModal}
              onEditBill={(id) => handleEditBill(id, billSourceTab)}
            />
          )}

          {activeTab === 'vendors' && (
            <VendorsList
              onOpenCreateVendor={handleOpenCreateVendor}
              onEditVendor={handleEditVendor}
              onOpenLedger={handleOpenVendorLedger}
              onRequestDelete={handleRequestDelete}
            />
          )}

          {activeTab === 'createVendor' && (
            <VendorForm
              vendor={currentActiveVendor}
              onBack={() => handleSelectTab(vendorSourceTab === 'vendorLedger' ? 'vendorLedger' : 'vendors')}
            />
          )}

          {activeTab === 'vendorLedger' && (
            <VendorLedger
              vendor={currentActiveVendor}
              onBack={() => handleSelectTab('vendors')}
              onCreateBill={(v) => handleOpenCreateBill(v, 'vendorLedger')}
              onViewBill={(id) => handleViewBill(id, 'vendorLedger')}
              onEditBill={(id) => handleEditBill(id, 'vendorLedger')}
              onEditExpense={handleEditExpense}
              onEditAsset={handleEditAsset}
              onEditVendor={(v) => handleEditVendor(v, 'vendorLedger')}
            />
          )}

          {activeTab === 'items' && (
            <ItemsList
              onOpenCreateItem={handleOpenCreateItem}
              onEditItem={handleEditItem}
              onRequestDelete={handleRequestDelete}
            />
          )}

          {activeTab === 'createItem' && (
            <ItemForm
              item={activeItem}
              onBack={() => handleSelectTab('items')}
            />
          )}

          {activeTab === 'expenses' && (
            <ExpensesList
              onOpenCreateExpense={handleOpenCreateExpense}
              onEditExpense={handleEditExpense}
              onRequestDelete={handleRequestDelete}
            />
          )}

          {activeTab === 'createExpense' && (
            <ExpenseForm
              expense={activeExpense}
              onBack={() => handleSelectTab('expenses')}
            />
          )}

          {activeTab === 'assets' && (
            <AssetsList
              onOpenCreateAsset={handleOpenCreateAsset}
              onEditAsset={handleEditAsset}
              onRequestDelete={handleRequestDelete}
            />
          )}

          {activeTab === 'createAsset' && (
            <AssetForm
              asset={activeAsset}
              onBack={() => handleSelectTab('assets')}
            />
          )}

          {(activeTab === 'reports' || activeTab === 'gstr1' || activeTab === 'gstr2b' || activeTab === 'gstr3b') && (
            <GstReport 
              initialReport={activeTab === 'reports' ? 'gstr1' : activeTab}
              onSwitchReport={(tab) => handleSelectTab(tab)}
            />
          )}
          {activeTab === 'logs' && (
            <AuditLogs
              onResumeSaleDraft={(draft) => {
                setActiveSale(draft);
                setActiveTab('createSale');
              }}
              onResumeBillDraft={(draft) => {
                setActiveBillId(null);
                setActiveBillDraft(draft);
                setActiveTab('createBill');
              }}
            />
          )}
          {activeTab === 'profile' && <ProfileSettings />}
        </main>
      </div>

      {/* Global Modals */}
      <AdminLoginModal />

      <PaymentModal
        bill={paymentBill}
        isOpen={Boolean(paymentBill)}
        onClose={() => setPaymentBill(null)}
      />

      <SalePaymentModal
        sale={paymentSale}
        isOpen={Boolean(paymentSale)}
        onClose={() => setPaymentSale(null)}
        onPaymentRecorded={(updatedSale) => {
          if (activeSale && activeSale.id === updatedSale?.id) {
            setActiveSale(updatedSale);
          }
        }}
      />

      <ConfirmModal
        isOpen={deleteDialog.isOpen}
        title={deleteDialog.title}
        message="Are you sure you want to permanently delete this record? This action cannot be undone."
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteDialog({ isOpen: false, col: null, id: null, title: '' })}
        confirmText="Yes, Delete Record"
        isDanger={true}
      />

      {/* Floating Financial AI Chatbot */}
      <ChatbotDrawer />
    </div>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <SettingsProvider>
        <AuthProvider>
          <DataProvider>
            <AppContent />
          </DataProvider>
        </AuthProvider>
      </SettingsProvider>
    </ToastProvider>
  );
}
