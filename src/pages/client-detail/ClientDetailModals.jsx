import React, { useState } from 'react';
import BottomSheet from '@/components/ui/BottomSheet';
import FullScreenModal from '@/components/ui/FullScreenModal';
import Button from '@/ui/Button';
import { colors, spacing } from '@/ui/tokens';
import { EQUIPMENT_LABELS } from '@/lib/gymEquipmentStore';
import { PHASES } from '@/lib/clientPhaseStore';
import { COACH_REMOVAL_REASON_OPTIONS } from '@/pages/client-detail/clientDetailUtils';

export function RemoveClientSheet({
  open,
  clientName,
  reason,
  setReason,
  reasonDetail,
  setReasonDetail,
  onCancel,
  onConfirm,
  isSubmitting,
}) {
  const firstName = (clientName || 'Client').trim().split(' ')[0] || 'Client';

  return (
    <BottomSheet open={open} onClose={() => onCancel?.()} title="Remove from roster" maxWidth={576} padded={false}>
        <div style={{ padding: spacing[16], paddingTop: 0 }}>
          <p className="text-sm font-semibold mb-2" style={{ color: colors.text }}>
            Why are you ending this coaching relationship?
          </p>
          <div className="flex flex-col gap-2" style={{ marginBottom: spacing[14] }}>
            {COACH_REMOVAL_REASON_OPTIONS.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setReason(option)}
                className="w-full text-left rounded-xl px-3 py-2.5"
                style={{
                  border: `1px solid ${reason === option ? colors.primary : colors.border}`,
                  background: reason === option ? colors.primarySubtle : colors.surface1,
                  color: colors.text,
                }}
              >
                {option}
              </button>
            ))}
          </div>

          <label className="block text-sm font-medium mb-2" style={{ color: colors.muted }}>
            Anything else you'd like to note? (internal only)
          </label>
          <textarea
            value={reasonDetail}
            onChange={(e) => setReasonDetail(e.target.value)}
            rows={3}
            className="w-full rounded-xl py-2.5 px-3 resize-none focus:outline-none focus:ring-1"
            style={{ background: colors.surface1, border: `1px solid ${colors.border}`, color: colors.text }}
            placeholder="Optional context for your records"
          />

          <div
            className="rounded-xl mt-4"
            style={{ padding: spacing[12], border: `1px solid ${colors.border}`, background: colors.surface2 }}
          >
            <p className="text-sm font-semibold" style={{ color: colors.text, marginBottom: spacing[8] }}>What happens next</p>
            <p className="text-sm" style={{ color: colors.muted, marginBottom: spacing[6] }}>Removing {clientName} will:</p>
            <ul className="text-sm" style={{ color: colors.muted, paddingLeft: 18, display: 'grid', gap: 6 }}>
              <li>End their access to your coaching programmes</li>
              <li>Keep their progress history intact (they keep their data)</li>
              <li>Cancel any active subscription on next billing date</li>
              <li>Send them a notification that coaching has ended</li>
            </ul>
          </div>

          <Button
            variant="primary"
            onClick={onConfirm}
            disabled={!reason || isSubmitting}
            style={{ width: '100%', marginTop: spacing[16], background: colors.danger }}
          >
            {isSubmitting ? 'Removing...' : `Remove ${firstName} from roster`}
          </Button>
        </div>
    </BottomSheet>
  );
}

