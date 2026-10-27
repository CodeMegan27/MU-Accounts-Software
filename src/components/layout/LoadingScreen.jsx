import React, { useState, useEffect } from 'react';
import { Loader2, CheckCircle2, ArrowRight, ShieldCheck, Database, Layers, Sparkles } from 'lucide-react';

export default function LoadingScreen({ onSkip }) {
  const [progress, setProgress] = useState(5);
  const [stageText, setStageText] = useState("Connecting to RS DESIGNS Database & local cache...");
  const [stepIndex, setStepIndex] = useState(1);

  useEffect(() => {
    // 6-second total duration split across smooth intervals (60ms * 100 = ~6000ms)
    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          if (onSkip) {
            setTimeout(onSkip, 300);
          }
          return 100;
        }

        const next = prev + 1;
        if (next < 25) {
          setStageText("Authenticating session & verifying cloud credentials...");
          setStepIndex(1);
        } else if (next < 55) {
          setStageText("Preparing Sales Orders, Purchase Bills & Item Masters...");
          setStepIndex(2);
        } else if (next < 85) {
          setStageText("Initializing Master GST Returns & P&L Statement Engine...");
          setStepIndex(3);
        } else {
          setStageText("Background preparation complete. Launching workspace...");
          setStepIndex(4);
        }
        return next;
      });
    }, 60);

    return () => clearInterval(interval);
  }, [onSkip]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-950 text-white select-none overflow-hidden">
      {/* Background Ambient Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-rose-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Top Skip Button */}
      {onSkip && (
        <div className="absolute top-5 right-5 sm:top-6 sm:right-6">
          <button
            onClick={onSkip}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-slate-900/80 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 text-xs font-semibold transition-all shadow-sm cursor-pointer"
          >
            <span>Skip & Enter</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      <div className="relative flex flex-col items-center space-y-6 max-w-md w-full px-6 text-center animate-in fade-in zoom-in-95 duration-300">
        {/* Animated Company Logo */}
        <div className="relative">
          <div className="w-24 h-24 rounded-3xl bg-white p-2.5 flex items-center justify-center shadow-2xl shadow-rose-900/50 border border-slate-700 overflow-hidden ring-4 ring-rose-500/20">
            <img 
              src="/rs_designs_logo.jpg" 
              alt="RS DESIGNS" 
              className="w-full h-full object-contain"
            />
          </div>
          <div className="absolute -bottom-2 -right-2 w-8 h-8 rounded-full bg-slate-900 border-2 border-slate-800 flex items-center justify-center shadow-md">
            <Loader2 className="w-4 h-4 text-rose-500 animate-spin" />
          </div>
        </div>

        {/* Company Branding */}
        <div>
          <h2 className="text-2xl sm:text-3xl font-black tracking-wide text-white flex items-center justify-center gap-1.5">
            <span>RS DESIGNS</span>
          </h2>
          <p className="text-[11px] text-rose-400 font-extrabold uppercase tracking-widest mt-1">
            Enterprise Management System
          </p>
        </div>

        {/* Real-time Progress Bar & Stage Status */}
        <div className="w-full space-y-2 pt-2">
          <div className="flex items-center justify-between text-xs text-slate-400 font-mono px-1">
            <span className="text-[11px] text-slate-400 font-sans font-semibold">Background Preparation</span>
            <span className="font-bold text-rose-400">{progress}%</span>
          </div>

          <div className="w-full bg-slate-900 h-2 rounded-full overflow-hidden border border-slate-800 p-0.5">
            <div 
              className="bg-gradient-to-r from-rose-500 via-brand-500 to-indigo-500 h-full rounded-full transition-all duration-100 ease-out shadow-xs"
              style={{ width: `${progress}%` }}
            />
          </div>

          <p className="text-xs text-slate-300 font-medium h-6 flex items-center justify-center truncate">
            {stageText}
          </p>
        </div>

        {/* 4-Step Milestone Checklist */}
        <div className="grid grid-cols-2 gap-2 w-full pt-1 text-left">
          <div className={`p-2.5 rounded-xl border text-[11px] flex items-center gap-2 transition-all ${
            stepIndex >= 1 ? 'bg-slate-900/90 border-slate-700 text-slate-200' : 'bg-slate-950/40 border-slate-900 text-slate-600'
          }`}>
            {stepIndex > 1 ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
            ) : (
              <Database className="w-3.5 h-3.5 text-rose-400 flex-shrink-0 animate-pulse" />
            )}
            <span className="truncate">Database & Auth</span>
          </div>

          <div className={`p-2.5 rounded-xl border text-[11px] flex items-center gap-2 transition-all ${
            stepIndex >= 2 ? 'bg-slate-900/90 border-slate-700 text-slate-200' : 'bg-slate-950/40 border-slate-900 text-slate-600'
          }`}>
            {stepIndex > 2 ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
            ) : (
              <Layers className="w-3.5 h-3.5 text-rose-400 flex-shrink-0 animate-pulse" />
            )}
            <span className="truncate">Registers & Orders</span>
          </div>

          <div className={`p-2.5 rounded-xl border text-[11px] flex items-center gap-2 transition-all ${
            stepIndex >= 3 ? 'bg-slate-900/90 border-slate-700 text-slate-200' : 'bg-slate-950/40 border-slate-900 text-slate-600'
          }`}>
            {stepIndex > 3 ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
            ) : (
              <ShieldCheck className="w-3.5 h-3.5 text-rose-400 flex-shrink-0 animate-pulse" />
            )}
            <span className="truncate">GST & Tax Center</span>
          </div>

          <div className={`p-2.5 rounded-xl border text-[11px] flex items-center gap-2 transition-all ${
            stepIndex >= 4 ? 'bg-slate-900/90 border-slate-700 text-slate-200' : 'bg-slate-950/40 border-slate-900 text-slate-600'
          }`}>
            {stepIndex >= 4 ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
            ) : (
              <Sparkles className="w-3.5 h-3.5 text-rose-400 flex-shrink-0 animate-pulse" />
            )}
            <span className="truncate">Workspace Ready</span>
          </div>
        </div>

        {/* Footer Security Badge */}
        <p className="text-[10px] text-slate-500 font-semibold tracking-wider uppercase pt-2">
          Offline First • Cloud Synced • RS DESIGNS 2026
        </p>
      </div>
    </div>
  );
}
