# PROMPT 10 – First 5 minutes polish pass

Light UI/copy refinements only (no new systems).

## Improvements

- **Coach Home** – Intro block separated from the rest with a subtle bottom border and slightly increased subline line-height for readability.
- **Client Home (no profile)** – Empty state title/description tightened for clarity and confidence (“Welcome to Atlas” + Discover framing).
- **Personal Home** – Hero subcopy for new users clarified (Today as training surface, Home updates after you finish).

## Screens / components touched

- `src/pages/CoachHomePage.jsx`
- `src/components/dashboards/ClientDashboard.jsx` (empty state + workout CTA tracking alignment with PROMPT 9)
- `src/components/dashboards/GeneralDashboard.jsx` (copy + workout CTA)

## Remaining weak spots (optional follow-ups)

- **Active Workout (base44)** – Still a separate stack; funnel may under-count users who only use that path without Supabase Today.
- **Coach invite** – “Copy code” does not emit `first_coach_link_copied` (by design: event is for full signup URL). Add a dedicated “Copy link” control if product wants parity with code copies.
- **Deep links** – First dashboard view fires when dashboard data finishes loading; very slow networks may delay the event vs. perceived “first paint.”
