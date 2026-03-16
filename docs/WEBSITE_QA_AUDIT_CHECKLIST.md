# Atlas Website QA & Audit Checklist

This checklist covers **public / marketing** surfaces only (not the in-app shell).

---

## 1. Routing & Shell Separation

- [ ] `/` and `/for-coaches`, `/for-athletes`, `/pricing`, `/marketplace`, `/login` all render under `MarketingLayout` (no AppShell header or bottom nav).
- [ ] Public coach profile pages and result story pages do **not** show in-app bottom nav or AppShell header.
- [ ] Navigating between marketing pages does not affect app session state.

---

## 2. Hero & CTA Structure

- **Home**
  - [ ] Hero has clear headline, supporting copy, and primary/secondary CTAs.
  - [ ] Primary CTA goes to `/auth` with the correct intent (coach vs personal where applicable).
  - [ ] Secondary CTA also leads into `/auth` or an appropriate discovery/onboarding path.
- **Pricing**
  - [ ] Explains pricing model clearly (coach-led, not per-seat SaaS).
  - [ ] CTAs point back to `/auth` or discovery, not to in-app internal URLs.

---

## 3. Typography, Spacing, and Layout

- [ ] Headings form a clear hierarchy (hero H1, section H2/H3).
- [ ] Content width for marketing pages is capped (e.g. `max-w-4xl/5xl/6xl`), not full-width text edge-to-edge.
- [ ] Adequate vertical whitespace between sections (hero, features, social proof, CTA).
- [ ] No dashboard-like tile grids in hero or social proof sections; use marketing cards/sections instead.

---

## 4. Social Proof & Results

- [ ] Social proof section(s) show:
  - [ ] Realistic quotes/testimonials.
  - [ ] Clear attribution (coach type/name or role).
  - [ ] Clean quotation styling (no double quotes around already quoted text).
- [ ] Results stories (public result pages, coach profile results):
  - [ ] Use clear labels (Transformation, Prep/Show outcome, etc.).
  - [ ] Handle missing images gracefully (placeholders instead of broken images).
  - [ ] Metrics render in a readable stacked or inline layout (no overflow).

---

## 5. Coach Discovery & Marketplace

- [ ] Marketplace page:
  - [ ] Filters (coach type, specialty, rating, location) are laid out as a marketing filter panel, not an in-app settings grid.
  - [ ] “Apply filters” button is present and does not navigate away to in-app routes.
  - [ ] “Clear” resets filters without breaking the page.
- [ ] Public coach profile:
  - [ ] Hero shows coach name, focus, and a clear “Work with this coach” / enquiry CTA.
  - [ ] Enquiry flow:
    - [ ] Validates email/name.
    - [ ] Shows success and error toasts appropriately.
  - [ ] No in-app shell elements (tab bar, AppShell header).

---

## 6. Navbar & Footer

- [ ] Navbar:
  - [ ] Uses Atlas logo + “Performance Labs” wordmark.
  - [ ] Links to Home, For Coaches, For Athletes, Pricing, Marketplace, Login.
  - [ ] Hover states are consistent and subtle (no app-style active tab states).
- [ ] Footer:
  - [ ] Shows copyright.
  - [ ] Links to key marketing pages (For Coaches, For Athletes, Pricing, Marketplace, Login).
  - [ ] Uses muted colors (no primary button styles).

---

## 7. Loading, Errors, and Mobile

- [ ] Marketing pages render quickly and do not block on app-only Supabase data.
- [ ] Waitlist form:
  - [ ] Validates email and role interest.
  - [ ] Shows appropriate “joining” state and final success/failed messages.
- [ ] Public coach/result pages:
  - [ ] Show full-page loading state while fetching.
  - [ ] Show clear “not found” state when data is missing.
- **Mobile**
  - [ ] Hero, sections, and cards are readable on small screens (no horizontal overflow).
  - [ ] Navbar collapses gracefully (wraps links rather than overflowing).
  - [ ] CTA buttons are tappable (sufficient size and spacing).

