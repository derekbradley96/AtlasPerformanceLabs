/**
 * Coach inbox for public profile enquiries (coach_public_enquiries).
 * List and update status (new, contacted, converted, closed).
 */
import React, { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import TopBar from '@/components/ui/TopBar';
import Card from '@/ui/Card';
import Button from '@/ui/Button';
import { colors, spacing } from '@/ui/tokens';
import { useAuth } from '@/lib/AuthContext';
import { getSupabase, hasSupabase } from '@/lib/supabaseClient';
import { MessageCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const STATUS_OPTIONS = [
  { value: 'new', label: 'New' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'converted', label: 'Converted' },
  { value: 'closed', label: 'Closed' },
];

const ENQUIRY_TYPE_LABELS = { transformation: 'Transformation', competition: 'Competition / Prep', general: 'General' };

async function fetchEnquiries(coachId) {
  if (!hasSupabase || !coachId) return [];
  const supabase = getSupabase();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('coach_public_enquiries')
    .select('*')
    .eq('coach_id', coachId)
    .order('created_at', { ascending: false });
  if (error) return [];
  return Array.isArray(data) ? data : [];
}

export default function CoachEnquiriesPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const coachId = user?.id ?? null;
  const queryClient = useQueryClient();

  const { data: enquiries = [], isLoading } = useQuery({
    queryKey: ['coach_public_enquiries', coachId],
    queryFn: () => fetchEnquiries(coachId),
    enabled: !!coachId,
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }) => {
      const supabase = getSupabase();
      if (!supabase || !coachId) throw new Error('Not signed in');
      const { error } = await supabase
        .from('coach_public_enquiries')
        .update({ status })
        .eq('id', id)
        .eq('coach_id', coachId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['coach_public_enquiries', coachId] });
      toast.success('Status updated');
    },
    onError: () => toast.error('Failed to update'),
  });

  const handleStatusChange = useCallback(
    (id, status) => {
      updateStatusMutation.mutate({ id, status });
    },
    [updateStatusMutation]
  );

  if (!coachId) {
    return (
      <div className="min-h-screen" style={{ background: colors.bg }}>
        <TopBar title="Enquiries" onBack={() => navigate(-1)} />
        <div className="p-4" style={{ color: colors.muted }}>Sign in as a coach to view enquiries.</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: colors.bg, paddingBottom: spacing[24] }}>
      <TopBar title="Enquiries" onBack={() => navigate(-1)} />
      <div className="px-4 pt-4">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="animate-spin" size={32} style={{ color: colors.muted }} />
          </div>
        ) : enquiries.length === 0 ? (
          <Card style={{ padding: spacing[24], textAlign: 'center' }}>
            <MessageCircle size={40} className="mx-auto mb-3" style={{ color: colors.muted }} />
            <h3 className="text-base font-semibold mb-1" style={{ color: colors.text }}>No enquiries yet</h3>
            <p className="text-sm mb-4" style={{ color: colors.muted }}>
              Enquiries from your public profile will appear here.
            </p>
            <Button variant="secondary" onClick={() => navigate('/referrals')}>
              Share your profile
            </Button>
          </Card>
        ) : (
          <div className="space-y-3">
            {enquiries.map((e) => (
              <Card key={e.id} style={{ padding: spacing[16] }}>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="min-w-0">
                    <p className="font-semibold truncate" style={{ color: colors.text }}>
                      {e.enquiry_name || '—'}
                    </p>
                    <p className="text-sm truncate" style={{ color: colors.muted }}>
                      {e.enquiry_email || '—'}
                    </p>
                  </div>
                  <span
                    className="shrink-0 rounded-full px-2 py-0.5 text-xs font-medium"
                    style={{
                      background: e.status === 'new' ? colors.primarySubtle : colors.surface2,
                      color: e.status === 'new' ? colors.accent : colors.textSecondary,
                    }}
                  >
                    {STATUS_OPTIONS.find((s) => s.value === e.status)?.label ?? e.status}
                  </span>
                </div>
                {(e.enquiry_goal || e.enquiry_type) && (
                  <p className="text-xs mb-2" style={{ color: colors.muted }}>
                    {[e.enquiry_goal, e.enquiry_type && ENQUIRY_TYPE_LABELS[e.enquiry_type]].filter(Boolean).join(' · ')}
                  </p>
                )}
                {e.message && (
                  <p className="text-sm mb-3 line-clamp-2" style={{ color: colors.textSecondary }}>
                    {e.message}
                  </p>
                )}
                <p className="text-xs mb-3" style={{ color: colors.muted }}>
                  {e.created_at ? new Date(e.created_at).toLocaleDateString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : ''}
                </p>
                {e.status === 'new' && (
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="secondary"
                      onClick={() => handleStatusChange(e.id, 'contacted')}
                      disabled={updateStatusMutation.isPending}
                      className="text-xs py-2"
                    >
                      Mark contacted
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => handleStatusChange(e.id, 'closed')}
                      disabled={updateStatusMutation.isPending}
                      className="text-xs py-2"
                    >
                      Close
                    </Button>
                  </div>
                )}
                {e.status !== 'new' && (
                  <select
                    value={e.status}
                    onChange={(ev) => handleStatusChange(e.id, ev.target.value)}
                    className="text-xs rounded border px-2 py-1"
                    style={{ background: colors.surface2, borderColor: colors.border, color: colors.text }}
                  >
                    {STATUS_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
