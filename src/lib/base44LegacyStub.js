/**
 * Legacy Base44-shaped stub (replaces deleted `emptyApi.js`).
 * Prefer Supabase client, repos, and `invokeSupabaseFunction` for new code.
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
    redirectToLogin: (url) => {
      if (typeof window !== 'undefined') window.location.href = url || '/';
    },
    logout: noop,
    updateMe: () => Promise.resolve({}),
  },
  entities: new Proxy({}, {
    get() {
      const e = emptyEntity();
      e.get = () => Promise.resolve(null);
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
