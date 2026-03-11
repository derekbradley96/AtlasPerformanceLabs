# iOS / Xcode notes

## Console messages (informational, not the app error)

- **UIScene lifecycle will soon be required** – Apple is moving to UIScene-based lifecycle. Capacitor/iOS templates may adopt this in a future version. You can ignore for now.
- **Could not create a sandbox extension for .../App.app** – Common on simulator; often harmless. If the app runs, you can ignore.
- **Networking process / WebContent process took X seconds to launch** – Normal for the first load of the WebView.
- **WebContent Unable to hide query parameters from script (missing data)** – WKWebView message; does not cause the "Something went wrong" screen.

## Easier fault finding: debug build (readable error names)

When you see a **minified** error in the app (e.g. **"Cannot access 'kn' before initialization"**), the real variable name is hidden. Use a **debug build** so the next run shows the real name (e.g. `nutritionLatestWeek`) and you can search the codebase for it.

**One-off debug build:**

```bash
npm run build:debug
# then sync and run on device/simulator, e.g. npm run ios
```

Or with the env var directly:

```bash
VITE_BUILD_DEBUG=1 npm run build
```

Debug builds **disable minification** only for that run; normal `npm run build` stays minified. No need to edit `vite.config.js`. Config in `vite.config.js` reads `VITE_BUILD_DEBUG=1` and sets `minify: false` when that env is set.

**Typical flow:** Reproduce the crash → run `npm run build:debug` and sync/run again → read the full error (e.g. "Cannot access 'someVariable' before initialization") → search the repo for `someVariable` → fix declaration order or usage, then use normal `npm run build` again.

## "Cannot access 'kn' before initialization" (historical – fixed)

That error was a **minified variable name**; the real name was `nutritionLatestWeek`. The cause was use-before-declaration (TDZ) in `ClientDetail.jsx`; nutrition state was moved above the callbacks that use it. For any similar future error, use the **debug build** above to get the real variable name quickly.
