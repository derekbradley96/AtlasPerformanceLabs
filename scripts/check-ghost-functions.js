#!/usr/bin/env node
/**
 * Fails if any file under src/ calls invokeSupabaseFunction with a function name
 * that is not listed in src/lib/deployedEdgeFunctions.js (ghost / undeployed edge).
 * Run in CI to prevent regressions.
 *
 * Usage: node scripts/check-ghost-functions.js
 */
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { isDeployedEdgeFunction } from '../src/lib/deployedEdgeFunctions.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC_ROOT = join(__dirname, '..', 'src');

const INVOKE_RE = /invokeSupabaseFunction\s*\(\s*['"]([a-zA-Z0-9_-]+)['"]/g;

function walk(dir, files = []) {
  for (const f of readdirSync(dir)) {
    const full = join(dir, f);
    if (f.startsWith('.') || f === 'node_modules' || f === 'dist') continue;
    if (statSync(full).isDirectory()) walk(full, files);
    else if (
      f.endsWith('.js')
      || f.endsWith('.ts')
      || f.endsWith('.jsx')
      || f.endsWith('.tsx')
    ) {
      files.push(full);
    }
  }
  return files;
}

let failed = false;
const violations = [];

for (const file of walk(SRC_ROOT)) {
  const content = readFileSync(file, 'utf-8');
  let m;
  const re = new RegExp(INVOKE_RE.source, 'g');
  while ((m = re.exec(content)) !== null) {
    const fnName = m[1];
    if (!isDeployedEdgeFunction(fnName)) {
      violations.push({ fnName, file });
      failed = true;
    }
  }
}

if (failed) {
  for (const { fnName, file } of violations) {
    console.error(`GHOST CALL: ${fnName} in ${file}`);
  }
  console.error('\nFix ghost calls before merging (or deploy the function and add it to DEPLOYED_EDGE_FUNCTIONS).');
  process.exit(1);
} else {
  console.log('No ghost function calls found.');
}
