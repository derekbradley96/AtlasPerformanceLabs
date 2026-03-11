/**
 * Migration bodyweight history import service.
 *
 * CSV columns (case/spacing tolerant): client_email, date, weight, bodyfat, notes.
 * Inserts into: client_weight_logs (client_progress is a view over this).
 * After import, invalidate progress query cache so charts regenerate.
 *
 * Exports:
 * - parseProgressCSV(text) -> { rows }
 * - validateProgressRows(rows) -> { validRows, errors }
 * - resolveClientIdsByEmail(supabase, emails) -> Promise<Map<email, client_id>>
 * - insertWeightLogs({ rows, supabase, clientIdByEmail }) -> Promise<{ inserted, errors }>
 * - getProgressQueryKeysToInvalidate(clientIds) -> query keys array
 * - invalidateProgressCache(queryClient, clientIds) -> void
 */

function normaliseHeader(h) {
  return (h || '')
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, '_');
}

/**
 * Parse bodyweight history CSV.
 * Headers: client_email (or email), date (or log_date), weight, bodyfat, notes.
 *
 * @param {string} csvText
 * @returns {{ rows: Array<{ rowIndex: number, client_email: string, date: string, weight: number | null, bodyfat: number | null, notes: string | null }> }}
 */
export function parseProgressCSV(csvText) {
  const text = (csvText || '').toString().trim();
  if (!text) return { rows: [] };

  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return { rows: [] };

  const headerRaw = lines[0].split(',').map((h) => h.trim());
  const headers = headerRaw.map(normaliseHeader);

  const findIndex = (...candidates) => {
    const set = new Set(candidates.map(normaliseHeader));
    return headers.findIndex((h) => set.has(h));
  };

  const idxEmail = findIndex('client_email', 'email');
  const idxDate = findIndex('date', 'log_date', 'weigh_date');
  const idxWeight = findIndex('weight', 'bodyweight', 'body_weight');
  const idxBodyfat = findIndex('bodyfat', 'body_fat', 'bf');
  const idxNotes = findIndex('notes', 'note');

  const rows = [];

  for (let i = 1; i < lines.length; i += 1) {
    const cols = lines[i].split(',').map((c) => c.trim());
    const emailVal = (idxEmail >= 0 ? cols[idxEmail] || '' : '').trim().toLowerCase();
    const dateVal = (idxDate >= 0 ? cols[idxDate] || '' : '').trim();
    const weightRaw = idxWeight >= 0 ? cols[idxWeight] || '' : '';
    const bodyfatRaw = idxBodyfat >= 0 ? cols[idxBodyfat] || '' : '';
    const notesVal = idxNotes >= 0 ? (cols[idxNotes] || '').trim() || null : null;

    let weight = null;
    if (weightRaw !== '') {
      const n = Number(String(weightRaw).replace(',', '.'));
      if (!Number.isNaN(n)) weight = n;
    }
    let bodyfat = null;
    if (bodyfatRaw !== '') {
      const n = Number(String(bodyfatRaw).replace(',', '.'));
      if (!Number.isNaN(n)) bodyfat = n;
    }

    rows.push({
      rowIndex: i + 1,
      client_email: emailVal || '',
      date: dateVal,
      weight,
      bodyfat,
      notes: notesVal,
    });
  }

  return { rows };
}

/**
 * Normalise date string to YYYY-MM-DD for storage.
 *
 * @param {string} value
 * @returns {string | null}
 */
