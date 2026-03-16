/**
 * Supplement Stack Builder – coaches assign supplement stacks to clients.
 * Coach can: search supplements, set dosage/timing, assign to client.
 */
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import TopBar from '@/components/ui/TopBar';
import Card from '@/ui/Card';
import { Button } from '@/components/ui/button';
import { colors, spacing, radii } from '@/ui/tokens';
import { hasSupabase, getSupabase } from '@/lib/supabaseClient';
import { toast } from 'sonner';
import { isCoach } from '@/lib/roles';
import { useAuth } from '@/lib/AuthContext';
import { Search, Users, Pill, CheckCircle2 } from 'lucide-react';

async function fetchCoachClients() {
  if (!hasSupabase) return [];
  const supabase = getSupabase();
  if (!supabase) return [];
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.id) return [];
  const { data, error } = await supabase
    .from('clients')
    .select('id, full_name, name')
    .or(`coach_id.eq.${user.id},trainer_id.eq.${user.id}`)
    .order('full_name');
  if (error) return [];
  return (data || []).map((c) => ({
    id: c.id,
    name: c.full_name || c.name || 'Client',
  }));
}

async function fetchSupplements() {
  if (!hasSupabase) return [];
  const supabase = getSupabase();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('supplements')
    .select('id, name, description, category')
    .order('name');
  if (error) return [];
  return data || [];
}

async function fetchClientStack(clientId) {
  if (!clientId || !hasSupabase) return [];
  const supabase = getSupabase();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('client_supplements')
    .select('id, dosage, timing, notes, supplements(id, name, category)')
    .eq('client_id', clientId)
    .order('created_at', { ascending: true });
  if (error) return [];
  return data || [];
}

