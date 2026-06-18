import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/AuthContext';
import { getSupabase } from '@/lib/supabaseClient';
import { toast } from 'sonner';
import { colors, spacing } from '@/ui/tokens';
import AtlasVideoCall from '@/components/video/AtlasVideoCall';

export default function CallRequestsPage() {
  const { user, profile } = useAuth();
  const supabase = getSupabase();
  const queryClient = useQueryClient();
  const [activeCallId, setActiveCallId] = useState(null);
  const clientDisplayName = profile?.display_name ?? 'Client';

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ['call-requests-client', user?.id],
    queryFn: async () => {
      if (!supabase || !user?.id) return [];
      const { data: clientRows } = await supabase
        .from('clients')
        .select('id')
        .eq('user_id', user.id);
      const clientIds = (clientRows || []).map((c) => c.id);
      if (!clientIds.length) return [];

      const { data } = await supabase
        .from('checkin_call_requests')
        .select(`
          id, call_type, proposed_at, duration_minutes,
          agenda, status, client_message, reschedule_proposed_at,
          created_at, coach_id,
          coach_profile:profiles!checkin_call_requests_coach_id_fkey(
            display_name, avatar_url
          )
        `)
        .in('client_id', clientIds)
        .in('status', ['pending', 'accepted', 'rescheduled'])
        .order('created_at', { ascending: false });
      return data || [];
    },
    enabled: !!user?.id && !!supabase,
    staleTime: 30000,
    refetchInterval: 60000,
  });

  const respondMutation = useMutation({
    mutationFn: async ({ requestId, status, message, rescheduleAt }) => {
      const { error } = await supabase
        .from('checkin_call_requests')
        .update({
          status,
          client_message: message || null,
          reschedule_proposed_at: rescheduleAt || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', requestId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['call-requests-client', user?.id]);
      toast.success('Response sent to your coach');
    },
  });

  const acceptMutation = useMutation({
    mutationFn: async (requestId) => {
      if (!supabase) throw new Error('No connection');

      const { error } = await supabase
        .from('checkin_call_requests')
        .update({
          status: 'accepted',
          updated_at: new Date().toISOString(),
        })
        .eq('id', requestId);
      if (error) throw error;
    },
    onSuccess: (_, requestId) => {
      queryClient.invalidateQueries(['call-requests-client', user?.id]);
      const req = requests.find((r) => r.id === requestId);
      if (req?.call_type === 'video') {
        setTimeout(() => setActiveCallId(requestId), 400);
      } else {
        toast.success('Call accepted');
      }
    },
    onError: (e) =>
      toast.error(String(e?.message || 'Could not accept')),
  });

  if (isLoading) return <div style={{ padding: 20, color: colors.muted }}>Loading...</div>;

  return (
    <div style={{ padding: spacing[16], paddingBottom: 'max(80px, env(safe-area-inset-bottom))' }}>
      <h1 style={{ fontSize: 22, fontWeight: 600, color: colors.text, marginBottom: 4 }}>
        Coach requests
      </h1>
      <p style={{ fontSize: 14, color: colors.muted, marginBottom: 20 }}>
        Your coach has requested a call or conversation about your recent check-in.
      </p>

      {requests.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <p style={{ fontSize: 40, marginBottom: 12 }}>✓</p>
          <p style={{ color: colors.muted, fontSize: 14 }}>No pending requests from your coach.</p>
        </div>
      ) : null}

      {requests.map((req) => (
        <CallRequestCard
          key={req.id}
          request={req}
          clientDisplayName={clientDisplayName}
          callActive={activeCallId === req.id}
          onRespond={respondMutation.mutate}
          onAccept={acceptMutation.mutate}
          onCallStart={() => setActiveCallId(req.id)}
          onCallEnd={() => {
            if (supabase) {
              void supabase
                .from('checkin_call_requests')
                .update({
                  status: 'completed',
                  updated_at: new Date().toISOString(),
                })
                .eq('id', req.id)
                .in('status', ['ringing', 'accepted', 'in_progress']);
            }
            setActiveCallId(null);
          }}
          isAccepting={acceptMutation.isPending}
        />
      ))}
    </div>
  );
}

