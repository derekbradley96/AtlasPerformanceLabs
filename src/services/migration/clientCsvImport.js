/**
 * Migration client CSV import service.
 *
 * Fields per row (header names are case/spacing tolerant):
 * - name (name, full_name, client_name)
 * - email
 * - phone
 * - start_date
 * - bodyweight (initial body weight)
 * - notes
 *
 * Exports:
 * - parseCSV(text) -> { rows }
 * - validateClientData(rows) -> { validRows, errors }
 * - createClientRecords({ rows, supabase? }) -> { created, errors }
 *
 * Notes:
 * - Dev / admin migration tooling — not the production invite/code acquisition path.
 * - It creates clients under the current coach id.
 * - It attempts to link to an existing profile (by email) when possible; if not found,
 *   it still creates the client without a profile (RLS-safe), and records a warning.
 */

import { getSupabase, hasSupabase } from '@/lib/supabaseClient';
import { createClient as insertCanonicalClient } from '@/data/supabaseClientsRepo';

function normaliseHeader(h) {
  return (h || '')
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, '_');
}

/**
 * Very small CSV parser for migration: header row + comma-separated values.
 * Does not fully handle quoted commas; good enough for simple migration sheets.
 *
 * @param {string} csvText
 * @returns {{ rows: Array<{ raw: Record<string,string>, name: string | null, email: string | null, phone: string | null, startDate: string | null, bodyweight: number | null, notes: string | null }> }}
 */
export function parseCSV(csvText) {
  const text = (csvText || '').toString().trim();
  if (!text) return { rows: [] };

  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return { rows: [] };

  const headerRaw = lines[0].split(',').map((h) => h.trim());
  const headers = headerRaw.map(normaliseHeader);

  const findIndex = (...candidates) => {
    const set = new Set(candidates.map(normaliseHeader));
    return headers.findIndex((h) => set.has(h));
  };

  const idxName = findIndex('name', 'full_name', 'client_name');
  const idxEmail = findIndex('email');
  const idxPhone = findIndex('phone', 'phone_number');
  const idxStartDate = findIndex('start_date', 'start', 'joined_at');
  const idxBodyweight = findIndex('bodyweight', 'body_weight', 'weight');
  const idxNotes = findIndex('notes', 'note');

  const rows = [];

  for (let i = 1; i < lines.length; i += 1) {
    const cols = lines[i].split(',').map((c) => c.trim());
    const raw = {};
    headers.forEach((h, idx) => {
      raw[h] = cols[idx] ?? '';
    });

    const nameVal = idxName >= 0 ? cols[idxName] || '' : '';
    const emailVal = idxEmail >= 0 ? cols[idxEmail] || '' : '';
    const phoneVal = idxPhone >= 0 ? cols[idxPhone] || '' : '';
    const startDateVal = idxStartDate >= 0 ? cols[idxStartDate] || '' : '';
    const bodyweightRaw = idxBodyweight >= 0 ? cols[idxBodyweight] || '' : '';
    const notesVal = idxNotes >= 0 ? cols[idxNotes] || '' : '';

    let bodyweight = null;
    if (bodyweightRaw) {
      const n = Number(bodyweightRaw.replace(',', '.'));
      bodyweight = Number.isNaN(n) ? null : n;
    }

    rows.push({
      raw,
      name: nameVal || null,
      email: emailVal || null,
      phone: phoneVal || null,
      startDate: startDateVal || null,
      bodyweight,
      notes: notesVal || null,
    });
  }

  return { rows };
}

/**
 * Validate parsed rows and return clean rows + validation errors.
 * - Requires at least name OR email.
 * - startDate is kept as-is; caller can normalise/convert if needed.
 *
 * @param {ReturnType<typeof parseCSV>['rows']} rows
 * @returns {{ validRows: typeof rows, errors: Array<{ rowIndex: number, message: string }> }}
 */
export function validateClientData(rows) {
  const validRows = [];
  const errors = [];

  (rows || []).forEach((row, index) => {
    if (!row.name && !row.email) {
      errors.push({ rowIndex: index, message: 'Missing both name and email' });
      return;
    }
    validRows.push(row);
  });

  return { validRows, errors };
}

/**
 * Create client records from validated rows.
 * Uses the same canonical insert as manual add and CSV import (`supabaseClientsRepo.createClient`).
 * Attempts to link user_id when a profile exists for the email (RLS may hide it).
 *
 * @param {{ rows: ReturnType<typeof parseCSV>['rows'], supabase?: import('@supabase/supabase-js').SupabaseClient | null }} params
 * @returns {Promise<{ created: Array<{ clientId: string, name: string | null, email: string | null }>, errors: Array<{ rowIndex: number, message: string }> }>}
 */
export async function createClientRecords({ rows, supabase }) {
  const created = [];
  const errors = [];
  if (!rows || rows.length === 0) return { created, errors };

  const client = supabase ?? (hasSupabase ? getSupabase() : null);
  if (!client) throw new Error('Supabase client is required to create clients');

  const {
    data: { user },
  } = await client.auth.getUser();
  const coachId = user?.id ?? null;
  if (!coachId) throw new Error('Could not resolve coach id for migration import');

  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    try {
      const email = row.email?.toString().trim() || null;
      let profileId = null;

      if (email) {
        try {
          const { data: existingProfile } = await client
            .from('profiles')
            .select('id')
            .eq('email', email)
            .maybeSingle();
          if (existingProfile?.id) {
            profileId = existingProfile.id;
          }
        } catch (_) {
          // ignore profile lookup errors (likely RLS); still create client record
        }
      }

      const noteParts = [];
      if (row.notes) noteParts.push(String(row.notes).trim());
      if (row.phone) noteParts.push(`Imported phone: ${String(row.phone).trim()}`);

      const payload = {
        full_name: row.name || email || 'Imported Client',
        email: email || undefined,
        client_type: 'transformation',
        client_journey: 'transformation',
        start_date: row.startDate ? String(row.startDate).trim().slice(0, 10) : undefined,
        onboarding_notes: noteParts.length > 0 ? noteParts.join('\n') : undefined,
        baseline_weight: row.bodyweight != null ? Number(row.bodyweight) : undefined,
        phase_started_at: row.startDate ? String(row.startDate).trim().slice(0, 10) : undefined,
        user_id: profileId || undefined,
      };

      const inserted = await insertCanonicalClient(coachId, payload);

      created.push({
        clientId: inserted.id,
        name: inserted.name ?? null,
        email: email ?? (inserted.email != null ? String(inserted.email) : null),
      });
    } catch (e) {
      errors.push({ rowIndex: i, message: e?.message || 'Unexpected error' });
    }
  }

  return { created, errors };
}

