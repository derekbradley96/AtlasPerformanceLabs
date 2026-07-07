// Delete account: cancel Stripe subscriptions, clear FK blockers, purge the
// user's storage, then delete the auth user (DB cascades handle the rest).
// Feedback is recorded first and has no FK to auth.users, so it survives.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
import { z } from "https://esm.sh/zod@3.23.8";
import { getCorsHeaders } from "../_shared/cors.ts";
import { getAuthUserId } from "../_shared/auth.ts";
import { TABLE } from "../_shared/supabase.ts";

const payloadSchema = z.object({
  reason: z.string().trim().min(1).max(120),
  reason_detail: z.string().trim().max(500).optional(),
  role: z.enum(["coach", "client", "personal"]),
}).strict();

Deno.serve(async (req) => {
  // CORS headers are request-scoped — computing them at module level crashed
  // every response path (json() referenced an out-of-scope req).
  const cors = getCorsHeaders(req);
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...cors, "Content-Type": "application/json" },
    });

  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    const userId = await getAuthUserId(req);
    if (!userId) {
      return json({ ok: false, error: "Unauthorized", code: "unauthorized" }, 401);
    }

    const rawBody = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const parsed = payloadSchema.safeParse(rawBody);
    if (!parsed.success) {
      return json({ ok: false, error: "Invalid request payload", code: "server_error" }, 400);
    }

    const { reason, reason_detail, role } = parsed.data;
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !supabaseServiceRole) {
      return json({ ok: false, error: "Server not configured", code: "server_error" }, 500);
    }

    const supabase = createClient(supabaseUrl, supabaseServiceRole);

    const feedbackInsert = await supabase
      .from("account_deletion_feedback")
      .insert({
        user_id: userId,
        role,
        reason,
        reason_detail: reason_detail || null,
      });

    if (feedbackInsert.error) {
      console.error("delete-account feedback insert error", feedbackInsert.error);
      return json({ ok: false, error: "Could not record feedback", code: "server_error" }, 500);
    }

    if (role === "coach") {
      // Same filter as DeleteAccountPage — inactive roster entries don't block.
      const { count, error: clientCountErr } = await supabase
        .from("clients")
        .select("id", { count: "exact", head: true })
        .or(`coach_id.eq.${userId},trainer_id.eq.${userId}`)
        .not("subscription_status", "eq", "inactive");

      if (clientCountErr) {
        console.error("delete-account coach client-count error", clientCountErr);
        return json({ ok: false, error: "Could not verify coach roster", code: "server_error" }, 500);
      }

      if ((count ?? 0) > 0) {
        return json(
          {
            ok: false,
            error: "You still have active clients. Remove them from your roster before deleting your account.",
            code: "has_active_clients",
          },
          409,
        );
      }
    }

    // Clients rows where the deleting user IS the client — needed for both
    // subscription cancellation and storage purge. (A coach's clients keep
    // their own accounts and data; only this user's footprint is removed.)
    const { data: ownClientRows } = await supabase
      .from("clients")
      .select("id")
      .eq("user_id", userId);
    const ownClientRowIds = (ownClientRows ?? [])
      .map((r: { id: string | null }) => r.id)
      .filter(Boolean) as string[];

    // Cancel Stripe subscriptions so cards stop being charged after the
    // account is gone. Best-effort: a Stripe hiccup must not strand the user
    // in a half-deleted state — failures are logged for manual follow-up.
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
    if (stripeKey) {
      const stripe = new Stripe(stripeKey, { apiVersion: "2024-11-20.acacia" });
      const subIds = new Set<string>();

      const { data: billing } = await supabase
        .from("coach_billing_state")
        .select("stripe_subscription_id")
        .eq("coach_id", userId)
        .maybeSingle();
      if (billing?.stripe_subscription_id) subIds.add(billing.stripe_subscription_id as string);

      if (ownClientRowIds.length > 0) {
        const { data: pays } = await supabase
          .from(TABLE.payments)
          .select("stripe_subscription_id")
          .in("client_id", ownClientRowIds)
          .not("stripe_subscription_id", "is", null);
        for (const p of pays ?? []) {
          if (p.stripe_subscription_id) subIds.add(p.stripe_subscription_id as string);
        }
      }

      for (const subId of subIds) {
        try {
          await stripe.subscriptions.cancel(subId);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          if (!/no such subscription|already.*cancel/i.test(msg)) {
            console.error("delete-account stripe cancel failed", subId, msg);
          }
        }
      }
    } else {
      console.error("delete-account: STRIPE_SECRET_KEY not set — subscriptions not cancelled for", userId);
    }

    // FK blockers: organisations.owner_profile_id is RESTRICT + NOT NULL (must
    // delete the row); show_day_tasks.completed_by is NO ACTION but nullable.
    await supabase.from("show_day_tasks").update({ completed_by: null }).eq("completed_by", userId);
    const { error: orgErr } = await supabase
      .from("organisations")
      .delete()
      .eq("owner_profile_id", userId);
    if (orgErr) {
      console.error("delete-account organisations delete error", orgErr);
      return json({ ok: false, error: "Could not delete account", code: "server_error" }, 500);
    }

    // Purge the user's storage — DB cascades don't touch storage objects.
    // Best-effort per folder; folders in Supabase storage are virtual, so
    // recursing into subfolders and removing files empties them completely.
    const purgeStorageFolder = async (bucket: string, prefix: string) => {
      try {
        for (let guard = 0; guard < 50; guard++) {
          const { data: entries, error } = await supabase.storage.from(bucket).list(prefix, { limit: 100 });
          if (error || !entries || entries.length === 0) return;
          const files = entries.filter((e: { id: string | null }) => e.id).map((e: { name: string }) => `${prefix}/${e.name}`);
          const folders = entries.filter((e: { id: string | null }) => !e.id).map((e: { name: string }) => `${prefix}/${e.name}`);
          for (const sub of folders) await purgeStorageFolder(bucket, sub);
          if (files.length > 0) {
            const { error: rmErr } = await supabase.storage.from(bucket).remove(files);
            if (rmErr) {
              console.error("delete-account storage remove error", bucket, prefix, rmErr);
              return;
            }
          } else if (folders.length === 0) {
            return;
          }
          if (entries.length < 100 && folders.length === 0) return;
        }
      } catch (err) {
        console.error("delete-account storage purge failed", bucket, prefix, err);
      }
    };

    await purgeStorageFolder("profile_images", userId);
    await purgeStorageFolder("marketplace_coach_media", userId);
    await purgeStorageFolder("progress_photos", `personal/${userId}`);
    for (const clientRowId of ownClientRowIds) {
      await purgeStorageFolder("progress_photos", clientRowId);
      await purgeStorageFolder("checkin_photos", clientRowId);
      await purgeStorageFolder("checkin_photos", `peak_week/${clientRowId}`);
      await purgeStorageFolder("pose_check_photos", clientRowId);
    }

    const { error: deleteErr } = await supabase.auth.admin.deleteUser(userId);
    if (deleteErr) {
      console.error("delete-account auth.admin.deleteUser error", deleteErr);
      return json({ ok: false, error: "Could not delete account", code: "server_error" }, 500);
    }

    return json({ ok: true });
  } catch (err) {
    console.error("delete-account unexpected", err);
    return json({ ok: false, error: "Unexpected server error", code: "server_error" }, 500);
  }
});
