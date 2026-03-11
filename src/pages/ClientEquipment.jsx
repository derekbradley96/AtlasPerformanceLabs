/**
 * Client-facing gym & equipment capture. Saves to same store as trainer's Client Detail.
 */
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { getClientByUserId } from '@/data/selectors';
import { getClientGym, setClientGym, EQUIPMENT_LABELS } from '@/lib/gymEquipmentStore';
import Card from '@/ui/Card';
import Button from '@/ui/Button';
import { colors, spacing } from '@/ui/tokens';
import { impactLight } from '@/lib/haptics';
import { toast } from 'sonner';

export default function ClientEquipment() {
  const navigate = useNavigate();
  const { user, isDemoMode } = useAuth();
  const userId = isDemoMode ? 'demo-client' : user?.id ?? null;
  const client = userId ? getClientByUserId(userId) : null;
  const clientId = client?.id ?? null;

  const [gymName, setGymName] = useState('');
  const [rack, setRack] = useState(false);
  const [smith, setSmith] = useState(false);
  const [cables, setCables] = useState(false);
  const [hackSquat, setHackSquat] = useState(false);
  const [dbMax, setDbMax] = useState('');
  const [machinesNotes, setMachinesNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!clientId) return;
    const existing = getClientGym(clientId) || {};
    setGymName(existing.gymName ?? '');
    setRack(!!existing.rack);
    setSmith(!!existing.smith);
    setCables(!!existing.cables);
    setHackSquat(!!existing.hackSquat);
    setDbMax(existing.dbMax != null ? String(existing.dbMax) : '');
    setMachinesNotes(existing.machinesNotes ?? '');
  }, [clientId]);

  const handleSave = () => {
    if (!clientId) return;
    impactLight();
    setSaving(true);
    try {
      setClientGym(clientId, { gymName, rack, smith, cables, hackSquat, dbMax, machinesNotes });
      toast.success('Gym & equipment saved');
      navigate(-1);
    } catch (e) {
      toast.error('Could not save');
    } finally {
      setSaving(false);
    }
  };

  if (userId && !client) {
    return (
      <div className="app-screen min-w-0 max-w-full overflow-x-hidden" style={{ padding: spacing[24] }}>
        <Card style={{ padding: spacing[24], textAlign: 'center' }}>
          <p className="text-sm" style={{ color: colors.muted }}>Client profile not found. Use the app as linked by your coach.</p>
          <Button variant="secondary" onClick={() => navigate(-1)} style={{ marginTop: spacing[16] }}>Back</Button>
        </Card>
      </div>
    );
  }

  if (!clientId) {
    return (
      <div className="app-screen min-w-0 max-w-full overflow-x-hidden" style={{ padding: spacing[24] }}>
        <div className="w-8 h-8 border-2 border-white/20 border-t-blue-500 rounded-full animate-spin mx-auto" />
      </div>
    );
  }

  return (
    <div
      className="app-screen min-w-0 max-w-full overflow-x-hidden"
      style={{ paddingBottom: spacing[24] + 80, paddingLeft: spacing[16], paddingRight: spacing[16], paddingTop: spacing[16] }}
    >
      <h1 className="text-[22px] font-semibold mb-1" style={{ color: colors.text }}>Gym & equipment</h1>
      <p className="text-[15px] mb-6" style={{ color: colors.muted }}>Help your coach tailor your plan to what you have access to.</p>

      <Card style={{ padding: spacing[16] }}>
        <label className="block text-sm font-medium mb-2" style={{ color: colors.muted }}>Gym name</label>
        <input
          value={gymName}
          onChange={(e) => setGymName(e.target.value)}
          placeholder="e.g. City Fitness"
          className="w-full rounded-xl py-2.5 px-3 mb-4 focus:outline-none focus:ring-1"
          style={{ background: 'rgba(255,255,255,0.06)', border: `1px solid ${colors.border}`, color: colors.text }}
        />
        <p className="text-sm font-medium mb-2" style={{ color: colors.muted }}>Equipment available</p>
        {['rack', 'smith', 'cables', 'hackSquat'].map((key) => (
          <label key={key} className="flex items-center gap-2 mb-2">
            <input
              type="checkbox"
              checked={key === 'rack' ? rack : key === 'smith' ? smith : key === 'cables' ? cables : hackSquat}
              onChange={(e) => {
                const v = e.target.checked;
                if (key === 'rack') setRack(v);
                else if (key === 'smith') setSmith(v);
                else if (key === 'cables') setCables(v);
                else setHackSquat(v);
              }}
            />
            <span className="text-sm" style={{ color: colors.text }}>{EQUIPMENT_LABELS[key] || key}</span>
          </label>
        ))}
        <label className="block text-sm font-medium mt-3 mb-2" style={{ color: colors.muted }}>{EQUIPMENT_LABELS.dbMax}</label>
        <input
          type="text"
          inputMode="decimal"
          value={dbMax}
          onChange={(e) => { const val = e.target.value; if (/^\d*\.?\d*$/.test(val)) setDbMax(val); }}
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
        <Button variant="primary" onClick={handleSave} disabled={saving} style={{ width: '100%', marginTop: spacing[16] }}>
          {saving ? 'Saving…' : 'Save'}
        </Button>
      </Card>
    </div>
  );
}
