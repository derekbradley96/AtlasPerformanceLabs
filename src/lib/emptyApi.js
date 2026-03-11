/**
 * Empty API stub for legacy call sites. No Base44 dependency.
 * Replace with AuthContext (user, isAuthenticated, navigateToLogin) and
 * Supabase Edge Functions (invokeSupabaseFunction from @/lib/supabaseApi) when implementing features.
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
