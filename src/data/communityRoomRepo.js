/**
 * Coach-owned community room — Supabase group_rooms / group_messages.
 * @see supabase/migrations/20260412150000_coach_community_rooms.sql
 */
import { getSupabase, hasSupabase } from '@/lib/supabaseClient';

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} coachId profiles.id / auth uid of coach
 */
export async function syncCommunityMembers(supabase, coachId) {
  if (!supabase || !coachId) return;
  const { error } = await supabase.rpc('atlas_sync_community_members', { p_coach_id: coachId });
  if (error) throw error;
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} coachId
 */
export async function fetchRoomForCoach(supabase, coachId) {
  const primary = await supabase
    .from('group_rooms')
    .select('id, coach_id, name, room_mode, is_active, rules_text, pinned_message_id, room_muted, created_at, updated_at')
    .eq('coach_id', coachId)
    .order('updated_at', { ascending: false })
    .limit(1);
  if (!primary.error) return Array.isArray(primary.data) ? (primary.data[0] || null) : null;

  const primaryMessage = String(primary.error?.message || '').toLowerCase();
  const canFallbackToTrainerId =
    primary.error?.code === '42703'
    || primaryMessage.includes('coach_id')
    || primaryMessage.includes('column');
  if (!canFallbackToTrainerId) throw primary.error;

  // Back-compat for environments still using trainer_id naming.
  const fallback = await supabase
    .from('group_rooms')
    .select('id, trainer_id, name, room_mode, is_active, rules_text, pinned_message_id, room_muted, created_at, updated_at')
    .eq('trainer_id', coachId)
    .order('updated_at', { ascending: false })
    .limit(1);
  if (fallback.error) throw fallback.error;
  const row = Array.isArray(fallback.data) ? (fallback.data[0] || null) : null;
  if (!row) return null;
  return {
    ...row,
    coach_id: row.trainer_id,
  };
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} userId
 */
export async function fetchRoomForMember(supabase, userId) {
  if (!supabase || !userId) return null;
  const { data: memberRows, error: memberError } = await supabase
    .from('group_room_members')
    .select('room_id, joined_at')
    .eq('user_id', userId)
    .eq('member_status', 'active')
    .order('joined_at', { ascending: false })
    .limit(1);
  if (memberError) throw memberError;
  const roomId = Array.isArray(memberRows) ? memberRows[0]?.room_id : null;
  if (!roomId) return null;

  const { data: room, error: roomError } = await supabase
    .from('group_rooms')
    .select('id, coach_id, name, room_mode, is_active, rules_text, pinned_message_id, room_muted, created_at, updated_at')
    .eq('id', roomId)
    .maybeSingle();
  if (roomError) throw roomError;
  return room || null;
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} roomId
 * @param {number} [limit]
 */
