import React from 'react';
import Card from '@/ui/Card';
import BlockHeader from '@/components/program-builder/BlockHeader';
import EmptyState from '@/components/ui/EmptyState';
import { UserPlus, X } from 'lucide-react';
import { colors, spacing, shell, radii, touchTargetMin } from '@/ui/tokens';

export default function ProgramBuilderHeader({
  showCoachNoClientsGate,
  navigate,
  clients,
  isPersonalRole,
  personalBuilderIntro,
  block,
  personalBasicExperience,
  fromTodayContext,
  dismissTodayFromBuilder,
  adjustmentMode,
  contextBannerTitle,
  contextNote,
  handleSaveBlock,
  headerEffectiveWeeksRef,
  saving,
  clientId,
  contextReviewId,
  contextSource,
  setClientId,
  standardCard,
  sectionGap,
  sectionLabel,
  blockName,
  setBlockName,
  totalWeeks,
  setTotalWeeks,
  reportHeaderEffectiveWeeks,
  saveDisabled,
  saveHint,
  isPrepOriented,
  personalSaveNameHint,
  personalEnhancedExperience,
}) {
  if (showCoachNoClientsGate) {
    return (
      <div style={{ marginBottom: sectionGap }}>
        <EmptyState
          title="No clients yet"
          description="Add someone to your roster first. Then you can build blocks, weeks, and exercises for them."
          icon={UserPlus}
          actionLabel="Open Clients"
          onAction={() => navigate('/clients')}
        />
      </div>
    );
  }

  return (
    <>
      {(clients.length > 0 || isPersonalRole) ? (
        <p style={{ fontSize: 13, color: colors.muted, marginBottom: spacing[16], lineHeight: 1.45, marginTop: 0 }}>
          {isPersonalRole
            ? personalBuilderIntro({ hasBlock: !!block?.id, basic: personalBasicExperience })
            : 'Pick the client, name the block, then add training days and lifts. Save often — changes sync to Supabase.'}
        </p>
      ) : null}

      {fromTodayContext ? (
        <Card
          style={{
            marginBottom: spacing[16],
            padding: `${spacing[12]}px ${spacing[14]}px`,
            background: colors.primarySubtle,
            border: `1px solid ${colors.border}`,
            display: 'flex',
            alignItems: 'flex-start',
            gap: spacing[12],
          }}
        >
          <p style={{ fontSize: 13, color: colors.text, margin: 0, flex: 1, lineHeight: 1.45 }}>
            Build your program and it&apos;ll show up here in Today.
          </p>
          <button
            type="button"
            onClick={dismissTodayFromBuilder}
            aria-label="Dismiss"
            style={{
              flexShrink: 0,
              minWidth: touchTargetMin,
              minHeight: touchTargetMin,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: radii.button,
              border: 'none',
              background: 'transparent',
              color: colors.muted,
              cursor: 'pointer',
              padding: 0,
            }}
          >
            <X size={18} aria-hidden />
          </button>
        </Card>
      ) : null}

      {adjustmentMode && contextBannerTitle ? (
        <Card
          style={{
            marginBottom: spacing[16],
            padding: spacing[16],
            background: colors.primarySubtle,
            border: `1px solid ${colors.primary}`,
          }}
        >
          <p style={{ fontSize: 13, fontWeight: 600, color: colors.text, margin: 0 }}>
            {contextBannerTitle}
          </p>
          {contextNote ? (
            <p style={{ fontSize: 12, color: colors.muted, margin: 0, marginTop: 4 }} title={contextNote}>
              {contextNote.length > 80 ? `${contextNote.slice(0, 80)}…` : contextNote}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2" style={{ marginTop: spacing[12], paddingTop: spacing[12], borderTop: `1px solid ${shell.cardBorder}` }}>
            <button
              type="button"
              onClick={() => handleSaveBlock({ totalWeeks: headerEffectiveWeeksRef.current })}
              disabled={saving}
              className="inline-flex items-center gap-1.5"
              style={{
                minHeight: touchTargetMin,
                padding: `${spacing[10]}px ${spacing[16]}px`,
                borderRadius: radii.button,
                background: colors.primary,
                color: '#fff',
                border: 'none',
                fontSize: 13,
                fontWeight: 600,
                cursor: saving ? 'not-allowed' : 'pointer',
                opacity: saving ? 0.7 : 1,
              }}
            >
              Save changes
            </button>
            {(clientId || block?.client_id) && contextReviewId && (contextSource === 'checkin' || contextSource === 'pose_check') ? (
              <button
                type="button"
                onClick={() =>
                  navigate(
                    contextSource === 'checkin'
                      ? `/review-center/checkins/${contextReviewId}`
                      : `/review-center/pose-checks/${contextReviewId}`
                  )
                }
                className="inline-flex items-center gap-1.5"
                style={{
                  minHeight: touchTargetMin,
                  padding: `${spacing[10]}px ${spacing[16]}px`,
                  borderRadius: radii.button,
                  background: 'transparent',
                  color: colors.text,
                  border: `1px solid ${shell.cardBorder}`,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Return to Review
              </button>
            ) : null}
          </div>
        </Card>
      ) : null}

      {!block && !isPersonalRole && clients.length > 0 ? (
        <Card style={{ ...standardCard, marginBottom: sectionGap, padding: spacing[16] }}>
          <p style={{ ...sectionLabel, marginBottom: spacing[8] }}>Client (required)</p>
          <select
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            style={{
              width: '100%',
              padding: `${spacing[12]}px ${spacing[14]}px`,
              borderRadius: 10,
              background: colors.surface2,
              border: `1px solid ${shell.cardBorder}`,
              color: colors.text,
              fontSize: 14,
            }}
          >
            <option value="">Select client</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </Card>
      ) : null}

      <BlockHeader
        blockName={blockName}
        onBlockNameChange={setBlockName}
        totalWeeks={totalWeeks}
        onTotalWeeksChange={setTotalWeeks}
        onSave={handleSaveBlock}
        onEffectiveWeeksChange={reportHeaderEffectiveWeeks}
        saving={saving}
        saveDisabled={saveDisabled}
        hasBlock={!!block?.id}
        blockNamePlaceholder={
          isPersonalRole
            ? 'Plan name (e.g. Spring strength)'
            : isPrepOriented
              ? 'Block name (e.g. Prep Block)'
              : 'Block name'
        }
        saveHint={isPersonalRole ? personalSaveNameHint({ hasBlock: !!block?.id }) : saveHint}
        planMode={isPersonalRole}
        hideWeekCount={!personalEnhancedExperience && !!block?.id}
      />
    </>
  );
}
