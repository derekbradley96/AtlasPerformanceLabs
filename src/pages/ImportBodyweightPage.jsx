/**
 * Import bodyweight history – paste or upload CSV (client_email, date, weight, bodyfat, notes).
 * Calls progressImportService.importBodyweightHistory; invalidates progress cache so charts update.
 */
import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import TopBar from '@/components/ui/TopBar';
import Card from '@/ui/Card';
import { Button } from '@/components/ui/button';
import { colors, spacing } from '@/ui/tokens';
import { hasSupabase, getSupabase } from '@/lib/supabaseClient';
import { useAuth } from '@/lib/AuthContext';
import { parseProgressCSV, validateProgressRows, importBodyweightHistory } from '@/services/migration/progressImportService';
import { toast } from 'sonner';
import { trackFriction } from '@/services/frictionTracker';
import { FileSpreadsheet } from 'lucide-react';

export default function ImportBodyweightPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const coachId = user?.id ?? null;

  const [csvText, setCsvText] = useState('');
  const [parsed, setParsed] = useState(null);
  const [validation, setValidation] = useState(null);
  const [loading, setLoading] = useState(false);
  const [importResult, setImportResult] = useState(null);

  const handleParse = useCallback(() => {
    setImportResult(null);
    try {
      const { rows } = parseProgressCSV(csvText);
      const { validRows, errors } = validateProgressRows(rows);
      setParsed({ rows, validRows, errors });
      setValidation({ validRows, errors });
      if (rows.length === 0) {
        toast.info('No rows found. Use headers: client_email, date, weight, bodyfat, notes');
      } else {
        toast.success(`Parsed ${rows.length} rows · ${validRows.length} valid, ${errors.length} errors`);
      }
    } catch (e) {
      trackFriction('import_failed', { source: 'bodyweight', phase: 'parse', error: e?.message });
      toast.error(e?.message ?? 'Could not parse CSV');
      setParsed(null);
      setValidation(null);
    }
  }, [csvText]);

  const handleFileChange = useCallback((e) => {
    const file = e.target?.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setCsvText(String(reader.result ?? ''));
      setParsed(null);
      setValidation(null);
      setImportResult(null);
    };
    reader.readAsText(file);
    e.target.value = '';
  }, []);

  const handleImport = useCallback(async () => {
    if (!csvText.trim()) {
      toast.error('Paste or upload a CSV first');
      return;
    }
    if (!hasSupabase || !getSupabase()) {
      toast.error('Supabase is not available');
      return;
    }
    if (!coachId) {
      toast.error('You must be signed in to import');
      return;
    }
    setLoading(true);
    setImportResult(null);
    try {
      const result = await importBodyweightHistory({
        csvText,
        supabase: getSupabase(),
        queryClient,
        coachId,
      });
      setImportResult(result);
      if (result.inserted > 0) {
        toast.success(`Imported ${result.inserted} weight log(s). Progress charts will update.`);
      }
      if (result.errors?.length > 0) {
        toast.warning(`${result.errors.length} row(s) had errors`);
      }
      if (result.inserted === 0 && (!result.errors || result.errors.length === 0)) {
        toast.info('No rows to import. Check CSV has client_email and date or weight.');
      }
    } catch (e) {
      trackFriction('import_failed', { source: 'bodyweight', phase: 'import', error: e?.message });
      toast.error(e?.message ?? 'Import failed');
    } finally {
      setLoading(false);
    }
  }, [csvText, coachId, queryClient]);

  const validCount = validation?.validRows?.length ?? 0;
  const errorCount = validation?.errors?.length ?? 0;

  return (
    <div className="min-h-screen pb-24" style={{ background: colors.bg, color: colors.text }}>
      <TopBar title="Import bodyweight history" onBack={() => navigate(-1)} />

      <div className="p-4 max-w-lg mx-auto space-y-4">
        <Card style={{ padding: spacing[16] }}>
          <p className="text-sm mb-2" style={{ color: colors.text }}>
            Paste or upload a CSV with columns: <strong>client_email</strong>, <strong>date</strong>, <strong>weight</strong>, and optionally bodyfat, notes.
            Rows are matched to your clients by email; progress charts update after import.
          </p>
          <textarea
            value={csvText}
            onChange={(e) => {
              setCsvText(e.target.value);
              setParsed(null);
              setValidation(null);
              setImportResult(null);
            }}
            rows={8}
            placeholder={'client_email,date,weight,bodyfat,notes\nclient@example.com,2024-01-15,72.5,18,'}
            className="w-full text-sm"
            style={{
              marginTop: spacing[8],
              padding: spacing[10],
              borderRadius: 8,
              border: `1px solid ${colors.border}`,
              background: colors.surface1,
              color: colors.text,
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
              resize: 'vertical',
            }}
          />
          <div className="flex flex-wrap items-center gap-2 mt-3">
            <label className="inline-flex items-center gap-2 text-sm cursor-pointer" style={{ color: colors.primary }}>
              <FileSpreadsheet size={18} />
              <input type="file" accept=".csv,text/csv" onChange={handleFileChange} className="sr-only" />
              Upload CSV
            </label>
            <Button size="sm" variant="outline" onClick={handleParse} disabled={!csvText.trim() || loading}>
              Parse & preview
            </Button>
            <Button size="sm" onClick={handleImport} disabled={!csvText.trim() || loading}>
              {loading ? 'Importing…' : 'Import'}
            </Button>
          </div>
        </Card>

        {validation && (
          <Card style={{ padding: spacing[16] }}>
            <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: colors.muted }}>
              Preview
            </p>
            <p className="text-sm mb-2" style={{ color: colors.text }}>
              Valid rows: <strong>{validCount}</strong>
              {errorCount > 0 && (
                <span style={{ color: colors.muted }}> · Errors: {errorCount}</span>
              )}
            </p>
            {validation.validRows.length > 0 && (
              <div className="space-y-2 mb-3">
                <p className="text-xs" style={{ color: colors.muted }}>First 5 valid rows:</p>
                {validation.validRows.slice(0, 5).map((row, idx) => (
                  <div
                    key={idx}
                    className="rounded-lg px-3 py-2"
                    style={{ background: colors.surface1, border: `1px solid ${colors.border}` }}
                  >
                    <span className="text-sm" style={{ color: colors.text }}>{row.client_email}</span>
                    <span className="text-xs ml-2" style={{ color: colors.muted }}>
                      {row.log_date ?? row.date} · {row.weight != null ? `${row.weight} kg` : '—'}
                      {row.bodyfat != null ? ` · ${row.bodyfat}% BF` : ''}
                    </span>
                  </div>
                ))}
              </div>
            )}
            {validation.errors.length > 0 && (
              <div>
                <p className="text-xs mb-1" style={{ color: colors.muted }}>Errors (first 5):</p>
                <ul className="text-xs space-y-0.5" style={{ color: colors.danger ?? '#ef4444' }}>
                  {validation.errors.slice(0, 5).map((err, i) => (
                    <li key={i}>Row {err.rowIndex}: {err.message}</li>
                  ))}
                </ul>
              </div>
            )}
          </Card>
        )}

        {importResult && (
          <Card style={{ padding: spacing[16], borderColor: colors.border }}>
            <p className="text-sm font-medium" style={{ color: colors.text }}>
              Imported: {importResult.inserted} weight log(s)
            </p>
            {importResult.errors?.length > 0 && (
              <p className="text-xs mt-1" style={{ color: colors.muted }}>
                {importResult.errors.length} row(s) skipped or failed
              </p>
            )}
          </Card>
        )}
      </div>
    </div>
  );
}
