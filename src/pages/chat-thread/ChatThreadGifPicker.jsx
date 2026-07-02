import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { colors } from '@/ui/tokens';
import { GIPHY_KEY } from '@/pages/chat-thread/chatThreadConstants';

/**
 * Giphy search + grid. Fetch runs only while `open` is true (avoids work when closed).
 * Surfaces a setup message when the GIPHY key is missing/banned instead of an empty grid.
 */
export default function ChatThreadGifPicker({ open, onClose, onSelectGif }) {
  const [gifSearch, setGifSearch] = useState('');
  const [gifResults, setGifResults] = useState([]);
  const [gifStatus, setGifStatus] = useState('idle'); // idle | loading | ready | unavailable

  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;
    setGifStatus('loading');
    const run = async () => {
      const query = gifSearch.trim();
      const endpoint = query
        ? `https://api.giphy.com/v1/gifs/search?api_key=${encodeURIComponent(GIPHY_KEY)}&q=${encodeURIComponent(query)}&limit=16&rating=pg`
        : `https://api.giphy.com/v1/gifs/trending?api_key=${encodeURIComponent(GIPHY_KEY)}&limit=16&rating=pg`;
      try {
        const res = await fetch(endpoint);
        const json = await res.json();
        if (cancelled) return;
        if (!res.ok || Number(json?.meta?.status) >= 400) {
          setGifResults([]);
          setGifStatus('unavailable');
          return;
        }
        setGifResults(Array.isArray(json?.data) ? json.data : []);
        setGifStatus('ready');
      } catch (_) {
        if (!cancelled) {
          setGifResults([]);
          setGifStatus('unavailable');
        }
      }
    };
    const t = setTimeout(run, gifSearch.trim() ? 350 : 0);
    return () => {
      cancelled = true;
      clearTimeout(t);
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
        {gifStatus === 'unavailable' ? (
          <div className="flex-1 flex items-center justify-center p-6 text-center">
            <p style={{ color: colors.muted, fontSize: 13, maxWidth: 280 }}>
              GIF search is unavailable right now. Try again in a moment.
            </p>
          </div>
        ) : gifStatus === 'ready' && gifResults.length === 0 ? (
          <div className="flex-1 flex items-center justify-center p-6 text-center">
            <p style={{ color: colors.muted, fontSize: 13 }}>No GIFs found — try another search.</p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-3 grid grid-cols-2 gap-2">
            {gifStatus === 'loading' && gifResults.length === 0
              ? [0, 1, 2, 3].map((i) => (
                  <div key={i} style={{ height: 120, borderRadius: 10, background: colors.surface1, opacity: 0.6 }} />
                ))
              : gifResults.map((g) => {
                  const url = g?.images?.fixed_width?.url || g?.images?.downsized?.url;
                  if (!url) return null;
                  return (
                    <button key={g.id} type="button" onClick={() => onSelectGif(url)} style={{ border: 'none', padding: 0, background: 'transparent' }}>
                      <img src={url} alt={g?.title || 'gif'} style={{ width: '100%', height: 120, objectFit: 'cover', borderRadius: 10 }} />
                    </button>
                  );
                })}
          </div>
        )}
        <p style={{ margin: 0, padding: '6px 12px', fontSize: 10, color: colors.muted, textAlign: 'center' }}>Powered by GIPHY</p>
      </div>
    </div>
  );
}
