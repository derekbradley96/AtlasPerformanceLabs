import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { isPersonal } from '@/lib/roles';
import { buildPersonalCoachTierSelectionUrl } from '@/lib/marketplaceScreenState';
import { PERSONAL_MARKETPLACE_SOURCE } from '@/lib/personalMarketplaceEntry';
import { motion, AnimatePresence } from 'framer-motion';
import { User, TrendingUp, Zap, X, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

const TRIGGER_TO_SOURCE = {
  plateau: PERSONAL_MARKETPLACE_SOURCE.FROM_PLATEAU,
  nutrition_inconsistent: PERSONAL_MARKETPLACE_SOURCE.FROM_ACCOUNTABILITY,
  frequent_rebuild: PERSONAL_MARKETPLACE_SOURCE.FROM_ADVANCED_REFINEMENT,
};

const triggerConfig = {
  plateau: {
    icon: TrendingUp,
    title: "Break Your Plateau",
    description: "You've been at the same level for a while. Expert coaching can help you progress faster.",
    cta: "Find a Coach"
  },
  nutrition_inconsistent: {
    icon: Zap,
    title: "Nail Your Nutrition",
    description: "A coach ensures consistency and accountability with personalized meal planning.",
    cta: "Get Coached"
  },
  frequent_rebuild: {
    icon: User,
    title: "Custom Training Programs",
    description: "Stop rebuilding workouts. Get a coach to design a structured plan for you.",
    cta: "Explore Coaching"
  }
};

export default function CoachingUpgradeCard({ trigger, reason, variant = 'card' }) {
  const navigate = useNavigate();
  const { effectiveRole } = useAuth();
  const [dismissed, setDismissed] = useState(false);

  const goFindCoach = () => {
    if (isPersonal(effectiveRole)) {
      const source = TRIGGER_TO_SOURCE[trigger] || PERSONAL_MARKETPLACE_SOURCE.FROM_GENERAL_DISCOVERY;
      navigate(buildPersonalCoachTierSelectionUrl({ source }));
    } else {
      navigate('/discover');
    }
  };

  if (!trigger || dismissed) return null;

  const config = triggerConfig[trigger];
  if (!config) return null;

  const Icon = config.icon;

  if (variant === 'banner') {
    return (
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="bg-gradient-to-r from-purple-600/20 to-blue-600/20 border border-purple-500/30 rounded-xl p-4 flex items-start gap-4"
        >
          <div className="flex-1">
            <h3 className="font-semibold text-white text-sm mb-1">{config.title}</h3>
            <p className="text-xs text-slate-300 leading-relaxed">{reason}</p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={goFindCoach}
              className="text-xs font-medium text-blue-400 hover:text-blue-300 transition-colors"
            >
              Learn More
            </button>
            <button
              onClick={() => setDismissed(true)}
              className="text-slate-500 hover:text-slate-400 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </motion.div>
      </AnimatePresence>
    );
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 10 }}
        className="bg-gradient-to-br from-purple-600/20 to-blue-600/20 border border-purple-500/30 rounded-2xl p-6 relative overflow-hidden"
      >
        {/* Background accent */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full -mr-16 -mt-16" />

        <div className="relative z-10">
          {/* Header */}
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                <Icon className="w-5 h-5 text-purple-400" />
              </div>
              <div>
                <h3 className="font-bold text-white text-lg">{config.title}</h3>
                <p className="text-sm text-slate-300 mt-1">{reason}</p>
              </div>
            </div>
            <button
              onClick={() => setDismissed(true)}
              className="text-slate-500 hover:text-slate-400 transition-colors flex-shrink-0"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Benefits */}
          <ul className="space-y-2 mb-4">
            {[
              'Personalized programming',
              'Expert guidance & accountability',
              'Faster, lasting results'
            ].map((benefit) => (
              <li key={benefit} className="flex items-center gap-2 text-sm text-slate-300">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                {benefit}
              </li>
            ))}
          </ul>

          {/* CTA */}
          <Button
            onClick={goFindCoach}
            className="w-full bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white font-semibold flex items-center justify-center gap-2"
          >
            {config.cta}
            <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}