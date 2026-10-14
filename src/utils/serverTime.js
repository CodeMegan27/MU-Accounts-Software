/**
 * Server Time Synchronization Utility
 * Synchronizes application timestamps with real-world server time (IST / NTP),
 * bypassing inaccurate or skewed local computer system clocks.
 */

let memoryOffsetMs = null;
let lastSyncTimestamp = null;
let syncSource = 'none';

// Retrieve cached offset from localStorage if available
function getStoredOffset() {
  if (memoryOffsetMs !== null) return memoryOffsetMs;
  try {
    const stored = localStorage.getItem('rsp_server_time_offset');
    if (stored !== null && !isNaN(Number(stored))) {
      memoryOffsetMs = Number(stored);
      return memoryOffsetMs;
    }
  } catch (e) {}
  return 0;
}

/**
 * Returns current accurate Date object adjusted by server offset
 */
export function getServerTime() {
  const offset = getStoredOffset();
  return new Date(Date.now() + offset);
}

/**
 * Returns current accurate ISO string adjusted by server offset
 */
export function getServerTimeISO() {
  return getServerTime().toISOString();
}

/**
 * Returns the current offset in milliseconds (server - local)
 */
export function getServerTimeOffsetMs() {
  return getStoredOffset();
}

/**
 * Returns sync metadata for UI display
 */
export function getServerSyncStatus() {
  return {
    offsetMs: getStoredOffset(),
    lastSync: lastSyncTimestamp || localStorage.getItem('rsp_server_time_last_sync'),
    source: syncSource || localStorage.getItem('rsp_server_time_source') || 'system',
    isSynced: memoryOffsetMs !== null || localStorage.getItem('rsp_server_time_offset') !== null
  };
}

/**
 * Perform server time synchronization from available endpoints
 */
export async function syncServerTime() {
  let serverTimestamp = null;
  let source = 'none';

  // 1. Try local dev-server endpoint
  try {
    const res = await fetch('/api/server-time', { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      if (data && data.serverTimestamp) {
        serverTimestamp = data.serverTimestamp;
        source = 'dev_server (' + (data.source || 'cloud') + ')';
      }
    }
  } catch (e) {
    // Dev server endpoint unavailable, proceed to public fallback
  }

  // 2. Fallback to public TimeAPI (Asia/Kolkata timezone with CORS support)
  if (!serverTimestamp) {
    try {
      const res = await fetch('https://timeapi.io/api/time/current/zone?timeZone=Asia/Kolkata', {
        cache: 'no-store'
      });
      if (res.ok) {
        const data = await res.json();
        if (data && data.dateTime) {
          serverTimestamp = new Date(data.dateTime + '+05:30').getTime();
          source = 'timeapi.io (IST)';
        }
      }
    } catch (e) {
      // timeapi.io failed
    }
  }

  // 3. Fallback to WorldTimeAPI
  if (!serverTimestamp) {
    try {
      const res = await fetch('https://worldtimeapi.org/api/timezone/Asia/Kolkata', {
        cache: 'no-store'
      });
      if (res.ok) {
        const data = await res.json();
        if (data && (data.utc_datetime || data.datetime)) {
          serverTimestamp = new Date(data.utc_datetime || data.datetime).getTime();
          source = 'worldtimeapi.org (IST)';
        }
      }
    } catch (e) {}
  }

  if (serverTimestamp) {
    const localNow = Date.now();
    const offset = serverTimestamp - localNow;
    memoryOffsetMs = offset;
    lastSyncTimestamp = new Date().toISOString();
    syncSource = source;

    try {
      localStorage.setItem('rsp_server_time_offset', String(offset));
      localStorage.setItem('rsp_server_time_last_sync', lastSyncTimestamp);
      localStorage.setItem('rsp_server_time_source', source);
    } catch (e) {}

    // Dispatch notification event for active components
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('rsp_server_time_synced', {
        detail: {
          offset,
          serverTime: getServerTimeISO(),
          source
        }
      }));
    }

    return {
      success: true,
      offsetMs: offset,
      serverTime: getServerTimeISO(),
      source
    };
  }

  return {
    success: false,
    offsetMs: getStoredOffset(),
    serverTime: getServerTimeISO(),
    source: 'fallback'
  };
}

/**
 * Format audit timestamp cleanly in Indian Standard Time (IST)
 */
export function formatServerTimestamp(dateInput) {
  if (!dateInput) return '-';
  try {
    const date = new Date(dateInput);
    if (isNaN(date.getTime())) return String(dateInput);

    return date.toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });
  } catch (e) {
    return String(dateInput);
  }
}

/**
 * Helper to format offset for human reading e.g. "+14h 58m"
 */
export function formatOffsetDescription(offsetMs) {
  if (!offsetMs || Math.abs(offsetMs) < 1000) return 'In Sync with System Clock';
  const sign = offsetMs > 0 ? '+' : '-';
  const absMs = Math.abs(offsetMs);
  const hours = Math.floor(absMs / (1000 * 60 * 60));
  const minutes = Math.floor((absMs % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((absMs % (1000 * 60)) / 1000);

  if (hours > 0) return `${sign}${hours}h ${minutes}m (${sign > 0 ? 'ahead of' : 'behind'} computer clock)`;
  if (minutes > 0) return `${sign}${minutes}m ${seconds}s`;
  return `${sign}${seconds}s`;
}
