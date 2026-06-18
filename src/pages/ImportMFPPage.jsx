import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import Card from '@/ui/Card';
import Button from '@/ui/Button';
import { colors, spacing } from '@/ui/tokens';
import { useAuth } from '@/lib/AuthContext';
import { getSupabase, hasSupabase } from '@/lib/supabaseClient';
import { importMFPMealsToAtlas, parseMFPCsv } from '@/lib/mfpCsvImport';

function formatDate(dateStr) {
  const d = new Date(dateStr);
  if (!Number.isFinite(d.getTime())) return dateStr;
  return d.toLocaleDateString();
}

export default function ImportMFPPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [howToOpen, setHowToOpen] = useState(false);
  const [csvText, setCsvText] = useState('');
  const [previewMeals, setPreviewMeals] = useState([]);
  const [progress, setProgress] = useState(0);
  const [isImporting, setIsImporting] = useState(false);
  const [result, setResult] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');

  const byMealType = useMemo(() => {
    const counts = {};
    for (const row of previewMeals) {
      const key = row.meal_type || 'other';
      counts[key] = (counts[key] || 0) + 1;
    }
    return counts;
  }, [previewMeals]);
  const dates = useMemo(() => {
    const ds = previewMeals.map((m) => m.log_date).filter(Boolean).sort();
    return {
      earliest: ds[0] || null,
      latest: ds[ds.length - 1] || null,
      days: new Set(ds).size,
    };
  }, [previewMeals]);

  const onPickFile = async (file) => {
    if (!file) return;
    const text = await file.text();
    const parsed = parseMFPCsv(text);
    setCsvText(text);
    setPreviewMeals(parsed);
    setResult(null);
    setErrorMessage('');
    if (!parsed.length) {
      toast.error('No meal rows found. Export your Food Diary CSV from MyFitnessPal.');
    }
  };

  const handleImport = async () => {
    if (!hasSupabase || !user?.id) {
      setErrorMessage('You need to be signed in with a live connection to import.');
      return;
    }
    const supabase = getSupabase();
    if (!supabase) {
      setErrorMessage('Could not connect to the database.');
      return;
    }
    setIsImporting(true);
    setProgress(0);
    setResult(null);
    setErrorMessage('');
    await importMFPMealsToAtlas({
      supabase,
      csvText,
      profileId: user.id,
      clientId: null,
      onProgress: setProgress,
      onComplete: (r) => setResult(r),
      onError: (msg) => setErrorMessage(msg),
    });
    setIsImporting(false);
  };

  return (
    <div style={{ minHeight: '100vh', background: colors.bg, color: colors.text, padding: spacing[16], maxWidth: 900, margin: '0 auto' }}>
      <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800 }}>Switch from MyFitnessPal</h1>
      <p style={{ marginTop: spacing[6], color: colors.muted }}>
        Import your food diary in under 2 minutes. Your history comes with you.
      </p>

      <Card style={{ marginTop: spacing[14], padding: spacing[14] }}>
        <button
          type="button"
          onClick={() => setHowToOpen((v) => !v)}
          style={{ border: 'none', background: 'none', color: colors.primary, fontWeight: 700, padding: 0, cursor: 'pointer' }}
        >
          STEP 1 — HOW TO EXPORT FROM MFP {howToOpen ? '▲' : '▼'}
        </button>
        {howToOpen ? (
          <div style={{ marginTop: spacing[10], fontSize: 13, color: colors.muted, lineHeight: 1.5 }}>
            <p style={{ margin: 0 }}>In MyFitnessPal: Settings → Data Export → Export Diary.</p>
            <p style={{ margin: `${spacing[6]}px 0 0` }}>You&apos;ll receive a CSV file by email.</p>
            <p style={{ margin: `${spacing[6]}px 0 0` }}>Open that file and upload it below.</p>
          </div>
        ) : null}
      </Card>

      <Card style={{ marginTop: spacing[14], padding: spacing[14] }}>
        <p style={{ margin: 0, fontSize: 12, fontWeight: 700, letterSpacing: '0.06em', color: colors.muted }}>STEP 2 — FILE UPLOAD</p>
        <label
          style={{
            marginTop: spacing[10],
            height: 400,
            width: '100%',
            border: `2px dashed ${colors.primary}`,
            borderRadius: 14,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            cursor: 'pointer',
            background: colors.surface1,
          }}
        >
          <input
            type="file"
            accept=".csv,text/csv"
            style={{ display: 'none' }}
            onChange={(e) => {
              void onPickFile(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
          <div>
            <p style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>Drop your MFP CSV here</p>
            <p style={{ margin: `${spacing[6]}px 0 0`, fontSize: 14, color: colors.muted }}>or tap to choose file</p>
          </div>
        </label>
      </Card>

      {previewMeals.length > 0 ? (
        <Card style={{ marginTop: spacing[14], padding: spacing[14] }}>
          <p style={{ margin: 0, fontSize: 12, fontWeight: 700, letterSpacing: '0.06em', color: colors.muted }}>STEP 3 — PREVIEW</p>
          <p style={{ margin: `${spacing[8]}px 0 0` }}>
            Found <strong>{previewMeals.length}</strong> meals across <strong>{dates.days}</strong> days
          </p>
          <p style={{ margin: `${spacing[6]}px 0 0`, fontSize: 13, color: colors.muted }}>
            Earliest: {dates.earliest ? formatDate(dates.earliest) : '—'} · Latest: {dates.latest ? formatDate(dates.latest) : '—'}
          </p>
          <p style={{ margin: `${spacing[6]}px 0 0`, fontSize: 13, color: colors.muted }}>
            Breakdown: Breakfast {byMealType.breakfast || 0}, Lunch {byMealType.lunch || 0}, Dinner {byMealType.dinner || 0}, Snack {byMealType.snack || 0}, Other {byMealType.other || 0}
          </p>
          <div style={{ display: 'flex', gap: spacing[8], marginTop: spacing[12] }}>
            <Button onClick={handleImport} disabled={isImporting}>
              {isImporting ? `Importing… ${progress}%` : `Import ${previewMeals.length} meals →`}
            </Button>
            <button
              type="button"
              onClick={() => {
                setCsvText('');
                setPreviewMeals([]);
                setResult(null);
                setErrorMessage('');
              }}
              style={{ border: 'none', background: 'none', color: colors.muted, cursor: 'pointer' }}
            >
              Cancel
            </button>
          </div>
          {isImporting ? (
            <div style={{ marginTop: spacing[10], height: 8, borderRadius: 6, background: colors.surface2 }}>
              <div style={{ width: `${progress}%`, height: '100%', borderRadius: 6, background: colors.primary, transition: 'width 0.25s ease' }} />
            </div>
          ) : null}
        </Card>
      ) : null}

      {result ? (
        <Card style={{ marginTop: spacing[14], padding: spacing[14], border: `1px solid ${colors.success}` }}>
          <p style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>{result.imported} meals imported from MyFitnessPal</p>
          <p style={{ margin: `${spacing[6]}px 0 0`, color: colors.muted }}>Your full food history is now in Atlas.</p>
          <Button style={{ marginTop: spacing[10] }} onClick={() => navigate('/nutrition')}>
            View my nutrition →
          </Button>
        </Card>
      ) : null}

      {errorMessage ? (
        <Card style={{ marginTop: spacing[14], padding: spacing[14], border: `1px solid ${colors.warning}` }}>
          <p style={{ margin: 0, color: colors.warning }}>{errorMessage}</p>
          <Button style={{ marginTop: spacing[10] }} variant="outline" onClick={() => setErrorMessage('')}>
            Try again
          </Button>
        </Card>
      ) : null}
    </div>
  );
}
