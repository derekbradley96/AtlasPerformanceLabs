#!/usr/bin/env node
/**
 * Runs the Supabase CLI with env from .env / .env.local merged in (without overwriting existing env).
 * Fixes `db push` failing with "Connect ... SUPABASE_DB_PASSWORD" when the password only lives in dotfiles.
 */
import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

function parseDotEnvFile(filePath) {
  const out = {};
  if (!fs.existsSync(filePath)) return out;
  let text;
  try {
    text = fs.readFileSync(filePath, 'utf8');
  } catch {
    return out;
  }
  for (const line of text.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq === -1) continue;
    const key = t.slice(0, eq).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;
    let val = t.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"'))
      || (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

/** .env then .env.local (local wins); only keys not already in process.env (shell exports win). */
const merged = { ...parseDotEnvFile(path.join(ROOT, '.env')), ...parseDotEnvFile(path.join(ROOT, '.env.local')) };
for (const [key, val] of Object.entries(merged)) {
  if (!(key in process.env)) process.env[key] = val;
}

const passThrough = process.argv.slice(2);
if (passThrough.length === 0) {
  console.error('Usage: node scripts/run-supabase.mjs <supabase-args...>');
  process.exit(1);
}

const r = spawnSync('npx', ['supabase', ...passThrough], {
  cwd: ROOT,
  stdio: 'inherit',
  env: process.env,
  shell: process.platform === 'win32',
});

process.exit(r.status === null ? 1 : r.status);
