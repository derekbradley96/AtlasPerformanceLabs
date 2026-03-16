/**
 * Client import service: parse CSV exports from other coaching apps and
 * prepare/create Atlas clients, programs, and (optionally) progress data.
 *
 * This module is intentionally conservative: it focuses on safe parsing and
 * minimal inserts. Heavier mapping can be layered on top in the UI.
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
 * Parse a CSV string into a normalised client import structure.
 * Supported logical fields (case/spacing tolerant):
 * - client name (name, full_name, client_name)
 * - email
 * - body weight history (JSON string or semicolon list \"YYYY-MM-DD:WEIGHT\")
 * - program name (program, program_name)
 * - exercise weights (JSON string)
 *
 * @param {string} csvText
 * @returns {{ rows: Array<{
 *   raw: Record<string,string>,
 *   clientName: string | null,
 *   email: string | null,
 *   programName: string | null,
 *   bodyWeightHistory: Array<{ date: string, weight: number }>,
 *   exerciseWeights: Array<Record<string, any>>,
 * }> }}
 */
export function parseClientCSV(csvText) {
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

  const idxName = findIndex('client_name', 'name', 'full_name');
  const idxEmail = findIndex('email');
  const idxWeightHistory = findIndex('body_weight_history', 'weight_history');
  const idxProgram = findIndex('program_name', 'program');
  const idxExerciseWeights = findIndex('exercise_weights');

  const rows = [];

  for (let i = 1; i < lines.length; i += 1) {
    const cols = lines[i].split(',').map((c) => c.trim());
    const raw = {};
    headers.forEach((h, idx) => {
      raw[h] = cols[idx] ?? '';
    });

    const clientName = idxName >= 0 ? cols[idxName] || null : null;
    const email = idxEmail >= 0 ? cols[idxEmail] || null : null;
    const programName = idxProgram >= 0 ? cols[idxProgram] || null : null;

    const bodyWeightHistory = [];
    if (idxWeightHistory >= 0 && cols[idxWeightHistory]) {
      const rawVal = cols[idxWeightHistory];
      try {
        if (rawVal.trim().startsWith('[') || rawVal.trim().startsWith('{')) {
          const parsed = JSON.parse(rawVal);
          const arr = Array.isArray(parsed) ? parsed : [parsed];
          for (const item of arr) {
            const date = (item.date || item.d || '').toString();
            const weight = Number(item.weight ?? item.w);
            if (date && !Number.isNaN(weight)) {
              bodyWeightHistory.push({ date, weight });
            }
          }
        } else {
          // Fallback: \"YYYY-MM-DD:WEIGHT;YYYY-MM-DD:WEIGHT\"
          rawVal.split(';').forEach((segment) => {
            const [d, w] = segment.split(':').map((s) => s.trim());
            const weight = Number(w);
            if (d && !Number.isNaN(weight)) {
              bodyWeightHistory.push({ date: d, weight });
            }
          });
        }
      } catch {
        // ignore parse errors; leave history empty
      }
    }

    let exerciseWeights = [];
    if (idxExerciseWeights >= 0 && cols[idxExerciseWeights]) {
      try {
        const parsed = JSON.parse(cols[idxExerciseWeights]);
        if (Array.isArray(parsed)) exerciseWeights = parsed;
        else if (parsed && typeof parsed === 'object') exerciseWeights = [parsed];
      } catch {
        exerciseWeights = [];
      }
    }

    rows.push({
      raw,
      clientName: clientName && clientName.length > 0 ? clientName : null,
      email: email && email.length > 0 ? email : null,
      programName: programName && programName.length > 0 ? programName : null,
      bodyWeightHistory,
      exerciseWeights,
    });
  }

  return { rows };
}

/**
 * Create Atlas clients from parsed CSV rows.
 * - Uses Supabase auth to resolve current coach id when not provided.
 * - Inserts into public.clients with minimal fields (full_name, email, coach_id).
 *
 * @param {{ rows: ReturnType<typeof parseClientCSV>['rows'], supabase?: import('@supabase/supabase-js').SupabaseClient | null, coachId?: string | null }} params
 * @returns {Promise<{ created: Array<{ clientId: string, name: string | null, email: string | null }>, errors: Array<{ rowIndex: number, message: string }> }>}
 */
