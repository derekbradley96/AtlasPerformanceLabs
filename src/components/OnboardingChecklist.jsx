import React from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, Circle, ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';

export default function OnboardingChecklist({ tasks, onDismiss }) {
  const navigate = useNavigate();
  const completedCount = tasks.filter(t => t.completed).length;
  const progress = (completedCount / tasks.length) * 100;

  if (completedCount === tasks.length) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-atlas-surface/50 border border-atlas-border/50 rounded-2xl p-5 mb-6"
    >
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="font-semibold text-white text-sm mb-1">Steps</h3>
          <p className="text-sm text-slate-300">{completedCount} of {tasks.length} completed</p>
        </div>
        <button
          onClick={onDismiss}
          className="text-slate-400 hover:text-white text-sm"
        >
          Dismiss
        </button>
      </div>

      {/* Progress Bar */}
      <div className="w-full h-2 bg-atlas-border/50 rounded-full mb-4 overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          className="h-full bg-atlas-accent"
        />
      </div>

      {/* Task List */}
      <div className="space-y-2">
        {tasks.map((task, i) => (
          <button
            key={i}
            onClick={() => task.action && task.action()}
            disabled={task.completed}
            className={`w-full flex items-center gap-3 p-3 rounded-xl transition-colors ${
              task.completed
                ? 'bg-green-500/10 cursor-default'
                : 'bg-atlas-surface/50 hover:bg-atlas-surface'
            }`}
          >
            {task.completed ? (
              <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0" />
            ) : (
              <Circle className="w-5 h-5 text-slate-500 flex-shrink-0" />
            )}
            <span className={`text-sm flex-1 text-left ${
              task.completed ? 'text-slate-400 line-through' : 'text-white'
            }`}>
              {task.label}
            </span>
            {!task.completed && task.action && (
              <ChevronRight className="w-4 h-4 text-slate-500" />
            )}
          </button>
        ))}
      </div>
    </motion.div>
  );
}