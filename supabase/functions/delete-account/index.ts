import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.23.8";
import { getCorsHeaders } from "../_shared/cors.ts";
import { getAuthUserId } from "../_shared/auth.ts";

const payloadSchema = z.object({
  reason: z.string().trim().min(1).max(120),
  reason_detail: z.string().trim().max(500).optional(),
  role: z.enum(["coach", "client", "personal"]),
}).strict();

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: getCorsHeaders(req) });

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
      const { count, error: clientCountErr } = await supabase
        .from("clients")
        .select("id", { count: "exact", head: true })
        .or(`coach_id.eq.${userId},trainer_id.eq.${userId}`);

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
