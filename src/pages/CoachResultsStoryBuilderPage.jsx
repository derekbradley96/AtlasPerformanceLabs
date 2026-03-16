/**
 * Coach: create and edit public result stories (transformation / prep).
 * Uses client_result_stories, result_story_metrics, and storage (marketplace_coach_media/result_stories).
 */
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import TopBar from '@/components/ui/TopBar';
import Card from '@/ui/Card';
import Button from '@/ui/Button';
import { colors, spacing } from '@/ui/tokens';
import { useAuth } from '@/lib/AuthContext';
import { hasSupabase, getSupabase } from '@/lib/supabaseClient';
import { uploadResultStoryImage, getResultStoryImageUrl } from '@/lib/resultStories';
import {
  ImagePlus,
  Trash2,
  Plus,
  Trophy,
  Eye,
  EyeOff,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';

const STORY_TYPES = [
  { value: 'transformation', label: 'Transformation' },
  { value: 'prep', label: 'Competition / Prep' },
];

/** Transformation-only coaches do not see prep option (no prep language leak). */
function getStoryTypesForFocus(coachFocus) {
  if (coachFocus === 'transformation') return STORY_TYPES.filter((t) => t.value === 'transformation');
  if (coachFocus === 'competition') return STORY_TYPES.filter((t) => t.value === 'prep');
  return STORY_TYPES;
}

function getMetricsHint(coachFocus, storyType) {
  if (storyType === 'transformation') return 'e.g. Weight lost, body fat change, adherence';
  if (storyType === 'prep') return 'e.g. Show name, placing, stage weight';
  return 'e.g. Weight lost, weeks coached, show name, placing';
}

const METRIC_PRESETS = {
  transformation: [
    { key: 'weight_lost', label: 'Weight lost', value: '' },
    { key: 'weeks_coached', label: 'Weeks coached', value: '' },
    { key: 'body_fat_change', label: 'Body fat change', value: '' },
    { key: 'compliance_rate', label: 'Compliance rate', value: '' },
  ],
  prep: [
    { key: 'show_name', label: 'Show name', value: '' },
    { key: 'placing', label: 'Placing', value: '' },
    { key: 'stage_weight', label: 'Stage weight', value: '' },
    { key: 'weeks_out_duration', label: 'Weeks out duration', value: '' },
    { key: 'peak_week_notes', label: 'Peak week notes', value: '' },
  ],
};

function MetricRow({ metric, onChange, onRemove }) {
  return (
    <div className="flex gap-2 items-start mb-2">
      <input
        type="text"
        placeholder="Label"
        value={metric.label}
        onChange={(e) => onChange({ ...metric, label: e.target.value })}
        className="flex-1 min-w-0 rounded-lg border px-3 py-2 text-sm"
        style={{ background: colors.surface2, borderColor: colors.border, color: colors.text }}
      />
      <input
        type="text"
        placeholder="Value"
        value={metric.value}
        onChange={(e) => onChange({ ...metric, value: e.target.value })}
        className="flex-1 min-w-0 rounded-lg border px-3 py-2 text-sm"
        style={{ background: colors.surface2, borderColor: colors.border, color: colors.text }}
      />
      <button
        type="button"
        onClick={onRemove}
        className="p-2 rounded-lg shrink-0"
        style={{ color: colors.muted }}
        aria-label="Remove metric"
      >
        <Trash2 size={18} />
      </button>
    </div>
  );
}

export default function CoachResultsStoryBuilderPage() {
  const { id: storyId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const coachId = user?.id ?? null;
  const supabase = hasSupabase ? getSupabase() : null;
  const queryClient = useQueryClient();

  const isEdit = !!storyId;

  const { data: profile } = useQuery({
    queryKey: ['profile-coach-focus', coachId],
    queryFn: async () => {
      if (!supabase || !coachId) return null;
      const { data } = await supabase.from('profiles').select('coach_focus').eq('id', coachId).maybeSingle();
      return data;
    },
    enabled: !!coachId && !!supabase,
  });
  const coachFocus = profile?.coach_focus ?? 'integrated';

  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [storyType, setStoryType] = useState('transformation');
  const [isPublic, setIsPublic] = useState(false);
  const [clientId, setClientId] = useState('');
  const [metrics, setMetrics] = useState([]);
  const [beforeFile, setBeforeFile] = useState(null);
  const [afterFile, setAfterFile] = useState(null);
  const [beforePreview, setBeforePreview] = useState(null);
  const [afterPreview, setAfterPreview] = useState(null);
  const [saving, setSaving] = useState(false);

  const { data: story, isLoading: loadingStory } = useQuery({
    queryKey: ['result_story', storyId],
    queryFn: async () => {
      if (!supabase || !storyId) return null;
      const { data, error } = await supabase
        .from('client_result_stories')
        .select('*')
        .eq('id', storyId)
        .eq('coach_id', coachId)
        .maybeSingle();
      if (error || !data) return null;
      return data;
    },
    enabled: isEdit && !!storyId && !!coachId && !!supabase,
  });

  const { data: storyMetrics = [] } = useQuery({
    queryKey: ['result_story_metrics', storyId],
    queryFn: async () => {
      if (!supabase || !storyId) return [];
      const { data, error } = await supabase
        .from('result_story_metrics')
        .select('*')
        .eq('story_id', storyId)
        .order('sort_order', { ascending: true });
      if (error) return [];
      return Array.isArray(data) ? data : [];
    },
    enabled: isEdit && !!storyId && !!supabase,
  });

  useEffect(() => {
    if (!story) return;
    setTitle(story.title ?? '');
    setSummary(story.summary ?? '');
    setStoryType(story.story_type ?? 'transformation');
    setIsPublic(!!story.is_public);
    setClientId(story.client_id ?? '');
  }, [story]);

  const defaultStoryTypeSet = React.useRef(false);
  useEffect(() => {
    if (isEdit || story || defaultStoryTypeSet.current || coachFocus == null) return;
    defaultStoryTypeSet.current = true;
    if (coachFocus === 'competition') setStoryType('prep');
    else setStoryType('transformation');
  }, [coachFocus, isEdit, story]);

  useEffect(() => {
    setMetrics(
      storyMetrics.map((m) => ({
        key: m.metric_key,
        label: m.metric_label,
        value: m.metric_value,
        sort_order: m.sort_order ?? 0,
      }))
    );
  }, [storyMetrics]);

  const loadPreviews = useCallback(async () => {
    if (!story?.before_image_path && !story?.after_image_path) return;
    if (story.before_image_path) {
      const url = await getResultStoryImageUrl(story.before_image_path);
      setBeforePreview(url);
    }
    if (story.after_image_path) {
      const url = await getResultStoryImageUrl(story.after_image_path);
      setAfterPreview(url);
    }
  }, [story?.before_image_path, story?.after_image_path]);

  useEffect(() => {
    loadPreviews();
  }, [loadPreviews]);

  const addPresetMetrics = () => {
    const preset = METRIC_PRESETS[storyType] ?? [];
    const existingKeys = new Set(metrics.map((m) => m.key));
    const next = [...metrics];
    let order = metrics.length;
    for (const p of preset) {
      if (existingKeys.has(p.key)) continue;
      next.push({ ...p, sort_order: order++ });
      existingKeys.add(p.key);
    }
    setMetrics(next);
  };

  const setMetric = (index, updated) => {
    setMetrics((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], ...updated };
      return next;
    });
  };

  const removeMetric = (index) => {
    setMetrics((prev) => prev.filter((_, i) => i !== index));
  };

  const addMetric = () => {
    setMetrics((prev) => [...prev, { key: `custom_${Date.now()}`, label: '', value: '', sort_order: prev.length }]);
  };

  const handleBeforeFile = (e) => {
    const file = e?.target?.files?.[0];
    if (!file) return;
    setBeforeFile(file);
    const url = URL.createObjectURL(file);
    setBeforePreview(url);
  };

  const handleAfterFile = (e) => {
    const file = e?.target?.files?.[0];
    if (!file) return;
    setAfterFile(file);
    const url = URL.createObjectURL(file);
    setAfterPreview(url);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!supabase || !coachId) throw new Error('Not signed in');
      const payload = {
        coach_id: coachId,
        title: title.trim() || 'Untitled story',
        summary: summary.trim() || null,
        story_type: storyType,
        is_public: isPublic,
        client_id: clientId.trim() || null,
      };

      let sid = storyId;
      if (isEdit) {
        const { error } = await supabase
          .from('client_result_stories')
          .update(payload)
          .eq('id', storyId)
          .eq('coach_id', coachId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('client_result_stories')
          .insert(payload)
          .select('id')
          .single();
        if (error) throw error;
        sid = data?.id;
        if (!sid) throw new Error('Create failed');
      }

      let beforePath = story?.before_image_path ?? null;
      let afterPath = story?.after_image_path ?? null;

      if (beforeFile && sid) {
        const path = await uploadResultStoryImage({ coachId, storyId: sid, file: beforeFile, slot: 'before' });
        if (path) beforePath = path;
      }
      if (afterFile && sid) {
        const path = await uploadResultStoryImage({ coachId, storyId: sid, file: afterFile, slot: 'after' });
        if (path) afterPath = path;
      }

      if (beforePath !== undefined || afterPath !== undefined) {
        const { error } = await supabase
          .from('client_result_stories')
          .update({
            before_image_path: beforePath ?? undefined,
            after_image_path: afterPath ?? undefined,
          })
          .eq('id', sid)
          .eq('coach_id', coachId);
        if (error) throw error;
      }

      await supabase.from('result_story_metrics').delete().eq('story_id', sid);
      const metricsToInsert = metrics
        .filter((m) => (m.label?.trim() || m.value?.trim()))
        .map((m, i) => ({
          story_id: sid,
          metric_key: m.key || `m${i}`,
          metric_label: m.label?.trim() || 'Metric',
          metric_value: m.value?.trim() || '—',
          sort_order: i,
        }));
      if (metricsToInsert.length > 0) {
        const { error } = await supabase.from('result_story_metrics').insert(metricsToInsert);
        if (error) throw error;
      }

      return sid;
    },
    onSuccess: (sid) => {
      toast.success(isEdit ? 'Story updated' : 'Story created');
      queryClient.invalidateQueries({ queryKey: ['result_story', sid] });
      queryClient.invalidateQueries({ queryKey: ['result_story_metrics', sid] });
      queryClient.invalidateQueries({ queryKey: ['public-coach-profile'] });
      if (!isEdit) navigate(-1);
    },
    onError: (err) => {
      toast.error(err?.message ?? 'Save failed');
    },
  });

  const handleSave = () => {
    if (!title.trim()) {
      toast.error('Enter a title');
      return;
    }
    saveMutation.mutate();
  };

  if (!coachId) {
    return (
      <div className="min-h-screen" style={{ background: colors.bg }}>
        <TopBar title="Result story" onBack={() => navigate(-1)} />
        <div className="p-4" style={{ color: colors.muted }}>
          Sign in as a coach to create result stories.
        </div>
      </div>
    );
  }

  if (isEdit && loadingStory) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: colors.bg }}>
        <Loader2 className="animate-spin" size={32} style={{ color: colors.muted }} />
      </div>
    );
  }

  if (isEdit && storyId && !story) {
    return (
      <div className="min-h-screen" style={{ background: colors.bg }}>
        <TopBar title="Result story" onBack={() => navigate(-1)} />
        <div className="p-4" style={{ color: colors.muted }}>
          Story not found or you don’t have access.
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: colors.bg, paddingBottom: spacing[24] }}>
      <TopBar
        title={isEdit ? 'Edit result story' : 'New result story'}
        onBack={() => navigate(-1)}
        rightAction={
          <button
            type="button"
            onClick={handleSave}
            disabled={saveMutation.isPending}
            className="text-sm font-semibold"
            style={{ color: colors.primary }}
          >
            {saveMutation.isPending ? 'Saving…' : 'Save'}
          </button>
        }
      />

      <div className="px-4 space-y-6" style={{ paddingTop: spacing[16] }}>
        <Card style={{ padding: spacing[16] }}>
          <label className="block text-sm font-medium mb-2" style={{ color: colors.textSecondary }}>
            Title
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. 12-week transformation"
            className="w-full rounded-lg border px-3 py-2 text-sm"
            style={{ background: colors.surface2, borderColor: colors.border, color: colors.text }}
          />
        </Card>

        <Card style={{ padding: spacing[16] }}>
          <label className="block text-sm font-medium mb-2" style={{ color: colors.textSecondary }}>
            Story type
          </label>
          <div className="flex gap-2">
            {getStoryTypesForFocus(coachFocus).map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => setStoryType(t.value)}
                className="flex-1 rounded-lg border px-3 py-2 text-sm font-medium"
                style={{
                  background: storyType === t.value ? colors.primarySubtle : colors.surface2,
                  borderColor: storyType === t.value ? colors.primary : colors.border,
                  color: storyType === t.value ? colors.accent : colors.text,
                }}
              >
                {t.label}
              </button>
            ))}
          </div>
        </Card>

        <Card style={{ padding: spacing[16] }}>
          <label className="block text-sm font-medium mb-2" style={{ color: colors.textSecondary }}>
            Summary
          </label>
          <textarea
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            placeholder="Short description of the journey or result."
            rows={3}
            className="w-full rounded-lg border px-3 py-2 text-sm resize-none"
            style={{ background: colors.surface2, borderColor: colors.border, color: colors.text }}
          />
        </Card>

        <Card style={{ padding: spacing[16] }}>
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium" style={{ color: colors.textSecondary }}>
              Visibility
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={isPublic}
              onClick={() => setIsPublic((p) => !p)}
              className="relative w-11 h-6 rounded-full transition-colors"
              style={{
                background: isPublic ? colors.primary : colors.surface2,
              }}
            >
              <span
                className="absolute top-1 w-4 h-4 rounded-full bg-white transition-transform"
                style={{ left: isPublic ? 22 : 4, top: 4 }}
              />
            </button>
          </div>
          <p className="text-xs flex items-center gap-2" style={{ color: colors.muted }}>
            {isPublic ? <Eye size={14} /> : <EyeOff size={14} />}
            {isPublic ? 'Visible on your public profile' : 'Only you can see this story'}
          </p>
        </Card>

        <Card style={{ padding: spacing[16] }}>
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: colors.text }}>
            <Trophy size={16} /> Before / After images
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: colors.muted }}>
                Before
              </label>
              <label className="block aspect-[3/4] rounded-lg border-2 border-dashed cursor-pointer overflow-hidden" style={{ borderColor: colors.border, background: colors.surface2 }}>
                {beforePreview ? (
                  <img src={beforePreview} alt="Before" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center">
                    <ImagePlus size={28} style={{ color: colors.muted }} />
                    <span className="text-xs mt-1" style={{ color: colors.muted }}>Add photo</span>
                  </div>
                )}
                <input type="file" accept="image/*" className="hidden" onChange={handleBeforeFile} />
              </label>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: colors.muted }}>
                After
              </label>
              <label className="block aspect-[3/4] rounded-lg border-2 border-dashed cursor-pointer overflow-hidden" style={{ borderColor: colors.border, background: colors.surface2 }}>
                {afterPreview ? (
                  <img src={afterPreview} alt="After" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center">
                    <ImagePlus size={28} style={{ color: colors.muted }} />
                    <span className="text-xs mt-1" style={{ color: colors.muted }}>Add photo</span>
                  </div>
                )}
                <input type="file" accept="image/*" className="hidden" onChange={handleAfterFile} />
              </label>
            </div>
          </div>
        </Card>

        <Card style={{ padding: spacing[16] }}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold" style={{ color: colors.text }}>
              Key metrics
            </h3>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={addPresetMetrics}
                className="text-xs px-2 py-1 rounded border"
                style={{ borderColor: colors.border, color: colors.textSecondary }}
              >
                Add presets
              </button>
              <button
                type="button"
                onClick={addMetric}
                className="flex items-center gap-1 text-xs px-2 py-1 rounded border"
                style={{ borderColor: colors.border, color: colors.primary }}
              >
                <Plus size={14} /> Add
              </button>
            </div>
          </div>
          <p className="text-xs mb-3" style={{ color: colors.muted }}>
            {getMetricsHint(coachFocus, storyType)}
          </p>
          {metrics.map((metric, index) => (
            <MetricRow
              key={metric.key || index}
              metric={metric}
              onChange={(m) => setMetric(index, m)}
              onRemove={() => removeMetric(index)}
            />
          ))}
          {metrics.length === 0 && (
            <p className="text-sm py-2" style={{ color: colors.muted }}>
              Tap “Add presets” or “Add” to add metrics.
            </p>
          )}
        </Card>

        <Button onClick={handleSave} disabled={saveMutation.isPending} className="w-full">
          {saveMutation.isPending ? 'Saving…' : isEdit ? 'Update story' : 'Create story'}
        </Button>
      </div>
    </div>
  );
}
