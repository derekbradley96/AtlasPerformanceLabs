/**
 * Import Programs – coach tool to import a program from CSV.
 *
 * Columns: exercise, sets, reps, rest, notes.
 * Maps to: program_blocks → program_weeks → program_days → program_exercises.
 * If an exercise name doesn't match the Atlas library, shows mapping UI to pick a library exercise or keep as-is.
 */
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import TopBar from '@/components/ui/TopBar';
import Card from '@/ui/Card';
import { Button } from '@/components/ui/button';
import { colors, spacing } from '@/ui/tokens';
import { hasSupabase, getSupabase } from '@/lib/supabaseClient';
import { toast } from 'sonner';
import { isCoach } from '@/lib/roles';
import { useAuth } from '@/lib/AuthContext';
import {
  parseProgramCSV,
  validateProgramRows,
  matchExercises,
  createProgramFromRows,
} from '@/services/migration/programImportService';
import { trackFriction } from '@/services/frictionTracker';
import { User, CheckCircle2, AlertCircle } from 'lucide-react';

async function fetchCoachClients() {
  if (!hasSupabase()) return [];
  const supabase = getSupabase();
  if (!supabase) return [];
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) return [];
  const { data, error } = await supabase
    .from('clients')
    .select('id, full_name, name')
    .or(`coach_id.eq.${user.id},trainer_id.eq.${user.id}`)
    .order('full_name');
  if (error) return [];
  return (data || []).map((c) => ({
    id: c.id,
    name: c.full_name || c.name || 'Client',
  }));
}

const KEEP_AS_IS = '__keep_as_is__';

