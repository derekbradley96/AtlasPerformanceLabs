/**
 * Single data access layer for UI. Clients + check-ins: Supabase-first via getTrainerId(); threads/programs: sandbox.
 */

import { useCallback, useMemo } from 'react';
import { useAuth } from '@/lib/AuthContext';
import repo from '@/lib/repo';
import { getTrainerId } from '@/lib/getTrainerId';
import { normalizeRole } from '@/lib/roles';
import { getSupabase, hasSupabase } from '@/lib/supabaseClient';
import * as messagingService from '@/data/messagingService';
import type { Client, ReviewItem, Program, CheckIn } from '@/data/models';

export const LOCAL_TRAINER_ID = 'local-trainer';

export function getEffectiveTrainerId(authUserId: string | null | undefined): string {
  return authUserId ?? LOCAL_TRAINER_ID;
}

/** Single source of truth: when Supabase session exists, trainerId = session.user.id. Else fall back to user.id if UUID, else local-trainer. */
function getCanonicalTrainerId(supabaseSession: { user?: { id?: string } } | null | undefined, user: { id?: string } | null | undefined): string {
  const fromSession = getTrainerId(supabaseSession);
  if (fromSession && fromSession !== LOCAL_TRAINER_ID) return fromSession;
  if (user?.id && user.id !== LOCAL_TRAINER_ID) return user.id;
  return LOCAL_TRAINER_ID;
}

