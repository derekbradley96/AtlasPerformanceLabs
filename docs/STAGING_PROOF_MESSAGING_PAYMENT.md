# Staging proof: messaging + client payment gate

Run on **staging** with real accounts. Record **Pass / Fail / Blocked** and short notes. This file is the canonical log for production confidence on the two highest-risk systems.

**Prereqs:** Messaging migration applied (`20260409180000_messaging_participant_rls_read_receipts.sql`); Stripe test mode; two users (coach + client linked via `clients.user_id`).

---

## Part 1 — Messaging proof

| # | Scenario | Result | Notes |
|---|----------|--------|-------|
| M1 | Coach → client send | | |
| M2 | Client → coach send | | |
| M3 | Unread count increments for recipient | | |
| M4 | Unread clears on thread open / mark read | | |
| M5 | Sender roles render correctly (coach vs client) | | |
| M6 | Thread detail opens from list / deep link | | |
| M7 | RLS: unrelated user cannot read thread/messages | | |

**Tester / date:** _______________

---

## Part 2 — Client payment gate proof

| # | Scenario | Result | Notes |
|---|----------|--------|-------|
| P1 | `/client` (or role shortcut) while `pending_payment` → onboarding/payment | | |
| P2 | Direct child route (e.g. `/today`, `/checkins`) blocked | | |
| P3 | Deep link `/messages` while gated → redirect (if messaging locked) | | |
| P4 | Stripe success return **before** webhook → confirming UI → eventual unlock | | |
| P5 | “Confirming payment” / poll UX acceptable | | |
| P6 | Timeout / “Check payment status” / refresh recovery | | |
| P7 | Manual/deferred billing (priced, no `stripe_price_id`) → not stuck in `pending_payment` | | |

**Tester / date:** _______________

---

## Sign-off

| Gate | Staging OK? |
|------|-------------|
| Messaging (M1–M7) | ☐ |
| Payment (P1–P7) | ☐ |
| Ready for production deploy of these systems | ☐ |

Linked checklist: [`RELEASE_GATE_MESSAGING_AND_CLIENT_PAYMENT.md`](./RELEASE_GATE_MESSAGING_AND_CLIENT_PAYMENT.md).
