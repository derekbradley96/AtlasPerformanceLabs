/**
 * Coach: pose check detail — review by mandatory pose (pose_check_items).
 * Each row: pose label, submitted image, coach_rating, coach_notes.
 * Summary: overall notes, mark reviewed, message client, adjust prep / posing work.
 * Falls back to legacy photos + overall rating when no pose_check_items.
 */
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import TopBar from '@/components/ui/TopBar';
import Card from '@/ui/Card';
import { Button } from '@/components/ui/button';
import { colors, spacing, shell } from '@/ui/tokens';
import {
  getPoseCheckById,
  getPoseCheckItems,
  updatePoseCheckItem,
  savePoseCheckReview,
  createPoseCheckPhotoSignedUrl,
  listPoseConditioningNotes,
  addPoseConditioningNote,
  removePoseConditioningNote,
  POSE_CONDITIONING_TAGS,
} from '@/lib/poseChecks';
import { useAuth } from '@/lib/AuthContext';
import { hasSupabase, getSupabase } from '@/lib/supabaseClient';
import { getActiveProgramAssignmentForClient } from '@/lib/programAssignments';
import { getPrepInsight } from '@/lib/checkinInsights';
import { getPrepInsightSummaries } from '@/lib/prepInsights';
import { generatePrepInsight } from '@/lib/atlasInsights';
import ReviewActionTray from '@/components/review/ReviewActionTray';
import InsightCard from '@/components/review/InsightCard';
import PrepTimelineCard from '@/components/prep/PrepTimelineCard';
import PoseCheckTimeline from '@/components/prep/PoseCheckTimeline';
import { MessageCircle, Check, ClipboardList, Award, User, Tag, X } from 'lucide-react';

function showPrepInsightsByFocus(coachFocus) {
  const f = (coachFocus ?? '').toString().trim().toLowerCase();
  return f === 'competition' || f === 'integrated';
}

