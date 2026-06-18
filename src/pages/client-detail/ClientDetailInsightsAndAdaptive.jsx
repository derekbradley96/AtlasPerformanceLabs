import React from 'react';
import Card from '@/ui/Card';
import { colors, spacing } from '@/ui/tokens';
import { sectionLabel, sectionGap, standardCard } from '@/ui/pageLayout';
import { getAdjustmentSummary } from '@/lib/adaptiveTrainingEngine';

/**
 * Interpreted coaching copy + DB coaching_insights + adaptive training recommendations.
 * Mutations are injected from ClientDetail (React Query).
 */
export default function ClientDetailInsightsAndAdaptive({
  atlasCoachingInsights,
  coachingInsights,
  markInsightResolvedMutation,
  canReviewAdaptiveRecommendations,
  adaptiveRecommendations,
  editingAdaptiveId,
  editingAdaptiveTitle,
  editingAdaptiveDescription,
  setEditingAdaptiveId,
  setEditingAdaptiveTitle,
  setEditingAdaptiveDescription,
  adaptiveEditMutation,
  adaptiveStatusMutation,
}) {
  return (
    <>
      {(atlasCoachingInsights.progress || atlasCoachingInsights.risk) && (
        <section style={{ marginBottom: sectionGap }}>
          <p style={{ ...sectionLabel }}>Atlas insights</p>
          <div className="grid gap-2" style={{ gridTemplateColumns: '1fr 1fr' }}>
            {atlasCoachingInsights.progress && (
              <Card
                style={{
                  ...standardCard,
                  padding: spacing[12],
                  borderLeft: `3px solid ${atlasCoachingInsights.progress.level === 'warning' ? colors.warning : atlasCoachingInsights.progress.level === 'positive' ? colors.success : colors.primary}`,
                }}
              >
                <p className="text-xs font-medium mb-1" style={{ color: colors.muted }}>{atlasCoachingInsights.progress.title}</p>
                <p className="text-sm m-0" style={{ color: colors.text, lineHeight: 1.4 }}>{atlasCoachingInsights.progress.summary}</p>
              </Card>
            )}
            {atlasCoachingInsights.risk && (
              <Card
                style={{
                  ...standardCard,
                  padding: spacing[12],
                  borderLeft: `3px solid ${atlasCoachingInsights.risk.level === 'warning' ? colors.warning : atlasCoachingInsights.risk.level === 'positive' ? colors.success : colors.primary}`,
                }}
              >
                <p className="text-xs font-medium mb-1" style={{ color: colors.muted }}>{atlasCoachingInsights.risk.title}</p>
                <p className="text-sm m-0" style={{ color: colors.text, lineHeight: 1.4 }}>{atlasCoachingInsights.risk.summary}</p>
              </Card>
            )}
          </div>
        </section>
      )}

      {Array.isArray(coachingInsights) && coachingInsights.length > 0 && (
        <section style={{ marginBottom: sectionGap }}>
          <p style={{ ...sectionLabel }}>Coaching Insights</p>
          <div className="flex flex-col gap-2">
            {coachingInsights.map((insight) => {
              const severity = (insight.severity || '').toLowerCase();
              const color =
                severity === 'high' ? colors.danger
                  : severity === 'medium' ? colors.warning
                    : colors.success;
              const suggestedAction =
                insight.metadata?.suggested_action
                || insight.metadata?.action
                || 'Review this insight and decide on the next best step for this client.';

              return (
                <Card
                  key={insight.id}
                  style={{
                    ...standardCard,
                    padding: spacing[12],
                    opacity: insight.is_resolved ? 0.6 : 1,
                  }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-sm font-semibold m-0" style={{ color: colors.text }}>
                          {insight.title}
                        </p>
                        <span
                          className="text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wide"
                          style={{
                            background: `${color}22`,
                            color,
                            border: `1px solid ${color}55`,
                          }}
                        >
                          {severity || 'info'}
                        </span>
                      </div>
                      {insight.description && (
                        <p className="text-xs mb-1" style={{ color: colors.muted }}>
                          {insight.description}
                        </p>
                      )}
                      <p className="text-[11px] mt-1" style={{ color: colors.muted }}>
                        <span style={{ fontWeight: 500 }}>Suggested action:</span>{' '}
                        {suggestedAction}
                      </p>
                    </div>
                    {!insight.is_resolved && (
                      <button
                        type="button"
                        onClick={() => markInsightResolvedMutation.mutate(insight.id)}
                        className="text-[11px] font-medium px-2 py-1 rounded-full"
                        style={{
                          background: colors.surface2,
                          color: colors.text,
                          border: `1px solid ${colors.border}`,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        Mark resolved
                      </button>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        </section>
      )}

      {canReviewAdaptiveRecommendations && Array.isArray(adaptiveRecommendations) && adaptiveRecommendations.length > 0 && (
        <section style={{ marginBottom: sectionGap }}>
          <p style={{ ...sectionLabel }}>Adaptive Training Recommendations</p>
          <div className="flex flex-col gap-2">
            {adaptiveRecommendations.map((rec) => {
              const severity = String(rec.severity || 'low').toLowerCase();
              const status = String(rec.status || 'pending').toLowerCase();
              const severityColor =
                severity === 'high' ? colors.danger
                  : severity === 'medium' ? colors.warning
                    : colors.success;
              const isEditing = editingAdaptiveId === rec.id;
              const summary = getAdjustmentSummary(rec);
              return (
                <Card key={rec.id} style={{ ...standardCard, padding: spacing[12], opacity: status === 'ignored' ? 0.68 : 1 }}>
                  <div className="flex items-start justify-between gap-3">
                    <div style={{ flex: 1, minWidth: 0 }}>
                      {!isEditing ? (
                        <>
                          <div className="flex items-center gap-2 mb-1">
                            <p className="text-sm font-semibold m-0" style={{ color: colors.text }}>{rec.title || 'Adaptive recommendation'}</p>
                            <span
                              className="text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wide"
                              style={{ background: `${severityColor}22`, color: severityColor, border: `1px solid ${severityColor}55` }}
                            >
                              {severity}
                            </span>
                            <span
                              className="text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wide"
                              style={{ background: `${colors.primary}22`, color: colors.primary, border: `1px solid ${colors.primary}55` }}
                            >
                              {status}
                            </span>
                          </div>
                          <p className="text-[12px] mb-1" style={{ color: colors.muted }}>
                            <span style={{ fontWeight: 600 }}>Why triggered:</span>{' '}
                            {rec.description || 'Readiness/fatigue trend triggered this recommendation.'}
                          </p>
                          <p className="text-[12px] m-0" style={{ color: colors.text }}>
                            <span style={{ fontWeight: 600 }}>Suggested adjustment:</span> {summary}
                          </p>
                        </>
                      ) : (
                        <div className="flex flex-col gap-2">
                          <input
                            type="text"
                            value={editingAdaptiveTitle}
                            onChange={(e) => setEditingAdaptiveTitle(e.target.value)}
                            placeholder="Recommendation title"
                            style={{
                              width: '100%',
                              borderRadius: 8,
                              border: `1px solid ${colors.border}`,
                              background: colors.surface2,
                              color: colors.text,
                              padding: '8px 10px',
                              fontSize: 13,
                            }}
                          />
                          <textarea
                            rows={2}
                            value={editingAdaptiveDescription}
                            onChange={(e) => setEditingAdaptiveDescription(e.target.value)}
                            placeholder="Reason/notes"
                            style={{
                              width: '100%',
                              borderRadius: 8,
                              border: `1px solid ${colors.border}`,
                              background: colors.surface2,
                              color: colors.text,
                              padding: '8px 10px',
                              fontSize: 12,
                              resize: 'vertical',
                            }}
                          />
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => adaptiveEditMutation.mutate({ id: rec.id, title: editingAdaptiveTitle, description: editingAdaptiveDescription })}
                              className="text-[11px] font-medium px-2 py-1 rounded-full"
                              style={{ background: colors.primary, color: '#fff', border: 'none' }}
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingAdaptiveId(null);
                                setEditingAdaptiveTitle('');
                                setEditingAdaptiveDescription('');
                              }}
                              className="text-[11px] font-medium px-2 py-1 rounded-full"
                              style={{ background: colors.surface2, color: colors.text, border: `1px solid ${colors.border}` }}
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                    {!isEditing && (
                      <div className="flex flex-col gap-2">
                        {status === 'pending' && (
                          <>
                            <button
                              type="button"
                              onClick={() => adaptiveStatusMutation.mutate({ id: rec.id, status: 'applied' })}
                              className="text-[11px] font-medium px-2 py-1 rounded-full"
                              style={{ background: `${colors.success}22`, color: colors.success, border: `1px solid ${colors.success}55`, whiteSpace: 'nowrap' }}
                            >
                              Apply
                            </button>
                            <button
                              type="button"
                              onClick={() => adaptiveStatusMutation.mutate({ id: rec.id, status: 'ignored' })}
                              className="text-[11px] font-medium px-2 py-1 rounded-full"
                              style={{ background: `${colors.warning}22`, color: colors.warning, border: `1px solid ${colors.warning}55`, whiteSpace: 'nowrap' }}
                            >
                              Ignore
                            </button>
                          </>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            setEditingAdaptiveId(rec.id);
                            setEditingAdaptiveTitle(rec.title || '');
                            setEditingAdaptiveDescription(rec.description || '');
                          }}
                          className="text-[11px] font-medium px-2 py-1 rounded-full"
                          style={{ background: colors.surface2, color: colors.text, border: `1px solid ${colors.border}`, whiteSpace: 'nowrap' }}
                        >
                          Edit
                        </button>
                      </div>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        </section>
      )}
    </>
  );
}
