# Zip / export hygiene (Atlas repo)

Archives shared with contractors, CI artifacts, or backup tools must **not** embed secrets, build output, or a nested `.git` history unless that is intentional.

## Never include

| Path / pattern | Why |
|----------------|-----|
| `node_modules/` | Huge, non-portable, reproducible via `npm ci` |
| `dist/`, `dist-ssr/`, `.vite/` | Build output; wrong machine may serve stale bundles |
| `.env`, `.env.*`, `.env.local` | **Secrets** (Supabase keys, Stripe, etc.) |
| `*.pem`, `secrets/`, `*.secret` | Credentials |
| `ios/Pods/`, `android/.gradle/` (unless you mean to ship native deps) | Often huge; regenerate with platform tooling |
| `.vercel/` | Local link state; not source of truth |

## Usually exclude (unless archiving for forensic/debug)

| Path | Why |
|------|-----|
| `.git/` | Large; recipients get wrong remotes/history; use `git archive` instead |
| `supabase/.temp/` | CLI temp; may contain project hints |

## Preferred ways to share code

1. **Git remote** — branch or tag; reviewer runs `npm ci` locally.
2. **`git archive`** — produces a tarball **without** `.git` by default:
   ```bash
   git archive --format=zip --output=atlas-src.zip HEAD
   ```
3. **CI artifact** — upload only `dist/` from a trusted pipeline, not a developer laptop zip of the whole tree.

## Repo-side guardrails

- Root `.gitignore` already ignores `node_modules`, `dist`, `.env*`, `supabase/.temp/`, `.vercel`.
- Before zipping manually: run from repo root and **exclude** the directories above (Finder: compress with care; CLI: use `zip -r` with `-x` patterns).

## Quick pre-zip checklist

- [ ] No `.env` or `.env.local` in the archive  
- [ ] No `node_modules`  
- [ ] No `dist`  
- [ ] Optional: no `.git` (use `git archive` if you need a clean snapshot)
