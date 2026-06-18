import React from 'react';
import Card from '@/ui/Card';
import EmptyState from '@/components/ui/EmptyState';
import ClientCheckinsPanel from '@/components/clients/ClientCheckinsPanel';
import { ClipboardList } from 'lucide-react';
import { standardCard, sectionLabel, sectionGap } from '@/ui/pageLayout';
import { spacing, colors } from '@/ui/tokens';

export default function ClientCheckInsTab({
  checkInsList,
  clientId,
  formatRelativeDate,
  lastCheckInAt,
  nextCheckInDue,
  pendingCheckIns,
  getCheckinReviewed,
  formatShortDate,
  lightHaptic,
  navigate,
}) {
  return (
    <div id="os-checkins" style={{ marginBottom: sectionGap, scrollMarginTop: 12 }}>
      <p style={{ ...sectionLabel }}>Check-ins</p>
      <div style={{ marginBottom: spacing[12] }}>
        <Card style={{ ...standardCard, padding: spacing[16] }}>
          {Array.isArray(checkInsList) && checkInsList.length > 0 ? (
            <>
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <div>
                  <p className="text-[11px] font-medium" style={{ color: colors.muted, marginBottom: 2 }}>Last check-in</p>
                  <p style={{ color: colors.text }}>{lastCheckInAt ? formatRelativeDate(lastCheckInAt) : '—'}</p>
                </div>
                <div>
                  <p className="text-[11px] font-medium" style={{ color: colors.muted, marginBottom: 2 }}>Next due</p>
                  <p style={{ color: colors.text }}>{nextCheckInDue ?? '—'}</p>
                </div>
              </div>
              {pendingCheckIns.length > 0 && <p className="text-[13px] mt-2" style={{ color: colors.warning }}>{pendingCheckIns.length} pending</p>}
            </>
          ) : (
            <EmptyState title="No check-ins yet" description="Check-ins will appear here once the client submits." icon={ClipboardList} />
          )}
        </Card>
      </div>
      {Array.isArray(checkInsList) && checkInsList.length > 0 ? (
        <ClientCheckinsPanel
          clientId={clientId}
          checkInsList={checkInsList}
          getCheckinReviewed={getCheckinReviewed}
          formatShortDate={formatShortDate}
          onCheckinSelect={async (c) => {
            await lightHaptic();
            if (clientId && c?.id) navigate(`/review-center/checkins/${c.id}?clientId=${encodeURIComponent(clientId)}`);
          }}
        />
      ) : null}
    </div>
  );
}
