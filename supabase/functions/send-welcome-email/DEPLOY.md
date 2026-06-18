# Deploying send-welcome-email

## First-time setup
1. Sign up at resend.com (free: 100 emails/day)
2. Add your sending domain: atlasperformancelabs.co.uk
3. Get your API key (starts with re_)
4. Set the secret in Supabase:
   npx supabase secrets set RESEND_API_KEY=re_your_key_here

## Deploy the function
npx supabase functions deploy send-welcome-email

## Test it
curl -X POST \
  https://[your-ref].supabase.co/functions/v1/send-welcome-email \
  -H "Authorization: Bearer [your-anon-key]" \
  -H "Content-Type: application/json" \
  -d '{"to":"test@example.com","subject":"Test","html":"<p>Test</p>"}'

## Verify
Check Resend dashboard for delivery status.
Check Supabase function logs for errors.
