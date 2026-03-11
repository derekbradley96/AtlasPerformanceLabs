import React from 'react';
import { Crown, TrendingUp, Clock, Zap } from 'lucide-react';
import { motion } from 'framer-motion';

export default function ProValueCard({ monthlySavings, automationsUsed, insightsViewed }) {
  const benefits = [
    {
      icon: TrendingUp,
      label: 'Saved this month',
      value: `£${monthlySavings}`,
      color: 'text-green-400'
    },
    {
      icon: Zap,
      label: 'Automations run',
      value: automationsUsed || 0,
      color: 'text-blue-400'
    },
    {
      icon: Clock,
      label: 'Time saved',
      value: `${Math.round((automationsUsed || 0) * 5)}m`,
      color: 'text-blue-400'
    }
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-gradient-to-br from-yellow-500/10 to-orange-500/10 border border-yellow-500/30 rounded-2xl p-5"
    >
      <div className="flex items-center gap-2 mb-4">
        <Crown className="w-5 h-5 text-yellow-400" />
        <h3 className="font-semibold text-white">Pro Value This Month</h3>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {benefits.map((benefit, i) => {
          const Icon = benefit.icon;
          return (
            <div key={i} className="text-center">
              <Icon className={`w-5 h-5 ${benefit.color} mx-auto mb-2`} />
              <p className={`text-xl font-bold ${benefit.color}`}>{benefit.value}</p>
              <p className="text-xs text-slate-400 mt-1">{benefit.label}</p>
            </div>
          );
        })}
      </div>

      <p className="text-xs text-slate-400 text-center mt-4">
        💎 You're making the most of Pro. Keep up the great work!
      </p>
    </motion.div>
  );
}