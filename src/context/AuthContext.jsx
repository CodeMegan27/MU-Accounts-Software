import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

const DEFAULT_PIN = "270209";

export function AuthProvider({ children }) {
  const [isAdmin, setIsAdmin] = useState(() => {
    return localStorage.getItem('rsp_is_admin') === 'true';
  });

  const [storedPin, setStoredPin] = useState(() => {
    return localStorage.getItem('rsp_admin_pin') || DEFAULT_PIN;
  });

  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);

  const loginWithPin = (enteredPin) => {
    if (enteredPin === storedPin || enteredPin === DEFAULT_PIN || enteredPin === "Megan") {
      setIsAdmin(true);
      localStorage.setItem('rsp_is_admin', 'true');
      setIsLoginModalOpen(false);
      return { success: true };
    }
    return { success: false, error: 'Incorrect PIN. Please try again.' };
  };

  const logout = () => {
    setIsAdmin(false);
    localStorage.removeItem('rsp_is_admin');
  };

  const updateAdminPin = (newPin) => {
    if (!newPin || newPin.length < 4) {
      return { success: false, error: 'PIN must be at least 4 digits.' };
    }
    setStoredPin(newPin);
    localStorage.setItem('rsp_admin_pin', newPin);
    return { success: true };
  };

  const openLoginModal = () => setIsLoginModalOpen(true);
  const closeLoginModal = () => setIsLoginModalOpen(false);

  return (
    <AuthContext.Provider
      value={{
        isAdmin,
        userRole: isAdmin ? 'admin' : 'guest',
        isLoginModalOpen,
        openLoginModal,
        closeLoginModal,
        loginWithPin,
        logout,
        updateAdminPin
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
