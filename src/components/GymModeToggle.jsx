import React from 'react';
import { Moon, Sun } from 'lucide-react';

export default function GymModeToggle({ enabled, onChange }) {
  return (
    <button
      onClick={() => onChange(!enabled)}
      className={`p-2 rounded-lg transition-all ${
        enabled
          ? 'bg-yellow-500 text-black hover:bg-yellow-400'
          : 'bg-slate-800 text-slate-400 hover:text-slate-300 hover:bg-slate-700'
      }`}
      title={enabled ? 'Exit Gym Mode' : 'Enter Gym Mode'}
    >
      {enabled ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
    </button>
  );
}