/** Single hook: uses session (or user.id) for trainer id so Supabase is used when logged in. */
export function useData(): {
  listClients: () => Promise<Client[]>;
  getClient: (id: string) => Promise<Client | null>;
  createClient: (payload: Record<string, unknown>) => Promise<Client | null>;
  updateClient: (id: string, patch: Record<string, unknown>) => Promise<Client | null>;
  deleteClient: (id: string) => Promise<void>;
  listThreads: () => Promise<Array<{ id: string; client_id: string; trainer_id: string; unread_count?: number; last_message_at?: string | null; last_message_preview?: string | null }>>;
  listMessages: (threadId: string) => Promise<Array<{ id: string; client_id: string; sender: string; body: string; created_date: string; type?: string; media_url?: string | null; durationMs?: number }>>;
  sendMessage: (
    threadId: string,
    textOrPayload: string | Record<string, unknown>,
    options?: { replyToId?: string | null; rosterClientId?: string | null; clientRosterId?: string | null }
  ) => Promise<{ id: string; created_date: string; media_url?: string } | null>;
  sendVoiceMessage: (
    threadId: string,
    payload: { blob: Blob; mimeType: string; durationMs: number },
    options?: { replyToId?: string | null; rosterClientId?: string | null; clientRosterId?: string | null }
  ) => Promise<{ id: string; created_date: string; media_url?: string } | null>;
  deleteThread: (clientId: string) => Promise<void>;
  listPrograms: () => Promise<Program[]>;
  assignProgramToClient: (clientId: string, programId: string) => Promise<void>;
  listReviewItems: () => Promise<{ active: ReviewItem[]; waiting: ReviewItem[]; done: ReviewItem[] }>;
  completeReviewItem: (id: string) => Promise<void>;
  getCoach: () => Promise<{ id?: string; name?: string; full_name?: string; email?: string; [key: string]: unknown } | null>;
  listCheckInsForTrainer: () => Promise<CheckIn[]>;
  listCheckInsForClient: (clientId: string) => Promise<CheckIn[]>;
  getClientPrograms: (clientId: string) => Promise<Program[]>;
  getThread: (clientId: string) => Promise<{ id: string; client_id: string; trainer_id: string; unread_count?: number; last_message_at?: string | null; last_message_preview?: string | null } | null>;
  ensureThreadForClient: (clientId: string) => Promise<{ id: string; client_id: string; trainer_id: string } | null>;
  markThreadRead: (threadIdOrClientId: string) => void;
  markAllThreadsRead: () => void;
  getUnreadMessageCountTotal: () => Promise<number>;
  getActiveNutritionPlan: (clientId: string) => Promise<Record<string, unknown> | null>;
  upsertNutritionPlan: (payload: Record<string, unknown>) => Promise<Record<string, unknown> | null>;
} {
  const { supabaseSession, isDemoMode = false, user, effectiveRole, clientLinkedRow, clientLinkedResolved } = useAuth();

  // If we have a real Supabase session, never use demo/local storage.
  const isAuthed = !!supabaseSession?.user?.id;
  const effectiveDemoMode = isDemoMode && !isAuthed;

  // When authenticated, trainer id MUST be the auth user id.
  // When not authenticated, fall back to any provided user.id (if present) or local-trainer.
  const trainerId = isAuthed ? (supabaseSession!.user!.id as string) : getCanonicalTrainerId(supabaseSession, user ?? null);

  const messagingOpts = useMemo(() => {
    const messagingRole = normalizeRole(effectiveRole ?? user?.role ?? null);
    const clientRosterId =
      messagingRole === 'client' && clientLinkedResolved ? (clientLinkedRow?.id as string | undefined) ?? null : null;
    const activeCoachId =
      messagingRole === 'client' && clientLinkedResolved
        ? ((clientLinkedRow?.trainer_id as string | undefined) ??
          (clientLinkedRow?.coach_id as string | undefined) ??
          null)
        : null;
    return { messagingRole, clientRosterId, activeCoachId };
  }, [effectiveRole, user?.role, clientLinkedResolved, clientLinkedRow?.id, clientLinkedRow?.trainer_id, clientLinkedRow?.coach_id]);

  const threadListOptions = useMemo(
    () =>
      ({
        viewerRole: messagingOpts.messagingRole === 'client' ? ('client' as const) : ('coach' as const),
        clientRosterId: messagingOpts.clientRosterId,
        activeCoachId: messagingOpts.activeCoachId,
      }) as const,
    [messagingOpts.messagingRole, messagingOpts.clientRosterId, messagingOpts.activeCoachId]
  );

  if (import.meta.env.DEV) {
    // Helpful for debugging stuck loading / empty lists
    console.log('[DATA] isAuthed=', isAuthed, 'effectiveDemoMode=', effectiveDemoMode, 'trainerId=', trainerId);
  }

  const listClientsFn = useCallback(
    () => (typeof repo?.clients?.list === 'function' ? repo.clients.list(trainerId, effectiveDemoMode) : Promise.resolve([])),
    [trainerId, effectiveDemoMode]
  );
  const getClientFn = useCallback(
    async (id: string) => {
      let resolvedTrainerId = trainerId;
      if ((!resolvedTrainerId || resolvedTrainerId === LOCAL_TRAINER_ID) && hasSupabase) {
        const sb = getSupabase();
        if (sb) {
          const { data: { session } } = await sb.auth.getSession();
          if (session?.user?.id) resolvedTrainerId = session.user.id;
        }
      }
      return repo.clients.get(id, resolvedTrainerId, effectiveDemoMode);
    },
    [trainerId, effectiveDemoMode]
  );
  /** Used by dev-gated manual add and imports — not the production invite/code acquisition path. */
  const createClientFn = useCallback(
    (payload: Record<string, unknown>) => repo.clients.create(trainerId, payload, effectiveDemoMode),
    [trainerId, effectiveDemoMode]
  );
  const updateClientFn = useCallback(
    (id: string, patch: Record<string, unknown>) => repo.clients.update(id, patch, trainerId, effectiveDemoMode),
    [trainerId, effectiveDemoMode]
  );
  const deleteClientFn = useCallback(
    (id: string) => repo.clients.delete(id, trainerId, effectiveDemoMode),
    [trainerId, effectiveDemoMode]
  );
  const listThreadsFn = useCallback(
    () =>
      typeof repo?.threads?.list === 'function' ? repo.threads.list(trainerId, { ...threadListOptions }) : Promise.resolve([]),
    [trainerId, threadListOptions]
  );
  const listMessagesFn = useCallback(
    (threadId: string) => repo.messages.list(threadId, trainerId, { ...threadListOptions }),
    [trainerId, threadListOptions]
  );
  const deleteThreadFn = useCallback((clientId: string) => repo.threads.deleteByClientId(clientId, trainerId), [trainerId]);
  const sendMessageFn = useCallback(
    async (
      threadId: string,
      textOrPayload: string | Record<string, unknown>,
      sendOptions?: { replyToId?: string | null; rosterClientId?: string | null; clientRosterId?: string | null },
    ) => {
      // Guard: if trainerId hasn't resolved to a real UUID yet,
      // wait up to 3 seconds for auth to settle before giving up.
      let resolvedTrainerId = trainerId;
      if (!resolvedTrainerId || resolvedTrainerId === LOCAL_TRAINER_ID) {
        // Poll for up to 3 seconds
        let waited = 0;
        while (waited < 3000) {
          await new Promise((r) => setTimeout(r, 200));
          waited += 200;
          // Try to get from Supabase session directly
          const sb = getSupabase();
          if (sb) {
            const { data: { session } } = await sb.auth.getSession();
            if (session?.user?.id) {
              resolvedTrainerId = session.user.id;
              break;
            }
          }
        }
      }
      if (!resolvedTrainerId || resolvedTrainerId === LOCAL_TRAINER_ID) {
        // Still not resolved — fall through and let messagingService handle it
        console.warn('[sendMessage] trainerId not resolved, send may fail');
      }
      const senderRole = messagingOpts.messagingRole === 'client' ? 'client' : 'coach';
      const mergedRosterId =
        sendOptions?.rosterClientId ?? sendOptions?.clientRosterId ?? threadListOptions.clientRosterId ?? null;
      const msg = await messagingService.sendMessage(threadId, textOrPayload as string | Record<string, unknown>, resolvedTrainerId, {
        ...threadListOptions,
        senderRole,
        replyToId: sendOptions?.replyToId ?? null,
        clientRosterId: mergedRosterId,
        rosterClientId: mergedRosterId,
      });
      if (!msg?.id) {
        throw new Error('Message could not be sent');
      }
      void messagingService.markThreadRead(threadId, resolvedTrainerId, {
        ...threadListOptions,
        asRole: senderRole,
      });
      return msg
        ? {
            id: msg.id,
            created_date: msg.created_date || new Date().toISOString(),
            ...(msg.media_url != null ? { media_url: msg.media_url } : {}),
          }
        : null;
    },
    [trainerId, threadListOptions, messagingOpts.messagingRole]
  );
  const sendVoiceMessageFn = useCallback(
    async (
      threadId: string,
      payload: { blob: Blob; mimeType: string; durationMs: number },
      options?: { replyToId?: string | null },
    ) => {
      const senderRole = messagingOpts.messagingRole === 'client' ? 'client' : 'coach';
      const msg = await repo.messages.addVoice(threadId, payload, trainerId, {
        ...threadListOptions,
        senderRole,
        replyToId: options?.replyToId ?? null,
      });
      if (msg) {
        void repo.markThreadRead(threadId, trainerId, {
          ...threadListOptions,
          asRole: senderRole,
        });
      }
      return msg;
    },
    [trainerId, threadListOptions, messagingOpts.messagingRole]
  );
  const ensureThreadForClientFn = useCallback(
    (clientId: string) => repo.threads.ensureThreadForClient(clientId, trainerId),
    [trainerId]
  );
  const ensureConversationFn = useCallback(
    (clientId: string) => repo.threads.ensureConversation(clientId, trainerId, { ...threadListOptions }),
    [trainerId, threadListOptions]
  );
  const listProgramsFn = useCallback(() => repo.programs.list(trainerId), [trainerId]);
  const assignProgramToClientFn = useCallback(
    (clientId: string, programId: string) => repo.programs.assignToClient(clientId, programId),
    []
  );
  const listReviewItemsFn = useCallback(() => repo.inbox.list(trainerId), [trainerId]);
  const completeReviewItemFn = useCallback((id: string) => repo.inbox.completeReviewItem(id), []);
  const getCoachFn = useCallback(() => repo.getCoach(trainerId), [trainerId]);
  const listCheckInsForTrainerFn = useCallback(
    (): Promise<CheckIn[]> =>
      typeof repo?.checkIns?.listForTrainer === 'function' ? repo.checkIns.listForTrainer(trainerId) : Promise.resolve([]),
    [trainerId]
  );
  const listCheckInsForClientFn = useCallback((clientId: string): Promise<CheckIn[]> => repo.checkIns.list(clientId, trainerId), [trainerId]);
  const getClientProgramsFn = useCallback((clientId: string) => repo.programs.list(clientId), []);
  const getThreadFn = useCallback(
    (clientId: string) => repo.threads.getByClientId(clientId, trainerId, { ...threadListOptions }),
    [trainerId, threadListOptions]
  );
  const markThreadReadFn = useCallback(
    (threadIdOrClientId: string) => {
      const asRole = messagingOpts.messagingRole === 'client' ? 'client' : 'coach';
      void repo.markThreadRead(threadIdOrClientId, trainerId, {
        ...threadListOptions,
        asRole,
      });
    },
    [trainerId, threadListOptions, messagingOpts.messagingRole]
  );
  const markAllThreadsReadFn = useCallback(
    () => repo.markAllThreadsRead(trainerId, { ...threadListOptions }),
    [trainerId, threadListOptions]
  );
  const getUnreadMessageCountTotalFn = useCallback(
    () => repo.getUnreadCountTotal(trainerId, { ...threadListOptions }),
    [trainerId, threadListOptions]
  );
  const getActiveNutritionPlanFn = useCallback(
    (clientId: string) => repo.nutrition.getActivePlan(trainerId, clientId),
    [trainerId]
  );
  const upsertNutritionPlanFn = useCallback(
    (payload: Record<string, unknown>) => repo.nutrition.upsert({ ...payload, trainer_id: trainerId } as Record<string, unknown>),
    [trainerId]
  );

  return useMemo(
    () => ({
      listClients: listClientsFn,
      getClient: getClientFn,
      createClient: createClientFn,
      updateClient: updateClientFn,
      deleteClient: deleteClientFn,
      listThreads: listThreadsFn,
      listMessages: listMessagesFn,
      sendMessage: sendMessageFn,
      sendVoiceMessage: sendVoiceMessageFn,
      deleteThread: deleteThreadFn,
      listPrograms: listProgramsFn,
      assignProgramToClient: assignProgramToClientFn,
      listReviewItems: listReviewItemsFn,
      completeReviewItem: completeReviewItemFn,
      getCoach: getCoachFn,
      listCheckInsForTrainer: listCheckInsForTrainerFn,
      listCheckInsForClient: listCheckInsForClientFn,
      getClientPrograms: getClientProgramsFn,
      getThread: getThreadFn,
      ensureThreadForClient: ensureThreadForClientFn,
      ensureConversation: ensureConversationFn,
      markThreadRead: markThreadReadFn,
      markAllThreadsRead: markAllThreadsReadFn,
      getUnreadMessageCountTotal: getUnreadMessageCountTotalFn,
      getActiveNutritionPlan: getActiveNutritionPlanFn,
      upsertNutritionPlan: upsertNutritionPlanFn,
    }),
    [
      listClientsFn,
      getClientFn,
      createClientFn,
      updateClientFn,
      deleteClientFn,
      listThreadsFn,
      listMessagesFn,
      sendMessageFn,
      sendVoiceMessageFn,
      deleteThreadFn,
      listProgramsFn,
      assignProgramToClientFn,
      listReviewItemsFn,
      completeReviewItemFn,
      getCoachFn,
      listCheckInsForTrainerFn,
      listCheckInsForClientFn,
      getClientProgramsFn,
      getThreadFn,
      ensureThreadForClientFn,
      ensureConversationFn,
      markThreadReadFn,
      markAllThreadsReadFn,
      getUnreadMessageCountTotalFn,
      getActiveNutritionPlanFn,
      upsertNutritionPlanFn,
    ]
  );
}

// Re-export sandbox helpers for Sandbox Tools UI
export { addClient as sandboxAddClient, seedIfEmpty, resetSandbox } from '@/lib/sandboxStore';
