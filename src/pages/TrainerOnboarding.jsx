import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { base44 } from '@/lib/emptyApi';
import { createPageUrl } from '@/utils';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowRight, Loader2, Check, Wallet, AlertCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';

export default function TrainerOnboarding() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [user, setUser] = useState(null);
  const [formData, setFormData] = useState({
    display_name: '',
    niche: '',
    bio: '',
    monthly_rate: 100
  });

  useEffect(() => {
    const loadUser = async () => {
      const u = await base44.auth.me();
      setUser(u);
      setFormData(prev => ({ ...prev, display_name: u.full_name || '' }));
    };
    
    // Check if Stripe Connect setup succeeded
    if (searchParams.get('success') === 'true') {
      setStep(3);
      toast.success('Stripe account connected!');
    }
    
    loadUser();
  }, [searchParams]);

  const handleCreateProfile = async () => {
    if (!formData.display_name.trim()) {
      toast.error('Please enter your display name');
      return;
    }
    
    setLoading(true);
    
    try {
      await base44.entities.TrainerProfile.create({
        user_id: user.id,
        display_name: formData.display_name,
        niche: formData.niche,
        bio: formData.bio,
        monthly_rate: formData.monthly_rate * 100,
        stripe_connected: false
      });
      
      setStep(2);
    } catch (err) {
      toast.error('Failed to create profile');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const copyCode = () => {
    const code = formData.display_name.slice(0, 1).toUpperCase() + 'XXX-' + Math.random().toString(36).slice(2, 6).toUpperCase();
    navigator.clipboard.writeText(code);
    setCopied(true);
    toast.success('Code copied!');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleStripeSetup = async () => {
    setLoading(true);
    try {
      const { data } = await base44.functions.invoke('createStripeConnectSession');
      window.location.href = data.url;
    } catch (err) {
      toast.error('Failed to start Stripe setup');
      console.error(err);
      setLoading(false);
    }
  };

  const handleFinish = () => {
    navigate(createPageUrl('Home'));
  };

  const niches = [
    'Strength Training',
    'Bodybuilding',
    'CrossFit',
    'Weight Loss',
    'Sports Performance',
    'Rehabilitation',
    'Online Coaching',
    'General Fitness'
  ];

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
            <h1 className="text-2xl font-bold mb-2">Create your trainer profile</h1>
            <p className="text-slate-400 mb-8">Let clients know who you are</p>

            <div className="space-y-5">
              <div>
                <label className="text-sm text-slate-400 mb-2 block">Display Name *</label>
                <Input
                  value={formData.display_name}
                  onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
                  placeholder="Coach Mike"
                  className="bg-slate-900 border-slate-800 h-12"
                />
              </div>

              <div>
                <label className="text-sm text-slate-400 mb-2 block">Specialization</label>
                <Select
                  value={formData.niche}
                  onValueChange={(value) => setFormData({ ...formData, niche: value })}
                >
                  <SelectTrigger className="bg-slate-900 border-slate-800 h-12">
                    <SelectValue placeholder="Select your niche" />
                  </SelectTrigger>
                  <SelectContent>
                    {niches.map(n => (
                      <SelectItem key={n} value={n}>{n}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm text-slate-400 mb-2 block">Bio</label>
                <Textarea
                  value={formData.bio}
                  onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                  placeholder="Tell clients about your experience and coaching style..."
                  className="bg-slate-900 border-slate-800 min-h-[100px]"
                />
              </div>

              <div>
                <label className="text-sm text-slate-400 mb-2 block">Monthly Rate (£)</label>
                <Input
                  type="number"
                  value={formData.monthly_rate}
                  onChange={(e) => setFormData({ ...formData, monthly_rate: parseInt(e.target.value) || 0 })}
                  placeholder="99"
                  className="bg-slate-900 border-slate-800 h-12"
                />
              </div>
            </div>

            <Button
              onClick={handleCreateProfile}
              disabled={loading}
              className="w-full h-12 bg-blue-500 hover:bg-blue-600 mt-8"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>Continue <ArrowRight className="w-4 h-4 ml-2" /></>
              )}
            </Button>
          </motion.div>
        )}

        {step === 2 && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
          >
            <h1 className="text-2xl font-bold mb-2">Setup payments</h1>
            <p className="text-slate-400 mb-8">Connect your Stripe account to accept client subscriptions</p>

            <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-6 mb-6">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-amber-500 mt-0.5 shrink-0" />
                <div>
                  <p className="text-amber-200 text-sm font-medium mb-1">
                    Stripe account required
                  </p>
                  <p className="text-amber-300/70 text-sm">
                    You won't be able to accept paid clients until your Stripe account is verified.
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 mb-6 space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-green-500/20 flex items-center justify-center mt-0.5">
                  <Check className="w-4 h-4 text-green-400" />
                </div>
                <div>
                  <p className="font-medium text-white">Profile created</p>
                  <p className="text-sm text-slate-400">{formData.display_name}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center mt-0.5">
                  <span className="text-blue-400 text-xs font-bold">2</span>
                </div>
                <div>
                  <p className="font-medium text-white">Connect Stripe</p>
                  <p className="text-sm text-slate-400">Link your bank account</p>
                </div>
              </div>
            </div>

            <Button
              onClick={handleStripeSetup}
              disabled={loading}
              className="w-full h-12 bg-blue-500 hover:bg-blue-600 font-semibold"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <><Wallet className="w-4 h-4 mr-2" /> Connect Stripe Account</>
              )}
            </Button>
            
            <button
              onClick={() => setStep(3)}
              className="w-full text-slate-400 hover:text-white mt-4 text-sm"
            >
              Skip for now
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
            <h1 className="text-2xl font-bold mb-2">Profile ready!</h1>
            <p className="text-slate-400 mb-8">
              {searchParams.get('success') === 'true' 
                ? 'Your Stripe account is connected. You can now accept paid clients.'
                : 'Get started inviting clients and creating programs. You can connect Stripe anytime.'}
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