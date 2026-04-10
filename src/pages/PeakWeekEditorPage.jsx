/**
 * Peak Week setup and daily plan editor – competition/integrated coaches only.
 * Create peak week for a client, link to contest prep, set show date, auto-generate days -7..0, edit daily plan.
 * Uses: peak_weeks, peak_week_days.
 */
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { getSupabase, hasSupabase } from '@/lib/supabaseClient';
import Card from '@/ui/Card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { colors, spacing, shadows } from '@/ui/tokens';
import { pageContainer, standardCard, sectionLabel, sectionGap } from '@/ui/pageLayout';
import { Calendar, Save, Plus, ChevronDown, ChevronUp, LayoutList, ListCollapse } from 'lucide-react';
import { hapticLight } from '@/lib/haptics';
import { toast } from 'sonner';
import { notifyClientPeakWeekUpdated } from '@/services/notificationTriggers';
import { CardSkeleton } from '@/components/ui/LoadingState';

const DAY_NUMBERS = [-7, -6, -5, -4, -3, -2, -1, 0];
const TRAINING_TYPE_OPTIONS = ['depletion', 'pump', 'rest', 'posing_only', 'custom'];

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
/** Calendar days from today to show date (0 = show day, negative = past show). */
function daysUntilShow(showDateStr, todayIso) {
  if (!showDateStr || !todayIso) return null;
  const show = new Date(`${showDateStr}T12:00:00`);
  const today = new Date(`${todayIso}T12:00:00`);
  if (Number.isNaN(show.getTime()) || Number.isNaN(today.getTime())) return null;
  return Math.round((show.getTime() - today.getTime()) / 86400000);
}

