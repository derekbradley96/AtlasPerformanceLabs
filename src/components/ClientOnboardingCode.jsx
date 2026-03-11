import React, { useState } from 'react';
import { ArrowRight, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { base44 } from '@/lib/emptyApi';
import { motion } from 'framer-motion';
import { toast } from 'sonner';

export default function ClientOnboardingCode({ onValidCode }) {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [trainerInfo, setTrainerInfo] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!code.trim()) return;

    setLoading(true);
    setError('');

    try {
      const { data } = await base44.functions.invoke('validateInviteCode', {
        code: code.toUpperCase()
      });

      if (!data.valid) {
        setError(data.error || 'Invalid trainer code');
        setTrainerInfo(null);
        return;
      }

      setTrainerInfo(data.trainer);
      toast.success('Trainer found!');
      onValidCode(data.trainer);
    } catch (error) {
      console.error('Validation error:', error);
      setError('Failed to validate code');
      setTrainerInfo(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-8">
        <h2 className="text-2xl font-bold text-white mb-2">
          Connect with Your Trainer
        </h2>
        <p className="text-slate-400 mb-6">
          Ask your trainer for their invite code to get started.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Trainer Invite Code
            </label>
            <Input
              value={code}
              onChange={(e) => {
                setCode(e.target.value.toUpperCase());
                setError('');
              }}
              placeholder="e.g., FITX-4K9Z"
              className="bg-slate-900 border-slate-600 h-12 text-lg font-mono"
              disabled={loading}
              maxLength="9"
            />
            <p className="text-xs text-slate-500 mt-1">
              Format: 4 letters, hyphen, 4 characters
            </p>
          </div>

          {error && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 flex items-start gap-2"
            >
              <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
              <p className="text-sm text-red-300">{error}</p>
            </motion.div>
          )}

          <Button
            type="submit"
            disabled={loading || !code.trim()}
            className="w-full h-12 bg-blue-500 hover:bg-blue-600 font-semibold"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                Verify Code <ArrowRight className="w-4 h-4 ml-2" />
              </>
            )}
          </Button>
        </form>
      </div>

      {trainerInfo && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-green-500/10 border border-green-500/30 rounded-2xl p-6"
        >
          <h3 className="font-semibold text-white mb-2">Trainer Found</h3>
          <p className="text-slate-300 mb-1">{trainerInfo.name}</p>
          <p className="text-sm text-slate-400 mb-4 capitalize">
            {trainerInfo.niche}
          </p>
          <p className="text-lg font-bold text-green-400">
            £{(trainerInfo.monthlyRate / 100).toFixed(2)}/month
          </p>
        </motion.div>
      )}
    </motion.div>
  );
}