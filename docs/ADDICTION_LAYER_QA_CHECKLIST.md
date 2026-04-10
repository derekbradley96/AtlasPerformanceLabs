# Addiction Layer QA Checklist

**Build/Branch:**  
**Tester:**  
**Date:**  
**Role Tested:** Personal / Client / Coach  
**Device:** iOS / Android / Web  
**Result Legend:** Pass / Fail / N/A

---

## A) Momentum Core

| ID | Check | Pass/Fail | Notes |
|---|---|---|---|
| A1 | Workout streak is visible on Home and updates after completed workout |  |  |
| A2 | Nutrition consistency streak is visible and updates after logging meal/nutrition |  |  |
| A3 | Check-in streak is visible and updates after submitting readiness/check-in |  |  |
| A4 | Weekly score is visible and updates after each qualifying action |  |  |
| A5 | Weekly target/current progress are visible (what is done vs what remains) |  |  |

---

## B) Near-Win Prompts

| ID | Check | Pass/Fail | Notes |
|---|---|---|---|
| B1 | Prompt appears: "One workout away..." when weekly workout target is near completion |  |  |
| B2 | Prompt appears for nutrition completion ("Hit protein today..." style) when nutrition is pending |  |  |
| B3 | Prompt appears for check-in completion when check-in is pending |  |  |
| B4 | Prompt content changes contextually as user completes missing actions |  |  |

---

## C) Streak Protection (Grace + Risk)

| ID | Check | Pass/Fail | Notes |
|---|---|---|---|
| C1 | One missed day in week does not immediately break streak (grace applied) |  |  |
| C2 | UI indicates grace-day state ("Grace used" / "Grace available") |  |  |
| C3 | "Streak at risk tomorrow" warning appears when grace is consumed and user misses again risk path |  |  |
| C4 | Warning clears when user recovers with required activity |  |  |

---

## D) Completion Rewards

| ID | Check | Pass/Fail | Notes |
|---|---|---|---|
| D1 | After workout completion, concise momentum feedback toast appears |  |  |
| D2 | After check-in submission, concise momentum feedback toast appears |  |  |
| D3 | After nutrition log, concise momentum feedback toast appears |  |  |
| D4 | Feedback variants appear where relevant (best week pace / matched / streak increased) |  |  |

---

## E) Identity Reinforcement Copy (Role-Aware)

| ID | Check | Pass/Fail | Notes |
|---|---|---|---|
| E1 | Personal sees momentum/consistency identity copy (premium tone) |  |  |
| E2 | Client sees "on track" + coach visibility reinforcement copy |  |  |
| E3 | Coach sees team-level signals only (not personal habit cards) |  |  |
| E4 | Copy remains motivating and non-childish across surfaces |  |  |

---

## F) Weekly Rhythm

| ID | Check | Pass/Fail | Notes |
|---|---|---|---|
| F1 | Weekly target is clearly visible |  |  |
| F2 | Current weekly score is clearly visible |  |  |
| F3 | "What to do next this week"/next-focus guidance is shown |  |  |
| F4 | Next-focus guidance updates after completing actions |  |  |

---

## G) Smart Comeback Nudges

| ID | Check | Pass/Fail | Notes |
|---|---|---|---|
| G1 | After missed activity day, comeback copy appears (not generic) |  |  |
| G2 | Comeback prompt references current state (e.g., one workout to get back on track) |  |  |
| G3 | Comeback prompt transitions to momentum-forward copy after recovery |  |  |

---

## H) UI/UX Quality Gates

| ID | Check | Pass/Fail | Notes |
|---|---|---|---|
| H1 | Premium visual tone (not childish gamification) |  |  |
| H2 | Compact and uncluttered on mobile |  |  |
| H3 | Works on Personal + Client Home |  |  |
| H4 | Coach view shows team/client momentum signals appropriately |  |  |
| H5 | No blocking layout issues on common viewport sizes |  |  |

---

## I) Scenario Run (End-to-End)

| ID | Scenario | Pass/Fail | Notes |
|---|---|---|---|
| I1 | Day 1 complete workout/check-in/nutrition -> streaks/score increase |  |  |
| I2 | Day 2 miss all -> comeback + grace behavior observed |  |  |
| I3 | Day 3 complete workout -> recovery path works, risk state updates |  |  |
| I4 | Weekly score reflects all transitions correctly |  |  |
| I5 | Prompts/nudges update correctly at each transition |  |  |

---

## J) Defect Log

| Defect ID | Severity (Low/Med/High) | Area | Steps to Repro | Expected | Actual | Screenshot/Video |
|---|---|---|---|---|---|---|
|  |  |  |  |  |  |  |

---

## K) Sign-Off

- **Overall Status:** Pass / Fail  
- **Blocking Issues Present:** Yes / No  
- **Recommended for Release:** Yes / No  
- **Tester Signature/Initials:**  
- **Notes:**  
