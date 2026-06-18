import React, { memo } from 'react';
import { Reply, Smile } from 'lucide-react';
import QuickReplyChips from '@/components/chat/QuickReplyChips';
import VoiceNoteComposer from '@/components/messages/VoiceNoteComposer';
import { colors } from '@/ui/tokens';
import { COMPOSER_HEIGHT, QUICK_REPLIES } from '@/pages/chat-thread/chatThreadConstants';
import { formatReplyComposerLabel } from '@/pages/chat-thread/chatThreadModel';
import { lightHaptic } from '@/pages/chat-thread/chatThreadHaptics';

function ChatThreadComposerDockInner({
  keyboardInset,
  replyTo,
  onClearReply,
  showQuickReplies,
  onQuickReplySelect,
  isSending,
  sendText,
  handleSendVoice,
  clientId,
  onOpenAttachmentSheet,
  inputRef,
  input,
  onInputChange,
  pulseRemoteTypingIndicator,
  onOpenGifPicker,
  fileInputRef,
  onImageSelected,
  videoFileInputRef,
  onVideoSelected,
}) {
  return (
    <div
      className="chat-composer flex flex-col flex-shrink-0 w-full"
      style={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 0,
        paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 8px)',
        transform: `translateY(-${keyboardInset}px)`,
        zIndex: 40,
        paddingTop: 8,
        paddingLeft: `calc(12px + env(safe-area-inset-left, 0px))`,
        paddingRight: `calc(12px + env(safe-area-inset-right, 0px))`,
        background: colors.surface1,
        borderTop: `1px solid ${colors.border}`,
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
            Replying to {formatReplyComposerLabel(replyTo)}
          </span>
          <button
            type="button"
            onClick={onClearReply}
            className="text-[13px] font-medium flex-shrink-0 active:opacity-80"
            style={{ color: colors.muted }}
            aria-label="Cancel reply"
          >
            ×
          </button>
        </div>
      )}
      <QuickReplyChips
        options={QUICK_REPLIES}
        onSelect={(text) => {
          lightHaptic();
          onQuickReplySelect(text);
        }}
        visible={showQuickReplies}
      />
      <div className="flex items-center gap-2 w-full" style={{ minHeight: COMPOSER_HEIGHT - 20 }}>
        <div className="flex-1 min-w-0">
          <VoiceNoteComposer
            disabled={isSending}
            onSendText={sendText}
            onSendVoice={handleSendVoice}
            placeholder="Message..."
            clientId={clientId}
            onAttach={() => {
              lightHaptic();
              onOpenAttachmentSheet();
            }}
            inputRef={inputRef}
            value={input}
            onChange={(v) => {
              onInputChange(v);
              pulseRemoteTypingIndicator();
            }}
          />
        </div>
        <button
          type="button"
          onClick={() => {
            lightHaptic();
            onOpenGifPicker();
          }}
          style={{
            flexShrink: 0,
            width: 44,
            height: 44,
            borderRadius: 999,
            border: `1px solid ${colors.border}`,
            background: colors.surface2,
            color: colors.muted,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          aria-label="Open GIF picker"
        >
          <Smile size={18} />
        </button>
      </div>
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={onImageSelected} />
      <input ref={videoFileInputRef} type="file" accept="video/mp4,video/quicktime,video/webm" className="hidden" onChange={onVideoSelected} />
    </div>
  );
}

export default memo(ChatThreadComposerDockInner);
