#!/usr/bin/env node
/**
 * Run from project root only. Builds web app, syncs to iOS, opens Xcode.
 * If ios/ is missing, adds the iOS platform first.
 */
import { existsSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';

const root = process.cwd();
const packageJson = join(root, 'package.json');
const iosDir = join(root, 'ios');
const xcodeProj = join(root, 'ios', 'App', 'App.xcodeproj');

if (!existsSync(packageJson)) {
  console.error('[ensure-ios] Run this from the project root (where package.json is).');
  process.exit(1);
}

if (!existsSync(iosDir)) {
  console.log('[ensure-ios] Adding iOS platform...');
  execSync('npx cap add ios', { cwd: root, stdio: 'inherit' });
}

console.log('[ensure-ios] Building and syncing...');
execSync('npm run build', { cwd: root, stdio: 'inherit' });
execSync('npx cap sync ios', { cwd: root, stdio: 'inherit' });

if (!existsSync(xcodeProj)) {
  console.error('[ensure-ios] Xcode project not found at:', xcodeProj);
  process.exit(1);
}

console.log('[ensure-ios] Opening Xcode...');
execSync(`open "${xcodeProj}"`, { cwd: root, stdio: 'inherit' });
