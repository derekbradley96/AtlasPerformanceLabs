/**
 * Coach-side check-in detail: metrics, notes, photos; Atlas Insights; Mark Reviewed, Message Client.
 */
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import TopBar from '@/components/ui/TopBar';
import Card from '@/ui/Card';
import { Button } from '@/components/ui/button';
import { colors, spacing, shell } from '@/ui/tokens';
import { pageContainer, standardCard, sectionLabel } from '@/ui/pageLayout';
import {
  getCheckinById,
  markCheckinReviewed,
  createCheckinPhotoSignedUrl,
} from '@/lib/checkins';
import { hasSupabase, getSupabase } from '@/lib/supabaseClient';
import { getActiveProgramAssignmentForClient } from '@/lib/programAssignments';
import { getCheckinInsights } from '@/lib/checkinInsights';
import { generateCheckinSummary } from '@/lib/atlasInsights';
import ReviewActionTray from '@/components/review/ReviewActionTray';
import InsightCard from '@/components/review/InsightCard';
import { MessageCircle, Check, Flag, ClipboardList } from 'lucide-react';

const METRIC_KEYS = [
  { key: 'weight', label: 'Weight' },
  { key: 'steps_avg', label: 'Steps (avg)' },
  { key: 'sleep_score', label: 'Sleep score' },
  { key: 'energy_level', label: 'Energy level' },
  { key: 'training_completion', label: 'Training completion %' },
  { key: 'nutrition_adherence', label: 'Nutrition adherence %' },
  { key: 'cardio_completion', label: 'Cardio completion %' },
  { key: 'posing_minutes', label: 'Posing (min)' },
  { key: 'pump_quality', label: 'Pump quality' },
  { key: 'digestion_score', label: 'Digestion score' },
];

