# In-app video calling - Whereby

## Setup (one-time)
1. Go to [whereby.com](https://whereby.com) and create a free account.
2. Go to [https://whereby.com/user/settings/embedded](https://whereby.com/user/settings/embedded) and copy your API key.
3. Add to Supabase secrets:
   `npx supabase secrets set WHEREBY_API_KEY=your_key_here`
4. Add to `.env.example`:
   `# Video calls via Whereby embedded`
   `# WHEREBY_API_KEY=your_key_here (server-side only)`

## How it works
- When a coach sends a video call request, the `create-video-room` edge function generates a Whereby room URL.
- The room URL is stored in `checkin_call_requests.room_url`.
- Both coach and client can open the same room URL.

## Edge function
Deploy with:
`npx supabase functions deploy create-video-room`

## Whereby API
- Endpoint: `POST https://api.whereby.dev/v1/meetings`
- Headers: `Authorization: Bearer {WHEREBY_API_KEY}`
- Body:
  `{ "endDate": "2099-01-01T00:00:00.000Z", "fields": ["hostRoomUrl"] }`
- Returns:
  `{ "roomUrl": "...", "hostRoomUrl": "..." }`
