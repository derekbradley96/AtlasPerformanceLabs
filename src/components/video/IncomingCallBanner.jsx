import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { getSupabase } from '@/lib/supabaseClient';
import { normalizeRole } from '@/lib/roles';
import { acceptIncomingVideoCall } from '@/lib/callRequestState';
import { createIncomingRingtonePlayer } from '@/lib/callSounds';
import { Phone, PhoneOff, Video } from 'lucide-react';
import AtlasVideoCall from '@/components/video/AtlasVideoCall';

export function shouldClearIncomingForStatus(status, callActive) {
  return ['cancelled', 'completed', 'declined', 'accepted', 'in_progress'].includes(status) && !callActive;
}

export default function IncomingCallBanner() {
  const {
    user,
    profile,
    effectiveRole,
    clientLinkedRow,
  } = useAuth();
  const viewerRole = normalizeRole(effectiveRole ?? profile?.role ?? user?.role ?? null);
  const [incomingCall, setIncomingCall] = useState(null);
  const [callActive, setCallActive] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const autoDeclineTimer = useRef(null);
  const ringtonePlayerRef = useRef(null);
  const supabase = getSupabase();

  const clearAutoDecline = useCallback(() => {
    if (autoDeclineTimer.current) {
      clearTimeout(autoDeclineTimer.current);
      autoDeclineTimer.current = null;
    }
  }, []);

  const handleDecline = useCallback(async (callIdOverride) => {
    const targetId = callIdOverride || incomingCall?.id;
    if (!targetId || !supabase) return;
    clearAutoDecline();
    try {
      await supabase
        .from('checkin_call_requests')
        .update({
          status: 'declined',
          updated_at: new Date().toISOString(),
        })
        .eq('id', targetId);
    } catch (_) {}
    setIncomingCall(null);
    setCallActive(false);
  }, [incomingCall?.id, supabase, clearAutoDecline]);

  const handleAccept = useCallback(async () => {
    if (!incomingCall || !supabase) return;
    clearAutoDecline();
    if (incomingCall.call_type === 'video') {
      // Mark acceptance explicitly; WebRTC callee flow also accepts this status.
      try {
        await acceptIncomingVideoCall({
          supabase,
          callRequestId: incomingCall.id,
        });
      } catch (_) {}
      setCallActive(true);
      return;
    }
    try {
      await supabase
        .from('checkin_call_requests')
        .update({
          status: 'in_progress',
          updated_at: new Date().toISOString(),
        })
        .eq('id', incomingCall.id);
    } catch (_) {}
    setIncomingCall(null);
    setCallActive(false);
  }, [incomingCall, supabase, clearAutoDecline]);

  const handleEndCall = useCallback(async () => {
    const targetId = incomingCall?.id;
    if (targetId && supabase) {
      try {
        await supabase
          .from('checkin_call_requests')
          .update({
            status: 'completed',
            updated_at: new Date().toISOString(),
          })
          .eq('id', targetId)
          .in('status', ['ringing', 'accepted', 'in_progress']);
      } catch (_) {}
    }
    clearAutoDecline();
    setCallActive(false);
    setIncomingCall(null);
  }, [incomingCall?.id, supabase, clearAutoDecline]);

  useEffect(() => {
    if (!incomingCall || callActive || dismissed) {
      ringtonePlayerRef.current?.stop?.();
      return undefined;
    }
    if (!ringtonePlayerRef.current) {
      ringtonePlayerRef.current = createIncomingRingtonePlayer();
    }
    void ringtonePlayerRef.current.start?.();
    return () => {
      ringtonePlayerRef.current?.stop?.();
    };
  }, [incomingCall, callActive, dismissed]);

  useEffect(() => {
    if (!user?.id || !supabase) return undefined;

    let mounted = true;
    let unsubscribe = () => {};
    let pollTimer = null;

    async function setup() {
      const { data: clientRows } = await supabase
        .from('clients')
        .select('id')
        .eq('user_id', user.id);

      const clientIds = Array.from(new Set([
        ...(clientRows || []).map((c) => c.id),
        clientLinkedRow?.id,
      ].filter(Boolean)));
      const coachId = user.id;
      const handleCallRow = (row) => {
        const isForClient = clientIds.includes(row.client_id);
        const isForCoach = row.coach_id === coachId;
        const isIncomingForCoach = isForCoach && row.caller_role === 'client';
        if (!isForClient && !isIncomingForCoach) return;

        // Prevent coaches from seeing their own outgoing call
        // as an incoming banner (self-call mirroring issue).
        if (viewerRole === 'coach' && row.caller_role !== 'client') return;

        if (row.status !== 'ringing') {
          if (shouldClearIncomingForStatus(row.status, callActive)) {
            setIncomingCall(null);
            setCallActive(false);
            clearAutoDecline();
          }
          return;
        }

        setDismissed(false);
        setIncomingCall({
          id: row.id,
          call_type: row.call_type,
          caller_name: row.caller_name ?? (row.caller_role === 'client' ? 'Your client' : 'Your coach'),
          caller_avatar: row.caller_avatar ?? null,
        });

        clearAutoDecline();
        autoDeclineTimer.current = setTimeout(() => {
          handleDecline(row.id);
        }, 30000);
      };

      const channel = supabase
        .channel(`incoming-call:${user.id}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'checkin_call_requests',
          },
          (payload) => {
            if (!mounted) return;
            handleCallRow(payload.new);
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'checkin_call_requests',
          },
          (payload) => {
            if (!mounted) return;
            handleCallRow(payload.new);
          }
        )
        .subscribe();

      // Reliability fallback: poll for active ringing calls.
      // This ensures the banner appears even if realtime delivery
      // is delayed or dropped in a tab/session.
      const pollForRinging = async () => {
        if (!mounted || !clientIds.length) return;
        const { data: row } = await supabase
          .from('checkin_call_requests')
          .select('id, client_id, coach_id, call_type, status, caller_name, caller_avatar, caller_role, updated_at')
          .in('client_id', clientIds)
          .eq('status', 'ringing')
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (!mounted) return;
        if (!row) {
          if (!callActive) {
            setIncomingCall(null);
            setCallActive(false);
            clearAutoDecline();
          }
          return;
        }
        handleCallRow(row);
      };

      // One immediate check on mount, then periodic fallback checks.
      await pollForRinging();
      pollTimer = setInterval(() => {
        void pollForRinging();
      }, 4000);

      unsubscribe = () => {
        supabase.removeChannel(channel);
        if (pollTimer) {
          clearInterval(pollTimer);
          pollTimer = null;
        }
      };
    }

    void setup();

    return () => {
      mounted = false;
      ringtonePlayerRef.current?.stop?.();
      unsubscribe();
      clearAutoDecline();
    };
  }, [user?.id, supabase, clearAutoDecline, handleDecline, viewerRole, clientLinkedRow?.id, callActive]);

  if (callActive && incomingCall?.call_type === 'video') {
    return (
      <AtlasVideoCall
        callRequestId={incomingCall.id}
        role="callee"
        myName={profile?.display_name ?? 'Client'}
        theirName={incomingCall.caller_name}
        onEnd={handleEndCall}
      />
    );
  }

  if (!incomingCall || dismissed) return null;

  const isVideo = incomingCall.call_type === 'video';

  return (
    <>
      <div style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1500,
        background: 'rgba(0,0,0,0.4)',
        backdropFilter: 'blur(4px)',
      }}
      />

      <div style={{
        position: 'fixed',
        top: 'max(20px, env(safe-area-inset-top, 20px))',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 1501,
        width: 'calc(100% - 32px)',
        maxWidth: 380,
        background: '#1a1f2e',
        border: '1px solid rgba(99,102,241,0.3)',
        borderRadius: 20,
        padding: '20px 20px 16px',
        boxShadow: '0 20px 60px rgba(0,0,0,0.6), 0 0 0 1px rgba(99,102,241,0.2)',
        animation: 'slideDown 0.3s ease-out',
      }}
      >
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          marginBottom: 20,
        }}
        >
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <div style={{
              position: 'absolute',
              inset: -6,
              borderRadius: '50%',
              background: isVideo
                ? 'rgba(99,102,241,0.2)'
                : 'rgba(34,197,94,0.2)',
              animation: 'pulse 1.5s ease-in-out infinite',
            }}
            />
            {incomingCall.caller_avatar ? (
              <img
                src={incomingCall.caller_avatar}
                alt={incomingCall.caller_name}
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: '50%',
                  objectFit: 'cover',
                  position: 'relative',
                }}
              />
            ) : (
              <div style={{
                width: 56,
                height: 56,
                borderRadius: '50%',
                background: isVideo
                  ? 'rgba(99,102,241,0.3)'
                  : 'rgba(34,197,94,0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative',
                fontSize: 22,
                fontWeight: 700,
                color: '#fff',
              }}
              >
                {(incomingCall.caller_name || 'C')[0].toUpperCase()}
              </div>
            )}
          </div>

          <div style={{ minWidth: 0 }}>
            <p style={{
              fontSize: 11,
              fontWeight: 600,
              color: isVideo ? '#818cf8' : '#4ade80',
              textTransform: 'uppercase',
              letterSpacing: '.07em',
              margin: '0 0 3px',
            }}
            >
              {isVideo ? 'Incoming video call' : 'Incoming call'}
            </p>
            <p style={{
              fontSize: 18,
              fontWeight: 700,
              color: '#fff',
              margin: 0,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
            >
              {incomingCall.caller_name}
            </p>
            <p style={{
              fontSize: 12,
              color: 'rgba(255,255,255,0.45)',
              margin: '2px 0 0',
            }}
            >
              Atlas Performance Labs
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 12 }}>
          <button
            type="button"
            onClick={() => handleDecline()}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 6,
              padding: '12px 0',
              borderRadius: 14,
              border: 'none',
              background: 'rgba(239,68,68,0.15)',
              cursor: 'pointer',
            }}
          >
            <div style={{
              width: 48,
              height: 48,
              borderRadius: '50%',
              background: '#ef4444',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            >
              <PhoneOff size={22} color="#fff" />
            </div>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#ef4444' }}>
              Decline
            </span>
          </button>

          <button
            type="button"
            onClick={handleAccept}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 6,
              padding: '12px 0',
              borderRadius: 14,
              border: 'none',
              background: 'rgba(34,197,94,0.15)',
              cursor: 'pointer',
            }}
          >
            <div style={{
              width: 48,
              height: 48,
              borderRadius: '50%',
              background: '#22c55e',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              animation: 'pulse 1.5s ease-in-out infinite',
            }}
            >
              {isVideo
                ? <Video size={22} color="#fff" />
                : <Phone size={22} color="#fff" />}
            </div>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#22c55e' }}>
              {isVideo ? 'Join' : 'Answer'}
            </span>
          </button>
        </div>
      </div>

      <style>{`
        @keyframes slideDown {
          from { opacity: 0; transform: translateX(-50%) translateY(-20px); }
          to { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.6; transform: scale(1.08); }
        }
      `}</style>
    </>
  );
}
