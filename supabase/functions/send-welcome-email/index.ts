import { serve } from 'https://deno.land/std@0.208.0/http/server.ts'

const RESEND_KEY = Deno.env.get('RESEND_API_KEY') ?? ''
const FROM = 'Atlas <hello@atlasperformancelabs.co.uk>'
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

async function isAuthorizedRequest(req: Request): Promise<boolean> {
  const authHeader = req.headers.get('Authorization')
  const internalSecret = Deno.env.get('INTERNAL_WEBHOOK_SECRET')

  // Internal webhook / server-to-server path.
  if (authHeader && internalSecret && authHeader === `Bearer ${internalSecret}`) {
    return true
  }

  // Authenticated app user path.
  if (!authHeader || !SUPABASE_URL || !SUPABASE_ANON_KEY) return false
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      method: 'GET',
      headers: {
        Authorization: authHeader,
        apikey: SUPABASE_ANON_KEY,
      },
    })
    return res.ok
  } catch (_) {
    return false
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200, headers: CORS_HEADERS })
  }

  if (!RESEND_KEY) {
    console.error('[send-welcome-email] RESEND_API_KEY not set in secrets')
    return new Response(
      JSON.stringify({ error: 'Email service not configured' }),
      { status: 503, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
    )
  }

  const authorized = await isAuthorizedRequest(req)
  if (!authorized) {
    return new Response('Unauthorized', { status: 401, headers: CORS_HEADERS })
  }

  try {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    const { to, subject, html } = await req.json()

    if (typeof to !== 'string' || !to.trim() || !emailRegex.test(to.trim())) {
      return new Response('Invalid "to": must be a valid email address.', {
        status: 400,
        headers: CORS_HEADERS,
      })
    }

    if (typeof subject !== 'string' || !subject.trim()) {
      return new Response('Invalid "subject": must be a non-empty string.', {
        status: 400,
        headers: CORS_HEADERS,
      })
    }

    if (subject.length > 200) {
      return new Response('Invalid "subject": max length is 200 characters.', {
        status: 400,
        headers: CORS_HEADERS,
      })
    }

    if (typeof html !== 'string' || !html.trim()) {
      return new Response('Invalid "html": must be a non-empty string.', {
        status: 400,
        headers: CORS_HEADERS,
      })
    }

    if (html.length > 50000) {
      return new Response('Invalid "html": max length is 50000 characters.', {
        status: 400,
        headers: CORS_HEADERS,
      })
    }

    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from: FROM, to, reply_to: 'customerservice@atlasperformancelabs.co.uk', subject, html }),
    })
    const body = await r.text()
    return new Response(body, {
      status: r.ok ? 200 : 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    return new Response(String(e), { status: 500, headers: CORS_HEADERS })
  }
})
