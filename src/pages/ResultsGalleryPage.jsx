import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Share as ShareIcon, Download } from 'lucide-react';
import TopBar from '@/components/ui/TopBar';
import Card from '@/ui/Card';
import { Button } from '@/components/ui/button';
import { colors, spacing } from '@/ui/tokens';
import { hasSupabase, getSupabase } from '@/lib/supabaseClient';
import { useAuth } from '@/lib/AuthContext';
import { getCoachClientJoinLinkPrimary } from '@/lib/referrals';

const DARK_BG = '#0f172a';

function generateResultCard(client, startWeight, currentWeight, startDate, programName) {
  const weeksDiff = Math.round((new Date() - new Date(startDate)) / (7 * 24 * 60 * 60 * 1000));
  const rawChange = currentWeight - startWeight;
  const change = rawChange.toFixed(1);
  return {
    clientFirstName: (client?.name || client?.full_name || 'Client').split(' ')[0],
    change: `${rawChange > 0 ? '+' : ''}${change}kg`,
    timeframe: `${weeksDiff} weeks`,
    programName,
    direction: rawChange < 0 ? 'lost' : 'gained',
  };
}

async function shareStory(text) {
  try {
    const { Capacitor } = await import('@capacitor/core');
    if (Capacitor.isNativePlatform()) {
      const { Share } = await import('@capacitor/share');
      await Share.share({ title: 'Atlas result story', text });
      return;
    }
    await navigator.clipboard.writeText(text);
  } catch {
    // noop
  }
}

function downloadCanvasCard(card) {
  const canvas = document.createElement('canvas');
  canvas.width = 1080;
  canvas.height = 1080;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.fillStyle = DARK_BG;
  ctx.fillRect(0, 0, 1080, 1080);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 44px Inter, sans-serif';
  ctx.fillText('Atlas', 70, 110);
  ctx.font = 'bold 130px Inter, sans-serif';
  ctx.fillText(card.change, 70, 500);
  ctx.font = '46px Inter, sans-serif';
  ctx.fillText(`${card.timeframe} · Transformation coaching`, 70, 590);
  ctx.font = '30px Inter, sans-serif';
  ctx.fillText('Atlas Performance Labs', 670, 980);

  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `atlas-result-${card.clientFirstName.toLowerCase()}.png`;
    a.click();
    URL.revokeObjectURL(url);
  }, 'image/png');
}

export default function ResultsGalleryPage() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const supabase = hasSupabase ? getSupabase() : null;

  const { data: cards = [], isLoading } = useQuery({
    queryKey: ['results-gallery', user?.id],
    queryFn: async () => {
      if (!supabase || !user?.id) return [];
      const { data: clients } = await supabase
        .from('clients')
        .select('id, name, full_name')
        .or(`coach_id.eq.${user.id},trainer_id.eq.${user.id}`);

      const out = [];
      for (const c of clients || []) {
        const [photosRes, weightsRes, workoutCountRes] = await Promise.all([
          supabase
            .from('progress_photos')
            .select('captured_at, created_at')
            .eq('client_id', c.id)
            .eq('is_deleted', false)
            .order('captured_at', { ascending: true }),
          supabase
            .from('client_weight_logs')
            .select('weight, log_date')
            .eq('client_id', c.id)
            .order('log_date', { ascending: true }),
          supabase
            .from('workout_sessions')
            .select('id', { head: true, count: 'exact' })
            .eq('client_id', c.id)
            .eq('status', 'completed'),
        ]);

        const photos = photosRes.data || [];
        const weights = weightsRes.data || [];
        const workoutCount = workoutCountRes.count || 0;
        if (photos.length < 2 || weights.length < 2 || workoutCount < 10) continue;

        const firstPhotoAt = photos[0]?.captured_at || photos[0]?.created_at;
        const lastPhotoAt = photos[photos.length - 1]?.captured_at || photos[photos.length - 1]?.created_at;
        const weeksApart = Math.abs(new Date(lastPhotoAt).getTime() - new Date(firstPhotoAt).getTime()) / (7 * 24 * 60 * 60 * 1000);
        if (weeksApart < 8) continue;

        const startWeight = Number(weights[0]?.weight);
        const currentWeight = Number(weights[weights.length - 1]?.weight);
        if (!Number.isFinite(startWeight) || !Number.isFinite(currentWeight)) continue;
        if (Math.abs(currentWeight - startWeight) < 3) continue;

        out.push(
          generateResultCard(c, startWeight, currentWeight, firstPhotoAt, 'Transformation coaching')
        );
      }
      return out;
    },
    enabled: Boolean(supabase && user?.id),
  });

  const referral = useMemo(
    () => getCoachClientJoinLinkPrimary(profile?.referral_code, user?.id) || 'https://atlasperformancelabs.app',
    [profile?.referral_code, user?.id]
  );

  return (
    <div className="min-h-screen" style={{ background: colors.bg, color: colors.text }}>
      <TopBar title="Results gallery" onBack={() => navigate(-1)} />
      <div style={{ padding: spacing[16], maxWidth: 1080, margin: '0 auto' }}>
        {isLoading ? (
          <Card style={{ padding: spacing[16] }}>Loading result stories...</Card>
        ) : cards.length === 0 ? (
          <Card style={{ padding: spacing[16] }}>No eligible result stories yet.</Card>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: spacing[10] }}>
            {cards.map((card, idx) => (
              <Card key={`${card.clientFirstName}-${idx}`} style={{ padding: spacing[14] }}>
                <p className="text-sm" style={{ color: colors.muted, marginBottom: spacing[8] }}>{card.clientFirstName}</p>
                <p className="text-lg font-semibold" style={{ color: colors.text }}>
                  {card.change} in {card.timeframe}
                </p>
                <p className="text-xs" style={{ color: colors.muted }}>{card.programName}</p>
                <div className="flex gap-2 mt-3">
                  <Button
                    onClick={() =>
                      shareStory(
                        `Another transformation result with Atlas.\n${card.clientFirstName}: ${card.change} in ${card.timeframe}.\nWant results like this? ${referral}`
                      )
                    }
                  >
                    <ShareIcon size={14} style={{ marginRight: 6 }} />
                    Share
                  </Button>
                  <Button variant="outline" onClick={() => downloadCanvasCard(card)}>
                    <Download size={14} style={{ marginRight: 6 }} />
                    Download card
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
