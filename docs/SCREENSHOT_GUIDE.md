# App Store Screenshot Guide

## Required sizes

### iOS App Store (REQUIRED)
- 6.7" iPhone (iPhone 15 Pro Max): 1290x2796px — REQUIRED
- 6.5" iPhone (iPhone 14 Plus): 1242x2688px — REQUIRED
- 12.9" iPad: 2048x2732px — REQUIRED for universal apps

### Google Play Store (REQUIRED)
- Phone: min 1080x1920px, max 3840px on longest side
- 7" Tablet: 1200x1920px recommended
- 10" Tablet: 1600x2560px recommended

## The 6 screens to capture (in this order)

### Screenshot 1 — Coach home (the hook)
Route: `/home` (as a transformation coach with 3+ clients)
What to show: Workload score "7", Top Priority card, Roster Health with one at-risk client

### Screenshot 2 — Workout player (the product proof)
Route: `/today-workout` (during an active session)
What to show: Bench Press with coach targets on left (60kg/10/RIR2) and client inputs on right, 3 sets shown

### Screenshot 3 — Barcode scanner (the MFP killer)
Route: `/nutrition` (after scanning a barcode)
What to show: Quick-confirm bottom sheet with product name, macros, and "Always free" label prominent

### Screenshot 4 — Nutrition interpreted (the differentiator)
Route: `/nutrition` (mid-day, some meals logged)
What to show: Calorie ring at 62%, with the interpretation text: "77g protein still needed — try chicken or a shake"

### Screenshot 5 — Pose library (the unique feature)
Route: `/comp-prep/pose-library` -> a pose detail
What to show: Front Double Bicep with Pillar coaching notes and "Exercises for this pose" section visible

### Screenshot 6 — Progress comparison
Route: `/progressphotos` (with 2+ photos)
What to show: Side-by-side comparison with weight change interpretation below

## Capture process

1. Use iOS Simulator in Xcode (Simulator > Device > choose size)
2. Navigate to each route
3. Use Simulator > File > New Screenshot (Cmd+S)
4. Screenshots save to Desktop

## Caption overlay tool

Use the `ScreenshotCaption` dev tool by adding query params to the URL:
- `?caption=true&screen=coach-home`
- `?caption=true&screen=workout`
- `?caption=true&screen=barcode`
- `?caption=true&screen=nutrition`
- `?caption=true&screen=posing`
- `?caption=true&screen=progress`
