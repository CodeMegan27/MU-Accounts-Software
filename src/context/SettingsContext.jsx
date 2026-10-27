import React, { createContext, useContext, useState, useEffect } from 'react';
import { db, BASE_COLLECTION_PATH } from '../config/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

const SettingsContext = createContext(null);

const DEFAULT_PROFILE = {
  businessName: 'RS DESIGNS',
  tagline: 'CREATIVE DESIGNING • DIGITAL PRINTING • FLEX BANNER & PACKAGING',
  logoUrl: '/rs_designs_logo.jpg',
  ownerName: 'Meganathan',
  gstin: '33BLQPM9171A1ZA',
  phone: '+91 98424 00000',
  email: 'rsdesigns@gmail.com',
  address: 'Main Road, Ramanathapuram, Tamil Nadu - 623501',
  state: 'Tamil Nadu',
  stateCode: '33',
  bankName: 'State Bank of India',
  bankAccount: '33001234567',
  bankIfsc: 'SBIN0000908',
  bankBranch: 'Ramanathapuram Main Branch',
  invoiceNotes: 'Computer generated official tax invoice / order estimate.'
};

export function SettingsProvider({ children }) {
  const [profile, setProfile] = useState(() => {
    try {
      const saved = localStorage.getItem('rsp_business_profile');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.businessName === 'RS Purchase Enterprise' || !parsed.businessName) {
          parsed.businessName = 'RS DESIGNS';
        }
        if (!parsed.logoUrl) parsed.logoUrl = '/rs_designs_logo.jpg';
        return { ...DEFAULT_PROFILE, ...parsed };
      }
      return DEFAULT_PROFILE;
    } catch (e) {
      return DEFAULT_PROFILE;
    }
  });

  const [loading, setLoading] = useState(true);

  // Sync profile from Firestore if available
  useEffect(() => {
    async function loadRemoteProfile() {
      if (!db) {
        setLoading(false);
        return;
      }
      try {
        const ref = doc(db, BASE_COLLECTION_PATH, 'settings', 'profile');
        const snap = await getDoc(ref);
        if (snap.exists()) {
          const data = snap.data();
          setProfile(prev => {
            const merged = { ...prev, ...data };
            localStorage.setItem('rsp_business_profile', JSON.stringify(merged));
            return merged;
          });
        }
      } catch (err) {
        console.warn('Could not fetch remote profile, using local copy:', err);
      } finally {
        setLoading(false);
      }
    }
    loadRemoteProfile();
  }, []);

  const updateProfile = async (newProfile) => {
    setProfile(newProfile);
    localStorage.setItem('rsp_business_profile', JSON.stringify(newProfile));

    if (db) {
      try {
        const ref = doc(db, BASE_COLLECTION_PATH, 'settings', 'profile');
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
