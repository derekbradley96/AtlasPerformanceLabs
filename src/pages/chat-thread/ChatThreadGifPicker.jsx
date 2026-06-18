import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { colors } from '@/ui/tokens';
import { GIPHY_KEY } from '@/pages/chat-thread/chatThreadConstants';

/**
 * Giphy search + grid. Fetch runs only while `open` is true (avoids work when closed).
 */
export default function ChatThreadGifPicker({ open, onClose, onSelectGif }) {
  const [gifSearch, setGifSearch] = useState('');
  const [gifResults, setGifResults] = useState([]);

  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;
    const run = async () => {
      const query = gifSearch.trim();
      const endpoint = query
        ? `https://api.giphy.com/v1/gifs/search?api_key=${encodeURIComponent(GIPHY_KEY)}&q=${encodeURIComponent(query)}&limit=16&rating=pg`
        : `https://api.giphy.com/v1/gifs/trending?api_key=${encodeURIComponent(GIPHY_KEY)}&limit=16&rating=pg`;
      try {
        const res = await fetch(endpoint);
        const json = await res.json();
        if (!cancelled) setGifResults(Array.isArray(json?.data) ? json.data : []);
      } catch (_) {
        if (!cancelled) setGifResults([]);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [open, gifSearch]);

  useEffect(() => {
    if (!open) setGifSearch('');
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40" style={{ background: colors.overlay }}>
      <div className="absolute inset-x-3 top-8 bottom-8 rounded-2xl border flex flex-col" style={{ background: colors.bg, borderColor: colors.border }}>
        <div className="flex items-center gap-2 p-3 border-b" style={{ borderColor: colors.border }}>
          <input
            value={gifSearch}
            onChange={(e) => setGifSearch(e.target.value)}
            placeholder="Search GIFs"
            style={{
              flex: 1,
              borderRadius: 10,
              border: `1px solid ${colors.border}`,
              background: colors.surface1,
              color: colors.text,
              padding: '8px 10px',
            }}
          />
          <button type="button" onClick={onClose} style={{ border: 'none', background: 'transparent', color: colors.muted }}>
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-3 grid grid-cols-2 gap-2">
          {gifResults.map((g) => {
            const url = g?.images?.fixed_width?.url || g?.images?.downsized?.url;
            if (!url) return null;
            return (
              <button key={g.id} type="button" onClick={() => onSelectGif(url)} style={{ border: 'none', padding: 0, background: 'transparent' }}>
                <img src={url} alt={g?.title || 'gif'} style={{ width: '100%', height: 120, objectFit: 'cover', borderRadius: 10 }} />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
