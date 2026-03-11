import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { invokeSupabaseFunction } from '@/lib/supabaseApi';
import { createPageUrl } from '@/utils';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ArrowRight, Loader2, Check, AlertCircle, User } from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';

export default function ClientOnboarding() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [inviteCode, setInviteCode] = useState('');
  const [trainer, setTrainer] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (searchParams.get('success') === 'true') setStep(3);
  }, [searchParams]);

  const validateCode = async () => {
    if (!inviteCode.trim()) {
      setError('Please enter an invite code');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const { data } = await invokeSupabaseFunction('validateInviteCode', {
        code: inviteCode.toUpperCase().trim()
      });
      if (!data?.valid) {
        setError(data?.error || 'Invalid invite code');
        return;
      }
      setTrainer(data.trainer);
      setStep(2);
    } catch (err) {
      setError('Failed to validate code');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async () => {
    if (!user?.id || !trainer?.id) return;
    setLoading(true);
    try {
      await invokeSupabaseFunction('client-profile-create', {
        user_id: user.id,
        trainer_id: trainer.id,
        subscription_status: 'pending'
      });
      const { data } = await invokeSupabaseFunction('createCheckoutSession', {
        trainerId: trainer.id,
        monthlyRate: trainer.monthlyRate
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

  const handleFinish = () => {
    navigate(createPageUrl('Home'));
  };

  const handleSkip = async () => {
    await invokeSupabaseFunction('user-update-role', { user_type: 'general' });
    navigate(createPageUrl('Home'));
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white p-4">
      <div className="max-w-lg mx-auto pt-8 pb-20">
        {/* Progress */}
        <div className="flex items-center gap-2 mb-8">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={`flex-1 h-1 rounded-full transition-colors ${
                s <= step ? 'bg-blue-500' : 'bg-slate-800'
              }`}
            />
          ))}
        </div>

        {step === 1 && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
          >
            <h1 className="text-2xl font-bold mb-2">Enter your trainer's code</h1>
            <p className="text-slate-400 mb-8">Your trainer should have shared an invite code with you</p>

            <div className="space-y-4">
              <Input
                  value={inviteCode}
                  onChange={(e) => {
                    setInviteCode(e.target.value.toUpperCase());
                    setError('');
                  }}
                  placeholder="e.g. FITX-4K9Z"
                  className="bg-slate-900 border-slate-800 h-14 text-center text-2xl font-mono tracking-widest uppercase"
                  maxLength={9}
                />
              
              {error && (
                <div className="flex items-center gap-2 text-red-400 text-sm">
                  <AlertCircle className="w-4 h-4" />
                  {error}
                </div>
              )}
            </div>

            <Button
              onClick={validateCode}
              disabled={loading}
              className="w-full h-12 bg-blue-500 hover:bg-blue-600 mt-8"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>Continue <ArrowRight className="w-4 h-4 ml-2" /></>
              )}
            </Button>

            <button
              onClick={handleSkip}
              className="w-full text-slate-400 hover:text-white mt-4 text-sm"
            >
              I don't have a code - use Personal
            </button>
          </motion.div>
        )}

        {step === 2 && trainer && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
          >
            <h1 className="text-2xl font-bold mb-2">Confirm your trainer</h1>
            <p className="text-slate-400 mb-8">You'll be coached by:</p>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 mb-6">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-400 rounded-xl flex items-center justify-center">
                  <User className="w-8 h-8 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold">{trainer.name}</h3>
                  {trainer.niche && (
                    <p className="text-slate-400 text-sm capitalize">{trainer.niche}</p>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-slate-800">
                <span className="text-slate-400">Monthly rate</span>
                <span className="text-xl font-semibold">£{(trainer.monthlyRate / 100).toFixed(2)}/mo</span>
              </div>
            </div>

            <Button
              onClick={handleJoin}
              disabled={loading}
              className="w-full h-12 bg-blue-500 hover:bg-blue-600"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>Join & Subscribe <ArrowRight className="w-4 h-4 ml-2" /></>
              )}
            </Button>
            
            <button
              onClick={() => setStep(1)}
              className="w-full text-slate-400 hover:text-white mt-4 text-sm"
            >
              Use a different code
            </button>
          </motion.div>
        )}

        {step === 3 && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="text-center"
          >
            <div className="w-20 h-20 bg-gradient-to-br from-green-500 to-emerald-500 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <Check className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-2xl font-bold mb-2">Welcome aboard!</h1>
            <p className="text-slate-400 mb-8">
              Payment successful! You're now connected to {trainer?.name}. Start logging workouts and tracking your progress.
            </p>

            <Button
              onClick={handleFinish}
              className="w-full h-12 bg-blue-500 hover:bg-blue-600"
            >
              Go to Dashboard <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </motion.div>
        )}
      </div>
    </div>
  );
}