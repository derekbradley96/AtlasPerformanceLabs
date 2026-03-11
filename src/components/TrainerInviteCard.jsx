import React, { useState, useEffect } from 'react';
import { Copy, Check, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import { toast } from 'sonner';

export default function TrainerInviteCard({ stripeConnected, onConnect }) {
  const [code, setCode] = useState(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    loadCode();
  }, []);

  const loadCode = async () => {
    try {
      setLoading(true);
      const base = typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_URL;
      if (base) {
        const url = `${base.replace(/\/$/, '')}/functions/v1`;
        const res = await fetch(`${url}/generate-invite-code`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        });
        const data = await res.json().catch(() => ({}));
        if (data?.code) setCode(data.code);
      }
    } catch (error) {
      console.error('Failed to generate code:', error);
      toast.error('Failed to generate invite code');
    } finally {
      setLoading(false);
    }
  };

  const copyCode = async () => {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      toast.success('Code copied!');
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast.error('Failed to copy');
    }
  };

  if (!stripeConnected) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-6 mb-6"
      >
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-500 mt-0.5 shrink-0" />
          <div className="flex-1">
            <h3 className="font-semibold text-white mb-1">
              Complete payment setup to invite clients
            </h3>
            <p className="text-sm text-amber-200 mb-4">
              Connect your Stripe account to start accepting payments from
              clients.
            </p>
            <Button
              onClick={onConnect}
              className="bg-amber-500 hover:bg-amber-600 text-black font-semibold"
            >
              Connect Stripe
            </Button>
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 mb-6"
    >
      <h3 className="font-semibold text-white mb-1">Invite Clients</h3>
      <p className="text-sm text-slate-400 mb-4">
        Share your unique code to invite clients to join your training program.
      </p>

      <div className="bg-slate-900 rounded-xl p-4 flex items-center gap-3">
        {loading ? (
          <div className="flex-1 h-10 bg-slate-800 rounded animate-pulse" />
        ) : (
          <>
            <div className="flex-1">
              <p className="text-sm text-slate-400 mb-1">Your invite code</p>
              <p className="text-2xl font-bold text-blue-400 font-mono">
                {code || '----'}
              </p>
            </div>
            <Button
              onClick={copyCode}
              disabled={!code}
              className="bg-blue-500 hover:bg-blue-600"
              size="icon"
            >
              {copied ? (
                <Check className="w-5 h-5" />
              ) : (
                <Copy className="w-5 h-5" />
              )}
            </Button>
          </>
        )}
      </div>

      <p className="text-xs text-slate-500 mt-3">
        Clients enter this code during onboarding to connect with you.
      </p>
    </motion.div>
  );
}