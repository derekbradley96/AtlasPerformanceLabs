import React from 'react';
import { TrendingUp, Minus, AlertCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export default function ClientProgressStatus({ snapshot }) {
  if (!snapshot) {
    return (
      <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-5">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 bg-blue-500/20 rounded-xl flex items-center justify-center">
            <TrendingUp className="w-6 h-6 text-blue-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white mb-1">Getting Started</h3>
            <p className="text-sm text-slate-400">Complete more workouts to see your progress status</p>
          </div>
        </div>
      </div>
    );
  }

  const getStatusConfig = () => {
    switch (snapshot.overall_trend) {
      case 'improving':
        return {
          icon: TrendingUp,
          color: 'text-green-400',
          bgColor: 'bg-green-500/20',
          borderColor: 'border-green-500/30',
          badge: 'bg-green-500/20 text-green-400 border-green-500/30',
          label: 'Improving',
          message: "You're making great progress! Your coach is pleased with your performance."
        };
      case 'needs_attention':
        return {
          icon: AlertCircle,
          color: 'text-orange-400',
          bgColor: 'bg-orange-500/20',
          borderColor: 'border-orange-500/30',
          badge: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
          label: 'Needs Attention',
          message: "Your coach is reviewing your program to help you break through."
        };
      default:
        return {
          icon: Minus,
          color: 'text-blue-400',
          bgColor: 'bg-blue-500/20',
          borderColor: 'border-blue-500/30',
          badge: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
          label: 'Stable',
          message: "You're maintaining consistency. Keep up the great work!"
        };
    }
  };

  const config = getStatusConfig();
  const Icon = config.icon;

  return (
    <div className={`bg-slate-800/50 border ${config.borderColor} rounded-2xl p-5`}>
      <div className="flex items-start gap-4">
        <div className={`w-12 h-12 ${config.bgColor} rounded-xl flex items-center justify-center`}>
          <Icon className={`w-6 h-6 ${config.color}`} />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <h3 className="text-lg font-semibold text-white">Your Progress</h3>
            <Badge className={config.badge}>{config.label}</Badge>
          </div>
          <p className="text-sm text-slate-400">{config.message}</p>
        </div>
      </div>
    </div>
  );
}