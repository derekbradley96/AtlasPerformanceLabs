import React from 'react';
import { MessageSquare } from 'lucide-react';
import TypingIndicator from '@/components/app/TypingIndicator';
import ChatBubble from '@/components/chat/ChatBubble';
import AudioMessage from '@/components/chat/AudioMessage';
import AudioBubble from '@/components/messages/AudioBubble';
import SummaryCardBubble from '@/components/chat/SummaryCardBubble';
import { DateSeparator, dateGroupLabel, getDaySeparatorLabel } from '@/pages/chat-thread/chatThreadUiPrimitives';
import { colors, spacing } from '@/ui/tokens';

function messageRequestsCheckin(message) {
  const body = String(message?.body || '').trim().toLowerCase();
  if (!body) return false;
  if (!/check[\s-]?in/.test(body) && !/\bcheckin\b/.test(body)) return false;
  if (/\b(submit|complete|finish|do|fill|today|due|reminder|weekly)\b/.test(body)) return true;
  return body.includes('check-in') || body.includes('check in') || body.includes('checkin');
}

export default function ChatThreadMessageList({
  allMessages,
  isClientView,
  client,
  remoteTyping,
  lastOutgoingMessage,
  lastOutgoingDelivery,
  currentThread,
  newMessageIds,
  replyPreviewById,
  isDesktopWeb,
  openMessageMenu,
  startMediaLongPress,
  cancelMediaLongPress,
  setMediaPreview,
  retryFailedMessage,
  handleSwipeReply,
  handleOpenCheckinFromMessage,
}) {
  return (
    <div
      style={{
        minHeight: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: allMessages.length === 0 && !remoteTyping ? 'center' : 'flex-start',
      }}
    >
      {allMessages.length === 0 && !remoteTyping ? (
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '32px 24px',
            textAlign: 'center',
            gap: 12,
          }}
        >
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: '50%',
              background: colors.primarySubtle,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <MessageSquare size={24} style={{ color: colors.primary }} />
          </div>
          <p style={{ fontSize: 17, fontWeight: 600, color: colors.text, margin: 0 }}>
            {isClientView ? 'Message your coach' : 'Start the conversation'}
          </p>
          <p
            style={{
              fontSize: 14,
              color: colors.muted,
              margin: 0,
              lineHeight: 1.5,
              maxWidth: 240,
            }}
          >
            {isClientView
              ? "Your coach will reply here. You'll get a notification."
              : `${client?.full_name || client?.name || 'Your client'} will see your message immediately.`}
          </p>
        </div>
      ) : (
        Array.isArray(allMessages) &&
        allMessages.map((m, idx) => {
          const isOutgoing = isClientView
            ? m?.sender === 'client'
            : m?.sender === 'coach' || m?.sender === 'trainer';
          const prev = allMessages[idx - 1];
          const prevDate = prev?.created_date ? dateGroupLabel(prev.created_date) : '';
          const thisDate = m?.created_date ? dateGroupLabel(m.created_date) : '';
          const daySeparatorLabel = getDaySeparatorLabel(m?.created_date);
          const showDateLabel = thisDate && thisDate !== prevDate;
          const isConsecutiveFromSameSender = prev != null && prev?.sender === m?.sender;
          const prevMs = prev?.created_date ? new Date(prev.created_date).getTime() : null;
          const currMs = m?.created_date ? new Date(m.created_date).getTime() : null;
          const showMessageTime = idx === 0 || !Number.isFinite(prevMs) || !Number.isFinite(currMs) || (currMs - prevMs) > 60000;
          const showClientCheckinCta =
            isClientView &&
            !isOutgoing &&
            messageRequestsCheckin(m) &&
            m?.type !== 'image' &&
            m?.type !== 'gif' &&
            m?.type !== 'video' &&
            m?.type !== 'voice' &&
            m?.type !== 'audio';
          const isLastOutgoingWithStatus =
            lastOutgoingMessage?.id === m?.id &&
            !!lastOutgoingDelivery.status &&
            m?.status !== 'failed';

          return (
            <React.Fragment key={m?.id ?? idx}>
              {showDateLabel && (
                <DateSeparator dateStr={daySeparatorLabel || thisDate} />
              )}
              {m?.summaryPayload ? (
                <div
                  onContextMenu={(e) => { e.preventDefault(); openMessageMenu(m, e); }}
                  onPointerDown={() => startMediaLongPress(m)}
                  onPointerUp={cancelMediaLongPress}
                  onPointerCancel={cancelMediaLongPress}
                  onPointerLeave={cancelMediaLongPress}
                >
                  <SummaryCardBubble message={m} isOutgoing={isOutgoing} />
                </div>
              ) : m?.type === 'voice' ? (
                <div
                  onContextMenu={(e) => { e.preventDefault(); openMessageMenu(m, e); }}
                  onPointerDown={() => startMediaLongPress(m)}
                  onPointerUp={cancelMediaLongPress}
                  onPointerCancel={cancelMediaLongPress}
                  onPointerLeave={cancelMediaLongPress}
                >
                  <AudioBubble
                    audioKey={m.audioKey}
                    mimeType={m.mimeType}
                    durationMs={m.durationMs ?? m.duration_ms}
                    isMine={isOutgoing}
                    mediaUrl={m.media_url}
                    messageId={m.id}
                  />
                </div>
              ) : m?.type === 'audio' ? (
                <div
                  onContextMenu={(e) => { e.preventDefault(); openMessageMenu(m, e); }}
                  onPointerDown={() => startMediaLongPress(m)}
                  onPointerUp={cancelMediaLongPress}
                  onPointerCancel={cancelMediaLongPress}
                  onPointerLeave={cancelMediaLongPress}
                >
                  <AudioMessage message={m} isOutgoing={isOutgoing} />
                </div>
              ) : (m?.type === 'image' || m?.type === 'gif' || m?.type === 'video') ? (
                <div className={`flex ${isOutgoing ? 'justify-end' : 'justify-start'}`} style={{ marginBottom: 10 }}>
                  <div style={{ maxWidth: '72%', position: 'relative' }}>
                    {m?.status === 'sending' ? (
                      <div
                        className="absolute inset-0 z-10 flex items-center justify-center rounded-[14px]"
                        style={{ background: 'rgba(0,0,0,0.45)' }}
                        aria-hidden
                      >
                        <span className="text-[12px] font-medium text-white">Sending…</span>
                      </div>
                    ) : null}
                    {m?.type === 'video' ? (
                      <video
                        src={m.media_url}
                        controls
                        playsInline
                        onContextMenu={(e) => { e.preventDefault(); openMessageMenu(m, e); }}
                        onPointerDown={() => startMediaLongPress(m)}
                        onPointerUp={cancelMediaLongPress}
                        onPointerCancel={cancelMediaLongPress}
                        onPointerLeave={cancelMediaLongPress}
                        style={{
                          width: '100%',
                          maxWidth: 280,
                          maxHeight: 200,
                          borderRadius: 12,
                          display: 'block',
                          background: '#000',
                          border: `1px solid ${colors.border}`,
                        }}
                      />
                    ) : (
                      <button
                        type="button"
                        onClick={() => setMediaPreview(m.media_url)}
                        onContextMenu={(e) => { e.preventDefault(); openMessageMenu(m, e); }}
                        onPointerDown={() => startMediaLongPress(m)}
                        onPointerUp={cancelMediaLongPress}
                        onPointerCancel={cancelMediaLongPress}
                        onPointerLeave={cancelMediaLongPress}
                        style={{ width: '100%', border: 'none', background: 'transparent', padding: 0 }}
                      >
                        <img
                          src={m.media_url}
                          alt=""
                          style={{
                            width: '100%',
                            maxHeight: 280,
                            objectFit: 'cover',
                            borderRadius: 14,
                            border: `1px solid ${colors.border}`,
                          }}
                        />
                      </button>
                    )}
                    {isOutgoing && m?.status === 'failed' ? (
                      <button
                        type="button"
                        onClick={() => retryFailedMessage(m)}
                        className="mt-2 text-[11px] font-semibold px-2 py-1 rounded-md"
                        style={{
                          border: `1px solid ${colors.border}`,
                          background: colors.surface1,
                          color: colors.text,
                        }}
                      >
                        Retry
                      </button>
                    ) : null}
                  </div>
                </div>
              ) : (
                <>
                  <ChatBubble
                    message={m}
                    isOutgoing={isOutgoing}
                    isNew={newMessageIds.has(m?.id)}
                    isConsecutiveFromSameSender={isConsecutiveFromSameSender}
                    replyPreview={replyPreviewById.get(m?.id) || ''}
                    onLongPress={openMessageMenu}
                    onSwipeReply={handleSwipeReply}
                    enableSwipeReply={!isDesktopWeb}
                    isDesktopWeb={isDesktopWeb}
                    canRetry={isOutgoing && m?.status === 'failed'}
                    onRetry={retryFailedMessage}
                    variant={isClientView ? 'client-thread' : 'default'}
                  />
                  {showClientCheckinCta ? (
                    <div className="flex justify-start" style={{ marginTop: -4, marginBottom: 8 }}>
                      <button
                        type="button"
                        onClick={handleOpenCheckinFromMessage}
                        style={{
                          fontSize: 12,
                          fontWeight: 600,
                          color: colors.primary,
                          border: `1px solid ${colors.primary}`,
                          borderRadius: 999,
                          background: 'transparent',
                          padding: '6px 12px',
                        }}
                      >
                        Submit check-in
                      </button>
                    </div>
                  ) : null}
                </>
              )}
              {showMessageTime && m?.created_date ? (
                <p
                  style={{
                    fontSize: 10,
                    color: colors.muted,
                    textAlign: isOutgoing ? 'right' : 'left',
                    margin: isOutgoing ? `2px ${spacing[4]}px 8px 0` : `2px 0 8px ${spacing[4]}px`,
                  }}
                >
                  {new Date(m.created_date).toLocaleTimeString('en-GB', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              ) : null}
              {!isClientView && isLastOutgoingWithStatus && !m?.summaryPayload && lastOutgoingMessage ? (
                <div className="flex justify-end" style={{ marginTop: -4, marginBottom: 4, paddingRight: 6 }}>
                  <span
                    style={{
                      fontSize: 11,
                      color: currentThread?.client_last_read_at &&
                        new Date(currentThread.client_last_read_at) >
                        new Date(lastOutgoingMessage.created_date)
                        ? colors.primary
                        : 'rgba(255,255,255,0.45)',
                      letterSpacing: -1,
                      fontWeight: 500,
                    }}
                  >
                    {currentThread?.client_last_read_at &&
                      new Date(currentThread.client_last_read_at) >
                      new Date(lastOutgoingMessage.created_date)
                      ? '✓✓'
                      : '✓'}
                  </span>
                </div>
              ) : null}
            </React.Fragment>
          );
        })
      )}
      {remoteTyping && (
        <div className="flex justify-start" style={{ marginBottom: 8 }}>
          <TypingIndicator
            label={isClientView ? 'Your coach' : (client?.full_name || client?.name || 'Client')}
          />
        </div>
      )}
    </div>
  );
}

