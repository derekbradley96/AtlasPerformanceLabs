# Security pipeline

Dependency and security scanning for this repo: what runs, what fails CI, and how to fix it.

---

## What gets scanned

| Step | Tool | Scope |
|------|------|--------|
| **npm audit (production)** | `npm audit --omit=dev` | Production dependencies only. |
| **npm audit strict** | `npm audit --audit-level=high` | All dependencies; fails if any **high** or **critical** finding. |
| **OSV Scanner** | `osv-scanner --lockfile=package-lock.json` | Full dependency tree from lockfile against OSV database. |
| **Lint** | `npm run lint` (ESLint) | Source code. |
| **Test** | `npm run test` + `npm run test:unit` | Node test + Vitest. |

---

## What fails CI

- **High or critical npm audit findings** – pipeline fails at the audit step.
- **Any OSV Scanner vulnerability** – pipeline fails at the OSV step (by default osv-scanner exits non-zero when vulns are found).
- **Lint errors** – pipeline fails at the lint step.
- **Test failures** – pipeline fails at the test step.

CI runs on **push to `main`** and **pull_request** targeting `main`. All steps must pass for the run to succeed.

---

## How to remediate

### npm audit (high/critical)

1. Run locally:  
   `npm run security:audit`  
   or:  
   `npm audit --audit-level=high`
2. Apply automatic fixes where safe:  
   `npm run security:audit:fix`
3. For remaining issues, upgrade the reported package(s) in `package.json` (or accept the risk and use overrides/audit ignore only when documented).

### OSV Scanner

1. Run locally:  
   `npm run security:osv`
2. Fix by upgrading the vulnerable dependency (or a parent that pulls it in).  
   Check the OSV output for the affected package and version; update `package.json` (or a dependency that brings it in) and run `npm install`, then re-run the scanner.

### Full local security check

Run both audit and OSV:

```bash
npm run security:full
```

---

## Blocked or deferred packages

Packages that cannot be upgraded safely (e.g. breaking changes) or are intentionally deferred should be listed here so the team knows why and what to do.

| Package | Reason blocked | Temporary mitigation | Owner action required |
|---------|----------------|----------------------|------------------------|
| *(none yet)* | — | — | Run `npm run security:full` and `npm audit`; add rows when a vuln must be accepted or deferred. |

When adding a row:

- **Reason blocked:** e.g. “Upgrade to 2.x breaks our usage of X” or “No fixed version yet”.
- **Temporary mitigation:** e.g. “Pinned in overrides”, “Not used at runtime”, “RLS limits exposure”.
- **Owner action required:** e.g. “Re-evaluate when upstream releases fix” or “Replace with Y”.

---

## NPM scripts reference

| Script | Command | Use |
|--------|---------|-----|
| `security:audit` | `npm audit --omit=dev` | Check production deps only. |
| `security:audit:fix` | `npm audit fix --omit=dev` | Auto-fix where possible (production). |
| `security:osv` | `npx osv-scanner@latest --lockfile=package-lock.json` | Scan lockfile with OSV. |
| `security:full` | audit + osv | Run both before pushing. |

---

## Workflow file

- **`.github/workflows/ci.yml`** – runs on `push` and `pull_request` to `main`: `npm ci` → audit (production + strict) → OSV → lint → test.

---

## Dependency review (manual)

- **Risky or outdated:** Run `npm run security:full` and `npm audit` regularly; upgrade or override as needed.
- **Unused:** Periodically review `package.json` (e.g. with `npx depcheck` or usage search); remove only when you’ve confirmed a package isn’t imported or used by the app.
- **Overrides:** This repo uses `overrides` in `package.json` for known fixes (e.g. `minimatch`, `tar`). Prefer upgrading the direct dependency when possible; use overrides when a transitive fix is required and the direct dep can’t be upgraded yet.
