import React, { useEffect, useState } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { getSupabase, hasSupabase } from '@/lib/supabaseClient';
import { getInviteCode, getOrCreateInviteCode } from '@/lib/inviteCodeStore';

const POLL_MS = 2000;
const MAX_POLLS = 20;

function isUuidLike(s) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(s || '').trim());
}

/**
 * Public join entry: `/join?code=atlas-xxxx` or `/join?coach=<uuid>` (code may still be generating).
 */
export default function JoinByCodePage() {
  const [params] = useSearchParams();
  const code = (params.get('code') || '').trim();
  const coach = (params.get('coach') || '').trim();
  const [resolvedCode, setResolvedCode] = useState(/** @type {string | false | null} */ (null));

  useEffect(() => {
    if (code) return;
    if (!coach) return;
    let cancelled = false;
    let pollCount = 0;
    let timeoutId = 0;

    async function pollRpc() {
      if (!hasSupabase) {
        if (!cancelled) setResolvedCode(false);
        return;
      }
      const sb = getSupabase();
      if (!sb) {
        if (!cancelled) setResolvedCode(false);
        return;
      }
      const { data } = await sb.rpc('get_coach_referral_code_for_join', { p_coach_id: coach });
      if (cancelled) return;
      const c = typeof data === 'string' ? data.trim() : '';
      if (c) {
        setResolvedCode(c);
        return;
      }
      pollCount += 1;
      if (pollCount < MAX_POLLS) {
        timeoutId = window.setTimeout(() => {
          void pollRpc();
        }, POLL_MS);
      } else if (!cancelled) {
        setResolvedCode(false);
      }
    }

    setResolvedCode(null);

    if (!isUuidLike(coach)) {
      const local = getInviteCode(coach) || getOrCreateInviteCode(coach);
      setResolvedCode(local || false);
      return () => {
        cancelled = true;
      };
    }

    void pollRpc();
    return () => {
      cancelled = true;
      if (timeoutId) window.clearTimeout(timeoutId);
    };
  }, [code, coach]);

  if (code) {
    return <Navigate to={`/client-onboarding-flow?code=${encodeURIComponent(code)}`} replace />;
  }
  if (!coach) {
    return <Navigate to="/auth?mode=signup&account=client" replace />;
  }
  if (resolvedCode === null) {
    return (
      <div
        className="min-h-screen flex items-center justify-center px-6 text-center text-sm"
        style={{ background: '#0B1220', color: '#94A3B8' }}
      >
        Opening your coach&apos;s signup link…
      </div>
    );
  }
  if (resolvedCode) {
    return <Navigate to={`/client-onboarding-flow?code=${encodeURIComponent(resolvedCode)}`} replace />;
  }
  return <Navigate to="/auth?mode=signup&account=client" replace />;
}
