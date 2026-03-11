/** Minimal app params (no Base44). Use Supabase / Edge Functions for API. */
export const appParams = {
  appId: null,
  token: null,
  fromUrl: typeof window !== 'undefined' ? window.location.href : '',
  functionsVersion: null,
  appBaseUrl: null,
};
