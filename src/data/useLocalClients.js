/**
 * Whether to use local client store (offline-first) vs remote.
 * When true: clients from localClientsStore, persisted across restarts.
 * When false: use existing remote/sandbox client source (e.g. Supabase when configured).
 */
export const USE_LOCAL_CLIENTS = true;
