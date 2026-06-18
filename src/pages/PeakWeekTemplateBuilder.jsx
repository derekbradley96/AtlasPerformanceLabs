/**
 * Coach: create reusable 7-day peak week templates for one-tap deploy.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import TopBar from '@/components/ui/TopBar';
import Card from '@/ui/Card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { colors, spacing } from '@/ui/tokens';
import { useAuth } from '@/lib/AuthContext';
import { getSupabase, hasSupabase } from '@/lib/supabaseClient';
import { toast } from 'sonner';
import { hapticLight } from '@/lib/haptics';

function emptyDay(dayNum) {
  return {
    day: dayNum,
    label: `Day ${dayNum}`,
    carbs_g: '',
    protein_g: '',
    fats_g: '',
    water_litres: '',
    sodium_restriction: false,
    training: '',
    notes: '',
  };
}

export default function PeakWeekTemplateBuilder() {
  const navigate = useNavigate();
  const { user, profile, coachFocus: coachFocusFromAuth } = useAuth();
  const coachFocus = (coachFocusFromAuth ?? profile?.coach_focus ?? '').toString().trim().toLowerCase();
  const showPeakWeek = coachFocus === 'competition' || coachFocus === 'integrated';
  const coachId = user?.id ?? null;
  const supabase = hasSupabase ? getSupabase() : null;

  const [name, setName] = useState('Standard 7-day peak');
  const [division, setDivision] = useState('');
  const [templateNotes, setTemplateNotes] = useState('');
  const [days, setDays] = useState(() => Array.from({ length: 7 }, (_, i) => emptyDay(i + 1)));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    document.title = 'Peak week templates — Atlas';
  }, []);

  const setDay = useCallback((idx, field, value) => {
    setDays((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value };
      return next;
    });
  }, []);

  const handleSave = async () => {
    if (!supabase || !coachId || saving) return;
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error('Name is required');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        coach_id: coachId,
        name: trimmed,
        division: division.trim() || null,
        notes: templateNotes.trim() || null,
        days: days.map((d) => ({
          day: Number(d.day) || 1,
          label: d.label || `Day ${d.day}`,
          carbs_g: d.carbs_g === '' ? null : Number(d.carbs_g),
          protein_g: d.protein_g === '' ? null : Number(d.protein_g),
          fats_g: d.fats_g === '' ? null : Number(d.fats_g),
          water_litres: d.water_litres === '' ? null : Number(d.water_litres),
          sodium_restriction: !!d.sodium_restriction,
          training: d.training || '',
          notes: d.notes || '',
        })),
      };
      const { error } = await supabase.from('peak_week_templates').insert(payload);
      if (error) throw error;
      toast.success('Template saved');
      hapticLight();
      navigate(-1);
    } catch (e) {
      toast.error(e?.message || 'Could not save');
    } finally {
      setSaving(false);
    }
  };

  if (!showPeakWeek) {
    return (
      <div className="min-h-screen p-4" style={{ background: colors.bg, color: colors.text }}>
        <TopBar title="Peak week templates" onBack={() => navigate(-1)} />
        <p className="text-sm mt-4" style={{ color: colors.muted }}>Available for competition or integrated coaches.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-24" style={{ background: colors.bg, color: colors.text }}>
      <TopBar title="Peak week templates" onBack={() => navigate(-1)} />
      <div className="p-4 max-w-lg mx-auto space-y-4">
        <Card style={{ padding: spacing[16], border: `1px solid ${colors.border}` }}>
          <Label className="text-xs" style={{ color: colors.muted }}>Template name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} className="mt-1" style={{ background: colors.surface2, borderColor: colors.border }} />
          <Label className="text-xs mt-3 block" style={{ color: colors.muted }}>Division (optional)</Label>
          <Input value={division} onChange={(e) => setDivision(e.target.value)} placeholder="e.g. Bikini" className="mt-1" style={{ background: colors.surface2, borderColor: colors.border }} />
          <Label className="text-xs mt-3 block" style={{ color: colors.muted }}>Coach notes</Label>
          <Textarea value={templateNotes} onChange={(e) => setTemplateNotes(e.target.value)} rows={2} className="mt-1" style={{ background: colors.surface2, borderColor: colors.border }} />
        </Card>

        {days.map((d) => (
          <Card key={d.day} style={{ padding: spacing[16], border: `1px solid ${colors.border}` }}>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold" style={{ color: colors.text }}>Day {d.day} (T-{7 - Number(d.day)})</p>
            </div>
            <Label className="text-xs" style={{ color: colors.muted }}>Label</Label>
            <Input value={d.label} onChange={(e) => setDay(idx, 'label', e.target.value)} className="mt-1 mb-2" style={{ background: colors.surface2, borderColor: colors.border }} />
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs" style={{ color: colors.muted }}>Carbs (g)</Label>
                <Input value={d.carbs_g} onChange={(e) => setDay(idx, 'carbs_g', e.target.value)} className="mt-1" style={{ background: colors.surface2, borderColor: colors.border }} />
              </div>
              <div>
                <Label className="text-xs" style={{ color: colors.muted }}>Protein (g)</Label>
                <Input value={d.protein_g} onChange={(e) => setDay(idx, 'protein_g', e.target.value)} className="mt-1" style={{ background: colors.surface2, borderColor: colors.border }} />
              </div>
              <div>
                <Label className="text-xs" style={{ color: colors.muted }}>Fats (g)</Label>
                <Input value={d.fats_g} onChange={(e) => setDay(idx, 'fats_g', e.target.value)} className="mt-1" style={{ background: colors.surface2, borderColor: colors.border }} />
              </div>
              <div>
                <Label className="text-xs" style={{ color: colors.muted }}>Water (L)</Label>
                <Input value={d.water_litres} onChange={(e) => setDay(idx, 'water_litres', e.target.value)} className="mt-1" style={{ background: colors.surface2, borderColor: colors.border }} />
              </div>
            </div>
            <label className="flex items-center gap-2 mt-2 text-sm" style={{ color: colors.text }}>
              <input type="checkbox" checked={!!d.sodium_restriction} onChange={(e) => setDay(idx, 'sodium_restriction', e.target.checked)} />
              Sodium restriction
            </label>
            <Label className="text-xs mt-2 block" style={{ color: colors.muted }}>Training</Label>
            <Textarea value={d.training} onChange={(e) => setDay(idx, 'training', e.target.value)} rows={2} className="mt-1" style={{ background: colors.surface2, borderColor: colors.border }} />
            <Label className="text-xs mt-2 block" style={{ color: colors.muted }}>Notes</Label>
            <Textarea value={d.notes} onChange={(e) => setDay(idx, 'notes', e.target.value)} rows={2} className="mt-1" style={{ background: colors.surface2, borderColor: colors.border }} />
          </Card>
        ))}

        <Button className="w-full" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving…' : 'Save template'}
        </Button>
      </div>
    </div>
  );
}
