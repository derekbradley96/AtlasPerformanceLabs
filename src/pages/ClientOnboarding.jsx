/**
 * Client onboarding: details (name, age, weight, goals, experience, medical, notes, coach docs) → coach package → pay or skip → success.
 * When user arrives with pending invite (from coach code on signup), trainer is pre-loaded.
 */
import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { getSupabase, hasSupabase } from '@/lib/supabaseClient';
import { getPendingInvite, clearPendingInvite } from './ClientCode';
import { invokeSupabaseFunction, normalizeInviteCode } from '@/lib/supabaseApi';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ArrowRight, Loader2, Check, AlertCircle, User, FileText } from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import MeasurementUnitSegments, { WEIGHT_SEGMENT_OPTIONS } from '@/components/measurements/MeasurementUnitSegments';
import { normalizeWeightUnit, parseWeightInputsToKg } from '@/lib/bodyMeasurementUnits';
import { defaultLoadUnitForLocale } from '@/lib/localeUnitDefaults';
import { normalizeLoadUnit } from '@/lib/trainingLoadUnits';

const STEP_DETAILS = 1;
const STEP_PACKAGE = 2;
const STEP_SUCCESS = 3;

const DOC_TYPE_LABELS = { contract: 'Contract', terms: 'Terms & Conditions', par_q: 'PAR-Q' };

