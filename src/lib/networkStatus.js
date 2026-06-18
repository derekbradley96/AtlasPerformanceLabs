import React from 'react';
import { Capacitor } from '@capacitor/core';

let networkListeners = new Set();
let currentStatus = { connected: true, connectionType: 'unknown' };

export function getNetworkStatus() {
  return currentStatus;
}

export function addNetworkListener(fn) {
  networkListeners.add(fn);
  return () => networkListeners.delete(fn);
}

function notifyListeners(status) {
  currentStatus = status;
  networkListeners.forEach((fn) => {
    try { fn(status); } catch (_) {}
  });
}

export async function initNetworkMonitoring() {
  if (typeof Capacitor !== 'undefined'
    && Capacitor.isNativePlatform?.()) {
    try {
      const { Network } = await import('@capacitor/network');

      // Get initial status
      const initial = await Network.getStatus();
      currentStatus = initial;
      notifyListeners(initial);

      // Listen for changes
      await Network.addListener('networkStatusChange', (status) => {
        notifyListeners(status);
        // Also fire browser events for components using navigator.onLine
        if (status.connected) {
          window.dispatchEvent(new Event('online'));
        } else {
          window.dispatchEvent(new Event('offline'));
        }
      });
    } catch (_) {
      // Fall back to browser events
      window.addEventListener('online', () =>
        notifyListeners({ connected: true,
          connectionType: 'unknown' }));
      window.addEventListener('offline', () =>
        notifyListeners({ connected: false,
          connectionType: 'none' }));
    }
  } else {
    // Browser fallback
    window.addEventListener('online', () =>
      notifyListeners({ connected: true,
        connectionType: 'unknown' }));
    window.addEventListener('offline', () =>
      notifyListeners({ connected: false,
        connectionType: 'none' }));
    currentStatus = {
      connected: navigator.onLine,
      connectionType: 'unknown',
    };
    notifyListeners(currentStatus);
  }
}

export function useNetworkStatus() {
  const [connected, setConnected] = React.useState(
    () => getNetworkStatus().connected
  );
  React.useEffect(() => {
    const remove = addNetworkListener((status) => {
      setConnected(status.connected);
    });
    return remove;
  }, []);
  return connected;
}
