import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import TopBar from '@/components/ui/TopBar';
import Card from '@/ui/Card';
import { colors, spacing, shell } from '@/ui/tokens';
import { getSupabase, hasSupabase } from '@/lib/supabaseClient';
import { useAuth } from '@/lib/AuthContext';
import { getLastCheckinTemplateIdForCoach } from '@/lib/checkinTemplatePrefs';

const PAGE_PADDING = { paddingLeft: shell.pagePaddingH, paddingRight: shell.pagePaddingH };

function evalNutritionFormula(formula, bodyweightKg) {
  const f = String(formula || '').trim().toLowerCase().replace(/\s+/g, '');
  if (!f || !Number.isFinite(Number(bodyweightKg))) return null;
  const n = Number(bodyweightKg);
  if (f.includes('bw*')) return Math.round(n * Number(f.split('bw*')[1] || 0));
  if (f.includes('bodyweight*')) return Math.round(n * Number(f.split('bodyweight*')[1] || 0));
  return null;
}

export default function MethodologyPackagePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const clientId = searchParams.get('clientId') || '';
  const { user } = useAuth();
  const supabase = hasSupabase ? getSupabase() : null;

  const [loading, setLoading] = useState(true);
  const [programs, setPrograms] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [packages, setPackages] = useState([]);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: '',
    description: '',
    onboarding_message: '',
    nutrition_formula: 'bw*28',
    checkin_template_id: '',
    program_ids: [],
  });

  const load = async () => {
    if (!supabase || !user?.id) return;
    setLoading(true);
    const [programRes, templateRes, packageRes] = await Promise.all([
      supabase.from('program_blocks').select('id, title, created_at').eq('coach_id', user.id).order('created_at', { ascending: false }),
      supabase.from('checkin_templates').select('id, name, created_at').eq('coach_id', user.id).order('created_at', { ascending: false }),
      supabase.from('methodology_packages').select('*').eq('coach_id', user.id).order('created_at', { ascending: false }),
    ]);
    setPrograms(Array.isArray(programRes.data) ? programRes.data : []);
    const templateRows = Array.isArray(templateRes.data) ? templateRes.data : [];
    setTemplates(templateRows);
    setPackages(Array.isArray(packageRes.data) ? packageRes.data : []);
    const lastTid = getLastCheckinTemplateIdForCoach(user.id);
    if (lastTid && templateRows.some((t) => t.id === lastTid)) {
      setForm((prev) => ({
        ...prev,
        checkin_template_id: prev.checkin_template_id || lastTid,
      }));
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [user?.id]);

  const selectedProgramTitle = useMemo(
    () => programs.filter((p) => form.program_ids.includes(p.id)).map((p) => p.title).join(', '),
    [programs, form.program_ids]
  );

  const savePackage = async () => {
    if (!supabase || !user?.id || !form.name.trim() || form.program_ids.length < 1) {
      toast.error('Add name and at least one program');
      return;
    }
    setSaving(true);
    const { error } = await supabase.from('methodology_packages').insert({
      coach_id: user.id,
      name: form.name.trim(),
      description: form.description.trim() || null,
      onboarding_message: form.onboarding_message.trim() || null,
      program_ids: form.program_ids,
      checkin_template_id: form.checkin_template_id || null,
      nutrition_formula: form.nutrition_formula || null,
    });
    setSaving(false);
    if (error) {
      toast.error(error.message || 'Could not save package');
      return;
    }
    toast.success('Coaching pack saved');
    setForm({ name: '', description: '', onboarding_message: '', nutrition_formula: 'bw*28', checkin_template_id: '', program_ids: [] });
    load();
  };

  const deployPackage = async (pkg) => {
    if (!supabase || !clientId) return;
    const start = new Date();
    await supabase.from('program_block_assignments').update({ is_active: false }).eq('client_id', clientId);
    for (let i = 0; i < (pkg.program_ids || []).length; i += 1) {
      const d = new Date(start);
      d.setDate(start.getDate() + i * 28);
      await supabase.from('program_block_assignments').insert({
        client_id: clientId,
        program_block_id: pkg.program_ids[i],
        start_date: d.toISOString().slice(0, 10),
        is_active: i === 0,
      });
    }
    if (pkg.checkin_template_id) {
      await supabase.from('clients').update({ default_checkin_template_id: pkg.checkin_template_id }).eq('id', clientId);
    }
    const { data: clientRow } = await supabase.from('clients').select('id, weight_kg').eq('id', clientId).maybeSingle();
    const calories = evalNutritionFormula(pkg.nutrition_formula, clientRow?.weight_kg);
    if (calories) {
      await supabase.from('nutrition_plans').upsert({
        client_id: clientId,
        calorie_target: calories,
        notes: `Auto-generated from methodology package ${pkg.name}`,
      }, { onConflict: 'client_id' });
    }
    toast.success('Pack deployed to client');
    navigate(`/clients/${clientId}?tab=program`);
  };

  const inputStyle = {
    width: '100%',
    borderRadius: 10,
    border: `1px solid ${colors.border}`,
    background: colors.surface2,
    color: colors.text,
    padding: '10px 12px',
    fontSize: 14,
  };

  return (
    <div style={{ minHeight: '100vh', background: colors.bg, color: colors.text }}>
      <TopBar title="Coaching Pack" onBack={() => navigate(-1)} />
      <div style={{ ...PAGE_PADDING, paddingTop: spacing[16], paddingBottom: spacing[24], display: 'grid', gap: spacing[12] }}>
        <Card style={{ padding: spacing[14] }}>
          <p style={{ margin: 0, fontSize: 12, color: colors.muted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Build pack</p>
          <input style={{ ...inputStyle, marginTop: spacing[8] }} placeholder="e.g. Sarah's 12-Week Transformation" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          <textarea style={{ ...inputStyle, marginTop: spacing[8] }} rows={2} placeholder="Description" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
          <textarea style={{ ...inputStyle, marginTop: spacing[8] }} rows={2} placeholder="Onboarding message sent to new client" value={form.onboarding_message} onChange={(e) => setForm((f) => ({ ...f, onboarding_message: e.target.value }))} />
          <input style={{ ...inputStyle, marginTop: spacing[8] }} placeholder="Calorie formula e.g. bw*28 (bodyweight × 28)" value={form.nutrition_formula} onChange={(e) => setForm((f) => ({ ...f, nutrition_formula: e.target.value }))} />
          <select style={{ ...inputStyle, marginTop: spacing[8] }} value={form.checkin_template_id} onChange={(e) => setForm((f) => ({ ...f, checkin_template_id: e.target.value }))}>
            <option value="">Select default check-in template</option>
            {templates.map((t) => <option key={t.id} value={t.id}>{t.name || 'Template'}</option>)}
          </select>
          <p style={{ margin: `${spacing[10]}px 0 ${spacing[6]}px`, fontSize: 12, color: colors.muted }}>Training programs (in order, each runs 28 days)</p>
          <div style={{ display: 'grid', gap: 6 }}>
            {programs.map((p) => (
              <label key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                <input
                  type="checkbox"
                  checked={form.program_ids.includes(p.id)}
                  onChange={(e) => {
                    setForm((f) => ({
                      ...f,
                      program_ids: e.target.checked ? [...f.program_ids, p.id] : f.program_ids.filter((id) => id !== p.id),
                    }));
                  }}
                />
                {p.title || 'Untitled program'}
              </label>
            ))}
          </div>
          {selectedProgramTitle ? <p style={{ margin: `${spacing[8]}px 0 0`, fontSize: 12, color: colors.muted }}>Selected: {selectedProgramTitle}</p> : null}
          <button type="button" onClick={savePackage} disabled={saving} style={{ marginTop: spacing[12], width: '100%', minHeight: 42, borderRadius: 10, border: 'none', background: colors.primary, color: '#fff', fontWeight: 700 }}>
            {saving ? 'Saving...' : 'Save coaching pack'}
          </button>
        </Card>

        <Card style={{ padding: spacing[14] }}>
          <p style={{ margin: 0, fontSize: 12, color: colors.muted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Deploy to client
          </p>
          {loading ? <p style={{ fontSize: 13, color: colors.muted }}>Loading...</p> : null}
          {!loading && packages.length === 0 ? <p style={{ fontSize: 13, color: colors.muted }}>No saved packs yet.</p> : null}
          <div style={{ display: 'grid', gap: spacing[8], marginTop: spacing[8] }}>
            {packages.map((pkg) => (
              <button
                key={pkg.id}
                type="button"
                onClick={() => deployPackage(pkg)}
                disabled={!clientId}
                style={{ textAlign: 'left', borderRadius: 10, border: `1px solid ${colors.border}`, background: colors.surface2, color: colors.text, padding: spacing[10] }}
              >
                <p style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>{pkg.name}</p>
                <p style={{ margin: `${spacing[4]}px 0 0`, fontSize: 12, color: colors.muted }}>
                  {(pkg.program_ids || []).length} programs · {pkg.nutrition_formula || 'No nutrition formula'}
                </p>
              </button>
            ))}
          </div>
          {!clientId ? <p style={{ margin: `${spacing[8]}px 0 0`, fontSize: 12, color: colors.muted }}>Open this page from a client to deploy directly.</p> : null}
        </Card>
      </div>
    </div>
  );
}