export default function ClientOnboarding() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, updateProfile, logout } = useAuth();
  const [step, setStep] = useState(STEP_DETAILS);
  const [loading, setLoading] = useState(false);
  const [inviteCode, setInviteCode] = useState('');
  const [trainer, setTrainer] = useState(null);
  const [error, setError] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [age, setAge] = useState('');
  const [weight, setWeight] = useState('');
  const [goals, setGoals] = useState('');
  const [previousExperience, setPreviousExperience] = useState('');
  const [medicalHistory, setMedicalHistory] = useState('');
  const [notes, setNotes] = useState('');
  const [coachDocuments, setCoachDocuments] = useState([]);
  const [acceptedDocumentIds, setAcceptedDocumentIds] = useState(new Set());
  const [documentsLoading, setDocumentsLoading] = useState(false);
  const [hasPending, setHasPending] = useState(false);
  const [pendingChecked, setPendingChecked] = useState(false);

  useEffect(() => {
    if (user) return;
    const pending = getPendingInvite();
    if (pending?.code) {
      navigate('/auth?mode=signup&account=client', { replace: true });
      return;
    }
    navigate('/auth?mode=login&account=client', { replace: true });
  }, [user, navigate]);

  // Payment success return URL
  useEffect(() => {
    if (searchParams.get('success') === 'true') setStep(STEP_SUCCESS);
  }, [searchParams]);

  // On mount: if pending invite, validate and load trainer so we show details step
  useEffect(() => {
    if (!user?.id || pendingChecked) return;
    const pending = getPendingInvite();
    if (pending?.code) {
      setHasPending(true);
      setInviteCode(pending.code);
      setLoading(true);
      invokeSupabaseFunction('validateInviteCode', { code: normalizeInviteCode(pending.code) })
        .then(({ data }) => {
          if (data?.valid && data?.trainer) {
            setTrainer(data.trainer);
            setStep(STEP_DETAILS);
          } else {
            setError(data?.error || 'Invalid code');
            clearPendingInvite();
            setHasPending(false);
          }
        })
        .catch(() => {
          setError('Could not validate code');
          clearPendingInvite();
          setHasPending(false);
        })
        .finally(() => {
          setLoading(false);
          setPendingChecked(true);
        });
    } else {
      setPendingChecked(true);
    }
  }, [user?.id, pendingChecked]);

  // Pre-fill display name from profile
  useEffect(() => {
    if (user?.full_name || user?.display_name) {
      setDisplayName((user.full_name || user.display_name || '').trim());
    }
  }, [user?.full_name, user?.display_name]);

  // Fetch coach documents when trainer is set (for step 1)
  useEffect(() => {
    if (!trainer?.id || !hasSupabase) return;
    setDocumentsLoading(true);
    getSupabase()
      .rpc('get_coach_onboarding_documents', { p_coach_id: trainer.id })
      .then(({ data }) => setCoachDocuments(Array.isArray(data) ? data : []))
      .catch(() => setCoachDocuments([]))
      .finally(() => setDocumentsLoading(false));
  }, [trainer?.id]);

  const toggleDocumentAccept = (docId) => {
    setAcceptedDocumentIds((prev) => {
      const next = new Set(prev);
      if (next.has(docId)) next.delete(docId);
      else next.add(docId);
      return next;
    });
  };

  const validateCode = async () => {
    if (!inviteCode.trim()) {
      setError('Please enter an invite code');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const { data } = await invokeSupabaseFunction('validateInviteCode', {
        code: normalizeInviteCode(inviteCode),
      });
      if (!data?.valid) {
        setError(data?.error || 'Invalid invite code');
        return;
      }
      setTrainer(data.trainer);
      setHasPending(false);
      setStep(STEP_DETAILS);
    } catch (err) {
      setError('Failed to validate code');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const saveDetailsAndContinue = async () => {
    const name = (displayName || '').trim();
    if (!name) {
      setError('Please enter your name');
      return;
    }
    const requiredDocIds = coachDocuments.map((d) => d.id);
    const allAccepted = requiredDocIds.length === 0 || requiredDocIds.every((id) => acceptedDocumentIds.has(id));
    if (!allAccepted) {
      setError('Please read and accept all documents from your coach.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      if (typeof updateProfile === 'function') {
        await updateProfile({ display_name: name });
      } else if (hasSupabase) {
        const supabase = getSupabase();
        await supabase.from('profiles').update({ display_name: name }).eq('id', user.id);
      }
      const wU = normalizeWeightUnit(weightUnit);
      const baselineKg =
        wU === 'st_lb'
          ? parseWeightInputsToKg({ weightUnit: wU, stoneText: weightSt, poundText: weightLbRem })
          : wU === 'lb'
            ? parseWeightInputsToKg({ weightUnit: wU, lbText: weight })
            : parseWeightInputsToKg({ weightUnit: wU, kgText: weight });

      const payload = {
        user_id: user.id,
        coach_id: trainer.id,
        trainer_id: trainer.id,
        name,
        full_name: name,
        subscription_status: 'active',
        age: age.trim() ? parseInt(age, 10) || null : null,
        baseline_weight: baselineKg != null ? Number(baselineKg.toFixed(3)) : null,
        goals: goals.trim() || null,
        previous_experience: previousExperience.trim() || null,
        medical_history: medicalHistory.trim() || null,
        onboarding_notes: notes.trim() || null,
        accepted_document_ids: Array.from(acceptedDocumentIds),
      };
      const { error: createErr } = await invokeSupabaseFunction('client-profile-create', payload);
      if (createErr) {
        console.error('client-profile-create failed:', createErr);
        setError('Could not save details — please try again');
        return;
      }
      if (typeof updateProfile === 'function') {
        await updateProfile({
          bodyweight_unit: normalizeWeightUnit(weightUnit),
          load_unit: normalizeLoadUnit(defaultLoadUnitForLocale()),
          units: normalizeWeightUnit(weightUnit) === 'lb' ? 'lb' : 'kg',
        });
      }
      setStep(STEP_PACKAGE);
    } catch (err) {
      setError('Could not save details');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubscribe = async () => {
    if (!user?.id || !trainer?.id) return;
    setLoading(true);
    try {
      const { data } = await invokeSupabaseFunction('createCheckoutSession', {
        trainerId: trainer.id,
        monthlyRate: trainer.monthlyRate,
      });
      if (data?.url) window.location.href = data.url;
      else if (data?.sessionId) window.location.href = `https://checkout.stripe.com/pay/${data.sessionId}`;
      else toast.error('Checkout not available');
    } catch (err) {
      toast.error('Failed to create checkout');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSkipPayment = async () => {
    if (!user?.id || !trainer?.id) return;
    setLoading(true);
    try {
      await invokeSupabaseFunction('user-update-role', { user_type: 'client' });
      clearPendingInvite();
      setStep(STEP_SUCCESS);
      toast.success('You’re in! You can subscribe later from your dashboard.');
    } catch (err) {
      toast.error('Something went wrong');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleFinish = async () => {
    clearPendingInvite();
    try {
      await updateProfile({ onboarding_complete: true });
    } catch (_) {}
    if (typeof window !== 'undefined') {
      const path = '/home';
      if (window.Capacitor?.isNativePlatform?.()) {
        window.location.hash = path;
        window.location.reload();
      } else {
        window.location.assign(path);
      }
    } else {
      navigate('/home', { replace: true });
    }
  };

  const handleSkipToPersonal = async () => {
    clearPendingInvite();
    await invokeSupabaseFunction('user-update-role', { user_type: 'personal' });
    navigate('/home', { replace: true });
  };

  if (!user) return null;

  const progressSteps = [STEP_DETAILS, STEP_PACKAGE, STEP_SUCCESS];

  return (
    <div className="min-h-screen bg-slate-950 text-white p-4">
      <div className="max-w-lg mx-auto pt-8 pb-20">
        <div className="flex justify-end mb-4">
          <button
            type="button"
            onClick={async () => {
              clearPendingInvite();
              await logout();
              navigate('/auth?mode=login&account=coach', { replace: true });
            }}
            className="text-xs text-slate-400 hover:text-white underline"
          >
            Not you? Log out
          </button>
        </div>
        <div className="flex items-center gap-2 mb-8">
          {progressSteps.map((s) => (
            <div
              key={s}
              className={`flex-1 h-1 rounded-full transition-colors ${
                s <= step ? 'bg-blue-500' : 'bg-slate-800'
              }`}
            />
          ))}
        </div>

        {/* Step 1: Enter code (only when no pending) or Your details */}
        {step === STEP_DETAILS && !hasPending && !trainer && (
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
            <h1 className="text-2xl font-bold mb-2">Enter your coach code</h1>
            <p className="text-slate-400 mb-8">Get this from your coach to join their roster.</p>
            <div className="space-y-4">
              <Input
                value={inviteCode}
                onChange={(e) => {
                  setInviteCode(e.target.value.toUpperCase());
                  setError('');
                }}
                placeholder="e.g. ATLAS-XXXXX"
                className="bg-slate-900 border-slate-800 h-14 text-center text-xl font-mono tracking-widest uppercase"
                maxLength={20}
              />
              {error && (
                <div className="flex items-center gap-2 text-red-400 text-sm">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {error}
                </div>
              )}
            </div>
            <Button
              onClick={validateCode}
              disabled={loading}
              className="w-full h-12 bg-blue-500 hover:bg-blue-600 mt-8"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <>Continue <ArrowRight className="w-4 h-4 ml-2" /></>}
            </Button>
            <button type="button" onClick={handleSkipToPersonal} className="w-full text-slate-400 hover:text-white mt-4 text-sm">
              I don’t have a code — use Personal
            </button>
          </motion.div>
        )}

        {step === STEP_DETAILS && trainer && (
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
            <h1 className="text-2xl font-bold mb-2">Your details</h1>
            <p className="text-slate-400 mb-6">So your coach knows who you are.</p>

            <div className="space-y-4">
              <label className="block text-sm font-medium text-slate-300">Name *</label>
              <Input
                value={displayName}
                onChange={(e) => { setDisplayName(e.target.value); setError(''); }}
                placeholder="Your name"
                className="bg-slate-900 border-slate-800 h-12"
              />
              <label className="block text-sm font-medium text-slate-300">Age</label>
              <Input
                type="number"
                min={1}
                max={120}
                value={age}
                onChange={(e) => setAge(e.target.value.replace(/\D/g, '').slice(0, 3))}
                placeholder="e.g. 28"
                className="bg-slate-900 border-slate-800 h-12"
              />
              <MeasurementUnitSegments
                label="Weight unit"
                options={WEIGHT_SEGMENT_OPTIONS}
                value={normalizeWeightUnit(weightUnit)}
                onChange={(id) => setWeightUnit(id)}
              />
              {normalizeWeightUnit(weightUnit) === 'st_lb' ? (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-300">Stone</label>
                    <Input
                      type="number"
                      min={0}
                      value={weightSt}
                      onChange={(e) => setWeightSt(e.target.value)}
                      placeholder="e.g. 11"
                      className="bg-slate-900 border-slate-800 h-12"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300">Pounds</label>
                    <Input
                      type="number"
                      min={0}
                      step={0.1}
                      value={weightLbRem}
                      onChange={(e) => setWeightLbRem(e.target.value)}
                      placeholder="e.g. 4"
                      className="bg-slate-900 border-slate-800 h-12"
                    />
                  </div>
                </div>
              ) : (
                <>
                  <label className="block text-sm font-medium text-slate-300">
                    Weight ({normalizeWeightUnit(weightUnit) === 'lb' ? 'lb' : 'kg'})
                  </label>
                  <Input
                    type="number"
                    min={0}
                    step={0.1}
                    value={weight}
                    onChange={(e) => setWeight(e.target.value)}
                    placeholder={normalizeWeightUnit(weightUnit) === 'lb' ? 'e.g. 175' : 'e.g. 75'}
                    className="bg-slate-900 border-slate-800 h-12"
                  />
                </>
              )}
              <label className="block text-sm font-medium text-slate-300">Goals</label>
              <Input
                value={goals}
                onChange={(e) => setGoals(e.target.value)}
                placeholder="e.g. Build muscle, improve strength"
                className="bg-slate-900 border-slate-800 h-12"
              />
              <label className="block text-sm font-medium text-slate-300">Previous gym / exercise experience</label>
              <Textarea
                value={previousExperience}
                onChange={(e) => setPreviousExperience(e.target.value)}
                placeholder="e.g. 2 years gym, some running"
                rows={2}
                className="bg-slate-900 border-slate-800 resize-none"
              />
              <label className="block text-sm font-medium text-slate-300">Medical history (if any)</label>
              <Textarea
                value={medicalHistory}
                onChange={(e) => setMedicalHistory(e.target.value)}
                placeholder="Any conditions or injuries we should know about"
                rows={2}
                className="bg-slate-900 border-slate-800 resize-none"
              />
              <label className="block text-sm font-medium text-slate-300">Notes</label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Anything else you’d like your coach to know"
                rows={2}
                className="bg-slate-900 border-slate-800 resize-none"
              />
            </div>

            {documentsLoading && (
              <div className="flex items-center gap-2 text-slate-400 text-sm">
                <Loader2 className="w-4 h-4 animate-spin" /> Loading documents…
              </div>
            )}
            {!documentsLoading && coachDocuments.length > 0 && (
              <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 space-y-4">
                <h2 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
                  <FileText className="w-4 h-4" /> Documents from your coach
                </h2>
                <p className="text-xs text-slate-500">Please read and accept each document to continue.</p>
                {coachDocuments.map((doc) => (
                  <div key={doc.id} className="border border-slate-800 rounded-lg p-3 space-y-2">
                    <p className="text-sm font-medium text-slate-200">
                      {doc.title || DOC_TYPE_LABELS[doc.type] || doc.type}
                    </p>
                    {doc.content && (
                      <div className="text-xs text-slate-400 whitespace-pre-wrap max-h-32 overflow-y-auto">
                        {doc.content.slice(0, 500)}{doc.content.length > 500 ? '…' : ''}
                      </div>
                    )}
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={acceptedDocumentIds.has(doc.id)}
                        onChange={() => toggleDocumentAccept(doc.id)}
                        className="rounded border-slate-600 bg-slate-800"
                      />
                      <span className="text-sm text-slate-300">I have read and accept</span>
                    </label>
                  </div>
                ))}
              </div>
            )}

            {error && (
              <div className="flex items-center gap-2 text-red-400 text-sm">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {error}
              </div>
            )}
            <Button
              onClick={saveDetailsAndContinue}
              disabled={loading}
              className="w-full h-12 bg-blue-500 hover:bg-blue-600 mt-4"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <>Continue <ArrowRight className="w-4 h-4 ml-2" /></>}
            </Button>
          </motion.div>
        )}

        {step === STEP_DETAILS && hasPending && !pendingChecked && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
          </div>
        )}

        {/* Step 2: Package — Subscribe or Skip */}
        {step === STEP_PACKAGE && trainer && (
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
            <h1 className="text-2xl font-bold mb-2">Choose your plan</h1>
            <p className="text-slate-400 mb-8">Monthly coaching with {trainer.name}.</p>
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 mb-6">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-400 rounded-xl flex items-center justify-center">
                  <User className="w-8 h-8 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold">{trainer.name}</h3>
                  {trainer.niche && <p className="text-slate-400 text-sm capitalize">{trainer.niche}</p>}
                </div>
              </div>
              <div className="flex items-center justify-between pt-4 border-t border-slate-800">
                <span className="text-slate-400">Monthly</span>
                <span className="text-xl font-semibold">£{((trainer.monthlyRate || 0) / 100).toFixed(2)}/mo</span>
              </div>
            </div>
            <Button
              onClick={handleSubscribe}
              disabled={loading}
              className="w-full h-12 bg-blue-500 hover:bg-blue-600 mb-3"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <>Subscribe & pay monthly</>}
            </Button>
            <Button
              variant="outline"
              onClick={handleSkipPayment}
              disabled={loading}
              className="w-full h-12 border-slate-600 text-slate-300 hover:bg-slate-800"
            >
              Skip for now
            </Button>
            <p className="text-xs text-slate-500 mt-2 text-center">
              You can subscribe later. Skip to test the app and access your client dashboard.
            </p>
          </motion.div>
        )}

        {/* Step 3: Success */}
        {step === STEP_SUCCESS && (
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="text-center">
            <div className="w-20 h-20 bg-gradient-to-br from-green-500 to-emerald-500 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <Check className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-2xl font-bold mb-2">You’re all set</h1>
            <p className="text-slate-400 mb-8">
              You’re now connected to {trainer?.name || 'your coach'}. Head to your dashboard to get started.
            </p>
            <Button onClick={handleFinish} className="w-full h-12 bg-blue-500 hover:bg-blue-600">
              Go to dashboard <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </motion.div>
        )}
      </div>
    </div>
  );
}
