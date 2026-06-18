import { useEffect } from 'react';

const DEFAULT_TITLE = 'Atlas Performance Labs — Competition Prep Coaching Software';
const DEFAULT_DESCRIPTION =
  'The coaching platform built for competition prep. Manage peak week, programs, nutrition, check-ins and client messaging in one place.';
const DEFAULT_OG_IMAGE = 'https://atlasperformancelabs.co.uk/og-image.png';
const DEFAULT_CANONICAL = 'https://atlasperformancelabs.co.uk/';
const DEFAULT_TWITTER_IMAGE_ALT = 'Atlas Performance Labs';

/**
 * Client-side document meta for marketing (and similar) routes.
 * Restores index.html defaults on unmount so SPA navigations do not leak titles.
 * When all props are empty, still registers cleanup so a prior effect’s coach/marketing meta resets.
 */
export function usePageMeta({ title, description, ogImage, canonical, twitterImageAlt } = {}) {
  useEffect(() => {
    if (!title && !description && !ogImage && !canonical && !twitterImageAlt) {
      return () => {
        document.title = DEFAULT_TITLE;
        document.querySelector('meta[name="description"]')?.setAttribute('content', DEFAULT_DESCRIPTION);
        document.querySelector('meta[property="og:title"]')?.setAttribute('content', DEFAULT_TITLE);
        document.querySelector('meta[property="og:description"]')?.setAttribute('content', DEFAULT_DESCRIPTION);
        document.querySelector('meta[name="twitter:title"]')?.setAttribute('content', DEFAULT_TITLE);
        document.querySelector('meta[name="twitter:description"]')?.setAttribute('content', DEFAULT_DESCRIPTION);
        document.querySelector('meta[property="og:image"]')?.setAttribute('content', DEFAULT_OG_IMAGE);
        document.querySelector('meta[name="twitter:image"]')?.setAttribute('content', DEFAULT_OG_IMAGE);
        document.querySelector('meta[name="twitter:image:alt"]')?.setAttribute('content', DEFAULT_TWITTER_IMAGE_ALT);
        document.querySelector('link[rel="canonical"]')?.setAttribute('href', DEFAULT_CANONICAL);
        document.querySelector('meta[property="og:url"]')?.setAttribute('content', DEFAULT_CANONICAL);
      };
    }

    const pageTitle = title ? `${title} — Atlas Performance Labs` : null;

    if (pageTitle) document.title = pageTitle;

    const descEl = document.querySelector('meta[name="description"]');
    if (descEl && description) descEl.setAttribute('content', description);

    const ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle && pageTitle) ogTitle.setAttribute('content', pageTitle);

    const ogDesc = document.querySelector('meta[property="og:description"]');
    if (ogDesc && description) ogDesc.setAttribute('content', description);

    const twTitle = document.querySelector('meta[name="twitter:title"]');
    if (twTitle && pageTitle) twTitle.setAttribute('content', pageTitle);

    const twDesc = document.querySelector('meta[name="twitter:description"]');
    if (twDesc && description) twDesc.setAttribute('content', description);

    if (ogImage) {
      const ogImg = document.querySelector('meta[property="og:image"]');
      if (ogImg) ogImg.setAttribute('content', ogImage);
      const twImg = document.querySelector('meta[name="twitter:image"]');
      if (twImg) twImg.setAttribute('content', ogImage);
    }

    const twImgAltEl = document.querySelector('meta[name="twitter:image:alt"]');
    if (twImgAltEl && twitterImageAlt) twImgAltEl.setAttribute('content', twitterImageAlt);

    if (canonical) {
      let link = document.querySelector('link[rel="canonical"]');
      if (!link) {
        link = document.createElement('link');
        link.rel = 'canonical';
        document.head.appendChild(link);
      }
      link.href = canonical;
      const ogUrl = document.querySelector('meta[property="og:url"]');
      if (ogUrl) ogUrl.setAttribute('content', canonical);
    }

    return () => {
      document.title = DEFAULT_TITLE;
      document.querySelector('meta[name="description"]')?.setAttribute('content', DEFAULT_DESCRIPTION);
      document.querySelector('meta[property="og:title"]')?.setAttribute('content', DEFAULT_TITLE);
      document.querySelector('meta[property="og:description"]')?.setAttribute('content', DEFAULT_DESCRIPTION);
      document.querySelector('meta[name="twitter:title"]')?.setAttribute('content', DEFAULT_TITLE);
      document.querySelector('meta[name="twitter:description"]')?.setAttribute('content', DEFAULT_DESCRIPTION);
      if (ogImage) {
        document.querySelector('meta[property="og:image"]')?.setAttribute('content', DEFAULT_OG_IMAGE);
        document.querySelector('meta[name="twitter:image"]')?.setAttribute('content', DEFAULT_OG_IMAGE);
      }
      if (twitterImageAlt) {
        document.querySelector('meta[name="twitter:image:alt"]')?.setAttribute('content', DEFAULT_TWITTER_IMAGE_ALT);
      }
      if (canonical) {
        document.querySelector('link[rel="canonical"]')?.setAttribute('href', DEFAULT_CANONICAL);
        document.querySelector('meta[property="og:url"]')?.setAttribute('content', DEFAULT_CANONICAL);
      }
    };
  }, [title, description, ogImage, canonical, twitterImageAlt]);
}
