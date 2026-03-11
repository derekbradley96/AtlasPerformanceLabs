/**
 * Pose check submission history: list of pose_checks by week with submitted/reviewed status.
 * Uses pose_checks. Renders nothing when no submissions (or no prep client if used in prep context).
 */
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getSupabase, hasSupabase } from '@/lib/supabaseClient';
import Card from '@/ui/Card';
import { colors, spacing } from '@/ui/tokens';
import { ImageIcon, Check } from 'lucide-react';

const LIMIT = 10;

async function fetchPoseCheckHistory(clientId) {
  if (!hasSupabase || !clientId) return [];
  const supabase = getSupabase();
  if (!supabase) return [];
  try {
    const { data, error } = await supabase
      .from('pose_checks')
      .select('id, week_start, submitted_at, reviewed_at, coach_rating')
      .eq('client_id', clientId)
      .order('week_start', { ascending: false })
      .limit(LIMIT);
    if (error) return [];
    return Array.isArray(data) ? data : [];
  } catch (_) {
    return [];
  }
}

function formatWeek(d) {
  if (!d) return '—';
  const date = typeof d === 'string' ? new Date(d) : d;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: '2-digit' });
}

export default function PoseCheckTimeline({ clientId, onSelectPoseCheck }) {
  const navigate = useNavigate();
  const [list, setList] = useState([]);

  useEffect(() => {
    if (!clientId) {
      setList([]);
      return;
    }
    let cancelled = false;
    fetchPoseCheckHistory(clientId).then((rows) => {
      if (!cancelled) setList(rows);
    });
    return () => { cancelled = true; };
  }, [clientId]);

  if (list.length === 0) return null;

  const handleClick = (id) => {
    if (onSelectPoseCheck) onSelectPoseCheck(id);
    else if (id) navigate(`/review-center/pose-checks/${id}`);
  };

  return (
    <Card style={{ marginBottom: spacing[12], padding: spacing[16] }}>
      <p className="text-xs font-medium uppercase tracking-wide mb-3" style={{ color: colors.muted }}>
        Pose check history
      </p>
      <ul className="space-y-0">
        {list.map((row) => (
          <li key={row.id}>
            <button
              type="button"
              onClick={() => handleClick(row.id)}
              className="w-full flex items-center justify-between gap-2 py-2.5 text-left rounded-lg active:opacity-80"
              style={{ borderBottom: `1px solid ${colors.border}`, background: 'transparent' }}
            >
              <span className="flex items-center gap-2 text-sm" style={{ color: colors.text }}>
                <ImageIcon size={14} style={{ color: colors.muted }} />
                Week of {formatWeek(row.week_start)}
              </span>
              <span className="flex items-center gap-1.5 text-xs" style={{ color: colors.muted }}>
                {row.reviewed_at ? (
                  <>
                    <Check size={12} style={{ color: colors.success }} />
                    {row.coach_rating != null ? `Rated ${row.coach_rating}` : 'Reviewed'}
                  </>
                ) : (
                  'Pending review'
                )}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </Card>
  );
}
