import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import Card from '@/ui/Card';
import Button from '@/ui/Button';
import { colors, spacing, radii } from '@/ui/tokens';
import { useAuth } from '@/lib/AuthContext';
import { hasSupabase, getSupabase } from '@/lib/supabaseClient';
import { normalizeRole } from '@/lib/roles';
import { usePresentationMode } from '@/lib/presentationMode';

const ROLE_REASON_OPTIONS = {
  coach: [
    { key: 'not_enough_clients', label: "I'm not getting enough clients through Atlas" },
    { key: 'missing_features', label: "The platform doesn't have features I need" },
    { key: 'too_expensive', label: 'It costs too much for what I get' },
    { key: 'different_platform', label: "I'm using a different platform" },
    { key: 'stopping_coaching', label: "I'm stopping coaching altogether" },
    { key: 'other', label: 'Other' },
  ],
  client: [
    { key: 'finished_with_coach', label: "I've finished working with my coach" },
    { key: 'find_different_coach', label: 'I want to find a different coach' },
    { key: 'taking_break', label: "I'm taking a break from coaching" },
    { key: 'app_not_working', label: "The app isn't working for me" },
    { key: 'different_training_method', label: 'I prefer a different way to train' },
    { key: 'other', label: 'Other' },
  ],
  personal: [
    { key: 'dont_use_enough', label: "I don't use it enough to keep the account" },
    { key: 'found_different_app', label: 'I found a different app' },
    { key: 'goal_achieved', label: "I achieved my goal and don't need this anymore" },
    { key: 'features_not_fit', label: "The features don't match what I need" },
    { key: 'other', label: 'Other' },
  ],
};

const IMPACT_COPY = {
  coach: [
    'Your coach profile and marketplace listing',
    'All programs, nutrition plans, and check-in templates',
    'All client history and check-ins',
    'Your earnings history and Stripe connection',
    'Your subscription (cancelled immediately)',
  ],
  client: [
    'Your training history and progress data',
    'All check-ins and coach feedback',
    'Your nutrition logs and progress photos',
    'Your habit logs and streaks',
  ],
  personal: [
    'Your training history and personal records',
    'Your nutrition logs and body weight history',
    'Your progress photos',
  ],
};

function getFunctionsBaseUrl() {
  const url = typeof import.meta !== 'undefined' ? import.meta.env?.VITE_SUPABASE_URL : null;
  if (!url) return null;
  return `${String(url).replace(/\/$/, '')}/functions/v1`;
}

async function callDeleteAccount({ reason, reason_detail, role }) {
  const supabase = getSupabase();
  if (!supabase) return { ok: false, error: 'Supabase is not configured.', code: 'server_error' };
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) return { ok: false, error: 'You are not signed in.', code: 'unauthorized' };

  const base = getFunctionsBaseUrl();
  if (!base) return { ok: false, error: 'Supabase URL not configured.', code: 'server_error' };

  const res = await fetch(`${base}/delete-account`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ reason, reason_detail, role }),
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok || body?.ok === false) {
    return {
      ok: false,
      error: body?.error || 'Could not delete account.',
      code: body?.code || 'server_error',
    };
  }
  return { ok: true };
}

