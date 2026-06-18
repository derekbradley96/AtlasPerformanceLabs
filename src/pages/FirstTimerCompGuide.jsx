import React, { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import TopBar from '@/components/ui/TopBar';
import Card from '@/ui/Card';
import { colors, spacing } from '@/ui/tokens';
import { ChevronDown, ChevronRight } from 'lucide-react';

const SECTIONS = [
  {
    id: 'peak_week',
    title: 'What is peak week?',
    bullets: [
      'Carb depletion then structured loading refills muscle glycogen so you look full, not flat, on stage.',
      'Water and sodium are adjusted with your coach — never freestyle this without their protocol.',
      'Feeling flat or “small” during depletion is common and temporary; it is not a sign you lost muscle overnight.',
    ],
  },
  {
    id: 'show_day',
    title: 'Show day: what to expect',
    bullets: [
      'Registration and check-ins: plan to arrive roughly 1–2 hours before your coach’s target time so you are not rushed.',
      'Prejudging is comparisons and placements; finals are presentation rounds — energy and polish still matter.',
      'Pump room: be efficient, respect shared space, and follow your coach’s pump timing.',
      'Judges score your division criteria (symmetry, conditioning, presentation) — ask your coach how that maps to you.',
      'Morning food and fluids follow your written plan — surprises on show day are rarely helpful.',
    ],
  },
  {
    id: 'judging',
    title: 'How judging works',
    bullets: [
      'Comparisons shuffle you so judges can see lines next to peers — it is normal to move often.',
      'Callbacks mean you are still in play for that round — they are not random “punishments”.',
      'Overall awards combine multiple classes — placings can surprise first-timers; focus on execution.',
      'First show is for learning the stage as much as the score sheet — use it as data for the next block.',
    ],
  },
  {
    id: 'after_show',
    title: 'After the show: what nobody tells you',
    bullets: [
      'Post-show blues are real, common, and temporary — structure, sunlight, and honest check-ins help.',
      'Rebound hunger is physiological and psychological — work with your coach on structured reintroduction, not shame cycles.',
      'Reverse dieting is how coaches protect metabolism and relationship with food — follow the plan even when appetite spikes.',
      'Off-season planning: once recovery stabilises, your coach will map timelines for health, muscle, and the next season.',
    ],
  },
];

function readSet() {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = window.localStorage.getItem('atlas_first_timer_guide_read_ids');
    const arr = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

function persistSet(ids) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem('atlas_first_timer_guide_read_ids', JSON.stringify([...ids]));
  } catch {
    /* ignore */
  }
}

export default function FirstTimerCompGuide() {
  const navigate = useNavigate();
  const [openId, setOpenId] = useState(SECTIONS[0]?.id || null);
  const [readIds, setReadIds] = useState(() => readSet());

  const progressLabel = useMemo(() => {
    const n = SECTIONS.filter((s) => readIds.has(s.id)).length;
    return `${n} of ${SECTIONS.length} sections read`;
  }, [readIds]);

  const markRead = useCallback((id) => {
    setReadIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      persistSet(next);
      return next;
    });
  }, []);

  return (
    <div className="min-h-screen" style={{ background: colors.bg, color: colors.text }}>
      <TopBar title="First comp guide" onBack={() => navigate(-1)} />
      <div className="p-4 pb-24 max-w-lg mx-auto">
        <p className="text-sm m-0 mb-1" style={{ color: colors.muted }}>
          Stepped reference for your first prep season — open each card when you are ready.
        </p>
        <p className="text-xs font-semibold mb-4 m-0" style={{ color: colors.primary }}>
          {progressLabel}
        </p>
        <div className="flex flex-col gap-3">
          {SECTIONS.map((s) => {
            const open = openId === s.id;
            return (
              <Card key={s.id} style={{ padding: spacing[14] }}>
                <button
                  type="button"
                  className="w-full flex items-center justify-between text-left gap-2"
                  onClick={() => {
                    setOpenId(open ? null : s.id);
                    markRead(s.id);
                  }}
                  style={{ color: colors.text, fontWeight: 700 }}
                >
                  <span>{s.title}</span>
                  {open ? <ChevronDown size={20} style={{ color: colors.muted }} /> : <ChevronRight size={20} style={{ color: colors.muted }} />}
                </button>
                {open ? (
                  <ul className="mt-3 pl-4 space-y-2 m-0" style={{ color: colors.textSecondary, fontSize: 14, lineHeight: 1.5 }}>
                    {s.bullets.map((b) => (
                      <li key={b.slice(0, 24)}>{b}</li>
                    ))}
                  </ul>
                ) : null}
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
