# Atlas Web vs App Presentation System

Shared logic and data remain unified. Presentation is split by shell mode:

- `mobile_app`: app-native compact shell, bottom nav, touch spacing.
- `desktop_web`: SaaS-style shell, wider container, top navigation strip, dashboard spacing.

## Source of truth

- Mode detection: `src/lib/presentationMode.js` via `usePresentationMode()`
- Shell behavior: `src/components/shell/AppShell.jsx`
- Layout primitives: `src/ui/pageLayout.js`

## How to build new pages

1. Keep business logic/data shared.
2. Use `usePresentationMode()` for layout treatment only.
3. Use `pageLayout` primitives:
   - `responsivePageStyle({ desktop, maxWidth })`
   - `responsiveGridColumns({ desktop, min })`
4. Keep mobile stacked and touch-first.
5. On desktop web, widen to `layout.widths.content` or `layout.widths.dashboard` and use multi-column where useful.

## Page implementation pattern

```js
const { isDesktopWeb } = usePresentationMode();

<div style={responsivePageStyle({ desktop: isDesktopWeb, maxWidth: 1240 })}>
  <section style={responsiveGridColumns({ desktop: isDesktopWeb, min: 300 })}>
    ...
  </section>
</div>
```

## UX rule

- Mobile: compact app feel.
- Desktop: intentional SaaS hierarchy, no stretched phone-column layouts.
