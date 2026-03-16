import React from 'react';
import Card from '@/ui/Card';
import { colors, spacing, shell } from '@/ui/tokens';

export default function GrowthDashboardPage() {
  return (
    <div
      className="min-h-screen"
      style={{
        background: colors.bgPrimary,
        padding: spacing[16],
        paddingTop: `calc(${spacing[20]} + env(safe-area-inset-top, 0px))`,
        paddingBottom: `calc(${spacing[20]} + env(safe-area-inset-bottom, 0px))`,
      }}
    >
      <div className="max-w-5xl mx-auto space-y-6">
        <header>
          <h1 className="text-2xl font-semibold mb-1" style={{ color: colors.text }}>
            Growth dashboard
          </h1>
          <p className="text-sm" style={{ color: colors.muted }}>
            High-level view of coach acquisition, referrals, marketplace performance, and result story impact.
          </p>
        </header>

        <section className="grid gap-4 md:grid-cols-2">
          <Card
            style={{
              padding: spacing[16],
              background: colors.surface,
              borderRadius: shell.cardRadius,
            }}
          >
            <p className="text-xs mb-1 uppercase tracking-wide" style={{ color: colors.muted }}>
              Coach acquisition
            </p>
            <p className="text-sm mb-3" style={{ color: colors.muted }}>
              New coaches joining Atlas and where they come from.
            </p>
            <div className="flex flex-col gap-2 text-sm" style={{ color: colors.text }}>
              <div className="flex justify-between">
                <span>New coaches (last 30 days)</span>
                <span>—</span>
              </div>
              <div className="flex justify-between">
                <span>Signup sources</span>
                <span>—</span>
              </div>
            </div>
          </Card>

          <Card
            style={{
              padding: spacing[16],
              background: colors.surface,
              borderRadius: shell.cardRadius,
            }}
          >
            <p className="text-xs mb-1 uppercase tracking-wide" style={{ color: colors.muted }}>
              Referral performance
            </p>
            <p className="text-sm mb-3" style={{ color: colors.muted }}>
              How referral links and invites are converting into new signups.
            </p>
            <div className="flex flex-col gap-2 text-sm" style={{ color: colors.text }}>
              <div className="flex justify-between">
                <span>Referral link opens (30d)</span>
                <span>—</span>
              </div>
              <div className="flex justify-between">
                <span>Coach conversion rate</span>
                <span>—</span>
              </div>
            </div>
          </Card>
        </section>

        <section className="grid gap-4 md:grid-cols-2">
          <Card
            style={{
              padding: spacing[16],
              background: colors.surface,
              borderRadius: shell.cardRadius,
            }}
          >
            <p className="text-xs mb-1 uppercase tracking-wide" style={{ color: colors.muted }}>
              Marketplace conversions
            </p>
            <p className="text-sm mb-3" style={{ color: colors.muted }}>
              How marketplace views turn into enquiries and paying clients.
            </p>
            <div className="flex flex-col gap-2 text-sm" style={{ color: colors.text }}>
              <div className="flex justify-between">
                <span>Profile views (30d)</span>
                <span>—</span>
              </div>
              <div className="flex justify-between">
                <span>Enquiries (30d)</span>
                <span>—</span>
              </div>
            </div>
          </Card>

          <Card
            style={{
              padding: spacing[16],
              background: colors.surface,
              borderRadius: shell.cardRadius,
            }}
          >
            <p className="text-xs mb-1 uppercase tracking-wide" style={{ color: colors.muted }}>
              Personal user growth
            </p>
            <p className="text-sm mb-3" style={{ color: colors.muted }}>
              New personal users and self-serve journeys.
            </p>
            <div className="flex flex-col gap-2 text-sm" style={{ color: colors.text }}>
              <div className="flex justify-between">
                <span>New personal users (30d)</span>
                <span>—</span>
              </div>
              <div className="flex justify-between">
                <span>Top entry funnels</span>
                <span>—</span>
              </div>
            </div>
          </Card>
        </section>

        <section>
          <Card
            style={{
              padding: spacing[16],
              background: colors.surface,
              borderRadius: shell.cardRadius,
            }}
          >
            <p className="text-xs mb-1 uppercase tracking-wide" style={{ color: colors.muted }}>
              Top performing result stories
            </p>
            <p className="text-sm mb-3" style={{ color: colors.muted }}>
              Stories that drive the most views, shares, and enquiries.
            </p>
            <div className="text-sm" style={{ color: colors.muted }}>
              <p>Result story leaderboard coming soon. This will highlight which stories pull in the most growth signals.</p>
            </div>
          </Card>
        </section>
      </div>
    </div>
  );
}

