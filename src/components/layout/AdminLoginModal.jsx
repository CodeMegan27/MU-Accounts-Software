import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { Lock, X, KeyRound, ShieldAlert, CheckCircle2, ShieldCheck, Sparkles } from 'lucide-react';

export default function AdminLoginModal() {
  const { isLoginModalOpen, closeLoginModal, loginWithPin } = useAuth();
  const { showToast } = useToast();
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [isSuccessAnim, setIsSuccessAnim] = useState(false);

  if (!isLoginModalOpen) return null;

  const handleSuccessfulLogin = () => {
    setIsSuccessAnim(true);
    setTimeout(() => {
      setIsSuccessAnim(false);
      setPin('');
      setError('');
      showToast('Admin Mode Unlocked', 'success');
    }, 1200);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!pin) {
      setError('Please enter your Admin PIN');
      return;
    }

    const res = loginWithPin(pin);
    if (res.success) {
      handleSuccessfulLogin();
    } else {
      setError(res.error || 'Invalid PIN');
    }
  };

  const handleDigitClick = (digit) => {
    if (pin.length < 10) {
      const nextPin = pin + digit;
      setPin(nextPin);
      setError('');
    }
  };

  const handleBackspace = () => {
    setPin(prev => prev.slice(0, -1));
    setError('');
  };

  const handleClear = () => {
    setPin('');
    setError('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/75 backdrop-blur-md animate-in fade-in duration-200 overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-[360px] max-h-[92vh] flex flex-col overflow-hidden transform transition-all relative my-auto">
        {/* Welcome Animation Overlay on Successful Login */}
        {isSuccessAnim && (
          <div className="absolute inset-0 z-30 bg-slate-900 flex flex-col items-center justify-center text-white p-6 animate-in zoom-in-95 duration-300">
            <div className="relative mb-3">
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-emerald-500/20 border-2 border-emerald-400 flex items-center justify-center animate-bounce">
                <ShieldCheck className="w-8 h-8 sm:w-10 sm:h-10 text-emerald-400" />
              </div>
              <Sparkles className="w-5 h-5 text-amber-400 absolute -top-1 -right-1 animate-spin" />
            </div>
            <h3 className="text-lg sm:text-xl font-black tracking-tight text-white">Welcome Back!</h3>
            <p className="text-[11px] sm:text-xs text-emerald-400 font-semibold mt-1 uppercase tracking-widest">Admin Access Granted</p>
            <p className="text-[11px] sm:text-xs text-slate-400 mt-2 text-center">Unlocking editing & financial tools...</p>
          </div>
        )}

        {/* Header */}
        <div className="bg-slate-900 p-4 sm:p-5 text-white text-center relative flex-shrink-0">
          <button
            onClick={() => {
              setPin('');
              setError('');
              closeLoginModal();
            }}
            className="absolute top-3.5 right-3.5 text-slate-400 hover:text-white transition-colors p-1 rounded-lg hover:bg-slate-800"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-brand-500/20 text-brand-400 border border-brand-500/30 flex items-center justify-center mx-auto mb-2 shadow-inner">
            <Lock className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <h3 className="text-base sm:text-lg font-bold">Admin Security Unlock</h3>
          <p className="text-[11px] sm:text-xs text-slate-400 mt-0.5">Enter your PIN to access editing & payments</p>
        </div>

        {/* Content with smooth scrolling if screen is short */}
        <form onSubmit={handleSubmit} autoComplete="off" className="p-4 sm:p-5 flex-1 overflow-y-auto">
          <div className="mb-4">
            <div className="flex justify-center items-center gap-3 mb-1">
              <input
                type="password"
                maxLength="10"
                autoComplete="one-time-code"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck="false"
                data-lpignore="true"
                data-form-type="other"
                name="admin_secret_token"
                id="admin_secret_token"
                value={pin}
                onChange={(e) => {
                  setPin(e.target.value);
                  setError('');
                }}
                placeholder="••••"
                autoFocus
                className="w-full text-center text-2xl sm:text-3xl tracking-[0.35em] font-mono py-2 px-3 bg-slate-50 border-2 border-slate-300 rounded-2xl focus:border-brand-500 focus:bg-white focus:outline-none transition-all shadow-inner"
              />
            </div>
            {error && (
              <p className="text-[11px] sm:text-xs font-semibold text-red-600 flex items-center justify-center gap-1 mt-1.5 animate-in fade-in">
                <ShieldAlert className="w-3.5 h-3.5 flex-shrink-0" /> {error}
              </p>
            )}
          </div>

          {/* Quick Keypad */}
          <div className="grid grid-cols-3 gap-2 sm:gap-2.5 mb-4">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((digit) => (
              <button
                key={digit}
                type="button"
                onClick={() => handleDigitClick(digit.toString())}
                className="py-2.5 sm:py-3 bg-slate-50 hover:bg-slate-100 active:bg-slate-200 border border-slate-200 rounded-xl text-base sm:text-lg font-bold text-slate-700 transition-colors shadow-sm select-none"
              >
                {digit}
              </button>
            ))}
            <button
              type="button"
              onClick={handleClear}
              className="py-2.5 sm:py-3 bg-slate-50 hover:bg-slate-100 active:bg-slate-200 text-[10px] sm:text-xs font-semibold text-slate-500 border border-slate-200 rounded-xl transition-colors uppercase select-none"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={() => handleDigitClick('0')}
              className="py-2.5 sm:py-3 bg-slate-50 hover:bg-slate-100 active:bg-slate-200 border border-slate-200 rounded-xl text-base sm:text-lg font-bold text-slate-700 transition-colors shadow-sm select-none"
            >
              0
            </button>
            <button
              type="button"
              onClick={handleBackspace}
              className="py-2.5 sm:py-3 bg-slate-50 hover:bg-slate-100 active:bg-slate-200 text-[10px] sm:text-xs font-semibold text-slate-500 border border-slate-200 rounded-xl transition-colors select-none"
            >
              ⌫ Back
            </button>
          </div>

          <button
            type="submit"
            className="w-full py-2.5 sm:py-3 bg-brand-600 hover:bg-brand-700 active:bg-brand-800 text-white rounded-xl font-semibold text-xs sm:text-sm transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2"
          >
            <KeyRound className="w-4 h-4" /> Unlock Admin Access
          </button>
        </form>
      </div>
    </div>
  );
}
