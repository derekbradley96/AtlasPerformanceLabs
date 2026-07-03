/**
 * Listens for Capacitor appUrlOpen (deep link) and routes the SPA to the URL path.
 * Handles both cold start (getLaunchUrl) and app-in-background (appUrlOpen).
 * When user taps capacitor://localhost/auth/callback#access_token=...,
 * we navigate to /auth/callback and preserve search + hash so AuthCallback can read tokens.
 *
 * With HashRouter (native), auth fragments stay on the hash; keep callback routes aligned with AuthCallback.
 */

import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';

const APP_SCHEME_PROTOCOL = 'com.atlasperformancelabs.app:';

function applyUrlToRouter(url, navigate) {
  if (!url || typeof url !== 'string') return;
  try {
    const u = new URL(url);
    let pathname = u.pathname || '/';
    // Custom scheme URLs (com.atlasperformancelabs.app://auth/callback) parse the first
    // segment as host — fold it back into the path so /auth/callback routes correctly.
    if (u.protocol === APP_SCHEME_PROTOCOL && u.host) {
      pathname = `/${u.host}${u.pathname || ''}`;
    }
    const search = u.search || '';
    const hash = u.hash || '';
    if (u.protocol === APP_SCHEME_PROTOCOL) {
      // Returning from external-browser OAuth — dismiss the SFSafariViewController sheet.
      import('@capacitor/browser').then(({ Browser }) => Browser.close()).catch(() => {});
    }
    if (pathname !== window.location.pathname || search !== window.location.search || hash !== window.location.hash) {
      if (hash) window.location.hash = hash;
      navigate(pathname + search, { replace: true });
    }
  } catch (_) {}
}

function useDeepLinkHandler() {
  const navigate = useNavigate();

  useEffect(() => {
    if (!Capacitor.isNativePlatform?.()) return;

    let handle = null;
    const setup = async () => {
      try {
        const App = (await import('@capacitor/app')).App;
        const launch = await App.getLaunchUrl?.();
        if (launch?.url) applyUrlToRouter(launch.url, navigate);

        handle = await App.addListener('appUrlOpen', (event) => {
          applyUrlToRouter(event?.url, navigate);
        });
      } catch (_) {}
    };
    setup();
    return () => {
      if (handle?.remove) handle.remove();
    };
  }, [navigate]);
}

export default function DeepLinkHandler() {
  useDeepLinkHandler();
  return null;
}
