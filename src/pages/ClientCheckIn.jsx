import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { hasSupabase, getSupabase } from '@/lib/supabaseClient';
import { getWeekStartISO, uploadCheckinPhoto } from '@/lib/checkins';
import { getMyClientProfile } from '@/lib/clientProfiles';
import { upsert } from '@/data/supabaseCheckinsRepo';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createPageUrl } from '@/utils';
import { CheckCircle2, Upload, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { PageLoader } from '@/components/ui/LoadingState';
import { toast } from 'sonner';
import { trackCheckinSubmitted, trackProgressPhotoUploaded } from '@/services/engagementTracker';
import { notifyCoachCheckinSubmitted } from '@/services/notificationTriggers';
import { trackFirstCheckinOpened } from '@/services/firstSessionTracker';
import MeasurementUnitSegments, { WEIGHT_SEGMENT_OPTIONS } from '@/components/measurements/MeasurementUnitSegments';
import { resolveViewerBodyweightUnit, normalizeWeightUnit, parseWeightInputsToKg, weightUnitShortLabel } from '@/lib/bodyMeasurementUnits';
import { atlasMigrationDataAttributes, deriveClientCheckInLegacyRouteState } from '@/lib/atlasMigrationPhases';

const WEEK_EMOJIS = [
  { value: '🔥', label: 'Crushed it' },
  { value: '😊', label: 'Good week' },
  { value: '😐', label: 'Average' },
  { value: '😔', label: 'Tough week' },
  { value: '💪', label: 'Pushed through' },
];

const stepMeta = {
  photos: { title: 'How are you looking?', description: 'Upload progress photos so your coach can assess visual change.' },
  body: { title: 'Bodyweight', description: 'Log your current bodyweight for this check-in.' },
  measurements: { title: 'Measurements', description: 'Optional body measurements to track shape changes over time.' },
  nutrition: { title: 'Nutrition & hydration', description: 'Share your nutrition consistency and recovery signals.' },
  training: { title: 'Training', description: 'Report how well you executed sessions and recovered.' },
  wellbeing: { title: 'Wellbeing', description: 'Give your coach context on recovery and stress readiness.' },
  competition: { title: 'Competition prep', description: 'Add prep-specific feedback for posing and stage condition.' },
  highlights: { title: 'Highlights', description: 'Share the biggest win and the biggest challenge this week.' },
  questions: { title: 'Coach questions', description: 'Answer your coach’s custom check-in prompts.' },
  notes: { title: 'Final notes', description: 'Anything else you want your coach to know this week.' },
};

function parseIntOrNull(value) {
  const n = parseInt(value, 10);
  return Number.isFinite(n) ? n : null;
}

function parseFloatOrNull(value) {
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : null;
}

function scoreTone(value) {
  if (value == null) return '#64748b';
  if (value < 50) return '#ef4444';
  if (value < 80) return '#f59e0b';
  return '#22c55e';
}

function scorePillTone(value) {
  if (value == null) return { bg: 'rgba(100,116,139,0.2)', color: '#94a3b8' };
  if (value <= 3) return { bg: 'rgba(239,68,68,0.2)', color: '#ef4444' };
  if (value <= 6) return { bg: 'rgba(245,158,11,0.2)', color: '#f59e0b' };
  return { bg: 'rgba(34,197,94,0.2)', color: '#22c55e' };
}

function NumericScale({ value, onChange, min = 1, max = 10 }) {
  return (
    <div className="grid grid-cols-5 gap-2 sm:grid-cols-10">
      {Array.from({ length: max - min + 1 }).map((_, idx) => {
        const n = min + idx;
        const selected = String(value) === String(n);
        return (
          <button
            key={n}
            type="button"
            onClick={() => onChange(String(n))}
            className={`rounded-lg py-2 text-sm font-medium transition ${
              selected ? 'bg-blue-500 text-white' : 'bg-slate-900/60 text-slate-300 hover:bg-slate-900'
            }`}
          >
            {n}
          </button>
        );
      })}
    </div>
  );
}

export default function ClientCheckIn() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, updateProfile } = useAuth();
  const supabase = getSupabase();
  const [uploading, setUploading] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [draftRestored, setDraftRestored] = useState(false);
  const [weightUnitLocal, setWeightUnitLocal] = useState(() => resolveViewerBodyweightUnit(null));
  const [weightSt, setWeightSt] = useState('');
  const [weightLbRem, setWeightLbRem] = useState('');
  const [pendingPhotos, setPendingPhotos] = useState([]);
  const [photoPreviewUrls, setPhotoPreviewUrls] = useState([]);
  const [weekMoodEmoji, setWeekMoodEmoji] = useState('');
  const previewUrlsRef = useRef(new Set());
  const [formData, setFormData] = useState({
    // Body
    weight_kg: '',
    weight: '',
    waist_cm: '',
    chest_cm: '',
    hip_cm: '',
    thigh_cm: '',
    arm_cm: '',
    // Nutrition
    nutrition_adherence: '',
    water_litres: '',
    hunger_level: '',
    cravings_level: '',
    digestion_score: '',
    supplement_adherence: '',
    // Training
    training_completion: '',
    cardio_completion: '',
    strength_feeling: '',
    pump_quality: '',
    recovery_score: '',
    steps_avg: '',
    // Wellbeing
    energy_level: '',
    mood_level: '',
    sleep_score: '',
    sleep_hours: '',
    stress_level: '',
    libido_level: '',
    // Competition
    posing_minutes: '',
    stage_condition_notes: '',
    symmetry_notes: '',
    peak_week_water_litres: '',
    peak_week_sodium_mg: '',
    peak_week_carb_g: '',
    // Qualitative
    wins: '',
    struggles: '',
    coach_questions: '',
    answers: [],
    notes: '',
  });
  const weekStart = getWeekStartISO();
  const draftKey = user?.id ? `atlas_checkin_draft_${user.id}_${weekStart}` : null;

  const releasePreviewUrl = (url) => {
    if (!url) return;
    URL.revokeObjectURL(url);
    previewUrlsRef.current.delete(url);
  };

  const releaseAllPreviewUrls = () => {
    for (const url of previewUrlsRef.current) {
      URL.revokeObjectURL(url);
    }
    previewUrlsRef.current.clear();
  };

  const { data: clientProfile, isLoading: clientProfileLoading, isError: clientProfileError } = useQuery({
    queryKey: ['client-profile', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      return getMyClientProfile(user.id);
    },
    enabled: !!user?.id && !!supabase,
  });

  const coachIdForTemplate = clientProfile?.trainer_id ?? clientProfile?.coach_id;

  const { data: template, isLoading: templateLoading } = useQuery({
    queryKey: ['client-template', clientProfile?.id, clientProfile?.checkin_template_id],
    queryFn: async () => {
      const db = getSupabase();
      if (!db || !clientProfile?.id) return null;
      const selectCols = `
        id, name, frequency, is_active, questions, focus_type,
        include_bodyweight, include_photos, include_energy, include_mood, include_sleep,
        include_stress, include_libido, include_water, include_hunger, include_digestion,
        include_supplements, include_cardio, include_steps, include_strength_feeling,
        include_pump, include_recovery, include_measurements, include_waist,
        include_posing, include_stage_condition, include_symmetry, include_peak_week_metrics,
        include_wins, include_struggles, include_coach_questions_field,
        schedule_day_of_week, schedule_time
      `;

      if (clientProfile.checkin_template_id) {
        const { data } = await db
          .from('checkin_templates')
          .select(selectCols)
          .eq('id', clientProfile.checkin_template_id)
          .eq('is_active', true)
          .maybeSingle();
        if (data) return data;
      }

      const coachId = clientProfile.trainer_id ?? clientProfile.coach_id;
      if (!coachId) return null;
      const { data } = await db
        .from('checkin_templates')
        .select(selectCols)
        .or(`trainer_id.eq.${coachId},coach_id.eq.${coachId}`)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      return data ?? null;
    },
    enabled: !!clientProfile?.id,
  });

  const { data: pendingCheckin, isLoading: pendingLoading } = useQuery({
    queryKey: ['pending-checkin', clientProfile?.id],
    queryFn: async () => {
      if (!supabase || !clientProfile?.id) return null;
      const { data } = await supabase
        .from('checkins')
        .select('id, client_id, status, submitted_at, due_date, coach_reviewed_at, template_id, week_start')
        .eq('client_id', clientProfile.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      return data ?? null;
    },
    enabled: !!clientProfile?.id && !!supabase && !!template,
  });

  const legacyCheckinMigrationAttrs = useMemo(() => {
    let surface = 'loading';
    if (user && clientProfile) {
      if (!coachIdForTemplate) surface = 'no_trainer';
      else if (templateLoading) surface = 'template_loading';
      else if (!template) surface = 'no_template';
      else if (pendingLoading) surface = 'pending_loading';
      else surface = 'form';
    }
    const s = deriveClientCheckInLegacyRouteState({ surface });
    return atlasMigrationDataAttributes(s.phase, s.primary);
  }, [user, clientProfile, coachIdForTemplate, templateLoading, template, pendingLoading]);

  useEffect(() => {
    if (!user?.id) return;
    trackFirstCheckinOpened(user.id, {});
  }, [user?.id]);

  useEffect(
    () => () => {
      releaseAllPreviewUrls();
    },
    []
  );

  useEffect(() => {
    if (!draftKey) return;
    try {
      localStorage.setItem(draftKey, JSON.stringify({ formData, currentStep, weekMoodEmoji }));
    } catch {}
  }, [draftKey, formData, currentStep, weekMoodEmoji]);

  useEffect(() => {
    if (!draftKey || draftRestored || clientProfileLoading) return;
    try {
      const raw = localStorage.getItem(draftKey);
      if (!raw) return;
      const saved = JSON.parse(raw);
      if (saved?.formData) setFormData((prev) => ({ ...prev, ...saved.formData }));
      if (saved?.currentStep && typeof saved.currentStep === 'number') setCurrentStep(saved.currentStep);
      if (saved?.weekMoodEmoji) setWeekMoodEmoji(saved.weekMoodEmoji);
    } catch {}
    setDraftRestored(true);
  }, [draftKey, draftRestored, clientProfileLoading]);

  const steps = useMemo(() => {
    if (!template) return [];
    const s = [];
    if (template.include_photos) s.push('photos');
    if (template.include_bodyweight) s.push('body');
    if (template.include_measurements || template.include_waist) s.push('measurements');
    if (template.include_water || template.include_hunger || template.include_digestion || template.include_supplements) s.push('nutrition');
    if (template.include_cardio || template.include_steps || template.include_strength_feeling || template.include_pump || template.include_recovery) s.push('training');
    if (template.include_energy || template.include_mood || template.include_sleep || template.include_stress || template.include_libido) s.push('wellbeing');
    if (template.focus_type === 'competition' && (template.include_posing || template.include_stage_condition || template.include_symmetry || template.include_peak_week_metrics)) s.push('competition');
    if (template.include_wins || template.include_struggles) s.push('highlights');
    if (template.questions?.length > 0) s.push('questions');
    s.push('notes');
    return s;
  }, [template]);

  const currentStepKey = steps[currentStep - 1];
  const totalSteps = steps.length;

  useEffect(() => {
    if (currentStep > totalSteps && totalSteps > 0) {
      setCurrentStep(totalSteps);
    }
  }, [currentStep, totalSteps]);

  const submitMutation = useMutation({
    mutationFn: async (data) => {
      if (!hasSupabase) throw new Error('Check-ins require a live connection.');
      const db = getSupabase();
      if (!db || !user?.id) throw new Error('Check-ins require a live connection.');
      const owner = clientProfile?.id ? clientProfile : await getMyClientProfile(user.id);
      if (!owner?.id) throw new Error('Could not resolve your client account');
      const trainerId = owner.trainer_id ?? owner.coach_id;
      if (!trainerId) throw new Error('No coach linked to your profile yet');

      const weekStart = pendingCheckin?.week_start || getWeekStartISO(new Date());
      const updated = await upsert(trainerId, {
        client_id: owner.id,
        checkin_date: weekStart,
        week_start: weekStart,
        focus_type: template?.focus_type || 'transformation',
        weight: data.weight,
        weight_kg: data.weight_kg,
        waist_cm: data.waist_cm,
        chest_cm: data.chest_cm,
        hip_cm: data.hip_cm,
        thigh_cm: data.thigh_cm,
        arm_cm: data.arm_cm,
        nutrition_adherence: data.nutrition_adherence,
        water_litres: data.water_litres,
        hunger_level: data.hunger_level,
        cravings_level: data.cravings_level,
        digestion_score: data.digestion_score,
        supplement_adherence: data.supplement_adherence,
        training_completion: data.training_completion,
        cardio_completion: data.cardio_completion,
        strength_feeling: data.strength_feeling,
        pump_quality: data.pump_quality,
        recovery_score: data.recovery_score,
        steps_avg: data.steps_avg,
        energy_level: data.energy_level,
        mood_level: data.mood_level,
        sleep_score: data.sleep_score,
        sleep_hours: data.sleep_hours,
        stress_level: data.stress_level,
        libido_level: data.libido_level,
        posing_minutes: data.posing_minutes,
        stage_condition_notes: data.stage_condition_notes,
        symmetry_notes: data.symmetry_notes,
        peak_week_water_litres: data.peak_week_water_litres,
        peak_week_sodium_mg: data.peak_week_sodium_mg,
        peak_week_carb_g: data.peak_week_carb_g,
        wins: data.wins,
        struggles: data.struggles,
        coach_questions: data.coach_questions,
        answers: data.answers,
        notes: data.notes,
        status: 'submitted',
        submitted_at: new Date().toISOString(),
        photos: [],
      });

      const uploadedPhotoUrls = [];
      if (pendingPhotos.length > 0 && updated?.id) {
        setUploading(true);
        try {
          for (const file of pendingPhotos) {
            const path = await uploadCheckinPhoto({ checkinId: updated.id, clientId: owner.id, file });
            if (path) uploadedPhotoUrls.push(path);
          }
          if (uploadedPhotoUrls.length > 0) {
            await db.from('checkins').update({ photos: uploadedPhotoUrls }).eq('id', updated.id);
          }
        } finally {
          setUploading(false);
        }
      }

      return { checkin: updated, uploadedPhotoUrls };
    },
    onSuccess: (result, payload) => {
      queryClient.invalidateQueries(['pending-checkin']);
      const savedCheckinId = result?.checkin?.id ?? pendingCheckin?.id;
      const uploadedPhotoUrls = Array.isArray(result?.uploadedPhotoUrls) ? result.uploadedPhotoUrls : [];
      if (clientProfile?.id) {
        const coachId = clientProfile.trainer_id ?? clientProfile.coach_id;
        trackCheckinSubmitted(clientProfile.id, coachId, { checkin_id: savedCheckinId }).catch(() => {});
        if (coachId) notifyCoachCheckinSubmitted(coachId, clientProfile.id, savedCheckinId).catch(() => {});
        if (uploadedPhotoUrls.length) {
          trackProgressPhotoUploaded(clientProfile.id, coachId, { checkin_id: savedCheckinId, photo_count: uploadedPhotoUrls.length }).catch(() => {});
        }
      }
      releaseAllPreviewUrls();
      setPendingPhotos([]);
      setPhotoPreviewUrls([]);
      void import('@/lib/haptics').then((m) => m.notificationSuccess?.()).catch(() => {});
      void import('@/lib/appReview')
        .then((m) => m.maybeRequestReview(m.incrementReviewActionCount()))
        .catch(() => {});
      void import('canvas-confetti')
        .then((mod) => {
          const confetti = mod?.default || mod;
          if (typeof confetti === 'function') {
            confetti({ particleCount: 70, spread: 65, origin: { y: 0.7 }, disableForReducedMotion: true });
          }
        })
        .catch(() => {});
      toast.success('Check-in submitted — nice work this week!');
      if (draftKey) {
        try {
          localStorage.removeItem(draftKey);
        } catch {}
      }
      navigate(createPageUrl('Home'));
    },
    onError: (error) => toast.error(error?.message || 'Failed to submit check-in'),
  });

  const handlePhotoUpload = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setPendingPhotos((prev) => [...prev, ...files]);
    const newUrls = files.map((f) => URL.createObjectURL(f));
    newUrls.forEach((url) => previewUrlsRef.current.add(url));
    setPhotoPreviewUrls((prev) => [...prev, ...newUrls]);
    e.target.value = '';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const wU = normalizeWeightUnit(weightUnitLocal);
    const resolvedKg =
      wU === 'st_lb'
        ? parseWeightInputsToKg({ weightUnit: wU, stoneText: weightSt, poundText: weightLbRem })
        : wU === 'lb'
          ? parseWeightInputsToKg({ weightUnit: wU, lbText: formData.weight_kg })
          : parseWeightInputsToKg({ weightUnit: wU, kgText: formData.weight_kg });

    // Required custom questions were never enforced — 'required' in the
    // template builder was decorative until now.
    const missingRequired = (template?.questions || []).filter(
      (q) => q.required && !String(formData.answers?.[q.id] || '').trim()
    );
    if (missingRequired.length > 0) {
      toast.error(
        missingRequired.length === 1
          ? `Please answer: “${missingRequired[0].text}”`
          : `Please answer ${missingRequired.length} required coach questions`
      );
      // currentStep is 1-based (currentStepKey = steps[currentStep - 1]).
      setCurrentStep(steps.indexOf('questions') + 1);
      return;
    }

    const answers = (template?.questions || []).map((q) => ({
      question_id: q.id,
      question_text: q.text,
      answer: formData.answers?.[q.id] || '',
    }));

    const notesWithEmoji =
      weekMoodEmoji && formData.notes
        ? `${weekMoodEmoji} ${formData.notes}`
        : weekMoodEmoji
          ? `${weekMoodEmoji} ${WEEK_EMOJIS.find((x) => x.value === weekMoodEmoji)?.label || ''}`.trim()
          : formData.notes;

    await submitMutation.mutateAsync({
      weight: parseFloatOrNull(String(resolvedKg)),
      weight_kg: parseFloatOrNull(String(resolvedKg)),
      waist_cm: parseFloatOrNull(formData.waist_cm),
      chest_cm: parseFloatOrNull(formData.chest_cm),
      hip_cm: parseFloatOrNull(formData.hip_cm),
      thigh_cm: parseFloatOrNull(formData.thigh_cm),
      arm_cm: parseFloatOrNull(formData.arm_cm),
      nutrition_adherence: parseIntOrNull(formData.nutrition_adherence),
      water_litres: parseFloatOrNull(formData.water_litres),
      hunger_level: parseIntOrNull(formData.hunger_level),
      cravings_level: parseIntOrNull(formData.cravings_level),
      digestion_score: parseIntOrNull(formData.digestion_score),
      supplement_adherence: parseIntOrNull(formData.supplement_adherence),
      training_completion: parseIntOrNull(formData.training_completion),
      cardio_completion: parseIntOrNull(formData.cardio_completion),
      strength_feeling: parseIntOrNull(formData.strength_feeling),
      pump_quality: parseIntOrNull(formData.pump_quality),
      recovery_score: parseIntOrNull(formData.recovery_score),
      steps_avg: parseIntOrNull(formData.steps_avg),
      energy_level: parseIntOrNull(formData.energy_level),
      mood_level: parseIntOrNull(formData.mood_level),
      sleep_score: parseIntOrNull(formData.sleep_score),
      sleep_hours: parseFloatOrNull(formData.sleep_hours),
      stress_level: parseIntOrNull(formData.stress_level),
      libido_level: parseIntOrNull(formData.libido_level),
      posing_minutes: parseIntOrNull(formData.posing_minutes),
      stage_condition_notes: formData.stage_condition_notes || null,
      symmetry_notes: formData.symmetry_notes || null,
      peak_week_water_litres: parseFloatOrNull(formData.peak_week_water_litres),
      peak_week_sodium_mg: parseIntOrNull(formData.peak_week_sodium_mg),
      peak_week_carb_g: parseIntOrNull(formData.peak_week_carb_g),
      wins: formData.wins || null,
      struggles: formData.struggles || null,
      coach_questions: formData.coach_questions || null,
      answers,
      notes: notesWithEmoji || null,
    });
  };

  if (!user || clientProfileLoading) {
    return <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950" {...legacyCheckinMigrationAttrs}><PageLoader /></div>;
  }
  if (!hasSupabase) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-4 md:p-6 flex items-center justify-center" {...legacyCheckinMigrationAttrs}>
        <div className="text-center max-w-md">
          <Calendar className="w-16 h-16 text-slate-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">Live connection required</h2>
          <p className="text-slate-400 mb-6">Check-ins require a live connection. Demo mode does not support check-in submission.</p>
          <Button onClick={() => navigate(createPageUrl('Home'))}>Back to Home</Button>
        </div>
      </div>
    );
  }
  if (clientProfileError || !clientProfile) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-4 md:p-6 flex items-center justify-center" {...legacyCheckinMigrationAttrs}>
        <div className="text-center max-w-md">
          <Calendar className="w-16 h-16 text-slate-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">Couldn&apos;t load check-in profile</h2>
          <p className="text-slate-400 mb-6">We couldn&apos;t find your client profile yet. Return home and try again in a moment.</p>
          <Button onClick={() => navigate(createPageUrl('Home'))}>Back to Home</Button>
        </div>
      </div>
    );
  }
  if (!coachIdForTemplate) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-4 md:p-6 flex items-center justify-center" {...legacyCheckinMigrationAttrs}>
        <div className="text-center max-w-md">
          <Calendar className="w-16 h-16 text-slate-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">No coach linked</h2>
          <p className="text-slate-400 mb-6">Connect with your coach first so check-ins can load.</p>
          <Button onClick={() => navigate(createPageUrl('Home'))}>Back to Home</Button>
        </div>
      </div>
    );
  }
  if (templateLoading || pendingLoading) {
    return <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950" {...legacyCheckinMigrationAttrs}><PageLoader message="Loading check-in…" /></div>;
  }
  if (!template) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-4 md:p-6 flex items-center justify-center" {...legacyCheckinMigrationAttrs}>
        <div className="text-center max-w-md">
          <Calendar className="w-16 h-16 text-slate-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">No Check-In Template</h2>
          <p className="text-slate-400 mb-6">Your trainer hasn&apos;t set up check-ins yet.</p>
          <Button onClick={() => navigate(createPageUrl('Home'))}>Back to Home</Button>
        </div>
      </div>
    );
  }

  const progressPercent = totalSteps > 0 ? (currentStep / totalSteps) * 100 : 0;
  const meta = stepMeta[currentStepKey] || stepMeta.notes;
  const nutritionTone = scoreTone(parseIntOrNull(formData.nutrition_adherence));
  const trainingTone = scoreTone(parseIntOrNull(formData.training_completion));

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 pb-24" {...legacyCheckinMigrationAttrs}>
      <div className="p-4 md:p-6 border-b border-slate-800">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-white">Weekly Check-In</h1>
            <p className="text-xs text-slate-400">{meta.title} - {meta.description}</p>
          </div>
          <span className="text-sm text-slate-400">Step {currentStep}/{Math.max(totalSteps, 1)}</span>
        </div>
        <div className="w-full bg-slate-700 rounded-full h-1 overflow-hidden">
          <div className="h-full bg-blue-500 transition-all duration-300" style={{ width: `${progressPercent}%` }} />
        </div>
      </div>

      {draftRestored && currentStep > 1 && (
        <div
          style={{
            margin: '8px 16px 0',
            padding: '8px 12px',
            background: 'rgba(59,130,246,0.1)',
            borderRadius: 8,
            border: '1px solid rgba(59,130,246,0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <p style={{ margin: 0, fontSize: 13, color: '#93c5fd' }}>Draft restored — continuing from where you left off</p>
          <button
            type="button"
            onClick={() => setCurrentStep(1)}
            style={{ fontSize: 12, color: '#60a5fa', background: 'none', border: 'none', cursor: 'pointer', padding: '0 4px' }}
          >
            Start over
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="p-4 md:p-6 space-y-6">
        {currentStepKey === 'photos' && (
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-6">
            <h2 className="text-lg font-semibold text-white mb-2">{stepMeta.photos.title}</h2>
            <p className="text-sm text-slate-400 mb-4">{stepMeta.photos.description}</p>
            <div className="grid grid-cols-3 gap-2 mb-4 text-xs text-slate-400">
              <div className="rounded-lg border border-slate-700 p-2 text-center">Front</div>
              <div className="rounded-lg border border-slate-700 p-2 text-center">Side</div>
              <div className="rounded-lg border border-slate-700 p-2 text-center">Back</div>
            </div>
            <input id="photo-upload" type="file" accept="image/*" multiple onChange={handlePhotoUpload} className="hidden" />
            <label htmlFor="photo-upload" className="flex min-h-36 cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-700 hover:bg-slate-900/40">
              <Upload className="w-8 h-8 text-slate-400" />
              <span className="text-slate-300 font-medium">Tap to upload progress photos</span>
            </label>
            {photoPreviewUrls.length > 0 ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {photoPreviewUrls.map((url, i) => (
                  <button key={url} type="button" className="relative" onClick={() => {
                    setPendingPhotos((p) => p.filter((_, j) => j !== i));
                    setPhotoPreviewUrls((p) => p.filter((_, j) => j !== i));
                    releasePreviewUrl(url);
                  }}>
                    <img src={url} alt={`preview-${i + 1}`} className="h-24 w-24 rounded-lg object-cover" />
                    <span className="absolute -top-2 -right-2 h-5 w-5 rounded-full bg-red-500 text-xs text-white">x</span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        )}

        {currentStepKey === 'body' && (
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-6">
            <h2 className="text-lg font-semibold text-white mb-2">{stepMeta.body.title}</h2>
            <p className="text-sm text-slate-400 mb-4">This is the most important number this week.</p>
            <MeasurementUnitSegments
              label="Weight unit"
              options={WEIGHT_SEGMENT_OPTIONS}
              value={normalizeWeightUnit(weightUnitLocal)}
              onChange={async (id) => {
                const w = normalizeWeightUnit(id);
                setWeightUnitLocal(w);
                if (user?.id && typeof updateProfile === 'function') {
                  await updateProfile({ bodyweight_unit: w, units: w === 'lb' ? 'lb' : 'kg' });
                }
              }}
            />
            {normalizeWeightUnit(weightUnitLocal) === 'st_lb' ? (
              <div className="grid grid-cols-2 gap-3 mt-4">
                <Input type="text" inputMode="numeric" value={weightSt} onChange={(e) => setWeightSt(e.target.value.replace(/[^\d]/g, ''))} placeholder="Stone" className="bg-slate-900/50 border-slate-700 text-2xl py-7" />
                <Input type="text" inputMode="decimal" value={weightLbRem} onChange={(e) => /^\d*\.?\d*$/.test(e.target.value) && setWeightLbRem(e.target.value)} placeholder="Pounds" className="bg-slate-900/50 border-slate-700 text-2xl py-7" />
              </div>
            ) : (
              <div className="mt-4">
                <Input type="text" inputMode="decimal" value={formData.weight_kg} onChange={(e) => /^\d*\.?\d*$/.test(e.target.value) && setFormData({ ...formData, weight_kg: e.target.value })} placeholder={normalizeWeightUnit(weightUnitLocal) === 'lb' ? '175' : '75.5'} className="bg-slate-900/50 border-slate-700 text-3xl py-8" />
                <p className="text-xs text-slate-500 mt-2">{weightUnitShortLabel(weightUnitLocal)}</p>
              </div>
            )}
          </div>
        )}

        {currentStepKey === 'measurements' && (
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-6">
            <h2 className="text-lg font-semibold text-white mb-2">{stepMeta.measurements.title}</h2>
            <p className="text-sm text-slate-400 mb-4">Skip if not tracking measurements this week.</p>
            <div className="grid grid-cols-2 gap-3">
              {[
                ['waist_cm', '📏 Waist (cm)'],
                ['chest_cm', '📏 Chest (cm)'],
                ['hip_cm', '📏 Hip (cm)'],
                ['thigh_cm', '📏 Thigh (cm)'],
                ['arm_cm', '📏 Arm (cm)'],
              ].map(([key, label]) => (
                <Input key={key} type="text" inputMode="decimal" placeholder={label} value={formData[key]} onChange={(e) => /^\d*\.?\d*$/.test(e.target.value) && setFormData({ ...formData, [key]: e.target.value })} className="bg-slate-900/50 border-slate-700" />
              ))}
            </div>
          </div>
        )}

        {currentStepKey === 'nutrition' && (
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-6 space-y-5">
            <h2 className="text-lg font-semibold text-white mb-2">{stepMeta.nutrition.title}</h2>
            <p className="text-sm text-slate-400">{stepMeta.nutrition.description}</p>
            <div>
              <label className="text-sm text-slate-300">Nutrition adherence</label>
              <input type="range" min="0" max="100" step="1" value={formData.nutrition_adherence || 0} onChange={(e) => setFormData({ ...formData, nutrition_adherence: e.target.value })} className="w-full mt-2" />
              <p className="text-2xl font-bold mt-2" style={{ color: nutritionTone }}>{formData.nutrition_adherence || 0}%</p>
            </div>
            {template.include_water && <Input type="number" step="0.1" value={formData.water_litres} onChange={(e) => setFormData({ ...formData, water_litres: e.target.value })} placeholder="Water intake (litres)" className="bg-slate-900/50 border-slate-700" />}
            {template.include_hunger && (
              <div>
                <p className="text-sm text-slate-300 mb-2">Hunger level (1-10)</p>
                <NumericScale value={formData.hunger_level} onChange={(v) => setFormData({ ...formData, hunger_level: v })} />
              </div>
            )}
            {template.include_digestion && (
              <div>
                <p className="text-sm text-slate-300 mb-2">Digestion score (1-10)</p>
                <NumericScale value={formData.digestion_score} onChange={(v) => setFormData({ ...formData, digestion_score: v })} />
              </div>
            )}
            {template.include_supplements && <Input type="number" min="0" max="100" value={formData.supplement_adherence} onChange={(e) => setFormData({ ...formData, supplement_adherence: e.target.value })} placeholder="Supplement adherence %" className="bg-slate-900/50 border-slate-700" />}
          </div>
        )}

        {currentStepKey === 'training' && (
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-6 space-y-5">
            <h2 className="text-lg font-semibold text-white mb-2">{stepMeta.training.title}</h2>
            <p className="text-sm text-slate-400">{stepMeta.training.description}</p>
            <div>
              <label className="text-sm text-slate-300">Training completion</label>
              <input type="range" min="0" max="100" step="1" value={formData.training_completion || 0} onChange={(e) => setFormData({ ...formData, training_completion: e.target.value })} className="w-full mt-2" />
              <p className="text-2xl font-bold mt-2" style={{ color: trainingTone }}>{formData.training_completion || 0}%</p>
            </div>
            {template.include_cardio && <Input type="number" min="0" max="100" value={formData.cardio_completion} onChange={(e) => setFormData({ ...formData, cardio_completion: e.target.value })} placeholder="Cardio completion %" className="bg-slate-900/50 border-slate-700" />}
            {template.include_steps && <Input type="number" value={formData.steps_avg} onChange={(e) => setFormData({ ...formData, steps_avg: e.target.value })} placeholder="Average daily steps" className="bg-slate-900/50 border-slate-700" />}
            {template.include_strength_feeling && (
              <div>
                <p className="text-sm text-slate-300 mb-2">How heavy did the weights feel? (1-10)</p>
                <NumericScale value={formData.strength_feeling} onChange={(v) => setFormData({ ...formData, strength_feeling: v })} />
              </div>
            )}
            {template.include_pump && (
              <div>
                <p className="text-sm text-slate-300 mb-2">Pump quality (1-10)</p>
                <NumericScale value={formData.pump_quality} onChange={(v) => setFormData({ ...formData, pump_quality: v })} />
              </div>
            )}
            {template.include_recovery && (
              <div>
                <p className="text-sm text-slate-300 mb-2">Recovery score (1-10)</p>
                <NumericScale value={formData.recovery_score} onChange={(v) => setFormData({ ...formData, recovery_score: v })} />
              </div>
            )}
          </div>
        )}

        {currentStepKey === 'wellbeing' && (
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-6 space-y-5">
            <h2 className="text-lg font-semibold text-white mb-2">{stepMeta.wellbeing.title}</h2>
            <p className="text-sm text-slate-400">{stepMeta.wellbeing.description}</p>
            {template.include_energy && <div><p className="text-sm text-slate-300 mb-2">Energy (1-10)</p><NumericScale value={formData.energy_level} onChange={(v) => setFormData({ ...formData, energy_level: v })} /></div>}
            {template.include_sleep && (
              <>
                <div><p className="text-sm text-slate-300 mb-2">Sleep quality (1-10)</p><NumericScale value={formData.sleep_score} onChange={(v) => setFormData({ ...formData, sleep_score: v })} /></div>
                <Input type="number" step="0.1" value={formData.sleep_hours} onChange={(e) => setFormData({ ...formData, sleep_hours: e.target.value })} placeholder="Sleep hours" className="bg-slate-900/50 border-slate-700" />
              </>
            )}
            {template.include_mood && <div><p className="text-sm text-slate-300 mb-2">Mood (1-10)</p><NumericScale value={formData.mood_level} onChange={(v) => setFormData({ ...formData, mood_level: v })} /></div>}
            {template.include_stress && <div><p className="text-sm text-slate-300 mb-2">Stress (1-10)</p><NumericScale value={formData.stress_level} onChange={(v) => setFormData({ ...formData, stress_level: v })} /></div>}
            {template.include_libido && (
              <div>
                <p className="text-sm text-slate-300 mb-2">Libido (1-10)</p>
                <NumericScale value={formData.libido_level} onChange={(v) => setFormData({ ...formData, libido_level: v })} />
                <p className="text-xs text-slate-500 mt-2">This is a key indicator of overall health and recovery status.</p>
              </div>
            )}
          </div>
        )}

        {currentStepKey === 'competition' && (
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-6 space-y-4">
            <h2 className="text-lg font-semibold text-white mb-2">{stepMeta.competition.title}</h2>
            <p className="text-sm text-slate-400">{stepMeta.competition.description}</p>
            {template.include_posing && <Input type="number" value={formData.posing_minutes} onChange={(e) => setFormData({ ...formData, posing_minutes: e.target.value })} placeholder="Posing minutes this week" className="bg-slate-900/50 border-slate-700" />}
            {template.include_stage_condition && <Textarea rows={3} value={formData.stage_condition_notes} onChange={(e) => setFormData({ ...formData, stage_condition_notes: e.target.value })} placeholder="How do you look in the mirror? Describe your conditioning, fullness, dryness." className="bg-slate-900/50 border-slate-700" />}
            {template.include_symmetry && <Textarea rows={3} value={formData.symmetry_notes} onChange={(e) => setFormData({ ...formData, symmetry_notes: e.target.value })} placeholder="Any lagging areas or improvements you've noticed?" className="bg-slate-900/50 border-slate-700" />}
            {template.include_peak_week_metrics && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <Input type="number" step="0.1" value={formData.peak_week_water_litres} onChange={(e) => setFormData({ ...formData, peak_week_water_litres: e.target.value })} placeholder="Water (L)" className="bg-slate-900/50 border-slate-700" />
                <Input type="number" value={formData.peak_week_sodium_mg} onChange={(e) => setFormData({ ...formData, peak_week_sodium_mg: e.target.value })} placeholder="Sodium (mg)" className="bg-slate-900/50 border-slate-700" />
                <Input type="number" value={formData.peak_week_carb_g} onChange={(e) => setFormData({ ...formData, peak_week_carb_g: e.target.value })} placeholder="Carbs (g)" className="bg-slate-900/50 border-slate-700" />
              </div>
            )}
          </div>
        )}

        {currentStepKey === 'highlights' && (
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-6 space-y-4">
            <h2 className="text-lg font-semibold text-white mb-2">{stepMeta.highlights.title}</h2>
            <p className="text-sm text-slate-400">{stepMeta.highlights.description}</p>
            {template.include_wins && <Textarea rows={4} value={formData.wins} onChange={(e) => setFormData({ ...formData, wins: e.target.value })} placeholder="Biggest win this week 🏆" className="border-green-600/50 bg-green-900/10 text-slate-100" />}
            {template.include_struggles && <Textarea rows={4} value={formData.struggles} onChange={(e) => setFormData({ ...formData, struggles: e.target.value })} placeholder="Biggest struggle this week 😤" className="border-amber-500/50 bg-amber-900/10 text-slate-100" />}
          </div>
        )}

        {currentStepKey === 'questions' && (
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-6 space-y-4">
            <h2 className="text-lg font-semibold text-white mb-2">{stepMeta.questions.title}</h2>
            <p className="text-sm text-slate-400">{stepMeta.questions.description}</p>
            {(template.questions || []).map((q) => (
              <div key={q.id}>
                <label className="block text-sm font-medium text-white mb-2">
                  {q.text}
                  {q.required ? <span className="text-red-400 ml-1" aria-hidden>*</span> : null}
                </label>
                {q.type === 'text' ? (
                  <Textarea
                    value={formData.answers?.[q.id] || ''}
                    onChange={(e) => setFormData({ ...formData, answers: { ...formData.answers, [q.id]: e.target.value } })}
                    rows={3}
                    className="bg-slate-900/50 border-slate-700"
                  />
                ) : q.type === 'flag' ? (
                  <div className="flex gap-2">
                    {['Yes', 'No'].map((opt) => {
                      const selected = formData.answers?.[q.id] === opt;
                      return (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => setFormData({ ...formData, answers: { ...formData.answers, [q.id]: opt } })}
                          className={`flex-1 rounded-lg py-2.5 text-sm font-medium border ${selected ? 'border-blue-500 bg-blue-500/20 text-white' : 'border-slate-700 bg-slate-900/50 text-slate-300'}`}
                          style={{ minHeight: 44 }}
                        >
                          {opt}
                        </button>
                      );
                    })}
                  </div>
                ) : q.type === 'scale' ? (
                  <div className="flex flex-wrap gap-1.5">
                    {Array.from({ length: 10 }, (_, i) => String(i + 1)).map((n) => {
                      const selected = formData.answers?.[q.id] === n;
                      return (
                        <button
                          key={n}
                          type="button"
                          onClick={() => setFormData({ ...formData, answers: { ...formData.answers, [q.id]: n } })}
                          className={`rounded-lg text-sm font-medium border ${selected ? 'border-blue-500 bg-blue-500/20 text-white' : 'border-slate-700 bg-slate-900/50 text-slate-300'}`}
                          style={{ width: 44, height: 44 }}
                          aria-pressed={selected}
                        >
                          {n}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <Input
                    type="text"
                    inputMode="numeric"
                    value={formData.answers?.[q.id] || ''}
                    onChange={(e) => /^\d*$/.test(e.target.value) && setFormData({ ...formData, answers: { ...formData.answers, [q.id]: e.target.value } })}
                    className="bg-slate-900/50 border-slate-700"
                  />
                )}
              </div>
            ))}
          </div>
        )}

        {currentStepKey === 'notes' && (
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-6 space-y-4">
            <h2 className="text-lg font-semibold text-white mb-2">{stepMeta.notes.title}</h2>
            <p className="text-sm text-slate-400">{stepMeta.notes.description}</p>
            <div>
              <p className="text-sm text-slate-300 mb-2">How did your week feel overall?</p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-5">
                {WEEK_EMOJIS.map((e) => (
                  <button
                    key={e.value}
                    type="button"
                    onClick={() => setWeekMoodEmoji(e.value)}
                    className={`rounded-lg border p-2 text-sm ${weekMoodEmoji === e.value ? 'border-blue-500 bg-blue-500/20 text-white' : 'border-slate-700 bg-slate-900/40 text-slate-300'}`}
                  >
                    {e.value} {e.label}
                  </button>
                ))}
              </div>
            </div>
            {template.include_coach_questions_field && (
              <Textarea rows={3} value={formData.coach_questions} onChange={(e) => setFormData({ ...formData, coach_questions: e.target.value })} placeholder="Anything specific you want your coach to answer?" className="bg-slate-900/50 border-slate-700" />
            )}
            <Textarea rows={4} value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} placeholder="Anything else for your coach?" className="bg-slate-900/50 border-slate-700" />
          </div>
        )}

        <div className="flex gap-3">
          {currentStep > 1 ? (
            <Button type="button" variant="outline" className="flex-1" onClick={() => setCurrentStep((s) => Math.max(1, s - 1))}>
              Back
            </Button>
          ) : null}
          {currentStep < totalSteps ? (
            <Button type="button" className="flex-1 bg-blue-500 hover:bg-blue-600" onClick={() => setCurrentStep((s) => Math.min(totalSteps, s + 1))}>
              Next
            </Button>
          ) : (
            <Button type="submit" disabled={submitMutation.isPending || uploading} className="flex-1 bg-green-500 hover:bg-green-600">
              <CheckCircle2 className="w-5 h-5 mr-2" />
              {uploading ? 'Uploading photos...' : submitMutation.isPending ? 'Submitting...' : 'Submit'}
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}
