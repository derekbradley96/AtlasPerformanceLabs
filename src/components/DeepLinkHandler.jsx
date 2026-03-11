/**
 * Listens for Capacitor appUrlOpen (deep link) and routes the SPA to the URL path.
 * Handles both cold start (getLaunchUrl) and app-in-background (appUrlOpen).
 * When user taps capacitor://localhost/auth/callback#access_token=...,
 * we navigate to /auth/callback and preserve search + hash so AuthCallback can read tokens.
 */

import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';

function applyUrlToRouter(url, navigate) {
  if (!url || typeof url !== 'string') return;
  try {
    const u = new URL(url);
    const pathname = u.pathname || '/';
    const search = u.search || '';
    const hash = u.hash || '';
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
