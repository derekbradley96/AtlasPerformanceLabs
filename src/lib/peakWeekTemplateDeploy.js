/**
 * Deploy a saved peak week template into peak_week_protocol_days (+ mirror peak_week_days for client /peak-week).
 */

function toISODate(d) {
  if (!d) return '';
  const x = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(x.getTime())) return '';
  const y = x.getFullYear();
  const m = String(x.getMonth() + 1).padStart(2, '0');
  const day = String(x.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function addDays(dateStr, delta) {
  const d = new Date(`${dateStr}T12:00:00`);
  d.setDate(d.getDate() + delta);
  return toISODate(d);
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {{ clientId: string, contestPrepId: string, showDate: string, templateDays: Array<Record<string, unknown>> }} args
 * @returns {Promise<{ ok: boolean, error?: string }>}
 */
export async function deployPeakWeekTemplateToAthlete(supabase, { clientId, contestPrepId, showDate, templateDays }) {
  if (!supabase || !clientId || !contestPrepId || !showDate || !Array.isArray(templateDays) || templateDays.length === 0) {
    return { ok: false, error: 'Missing deploy context' };
  }
  try {
    let protocolId = null;
    const { data: existingProt } = await supabase
      .from('peak_week_protocols')
      .select('id')
      .eq('client_id', clientId)
      .eq('contest_prep_id', contestPrepId)
      .maybeSingle();
    if (existingProt?.id) {
      protocolId = existingProt.id;
    } else {
      const { data: insertedProt, error: insErr } = await supabase
        .from('peak_week_protocols')
        .insert({ client_id: clientId, contest_prep_id: contestPrepId })
        .select('id')
        .single();
      if (insErr || !insertedProt?.id) return { ok: false, error: insErr?.message || 'Could not create protocol' };
      protocolId = insertedProt.id;
    }

    const { data: existingDays } = await supabase
      .from('peak_week_protocol_days')
      .select('id')
      .eq('protocol_id', protocolId);
    const ids = (existingDays || []).map((r) => r.id).filter(Boolean);
    if (ids.length) {
      await supabase.from('peak_week_protocol_days').delete().in('id', ids);
    }

    const sorted = [...templateDays].sort((a, b) => Number(a.day) - Number(b.day));
    const protocolRows = sorted.map((td, idx) => {
      const dayNum = Number(td.day);
      const dayDate = addDays(showDate, dayNum - 7);
      const extraBits = [];
      if (td.protein_g != null) extraBits.push(`Protein ${td.protein_g}g`);
      if (td.fats_g != null) extraBits.push(`Fats ${td.fats_g}g`);
      if (td.sodium_restriction === true) extraBits.push('Sodium restriction');
      const notesTail = extraBits.length ? `\n${extraBits.join(' · ')}` : '';
      const baseNotes = (td.notes && String(td.notes).trim()) || '';
      const training = (td.training && String(td.training).trim()) || '';
      return {
        protocol_id: protocolId,
        day_date: dayDate,
        day_label: td.label ? String(td.label) : `Day ${dayNum}`,
        sort_order: idx,
        carbs_g: td.carbs_g != null && td.carbs_g !== '' ? Number(td.carbs_g) : null,
        water_l: td.water_litres != null && td.water_litres !== '' ? Number(td.water_litres) : null,
        sodium_mg: td.sodium_mg != null && td.sodium_mg !== ''
          ? Number(td.sodium_mg)
          : (td.sodium_restriction === true ? 1000 : null),
        cardio_minutes: td.cardio_minutes != null && td.cardio_minutes !== '' ? Number(td.cardio_minutes) : null,
        training_notes: training || null,
        notes: baseNotes ? `${baseNotes}${notesTail}` : (notesTail.trim() || null),
      };
    });

    const { error: dayErr } = await supabase.from('peak_week_protocol_days').insert(protocolRows);
    if (dayErr) return { ok: false, error: dayErr.message };

    const { data: peakWeek } = await supabase
      .from('peak_weeks')
      .select('id')
      .eq('client_id', clientId)
      .eq('contest_prep_id', contestPrepId)
      .eq('is_active', true)
      .maybeSingle();

    if (peakWeek?.id) {
      for (const td of sorted) {
        const dayNum = Number(td.day);
        const day_number = dayNum - 7;
        if (day_number < -7 || day_number > 0) continue;
        const target_date = addDays(showDate, dayNum - 7);
        const extraBits = [];
        if (td.protein_g != null) extraBits.push(`Protein ${td.protein_g}g`);
        if (td.fats_g != null) extraBits.push(`Fats ${td.fats_g}g`);
        const notesTail = extraBits.length ? `\n${extraBits.join(' · ')}` : '';
        const baseNotes = (td.notes && String(td.notes).trim()) || '';
        const training = (td.training && String(td.training).trim()) || '';
        const payload = {
          day_label: td.label ? String(td.label) : `Day ${day_number}`,
          target_date,
          carbs_g: td.carbs_g != null && td.carbs_g !== '' ? Number(td.carbs_g) : null,
          protein_g: td.protein_g != null && td.protein_g !== '' ? Number(td.protein_g) : null,
          fats_g: td.fats_g != null && td.fats_g !== '' ? Number(td.fats_g) : null,
          water_l: td.water_litres != null && td.water_litres !== '' ? Number(td.water_litres) : null,
          sodium_mg: td.sodium_mg != null && td.sodium_mg !== ''
            ? Number(td.sodium_mg)
            : (td.sodium_restriction === true ? 1000 : null),
          cardio_minutes: td.cardio_minutes != null && td.cardio_minutes !== '' ? Number(td.cardio_minutes) : null,
          training_type: 'custom',
          training_notes: training || null,
          notes: baseNotes ? `${baseNotes}${notesTail}` : (notesTail.trim() || null),
          updated_at: new Date().toISOString(),
        };
        const { data: dayRow } = await supabase
          .from('peak_week_days')
          .select('id')
          .eq('peak_week_id', peakWeek.id)
          .eq('day_number', day_number)
          .maybeSingle();
        if (dayRow?.id) {
          await supabase.from('peak_week_days').update(payload).eq('id', dayRow.id);
        } else {
          await supabase.from('peak_week_days').insert({
            peak_week_id: peakWeek.id,
            day_number,
            ...payload,
          });
        }
      }
    }

    return { ok: true };
  } catch (e) {
    return { ok: false, error: e?.message || 'Deploy failed' };
  }
}
