import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getSupabase, hasSupabase } from '@/lib/supabaseClient';
import Card from '@/ui/Card';
import Button from '@/ui/Button';
import { colors, spacing, shell } from '@/ui/tokens';
import { ClientListSkeleton } from '@/components/ui/LoadingState';
import LoadErrorFallback from '@/components/ui/LoadErrorFallback';
import { getResultStoryImageUrl } from '@/lib/resultStories';
import { copyLinkToClipboard, getResultStoryUrl, shareNative, buildTwitterShareUrl, buildWhatsAppShareUrl, buildInstagramShareHint, openShareWindow } from '@/lib/socialSharing';

function MetricPill({ label, value }) {
  if (!label && !value) return null;
  return (
    <span
      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
      style={{
        background: colors.surface2,
        color: colors.text,
        border: `1px solid ${colors.border}`,
      }}
    >
      {label && <span style={{ opacity: 0.8 }}>{label}</span>}
      {label && value ? <span style={{ margin: '0 4px' }}>·</span> : null}
      {value && <span>{value}</span>}
    </span>
  );
}

export default function PublicResultStoryPage() {
  const { storySlug } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [story, setStory] = useState(null);
  const [metrics, setMetrics] = useState([]);
  const [coach, setCoach] = useState(null);
  const [beforeUrl, setBeforeUrl] = useState(null);
  const [afterUrl, setAfterUrl] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);
  const [copySuccess, setCopySuccess] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!storySlug) {
        setErrorMessage('Missing result slug.');
        setLoading(false);
        return;
      }
      if (!hasSupabase) {
        setErrorMessage('Public result stories are not available (Supabase not configured).');
        setLoading(false);
        return;
      }
      const supabase = getSupabase();
      if (!supabase) {
        setErrorMessage('Unable to load result story right now.');
        setLoading(false);
        return;
      }

      try {
        const { data: storyRow, error: storyError } = await supabase
          .from('client_result_stories')
          .select('*')
          .eq('slug', storySlug)
          .eq('is_public', true)
          .maybeSingle();

        if (storyError || !storyRow) {
          setErrorMessage('This result story could not be found.');
          setLoading(false);
          return;
        }

        if (cancelled) return;
        setStory(storyRow);

        const [metricsRes, coachRes] = await Promise.all([
          supabase
            .from('result_story_metrics')
            .select('*')
            .eq('story_id', storyRow.id)
            .order('sort_order', { ascending: true }),
          storyRow.coach_id
            ? supabase
                .from('profiles')
                .select('id, full_name, coach_focus, avatar_url, bio')
                .eq('id', storyRow.coach_id)
                .maybeSingle()
            : Promise.resolve({ data: null, error: null }),
        ]);

        if (cancelled) return;

        const metricRows = Array.isArray(metricsRes.data) ? metricsRes.data : [];
        setMetrics(
          metricRows.map((m) => ({
            key: m.metric_key,
            label: m.metric_label,
            value: m.metric_value,
          }))
        );
        setCoach(coachRes.data || null);

        if (storyRow.before_image_path) {
          const url = await getResultStoryImageUrl(storyRow.before_image_path);
          if (!cancelled) setBeforeUrl(url);
        }
        if (storyRow.after_image_path) {
          const url = await getResultStoryImageUrl(storyRow.after_image_path);
          if (!cancelled) setAfterUrl(url);
        }
      } catch (e) {
        if (!cancelled) {
          setErrorMessage(e?.message || 'Failed to load result story.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [storySlug]);

  if (loading) {
    return (
      <div className="min-h-screen" style={{ background: colors.bgPrimary, padding: spacing[16] }}>
        <ClientListSkeleton />
      </div>
    );
  }

  if (!story || errorMessage) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: colors.bgPrimary, padding: spacing[16] }}>
        <div style={{ maxWidth: 480, width: '100%' }}>
          <LoadErrorFallback
            title="Result not available"
            description={errorMessage || 'This result story is no longer available.'}
            onRetry={() => window.location.reload()}
            showGoHome={false}
          />
          <div className="mt-4 flex justify-center">
            <Button variant="secondary" onClick={() => navigate('/')}>
              Go to Atlas
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const coachName = coach?.full_name || 'Coach';
  const storyTitle = story.title || 'Result story';
  const summary = story.summary || '';
  const shareUrl = getResultStoryUrl(story.slug || storySlug);

  const handleCopyLink = async () => {
    const ok = await copyLinkToClipboard(shareUrl);
    if (ok) {
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    }
  };

  const handleShareNativeOrTwitter = async () => {
    const usedNative = await shareNative({ title: storyTitle, text: summary, url: shareUrl });
    if (!usedNative) {
      const url = buildTwitterShareUrl({ text: storyTitle, url: shareUrl });
      openShareWindow(url);
    }
  };

  const handleShareWhatsApp = () => {
    const url = buildWhatsAppShareUrl({ text: storyTitle, url: shareUrl });
    openShareWindow(url);
  };

  const handleShareInstagram = async () => {
    const hint = buildInstagramShareHint({ url: shareUrl });
    const ok = await copyLinkToClipboard(hint);
    if (ok) {
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    }
  };

  return (
    <div
      className="min-h-screen"
      style={{
        background: colors.bgPrimary,
        padding: spacing[16],
        paddingTop: `calc(${spacing[24]} + env(safe-area-inset-top, 0px))`,
        paddingBottom: `calc(${spacing[24]} + env(safe-area-inset-bottom, 0px))`,
      }}
    >
      <div className="max-w-xl mx-auto space-y-4">
        <Card
          style={{
            padding: spacing[16],
            background: colors.surface,
            borderRadius: shell.cardRadius,
          }}
        >
          <p className="text-xs mb-1 uppercase tracking-wide" style={{ color: colors.muted }}>
            Result story
          </p>
          <h1 className="text-xl font-semibold mb-2" style={{ color: colors.text }}>
            {storyTitle}
          </h1>
          {summary && (
            <p className="text-sm mb-3 whitespace-pre-wrap" style={{ color: colors.muted }}>
              {summary}
            </p>
          )}
          {metrics.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {metrics.map((m) => (
                <MetricPill key={m.key} label={m.label} value={m.value} />
              ))}
            </div>
          )}
        </Card>

        <Card
          style={{
            padding: spacing[16],
            background: colors.surface,
            borderRadius: shell.cardRadius,
          }}
        >
          <p className="text-xs mb-1 uppercase tracking-wide" style={{ color: colors.muted }}>
            Coach
          </p>
          <div className="flex items-center gap-3">
            <div
              className="rounded-full flex items-center justify-center"
              style={{
                width: 40,
                height: 40,
                background: colors.surface2,
                overflow: 'hidden',
              }}
            >
              {coach?.avatar_url ? (
                <img src={coach.avatar_url} alt={coachName} className="w-full h-full object-cover" />
              ) : (
                <span className="text-sm font-semibold" style={{ color: colors.text }}>
                  {coachName
                    .split(' ')
                    .map((p) => p[0])
                    .join('')
                    .slice(0, 2)
                    .toUpperCase()}
                </span>
              )}
            </div>
            <div>
              <p className="text-sm font-semibold" style={{ color: colors.text }}>
                {coachName}
              </p>
              {coach?.coach_focus && (
                <p className="text-xs" style={{ color: colors.muted }}>
                  {coach.coach_focus === 'competition'
                    ? 'Competition / Prep coach'
                    : coach.coach_focus === 'integrated'
                      ? 'Transformation & Competition coach'
                      : 'Transformation coach'}
                </p>
              )}
            </div>
          </div>
          {coach?.bio && (
            <p className="text-xs mt-3 whitespace-pre-wrap" style={{ color: colors.muted }}>
              {coach.bio}
            </p>
          )}
        </Card>

        {(beforeUrl || afterUrl) && (
          <Card
            style={{
              padding: spacing[12],
              background: colors.surface,
              borderRadius: shell.cardRadius,
            }}
          >
            <p className="text-xs mb-2 uppercase tracking-wide" style={{ color: colors.muted }}>
              Journey timeline
            </p>
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-lg overflow-hidden aspect-[3/4]" style={{ background: colors.surface2 }}>
                {beforeUrl ? (
                  <img src={beforeUrl} alt="Before" className="w-full h-full object-cover" />
                ) : null}
              </div>
              <div className="rounded-lg overflow-hidden aspect-[3/4]" style={{ background: colors.surface2 }}>
                {afterUrl ? (
                  <img src={afterUrl} alt="After" className="w-full h-full object-cover" />
                ) : null}
              </div>
            </div>
          </Card>
        )}

        <Card
          style={{
            padding: spacing[16],
            background: colors.surface,
            borderRadius: shell.cardRadius,
          }}
        >
          <h2 className="text-base font-semibold mb-2" style={{ color: colors.text }}>
            Share this result
          </h2>
          <p className="text-xs mb-3" style={{ color: colors.muted }}>
            Share this story with friends or on social to celebrate the journey.
          </p>
          <div className="flex flex-col sm:flex-row flex-wrap gap-2 mb-2">
            <Button variant="secondary" className="w-full sm:w-auto" onClick={handleCopyLink}>
              {copySuccess ? 'Link copied' : 'Copy link'}
            </Button>
            <Button variant="secondary" className="w-full sm:w-auto" onClick={handleShareInstagram}>
              Share to Instagram
            </Button>
            <Button variant="secondary" className="w-full sm:w-auto" onClick={handleShareWhatsApp}>
              Share to WhatsApp
            </Button>
            <Button variant="secondary" className="w-full sm:w-auto" onClick={handleShareNativeOrTwitter}>
              Share to Twitter
            </Button>
          </div>
        </Card>

        <Card
          style={{
            padding: spacing[16],
            background: colors.surface,
            borderRadius: shell.cardRadius,
          }}
        >
          <h2 className="text-base font-semibold mb-1" style={{ color: colors.text }}>
            Start your journey
          </h2>
          <p className="text-sm mb-3" style={{ color: colors.muted }}>
            Ready to build your own story like this? Start your journey with Atlas and a coach who specialises in results like these.
          </p>
          <div className="flex flex-col sm:flex-row gap-2">
            <Button
              variant="primary"
              className="w-full"
              onClick={() => navigate('/auth')}
            >
              Join Atlas
            </Button>
            <Button
              variant="secondary"
              className="w-full"
              onClick={() => navigate('/marketplace')}
            >
              Explore coaches
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}