export default function SupplementStackBuilder() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { effectiveRole } = useAuth();
  const queryClient = useQueryClient();

  const [clientId, setClientId] = useState(searchParams.get('clientId') || '');
  const [searchTerm, setSearchTerm] = useState('');
  const [dosage, setDosage] = useState('');
  const [timing, setTiming] = useState('');
  const [notes, setNotes] = useState('');
  const [selectedSupplementId, setSelectedSupplementId] = useState('');

  const isCoachRole = isCoach(effectiveRole);

  const { data: clients = [], isLoading: loadingClients } = useQuery({
    queryKey: ['coach_clients_for_supplements'],
    queryFn: fetchCoachClients,
    enabled: hasSupabase && isCoachRole,
  });

  const { data: supplements = [], isLoading: loadingSupps } = useQuery({
    queryKey: ['supplements_all'],
    queryFn: fetchSupplements,
    enabled: hasSupabase && isCoachRole,
  });

  const { data: clientStack = [], isLoading: loadingStack } = useQuery({
    queryKey: ['client_supplements_stack', clientId],
    queryFn: () => fetchClientStack(clientId),
    enabled: hasSupabase && isCoachRole && !!clientId,
  });

  const assignMutation = useMutation({
    mutationFn: async () => {
      if (!clientId) throw new Error('Select a client first');
      if (!selectedSupplementId) throw new Error('Select a supplement');
      const supabase = getSupabase();
      if (!supabase) throw new Error('No supabase client');
      const payload = {
        client_id: clientId,
        supplement_id: selectedSupplementId,
        dosage: dosage.trim() || null,
        timing: timing.trim() || null,
        notes: notes.trim() || null,
      };
      const { error } = await supabase.from('client_supplements').insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Supplement assigned to client');
      queryClient.invalidateQueries({ queryKey: ['client_supplements_stack', clientId] });
      setDosage('');
      setTiming('');
      setNotes('');
    },
    onError: (e) => {
      toast.error(e?.message || 'Could not assign supplement');
    },
  });

  if (!isCoachRole) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ background: colors.bg }}>
        <p style={{ color: colors.muted }}>Supplement stacks are for coaches only.</p>
      </div>
    );
  }

  const filteredSupplements =
    searchTerm.trim().length === 0
      ? supplements
      : supplements.filter((s) => {
          const q = searchTerm.toLowerCase();
          return (
            (s.name || '').toLowerCase().includes(q) ||
            (s.category || '').toLowerCase().includes(q) ||
            (s.description || '').toLowerCase().includes(q)
          );
        });

  const assignDisabled = !clientId || !selectedSupplementId || assignMutation.isPending;

  return (
    <div className="min-h-screen pb-24" style={{ background: colors.bg, color: colors.text }}>
      <TopBar title="Supplement stacks" onBack={() => navigate(-1)} />

      <div className="p-4 space-y-4">
        <Card style={{ padding: spacing[16] }}>
          <div className="flex items-center gap-2 mb-3">
            <Users size={16} style={{ color: colors.muted }} />
            <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: colors.muted, margin: 0 }}>
              Select client
            </p>
          </div>
          {loadingClients ? (
            <p className="text-sm" style={{ color: colors.muted }}>
              Loading clients…
            </p>
          ) : clients.length === 0 ? (
            <p className="text-sm" style={{ color: colors.muted }}>
              No clients found. Add a client first.
            </p>
          ) : (
            <select
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              className="w-full text-sm"
              style={{
                padding: spacing[10],
                borderRadius: radii.button,
                border: `1px solid ${colors.border}`,
                background: colors.surface1,
                color: colors.text,
              }}
            >
              <option value="">Select client…</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          )}
        </Card>

        <div className="grid gap-4 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
          <Card style={{ padding: spacing[16] }}>
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-2">
                <Pill size={16} style={{ color: colors.muted }} />
                <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: colors.muted, margin: 0 }}>
                  Supplement library
                </p>
              </div>
            </div>
            <div
              className="flex items-center gap-2 mb-3 rounded-lg px-2 py-1"
              style={{ border: `1px solid ${colors.border}`, background: colors.surface1 }}
            >
              <Search size={14} style={{ color: colors.muted }} />
              <input
                type="text"
                placeholder="Search supplements…"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="flex-1 text-sm bg-transparent focus:outline-none"
                style={{ color: colors.text }}
              />
            </div>
            {loadingSupps ? (
              <p className="text-sm" style={{ color: colors.muted }}>
                Loading supplements…
              </p>
            ) : filteredSupplements.length === 0 ? (
              <p className="text-sm" style={{ color: colors.muted }}>
                No supplements match this search.
              </p>
            ) : (
              <div className="space-y-1 max-h-72 overflow-y-auto pr-1">
                {filteredSupplements.map((s) => {
                  const isSelected = selectedSupplementId === s.id;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setSelectedSupplementId(s.id)}
                      className="w-full text-left rounded-md px-3 py-2 text-sm"
                      style={{
                        background: isSelected ? colors.primarySubtle : 'transparent',
                        border: `1px solid ${isSelected ? colors.primary : 'transparent'}`,
                        color: colors.text,
                      }}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium">{s.name}</span>
                        {s.category && (
                          <span className="text-[11px] px-2 py-0.5 rounded-full" style={{ background: colors.surface2, color: colors.muted }}>
                            {s.category}
                          </span>
                        )}
                      </div>
                      {s.description && (
                        <p className="text-xs mt-1" style={{ color: colors.muted }}>
                          {s.description}
                        </p>
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            <div
              className="mt-4 pt-3 border-t"
              style={{ borderColor: colors.border }}
            >
              <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: colors.muted }}>
                Set dosage & timing
              </p>
              <div className="space-y-2">
                <input
                  type="text"
                  placeholder="Dosage (e.g. 5g)"
                  value={dosage}
                  onChange={(e) => setDosage(e.target.value)}
                  className="w-full text-sm"
                  style={{
                    padding: spacing[10],
                    borderRadius: radii.button,
                    border: `1px solid ${colors.border}`,
                    background: colors.surface1,
                    color: colors.text,
                  }}
                />
                <input
                  type="text"
                  placeholder="Timing (e.g. AM with breakfast)"
                  value={timing}
                  onChange={(e) => setTiming(e.target.value)}
                  className="w-full text-sm"
                  style={{
                    padding: spacing[10],
                    borderRadius: radii.button,
                    border: `1px solid ${colors.border}`,
                    background: colors.surface1,
                    color: colors.text,
                  }}
                />
                <textarea
                  placeholder="Notes (optional)"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  className="w-full text-sm"
                  style={{
                    padding: spacing[10],
                    borderRadius: radii.button,
                    border: `1px solid ${colors.border}`,
                    background: colors.surface1,
                    color: colors.text,
                    resize: 'vertical',
                  }}
                />
              </div>
              <Button
                className="mt-3 w-full inline-flex items-center justify-center gap-1.5"
                disabled={assignDisabled}
                onClick={() => assignMutation.mutate()}
              >
                <CheckCircle2 className="w-4 h-4" />
                {assignMutation.isPending ? 'Assigning…' : 'Assign to client'}
              </Button>
              {!clientId && (
                <p className="text-xs mt-2" style={{ color: colors.muted }}>
                  Select a client to assign this stack.
                </p>
              )}
            </div>
          </Card>

          <Card style={{ padding: spacing[16] }}>
            <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: colors.muted }}>
              Current stack
            </p>
            {(!clientId || loadingStack) && (
              <p className="text-sm" style={{ color: colors.muted }}>
                {clientId ? 'Loading stack…' : 'Choose a client to view their stack.'}
              </p>
            )}
            {clientId && !loadingStack && clientStack.length === 0 && (
              <p className="text-sm" style={{ color: colors.muted }}>
                No supplements assigned yet.
              </p>
            )}
            {clientId && !loadingStack && clientStack.length > 0 && (
              <ul className="space-y-2">
                {clientStack.map((row) => (
                  <li
                    key={row.id}
                    className="rounded-lg px-3 py-2 border"
                    style={{ borderColor: colors.border, background: colors.surface1 }}
                  >
                    <p className="text-sm font-medium" style={{ color: colors.text }}>
                      {row.supplements?.name || 'Supplement'}
                    </p>
                    <p className="text-xs mt-1" style={{ color: colors.muted }}>
                      {row.dosage || '—'} {row.timing ? `• ${row.timing}` : ''}
                    </p>
                    {row.notes && (
                      <p className="text-xs mt-1" style={{ color: colors.muted }}>
                        {row.notes}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

