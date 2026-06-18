import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, ChevronUp } from 'lucide-react';
import TopBar from '@/components/ui/TopBar';
import Card from '@/ui/Card';
import Button from '@/ui/Button';
import { Input } from '@/components/ui/input';
import { colors, spacing, shell, radii } from '@/ui/tokens';
import { useAuth } from '@/lib/AuthContext';
import { hasSupabase } from '@/lib/supabaseClient';
import {
  PREP_PROTOCOLS,
  getProtocolTotalWeeks,
  parsePhaseWeekRange,
} from '@/lib/prepProtocols';
import { startPersonalContestPrepRow } from '@/lib/personalContestPrepApi';

function toLocalYmd(d) {
  const x = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(x.getTime())) return '';
  const y = x.getFullYear();
  const m = String(x.getMonth() + 1).padStart(2, '0');
  const day = String(x.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const DIVISION_OPTIONS = [
  { value: 'bikini', label: 'Bikini' },
  { value: 'figure', label: 'Figure' },
  { value: 'mens_physique', label: "Men's physique" },
];

export default function PrepProtocolsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [expanded, setExpanded] = useState({});
  const [dialog, setDialog] = useState(null);
  const [showDate, setShowDate] = useState('');
  const [division, setDivision] = useState('bikini');
  const [federation, setFederation] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const entries = useMemo(() => Object.entries(PREP_PROTOCOLS), []);

  const toggle = (id) => setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));

  const openStart = (protocolId) => {
    setErr('');
    setDialog(protocolId);
    setShowDate('');
    setDivision('bikini');
    setFederation('');
  };

  const confirmStart = async () => {
    if (!user?.id || !dialog) return;
    if (!showDate) {
      setErr('Choose your show date.');
      return;
    }
    if (!hasSupabase) {
      setErr('Connect to the app to save your prep.');
      return;
    }
    setSaving(true);
    setErr('');
    const prepStarted = toLocalYmd(new Date());
    const res = await startPersonalContestPrepRow({
      profileId: user.id,
      protocolId: dialog,
      showDate,
      prepStartedAt: prepStarted,
      division,
      federation: federation.trim() || null,
      showName: null,
    });
    setSaving(false);
    if (!res.ok) {
      setErr(res.error || 'Could not start protocol.');
      return;
    }
    setDialog(null);
    navigate('/today');
  };

  return (
    <div style={{ minHeight: '100vh', background: colors.bg, color: colors.text }}>
      <TopBar title="Prep protocols" onBack={() => navigate(-1)} showBack />
      <div style={{ padding: `${spacing[12]}px ${shell.pagePaddingH}px ${spacing[24]}px` }}>
        <p style={{ margin: `0 0 ${spacing[12]}px`, fontSize: 14, color: colors.muted, lineHeight: 1.5 }}>
          Structured, evidence-based templates you can run without a coach. Pick one that matches your division and timeline.
        </p>

        {entries.map(([id, protocol]) => {
          const totalWeeks = getProtocolTotalWeeks(protocol);
          const isOpen = !!expanded[id];
          return (
            <Card key={id} style={{ marginBottom: spacing[12], padding: spacing[14] }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: spacing[10], alignItems: 'flex-start' }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>{protocol.name}</h2>
                  <p style={{ margin: `${spacing[6]}px 0 0`, fontSize: 13, color: colors.muted, lineHeight: 1.45 }}>
                    {protocol.description}
                  </p>
                  <p style={{ margin: `${spacing[8]}px 0 0`, fontSize: 12, color: colors.muted }}>
                    Duration: {totalWeeks} weeks
                  </p>
                  <div style={{ marginTop: spacing[8], display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {(protocol.suitableFor || []).map((tag) => (
                      <span
                        key={tag}
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          padding: '4px 8px',
                          borderRadius: radii.pill,
                          border: `1px solid ${colors.border}`,
                          color: colors.muted,
                        }}
                      >
                        {tag.replace(/_/g, ' ')}
                      </span>
                    ))}
                  </div>
                </div>
                <button
                  type="button"
                  aria-expanded={isOpen}
                  onClick={() => toggle(id)}
                  style={{
                    border: `1px solid ${colors.border}`,
                    background: colors.surface1,
                    borderRadius: 10,
                    padding: 8,
                    color: colors.text,
                  }}
                >
                  {isOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                </button>
              </div>

              {isOpen ? (
                <div style={{ marginTop: spacing[12], borderTop: `1px solid ${colors.border}`, paddingTop: spacing[12] }}>
                  <p style={{ margin: `0 0 ${spacing[8]}px`, fontSize: 12, fontWeight: 700, color: colors.muted, textTransform: 'uppercase' }}>
                    Phase breakdown
                  </p>
                  <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, lineHeight: 1.55, color: colors.text }}>
                    {protocol.phases.map((ph) => {
                      const r = parsePhaseWeekRange(ph.weeks);
                      const wk = r ? (r.start === r.end ? `Week ${r.start}` : `Weeks ${r.start}–${r.end}`) : ph.weeks;
                      return (
                        <li key={ph.name} style={{ marginBottom: spacing[8] }}>
                          <strong>{ph.name}</strong> ({wk}): {ph.trainingFocus}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ) : null}
              <Button type="button" variant={isOpen ? 'primary' : 'outline'} style={{ marginTop: spacing[12] }} onClick={() => openStart(id)}>
                Start this protocol
              </Button>
            </Card>
          );
        })}
      </div>

      {dialog ? (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 50,
            background: 'rgba(0,0,0,0.55)',
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
            padding: spacing[12],
          }}
        >
          <Card style={{ width: '100%', maxWidth: 420, padding: spacing[16] }}>
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Target show</h3>
            <p style={{ margin: `${spacing[8]}px 0 0`, fontSize: 13, color: colors.muted }}>
              We align your phase to weeks from this date and today&apos;s prep start ({toLocalYmd(new Date())}).
            </p>
            <label style={{ display: 'block', marginTop: spacing[12], fontSize: 13, fontWeight: 600 }}>
              Show date
              <Input type="date" value={showDate} onChange={(e) => setShowDate(e.target.value)} style={{ marginTop: 6 }} />
            </label>
            <label style={{ display: 'block', marginTop: spacing[12], fontSize: 13, fontWeight: 600 }}>
              Division
              <select
                value={division}
                onChange={(e) => setDivision(e.target.value)}
                style={{
                  marginTop: 6,
                  width: '100%',
                  minHeight: 44,
                  borderRadius: radii.input,
                  border: `1px solid ${colors.border}`,
                  background: colors.surface1,
                  color: colors.text,
                  padding: '0 10px',
                }}
              >
                {DIVISION_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            <label style={{ display: 'block', marginTop: spacing[12], fontSize: 13, fontWeight: 600 }}>
              Federation (optional)
              <Input value={federation} onChange={(e) => setFederation(e.target.value)} placeholder="e.g. PCA" style={{ marginTop: 6 }} />
            </label>
            {err ? <p style={{ margin: `${spacing[10]}px 0 0`, fontSize: 12, color: '#f87171' }}>{err}</p> : null}
            <div style={{ display: 'flex', gap: spacing[10], marginTop: spacing[16] }}>
              <Button type="button" variant="outline" onClick={() => setDialog(null)} disabled={saving}>
                Cancel
              </Button>
              <Button type="button" onClick={confirmStart} disabled={saving}>
                {saving ? 'Saving…' : 'Begin prep'}
              </Button>
            </div>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