export function GymEditModal({ clientId, initial, onSave, onClose }) {
  const [gymName, setGymName] = useState(initial.gymName ?? '');
  const [rack, setRack] = useState(!!initial.rack);
  const [smith, setSmith] = useState(!!initial.smith);
  const [cables, setCables] = useState(!!initial.cables);
  const [hackSquat, setHackSquat] = useState(!!initial.hackSquat);
  const [dbMax, setDbMax] = useState(initial.dbMax != null ? String(initial.dbMax) : '');
  const [machinesNotes, setMachinesNotes] = useState(initial.machinesNotes ?? '');

  return (
    /* Parent mounts this conditionally, so `open` is constant here. */
    <BottomSheet open onClose={() => onClose?.()} title="Gym & equipment" maxWidth={448} padded={false}>
        <div style={{ padding: spacing[16], paddingTop: 0 }}>
          <label className="block text-sm font-medium mb-2" style={{ color: colors.muted }}>Gym name</label>
          <input
            value={gymName}
            onChange={(e) => setGymName(e.target.value)}
            placeholder="e.g. City Fitness"
            className="w-full rounded-xl py-2.5 px-3 mb-4 focus:outline-none focus:ring-1"
            style={{ background: 'rgba(255,255,255,0.06)', border: `1px solid ${colors.border}`, color: colors.text }}
          />
          {['rack', 'smith', 'cables', 'hackSquat'].map((key) => (
            <label key={key} className="flex items-center gap-2 mb-2">
              <input type="checkbox" checked={key === 'rack' ? rack : key === 'smith' ? smith : key === 'cables' ? cables : hackSquat} onChange={(e) => { const v = e.target.checked; if (key === 'rack') setRack(v); else if (key === 'smith') setSmith(v); else if (key === 'cables') setCables(v); else setHackSquat(v); }} />
              <span className="text-sm" style={{ color: colors.text }}>{EQUIPMENT_LABELS[key] || key}</span>
            </label>
          ))}
          <label className="block text-sm font-medium mt-3 mb-2" style={{ color: colors.muted }}>{EQUIPMENT_LABELS.dbMax}</label>
          <input
            type="text"
            inputMode="decimal"
            value={dbMax}
            onChange={(e) => {
              const val = e.target.value;
              if (/^\d*\.?\d*$/.test(val)) setDbMax(val);
            }}
            placeholder="e.g. 25"
            className="w-full rounded-xl py-2.5 px-3 mb-4 focus:outline-none focus:ring-1"
            style={{ background: 'rgba(255,255,255,0.06)', border: `1px solid ${colors.border}`, color: colors.text }}
          />
          <label className="block text-sm font-medium mb-2" style={{ color: colors.muted }}>{EQUIPMENT_LABELS.machinesNotes}</label>
          <textarea
            value={machinesNotes}
            onChange={(e) => setMachinesNotes(e.target.value)}
            placeholder="Other machines or notes"
            rows={2}
            className="w-full rounded-xl py-2.5 px-3 resize-none focus:outline-none focus:ring-1"
            style={{ background: 'rgba(255,255,255,0.06)', border: `1px solid ${colors.border}`, color: colors.text }}
          />
          <Button variant="primary" onClick={() => onSave({ gymName, rack, smith, cables, hackSquat, dbMax, machinesNotes })} style={{ width: '100%', marginTop: spacing[16] }}>Save</Button>
        </div>
    </BottomSheet>
  );
}

