# Data access rule

## The rule

UI components access data through `useData()` or React Query.
Only repository modules (`src/lib/repo/`, `src/data/`) touch
`getSupabase()` directly.

## Pattern for components

WRONG:

```javascript
const supabase = getSupabase();
const { data } = await supabase.from('checkins').select(...)
```

RIGHT:

```javascript
const data = useData();
const checkins = await data.listCheckInsForClient(clientId);
```

Or with React Query:

```javascript
const { data: checkins } = useQuery({
  queryKey: ['checkins', clientId],
  queryFn: () => data.listCheckInsForClient(clientId),
});
```

Or call a function in `src/data/` that wraps Supabase (still no
`getSupabase()` in the component).

## Why

- Shared cache: same query doesn't fire twice
- Centralised error handling
- Offline/optimistic patterns work from one place
- Easier to test (mock `useData`, not `getSupabase`)

## Exceptions

Low-level one-off operations where no `useData` method
exists yet may call `getSupabase()` temporarily.
Add a `// TODO: move to useData` comment when doing this.
