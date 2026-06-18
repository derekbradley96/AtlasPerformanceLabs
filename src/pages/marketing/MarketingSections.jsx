/**
 * Reusable marketing sections: Hero, Features, Testimonials, CTA.
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { colors, spacing } from '@/ui/tokens';
import { LOGIN_PUBLIC_PATH } from '@/lib/publicAuthPaths';
import { clearAuthEntryCarryover } from '@/lib/onboardingStatus';

export function Hero({
  title,
  subtitle,
  primaryCtaLabel,
  primaryCtaTo,
  secondaryCtaLabel,
  secondaryCtaTo,
  eyebrow,
  screenshotSrc,
  screenshotAlt,
  embedUrl,
}) {
  const defaultScreenshotAlt =
    'Atlas coach dashboard showing workload score, priority queue, and roster health';
  const [imageFailed, setImageFailed] = React.useState(false);

  React.useEffect(() => {
    setImageFailed(false);
  }, [screenshotSrc]);

  return (
    <section
      className="text-center px-4 py-14 sm:py-20 md:py-24"
      style={{
        background: `radial-gradient(circle at top left, rgba(59,130,246,0.38), transparent 55%), linear-gradient(180deg, ${colors.surface} 0%, ${colors.bg} 100%)`,
        borderBottom: `1px solid ${colors.border}`,
      }}
    >
      <div className="max-w-5xl mx-auto">
        {eyebrow ? (
          <p className="text-[11px] font-semibold tracking-[0.18em] uppercase mb-4" style={{ color: colors.muted }}>
            {eyebrow}
          </p>
        ) : null}
        <h1 className="text-[1.95rem] sm:text-4xl md:text-5xl font-bold mb-3 sm:mb-4 leading-[1.14] max-w-4xl mx-auto" style={{ color: colors.text }}>
          {title}
        </h1>
        {subtitle && (
          <p className="text-[0.98rem] sm:text-lg md:text-xl mb-7 sm:mb-8 max-w-2xl mx-auto leading-relaxed" style={{ color: colors.muted }}>
            {subtitle}
          </p>
        )}
        <div className="flex flex-wrap items-center justify-center gap-3">
          {primaryCtaLabel && primaryCtaTo && (
            <Link
              to={primaryCtaTo}
              onClick={primaryCtaTo === LOGIN_PUBLIC_PATH ? clearAuthEntryCarryover : undefined}
              className="inline-flex items-center justify-center px-6 sm:px-7 py-3.5 rounded-2xl text-[0.95rem] sm:text-base font-semibold transition-opacity hover:opacity-90"
              style={{ background: colors.primary, color: '#fff' }}
            >
              {primaryCtaLabel}
            </Link>
          )}
          {secondaryCtaLabel && secondaryCtaTo && (
            <Link
              to={secondaryCtaTo}
              className="inline-flex items-center justify-center px-5 sm:px-6 py-3 rounded-2xl text-[0.95rem] sm:text-base font-semibold border transition-opacity hover:bg-white/5"
              style={{ borderColor: colors.border, color: colors.text }}
            >
              {secondaryCtaLabel}
            </Link>
          )}
        </div>

        {screenshotSrc === 'mockup' || imageFailed ? (
          <DeviceMockup />
        ) : screenshotSrc ? (
          <div
            style={{
              position: 'relative',
              maxWidth: 900,
              margin: '48px auto 0',
            }}
          >
            <div
              style={{
                position: 'absolute',
                inset: -24,
                background: 'radial-gradient(ellipse at center, rgba(59,130,246,0.15), transparent 70%)',
                borderRadius: 32,
                pointerEvents: 'none',
              }}
            />
            <div
              style={{
                borderRadius: 16,
                overflow: 'hidden',
                border: `1px solid ${colors.border}`,
                boxShadow: '0 32px 80px rgba(0,0,0,0.5)',
                position: 'relative',
              }}
            >
              <img
                src={screenshotSrc}
                alt={screenshotAlt || defaultScreenshotAlt}
                style={{ width: '100%', display: 'block', height: 'auto' }}
                loading="lazy"
                onError={() => {
                  setImageFailed(true);
                }}
              />
            </div>
          </div>
        ) : embedUrl ? (
          <div
            style={{
              position: 'relative',
              paddingBottom: '56.25%',
              margin: '48px auto 0',
              maxWidth: 900,
              borderRadius: 16,
              overflow: 'hidden',
              border: `1px solid ${colors.border}`,
              boxShadow: '0 32px 80px rgba(0,0,0,0.5)',
            }}
          >
            <iframe
              src={embedUrl}
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none' }}
              allow="autoplay; fullscreen"
              title="Atlas product demo"
            />
          </div>
        ) : null}
      </div>
    </section>
  );
}

function DeviceMockup() {
  return (
    <div
      style={{
        position: 'relative',
        maxWidth: 860,
        margin: '52px auto 0',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        gap: 20,
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: -32,
          background: 'radial-gradient(ellipse at center, rgba(59,130,246,0.13), transparent 65%)',
          borderRadius: 40,
          pointerEvents: 'none',
        }}
      />

      <span style={{ display: 'block' }} className="hidden sm:block">
        <div style={{ position: 'relative', flexShrink: 0, width: 500, zIndex: 1 }}>
          <div
            style={{
              background: '#111827',
              borderRadius: '12px 12px 0 0',
              border: '1.5px solid rgba(255,255,255,0.09)',
              padding: '10px 10px 0',
              boxShadow: '0 32px 72px rgba(0,0,0,0.55)',
            }}
          >
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'rgba(255,255,255,0.13)', margin: '0 auto 6px' }} />
            <div
              style={{
                background: '#0B1220',
                borderRadius: '6px 6px 0 0',
                overflow: 'hidden',
                aspectRatio: '16/10',
                display: 'flex',
                fontFamily: 'system-ui,sans-serif',
              }}
            >
              <div
                style={{
                  width: 132,
                  background: '#0d1929',
                  borderRight: '1px solid rgba(255,255,255,0.05)',
                  padding: '12px 8px',
                  flexShrink: 0,
                }}
              >
                <div style={{ fontSize: 11, fontWeight: 700, color: '#3B82F6', marginBottom: 14, letterSpacing: '.02em' }}>Atlas</div>
                {[
                  { label: 'Home', active: true },
                  { label: 'Clients', badge: '7' },
                  { label: 'Inbox', badge: '3' },
                  { label: 'Review centre' },
                  { label: 'Programmes' },
                  { label: 'Earnings' },
                ].map((item) => (
                  <div
                    key={item.label}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '5px 6px',
                      borderRadius: 5,
                      marginBottom: 2,
                      background: item.active ? 'rgba(59,130,246,0.14)' : 'transparent',
                    }}
                  >
                    <span style={{ fontSize: 9.5, color: item.active ? '#60A5FA' : '#4B5563', fontWeight: item.active ? 600 : 400 }}>
                      {item.label}
                    </span>
                    {item.badge && (
                      <span style={{ fontSize: 8, fontWeight: 700, background: '#EF4444', color: '#fff', padding: '1px 4px', borderRadius: 8 }}>
                        {item.badge}
                      </span>
                    )}
                  </div>
                ))}
              </div>

              <div style={{ flex: 1, padding: '11px 13px', overflow: 'hidden' }}>
                <div
                  style={{
                    background: 'rgba(59,130,246,0.13)',
                    border: '1px solid rgba(59,130,246,0.18)',
                    borderRadius: 8,
                    padding: '9px 11px',
                    marginBottom: 7,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                  }}
                >
                  <div>
                    <div style={{ fontSize: 8, color: '#6B7280', marginBottom: 2, textTransform: 'uppercase', letterSpacing: '.04em' }}>
                      Workload
                    </div>
                    <div style={{ fontSize: 22, fontWeight: 700, color: '#3B82F6', lineHeight: 1 }}>7</div>
                  </div>
                  <div style={{ fontSize: 8, color: '#9CA3AF', lineHeight: 1.55 }}>
                    3 check-in reviews
                    <br />
                    2 unread messages
                    <br />
                    2 payments pending
                  </div>
                </div>

                <div
                  style={{
                    background: '#111f35',
                    border: '1px solid rgba(255,255,255,0.05)',
                    borderRadius: 8,
                    padding: '7px 9px',
                    marginBottom: 7,
                  }}
                >
                  <div style={{ fontSize: 7.5, color: '#6B7280', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '.04em' }}>
                    Top priority
                  </div>
                  <div style={{ fontSize: 9, color: '#E2E8F0', fontWeight: 500 }}>Review Jake&apos;s check-in →</div>
                  <div style={{ fontSize: 7.5, color: '#6B7280', marginTop: 2 }}>Submitted 2h ago · weight down 1.2kg</div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5 }}>
                  {[
                    { name: 'Jake M.', tag: '⚠ Check-in due', col: '#F59E0B' },
                    { name: 'Sarah K.', tag: 'Adherence 61%', col: '#EF4444' },
                    { name: 'Tom R.', tag: 'On track ✓', col: '#22C55E' },
                    { name: 'Emma W.', tag: '14 days to show', col: '#8B5CF6' },
                  ].map((client) => (
                    <div
                      key={client.name}
                      style={{
                        background: '#111f35',
                        border: '1px solid rgba(255,255,255,0.04)',
                        borderRadius: 5,
                        padding: '5px 7px',
                      }}
                    >
                      <div style={{ fontSize: 8.5, color: '#CBD5E1', fontWeight: 500 }}>{client.name}</div>
                      <div style={{ fontSize: 7.5, color: client.col, marginTop: 2 }}>{client.tag}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
          <div
            style={{
              height: 10,
              background: '#111827',
              borderRadius: '0 0 3px 3px',
              border: '1.5px solid rgba(255,255,255,0.08)',
              borderTop: 'none',
            }}
          />
          <div
            style={{
              height: 3,
              background: '#0d1117',
              borderRadius: '0 0 10px 10px',
              margin: '0 -12px',
              borderBottom: '1px solid rgba(255,255,255,0.05)',
            }}
          />
        </div>
      </span>

      <div style={{ position: 'relative', zIndex: 2, width: 132, flexShrink: 0, marginBottom: 18 }}>
        <div
          style={{
            background: '#111827',
            borderRadius: 20,
            border: '1.5px solid rgba(255,255,255,0.1)',
            padding: '9px 5px',
            boxShadow: '0 28px 56px rgba(0,0,0,0.65)',
          }}
        >
          <div style={{ width: 36, height: 5, background: '#0d1117', borderRadius: 10, margin: '0 auto 5px' }} />
          <div
            style={{
              background: '#0B1220',
              borderRadius: 11,
              overflow: 'hidden',
              padding: '7px 5px',
              fontFamily: 'system-ui,sans-serif',
            }}
          >
            <div style={{ fontSize: 8.5, fontWeight: 700, color: '#E2E8F0', marginBottom: 5 }}>Today</div>
            <div
              style={{
                background: 'rgba(59,130,246,0.14)',
                border: '1px solid rgba(59,130,246,0.22)',
                borderRadius: 7,
                padding: '6px 7px',
                marginBottom: 4,
              }}
            >
              <div style={{ fontSize: 7, color: '#60A5FA', fontWeight: 600 }}>Push Day A</div>
              <div style={{ fontSize: 6.5, color: '#6B7280', margin: '2px 0 4px' }}>5 exercises · ~55 min</div>
              <div
                style={{
                  background: '#3B82F6',
                  color: '#fff',
                  borderRadius: 4,
                  padding: '3px 0',
                  fontSize: 7,
                  fontWeight: 600,
                  textAlign: 'center',
                }}
              >
                Start workout →
              </div>
            </div>
            <div
              style={{
                background: '#111f35',
                border: '1px solid rgba(255,255,255,0.05)',
                borderRadius: 7,
                padding: '5px 7px',
                marginBottom: 4,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="9" fill="none" stroke="#1e2d45" strokeWidth="3" />
                <circle
                  cx="12"
                  cy="12"
                  r="9"
                  fill="none"
                  stroke="#3B82F6"
                  strokeWidth="3"
                  strokeDasharray="37 20"
                  strokeLinecap="round"
                  transform="rotate(-90 12 12)"
                />
              </svg>
              <div>
                <div style={{ fontSize: 7, color: '#E2E8F0', fontWeight: 500 }}>1,380 kcal</div>
                <div style={{ fontSize: 6.5, color: '#6B7280' }}>820 remaining</div>
              </div>
            </div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-around',
                borderTop: '1px solid rgba(255,255,255,0.05)',
                paddingTop: 4,
                marginTop: 3,
              }}
            >
              {['Today', 'Train', 'Log', 'Progress'].map((tab, idx) => (
                <div key={tab} style={{ fontSize: 6.5, color: idx === 0 ? '#3B82F6' : '#4B5563', fontWeight: idx === 0 ? 600 : 400 }}>
                  {tab}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function Features({ title, items, id, gridClassName }) {
  const grid =
    gridClassName ||
    (items.length === 4
      ? 'grid gap-6 sm:grid-cols-2 max-w-4xl mx-auto'
      : 'grid gap-6 sm:grid-cols-2 lg:grid-cols-3');
  return (
    <section id={id || undefined} className="px-4 py-16 sm:py-20 max-w-5xl mx-auto">
      <h2 className="text-2xl sm:text-3xl font-bold text-center mb-4" style={{ color: colors.text }}>{title}</h2>
      <ul className={grid}>
        {items.map(({ heading, body }, i) => (
          <li
            key={i}
            className="p-5 sm:p-6 rounded-xl border"
            style={{ borderColor: colors.border, background: colors.surface1 }}
          >
            <h3 className="text-lg font-semibold mb-2" style={{ color: colors.text }}>{heading}</h3>
            <p className="text-sm sm:text-base leading-relaxed" style={{ color: colors.muted }}>{body}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * @param {{ title?: string, testimonials: Array<{ quote: string, name: string, role: string, pillars?: number, result?: string|null, photo?: string|null }> }} props
 */
