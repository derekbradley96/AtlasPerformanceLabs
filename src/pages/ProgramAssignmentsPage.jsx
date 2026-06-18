/**
 * Assign a program block to a client. Coach selects client, block, start date, active flag.
 * One active assignment per client; saving a new active assignment deactivates others.
 * Entry: Program Builder ("Assign to Client") or Client Detail ("Assign Program").
 */
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import TopBar from '@/components/ui/TopBar';
import Card from '@/ui/Card';
import { getSupabase, hasSupabase } from '@/lib/supabaseClient';
import { useAuth } from '@/lib/AuthContext';
import { isCoach } from '@/lib/roles';
import { colors, spacing, shell, radii } from '@/ui/tokens';
import { runProgramNutritionDiagnostic } from '@/lib/diagnostics/programNutritionDiagnostic';

const PAGE_PADDING = { paddingLeft: shell.pagePaddingH, paddingRight: shell.pagePaddingH };

async function fetchCoachClients(supabase, userId) {
  if (!supabase || !userId) return [];
  const { data, error } = await supabase
    .from('clients')
    .select('id, name')
    .or(`coach_id.eq.${userId},trainer_id.eq.${userId}`)
    .order('name');
  if (error) return [];
  return (data || []).map((c) => ({ id: c.id, name: c.name || 'Client' }));
}

async function fetchBlock(supabase, blockId) {
  if (!supabase || !blockId) return null;
  const { data, error } = await supabase.from('program_blocks').select('*').eq('id', blockId).maybeSingle();
  if (error || !data) return null;
  return data;
}

async function fetchBlocksForClient(supabase, clientId) {
  if (!supabase || !clientId) return [];
  const { data, error } = await supabase
    .from('program_blocks')
    .select('id, title, total_weeks, created_at')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false });
  if (error) return [];
  return data || [];
}

async function fetchCoachBlocks(supabase, coachId) {
  if (!supabase || !coachId) return [];
  const { data, error } = await supabase
    .from('program_blocks')
    .select('id, title, total_weeks, created_at, client_id')
    .or(`coach_id.eq.${coachId},owner_profile_id.eq.${coachId}`)
    .order('created_at', { ascending: false });
  if (error) return [];
  return data || [];
}