export async function listGroupMessages(supabase, roomId, limit = 60) {
  const { data, error } = await supabase
    .from('group_messages')
    .select('id, room_id, sender_user_id, sender_role, message_type, body, media_url, metadata_json, reply_to_id, created_at')
    .eq('room_id', roomId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return Array.isArray(data) ? data.reverse() : [];
}

/**
 * Fetch older group messages before a cursor timestamp.
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} roomId
 * @param {string} beforeCreatedAt
 * @param {number} [limit]
 */
export async function listGroupMessagesBefore(supabase, roomId, beforeCreatedAt, limit = 60) {
  if (!supabase || !roomId || !beforeCreatedAt) return [];
  const { data, error } = await supabase
    .from('group_messages')
    .select('id, room_id, sender_user_id, sender_role, message_type, body, media_url, metadata_json, reply_to_id, created_at')
    .eq('room_id', roomId)
    .is('deleted_at', null)
    .lt('created_at', beforeCreatedAt)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return Array.isArray(data) ? data.reverse() : [];
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} messageId
 */
export async function fetchGroupMessageById(supabase, messageId) {
  if (!messageId) return null;
  const { data, error } = await supabase
    .from('group_messages')
    .select('id, room_id, sender_user_id, sender_role, message_type, body, media_url, metadata_json, created_at')
    .eq('id', messageId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {object} row
 */
export async function insertGroupMessage(supabase, row) {
  const { data, error } = await supabase
    .from('group_messages')
    .insert(row)
    .select('id, created_at')
    .single();
  if (error) throw error;
  return data;
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} messageId
 * @param {string} roomId
 * @param {string} coachId
 */
export async function coachSoftDeleteMessage(supabase, messageId, roomId, coachId) {
  const rpcAttempt = await supabase.rpc('atlas_community_soft_delete_message', {
    p_room_id: roomId,
    p_message_id: messageId,
  });
  if (!rpcAttempt.error) return;
  const rpcMissing = rpcAttempt.error?.code === '42883'
    || String(rpcAttempt.error?.message || '').toLowerCase().includes('atlas_community_soft_delete_message');
  if (!rpcMissing) throw rpcAttempt.error;

  const { error } = await supabase
    .from('group_messages')
    .update({ deleted_at: new Date().toISOString(), deleted_by: coachId })
    .eq('id', messageId)
    .eq('room_id', roomId);
  if (error) throw error;
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} roomId
 * @param {string|null} pinnedMessageId
 */
export async function coachSetPinnedMessage(supabase, roomId, pinnedMessageId) {
  const rpcAttempt = await supabase.rpc('atlas_community_set_pinned_message', {
    p_room_id: roomId,
    p_message_id: pinnedMessageId ?? null,
  });
  if (!rpcAttempt.error) return;
  const rpcMissing = rpcAttempt.error?.code === '42883'
    || String(rpcAttempt.error?.message || '').toLowerCase().includes('atlas_community_set_pinned_message');
  if (!rpcMissing) throw rpcAttempt.error;

  const { error } = await supabase
    .from('group_rooms')
    .update({ pinned_message_id: pinnedMessageId, updated_at: new Date().toISOString() })
    .eq('id', roomId);
  if (error) throw error;
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} roomId
 * @param {'community'|'coach_led'} mode
 */
export async function coachSetRoomMode(supabase, roomId, mode) {
  const { error } = await supabase
    .from('group_rooms')
    .update({ room_mode: mode, updated_at: new Date().toISOString() })
    .eq('id', roomId);
  if (error) throw error;
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} roomId
 * @param {string} userId
 */
export async function markCommunityRead(supabase, roomId, userId) {
  const { error } = await supabase
    .from('group_room_members')
    .update({ last_read_at: new Date().toISOString() })
    .eq('room_id', roomId)
    .eq('user_id', userId)
    .eq('member_status', 'active');
  if (error) throw error;
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} userId auth uid
 */
export async function fetchClientCoachId(supabase, userId) {
  const primary = await supabase
    .from('clients')
    .select('coach_id')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1);
  if (!primary.error) return Array.isArray(primary.data) ? (primary.data[0]?.coach_id ?? null) : null;

  const primaryMessage = String(primary.error?.message || '').toLowerCase();
  const canFallbackToTrainerId =
    primary.error?.code === '42703'
    || primaryMessage.includes('coach_id')
    || primaryMessage.includes('column');
  if (!canFallbackToTrainerId) throw primary.error;

  // Back-compat for environments still using trainer_id naming.
  const fallback = await supabase
    .from('clients')
    .select('trainer_id')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1);
  if (fallback.error) throw fallback.error;
  return Array.isArray(fallback.data) ? (fallback.data[0]?.trainer_id ?? null) : null;
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} roomId
 * @returns {Promise<Array<{ user_id: string, role: 'coach' | 'client', name: string }>>}
 */
export async function listActiveRoomMembers(supabase, roomId) {
  if (!supabase || !roomId) return [];
  const { data: members, error: membersError } = await supabase
    .from('group_room_members')
    .select('user_id, role, member_status, is_muted')
    .eq('room_id', roomId)
    .eq('member_status', 'active');
  if (membersError) throw membersError;
  const userIds = Array.isArray(members) ? members.map((m) => m.user_id).filter(Boolean) : [];
  if (userIds.length === 0) return [];

  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('id, display_name, full_name, name')
    .in('id', userIds);
  if (profilesError) throw profilesError;

  const { data: roomRow } = await supabase
    .from('group_rooms')
    .select('coach_id')
    .eq('id', roomId)
    .maybeSingle();

  const clientsByUserId = new Map();
  // Primary source: any client row tied to the sender auth user id.
  const { data: directClientRows } = await supabase
    .from('clients')
    .select('user_id, name, coach_id, trainer_id')
    .in('user_id', userIds)
    .not('user_id', 'is', null);
  for (const row of Array.isArray(directClientRows) ? directClientRows : []) {
    if (!row?.user_id) continue;
    const candidate = (row.name || '').toString().trim();
    if (!candidate) continue;
    if (!clientsByUserId.has(row.user_id)) clientsByUserId.set(row.user_id, candidate);
  }
  // Secondary source: rows scoped to this room coach (handles stricter RLS setups).
  if (roomRow?.coach_id) {
    const { data: scopedClientRows } = await supabase
      .from('clients')
      .select('user_id, name')
      .or(`coach_id.eq.${roomRow.coach_id},trainer_id.eq.${roomRow.coach_id},assigned_coach_id.eq.${roomRow.coach_id}`)
      .in('user_id', userIds)
      .not('user_id', 'is', null);
    for (const row of Array.isArray(scopedClientRows) ? scopedClientRows : []) {
      if (!row?.user_id) continue;
      const candidate = (row.name || '').toString().trim();
      if (!candidate) continue;
      if (!clientsByUserId.has(row.user_id)) clientsByUserId.set(row.user_id, candidate);
    }
  }

  const profileMap = new Map(
    (Array.isArray(profiles) ? profiles : []).map((p) => [
      p.id,
      p.display_name || p.full_name || p.name || null,
    ])
  );

  return (Array.isArray(members) ? members : []).map((m) => ({
    user_id: m.user_id,
    role: m.role,
    member_status: m.member_status,
    is_muted: !!m.is_muted,
    name: profileMap.get(m.user_id) || clientsByUserId.get(m.user_id) || (m.role === 'coach' ? 'Coach' : 'Client'),
  }));
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} roomId
 */
export async function listRoomMembersForCoach(supabase, roomId) {
  if (!supabase || !roomId) return [];
  const { data: members, error: membersError } = await supabase
    .from('group_room_members')
    .select('user_id, role, member_status, is_muted, joined_at')
    .eq('room_id', roomId)
    .order('joined_at', { ascending: true });
  if (membersError) throw membersError;
  const userIds = Array.isArray(members) ? members.map((m) => m.user_id).filter(Boolean) : [];
  if (userIds.length === 0) return [];

  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('id, display_name, full_name, name')
    .in('id', userIds);
  if (profilesError) throw profilesError;

  const { data: roomRow } = await supabase
    .from('group_rooms')
    .select('coach_id')
    .eq('id', roomId)
    .maybeSingle();

  const clientsByUserId = new Map();
  const { data: directClientRows } = await supabase
    .from('clients')
    .select('user_id, name, coach_id, trainer_id')
    .in('user_id', userIds)
    .not('user_id', 'is', null);
  for (const row of Array.isArray(directClientRows) ? directClientRows : []) {
    if (!row?.user_id) continue;
    const candidate = (row.name || '').toString().trim();
    if (!candidate) continue;
    if (!clientsByUserId.has(row.user_id)) clientsByUserId.set(row.user_id, candidate);
  }
  if (roomRow?.coach_id) {
    const { data: scopedClientRows } = await supabase
      .from('clients')
      .select('user_id, name')
      .or(`coach_id.eq.${roomRow.coach_id},trainer_id.eq.${roomRow.coach_id},assigned_coach_id.eq.${roomRow.coach_id}`)
      .in('user_id', userIds)
      .not('user_id', 'is', null);
    for (const row of Array.isArray(scopedClientRows) ? scopedClientRows : []) {
      if (!row?.user_id) continue;
      const candidate = (row.name || '').toString().trim();
      if (!candidate) continue;
      if (!clientsByUserId.has(row.user_id)) clientsByUserId.set(row.user_id, candidate);
    }
  }

  const profileMap = new Map(
    (Array.isArray(profiles) ? profiles : []).map((p) => [
      p.id,
      p.display_name || p.full_name || p.name || null,
    ])
  );

  return (Array.isArray(members) ? members : []).map((m) => ({
    user_id: m.user_id,
    role: m.role,
    member_status: m.member_status,
    is_muted: !!m.is_muted,
    joined_at: m.joined_at,
    name: profileMap.get(m.user_id) || clientsByUserId.get(m.user_id) || (m.role === 'coach' ? 'Coach' : 'Client'),
  }));
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} roomId
 * @param {boolean} isActive
 */
export async function coachSetCommunityActive(supabase, roomId, isActive) {
  const { error } = await supabase
    .from('group_rooms')
    .update({ is_active: !!isActive, updated_at: new Date().toISOString() })
    .eq('id', roomId);
  if (error) throw error;
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} roomId
 * @param {string} rulesText
 */
export async function coachSetCommunityRules(supabase, roomId, rulesText) {
  const { error } = await supabase
    .from('group_rooms')
    .update({ rules_text: String(rulesText || ''), updated_at: new Date().toISOString() })
    .eq('id', roomId);
  if (error) throw error;
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} roomId
 * @param {string} userId
 * @param {{ isMuted?: boolean, memberStatus?: 'active' | 'removed' }} updates
 */
export async function coachSetMemberModeration(supabase, roomId, userId, updates = {}) {
  if (!supabase || !roomId || !userId) return;
  const payload = {};
  if (typeof updates.isMuted === 'boolean') payload.is_muted = updates.isMuted;
  if (updates.memberStatus) payload.member_status = updates.memberStatus;
  const { error } = await supabase
    .from('group_room_members')
    .update(payload)
    .eq('room_id', roomId)
    .eq('user_id', userId);
  if (error) throw error;
}

/**
 * Create-or-fetch coach community room and ensure coach membership.
 * Uses direct table writes as deterministic activation fallback.
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} coachId
 * @param {{ rulesText?: string }} [options]
 */
export async function ensureCoachCommunityRoom(supabase, coachId, options = {}) {
  if (!supabase || !coachId) return null;
  const existing = await fetchRoomForCoach(supabase, coachId);
  if (existing) return existing;

  const insertPayload = {
    coach_id: coachId,
    name: 'Team',
    room_mode: 'community',
    is_active: true,
    rules_text: String(options.rulesText || ''),
  };

  const { data: created, error: createError } = await supabase
    .from('group_rooms')
    .insert(insertPayload)
    .select('id, coach_id, name, room_mode, is_active, rules_text, pinned_message_id, room_muted, created_at, updated_at')
    .maybeSingle();

  if (createError) {
    // If another process created it at the same time, fetch latest.
    const fallback = await fetchRoomForCoach(supabase, coachId);
    if (fallback) return fallback;
    throw createError;
  }

  const room = created || (await fetchRoomForCoach(supabase, coachId));
  if (!room?.id) return room || null;

  await supabase
    .from('group_room_members')
    .upsert(
      {
        room_id: room.id,
        user_id: coachId,
        role: 'coach',
        member_status: 'active',
        is_muted: false,
      },
      { onConflict: 'room_id,user_id' }
    );

  return room;
}

export { hasSupabase, getSupabase };
