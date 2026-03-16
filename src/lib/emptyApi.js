/**
 * Legacy API stub for call sites not yet migrated to Supabase.
 * Base44 has been removed from the project. Prefer useAuth() and invokeSupabaseFunction()
 * (or Supabase client/repos) for new code. This stub returns empty data so existing
 * pages render without errors until they are wired to Supabase.
 */

const noop = () => {};
const emptyList = () => Promise.resolve([]);
const emptyEntity = () => ({
  filter: emptyList,
  list: (...args) => (args.length >= 1 ? emptyList() : emptyList()),
  create: () => Promise.resolve({}),
  update: () => Promise.resolve({}),
  delete: () => Promise.resolve(),
  get: () => Promise.resolve(null),
});

export const base44 = {
  auth: {
    me: () => Promise.resolve(null),
    isAuthenticated: () => Promise.resolve(false),
    redirectToLogin: (url) => { if (typeof window !== 'undefined') window.location.href = url || '/'; },
    logout: noop,
    updateMe: () => Promise.resolve({}),
  },
  entities: new Proxy({}, {
    get(_, name) {
      const e = emptyEntity();
      e.get = (id) => Promise.resolve(null);
      return e;
    },
  }),
  functions: {
    invoke: () => Promise.resolve({ data: null }),
  },
  integrations: {
    Core: {
      UploadFile: () => Promise.resolve({ file_url: '' }),
    },
  },
  users: {
    inviteUser: () => Promise.resolve({}),
  },
};