export function Testimonials({ title = 'What coaches say', testimonials }) {
  const list = Array.isArray(testimonials) ? testimonials : [];
  if (!list.length) return null;

  return (
    <section
      style={{
        padding: `${spacing[20]}px ${spacing[16]}px`,
        borderTop: `1px solid ${colors.border}`,
        borderBottom: `1px solid ${colors.border}`,
        background: colors.surface1,
      }}
    >
      <div style={{ maxWidth: 960, margin: '0 auto' }}>
        <h2
          style={{
            fontSize: 26,
            fontWeight: 700,
            color: colors.text,
            textAlign: 'center',
            marginBottom: spacing[20],
          }}
        >
          {title}
        </h2>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: spacing[16],
          }}
        >
          {list.map((t, i) => (
            <div
              key={`${t.name}-${i}`}
              style={{
                background: colors.surface1,
                border: `1px solid ${colors.border}`,
                borderRadius: 16,
                padding: spacing[20],
              }}
            >
              <div style={{ display: 'flex', gap: 3, marginBottom: spacing[12] }}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <div
                    key={n}
                    style={{
                      width: 4,
                      height: 16,
                      borderRadius: 2,
                      background: n <= (t.pillars ?? 5) ? colors.primary : colors.surface2,
                    }}
                  />
                ))}
              </div>
              <p
                style={{
                  fontSize: 14,
                  lineHeight: 1.6,
                  color: colors.text,
                  marginBottom: spacing[16],
                  fontStyle: 'italic',
                }}
              >
                &ldquo;{t.quote}&rdquo;
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: spacing[10] }}>
                {t.photo ? (
                  <img
                    src={t.photo}
                    alt={t.name}
                    style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover' }}
                  />
                ) : (
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: '50%',
                      background: colors.primarySubtle,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 16,
                      color: colors.primary,
                      fontWeight: 600,
                    }}
                  >
                    {String(t.name || '?')[0]}
                  </div>
                )}
                <div>
                  <p style={{ fontSize: 13, fontWeight: 600, color: colors.text, margin: 0 }}>{t.name}</p>
                  <p style={{ fontSize: 12, color: colors.muted, margin: 0 }}>{t.role}</p>
                </div>
                {t.result ? (
                  <span
                    style={{
                      marginLeft: 'auto',
                      fontSize: 12,
                      fontWeight: 600,
                      color: colors.success,
                      background: colors.surface2,
                      padding: '2px 8px',
                      borderRadius: 20,
                    }}
                  >
                    {t.result}
                  </span>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function CTA({ title, subtitle, primaryCtaLabel, primaryCtaTo, secondaryCtaLabel, secondaryCtaTo }) {
  return (
    <section
      className="px-4 py-14 sm:py-18 md:py-20 text-center border-t"
      style={{ borderColor: colors.border }}
    >
      <div className="max-w-lg mx-auto">
        <h2 className="text-[1.7rem] sm:text-3xl font-bold mb-3 leading-tight" style={{ color: colors.text }}>{title}</h2>
        {subtitle && (
          <p className="mb-7 sm:mb-8 text-[0.96rem] sm:text-lg leading-relaxed" style={{ color: colors.muted }}>
            {subtitle}
          </p>
        )}
        <div className="flex flex-wrap items-center justify-center gap-3">
          {primaryCtaLabel && primaryCtaTo && (
            <Link
              to={primaryCtaTo}
              onClick={primaryCtaTo === LOGIN_PUBLIC_PATH ? clearAuthEntryCarryover : undefined}
              className="inline-flex items-center justify-center px-6 sm:px-7 py-3.5 rounded-2xl text-[0.95rem] sm:text-base font-semibold transition-opacity hover:opacity-90"
              style={{ background: colors.primary, color: '#fff' }}
            >
              {primaryCtaLabel}
            </Link>
          )}
          {secondaryCtaLabel && secondaryCtaTo && (
            <Link
              to={secondaryCtaTo}
              className="inline-flex items-center justify-center px-5 sm:px-6 py-3 rounded-2xl text-[0.95rem] sm:text-base font-semibold border transition-opacity hover:opacity-90"
              style={{ borderColor: colors.border, color: colors.text }}
            >
              {secondaryCtaLabel}
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}

export { DeviceMockup };
