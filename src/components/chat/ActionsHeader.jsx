/**
 * Collapsible "Actions" block for chat: collapsed shows status line; expand shows 3 buttons.
 * Renders inside the message list (no overlap).
 */
import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Calendar, User, CreditCard } from 'lucide-react';
import { colors } from '@/ui/tokens';

const BORDER = 'rgba(255,255,255,0.06)';

export default function ActionsHeader({
  nextCheckInDue = '—',
  paymentStatus = 'Pending',
  onRequestCheckIn,
  onViewClient,
  onPaymentReminder,
  defaultCollapsed = true,
}) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  return (
    <div
      className="rounded-2xl overflow-hidden mb-3"
      style={{
        background: 'rgba(30, 41, 59, 0.5)',
        border: `1px solid ${BORDER}`,
      }}
    >
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left active:opacity-90"
        style={{ color: colors.text }}
      >
        <span className="text-[13px] font-medium">Actions</span>
        <span className="text-[12px] truncate flex-1 min-w-0" style={{ color: colors.muted }}>
          Check-in due: {nextCheckInDue} | {paymentStatus}
        </span>
        {collapsed ? (
          <ChevronDown size={18} style={{ color: colors.muted, flexShrink: 0 }} />
        ) : (
          <ChevronUp size={18} style={{ color: colors.muted, flexShrink: 0 }} />
        )}
      </button>
      {!collapsed && (
        <div
          className="flex border-t gap-2 px-2 py-2"
          style={{ borderColor: BORDER }}
        >
          <button
            type="button"
            onClick={() => typeof onRequestCheckIn === 'function' && onRequestCheckIn()}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[13px] font-medium active:opacity-80"
            style={{ color: colors.text, background: 'rgba(255,255,255,0.06)' }}
          >
            <Calendar size={14} /> Request check-in
          </button>
          <button
            type="button"
            onClick={() => typeof onViewClient === 'function' && onViewClient()}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[13px] font-medium active:opacity-80"
            style={{ color: colors.text, background: 'rgba(255,255,255,0.06)' }}
          >
            <User size={14} /> View client
          </button>
          <button
            type="button"
            onClick={() => typeof onPaymentReminder === 'function' && onPaymentReminder()}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[13px] font-medium active:opacity-80"
            style={{ color: colors.text, background: 'rgba(255,255,255,0.06)' }}
          >
            <CreditCard size={14} /> Payment reminder
          </button>
        </div>
      )}
    </div>
  );
}
