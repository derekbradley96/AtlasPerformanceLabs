import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ClipboardList, MessageSquare, CreditCard, UserPlus, Check, Flame } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { getCloseoutCounts } from '@/lib/inboxService';
import {
  getStreak,
  wasCloseoutDoneToday,
  markCloseoutComplete,
  getTodayTotalItemsSnapshot,
  setTodayTotalItemsSnapshot,
  getFocusScore,
  getWeeklyCloseoutHistory,
  getCloseoutLogToday,
} from '@/lib/closeoutStore';
import { notificationSuccess } from '@/lib/haptics';
import Card from '@/ui/Card';
import Button from '@/ui/Button';
import { colors, spacing } from '@/ui/tokens';

const CATEGORIES = [
  { key: 'checkinReview', label: 'Reviews', icon: ClipboardList, type: 'CHECKIN_REVIEW', filter: 'reviews' },
  { key: 'overduePayments', label: 'Payments', icon: CreditCard, type: 'PAYMENT_OVERDUE', filter: 'payments' },
  { key: 'unreadMessages', label: 'Messages', icon: MessageSquare, type: 'UNREAD_MESSAGE', filter: 'messages' },
  { key: 'newLeads', label: 'Leads', icon: UserPlus, type: 'NEW_LEAD', filter: 'leads' },
];

