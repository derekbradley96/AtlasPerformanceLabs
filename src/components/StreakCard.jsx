import React from 'react';
import { Flame, Trophy, TrendingUp } from 'lucide-react';
import { motion } from 'framer-motion';

export default function StreakCard({ workoutStreak = 0, checkinStreak = 0, showNudge = false }) {
  const maxStreak = Math.max(workoutStreak, checkinStreak);
  
  if (maxStreak === 0 && !showNudge) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-gradient-to-br from-orange-600/20 to-red-600/20 border border-orange-500/30 rounded-2xl p-5"
    >
      {maxStreak > 0 ? (
        <>
          <div className="flex items-center gap-2 mb-4">
            <Flame className="w-5 h-5 text-orange-400" />
            <h3 className="font-semibold text-white">You're on fire!</h3>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {workoutStreak > 0 && (
              <div className="bg-slate-800/50 rounded-xl p-3 text-center">
                <p className="text-2xl font-bold text-white">{workoutStreak}</p>
                <p className="text-xs text-slate-400">Workout Streak</p>
              </div>
            )}
            {checkinStreak > 0 && (
              <div className="bg-slate-800/50 rounded-xl p-3 text-center">
                <p className="text-2xl font-bold text-white">{checkinStreak}</p>
                <p className="text-xs text-slate-400">Check-in Streak</p>
              </div>
            )}
          </div>
          {maxStreak >= 7 && (
            <div className="mt-3 flex items-center gap-2 text-sm text-orange-300">
              <Trophy className="w-4 h-4" />
              <span>Keep it going! Consistency is key.</span>
            </div>
          )}
        </>
      ) : showNudge ? (
        <>
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-5 h-5 text-orange-400" />
            <h3 className="font-semibold text-white">Let's restart today</h3>
          </div>
          <p className="text-sm text-slate-300">
            Every journey has its moments. Let's get back on track together.
          </p>
        </>
      ) : null}
    </motion.div>
  );
}