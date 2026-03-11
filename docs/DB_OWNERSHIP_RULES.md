# Database ownership rules

Internal reference for how coach/client ownership is modelled and how RLS should be written.

## Identity

- **`profiles.user_id`** = `auth.uid()`  
  One row per auth user; `user_id` is the stable link to `auth.users(id)`.

- **`clients.coach_id`** = `auth.uid()` for the owning coach  
  The coach who “owns” the client record. Single source of truth for “this client belongs to this coach.”

## Client-owned tables

All client-scoped tables:

- Reference **`public.clients(id)`** (e.g. `client_id UUID REFERENCES public.clients(id)`).
- Derive coach via **`clients.coach_id`**, not via a separate trainer table or `trainer_id` when writing new policies.

Examples: `checkins`, `client_compliance`, `client_flags`, `client_phases`, `message_threads` (coach_id on thread), etc.

## RLS pattern

**Client (acting as themselves)**

- Can read rows where **`client_id` is theirs**:  
  `client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid())`

**Coach (acting as coach)**

- Can read (and where applicable write) rows where the **client belongs to them**:  
  `client_id IN (SELECT id FROM public.clients WHERE coach_id = auth.uid())`

Use **`clients.coach_id`** in policy conditions so ownership is consistent and index-friendly.  
For **`public.clients`** itself, coach policies use:  
`COALESCE(coach_id, trainer_id) = auth.uid()` so behaviour is correct before and after `coach_id` backfill.

## Summary

| Who    | Condition |
|--------|-----------|
| Client | `client_id IN (SELECT id FROM clients WHERE user_id = auth.uid())` |
| Coach  | `client_id IN (SELECT id FROM clients WHERE coach_id = auth.uid())` |
| Clients table (coach) | `COALESCE(coach_id, trainer_id) = auth.uid()` |

New policies and views should use **`clients.coach_id`** for coach ownership. Legacy **`trainer_id`** is kept on `clients` for compatibility but is no longer the preferred key for RLS.
