import React, { useState, useCallback } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { getMyTrainingSessions, getTrainerKey, addMyTrainingSession } from '@/lib/myTrainingSessionsStore';
import { impactLight } from '@/lib/haptics';
import { colors, spacing } from '@/ui/tokens';

export default function MyTraining() {
  const { user, supabaseUser } = useAuth();
  const trainerKey = getTrainerKey(supabaseUser ?? user);
  const [sessions, setSessions] = useState(() => getMyTrainingSessions(trainerKey));

  const handleStartSession = useCallback(async () => {
    await impactLight();
    addMyTrainingSession(trainerKey, {
      date: new Date().toISOString().split('T')[0],
      sessionName: 'Session',
      exercisesSummary: '',
    });
    setSessions(getMyTrainingSessions(trainerKey));
  }, [trainerKey]);

  return (
    <div
      className="min-h-screen min-w-0 max-w-full overflow-x-hidden"
      style={{
        background: colors.bg,
        paddingTop: spacing[16],
        paddingLeft: 'max(' + spacing[16] + 'px, env(safe-area-inset-left, 0px))',
        paddingRight: 'max(' + spacing[16] + 'px, env(safe-area-inset-right, 0px))',
        paddingBottom: 'calc(' + spacing[24] + 'px + env(safe-area-inset-bottom, 0px))',
      }}
    >
      <h1 className="text-[22px] font-bold mb-1" style={{ color: colors.text }}>My Training</h1>
      <p className="text-[14px] mb-6" style={{ color: colors.muted }}>Run your own sessions</p>

      <section style={{ marginBottom: spacing[24] }}>
        <button
          type="button"
          onClick={handleStartSession}
          className="w-full rounded-xl py-3 text-[15px] font-semibold min-w-0 active:opacity-90"
          style={{ background: colors.accent, color: '#fff' }}
        >
          Start session
        </button>
      </section>

      <section>
        <h2 className="text-[13px] font-semibold uppercase tracking-wider mb-3" style={{ color: colors.muted }}>Recent sessions</h2>
        {sessions.length === 0 ? (
          <div
            className="rounded-[20px] border py-8 px-4 text-center"
            style={{ background: colors.card, borderColor: colors.border }}
          >
            <p className="text-[14px]" style={{ color: colors.muted }}>No sessions yet. Tap “Start session” to log one.</p>
          </div>
        ) : (
          <ul className="list-none p-0 m-0" style={{ display: 'flex', flexDirection: 'column', gap: spacing[12] }}>
            {sessions.map((s, i) => (
              <li
                key={i}
                className="rounded-[20px] border p-4"
                style={{ background: colors.card, borderColor: colors.border }}
              >
                <p className="text-[15px] font-medium truncate" style={{ color: colors.text }}>{s.sessionName}</p>
                <p className="text-[13px] mt-0.5" style={{ color: colors.muted }}>{s.date}{s.exercisesSummary ? ` · ${s.exercisesSummary}` : ''}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
