/**
 * Automation engine: persist events, load rules, evaluate conditions, execute actions.
 * automation_rules: trigger_type, condition jsonb, action_type
 * automation_events: event_type, payload jsonb
 *
 * Supported action_type values:
 * - send_notification | notification | notify → insert notifications (payload.user_id, title, message, type)
 * - create_review_item → insert review_queue_items (payload.coach_id, client_id; optional item_type, priority, reasons)
 * - flag_client → insert client_flags (payload.client_id; optional severity, label)
 * - send_message → ensureThread + message_messages as coach (payload.coach_id, client_id, text)
 * - noop | none | log
 *
 * RLS on automation_* has no policies by default — pass options.client (service role)
 * from an Edge Function; review_queue_items / client_flags / messages need coach context or service role.
 */

import { getSupabase, hasSupabase } from '@/lib/supabaseClient';
import { getReminderCopy } from '@/lib/reminderTriggers';

/**
 * @typedef {import('@supabase/supabase-js').SupabaseClient} SupabaseClient
 */

/**
 * Evaluate rule condition against event payload.
 * - condition null/undefined/{} → match
 * - condition.match → shallow: every key in match must equal payload[key] (strict ===)
 * - condition.path + condition.equals → payload[path] === equals (path dotted optional)
 * @param {Record<string, unknown> | null} condition
 * @param {Record<string, unknown>} payload
 * @returns {boolean}
 */
export function evaluateCondition(condition, payload) {
  if (condition == null || typeof condition !== 'object') return true;
  const c = /** @type {Record<string, unknown>} */ (condition);
  if (Object.keys(c).length === 0) return true;

  if (c.match && typeof c.match === 'object' && !Array.isArray(c.match)) {
    const match = /** @type {Record<string, unknown>} */ (c.match);
    for (const [key, val] of Object.entries(match)) {
      if (payload[key] !== val) return false;
    }
    return true;
  }

  if (typeof c.path === 'string' && 'equals' in c) {
    const path = c.path.split('.');
    let cur = payload;
    for (const p of path) {
      if (cur == null || typeof cur !== 'object') return false;
      cur = /** @type {Record<string, unknown>} */ (cur)[p];
    }
    return cur === c.equals;
  }

  // No recognized predicate keys → match (condition used only for action hints)
  return true;
}

/**
 * Execute a single rule action. Extensible by action_type.
 * @param {{ id?: string; action_type?: string; condition?: Record<string, unknown> }} rule
 * @param {Record<string, unknown>} payload
 * @param {{ client?: SupabaseClient }} [options]
 * @returns {Promise<{ ok: boolean; action?: string; error?: string }>}
 */