function CallRequestCard({
  request,
  clientDisplayName,
  callActive = false,
  onRespond,
  onAccept,
  onCallStart,
  onCallEnd,
  isAccepting = false,
}) {
  const [showReschedule, setShowReschedule] = useState(false);
  const [rescheduleAt, setRescheduleAt] = useState('');
  const [message, setMessage] = useState('');
  const coachName = request.coach_profile?.display_name ?? 'Your coach';
  const typeLabel = request.call_type === 'video' ? '📹 Video call' : request.call_type === 'phone' ? '📞 Phone call' : '💬 Message';
  const proposedDate = new Date(request.proposed_at);

  return (
    <div
      style={{
        background: colors.surface1,
        border: `1px solid ${colors.border}`,
        borderRadius: 16,
        padding: spacing[16],
        marginBottom: spacing[12],
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: spacing[10], marginBottom: spacing[12] }}>
        {request.coach_profile?.avatar_url ? (
          <img
            src={request.coach_profile.avatar_url}
            style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover' }}
            alt={coachName}
          />
        ) : (
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: '50%',
              background: colors.primarySubtle,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: colors.primary,
              fontSize: 16,
              fontWeight: 600,
            }}
          >
            {coachName[0]}
          </div>
        )}
        <div>
          <p style={{ fontSize: 14, fontWeight: 600, color: colors.text, margin: 0 }}>{coachName}</p>
          <p style={{ fontSize: 12, color: colors.primary, margin: 0 }}>{typeLabel}</p>
        </div>
      </div>

      {request.call_type !== 'message' ? (
        <div style={{ background: colors.surface2, borderRadius: 10, padding: '10px 12px', marginBottom: spacing[12] }}>
          <p style={{ fontSize: 13, color: colors.muted, margin: 0, marginBottom: 2 }}>Proposed time</p>
          <p style={{ fontSize: 15, fontWeight: 500, color: colors.text, margin: 0 }}>
            {proposedDate.toLocaleString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}
            {' · '}{request.duration_minutes} min
          </p>
        </div>
      ) : null}

      {request.agenda ? (
        <div style={{ marginBottom: spacing[14] }}>
          <p style={{ fontSize: 12, color: colors.muted, marginBottom: 4 }}>What your coach wants to cover</p>
          <p style={{ fontSize: 13, color: colors.text, lineHeight: 1.5 }}>{request.agenda}</p>
        </div>
      ) : null}

      {request.status === 'pending' && !showReschedule ? (
        <div style={{ display: 'flex', gap: spacing[8] }}>
          <button
            type="button"
            onClick={() => onAccept(request.id)}
            disabled={isAccepting}
            style={{
              flex: 1,
              padding: '11px',
              borderRadius: 10,
              border: 'none',
              background: colors.primary,
              color: '#fff',
              cursor: 'pointer',
              fontSize: 14,
              fontWeight: 600,
              opacity: isAccepting ? 0.7 : 1,
            }}
          >
            {isAccepting ? 'Accepting...' : '✓ Accept'}
          </button>
          <button
            type="button"
            onClick={() => setShowReschedule(true)}
            style={{
              flex: 1,
              padding: '11px',
              borderRadius: 10,
              border: `1px solid ${colors.border}`,
              background: 'transparent',
              color: colors.muted,
              cursor: 'pointer',
              fontSize: 14,
            }}
          >
            Reschedule
          </button>
        </div>
      ) : null}

      {showReschedule ? (
        <div style={{ marginTop: spacing[12] }}>
          <label style={{ fontSize: 13, color: colors.muted, display: 'block', marginBottom: 6 }}>
            Suggest a different time
          </label>
          <input
            type="datetime-local"
            value={rescheduleAt}
            min={new Date().toISOString().slice(0, 16)}
            onChange={(e) => setRescheduleAt(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 12px',
              background: colors.surface2,
              border: `1px solid ${colors.border}`,
              borderRadius: 10,
              color: colors.text,
              fontSize: 14,
              marginBottom: 10,
            }}
          />
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Any message for your coach..."
            rows={2}
            style={{
              width: '100%',
              padding: '10px 12px',
              background: colors.surface2,
              border: `1px solid ${colors.border}`,
              borderRadius: 10,
              color: colors.text,
              fontSize: 14,
              resize: 'none',
              marginBottom: 10,
              fontFamily: 'inherit',
            }}
          />
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              onClick={() =>
                onRespond({
                  requestId: request.id,
                  status: 'rescheduled',
                  message,
                  rescheduleAt: rescheduleAt || null,
                })
              }
              style={{
                flex: 1,
                padding: '11px',
                borderRadius: 10,
                border: 'none',
                background: colors.primary,
                color: '#fff',
                cursor: 'pointer',
                fontSize: 14,
                fontWeight: 600,
              }}
            >
              Send reschedule
            </button>
            <button
              type="button"
              onClick={() => setShowReschedule(false)}
              style={{
                padding: '11px 16px',
                borderRadius: 10,
                border: `1px solid ${colors.border}`,
                background: 'transparent',
                color: colors.muted,
                cursor: 'pointer',
                fontSize: 14,
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      {request.status === 'accepted' && (
        <div>
          <div style={{
            background: 'rgba(34,197,94,0.08)',
            border: '1px solid rgba(34,197,94,0.25)',
            borderRadius: 12,
            padding: '10px 14px',
            marginBottom: request.call_type === 'video' ? 10 : 0,
          }}>
            <p style={{ color: '#22c55e', fontSize: 13, fontWeight: 500, margin: 0 }}>
              ✓ Confirmed —{' '}
              {proposedDate.toLocaleString('en-GB', {
                weekday: 'short', day: 'numeric',
                month: 'short', hour: '2-digit',
                minute: '2-digit',
              })}
              {request.duration_minutes
                ? ` · ${request.duration_minutes} min` : ''}
            </p>
          </div>
          {request.call_type === 'video' && !callActive && (
            <button
              type="button"
              onClick={onCallStart}
              style={{
                width: '100%',
                padding: '14px',
                borderRadius: 12,
                border: 'none',
                background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                color: '#fff',
                cursor: 'pointer',
                fontSize: 15,
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 10,
                letterSpacing: '-0.01em',
              }}
            >
              <span style={{ fontSize: 20 }}>📹</span>
              Join video call with {coachName}
            </button>
          )}
          {request.call_type === 'phone' && (
            <div style={{
              background: colors.surface2,
              borderRadius: 10,
              padding: '10px 14px',
              marginTop: 8,
            }}>
              <p style={{ fontSize: 13, color: colors.text, margin: 0 }}>
                📞 Your coach will call you at the agreed time.
              </p>
            </div>
          )}
          {callActive && request.call_type === 'video' ? (
            <AtlasVideoCall
              callRequestId={request.id}
              role="callee"
              myName={clientDisplayName ?? 'Client'}
              theirName={coachName}
              onEnd={onCallEnd}
            />
          ) : null}
        </div>
      )}
    </div>
  );
}
