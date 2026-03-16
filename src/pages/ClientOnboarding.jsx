/**
 * Client onboarding: details → coach package → pay or skip → client dashboard.
 * When user arrives with pending invite (from coach code on signup), trainer is pre-loaded.
 */
import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { getSupabase, hasSupabase } from '@/lib/supabaseClient';
import { getPendingInvite, clearPendingInvite } from './ClientCode';
import { invokeSupabaseFunction } from '@/lib/supabaseApi';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ArrowRight, Loader2, Check, AlertCircle, User } from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';

const STEP_DETAILS = 1;
const STEP_PACKAGE = 2;
const STEP_SUCCESS = 3;

export default function ClientOnboarding() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, updateProfile } = useAuth();
  const [step, setStep] = useState(STEP_DETAILS);
  const [loading, setLoading] = useState(false);
  const [inviteCode, setInviteCode] = useState('');
  const [trainer, setTrainer] = useState(null);
  const [error, setError] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [hasPending, setHasPending] = useState(false);
  const [pendingChecked, setPendingChecked] = useState(false);

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
      invokeSupabaseFunction('validateInviteCode', { code: (pending.code || '').trim() })
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

  const validateCode = async () => {
    if (!inviteCode.trim()) {
      setError('Please enter an invite code');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const { data } = await invokeSupabaseFunction('validateInviteCode', {
        code: inviteCode.toUpperCase().trim(),
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
    setLoading(true);
    setError('');
    try {
      if (typeof updateProfile === 'function') {
        await updateProfile({ display_name: name });
      } else if (hasSupabase()) {
        const supabase = getSupabase();
        await supabase.from('profiles').update({ display_name: name }).eq('id', user.id);
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
      await invokeSupabaseFunction('client-profile-create', {
        user_id: user.id,
        coach_id: trainer.id,
        trainer_id: trainer.id,
        subscription_status: 'pending',
      });
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
      await invokeSupabaseFunction('client-profile-create', {
        user_id: user.id,
        coach_id: trainer.id,
        trainer_id: trainer.id,
        subscription_status: 'active',
      });
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

  const handleFinish = () => {
    clearPendingInvite();
    // Reload so auth refetches profile and new client role is applied
    if (typeof window !== 'undefined') {
      const path = '/client-dashboard';
      if (window.Capacitor?.isNativePlatform?.()) {
        window.location.hash = path;
        window.location.reload();
      } else {
        window.location.assign(path);
      }
    } else {
      navigate('/client-dashboard', { replace: true });
    }
  };

  const handleSkipToPersonal = async () => {
    clearPendingInvite();
    await invokeSupabaseFunction('user-update-role', { user_type: 'personal' });
    navigate('/home', { replace: true });
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  const progressSteps = [STEP_DETAILS, STEP_PACKAGE, STEP_SUCCESS];

  return (
    <div className="min-h-screen bg-slate-950 text-white p-4">
      <div className="max-w-lg mx-auto pt-8 pb-20">
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
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
            <h1 className="text-2xl font-bold mb-2">Your details</h1>
            <p className="text-slate-400 mb-8">So your coach knows who you are.</p>
            <div className="space-y-4">
              <label className="block text-sm font-medium text-slate-300">Name</label>
              <Input
                value={displayName}
                onChange={(e) => {
                  setDisplayName(e.target.value);
                  setError('');
                }}
                placeholder="Your name"
                className="bg-slate-900 border-slate-800 h-12"
              />
              {error && (
                <div className="flex items-center gap-2 text-red-400 text-sm">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {error}
                </div>
              )}
            </div>
            <Button
              onClick={saveDetailsAndContinue}
              disabled={loading}
              className="w-full h-12 bg-blue-500 hover:bg-blue-600 mt-8"
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
