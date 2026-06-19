/**
 * Conversion-focused pricing: plans, commission math, FAQ, CTA.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { trackPage } from '@/lib/analytics';
import { Link, useSearchParams } from 'react-router-dom';
import { Check, ChevronDown, HelpCircle, Palette, LayoutTemplate, EyeOff, Headphones, Star } from 'lucide-react';
import { colors } from '@/ui/tokens';
import { SIGNUP_PUBLIC_PATH } from '@/lib/publicAuthPaths';
import { usePageMeta } from '@/lib/usePageMeta';
import EarningsCalculator from '@/components/pricing/EarningsCalculator';
import { PLANS as SOURCE_PLANS } from '@/config/plans';

const ELITE_FEATURE_ICONS = {
  Palette,
  LayoutTemplate,
  EyeOff,
  Headphones,
  Star,
};

const ASSUMED_LABEL = 'Example: average £100 / client / month through Atlas';
/** Monthly volume (£) processed → fee under each plan */
function planCosts(monthlyVolume) {
  const basic = 0 + monthlyVolume * 0.1;
  const pro = 59 + monthlyVolume * 0.03;
  const elite = 89 + 0;
  const costs = [
    { id: 'basic', label: 'Basic', value: basic },
    { id: 'pro', label: 'Pro', value: pro },
    { id: 'elite', label: 'Elite', value: elite },
  ];
  const best = costs.reduce((a, b) => (a.value <= b.value ? a : b));
  return { basic, pro, elite, bestId: best.id };
}

const COMPARISON_ROWS = [
  { clients: 5, volume: 500, note: 'Early stage' },
  { clients: 10, volume: 1000, note: 'Pro breaks even vs Basic' },
  { clients: 12, volume: 1200, note: 'Elite breaks even' },
  { clients: 15, volume: 1500, note: 'Higher volume' },
  { clients: 20, volume: 2000, note: 'Elite clearly wins' },
  { clients: 25, volume: 2500, note: '' },
];

function formatMoney(n) {
  return `£${n.toFixed(0)}`;
}

const PLANS = [
  {
    id: 'basic',
    name: 'Basic',
    label: 'Starter',
    monthly: 0,
    commission: '10%',
    commissionDetail: 'commission on payments through Atlas',
    note: 'Use this to get started — you will outgrow this quickly',
    highlights: ['No monthly fee', 'Full core product access', 'Best for testing your setup, not long-term margin'],
    cta: 'Start with Basic',
    emphasized: false,
  },
  {
    id: 'pro',
    name: 'Pro',
    label: 'Most popular',
    monthly: 59,
    commission: '3%',
    commissionDetail: 'commission on payments through Atlas',
    note: 'Most coaches switch here within weeks · switches at ~10 clients',
    highlights: ['Best balance of fee + take rate', 'Lower commission as volume grows', 'Default tier once roster starts moving'],
    cta: 'Upgrade to Pro',
    emphasized: true,
  },
  {
    id: 'elite',
    name: 'Elite',
    label: 'Scale tier',
    monthly: 89,
    commission: '0%',
    commissionDetail: 'no commission on payments through Atlas',
    note: 'Built for full rosters — break-even at ~12 clients vs Pro on commission savings alone.',
    highlights: [
      'Zero commission — keep 100% of every client payment',
      'White-label: your brand, not Atlas',
      'Custom client onboarding page',
      'Priority 4-hour support guarantee',
      'Premium marketplace listing priority',
    ],
    cta: 'Go Elite',
    emphasized: false,
  },
];

const FAQ_ITEMS = [
  {
    q: 'Can I switch plans later?',
    a: 'Yes. Move up when your client count and volume make the math obvious, or step down if you need to. We keep switching straightforward so your stack doesn’t lock you in.',
  },
  {
    q: 'How does billing work?',
    a: 'Plans bill monthly in GBP. Commission applies to eligible payments processed through Atlas according to your tier—Basic 10%, Pro 3%, Elite 0%. Your invoice shows subscription and any commission settlement periods clearly.',
  },
  {
    q: 'Is my client and business data safe?',
    a: 'Your data is yours. We use industry-standard practices, access controls, and separation between accounts. You can export key information, and we do not sell client lists.',
  },
];