export default function ImportProgramsPage() {
  const navigate = useNavigate();
  const { effectiveRole } = useAuth();
  const [csvText, setCsvText] = useState('');
  const [clientId, setClientId] = useState('');
  const [blockTitle, setBlockTitle] = useState('');
  const [parsed, setParsed] = useState(null);
  const [exerciseMapping, setExerciseMapping] = useState({});
  const [loading, setLoading] = useState(false);
  const [createdBlockId, setCreatedBlockId] = useState(null);

  const isCoachRole = isCoach(effectiveRole);

  const { data: clients = [], isLoading: loadingClients } = useQuery({
    queryKey: ['coach_clients_for_program_import'],
    queryFn: fetchCoachClients,
    enabled: hasSupabase() && isCoachRole,
  });

  const handleFileChange = (e) => {
    const file = e.target?.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = (ev.target?.result || '').toString();
      setCsvText(text);
      setParsed(null);
      setExerciseMapping({});
    };
    reader.readAsText(file);
  };

  const handleParse = () => {
    try {
      const { rows } = parseProgramCSV(csvText);
      const { validRows, errors } = validateProgramRows(rows);
      if (validRows.length === 0) {
        toast.error('No valid rows. Need at least exercise names.');
        setParsed(null);
        return;
      }
      const { rowsWithMatch, unmapped } = matchExercises(validRows);
      setParsed({
        rowsWithMatch,
        unmapped,
        validationErrors: errors,
      });
      const initialMapping = {};
      unmapped.forEach(({ csvName }) => {
        initialMapping[csvName] = KEEP_AS_IS;
      });
      setExerciseMapping(initialMapping);
      toast.success(`Parsed ${validRows.length} exercise(s). ${unmapped.length} need mapping.`);
    } catch (e) {
      trackFriction('import_failed', { source: 'programs', phase: 'parse', error: e?.message });
      toast.error(e?.message || 'Could not parse CSV');
      setParsed(null);
    }
  };

  const handleImport = async () => {
    if (!parsed?.rowsWithMatch?.length) {
      toast.error('Parse a CSV first.');
      return;
    }
    if (!clientId) {
      toast.error('Select a client.');
      return;
    }
    if (!hasSupabase()) {
      toast.error('Supabase is not available.');
      return;
    }
    const ok =
      typeof window !== 'undefined' &&
      window.confirm(
        `Create program "${blockTitle || 'Imported program'}" for this client with ${parsed.rowsWithMatch.length} exercise(s)?`
      );
    if (!ok) return;

    setLoading(true);
    try {
      const supabase = getSupabase();
      const mappingForService = { ...exerciseMapping };
      Object.keys(mappingForService).forEach((k) => {
        if (mappingForService[k] === KEEP_AS_IS) mappingForService[k] = k;
      });

      const result = await createProgramFromRows({
        rows: parsed.rowsWithMatch,
        clientId,
        blockTitle: blockTitle || 'Imported program',
        totalWeeks: 1,
        supabase,
        exerciseMapping: mappingForService,
      });

      if (result.errors.length > 0 && result.exercisesCreated === 0) {
        toast.error(result.errors[0]?.message || 'Import failed');
        return;
      }
      if (result.exercisesCreated > 0) {
        setCreatedBlockId(result.blockId);
        toast.success(`Created program with ${result.exercisesCreated} exercise(s).`);
      }
      if (result.errors.length > 0) {
        toast.error(`Some exercises failed: ${result.errors.length}. See console.`);
        if (import.meta.env?.DEV) console.error('Program import errors', result.errors);
      }
    } catch (e) {
      trackFriction('import_failed', { source: 'programs', phase: 'create', error: e?.message });
      toast.error(e?.message || 'Could not create program');
    } finally {
      setLoading(false);
    }
  };

  const setMappingFor = (csvName, value) => {
    setExerciseMapping((prev) => ({ ...prev, [csvName]: value }));
  };

  if (!isCoachRole) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ background: colors.bg }}>
        <p style={{ color: colors.muted }}>This page is for coaches only.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-24" style={{ background: colors.bg, color: colors.text }}>
      <TopBar title="Import program" onBack={() => navigate(-1)} />

      <div className="p-4 space-y-4">
        <Card style={{ padding: spacing[16] }}>
          <p className="text-sm mb-3" style={{ color: colors.text }}>
            Import a program from CSV. Columns: <strong>exercise</strong>, sets, reps, rest, notes. All exercises
            will be added to Week 1, Day 1.
          </p>

          <label className="block text-xs font-medium mb-1" style={{ color: colors.muted }}>
            Client
          </label>
          <div className="flex items-center gap-2 mb-3">
            <User size={16} style={{ color: colors.muted }} />
            <select
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              className="flex-1 text-sm rounded-lg border px-3 py-2"
              style={{
                background: colors.surface1,
                borderColor: colors.border,
                color: colors.text,
              }}
              disabled={loadingClients}
            >
              <option value="">Select client…</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <label className="block text-xs font-medium mb-1" style={{ color: colors.muted }}>
            Program name
          </label>
          <input
            type="text"
            value={blockTitle}
            onChange={(e) => setBlockTitle(e.target.value)}
            placeholder="e.g. Push Day"
            className="w-full text-sm rounded-lg border px-3 py-2 mb-3"
            style={{
              background: colors.surface1,
              borderColor: colors.border,
              color: colors.text,
            }}
          />

          <label className="block text-xs font-medium mb-1" style={{ color: colors.muted }}>
            CSV file or paste
          </label>
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={handleFileChange}
            className="text-xs mb-2"
            style={{ color: colors.muted }}
          />
          <textarea
            value={csvText}
            onChange={(e) => {
              setCsvText(e.target.value);
              setParsed(null);
            }}
            rows={8}
            placeholder="Paste CSV here (header: exercise, sets, reps, rest, notes)…"
            className="w-full text-sm rounded-lg border px-3 py-2 font-mono"
            style={{
              background: colors.surface1,
              borderColor: colors.border,
              color: colors.text,
              resize: 'vertical',
            }}
          />
          <div className="flex flex-wrap gap-2 mt-3">
            <Button
              size="sm"
              variant="outline"
              onClick={handleParse}
              disabled={!csvText.trim() || loading}
            >
              Parse CSV
            </Button>
            <Button
              size="sm"
              onClick={handleImport}
              disabled={!parsed?.rowsWithMatch?.length || !clientId || loading}
            >
              {loading ? 'Creating…' : 'Create program'}
            </Button>
            {createdBlockId && (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => navigate(`/program-builder?clientId=${encodeURIComponent(clientId)}&blockId=${encodeURIComponent(createdBlockId)}`)}
              >
                Open in builder
              </Button>
            )}
          </div>
        </Card>

        {parsed && parsed.rowsWithMatch.length > 0 && (
          <>
            <Card style={{ padding: spacing[16] }}>
              <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: colors.muted }}>
                Preview ({parsed.rowsWithMatch.length} exercises)
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr style={{ borderBottom: `1px solid ${colors.border}` }}>
                      <th className="text-left py-1 pr-2" style={{ color: colors.muted }}>#</th>
                      <th className="text-left py-1 pr-2" style={{ color: colors.muted }}>Exercise</th>
                      <th className="text-left py-1 pr-2" style={{ color: colors.muted }}>Sets</th>
                      <th className="text-left py-1 pr-2" style={{ color: colors.muted }}>Reps</th>
                      <th className="text-left py-1 pr-2" style={{ color: colors.muted }}>Rest</th>
                      <th className="text-left py-1 pr-2" style={{ color: colors.muted }}>Match</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsed.rowsWithMatch.slice(0, 15).map((row, idx) => (
                      <tr key={idx} style={{ borderBottom: `1px solid ${colors.border}` }}>
                        <td className="py-1 pr-2" style={{ color: colors.muted }}>{idx + 1}</td>
                        <td className="py-1 pr-2" style={{ color: colors.text }}>{row.exercise || '—'}</td>
                        <td className="py-1 pr-2" style={{ color: colors.text }}>{row.sets ?? '—'}</td>
                        <td className="py-1 pr-2" style={{ color: colors.text }}>{row.reps ?? '—'}</td>
                        <td className="py-1 pr-2" style={{ color: colors.text }}>{row.rest || '—'}</td>
                        <td className="py-1 pr-2">
                          {row.matchedName ? (
                            <span className="inline-flex items-center gap-1" style={{ color: colors.primary }}>
                              <CheckCircle2 size={12} /> {row.matchedName}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1" style={{ color: colors.muted }}>
                              <AlertCircle size={12} /> Map below
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {parsed.rowsWithMatch.length > 15 && (
                <p className="text-xs mt-2" style={{ color: colors.muted }}>
                  + {parsed.rowsWithMatch.length - 15} more
                </p>
              )}
            </Card>

            {parsed.unmapped.length > 0 && (
              <Card style={{ padding: spacing[16] }}>
                <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: colors.muted }}>
                  <AlertCircle size={14} className="inline mr-1" />
                  Map exercises to Atlas library
                </p>
                <p className="text-sm mb-3" style={{ color: colors.text }}>
                  These names didn’t match. Choose a library exercise or keep the CSV name.
                </p>
                <ul className="space-y-3">
                  {parsed.unmapped.map(({ csvName, suggestions }) => (
                    <li key={csvName} className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium shrink-0" style={{ color: colors.text }}>
                        {csvName}
                      </span>
                      <span className="text-xs" style={{ color: colors.muted }}>→</span>
                      <select
                        value={exerciseMapping[csvName] ?? KEEP_AS_IS}
                        onChange={(e) => setMappingFor(csvName, e.target.value)}
                        className="text-sm rounded-lg border px-2 py-1.5 min-w-[180px]"
                        style={{
                          background: colors.surface1,
                          borderColor: colors.border,
                          color: colors.text,
                        }}
                      >
                        <option value={KEEP_AS_IS}>Keep as-is: “{csvName}”</option>
                        {suggestions.map((s) => (
                          <option key={s.id} value={s.name}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                    </li>
                  ))}
                </ul>
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  );
}
