import React, { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';
import TopBar from '@/components/ui/TopBar';
import Card from '@/ui/Card';
import { colors, spacing, shell, radii } from '@/ui/tokens';
import { FEDERATION_GUIDES, FEDERATION_KEYS } from '@/lib/federationGuides';

function Section({ title, open, onToggle, children }) {
  return (
    <Card style={{ marginBottom: spacing[10], overflow: 'hidden' }}>
      <button
        type="button"
        onClick={onToggle}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: spacing[14],
          border: 'none',
          background: 'transparent',
          color: colors.text,
          fontSize: 15,
          fontWeight: 700,
          textAlign: 'left',
        }}
      >
        {title}
        {open ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
      </button>
      {open ? <div style={{ padding: `0 ${spacing[14]}px ${spacing[14]}px` }}>{children}</div> : null}
    </Card>
  );
}

export default function FederationGuidePage() {
  const { federationKey } = useParams();
  const navigate = useNavigate();
  const resolvedKey = useMemo(() => {
    const raw = String(federationKey || '').trim();
    if (!raw) return '';
    const hit = FEDERATION_KEYS.find((k) => k.toLowerCase() === raw.toLowerCase());
    return hit || raw;
  }, [federationKey]);
  const guide = FEDERATION_GUIDES[resolvedKey] || null;
  const [open, setOpen] = useState({
    bring: true,
    expect: true,
    divisions: true,
    judging: true,
    banned: false,
    bikini: false,
  });
  const [checked, setChecked] = useState({});

  const websiteUrl = useMemo(() => {
    if (!guide?.website) return '';
    const w = guide.website.trim();
    if (w.startsWith('http')) return w;
    return `https://${w}`;
  }, [guide]);

  if (!guide) {
    return (
      <div style={{ minHeight: '100vh', background: colors.bg, color: colors.text }}>
        <TopBar title="Federation guide" onBack={() => navigate(-1)} showBack />
        <div style={{ padding: spacing[16] }}>
          <p style={{ color: colors.muted }}>Unknown federation. Try {FEDERATION_KEYS.join(', ')}.</p>
        </div>
      </div>
    );
  }

  const toggleCheck = (idx) => {
    setChecked((prev) => ({ ...prev, [idx]: !prev[idx] }));
  };

  return (
    <div style={{ minHeight: '100vh', background: colors.bg, color: colors.text }}>
      <TopBar title={guide.full_name} onBack={() => navigate(-1)} showBack />
      <div style={{ padding: `${spacing[12]}px ${shell.pagePaddingH}px ${spacing[24]}px` }}>
        <p style={{ margin: `0 0 ${spacing[8]}px`, fontSize: 13, color: colors.muted }}>
          {guide.country} · {guide.drug_tested ? 'Drug-tested federation' : 'Not marketed as drug-tested in this guide'}
        </p>
        {websiteUrl ? (
          <a
            href={websiteUrl}
            target="_blank"
            rel="noreferrer"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 14, color: colors.primary, marginBottom: spacing[14] }}
          >
            Official site <ExternalLink size={14} />
          </a>
        ) : null}

        <Section title="What to bring" open={open.bring} onToggle={() => setOpen((s) => ({ ...s, bring: !s.bring }))}>
          <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
            {(guide.what_to_bring || []).map((item, idx) => (
              <li key={idx} style={{ marginBottom: spacing[8] }}>
                <button
                  type="button"
                  onClick={() => toggleCheck(`b-${idx}`)}
                  style={{
                    display: 'flex',
                    gap: spacing[10],
                    alignItems: 'flex-start',
                    width: '100%',
                    textAlign: 'left',
                    border: `1px solid ${colors.border}`,
                    borderRadius: radii.card,
                    padding: spacing[10],
                    background: checked[`b-${idx}`] ? colors.primarySubtle : colors.surface1,
                    color: colors.text,
                    fontSize: 13,
                  }}
                >
                  <span style={{ fontSize: 16 }}>{checked[`b-${idx}`] ? '☑' : '☐'}</span>
                  <span style={{ textDecoration: checked[`b-${idx}`] ? 'line-through' : 'none', opacity: checked[`b-${idx}`] ? 0.75 : 1 }}>{item}</span>
                </button>
              </li>
            ))}
          </ul>
        </Section>

        <Section title="What to expect on the day" open={open.expect} onToggle={() => setOpen((s) => ({ ...s, expect: !s.expect }))}>
          <ol style={{ margin: 0, paddingLeft: 18, fontSize: 13, lineHeight: 1.55 }}>
            {(guide.what_to_expect || []).map((line, i) => (
              <li key={i} style={{ marginBottom: spacing[6] }}>
                {line}
              </li>
            ))}
          </ol>
        </Section>

        <Section title="Divisions covered in this guide" open={open.divisions} onToggle={() => setOpen((s) => ({ ...s, divisions: !s.divisions }))}>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13 }}>
            {(guide.divisions || []).map((d) => (
              <li key={d}>{d}</li>
            ))}
          </ul>
        </Section>

        {guide.bikini_suit_rules ? (
          <Section title="Bikini / suit rules (summary)" open={open.bikini} onToggle={() => setOpen((s) => ({ ...s, bikini: !s.bikini }))}>
            <p style={{ margin: 0, fontSize: 13, lineHeight: 1.55 }}>{guide.bikini_suit_rules}</p>
          </Section>
        ) : null}

        <Section title="Judging format" open={open.judging} onToggle={() => setOpen((s) => ({ ...s, judging: !s.judging }))}>
          <p style={{ margin: 0, fontSize: 13, lineHeight: 1.55 }}>{guide.judging_format}</p>
        </Section>

        {guide.banned_items?.length ? (
          <Section title="Banned or risky items" open={open.banned} onToggle={() => setOpen((s) => ({ ...s, banned: !s.banned }))}>
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13 }}>
              {guide.banned_items.map((x, i) => (
                <li key={i}>{x}</li>
              ))}
            </ul>
          </Section>
        ) : null}
      </div>
    </div>
  );
}
