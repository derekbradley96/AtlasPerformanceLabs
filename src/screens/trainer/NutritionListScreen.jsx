/**
 * Nutrition list: trainer's clients with active plan badge and quick status.
 * Route: /trainer/nutrition
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { UtensilsCrossed, ChevronRight } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { useData } from '@/data/useData';
import { supabase, hasSupabase } from '@/lib/supabaseClient';
import { impactLight } from '@/lib/haptics';
import Card from '@/ui/Card';
import { colors, spacing, touchTargetMin } from '@/ui/tokens';

export default function NutritionListScreen() {
  const navigate = useNavigate();
  const { profile, supabaseUser } = useAuth();
  const data = useData();
  const trainerId = profile?.id ?? supabaseUser?.id ?? null;

  const [clients, setClients] = useState([]);
  const [plansByClient, setPlansByClient] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadClients = useCallback(async () => {
    if (!data?.listClients) return;
    setLoading(true);
    setError(null);
    try {
      const list = await data.listClients();
      setClients(Array.isArray(list) ? list : []);
    } catch (e) {
      setError(e?.message ?? 'Failed to load clients');
      setClients([]);
    } finally {
      setLoading(false);
    }
  }, [data]);

  const loadPlans = useCallback(async () => {
    if (!hasSupabase || !supabase || !trainerId) return;
    try {
      const { data: rows, error: err } = await supabase
        .from('nutrition_plans')
        .select('*')
        .eq('trainer_id', trainerId)
        .order('created_at', { ascending: false });
      if (err) throw err;
      const list = Array.isArray(rows) ? rows : [];
      const byClient = {};
      for (const row of list) {
        const cid = row.client_id;
        if (!cid) continue;
        const existing = byClient[cid];
        const useActive = existing == null || (row.is_active === true && existing.is_active !== true) || (!existing.is_active && row.is_active === true);
        if (existing == null || useActive) byClient[cid] = row;
      }
      setPlansByClient(byClient);
    } catch (_) {
      setPlansByClient({});
    }
  }, [trainerId]);

  useEffect(() => {
    loadClients();
  }, [loadClients]);

  useEffect(() => {
    if (trainerId && !loading) loadPlans();
  }, [trainerId, loading, loadPlans]);

  const handleClientPress = useCallback(
    (clientId) => {
      impactLight();
      navigate(`/trainer/nutrition/${clientId}`);
    },
    [navigate]
  );

  if (!profile && !supabaseUser) {
    return (
      <div className="app-screen min-w-0 max-w-full overflow-x-hidden" style={{ padding: spacing[24] }}>
        <p className="text-sm" style={{ color: colors.muted }}>Loading…</p>
      </div>
    );
  }

  return (
    <div className="app-screen min-w-0 max-w-full overflow-x-hidden">
      <div style={{ padding: spacing[16], paddingBottom: spacing[24] }}>
        <h1 className="text-[22px] font-semibold mb-1" style={{ color: colors.text }}>
          Nutrition plans
        </h1>
        <p className="text-sm mb-4" style={{ color: colors.muted }}>
          Macros and meal plans by client
        </p>

        {error && (
          <div className="mb-4 p-3 rounded-xl" style={{ background: 'rgba(239,68,68,0.12)', color: colors.destructive }}>
            {error}
          </div>
        )}

        {loading ? (
          <div className="py-8 text-center text-sm" style={{ color: colors.muted }}>
            Loading clients…
          </div>
        ) : clients.length === 0 ? (
          <Card style={{ padding: spacing[24], textAlign: 'center' }}>
            <UtensilsCrossed size={32} style={{ color: colors.muted, marginBottom: spacing[12] }} />
            <p className="text-sm" style={{ color: colors.muted }}>
              No clients yet. Add clients from the Clients tab to assign nutrition plans.
            </p>
          </Card>
        ) : (
          <div className="rounded-[20px] overflow-hidden border" style={{ background: colors.card, borderColor: colors.border }}>
            {clients.map((client, i) => {
              const plan = plansByClient[client.id] ?? null;
              const dietLabel = plan?.diet_type === 'prep' ? 'Prep' : plan?.diet_type === 'lifestyle' ? 'Lifestyle' : 'No plan';
              return (
                <button
                  key={client.id}
                  type="button"
                  onClick={() => handleClientPress(client.id)}
                  className="w-full flex items-center gap-3 text-left active:opacity-90"
                  style={{
                    minHeight: touchTargetMin,
                    padding: spacing[16],
                    borderBottom: i < clients.length - 1 ? `1px solid ${colors.border}` : 'none',
                    background: 'transparent',
                    border: 'none',
                    color: 'inherit',
                  }}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-[15px] font-medium truncate" style={{ color: colors.text }}>
                      {client.full_name || client.name || 'Client'}
                    </p>
                    <div className="flex flex-wrap items-center gap-2 mt-1">
                      <span
                        className="text-[11px] font-medium px-2 py-0.5 rounded"
                        style={{
                          background: plan ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.06)',
                          color: plan ? colors.text : colors.muted,
                        }}
                      >
                        {dietLabel}
                      </span>
                      {plan?.phase && (
                        <span className="text-[11px] truncate" style={{ color: colors.muted }}>
                          {plan.phase}
                        </span>
                      )}
                      {plan?.peak_week && (
                        <span className="text-[10px] font-medium px-2 py-0.5 rounded" style={{ background: 'rgba(234,179,8,0.2)', color: '#EAB308' }}>
                          Peak week
                        </span>
                      )}
                      {plan?.refeed_day && (
                        <span className="text-[10px] font-medium px-2 py-0.5 rounded" style={{ background: 'rgba(59,130,246,0.2)', color: colors.accent }}>
                          Refeed
                        </span>
                      )}
                    </div>
                  </div>
                  <ChevronRight size={18} style={{ color: colors.muted }} className="flex-shrink-0" />
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
