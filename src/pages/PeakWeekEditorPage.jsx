/**
 * Peak Week setup and daily plan editor – competition/integrated coaches only.
 * Create peak week for a client, link to contest prep, set show date, auto-generate days -7..0, edit daily plan.
 * Uses: peak_weeks, peak_week_days.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { getSupabase, hasSupabase } from '@/lib/supabaseClient';
import Card from '@/ui/Card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { colors, spacing } from '@/ui/tokens';
import { pageContainer, standardCard, sectionLabel, sectionGap } from '@/ui/pageLayout';
import { Calendar, Save, Plus, ChevronDown, ChevronUp } from 'lucide-react';
import { hapticLight } from '@/lib/haptics';
import { toast } from 'sonner';
import { notifyClientPeakWeekUpdated } from '@/services/notificationTriggers';

const DAY_NUMBERS = [-7, -6, -5, -4, -3, -2, -1, 0];

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

function addDays(date, delta) {
  const d = date instanceof Date ? new Date(date) : new Date(date);
  d.setDate(d.getDate() + delta);
  return d;
}

/** Default day row for day_number -7..0 */
function defaultDay(dayNumber, showDate) {
  const targetDate = showDate ? addDays(showDate, dayNumber) : null;
  const label = dayNumber === 0 ? 'Show day' : `Day ${dayNumber}`;
  return {
    id: null,
    day_number: dayNumber,
    day_label: label,
    target_date: targetDate ? toISODate(targetDate) : null,
    carbs_g: null,
    water_l: null,
    sodium_mg: null,
    training_notes: '',
    posing_required: false,
    checkin_required: false,
    notes: '',
  };
}

