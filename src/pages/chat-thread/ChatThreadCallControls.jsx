import React, { useCallback, useEffect } from 'react';
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

  // Phone + video live in the header (set above). The old duplicate "Call
  // options" strip below the header was redundant — the header video button
  // already starts an accepted call (onOpenAcceptedCall runs first), so this
  // component now only wires the header and renders nothing inline.
  return null;
}

