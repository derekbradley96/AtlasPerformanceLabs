import React from 'react';
import Card from '@/ui/Card';
import Button from '@/ui/Button';
import { standardCard, sectionLabel, sectionGap } from '@/ui/pageLayout';
import { colors, spacing } from '@/ui/tokens';

export default function ClientNotesTab({
  quickNotes,
  setQuickNotes,
  coachNotesState,
  setCoachNotesState,
  handleSaveNotes,
  handleSaveCoachNotes,
}) {
  return (
    <div style={{ marginBottom: sectionGap }}>
      <p style={{ ...sectionLabel }}>Notes</p>
      <Card style={{ ...standardCard, padding: spacing[16], marginBottom: spacing[12] }}>
        <p className="text-xs font-semibold" style={{ color: colors.muted, marginBottom: spacing[8] }}>Client notes</p>
        <textarea
          value={quickNotes}
          onChange={(e) => setQuickNotes(e.target.value)}
          rows={4}
          className="w-full rounded-xl py-2.5 px-3 resize-none focus:outline-none focus:ring-1"
          style={{ background: colors.surface1, border: `1px solid ${colors.border}`, color: colors.text }}
        />
        <Button variant="secondary" size="sm" style={{ marginTop: spacing[10] }} onClick={handleSaveNotes}>
          Save client notes
        </Button>
      </Card>
      <Card style={{ ...standardCard, padding: spacing[16] }}>
        <p className="text-xs font-semibold" style={{ color: colors.muted, marginBottom: spacing[8] }}>Coach notes</p>
        <textarea
          value={coachNotesState}
          onChange={(e) => setCoachNotesState(e.target.value)}
          rows={4}
          className="w-full rounded-xl py-2.5 px-3 resize-none focus:outline-none focus:ring-1"
          style={{ background: colors.surface1, border: `1px solid ${colors.border}`, color: colors.text }}
        />
        <Button variant="secondary" size="sm" style={{ marginTop: spacing[10] }} onClick={handleSaveCoachNotes}>
          Save coach notes
        </Button>
      </Card>
    </div>
  );
}