function defaultDay(dayNumber, showDate) {
  const targetDate = showDate ? addDays(showDate, dayNumber) : null;
  const label = dayNumber === 0 ? 'Show day' : `Day ${dayNumber}`;
  return {
    id: null,
    day_number: dayNumber,
    day_label: label,
    target_date: targetDate ? toISODate(targetDate) : null,
    carbs_g: null,
    protein_g: null,
    fats_g: null,
    water_l: null,
    sodium_mg: null,
    steps_target: null,
    cardio_minutes: null,
    training_type: null,
    training_notes: '',
    posing_required: false,
    posing_notes: '',
    morning_checkin_required: false,
    evening_checkin_required: false,
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
  /** focus = accordion one day; overview = all days expanded for fast macro editing */
  const [editMode, setEditMode] = useState('focus');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);

  const supabase = hasSupabase ? getSupabase() : null;
  const coachId = user?.id ?? null;
  const todayStr = useMemo(() => toISODate(new Date()), []);
  const daysOut = useMemo(
    () => (showDate ? daysUntilShow(showDate, todayStr) : null),
    [showDate, todayStr]
  );
  const todayDayIndex = useMemo(
    () => days.findIndex((d) => d.target_date === todayStr),
    [days, todayStr]
  );
  const autoExpandedWeekRef = useRef(null);

  useEffect(() => {
    autoExpandedWeekRef.current = null;
  }, [clientId]);

  useEffect(() => {
    if (!peakWeek?.id || !days.length) return;
    if (autoExpandedWeekRef.current === peakWeek.id) return;
    autoExpandedWeekRef.current = peakWeek.id;
    if (todayDayIndex >= 0) setExpandedDay(todayDayIndex);
  }, [peakWeek?.id, days.length, todayDayIndex]);

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
        if (existing) {
          return {
            ...existing,
            target_date: existing.target_date || (week.show_date ? toISODate(addDays(week.show_date, num)) : null),
            protein_g: existing.protein_g ?? null,
            fats_g: existing.fats_g ?? null,
            steps_target: existing.steps_target ?? null,
            cardio_minutes: existing.cardio_minutes ?? null,
            training_type: existing.training_type ?? null,
            posing_notes: existing.posing_notes ?? '',
            morning_checkin_required: existing.morning_checkin_required ?? existing.checkin_required ?? false,
            evening_checkin_required: existing.evening_checkin_required ?? existing.checkin_required ?? false,
          };
        }
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
          protein_g: null,
          fats_g: null,
          water_l: null,
          sodium_mg: null,
          steps_target: null,
          cardio_minutes: null,
          training_type: null,
          training_notes: null,
          posing_required: false,
          posing_notes: null,
          morning_checkin_required: false,
          evening_checkin_required: false,
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

  const copyPreviousDay = (index) => {
    if (index <= 0) {
      toast.error('No previous day to copy');
      return;
    }
    setDays((prev) => {
      const next = [...prev];
      const src = prev[index - 1];
      const target = prev[index];
      if (!src || !target) return prev;
      next[index] = {
        ...target,
        carbs_g: src.carbs_g,
        protein_g: src.protein_g,
        fats_g: src.fats_g,
        water_l: src.water_l,
        sodium_mg: src.sodium_mg,
        steps_target: src.steps_target,
        cardio_minutes: src.cardio_minutes,
        training_type: src.training_type,
        training_notes: src.training_notes,
        posing_required: src.posing_required,
        posing_notes: src.posing_notes,
        morning_checkin_required: src.morning_checkin_required,
        evening_checkin_required: src.evening_checkin_required,
        notes: src.notes,
      };
      return next;
    });
    toast.success('Copied from previous day');
  };

  const resetDay = (index) => {
    setDays((prev) => {
      const next = [...prev];
      const current = prev[index];
      if (!current) return prev;
      next[index] = {
        ...current,
        carbs_g: null,
        protein_g: null,
        fats_g: null,
        water_l: null,
        sodium_mg: null,
        steps_target: null,
        cardio_minutes: null,
        training_type: null,
        training_notes: '',
        posing_required: false,
        posing_notes: '',
        morning_checkin_required: false,
        evening_checkin_required: false,
        notes: '',
      };
      return next;
    });
    toast.success('Day reset');
  };

  const shiftTargetDatesByOneDay = () => {
    setDays((prev) => prev.map((d) => {
      if (!d?.target_date) return d;
      return { ...d, target_date: toISODate(addDays(d.target_date, 1)) };
    }));
    toast.success('Shifted all target dates by +1 day');
  };

  const duplicateFullPeakWeek = async () => {
    if (!supabase || !peakWeek?.id || !clientId || !coachId) return;
    setSaving(true);
    try {
      const { data: inserted, error: insertErr } = await supabase
        .from('peak_weeks')
        .insert({
          client_id: clientId,
          coach_id: coachId,
          contest_prep_id: contestPrepId || null,
          show_date: showDate?.trim() || peakWeek.show_date,
          division: division?.trim() || null,
          is_active: true,
        })
        .select('id')
        .single();
      if (insertErr) throw insertErr;
      await supabase.from('peak_weeks').update({ is_active: false }).eq('id', peakWeek.id);
      for (const d of days) {
        await supabase.from('peak_week_days').insert({
          peak_week_id: inserted.id,
          day_number: d.day_number,
          day_label: d.day_label,
          target_date: d.target_date || null,
          carbs_g: d.carbs_g != null && d.carbs_g !== '' ? Number(d.carbs_g) : null,
          protein_g: d.protein_g != null && d.protein_g !== '' ? Number(d.protein_g) : null,
          fats_g: d.fats_g != null && d.fats_g !== '' ? Number(d.fats_g) : null,
          water_l: d.water_l != null && d.water_l !== '' ? Number(d.water_l) : null,
          sodium_mg: d.sodium_mg != null && d.sodium_mg !== '' ? Number(d.sodium_mg) : null,
          steps_target: d.steps_target != null && d.steps_target !== '' ? Number(d.steps_target) : null,
          cardio_minutes: d.cardio_minutes != null && d.cardio_minutes !== '' ? Number(d.cardio_minutes) : null,
          training_type: d.training_type?.trim() || null,
          training_notes: d.training_notes?.trim() || null,
          posing_required: Boolean(d.posing_required),
          posing_notes: d.posing_notes?.trim() || null,
          morning_checkin_required: Boolean(d.morning_checkin_required),
          evening_checkin_required: Boolean(d.evening_checkin_required),
          notes: d.notes?.trim() || null,
        });
      }
      toast.success('Duplicated full peak week and switched to the new copy.');
      await loadPeakWeekAndDays();
    } catch (e) {
      toast.error(e?.message || 'Failed to duplicate peak week.');
    } finally {
      setSaving(false);
    }
  };

  const markTodayReviewed = async () => {
    if (!supabase || !coachId || !peakWeek?.id) return;
    const todayDay = days.find((d) => d.target_date === todayStr);
    if (!todayDay?.id) {
      toast.error('No day row matches today.');
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase
        .from('peak_week_days')
        .update({ reviewed_at: new Date().toISOString(), reviewed_by: coachId })
        .eq('id', todayDay.id);
      if (error) throw error;
      toast.success('Marked today as reviewed');
      await loadPeakWeekAndDays();
    } catch (e) {
      toast.error(e?.message || 'Failed to mark as reviewed.');
    } finally {
      setSaving(false);
    }
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
          protein_g: d.protein_g != null && d.protein_g !== '' ? Number(d.protein_g) : null,
          fats_g: d.fats_g != null && d.fats_g !== '' ? Number(d.fats_g) : null,
          water_l: d.water_l != null && d.water_l !== '' ? Number(d.water_l) : null,
          sodium_mg: d.sodium_mg != null && d.sodium_mg !== '' ? Number(d.sodium_mg) : null,
          steps_target: d.steps_target != null && d.steps_target !== '' ? Number(d.steps_target) : null,
          cardio_minutes: d.cardio_minutes != null && d.cardio_minutes !== '' ? Number(d.cardio_minutes) : null,
          training_type: d.training_type?.trim() || null,
          training_notes: d.training_notes?.trim() || null,
          posing_required: Boolean(d.posing_required),
          posing_notes: d.posing_notes?.trim() || null,
          morning_checkin_required: Boolean(d.morning_checkin_required),
          evening_checkin_required: Boolean(d.evening_checkin_required),
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
          <div className="space-y-4">
            <Card style={{ ...cardStyle, padding: spacing[16] }}>
              <CardSkeleton count={1} />
            </Card>
            <Card style={{ ...cardStyle, padding: spacing[16] }}>
              <CardSkeleton count={4} />
            </Card>
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
              {daysOut != null && (
                <p className="text-xs mt-3" style={{ color: colors.muted }}>
                  {daysOut === 0
                    ? 'Show is today — client sees “Show day” as their current protocol day if dates align.'
                    : daysOut > 0
                      ? `${daysOut} day${daysOut === 1 ? '' : 's'} until show — matches client “days out” in the app.`
                      : `Show was ${Math.abs(daysOut)} day${Math.abs(daysOut) === 1 ? '' : 's'} ago (editing past peak week).`}
                </p>
              )}
              <div className="mt-4 flex flex-wrap gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => { hapticLight(); duplicateFullPeakWeek(); }} disabled={saving}>
                  Duplicate full peak week
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => { hapticLight(); shiftTargetDatesByOneDay(); }}>
                  Shift target dates +1 day
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => { hapticLight(); markTodayReviewed(); }} disabled={saving}>
                  Mark today reviewed
                </Button>
              </div>
            </Card>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-2">
              <div style={sectionLabel}>Daily plan (Day -7 → Show day)</div>
              <div className="flex rounded-lg overflow-hidden border shrink-0" style={{ borderColor: colors.border }}>
                <button
                  type="button"
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium"
                  style={{
                    background: editMode === 'focus' ? colors.primarySubtle : 'transparent',
                    color: editMode === 'focus' ? colors.primary : colors.muted,
                  }}
                  onClick={() => { hapticLight(); setEditMode('focus'); }}
                >
                  <ListCollapse size={14} /> One day
                </button>
                <button
                  type="button"
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-l"
                  style={{
                    borderColor: colors.border,
                    background: editMode === 'overview' ? colors.primarySubtle : 'transparent',
                    color: editMode === 'overview' ? colors.primary : colors.muted,
                  }}
                  onClick={() => { hapticLight(); setEditMode('overview'); }}
                >
                  <LayoutList size={14} /> All days
                </button>
              </div>
            </div>
            <p className="text-xs mb-3" style={{ color: colors.muted }}>
              {editMode === 'overview'
                ? 'Edit carbs, water, and sodium for every day on one screen. Save when done.'
                : 'Use the timeline to jump days. Calendar “today” is highlighted for you and the client.'}
            </p>
            {!days.some((d) => d.carbs_g != null || d.water_l != null || d.sodium_mg != null || d.cardio_minutes != null || d.training_notes) && (
              <Card style={{ ...cardStyle, marginBottom: spacing[12], border: `1px dashed ${colors.border}` }}>
                <p className="text-sm font-medium" style={{ color: colors.text }}>No daily targets set</p>
                <p className="text-xs mt-1" style={{ color: colors.muted }}>
                  Start with macros/hydration for each day, then add cardio and training details.
                </p>
              </Card>
            )}

            {/* Horizontal timeline — jump to day, strong highlight for calendar today */}
            <div
              className="overflow-x-auto pb-3 mb-3 -mx-1"
              style={{ WebkitOverflowScrolling: 'touch' }}
            >
              <div className="flex gap-2 px-1" style={{ width: 'max-content' }}>
                {days.map((d, index) => {
                  const isCalToday = d.target_date === todayStr;
                  const hasTargets = d.carbs_g != null || d.water_l != null || d.sodium_mg != null;
                  const isReviewed = !!d.reviewed_at;
                  const shortDate = d.target_date
                    ? new Date(`${d.target_date}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
                    : '—';
                  return (
                    <button
                      key={d.day_number}
                      type="button"
                      onClick={() => {
                        hapticLight();
                        setExpandedDay(index);
                        if (editMode === 'overview') {
                          document.getElementById(`peak-day-anchor-${index}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                        }
                      }}
                      className="flex flex-col items-stretch text-left rounded-xl px-3 py-2 min-w-[100px] transition-shadow"
                      style={{
                        border: `2px solid ${isCalToday ? colors.primary : colors.border}`,
                        background: isCalToday ? colors.primarySubtle : colors.surface2,
                        boxShadow: isCalToday ? shadows.brandGlow : 'none',
                        color: colors.text,
                      }}
                    >
                      <span className="text-xs font-semibold" style={{ color: isCalToday ? colors.primary : colors.text }}>
                        {d.day_label || `Day ${d.day_number}`}
                      </span>
                      <span className="text-[11px] mt-0.5" style={{ color: colors.muted }}>{shortDate}</span>
                      <span className="flex items-center gap-1 mt-1.5 text-[10px]" style={{ color: colors.muted }}>
                        {isCalToday && (
                          <span className="font-semibold uppercase tracking-wide" style={{ color: colors.primary }}>Today</span>
                        )}
                        {hasTargets && !isCalToday && <span>Targets set</span>}
                        {(d.morning_checkin_required || d.evening_checkin_required) && <span>CI</span>}
                        {d.posing_required && <span>Pose</span>}
                        {isReviewed && <span style={{ color: colors.success }}>Reviewed</span>}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2">
              {days.map((d, index) => {
                const isExpanded = editMode === 'overview' || expandedDay === index;
                const isCalToday = d.target_date === todayStr;
                const reviewedLabel = d.reviewed_at
                  ? new Date(d.reviewed_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
                  : null;
                return (
                  <Card
                    key={d.day_number}
                    id={`peak-day-anchor-${index}`}
                    style={{
                      ...cardStyle,
                      padding: spacing[12],
                      border: editMode === 'overview' && isCalToday ? `2px solid ${colors.primary}` : cardStyle.border,
                      boxShadow: editMode === 'overview' && isCalToday ? shadows.brandGlow : undefined,
                    }}
                  >
                    {editMode === 'overview' ? (
                      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                        <div>
                          <span className="font-semibold" style={{ color: colors.text }}>
                            {d.day_label || `Day ${d.day_number}`}
                          </span>
                          {d.target_date && (
                            <span className="text-sm ml-2" style={{ color: colors.muted }}>
                              {d.target_date}
                            </span>
                          )}
                          {isCalToday && (
                            <span
                              className="ml-2 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full"
                              style={{ background: colors.primarySubtle, color: colors.primary }}
                            >
                              Today
                            </span>
                          )}
                          {reviewedLabel && (
                            <span
                              className="ml-2 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full"
                              style={{ background: colors.successSubtle, color: colors.success }}
                            >
                              Reviewed
                            </span>
                          )}
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="w-full flex items-center justify-between text-left"
                        onClick={() => setExpandedDay(isExpanded && expandedDay === index ? -1 : index)}
                      >
                        <span className="font-medium" style={{ color: colors.text }}>
                          {d.day_label || `Day ${d.day_number}`}
                          {d.target_date ? ` · ${d.target_date}` : ''}
                          {isCalToday && (
                            <span className="ml-2 text-[10px] font-bold uppercase align-middle" style={{ color: colors.primary }}>
                              Today
                            </span>
                          )}
                          {reviewedLabel && (
                            <span className="ml-2 text-[10px] font-bold uppercase align-middle" style={{ color: colors.success }}>
                              Reviewed
                            </span>
                          )}
                        </span>
                        {isExpanded ? <ChevronUp size={18} style={{ color: colors.muted }} /> : <ChevronDown size={18} style={{ color: colors.muted }} />}
                      </button>
                    )}
                    {isExpanded && (
                      <div className={`${editMode === 'overview' ? '' : 'mt-4 pt-4 border-t'} space-y-3`} style={{ borderColor: colors.border }}>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
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
                            <Label className="text-xs" style={{ color: colors.muted }}>Protein (g)</Label>
                            <Input
                              type="number"
                              value={d.protein_g ?? ''}
                              onChange={(e) => updateDay(index, 'protein_g', e.target.value === '' ? null : e.target.value)}
                              className="mt-1 bg-black/20 border border-white/10 text-white"
                            />
                          </div>
                          <div>
                            <Label className="text-xs" style={{ color: colors.muted }}>Fats (g)</Label>
                            <Input
                              type="number"
                              value={d.fats_g ?? ''}
                              onChange={(e) => updateDay(index, 'fats_g', e.target.value === '' ? null : e.target.value)}
                              className="mt-1 bg-black/20 border border-white/10 text-white"
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
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
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <div>
                            <Label className="text-xs" style={{ color: colors.muted }}>Steps target</Label>
                            <Input
                              type="number"
                              value={d.steps_target ?? ''}
                              onChange={(e) => updateDay(index, 'steps_target', e.target.value === '' ? null : e.target.value)}
                              className="mt-1 bg-black/20 border border-white/10 text-white"
                            />
                          </div>
                          <div>
                            <Label className="text-xs" style={{ color: colors.muted }}>Cardio (min)</Label>
                            <Input
                              type="number"
                              value={d.cardio_minutes ?? ''}
                              onChange={(e) => updateDay(index, 'cardio_minutes', e.target.value === '' ? null : e.target.value)}
                              className="mt-1 bg-black/20 border border-white/10 text-white"
                            />
                          </div>
                        </div>
                        <div>
                          <Label className="text-xs" style={{ color: colors.muted }}>Training type</Label>
                          <select
                            value={d.training_type ?? ''}
                            onChange={(e) => updateDay(index, 'training_type', e.target.value || null)}
                            className="mt-1 w-full rounded-lg bg-black/20 border border-white/10 text-white p-2"
                            style={{ color: colors.text }}
                          >
                            <option value="">Select training type</option>
                            {TRAINING_TYPE_OPTIONS.map((opt) => (
                              <option key={opt} value={opt}>{opt.replaceAll('_', ' ')}</option>
                            ))}
                          </select>
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
                              checked={Boolean(d.morning_checkin_required)}
                              onChange={(e) => updateDay(index, 'morning_checkin_required', e.target.checked)}
                              className="rounded border-white/20"
                            />
                            <span className="text-sm" style={{ color: colors.text }}>Morning check-in required</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={Boolean(d.evening_checkin_required)}
                              onChange={(e) => updateDay(index, 'evening_checkin_required', e.target.checked)}
                              className="rounded border-white/20"
                            />
                            <span className="text-sm" style={{ color: colors.text }}>Evening check-in required</span>
                          </label>
                        </div>
                        <div>
                          <Label className="text-xs" style={{ color: colors.muted }}>Posing notes</Label>
                          <Textarea
                            value={d.posing_notes ?? ''}
                            onChange={(e) => updateDay(index, 'posing_notes', e.target.value)}
                            rows={2}
                            className="mt-1 bg-black/20 border border-white/10 text-white"
                          />
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
                        <div className="flex flex-wrap gap-2 pt-1">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => { hapticLight(); copyPreviousDay(index); }}
                            disabled={index === 0}
                          >
                            Copy previous day
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => { hapticLight(); resetDay(index); }}
                          >
                            Reset day
                          </Button>
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
