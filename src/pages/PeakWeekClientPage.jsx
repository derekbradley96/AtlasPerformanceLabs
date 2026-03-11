/**
 * Peak Week – client view of their peak week protocol.
 * Today card (carbs, water, sodium, cardio, training, notes) + week overview (Monday → Show day), today highlighted.
 * Only visible when client has an active peak_week_protocol.
 */
import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import TopBar from '@/components/ui/TopBar';
import Card from '@/ui/Card';
import { colors, spacing, shell } from '@/ui/tokens';
import { hasSupabase, getSupabase } from '@/lib/supabaseClient';
import { useAuth } from '@/lib/AuthContext';
import EmptyState from '@/components/ui/EmptyState';
import { Calendar } from 'lucide-react';

function toISODate(d) {
  if (!d) return '';
  const x = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(x.getTime())) return '';
  const y = x.getFullYear();
  const m = String(x.getMonth() + 1).padStart(2, '0');
  const day = String(x.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

async function resolveClientId(supabase, userId) {
  if (!supabase || !userId) return null;
  const { data } = await supabase.from('clients').select('id').eq('user_id', userId).maybeSingle();
  return data?.id ?? null;
}

export default function PeakWeekClientPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const supabase = hasSupabase ? getSupabase() : null;
  const todayStr = useMemo(() => toISODate(new Date()), []);

  const { data: clientId } = useQuery({
    queryKey: ['peak-week-client-id', user?.id],
    queryFn: () => resolveClientId(supabase, user?.id),
    enabled: !!supabase && !!user?.id,
  });

  const { data: protocol, isLoading: protocolLoading } = useQuery({
    queryKey: ['peak_week_protocol', clientId],
    queryFn: async () => {
      if (!supabase || !clientId) return null;
      const { data: prep } = await supabase
        .from('contest_preps')
        .select('id')
        .eq('client_id', clientId)
        .eq('is_active', true)
        .maybeSingle();
      if (!prep) return null;
      const { data: prot } = await supabase
        .from('peak_week_protocols')
        .select('id')
        .eq('client_id', clientId)
        .eq('contest_prep_id', prep.id)
        .maybeSingle();
      return prot;
    },
    enabled: !!supabase && !!clientId,
  });

  const { data: days = [], isLoading: daysLoading } = useQuery({
    queryKey: ['peak_week_protocol_days', protocol?.id],
    queryFn: async () => {
      if (!supabase || !protocol?.id) return [];
      const { data, error } = await supabase
        .from('peak_week_protocol_days')
        .select('*')
        .eq('protocol_id', protocol.id)
        .order('sort_order', { ascending: true });
      return error ? [] : (data ?? []);
    },
    enabled: !!supabase && !!protocol?.id,
  });

  const todayDay = useMemo(() => days.find((d) => d.day_date === todayStr), [days, todayStr]);
  const hasProtocol = protocol != null && days.length > 0;
  const loading = protocolLoading || daysLoading;

  if (!user) {
    return (
      <div className="min-h-screen" style={{ background: colors.bg, color: colors.text }}>
        <TopBar title="Peak Week" onBack={() => navigate(-1)} />
        <div className="p-4">
          <p style={{ color: colors.muted }}>Sign in to view your peak week.</p>
          <button type="button" onClick={() => navigate(-1)} className="mt-2 text-sm" style={{ color: colors.primary }}>Back</button>
        </div>
      </div>
    );
  }

  if (!hasProtocol && !loading) {
    return (
      <div className="min-h-screen" style={{ background: colors.bg, color: colors.text }}>
        <TopBar title="Peak Week" onBack={() => navigate(-1)} />
        <div className="p-4">
          <EmptyState
            title="No peak week plan yet"
            description="Your coach will add a peak week protocol when you're in prep. Check back or ask your coach."
            icon={Calendar}
            actionLabel="Back"
            onAction={() => navigate(-1)}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: colors.bg, color: colors.text, paddingBottom: 96 }}>
      <TopBar title="Peak Week" onBack={() => navigate(-1)} />
      <div className="p-4 max-w-lg mx-auto">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-2 border-white/20 rounded-full animate-spin" style={{ borderTopColor: colors.primary }} />
          </div>
        ) : (
          <>
            {/* Today card */}
            <section style={{ marginBottom: spacing[24] }}>
              <h2 className="text-sm font-semibold uppercase tracking-wide mb-3" style={{ color: colors.muted }}>
                Today
                {todayDay?.day_label && (
                  <span className="ml-2 font-normal" style={{ color: colors.text }}>— {todayDay.day_label}</span>
                )}
              </h2>
              <Card style={{ padding: spacing[16], border: `1px solid ${colors.border}`, borderRadius: shell.cardRadius ?? 8 }}>
                <div className="grid gap-4" style={{ gridTemplateColumns: '1fr 1fr' }}>
                  <div>
                    <p className="text-xs mb-0.5" style={{ color: colors.muted }}>Carbs (g)</p>
                    <p className="text-lg font-medium" style={{ color: colors.text }}>{todayDay?.carbs_g ?? '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs mb-0.5" style={{ color: colors.muted }}>Water (L)</p>
                    <p className="text-lg font-medium" style={{ color: colors.text }}>{todayDay?.water_l ?? '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs mb-0.5" style={{ color: colors.muted }}>Sodium (mg)</p>
                    <p className="text-lg font-medium" style={{ color: colors.text }}>{todayDay?.sodium_mg ?? '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs mb-0.5" style={{ color: colors.muted }}>Cardio (min)</p>
                    <p className="text-lg font-medium" style={{ color: colors.text }}>{todayDay?.cardio_minutes ?? '—'}</p>
                  </div>
                </div>
                {(todayDay?.training_notes || todayDay?.notes) && (
                  <div className="mt-4 pt-4" style={{ borderTop: `1px solid ${colors.border}` }}>
                    {todayDay.training_notes && (
                      <div className="mb-2">
                        <p className="text-xs mb-0.5" style={{ color: colors.muted }}>Training</p>
                        <p className="text-sm" style={{ color: colors.text }}>{todayDay.training_notes}</p>
                      </div>
                    )}
                    {todayDay.notes && (
                      <div>
                        <p className="text-xs mb-0.5" style={{ color: colors.muted }}>Notes</p>
                        <p className="text-sm" style={{ color: colors.text }}>{todayDay.notes}</p>
                      </div>
                    )}
                  </div>
                )}
              </Card>
            </section>

            {/* Week overview */}
            <section>
              <h2 className="text-sm font-semibold uppercase tracking-wide mb-3" style={{ color: colors.muted }}>
                Week overview
              </h2>
              <div className="flex flex-wrap gap-2">
                {days.map((d) => {
                  const isToday = d.day_date === todayStr;
                  const dayName = d.day_date ? (() => {
                    const dt = new Date(d.day_date + 'T12:00:00');
                    return dt.toLocaleDateString(undefined, { weekday: 'short' });
                  })() : d.day_label;
                  return (
                    <div
                      key={d.id || d.day_date}
                      style={{
                        padding: `${spacing[8]}px ${spacing[12]}px`,
                        borderRadius: shell.cardRadius ?? 8,
                        border: `1px solid ${isToday ? colors.primary : colors.border}`,
                        background: isToday ? colors.primarySubtle : colors.surface2,
                        color: isToday ? colors.primary : colors.text,
                        fontWeight: isToday ? 600 : 400,
                        fontSize: 13,
                        minWidth: 72,
                        textAlign: 'center',
                      }}
                    >
                      <div>{dayName}</div>
                      <div className="text-xs mt-0.5" style={{ opacity: 0.9 }}>{d.day_label}</div>
                      {isToday && <div className="text-xs mt-1" style={{ opacity: 0.8 }}>Today</div>}
                    </div>
                  );
                })}
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
