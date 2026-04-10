/**
 * Canonical auth URLs that always show AuthScreen (email/password).
 * `public=1` prevents AuthScreenGate / AuthScreen from auto-skipping to onboarding.
 * `/signup` route redirects to signup mode with the same flag (see App.jsx).
 */
export const LOGIN_PUBLIC_PATH = '/login?public=1';
export const SIGNUP_PUBLIC_PATH = '/signup';
