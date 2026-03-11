import React from 'react';
import { formatDistanceToNow } from 'date-fns';
import { 
  Dumbbell, Target, Calendar, MessageSquare, 
  CheckCircle2, TrendingUp, Award 
} from 'lucide-react';
import { motion } from 'framer-motion';

export default function ActivityFeed({ activities, maxItems = 10 }) {
  if (!activities || activities.length === 0) {
    return (
      <div className="text-center py-8">
        <div className="w-12 h-12 bg-atlas-surface rounded-xl flex items-center justify-center mb-3 mx-auto">
          <TrendingUp className="w-6 h-6 text-slate-500" />
        </div>
        <p className="text-slate-500 text-sm">No recent activity</p>
      </div>
    );
  }

  const getActivityIcon = (type) => {
    const iconMap = {
      workout_completed: Dumbbell,
      program_assigned: Target,
      program_updated: Target,
      checkin_submitted: Calendar,
      message_sent: MessageSquare,
      streak_milestone: Award,
      pr_achieved: CheckCircle2
    };
    return iconMap[type] || TrendingUp;
  };

  const getActivityColor = (type) => {
    const colorMap = {
      workout_completed: 'text-green-400',
      program_assigned: 'text-blue-400',
      program_updated: 'text-blue-400',
      checkin_submitted: 'text-blue-400',
      message_sent: 'text-orange-400',
      streak_milestone: 'text-yellow-400',
      pr_achieved: 'text-pink-400'
    };
    return colorMap[type] || 'text-slate-400';
  };

  return (
    <div className="space-y-3">
      {activities.slice(0, maxItems).map((activity, i) => {
        const Icon = getActivityIcon(activity.type);
        const colorClass = getActivityColor(activity.type);
        
        return (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.05 }}
            className="flex items-start gap-3 p-3 bg-atlas-surface/30 rounded-xl"
          >
            <div className={`w-8 h-8 bg-atlas-border/50 rounded-lg flex items-center justify-center flex-shrink-0`}>
              <Icon className={`w-4 h-4 ${colorClass}`} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-white font-medium">{activity.title}</p>
              {activity.description && (
                <p className="text-xs text-slate-400 mt-0.5">{activity.description}</p>
              )}
              <p className="text-xs text-slate-500 mt-1">
                {formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true })}
              </p>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}