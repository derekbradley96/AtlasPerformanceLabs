/**
 * Standard empty state: card, icon container, title, muted description, optional CTA.
 * Same treatment across Coach, Client, Personal (no workouts, no messages, no clients, etc.).
 */
import React from 'react';
import { colors, spacing, shell } from '@/ui/tokens';
import Button from '@/ui/Button';

const EMPTY_ICON_SIZE = 48;
const EMPTY_ICON_CONTAINER_SIZE = 56;

export default function EmptyState({
  title,
  description,
  subtext,
  icon: Icon,
  actionLabel,
  onAction,
  action,
  className = '',
}) {
  const text = description ?? subtext ?? null;

  return (
    <div
      className={`flex flex-col items-center justify-center text-center ${className}`}
      style={{
        padding: spacing[32],
        minHeight: 200,
        background: colors.card,
        border: `1px solid ${shell.cardBorder}`,
        borderRadius: shell.cardRadius,
        boxShadow: shell.cardShadow,
      }}
    >
      {Icon && (
        <div
          style={{
            width: EMPTY_ICON_CONTAINER_SIZE,
            height: EMPTY_ICON_CONTAINER_SIZE,
            borderRadius: shell.iconContainerRadius,
            background: colors.primarySubtle,
            color: colors.primary,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: spacing[16],
          }}
        >
          <Icon size={28} strokeWidth={1.5} />
        </div>
      )}
      <p
        className="text-[17px] font-semibold"
        style={{ color: colors.text, margin: 0, marginBottom: spacing[8] }}
      >
        {title}
      </p>
      {text && (
        <p
          className="text-[14px] max-w-[280px]"
          style={{ color: colors.muted, margin: 0, marginBottom: spacing[20] }}
        >
          {text}
        </p>
      )}
      {action != null ? (
        <div style={{ marginTop: text ? 0 : spacing[12] }}>{action}</div>
      ) : actionLabel && onAction ? (
        <Button variant="primary" onClick={onAction}>
          {actionLabel}
        </Button>
      ) : null}
    </div>
  );
}
