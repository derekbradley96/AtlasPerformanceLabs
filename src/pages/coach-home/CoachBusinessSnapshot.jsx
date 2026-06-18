import React from 'react';
import { useNavigate } from 'react-router-dom';
import { getMessagesListPath, navigateToThread } from '@/lib/messagesPath';
import Card from '@/ui/Card';
import CountPill from '@/components/CountPill';
import { colors, spacing } from '@/ui/tokens';
import { sectionLabel, sectionGap } from '@/ui/pageLayout';

/** Business metrics + optional billing note + retention intel list (deferred panel). */
export default function CoachBusinessSnapshot({
  cardStyle,
  activeClientCount,
  clientsAtRiskTodayLength,
  revenueDisplay,
  newLeadsCount,
  billingState,
  planTier,
  formatCurrency,
  retentionIntelItems,
}) {
  const navigate = useNavigate();

  return (
    <>
      <section style={{ marginBottom: sectionGap }}>
        <div style={sectionLabel}>Business Snapshot</div>
        <Card style={{ ...cardStyle, padding: spacing[12] }}>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <CountPill label="Active clients" value={activeClientCount} tone="primary" />
            <CountPill
              label="At-risk clients"
              value={clientsAtRiskTodayLength}
              tone={clientsAtRiskTodayLength > 0 ? 'warning' : 'neutral'}
            />
            <CountPill label="Revenue" value={revenueDisplay} tone="neutral" />
            <CountPill label="New leads" value={newLeadsCount} tone={newLeadsCount > 0 ? 'primary' : 'neutral'} />
          </div>
        </Card>
        {billingState?.recommended_plan && billingState?.recommended_plan !== planTier ? (
          <Card style={{ ...cardStyle, marginTop: spacing[8], padding: spacing[12] }}>
            <p className="text-xs font-semibold" style={{ color: colors.text }}>
              Monthly summary: {String(billingState.recommended_plan).toUpperCase()} is currently the lower-cost plan.
            </p>
            <p className="text-xs mt-1" style={{ color: colors.muted }}>
              Current estimated monthly platform cost: {formatCurrency(Number(billingState.monthly_fees_estimate || 0))}
            </p>
          </Card>
        ) : null}
      </section>
      <section style={{ marginBottom: sectionGap }}>
        <div style={sectionLabel}>Retention Intelligence</div>
        <Card style={{ ...cardStyle }}>
          {retentionIntelItems.length === 0 ? (
            <p className="text-sm" style={{ color: colors.muted }}>
              No inactivity or adherence-risk signals right now.
            </p>
          ) : (
            <ul className="space-y-0">
              {retentionIntelItems.map((item, idx) => (
                <li key={`${item.client_id || 'global'}-ri-${idx}`} style={{ borderBottom: `1px solid ${colors.border}` }}>
                  <div className="py-3 flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold truncate" style={{ color: colors.text }}>
                        {item.client_name || 'Client'}
                      </p>
                      <p className="text-xs truncate" style={{ color: colors.muted }}>
                        {item.reason_summary || 'Adherence trend dropping'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => (item.client_id ? navigateToThread(navigate, item.client_id) : navigate(getMessagesListPath()))}
                      className="inline-flex items-center gap-1 text-xs font-medium rounded-lg py-1.5 px-2.5"
                      style={{ background: colors.surface1, color: colors.primary, border: `1px solid ${colors.border}` }}
                    >
                      Message
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </section>
    </>
  );
}
