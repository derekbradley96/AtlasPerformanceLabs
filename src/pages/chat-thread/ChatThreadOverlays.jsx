import React from 'react';
import ChatThreadGifPicker from '@/pages/chat-thread/ChatThreadGifPicker';

export default function ChatThreadOverlays({
  showGifPicker,
  setShowGifPicker,
  handleSendGif,
  mediaPreview,
  setMediaPreview,
}) {
  return (
    <>
      <ChatThreadGifPicker
        open={showGifPicker}
        onClose={() => setShowGifPicker(false)}
        onSelectGif={handleSendGif}
      />

      {mediaPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.9)' }} onClick={() => setMediaPreview(null)}>
          <img src={mediaPreview} alt="" style={{ maxWidth: '94vw', maxHeight: '92vh', objectFit: 'contain' }} />
        </div>
      )}
    </>
  );
}
