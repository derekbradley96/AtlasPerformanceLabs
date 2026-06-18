import React from 'react';
import Card from '@/ui/Card';
import Button from '@/ui/Button';
import EmptyState from '@/components/ui/EmptyState';
import PrepHeader from '@/components/PrepHeader';
import PrepTimelineCard from '@/components/prep/PrepTimelineCard';
import PrepCheckpoints from '@/components/prep/PrepCheckpoints';
import PoseCheckTimeline from '@/components/prep/PoseCheckTimeline';
import PrepInsightsBlock from '@/components/prep/PrepInsightsBlock';
import PrepHistoryCard from '@/components/prep/PrepHistoryCard';
import PrepPosingTargetCard from '@/components/prep/PrepPosingTargetCard';
import { Calendar } from 'lucide-react';
import { colors, spacing, touchTargetMin } from '@/ui/tokens';
import { standardCard, sectionLabel, sectionGap } from '@/ui/pageLayout';

export default function ClientPrepTab({
  client,
  clientId,
  coachFocus,
  isPrep,
  prepStatusText,
  progressMetrics,
  progressMetricsLoading,
  showPrepTimelineSurfaces,
  lightHaptic,
  navigate,
}) {
  return (
    <>
      {client && clientId && (coachFocus === 'competition' || coachFocus === 'integrated') && (
        <Card style={{ ...standardCard, padding: spacing[16], marginBottom: sectionGap }}>
          <p style={{ ...sectionLabel, marginBottom: spacing[8] }}>Prep command centre</p>
          <p style={{ fontSize: 13, color: colors.muted, margin: 0, marginBottom: spacing[12], lineHeight: 1.45 }}>
            {prepStatusText ? `Timeline: ${prepStatusText}. Use shortcuts below for prep operations.` : 'Set show context to activate prep workflow.'}
          </p>
          <div className="flex flex-col gap-2">
            <Button variant="secondary" size="sm" className="justify-start" style={{ minHeight: touchTargetMin }} onClick={async () => { await lightHaptic(); navigate(`/program-assignments?clientId=${encodeURIComponent(clientId)}`); }}>
              Assign program
            </Button>
            <Button variant="secondary" size="sm" className="justify-start" style={{ minHeight: touchTargetMin }} onClick={async () => { await lightHaptic(); navigate(`/clients/${clientId}/peak-week-editor`); }}>
              Peak week editor
            </Button>
            <Button variant="secondary" size="sm" className="justify-start" style={{ minHeight: touchTargetMin }} onClick={async () => { await lightHaptic(); navigate(`/prep-comparison?clientId=${encodeURIComponent(clientId)}&source=prep-command-centre`); }}>
              View comparison
            </Button>
          </div>
        </Card>
      )}

      {showPrepTimelineSurfaces && (
        <div data-prep-header style={{ marginBottom: spacing[16] }}>
          <PrepHeader clientId={clientId} showPrepInsights />
          {progressMetrics?.has_active_prep ? (
            <>
              <PrepPosingTargetCard clientId={clientId} />
              <PrepInsightsBlock clientId={clientId} />
              <PrepTimelineCard clientId={clientId} />
              <PrepCheckpoints clientId={clientId} />
              <PoseCheckTimeline clientId={clientId} />
            </>
          ) : !progressMetricsLoading && progressMetrics && (
            <EmptyState
              title="No prep data for this client"
              description="Timeline and pose checks will appear here when they're in active contest prep."
              icon={Calendar}
            />
          )}
          <PrepHistoryCard clientId={clientId} />
        </div>
      )}

      {!isPrep && !showPrepTimelineSurfaces && (
        <Card style={{ ...standardCard, padding: spacing[16], marginBottom: sectionGap }}>
          <p className="text-sm m-0" style={{ color: colors.muted }}>
            Prep tab is available for competition and integrated prep clients.
          </p>
        </Card>
      )}
    </>
  );
}
