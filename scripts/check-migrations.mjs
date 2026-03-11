#!/usr/bin/env node
/**
 * Check supabase migrations for common issues that cause db push failures.
 * Run before: npm run db:push
 *
 * Checks:
 * 1. Duplicate version (timestamp) prefix → schema_migrations_pkey violation
 */

import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

const migrationsDir = join(process.cwd(), 'supabase', 'migrations');
const versionPrefixRe = /^(\d+)_/;

function getMigrations() {
  try {
    return readdirSync(migrationsDir)
      .filter((f) => f.endsWith('.sql'))
      .sort();
  } catch (e) {
    console.error('Could not read supabase/migrations:', e.message);
    process.exit(1);
  }
}

function extractVersion(filename) {
  const m = filename.match(versionPrefixRe);
  return m ? m[1] : null;
}

function checkDuplicateVersions(files) {
  const byVersion = new Map();
  for (const f of files) {
    const v = extractVersion(f);
    if (!v) continue;
    if (!byVersion.has(v)) byVersion.set(v, []);
    byVersion.get(v).push(f);
  }
  const duplicates = [...byVersion.entries()].filter(([, list]) => list.length > 1);
  return duplicates;
}

function checkReservedWordInSchema(files) {
  const reserved = ['placing', 'user', 'order', 'check', 'group', 'limit'];
  const issues = [];
  for (const f of files) {
    const path = join(migrationsDir, f);
    const sql = readFileSync(path, 'utf8');
    for (const word of reserved) {
      const unquotedRe = new RegExp(`\\b${word}\\s+(?:TEXT|INTEGER|UUID|JSONB|TIMESTAMPTZ|DATE|NUMERIC|BOOLEAN)`, 'i');
      if (unquotedRe.test(sql) && !sql.includes(`"${word}"`)) {
        issues.push({ file: f, word });
      }
    }
  }
  return issues;
}

// --- main
const files = getMigrations();
let exitCode = 0;

const duplicates = checkDuplicateVersions(files);
if (duplicates.length > 0) {
  console.error('❌ Duplicate migration version (will cause schema_migrations_pkey violation):');
  for (const [version, list] of duplicates) {
    console.error(`   Version ${version}: ${list.join(', ')}`);
  }
  console.error('   Fix: rename one file to a unique timestamp prefix (see supabase/MIGRATION_CHECKLIST.md)\n');
  exitCode = 1;
} else {
  console.log('✓ No duplicate migration versions.');
}

const reservedIssues = checkReservedWordInSchema(files);
if (reservedIssues.length > 0) {
  console.warn('⚠ Possible unquoted reserved word (may cause syntax error):');
  for (const { file, word } of reservedIssues) {
    console.warn(`   ${file}: column "${word}" → use "placing" (quoted) in SQL`);
  }
  console.warn('   See supabase/MIGRATION_CHECKLIST.md\n');
  exitCode = 1;
} else {
  console.log('✓ No obvious unquoted reserved-word columns.');
}

if (exitCode === 0) {
  console.log('\nMigration check passed. Run npm run db:push when ready.');
}
process.exit(exitCode);