export default function DeleteAccountPage() {
  const navigate = useNavigate();
  const { isDesktopWeb } = usePresentationMode();
  const { user, effectiveRole, profile, signOut } = useAuth();
  const supabase = getSupabase();
  const canonicalRole = normalizeRole(effectiveRole || profile?.role || 'personal');
  const role = canonicalRole === 'coach' || canonicalRole === 'client' ? canonicalRole : 'personal';
  const reasonOptions = ROLE_REASON_OPTIONS[role];
  const [selectedReason, setSelectedReason] = useState('');
  const [reasonDetail, setReasonDetail] = useState('');
  const [confirmText, setConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteBlockedByClients, setDeleteBlockedByClients] = useState(false);

  const isCoachRole = role === 'coach';
  const { data: activeClientCount = 0, isLoading: countLoading } = useQuery({
    queryKey: ['active-client-count-delete-check', user?.id],
    queryFn: async () => {
      if (!supabase || !user?.id) return 0;
      const { count, error } = await supabase
        .from('clients')
        .select('id', { count: 'exact', head: true })
        .or(`coach_id.eq.${user.id},trainer_id.eq.${user.id}`)
        .not('subscription_status', 'eq', 'inactive');
      if (error) throw error;
      return count ?? 0;
    },
    enabled: !!user?.id && isCoachRole && hasSupabase,
    staleTime: 30_000,
  });

  const hasActiveClients = isCoachRole && activeClientCount > 0;
  const showCoachCountLoading = isCoachRole && countLoading;
  const showCoachBlocker = hasActiveClients;
  const hardBlocked = hasActiveClients || deleteBlockedByClients;
  const canSubmit = selectedReason && confirmText === 'DELETE' && !hardBlocked && !deleting && !showCoachCountLoading;

  const impactItems = IMPACT_COPY[role];

  const handleDelete = useCallback(async () => {
    if (!canSubmit) return;
    setDeleting(true);
    try {
      const result = await callDeleteAccount({
        reason: selectedReason,
        reason_detail: selectedReason === 'other' ? reasonDetail.slice(0, 500).trim() : '',
        role,
      });
      if (!result.ok) {
        if (result.code === 'has_active_clients') {
          setDeleteBlockedByClients(true);
          toast.error('You still have active clients. Remove them from your roster first.');
          return;
        }
        toast.error(result.error || 'Could not delete account.');
        return;
      }
      await signOut();
      navigate('/goodbye', { replace: true });
    } finally {
      setDeleting(false);
    }
  }, [canSubmit, selectedReason, reasonDetail, role, signOut, navigate]);

  const wrapperStyle = isDesktopWeb
    ? { maxWidth: 480, margin: '0 auto', padding: `${spacing[24]}px ${spacing[16]}px calc(${spacing[32]}px + env(safe-area-inset-bottom, 0px))` }
    : { padding: `${spacing[16]}px ${spacing[16]}px calc(${spacing[32]}px + env(safe-area-inset-bottom, 0px))` };

  return (
    <div style={{ minHeight: '100%', background: colors.bg, color: colors.text }}>
      <div style={wrapperStyle}>
        <Card
          style={{
            padding: spacing[20],
            border: `1px solid ${colors.dangerSubtle}`,
            background: colors.dangerSubtle,
            marginBottom: spacing[12],
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: spacing[10], marginBottom: spacing[8] }}>
            <AlertTriangle size={20} style={{ color: colors.danger }} />
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: colors.danger }}>Delete your Atlas account</h1>
          </div>
          <p style={{ margin: 0, color: colors.text, lineHeight: 1.45 }}>
            This is permanent. Your data cannot be recovered.
          </p>
        </Card>

        {showCoachCountLoading ? (
          <Card style={{ padding: spacing[16], marginBottom: spacing[12] }}>
            <div style={{ display: 'grid', gap: spacing[10] }}>
              <div style={{ height: 14, borderRadius: 8, background: colors.surface2, width: '62%' }} />
              <div style={{ height: 44, borderRadius: radii.md, background: colors.surface2 }} />
              <div style={{ height: 44, borderRadius: radii.md, background: colors.surface2 }} />
              <div style={{ height: 44, borderRadius: radii.md, background: colors.surface2 }} />
            </div>
          </Card>
        ) : showCoachBlocker ? (
          <Card
            style={{
              background: colors.warningSubtle,
              border: `1px solid ${colors.warning}`,
              padding: spacing[16],
            }}
          >
            <p style={{ fontWeight: 600, color: colors.warning, margin: 0 }}>
              You have {activeClientCount} active client
              {activeClientCount > 1 ? 's' : ''}
            </p>
            <p style={{ color: colors.muted, marginTop: spacing[8], marginBottom: 0 }}>
              Remove all clients from your roster before deleting your account.
            </p>
            <Button onClick={() => navigate('/clients')} style={{ marginTop: spacing[12] }}>
              Go to Clients
            </Button>
          </Card>
        ) : (
          <>
            <Card style={{ padding: spacing[16], marginBottom: spacing[12] }}>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: colors.text }}>Before you go, help us understand why:</p>
              <div style={{ marginTop: spacing[12], display: 'grid', gap: spacing[8] }}>
                {reasonOptions.map((opt) => {
                  const checked = selectedReason === opt.key;
                  return (
                    <label
                      key={opt.key}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: spacing[10],
                        minHeight: 44,
                        borderRadius: radii.md,
                        padding: `${spacing[8]}px ${spacing[10]}px`,
                        border: `1px solid ${checked ? colors.danger : colors.border}`,
                        background: checked ? colors.dangerSubtle : colors.surface1,
                      }}
                    >
                      <input
                        type="radio"
                        name="delete-reason"
                        value={opt.key}
                        checked={checked}
                        onChange={() => setSelectedReason(opt.key)}
                      />
                      <span style={{ fontSize: 14 }}>{opt.label}</span>
                    </label>
                  );
                })}
              </div>

              {selectedReason === 'other' ? (
                <div style={{ marginTop: spacing[12] }}>
                  <label style={{ display: 'block', fontSize: 13, color: colors.muted, marginBottom: spacing[6] }}>
                    Tell us more (optional)
                  </label>
                  <textarea
                    value={reasonDetail}
                    maxLength={500}
                    onChange={(e) => setReasonDetail(e.target.value)}
                    rows={4}
                    style={{
                      width: '100%',
                      borderRadius: radii.button,
                      border: `1px solid ${colors.border}`,
                      background: colors.surface2,
                      color: colors.text,
                      padding: `${spacing[10]}px ${spacing[12]}px`,
                      resize: 'vertical',
                    }}
                  />
                  <p style={{ margin: `${spacing[6]}px 0 0`, fontSize: 12, color: colors.muted }}>{reasonDetail.length}/500</p>
                </div>
              ) : null}
            </Card>

            <Card style={{ padding: spacing[16], marginBottom: spacing[12] }}>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: colors.text }}>Deleting will permanently remove:</p>
              <ul style={{ margin: `${spacing[10]}px 0 0`, paddingLeft: 18, color: colors.muted, lineHeight: 1.6 }}>
                {impactItems.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </Card>

            <Card style={{ padding: spacing[16], marginBottom: spacing[12] }}>
              <label style={{ display: 'block', fontSize: 13, color: colors.muted, marginBottom: spacing[6] }}>
                Type DELETE to confirm
              </label>
              <input
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="DELETE"
                style={{
                  width: '100%',
                  minHeight: 44,
                  borderRadius: radii.button,
                  border: `1px solid ${colors.border}`,
                  background: colors.surface2,
                  color: colors.text,
                  padding: `0 ${spacing[12]}px`,
                }}
              />
            </Card>

            <Button
              onClick={() => void handleDelete()}
              disabled={!canSubmit}
              style={{
                width: '100%',
                minHeight: 52,
                background: canSubmit ? colors.danger : colors.dangerSubtle,
                color: '#fff',
                cursor: canSubmit ? 'pointer' : 'not-allowed',
              }}
            >
              <Trash2 size={18} />
              {deleting ? 'Deleting your account...' : 'Permanently delete my account'}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