export default function PoseCheckReviewDetailPage() {
  const navigate = useNavigate();
  const { poseCheckId } = useParams();
  const { coachFocus } = useAuth();
  const [poseCheck, setPoseCheck] = useState(null);
  const [items, setItems] = useState([]);
  const [itemSignedUrls, setItemSignedUrls] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [legacyPhotoUrls, setLegacyPhotoUrls] = useState([]);
  const [overallCoachNotes, setOverallCoachNotes] = useState('');
  const [itemEdits, setItemEdits] = useState({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!poseCheckId) {
        setLoading(false);
        return;
      }
      const [row, itemRows] = await Promise.all([
        getPoseCheckById(poseCheckId),
        getPoseCheckItems(poseCheckId),
      ]);
      if (cancelled) return;
      setPoseCheck(row);
      setItems(Array.isArray(itemRows) ? itemRows : []);
      const edits = {};
      (itemRows || []).forEach((i) => {
        edits[i.id] = { coach_rating: i.coach_rating, coach_notes: i.coach_notes ?? '' };
      });
      setItemEdits(edits);
      if (row) {
        setOverallCoachNotes(row.coach_notes ?? '');
        if (row.photos && Array.isArray(row.photos) && row.photos.length > 0) {
          const urls = await Promise.all(row.photos.map((path) => createPoseCheckPhotoSignedUrl(path)));
          if (!cancelled) setLegacyPhotoUrls(urls.filter(Boolean));
        }
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [poseCheckId]);

  useEffect(() => {
    if (items.length === 0) return;
    let cancelled = false;
    (async () => {
      const byId = {};
      await Promise.all(
        items
          .filter((i) => i.photo_path)
          .map(async (i) => {
            const url = await createPoseCheckPhotoSignedUrl(i.photo_path);
            if (!cancelled && url) byId[i.id] = url;
          })
      );
      if (!cancelled) setItemSignedUrls((prev) => ({ ...prev, ...byId }));
    })();
    return () => { cancelled = true; };
  }, [items]);

  const clientId = poseCheck?.client_id ?? null;
  const supabase = hasSupabase ? getSupabase() : null;
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
  const { data: poseChecksCount } = useQuery({
    queryKey: ['pose_checks_count_4w', clientId],
    queryFn: async () => {
      if (!supabase || !clientId) return 0;
      const since = new Date();
      since.setDate(since.getDate() - 28);
      const { count, error } = await supabase
        .from('pose_checks')
        .select('*', { count: 'exact', head: true })
        .eq('client_id', clientId)
        .gte('submitted_at', since.toISOString());
      return error ? 0 : (count ?? 0);
    },
    enabled: !!supabase && !!clientId,
  });
  const { data: prepHeader } = useQuery({
    queryKey: ['v_client_prep_header', clientId],
    queryFn: async () => {
      if (!supabase || !clientId) return null;
      const { data, error } = await supabase
        .from('v_client_prep_header')
        .select('*')
        .eq('client_id', clientId)
        .maybeSingle();
      return error ? null : data;
    },
    enabled: !!supabase && !!clientId && !!metrics?.has_active_prep,
  });
  const { data: activePrep } = useQuery({
    queryKey: ['contest_preps_active', clientId],
    queryFn: async () => {
      if (!supabase || !clientId) return null;
      const { data, error } = await supabase
        .from('contest_preps')
        .select('id, division, division_key')
        .eq('client_id', clientId)
        .eq('is_active', true)
        .maybeSingle();
      return error ? null : data;
    },
    enabled: !!supabase && !!clientId,
  });

  const prepDataForInsight = useMemo(() => {
    if (!metrics?.has_active_prep) return null;
    return {
      has_active_prep: true,
      days_out: prepHeader?.days_out ?? metrics?.days_out,
      show_date: prepHeader?.show_date,
      pose_check_submitted_this_week: prepHeader?.pose_check_submitted_this_week === true,
      weight_change: metrics?.weight_change,
      show_name: prepHeader?.show_name,
      division: prepHeader?.division ?? activePrep?.division,
    };
  }, [metrics, prepHeader, activePrep]);

  const atlasPrepInsight = useMemo(
    () => (prepDataForInsight ? generatePrepInsight(prepDataForInsight) : null),
    [prepDataForInsight]
  );
  const showAtlasPrepCard = atlasPrepInsight && atlasPrepInsight.title !== 'No active prep';

  const prepInsightSummaries = useMemo(() => {
    if (!showPrepInsightsByFocus(coachFocus) || !metrics?.has_active_prep) return [];
    return getPrepInsightSummaries(prepHeader ?? null, metrics, {
      poseChecksLast4w: poseChecksCount ?? 0,
      poseSubmittedThisWeek: prepHeader?.pose_check_submitted_this_week === true,
    });
  }, [coachFocus, metrics, prepHeader, poseChecksCount]);

  const prepInsightCards = useMemo(() => {
    const cards = [];
    const prep = getPrepInsight(metrics ?? null);
    if (prep) cards.push({ key: 'prep', ...prep });
    if (typeof poseChecksCount === 'number' && metrics?.has_active_prep) {
      cards.push({
        key: 'frequency',
        level: 'neutral',
        title: 'Pose check frequency',
        detail: `${poseChecksCount} in the last 4 weeks.`,
      });
    }
    return cards;
  }, [metrics, poseChecksCount]);

  const itemIds = useMemo(() => items.map((i) => i.id).filter(Boolean), [items]);
  const { data: conditioningNotes = [], refetch: refetchConditioningNotes } = useQuery({
    queryKey: ['pose_conditioning_notes', itemIds],
    queryFn: () => listPoseConditioningNotes(itemIds),
    enabled: itemIds.length > 0,
  });
  const notesByItemId = useMemo(() => {
    const map = {};
    for (const n of conditioningNotes) {
      if (!n.pose_check_item_id) continue;
      if (!map[n.pose_check_item_id]) map[n.pose_check_item_id] = [];
      map[n.pose_check_item_id].push(n);
    }
    return map;
  }, [conditioningNotes]);

  const [addTagItemId, setAddTagItemId] = useState(null);
  const [addTagValue, setAddTagValue] = useState('');
  const [addTagNote, setAddTagNote] = useState('');
  const [addingTag, setAddingTag] = useState(false);

  const setItemEdit = (itemId, field, value) => {
    setItemEdits((prev) => ({
      ...prev,
      [itemId]: { ...(prev[itemId] || {}), [field]: value },
    }));
  };

  const handleAddConditioningTag = async () => {
    if (!addTagItemId || !addTagValue || addingTag) return;
    setAddingTag(true);
    try {
      const added = await addPoseConditioningNote(addTagItemId, addTagValue, addTagNote);
      if (added) {
        toast.success('Tag added');
        refetchConditioningNotes();
        setAddTagItemId(null);
        setAddTagValue('');
        setAddTagNote('');
      } else toast.error('Could not add tag');
    } finally {
      setAddingTag(false);
    }
  };

  const handleRemoveConditioningTag = async (noteId) => {
    const ok = await removePoseConditioningNote(noteId);
    if (ok) {
      toast.success('Tag removed');
      refetchConditioningNotes();
    } else toast.error('Could not remove tag');
  };

  const handleSaveReview = async (e) => {
    e?.preventDefault();
    if (!poseCheckId || saving) return;
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.id) {
        toast.error('Not signed in');
        setSaving(false);
        return;
      }
      for (const item of items) {
        const edit = itemEdits[item.id];
        if (!edit) continue;
        const rating = edit.coach_rating !== undefined && edit.coach_rating !== null && edit.coach_rating !== ''
          ? Math.min(10, Math.max(1, parseInt(String(edit.coach_rating), 10)))
          : null;
        const notes = typeof edit.coach_notes === 'string' && edit.coach_notes.trim() ? edit.coach_notes.trim() : null;
        if (rating !== item.coach_rating || notes !== (item.coach_notes ?? null)) {
          await updatePoseCheckItem(item.id, { coach_rating: Number.isNaN(rating) ? null : rating, coach_notes: notes });
        }
      }
      const ok = await savePoseCheckReview(poseCheckId, {
        coach_notes: overallCoachNotes.trim() || null,
      });
      if (ok) {
        toast.success('Review saved');
        setPoseCheck((p) =>
          p ? { ...p, reviewed_at: new Date().toISOString(), reviewed_by: user.id, coach_notes: overallCoachNotes.trim() || null } : p
        );
        setItems((prev) =>
          prev.map((i) => {
            const e = itemEdits[i.id];
            return e ? { ...i, coach_rating: e.coach_rating, coach_notes: e.coach_notes } : i;
          })
        );
      } else {
        toast.error('Could not save review');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleMessageClient = () => {
    if (clientId) navigate(`/messages/${clientId}`);
    else toast.error('Client not found');
  };

  const handleAdjustProgram = async () => {
    if (!clientId) {
      toast.error('Client not found');
      return;
    }
    const active = supabase ? await getActiveProgramAssignmentForClient(supabase, clientId) : null;
    const params = new URLSearchParams({ clientId });
    params.set('source', 'pose_check');
    if (poseCheckId) params.set('review_id', poseCheckId);
    const note = poseCheck?.client_notes?.trim();
    if (note) params.set('note', note.slice(0, 120));
    if (active?.block?.id) {
      params.set('blockId', active.block.id);
      navigate(`/program-builder?${params.toString()}`);
    } else {
      navigate(`/program-assignments?${params.toString()}`);
    }
  };

  const handlePosingWork = () => {
    if (clientId) navigate(`/clients/${clientId}`);
    else toast.error('Client not found');
  };

  const handleBackToClient = () => {
    if (clientId) navigate(`/clients/${clientId}`);
    else navigate(-1);
  };

  if (loading) {
    return (
      <div className="min-h-screen" style={{ background: colors.bg, color: colors.text }}>
        <TopBar title="Pose check" onBack={() => navigate(-1)} />
        <div className="p-4 flex items-center justify-center" style={{ minHeight: 200 }}>
          <p style={{ color: colors.muted }}>Loading…</p>
        </div>
      </div>
    );
  }

  if (!poseCheck) {
    return (
      <div className="min-h-screen" style={{ background: colors.bg, color: colors.text }}>
        <TopBar title="Pose check" onBack={() => navigate(-1)} />
        <div className="p-6 text-center">
          <p style={{ color: colors.muted }}>Pose check not found.</p>
          <Button variant="outline" className="mt-4" onClick={() => navigate(-1)}>Go back</Button>
        </div>
      </div>
    );
  }

  const isReviewed = !!(poseCheck.reviewed_at || poseCheck.reviewed_by);
  const hasStructuredItems = items.length > 0;

  return (
    <div className="min-h-screen" style={{ background: colors.bg, color: colors.text }}>
      <TopBar title="Pose check" onBack={() => navigate(-1)} />
      <div className="p-4 pb-8" style={{ paddingBottom: 120 }}>
        <p className="text-sm mb-1" style={{ color: colors.muted }}>
          Week of {poseCheck.week_start}
          {activePrep && (activePrep.division || activePrep.division_key) && (
            <span className="ml-2" style={{ color: colors.text }}>
              · {activePrep.division || activePrep.division_key}
            </span>
          )}
        </p>

        {clientId && metrics?.has_active_prep && (
          <section style={{ marginBottom: spacing[16] }}>
            <PrepTimelineCard clientId={clientId} />
            <PoseCheckTimeline clientId={clientId} onSelectPoseCheck={(id) => id && navigate(`/review-center/pose-checks/${id}`)} />
          </section>
        )}

        {(showAtlasPrepCard || prepInsightSummaries.length > 0) && (
          <section style={{ marginBottom: spacing[16] }}>
            <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: colors.muted }}>Prep insights</p>
            {showAtlasPrepCard && (
              <InsightCard
                level={atlasPrepInsight.level === 'warning' ? 'warning' : atlasPrepInsight.level === 'positive' ? 'positive' : 'neutral'}
                title={atlasPrepInsight.title}
                detail={atlasPrepInsight.summary}
              />
            )}
            {prepInsightSummaries.map((s, i) => (
              <InsightCard key={i} level={s.level} title={s.title} detail={s.detail} />
            ))}
          </section>
        )}

        {prepInsightCards.length > 0 && (
          <section style={{ marginBottom: spacing[16] }}>
            <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: colors.muted }}>Atlas Insights</p>
            {prepInsightCards.map(({ key, level, title, detail }) => (
              <InsightCard key={key} level={level} title={title} detail={detail} />
            ))}
          </section>
        )}

        {poseCheck.client_notes && (
          <Card style={{ marginBottom: spacing[16], padding: spacing[16], border: `1px solid ${shell.cardBorder}`, borderRadius: shell.cardRadius }}>
            <p className="text-xs font-medium mb-2" style={{ color: colors.muted }}>Client notes</p>
            <p className="text-sm whitespace-pre-wrap" style={{ color: colors.text }}>{poseCheck.client_notes}</p>
          </Card>
        )}

        {hasStructuredItems ? (
          <section style={{ marginBottom: spacing[24] }}>
            <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: colors.muted }}>Mandatory poses</p>
            <div className="space-y-4">
              {items.map((item) => {
                const edit = itemEdits[item.id] || {};
                const rating = edit.coach_rating !== undefined ? edit.coach_rating : item.coach_rating;
                const notes = edit.coach_notes !== undefined ? edit.coach_notes : (item.coach_notes ?? '');
                const imageUrl = itemSignedUrls[item.id] || null;
                return (
                  <Card
                    key={item.id}
                    style={{
                      padding: spacing[16],
                      border: `1px solid ${shell.cardBorder}`,
                      borderRadius: shell.cardRadius,
                      boxShadow: shell.cardShadow,
                    }}
                  >
                    <p className="text-sm font-semibold mb-3" style={{ color: colors.text }}>{item.pose_label}</p>
                    <div className="flex flex-col sm:flex-row gap-4">
                      <div className="flex-shrink-0">
                        {imageUrl ? (
                          <a
                            href={imageUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block rounded-lg overflow-hidden"
                            style={{ width: 160, height: 200, background: colors.surface2 }}
                          >
                            <img src={imageUrl} alt={item.pose_label} className="w-full h-full object-cover" />
                          </a>
                        ) : (
                          <div
                            className="rounded-lg flex items-center justify-center"
                            style={{ width: 160, height: 200, background: colors.surface2, color: colors.muted }}
                          >
                            <span className="text-xs">No photo</span>
                          </div>
                        )}
                        {/* Conditioning tag markers */}
                        <div className="flex flex-wrap gap-1.5 mt-2 items-center">
                          {(notesByItemId[item.id] || []).map((n) => {
                            const label = POSE_CONDITIONING_TAGS.find((t) => t.value === n.tag)?.label || n.tag;
                            return (
                              <span
                                key={n.id}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs"
                                style={{ background: colors.primarySubtle, color: colors.primary }}
                              >
                                {label}
                                <button
                                  type="button"
                                  onClick={() => handleRemoveConditioningTag(n.id)}
                                  aria-label="Remove tag"
                                  style={{ padding: 0, border: 'none', background: 'none', color: 'inherit', cursor: 'pointer', display: 'flex' }}
                                >
                                  <X size={12} />
                                </button>
                              </span>
                            );
                          })}
                          {addTagItemId === item.id ? (
                            <div className="flex flex-wrap gap-2 items-center">
                              <select
                                value={addTagValue}
                                onChange={(e) => setAddTagValue(e.target.value)}
                                className="rounded border text-sm"
                                style={{ padding: 4, background: colors.surface2, borderColor: colors.border, color: colors.text }}
                              >
                                <option value="">Select tag</option>
                                {POSE_CONDITIONING_TAGS.map((t) => (
                                  <option key={t.value} value={t.value}>{t.label}</option>
                                ))}
                              </select>
                              <input
                                type="text"
                                placeholder="Note (optional)"
                                value={addTagNote}
                                onChange={(e) => setAddTagNote(e.target.value)}
                                className="rounded border text-xs w-24"
                                style={{ padding: 4, background: colors.surface2, borderColor: colors.border, color: colors.text }}
                              />
                              <button
                                type="button"
                                onClick={handleAddConditioningTag}
                                disabled={!addTagValue || addingTag}
                                className="text-xs px-2 py-1 rounded"
                                style={{ background: colors.primary, color: '#fff', border: 'none', cursor: addingTag ? 'wait' : 'pointer' }}
                              >
                                {addingTag ? '…' : 'Add'}
                              </button>
                              <button
                                type="button"
                                onClick={() => { setAddTagItemId(null); setAddTagValue(''); setAddTagNote(''); }}
                                className="text-xs px-1"
                                style={{ color: colors.muted }}
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setAddTagItemId(item.id)}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs border"
                              style={{ borderColor: colors.border, color: colors.muted, background: 'transparent', cursor: 'pointer' }}
                            >
                              <Tag size={12} /> Add tag
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <label className="block text-xs font-medium mb-1" style={{ color: colors.muted }}>Rating (1–10)</label>
                        <input
                          type="number"
                          min={1}
                          max={10}
                          value={rating === null || rating === undefined || rating === '' ? '' : rating}
                          onChange={(e) => setItemEdit(item.id, 'coach_rating', e.target.value === '' ? '' : e.target.value)}
                          placeholder="Optional"
                          className="w-full rounded-lg border bg-black/20 text-white placeholder:text-gray-500"
                          style={{ padding: 8, borderColor: colors.border, marginBottom: spacing[12], maxWidth: 80 }}
                        />
                        <label className="block text-xs font-medium mb-1" style={{ color: colors.muted }}>Notes</label>
                        <textarea
                          value={notes}
                          onChange={(e) => setItemEdit(item.id, 'coach_notes', e.target.value)}
                          placeholder="Optional"
                          rows={2}
                          className="w-full rounded-lg border bg-black/20 text-white placeholder:text-gray-500"
                          style={{ padding: 8, borderColor: colors.border, fontSize: 14 }}
                        />
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          </section>
        ) : (
          <>
            {legacyPhotoUrls.length > 0 && (
              <Card style={{ marginBottom: spacing[16], padding: spacing[16], border: `1px solid ${shell.cardBorder}`, borderRadius: shell.cardRadius }}>
                <p className="text-xs font-medium mb-2" style={{ color: colors.muted }}>Photos</p>
                <div className="flex flex-wrap gap-2">
                  {legacyPhotoUrls.map((url, i) => (
                    <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="block rounded-lg overflow-hidden" style={{ width: 100, height: 100 }}>
                      <img src={url} alt="" className="w-full h-full object-cover" />
                    </a>
                  ))}
                </div>
              </Card>
            )}
          </>
        )}

        <section style={{ marginBottom: spacing[16] }}>
          <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: colors.muted }}>Overall notes</p>
          <Card style={{ padding: spacing[16], border: `1px solid ${shell.cardBorder}`, borderRadius: shell.cardRadius }}>
            <textarea
              value={overallCoachNotes}
              onChange={(e) => setOverallCoachNotes(e.target.value)}
              placeholder="Summary or feedback for the client…"
              rows={3}
              className="w-full rounded-lg border bg-black/20 text-white placeholder:text-gray-500"
              style={{ padding: 10, borderColor: colors.border }}
            />
          </Card>
        </section>

        <ReviewActionTray
          actions={[
            { label: saving ? 'Saving…' : isReviewed ? 'Update review' : 'Save & mark reviewed', onClick: handleSaveReview, primary: true, disabled: saving, icon: <Check size={16} /> },
            { label: 'Message client', onClick: handleMessageClient, icon: <MessageCircle size={16} /> },
            { label: 'Back to client', onClick: handleBackToClient, icon: <User size={16} /> },
            { label: 'Adjust program', onClick: handleAdjustProgram, icon: <ClipboardList size={16} /> },
            { label: 'Posing work', onClick: handlePosingWork, icon: <Award size={16} /> },
          ]}
        />
      </div>
    </div>
  );
}
