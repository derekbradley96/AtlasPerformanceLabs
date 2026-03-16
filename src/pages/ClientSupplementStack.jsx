/**
 * Client view of their supplement plan: name, dosage, timing, and log button.
 * Clients can mark supplements as taken (writes to supplement_logs).
 */
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import TopBar from '@/components/ui/TopBar';
import Card from '@/ui/Card';
import { Button } from '@/components/ui/button';
import { colors, spacing } from '@/ui/tokens';
import { getSupabase, hasSupabase } from '@/lib/supabaseClient';
import { toast } from 'sonner';
import { Pill, CheckCircle2, Circle } from 'lucide-react';

function todayISODate() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

async function fetchClientStack() {
  if (!hasSupabase) return { stack: [], todayLogs: [] };
  const supabase = getSupabase();
  if (!supabase) return { stack: [], todayLogs: [] };

  const { data: stack, error: stackErr } = await supabase
    .from('client_supplements')
    .select('id, dosage, timing, notes, supplements(id, name, category)')
    .order('created_at', { ascending: true });

  if (stackErr) return { stack: [], todayLogs: [] };

  const ids = (stack || []).map((r) => r.id).filter(Boolean);
  if (ids.length === 0) return { stack: stack || [], todayLogs: [] };

  const today = todayISODate();
  const { data: logs, error: logsErr } = await supabase
    .from('supplement_logs')
    .select('id, client_supplement_id, taken')
    .in('client_supplement_id', ids)
    .eq('log_date', today);

  if (logsErr) return { stack: stack || [], todayLogs: [] };

  return { stack: stack || [], todayLogs: logs || [] };
}

export default function ClientSupplementStack() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const today = todayISODate();

  const { data, isLoading } = useQuery({
    queryKey: ['client_supplement_stack', today],
    queryFn: fetchClientStack,
    enabled: hasSupabase,
  });

  const stack = data?.stack ?? [];
  const todayLogs = data?.todayLogs ?? [];
  const takenByCsId = React.useMemo(() => {
    const map = {};
    for (const l of todayLogs) {
      if (l.client_supplement_id && l.taken) map[l.client_supplement_id] = l;
    }
    return map;
  }, [todayLogs]);

  const logMutation = useMutation({
    mutationFn: async ({ clientSupplementId, markTaken }) => {
      const supabase = getSupabase();
      if (!supabase) throw new Error('No supabase');
      const existing = todayLogs.find((l) => l.client_supplement_id === clientSupplementId);
      if (existing) {
        const { error } = await supabase
          .from('supplement_logs')
          .update({ taken: markTaken })
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        if (!markTaken) return;
        const { error } = await supabase.from('supplement_logs').insert({
          client_supplement_id: clientSupplementId,
          log_date: today,
          taken: true,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client_supplement_stack', today] });
      toast.success('Updated');
    },
    onError: (e) => {
      toast.error(e?.message || 'Could not update log');
    },
  });

  if (!hasSupabase) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ background: colors.bg }}>
        <p style={{ color: colors.muted }}>Sign in to view your supplement plan.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-24" style={{ background: colors.bg, color: colors.text }}>
      <TopBar title="My supplements" onBack={() => navigate(-1)} />

      <div className="p-4">
        {isLoading ? (
          <p style={{ color: colors.muted }}>Loading…</p>
        ) : stack.length === 0 ? (
          <Card style={{ padding: spacing[24], textAlign: 'center' }}>
            <Pill className="w-10 h-10 mx-auto mb-3" style={{ color: colors.muted }} />
            <p style={{ color: colors.muted }}>No supplements assigned yet.</p>
            <p className="text-sm mt-2" style={{ color: colors.muted }}>
              Your coach can add your supplement plan from their dashboard.
            </p>
          </Card>
        ) : (
          <ul className="space-y-3">
            {stack.map((row) => {
              const name = row.supplements?.name ?? 'Supplement';
              const log = takenByCsId[row.id];
              const isTaken = !!log?.taken;
              const isLogging = logMutation.isPending && logMutation.variables?.clientSupplementId === row.id;

              return (
                <li key={row.id}>
                  <Card
                    style={{
                      padding: spacing[16],
                      borderLeft: `4px solid ${isTaken ? 'var(--color-success, #22c55e)' : colors.border}`,
                    }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-sm" style={{ color: colors.text }}>
                          {name}
                        </p>
                        <p className="text-xs mt-1" style={{ color: colors.muted }}>
                          {row.dosage || '—'} {row.timing ? `· ${row.timing}` : ''}
                        </p>
                        {row.notes && (
                          <p className="text-xs mt-1" style={{ color: colors.muted }}>
                            {row.notes}
                          </p>
                        )}
                      </div>
                      <Button
                        variant={isTaken ? 'secondary' : 'default'}
                        size="sm"
                        disabled={isLogging}
                        onClick={() => {
                          logMutation.mutate({
                            clientSupplementId: row.id,
                            markTaken: !isTaken,
                          });
                        }}
                        className="shrink-0 inline-flex items-center gap-1.5"
                      >
                        {isTaken ? (
                          <>
                            <CheckCircle2 size={16} />
                            Taken
                          </>
                        ) : (
                          <>
                            <Circle size={16} />
                            Log
                          </>
                        )}
                      </Button>
                    </div>
                  </Card>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