export async function executeAction(rule, payload, options = {}) {
  const client = options.client ?? getSupabase();
  if (!client) {
    return { ok: false, error: 'No Supabase client' };
  }

  const actionType = (rule.action_type || '').toLowerCase();

  if (actionType === 'noop' || actionType === 'none' || !actionType) {
    return { ok: true, action: 'noop' };
  }

  // send_notification — same as notification (canonical name for rules)
  if (
    actionType === 'send_notification' ||
    actionType === 'notification' ||
    actionType === 'notify'
  ) {
    const userId = payload.user_id ?? payload.userId;
    if (!userId || typeof userId !== 'string') {
      return { ok: false, error: 'notification action requires payload.user_id' };
    }
    const type = (payload.type || payload.event_type || 'automation').toString();
    const title =
      (payload.title && String(payload.title)) ||
      (rule.condition && typeof rule.condition === 'object' && rule.condition.title
        ? String(rule.condition.title)
        : null) ||
      getReminderCopy(type).title;
    const message =
      (payload.message && String(payload.message)) ||
      (rule.condition && typeof rule.condition === 'object' && rule.condition.message
        ? String(rule.condition.message)
        : null) ||
      getReminderCopy(type).message;

    const { error } = await client.from('notifications').insert({
      user_id: userId,
      type,
      title,
      message,
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true, action: 'send_notification' };
  }

  /**
   * create_review_item — insert public.review_queue_items
   * Payload: coach_id, client_id required.
   * Optional: item_type (must be checkin|pose_check|retention_risk|billing_overdue|flag; default 'flag'),
   * priority, reasons (string[]), review_payload (object merged into payload column).
   */
  if (actionType === 'create_review_item') {
    const coachId = payload.coach_id ?? payload.coachId;
    const clientId = payload.client_id ?? payload.clientId;
    if (!coachId || !clientId) {
      return { ok: false, error: 'create_review_item requires payload.coach_id and payload.client_id' };
    }
    const allowedTypes = ['checkin', 'pose_check', 'retention_risk', 'billing_overdue', 'flag'];
    const itemType = (payload.item_type || payload.itemType || 'flag').toString();
    if (!allowedTypes.includes(itemType)) {
      return { ok: false, error: `create_review_item item_type must be one of: ${allowedTypes.join(', ')}` };
    }
    const priority = Number(payload.priority);
    const reasons = Array.isArray(payload.reasons)
      ? payload.reasons.map((r) => String(r))
      : payload.reason
        ? [String(payload.reason)]
        : ['automation_rule'];
    const payloadJson =
      payload.review_payload && typeof payload.review_payload === 'object'
        ? payload.review_payload
        : typeof payload.payload === 'object' && payload.payload !== null
          ? payload.payload
          : { source: 'automation', rule_id: rule.id };

    const { error } = await client.from('review_queue_items').insert({
      coach_id: coachId,
      client_id: clientId,
      item_type: itemType,
      priority: Number.isFinite(priority) ? priority : 50,
      reasons,
      payload: payloadJson,
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true, action: 'create_review_item' };
  }

  /**
   * flag_client — insert public.client_flags
   * Payload: client_id required. Optional: severity (low|medium|high|critical), label.
   */
  if (actionType === 'flag_client') {
    const clientId = payload.client_id ?? payload.clientId;
    if (!clientId) {
      return { ok: false, error: 'flag_client requires payload.client_id' };
    }
    const allowedSeverity = ['low', 'medium', 'high', 'critical'];
    const severity = (payload.severity || 'medium').toString().toLowerCase();
    const safeSeverity = allowedSeverity.includes(severity) ? severity : 'medium';
    const label =
      (payload.label && String(payload.label)) ||
      (payload.message && String(payload.message)) ||
      'Automation flag';

    const { error } = await client.from('client_flags').insert({
      client_id: clientId,
      severity: safeSeverity,
      label,
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true, action: 'flag_client' };
  }

  /**
   * send_message — ensure thread then insert message_messages as coach
   * Payload: coach_id, client_id, text (or message) required.
   */
  if (actionType === 'send_message') {
    const coachId = payload.coach_id ?? payload.coachId;
    const clientId = payload.client_id ?? payload.clientId;
    const text = (payload.text ?? payload.message ?? '').toString().trim();
    if (!coachId || !clientId) {
      return { ok: false, error: 'send_message requires payload.coach_id and payload.client_id' };
    }
    if (!text) {
      return { ok: false, error: 'send_message requires payload.text or payload.message' };
    }
    try {
      const { ensureThread, sendMessage } = await import('@/lib/messaging/supabaseMessaging.js');
      const thread = await ensureThread({ supabase: client, coachId, clientId });
      await sendMessage({ supabase: client, threadId: thread.id, text, senderRole: 'coach' });
      return { ok: true, action: 'send_message' };
    } catch (e) {
      const msg = e && typeof e === 'object' && 'message' in e ? String(e.message) : String(e);
      return { ok: false, error: msg };
    }
  }

  if (actionType === 'log') {
    if (import.meta.env?.DEV) {
      console.log('[automationEngine] executeAction log', { rule: rule.id, payload });
    }
    return { ok: true, action: 'log' };
  }

  return { ok: false, error: `Unknown action_type: ${rule.action_type}` };
}

/**
 * Load rules for trigger and run condition + executeAction for each match.
 * @param {string} eventType
 * @param {Record<string, unknown>} payload
 * @param {{ client?: SupabaseClient; limit?: number }} [options]
 * @returns {Promise<{ matched: number; executed: number; results: Array<{ ruleId: string; result: Awaited<ReturnType<typeof executeAction>> }> }>}
 */
export async function runAutomationRules(eventType, payload, options = {}) {
  const client = options.client ?? getSupabase();
  const results = [];
  if (!client || !eventType) {
    return { matched: 0, executed: 0, results };
  }

  let query = client
    .from('automation_rules')
    .select('id, trigger_type, condition, action_type')
    .eq('trigger_type', eventType);

  const limit = options.limit ?? 100;
  const { data: rules, error } = await query.limit(limit);

  if (error || !rules?.length) {
    return { matched: 0, executed: 0, results };
  }

  let matched = 0;
  let executed = 0;

  for (const rule of rules) {
    const condition = rule.condition && typeof rule.condition === 'object' ? rule.condition : {};
    if (!evaluateCondition(condition, payload)) continue;
    matched += 1;
    const result = await executeAction(rule, payload, { client });
    results.push({ ruleId: rule.id, result });
    if (result.ok) executed += 1;
  }

  return { matched, executed, results };
}

/**
 * Persist event then run matching automation rules.
 * @param {string} eventType
 * @param {Record<string, unknown>} [payload]
 * @param {{ client?: SupabaseClient; skipPersist?: boolean }} [options]
 * @returns {Promise<{ eventId: string | null; run: Awaited<ReturnType<typeof runAutomationRules>> }>}
 */
export async function processEvent(eventType, payload = {}, options = {}) {
  const client = options.client ?? (hasSupabase ? getSupabase() : null);
  const safePayload = payload && typeof payload === 'object' ? payload : {};
  let eventId = null;

  if (client && !options.skipPersist) {
    const { data, error } = await client.from('automation_events').insert({
      event_type: eventType,
      payload: safePayload,
    }).select('id').maybeSingle();
    if (!error && data?.id) eventId = data.id;
  }

  const run = await runAutomationRules(eventType, safePayload, { client: options.client ?? client });

  return { eventId, run };
}
