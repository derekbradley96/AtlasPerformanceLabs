/**
 * Update a client profile. Caller must be the client's coach (or the client for own profile).
 * When coach_id or trainer_id is provided, sets both so the coach stays attached.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.23.8";
import { getCorsHeaders } from "../_shared/cors.ts";
import { getAuthUserId, jsonError } from "../_shared/auth.ts";
import { validateSelectedServiceForCoach } from "../_shared/clientSelectedService.ts";

const payloadSchema = z.object({
  id: z.string().uuid().optional(),
  client_id: z.string().uuid().optional(),
  coach_id: z.string().uuid().optional().nullable(),
  trainer_id: z.string().uuid().optional().nullable(),
  name: z.string().max(120).optional(),
  full_name: z.string().max(120).optional(),
  billing_status: z.string().max(40).optional(),
  subscription_status: z.string().max(40).optional(),
  phase: z.string().max(60).optional(),
  monthly_fee: z.union([z.number(), z.string()]).optional(),
  next_due_date: z.string().max(80).optional(),
  lifecycle_stage: z.string().max(60).optional(),
  membership_type: z.string().max(60).optional(),
  training_days_per_week: z.union([z.number(), z.string()]).optional(),
  injuries: z.string().max(2000).optional(),
}).strict();

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: getCorsHeaders(req) });
  try {
    const callerId = await getAuthUserId(req);
    if (!callerId) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } });
    }

    const rawBody = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const parsed = payloadSchema.safeParse(rawBody);
    if (!parsed.success) {
      return jsonError("Invalid request payload", 400);
    }
    const body = parsed.data;
    const id = body.id ?? body.client_id;
    if (!id) {
      return new Response(JSON.stringify({ error: "id required" }), { status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } });
    }
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: existing } = await supabase.from("clients").select("user_id, coach_id, trainer_id").eq("id", id).maybeSingle();
    if (!existing) {
      return new Response(JSON.stringify({ error: "Client not found" }), { status: 404, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } });
    }
    const e = existing as Record<string, unknown>;
    const isOwner = e.user_id === callerId;
    const isCoach = e.coach_id === callerId || e.trainer_id === callerId;
    if (!isOwner && !isCoach) {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } });
    }

    const updates: Record<string, unknown> = {};
    const coachOnlyFields = new Set([
      "coach_id",
      "trainer_id",
      "billing_status",
      "subscription_status",
      "phase",
      "monthly_fee",
      "next_due_date",
      "lifecycle_stage",
      "membership_type",
    ]);
    const ownerAllowedFields = new Set([
      "name",
      "full_name",
      "training_days_per_week",
      "injuries",
    ]);

    // Owners can edit only profile-safe self fields unless they are also the assigned coach.
    if (isOwner && !isCoach) {
      for (const field of coachOnlyFields) {
        if (body[field] !== undefined) {
          return new Response(JSON.stringify({ error: `Forbidden field: ${field}` }), {
            status: 403,
            headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
          });
        }
      }
      for (const key of Object.keys(body)) {
        if (key === "id" || key === "client_id") continue;
        if (!ownerAllowedFields.has(key)) {
          return new Response(JSON.stringify({ error: `Forbidden field: ${key}` }), {
            status: 403,
            headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
          });
        }
      }
    }

    const coachId = body.coach_id ?? body.trainer_id;

    if (coachId != null) {
      updates.coach_id = coachId;
      updates.trainer_id = coachId;
    }
    if (body.name !== undefined) updates.name = body.name;
    if (body.full_name !== undefined) updates.full_name = body.full_name;
    if (body.billing_status !== undefined) updates.billing_status = body.billing_status;
    if (body.subscription_status !== undefined) updates.billing_status = body.subscription_status;
    if (body.phase !== undefined) updates.phase = body.phase;
    if (body.monthly_fee !== undefined) updates.monthly_fee = body.monthly_fee;
    if (body.next_due_date !== undefined) updates.next_due_date = body.next_due_date;
    if (body.lifecycle_stage !== undefined) updates.lifecycle_stage = body.lifecycle_stage;
    if (body.membership_type !== undefined) updates.membership_type = body.membership_type;
    if (body.training_days_per_week !== undefined) updates.training_days_per_week = body.training_days_per_week;
    if (body.injuries !== undefined) updates.injuries = body.injuries;

    if (Object.keys(updates).length === 0) {
      const { data: existing } = await supabase.from("clients").select("id, user_id, coach_id, trainer_id, name, full_name, billing_status, training_days_per_week, injuries").eq("id", id).single();
      return new Response(JSON.stringify(existing ?? null), { headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } });
    }

    const { data, error } = await supabase.from("clients").update(updates).eq("id", id).select("id, user_id, coach_id, trainer_id, name, full_name, billing_status, selected_service_id, training_days_per_week, injuries").single();

    if (error) {
      console.error("client-profile-update", error);
      return jsonError("Request failed", 500);
    }
    const out = data ? { ...data, subscription_status: (data as Record<string, unknown>).billing_status ?? "active" } : null;

    // Linking a coach from a Personal account: promote to client and stamp transition (same user id).
    if (updates.coach_id != null && typeof e.user_id === "string") {
      const { data: prevProfile } = await supabase.from("profiles").select("role").eq("id", e.user_id).maybeSingle();
      const prevRole = (prevProfile as { role?: string } | null)?.role;
      if (prevRole === "personal") {
        await supabase.from("profiles").update({
          role: "client",
          linked_from_personal_at: new Date().toISOString(),
        }).eq("id", e.user_id);
      }
    }

    return new Response(JSON.stringify(out), { headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } });
  } catch (e) {
    console.error("client-profile-update", e);
    return jsonError("Request failed", 500);
  }
});