export async function createClients({ rows, supabase, coachId }) {
  const created = [];
  const errors = [];
  if (!rows || rows.length === 0) return { created, errors };

  const client = supabase ?? (hasSupabase ? getSupabase() : null);
  if (!client) {
    throw new Error('Supabase client is required to create clients');
  }

  let coachIdResolved = coachId ?? null;
  if (!coachIdResolved) {
    const { data: { user } } = await client.auth.getUser();
    coachIdResolved = user?.id ?? null;
  }

  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    if (!row.clientName && !row.email) {
      errors.push({ rowIndex: i, message: 'Missing client name and email' });
      continue;
    }
    try {
      const payload = {
        full_name: row.clientName ?? row.email ?? 'Imported Client',
        email: row.email ?? null,
        coach_id: coachIdResolved,
      };
      const { data, error } = await client
        .from('clients')
        .insert(payload)
        .select('id, full_name, email')
        .maybeSingle();
      if (error || !data) {
        errors.push({ rowIndex: i, message: error?.message || 'Insert failed' });
      } else {
        created.push({ clientId: data.id, name: data.full_name ?? null, email: data.email ?? null });
      }
    } catch (e) {
      errors.push({ rowIndex: i, message: e?.message || 'Unexpected error' });
    }
  }

  return { created, errors };
}

/**
 * Map imported program names to simple program descriptors.
 * This is a pure helper – it does not write to the database.
 *
 * @param {{ rows: ReturnType<typeof parseClientCSV>['rows'], createdClients: Array<{ clientId: string, name: string | null, email: string | null }> }} params
 * @returns {{ programsByName: Record<string, { name: string, clients: string[] }> }}
 */
export function mapPrograms({ rows, createdClients }) {
  const programsByName = {};
  const clientByEmail = new Map(
    (createdClients || []).map((c) => [c.email?.toLowerCase() ?? '', c.clientId])
  );

  rows.forEach((row) => {
    const name = (row.programName || '').toString().trim();
    if (!name) return;
    const key = name;
    if (!programsByName[key]) {
      programsByName[key] = { name, clients: [] };
    }
    const emailKey = (row.email || '').toLowerCase();
    const clientId = clientByEmail.get(emailKey);
    if (clientId && !programsByName[key].clients.includes(clientId)) {
      programsByName[key].clients.push(clientId);
    }
  });

  return { programsByName };
}

/**
 * Import progress data (weight history, exercise weights).
 * Currently:
 * - bodyWeightHistory is returned in the summary only (safe; no checkin backfill).
 * - exerciseWeights are inserted into exercise_performance when possible.
 *
 * @param {{ rows: ReturnType<typeof parseClientCSV>['rows'], createdClients: Array<{ clientId: string, name: string | null, email: string | null }>, supabase?: import('@supabase/supabase-js').SupabaseClient | null }} params
 * @returns {Promise<{ exercisePerformanceInserted: number, bodyWeightHistoryPlanned: number }>}
 */
export async function importProgressData({ rows, createdClients, supabase }) {
  const client = supabase ?? (hasSupabase ? getSupabase() : null);
  if (!client) {
    throw new Error('Supabase client is required to import progress data');
  }

  const clientIdByEmail = new Map(
    (createdClients || []).map((c) => [c.email?.toLowerCase() ?? '', c.clientId])
  );

  let exercisePerformanceInserted = 0;
  let bodyWeightHistoryPlanned = 0;

  for (const row of rows) {
    const emailKey = (row.email || '').toLowerCase();
    const clientId = clientIdByEmail.get(emailKey);
    if (!clientId) continue;

    // Count weight history entries (for reporting only)
    if (Array.isArray(row.bodyWeightHistory)) {
      bodyWeightHistoryPlanned += row.bodyWeightHistory.length;
    }

    // Insert exercise weights into exercise_performance (best-effort)
    if (Array.isArray(row.exerciseWeights) && row.exerciseWeights.length > 0) {
      const payloads = [];
      for (const item of row.exerciseWeights) {
        const weight = item.weight ?? item.load ?? null;
        const reps = item.reps ?? null;
        const rir = item.rir ?? null;
        if (weight == null && reps == null && rir == null) continue;
        payloads.push({
          client_id: clientId,
          exercise_id: item.exercise_id ?? null,
          weight: weight != null ? Number(weight) : null,
          reps: reps != null ? Number(reps) : null,
          rir: rir != null ? Number(rir) : null,
          session_id: null,
        });
      }
      if (payloads.length > 0) {
        const { error } = await client.from('exercise_performance').insert(payloads);
        if (!error) {
          exercisePerformanceInserted += payloads.length;
        }
      }
    }
  }

  return { exercisePerformanceInserted, bodyWeightHistoryPlanned };
}

