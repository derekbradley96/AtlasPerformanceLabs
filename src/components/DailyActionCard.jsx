import React from 'react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Dumbbell, Calendar, Target, Zap, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';

export default function DailyActionCard({ action }) {
  const navigate = useNavigate();

  if (!action) return null;

  const iconMap = {
    workout: Dumbbell,
    checkin: Calendar,
    program: Target,
    message: MessageSquare,
    default: Zap
  };

  const colorMap = {
    workout: 'from-green-600/20 to-emerald-600/20 border-green-500/30',
    checkin: 'from-blue-600/20 to-blue-500/20 border-blue-500/30',
    program: 'from-purple-600/20 to-pink-600/20 border-purple-500/30',
    message: 'from-orange-600/20 to-red-600/20 border-orange-500/30',
    default: 'from-blue-600/20 to-purple-600/20 border-blue-500/30'
  };

  const Icon = iconMap[action.type] || iconMap.default;
  const colorClass = colorMap[action.type] || colorMap.default;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`bg-gradient-to-br ${colorClass} border-2 rounded-2xl p-6 mb-6`}
    >
      <div className="flex items-start gap-4">
        <div className="w-14 h-14 bg-white/10 rounded-2xl flex items-center justify-center flex-shrink-0">
          <Icon className="w-7 h-7 text-white" />
        </div>
        <div className="flex-1">
          <h2 className="text-lg font-bold text-white mb-1">{action.title}</h2>
          <p className="text-sm text-slate-200 mb-4">{action.description}</p>
          <Button
            onClick={() => navigate(createPageUrl(action.page))}
            className="bg-white/20 hover:bg-white/30 text-white backdrop-blur-sm border border-white/20"
          >
            {action.buttonText}
          </Button>
        </div>
      </div>
    </motion.div>
  );
}