export function PhaseEditModal({ phaseForm, setPhaseForm, onSave, onClose }) {
  return (
    /* Parent mounts this conditionally, so `open` is constant here. */
    <BottomSheet open onClose={() => onClose?.()} title="Change phase" maxWidth={448} padded={false}>
        <div style={{ padding: spacing[16], paddingTop: 0 }}>
          <label className="block text-sm font-medium mb-2" style={{ color: colors.muted }}>Phase</label>
          <select
            value={phaseForm.phase}
            onChange={(e) => setPhaseForm((p) => ({ ...p, phase: e.target.value }))}
            className="w-full rounded-xl py-2.5 px-3 mb-4 focus:outline-none focus:ring-1"
            style={{ background: 'rgba(255,255,255,0.06)', border: `1px solid ${colors.border}`, color: colors.text }}
          >
            {PHASES.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
          <label className="block text-sm font-medium mb-2" style={{ color: colors.muted }}>Effective date</label>
          <input
            type="date"
            value={phaseForm.effectiveDate}
            onChange={(e) => setPhaseForm((p) => ({ ...p, effectiveDate: e.target.value }))}
            className="w-full rounded-xl py-2.5 px-3 mb-4 focus:outline-none focus:ring-1"
            style={{ background: 'rgba(255,255,255,0.06)', border: `1px solid ${colors.border}`, color: colors.text }}
          />
          <label className="block text-sm font-medium mb-2" style={{ color: colors.muted }}>Note (optional)</label>
          <textarea
            value={phaseForm.note}
            onChange={(e) => setPhaseForm((p) => ({ ...p, note: e.target.value }))}
            placeholder="e.g. Starting cut after holiday"
            rows={2}
            className="w-full rounded-xl py-2.5 px-3 resize-none focus:outline-none focus:ring-1"
            style={{ background: 'rgba(255,255,255,0.06)', border: `1px solid ${colors.border}`, color: colors.text }}
          />
          <Button variant="primary" onClick={onSave} disabled={!phaseForm.phase} style={{ width: '100%', marginTop: spacing[16] }}>Save</Button>
        </div>
    </BottomSheet>
  );
}

const PHASE_OPTIONS = ['hypertrophy', 'strength', 'cut', 'prep', 'peak', 'deload', 'maintenance', 'other'];

const inputStyle = { background: colors.surface1, border: `1px solid ${colors.border}`, color: colors.text };
const hintStyle = { fontSize: 12, color: colors.destructive, marginTop: 4, marginBottom: 8 };

function validateSetPhaseForm(form) {
  const phase = (form.phase ?? '').toString().trim();
  const blockRaw = form.block_length_weeks;
  const blockNum = typeof blockRaw === 'number' ? blockRaw : parseInt(String(blockRaw), 10);
  const startDate = (form.start_date ?? '').toString().trim();
  return {
    phaseValid: phase.length > 0,
    blockValid: Number.isInteger(blockNum) && blockNum >= 1 && blockNum <= 52,
    startDateValid: startDate.length > 0,
    phaseErr: phase.length === 0 ? 'Phase is required' : null,
    blockErr: !Number.isInteger(blockNum) || blockNum < 1 || blockNum > 52 ? 'Enter a number between 1 and 52' : null,
    startDateErr: startDate.length === 0 ? 'Start date is required' : null,
  };
}

export function SetPhaseFullScreenModal({ form, setForm, onSave, onClose, saving, error }) {
  const validation = validateSetPhaseForm(form);
  const isValid = validation.phaseValid && validation.blockValid && validation.startDateValid;

  return (
    <FullScreenModal
      open={true}
      title="Set Phase"
      rightAction="cancel"
      rightLabel="Cancel"
      onClose={onClose}
      footer={
        <Button variant="primary" onClick={onSave} disabled={saving || !isValid} style={{ width: '100%' }}>
          {saving ? 'Saving…' : 'Save phase'}
        </Button>
      }
    >
      {error && (
        <div className="mb-4 p-3 rounded-xl text-sm" style={{ background: colors.surface1, border: `1px solid ${colors.destructive}`, color: colors.destructive }}>
          {error}
        </div>
      )}
      <label className="block text-sm font-medium mb-2" style={{ color: colors.muted }}>Phase</label>
      <select
        value={form.phase}
        onChange={(e) => setForm((p) => ({ ...p, phase: e.target.value }))}
        className="w-full rounded-xl py-2.5 px-3 focus:outline-none focus:ring-1"
        style={{ ...inputStyle, borderColor: validation.phaseErr ? colors.destructive : undefined }}
        aria-invalid={!!validation.phaseErr}
      >
        {PHASE_OPTIONS.map((p) => (
          <option key={p} value={p}>{p}</option>
        ))}
      </select>
      {validation.phaseErr && <p style={hintStyle}>{validation.phaseErr}</p>}
      {!validation.phaseErr && <div style={{ marginBottom: 16 }} />}

      <label className="block text-sm font-medium mb-2" style={{ color: colors.muted }}>Block length (weeks, 1–52)</label>
      <input
        type="number"
        min={1}
        max={52}
        value={form.block_length_weeks}
        onChange={(e) => setForm((p) => ({ ...p, block_length_weeks: e.target.value }))}
        className="w-full rounded-xl py-2.5 px-3 focus:outline-none focus:ring-1"
        style={{ ...inputStyle, borderColor: validation.blockErr ? colors.destructive : undefined }}
        aria-invalid={!!validation.blockErr}
      />
      {validation.blockErr && <p style={hintStyle}>{validation.blockErr}</p>}
      {!validation.blockErr && <div style={{ marginBottom: 16 }} />}

      <label className="block text-sm font-medium mb-2" style={{ color: colors.muted }}>Start date</label>
      <input
        type="date"
        value={form.start_date}
        onChange={(e) => setForm((p) => ({ ...p, start_date: e.target.value }))}
        className="w-full rounded-xl py-2.5 px-3 focus:outline-none focus:ring-1"
        style={{ ...inputStyle, borderColor: validation.startDateErr ? colors.destructive : undefined }}
        aria-invalid={!!validation.startDateErr}
      />
      {validation.startDateErr && <p style={hintStyle}>{validation.startDateErr}</p>}
      {!validation.startDateErr && <div style={{ marginBottom: 16 }} />}

      <label className="block text-sm font-medium mb-2" style={{ color: colors.muted }}>Notes (optional)</label>
      <textarea
        value={form.notes}
        onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
        placeholder="e.g. Starting cut after holiday"
        rows={2}
        className="w-full rounded-xl py-2.5 px-3 resize-none focus:outline-none focus:ring-1"
        style={inputStyle}
      />
    </FullScreenModal>
  );
}

export function CreateProgramBlockSheet({ form, setForm, onSave, onClose, saving }) {
  return (
    /* Parent mounts this conditionally, so `open` is constant here. */
    <BottomSheet open onClose={() => onClose?.()} title="Create program block" maxWidth={448} padded={false}>
        <div style={{ padding: spacing[16], paddingTop: 0 }}>
          <label className="block text-sm font-medium mb-2" style={{ color: colors.muted }}>Title</label>
          <input
            type="text"
            value={form.title}
            onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
            placeholder="e.g. Block 1 – Strength"
            className="w-full rounded-xl py-2.5 px-3 mb-4 focus:outline-none focus:ring-1"
            style={{ background: 'rgba(255,255,255,0.06)', border: `1px solid ${colors.border}`, color: colors.text }}
          />
          <label className="block text-sm font-medium mb-2" style={{ color: colors.muted }}>Total weeks (1–52)</label>
          <input
            type="number"
            min={1}
            max={52}
            value={form.total_weeks}
            onChange={(e) => setForm((p) => ({ ...p, total_weeks: e.target.value }))}
            className="w-full rounded-xl py-2.5 px-3 mb-4 focus:outline-none focus:ring-1"
            style={{ background: 'rgba(255,255,255,0.06)', border: `1px solid ${colors.border}`, color: colors.text }}
          />
          <label className="block text-sm font-medium mb-2" style={{ color: colors.muted }}>Link to phase (optional)</label>
          <input
            type="text"
            value={form.phase_id}
            onChange={(e) => setForm((p) => ({ ...p, phase_id: e.target.value }))}
            placeholder="Phase ID or leave blank"
            className="w-full rounded-xl py-2.5 px-3 mb-4 focus:outline-none focus:ring-1"
            style={{ background: 'rgba(255,255,255,0.06)', border: `1px solid ${colors.border}`, color: colors.text }}
          />
          <Button variant="primary" onClick={onSave} disabled={saving || !form.title?.trim()} style={{ width: '100%', marginTop: spacing[16] }}>
            {saving ? 'Creating…' : 'Create block'}
          </Button>
        </div>
    </BottomSheet>
  );
}
