import { getSupabase, hasSupabase } from '@/lib/supabaseClient';

const COACH_SUBJECT = (name) =>
  `Welcome to Atlas, ${name} - your coaching dashboard is ready`;
const CLIENT_SUBJECT = (name) =>
  `Welcome to Atlas, ${name} - you're all set up`;
const PERSONAL_SUBJECT = (name) =>
  `Welcome to Atlas, ${name} - let's get started`;

function baseHtml({ headline, lines, ctaLabel, ctaUrl }) {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width">
</head>
<body style="margin:0;padding:0;background:#0B1220;
  font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
<div style="max-width:480px;margin:40px auto;padding:32px 24px">
  <div style="font-size:22px;font-weight:700;color:#3B82F6;
    margin-bottom:28px">Atlas</div>
  <h1 style="font-size:22px;font-weight:600;color:#F1F5F9;
    margin:0 0 12px">${headline}</h1>
  <div style="background:rgba(59,130,246,0.1);border-radius:12px;
    padding:16px;margin:20px 0">
    ${lines
      .map(
        (l) => `<p style="margin:0 0 8px;color:#94A3B8;font-size:14px">
        ${l}</p>`,
      )
      .join('')}
  </div>
  <a href="${ctaUrl}" style="display:inline-block;padding:14px 28px;
    background:#3B82F6;color:#fff;border-radius:12px;
    text-decoration:none;font-weight:600;font-size:15px">
    ${ctaLabel}
  </a>
  <div style="margin-top:32px;padding-top:20px;
    border-top:1px solid rgba(255,255,255,0.08);
    font-size:12px;color:#475569">
    Atlas Performance Labs ·
    <a href="https://atlasperformancelabs.co.uk/privacy"
      style="color:#3B82F6">Privacy Policy</a>
  </div>
</div></body></html>`;
}

export async function sendCoachWelcomeEmail({ name, email }) {
  if (!hasSupabase || !email) return;
  try {
    const supabase = getSupabase();
    await supabase.functions.invoke('send-welcome-email', {
      body: {
        to: email,
        subject: COACH_SUBJECT(name),
        html: baseHtml({
          headline: `You're ready to coach, ${name}`,
          lines: [
            '1. Share your coaching link with your first client',
            '2. Build your first programme in the builder',
            '3. Connect Stripe to receive client payments',
          ],
          ctaLabel: 'Open my dashboard ->',
          ctaUrl: 'https://atlasperformancelabs.co.uk/home',
        }),
      },
    });
  } catch (_) {}
}

export async function sendClientWelcomeEmail({ name, email, coachName }) {
  if (!hasSupabase || !email) return;
  try {
    const supabase = getSupabase();
    await supabase.functions.invoke('send-welcome-email', {
      body: {
        to: email,
        subject: CLIENT_SUBJECT(name),
        html: baseHtml({
          headline: `You're all set up, ${name}`,
          lines: [
            `You're now coached by ${coachName || 'your coach'}.`,
            "Log workouts with your coach's exact targets",
            'Scan barcodes to log food - always free on Atlas',
            'Submit your weekly check-in to get feedback',
          ],
          ctaLabel: 'Open Atlas ->',
          ctaUrl: 'https://atlasperformancelabs.co.uk/today',
        }),
      },
    });
  } catch (_) {}
}

export async function sendPersonalWelcomeEmail({ name, email }) {
  if (!hasSupabase || !email) return;
  try {
    const supabase = getSupabase();
    await supabase.functions.invoke('send-welcome-email', {
      body: {
        to: email,
        subject: PERSONAL_SUBJECT(name),
        html: baseHtml({
          headline: `Let's get started, ${name}`,
          lines: [
            'Build your first programme',
            'Track macros with a free barcode scanner',
            'Log your weight and see your progress over time',
          ],
          ctaLabel: 'Open Atlas ->',
          ctaUrl: 'https://atlasperformancelabs.co.uk/today',
        }),
      },
    });
  } catch (_) {}
}
