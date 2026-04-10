import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, X, TrendingUp } from 'lucide-react';
import { colors } from '@/ui/tokens';
import { Button } from '@/components/ui/button';

export default function UpgradePrompt({
  prompt,
  variant = null,
  onDismiss,
  onUpgrade,
  onShown,
}) {
  useEffect(() => {
    if (!prompt || typeof onShown !== 'function') return;
    onShown(prompt);
  }, [prompt, onShown]);

  if (!prompt) return null;
  const mode = variant || prompt.variant || 'banner';
  const title = prompt.title || "You're growing";
  const body = prompt.body || 'See which plan keeps more of your revenue.';
  const ctaLabel = prompt.ctaLabel || 'View plans';

  const handleUpgrade = () => {
    onUpgrade?.(prompt);
  };

  if (mode === 'modal') {
    return (
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-black/55 p-4 flex items-center justify-center"
          onClick={() => onDismiss?.(prompt)}
        >
          <motion.div
            initial={{ y: 10, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 8, opacity: 0, scale: 0.98 }}
            className="w-full max-w-md rounded-2xl border p-5"
            style={{ background: colors.surface, borderColor: colors.border, color: colors.text }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: colors.accent }}>Growth signal</p>
                <h3 className="text-lg font-semibold mt-1">{title}</h3>
              </div>
              <button type="button" className="opacity-70 hover:opacity-100" onClick={() => onDismiss?.(prompt)} aria-label="Dismiss">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-sm mt-2" style={{ color: colors.muted }}>{body}</p>
            <div className="mt-4 flex gap-2">
              <Button className="flex-1" onClick={handleUpgrade}>
                {ctaLabel}
                <ArrowRight className="w-4 h-4 ml-1.5" />
              </Button>
              <Button variant="outline" className="flex-1" onClick={() => onDismiss?.(prompt)}>
                Not now
              </Button>
            </div>
          </motion.div>
        </motion.div>
      </AnimatePresence>
    );
  }

  if (mode === 'inline') {
    return (
      <div className="rounded-xl border p-4" style={{ borderColor: colors.border, background: colors.surface1 }}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: colors.accent }}>Growth signal</p>
            <p className="text-sm font-semibold mt-1" style={{ color: colors.text }}>{title}</p>
            <p className="text-xs mt-1" style={{ color: colors.muted }}>{body}</p>
            <div className="mt-3 flex items-center gap-2">
              <Button size="sm" onClick={handleUpgrade}>{ctaLabel}</Button>
              <button type="button" className="text-xs font-medium" style={{ color: colors.muted }} onClick={() => onDismiss?.(prompt)}>
                Dismiss
              </button>
            </div>
          </div>
          <TrendingUp className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: colors.primary }} />
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border px-3 py-2.5" style={{ borderColor: colors.border, background: 'rgba(59,130,246,0.08)' }}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold" style={{ color: colors.text }}>{title}</p>
          <p className="text-xs mt-0.5" style={{ color: colors.muted }}>{body}</p>
          <Link
            to="/plan"
            onClick={(e) => {
              e.preventDefault();
              handleUpgrade();
            }}
            className="inline-flex items-center text-xs font-semibold mt-1.5"
            style={{ color: colors.primary }}
          >
            {ctaLabel}
            <ArrowRight className="w-3 h-3 ml-1" />
          </Link>
        </div>
        <button type="button" className="opacity-70 hover:opacity-100" onClick={() => onDismiss?.(prompt)} aria-label="Dismiss">
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
