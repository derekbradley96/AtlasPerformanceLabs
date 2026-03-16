/**
 * Coach: inbox for marketplace inquiries (coach_inquiries where coach_id = auth).
 * Show sender name, message preview, date, status; actions: mark contacted / converted / closed, convert to client (placeholder).
 */
import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import TopBar from '@/components/ui/TopBar';
import Card from '@/ui/Card';
import { Button } from '@/components/ui/button';
import EmptyState from '@/components/ui/EmptyState';
import { colors, spacing } from '@/ui/tokens';
import { useAuth } from '@/lib/AuthContext';
import { hasSupabase, getSupabase } from '@/lib/supabaseClient';
import { Inbox, UserPlus, MessageCircle, CheckCircle2, XCircle } from 'lucide-react';

const STATUS_OPTIONS = [
  { value: 'contacted', label: 'Contacted', icon: MessageCircle },
  { value: 'converted', label: 'Converted', icon: CheckCircle2 },
  { value: 'closed', label: 'Closed', icon: XCircle },
];

function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  const days = Math.floor((now - d) / (24 * 60 * 60 * 1000));
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: '2-digit' });
}

function messagePreview(msg, maxLen = 80) {
  if (!msg || typeof msg !== 'string') return '—';
  const t = msg.trim();
  if (t.length <= maxLen) return t;
  return t.slice(0, maxLen) + '…';
}

export default function CoachInquiryInboxPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const coachId = user?.id ?? null;
  const supabase = hasSupabase ? getSupabase() : null;

  const { data: inquiries = [], isLoading } = useQuery({
    queryKey: ['coach_inquiries', coachId],
    queryFn: async () => {
      if (!supabase || !coachId) return [];
      const { data, error } = await supabase
        .from('coach_inquiries')
        .select('id, coach_id, user_profile_id, status, message, created_at')
        .eq('coach_id', coachId)
        .order('created_at', { ascending: false });
      if (error) return [];
      return Array.isArray(data) ? data : [];
    },
    enabled: !!supabase && !!coachId,
  });

  const userIds = useMemo(() => [...new Set(inquiries.map((i) => i.user_profile_id).filter(Boolean))], [inquiries]);

  const { data: nameMap = {} } = useQuery({
    queryKey: ['profiles-names', userIds],
    queryFn: async () => {
      if (!supabase || userIds.length === 0) return {};
      const { data, error } = await supabase
        .from('profiles')
        .select('id, display_name, full_name')
        .in('id', userIds);
      if (error) return {};
      const map = {};
      (data || []).forEach((p) => {
        map[p.id] = p.full_name || p.display_name || 'Personal user';
      });
      return map;
    },
    enabled: !!supabase && userIds.length > 0,
  });

  const updateStatus = async (inquiryId, status) => {
    if (!supabase || !inquiryId) return false;
    const { error } = await supabase.from('coach_inquiries').update({ status }).eq('id', inquiryId);
    if (error) return false;
    queryClient.invalidateQueries({ queryKey: ['coach_inquiries', coachId] });
    return true;
  };

  const handleStatus = async (inquiryId, status) => {
    const ok = await updateStatus(inquiryId, status);
    if (ok) toast.success(`Marked as ${status}`);
    else toast.error('Could not update');
  };

  const handleConvertToClient = (inquiry) => {
    toast.info('Client conversion flow coming soon');
    navigate('/invite-client', { state: { fromInquiry: inquiry?.id, userProfileId: inquiry?.user_profile_id } });
  };

  if (!user) {
    return (
      <div className="min-h-screen" style={{ background: colors.bg, color: colors.text }}>
        <TopBar title="Inquiry inbox" onBack={() => navigate(-1)} />
        <div className="p-4">
          <p style={{ color: colors.muted }}>Sign in to view inquiries.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: colors.bg, color: colors.text, paddingBottom: 100 }}>
      <TopBar title="Inquiry inbox" onBack={() => navigate(-1)} />
      <div style={{ padding: spacing[16], maxWidth: 600, margin: '0 auto' }}>
        <p className="text-sm mb-4" style={{ color: colors.muted }}>
          Marketplace leads who reached out. Update status or convert to client.
        </p>

        {isLoading ? (
          <div className="flex items-center justify-center" style={{ minHeight: 200 }}>
            <p style={{ color: colors.muted }}>Loading…</p>
          </div>
        ) : inquiries.length === 0 ? (
          <EmptyState
            icon={Inbox}
            title="No inquiries yet"
            description="When someone sends an inquiry from coach discovery, it will appear here."
          />
        ) : (
          <div className="space-y-3">
            {inquiries.map((inq) => {
              const senderName = nameMap[inq.user_profile_id] ?? 'Personal user';
              const statusLabel = (inq.status || 'new').replace(/_/g, ' ');
              return (
                <Card
                  key={inq.id}
                  style={{
                    padding: spacing[16],
                    border: `1px solid ${shell.cardBorder}`,
                    borderRadius: shell.cardRadius,
                    boxShadow: shell.cardShadow,
                  }}
                >
                  <div className="flex justify-between items-start gap-2 mb-2">
                    <p className="font-semibold" style={{ color: colors.text }}>{senderName}</p>
                    <span
                      className="text-xs px-2 py-0.5 rounded capitalize"
                      style={{
                        background: inq.status === 'new' ? colors.primarySubtle : colors.surface2,
                        color: inq.status === 'new' ? colors.primary : colors.muted,
                      }}
                    >
                      {statusLabel}
                    </span>
                  </div>
                  <p className="text-sm mb-2 line-clamp-2" style={{ color: colors.muted }}>
                    {messagePreview(inq.message)}
                  </p>
                  <p className="text-xs mb-3" style={{ color: colors.muted }}>
                    {formatDate(inq.created_at)}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {inq.status !== 'contacted' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleStatus(inq.id, 'contacted')}
                        style={{ fontSize: 12 }}
                      >
                        <MessageCircle size={14} className="mr-1" />
                        Contacted
                      </Button>
                    )}
                    {inq.status !== 'converted' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleStatus(inq.id, 'converted')}
                        style={{ fontSize: 12 }}
                      >
                        <CheckCircle2 size={14} className="mr-1" />
                        Converted
                      </Button>
                    )}
                    {inq.status !== 'closed' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleStatus(inq.id, 'closed')}
                        style={{ fontSize: 12 }}
                      >
                        <XCircle size={14} className="mr-1" />
                        Close
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleConvertToClient(inq)}
                      style={{ fontSize: 12 }}
                    >
                      <UserPlus size={14} className="mr-1" />
                      Convert to client
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
