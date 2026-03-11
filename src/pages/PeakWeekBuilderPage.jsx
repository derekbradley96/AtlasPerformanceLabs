/**
 * Peak Week Builder – competition/integrated coaches only.
 * Select prep client, generate week (show_date - 6 through show_date), edit carbs/water/sodium/cardio/training/notes per day, save.
 */
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import TopBar from '@/components/ui/TopBar';
import Card from '@/ui/Card';
import Button from '@/components/ui/button';
import { colors, spacing, shell } from '@/ui/tokens';
import { hasSupabase, getSupabase } from '@/lib/supabaseClient';
import { useAuth } from '@/lib/AuthContext';
import EmptyState from '@/components/ui/EmptyState';
import { Calendar, Save, Minus, Plus } from 'lucide-react';

function getCoachFocus(profile, coachFocusFromAuth) {
  const raw = (coachFocusFromAuth ?? profile?.coach_focus ?? 'transformation').toString().trim().toLowerCase();
  return raw || 'transformation';
}

function showPeakWeekByFocus(coachFocus) {
  return coachFocus === 'competition' || coachFocus === 'integrated';
}

function toISODate(d) {
  if (!d) return '';
  const x = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(x.getTime())) return '';
  const y = x.getFullYear();
  const m = String(x.getMonth() + 1).padStart(2, '0');
  const day = String(x.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function addDays(date, days) {
  const d = date instanceof Date ? new Date(date) : new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

/** Build 7 days: show_date - 6 through show_date. */
function buildWeekDays(showDate) {
  if (!showDate) return [];
  const show = new Date(showDate);
  if (Number.isNaN(show.getTime())) return [];
  const days = [];
  for (let i = -6; i <= 0; i++) {
    const d = addDays(show, i);
    const label = i === 0 ? 'Show day' : `Day ${i}`;
    days.push({
      day_date: toISODate(d),
      day_label: label,
      sort_order: i + 6,
      carbs_g: null,
      water_l: null,
      sodium_mg: null,
      cardio_minutes: null,
      training_notes: '',
      notes: '',
    });
  }
  return days;
}

export default function PeakWeekBuilderPage() {
  const navigate = useNavigate();
  const { id: clientIdFromParams } = useParams();
  const { user, profile, coachFocus: coachFocusFromAuth } = useAuth();
  const coachFocus = getCoachFocus(profile, coachFocusFromAuth);
  const showPeakWeek = showPeakWeekByFocus(coachFocus);

  const [selectedClientId, setSelectedClientId] = useState(() => clientIdFromParams || null);
  useEffect(() => {
    if (clientIdFromParams) setSelectedClientId(clientIdFromParams);
  }, [clientIdFromParams]);
  const [prepClients, setPrepClients] = useState([]);
  const [contestPrep, setContestPrep] = useState(null);
  const [protocol, setProtocol] = useState(null);
  const [days, setDays] = useState([]);
  const [saving, setSaving] = useState(false);
  const [autoSave, setAutoSave] = useState(false);
  const saveDebounceRef = useRef(null);

  const supabase = hasSupabase ? getSupabase() : null;
  const coachId = user?.id ?? null;

  useQuery({
    queryKey: ['v_peak_week_clients', coachId],
    queryFn: async () => {
      if (!supabase || !coachId) return [];
      const { data, error } = await supabase
        .from('v_peak_week_clients')
        .select('*')
        .eq('coach_id', coachId)
        .order('days_out', { ascending: true });
      return error ? [] : (data ?? []);
    },
    enabled: !!supabase && !!coachId && showPeakWeek,
    onSuccess: (data) => {
      setPrepClients(Array.isArray(data) ? data : []);
    },
  });

  useEffect(() => {
    if (!showPeakWeek || !selectedClientId || !supabase) {
      setContestPrep(null);
      setProtocol(null);
      setDays([]);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data: prep } = await supabase
        .from('contest_preps')
        .select('id, show_date')
        .eq('client_id', selectedClientId)
        .eq('is_active', true)
        .maybeSingle();
      if (cancelled || !prep) {
        if (!cancelled) {
          setContestPrep(null);
          setProtocol(null);
          setDays(buildWeekDays(null));
        }
        return;
      }
      setContestPrep(prep);
      const { data: prot } = await supabase
        .from('peak_week_protocols')
        .select('id')
        .eq('client_id', selectedClientId)
        .eq('contest_prep_id', prep.id)
        .maybeSingle();
      if (cancelled) return;
      if (prot) {
        setProtocol(prot);
        const { data: dayRows } = await supabase
          .from('peak_week_protocol_days')
          .select('*')
          .eq('protocol_id', prot.id)
          .order('sort_order', { ascending: true });
        if (cancelled) return;
        const base = buildWeekDays(prep.show_date);
        const byDate = {};
        (dayRows || []).forEach((r) => { byDate[r.day_date] = r; });
        const merged = base.map((b) => {
          const existing = byDate[b.day_date];
          if (existing) {
            return {
              ...existing,
              carbs_g: existing.carbs_g ?? '',
              water_l: existing.water_l ?? '',
              sodium_mg: existing.sodium_mg ?? '',
              cardio_minutes: existing.cardio_minutes ?? '',
              training_notes: existing.training_notes ?? '',
              notes: existing.notes ?? '',
            };
          }
          return { ...b, id: null };
        });
        setDays(merged);
      } else {
        setProtocol(null);
        setDays(buildWeekDays(prep.show_date));
      }
    })();
    return () => { cancelled = true; };
  }, [showPeakWeek, selectedClientId, supabase]);

  const setDayField = (index, field, value) => {
    setDays((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
    if (autoSave) scheduleDebouncedSave();
  };

  const scheduleDebouncedSave = useCallback(() => {
    if (saveDebounceRef.current) clearTimeout(saveDebounceRef.current);
    saveDebounceRef.current = setTimeout(() => {
      saveDebounceRef.current = null;
      handleSaveRef.current?.();
    }, 600);
  }, []);

  const handleSaveRef = useRef(null);

  const handleSave = useCallback(async () => {
    if (!supabase || !selectedClientId || !contestPrep || saving) return;
    setSaving(true);
    try {
      let protocolId = protocol?.id;
      if (!protocolId) {
        const { data: newProt, error: insertErr } = await supabase
          .from('peak_week_protocols')
          .insert({ client_id: selectedClientId, contest_prep_id: contestPrep.id })
          .select('id')
          .single();
        if (insertErr) {
          toast.error('Could not create protocol');
          return;
        }
        protocolId = newProt.id;
        setProtocol(newProt);
      }
      const nextDays = [...days];
      for (let i = 0; i < nextDays.length; i++) {
        const d = nextDays[i];
        const payload = {
          protocol_id: protocolId,
          day_date: d.day_date,
          day_label: d.day_label,
          sort_order: d.sort_order,
          carbs_g: d.carbs_g === '' || d.carbs_g == null ? null : Number(d.carbs_g),
          water_l: d.water_l === '' || d.water_l == null ? null : Number(d.water_l),
          sodium_mg: d.sodium_mg === '' || d.sodium_mg == null ? null : Number(d.sodium_mg),
          cardio_minutes: d.cardio_minutes === '' || d.cardio_minutes == null ? null : Number(d.cardio_minutes),
          training_notes: (d.training_notes || '').trim() || null,
          notes: (d.notes || '').trim() || null,
        };
        if (d.id) {
          await supabase.from('peak_week_protocol_days').update(payload).eq('id', d.id);
        } else {
          const { data: inserted } = await supabase.from('peak_week_protocol_days').insert(payload).select('id').single();
          if (inserted) nextDays[i] = { ...nextDays[i], id: inserted.id };
        }
      }
      setDays(nextDays);
      toast.success('Peak week saved');
    } catch (e) {
      toast.error(e?.message || 'Could not save');
    } finally {
      setSaving(false);
    }
  }, [supabase, selectedClientId, contestPrep, protocol, days, saving]);

  useEffect(() => {
    handleSaveRef.current = handleSave;
  }, [handleSave]);

  useEffect(() => {
    return () => {
      if (saveDebounceRef.current) clearTimeout(saveDebounceRef.current);
    };
  }, []);

  const incrementDayField = (index, field, delta, step = 1) => {
    setDays((prev) => {
      const next = [...prev];
      const row = next[index];
      const raw = row[field];
      const num = raw === '' || raw == null ? 0 : Number(raw);
      const newVal = Math.max(0, num + delta);
      const value = step === 1 ? Math.round(newVal) : Math.round(newVal / step) * step;
      next[index] = { ...row, [field]: value };
      return next;
    });
    if (autoSave) scheduleDebouncedSave();
  };

  if (!showPeakWeek) {
    return (
      <div className="min-h-screen" style={{ background: colors.bg, color: colors.text }}>
        <TopBar title="Peak Week Builder" onBack={() => navigate(-1)} />
        <div className="p-4">
          <p className="text-sm mb-4" style={{ color: colors.muted }}>
            Only available when coach focus is Competition or Integrated.
          </p>
          <Button variant="outline" onClick={() => navigate(-1)}>Back</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: colors.bg, color: colors.text, paddingBottom: 96 }}>
      <TopBar title="Peak Week Builder" onBack={() => navigate(-1)} />
      <div className="p-4 max-w-2xl mx-auto">
        {/* Client selector */}
        <section style={{ marginBottom: spacing[24] }}>
          <label className="block text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: colors.muted }}>
            Prep client
          </label>
          <select
            value={selectedClientId || ''}
            onChange={(e) => setSelectedClientId(e.target.value || null)}
            style={{
              width: '100%',
              padding: spacing[12],
              borderRadius: shell.cardRadius ?? 8,
              background: colors.surface2,
              border: `1px solid ${colors.border}`,
              color: colors.text,
              fontSize: 14,
            }}
          >
            <option value="">Select client</option>
            {prepClients.map((c) => (
              <option key={c.client_id} value={c.client_id}>
                {c.client_name || 'Client'} — {c.show_name || 'Show'} {c.days_out != null ? `(${c.days_out}d out)` : ''}
              </option>
            ))}
          </select>
          {prepClients.length === 0 && (
            <p className="text-sm mt-2" style={{ color: colors.muted }}>
              No clients in peak window (show within 14 days). Add an active contest prep with show date to see them here.
            </p>
          )}
        </section>

        {selectedClientId && contestPrep && days.length > 0 && (
          <>
            <p className="text-sm mb-3" style={{ color: colors.muted }}>
              Week starting {days[0]?.day_date} through show day {contestPrep.show_date}
            </p>
            <div className="space-y-4">
              {days.map((day, index) => (
                <Card key={day.day_date || index} style={{ padding: spacing[16], border: `1px solid ${colors.border}`, borderRadius: shell.cardRadius ?? 8 }}>
                  <p className="font-medium mb-3" style={{ color: colors.text }}>{day.day_label} · {day.day_date}</p>
                  <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))' }}>
                    <div>
                      <label className="block text-xs mb-1" style={{ color: colors.muted }}>Carbs (g)</label>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          aria-label="Decrease carbs"
                          onClick={() => incrementDayField(index, 'carbs_g', -5)}
                          style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6, border: `1px solid ${colors.border}`, background: colors.surface2, color: colors.text, cursor: 'pointer', flexShrink: 0 }}
                        >
                          <Minus size={14} strokeWidth={2.5} />
                        </button>
                        <input
                          type="number"
                          min={0}
                          value={day.carbs_g ?? ''}
                          onChange={(e) => setDayField(index, 'carbs_g', e.target.value)}
                          style={{ width: 56, padding: '6px 4px', borderRadius: 6, border: `1px solid ${colors.border}`, background: colors.surface2, color: colors.text, textAlign: 'center', fontSize: 14 }}
                        />
                        <button
                          type="button"
                          aria-label="Increase carbs"
                          onClick={() => incrementDayField(index, 'carbs_g', 5)}
                          style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6, border: `1px solid ${colors.border}`, background: colors.surface2, color: colors.text, cursor: 'pointer', flexShrink: 0 }}
                        >
                          <Plus size={14} strokeWidth={2.5} />
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs mb-1" style={{ color: colors.muted }}>Water (L)</label>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          aria-label="Decrease water"
                          onClick={() => incrementDayField(index, 'water_l', -0.5, 0.5)}
                          style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6, border: `1px solid ${colors.border}`, background: colors.surface2, color: colors.text, cursor: 'pointer', flexShrink: 0 }}
                        >
                          <Minus size={14} strokeWidth={2.5} />
                        </button>
                        <input
                          type="number"
                          min={0}
                          step={0.5}
                          value={day.water_l ?? ''}
                          onChange={(e) => setDayField(index, 'water_l', e.target.value)}
                          style={{ width: 56, padding: '6px 4px', borderRadius: 6, border: `1px solid ${colors.border}`, background: colors.surface2, color: colors.text, textAlign: 'center', fontSize: 14 }}
                        />
                        <button
                          type="button"
                          aria-label="Increase water"
                          onClick={() => incrementDayField(index, 'water_l', 0.5, 0.5)}
                          style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6, border: `1px solid ${colors.border}`, background: colors.surface2, color: colors.text, cursor: 'pointer', flexShrink: 0 }}
                        >
                          <Plus size={14} strokeWidth={2.5} />
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs mb-1" style={{ color: colors.muted }}>Sodium (mg)</label>
                      <input
                        type="number"
                        min={0}
                        value={day.sodium_mg ?? ''}
                        onChange={(e) => setDayField(index, 'sodium_mg', e.target.value)}
                        style={{ width: '100%', padding: 8, borderRadius: 6, border: `1px solid ${colors.border}`, background: colors.surface2, color: colors.text }}
                      />
                    </div>
                    <div>
                      <label className="block text-xs mb-1" style={{ color: colors.muted }}>Cardio (min)</label>
                      <input
                        type="number"
                        min={0}
                        value={day.cardio_minutes ?? ''}
                        onChange={(e) => setDayField(index, 'cardio_minutes', e.target.value)}
                        style={{ width: '100%', padding: 8, borderRadius: 6, border: `1px solid ${colors.border}`, background: colors.surface2, color: colors.text }}
                      />
                    </div>
                  </div>
                  <div className="mt-3">
                    <label className="block text-xs mb-1" style={{ color: colors.muted }}>Training</label>
                    <textarea
                      rows={2}
                      value={day.training_notes ?? ''}
                      onChange={(e) => setDayField(index, 'training_notes', e.target.value)}
                      placeholder="Optional"
                      style={{ width: '100%', padding: 8, borderRadius: 6, border: `1px solid ${colors.border}`, background: colors.surface2, color: colors.text, fontSize: 14 }}
                    />
                  </div>
                  <div className="mt-2">
                    <label className="block text-xs mb-1" style={{ color: colors.muted }}>Notes</label>
                    <textarea
                      rows={2}
                      value={day.notes ?? ''}
                      onChange={(e) => setDayField(index, 'notes', e.target.value)}
                      placeholder="Optional"
                      style={{ width: '100%', padding: 8, borderRadius: 6, border: `1px solid ${colors.border}`, background: colors.surface2, color: colors.text, fontSize: 14 }}
                    />
                  </div>
                </Card>
              ))}
            </div>
            <div className="mt-6 flex flex-wrap items-center gap-4">
              <label className="inline-flex items-center gap-2 cursor-pointer" style={{ color: colors.text, fontSize: 14 }}>
                <input
                  type="checkbox"
                  checked={autoSave}
                  onChange={(e) => setAutoSave(e.target.checked)}
                  style={{ width: 18, height: 18, accentColor: colors.primary }}
                />
                Auto-save on change
              </label>
              <Button
                onClick={handleSave}
                disabled={saving}
                className="inline-flex items-center gap-2"
                style={{ background: colors.primary, color: '#fff', border: 'none', padding: `${spacing[12]}px ${spacing[20]}px`, borderRadius: 8, cursor: saving ? 'wait' : 'pointer', fontWeight: 600 }}
              >
                <Save size={18} /> {saving ? 'Saving…' : 'Save'}
              </Button>
            </div>
          </>
        )}

        {selectedClientId && !contestPrep && prepClients.some((c) => c.client_id === selectedClientId) && (
          <EmptyState
            title="No active prep"
            description="This client has no active contest prep with a show date. Add one from client detail."
            icon={Calendar}
          />
        )}
      </div>
    </div>
  );
}
