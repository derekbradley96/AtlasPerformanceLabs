import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { getMessagesListPath, getMessagesThreadPath } from '@/lib/messagesPath';
import { useAuth } from '@/lib/AuthContext';
import { useData } from '@/data/useData';
import { colors, spacing } from '@/ui/tokens';
import { Check, Circle, UserPlus, MessageSquare, FileText, Flag, ClipboardCheck, UtensilsCrossed, ChevronRight } from 'lucide-react';
import { impactLight } from '@/lib/haptics';

async function launchConfetti(options) {
  try {
    const mod = await import('canvas-confetti');
    const confetti = mod?.default || mod;
    if (typeof confetti === 'function') confetti(options);
  } catch {
    // Non-blocking visual effect; ignore failure.
  }
}

const QUICK_WIN_ITEMS = [
  {
    key: 'add_first_client',
    label: 'Add your first client',
    path: '/get-clients',
    icon: UserPlus,
  },
  {
    key: 'send_welcome_message',
    label: 'Send them a welcome message',
    path: '/messages',
    icon: MessageSquare,
  },
  {
    key: 'setup_first_program',
    label: 'Set up their first program',
    path: '/program-builder',
    icon: FileText,
  },
];

const NEXT_UP_CARDS = [
  {
    key: 'peak_week',
    title: 'Peak Week',
    description: 'Build and tune peak protocols for show week.',
    path: '/peak-week-dashboard',
    icon: Flag,
  },
  {
    key: 'checkins',
    title: 'Check-ins',
    description: 'Review updates and keep athlete momentum high.',
    path: '/review-center',
    icon: ClipboardCheck,
  },
  {
    key: 'nutrition',
    title: 'Nutrition',
    description: 'Set plans and make adjustments in one place.',
    path: '/coach/nutrition',
    icon: UtensilsCrossed,
  },
];

