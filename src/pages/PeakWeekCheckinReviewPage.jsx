/**
 * Coach: review peak week check-ins (list + detail). View photos, weight, ratings, add coach notes,
 * and optionally save stage readiness scores to stage_readiness_scores.
 */
import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/AuthContext';
import { getSupabase, hasSupabase } from '@/lib/supabaseClient';
import { createCheckinPhotoSignedUrl } from '@/lib/checkins';
import TopBar from '@/components/ui/TopBar';
import Card from '@/ui/Card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { colors, spacing } from '@/ui/tokens';
import { pageContainer, standardCard, sectionLabel, sectionGap } from '@/ui/pageLayout';
import { MessageSquare, ClipboardList, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { hapticLight } from '@/lib/haptics';

const RATING_MIN = 1;
const RATING_MAX = 10;

export default function PeakWeekCheckinReviewPage() {
  const navigate = useNavigate();
  const { checkinId } = useParams();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const supabase = hasSupabase ? getSupabase() : null;
  const coachId = user?.id ?? null;

  const [coachNotes, setCoachNotes] = useState('');
  const [readinessConditioning, setReadinessConditioning] = useState('');
  const [readinessFullness, setReadinessFullness] = useState('');
  const [readinessDryness, setReadinessDryness] = useState('');
  const [readinessFatigue, setReadinessFatigue] = useState('');
  const [readinessNotes, setReadinessNotes] = useState('');
  const [photoUrls, setPhotoUrls] = useState([]);

  const isDetail = Boolean(checkinId);

  const { data: checkin, isLoading: loadingCheckin } = useQuery({
    queryKey: ['peak_week_checkin', checkinId],
    queryFn: async () => {
      if (!supabase || !checkinId) return null;
      const { data, error } = await supabase
        .from('peak_week_checkins')
        .select('*')
        .eq('id', checkinId)
        .maybeSingle();
      return error ? null : data;
    },
    enabled: !!supabase && !!checkinId,
  });

  const clientId = checkin?.client_id ?? null;
  const peakWeekId = checkin?.peak_week_id ?? null;

  const { data: client } = useQuery({
    queryKey: ['client', clientId],
    queryFn: async () => {
      if (!supabase || !clientId) return null;
      const { data } = await supabase.from('clients').select('id, name, full_name').eq('id', clientId).maybeSingle();
      return data;
    },
    enabled: !!supabase && !!clientId,
  });

  useEffect(() => {
    if (!checkin?.photos || !Array.isArray(checkin.photos) || checkin.photos.length === 0) {
      setPhotoUrls([]);
      return;
    }
    let cancelled = false;
    (async () => {
      const urls = await Promise.all(checkin.photos.map((path) => createCheckinPhotoSignedUrl(path)));
      if (!cancelled) setPhotoUrls(urls.filter(Boolean));
    })();
    return () => { cancelled = true; };
  }, [checkin?.photos]);

  useEffect(() => {
    if (checkin?.coach_notes != null) setCoachNotes(checkin.coach_notes || '');
  }, [checkin?.coach_notes]);

  const listQuery = useQuery({
    queryKey: ['peak_week_checkins_list', coachId],
    queryFn: async () => {
      if (!supabase || !coachId) return [];
      const { data: clientRows } = await supabase
        .from('clients')
        .select('id')
        .or(`coach_id.eq.${coachId},trainer_id.eq.${coachId}`);
      const clientIds = (clientRows || []).map((c) => c.id).filter(Boolean);
      if (clientIds.length === 0) return [];
      const { data: weeks } = await supabase
        .from('peak_weeks')
        .select('id, client_id')
        .in('client_id', clientIds)
        .eq('is_active', true);
      if (!weeks?.length) return [];
      const peakWeekIds = weeks.map((w) => w.id);
      const weekClientIds = [...new Set(weeks.map((w) => w.client_id))];
      const { data: checkins } = await supabase
        .from('peak_week_checkins')
        .select('id, client_id, peak_week_id, weight, pump_rating, flat_full_rating, created_at')
        .in('peak_week_id', peakWeekIds)
        .order('created_at', { ascending: false });
      const { data: clients } = await supabase.from('clients').select('id, name, full_name').in('id', weekClientIds);
      const nameBy = {};
      (clients || []).forEach((c) => { nameBy[c.id] = c.name || c.full_name || 'Client'; });
      const byClient = {};
      (checkins || []).forEach((c) => {
        if (!byClient[c.client_id]) byClient[c.client_id] = c;
      });
      return Object.entries(byClient).map(([cid, c]) => ({
        ...c,
        client_name: nameBy[cid] || 'Client',
      }));
    },
    enabled: !!supabase && !!coachId && !isDetail,
  });

  const saveCoachNotesMutation = useMutation({
    mutationFn: async () => {
      if (!supabase || !checkinId) throw new Error('Missing check-in');
      const { error } = await supabase
        .from('peak_week_checkins')
        .update({ coach_notes: coachNotes.trim() || null })
        .eq('id', checkinId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['peak_week_checkin', checkinId] });
      toast.success('Coach notes saved.');
    },
    onError: (e) => toast.error(e?.message || 'Failed to save.'),
  });

  const saveReadinessMutation = useMutation({
    mutationFn: async () => {
      if (!supabase || !clientId) throw new Error('Missing client');
      const payload = {
        client_id: clientId,
        peak_week_id: peakWeekId || null,
        conditioning_score: readinessConditioning !== '' ? Math.min(RATING_MAX, Math.max(RATING_MIN, Number(readinessConditioning))) : null,
        fullness_score: readinessFullness !== '' ? Math.min(RATING_MAX, Math.max(RATING_MIN, Number(readinessFullness))) : null,
        dryness_score: readinessDryness !== '' ? Math.min(RATING_MAX, Math.max(RATING_MIN, Number(readinessDryness))) : null,
        fatigue_score: readinessFatigue !== '' ? Math.min(RATING_MAX, Math.max(RATING_MIN, Number(readinessFatigue))) : null,
        notes: readinessNotes.trim() || null,
      };
      const { error } = await supabase.from('stage_readiness_scores').insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Stage readiness saved.');
      setReadinessConditioning('');
      setReadinessFullness('');
      setReadinessDryness('');
      setReadinessFatigue('');
      setReadinessNotes('');
    },
    onError: (e) => toast.error(e?.message || 'Failed to save readiness.'),
  });

  const loading = isDetail ? loadingCheckin : listQuery.isLoading;

  if (!user) {
    return (
      <div className="min-h-screen" style={{ background: colors.bg, color: colors.text }}>
        <TopBar title="Peak Week Check-Ins" onBack={() => navigate(-1)} />
        <div className="p-4" style={pageContainer}>
          <p style={{ color: colors.muted }}>Sign in to review check-ins.</p>
          <Button variant="outline" className="mt-2" onClick={() => navigate(-1)}>Back</Button>
        </div>
      </div>
    );
  }

  if (isDetail && !checkin && !loadingCheckin) {
    return (
      <div className="min-h-screen" style={{ background: colors.bg, color: colors.text }}>
        <TopBar title="Peak Week Check-In" onBack={() => navigate('/review-center/peak-week-checkins')} />
        <div className="p-4 text-center">
          <p style={{ color: colors.muted }}>Check-in not found.</p>
          <Button variant="outline" className="mt-4" onClick={() => navigate('/review-center/peak-week-checkins')}>Back to list</Button>
        </div>
      </div>
    );
  }

  if (isDetail && checkin) {
    const clientName = client?.name || client?.full_name || 'Client';
    return (
      <div className="min-h-screen pb-8" style={{ background: colors.bg, color: colors.text }}>
        <TopBar title="Peak Week Check-In" onBack={() => navigate('/review-center/peak-week-checkins')} />
        <div className="max-w-lg mx-auto" style={{ ...pageContainer, paddingBottom: spacing[32] }}>
          <p className="text-sm mb-4" style={{ color: colors.muted }}>
            {clientName} · {checkin.created_at ? new Date(checkin.created_at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '—'}
          </p>

          <section style={{ marginBottom: sectionGap }}>
            <div style={sectionLabel}>Check-in</div>
            <Card style={{ ...standardCard, padding: spacing[16] }}>
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div>
                  <p className="text-xs mb-0.5" style={{ color: colors.muted }}>Weight (kg)</p>
                  <p className="font-medium" style={{ color: colors.text }}>{checkin.weight != null ? Number(checkin.weight) : '—'}</p>
                </div>
                <div>
                  <p className="text-xs mb-0.5" style={{ color: colors.muted }}>Pump rating</p>
                  <p className="font-medium" style={{ color: colors.text }}>{checkin.pump_rating != null ? checkin.pump_rating : '—'}</p>
                </div>
                <div>
                  <p className="text-xs mb-0.5" style={{ color: colors.muted }}>Flat / full rating</p>
                  <p className="font-medium" style={{ color: colors.text }}>{checkin.flat_full_rating != null ? checkin.flat_full_rating : '—'}</p>
                </div>
              </div>
              {checkin.client_notes && (
                <div className="mb-4">
                  <p className="text-xs mb-0.5" style={{ color: colors.muted }}>Client notes</p>
                  <p className="text-sm" style={{ color: colors.text }}>{checkin.client_notes}</p>
                </div>
              )}
              {photoUrls.length > 0 && (
                <div className="mb-4">
                  <p className="text-xs mb-2" style={{ color: colors.muted }}>Photos</p>
                  <div className="flex flex-wrap gap-2">
                    {photoUrls.map((url, i) => (
                      <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="block rounded-lg overflow-hidden border" style={{ borderColor: colors.border, maxWidth: 120, maxHeight: 120 }}>
                        <img src={url} alt={`Check-in ${i + 1}`} className="w-full h-full object-cover" style={{ width: 120, height: 120 }} />
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </Card>
          </section>

          <section style={{ marginBottom: sectionGap }}>
            <div style={sectionLabel}>Coach notes</div>
            <Card style={{ ...standardCard, padding: spacing[16] }}>
              <Textarea
                value={coachNotes}
                onChange={(e) => setCoachNotes(e.target.value)}
                placeholder="Feedback for the athlete..."
                rows={3}
                className="bg-black/20 border border-white/10 text-white"
              />
              <Button className="mt-2" size="sm" onClick={() => saveCoachNotesMutation.mutate()} disabled={saveCoachNotesMutation.isPending}>
                Save coach notes
              </Button>
            </Card>
          </section>

          <section style={{ marginBottom: sectionGap }}>
            <div style={sectionLabel}>Stage readiness (optional)</div>
            <Card style={{ ...standardCard, padding: spacing[16] }}>
              <p className="text-xs mb-3" style={{ color: colors.muted }}>Scores 1–10. Saved as a new readiness record.</p>
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <Label className="text-xs" style={{ color: colors.muted }}>Conditioning</Label>
                  <Input type="number" min={1} max={10} value={readinessConditioning} onChange={(e) => setReadinessConditioning(e.target.value)} className="mt-1 bg-black/20 border border-white/10 text-white" />
                </div>
                <div>
                  <Label className="text-xs" style={{ color: colors.muted }}>Fullness</Label>
                  <Input type="number" min={1} max={10} value={readinessFullness} onChange={(e) => setReadinessFullness(e.target.value)} className="mt-1 bg-black/20 border border-white/10 text-white" />
                </div>
                <div>
                  <Label className="text-xs" style={{ color: colors.muted }}>Dryness</Label>
                  <Input type="number" min={1} max={10} value={readinessDryness} onChange={(e) => setReadinessDryness(e.target.value)} className="mt-1 bg-black/20 border border-white/10 text-white" />
                </div>
                <div>
                  <Label className="text-xs" style={{ color: colors.muted }}>Fatigue</Label>
                  <Input type="number" min={1} max={10} value={readinessFatigue} onChange={(e) => setReadinessFatigue(e.target.value)} className="mt-1 bg-black/20 border border-white/10 text-white" />
                </div>
              </div>
              <div className="mb-3">
                <Label className="text-xs" style={{ color: colors.muted }}>Notes</Label>
                <Textarea value={readinessNotes} onChange={(e) => setReadinessNotes(e.target.value)} rows={2} className="mt-1 bg-black/20 border border-white/10 text-white" />
              </div>
              <Button variant="secondary" size="sm" onClick={() => saveReadinessMutation.mutate()} disabled={saveReadinessMutation.isPending}>
                Save stage readiness
              </Button>
            </Card>
          </section>

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" className="inline-flex items-center gap-1.5" onClick={() => { hapticLight(); navigate(`/messages/${clientId}`); }}>
              <MessageSquare size={14} /> Message client
            </Button>
            <Button variant="outline" size="sm" className="inline-flex items-center gap-1.5" onClick={() => { hapticLight(); navigate(`/clients/${clientId}/peak-week-editor`); }}>
              <ClipboardList size={14} /> Peak week plan
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const list = listQuery.data || [];

  return (
    <div className="min-h-screen pb-8" style={{ background: colors.bg, color: colors.text }}>
      <TopBar title="Peak Week Check-Ins" onBack={() => navigate(-1)} />
      <div className="max-w-lg mx-auto" style={{ ...pageContainer, paddingBottom: spacing[32] }}>
        <p className="text-sm mb-4" style={{ color: colors.muted }}>
          Latest peak week check-in per client. Tap to review and add coach notes or readiness scores.
        </p>
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-2 border-white/20 rounded-full animate-spin" style={{ borderTopColor: colors.primary }} />
          </div>
        ) : list.length === 0 ? (
          <Card style={{ ...standardCard, padding: spacing[24], textAlign: 'center' }}>
            <ClipboardList size={40} style={{ color: colors.muted, marginBottom: spacing[12] }} />
            <p className="font-medium" style={{ color: colors.text }}>No peak week check-ins yet</p>
            <p className="text-sm mt-1" style={{ color: colors.muted }}>When athletes submit peak week check-ins, they’ll appear here.</p>
          </Card>
        ) : (
          <ul className="space-y-0">
            {list.map((row) => (
              <li key={row.id}>
                <Card
                  style={{
                    ...standardCard,
                    padding: spacing[16],
                    marginBottom: spacing[8],
                    cursor: 'pointer',
                  }}
                  onClick={() => { hapticLight(); navigate(`/review-center/peak-week-checkins/${row.id}`); }}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold" style={{ color: colors.text }}>{row.client_name}</p>
                      <p className="text-xs mt-0.5" style={{ color: colors.muted }}>
                        {row.created_at ? new Date(row.created_at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '—'}
                        {row.weight != null && ` · ${Number(row.weight)} kg`}
                        {(row.pump_rating != null || row.flat_full_rating != null) && ` · P${row.pump_rating ?? '—'}/F${row.flat_full_rating ?? '—'}`}
                      </p>
                    </div>
                    <ChevronRight size={20} style={{ color: colors.muted }} />
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
