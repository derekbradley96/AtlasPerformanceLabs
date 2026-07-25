/**
 * Listens for Capacitor appUrlOpen (deep link) and routes the SPA to the URL path.
 * Handles both cold start (getLaunchUrl) and app-in-background (appUrlOpen).
 *
 * Two hard-won rules live here:
 * 1. Auth returns carry their payload in the URL fragment (#access_token=…).
 *    Native runs HashRouter, where location.hash IS the route — so the
 *    fragment is folded into the query string instead ("/auth/callback?...");
 *    AuthCallback reads both.
 * 2. The listener binds ONCE and the launch URL is consumed ONCE. The first
 *    version re-ran its effect on every `navigate` identity change (i.e. every
 *    navigation) and getLaunchUrl() returns the SAME URL for the whole app
 *    session — so after email-confirm signup, AuthCallback's onward navigation
 *    re-triggered the effect, the launch URL yanked the router straight back,
 *    and the two fought until WebKit's SecurityError (100 replaceState / 10s)
 *    crashed the screen. deepLinkTarget() also returns null when the target
 *    equals the current location so duplicate deliveries are inert.
 */

import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';

const APP_SCHEME_PROTOCOL = 'com.atlasperformancelabs.app:';

/**
 * Pure: deep-link URL -> router target (path + search), or null when nothing
 * should happen (unparseable, or already at the target). Exported for tests.
 * @param {string} url
 * @param {{ hash?: string }} [currentLocation] window.location-like, for the same-target check
 */
export function deepLinkTarget(url, currentLocation) {
  if (!url || typeof url !== 'string') return null;
  let u;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  let pathname = u.pathname || '/';
  // Custom scheme URLs (com.atlasperformancelabs.app://auth/callback) parse the
  // first segment as host — fold it back into the path.
  if (u.protocol === APP_SCHEME_PROTOCOL && u.host) {
    pathname = `/${u.host}${u.pathname || ''}`;
  }
  const search = u.search || '';
  const hash = u.hash || '';

  let target;
  if (pathname.startsWith('/auth/callback')) {
    const fragment = hash.startsWith('#') ? hash.slice(1) : hash;
    const fragmentParams = fragment.includes('=') && !fragment.startsWith('/') ? fragment : '';
    const merged = [search.replace(/^\?/, ''), fragmentParams].filter(Boolean).join('&');
    target = pathname + (merged ? `?${merged}` : '');
  } else {
    target = pathname + search;
  }

  // Under HashRouter the current route lives in location.hash ("#/path?query").
  const currentHashRoute = String(currentLocation?.hash || '').replace(/^#/, '');
  if (currentHashRoute && currentHashRoute === target) return null;

  return { target, isAppScheme: u.protocol === APP_SCHEME_PROTOCOL };
}

function applyUrlToRouter(url, navigate) {
  const resolved = deepLinkTarget(url, typeof window !== 'undefined' ? window.location : undefined);
  if (!resolved) return;
  if (resolved.isAppScheme) {
    // Returning from external-browser OAuth — dismiss the SFSafariViewController sheet.
    import('@capacitor/browser').then(({ Browser }) => Browser.close()).catch(() => {});
  }
  navigate(resolved.target, { replace: true });
}

function useDeepLinkHandler() {
  const navigate = useNavigate();
  // navigate's identity changes on every location change; the listener must
  // not re-bind (see header). Route through a ref instead.
  const navigateRef = useRef(navigate);
  navigateRef.current = navigate;

  useEffect(() => {
    if (!Capacitor.isNativePlatform?.()) return undefined;

    let disposed = false;
    let handle = null;
    const setup = async () => {
      try {
        const App = (await import('@capacitor/app')).App;
        const launch = await App.getLaunchUrl?.();
        if (!disposed && launch?.url) {
          applyUrlToRouter(launch.url, (to, opts) => navigateRef.current(to, opts));
        }
        handle = await App.addListener('appUrlOpen', (event) => {
          applyUrlToRouter(event?.url, (to, opts) => navigateRef.current(to, opts));
        });
        if (disposed) handle?.remove?.();
      } catch (_) {}
    };
    setup();
    return () => {
      disposed = true;
      if (handle?.remove) handle.remove();
    };
  }, []);
}

export default function DeepLinkHandler() {
  useDeepLinkHandler();
  return null;
}