export default function CoachOnboardingChecklist() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const data = useData();
  const [clients, setClients] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [threads, setThreads] = useState([]);
  const [loading, setLoading] = useState(true);
  const prevCompletionRef = useRef(null);
  const [celebratingStep, setCelebratingStep] = useState(null);
  const celebrateTimerRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      data.listClients().catch(() => []),
      data.listPrograms().catch(() => []),
      data.listThreads?.().catch(() => []) ?? Promise.resolve([]),
    ]).then(([clientList, programList, threadList]) => {
      if (!cancelled) {
        setClients(Array.isArray(clientList) ? clientList : []);
        setPrograms(Array.isArray(programList) ? programList : []);
        setThreads(Array.isArray(threadList) ? threadList : []);
      }
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [data]);

  useEffect(() => () => {
    if (celebrateTimerRef.current) clearTimeout(celebrateTimerRef.current);
  }, []);

  const hasClient = clients.length >= 1;
  const hasProgram = programs.length >= 1;
  const hasWelcomeMessage = useMemo(() => {
    return threads.some((thread) => {
      const preview = String(thread?.last_message_preview ?? thread?.lastMessage ?? '').trim();
      return preview.length > 0;
    });
  }, [threads]);
  const firstClientId = clients[0]?.id ?? null;

  const completion = useMemo(
    () => ({
      add_first_client: hasClient,
      send_welcome_message: hasWelcomeMessage,
      setup_first_program: hasProgram,
    }),
    [hasClient, hasWelcomeMessage, hasProgram]
  );

  const allQuickWinsComplete = Object.values(completion).every(Boolean);
  const completedCount = Object.values(completion).filter(Boolean).length;

  useEffect(() => {
    if (!prevCompletionRef.current) {
      prevCompletionRef.current = completion;
      return;
    }
    QUICK_WIN_ITEMS.forEach((item) => {
      const wasDone = !!prevCompletionRef.current?.[item.key];
      const isDone = !!completion[item.key];
      if (!wasDone && isDone) {
        setCelebratingStep(item.key);
        void launchConfetti({
          particleCount: 40,
          spread: 70,
          origin: { y: 0.82 },
          scalar: 0.8,
          colors: [colors.success, '#7DE3A6', '#C9F5DA'],
        });
        if (celebrateTimerRef.current) clearTimeout(celebrateTimerRef.current);
        celebrateTimerRef.current = setTimeout(() => setCelebratingStep(null), 850);
      }
    });
    prevCompletionRef.current = completion;
  }, [completion]);

  const handleItemPress = (item) => {
    impactLight();
    if (item.key === 'send_welcome_message') {
      if (!hasClient) return;
      navigate(firstClientId ? getMessagesThreadPath(firstClientId) : getMessagesListPath());
      return;
    }
    if (item.path) navigate(item.path);
  };

  if (loading) return null;

  return (
    <div
      className="rounded-2xl overflow-hidden border min-w-0"
      style={{
        background: colors.card,
        borderColor: colors.border,
        boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
      }}
    >
      <div
        className="flex items-center justify-between px-4 py-3"
        style={{
          borderBottom: `1px solid ${colors.border}`,
          background: 'rgba(255,255,255,0.02)',
        }}
      >
        <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: colors.muted }}>
          Quick wins
        </span>
        <span className="text-xs font-medium tabular-nums" style={{ color: colors.text }}>
          {completedCount}/{QUICK_WIN_ITEMS.length}
        </span>
      </div>
      <ul className="divide-y divide-opacity-10" style={{ borderColor: colors.border }}>
        {QUICK_WIN_ITEMS.map((item) => {
          const done = completion[item.key];
          const isLocked = item.key === 'send_welcome_message' && !hasClient;
          const displayLabel = isLocked ? `${item.label} (after adding a client)` : item.label;
          const Icon = item.icon;
          return (
            <li key={item.key}>
              <button
                type="button"
                onClick={() => handleItemPress(item)}
                className="w-full flex items-center gap-3 text-left active:opacity-90 min-w-0"
                style={{
                  minHeight: 48,
                  padding: spacing[12],
                  paddingLeft: spacing[16],
                  paddingRight: spacing[16],
                  background: 'transparent',
                  border: 'none',
                  color: colors.text,
                  opacity: isLocked ? 0.72 : 1,
                }}
              >
                <div
                  className="flex-shrink-0 rounded-full flex items-center justify-center"
                  style={{
                    width: 28,
                    height: 28,
                    background: done ? 'rgba(34,197,94,0.18)' : colors.surface2,
                    color: done ? colors.success : colors.muted,
                    transform: celebratingStep === item.key ? 'scale(1.16)' : 'scale(1)',
                    transition: 'transform 180ms ease-out',
                  }}
                >
                  {done ? <Check size={16} strokeWidth={2.7} /> : <Icon size={14} style={{ color: colors.muted }} />}
                </div>
                <span
                  className="flex-1 min-w-0 text-[14px] font-medium"
                  style={{
                    color: done ? colors.muted : colors.text,
                  }}
                >
                  {displayLabel}
                </span>
                {!done && item.path && !isLocked && (
                  <Circle size={14} className="flex-shrink-0" style={{ color: colors.muted }} />
                )}
              </button>
            </li>
          );
        })}
      </ul>
      {allQuickWinsComplete ? (
        <div
          style={{
            borderTop: `1px solid ${colors.border}`,
            padding: spacing[16],
            background: 'rgba(34,197,94,0.06)',
          }}
        >
          <p className="text-[14px] font-semibold" style={{ color: colors.success, margin: 0 }}>
            You&apos;re ready to coach! Here&apos;s what to explore next:
          </p>
          <div className="grid grid-cols-1 gap-2 mt-3">
            {NEXT_UP_CARDS.map((card) => {
              const Icon = card.icon;
              return (
                <button
                  key={card.key}
                  type="button"
                  onClick={() => {
                    impactLight();
                    navigate(card.path);
                  }}
                  className="w-full text-left rounded-xl border px-3 py-2.5 flex items-center gap-3 active:opacity-90"
                  style={{
                    borderColor: colors.border,
                    background: colors.card,
                    color: colors.text,
                  }}
                >
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: colors.surface2 }}
                  >
                    <Icon size={16} style={{ color: colors.muted }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-semibold truncate" style={{ margin: 0, color: colors.text }}>{card.title}</p>
                    <p className="text-[12px] truncate" style={{ margin: 0, color: colors.muted }}>{card.description}</p>
                  </div>
                  <ChevronRight size={16} style={{ color: colors.muted }} />
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
