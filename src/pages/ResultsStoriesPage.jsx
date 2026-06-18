import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import TopBar from '@/components/ui/TopBar';
import Card from '@/ui/Card';
import { colors, spacing, shell } from '@/ui/tokens';
import { getSupabase, hasSupabase } from '@/lib/supabaseClient';
import { useAuth } from '@/lib/AuthContext';

const PAGE_PADDING = { paddingLeft: shell.pagePaddingH, paddingRight: shell.pagePaddingH };

function toWeeks(startIso, endIso) {
  const a = new Date(startIso).getTime();
  const b = new Date(endIso).getTime();
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0;
  return Math.max(0, Math.round((b - a) / (86400000 * 7)));
}

export default function ResultsStoriesPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const sb = hasSupabase ? getSupabase() : null;
  const [loading, setLoading] = useState(true);
  const [stories, setStories] = useState([]);

  useEffect(() => {
    const run = async () => {
      if (!sb || !user?.id) return;
      setLoading(true);
      const { data: clients } = await sb.from('clients').select('id, name').or(`coach_id.eq.${user.id},trainer_id.eq.${user.id}`);
      const rows = [];
      for (const c of clients || []) {
        const [weightsRes, workoutRes, programRes] = await Promise.all([
          sb.from('client_weight_logs').select('weight_kg, logged_at').eq('client_id', c.id).order('logged_at', { ascending: true }),
          sb.from('workout_sessions').select('id', { head: true, count: 'exact' }).eq('client_id', c.id).eq('status', 'completed'),
          sb.from('program_block_assignments').select('program_block_id, program_blocks(title)').eq('client_id', c.id).eq('is_active', true).maybeSingle(),
        ]);
        const weights = Array.isArray(weightsRes.data) ? weightsRes.data.filter((x) => Number.isFinite(Number(x.weight_kg))) : [];
        if (weights.length < 2) continue;
        const first = weights[0];
        const last = weights[weights.length - 1];
        const weeks = toWeeks(first.logged_at, last.logged_at);
        const delta = Number(last.weight_kg) - Number(first.weight_kg);
        if (weeks < 8 || Math.abs(delta) < 3 || Number(workoutRes.count || 0) < 10) continue;
        rows.push({
          clientId: c.id,
          clientName: String(c.name || 'Client').split(' ')[0],
          startDate: first.logged_at,
          endDate: last.logged_at,
          changeKg: delta,
          weeks,
          workoutsCompleted: Number(workoutRes.count || 0),
          programType: programRes.data?.program_blocks?.title || 'Atlas Program',
        });
      }
      setStories(rows);
      setLoading(false);
    };
    run();
  }, [user?.id]);

  const sortedStories = useMemo(
    () => [...stories].sort((a, b) => Math.abs(b.changeKg) - Math.abs(a.changeKg)),
    [stories]
  );

  const shareStoryImage = (story) => {
    const canvas = document.createElement('canvas');
    canvas.width = 1080;
    canvas.height = 1350;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#0b1220';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#2563eb';
    ctx.fillRect(60, 60, canvas.width - 120, canvas.height - 120);
    ctx.fillStyle = '#dbeafe';
    ctx.font = '600 32px Inter, sans-serif';
    ctx.fillText('TRANSFORMATION', 120, 160);
    ctx.fillStyle = '#ffffff';
    ctx.font = '700 66px Inter, sans-serif';
    ctx.fillText(`${story.clientName}'s Result`, 120, 270);
    ctx.font = '700 164px Inter, sans-serif';
    ctx.fillText(`${story.changeKg > 0 ? '+' : ''}${story.changeKg.toFixed(1)}kg`, 120, 500);
    ctx.font = '600 54px Inter, sans-serif';
    ctx.fillText(`${story.weeks} weeks`, 120, 590);
    ctx.font = '500 36px Inter, sans-serif';
    ctx.fillText('Coached with Atlas', 120, 1210);
    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/png');
    a.download = `atlas-result-${story.clientName.toLowerCase()}.png`;
    a.click();
  };

  return (
    <div style={{ minHeight: '100vh', background: colors.bg, color: colors.text }}>
      <TopBar title="Result stories" onBack={() => navigate(-1)} />
      <div style={{ ...PAGE_PADDING, paddingTop: spacing[16], paddingBottom: spacing[24] }}>
        {loading ? <p style={{ color: colors.muted }}>Loading stories…</p> : null}
        {!loading && sortedStories.length === 0 ? (
          <Card style={{ padding: spacing[14] }}>
            <p style={{ margin: 0, color: colors.muted, fontSize: 13 }}>
              No eligible stories yet. A card appears when a client has photos 8+ weeks apart, 3kg+ weight change, and 10+ workouts.
            </p>
          </Card>
        ) : null}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: spacing[10] }}>
          {sortedStories.map((story) => (
            <Card key={`${story.clientId}-${story.endDate}`} style={{ padding: spacing[12] }}>
              <p style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>{story.clientName}</p>
              <p style={{ margin: `${spacing[4]}px 0 0`, fontSize: 12, color: colors.muted }}>
                {new Date(story.startDate).toLocaleDateString()} → {new Date(story.endDate).toLocaleDateString()}
              </p>
              <p style={{ margin: `${spacing[8]}px 0 0`, fontSize: 14, color: colors.text }}>
                {story.changeKg < 0 ? `Down ${Math.abs(story.changeKg).toFixed(1)}kg` : `Up ${story.changeKg.toFixed(1)}kg`} in {story.weeks} weeks
              </p>
              <p style={{ margin: `${spacing[4]}px 0 0`, fontSize: 12, color: colors.muted }}>
                {story.workoutsCompleted} workouts · {story.programType}
              </p>
              <div style={{ display: 'flex', gap: 8, marginTop: spacing[10] }}>
                <button type="button" onClick={() => shareStoryImage(story)} style={{ flex: 1, minHeight: 40, borderRadius: 10, border: 'none', background: colors.primary, color: '#fff', fontWeight: 700 }}>
                  Share
                </button>
                <button type="button" onClick={() => navigate(`/clients/${story.clientId}`)} style={{ flex: 1, minHeight: 40, borderRadius: 10, border: `1px solid ${colors.border}`, background: colors.surface2, color: colors.text }}>
                  Open client
                </button>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
