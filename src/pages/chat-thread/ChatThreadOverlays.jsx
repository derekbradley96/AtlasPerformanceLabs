import React from 'react';
import { X } from 'lucide-react';
import { colors } from '@/ui/tokens';

export default function ChatThreadOverlays({
  showGifPicker,
  gifSearch,
  setGifSearch,
  setShowGifPicker,
  gifResults,
  handleSendGif,
  mediaPreview,
  setMediaPreview,
}) {
  return (
    <>
      {showGifPicker && (
        <div className="fixed inset-0 z-40" style={{ background: colors.overlay }}>
          <div className="absolute inset-x-3 top-8 bottom-8 rounded-2xl border flex flex-col" style={{ background: colors.bg, borderColor: colors.border }}>
            <div className="flex items-center gap-2 p-3 border-b" style={{ borderColor: colors.border }}>
              <input
                value={gifSearch}
                onChange={(e) => setGifSearch(e.target.value)}
                placeholder="Search GIFs"
                style={{ flex: 1, borderRadius: 10, border: `1px solid ${colors.border}`, background: colors.surface1, color: colors.text, padding: '8px 10px' }}
              />
              <button type="button" onClick={() => setShowGifPicker(false)} style={{ border: 'none', background: 'transparent', color: colors.muted }}>
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-3 grid grid-cols-2 gap-2">
              {gifResults.map((g) => {
                const url = g?.images?.fixed_width?.url || g?.images?.downsized?.url;
                if (!url) return null;
                return (
                  <button key={g.id} type="button" onClick={() => handleSendGif(url)} style={{ border: 'none', padding: 0, background: 'transparent' }}>
                    <img src={url} alt={g?.title || 'gif'} style={{ width: '100%', height: 120, objectFit: 'cover', borderRadius: 10 }} />
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {mediaPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.9)' }} onClick={() => setMediaPreview(null)}>
          <img src={mediaPreview} alt="" style={{ maxWidth: '94vw', maxHeight: '92vh', objectFit: 'contain' }} />
        </div>
      )}
    </>
  );
}

