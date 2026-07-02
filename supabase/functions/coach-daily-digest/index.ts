// Scheduled daily digest email to coaches: check-ins waiting, at-risk clients, overdue payments.
// Auth: Authorization: Bearer <CRON_SECRET> (scheduled via pg_cron, see 20260702* migration).
// Sends via Resend; skips coaches with nothing actionable.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";

const RESEND_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const FROM = "Atlas <hello@atlasperformancelabs.co.uk>";
const APP_URL = "https://atlasperformancelabs.co.uk";

type DigestRow = {
  checkinsWaiting: number;
  checkinNames: string[];
  atRisk: number;
  atRiskNames: string[];
  paymentsOverdue: number;
};

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function digestHtml(coachName: string, d: DigestRow): string {
  const items: string[] = [];
  if (d.checkinsWaiting > 0) {
    const names = d.checkinNames.slice(0, 3).map(esc).join(", ");
    items.push(`<li><strong>${d.checkinsWaiting} check-in${d.checkinsWaiting === 1 ? "" : "s"} waiting for review</strong>${names ? ` — ${names}${d.checkinsWaiting > 3 ? " and more" : ""}` : ""}</li>`);
  }
  if (d.atRisk > 0) {
    const names = d.atRiskNames.slice(0, 3).map(esc).join(", ");
    items.push(`<li><strong>${d.atRisk} client${d.atRisk === 1 ? "" : "s"} showing churn risk</strong>${names ? ` — ${names}` : ""}</li>`);
  }
  if (d.paymentsOverdue > 0) {
    items.push(`<li><strong>${d.paymentsOverdue} payment${d.paymentsOverdue === 1 ? "" : "s"} overdue</strong></li>`);
  }
  return `
  <div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#0f172a">
    <h2 style="margin:0 0 4px">Morning, ${esc(coachName)}</h2>
    <p style="margin:0 0 16px;color:#475569">Here's what needs you today:</p>
    <ul style="line-height:1.9;padding-left:18px;margin:0 0 20px">${items.join("")}</ul>
    <a href="${APP_URL}/review-center" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;font-weight:600">Open review queue</a>
    <p style="margin:24px 0 0;font-size:12px;color:#94a3b8">Atlas Performance Labs — you get this when there's something actionable. Manage notifications in Settings.</p>
  </div>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: getCorsHeaders(req) });

  const authHeader = req.headers.get("Authorization");
  const cronSecret = Deno.env.get("CRON_SECRET");
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  if (!RESEND_KEY) {
    return new Response(JSON.stringify({ ok: true, sent: 0, reason: "RESEND_API_KEY not set" }), {
      status: 200,
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  }

  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const digests = new Map<string, DigestRow>();
    const get = (coachId: string): DigestRow => {
      let d = digests.get(coachId);
      if (!d) {
        d = { checkinsWaiting: 0, checkinNames: [], atRisk: 0, atRiskNames: [], paymentsOverdue: 0 };
        digests.set(coachId, d);
      }
      return d;
    };

    // 1) Submitted check-ins not yet reviewed.
    const { data: pendingCheckins } = await supabase
      .from("checkins")
      .select("trainer_id, client_id")
      .eq("status", "submitted")
      .is("reviewed_at", null);
    const checkinClientIds = new Set<string>();
    for (const row of pendingCheckins ?? []) {
      const t = (row as { trainer_id?: string }).trainer_id;
      if (!t) continue;
      get(t).checkinsWaiting += 1;
      const cid = (row as { client_id?: string }).client_id;
      if (cid) checkinClientIds.add(cid);
    }

    // 2) High churn-risk clients.
    const { data: riskRows } = await supabase
      .from("v_client_retention_risk")
      .select("coach_id, client_name")
      .eq("risk_band", "high");
    for (const row of riskRows ?? []) {
      const c = (row as { coach_id?: string }).coach_id;
      if (!c) continue;
      const d = get(c);
      d.atRisk += 1;
      const name = (row as { client_name?: string }).client_name;
      if (name) d.atRiskNames.push(name);
    }

    // 3) Overdue payments (active review items).
    const { data: overdueRows } = await supabase
      .from("atlas_review_items")
      .select("coach_id")
      .eq("status", "active")
      .eq("type", "payment_overdue");
    for (const row of overdueRows ?? []) {
      const c = (row as { coach_id?: string }).coach_id;
      if (c) get(c).paymentsOverdue += 1;
    }

    // Names for waiting check-ins (small set, one query).
    const nameById = new Map<string, string>();
    if (checkinClientIds.size > 0) {
      const { data: clientRows } = await supabase
        .from("clients")
        .select("id, name, full_name, trainer_id, coach_id")
        .in("id", [...checkinClientIds]);
      for (const c of clientRows ?? []) {
        const row = c as { id: string; name?: string; full_name?: string };
        nameById.set(row.id, (row.full_name || row.name || "").trim());
      }
    }
    for (const row of pendingCheckins ?? []) {
      const t = (row as { trainer_id?: string }).trainer_id;
      const cid = (row as { client_id?: string }).client_id;
      if (!t || !cid) continue;
      const nm = nameById.get(cid);
      if (nm) get(t).checkinNames.push(nm);
    }

    const coachIds = [...digests.keys()].filter((id) => {
      const d = digests.get(id)!;
      return d.checkinsWaiting > 0 || d.atRisk > 0 || d.paymentsOverdue > 0;
    });
    if (coachIds.length === 0) {
      return new Response(JSON.stringify({ ok: true, sent: 0, coaches: 0 }), {
        status: 200,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    const { data: coaches } = await supabase
      .from("profiles")
      .select("id, email, display_name")
      .in("id", coachIds);

    let sent = 0;
    for (const coach of coaches ?? []) {
      const row = coach as { id: string; email?: string; display_name?: string };
      const email = (row.email || "").trim();
      if (!email || !email.includes("@")) continue;
      const d = digests.get(row.id);
      if (!d) continue;
      const parts: string[] = [];
      if (d.checkinsWaiting) parts.push(`${d.checkinsWaiting} check-in${d.checkinsWaiting === 1 ? "" : "s"}`);
      if (d.atRisk) parts.push(`${d.atRisk} at-risk`);
      if (d.paymentsOverdue) parts.push(`${d.paymentsOverdue} overdue`);
      const subject = `Atlas today: ${parts.join(" · ")}`;
      const r = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: FROM,
          to: email,
          subject,
          html: digestHtml((row.display_name || "Coach").split(" ")[0], d),
        }),
      });
      if (r.ok) sent += 1;
      else console.error("coach-daily-digest resend", r.status, await r.text().catch(() => ""));
    }

    return new Response(JSON.stringify({ ok: true, coaches: coachIds.length, sent }), {
      status: 200,
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("coach-daily-digest", e);
    return new Response(JSON.stringify({ error: "Request failed" }), {
      status: 500,
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  }
});
