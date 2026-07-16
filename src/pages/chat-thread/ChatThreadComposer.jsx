import React from 'react';
import { Smile, Pencil, Reply } from 'lucide-react';
import VoiceNoteComposer from '@/components/messages/VoiceNoteComposer';
import QuickReplyChips from '@/components/chat/QuickReplyChips';
import { AttachmentActionSheet } from '@/pages/chat-thread/chatThreadUiPrimitives';
import { colors } from '@/ui/tokens';

export default function ChatThreadComposer({
  isDesktopWeb,
  keyboardInset,
  composerHeight,
  desktopSidebarWidth,
  borderColor,
  quickReplies,
  showQuickReplies,
  inputRef,
  input,
  isSending,
  clientId,
  onInputChange,
  onSendText,
  onSendVoice,
  onOpenAttachment,
  onOpenGifPicker,
  editingMessage,
  replyTo,
  onCancelEdit,
  onCancelReply,
  onQuickReply,
  fileInputRef,
  onImageSelected,
  videoFileInputRef,
  onVideoSelected,
  showAttachmentSheet,
  onAttachmentPhoto,
  onAttachmentCamera,
  onAttachmentVideo,
  onAttachmentCancel,
}) {
  return (
    <>
      <div
        className="chat-composer flex flex-col flex-shrink-0 w-full"
        style={{
          position: 'fixed',
          left: isDesktopWeb ? `calc(${desktopSidebarWidth}px + env(safe-area-inset-left, 0px))` : 0,
          right: 0,
          bottom: 0,
          // The bottom inset clears the home indicator — but an open keyboard
          // already covers it, and the bar is lifted by translateY on top of
          // that, so keeping the inset left a dead ~34px band between the
          // message bar and the keyboard.
          paddingBottom: keyboardInset > 0 ? 8 : 'calc(env(safe-area-inset-bottom, 0px) + 8px)',
          transform: `translateY(-${keyboardInset}px)`,
          zIndex: 40,
          paddingTop: 8,
          paddingLeft: 'calc(12px + env(safe-area-inset-left, 0px))',
          paddingRight: 'calc(12px + env(safe-area-inset-right, 0px))',
          background: colors.surface1,
          borderTop: `1px solid ${borderColor}`,
        }}
      >
        {editingMessage ? (
          <div
            className="flex items-center gap-2 py-2 px-3 rounded-xl mb-2"
            style={{ background: colors.surface2, border: `1px solid ${colors.border}` }}
          >
            <Pencil size={14} style={{ color: colors.muted, flexShrink: 0 }} />
            <span className="text-[13px] truncate flex-1 min-w-0" style={{ color: colors.muted }}>
              Editing message
            </span>
            <button
              type="button"
              onClick={onCancelEdit}
              className="text-[13px] font-medium flex-shrink-0 active:opacity-80"
              style={{ color: colors.muted }}
              aria-label="Cancel edit"
            >
              ×
            </button>
          </div>
        ) : null}

        {replyTo && !editingMessage ? (
          <div
            className="flex items-center gap-2 py-2 px-3 rounded-xl mb-2"
            style={{ background: colors.surface2, border: `1px solid ${colors.border}` }}
          >
            <Reply size={14} style={{ color: colors.muted, flexShrink: 0 }} />
            <span className="text-[13px] truncate flex-1 min-w-0" style={{ color: colors.muted }}>
              Replying to {replyTo.body ? (replyTo.body.length > 40 ? `${replyTo.body.slice(0, 40)}…` : replyTo.body) : 'message'}
            </span>
            <button
              type="button"
              onClick={onCancelReply}
              className="text-[13px] font-medium flex-shrink-0 active:opacity-80"
              style={{ color: colors.muted }}
              aria-label="Cancel reply"
            >
              ×
            </button>
          </div>
        ) : null}

        <QuickReplyChips options={quickReplies} onSelect={onQuickReply} visible={showQuickReplies} />

        <div className="flex items-center gap-2 w-full" style={{ minHeight: composerHeight - 20 }}>
          <div className="flex-1 min-w-0">
            <VoiceNoteComposer
              disabled={isSending}
              onSendText={onSendText}
              onSendVoice={onSendVoice}
              placeholder="Message..."
              clientId={clientId}
              onAttach={onOpenAttachment}
              inputRef={inputRef}
              value={input}
              onChange={onInputChange}
            />
          </div>
          <button
            type="button"
            onClick={onOpenGifPicker}
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

      {showAttachmentSheet && (
        <AttachmentActionSheet
          onPhoto={onAttachmentPhoto}
          onCamera={onAttachmentCamera}
          onVideo={onAttachmentVideo}
          onCancel={onAttachmentCancel}
          bg={colors.bg}
          border={borderColor}
        />
      )}
    </>
  );
}

