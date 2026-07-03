#!/usr/bin/env node
/**
 * Some Capacitor community plugins ship native iOS source but no Package.swift,
 * so `npx cap sync ios` silently excludes them from the SPM build — they install
 * fine but never actually link into the app (methods fail at runtime).
 * This copies our own Package.swift into those packages after every npm install,
 * so `npx cap sync ios` picks them up automatically like any other SPM plugin.
 * Safe to extend: add a "<pkg-dir-name>.Package.swift" file to ios-plugin-patches/
 * and an entry below.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const PATCHES = [
  { pkg: '@capacitor-community/apple-sign-in', template: 'apple-sign-in.Package.swift' },
  { pkg: 'capacitor-healthkit', template: 'capacitor-healthkit.Package.swift' },
  { pkg: 'capacitor-native-biometric', template: 'capacitor-native-biometric.Package.swift' },
  { pkg: '@capacitor/live-updates', template: 'live-updates.Package.swift' },
  { pkg: '@capacitor-mlkit/barcode-scanning', template: 'mlkit-barcode-scanning.Package.swift' },
  { pkg: '@capacitor-community/in-app-review', template: 'in-app-review.Package.swift' },
];

for (const { pkg, template } of PATCHES) {
  const pkgDir = path.join(ROOT, 'node_modules', pkg);
  if (!fs.existsSync(pkgDir)) continue; // not installed (e.g. optional dep) — skip quietly
  const src = path.join(ROOT, 'ios-plugin-patches', template);
  const dest = path.join(pkgDir, 'Package.swift');
  fs.copyFileSync(src, dest);
  console.log(`[patch-native-plugins] wrote ${pkg}/Package.swift`);
}
