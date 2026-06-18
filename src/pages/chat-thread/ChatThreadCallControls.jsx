import React, { useCallback, useEffect, useMemo } from 'react';
import { Phone, Video } from 'lucide-react';
import { toast } from 'sonner';
import { colors } from '@/ui/tokens';

export default function ChatThreadCallControls({
  client,
  isClientView,
  latestCallRequest,
  setHeaderRight,
  onLightHaptic,
  onOpenAcceptedCall,
  onStartChatVideoCall,
  onOpenCallRequests,
  onOpenCallPrep,
}) {
  const handlePhoneAction = useCallback(async () => {
    await onLightHaptic();
    if (latestCallRequest?.status === 'accepted' && latestCallRequest?.call_type === 'phone') {
      toast.message('Phone call accepted. Start from your phone now.');
      return;
    }
    if (isClientView) {
      onOpenCallRequests();
      return;
    }
    onOpenCallPrep();
  }, [onLightHaptic, latestCallRequest, isClientView, onOpenCallRequests, onOpenCallPrep]);

  const handleVideoAction = useCallback(async () => {
    await onLightHaptic();
    const started = onOpenAcceptedCall();
    if (started) return;
    if (isClientView) {
      onOpenCallRequests();
      return;
    }
    const created = await onStartChatVideoCall();
    if (created) return;
    onOpenCallPrep();
  }, [onLightHaptic, onOpenAcceptedCall, isClientView, onOpenCallRequests, onStartChatVideoCall, onOpenCallPrep]);

  useEffect(() => {
    if (typeof setHeaderRight !== 'function' || !client) {
      if (typeof setHeaderRight === 'function') setHeaderRight(null);
      return () => {};
    }
    setHeaderRight(
      <div className="flex items-center gap-1" style={{ alignItems: 'center' }}>
        <button
          type="button"
          onClick={handlePhoneAction}
          className="p-2.5 rounded-lg active:opacity-70 transition-opacity"
          style={{ color: colors.text, background: 'transparent', border: 'none', minWidth: 44, minHeight: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          aria-label={isClientView ? 'Open call requests' : 'Call'}
        >
          <Phone size={20} strokeWidth={2} />
        </button>
        <button
          type="button"
          onClick={handleVideoAction}
          className="p-2.5 rounded-lg active:opacity-70 transition-opacity"
          style={{
            color: colors.text,
            background: 'transparent',
            border: 'none',
            minWidth: 44,
            minHeight: 44,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          aria-label="Video call"
        >
          <Video size={20} strokeWidth={2} />
        </button>
      </div>
    );
    return () => setHeaderRight(null);
  }, [setHeaderRight, client, isClientView, handlePhoneAction, handleVideoAction]);

  const canStartAcceptedVideoCall = useMemo(
    () => latestCallRequest?.status === 'accepted' && latestCallRequest?.call_type === 'video',
    [latestCallRequest],
  );

  return (
    <div
      className="mx-4 mt-2 mb-2 px-3 py-2 rounded-xl flex items-center justify-between gap-2"
      style={{
        background: colors.surface1,
        border: `1px solid ${colors.border}`,
      }}
    >
      <div style={{ minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 12, color: colors.muted }}>
          {canStartAcceptedVideoCall
            ? 'Call accepted - ready to start'
            : 'Call options'}
        </p>
      </div>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={handlePhoneAction}
          className="rounded-full active:opacity-80"
          style={{
            width: 36,
            height: 36,
            border: `1px solid ${colors.border}`,
            background: colors.surface2,
            color: colors.text,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          aria-label={isClientView ? 'Open call requests' : 'Call'}
          title={isClientView ? 'Open call requests' : 'Call'}
        >
          <Phone size={14} />
        </button>
        <button
          type="button"
          onClick={handleVideoAction}
          className="rounded-full active:opacity-80"
          style={{
            width: 36,
            height: 36,
            border: `1px solid ${colors.primary}`,
            background: canStartAcceptedVideoCall ? colors.primary : colors.primarySubtle,
            color: canStartAcceptedVideoCall ? '#fff' : colors.primary,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          aria-label={canStartAcceptedVideoCall ? 'Start call' : 'Video call'}
          title={canStartAcceptedVideoCall ? 'Start call' : 'Video call'}
        >
          <Video size={14} />
        </button>
      </div>
    </div>
  );
}

