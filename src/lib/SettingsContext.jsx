import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';

const ADVANCED_MODE_KEY = 'atlas_advanced_mode';

const SettingsContext = createContext(null);

function getStoredAdvancedMode() {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return false;
    const raw = window.localStorage.getItem(ADVANCED_MODE_KEY);
    return raw === '1' || raw === 'true';
  } catch {
    return false;
  }
}

function setStoredAdvancedMode(value) {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    window.localStorage.setItem(ADVANCED_MODE_KEY, value ? '1' : '0');
  } catch {}
}

export function SettingsProvider({ children }) {
  const [advancedMode, setAdvancedModeState] = useState(getStoredAdvancedMode);

  useEffect(() => {
    setAdvancedModeState(getStoredAdvancedMode());
  }, []);

  const setAdvancedMode = useCallback((value) => {
    const next = typeof value === 'function' ? value(getStoredAdvancedMode()) : !!value;
    setStoredAdvancedMode(next);
    setAdvancedModeState(next);
  }, []);

  const value = { advancedMode: !!advancedMode, setAdvancedMode };
  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useAdvancedMode() {
  const ctx = useContext(SettingsContext);
  if (!ctx) {
    return {
      advancedMode: false,
      setAdvancedMode: () => {},
    };
  }
  return ctx;
}
