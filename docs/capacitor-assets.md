# iOS/Android app icons and splash screens (Capacitor)

Atlas Performance Labs uses **atlas-mark.png** (icon only, no text) for the app icon on iOS and Android. Run `npm run assets` then `npm run cap:sync` to replace the default app icon with atlas-mark and use a centered mark on `#0F172A` for the splash screen.

## Setup

1. **Install dependencies** (required for `@capacitor/assets`; run once so `sharp` can build):
   ```bash
   npm install
   ```
   If you previously used `npm install --ignore-scripts`, run `npm install` again without that flag so `sharp` installs correctly.

2. **Generate source assets and platform assets**
   ```bash
   npm run assets
   ```
   This:
   - Runs `scripts/generate-capacitor-resources.mjs` to create from `src/assets/branding/atlas-mark.png`:
     - `resources/icon.png` and `resources/icon-only.png` (1024×1024, #0F172A + mark)
     - `resources/splash.png` (2732×2732, #0F172A + centered mark)
   - Runs `capacitor-assets generate` to produce iOS/Android (and PWA) icons and splash screens from `resources/`.

3. **Sync native projects**
   ```bash
   npm run cap:sync
   ```
   Builds the web app and copies it into the native projects (and updates icons/splash if you just ran `npm run assets`).

## Commands

| Script | Description |
|--------|-------------|
| `npm run assets` | Generate `resources/` source images from atlas-mark, then run `capacitor-assets generate`. |
| `npm run cap:sync` | `npm run build` then `npx cap sync` (web build + copy to iOS/Android). |

## Config

- **capacitor.config.ts**: `appName: "Atlas Performance Labs"`, `appId: "com.atlasperformancelabs.app"`.
- **resources/**: Source images for @capacitor/assets (do not edit by hand; regenerate with `npm run assets`).

## Troubleshooting

- **"Cannot find module sharp" / sharp install fails**: Run `npm install` without `--ignore-scripts` so `sharp` can build, or run `npm rebuild sharp`. On CI, ensure native build tools are available (e.g. Xcode on macOS).
- **iOS/Android not found**: `capacitor-assets` generates into `ios/App` and `android` only when those projects exist. After `npx cap add ios` and `npx cap add android`, run `npm run assets` again to generate native icons and splash screens.
- **Only need to regenerate source images**: Run `node scripts/generate-capacitor-resources.mjs` (uses jimp, no sharp required). Then run `npx capacitor-assets generate ...` when sharp is available.
