/**
 * Pose Timeline: compare conditioning across prep weeks by pose.
 * Coach view for prep clients. Uses v_pose_progression.
 * Pose selector at top; timeline gallery by week (16, 12, 8, 6, 4); click opens comparison viewer.
 */
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import TopBar from '@/components/ui/TopBar';
import Card from '@/ui/Card';
import { colors, spacing, shell, radii } from '@/ui/tokens';
import { hasSupabase, getSupabase } from '@/lib/supabaseClient';
import { createPoseCheckPhotoSignedUrl } from '@/lib/poseChecks';
import EmptyState from '@/components/ui/EmptyState';
import { ImageIcon } from 'lucide-react';

/** Fetch pose progression for a client (v_pose_progression, order by pose_key, submitted_at). */
async function fetchPoseProgression(supabase, clientId) {
  if (!supabase || !clientId) return [];
  const { data, error } = await supabase
    .from('v_pose_progression')
    .select('client_id, pose_key, pose_label, pose_check_id, submitted_at, week_out, photo_path')
    .eq('client_id', clientId)
    .order('pose_key', { ascending: true })
    .order('submitted_at', { ascending: true });
  if (error) return [];
  return Array.isArray(data) ? data : [];
}

export default function PoseTimelinePage() {
  const navigate = useNavigate();
  const { id: clientId } = useParams();
  const [selectedPoseKey, setSelectedPoseKey] = useState(null);
  const [urlByPath, setUrlByPath] = useState({});
  const [comparisonItem, setComparisonItem] = useState(null);

  const supabase = hasSupabase ? getSupabase() : null;
  const { data: progression = [], isLoading } = useQuery({
    queryKey: ['v_pose_progression', clientId],
    queryFn: () => fetchPoseProgression(supabase, clientId),
    enabled: !!supabase && !!clientId,
  });

  const poses = useMemo(() => {
    const seen = new Set();
    const list = [];
    for (const row of progression) {
      if (row.pose_key && !seen.has(row.pose_key)) {
        seen.add(row.pose_key);
        list.push({ pose_key: row.pose_key, pose_label: row.pose_label || row.pose_key });
      }
    }
    return list;
  }, [progression]);

  useEffect(() => {
    if (poses.length > 0 && selectedPoseKey === null) setSelectedPoseKey(poses[0].pose_key);
  }, [poses, selectedPoseKey]);

  const filteredByPose = useMemo(() => {
    if (!selectedPoseKey) return [];
    return progression.filter((r) => r.pose_key === selectedPoseKey);
  }, [progression, selectedPoseKey]);

  const byWeek = useMemo(() => {
    const map = {};
    for (const row of filteredByPose) {
      const w = row.week_out != null ? Number(row.week_out) : null;
      if (w == null) continue;
      if (!map[w]) map[w] = [];
      map[w].push(row);
    }
    const weeks = Object.keys(map).map(Number).sort((a, b) => b - a);
    return { weeks, map };
  }, [filteredByPose]);

  useEffect(() => {
    if (filteredByPose.length === 0) return;
    let cancelled = false;
    const paths = [...new Set(filteredByPose.map((r) => r.photo_path).filter(Boolean))];
    (async () => {
      const next = {};
      for (const path of paths) {
        if (cancelled) break;
        const url = await createPoseCheckPhotoSignedUrl(path);
        if (url) next[path] = url;
      }
      if (!cancelled) setUrlByPath((prev) => ({ ...prev, ...next }));
    })();
    return () => { cancelled = true; };
  }, [filteredByPose]);

  if (!clientId) {
    return (
      <div className="min-h-screen" style={{ background: colors.bg, color: colors.text }}>
        <TopBar title="Pose Timeline" onBack={() => navigate(-1)} />
        <div className="p-4">
          <p style={{ color: colors.muted }}>Client not found.</p>
          <button type="button" onClick={() => navigate(-1)} className="mt-2 text-sm" style={{ color: colors.primary }}>Go back</button>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen" style={{ background: colors.bg, color: colors.text }}>
        <TopBar title="Pose Timeline" onBack={() => navigate(-1)} />
        <div className="p-4 flex items-center justify-center" style={{ minHeight: 200 }}>
          <p style={{ color: colors.muted }}>Loading…</p>
        </div>
      </div>
    );
  }

  const selectedLabel = poses.find((p) => p.pose_key === selectedPoseKey)?.pose_label || selectedPoseKey;

  return (
    <div className="min-h-screen" style={{ background: colors.bg, color: colors.text, paddingBottom: 96 }}>
      <TopBar title="Pose Timeline" onBack={() => navigate(-1)} />
      <div className="p-4">
        {poses.length === 0 ? (
          <EmptyState
            title="No pose progression yet"
            description="Pose check submissions will appear here. Have your client submit pose checks during prep to compare conditioning over time."
            icon={ImageIcon}
            actionLabel="Back to client"
            onAction={() => navigate(`/clients/${clientId}`)}
          />
        ) : (
          <>
            {/* Pose selector */}
            <section style={{ marginBottom: spacing[20] }}>
              <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: colors.muted }}>Pose</p>
              <div className="flex flex-wrap gap-2">
                {poses.map(({ pose_key, pose_label }) => (
                  <button
                    key={pose_key}
                    type="button"
                    onClick={() => setSelectedPoseKey(pose_key)}
                    style={{
                      padding: `${spacing[8]}px ${spacing[12]}px`,
                      borderRadius: shell.cardRadius ?? 8,
                      fontSize: 13,
                      fontWeight: 500,
                      border: `1px solid ${selectedPoseKey === pose_key ? colors.primary : colors.border}`,
                      background: selectedPoseKey === pose_key ? colors.primarySubtle : 'transparent',
                      color: selectedPoseKey === pose_key ? colors.primary : colors.text,
                      cursor: 'pointer',
                    }}
                  >
                    {pose_label}
                  </button>
                ))}
              </div>
            </section>

            {/* Timeline gallery by week */}
            <section>
              <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: colors.muted }}>Timeline — {selectedLabel}</p>
              {byWeek.weeks.length === 0 ? (
                <p className="text-sm" style={{ color: colors.muted }}>No submissions for this pose yet.</p>
              ) : (
                <div className="space-y-6">
                  {byWeek.weeks.map((week) => {
                    const rows = byWeek.map[week] || [];
                    return (
                      <div key={week}>
                        <p className="text-sm font-medium mb-2" style={{ color: colors.text }}>Week {week}</p>
                        <div className="flex flex-wrap gap-3">
                          {rows.map((r, i) => {
                            const url = r.photo_path ? urlByPath[r.photo_path] : null;
                            return (
                              <Card
                                key={r.pose_check_id + (r.submitted_at || '') + i}
                                style={{
                                  padding: 0,
                                  overflow: 'hidden',
                                  width: 140,
                                  height: 180,
                                  cursor: url ? 'pointer' : 'default',
                                  border: `1px solid ${colors.border}`,
                                  borderRadius: shell.cardRadius ?? 8,
                                }}
                                onClick={() => url && setComparisonItem({ ...r, imageUrl: url })}
                              >
                                {url ? (
                                  <img
                                    src={url}
                                    alt={`${selectedLabel} — Week ${week}`}
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center" style={{ background: colors.surface2, color: colors.muted }}>
                                    <ImageIcon size={32} />
                                  </div>
                                )}
                              </Card>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </>
        )}
      </div>

      {/* Comparison viewer modal */}
      {comparisonItem && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Pose comparison viewer"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 100,
            background: colors.overlay,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: spacing[16],
          }}
          onClick={() => setComparisonItem(null)}
        >
          <div
            style={{
              maxWidth: '100%',
              maxHeight: '100%',
              background: colors.surface1,
              borderRadius: radii.md,
              overflow: 'hidden',
              boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-3 py-2" style={{ borderBottom: `1px solid ${colors.border}` }}>
              <span className="text-sm font-medium" style={{ color: colors.text }}>
                {comparisonItem.pose_label} — Week {comparisonItem.week_out}
              </span>
              <button
                type="button"
                onClick={() => setComparisonItem(null)}
                className="px-3 py-1.5 text-sm rounded"
                style={{ background: colors.surface2, color: colors.text, border: 'none', cursor: 'pointer' }}
              >
                Close
              </button>
            </div>
            <img
              src={comparisonItem.imageUrl}
              alt={comparisonItem.pose_label}
              style={{ display: 'block', maxWidth: '100%', maxHeight: '80vh', objectFit: 'contain' }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
