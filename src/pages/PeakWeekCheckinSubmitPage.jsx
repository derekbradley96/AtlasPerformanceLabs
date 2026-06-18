/**
 * Client: submit a peak week check-in (weight, photos, pump/flat-full ratings, notes).
 * Saves to peak_week_checkins. Competition clients with active peak week only.
 */
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/AuthContext';
import { getSupabase, hasSupabase } from '@/lib/supabaseClient';
import { uploadPeakWeekCheckinPhoto } from '@/lib/checkins';
import TopBar from '@/components/ui/TopBar';
import Card from '@/ui/Card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { colors, spacing } from '@/ui/tokens';
import { pageContainer, standardCard, sectionLabel } from '@/ui/pageLayout';
import EmptyState from '@/components/ui/EmptyState';
import { Calendar, Upload, X } from 'lucide-react';
import { toast } from 'sonner';
import { hapticLight } from '@/lib/haptics';

function resolveClientAndCoachFocus(supabase, userId) {
  if (!supabase || !userId) return Promise.resolve({ clientId: null, coachFocus: null });
  return supabase
    .from('clients')
    .select('id, coach_id, trainer_id')
    .eq('user_id', userId)
    .maybeSingle()
    .then(({ data: client }) => {
      if (!client) return { clientId: null, coachFocus: null };
      const coachId = client.coach_id || client.trainer_id;
      if (!coachId) return { clientId: client.id, coachFocus: null };
      return supabase
        .from('profiles')
        .select('coach_focus')
        .eq('id', coachId)
        .maybeSingle()
        .then(({ data: profile }) => ({
          clientId: client.id,
          coachFocus: (profile?.coach_focus || '').toString().trim().toLowerCase() || null,
        }));
    });
}

function isCompetitionClient(coachFocus) {
  if (!coachFocus) return true;
  return coachFocus === 'competition' || coachFocus === 'integrated';
}

const RATING_MIN = 1;
const RATING_MAX = 10;

export default function PeakWeekCheckinSubmitPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const supabase = hasSupabase ? getSupabase() : null;

  const [weight, setWeight] = useState('');
  const [photoPaths, setPhotoPaths] = useState([]);
  const [pumpRating, setPumpRating] = useState('');
  const [flatFullRating, setFlatFullRating] = useState('');
  const [clientNotes, setClientNotes] = useState('');
  const [uploading, setUploading] = useState(false);
  const [checkinPeriod, setCheckinPeriod] = useState('morning');

  const { data: clientAndFocus, isLoading: loadingClient } = useQuery({
    queryKey: ['client-peak-week-identity', user?.id],
    queryFn: () => resolveClientAndCoachFocus(supabase, user?.id),
    enabled: !!supabase && !!user?.id,
  });

  const clientId = clientAndFocus?.clientId ?? null;
  const coachFocus = clientAndFocus?.coachFocus ?? null;
  const canSeePeakWeek = isCompetitionClient(coachFocus);

  const { data: peakWeek, isLoading: loadingPeakWeek } = useQuery({
    queryKey: ['peak_weeks_active', clientId],
    queryFn: async () => {
      if (!supabase || !clientId) return null;
      const { data } = await supabase
        .from('peak_weeks')
        .select('id')
        .eq('client_id', clientId)
        .eq('is_active', true)
        .order('show_date', { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
    enabled: !!supabase && !!clientId && canSeePeakWeek,
  });

  const todayIso = new Date().toISOString().slice(0, 10);
  const { data: todayPeakWeekDay, isLoading: loadingTodayPeakWeekDay } = useQuery({
    queryKey: ['peak-week-day-today', peakWeek?.id, todayIso],
    queryFn: async () => {
      if (!supabase || !peakWeek?.id) return null;
      const { data, error } = await supabase
        .from('peak_week_days')
        .select('id, day_label, target_date, morning_checkin_required, evening_checkin_required')
        .eq('peak_week_id', peakWeek.id)
        .eq('target_date', todayIso)
        .maybeSingle();
      return error ? null : data;
    },
    enabled: !!supabase && !!peakWeek?.id,
  });

  const { data: todayPeriodCheckins = [], isLoading: loadingTodayPeriodCheckins } = useQuery({
    queryKey: ['peak-week-checkins-today-periods', clientId, peakWeek?.id, todayIso],
    queryFn: async () => {
      if (!supabase || !clientId || !peakWeek?.id) return [];
      const start = `${todayIso}T00:00:00.000Z`;
      const end = `${todayIso}T23:59:59.999Z`;
      const { data, error } = await supabase
        .from('peak_week_checkins')
        .select('id, checkin_period, created_at')
        .eq('client_id', clientId)
        .eq('peak_week_id', peakWeek.id)
        .gte('created_at', start)
        .lte('created_at', end)
        .order('created_at', { ascending: false });
      return error ? [] : (data || []);
    },
    enabled: !!supabase && !!clientId && !!peakWeek?.id,
  });

  const morningRequired = !!todayPeakWeekDay?.morning_checkin_required;
  const eveningRequired = !!todayPeakWeekDay?.evening_checkin_required;
  const morningSubmitted = todayPeriodCheckins.some((c) => c.checkin_period === 'morning');
  const eveningSubmitted = todayPeriodCheckins.some((c) => c.checkin_period === 'evening');
  const availablePeriods = [
    ...(morningRequired ? ['morning'] : []),
    ...(eveningRequired ? ['evening'] : []),
  ];
  const periodSelectionRequired = availablePeriods.length > 0;
  useEffect(() => {
    if (periodSelectionRequired && !availablePeriods.includes(checkinPeriod)) {
      setCheckinPeriod(availablePeriods[0]);
    }
  }, [availablePeriods, checkinPeriod, periodSelectionRequired]);

  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!supabase || !peakWeek?.id || !clientId) throw new Error('Missing peak week or client');
      if (periodSelectionRequired && !availablePeriods.includes(checkinPeriod)) {
        throw new Error('Select the required check-in period.');
      }
      if ((checkinPeriod === 'morning' && morningSubmitted) || (checkinPeriod === 'evening' && eveningSubmitted)) {
        throw new Error(`You already submitted the ${checkinPeriod} check-in today.`);
      }
      const { error } = await supabase.from('peak_week_checkins').insert({
        peak_week_id: peakWeek.id,
        client_id: clientId,
        weight: weight !== '' ? Number(weight) : null,
        photos: Array.isArray(photoPaths) ? photoPaths : [],
        pump_rating: pumpRating !== '' ? Math.min(RATING_MAX, Math.max(RATING_MIN, Number(pumpRating))) : null,
        flat_full_rating: flatFullRating !== '' ? Math.min(RATING_MAX, Math.max(RATING_MIN, Number(flatFullRating))) : null,
        client_notes: clientNotes.trim() || null,
        checkin_period: periodSelectionRequired ? checkinPeriod : 'evening',
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['peak_week_checkins'] });
      toast.success('Peak week check-in submitted.');
      hapticLight();
      navigate('/peak-week');
    },
    onError: (e) => {
      toast.error(e?.message || 'Failed to submit.');
    },
  });

  const handlePhotoSelect = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0 || !clientId) return;
    setUploading(true);
    try {
      const paths = [];
      for (const file of files) {
        const path = await uploadPeakWeekCheckinPhoto({ clientId, file });
        if (path) paths.push(path);
      }
      if (paths.length) setPhotoPaths((prev) => [...prev, ...paths]);
      if (paths.length < files.length) toast.error('Some photos failed to upload.');
      else if (paths.length) toast.success('Photos added.');
    } catch {
      toast.error('Upload failed.');
    } finally {
      setUploading(false);
    }
  };

  const removePhoto = (index) => {
    setPhotoPaths((prev) => prev.filter((_, i) => i !== index));
  };

  const loading = loadingClient || loadingPeakWeek || loadingTodayPeakWeekDay || loadingTodayPeriodCheckins;

  if (!user) {
    return (
      <div className="min-h-screen" style={{ background: colors.bg, color: colors.text }}>
        <TopBar title="Peak Week Check-In" onBack={() => navigate(-1)} />
        <div className="p-4 max-w-lg mx-auto" style={pageContainer}>
          <p style={{ color: colors.muted }}>Sign in to submit a check-in.</p>
          <Button variant="outline" className="mt-2" onClick={() => navigate(-1)}>Back</Button>
        </div>
      </div>
    );
  }

  if (!canSeePeakWeek) {
    return (
      <div className="min-h-screen" style={{ background: colors.bg, color: colors.text }}>
        <TopBar title="Peak Week Check-In" onBack={() => navigate(-1)} />
        <div className="p-4 max-w-lg mx-auto" style={pageContainer}>
          <EmptyState
            title="Not available"
            description="Peak week check-ins are for competition prep athletes."
            icon={Calendar}
            actionLabel="Back"
            onAction={() => { hapticLight(); navigate(-1); }}
          />
        </div>
      </div>
    );
  }

  if (!clientId && !loadingClient) {
    return (
      <div className="min-h-screen" style={{ background: colors.bg, color: colors.text }}>
        <TopBar title="Peak Week Check-In" onBack={() => navigate(-1)} />
        <div className="p-4 max-w-lg mx-auto" style={pageContainer}>
          <EmptyState
            title="No coach linked"
            description="Link with a coach to use peak week check-ins."
            icon={Calendar}
            actionLabel="Back"
            onAction={() => { hapticLight(); navigate(-1); }}
          />
        </div>
      </div>
    );
  }

  if (!peakWeek && !loading) {
    return (
      <div className="min-h-screen" style={{ background: colors.bg, color: colors.text }}>
        <TopBar title="Peak Week Check-In" onBack={() => navigate(-1)} />
        <div className="p-4 max-w-lg mx-auto" style={pageContainer}>
          <EmptyState
            title="No peak week yet"
            description="Your coach will add your peak week when you're in prep."
            icon={Calendar}
            actionLabel="Back to Peak Week"
            onAction={() => { hapticLight(); navigate('/peak-week'); }}
          />
        </div>
      </div>
    );
  }

  const canSubmit =
    !uploading &&
    !(checkinPeriod === 'morning' && morningSubmitted) &&
    !(checkinPeriod === 'evening' && eveningSubmitted);
  const allRequiredSubmitted =
    periodSelectionRequired &&
    availablePeriods.every((p) => (p === 'morning' ? morningSubmitted : eveningSubmitted));
  const noCheckinDueToday = !!todayPeakWeekDay && !morningRequired && !eveningRequired;

  return (
    <div className="min-h-screen pb-8" style={{ background: colors.bg, color: colors.text }}>
      <TopBar title="Peak Week Check-In" onBack={() => navigate(-1)} />
      <div className="max-w-lg mx-auto" style={{ ...pageContainer, paddingBottom: spacing[32] }}>
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-2 border-white/20 rounded-full animate-spin" style={{ borderTopColor: colors.primary }} />
          </div>
        ) : (
          <Card style={{ ...standardCard, padding: spacing[16] }}>
            <div style={sectionLabel}>Submit check-in</div>

            <div className="space-y-4">
              {noCheckinDueToday && (
                <div
                  className="rounded-lg px-3 py-2 text-xs font-medium"
                  style={{ border: `1px solid ${colors.border}`, background: colors.surface2, color: colors.muted }}
                >
                  No check-in is required today. You can still submit an optional update if needed.
                </div>
              )}
              {allRequiredSubmitted && (
                <div
                  className="rounded-lg px-3 py-2 text-xs font-medium"
                  style={{ border: `1px solid ${colors.success}`, background: colors.successSubtle, color: colors.success }}
                >
                  You&apos;ve already submitted all required check-ins for today.
                </div>
              )}
              <div>
                <Label className="text-xs" style={{ color: colors.muted }}>Check-in period</Label>
                <div className="flex gap-2 mt-1">
                  {['morning', 'evening'].map((p) => {
                    const required = availablePeriods.includes(p);
                    const submitted = p === 'morning' ? morningSubmitted : eveningSubmitted;
                    const disabled = periodSelectionRequired ? !required : false;
                    return (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setCheckinPeriod(p)}
                        disabled={disabled}
                        style={{
                          flex: 1,
                          minHeight: 42,
                          borderRadius: 8,
                          border: `1px solid ${checkinPeriod === p ? colors.primary : colors.border}`,
                          background: checkinPeriod === p ? colors.primarySubtle : colors.surface2,
                          color: checkinPeriod === p ? colors.primary : colors.text,
                          fontWeight: 600,
                          opacity: disabled ? 0.45 : 1,
                          cursor: disabled ? 'not-allowed' : 'pointer',
                        }}
                      >
                        {p[0].toUpperCase() + p.slice(1)}{required ? '' : ' (optional)'}{submitted ? ' ✓' : ''}
                      </button>
                    );
                  })}
                </div>
                {periodSelectionRequired && (
                  <p className="text-xs mt-1" style={{ color: colors.muted }}>
                    Required today: {availablePeriods.join(' + ')}.
                  </p>
                )}
              </div>
              <div>
                <Label className="text-xs" style={{ color: colors.muted }}>Weight (kg)</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                  placeholder="e.g. 82.5"
                  className="mt-1 bg-black/20 border border-white/10 text-white"
                />
              </div>

              <div>
                <Label className="text-xs" style={{ color: colors.muted }}>Photos</Label>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handlePhotoSelect}
                  className="hidden"
                  id="pw-checkin-photos"
                />
                <label
                  htmlFor="pw-checkin-photos"
                  className="flex flex-col items-center justify-center gap-2 w-full py-6 border-2 border-dashed rounded-xl cursor-pointer mt-1"
                  style={{ borderColor: colors.border, color: colors.muted }}
                >
                  <Upload size={24} />
                  <span>{uploading ? 'Uploading...' : 'Tap to add photos'}</span>
                </label>
                {photoPaths.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {photoPaths.map((_, i) => (
                      <span
                        key={i}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded text-sm"
                        style={{ background: colors.surface2 }}
                      >
                        Photo {i + 1}
                        <button type="button" onClick={() => removePhoto(i)} aria-label="Remove">
                          <X size={14} style={{ color: colors.muted }} />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs" style={{ color: colors.muted }}>Pump rating (1–10)</Label>
                  <Input
                    type="number"
                    min={RATING_MIN}
                    max={RATING_MAX}
                    value={pumpRating}
                    onChange={(e) => setPumpRating(e.target.value)}
                    className="mt-1 bg-black/20 border border-white/10 text-white"
                  />
                </div>
                <div>
                  <Label className="text-xs" style={{ color: colors.muted }}>Flat / full rating (1–10)</Label>
                  <Input
                    type="number"
                    min={RATING_MIN}
                    max={RATING_MAX}
                    value={flatFullRating}
                    onChange={(e) => setFlatFullRating(e.target.value)}
                    className="mt-1 bg-black/20 border border-white/10 text-white"
                  />
                </div>
              </div>

              <div>
                <Label className="text-xs" style={{ color: colors.muted }}>Your notes</Label>
                <Textarea
                  value={clientNotes}
                  onChange={(e) => setClientNotes(e.target.value)}
                  placeholder="How you're feeling, any observations..."
                  rows={3}
                  className="mt-1 bg-black/20 border border-white/10 text-white"
                />
              </div>

              <Button
                className="w-full mt-4"
                onClick={() => submitMutation.mutate()}
                disabled={submitMutation.isPending || !canSubmit || allRequiredSubmitted}
              >
                {submitMutation.isPending ? 'Submitting...' : 'Submit check-in'}
              </Button>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
