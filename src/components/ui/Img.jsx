import React, { useEffect, useState } from 'react';

/**
 * <img> that degrades instead of showing a broken-image icon.
 *
 * Most image sources here are Supabase signed URLs (avatars, coach logos,
 * progress photos, result stories) and those expire — 32 of the 49 files using
 * <img> had no onError at all, so an expired or dead URL rendered as the browser's
 * broken-image glyph in the middle of the UI. This falls back to whatever the
 * caller would have shown had there been no image (initials, an icon), which is
 * always nicer than a broken graphic.
 *
 * @param {string} [src]
 * @param {string} alt Required for anything meaningful; pass "" for decorative.
 * @param {React.ReactNode} [fallback] Rendered when src is missing or fails.
 */
export default function Img({ src, alt = '', fallback = null, ...rest }) {
  const [failed, setFailed] = useState(false);

  // A new src deserves a fresh attempt — otherwise one bad URL would
  // permanently poison the slot (e.g. after re-uploading an avatar).
  useEffect(() => {
    setFailed(false);
  }, [src]);

  if (!src || failed) return fallback;

  return <img src={src} alt={alt} onError={() => setFailed(true)} {...rest} />;
}
