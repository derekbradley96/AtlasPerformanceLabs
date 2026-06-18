import React from 'react';
import { useNavigate } from 'react-router-dom';
import { navigateToThread } from '@/lib/messagesPath';
import Card from '@/ui/Card';
import { colors } from '@/ui/tokens';
import { sectionLabel, sectionGap } from '@/ui/pageLayout';
import { hapticLight } from '@/lib/haptics';
import { AlertCircle, MessageSquare } from 'lucide-react';

/** Deferred: high-severity coaching_insights + subscription overdue list (chunk-split for lazy load). */
export default function CoachRiskPanel({
  coachingAlerts,
  overdueSubscriptions,
  cardStyle,
  onOpenClient,
  formatCurrency,
  paymentReminderMsg,
}) {
  const navigate = useNavigate();
  const hasCoaching = Array.isArray(coachingAlerts) && coachingAlerts.length > 0;
  const hasOverdue = Array.isArray(overdueSubscriptions) && overdueSubscriptions.length > 0;
  if (!hasCoaching && !hasOverdue) return null;

  return (
    <>
      {hasCoaching ? (
        <section style={{ marginTop: sectionGap }}>
          <div className="flex items-center gap-2 mb-2">
            <span style={sectionLabel}>Coaching Alerts</span>
            <span
              className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
              style={{ background: 'rgba(239,68,68,0.2)', color: colors.danger }}
            >
              <AlertCircle size={12} /> High severity
            </span>
          </div>
          <Card style={{ ...cardStyle, borderLeft: `4px solid ${colors.danger}` }}>
            <ul className="space-y-0">
              {coachingAlerts.slice(0, 5).map((row) => (
                <li key={row.id} style={{ borderBottom: `1px solid ${colors.border}` }}>
                  <div className="py-3">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium truncate text-left text-sm" style={{ color: colors.text }}>
                          {row.title || 'Coaching alert'}
                        </p>
                        <p className="text-xs mt-0.5" style={{ color: colors.muted }}>
                          {row.client_name || 'Client'} ·{' '}
                          {row.insight_type === 'prep_risk'
                            ? 'Prep risk'
                            : row.insight_type === 'weight_plateau'
                              ? 'Plateau detected'
                              : row.insight_type === 'engagement_drop'
                                ? 'Engagement dropping'
                                : row.insight_type?.replace(/_/g, ' ') || 'Alert'}
                        </p>
                        {row.description ? (
                          <p className="text-[11px] mt-0.5" style={{ color: colors.muted }}>
                            {row.description}
                          </p>
                        ) : null}
                      </div>
                      <button
                        type="button"
                        onClick={() => onOpenClient(row.client_id)}
                        className="inline-flex items-center gap-1 text-xs font-medium rounded-lg py-1.5 px-2.5"
                        style={{ background: colors.surface1, color: colors.primary, border: `1px solid ${colors.border}` }}
                      >
                        View client
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        </section>
      ) : null}

      {hasOverdue ? (
        <section style={{ marginTop: sectionGap }}>
          <div className="flex items-center gap-2 mb-2">
            <span style={sectionLabel}>Clients with overdue payments</span>
            <span
              className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
              style={{ background: 'rgba(239,68,68,0.2)', color: colors.danger }}
            >
              <AlertCircle size={12} /> Overdue
            </span>
          </div>
          <Card style={{ ...cardStyle, borderLeft: `4px solid ${colors.danger}` }}>
            <ul className="space-y-0">
              {overdueSubscriptions.map((row) => (
                <li key={row.subscription_id} style={{ borderBottom: `1px solid ${colors.border}` }}>
                  <div className="py-3">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium truncate text-left text-sm" style={{ color: colors.text }}>
                          {row.client_name || 'Client'}
                        </p>
                        <p className="text-xs mt-0.5" style={{ color: colors.muted }}>
                          {row.days_overdue != null && row.days_overdue > 0
                            ? `${row.days_overdue} day${row.days_overdue === 1 ? '' : 's'} overdue`
                            : 'Overdue'}{' '}
                          · {formatCurrency(row.price)}
                        </p>
                      </div>
                      <div className="flex shrink-0 gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            hapticLight();
                            navigate(`/clients/${row.client_id}/billing`);
                          }}
                          className="inline-flex items-center gap-1 text-xs font-medium rounded-lg py-1.5 px-2.5"
                          style={{ background: colors.surface1, color: colors.primary, border: `1px solid ${colors.border}` }}
                        >
                          Open billing
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            hapticLight();
                            navigateToThread(navigate, row.client_id, { state: { prefilledMessage: paymentReminderMsg } });
                          }}
                          className="inline-flex items-center gap-1 text-xs font-medium rounded-lg py-1.5 px-2.5"
                          style={{ background: colors.surface1, color: colors.primary, border: `1px solid ${colors.border}` }}
                        >
                          <MessageSquare size={14} /> Message client
                        </button>
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        </section>
      ) : null}
    </>
  );
}