export default function CheckInReviewPage() {
  const navigate = useNavigate();
  const { checkinId } = useParams();
  const [checkin, setCheckin] = useState(null);
  const [loading, setLoading] = useState(true);
  const [marking, setMarking] = useState(false);
  const [photoUrls, setPhotoUrls] = useState([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!checkinId) {
        setLoading(false);
        return;
      }
      const row = await getCheckinById(checkinId);
      if (cancelled) return;
      setCheckin(row);
      if (row?.photos && Array.isArray(row.photos) && row.photos.length > 0) {
        const urls = await Promise.all(
          row.photos.map((path) => createCheckinPhotoSignedUrl(path))
        );
        if (!cancelled) setPhotoUrls(urls.filter(Boolean));
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [checkinId]);

  const clientId = checkin?.client_id ?? null;
  const supabase = hasSupabase ? getSupabase() : null;
  const { data: trends = [] } = useQuery({
    queryKey: ['v_client_progress_trends', clientId],
    queryFn: async () => {
      if (!supabase || !clientId) return [];
      const { data, error } = await supabase
        .from('v_client_progress_trends')
        .select('*')
        .eq('client_id', clientId)
        .order('submitted_at', { ascending: true });
      return error ? [] : (Array.isArray(data) ? data : []);
    },
    enabled: !!supabase && !!clientId,
  });
  const { data: metrics } = useQuery({
    queryKey: ['v_client_progress_metrics', clientId],
    queryFn: async () => {
      if (!supabase || !clientId) return null;
      const { data, error } = await supabase
        .from('v_client_progress_metrics')
        .select('*')
        .eq('client_id', clientId)
        .maybeSingle();
      return error ? null : data;
    },
    enabled: !!supabase && !!clientId,
  });

  const insightCards = useMemo(() => {
    const all = getCheckinInsights(trends, metrics ?? null);
    const list = [
      all.weight && { key: 'weight', ...all.weight },
      all.compliance && { key: 'compliance', ...all.compliance },
      all.recovery && { key: 'recovery', ...all.recovery },
      all.flags && { key: 'flags', ...all.flags },
    ].filter(Boolean);
    return list.slice(0, 4);
  }, [trends, metrics]);

  const atlasSummaryCards = useMemo(() => {
    if (!checkin) return [];
    const previousTrends = Array.isArray(trends)
      ? trends.filter((t) => t.submitted_at && checkin.submitted_at && new Date(t.submitted_at) < new Date(checkin.submitted_at))
      : [];
    const result = generateCheckinSummary(checkin, previousTrends.length > 0 ? previousTrends : null);
    const weightTrend = result.details.filter((d) => /weight/i.test(d));
    const complianceTrend = result.details.filter((d) => /training|nutrition|adherence|completion/i.test(d));
    const recoveryMarkers = result.details.filter((d) => /sleep|energy/i.test(d));
    const alreadyShown = new Set([...weightTrend, ...complianceTrend, ...recoveryMarkers]);
    const riskWarnings = result.level === 'warning' ? result.details.filter((d) => !alreadyShown.has(d)) : [];
    const cards = [
      weightTrend.length > 0 && { key: 'weight', label: 'Weight trend', items: weightTrend, level: result.level },
      complianceTrend.length > 0 && { key: 'compliance', label: 'Compliance trend', items: complianceTrend, level: result.level },
      recoveryMarkers.length > 0 && { key: 'recovery', label: 'Recovery markers', items: recoveryMarkers, level: result.level },
      (riskWarnings.length > 0 || (result.level === 'warning' && result.details.length > 0)) && {
        key: 'risk',
        label: 'Risk warnings',
        items: riskWarnings.length > 0 ? riskWarnings : ['Review weight, compliance, and recovery above.'],
        level: 'warning',
      },
    ].filter(Boolean);
    return cards;
  }, [checkin, trends]);

  const handleMarkReviewed = async () => {
    if (!checkinId || marking) return;
    setMarking(true);
    try {
      const ok = await markCheckinReviewed(checkinId);
      if (ok) {
        toast.success('Marked as reviewed');
        setCheckin((c) => (c ? { ...c, reviewed_at: new Date().toISOString(), reviewed_by: true } : c));
      } else {
        toast.error('Could not mark as reviewed');
      }
    } finally {
      setMarking(false);
    }
  };

  const handleMessageClient = () => {
    const clientId = checkin?.client_id;
    if (clientId) navigate(`/messages/${clientId}`);
    else toast.error('Client not found');
  };

  const handleAddFlag = () => {
    const clientId = checkin?.client_id;
    if (clientId) {
      navigate(`/clients/${clientId}`);
      toast.info('Add flag from client profile');
    } else toast.error('Client not found');
  };

  const handleAdjustProgram = async () => {
    const clientId = checkin?.client_id;
    if (!clientId) {
      toast.error('Client not found');
      return;
    }
    const supabase = hasSupabase ? getSupabase() : null;
    const active = supabase ? await getActiveProgramAssignmentForClient(supabase, clientId) : null;
    const params = new URLSearchParams({ clientId });
    params.set('source', 'checkin');
    if (checkinId) params.set('review_id', checkinId);
    const note = checkin?.struggles?.trim() || checkin?.questions?.trim();
    if (note) params.set('note', note.slice(0, 120));
    if (active?.block?.id) {
      params.set('blockId', active.block.id);
      navigate(`/program-builder?${params.toString()}`);
    } else {
      navigate(`/program-assignments?${params.toString()}`);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen" style={{ background: colors.bg, color: colors.text }}>
        <TopBar title="Check-in" onBack={() => navigate(-1)} />
        <div style={{ ...pageContainer, paddingTop: spacing[24] }}>
          <div className="animate-pulse rounded-xl" style={{ ...standardCard, padding: spacing[24], minHeight: 220 }}>
            <div style={{ height: 14, width: '50%', background: colors.surface2, borderRadius: 6, marginBottom: spacing[16] }} />
            <div style={{ height: 12, width: '90%', background: colors.surface2, borderRadius: 6, marginBottom: spacing[8] }} />
            <div style={{ height: 12, width: '70%', background: colors.surface2, borderRadius: 6, marginBottom: spacing[16] }} />
            <div style={{ height: 48, width: '100%', background: colors.surface2, borderRadius: shell.cardRadius }} />
          </div>
        </div>
      </div>
    );
  }

  if (!checkin) {
    return (
      <div className="min-h-screen" style={{ background: colors.bg, color: colors.text }}>
        <TopBar title="Check-in" onBack={() => navigate(-1)} />
        <div className="p-6 text-center">
          <p style={{ color: colors.muted }}>Check-in not found.</p>
          <Button variant="outline" className="mt-4" onClick={() => navigate(-1)}>Go back</Button>
        </div>
      </div>
    );
  }

  const isReviewed = !!(checkin.reviewed_at || checkin.reviewed_by);

  return (
    <div className="min-h-screen" style={{ background: colors.bg, color: colors.text }}>
      <TopBar title="Check-in" onBack={() => navigate(-1)} />
      <div style={{ ...pageContainer, paddingBottom: spacing[32] }}>
        <p className="atlas-meta" style={{ marginBottom: spacing[16] }}>
          Week of {checkin.week_start} · {checkin.focus_type ?? '—'}
        </p>

        {atlasSummaryCards.length > 0 && (
          <section style={{ marginBottom: spacing[16] }}>
            <p style={{ ...sectionLabel, marginBottom: spacing[8] }}>
              Atlas Summary
            </p>
            <div className="grid gap-2" style={{ gridTemplateColumns: '1fr 1fr' }}>
              {atlasSummaryCards.map(({ key, label, items, level }) => (
                <Card
                  key={key}
                  style={{
                    padding: spacing[12],
                    borderLeft: `3px solid ${level === 'warning' ? colors.warning : colors.primary}`,
                    background: colors.surface1,
                  }}
                >
                  <p className="text-xs font-medium mb-1" style={{ color: colors.muted }}>{label}</p>
                  <ul className="text-xs m-0 pl-4" style={{ color: colors.text, lineHeight: 1.4 }}>
                    {items.map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                </Card>
              ))}
            </div>
          </section>
        )}

        <Card style={{ ...standardCard, marginBottom: spacing[16], padding: spacing[16] }}>
          <p className="atlas-meta" style={{ marginBottom: spacing[8] }}>Metrics</p>
          <div className="grid gap-2" style={{ gridTemplateColumns: '1fr 1fr' }}>
            {METRIC_KEYS.map(({ key, label }) => {
              const v = checkin[key];
              if (v == null || v === '') return null;
              return (
                <div key={key}>
                  <span className="text-xs" style={{ color: colors.muted }}>{label}</span>
                  <p className="font-medium" style={{ color: colors.text }}>{String(v)}</p>
                </div>
              );
            })}
          </div>
        </Card>

        {insightCards.length > 0 && (
          <section style={{ marginBottom: spacing[16] }}>
            <p style={{ ...sectionLabel, marginBottom: spacing[8] }}>Atlas Insights</p>
            {insightCards.map(({ key, level, title, detail }) => (
              <InsightCard
                key={key}
                level={key === 'flags' && level === 'warning' ? 'danger' : level}
                title={title}
                detail={detail}
              />
            ))}
          </section>
        )}

        {(checkin.wins || checkin.struggles || checkin.questions) && (
          <Card style={{ ...standardCard, marginBottom: spacing[16], padding: spacing[16] }}>
            <p className="atlas-meta" style={{ marginBottom: spacing[8] }}>Notes</p>
            {checkin.wins && (
              <div className="mb-3">
                <span className="text-xs" style={{ color: colors.muted }}>Wins</span>
                <p className="text-sm mt-0.5" style={{ color: colors.text }}>{checkin.wins}</p>
              </div>
            )}
            {checkin.struggles && (
              <div className="mb-3">
                <span className="text-xs" style={{ color: colors.muted }}>Struggles</span>
                <p className="text-sm mt-0.5" style={{ color: colors.text }}>{checkin.struggles}</p>
              </div>
            )}
            {checkin.questions && (
              <div>
                <span className="text-xs" style={{ color: colors.muted }}>Questions</span>
                <p className="text-sm mt-0.5" style={{ color: colors.text }}>{checkin.questions}</p>
              </div>
            )}
          </Card>
        )}

        {photoUrls.length > 0 && (
          <Card style={{ ...standardCard, marginBottom: spacing[16], padding: spacing[16] }}>
            <p className="atlas-meta" style={{ marginBottom: spacing[8] }}>Photos</p>
            <div className="flex flex-wrap gap-2">
              {photoUrls.map((url, i) => (
                <a
                  key={i}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block rounded-lg overflow-hidden"
                  style={{ width: 100, height: 100 }}
                >
                  <img src={url} alt="" className="w-full h-full object-cover" />
                </a>
              ))}
            </div>
          </Card>
        )}

        <ReviewActionTray
          actions={[
            { label: 'Message Client', onClick: handleMessageClient, icon: <MessageCircle size={16} /> },
            { label: 'Add Flag', onClick: handleAddFlag, icon: <Flag size={16} /> },
            { label: 'Adjust Program', onClick: handleAdjustProgram, icon: <ClipboardList size={16} /> },
            ...(!isReviewed ? [{ label: marking ? 'Saving…' : 'Mark Reviewed', onClick: handleMarkReviewed, primary: true, disabled: marking, icon: <Check size={16} /> }] : []),
          ]}
        />
      </div>
    </div>
  );
}
