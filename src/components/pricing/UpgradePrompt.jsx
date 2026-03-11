import React from 'react';
import { Crown, ArrowRight, X, Zap, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';

export default function UpgradePrompt({ 
  trigger, 
  savingsAmount, 
  onUpgrade, 
  onDismiss,
  variant = 'banner' // 'banner', 'modal', 'inline'
}) {
  const getTriggerContent = () => {
    switch (trigger) {
      case 'advanced_analytics':
        return {
          icon: TrendingUp,
          title: 'Unlock Advanced Training Intelligence',
          description: 'Get deeper insights into client performance, automated regression alerts, and predictive analytics',
          cta: 'Upgrade to Pro',
          color: 'from-atlas-accent to-atlas-accent/90'
        };
      case 'automation':
        return {
          icon: Zap,
          title: 'Save Time with Automation',
          description: 'Automate check-in reminders, at-risk client nudges, and progress reports',
          cta: 'Unlock Automation',
          color: 'from-atlas-accent to-blue-600'
        };
      case 'savings':
        return {
          icon: Crown,
          title: `Save £${savingsAmount}/month with Pro`,
          description: 'Your current fees exceed the Pro subscription cost. Upgrade to keep more of what you earn.',
          cta: 'Start Saving Now',
          color: 'from-green-600 to-emerald-600'
        };
      case 'scale':
        return {
          icon: TrendingUp,
          title: 'Scale Your Coaching Business',
          description: 'Manage more clients efficiently with advanced analytics and automation',
          cta: 'Upgrade to Pro',
          color: 'from-orange-600 to-red-600'
        };
      default:
        return {
          icon: Crown,
          title: 'Upgrade to Pro',
          description: 'Reduced fees, advanced analytics, and automation',
          cta: 'Learn More',
          color: 'from-atlas-accent to-atlas-border'
        };
    }
  };

  const content = getTriggerContent();
  const Icon = content.icon;

  if (variant === 'modal') {
    return (
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={onDismiss}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className={`bg-atlas-primary border border-atlas-border rounded-2xl p-6 max-w-md w-full relative`}
          >
            <button
              onClick={onDismiss}
              className="absolute top-4 right-4 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <div className={`w-12 h-12 bg-gradient-to-br ${content.color} rounded-xl flex items-center justify-center mb-4`}>
              <Icon className="w-6 h-6 text-white" />
            </div>

            <h3 className="text-xl font-bold text-white mb-2">{content.title}</h3>
            <p className="text-slate-400 mb-6">{content.description}</p>

            <div className="flex gap-3">
              <Button
                onClick={onUpgrade}
                className={`flex-1 bg-gradient-to-r ${content.color} hover:opacity-90`}
              >
                {content.cta}
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
              <Button
                onClick={onDismiss}
                variant="outline"
                className="border-atlas-border"
              >
                Maybe Later
              </Button>
            </div>
          </motion.div>
        </motion.div>
      </AnimatePresence>
    );
  }

  if (variant === 'inline') {
    return (
      <div className={`bg-gradient-to-r ${content.color} bg-opacity-10 border border-white/10 rounded-2xl p-5 relative`}>
        <button
          onClick={onDismiss}
          className="absolute top-3 right-3 text-white/60 hover:text-white"
        >
          <X className="w-4 h-4" />
        </button>
        
        <div className="flex items-start gap-4">
          <div className={`w-10 h-10 bg-gradient-to-br ${content.color} rounded-xl flex items-center justify-center flex-shrink-0`}>
            <Icon className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1">
            <h4 className="font-semibold text-white mb-1">{content.title}</h4>
            <p className="text-sm text-slate-300 mb-3">{content.description}</p>
            <Button
              onClick={onUpgrade}
              size="sm"
              className="bg-atlas-accent text-white hover:bg-atlas-accent/90"
            >
              {content.cta}
              <ArrowRight className="w-3 h-3 ml-1" />
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Default: banner
  return (
    <motion.div
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: -20, opacity: 0 }}
      className={`bg-gradient-to-r ${content.color} rounded-2xl p-4 relative`}
    >
      <button
        onClick={onDismiss}
        className="absolute top-2 right-2 text-white/80 hover:text-white"
      >
        <X className="w-4 h-4" />
      </button>

      <div className="flex items-center gap-3 pr-6">
        <Icon className="w-5 h-5 text-white flex-shrink-0" />
        <div className="flex-1">
          <p className="font-semibold text-white text-sm">{content.title}</p>
          <p className="text-white/80 text-xs">{content.description}</p>
        </div>
        <Button
          onClick={onUpgrade}
          size="sm"
          className="bg-atlas-accent text-white hover:bg-atlas-accent/90"
        >
          {content.cta}
        </Button>
      </div>
    </motion.div>
  );
}