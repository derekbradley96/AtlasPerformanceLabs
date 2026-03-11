/**
 * DEV only: "Supabase ON/OFF" badge.
 * OFF if VITE_SUPABASE_URL is missing/empty; ON if present and GET /functions/v1/health returns 200.
 * Never blocks render; updates async.
 */
import React, { useState, useEffect } from 'react';
import { colors } from '@/ui/tokens';

const isDev = typeof import.meta !== 'undefined' && import.meta.env?.DEV;

function getBaseUrl() {
  try {
    const url = import.meta.env?.VITE_SUPABASE_URL;
    if (typeof url !== 'string' || !url.trim()) return null;
    return url.replace(/\/$/, '');
  } catch {
    return null;
  }
}

export default function BackendStatusBadge() {
  const [status, setStatus] = useState(null); // null = checking, 'on' | 'off'

  useEffect(() => {
    if (!isDev) return;
    const base = getBaseUrl();
    if (!base) {
      setStatus('off');
      return;
    }
    let cancelled = false;
    setStatus(null);
    const url = `${base}/functions/v1/health`;
    fetch(url, { method: 'GET' })
      .then((res) => {
        if (cancelled) return;
        setStatus(res.ok ? 'on' : 'off');
      })
      .catch(() => {
        if (!cancelled) setStatus('off');
      });
    return () => { cancelled = true; };
  }, []);

  if (!isDev) return null;

  const label = status === null ? '…' : status === 'on' ? 'Supabase ON' : 'Supabase OFF';
  const bg = status === 'on' ? colors.success : status === 'off' ? colors.danger : colors.warning;

  return (
    <span
      className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-medium uppercase tracking-wider"
      style={{ background: bg, color: '#fff' }}
      title={label}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-white/90" aria-hidden />
      {label}
    </span>
  );
}