export default function Closeout() {
  const navigate = useNavigate();
  const { role, user, isDemoMode } = useAuth();
  const trainerId = isDemoMode ? 'demo-trainer' : user?.id ?? 'trainer-1';

  const [refreshKey, setRefreshKey] = useState(0);

  const counts = useMemo(() => getCloseoutCounts(trainerId), [trainerId, refreshKey]);
  const streak = getStreak();
  const alreadyDoneToday = wasCloseoutDoneToday();
  const allResolved = counts.total === 0;
  const completedCount = counts.completed;
  const totalCategories = 4;

  const todaySnapshot = getTodayTotalItemsSnapshot();
  const closeoutLogToday = getCloseoutLogToday();
  useEffect(() => {
    if (todaySnapshot === null) setTodayTotalItemsSnapshot(counts.total);
  }, [counts.total, todaySnapshot]);
  const totalItemsToday = todaySnapshot ?? counts.total;
  const focusScore = getFocusScore(counts.total, totalItemsToday);
  const weeklyHistory = useMemo(() => getWeeklyCloseoutHistory(), [refreshKey]);
  const hasActiveItems = counts.total > 0;

  const handleResolve = useCallback(
    (filter) => {
      navigate(`/review-center?tab=active&filter=${filter}`);
    },
    [navigate]
  );

  const handleFinishCloseout = useCallback(() => {
    navigate('/review-center?tab=active&filter=all');
  }, [navigate]);

  const handleMarkComplete = useCallback(async () => {
    if (!allResolved) return;
    markCloseoutComplete({ totalCleared: totalItemsToday, durationEstimate: 0 });
    await notificationSuccess();
    setRefreshKey((k) => k + 1);
  }, [allResolved, totalItemsToday]);

  if (role !== 'trainer') {
    return (
      <div className="app-screen p-4" style={{ color: colors.muted }}>
        <p>Closeout is for trainers only.</p>
      </div>
    );
  }

  return (
    <div
      className="app-screen min-w-0 max-w-full overflow-x-hidden"
      style={{
        paddingBottom: `calc(${spacing[24]} + env(safe-area-inset-bottom, 0px))`,
      }}
    >
      {/* Focus % circle + streak + categories summary */}
      <Card style={{ padding: spacing[20], marginBottom: spacing[16], borderRadius: 20 }}>
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex-shrink-0 flex flex-col items-center gap-1">
            <FocusScoreRing score={focusScore} size={72} />
            <span className="text-[12px] font-medium" style={{ color: colors.muted }}>Focus %</span>
          </div>
          <div className="flex-shrink-0 flex flex-col items-center gap-1">
            <div className="flex items-center gap-1.5" style={{ minHeight: 72, alignItems: 'center' }}>
              <Flame size={28} style={{ color: streak > 0 ? '#F59E0B' : colors.muted }} />
              <span className="text-[24px] font-bold tabular-nums" style={{ color: colors.text }}>{streak}</span>
              <span className="text-[14px]" style={{ color: colors.muted }}>day{streak !== 1 ? 's' : ''}</span>
            </div>
            <span className="text-[12px] font-medium" style={{ color: colors.muted }}>Closeout streak</span>
          </div>
          <div className="flex-1 min-w-0">
            {allResolved ? (
              <>
                <p className="text-[17px] font-semibold" style={{ color: colors.text }}>Today secured.</p>
                <p className="text-[14px] mt-0.5" style={{ color: colors.muted }}>All clients handled.</p>
              </>
            ) : (
              <>
                <p className="text-[17px] font-semibold" style={{ color: colors.text }}>Today's Closeout</p>
                <p className="text-[14px] mt-0.5" style={{ color: colors.muted }}>{completedCount} of 4 cleared</p>
              </>
            )}
          </div>
        </div>
      </Card>

      {/* Done today summary */}
      {closeoutLogToday && (closeoutLogToday.totalCleared > 0 || closeoutLogToday.counts) && (
        <Card style={{ padding: spacing[16], marginBottom: spacing[16], borderRadius: 20 }}>
          <p className="text-[13px] font-medium mb-2" style={{ color: colors.muted }}>Done today</p>
          <p className="text-[15px]" style={{ color: colors.text }}>
            {closeoutLogToday.totalCleared != null && closeoutLogToday.totalCleared > 0
              ? `${closeoutLogToday.totalCleared} item${closeoutLogToday.totalCleared !== 1 ? 's' : ''} cleared`
              : 'Closeout logged'}
            {closeoutLogToday.durationEstimate > 0 ? ` · ~${closeoutLogToday.durationEstimate} min` : ''}
          </p>
          {closeoutLogToday.counts && Object.values(closeoutLogToday.counts).some((n) => n > 0) && (
            <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 text-[13px]" style={{ color: colors.muted }}>
              {closeoutLogToday.counts.reviews > 0 && <span>Reviews: {closeoutLogToday.counts.reviews}</span>}
              {closeoutLogToday.counts.messages > 0 && <span>Messages: {closeoutLogToday.counts.messages}</span>}
              {closeoutLogToday.counts.payments > 0 && <span>Payments: {closeoutLogToday.counts.payments}</span>}
              {closeoutLogToday.counts.posing > 0 && <span>Posing: {closeoutLogToday.counts.posing}</span>}
              {closeoutLogToday.counts.leads > 0 && <span>Leads: {closeoutLogToday.counts.leads}</span>}
            </div>
          )}
        </Card>
      )}

      {/* Weekly consistency bar chart */}
      <Card style={{ padding: spacing[16], marginBottom: spacing[20], borderRadius: 20 }}>
        <p className="text-[14px] font-semibold mb-3" style={{ color: colors.text }}>Weekly consistency</p>
        <div className="flex items-end justify-between gap-1" style={{ height: 48 }}>
          {weeklyHistory.map((day) => (
            <div key={day.dateStr} className="flex-1 flex flex-col items-center gap-1 min-w-0">
              <div
                className="w-full rounded-t transition-all duration-300"
                style={{
                  height: day.done ? 32 : 8,
                  maxHeight: 32,
                  background: day.done ? colors.success : 'rgba(255,255,255,0.1)',
                }}
                title={day.done ? `${day.label}: Done` : `${day.label}: Not done`}
              />
              <span className="text-[10px] truncate w-full text-center" style={{ color: colors.muted }}>{day.label}</span>
            </div>
          ))}
        </div>
      </Card>

      {/* 4 compact resolve rows */}
      <div className="space-y-3">
        {CATEGORIES.map((cat) => {
          const count = counts[cat.key] ?? 0;
          const resolved = count === 0;
          const Icon = cat.icon;
          return (
            <button
              key={cat.key}
              type="button"
              onClick={() => !resolved && handleResolve(cat.filter)}
              className="w-full text-left rounded-[20px] overflow-hidden border transition-colors active:opacity-90 min-w-0"
              style={{
                background: colors.card,
                borderColor: colors.border,
                padding: spacing[14],
                paddingLeft: spacing[16],
                paddingRight: spacing[16],
                opacity: resolved ? 0.85 : 1,
              }}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{
                      background: resolved ? 'rgba(34,197,94,0.2)' : 'rgba(255,255,255,0.08)',
                      color: resolved ? colors.success : colors.muted,
                    }}
                  >
                    {resolved ? <Check size={20} /> : <Icon size={20} />}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[15px] font-semibold" style={{ color: colors.text }}>{cat.label}</p>
                    <p className="text-[13px]" style={{ color: colors.muted }}>
                      {resolved ? 'Cleared' : `${count} need${count === 1 ? 's' : ''} attention`}
                    </p>
                  </div>
                </div>
                {!resolved && (
                  <span className="text-[14px] font-medium flex-shrink-0" style={{ color: colors.accent }}>
                    Resolve
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* If active items remain: Finish closeout → Global Review */}
      {hasActiveItems && (
        <div style={{ marginTop: spacing[16] }}>
          <Button variant="primary" onClick={handleFinishCloseout} style={{ width: '100%' }}>
            Finish closeout
          </Button>
          <p className="text-center text-[12px] mt-2" style={{ color: colors.muted }}>
            Opens Review Center to clear remaining items
          </p>
        </div>
      )}

      {/* Completion state: optional footer */}
      {allResolved && (
        <>
          {!alreadyDoneToday && (
            <div style={{ marginTop: spacing[20] }}>
              <Button variant="primary" onClick={handleMarkComplete} style={{ width: '100%' }}>
                Log closeout
              </Button>
            </div>
          )}
          <p className="text-center text-[13px] mt-6" style={{ color: colors.muted }}>
            Consistency builds trust.
          </p>
        </>
      )}
    </div>
  );
}

/** Focus % circle: score 0–100, with percentage label in center. */
function FocusScoreRing({ score, size = 72 }) {
  const stroke = Math.max(4, size / 9);
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const progress = Math.min(100, Math.max(0, score)) / 100;
  const strokeDashoffset = circumference * (1 - progress);
  const cx = size / 2;
  const cy = size / 2;

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={size} height={size} className="transform -rotate-90" style={{ overflow: 'visible' }}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={stroke} />
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke={colors.success}
          strokeWidth={stroke}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.3s ease' }}
        />
      </svg>
      <span
        className="absolute text-[14px] font-bold tabular-nums"
        style={{ color: colors.text }}
      >
        {score}%
      </span>
    </div>
  );
}
