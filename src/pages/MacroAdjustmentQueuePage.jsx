import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import TopBar from '@/components/ui/TopBar';
import Card from '@/ui/Card';
import { Button } from '@/components/ui/button';
import { colors, spacing } from '@/ui/tokens';
import { hasSupabase, getSupabase } from '@/lib/supabaseClient';
import { useAuth } from '@/lib/AuthContext';
import { getMacroDraftQueue } from '@/lib/macroDraftQueue';
import { toast } from 'sonner';

const DISMISS_PREFIX = 'atlas_macro_queue_dismiss_until_';

function reasonLine(item) {
  const c = item?.client || {};
  const s = item?.suggestion || {};
  const name = (c.full_name || c.name || 'Client').split(' ')[0];
  const cal = Number(s.suggestedCalories || 0);
  const direction = s.adjustmentType === 'decrease' ? 'reduction' : s.adjustmentType === 'increase' ? 'increase' : 'adjustment';
  return `${name} — ${direction} to ${cal} kcal suggested. ${s.reasoning || ''}`.trim();
}

export default function MacroAdjustmentQueuePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const supabase = hasSupabase ? getSupabase() : null;

  const { data: queue = [], refetch, isLoading } = useQuery({
    queryKey: ['macro-draft-queue', user?.id],
    queryFn: async () => {
      const all = await getMacroDraftQueue(supabase, user?.id);
      const now = new Date();
      return all.filter((item) => {
        const key = `${DISMISS_PREFIX}${item.client.id}`;
        const untilRaw = localStorage.getItem(key);
        if (!untilRaw) return true;
        return new Date(untilRaw) <= now;
      });
    },
    enabled: Boolean(supabase && user?.id),
  });

  return (
    <div className="min-h-screen" style={{ background: colors.bg, color: colors.text }}>
      <TopBar title="Macro adjustments ready" onBack={() => navigate(-1)} />
      <div style={{ padding: spacing[16], maxWidth: 960, margin: '0 auto' }}>
        <p className="text-sm mb-3" style={{ color: colors.muted }}>
          Atlas drafted macro updates based on trend and adherence data. Review and apply coach-side.
        </p>
        {isLoading ? (
          <Card style={{ padding: spacing[16] }}>Loading macro drafts...</Card>
        ) : queue.length === 0 ? (
          <Card style={{ padding: spacing[16] }}>No macro adjustments are queued right now.</Card>
        ) : (
          <div style={{ display: 'grid', gap: spacing[10] }}>
            {queue.map((item) => {
              const client = item.client;
              const suggestion = item.suggestion;
              return (
                <Card key={client.id} style={{ padding: spacing[14] }}>
                  <p className="text-sm font-semibold" style={{ color: colors.text }}>{reasonLine(item)}</p>
                  <div className="flex gap-2 mt-3 flex-wrap">
                    <Button
                      onClick={() => {
                        const q = new URLSearchParams();
                        q.set('clientId', client.id);
                        if (suggestion.suggestedCalories != null) q.set('suggestCalories', String(Math.round(suggestion.suggestedCalories)));
                        if (suggestion.suggestedProtein != null) q.set('suggestProtein_g', String(Math.round(suggestion.suggestedProtein)));
                        if (suggestion.suggestedCarbs != null) q.set('suggestCarbs_g', String(Math.round(suggestion.suggestedCarbs)));
                        if (suggestion.suggestedFats != null) q.set('suggestFats_g', String(Math.round(suggestion.suggestedFats)));
                        navigate(`/nutrition-builder?${q.toString()}`);
                      }}
                    >
                      Apply adjustment
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        const until = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
                        localStorage.setItem(`${DISMISS_PREFIX}${client.id}`, until);
                        toast.success('Dismissed for this week');
                        refetch();
                      }}
                    >
                      Dismiss for this week
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
