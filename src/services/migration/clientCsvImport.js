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
 * - This is aimed at migration flows run by a coach/Admin user.
 * - It creates clients under the current coach id.
 * - It attempts to link to an existing profile (by email) when possible; if not found,
 *   it still creates the client without a profile (RLS-safe), and records a warning.
 */

import { getSupabase, hasSupabase } from '@/lib/supabaseClient';

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
 * - Uses Supabase auth to resolve current coach id.
 * - Inserts into public.clients with minimal, safe fields:
 *   - full_name, email, phone, notes, baseline_weight, phase_started_at (from startDate)
 *   - trainer_id / coach_id depending on schema (we set both when present).
 * - Attempts to link to an existing profile by email when RLS allows; otherwise, warns.
 *
 * @param {{ rows: ReturnType<typeof parseCSV>['rows'], supabase?: import('@supabase/supabase-js').SupabaseClient | null }} params
 * @returns {Promise<{ created: Array<{ clientId: string, name: string | null, email: string | null }>, errors: Array<{ rowIndex: number, message: string }> }>}
 */
export async function createClientRecords({ rows, supabase }) {
  const created = [];
  const errors = [];
  if (!rows || rows.length === 0) return { created, errors };

  const client = supabase ?? (hasSupabase() ? getSupabase() : null);
  if (!client) throw new Error('Supabase client is required to create clients');

  const {
    data: { user },
  } = await client.auth.getUser();
  const coachId = user?.id ?? null;

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

      const payload = {
        full_name: row.name || email || 'Imported Client',
        email,
        phone: row.phone || null,
        notes: row.notes || null,
        baseline_weight: row.bodyweight != null ? Number(row.bodyweight) : null,
        phase_started_at: row.startDate || null,
        trainer_id: coachId, // canonical schema
        coach_id: coachId, // newer schema
        user_id: profileId,
      };

      const { data: inserted, error } = await client
        .from('clients')
        .insert(payload)
        .select('id, full_name, email')
        .maybeSingle();

      if (error || !inserted) {
        errors.push({ rowIndex: i, message: error?.message || 'Insert failed' });
        continue;
      }

      created.push({
        clientId: inserted.id,
        name: inserted.full_name ?? null,
        email: inserted.email ?? null,
      });
    } catch (e) {
      errors.push({ rowIndex: i, message: e?.message || 'Unexpected error' });
    }
  }

  return { created, errors };
}

