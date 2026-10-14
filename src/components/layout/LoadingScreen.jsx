import React, { useState, useEffect } from 'react';
import { Loader2, CheckCircle2, ArrowRight, ShieldCheck, Database, Layers, Sparkles } from 'lucide-react';

export default function LoadingScreen({ onSkip }) {
  const profile = React.useMemo(() => {
    try {
      const p = JSON.parse(localStorage.getItem('rsp_business_profile') || '{}');
      return {
        businessName: p.businessName || 'MU Accounts',
        logoUrl: p.logoUrl || '/mu_accounts_logo.svg'
      };
    } catch (e) {
      return { businessName: 'MU Accounts', logoUrl: '/mu_accounts_logo.svg' };
    }
  }, []);

  const [progress, setProgress] = useState(5);
  const [stageText, setStageText] = useState("Connecting to MU Software Engine & local database...");
  const [stepIndex, setStepIndex] = useState(1);

  useEffect(() => {
    // 2.5-second total duration (25ms * 100 = ~2500ms) for snappy, smooth feel
    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          if (onSkip) {
            setTimeout(onSkip, 200);
          }
          return 100;
        }

        const next = prev + 1;
        if (next < 25) {
          setStageText("Authenticating MU Software Engine & secure local cache...");
          setStepIndex(1);
        } else if (next < 55) {
          setStageText("Synchronizing Branch & Department Master directories...");
          setStepIndex(2);
        } else if (next < 85) {
          setStageText("Verifying Sales, Purchase Registers & GST Tax Engine...");
          setStepIndex(3);
        } else {
          setStageText("MU Accounts ERP ready. Launching workspace...");
          setStepIndex(4);
        }
        return next;
      });
    }, 25);

    return () => clearInterval(interval);
  }, [onSkip]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-950 text-white select-none overflow-hidden">
      {/* Background Ambient Glow with MU Blue / Indigo theme */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-blue-600/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />

      {/* Top Skip Button */}
      {onSkip && (
        <div className="absolute top-5 right-5 sm:top-6 sm:right-6">
          <button
            onClick={onSkip}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-slate-900/90 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700 text-xs font-semibold transition-all shadow-sm cursor-pointer hover:border-blue-500/50"
          >
            <span>Skip & Enter</span>
            <ArrowRight className="w-3.5 h-3.5 text-blue-400" />
          </button>
        </div>
      )}

      <div className="relative flex flex-col items-center space-y-6 max-w-md w-full px-6 text-center animate-in fade-in zoom-in-95 duration-300">
        {/* Animated MU Logo */}
        <div className="relative">
          <div className="w-24 h-24 rounded-3xl bg-slate-900 p-2.5 flex items-center justify-center shadow-2xl shadow-blue-900/60 border border-blue-500/30 overflow-hidden ring-4 ring-blue-500/20">
            <img 
              src={profile.logoUrl} 
              alt="MU Accounts" 
              className="w-full h-full object-contain filter drop-shadow"
            />
          </div>
          <div className="absolute -bottom-2 -right-2 w-8 h-8 rounded-full bg-slate-900 border-2 border-slate-800 flex items-center justify-center shadow-md">
            <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />
          </div>
        </div>

        {/* Company Branding */}
        <div>
          <h2 className="text-2xl sm:text-3xl font-black tracking-wide text-white flex items-center justify-center gap-1.5">
            <span className="bg-gradient-to-r from-white via-slate-100 to-blue-200 bg-clip-text text-transparent">MU Accounts</span>
          </h2>
          <p className="text-[11px] text-blue-400 font-extrabold uppercase tracking-widest mt-1">
            MU Software • Enterprise Cloud ERP
          </p>
        </div>

        {/* Real-time Progress Bar & Stage Status */}
        <div className="w-full space-y-2 pt-2">
          <div className="flex items-center justify-between text-xs text-slate-400 font-mono px-1">
            <span className="text-[11px] text-slate-400 font-sans font-semibold">System Initialization</span>
            <span className="font-bold text-blue-400">{progress}%</span>
          </div>

          <div className="w-full bg-slate-900 h-2.5 rounded-full overflow-hidden border border-slate-800 p-0.5">
            <div 
              className="bg-gradient-to-r from-blue-600 via-indigo-500 to-cyan-400 h-full rounded-full transition-all duration-75 ease-out shadow-xs shadow-blue-500/50"
              style={{ width: `${progress}%` }}
            />
          </div>

          <p className="text-xs text-slate-300 font-medium h-6 flex items-center justify-center truncate px-2">
            {stageText}
          </p>
        </div>

        {/* 4-Step Milestone Checklist */}
        <div className="grid grid-cols-2 gap-2 w-full pt-1 text-left">
          <div className={`p-2.5 rounded-xl border text-[11px] flex items-center gap-2 transition-all ${
            stepIndex >= 1 ? 'bg-slate-900/90 border-blue-500/40 text-slate-200' : 'bg-slate-950/40 border-slate-900 text-slate-600'
          }`}>
            {stepIndex > 1 ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
            ) : (
              <Database className="w-3.5 h-3.5 text-blue-400 flex-shrink-0 animate-pulse" />
            )}
            <span className="truncate">MU Engine & Auth</span>
          </div>

          <div className={`p-2.5 rounded-xl border text-[11px] flex items-center gap-2 transition-all ${
            stepIndex >= 2 ? 'bg-slate-900/90 border-blue-500/40 text-slate-200' : 'bg-slate-950/40 border-slate-900 text-slate-600'
          }`}>
            {stepIndex > 2 ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
            ) : (
              <Layers className="w-3.5 h-3.5 text-blue-400 flex-shrink-0 animate-pulse" />
            )}
            <span className="truncate">Branch & Dept Master</span>
          </div>

          <div className={`p-2.5 rounded-xl border text-[11px] flex items-center gap-2 transition-all ${
            stepIndex >= 3 ? 'bg-slate-900/90 border-blue-500/40 text-slate-200' : 'bg-slate-950/40 border-slate-900 text-slate-600'
          }`}>
            {stepIndex > 3 ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
            ) : (
              <ShieldCheck className="w-3.5 h-3.5 text-blue-400 flex-shrink-0 animate-pulse" />
            )}
            <span className="truncate">Registers & Tax Core</span>
          </div>

          <div className={`p-2.5 rounded-xl border text-[11px] flex items-center gap-2 transition-all ${
            stepIndex >= 4 ? 'bg-slate-900/90 border-blue-500/40 text-slate-200' : 'bg-slate-950/40 border-slate-900 text-slate-600'
          }`}>
            {stepIndex >= 4 ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
            ) : (
              <Sparkles className="w-3.5 h-3.5 text-blue-400 flex-shrink-0 animate-pulse" />
            )}
            <span className="truncate">Workspace Ready</span>
          </div>
        </div>

        {/* Footer Security Badge */}
        <p className="text-[10px] text-slate-500 font-semibold tracking-wider uppercase pt-2">
          Offline First • Cloud Synced • MU Software 2026
        </p>
      </div>
    </div>
  );
}
