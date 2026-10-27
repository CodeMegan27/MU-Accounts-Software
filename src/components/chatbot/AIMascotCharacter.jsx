import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useData } from '../../context/DataContext';
import { formatCurrency } from '../../utils/formatters';
import { 
  Sparkles, 
  MessageSquare, 
  ChevronRight, 
  X, 
  Pause, 
  Play, 
  RotateCcw,
  Volume2,
  VolumeX,
  TrendingUp,
  Receipt,
  Users,
  AlertCircle,
  Lightbulb,
  Minimize2
} from 'lucide-react';

export default function AIMascotCharacter({ onOpenChat }) {
  const dataContext = useData() || {};
  const sales = Array.isArray(dataContext.sales) ? dataContext.sales : [];
  const bills = Array.isArray(dataContext.bills) ? dataContext.bills : [];
  const vendors = Array.isArray(dataContext.vendors) ? dataContext.vendors : [];
  const logs = Array.isArray(dataContext.logs) ? dataContext.logs : [];

  // Mascot Position & Movement State
  const [position, setPosition] = useState(() => {
    try {
      const saved = localStorage.getItem('rsp_mascot_pos');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return {
      x: typeof window !== 'undefined' ? Math.max(30, window.innerWidth - 180) : 1000,
      y: typeof window !== 'undefined' ? Math.max(90, window.innerHeight - 160) : 650
    };
  });

  const positionRef = useRef(position);
  positionRef.current = position;

  const [facing, setFacing] = useState(-1); // 1 = right, -1 = left
  const [isWalking, setIsWalking] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isJumping, setIsJumping] = useState(false);
  const [showControls, setShowControls] = useState(false);

  // Settings
  const [autoRoam, setAutoRoam] = useState(() => {
    return localStorage.getItem('rsp_mascot_roam') !== 'false';
  });
  const [speechEnabled, setSpeechEnabled] = useState(() => {
    return localStorage.getItem('rsp_mascot_speech') !== 'false';
  });

  // Minimize Peek-a-boo State (sticks to top-right/left edge, only head peeks & blinks, hides, reappears on other corner)
  const [isMinimized, setIsMinimized] = useState(() => {
    try {
      return localStorage.getItem('rsp_mascot_minimized') === 'true';
    } catch (e) {
      return false;
    }
  });
  const [peekSide, setPeekSide] = useState('right'); // 'right' | 'left'
  const [peekPhase, setPeekPhase] = useState('peeking'); // 'peeking' | 'hiding'
  const [wakeUpSpeech, setWakeUpSpeech] = useState(null);

  // Dialogue & Insights Engine
  const [currentTipIndex, setCurrentTipIndex] = useState(0);
  const [isSpeechVisible, setIsSpeechVisible] = useState(true);
  const [blink, setBlink] = useState(false);

  const mascotRef = useRef(null);
  const dragStartRef = useRef({ startX: 0, startY: 0, originX: 0, originY: 0, hasMoved: false });
  const roamTimeoutRef = useRef(null);

  // Periodic Eye Blink
  useEffect(() => {
    const blinkInterval = setInterval(() => {
      setBlink(true);
      setTimeout(() => setBlink(false), 200);
    }, 3500);
    return () => clearInterval(blinkInterval);
  }, []);

  // Minimized Corner Peek-a-boo Cycle (Stick to edge, peek head out, blink eyes, hide, reappear on opposite corner)
  // Cleanly teleports behind the wall without crossing the page!
  useEffect(() => {
    if (!isMinimized) return;

    let timer;
    if (peekPhase === 'peeking') {
      // Stay peeking and blinking on this corner for 5 seconds, then duck into hiding
      timer = setTimeout(() => {
        setPeekPhase('hiding');
      }, 5000);
    } else if (peekPhase === 'hiding') {
      // Takes 400ms to smoothly slide behind wall. Once hidden, teleport silently to the other side
      timer = setTimeout(() => {
        setPeekPhase('teleporting');
        setPeekSide(prev => (prev === 'right' ? 'left' : 'right'));
      }, 420);
    } else if (peekPhase === 'teleporting') {
      // Rest hidden behind the new wall for 1.2s, then smoothly peek out!
      timer = setTimeout(() => {
        setPeekPhase('peeking');
      }, 1200);
    }

    return () => clearTimeout(timer);
  }, [isMinimized, peekPhase]);

  // Extra cute blink when emerging from corner
  useEffect(() => {
    if (isMinimized && peekPhase === 'peeking') {
      const peekBlink = setTimeout(() => {
        setBlink(true);
        setTimeout(() => setBlink(false), 200);
      }, 900);
      return () => clearTimeout(peekBlink);
    }
  }, [isMinimized, peekPhase, peekSide]);

  // Compute Live Company Insights
  const insightsList = useMemo(() => {
    const list = [];
    const todayStr = new Date().toISOString().split('T')[0];

    // 1. Today's Sales
    const todaySales = sales.filter(s => (s.date || '').startsWith(todayStr));
    const totalTodaySales = todaySales.reduce((sum, s) => sum + (parseFloat(s.finalAmount || s.totalAmount) || 0), 0);
    if (todaySales.length > 0) {
      list.push({
        type: 'sales',
        badge: 'TODAY SALES',
        icon: TrendingUp,
        color: 'text-emerald-400',
        text: `Today we recorded ${todaySales.length} sale${todaySales.length > 1 ? 's' : ''} worth ${formatCurrency(totalTodaySales)}! Keep up the momentum! 🔥`
      });
    } else {
      list.push({
        type: 'sales',
        badge: 'SALES READY',
        icon: TrendingUp,
        color: 'text-blue-400',
        text: `Ready for today's sales register! All bills and GST reports are live and synced.`
      });
    }

    // 2. Pending Bills
    const unpaidBills = bills.filter(b => (parseFloat(b.balance) || 0) > 0);
    if (unpaidBills.length > 0) {
      const topPending = unpaidBills.slice(0, 3);
      const totalPending = topPending.reduce((sum, b) => sum + (parseFloat(b.balance) || 0), 0);
      list.push({
        type: 'bills',
        badge: 'PAYABLES NOTICE',
        icon: Receipt,
        color: 'text-amber-400',
        text: `${unpaidBills.length} purchase bill${unpaidBills.length > 1 ? 's' : ''} pending payment (${formatCurrency(totalPending)}). Click to review!`
      });
    }

    // 3. Top Vendor
    if (vendors.length > 0) {
      const sortedVendors = [...vendors].sort((a, b) => (parseFloat(b.totalBilled || 0) - parseFloat(a.totalBilled || 0)));
      const topV = sortedVendors[0];
      if (topV) {
        list.push({
          type: 'vendor',
          badge: 'TOP PARTNER',
          icon: Users,
          color: 'text-indigo-400',
          text: `Vendor highlight: ${topV.name} is leading with total billed ${formatCurrency(topV.totalBilled || 0)}.`
        });
      }
    }

    // 4. Recent Audit Activity
    if (logs.length > 0) {
      const latestLog = logs[0];
      list.push({
        type: 'log',
        badge: 'LIVE SYSTEM LOG',
        icon: AlertCircle,
        color: 'text-cyan-400',
        text: `Activity alert: ${latestLog.action || 'Update'} recorded by ${latestLog.performedBy || 'User'} on ${latestLog.entity || 'Records'}.`
      });
    }

    // 5. Friendly Pro-Tips
    list.push({
      type: 'tip',
      badge: 'PRO TIP',
      icon: Lightbulb,
      color: 'text-amber-300',
      text: `Did you know? In Vendors List, click any vendor's name directly to open their full statement of account!`
    });

    list.push({
      type: 'tip',
      badge: 'EXCEL FILTERS',
      icon: Lightbulb,
      color: 'text-emerald-300',
      text: `Every table column header now has Excel-style sorting & deduplicated filters for faster lookup!`
    });

    list.push({
      type: 'ai',
      badge: 'MEGAN AI',
      icon: Sparkles,
      color: 'text-violet-300',
      text: `I am Megan AI! I can generate complete master audit reports, PDF summaries, and Excel sheets! Click me to chat.`
    });

    return list;
  }, [sales, bills, vendors, logs]);

  // Rotate through speech insights every 12 seconds
  useEffect(() => {
    if (!speechEnabled) return;
    const interval = setInterval(() => {
      setCurrentTipIndex(prev => (prev + 1) % insightsList.length);
      setIsSpeechVisible(true);
    }, 12000);
    return () => clearInterval(interval);
  }, [speechEnabled, insightsList.length]);

  // Auto-Roam across whole website: 10 sec walk, 3 sec rest, repeat (DISABLED while minimized)
  // Highly optimized: uses hardware-accelerated CSS transition to eliminate per-frame React re-renders!
  useEffect(() => {
    if (!autoRoam || isDragging || isMinimized) {
      setIsWalking(false);
      return;
    }

    let isCancelled = false;
    let walkTimer = null;

    const runCycle = () => {
      if (isCancelled || !autoRoam || isDragging || isMinimized) return;

      const screenWidth = typeof window !== 'undefined' ? window.innerWidth : 1200;
      const screenHeight = typeof window !== 'undefined' ? window.innerHeight : 800;

      // Safe bounds across the entire website
      const minX = 40;
      const maxX = Math.max(minX + 80, screenWidth - 140);
      const minY = 85; // Below header navbar
      const maxY = Math.max(minY + 80, screenHeight - 140);

      const curX = positionRef.current.x;
      const curY = positionRef.current.y;

      // Pick a destination anywhere across the website
      let targetX = minX + Math.random() * (maxX - minX);
      let targetY = minY + Math.random() * (maxY - minY);

      // Ensure good roaming travel distance
      const dist = Math.hypot(targetX - curX, targetY - curY);
      if (dist < 180) {
        targetX = curX > (minX + maxX) / 2 ? minX + 60 + Math.random() * 200 : maxX - 60 - Math.random() * 200;
        targetY = curY > (minY + maxY) / 2 ? minY + 60 + Math.random() * 160 : maxY - 60 - Math.random() * 160;
      }

      targetX = Math.round(Math.max(minX, Math.min(targetX, maxX)));
      targetY = Math.round(Math.max(minY, Math.min(targetY, maxY)));

      setFacing(targetX >= curX ? 1 : -1);
      setIsWalking(true);
      setPosition({ x: targetX, y: targetY });

      // Exactly 10 seconds smooth walk transition handled smoothly by CSS
      walkTimer = setTimeout(() => {
        if (isCancelled || isDragging || isMinimized) return;
        setIsWalking(false);

        try {
          localStorage.setItem('rsp_mascot_pos', JSON.stringify({ x: targetX, y: targetY }));
        } catch (e) {}

        // Cycle to next dialogue insight during rest
        setCurrentTipIndex(prev => (prev + 1) % insightsList.length);
        setIsSpeechVisible(true);

        // 3 seconds rest pause, then walk again!
        roamTimeoutRef.current = setTimeout(() => {
          if (!isCancelled) {
            runCycle();
          }
        }, 3000);
      }, 10000);
    };

    // Begin cycle with a brief pause, then run 10s walk / 3s rest
    roamTimeoutRef.current = setTimeout(() => {
      runCycle();
    }, 1200);

    return () => {
      isCancelled = true;
      if (walkTimer) clearTimeout(walkTimer);
      if (roamTimeoutRef.current) clearTimeout(roamTimeoutRef.current);
    };
  }, [autoRoam, isDragging, isMinimized, insightsList.length]);

  // Window resize bounds clamping
  useEffect(() => {
    const handleResize = () => {
      setPosition(prev => {
        const maxX = Math.max(20, window.innerWidth - 180);
        const maxY = Math.max(20, window.innerHeight - 150);
        const clampedX = Math.max(20, Math.min(prev.x, maxX));
        const clampedY = Math.max(20, Math.min(prev.y, maxY));
        if (clampedX !== prev.x || clampedY !== prev.y) {
          const next = { x: clampedX, y: clampedY };
          try {
            localStorage.setItem('rsp_mascot_pos', JSON.stringify(next));
          } catch (e) {}
          return next;
        }
        return prev;
      });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Drag and Drop Handling
  const handleDragStart = (e) => {
    if (e.button !== undefined && e.button !== 0) return;
    if (e.target.closest('button, a')) return;

    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;

    dragStartRef.current = {
      startX: clientX,
      startY: clientY,
      originX: position.x,
      originY: position.y,
      hasMoved: false
    };

    setIsDragging(true);

    const onMove = (moveEvt) => {
      const curX = moveEvt.touches ? moveEvt.touches[0].clientX : moveEvt.clientX;
      const curY = moveEvt.touches ? moveEvt.touches[0].clientY : moveEvt.clientY;
      const dx = curX - dragStartRef.current.startX;
      const dy = curY - dragStartRef.current.startY;

      if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
        dragStartRef.current.hasMoved = true;
      }

      let newX = dragStartRef.current.originX + dx;
      let newY = dragStartRef.current.originY + dy;

      const maxX = Math.max(20, window.innerWidth - 140);
      const maxY = Math.max(20, window.innerHeight - 140);

      newX = Math.max(10, Math.min(newX, maxX));
      newY = Math.max(10, Math.min(newY, maxY));

      setPosition({ x: Math.round(newX), y: Math.round(newY) });
    };

    const onEnd = () => {
      setIsDragging(false);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onEnd);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onEnd);

      if (dragStartRef.current.hasMoved) {
        try {
          setPosition(latest => {
            localStorage.setItem('rsp_mascot_pos', JSON.stringify(latest));
            return latest;
          });
        } catch (e) {}
      }
    };

    window.addEventListener('mousemove', onMove, { passive: false });
    window.addEventListener('mouseup', onEnd);
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('touchend', onEnd);
  };

  // Click Mascot to Trigger Chat or Wake Up from Minimize
  const handleMascotClick = (e) => {
    if (dragStartRef.current.hasMoved) return;
    if (isMinimized) {
      handleWakeUp(e);
      return;
    }
    setIsJumping(true);
    setTimeout(() => setIsJumping(false), 600);
    if (onOpenChat) onOpenChat();
  };

  const handleToggleMinimize = (e) => {
    if (e) e.stopPropagation();
    setIsMinimized(true);
    setPeekSide('right');
    setPeekPhase('peeking');
    try {
      localStorage.setItem('rsp_mascot_minimized', 'true');
    } catch (err) {}
  };

  const handleWakeUp = (e) => {
    if (e) e.stopPropagation();
    setIsMinimized(false);
    try {
      localStorage.setItem('rsp_mascot_minimized', 'false');
    } catch (err) {}

    const curScreenWidth = typeof window !== 'undefined' ? window.innerWidth : 1200;
    const restoreX = peekSide === 'left' ? 100 : Math.max(90, curScreenWidth - 220);
    const restoreY = 135;

    setPosition({ x: restoreX, y: restoreY });
    setFacing(peekSide === 'left' ? 1 : -1);
    setIsWalking(false);
    setIsJumping(true);
    setTimeout(() => setIsJumping(false), 800);

    setWakeUpSpeech("I'm back! Let's explore the website together! 🚀");
    setIsSpeechVisible(true);
    setTimeout(() => setWakeUpSpeech(null), 7000);
  };

  const handleToggleRoam = () => {
    setAutoRoam(prev => {
      const next = !prev;
      localStorage.setItem('rsp_mascot_roam', next.toString());
      return next;
    });
  };

  const handleToggleSpeech = () => {
    setSpeechEnabled(prev => {
      const next = !prev;
      localStorage.setItem('rsp_mascot_speech', next.toString());
      return next;
    });
  };

  const handleResetPosition = () => {
    const defaultPos = {
      x: Math.max(20, window.innerWidth - 180),
      y: Math.max(20, window.innerHeight - 150)
    };
    setPosition(defaultPos);
    try {
      localStorage.setItem('rsp_mascot_pos', JSON.stringify(defaultPos));
    } catch (e) {}
  };

  const currentInsight = insightsList[currentTipIndex] || insightsList[0];
  const IconComponent = currentInsight.icon || Sparkles;

  const screenWidth = typeof window !== 'undefined' ? window.innerWidth : 1200;
  const screenHeight = typeof window !== 'undefined' ? window.innerHeight : 800;
  const isBotOnLeftSide = position.x < screenWidth / 2;
  const isNearBottom = position.y > screenHeight - 200;

  // Minimized Corner Peek-a-boo Coordinates
  let displayX = position.x;
  let displayY = position.y;
  let displayFacing = facing;
  let displayRotation = 0;
  let transitionStyle = 'transform 0.2s ease-out, left 0.3s ease-out, top 0.3s ease-out';
  let opacityStyle = 1;

  if (isMinimized) {
    displayY = 82; // Sticky near top corner edge under navbar
    if (peekSide === 'right') {
      displayFacing = -1; // Face looking into the screen (left)
      displayRotation = -12;
      displayX = (peekPhase === 'peeking') ? (screenWidth - 46) : (screenWidth + 65);
    } else {
      displayFacing = 1; // Face looking into the screen (right)
      displayRotation = 12;
      displayX = (peekPhase === 'peeking') ? -34 : -145;
    }

    if (peekPhase === 'teleporting') {
      transitionStyle = 'none';
      opacityStyle = 0;
    } else if (peekPhase === 'hiding') {
      transitionStyle = 'all 0.4s ease-in';
      opacityStyle = 1;
    } else {
      // peeking out
      transitionStyle = 'all 0.55s cubic-bezier(0.34, 1.4, 0.64, 1)';
      opacityStyle = 1;
    }
  } else if (isDragging) {
    transitionStyle = 'none';
  } else if (isWalking) {
    transitionStyle = 'left 10s linear, top 10s linear';
  }

  return (
    <div
      id="megan-ai-mascot"
      ref={mascotRef}
      onMouseEnter={() => setShowControls(true)}
      onMouseLeave={() => setShowControls(false)}
      style={{
        position: 'fixed',
        left: `${displayX}px`,
        top: `${displayY}px`,
        zIndex: 49,
        transition: transitionStyle,
        opacity: opacityStyle,
        pointerEvents: isMinimized && peekPhase === 'teleporting' ? 'none' : 'auto',
        willChange: 'left, top, transform'
      }}
      className="select-none touch-none no-print print:hidden megan-ai-element"
    >
      {/* Embedded CSS for 3D Clay Walk & Idle Keyframes */}
      <style>{`
        @keyframes mascotFloat {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-5px); }
        }
        @keyframes mascotWalkBob {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          25% { transform: translateY(-4px) rotate(2deg); }
          50% { transform: translateY(0px) rotate(0deg); }
          75% { transform: translateY(-4px) rotate(-2deg); }
        }
        @keyframes legWalkLeft {
          0%, 100% { transform: rotate(0deg) translateY(0px); }
          50% { transform: rotate(26deg) translateY(-5px); }
        }
        @keyframes legWalkRight {
          0%, 100% { transform: rotate(0deg) translateY(0px); }
          50% { transform: rotate(-26deg) translateY(3px); }
        }
        @keyframes armSwing {
          0%, 100% { transform: rotate(0deg); }
          50% { transform: rotate(18deg); }
        }
        @keyframes eyeGaze {
          0%, 45%, 55%, 100% { transform: translateX(0px); }
          50% { transform: translateX(2px); }
        }
        @keyframes mascotJumpAnim {
          0% { transform: scale(1) translateY(0px); }
          40% { transform: scale(1.15, 0.85) translateY(-22px); }
          70% { transform: scale(0.92, 1.08) translateY(-6px); }
          100% { transform: scale(1) translateY(0px); }
        }
        @keyframes shadowScale {
          0%, 100% { transform: scaleX(1); opacity: 0.35; }
          50% { transform: scaleX(0.75); opacity: 0.2; }
        }
      `}</style>

      {/* Minimized Peek Indicator Pill */}
      {isMinimized && peekPhase === 'peeking' && (
        <div 
          onClick={handleWakeUp}
          className={`absolute z-50 whitespace-nowrap bg-slate-900/95 backdrop-blur-md text-white border border-cyan-400/60 shadow-2xl rounded-full px-3 py-1.5 cursor-pointer hover:scale-105 transition-all text-xs font-bold flex items-center gap-1.5 animate-bounce ${
            peekSide === 'right' ? 'right-full mr-2.5 top-2' : 'left-full ml-2.5 top-2'
          }`}
          title="Click to bring Megan AI out to walk around the website!"
        >
          <Sparkles className="w-3.5 h-3.5 text-cyan-300 animate-spin" />
          <span>Click me to wake up! 👋</span>
        </div>
      )}

      {/* Floating RPG Game Speech Bubble - Positioned to the SIDE of the bot (Never overlays face) */}
      {!isMinimized && speechEnabled && isSpeechVisible && !isDragging && (
        <div 
          onClick={handleMascotClick}
          className={`absolute z-50 w-64 sm:w-72 bg-slate-900/95 backdrop-blur-md text-white border border-indigo-500/40 shadow-2xl rounded-2xl p-3 cursor-pointer group transition-all duration-300 hover:scale-105 hover:border-indigo-400 animate-in fade-in zoom-in-95 ${
            isNearBottom ? 'bottom-0' : '-top-2'
          } ${
            isBotOnLeftSide 
              ? 'left-full ml-4' 
              : 'right-full mr-4'
          }`}
        >
          {/* Badge & Close */}
          <div className="flex items-center justify-between mb-1 text-[10px] font-bold tracking-wider">
            <span className={`flex items-center gap-1.5 uppercase font-mono px-2 py-0.5 rounded-full bg-white/10 ${wakeUpSpeech ? 'text-emerald-400' : currentInsight.color}`}>
              <IconComponent className="w-3 h-3 animate-pulse" />
              {wakeUpSpeech ? 'MEGAN AI ACTIVE' : currentInsight.badge}
            </span>
            <div className="flex items-center gap-1">
              {!wakeUpSpeech && (
                <button 
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setCurrentTipIndex(prev => (prev + 1) % insightsList.length);
                  }}
                  className="p-1 text-slate-400 hover:text-white rounded-md hover:bg-white/10"
                  title="Next insight"
                >
                  <ChevronRight className="w-3 h-3" />
                </button>
              )}
              <button 
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsSpeechVisible(false);
                }}
                className="p-1 text-slate-400 hover:text-rose-400 rounded-md hover:bg-white/10"
                title="Dismiss"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          </div>

          {/* Dialogue Text */}
          <p className="text-xs text-slate-200 leading-relaxed font-medium line-clamp-3">
            {wakeUpSpeech || currentInsight.text}
          </p>

          {/* Click to Chat Cue */}
          <div className="mt-2 pt-1.5 border-t border-slate-800 flex items-center justify-between text-[10px] text-indigo-300 font-semibold">
            <span className="flex items-center gap-1 group-hover:text-indigo-200">
              <MessageSquare className="w-3 h-3" /> Click to open Megan AI
            </span>
            <span className="text-[9px] text-slate-400 font-mono">LIVE AGENT</span>
          </div>

          {/* Speech Pointer Arrow pointing horizontally to the mascot */}
          {isBotOnLeftSide ? (
            /* Bot is on the left -> Bubble is on the right -> Arrow is on left edge of bubble pointing left to bot */
            <div className="absolute -left-1.5 top-8 w-3.5 h-3.5 bg-slate-900 border-l border-b border-indigo-500/40 transform rotate-45" />
          ) : (
            /* Bot is on the right -> Bubble is on the left -> Arrow is on right edge of bubble pointing right to bot */
            <div className="absolute -right-1.5 top-8 w-3.5 h-3.5 bg-slate-900 border-r border-t border-indigo-500/40 transform rotate-45" />
          )}
        </div>
      )}

      {/* Mini Companion Controls (Pill Bar on Hover) - Only when not minimized */}
      {!isMinimized && (
        <div 
          className={`absolute -top-8 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-slate-900/90 backdrop-blur-md px-2 py-1 rounded-full border border-slate-700 shadow-lg text-[10px] transition-all duration-200 ${
            showControls ? 'opacity-100 scale-100' : 'opacity-0 scale-90 pointer-events-none'
          }`}
        >
          <button
            type="button"
            onClick={handleToggleRoam}
            className={`p-1 rounded-full transition-colors ${autoRoam ? 'text-emerald-400 hover:bg-white/10' : 'text-slate-400 hover:bg-white/10'}`}
            title={autoRoam ? 'Pause walking' : 'Allow roaming around'}
          >
            {autoRoam ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
          </button>
          <button
            type="button"
            onClick={handleToggleSpeech}
            className={`p-1 rounded-full transition-colors ${speechEnabled ? 'text-indigo-400 hover:bg-white/10' : 'text-slate-400 hover:bg-white/10'}`}
            title={speechEnabled ? 'Mute dialogue speech' : 'Enable dialogue speech'}
          >
            {speechEnabled ? <Volume2 className="w-3 h-3" /> : <VolumeX className="w-3 h-3" />}
          </button>
          <button
            type="button"
            onClick={handleToggleMinimize}
            className="p-1 text-slate-400 hover:text-cyan-400 rounded-full hover:bg-white/10 transition-colors"
            title="Minimize to screen corner (Peek-a-boo mode)"
          >
            <Minimize2 className="w-3 h-3" />
          </button>
          <button
            type="button"
            onClick={handleResetPosition}
            className="p-1 text-slate-400 hover:text-amber-400 rounded-full hover:bg-white/10 transition-colors"
            title="Reset position to bottom-right"
          >
            <RotateCcw className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* 3D Clay Animated Mascot Character Body */}
      <div
        onMouseDown={isMinimized ? undefined : handleDragStart}
        onTouchStart={isMinimized ? undefined : handleDragStart}
        onClick={handleMascotClick}
        style={{
          transform: `scaleX(${displayFacing}) rotate(${displayRotation}deg) ${isJumping ? 'scale(1.15) translateY(-20px)' : ''}`,
          animation: isMinimized 
            ? (peekPhase === 'peeking' ? 'mascotFloat 2.8s infinite ease-in-out' : 'none')
            : isJumping 
            ? 'mascotJumpAnim 0.6s ease-out' 
            : isWalking 
            ? 'mascotWalkBob 0.6s infinite ease-in-out' 
            : 'mascotFloat 3.5s infinite ease-in-out'
        }}
        className={`relative w-20 h-24 transition-transform duration-200 group ${
          isMinimized ? 'cursor-pointer' : 'cursor-grab active:cursor-grabbing'
        }`}
        title={isMinimized ? "I'm peeking! Click me to bring me out to walk!" : "I'm Megan AI! Drag me anywhere or click to chat."}
      >
        {/* SVG Render for Modern 3D Vector Character */}
        <svg 
          viewBox="0 0 100 120" 
          className="w-full h-full overflow-visible drop-shadow-xl"
        >
          <defs>
            {/* Clay 3D Gradients */}
            <radialGradient id="bodyClayGrad" cx="35%" cy="30%" r="70%">
              <stop offset="0%" stopColor="#818cf8" />
              <stop offset="40%" stopColor="#4f46e5" />
              <stop offset="85%" stopColor="#3730a3" />
              <stop offset="100%" stopColor="#1e1b4b" />
            </radialGradient>

            <radialGradient id="headClayGrad" cx="35%" cy="25%" r="75%">
              <stop offset="0%" stopColor="#93c5fd" />
              <stop offset="45%" stopColor="#3b82f6" />
              <stop offset="85%" stopColor="#1d4ed8" />
              <stop offset="100%" stopColor="#172554" />
            </radialGradient>

            <linearGradient id="visorGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#0f172a" />
              <stop offset="100%" stopColor="#1e293b" />
            </linearGradient>

            <linearGradient id="eyeGlow" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#38bdf8" />
              <stop offset="100%" stopColor="#0284c7" />
            </linearGradient>

            <radialGradient id="shoeGrad" cx="40%" cy="30%" r="70%">
              <stop offset="0%" stopColor="#64748b" />
              <stop offset="60%" stopColor="#334155" />
              <stop offset="100%" stopColor="#0f172a" />
            </radialGradient>

            <filter id="softGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="2.5" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Left Ear Antenna */}
          <path d="M 28 22 Q 20 12 18 16 Q 22 24 30 26 Z" fill="url(#bodyClayGrad)" />
          <circle cx="18" cy="14" r="3.5" fill="#38bdf8" filter="url(#softGlow)" />

          {/* Right Ear Antenna */}
          <path d="M 72 22 Q 80 12 82 16 Q 78 24 70 26 Z" fill="url(#bodyClayGrad)" />
          <circle cx="82" cy="14" r="3.5" fill="#38bdf8" filter="url(#softGlow)" />

          {/* Left Arm */}
          <g style={{ animation: isWalking ? 'armSwing 0.6s infinite ease-in-out' : 'none', transformOrigin: '28px 58px' }}>
            <rect x="20" y="55" width="10" height="22" rx="5" fill="url(#bodyClayGrad)" />
            <circle cx="25" cy="78" r="5" fill="#93c5fd" />
          </g>

          {/* Right Arm (Waving or idle) */}
          <g style={{ animation: isWalking ? 'armSwing 0.6s infinite reverse ease-in-out' : 'none', transformOrigin: '72px 58px' }}>
            <rect x="70" y="55" width="10" height="22" rx="5" fill="url(#bodyClayGrad)" />
            <circle cx="75" cy="78" r="5" fill="#93c5fd" />
          </g>

          {/* Left Leg & 3D Walking Shoe */}
          <g style={{ animation: isWalking ? 'legWalkLeft 0.6s infinite ease-in-out' : 'none', transformOrigin: '38px 84px' }}>
            <rect x="34" y="80" width="10" height="20" rx="4" fill="url(#bodyClayGrad)" />
            {/* Shoe */}
            <path d="M 28 98 Q 30 92 42 92 Q 48 94 48 102 Q 36 104 28 98 Z" fill="url(#shoeGrad)" />
            {/* Neon sole */}
            <rect x="29" y="100" width="18" height="2.5" rx="1" fill="#38bdf8" />
          </g>

          {/* Right Leg & 3D Walking Shoe */}
          <g style={{ animation: isWalking ? 'legWalkRight 0.6s infinite ease-in-out' : 'none', transformOrigin: '62px 84px' }}>
            <rect x="56" y="80" width="10" height="20" rx="4" fill="url(#bodyClayGrad)" />
            {/* Shoe */}
            <path d="M 50 98 Q 52 92 64 92 Q 70 94 70 102 Q 58 104 50 98 Z" fill="url(#shoeGrad)" />
            {/* Neon sole */}
            <rect x="51" y="100" width="18" height="2.5" rx="1" fill="#38bdf8" />
          </g>

          {/* 3D Torso / Clay Body */}
          <rect x="28" y="46" width="44" height="42" rx="18" fill="url(#bodyClayGrad)" />

          {/* Glowing Reactor Chest Core */}
          <circle cx="50" cy="65" r="7" fill="#0f172a" />
          <circle cx="50" cy="65" r="5" fill="#38bdf8" filter="url(#softGlow)" className="animate-pulse" />
          <circle cx="48.5" cy="63.5" r="1.5" fill="#ffffff" />

          {/* 3D Head */}
          <rect x="24" y="16" width="52" height="38" rx="16" fill="url(#headClayGrad)" />
          {/* Specular Highlight on Head */}
          <ellipse cx="38" cy="22" rx="10" ry="3.5" fill="#ffffff" opacity="0.35" transform="rotate(-10 38 22)" />

          {/* Dark Glass Visor */}
          <rect x="30" y="24" width="40" height="22" rx="9" fill="url(#visorGrad)" stroke="#1e293b" strokeWidth="1" />

          {/* Animated Expressive Cyan Eyes */}
          <g style={{ transform: blink ? 'scaleY(0.1)' : 'scaleY(1)', transformOrigin: '50px 35px' }}>
            {/* Left Eye */}
            <rect x="37" y="30" width="8" height="10" rx="4" fill="url(#eyeGlow)" filter="url(#softGlow)" />
            <circle cx="39" cy="32" r="1.5" fill="#ffffff" />

            {/* Right Eye */}
            <rect x="55" y="30" width="8" height="10" rx="4" fill="url(#eyeGlow)" filter="url(#softGlow)" />
            <circle cx="57" cy="32" r="1.5" fill="#ffffff" />
          </g>
        </svg>

        {/* Dynamic Floor Shadow (Hidden while minimized at edge) */}
        {!isMinimized && (
          <div 
            style={{
              animation: isWalking ? 'shadowScale 0.6s infinite ease-in-out' : 'shadowScale 3.5s infinite ease-in-out'
            }}
            className="absolute -bottom-1 left-2 right-2 h-3 bg-slate-900/40 rounded-full blur-[3px] pointer-events-none" 
          />
        )}
      </div>
    </div>
  );
}
