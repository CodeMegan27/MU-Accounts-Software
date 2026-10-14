import React, { createContext, useContext, useState, useEffect } from 'react';
import { db } from '../config/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { getTenantCollectionPath, getActiveTenantId } from './DataContext';

const SettingsContext = createContext(null);

const DEFAULT_PROFILE = {
  businessName: 'MU Accounts',
  tagline: 'SMART CLOUD ACCOUNTING • INVENTORY & TAX ERP',
  logoUrl: '/mu_accounts_logo.svg',
  ownerName: 'Admin',
  gstin: '33BLQPM9171A1ZA',
  phone: '+91 98424 00000',
  email: 'admin@muaccounts.com',
  address: 'Commercial Complex, Main Road, Tamil Nadu - 623501',
  state: 'Tamil Nadu',
  stateCode: '33',
  bankName: 'State Bank of India',
  bankAccount: '33001234567',
  bankIfsc: 'SBIN0000908',
  bankBranch: 'Main Branch',
  invoiceNotes: 'Computer generated official tax invoice / order estimate.'
};

const getTenantProfileKey = () => {
  const tid = getActiveTenantId();
  return `rsp_${tid}_business_profile`;
};

export function SettingsProvider({ children }) {
  const [profile, setProfile] = useState(() => {
    try {
      const key = getTenantProfileKey();
      const saved = localStorage.getItem(key);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.businessName === 'RS Purchase Enterprise' || parsed.businessName === 'RS DESIGNS' || !parsed.businessName) {
          parsed.businessName = 'MU Accounts';
        }
        if (!parsed.logoUrl || parsed.logoUrl === '/rs_designs_logo.jpg') {
          parsed.logoUrl = '/mu_accounts_logo.svg';
        }
        return { ...DEFAULT_PROFILE, ...parsed };
      }
      return DEFAULT_PROFILE;
    } catch (e) {
      return DEFAULT_PROFILE;
    }
  });

  const [loading, setLoading] = useState(true);

  // Sync profile from Firestore for active tenant
  const loadRemoteProfile = async () => {
    if (!db) {
      setLoading(false);
      return;
    }
    try {
      const tenantPath = getTenantCollectionPath();
      const ref = doc(db, tenantPath, 'settings', 'profile');
      const snap = await getDoc(ref);
      if (snap.exists()) {
        const data = snap.data();
        setProfile(prev => {
          const merged = { ...prev, ...data };
          localStorage.setItem(getTenantProfileKey(), JSON.stringify(merged));
          return merged;
        });
      }
    } catch (err) {
      console.warn('Could not fetch remote profile, using local copy:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRemoteProfile();

    const handleTenantSwitch = (e) => {
      const newTid = e?.detail?.tenantId || getActiveTenantId();
      const newCoName = e?.detail?.companyName;
      const key = `rsp_${newTid}_business_profile`;
      const saved = localStorage.getItem(key);
      if (saved) {
        try {
          setProfile(JSON.parse(saved));
        } catch (err) {}
      } else {
        setProfile({
          ...DEFAULT_PROFILE,
          businessName: newCoName || 'MU Accounts'
        });
      }
      loadRemoteProfile();
    };

    window.addEventListener('rsp_tenant_switched', handleTenantSwitch);
    return () => window.removeEventListener('rsp_tenant_switched', handleTenantSwitch);
  }, []);

  const updateProfile = async (newProfile) => {
    setProfile(newProfile);
    localStorage.setItem(getTenantProfileKey(), JSON.stringify(newProfile));

    if (db) {
      try {
        const tenantPath = getTenantCollectionPath();
        const ref = doc(db, tenantPath, 'settings', 'profile');
        await setDoc(ref, newProfile, { merge: true });
        return { success: true };
      } catch (err) {
        console.error('Failed to sync profile to cloud:', err);
        return { success: true, warning: 'Saved locally, will sync when online.' };
      }
    }
    return { success: true };
  };

  return (
    <SettingsContext.Provider value={{ profile, updateProfile, loading }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
}