function normaliseDate(value) {
  if (!value || !String(value).trim()) return null;
  const s = String(value).trim();
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

/**
 * Validate parsed rows: require client_email and (date or weight).
 *
 * @param {ReturnType<typeof parseProgressCSV>['rows']} rows
 * @returns {{ validRows: Array<{ ...row, log_date: string | null }>, errors: Array<{ rowIndex: number, message: string }> }}
 */
export function validateProgressRows(rows) {
  const validRows = [];
  const errors = [];

  (rows || []).forEach((row) => {
    if (!row.client_email || !String(row.client_email).trim()) {
      errors.push({ rowIndex: row.rowIndex, message: 'Missing client_email' });
      return;
    }
    const logDate = normaliseDate(row.date);
    if (!logDate && row.weight == null) {
      errors.push({ rowIndex: row.rowIndex, message: 'Missing date and weight' });
      return;
    }
    validRows.push({
      ...row,
      log_date: logDate || null,
    });
  });

  return { validRows, errors };
}

/**
 * Resolve client_id for each email (coach's clients only; uses clients.email).
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string[]} emails
 * @param {string} [coachId] - optional; if provided, filter clients by coach_id/trainer_id
 * @returns {Promise<Map<string, string>>} email (lowercase) -> client_id
 */
export async function resolveClientIdsByEmail(supabase, emails, coachId) {
  const map = new Map();
  if (!supabase || !emails?.length) return map;

  const unique = [...new Set(emails.map((e) => (e || '').trim().toLowerCase()).filter(Boolean))];
  if (unique.length === 0) return map;

  let q = supabase
    .from('clients')
    .select('id, email')
    .in('email', unique);

  if (coachId) {
    q = q.or(`coach_id.eq.${coachId},trainer_id.eq.${coachId}`);
  }

  const { data, error } = await q;
  if (error) return map;

  (data || []).forEach((row) => {
    const email = (row.email || '').trim().toLowerCase();
    if (email && row.id) map.set(email, row.id);
  });

  return map;
}

/**
 * Insert validated rows into client_weight_logs. Uses clientIdByEmail to resolve client_id.
 * Dedupes by (client_id, log_date): later row wins (or use ON CONFLICT if we add unique constraint).
 *
 * @param {{
 *   rows: Array<{ client_email: string, log_date: string | null, weight: number | null, bodyfat: number | null, notes: string | null }>;
 *   supabase: import('@supabase/supabase-js').SupabaseClient;
 *   clientIdByEmail: Map<string, string>;
 * }} params
 * @returns {Promise<{ inserted: number, errors: Array<{ rowIndex: number, message: string }> }>}
 */
export async function insertWeightLogs({ rows, supabase, clientIdByEmail }) {
  const errors = [];
  let inserted = 0;

  if (!rows?.length || !supabase) {
    return { inserted: 0, errors: [{ rowIndex: 0, message: 'No rows or supabase client' }] };
  }

  for (const row of rows) {
    const email = (row.client_email || '').trim().toLowerCase();
    const clientId = clientIdByEmail.get(email);
    if (!clientId) {
      errors.push({ rowIndex: row.rowIndex, message: `Unknown client email: ${email || '(empty)'}` });
      continue;
    }
    const logDate = row.log_date || null;
    if (!logDate) {
      errors.push({ rowIndex: row.rowIndex, message: 'Missing or invalid date' });
      continue;
    }

    const { error } = await supabase.from('client_weight_logs').upsert(
      {
        client_id: clientId,
        log_date: logDate,
        weight: row.weight ?? null,
        bodyfat: row.bodyfat ?? null,
        notes: row.notes ?? null,
      },
      {
        onConflict: 'client_id,log_date',
        ignoreDuplicates: false,
      }
    );

    if (error) {
      errors.push({ rowIndex: row.rowIndex, message: error.message });
    } else {
      inserted += 1;
    }
  }

  return { inserted, errors };
}

/** Query key prefixes used by progress charts (React Query). */
export const PROGRESS_QUERY_KEY_PREFIXES = [
  'v_client_progress_trends',
  'v_client_progress_metrics',
  'v_weight_trends',
];

/**
 * Return query keys to invalidate for given client IDs so progress charts refetch.
 *
 * @param {string[]} clientIds
 * @returns {Array<string[]|string>} keys for queryClient.invalidateQueries({ predicate }) or exact keys
 */
export function getProgressQueryKeysToInvalidate(clientIds) {
  if (!clientIds?.length) return PROGRESS_QUERY_KEY_PREFIXES.map((p) => [p]);
  const keys = [];
  for (const prefix of PROGRESS_QUERY_KEY_PREFIXES) {
    keys.push([prefix]);
    for (const id of clientIds) {
      keys.push([prefix, id]);
    }
  }
  return keys;
}

/**
 * Invalidate progress-related React Query cache so charts regenerate after import.
 *
 * @param {import('@tanstack/react-query').QueryClient} queryClient
 * @param {string[]} [clientIds] - optional; if provided, invalidate per-client keys too
 */
export function invalidateProgressCache(queryClient, clientIds = []) {
  if (!queryClient) return;
  const prefixes = PROGRESS_QUERY_KEY_PREFIXES;
  const predicate = (query) => {
    const key = query.queryKey;
    if (!Array.isArray(key) || key.length === 0) return false;
    const first = key[0];
    if (prefixes.includes(first)) return true;
    return false;
  };
  queryClient.invalidateQueries({ predicate });
}

/**
 * Full flow: parse CSV, validate, resolve clients by email, insert into client_weight_logs,
 * then invalidate progress cache so charts regenerate.
 *
 * @param {{
 *   csvText: string;
 *   supabase: import('@supabase/supabase-js').SupabaseClient;
 *   queryClient: import('@tanstack/react-query').QueryClient;
 *   coachId: string;
 * }} params
 * @returns {Promise<{ inserted: number, errors: Array<{ rowIndex: number, message: string }> }>}
 */
export async function importBodyweightHistory({ csvText, supabase, queryClient, coachId }) {
  const { rows } = parseProgressCSV(csvText);
  const { validRows, errors: validationErrors } = validateProgressRows(rows);

  if (validRows.length === 0) {
    return { inserted: 0, errors: validationErrors };
  }

  const emails = [...new Set(validRows.map((r) => (r.client_email || '').trim().toLowerCase()).filter(Boolean))];
  const clientIdByEmail = await resolveClientIdsByEmail(supabase, emails, coachId);
  const { inserted, errors: insertErrors } = await insertWeightLogs({
    rows: validRows,
    supabase,
    clientIdByEmail,
  });

  if (inserted > 0 && queryClient) {
    const clientIds = [...new Set(validRows.map((r) => clientIdByEmail.get((r.client_email || '').trim().toLowerCase())).filter(Boolean))];
    invalidateProgressCache(queryClient, clientIds);
  }

  return {
    inserted,
    errors: [...validationErrors, ...insertErrors],
  };
}
