// Nightly job: create review items for high retention risk clients.
// Uses service role. Schedule via Supabase Dashboard → Scheduled Triggers (e.g. daily 06:00 UTC).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const RETENTION_REVIEW_TABLE = "atlas_retention_review_items";
const RETENTION_VIEW = "v_client_retention_risk";
const TYPE_RETENTION_RISK = "retention_risk";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: highRisk, error: fetchError } = await supabase
      .from(RETENTION_VIEW)
      .select("coach_id, client_id, client_name, risk_score, risk_band, reasons, last_checkin_at, checkins_last_4w, messages_last_7d, compliance_trend")
      .eq("risk_band", "high");

    if (fetchError) {
      console.error("retention-alerts: fetch high risk", fetchError);
      return new Response(
        JSON.stringify({ error: fetchError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const rows = highRisk ?? [];
    let inserted = 0;
    let skipped = 0;

    for (const row of rows) {
      const coachId = row.coach_id;
      const clientId = row.client_id;
      if (!coachId || !clientId) continue;

      const { data: existing } = await supabase
        .from(RETENTION_REVIEW_TABLE)
        .select("id")
        .eq("coach_id", coachId)
        .eq("client_id", clientId)
        .eq("type", TYPE_RETENTION_RISK)
        .is("resolved_at", null)
        .maybeSingle();

      if (existing) {
        skipped += 1;
        continue;
      }

      const payload = {
        risk_score: row.risk_score,
        risk_band: row.risk_band,
        reasons: row.reasons ?? [],
        last_checkin_at: row.last_checkin_at,
        checkins_last_4w: row.checkins_last_4w,
        messages_last_7d: row.messages_last_7d,
        compliance_trend: row.compliance_trend,
        client_name: row.client_name,
      };

      const { error: insertError } = await supabase.from(RETENTION_REVIEW_TABLE).insert({
        coach_id: coachId,
        client_id: clientId,
        type: TYPE_RETENTION_RISK,
        payload,
      });

      if (insertError) {
        if ((insertError as { code?: string }).code === "23505") {
          skipped += 1;
          continue;
        }
        console.error("retention-alerts: insert", insertError);
        return new Response(
          JSON.stringify({ error: insertError.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      inserted += 1;
    }

    return new Response(
      JSON.stringify({ ok: true, high_risk_count: rows.length, inserted, skipped }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("retention-alerts", e);
    return new Response(
      JSON.stringify({ error: String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
