import React, { useState } from 'react';
import { Zap, ChevronRight } from 'lucide-react';

const DEFAULT_TEMPLATES = [
  "Great work this week 💪",
  "Let's adjust calories",
  "Focus on sleep + steps",
  "Deload this week",
  "Looking strong! Keep it up",
  "Check in with me on progress"
];

export default function QuickReplies({ onSelect }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border-t border-slate-800 bg-slate-900/50 p-3">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors mb-2"
      >
        <Zap className="w-4 h-4" />
        <span>Quick Replies</span>
        <ChevronRight className={`w-4 h-4 transition-transform ${expanded ? 'rotate-90' : ''}`} />
      </button>
      
      {expanded && (
        <div className="grid grid-cols-2 gap-2">
          {DEFAULT_TEMPLATES.map((template, idx) => (
            <button
              key={idx}
              onClick={() => {
                onSelect(template);
                setExpanded(false);
              }}
              className="text-left text-sm bg-slate-800 hover:bg-slate-700 rounded-lg px-3 py-2 text-slate-300 transition-colors"
            >
              {template}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}