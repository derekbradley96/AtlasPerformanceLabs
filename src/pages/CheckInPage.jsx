/**
 * Focus-aware Client Check-In submission screen.
 * Uses public.checkins (Check-In Engine); focus from profile / coach.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import TopBar from '@/components/ui/TopBar';
import Card from '@/ui/Card';
import { Button } from '@/components/ui/button';
import { colors, spacing } from '@/ui/tokens';
import {
  getWeekStartISO,
  getMyClientId,
  getCheckinForWeek,
  getFocusTypeForCurrentUser,
  submitCheckin,
  uploadCheckinPhoto,
  updateCheckinPhotos,
} from '@/lib/checkins';
import { trackFriction, trackRecoverableError } from '@/services/frictionTracker';
import { ChevronDown, ChevronRight, ImagePlus } from 'lucide-react';

function Field({ label, name, value, onChange, type = 'number', min, max, placeholder }) {
  const v = value ?? '';
  return (
    <div style={{ marginBottom: spacing[12] }}>
      <label className="block text-sm font-medium mb-1" style={{ color: colors.muted }}>{label}</label>
      {type === 'textarea' ? (
        <textarea
          name={name}
          value={v}
          onChange={(e) => onChange(name, e.target.value)}
          placeholder={placeholder}
          rows={3}
          className="w-full rounded-lg border bg-black/20 text-white placeholder:text-gray-500"
          style={{ padding: 10, borderColor: colors.border }}
        />
      ) : (
        <input
          type={type}
          name={name}
          value={v}
          onChange={(e) => onChange(name, type === 'number' ? (e.target.value === '' ? null : Number(e.target.value)) : e.target.value)}
          min={min}
          max={max}
          placeholder={placeholder}
          className="w-full rounded-lg border bg-black/20 text-white placeholder:text-gray-500"
          style={{ padding: 10, borderColor: colors.border }}
        />
      )}
    </div>
  );
}

function Section({ title, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Card style={{ marginBottom: spacing[16], padding: spacing[16] }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between text-left"
        style={{ color: colors.text, fontWeight: 600, marginBottom: open ? spacing[12] : 0 }}
      >
        {title}
        {open ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
      </button>
      {open && children}
    </Card>
  );
}

export default function CheckInPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [clientId, setClientId] = useState(null);
  const [focusType, setFocusType] = useState('transformation');
  const [weekStart, setWeekStart] = useState('');
  const [existing, setExisting] = useState(null);
  const [form, setForm] = useState({});
  const [photoFiles, setPhotoFiles] = useState([]);

  const setField = useCallback((name, value) => {
    setForm((f) => ({ ...f, [name]: value }));
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const w = getWeekStartISO();
      setWeekStart(w);
      const focus = await getFocusTypeForCurrentUser();
      if (cancelled) return;
      setFocusType(focus);
      const cid = await getMyClientId();
      if (cancelled) return;
      setClientId(cid);
      if (cid) {
        const ex = await getCheckinForWeek(cid, w);
        if (!cancelled) setExisting(ex);
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const handlePhotoChange = (e) => {
    const files = Array.from(e.target.files || []);
    setPhotoFiles((prev) => [...prev, ...files]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!clientId || existing || submitting) return;
    setSubmitting(true);
    try {
      const payload = {
        client_id: clientId,
        week_start: weekStart,
        focus_type: focusType,
        weight: form.weight ?? null,
        steps_avg: form.steps_avg ?? null,
        sleep_score: form.sleep_score ?? null,
        energy_level: form.energy_level ?? null,
        training_completion: form.training_completion ?? null,
        nutrition_adherence: form.nutrition_adherence ?? null,
        cardio_completion: form.cardio_completion ?? null,
        posing_minutes: form.posing_minutes ?? null,
        pump_quality: form.pump_quality ?? null,
        digestion_score: form.digestion_score ?? null,
        condition_notes: form.condition_notes ?? null,
        wins: form.wins ?? null,
        struggles: form.struggles ?? null,
        questions: form.questions ?? null,
        photos: [],
      };
      const row = await submitCheckin(payload);
      if (!row?.id) {
        trackFriction('checkin_submit_failed', { phase: 'submit', client_id: clientId });
        trackRecoverableError('CheckInPage', 'submitCheckin', 'submit returned no row');
        toast.error('Failed to submit check-in');
        return;
      }
      const paths = [];
      for (const file of photoFiles) {
        const path = await uploadCheckinPhoto({ clientId, checkinId: row.id, file });
        if (path) paths.push(path);
      }
      if (paths.length > 0) await updateCheckinPhotos(row.id, paths);
      toast.success('Check-in submitted');
      setExisting(row);
      setPhotoFiles([]);
    } catch (err) {
      trackFriction('checkin_submit_failed', { phase: 'submit', client_id: clientId, error: err?.message });
      trackRecoverableError('CheckInPage', 'submitCheckin', err);
      toast.error('Failed to submit check-in');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen" style={{ background: colors.bg, color: colors.text }}>
        <TopBar title="Check-in" onBack={() => navigate(-1)} />
        <div className="p-4 flex items-center justify-center" style={{ minHeight: 200 }}>
          <p style={{ color: colors.muted }}>Loading…</p>
        </div>
      </div>
    );
  }

  if (!clientId) {
    return (
      <div className="min-h-screen" style={{ background: colors.bg, color: colors.text }}>
        <TopBar title="Check-in" onBack={() => navigate(-1)} />
        <div className="p-6 text-center">
          <p style={{ color: colors.muted, marginBottom: spacing[16] }}>
            Link your account to a coach to submit check-ins.
          </p>
          <Button variant="outline" onClick={() => navigate(-1)}>Go back</Button>
        </div>
      </div>
    );
  }

  if (existing) {
    return (
      <div className="min-h-screen" style={{ background: colors.bg, color: colors.text }}>
        <TopBar title="Check-in" onBack={() => navigate(-1)} />
        <div className="p-6 text-center">
          <p style={{ color: colors.text, fontWeight: 600, marginBottom: spacing[8] }}>Already submitted</p>
          <p style={{ color: colors.muted, marginBottom: spacing[16] }}>
            You’ve already submitted a check-in for the week of {weekStart}.
          </p>
          <Button variant="outline" onClick={() => navigate(-1)}>Go back</Button>
        </div>
      </div>
    );
  }

  const isTransformation = focusType === 'transformation';
  const isCompetition = focusType === 'competition';
  const isIntegrated = focusType === 'integrated';

  return (
    <div className="min-h-screen" style={{ background: colors.bg, color: colors.text }}>
      <TopBar title="Check-in" onBack={() => navigate(-1)} />
      <form onSubmit={handleSubmit} className="p-4 pb-8" style={{ paddingBottom: spacing[32] }}>
        <p className="text-sm mb-4" style={{ color: colors.muted }}>
          Week of {weekStart} · {focusType.charAt(0).toUpperCase() + focusType.slice(1)}
        </p>

        {isIntegrated && (
          <>
            <Section title="Lifestyle" defaultOpen={true}>
              <Field label="Weight" name="weight" value={form.weight} onChange={setField} />
              <Field label="Steps (avg)" name="steps_avg" value={form.steps_avg} onChange={setField} />
              <Field label="Sleep score (1–10)" name="sleep_score" value={form.sleep_score} onChange={setField} type="number" min={1} max={10} />
              <Field label="Energy level (1–10)" name="energy_level" value={form.energy_level} onChange={setField} type="number" min={1} max={10} />
              <Field label="Nutrition adherence (%)" name="nutrition_adherence" value={form.nutrition_adherence} onChange={setField} type="number" min={0} max={100} />
            </Section>
            <Section title="Training" defaultOpen={true}>
              <Field label="Training completion (%)" name="training_completion" value={form.training_completion} onChange={setField} type="number" min={0} max={100} />
              <Field label="Cardio completion (%)" name="cardio_completion" value={form.cardio_completion} onChange={setField} type="number" min={0} max={100} />
            </Section>
            <Section title="Prep" defaultOpen={true}>
              <Field label="Posing (min)" name="posing_minutes" value={form.posing_minutes} onChange={setField} type="number" min={0} />
              <Field label="Pump quality (1–10)" name="pump_quality" value={form.pump_quality} onChange={setField} type="number" min={1} max={10} />
              <Field label="Digestion score (1–10)" name="digestion_score" value={form.digestion_score} onChange={setField} type="number" min={1} max={10} />
              <Field label="Condition notes" name="condition_notes" value={form.condition_notes} onChange={setField} type="textarea" placeholder="Optional" />
            </Section>
            <Section title="Notes" defaultOpen={true}>
              <Field label="Wins" name="wins" value={form.wins} onChange={setField} type="textarea" placeholder="Optional" />
              <Field label="Struggles" name="struggles" value={form.struggles} onChange={setField} type="textarea" placeholder="Optional" />
              <Field label="Questions" name="questions" value={form.questions} onChange={setField} type="textarea" placeholder="Optional" />
            </Section>
          </>
        )}

        {isTransformation && !isIntegrated && (
          <Card style={{ marginBottom: spacing[16], padding: spacing[16] }}>
            <Field label="Weight" name="weight" value={form.weight} onChange={setField} />
            <Field label="Steps (avg)" name="steps_avg" value={form.steps_avg} onChange={setField} />
            <Field label="Sleep score (1–10)" name="sleep_score" value={form.sleep_score} onChange={setField} type="number" min={1} max={10} />
            <Field label="Energy level (1–10)" name="energy_level" value={form.energy_level} onChange={setField} type="number" min={1} max={10} />
            <Field label="Nutrition adherence (%)" name="nutrition_adherence" value={form.nutrition_adherence} onChange={setField} type="number" min={0} max={100} />
            <Field label="Wins" name="wins" value={form.wins} onChange={setField} type="textarea" placeholder="Optional" />
            <Field label="Struggles" name="struggles" value={form.struggles} onChange={setField} type="textarea" placeholder="Optional" />
            <Field label="Questions" name="questions" value={form.questions} onChange={setField} type="textarea" placeholder="Optional" />
          </Card>
        )}

        {isCompetition && !isIntegrated && (
          <>
            <Card style={{ marginBottom: spacing[16], padding: spacing[16] }}>
              <Field label="Weight" name="weight" value={form.weight} onChange={setField} />
              <Field label="Training completion (%)" name="training_completion" value={form.training_completion} onChange={setField} type="number" min={0} max={100} />
              <Field label="Cardio completion (%)" name="cardio_completion" value={form.cardio_completion} onChange={setField} type="number" min={0} max={100} />
              <Field label="Sleep score (1–10)" name="sleep_score" value={form.sleep_score} onChange={setField} type="number" min={1} max={10} />
              <Field label="Energy level (1–10)" name="energy_level" value={form.energy_level} onChange={setField} type="number" min={1} max={10} />
              <Field label="Digestion score (1–10)" name="digestion_score" value={form.digestion_score} onChange={setField} type="number" min={1} max={10} />
              <Field label="Posing (min)" name="posing_minutes" value={form.posing_minutes} onChange={setField} type="number" min={0} />
              <Field label="Pump quality (1–10)" name="pump_quality" value={form.pump_quality} onChange={setField} type="number" min={1} max={10} />
              <Field label="Condition notes" name="condition_notes" value={form.condition_notes} onChange={setField} type="textarea" placeholder="Optional" />
              <Field label="Wins" name="wins" value={form.wins} onChange={setField} type="textarea" placeholder="Optional" />
              <Field label="Struggles" name="struggles" value={form.struggles} onChange={setField} type="textarea" placeholder="Optional" />
              <Field label="Questions" name="questions" value={form.questions} onChange={setField} type="textarea" placeholder="Optional" />
            </Card>
          </>
        )}

        <Card style={{ marginBottom: spacing[16], padding: spacing[16] }}>
          <label className="block text-sm font-medium mb-2" style={{ color: colors.muted }}>Photos</label>
          <input
            type="file"
            multiple
            accept="image/*"
            onChange={handlePhotoChange}
            className="sr-only"
            id="checkin-photos"
          />
          <label
            htmlFor="checkin-photos"
            className="flex items-center justify-center gap-2 rounded-lg border border-dashed cursor-pointer py-4"
            style={{ borderColor: colors.border, color: colors.muted }}
          >
            <ImagePlus size={20} />
            <span>{photoFiles.length > 0 ? `${photoFiles.length} selected` : 'Select images'}</span>
          </label>
        </Card>

        <Button
          type="submit"
          disabled={submitting}
          className="w-full"
          style={{ minHeight: 48 }}
        >
          {submitting ? 'Submitting…' : 'Submit check-in'}
        </Button>
      </form>
    </div>
  );
}