export default function PeakWeekEditorPage() {
  const navigate = useNavigate();
  const { id: clientIdParam } = useParams();
  const { user, profile, coachFocus: coachFocusFromAuth } = useAuth();
  const coachFocus = getCoachFocus(profile, coachFocusFromAuth);
  const showPeakWeek = showPeakWeekByFocus(coachFocus);

  const [clientId, setClientId] = useState(clientIdParam || null);
  const [clientName, setClientName] = useState('');
  const [contestPreps, setContestPreps] = useState([]);
  const [peakWeek, setPeakWeek] = useState(null);
  const [days, setDays] = useState([]);
  const [showDate, setShowDate] = useState('');
  const [contestPrepId, setContestPrepId] = useState('');
  const [division, setDivision] = useState('');
  const [expandedDay, setExpandedDay] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);

  const supabase = hasSupabase ? getSupabase() : null;
  const coachId = user?.id ?? null;

  useEffect(() => {
    if (clientIdParam) setClientId(clientIdParam);
  }, [clientIdParam]);

  const loadClientAndPreps = useCallback(async () => {
    if (!supabase || !clientId) return;
    const { data: client } = await supabase.from('clients').select('id, name, full_name').eq('id', clientId).maybeSingle();
    setClientName(client?.name || client?.full_name || 'Client');
    const { data: preps } = await supabase
      .from('contest_preps')
      .select('id, show_date, show_name, division')
      .eq('client_id', clientId)
      .eq('is_active', true)
      .order('show_date', { ascending: true });
    setContestPreps(Array.isArray(preps) ? preps : []);
  }, [supabase, clientId]);

  const loadPeakWeekAndDays = useCallback(async () => {
    if (!supabase || !clientId) return;
    const { data: week } = await supabase
      .from('peak_weeks')
      .select('id, client_id, coach_id, contest_prep_id, show_date, division, is_active')
      .eq('client_id', clientId)
      .eq('is_active', true)
      .order('show_date', { ascending: false })
      .limit(1)
      .maybeSingle();
    setPeakWeek(week || null);
    if (week) {
      setShowDate(week.show_date || '');
      setContestPrepId(week.contest_prep_id || '');
      setDivision(week.division || '');
      const { data: dayRows } = await supabase
        .from('peak_week_days')
        .select('*')
        .eq('peak_week_id', week.id)
        .order('day_number', { ascending: true });
      const byNum = {};
      (dayRows || []).forEach((r) => { byNum[r.day_number] = r; });
      const merged = DAY_NUMBERS.map((num) => {
        const existing = byNum[num];
        if (existing) return { ...existing, target_date: existing.target_date || (week.show_date ? toISODate(addDays(week.show_date, num)) : null) };
        return defaultDay(num, week.show_date);
      });
      setDays(merged);
    } else {
      setDays(DAY_NUMBERS.map((n) => defaultDay(n, null)));
      setShowDate('');
      setContestPrepId('');
      setDivision('');
    }
  }, [supabase, clientId]);

  useEffect(() => {
    if (!showPeakWeek || !clientId || !supabase) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    (async () => {
      await loadClientAndPreps();
      if (cancelled) return;
      await loadPeakWeekAndDays();
    })().finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [showPeakWeek, clientId, supabase, loadClientAndPreps, loadPeakWeekAndDays]);

  const handleGenerate = async () => {
    if (!supabase || !clientId || !coachId || !showDate.trim()) {
      toast.error('Select a client and set show date first.');
      return;
    }
    setGenerating(true);
    try {
      const { data: inserted, error: insertErr } = await supabase
        .from('peak_weeks')
        .insert({
          client_id: clientId,
          coach_id: coachId,
          contest_prep_id: contestPrepId || null,
          show_date: showDate.trim(),
          division: division.trim() || null,
          is_active: true,
        })
        .select('id')
        .single();
      if (insertErr) throw insertErr;
      const peakWeekId = inserted.id;
      const show = new Date(showDate.trim());
      for (const num of DAY_NUMBERS) {
        const label = num === 0 ? 'Show day' : `Day ${num}`;
        const targetDate = toISODate(addDays(show, num));
        await supabase.from('peak_week_days').insert({
          peak_week_id: peakWeekId,
          day_number: num,
          day_label: label,
          target_date: targetDate,
          carbs_g: null,
          water_l: null,
          sodium_mg: null,
          training_notes: null,
          posing_required: false,
          checkin_required: false,
          notes: null,
        });
      }
      toast.success('Peak week structure created.');
      await loadPeakWeekAndDays();
      setPeakWeek({ ...inserted, client_id: clientId, coach_id: coachId, contest_prep_id: contestPrepId || null, show_date: showDate.trim(), division: division.trim() || null, is_active: true });
    } catch (e) {
      toast.error(e?.message || 'Failed to create peak week.');
    } finally {
      setGenerating(false);
    }
  };

  const updateDay = (index, field, value) => {
    setDays((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const handleSave = async () => {
    if (!supabase || !peakWeek?.id) {
      toast.error('No peak week to save.');
      return;
    }
    setSaving(true);
    try {
      await supabase
        .from('peak_weeks')
        .update({
          show_date: showDate.trim() || peakWeek.show_date,
          contest_prep_id: contestPrepId || null,
          division: division.trim() || null,
        })
        .eq('id', peakWeek.id);
      for (const d of days) {
        const payload = {
          day_label: d.day_label,
          target_date: d.target_date || null,
          carbs_g: d.carbs_g != null && d.carbs_g !== '' ? Number(d.carbs_g) : null,
          water_l: d.water_l != null && d.water_l !== '' ? Number(d.water_l) : null,
          sodium_mg: d.sodium_mg != null && d.sodium_mg !== '' ? Number(d.sodium_mg) : null,
          training_notes: d.training_notes?.trim() || null,
          posing_required: Boolean(d.posing_required),
          checkin_required: Boolean(d.checkin_required),
          notes: d.notes?.trim() || null,
        };
        if (d.id) {
          await supabase.from('peak_week_days').update(payload).eq('id', d.id);
        } else {
          await supabase.from('peak_week_days').insert({
            peak_week_id: peakWeek.id,
            day_number: d.day_number,
            ...payload,
          });
        }
      }
      toast.success('Peak week saved.');
      const { data: clientRow } = await supabase.from('clients').select('user_id').eq('id', clientId).maybeSingle();
      if (clientRow?.user_id) notifyClientPeakWeekUpdated(clientRow.user_id, peakWeek.id).catch(() => {});
      await loadPeakWeekAndDays();
    } catch (e) {
      toast.error(e?.message || 'Failed to save.');
    } finally {
      setSaving(false);
    }
  };

  if (!showPeakWeek) {
    return (
      <div className="min-h-screen pb-8" style={{ background: colors.bg, color: colors.text }}>
        <div className="max-w-lg mx-auto" style={{ ...pageContainer, paddingBottom: spacing[32] }}>
          <h1 className="atlas-page-title">Peak Week Editor</h1>
          <p className="text-sm mt-1 mb-4" style={{ color: colors.muted }}>
            Only available when your coach focus is Competition or Integrated.
          </p>
          <Card style={{ ...standardCard, padding: spacing[24], textAlign: 'center' }}>
            <Calendar size={40} style={{ color: colors.muted, marginBottom: spacing[12] }} />
            <p className="text-[15px] font-medium" style={{ color: colors.text }}>Peak Week Editor is for prep coaches</p>
            <Button variant="outline" className="mt-4" onClick={() => { hapticLight(); navigate('/home'); }}>Back to Home</Button>
          </Card>
        </div>
      </div>
    );
  }

  if (!clientId) {
    return (
      <div className="min-h-screen pb-8" style={{ background: colors.bg, color: colors.text }}>
        <div className="max-w-lg mx-auto" style={{ ...pageContainer, paddingBottom: spacing[32] }}>
          <h1 className="atlas-page-title">Peak Week Editor</h1>
          <p className="text-sm mt-1 mb-4" style={{ color: colors.muted }}>Open from a client context (e.g. Peak Week Dashboard → Open Peak Week).</p>
          <Button variant="outline" onClick={() => { hapticLight(); navigate('/peak-week-dashboard'); }}>Go to Peak Week Dashboard</Button>
        </div>
      </div>
    );
  }

  const cardStyle = { ...standardCard, padding: spacing[16] };

  return (
    <div className="min-h-screen pb-8" style={{ background: colors.bg, color: colors.text }}>
      <div className="max-w-lg mx-auto" style={{ ...pageContainer, paddingBottom: spacing[32] }}>
        <div className="flex items-center justify-between gap-2 mb-4">
          <h1 className="atlas-page-title">Peak Week Editor</h1>
          <Button variant="ghost" size="sm" onClick={() => { hapticLight(); navigate(`/clients/${clientId}`); }}>Back to client</Button>
        </div>
        <p className="text-sm mb-4" style={{ color: colors.muted }}>Client: {clientName || clientId}</p>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-2 border-white/20 rounded-full animate-spin" style={{ borderTopColor: colors.primary }} />
          </div>
        ) : !peakWeek ? (
          <>
            <Card style={{ ...cardStyle, marginBottom: sectionGap }}>
              <div style={sectionLabel}>Create peak week</div>
              <div className="space-y-3">
                <div>
                  <Label className="text-xs" style={{ color: colors.muted }}>Show date</Label>
                  <Input
                    type="date"
                    value={showDate}
                    onChange={(e) => setShowDate(e.target.value)}
                    className="mt-1 bg-black/20 border border-white/10 text-white"
                  />
                </div>
                {contestPreps.length > 0 && (
                  <div>
                    <Label className="text-xs" style={{ color: colors.muted }}>Link to contest prep (optional)</Label>
                    <select
                      value={contestPrepId}
                      onChange={(e) => {
                        const id = e.target.value;
                        setContestPrepId(id);
                        if (id) {
                          const p = contestPreps.find((x) => x.id === id);
                          if (p?.show_date) setShowDate(p.show_date);
                        }
                      }}
                      className="mt-1 w-full rounded-lg bg-black/20 border border-white/10 text-white p-2"
                      style={{ color: colors.text }}
                    >
                      <option value="">None</option>
                      {contestPreps.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.show_name || 'Show'} {p.show_date} {p.division ? ` · ${p.division}` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <div>
                  <Label className="text-xs" style={{ color: colors.muted }}>Division (optional)</Label>
                  <Input
                    value={division}
                    onChange={(e) => setDivision(e.target.value)}
                    placeholder="e.g. Men's Physique"
                    className="mt-1 bg-black/20 border border-white/10 text-white"
                  />
                </div>
                <Button
                  className="w-full mt-2"
                  onClick={handleGenerate}
                  disabled={!showDate.trim() || generating}
                >
                  <Plus size={18} className="mr-2" /> Generate Standard Peak Week Structure
                </Button>
              </div>
            </Card>
          </>
        ) : (
          <>
            <Card style={{ ...cardStyle, marginBottom: sectionGap }}>
              <div style={sectionLabel}>Peak week</div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs" style={{ color: colors.muted }}>Show date</Label>
                  <Input
                    type="date"
                    value={showDate}
                    onChange={(e) => setShowDate(e.target.value)}
                    className="mt-1 bg-black/20 border border-white/10 text-white"
                  />
                </div>
                <div>
                  <Label className="text-xs" style={{ color: colors.muted }}>Division</Label>
                  <Input
                    value={division}
                    onChange={(e) => setDivision(e.target.value)}
                    className="mt-1 bg-black/20 border border-white/10 text-white"
                  />
                </div>
              </div>
            </Card>

            <div style={sectionLabel}>Daily plan (Day -7 → Show day)</div>
            <div className="space-y-2">
              {days.map((d, index) => {
                const isExpanded = expandedDay === index;
                return (
                  <Card key={d.day_number} style={{ ...cardStyle, padding: spacing[12] }}>
                    <button
                      type="button"
                      className="w-full flex items-center justify-between text-left"
                      onClick={() => setExpandedDay(isExpanded ? -1 : index)}
                    >
                      <span className="font-medium" style={{ color: colors.text }}>
                        {d.day_label || `Day ${d.day_number}`} {d.target_date ? ` · ${d.target_date}` : ''}
                      </span>
                      {isExpanded ? <ChevronUp size={18} style={{ color: colors.muted }} /> : <ChevronDown size={18} style={{ color: colors.muted }} />}
                    </button>
                    {isExpanded && (
                      <div className="mt-4 pt-4 border-t space-y-3" style={{ borderColor: colors.border }}>
                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <Label className="text-xs" style={{ color: colors.muted }}>Carbs (g)</Label>
                            <Input
                              type="number"
                              value={d.carbs_g ?? ''}
                              onChange={(e) => updateDay(index, 'carbs_g', e.target.value === '' ? null : e.target.value)}
                              className="mt-1 bg-black/20 border border-white/10 text-white"
                            />
                          </div>
                          <div>
                            <Label className="text-xs" style={{ color: colors.muted }}>Water (L)</Label>
                            <Input
                              type="number"
                              step="0.5"
                              value={d.water_l ?? ''}
                              onChange={(e) => updateDay(index, 'water_l', e.target.value === '' ? null : e.target.value)}
                              className="mt-1 bg-black/20 border border-white/10 text-white"
                            />
                          </div>
                          <div>
                            <Label className="text-xs" style={{ color: colors.muted }}>Sodium (mg)</Label>
                            <Input
                              type="number"
                              value={d.sodium_mg ?? ''}
                              onChange={(e) => updateDay(index, 'sodium_mg', e.target.value === '' ? null : e.target.value)}
                              className="mt-1 bg-black/20 border border-white/10 text-white"
                            />
                          </div>
                        </div>
                        <div>
                          <Label className="text-xs" style={{ color: colors.muted }}>Training notes</Label>
                          <Textarea
                            value={d.training_notes ?? ''}
                            onChange={(e) => updateDay(index, 'training_notes', e.target.value)}
                            rows={2}
                            className="mt-1 bg-black/20 border border-white/10 text-white"
                          />
                        </div>
                        <div className="flex flex-wrap gap-4">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={Boolean(d.posing_required)}
                              onChange={(e) => updateDay(index, 'posing_required', e.target.checked)}
                              className="rounded border-white/20"
                            />
                            <span className="text-sm" style={{ color: colors.text }}>Posing required</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={Boolean(d.checkin_required)}
                              onChange={(e) => updateDay(index, 'checkin_required', e.target.checked)}
                              className="rounded border-white/20"
                            />
                            <span className="text-sm" style={{ color: colors.text }}>Check-in required</span>
                          </label>
                        </div>
                        <div>
                          <Label className="text-xs" style={{ color: colors.muted }}>Notes</Label>
                          <Textarea
                            value={d.notes ?? ''}
                            onChange={(e) => updateDay(index, 'notes', e.target.value)}
                            rows={2}
                            className="mt-1 bg-black/20 border border-white/10 text-white"
                          />
                        </div>
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
            <div className="mt-6">
              <Button className="w-full" onClick={handleSave} disabled={saving}>
                <Save size={18} className="mr-2" /> Save changes
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
