/**
 * ImportClientsPage
 *
 * Coach tool for importing client CSVs from other coaching apps.
 * MVP: upload CSV → parse → preview → create clients → optional progress import.
 */
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import TopBar from '@/components/ui/TopBar';
import Card from '@/ui/Card';
import { Button } from '@/components/ui/button';
import { colors, spacing } from '@/ui/tokens';
import { parseClientCSV, createClients, mapPrograms, importProgressData } from '@/services/clientImportService';
import { hasSupabase, getSupabase } from '@/lib/supabaseClient';
import { toast } from 'sonner';
import { trackFriction } from '@/services/frictionTracker';

export default function ImportClientsPage() {
  const navigate = useNavigate();
  const [csvText, setCsvText] = useState('');
  const [parsed, setParsed] = useState(null);
  const [createdClients, setCreatedClients] = useState([]);
  const [programSummary, setProgramSummary] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleParse = () => {
    try {
      const result = parseClientCSV(csvText);
      setParsed(result);
      setCreatedClients([]);
      setProgramSummary(null);
      toast.success(`Parsed ${result.rows.length} rows`);
    } catch (e) {
      trackFriction('import_failed', { source: 'clients', phase: 'parse', error: e?.message });
      toast.error(e?.message || 'Could not parse CSV');
    }
  };

  const handleCreateClients = async () => {
    if (!parsed || !parsed.rows.length) {
      toast.error('Parse a CSV first');
      return;
    }
    if (!hasSupabase()) {
      toast.error('Supabase is not available');
      return;
    }
    setLoading(true);
    try {
      const supabase = getSupabase();
      const { created, errors } = await createClients({ rows: parsed.rows, supabase });
      setCreatedClients(created);
      if (created.length) {
        const { trackClientCreated } = await import('@/services/analyticsService');
        for (const c of created) {
          if (c?.id) trackClientCreated({ client_id: c.id, source: 'import' });
        }
        toast.success(`Created ${created.length} clients`);
      }
      if (errors.length) {
        toast.error(`Some rows failed: ${errors.length} error(s). See console for details.`);
        // eslint-disable-next-line no-console
        console.error('Client import errors', errors);
      }
      const prog = mapPrograms({ rows: parsed.rows, createdClients: created });
      setProgramSummary(prog);
    } catch (e) {
      trackFriction('import_failed', { source: 'clients', phase: 'create', error: e?.message });
      toast.error(e?.message || 'Could not create clients');
    } finally {
      setLoading(false);
    }
  };

  const handleImportProgress = async () => {
    if (!parsed || !createdClients.length) {
      toast.error('Import clients first');
      return;
    }
    if (!hasSupabase()) {
      toast.error('Supabase is not available');
      return;
    }
    setLoading(true);
    try {
      const supabase = getSupabase();
      const { exercisePerformanceInserted, bodyWeightHistoryPlanned } = await importProgressData({
        rows: parsed.rows,
        createdClients,
        supabase,
      });
      const parts = [];
      if (exercisePerformanceInserted > 0) {
        parts.push(`${exercisePerformanceInserted} exercise sets`);
      }
      if (bodyWeightHistoryPlanned > 0) {
        parts.push(`${bodyWeightHistoryPlanned} body-weight entries (planned only)`);
      }
      toast.success(
        parts.length ? `Imported progress data: ${parts.join(', ')}.` : 'No progress data found to import.'
      );
    } catch (e) {
      toast.error(e?.message || 'Could not import progress data');
    } finally {
      setLoading(false);
    }
  };

  const totalRows = parsed?.rows.length ?? 0;
  const withEmail = parsed ? parsed.rows.filter((r) => r.email).length : 0;

  return (
    <div className="min-h-screen pb-24" style={{ background: colors.bg, color: colors.text }}>
      <TopBar title="Import clients" onBack={() => navigate(-1)} />

      <div className="p-4 space-y-4">
        <Card style={{ padding: spacing[16] }}>
          <p className="text-sm mb-2" style={{ color: colors.text }}>
            Paste or upload a CSV export from another coaching app. Atlas will parse client name, email, body weight
            history, program name, and exercise weights where available.
          </p>
          <textarea
            value={csvText}
            onChange={(e) => setCsvText(e.target.value)}
            rows={10}
            placeholder="Paste CSV here (including header row)…"
            className="w-full text-sm"
            style={{
              marginTop: spacing[8],
              padding: spacing[10],
              borderRadius: 8,
              border: `1px solid ${colors.border}`,
              background: colors.surface1,
              color: colors.text,
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, Liberation Mono, Courier New, monospace',
              resize: 'vertical',
            }}
          />
          <div className="flex flex-wrap gap-2 mt-3">
            <Button size="sm" variant="outline" onClick={handleParse} disabled={!csvText.trim() || loading}>
              Parse CSV
            </Button>
            <Button size="sm" onClick={handleCreateClients} disabled={!parsed || loading}>
              {loading ? 'Working…' : 'Create clients'}
            </Button>
            <Button size="sm" variant="secondary" onClick={handleImportProgress} disabled={!parsed || !createdClients.length || loading}>
              Import progress
            </Button>
          </div>
          {parsed && (
            <p className="text-xs mt-2" style={{ color: colors.muted }}>
              Parsed rows: {totalRows} · With email: {withEmail}
            </p>
          )}
        </Card>

        {parsed && parsed.rows.length > 0 && (
          <Card style={{ padding: spacing[16] }}>
            <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: colors.muted }}>
              Preview (first 5)
            </p>
            <div className="space-y-2">
              {parsed.rows.slice(0, 5).map((row, idx) => (
                <div
                  key={idx}
                  className="rounded-lg px-3 py-2"
                  style={{ background: colors.surface1, border: `1px solid ${colors.border}` }}
                >
                  <p className="text-sm font-medium" style={{ color: colors.text }}>
                    {row.clientName || 'Unnamed client'}
                  </p>
                  <p className="text-xs" style={{ color: colors.muted }}>
                    {row.email || 'No email'}
                    {row.programName && ` · Program: ${row.programName}`}
                  </p>
                  {row.bodyWeightHistory?.length > 0 && (
                    <p className="text-[11px] mt-1" style={{ color: colors.muted }}>
                      Weight history entries: {row.bodyWeightHistory.length}
                    </p>
                  )}
                  {row.exerciseWeights?.length > 0 && (
                    <p className="text-[11px]" style={{ color: colors.muted }}>
                      Exercise weights entries: {row.exerciseWeights.length}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </Card>
        )}

        {programSummary && programSummary.programsByName && (
          <Card style={{ padding: spacing[16] }}>
            <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: colors.muted }}>
              Programs detected
            </p>
            {Object.keys(programSummary.programsByName).length === 0 ? (
              <p className="text-sm" style={{ color: colors.muted }}>
                No program names detected in import.
              </p>
            ) : (
              <ul className="space-y-1">
                {Object.values(programSummary.programsByName).map((p) => (
                  <li key={p.name} className="text-sm" style={{ color: colors.text }}>
                    {p.name}{' '}
                    <span className="text-xs" style={{ color: colors.muted }}>
                      ({p.clients.length} client{p.clients.length === 1 ? '' : 's'})
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )}
      </div>
    </div>
  );
}

