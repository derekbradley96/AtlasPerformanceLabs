#!/usr/bin/env node
/**
 * Atlas health check: lint, typecheck, tests, build, and grep scans for common footguns.
 * Exit code 0 = all pass; non-zero = at least one failure.
 */

import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'src');
const packageJson = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));

const results = { passed: [], failed: [] };

function run(name, cmd, args = []) {
  console.log(`\n--- ${name} ---`);
  const opts = { cwd: ROOT, stdio: 'inherit', shell: true };
  const result = spawnSync(cmd, args, opts);
  if (result.status !== 0) {
    results.failed.push(name);
    return false;
  }
  results.passed.push(name);
  return true;
}

function grepScan() {
  console.log('\n--- Grep scan (footguns) ---');
  const findings = [];

  function walk(dir, callback) {
    if (!fs.existsSync(dir)) return;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (e.name !== 'node_modules' && e.name !== 'dist' && e.name !== '.git') walk(full, callback);
      } else if (/\.(js|jsx|ts|tsx)$/.test(e.name)) {
        callback(full);
      }
    }
  }

  walk(SRC, (file) => {
    const rel = path.relative(ROOT, file);
    const content = fs.readFileSync(file, 'utf8');

    if (content.includes('public.messages') && !content.includes('message_messages') && !content.includes('message_threads')) {
      findings.push({ file: rel, rule: 'public.messages', detail: 'Reference to non-existent table public.messages' });
    }
    if (content.includes('window.confirm(')) {
      findings.push({ file: rel, rule: 'window.confirm', detail: 'Use ConfirmDialog for consistency' });
    }
  });

  // Role-safety: canUseRoleSwitcher must be dev-only and restricted to admin email
  const authContextPath = path.join(SRC, 'lib', 'AuthContext.jsx');
  if (fs.existsSync(authContextPath)) {
    const authContent = fs.readFileSync(authContextPath, 'utf8');
    const switcherLine = authContent.split('\n').find((l) => l.includes('canUseRoleSwitcher = '));
    if (switcherLine) {
      if (!switcherLine.includes('isDev') && !switcherLine.includes('import.meta.env.DEV')) {
        findings.push({ file: 'src/lib/AuthContext.jsx', rule: 'role-safety', detail: 'canUseRoleSwitcher must be DEV-only (isDev &&) so view-as never ships in production' });
      }
      if (!switcherLine.includes('ADMIN_EMAIL') && !switcherLine.includes('user?.email')) {
        findings.push({ file: 'src/lib/AuthContext.jsx', rule: 'role-safety', detail: 'canUseRoleSwitcher must be restricted to admin email (ADMIN_EMAIL)' });
      }
    }
  }

  // Role-safety: dev-only routes must be behind import.meta.env.DEV
  const appPath = path.join(SRC, 'App.jsx');
  if (fs.existsSync(appPath)) {
    const appContent = fs.readFileSync(appPath, 'utf8');
    if (appContent.includes('admin-dev-panel') && !appContent.includes('import.meta.env.DEV') && !/admin-dev-panel[\s\S]*?import\.meta\.env\.DEV|import\.meta\.env\.DEV[\s\S]*?admin-dev-panel/.test(appContent)) {
      const hasGuard = /admin-dev-panel[\s\S]{0,800}?import\.meta\.env\.DEV|element=\{import\.meta\.env\.DEV \?/.test(appContent);
      if (!hasGuard) {
        findings.push({ file: 'src/App.jsx', rule: 'role-safety', detail: 'admin-dev-panel / navigation-audit routes must be wrapped with import.meta.env.DEV' });
      }
    }
  }

  const byRule = {};
  findings.forEach((f) => {
    byRule[f.rule] = (byRule[f.rule] || 0) + 1;
  });
  console.log('Grep findings:', Object.keys(byRule).length ? JSON.stringify(byRule, null, 2) : 'none');
  findings.slice(0, 20).forEach((f) => console.log(`  ${f.file} [${f.rule}] ${f.detail}`));
  if (findings.length > 20) console.log(`  ... and ${findings.length - 20} more`);

  const failRules = ['public.messages', 'window.confirm', 'role-safety'];
  const hasCritical = findings.some((f) => failRules.includes(f.rule));
  if (hasCritical) results.failed.push('Grep scan (critical footguns + role-safety)');
  else results.passed.push('Grep scan');
  return !hasCritical;
}

// Run checks
let ok = true;
if (fs.existsSync(path.join(ROOT, 'node_modules', 'eslint'))) {
  ok = run('Lint', 'npm', ['run', 'lint']) && ok;
} else {
  console.log('\n--- Lint (skipped, eslint not found) ---');
}
if (fs.existsSync(path.join(ROOT, 'jsconfig.json')) || fs.existsSync(path.join(ROOT, 'tsconfig.json'))) {
  ok = run('Typecheck', 'npm', ['run', 'typecheck']) && ok;
} else {
  console.log('\n--- Typecheck (skipped) ---');
}
if (fs.existsSync(path.join(ROOT, 'vitest.config.js')) || fs.existsSync(path.join(ROOT, 'vitest.config.ts')) || (packageJson.scripts && packageJson.scripts['test:unit'])) {
  ok = run('Unit tests', 'npm', ['run', 'test:unit']) && ok;
} else {
  console.log('\n--- Unit tests (skipped) ---');
}
ok = run('Build', 'npm', ['run', 'build']) && ok;
grepScan();

console.log('\n========== Summary ==========');
console.log('Passed:', results.passed.join(', '));
if (results.failed.length) {
  console.log('Failed:', results.failed.join(', '));
  process.exit(1);
}
console.log('All checks passed.');
process.exit(0);
