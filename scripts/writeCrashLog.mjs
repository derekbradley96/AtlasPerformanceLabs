#!/usr/bin/env node
/**
 * Write crash log to logs/last-crash.txt (overwrite) and logs/crash-history.log (append).
 * Usage:
 *   echo '{"message":"Error message","stack":"..."}' | node scripts/writeCrashLog.mjs
 *   node scripts/writeCrashLog.mjs '{"message":"Error message","stack":"..."}'
 */
import { mkdirSync, writeFileSync, appendFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const logsDir = join(root, 'logs');
const lastCrashPath = join(logsDir, 'last-crash.txt');
const historyPath = join(logsDir, 'crash-history.log');

function main() {
  const arg = process.argv[2];
  if (!arg) {
    console.error('Usage: node scripts/writeCrashLog.mjs \'<JSON>\'');
    console.error('   Or paste JSON and run: node scripts/writeCrashLog.mjs "$(cat)"');
    process.exit(1);
  }
  try {
    const raw = (typeof arg === 'string' ? arg : String(arg)).trim() || '{}';
    const data = typeof raw === 'string' && (raw.startsWith('{') || raw.startsWith('[')) ? JSON.parse(raw) : { message: raw };
    const payload = {
      message: data.message ?? data.errorMessage ?? 'Unknown error',
      stack: data.stack ?? data.errorStack ?? '',
      componentStack: data.componentStack ?? '',
      route: data.route ?? {},
      name: data.name ?? '',
      timestamp: data.timestamp ?? new Date().toISOString(),
    };
    const text = [
      `[${payload.timestamp}]`,
      payload.message,
      payload.stack ? `\nStack:\n${payload.stack}` : '',
      payload.componentStack ? `\nComponent stack:\n${payload.componentStack}` : '',
      payload.route && Object.keys(payload.route).length ? `\nRoute: ${JSON.stringify(payload.route)}` : '',
    ].filter(Boolean).join('\n');

    mkdirSync(logsDir, { recursive: true });
    writeFileSync(lastCrashPath, text, 'utf-8');
    appendFileSync(historyPath, '\n---\n' + text, 'utf-8');
    console.log('Crash log written to logs/last-crash.txt and appended to logs/crash-history.log');
  } catch (e) {
    console.error('writeCrashLog failed:', e.message);
    process.exit(1);
  }
}

main();
