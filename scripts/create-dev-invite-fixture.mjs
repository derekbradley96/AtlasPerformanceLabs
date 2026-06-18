#!/usr/bin/env node
/**
 * Dev-only helper: provisions a temporary coach fixture with a known referral code.
 *
 * Usage:
 *   node scripts/create-dev-invite-fixture.mjs --code atlas-live-fixture
 *   node scripts/create-dev-invite-fixture.mjs --code atlas-live-fixture --email qa.coach.fixture@atlas.test
 *
 * Requires:
 *   - linked Supabase project (`supabase link`)
 *   - authenticated Supabase CLI
 */

import { execSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

function readArg(flag) {
  const idx = process.argv.findIndex((arg) => arg === flag);
  if (idx < 0) return null;
  return process.argv[idx + 1] ?? null;
}

const now = new Date();
const stamp = `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, '0')}${String(now.getUTCDate()).padStart(2, '0')}${String(now.getUTCHours()).padStart(2, '0')}${String(now.getUTCMinutes()).padStart(2, '0')}`;
const referralCode = (readArg('--code') ?? `atlas-live-fixture-${stamp}`).trim().toLowerCase();
const email = (readArg('--email') ?? `qa.coach.fixture.${stamp}@atlas.test`).trim().toLowerCase();
const displayName = (readArg('--name') ?? 'QA Coach Fixture').trim();
const password = (readArg('--password') ?? 'AtlasFixture!2026').trim();

if (!referralCode) {
  console.error('Missing --code value');
  process.exit(1);
}

const esc = (v) => v.replace(/'/g, "''");

const sql = `
with existing_user as (
  select id, email
  from auth.users
  where lower(email) = lower('${esc(email)}')
  limit 1
),
inserted_user as (
  insert into auth.users (
    id,
    instance_id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    created_at,
    updated_at,
    raw_app_meta_data,
    raw_user_meta_data,
    is_super_admin,
    is_sso_user,
    is_anonymous
  )
  select
    gen_random_uuid(),
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    '${esc(email)}',
    crypt('${esc(password)}', gen_salt('bf')),
    now(),
    now(),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object(
      'role', 'coach',
      'display_name', '${esc(displayName)}',
      'referral_code', '${esc(referralCode)}'
    ),
    false,
    false,
    false
  where not exists (select 1 from existing_user)
  returning id, email
),
upsert_user as (
  select id, email from existing_user
  union all
  select id, email from inserted_user
),
release_code as (
  update public.profiles
  set referral_code = null
  where referral_code = '${esc(referralCode)}'
    and id <> (select id from upsert_user limit 1)
  returning id
),
forced_release as (
  select count(*) as released_rows
  from release_code
),
ensure_profile as (
  insert into public.profiles (id, user_id, role, referral_code, display_name, onboarding_complete)
  select id, id, 'coach', '${esc(referralCode)}', '${esc(displayName)}', true
  from upsert_user, forced_release
  on conflict (id) do update
    set user_id = coalesce(public.profiles.user_id, excluded.user_id),
        role = 'coach',
        referral_code = '${esc(referralCode)}',
        display_name = excluded.display_name,
        onboarding_complete = true
  returning id, role, referral_code, display_name
)
select p.id, u.email, p.role, p.referral_code, p.display_name
from ensure_profile p
join upsert_user u on u.id = p.id;
`.trim();

console.log('Creating dev coach fixture...');
const tempDir = mkdtempSync(join(tmpdir(), 'atlas-dev-fixture-'));
const sqlFile = join(tempDir, 'fixture.sql');
writeFileSync(sqlFile, `${sql}\n`, 'utf8');
try {
  execSync(`npx supabase db query --linked --file "${sqlFile}"`, { stdio: 'inherit' });
} finally {
  rmSync(tempDir, { recursive: true, force: true });
}
console.log('\nFixture ready:');
console.log(`- Coach email: ${email}`);
console.log(`- Coach password: ${password}`);
console.log(`- Referral code: ${referralCode}`);

