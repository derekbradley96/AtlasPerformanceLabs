/**
 * Anchored bottom composer: attach | input pill | send.
 * Send disabled until non-whitespace input or attachment; shows "Sending…" when sending.
 */
import React, { useRef, useCallback } from 'react';
import { Send, Paperclip, Reply, Loader2 } from 'lucide-react';
import { colors, touchTargetMin, radii } from '@/ui/tokens';

async function lightHaptic() {
  try {
    const { Capacitor } = await import('@capacitor/core');
    const { Haptics, ImpactStyle } = await import('@capacitor/haptics');
    if (Capacitor.isNativePlatform()) await Haptics.impact({ style: ImpactStyle.Light });
    else if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(10);
  } catch (_) {}
}

const COMPOSER_PADDING_V = 10;
const COMPOSER_PADDING_H = 12;
const INPUT_HEIGHT = 44;

export default function ChatInputBar({
  value = '',
  onChange,
  onSend,
  onAttach,
  replyTo,
  onClearReply,
  inputRef: externalInputRef,
  keyboardOffset = 0,
  placeholder = 'Message...',
  hasAttachment = false,
  isSending = false,
}) {
  const internalInputRef = useRef(null);
  const inputRef = externalInputRef ?? internalInputRef;
  const trimmed = typeof value === 'string' ? value.trim() : '';
  const canSend = (trimmed.length > 0 || hasAttachment) && !isSending;

  const handleSend = useCallback(() => {
    if (!trimmed && !hasAttachment) return;
    if (isSending) return;
    lightHaptic();
    if (typeof onSend === 'function') onSend();
  }, [trimmed, hasAttachment, isSending, onSend]);

  return (
    <div
      className="chat-input-bar flex flex-col w-full"
      style={{
        paddingTop: COMPOSER_PADDING_V,
        paddingBottom: `calc(${COMPOSER_PADDING_V}px + env(safe-area-inset-bottom, 0px)${keyboardOffset > 0 ? ` + ${keyboardOffset}px` : ''})`,
        paddingLeft: COMPOSER_PADDING_H,
        paddingRight: COMPOSER_PADDING_H,
        background: 'transparent',
        transform: keyboardOffset > 0 ? `translateY(-${keyboardOffset}px)` : undefined,
      }}
    >
      {replyTo && (
        <div
          className="flex items-center gap-2 py-2 px-3 rounded-xl mb-2"
          style={{
            background: colors.surface2,
            border: `1px solid ${colors.border}`,
          }}
        >
          <Reply size={14} style={{ color: colors.muted, flexShrink: 0 }} />
          <span className="text-[13px] truncate flex-1 min-w-0" style={{ color: colors.muted }}>
            {replyTo.body ?? ''}
          </span>
          <button
            type="button"
            onClick={onClearReply}
            className="text-[13px] font-medium flex-shrink-0 active:opacity-80"
            style={{ color: colors.muted }}
          >
            Cancel
          </button>
        </div>
      )}
      <div
        className="flex items-center gap-2"
        style={{
          minHeight: touchTargetMin,
          height: INPUT_HEIGHT,
          paddingLeft: 6,
          paddingRight: 6,
          background: colors.surface2,
          borderRadius: radii.full,
        }}
      >
        <button
          type="button"
          onClick={() => typeof onAttach === 'function' && onAttach()}
          className="flex items-center justify-center flex-shrink-0 active:opacity-90 transition-opacity"
          style={{
            width: 36,
            height: 36,
            color: '#fff',
            background: colors.primary,
            border: 'none',
            borderRadius: radii.full,
          }}
          aria-label="Attach file"
        >
          <Paperclip size={18} strokeWidth={2} />
        </button>
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => typeof onChange === 'function' && onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder={placeholder}
          className="flex-1 min-w-0 placeholder:opacity-60 focus:outline-none"
          style={{
            height: 28,
            lineHeight: '20px',
            fontSize: 15,
            color: colors.text,
            background: 'transparent',
            border: 'none',
            paddingLeft: 8,
            paddingRight: 8,
            paddingTop: 4,
            paddingBottom: 4,
          }}
        />
        <button
          type="button"
          onClick={handleSend}
          disabled={!canSend}
          className="flex items-center justify-center flex-shrink-0 active:opacity-90 transition-opacity disabled:opacity-50"
          style={{
            width: 36,
            height: 36,
            borderRadius: radii.full,
            background: canSend ? colors.primary : 'transparent',
            border: 'none',
            color: canSend ? '#fff' : colors.muted,
          }}
          aria-label={isSending ? 'Sending' : 'Send'}
        >
          {isSending ? (
            <Loader2 size={18} className="animate-spin" style={{ color: 'inherit' }} />
          ) : (
            <Send size={20} strokeWidth={2} style={{ color: 'inherit' }} />
          )}
        </button>
      </div>
    </div>
  );
}
