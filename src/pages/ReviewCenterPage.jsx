/**
 * Coach-side Review Center: list of clients with latest check-in status.
 * Status: New (submitted within 48h, not reviewed), Missed (no check-in for current week), Up to date.
 */
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import TopBar from '@/components/ui/TopBar';
import Card from '@/ui/Card';
import { colors, spacing } from '@/ui/tokens';
import { getCoachClients, getLatestCheckinsForCoach, getWeekStartISO } from '@/lib/checkins';
import { ChevronRight } from 'lucide-react';

const STATUS_NEW = 'new';
const STATUS_MISSED = 'missed';
const STATUS_UP_TO_DATE = 'up_to_date';

const FORTY_EIGHT_HOURS_MS = 48 * 60 * 60 * 1000;

function getStatus(client, latest, currentWeekStart) {
  if (!latest) return STATUS_MISSED;
  if (latest.week_start !== currentWeekStart) return STATUS_MISSED;
  const submittedAt = latest.submitted_at ? new Date(latest.submitted_at).getTime() : 0;
  const within48h = Date.now() - submittedAt <= FORTY_EIGHT_HOURS_MS;
  const reviewed = !!(latest.reviewed_at || latest.reviewed_by);
  if (within48h && !reviewed) return STATUS_NEW;
  return STATUS_UP_TO_DATE;
}

function sortOrder(status) {
  if (status === STATUS_NEW) return 0;
  if (status === STATUS_MISSED) return 1;
  return 2;
}

export default function ReviewCenterPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [clients, setClients] = useState([]);
  const [latestMap, setLatestMap] = useState({});

  const currentWeekStart = useMemo(() => getWeekStartISO(), []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const list = await getCoachClients();
      if (cancelled) return;
      setClients(list);
      const ids = list.map((c) => c.id).filter(Boolean);
      if (ids.length === 0) {
        setLoading(false);
        return;
      }
      const rows = await getLatestCheckinsForCoach(ids);
      if (cancelled) return;
      const map = {};
      for (const r of rows) map[r.client_id] = r;
      setLatestMap(map);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const rows = useMemo(() => {
    return clients
      .map((client) => {
        const latest = latestMap[client.id] || null;
        const status = getStatus(client, latest, currentWeekStart);
        return { client, latest, status };
      })
      .sort((a, b) => sortOrder(a.status) - sortOrder(b.status));
  }, [clients, latestMap, currentWeekStart]);

  const statusLabel = (status) => {
    if (status === STATUS_NEW) return 'New check-in';
    if (status === STATUS_MISSED) return 'Missed';
    return 'Up to date';
  };

  const statusColor = (status) => {
    if (status === STATUS_NEW) return colors.primary;
    if (status === STATUS_MISSED) return '#E11D48';
    return colors.muted;
  };

  if (loading) {
    return (
      <div className="min-h-screen" style={{ background: colors.bg, color: colors.text }}>
        <TopBar title="Review Center" onBack={() => navigate(-1)} />
        <div className="p-4 flex items-center justify-center" style={{ minHeight: 200 }}>
          <p style={{ color: colors.muted }}>Loading…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: colors.bg, color: colors.text }}>
      <TopBar title="Review Center" onBack={() => navigate(-1)} />
      <div className="p-4 pb-8">
        <p className="text-sm mb-4" style={{ color: colors.muted }}>
          Week of {currentWeekStart}
        </p>
        {rows.length === 0 ? (
          <Card style={{ padding: spacing[24], textAlign: 'center' }}>
            <p style={{ color: colors.muted }}>No clients yet.</p>
          </Card>
        ) : (
          rows.map(({ client, latest, status }) => (
            <Card
              key={client.id}
              style={{ marginBottom: spacing[12], padding: spacing[16], cursor: 'pointer' }}
              onClick={() => latest?.checkin_id && navigate(`/review-center/checkins/${latest.checkin_id}`)}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold" style={{ color: colors.text }}>
                    {client.full_name || client.name || 'Client'}
                  </p>
                  <p className="text-sm" style={{ color: statusColor(status) }}>
                    {statusLabel(status)}
                  </p>
                  {latest?.submitted_at && (
                    <p className="text-xs mt-1" style={{ color: colors.muted }}>
                      Submitted {new Date(latest.submitted_at).toLocaleString()}
                    </p>
                  )}
                </div>
                {latest?.checkin_id && (
                  <ChevronRight size={20} style={{ color: colors.muted }} />
                )}
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
