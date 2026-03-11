import type { CapacitorConfig } from '@capacitor/cli';

/**
 * When CAPACITOR_SERVER_URL is set (e.g. for live reload), the app loads from that URL.
 * When unset (production), the app uses the built files in webDir (dist).
 */
const serverUrl = process.env.CAPACITOR_SERVER_URL;

const config: CapacitorConfig = {
  appId: 'com.atlasperformancelabs.app',
  appName: 'Atlas Performance Labs',
  webDir: 'dist',
  plugins: {
    Keyboard: {
      resize: 'none',
      style: 'dark',
      resizeOnFullScreen: true,
    },
    SplashScreen: {
      launchShowDuration: 0,
      launchAutoHide: true,
      backgroundColor: '#0F172A',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
    },
  },
  server: {
    allowNavigation: ['capacitor://localhost', 'https://*.supabase.co'],
    ...(serverUrl
      ? { url: serverUrl, cleartext: true }
      : { hostname: 'localhost' }),
  },
  ...(!serverUrl ? { android: { allowMixedContent: true } } : {}),
};

export default config;
