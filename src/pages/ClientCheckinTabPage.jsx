import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/lib/AuthContext';
import { getMyClientProfile } from '@/lib/clientProfiles';
import { getSupabase, hasSupabase } from '@/lib/supabaseClient';
import Card from '@/ui/Card';
import Button from '@/ui/Button';
import { colors, spacing } from '@/ui/tokens';

function toDate(value) {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export default function ClientCheckinTabPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const supabase = hasSupabase ? getSupabase() : null;

  const { data: profile } = useQuery({
    queryKey: ['client-profile-checkin-tab', user?.id],
    queryFn: () => getMyClientProfile(user?.id),
    enabled: !!user?.id,
  });

  const { data: checkins = [] } = useQuery({
    queryKey: ['client-checkin-tab-list', profile?.id],
    queryFn: async () => {
      if (!supabase || !profile?.id) return [];
      const { data, error } = await supabase
        .from('checkins')
        .select('id,status,due_date,submitted_at,reviewed_at,created_at,summary')
        .eq('client_id', profile.id)
        .order('created_at', { ascending: false })
        .limit(8);
      if (error) return [];
      return Array.isArray(data) ? data : [];
    },
    enabled: !!supabase && !!profile?.id,
  });

  const latest = checkins[0] || null;
  const reviewedCheckin = useMemo(
    () => checkins.find((c) => c.reviewed_at || c.status === 'reviewed') || null,
    [checkins],
  );
  const now = new Date();
  const dueDate = latest?.due_date ? toDate(latest.due_date) : null;
  const pending = latest?.status === 'pending';
  const overdue = pending && dueDate && dueDate < now;
  const submitted = latest?.status === 'submitted' || !!latest?.submitted_at;
  const reviewed = !!reviewedCheckin;

  const statusLine = overdue
    ? 'This week is overdue'
    : pending
      ? 'This week is pending'
      : submitted
        ? 'Submitted this week'
        : reviewed
          ? 'Reviewed by coach'
          : 'No check-in due right now';

  const recent4 = useMemo(() => checkins.slice(0, 4), [checkins]);

  return (
    <div className="app-screen" style={{ paddingBottom: spacing[24] }}>
      <Card style={{ padding: spacing[16], marginBottom: spacing[12] }}>
        <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: colors.muted }}>Check-in</p>
        <p className="text-lg font-semibold mt-1" style={{ color: colors.text }}>{statusLine}</p>
        <p className="text-sm mt-1" style={{ color: colors.muted }}>
          {dueDate ? `Due ${dueDate.toLocaleDateString()}` : 'Weekly check-in status'}
        </p>
        {!!profile ? (
          <Button className="w-full mt-3" onClick={() => navigate('/submit-checkin')}>
            {pending ? "Submit this week&apos;s check-in" : 'Open check-in'}
          </Button>
        ) : null}
        {reviewed ? (
          <Button
            variant="secondary"
            className="w-full mt-2"
            onClick={() => navigate(reviewedCheckin?.id ? `/reviewcheckin?id=${encodeURIComponent(reviewedCheckin.id)}` : '/reviewcheckin')}
          >
            View last coach feedback
          </Button>
        ) : null}
      </Card>

      <Card style={{ padding: spacing[16], marginBottom: spacing[12] }}>
        <p className="text-sm font-semibold" style={{ color: colors.text }}>Latest summary</p>
        <p className="text-xs mt-1" style={{ color: colors.muted }}>
          Last check-in: {latest?.submitted_at ? new Date(latest.submitted_at).toLocaleDateString() : 'Not submitted yet'}
        </p>
        <p className="text-sm mt-2" style={{ color: colors.text }}>
          {latest?.summary || 'Submit this week to capture your latest training, nutrition, and recovery summary.'}
        </p>
      </Card>

      <Card style={{ padding: spacing[16] }}>
        <p className="text-sm font-semibold" style={{ color: colors.text }}>Previous 4 weeks</p>
        <div className="mt-3 space-y-2">
          {recent4.length === 0 ? (
            <p className="text-xs" style={{ color: colors.muted }}>No previous check-ins yet.</p>
          ) : (
            recent4.map((item) => (
              <div key={item.id} className="rounded-lg p-3" style={{ border: `1px solid ${colors.border}`, background: colors.surface1 }}>
                <p className="text-xs font-semibold" style={{ color: colors.text, margin: 0 }}>
                  {item.created_at ? new Date(item.created_at).toLocaleDateString() : 'Check-in'}
                </p>
                <p className="text-xs mt-1" style={{ color: colors.muted, margin: 0 }}>
                  Status: {item.status || (item.submitted_at ? 'submitted' : 'pending')}
                </p>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}