function EliteCoachFeaturesSection() {
  const features = SOURCE_PLANS.find((p) => p.id === 'elite')?.eliteOnlyFeatures ?? [];
  return (
    <section className="mt-12 sm:mt-14">
      <h2 className="text-[1.35rem] sm:text-2xl font-bold text-center mb-2" style={{ color: colors.text }}>
        What Elite coaches get
      </h2>
      <p className="text-center text-base font-semibold mb-1" style={{ color: colors.text }}>
        Everything Pro includes, plus
      </p>
      <p className="text-center text-sm mb-8 max-w-xl mx-auto" style={{ color: colors.muted }}>
        Elite is the only plan with these features
      </p>
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3 sm:gap-4">
        {features.map((f) => {
          const Icon = ELITE_FEATURE_ICONS[f.icon] || Check;
          return (
            <div
              key={f.id}
              className="rounded-xl p-4 border flex flex-col gap-2"
              style={{
                background: 'rgba(15, 23, 42, 0.55)',
                borderColor: 'rgba(251, 191, 36, 0.35)',
                boxShadow: '0 0 0 1px rgba(251, 191, 36, 0.08)',
              }}
            >
              <div className="flex items-start justify-between gap-2">
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                  style={{ background: 'rgba(251, 191, 36, 0.12)' }}
                >
                  <Icon className="w-4 h-4" style={{ color: '#fbbf24' }} aria-hidden />
                </div>
                <span
                  className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full shrink-0"
                  style={{ background: 'rgba(251, 191, 36, 0.18)', color: '#fcd34d' }}
                >
                  Elite only
                </span>
              </div>
              <p className="text-[14px] font-bold leading-snug" style={{ color: colors.text }}>
                {f.title}
              </p>
              <p className="text-[13px] leading-relaxed flex-1" style={{ color: colors.muted }}>
                {f.description}
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function FaqItem({ item }) {
  const [open, setOpen] = React.useState(false);
  return (
    <div
      className="rounded-xl border overflow-hidden"
      style={{ borderColor: colors.border, background: colors.surface1 }}
    >
      <button
        type="button"
        className="w-full flex items-center justify-between gap-3 text-left px-4 py-4 sm:px-5"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <span className="font-medium text-sm sm:text-base pr-2" style={{ color: colors.text }}>
          {item.q}
        </span>
        <ChevronDown
          className={`w-5 h-5 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
          style={{ color: colors.muted }}
        />
      </button>
      {open && (
        <div className="px-4 pb-4 sm:px-5 sm:pb-5 pt-0 text-sm leading-relaxed border-t" style={{ borderColor: colors.border, color: colors.muted }}>
          {item.a}
        </div>
      )}
    </div>
  );
}

function PricingTabSwitcher({ value, onChange }) {
  const tabs = [
    { id: 'coaching', label: 'Coaching' },
    { id: 'personal', label: 'Personal' },
  ];
  return (
    <div className="max-w-5xl mx-auto px-4 pt-10 pb-6">
      <div
        className="mx-auto max-w-md rounded-2xl border p-1 flex"
        style={{ borderColor: colors.border, background: colors.surface1 }}
        role="tablist"
        aria-label="Pricing audience"
      >
        {tabs.map((t) => {
          const active = value === t.id;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={active}
              className="flex-1 rounded-xl px-3 py-2.5 text-sm sm:text-base font-semibold transition-colors"
              style={{
                background: active ? colors.primary : 'transparent',
                color: active ? '#fff' : colors.text,
                boxShadow: active ? '0 10px 30px rgba(59,130,246,0.25)' : undefined,
              }}
              onClick={() => onChange(t.id)}
            >
              {t.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function PersonalPricingSection() {
  const personalFeatures = [
    'Program creation and workout logging',
    'Nutrition targets and food logging',
    'Check-ins, habits, and progress tracking',
    'Barcode scan and quick add',
    'Manual adjustments you control',
  ];

  return (
    <>
      <header
        className="text-center px-4 pt-14 pb-12 sm:pt-20 sm:pb-16"
        style={{
          background: `radial-gradient(circle at top right, rgba(16,185,129,0.22), transparent 52%), linear-gradient(180deg, ${colors.surface} 0%, ${colors.bg} 100%)`,
          borderBottom: `1px solid ${colors.border}`,
        }}
      >
        <div className="max-w-3xl mx-auto">
          <h1 className="text-3xl sm:text-4xl md:text-[2.75rem] font-bold leading-tight mb-4">
            Personal training — free
          </h1>
          <p className="text-base sm:text-lg md:text-xl leading-relaxed" style={{ color: colors.muted }}>
            Log workouts, track nutrition, and follow your own plan. No subscription required.
          </p>
        </div>
      </header>

      <section className="px-4 py-12 sm:py-16 max-w-2xl mx-auto">
        <div
          className="relative flex flex-col rounded-2xl border p-6 sm:p-8"
          style={{
            borderColor: colors.primary,
            background: 'rgba(59, 130, 246, 0.08)',
            boxShadow: '0 14px 56px rgba(59, 130, 246, 0.18)',
          }}
        >
          <span
            className="inline-block self-start text-[11px] font-semibold uppercase tracking-wide px-2.5 py-1 rounded-md mb-4"
            style={{ background: colors.primary, color: '#fff' }}
          >
            Personal
          </span>
          <h2 className="text-3xl sm:text-4xl font-bold mb-1">Free</h2>
          <p className="text-sm mb-4" style={{ color: colors.muted }}>
            Full personal training toolkit — programs, logging, nutrition, and progress in one place.
          </p>
          <ul className="space-y-2.5 mb-6 flex-1">
            {personalFeatures.map((h) => (
              <li key={h} className="flex gap-2 text-sm" style={{ color: colors.muted }}>
                <Check className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: colors.primary }} />
                {h}
              </li>
            ))}
          </ul>
          <Link
            to={SIGNUP_PUBLIC_PATH}
            className="inline-flex items-center justify-center w-full py-3.5 rounded-xl text-base font-semibold transition-opacity hover:opacity-90"
            style={{ background: colors.primary, color: '#fff', border: 'none' }}
          >
            Start free
          </Link>
        </div>
      </section>

      <section
        className="px-4 py-14 sm:py-20 text-center border-t"
        style={{
          borderColor: colors.border,
          background: `linear-gradient(180deg, ${colors.bg} 0%, rgba(16,185,129,0.12) 100%)`,
        }}
      >
        <div className="max-w-xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-bold mb-6 leading-tight">
            Start free. Train on your terms.
          </h2>
          <p className="text-base sm:text-lg mb-6" style={{ color: colors.muted }}>
            No paid tier — just a cleaner path to consistent training.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link
              to={SIGNUP_PUBLIC_PATH}
              className="inline-flex items-center justify-center px-8 py-4 rounded-xl text-base font-semibold transition-opacity hover:opacity-90"
              style={{ background: colors.primary, color: '#fff' }}
            >
              Start free
            </Link>
            <Link
              to="/pricing?tab=coaching"
              className="inline-flex items-center justify-center px-8 py-4 rounded-xl text-base font-semibold border transition-opacity hover:bg-white/5"
              style={{ borderColor: colors.border, color: colors.text }}
            >
              View coaching pricing
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}

function CoachingPricingSection({ comparison }) {
  const [hasScrolled, setHasScrolled] = useState(false);
  const tableRef = useRef(null);

  return (
    <>
      {/* PART 1 — Header */}
      <header
        className="text-center px-4 pt-14 pb-12 sm:pt-20 sm:pb-16"
        style={{
          background: `radial-gradient(circle at top left, rgba(59,130,246,0.35), transparent 50%), linear-gradient(180deg, ${colors.surface} 0%, ${colors.bg} 100%)`,
          borderBottom: `1px solid ${colors.border}`,
        }}
      >
        <div className="max-w-3xl mx-auto">
          <h1 className="text-3xl sm:text-4xl md:text-[2.75rem] font-bold leading-tight mb-4">
            Make more from every client you coach
          </h1>
          <p className="text-base sm:text-lg md:text-xl leading-relaxed" style={{ color: colors.muted }}>
            Start simple, scale up, and keep more of what you earn
          </p>
        </div>
      </header>

      {/* PART 2 — Cards */}
      <section className="px-4 py-12 sm:py-16 max-w-6xl mx-auto">
        <div
          className="max-w-3xl mx-auto rounded-xl border px-4 py-3 mb-8 text-center text-sm sm:text-base font-semibold"
          style={{ borderColor: colors.primary, background: 'rgba(59, 130, 246, 0.1)', color: colors.text }}
        >
          The moment you have ~10 clients, staying on Basic costs you money.
        </div>
        <p className="text-center text-sm mb-8 max-w-xl mx-auto" style={{ color: colors.muted }}>
          All plans include the same core workflow—programs, check-ins, and messaging. The difference is how you pay as volume grows.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:items-stretch">
          {PLANS.map((plan) => (
            <div
              key={plan.id}
              className={`relative flex flex-col rounded-2xl border p-6 sm:p-8 ${plan.emphasized ? 'sm:scale-[1.02] sm:z-10' : ''}`}
              style={{
                borderColor: plan.emphasized ? colors.primary : colors.border,
                background: plan.emphasized ? 'rgba(59, 130, 246, 0.08)' : colors.surface1,
                boxShadow: plan.emphasized ? '0 14px 56px rgba(59, 130, 246, 0.28)' : undefined,
              }}
            >
              {plan.label && (
                <span
                  className="inline-block self-start text-[11px] font-semibold uppercase tracking-wide px-2.5 py-1 rounded-md mb-4"
                  style={{
                    background: plan.emphasized ? colors.primary : colors.surface2,
                    color: plan.emphasized ? '#fff' : colors.muted,
                  }}
                >
                  {plan.label}
                </span>
              )}
              <h2 className="text-xl font-bold mb-1">{plan.name}</h2>
              <div className="mb-1">
                <span className="text-3xl sm:text-4xl font-bold">{formatMoney(plan.monthly)}</span>
                <span className="text-sm font-normal ml-1" style={{ color: colors.muted }}>
                  /month
                </span>
              </div>
              <p className="text-sm font-medium mb-1" style={{ color: colors.accent }}>
                {plan.commission} {plan.commissionDetail}
              </p>
              {plan.note && (
                <p className="text-xs sm:text-sm mb-4 italic" style={{ color: colors.muted }}>
                  {plan.note}
                </p>
              )}
              {!plan.note && <div className="mb-4" />}
              <ul className="space-y-2.5 mb-6 flex-1">
                {plan.highlights.map((h) => (
                  <li key={h} className="flex gap-2 text-sm" style={{ color: colors.muted }}>
                    <Check className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: colors.primary }} />
                    {h}
                  </li>
                ))}
              </ul>
              <Link
                to={SIGNUP_PUBLIC_PATH}
                className="inline-flex items-center justify-center w-full py-3.5 rounded-xl text-base font-semibold transition-opacity hover:opacity-90"
                style={{
                  background: plan.emphasized ? colors.primary : 'transparent',
                  color: plan.emphasized ? '#fff' : colors.text,
                  border: plan.emphasized ? 'none' : `1px solid ${colors.border}`,
                  boxShadow: plan.emphasized ? '0 8px 24px rgba(59,130,246,0.25)' : undefined,
                }}
              >
                {plan.cta}
              </Link>
            </div>
          ))}
        </div>
        <EliteCoachFeaturesSection />
        <EarningsCalculator />
      </section>

      {/* PART 3 — Comparison */}
      <section
        className="px-4 py-12 sm:py-16 border-t"
        style={{ borderColor: colors.border, background: colors.surface }}
      >
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-2">See the math at your volume</h2>
          <p className="text-center text-base sm:text-lg font-semibold mb-2" style={{ color: colors.text }}>
            At ~10 clients, Pro already saves you money.
          </p>
          <p className="text-sm text-center mb-2 max-w-lg mx-auto" style={{ color: colors.muted }}>
            {ASSUMED_LABEL}. Totals = monthly subscription + commission on that volume. Your real numbers may differ—use this to
            spot when upgrading saves money.
          </p>
          <div className="relative -mx-4 mt-8 sm:mx-0">
            <div
              ref={tableRef}
              onScroll={() => setHasScrolled(true)}
              className="overflow-x-auto rounded-xl border px-4 sm:px-0"
              style={{
                WebkitOverflowScrolling: 'touch',
                borderColor: colors.border,
              }}
            >
              <div style={{ minWidth: 700 }}>
                <table className="w-full text-sm" style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: colors.surface1, borderBottom: `1px solid ${colors.border}` }}>
                      <th className="text-left py-3 px-3 sm:px-4 font-semibold">Clients</th>
                      <th className="text-right py-3 px-2 sm:px-3 font-semibold whitespace-nowrap">Volume / mo</th>
                      <th className="text-right py-3 px-2 sm:px-3 font-semibold text-red-300/90 whitespace-nowrap">Commission Basic (10%)</th>
                      <th className="text-right py-3 px-2 sm:px-3 font-semibold text-red-300/90 whitespace-nowrap">Commission Pro (3%)</th>
                      <th className="text-right py-3 px-2 sm:px-3 font-semibold whitespace-nowrap">Total Basic</th>
                      <th className="text-right py-3 px-2 sm:px-3 font-semibold whitespace-nowrap">Total Pro</th>
                      <th className="text-right py-3 px-3 sm:px-4 font-semibold whitespace-nowrap">Total Elite</th>
                      <th className="text-left py-3 px-3 font-semibold whitespace-nowrap">Lowest cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {comparison.map((row) => (
                      <tr key={row.clients} style={{ borderBottom: `1px solid ${colors.border}` }}>
                        <td className="py-3 px-3 sm:px-4 font-medium">{row.clients}</td>
                        <td className="text-right py-3 px-2 sm:px-3 whitespace-nowrap" style={{ color: colors.muted }}>
                          {formatMoney(row.volume)}
                        </td>
                        <td className="text-right py-3 px-2 sm:px-3 whitespace-nowrap" style={{ color: colors.muted }}>
                          {formatMoney(row.commissionLostBasic)}
                        </td>
                        <td className="text-right py-3 px-2 sm:px-3 whitespace-nowrap" style={{ color: colors.muted }}>
                          {formatMoney(row.commissionLostPro)}
                        </td>
                        <td className="text-right py-3 px-2 sm:px-3 whitespace-nowrap">{formatMoney(row.basic)}</td>
                        <td className="text-right py-3 px-2 sm:px-3 whitespace-nowrap">{formatMoney(row.pro)}</td>
                        <td className="text-right py-3 px-3 sm:px-4 whitespace-nowrap">{formatMoney(row.elite)}</td>
                        <td className="py-3 px-3">
                          <span
                            className="inline-flex text-xs font-semibold px-2 py-0.5 rounded-md"
                            style={{
                              background:
                                row.bestId === 'elite'
                                  ? 'rgba(34, 197, 94, 0.2)'
                                  : row.bestId === 'pro'
                                    ? 'rgba(59, 130, 246, 0.25)'
                                    : 'rgba(156, 163, 175, 0.2)',
                              color: colors.text,
                            }}
                          >
                            {row.bestId === 'basic' ? 'Basic' : row.bestId === 'pro' ? 'Pro' : 'Elite'}
                          </span>
                          {row.note && (
                            <span className="block text-[10px] mt-1" style={{ color: colors.muted }}>
                              {row.note}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            {!hasScrolled && (
              <div
                className="pointer-events-none absolute right-0 top-0 bottom-0 flex items-center justify-end pr-1 sm:hidden"
                style={{
                  width: 32,
                  background: 'linear-gradient(to right, transparent, rgba(11, 18, 32, 0.9))',
                }}
              >
                <span
                  style={{
                    fontSize: 12,
                    color: colors.muted,
                    transform: 'rotate(90deg)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  scroll →
                </span>
              </div>
            )}
          </div>
          <div
            className="mt-6 rounded-xl p-4 sm:p-5 border text-sm leading-relaxed"
            style={{ borderColor: colors.border, background: colors.surface1, color: colors.muted }}
          >
            <p className="font-medium mb-2" style={{ color: colors.text }}>
              <HelpCircle className="w-4 h-4 inline mr-1 align-text-bottom" />
              How to read this
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                <strong style={{ color: colors.text }}>Commission columns</strong> show how much you give up on volume alone—Basic
                loses more to %; Pro keeps more before the fixed fee.
              </li>
              <li>
                <strong style={{ color: colors.text }}>Total columns</strong> add the monthly plan fee. When Elite (£89) drops
                below Basic or Pro on all-in cost, the upgrade pays for itself—often as your active book passes ~10–12 clients at
                this example average.
              </li>
              <li>
                <strong style={{ color: colors.text }}>Crossover guide</strong> Pro vs Basic flips at ~£860 monthly volume
                (around 9–10 clients at £100 avg). Elite vs Pro flips at ~£1,000 monthly volume (around 10–11 clients at £100 avg).
              </li>
            </ul>
            <p className="mt-3 font-medium" style={{ color: colors.text }}>
              Most coaches reach this within their first few months.
            </p>
          </div>
        </div>
      </section>

      {/* PART 4 — FAQ */}
      <section className="px-4 py-12 sm:py-16 max-w-2xl mx-auto">
        <h2 className="text-2xl font-bold text-center mb-8">Questions</h2>
        <div className="space-y-3">
          {FAQ_ITEMS.map((item) => (
            <FaqItem key={item.q} item={item} />
          ))}
        </div>
      </section>

      {/* PART 5 — CTA */}
      <section
        className="px-4 py-14 sm:py-20 text-center border-t"
        style={{
          borderColor: colors.border,
          background: `linear-gradient(180deg, ${colors.bg} 0%, rgba(59,130,246,0.12) 100%)`,
        }}
      >
        <div className="max-w-xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-bold mb-6 leading-tight">
            Stop losing money to commission
          </h2>
          <p className="text-base sm:text-lg mb-6" style={{ color: colors.muted }}>
            Upgrade when it makes sense, Atlas grows with you.
          </p>
          <Link
            to={SIGNUP_PUBLIC_PATH}
            className="inline-flex items-center justify-center px-8 py-4 rounded-xl text-base font-semibold transition-opacity hover:opacity-90"
            style={{ background: colors.primary, color: '#fff' }}
          >
            Start Coaching
          </Link>
        </div>
      </section>
    </>
  );
}

export default function PricingPage() {
  usePageMeta({
    title: "Pricing — Start Free, Scale When You're Ready",
    description:
      'Coaches start free with 10% commission. Upgrade to Pro (£59/month) or Elite (£89/month + 0% commission). No lock-in, cancel anytime.',
    canonical: 'https://atlasperformancelabs.co.uk/pricing',
  });

  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = (() => {
    const raw = String(searchParams.get('tab') || '').toLowerCase();
    if (raw === 'personal' || raw === 'coaching') return raw;
    return 'coaching';
  })();

  const [tab, setTab] = useState(initialTab);

  useEffect(() => {
    const raw = String(searchParams.get('tab') || '').toLowerCase();
    if (raw === 'personal' || raw === 'coaching') setTab(raw);
  }, [searchParams]);

  useEffect(() => {
    trackPage('pricing');
  }, []);

  const setTabAndUrl = (next) => {
    setTab(next);
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('tab', next);
    setSearchParams(nextParams, { replace: true });
  };

  const comparison = useMemo(
    () =>
      COMPARISON_ROWS.map((row) => {
        const { basic, pro, elite, bestId } = planCosts(row.volume);
        const commissionLostBasic = row.volume * 0.1;
        const commissionLostPro = row.volume * 0.03;
        return {
          ...row,
          basic,
          pro,
          elite,
          bestId,
          commissionLostBasic,
          commissionLostPro,
        };
      }),
    []
  );

  return (
    <div className="pb-16" style={{ color: colors.text }}>
      <PricingTabSwitcher value={tab} onChange={setTabAndUrl} />

      <div className="transition-opacity duration-150 ease-out">
        {tab === 'personal' ? (
          <PersonalPricingSection />
        ) : (
          <CoachingPricingSection comparison={comparison} />
        )}
      </div>
    </div>
  );
}
