/**
 * Conversion-focused pricing: plans, commission math, FAQ, CTA.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Check, ChevronDown, HelpCircle } from 'lucide-react';
import { colors } from '@/ui/tokens';
import { SIGNUP_PUBLIC_PATH } from '@/lib/publicAuthPaths';
import EarningsCalculator from '@/components/pricing/EarningsCalculator';

const ASSUMED_LABEL = 'Example: average £100 / client / month through Atlas';
const PERSONAL_ENHANCED_PRICE = 14.99;

/** Monthly volume (£) processed → fee under each plan */
function planCosts(monthlyVolume) {
  const basic = 0 + monthlyVolume * 0.1;
  const pro = 59 + monthlyVolume * 0.03;
  const elite = 79 + 0;
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
  { clients: 10, volume: 1000, note: 'Pro crossover zone' },
  { clients: 12, volume: 1200, note: '' },
  { clients: 15, volume: 1500, note: 'Higher volume' },
  { clients: 20, volume: 2000, note: 'Elite sweet spot' },
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
    monthly: 79,
    commission: '0%',
    commissionDetail: 'no commission on payments through Atlas',
    note: 'Built for full rosters · if you are doing real numbers, this is a no-brainer',
    highlights: ['Keep 100% of platform-linked revenue above the subscription', 'Predictable cost at scale', 'Built for high-output coaching operations'],
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
  const compareRows = [
    { label: 'How you train', basic: 'Manual structure you control', enhanced: 'Smarter structure and faster drafts' },
    { label: 'Decisions', basic: 'You decide every adjustment', enhanced: 'Clearer next steps when you want them' },
    { label: 'Noise', basic: 'Minimal', enhanced: 'Still minimal—no clutter' },
    { label: 'Best for', basic: 'Building consistency first', enhanced: 'Turning consistency into momentum' },
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
            Train your way, upgrade when you&apos;re ready
          </h1>
          <p className="text-base sm:text-lg md:text-xl leading-relaxed" style={{ color: colors.muted }}>
            Basic is free for manual training and tracking. Enhanced adds smarter guidance, clearer next steps, and faster decisions when you want more support.
          </p>
        </div>
      </header>

      <section className="px-4 py-12 sm:py-16 max-w-5xl mx-auto">
        <div className="grid gap-6 md:grid-cols-2">
          <div
            className="relative flex flex-col rounded-2xl border p-6 sm:p-8"
            style={{ borderColor: colors.border, background: colors.surface1 }}
          >
            <span
              className="inline-block self-start text-[11px] font-semibold uppercase tracking-wide px-2.5 py-1 rounded-md mb-4"
              style={{ background: colors.surface2, color: colors.muted }}
            >
              Personal Basic
            </span>
            <h2 className="text-xl font-bold mb-1">Free</h2>
            <p className="text-sm mb-4" style={{ color: colors.muted }}>
              Manual-first training with full core tracking.
            </p>
            <ul className="space-y-2.5 mb-6 flex-1">
              {[
                'Manual program creation',
                'Workout logging',
                'Nutrition targets + logging',
                'Check-ins, habits, progress dashboard',
                'Barcode scan / quick add',
                'Manual adjustments',
              ].map((h) => (
                <li key={h} className="flex gap-2 text-sm" style={{ color: colors.muted }}>
                  <Check className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: colors.primary }} />
                  {h}
                </li>
              ))}
            </ul>
            <Link
              to={SIGNUP_PUBLIC_PATH}
              className="inline-flex items-center justify-center w-full py-3.5 rounded-xl text-base font-semibold transition-opacity hover:opacity-90"
              style={{ background: 'transparent', color: colors.text, border: `1px solid ${colors.border}` }}
            >
              Start free
            </Link>
          </div>
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
              Personal Enhanced
            </span>
            <div className="mb-1">
              <span className="text-3xl sm:text-4xl font-bold">£{PERSONAL_ENHANCED_PRICE.toFixed(2)}</span>
              <span className="text-sm font-normal ml-1" style={{ color: colors.muted }}>
                /month
              </span>
            </div>
            <p className="text-sm mb-4" style={{ color: colors.muted }}>
              Optional guidance when you want smarter support—not a requirement to train well.
            </p>
            <ul className="space-y-2.5 mb-6 flex-1">
              {[
                'Faster week builds from your context',
                'Smarter exercise picks as you train',
                'Feedback that sharpens your choices over time',
                'Adaptive suggestions tied to how you feel',
                'Macro nudges when your data supports them',
                'Clear next steps without extra noise',
              ].map((h) => (
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
              Upgrade to Enhanced
            </Link>
          </div>
        </div>
      </section>

      <section className="px-4 py-12 sm:py-16 border-t" style={{ borderColor: colors.border, background: colors.surface }}>
        <div className="max-w-5xl mx-auto">
          <h2 className="text-[1.55rem] sm:text-3xl font-bold text-center mb-3 leading-tight" style={{ color: colors.text }}>
            Compare how you train
          </h2>
          <p className="text-center text-[0.95rem] sm:text-lg mb-8 sm:mb-10 max-w-3xl mx-auto leading-relaxed" style={{ color: colors.muted }}>
            Start free, upgrade only if it earns its place in your week.
          </p>
          <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0 rounded-xl border" style={{ borderColor: colors.border }}>
            <table className="w-full text-sm min-w-[520px]">
              <thead>
                <tr style={{ background: colors.surface1, borderBottom: `1px solid ${colors.border}` }}>
                  <th className="text-left py-3 px-3 sm:px-4 font-semibold"> </th>
                  <th className="text-left py-3 px-3 sm:px-4 font-semibold">Personal Basic</th>
                  <th className="text-left py-3 px-3 sm:px-4 font-semibold">Personal Enhanced</th>
                </tr>
              </thead>
              <tbody>
                {compareRows.map((row) => (
                  <tr key={row.label} style={{ borderBottom: `1px solid ${colors.border}` }}>
                    <td className="py-3 px-3 sm:px-4 font-medium whitespace-nowrap">{row.label}</td>
                    <td className="py-3 px-3 sm:px-4" style={{ color: colors.muted }}>{row.basic}</td>
                    <td className="py-3 px-3 sm:px-4" style={{ color: colors.muted }}>{row.enhanced}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div
            className="mt-6 rounded-xl p-4 sm:p-5 border text-sm leading-relaxed"
            style={{ borderColor: colors.border, background: colors.surface1, color: colors.muted }}
          >
            <p className="font-medium mb-2" style={{ color: colors.text }}>
              What Basic covers vs what Enhanced adds
            </p>
            <p>
              Basic gives you the full manual toolkit to train consistently. Enhanced adds a guidance layer on top—so you can move faster when you want help turning consistency into clearer next steps.
            </p>
          </div>
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
            Start free. Upgrade when it helps.
          </h2>
          <p className="text-base sm:text-lg mb-6" style={{ color: colors.muted }}>
            No pressure—just a cleaner path to consistent training.
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
        <div className="grid gap-6 md:grid-cols-3 md:items-stretch">
          {PLANS.map((plan) => (
            <div
              key={plan.id}
              className={`relative flex flex-col rounded-2xl border p-6 sm:p-8 ${plan.emphasized ? 'md:scale-[1.02] md:z-10' : ''}`}
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
          <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0 mt-8 rounded-xl border" style={{ borderColor: colors.border }}>
            <table className="w-full text-sm min-w-[520px]">
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
                <strong style={{ color: colors.text }}>Total columns</strong> add the monthly plan fee. When Elite (£79) drops
                below Basic, the upgrade pays for itself—often as your active book passes ~20 clients at this example average.
              </li>
              <li>
                <strong style={{ color: colors.text }}>Pro vs Basic</strong> usually flips around £800–£900 monthly volume at
                these rates—roughly the 10–15 client range in the example.
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
