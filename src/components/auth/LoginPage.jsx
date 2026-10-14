import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { 
  Lock, 
  KeyRound, 
  Mail, 
  Building2, 
  ShieldCheck, 
  ArrowRight, 
  CheckCircle2, 
  Sparkles, 
  UserCheck, 
  ShieldAlert, 
  Send, 
  Code2, 
  Layers
} from 'lucide-react';

export default function LoginPage() {
  const { 
    login, 
    loginWithPin, 
    storedPin, 
    availableRoles, 
    sendEmailOtp, 
    verifyEmailOtp 
  } = useAuth();
  
  const { showToast } = useToast();

  const [authMode, setAuthMode] = useState('pin'); // 'pin' | 'email_otp' | 'register'
  const [selectedRole, setSelectedRole] = useState('Managing Director (MD)');
  
  // PIN Login state
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [isSuccessAnim, setIsSuccessAnim] = useState(false);

  // Email OTP state
  const [email, setEmail] = useState('');
  const [companyName, setCompanyName] = useState('MU Accounts');
  const [otpSent, setOtpSent] = useState(false);
  const [enteredOtp, setEnteredOtp] = useState('');
  const [otpDebugCode, setOtpDebugCode] = useState('');
  const [newSetupPin, setNewSetupPin] = useState('');
  const [isSendingOtp, setIsSendingOtp] = useState(false);

  // Keypad clicks for PIN login
  const handleDigitClick = (digit) => {
    if (pin.length < 6) {
      const next = pin + digit;
      setPin(next);
      setError('');
      if (next.length === 6) {
        // Auto trigger submit on 6 digits
        attemptPinLogin(next);
      }
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

  const attemptPinLogin = (pinToTest) => {
    const code = pinToTest || pin;
    if (!code) {
      setError('Please enter your 6-digit security code');
      return;
    }

    const res = loginWithPin(code);
    if (res.success) {
      setIsSuccessAnim(true);
      setTimeout(() => {
        login({
          role: selectedRole,
          pin: code,
          companyName: 'MU Accounts',
          companyId: 'tenant_mu_accounts'
        });
        window.dispatchEvent(new CustomEvent('rsp_tenant_switched', { detail: { tenantId: 'tenant_mu_accounts', companyName: 'MU Accounts' } }));
        showToast(`Welcome back! Logged in as ${selectedRole}`, 'success');
      }, 700);
    } else {
      setError('Invalid 6-digit PIN. Default Master PIN is 270209.');
    }
  };

  const handleSendOtp = async (e) => {
    e.preventDefault();
    if (!email || !email.includes('@')) {
      setError('Please provide a valid business email ID');
      return;
    }

    setIsSendingOtp(true);
    setError('');
    try {
      const res = await sendEmailOtp(email, 'Company Account Verification');
      if (res.success) {
        setOtpSent(true);
        setOtpDebugCode(res.otp || res.debugOtp);
        if (res.resendDispatched) {
          showToast(`Security OTP emailed to ${email} via Resend!`, 'success');
        } else {
          showToast(res.message, 'info');
        }
      } else {
        setError(res.error || 'Failed to send OTP');
      }
    } catch (err) {
      setError('Error dispatching OTP');
    } finally {
      setIsSendingOtp(false);
    }
  };

  const handleVerifyOtpAndLogin = (e) => {
    e.preventDefault();
    if (!enteredOtp || enteredOtp.length < 6) {
      setError('Please enter the 6-digit OTP code');
      return;
    }

    const res = verifyEmailOtp(enteredOtp);
    if (res.success) {
      setIsSuccessAnim(true);
      const safeCompanyId = `tenant_${companyName.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
      setTimeout(() => {
        login({
          email,
          role: selectedRole,
          pin: newSetupPin || '270209',
          companyName: companyName || 'MU Accounts',
          companyId: safeCompanyId
        });
        window.dispatchEvent(new CustomEvent('rsp_tenant_switched', { detail: { tenantId: safeCompanyId, companyName } }));
        showToast(`Verified! Isolated workspace opened for ${companyName}`, 'success');
      }, 700);
    } else {
      setError(res.error || 'Invalid OTP');
    }
  };

  const handleDeveloperFastLogin = () => {
    setIsSuccessAnim(true);
    setTimeout(() => {
      login({
        role: 'Developer',
        name: 'Meganathan (Developer)',
        email: 'meganfullsd@gmail.com',
        companyName: 'MU Accounts',
        companyId: 'tenant_mu_accounts'
      });
      window.dispatchEvent(new CustomEvent('rsp_tenant_switched', { detail: { tenantId: 'tenant_mu_accounts', companyName: 'MU Accounts' } }));
      showToast('Developer Access Granted (meganfullsd@gmail.com) - Full Diagnostic Control', 'success');
    }, 500);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col justify-between relative overflow-hidden select-none font-sans">
      {/* Background Ambient Glows */}
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Top Navbar */}
      <header className="w-full max-w-6xl mx-auto px-6 py-5 flex items-center justify-between z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-slate-900 border border-blue-500/30 p-1.5 flex items-center justify-center shadow-lg shadow-blue-900/40">
            <img src="/mu_accounts_logo.svg" alt="MU Accounts" className="w-full h-full object-contain" />
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-black tracking-tight text-white leading-tight">
              MU Accounts
            </h1>
            <p className="text-[10px] text-blue-400 font-extrabold tracking-widest uppercase">
              MU Software Enterprise ERP
            </p>
          </div>
        </div>

        <button
          onClick={handleDeveloperFastLogin}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-900/90 hover:bg-blue-900/40 border border-slate-800 hover:border-blue-500/50 text-[11px] font-semibold text-slate-400 hover:text-blue-300 transition-all cursor-pointer shadow-sm"
          title="Instant Developer Access as meganfullsd@gmail.com"
        >
          <Code2 className="w-3.5 h-3.5 text-blue-400" />
          <span className="hidden sm:inline">Developer (meganfullsd@gmail.com)</span>
          <span className="sm:hidden">Dev</span>
        </button>
      </header>

      {/* Main Container */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6 z-10">
        <div className="w-full max-w-[420px] bg-slate-900/90 backdrop-blur-xl border border-slate-800/80 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
          
          {/* Success Overlay */}
          {isSuccessAnim && (
            <div className="absolute inset-0 z-30 bg-slate-950/95 flex flex-col items-center justify-center p-6 text-center animate-in zoom-in-95 duration-200">
              <div className="w-16 h-16 rounded-full bg-emerald-500/20 border-2 border-emerald-400 flex items-center justify-center mb-3 animate-bounce shadow-lg shadow-emerald-500/30">
                <CheckCircle2 className="w-8 h-8 text-emerald-400" />
              </div>
              <h3 className="text-lg font-black text-white">Access Authenticated</h3>
              <p className="text-xs text-blue-400 font-semibold mt-1">Launching {selectedRole} workspace...</p>
            </div>
          )}

          {/* Mode Switcher Tabs */}
          <div className="flex bg-slate-950/80 p-1 rounded-2xl border border-slate-800 mb-6">
            <button
              onClick={() => { setAuthMode('pin'); setError(''); }}
              className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                authMode === 'pin'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span>6-Digit PIN</span>
            </button>
            <button
              onClick={() => { setAuthMode('email_otp'); setError(''); }}
              className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                authMode === 'email_otp'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Mail className="w-3.5 h-3.5" />
              <span>Email OTP & Company</span>
            </button>
          </div>

          {/* MODE 1: 6-DIGIT PIN QUICK LOGIN */}
          {authMode === 'pin' && (
            <div className="space-y-5 animate-in fade-in duration-200">
              {/* Role Selector */}
              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                  Select User Staff Role
                </label>
                <div className="relative">
                  <select
                    value={selectedRole}
                    onChange={(e) => setSelectedRole(e.target.value)}
                    className="w-full py-2.5 px-3.5 bg-slate-950 border border-slate-800 rounded-xl text-xs font-semibold text-slate-200 focus:outline-none focus:border-blue-500 cursor-pointer"
                  >
                    {availableRoles.map(r => (
                      <option key={r} value={r} className="bg-slate-900 text-white">
                        {r}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* PIN Dots Indicator */}
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    Enter 6-Digit Access Code
                  </label>
                  <span className="text-[10px] text-blue-400 font-mono">Master: 270209</span>
                </div>

                <div className="flex justify-center items-center gap-2.5 py-3 px-4 bg-slate-950 border border-slate-800 rounded-2xl">
                  {[0, 1, 2, 3, 4, 5].map((idx) => {
                    const isFilled = pin.length > idx;
                    return (
                      <div
                        key={idx}
                        className={`w-3.5 h-3.5 rounded-full border-2 transition-all duration-150 ${
                          isFilled
                            ? 'bg-blue-500 border-blue-400 scale-110 shadow-sm shadow-blue-500/50'
                            : 'bg-slate-900 border-slate-700'
                        }`}
                      />
                    );
                  })}
                </div>

                {error && (
                  <p className="text-[11px] font-semibold text-red-400 flex items-center justify-center gap-1 mt-2 animate-in fade-in">
                    <ShieldAlert className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>{error}</span>
                  </p>
                )}
              </div>

              {/* Number Keypad */}
              <div className="grid grid-cols-3 gap-2 pt-1">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((digit) => (
                  <button
                    key={digit}
                    type="button"
                    onClick={() => handleDigitClick(digit.toString())}
                    className="py-3 bg-slate-950/80 hover:bg-slate-800 active:bg-blue-950 border border-slate-800 hover:border-slate-700 rounded-xl text-lg font-bold text-slate-200 transition-colors shadow-sm select-none cursor-pointer"
                  >
                    {digit}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={handleClear}
                  className="py-3 bg-slate-950/80 hover:bg-slate-800 active:bg-slate-700 text-[10px] font-bold text-slate-500 hover:text-slate-300 border border-slate-800 rounded-xl uppercase tracking-wider transition-colors select-none cursor-pointer"
                >
                  Clear
                </button>
                <button
                  type="button"
                  onClick={() => handleDigitClick('0')}
                  className="py-3 bg-slate-950/80 hover:bg-slate-800 active:bg-blue-950 border border-slate-800 hover:border-slate-700 rounded-xl text-lg font-bold text-slate-200 transition-colors shadow-sm select-none cursor-pointer"
                >
                  0
                </button>
                <button
                  type="button"
                  onClick={handleBackspace}
                  className="py-3 bg-slate-950/80 hover:bg-slate-800 active:bg-slate-700 text-xs font-semibold text-slate-500 hover:text-slate-300 border border-slate-800 rounded-xl transition-colors select-none cursor-pointer"
                >
                  ⌫
                </button>
              </div>

              {/* Unlock Button */}
              <button
                type="button"
                onClick={() => attemptPinLogin()}
                className="w-full py-3 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs sm:text-sm rounded-xl shadow-lg shadow-blue-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Lock className="w-4 h-4" />
                <span>Login to MU Accounts</span>
                <ArrowRight className="w-4 h-4 ml-1" />
              </button>
            </div>
          )}

          {/* MODE 2: EMAIL OTP VERIFICATION & COMPANY ISOLATION (PHASE 2) */}
          {authMode === 'email_otp' && (
            <div className="space-y-4 animate-in fade-in duration-200 text-xs">
              {!otpSent ? (
                <form onSubmit={handleSendOtp} className="space-y-3.5">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                        Business / User Email Address
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          setEmail('meganfullsd@gmail.com');
                          setSelectedRole('Developer');
                        }}
                        className="text-[10px] font-bold text-blue-400 hover:text-blue-300 cursor-pointer"
                      >
                        Use meganfullsd@gmail.com
                      </button>
                    </div>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => {
                          const val = e.target.value;
                          setEmail(val);
                          if (val.toLowerCase().trim() === 'meganfullsd@gmail.com') {
                            setSelectedRole('Developer');
                          }
                        }}
                        placeholder="you@company.com or meganfullsd@gmail.com"
                        className="w-full py-2.5 pl-9 pr-3 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-blue-500 font-mono text-xs"
                      />
                    </div>
                    {email.toLowerCase().trim() === 'meganfullsd@gmail.com' && (
                      <p className="text-[10px] text-emerald-400 font-bold mt-1 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Master Developer Account Recognized (meganfullsd@gmail.com)</span>
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                      Company Workspace Name
                    </label>
                    <div className="relative">
                      <Building2 className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                      <input
                        type="text"
                        required
                        value={companyName}
                        onChange={(e) => setCompanyName(e.target.value)}
                        placeholder="e.g. MU Accounts or My Firm"
                        className="w-full py-2.5 pl-9 pr-3 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    <p className="text-[10px] text-slate-500 mt-1">
                      Multi-tenant isolated workspace: each company data is stored separately in server.
                    </p>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                      Role in Company
                    </label>
                    <select
                      value={selectedRole}
                      onChange={(e) => setSelectedRole(e.target.value)}
                      className="w-full py-2.5 px-3 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-blue-500 cursor-pointer"
                    >
                      {availableRoles.map(r => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                  </div>

                  {error && (
                    <p className="text-[11px] font-semibold text-red-400 flex items-center gap-1">
                      <ShieldAlert className="w-3.5 h-3.5 flex-shrink-0" />
                      <span>{error}</span>
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={isSendingOtp}
                    className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer mt-2"
                  >
                    <Send className="w-4 h-4" />
                    <span>{isSendingOtp ? 'Sending 6-Digit OTP...' : 'Send Verification OTP'}</span>
                  </button>
                </form>
              ) : (
                <form onSubmit={handleVerifyOtpAndLogin} className="space-y-4">
                  <div className="p-3 bg-blue-950/40 border border-blue-800/60 rounded-2xl text-[11px] text-blue-300 space-y-1">
                    <p className="font-bold text-white flex items-center justify-between">
                      <span>6-Digit Security OTP Dispatched</span>
                      <span className="text-[9px] font-mono px-2 py-0.5 rounded bg-blue-900 text-blue-200">Official Mail</span>
                    </p>
                    <p className="text-[10px] text-slate-300">
                      From Company Email: <strong className="text-emerald-400 font-mono">meganfullsd@gmail.com</strong>
                    </p>
                    <p className="text-[10px] text-slate-300">
                      To Recipient User: <span className="text-white font-mono">{email}</span>
                    </p>
                    {otpDebugCode && (
                      <div className="mt-1.5 flex items-center justify-between bg-blue-900/40 p-2 rounded-lg border border-blue-700/50">
                        <span className="text-[10px] text-blue-300 font-mono">
                          Verification Code: <strong className="text-emerald-400 text-xs">{otpDebugCode}</strong>
                        </span>
                        <button
                          type="button"
                          onClick={() => setEnteredOtp(otpDebugCode)}
                          className="px-2 py-0.5 bg-blue-600 hover:bg-blue-500 text-white rounded text-[10px] font-bold cursor-pointer transition-all shadow-xs active:scale-95"
                        >
                          Auto-Fill
                        </button>
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                      Enter 6-Digit OTP Code
                    </label>
                    <input
                      type="text"
                      maxLength="6"
                      required
                      autoFocus
                      value={enteredOtp}
                      onChange={(e) => setEnteredOtp(e.target.value)}
                      placeholder="6 Digits"
                      className="w-full py-2.5 text-center text-lg font-mono tracking-widest bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                      Set Personal 6-Digit Security PIN
                    </label>
                    <input
                      type="password"
                      maxLength="6"
                      value={newSetupPin}
                      onChange={(e) => setNewSetupPin(e.target.value)}
                      placeholder="e.g. 270209"
                      className="w-full py-2 px-3 text-center text-sm font-mono tracking-widest bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  {error && (
                    <p className="text-[11px] font-semibold text-red-400 flex items-center gap-1">
                      <ShieldAlert className="w-3.5 h-3.5 flex-shrink-0" />
                      <span>{error}</span>
                    </p>
                  )}

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => { setOtpSent(false); setEnteredOtp(''); }}
                      className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-semibold cursor-pointer"
                    >
                      Change Email
                    </button>
                    <button
                      type="submit"
                      className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold cursor-pointer shadow-md flex items-center justify-center gap-1.5"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Verify & Enter</span>
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full max-w-6xl mx-auto px-6 py-4 text-center text-[11px] text-slate-600 z-10 flex flex-col sm:flex-row items-center justify-between gap-2">
        <p>© 2026 MU Accounts. Built & Powered by MU Software.</p>
        <p className="text-slate-500">Offline First • Multi-Tenant Isolated Storage • Enterprise Cloud Synced</p>
      </footer>
    </div>
  );
}