export default function ProgramAssignmentsPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const clientIdParam = searchParams.get('clientId');
  const blockIdParam = searchParams.get('blockId');
  const contextSource = searchParams.get('source') || '';
  const contextNote = searchParams.get('note') || '';
  const { user, effectiveRole } = useAuth();
  const showContextBanner = contextSource === 'checkin' || contextSource === 'pose_check';
  const contextBannerLabel = contextSource === 'checkin' ? 'check-in review' : contextSource === 'pose_check' ? 'pose check review' : '';

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [clients, setClients] = useState([]);
  const [blocks, setBlocks] = useState([]);
  const [showClientOnlyBlocks, setShowClientOnlyBlocks] = useState(false);
  const [clientId, setClientId] = useState(clientIdParam || '');
  const [blockId, setBlockId] = useState(blockIdParam || '');
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [isActive, setIsActive] = useState(true);
  const [personalizeName, setPersonalizeName] = useState(false);
  const [clientDisplayName, setClientDisplayName] = useState('');
  const [assignmentSuccessBanner, setAssignmentSuccessBanner] = useState('');

  const isCoachRole = isCoach(effectiveRole);
  const supabase = hasSupabase ? getSupabase() : null;
  const coachId = user?.id ?? null;

  const loadClients = useCallback(async () => {
    if (!supabase || !coachId) return;
    const list = await fetchCoachClients(supabase, coachId);
    setClients(list);
  }, [supabase, coachId]);

  useEffect(() => {
    if (!isCoachRole) {
      setLoading(false);
      return;
    }
    (async () => {
      await loadClients();
      if (clientIdParam) setClientId(clientIdParam);
      if (blockIdParam) setBlockId(blockIdParam);
      setLoading(false);
    })();
  }, [isCoachRole, loadClients, clientIdParam, blockIdParam]);

  useEffect(() => {
    if (!import.meta.env.DEV || !coachId) return;
    runProgramNutritionDiagnostic(coachId, 'coach', clientId).catch(console.error);
  }, [coachId, clientId]);

  // When opening with blockId only, load block to get client_id and pre-fill client.
  useEffect(() => {
    if (!blockIdParam || !supabase) return;
    let cancelled = false;
    fetchBlock(supabase, blockIdParam).then((b) => {
      if (!cancelled && b?.client_id) setClientId(b.client_id);
    });
    return () => { cancelled = true; };
  }, [blockIdParam, supabase]);

  // Load blocks for selected client (legacy scoped view).
  useEffect(() => {
    if (!showClientOnlyBlocks) return undefined;
    if (!clientId || !supabase) {
      setBlocks([]);
      return;
    }
    let cancelled = false;
    fetchBlocksForClient(supabase, clientId).then((list) => {
      if (!cancelled) {
        setBlocks(list);
        if (blockIdParam && list.some((b) => b.id === blockIdParam)) setBlockId(blockIdParam);
        else if (list.length > 0) setBlockId(list[0].id);
        else setBlockId('');
      }
    });
    return () => { cancelled = true; };
  }, [clientId, supabase, blockIdParam, showClientOnlyBlocks]);

  // Preferred path: show coach-owned block library (assignment source-of-truth).
  useEffect(() => {
    if (showClientOnlyBlocks) return undefined;
    if (!supabase || !coachId) {
      setBlocks([]);
      return undefined;
    }
    let cancelled = false;
    fetchCoachBlocks(supabase, coachId).then((list) => {
      if (cancelled) return;
      setBlocks(list);
      if (blockIdParam && list.some((b) => b.id === blockIdParam)) setBlockId(blockIdParam);
      else if (!blockId && list.length > 0) setBlockId(list[0].id);
    });
    return () => { cancelled = true; };
  }, [supabase, coachId, showClientOnlyBlocks, blockIdParam, blockId]);

  const handleSubmit = async () => {
    if (!supabase || !clientId || !blockId) {
      toast.error('Select a client and a program block');
      return;
    }
    setSaving(true);
    try {
      if (isActive) {
        const { error: updateErr } = await supabase
          .from('program_block_assignments')
          .update({ is_active: false })
          .eq('client_id', clientId);
        if (updateErr) throw updateErr;
      }
      const { error: insertErr } = await supabase.from('program_block_assignments').insert({
        client_id: clientId,
        program_block_id: blockId,
        start_date: startDate,
        is_active: !!isActive,
        client_display_name: personalizeName ? (clientDisplayName || '').trim() || null : null,
      });
      if (insertErr) throw insertErr;
      const selectedClientName = clients.find((c) => c.id === clientId)?.name || 'Client';
      const selectedProgramTitle =
        blocks.find((b) => b.id === blockId)?.title || 'Program';
      const normalizedStartDate = startDate || new Date().toISOString().slice(0, 10);
      toast.success(`Program assigned — ${selectedClientName} will see this in their app`);
      setAssignmentSuccessBanner(
        `✓ ${selectedProgramTitle} assigned to ${selectedClientName} starting ${normalizedStartDate}`
      );
      setTimeout(() => {
        navigate(`/clients/${clientId}?tab=program`);
      }, 2000);
    } catch (e) {
      toast.error(e?.message || 'Failed to save assignment');
    } finally {
      setSaving(false);
    }
  };

  if (!isCoachRole) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ background: colors.bg, color: colors.text }}>
        <p style={{ color: colors.muted }}>Assignments are for coaches only.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: colors.bg }}>
        <div className="w-8 h-8 border-2 border-white/20 rounded-full animate-spin" style={{ borderTopColor: colors.primary }} />
      </div>
    );
  }

  const inputBase = {
    padding: `${spacing[10]}px ${spacing[12]}px`,
    borderRadius: radii.button,
    background: colors.surface2,
    border: `1px solid ${shell.cardBorder}`,
    color: colors.text,
    fontSize: 14,
    width: '100%',
  };

  return (
    <div className="min-h-screen pb-8" style={{ background: colors.bg, color: colors.text }}>
      <TopBar title="Assign Program" onBack={() => navigate(-1)} />
      <div style={{ ...PAGE_PADDING, paddingTop: spacing[16] }}>
        {showContextBanner && contextBannerLabel && (
          <div
            style={{
              marginBottom: spacing[16],
              padding: spacing[12],
              borderRadius: 8,
              background: colors.primarySubtle,
              border: `1px solid ${colors.primary}`,
            }}
          >
            <p style={{ fontSize: 13, fontWeight: 500, color: colors.text, margin: 0 }}>
              Assigning program after {contextBannerLabel}
            </p>
            {contextNote && (
              <p style={{ fontSize: 12, color: colors.muted, margin: 0, marginTop: 4 }} title={contextNote}>
                {contextNote.length > 80 ? `${contextNote.slice(0, 80)}…` : contextNote}
              </p>
            )}
          </div>
        )}
        {assignmentSuccessBanner && (
          <div
            style={{
              marginBottom: spacing[16],
              padding: spacing[12],
              borderRadius: 8,
              background: 'rgba(34, 197, 94, 0.14)',
              border: '1px solid rgba(34, 197, 94, 0.45)',
              color: colors.text,
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            {assignmentSuccessBanner}
          </div>
        )}
        <Card style={{ marginBottom: spacing[16], padding: spacing[16] }}>
          <label className="block text-sm font-medium mb-1" style={{ color: colors.muted }}>Client</label>
          <select
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            style={inputBase}
            aria-label="Select client"
          >
            <option value="">— Select client —</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>

          <label className="block text-sm font-medium mt-4 mb-1" style={{ color: colors.muted }}>Program block</label>
          <label className="flex items-center gap-2 mb-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showClientOnlyBlocks}
              onChange={(e) => setShowClientOnlyBlocks(e.target.checked)}
              style={{ accentColor: colors.primary }}
              aria-label="Show client-only blocks"
            />
            <span className="text-xs" style={{ color: colors.muted }}>
              Show only this client's existing blocks
            </span>
          </label>
          <select
            value={blockId}
            onChange={(e) => setBlockId(e.target.value)}
            style={inputBase}
            disabled={!clientId && showClientOnlyBlocks}
            aria-label="Select program block"
          >
            <option value="">— Select block —</option>
            {blocks.map((b) => (
              <option key={b.id} value={b.id}>
                {b.title || 'Untitled'} ({b.total_weeks}w){b.client_id ? ` • Client scoped` : ''}
              </option>
            ))}
          </select>
          {clientId && blocks.length === 0 && (
            <p className="text-xs mt-1" style={{ color: colors.muted }}>No blocks for this client. Create one in Program Builder first.</p>
          )}

          <label className="block text-sm font-medium mt-4 mb-1" style={{ color: colors.muted }}>Start date</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            style={inputBase}
            aria-label="Start date"
          />

          <label className="flex items-center gap-2 mt-4 cursor-pointer">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              style={{ accentColor: colors.primary }}
              aria-label="Set as active program"
            />
            <span className="text-sm" style={{ color: colors.text }}>Set as active program</span>
          </label>
          <p className="text-xs mt-1" style={{ color: colors.muted }}>
            Only one active program per client. Turning this on will deactivate any current assignment.
          </p>

          {clientId ? (
            <>
              <label className="flex items-center gap-2 mt-4 cursor-pointer">
                <input
                  type="checkbox"
                  checked={personalizeName}
                  onChange={(e) => setPersonalizeName(e.target.checked)}
                  style={{ accentColor: colors.primary }}
                  aria-label="Personalize name for client"
                />
                <span className="text-sm" style={{ color: colors.text }}>
                  Personalise for {clients.find((c) => c.id === clientId)?.name || 'client'}
                </span>
              </label>
              {personalizeName ? (
                <>
                  <label className="block text-sm font-medium mt-3 mb-1" style={{ color: colors.muted }}>
                    Client-facing program name
                  </label>
                  <input
                    type="text"
                    value={clientDisplayName}
                    onChange={(e) => setClientDisplayName(e.target.value)}
                    placeholder={`${
                      clients.find((c) => c.id === clientId)?.name || 'Client'
                    }'s 12-Week Strength Block`}
                    style={inputBase}
                    aria-label="Client-facing program name"
                  />
                </>
              ) : null}
            </>
          ) : null}

          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving || !clientId || !blockId}
            style={{
              marginTop: spacing[20],
              padding: `${spacing[12]}px ${spacing[20]}px`,
              borderRadius: radii.button,
              background: colors.primary,
              color: '#fff',
              border: 'none',
              fontSize: 14,
              fontWeight: 600,
              cursor: saving ? 'wait' : 'pointer',
            }}
          >
            {saving ? 'Saving…' : 'Assign program'}
          </button>
        </Card>
      </div>
    </div>
  );
}
