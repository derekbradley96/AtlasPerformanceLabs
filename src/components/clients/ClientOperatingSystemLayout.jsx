/**
 * Coach Client Detail — unified operating system shell (desktop 3-column vs app stack + drawer).
 */
import React, { useState } from 'react';
import { ChevronDown, ChevronUp, MessageCircle, SlidersHorizontal, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { colors, spacing, shell, shadows } from '@/ui/tokens';
import { CLIENT_OS_MESSAGE_TEMPLATES } from '@/lib/clientOsModel';

function sectionLabelStyle() {
  return {
    margin: `0 0 ${spacing[8]}px`,
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    color: colors.muted,
  };
}

function SummaryChip({ label, value, accent }) {
  return (
    <div
      style={{
        flex: '1 1 100px',
        minWidth: 88,
        padding: `${spacing[8]}px ${spacing[10]}px`,
        borderRadius: 12,
        border: `1px solid ${colors.border}`,
        background: colors.surface2,
      }}
    >
      <p style={{ margin: 0, fontSize: 10, fontWeight: 700, color: colors.muted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</p>
      <p style={{ margin: `${spacing[4]}px 0 0`, fontSize: 14, fontWeight: 700, color: accent || colors.text }}>{value}</p>
    </div>
  );
}

export default function ClientOperatingSystemLayout({
  /** For deep-link scroll (?tab=messages) */
  rightRailId = 'os-actions-rail',
  isDesktopWeb,
  /** @type {{ initials: string, name: string, phaseLine: string, typeLabel: string, statusLabel: string, statusColor: string, lastCheckin: string }} */
  header,
  summaryItems = [],
  leftColumn,
  rightPanel,
  children,
  /** Optional: best next action + queue (from ClientDetail intelligence) */
  priorityRail,
  messageDraft,
  onMessageDraftChange,
  onSendMessage,
  sendingMessage,
  adjustmentDraft,
  onAdjustmentDraftChange,
  onApplyAdjustment,
  coachNotes,
  onCoachNotesChange,
  onSaveCoachNotes,
  pinnedNote,
  onPinnedNoteChange,
  onSavePinnedNote,
  onOpenFullThread,
  topQuickActions,
}) {
  const [summaryOpen, setSummaryOpen] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const headerBlock = (
    <header
      id="os-top"
      style={{
        marginBottom: spacing[14],
        paddingBottom: spacing[14],
        borderBottom: `1px solid ${colors.border}`,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: spacing[12] }}>
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 15,
            fontWeight: 700,
            background: colors.surface2,
            color: colors.text,
            flexShrink: 0,
          }}
        >
          {header.initials}
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <h1 style={{ margin: 0, fontSize: isDesktopWeb ? 24 : 20, fontWeight: 800, letterSpacing: '-0.02em', color: colors.text }}>{header.name}</h1>
          <p style={{ margin: `${spacing[4]}px 0 0`, fontSize: 13, color: colors.muted }}>{header.typeLabel}</p>
          <p style={{ margin: `${spacing[4]}px 0 0`, fontSize: 13, color: colors.textSecondary }}>{header.phaseLine}</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: spacing[8], marginTop: spacing[10] }}>
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                padding: '4px 10px',
                borderRadius: 8,
                background: `${header.statusColor}22`,
                color: header.statusColor,
              }}
            >
              {header.statusLabel}
            </span>
            <span style={{ fontSize: 12, color: colors.muted }}>Last check-in: {header.lastCheckin}</span>
          </div>
        </div>
      </div>
    </header>
  );

  const summaryBlock = (
    <div style={{ marginBottom: spacing[16] }}>
      {!isDesktopWeb ? (
        <button
          type="button"
          onClick={() => setSummaryOpen((o) => !o)}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: spacing[12],
            borderRadius: shell.cardRadius,
            border: `1px solid ${colors.border}`,
            background: colors.surface1,
            color: colors.text,
            fontSize: 13,
            fontWeight: 600,
            marginBottom: spacing[8],
          }}
        >
          Summary
          {summaryOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </button>
      ) : null}
      {(!isDesktopWeb && !summaryOpen) ? null : (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: spacing[8] }}>
          {summaryItems.map((it) => (
            <SummaryChip key={it.label} label={it.label} value={it.value} accent={it.accent} />
          ))}
        </div>
      )}
    </div>
  );

  const railInner = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: spacing[16] }}>
      {priorityRail}
      <div>
        <p style={sectionLabelStyle()}>Quick actions</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing[8] }}>{topQuickActions}</div>
      </div>
      <div>
        <p style={sectionLabelStyle()}>Adjustment notes</p>
        <Textarea
          value={adjustmentDraft}
          onChange={(e) => onAdjustmentDraftChange(e.target.value)}
          rows={3}
          placeholder="e.g. Pull 1 set from legs · calories −100 · cardio +1"
          style={{ background: colors.surface2, borderColor: colors.border, color: colors.text }}
        />
        {onApplyAdjustment ? (
          <Button type="button" variant="secondary" size="sm" className="mt-2 w-full" onClick={onApplyAdjustment}>
            Open macro editor
          </Button>
        ) : null}
      </div>
      <div>
        <p style={sectionLabelStyle()}>Pinned note (private)</p>
        <Input
          value={pinnedNote}
          onChange={(e) => onPinnedNoteChange(e.target.value)}
          placeholder="Shows at top of notes"
          className="mb-2"
          style={{ background: colors.surface2, borderColor: colors.border, color: colors.text }}
        />
        {onSavePinnedNote ? (
          <Button type="button" variant="outline" size="sm" onClick={onSavePinnedNote}>
            Save pinned
          </Button>
        ) : null}
      </div>
      <div>
        <p style={sectionLabelStyle()}>Coach notes</p>
        <Textarea
          value={coachNotes}
          onChange={(e) => onCoachNotesChange(e.target.value)}
          rows={5}
          placeholder="Private notes — not visible to client"
          style={{ background: colors.surface2, borderColor: colors.border, color: colors.text }}
        />
        {onSaveCoachNotes ? (
          <Button type="button" variant="outline" size="sm" className="mt-2" onClick={onSaveCoachNotes}>
            Save notes
          </Button>
        ) : null}
      </div>
      <div>
        <p style={sectionLabelStyle()}>Message</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing[6], marginBottom: spacing[8] }}>
          {CLIENT_OS_MESSAGE_TEMPLATES.map((t) => (
            <Button
              key={t.id}
              type="button"
              size="sm"
              variant="outline"
              className="justify-start text-left h-auto py-2 whitespace-normal"
              onClick={() => onMessageDraftChange(t.body)}
            >
              {t.label}
            </Button>
          ))}
        </div>
        <Textarea
          value={messageDraft}
          onChange={(e) => onMessageDraftChange(e.target.value)}
          rows={4}
          placeholder="Type a message…"
          style={{ background: colors.surface2, borderColor: colors.border, color: colors.text }}
        />
        <div style={{ display: 'flex', gap: spacing[8], marginTop: spacing[8] }}>
          <Button type="button" variant="primary" size="sm" disabled={sendingMessage} onClick={onSendMessage}>
            {sendingMessage ? 'Sending…' : 'Send'}
          </Button>
          {onOpenFullThread ? (
            <Button type="button" variant="ghost" size="sm" onClick={onOpenFullThread}>
              Open thread
            </Button>
          ) : null}
        </div>
      </div>
      {rightPanel}
    </div>
  );

  const leftWrap = (
    <aside
      style={{
        borderRadius: shell.cardRadius,
        border: `1px solid ${colors.border}`,
        background: colors.surface1,
        padding: spacing[14],
        position: isDesktopWeb ? 'sticky' : 'relative',
        top: isDesktopWeb ? spacing[16] : undefined,
        alignSelf: 'start',
        maxHeight: isDesktopWeb ? 'calc(100vh - 48px)' : undefined,
        overflowY: isDesktopWeb ? 'auto' : 'visible',
      }}
    >
      <p style={sectionLabelStyle()}>Timeline</p>
      {leftColumn}
    </aside>
  );

  const centerWrap = (
    <div id="os-center-scroll" style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: spacing[16] }}>
      {children}
    </div>
  );

  const rightWrap = (
    <aside
      id={rightRailId}
      style={{
        position: isDesktopWeb ? 'sticky' : 'relative',
        top: isDesktopWeb ? spacing[16] : undefined,
        maxHeight: isDesktopWeb ? 'calc(100vh - 48px)' : undefined,
        overflowY: isDesktopWeb ? 'auto' : 'visible',
        borderRadius: shell.cardRadius,
        border: `1px solid ${colors.border}`,
        background: colors.surface1,
        padding: spacing[16],
        boxShadow: isDesktopWeb ? shadows.glow : undefined,
      }}
    >
      {railInner}
    </aside>
  );

  if (isDesktopWeb) {
    return (
      <div style={{ width: '100%' }}>
        {headerBlock}
        {summaryBlock}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(220px, 260px) minmax(0, 1fr) minmax(260px, 300px)',
            gap: spacing[20],
            alignItems: 'start',
          }}
        >
          {leftWrap}
          {centerWrap}
          {rightWrap}
        </div>
      </div>
    );
  }

  return (
    <div style={{ width: '100%', paddingBottom: 'calc(88px + env(safe-area-inset-bottom, 0px))' }}>
      {headerBlock}
      {summaryBlock}
      {leftWrap}
      <div style={{ marginTop: spacing[16] }}>{centerWrap}</div>
      <div
        style={{
          position: 'fixed',
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 40,
          display: 'flex',
          gap: spacing[8],
          padding: `${spacing[10]}px 16px calc(${spacing[10]}px + env(safe-area-inset-bottom, 0px))`,
          background: colors.bg,
          borderTop: `1px solid ${colors.border}`,
        }}
      >
        <Button type="button" variant="secondary" className="flex-1" onClick={() => setDrawerOpen(true)}>
          <SlidersHorizontal size={16} style={{ marginRight: 6 }} />
          Actions
        </Button>
        <Button type="button" variant="primary" className="flex-1" onClick={() => setDrawerOpen(true)}>
          <MessageCircle size={16} style={{ marginRight: 6 }} />
          Message
        </Button>
      </div>
      {drawerOpen ? (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, background: colors.overlay }} role="presentation" onClick={() => setDrawerOpen(false)}>
          <div
            role="dialog"
            aria-modal="true"
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: 0,
              maxHeight: '90vh',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              background: colors.surface1,
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              border: `1px solid ${colors.border}`,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: spacing[14], borderBottom: `1px solid ${colors.border}` }}>
              <p style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Actions & messaging</p>
              <button type="button" aria-label="Close" onClick={() => setDrawerOpen(false)} style={{ border: 'none', background: 'transparent', color: colors.text, cursor: 'pointer' }}>
                <X size={22} />
              </button>
            </div>
            <div style={{ overflowY: 'auto', padding: spacing[16], flex: 1 }}>{railInner}</div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
