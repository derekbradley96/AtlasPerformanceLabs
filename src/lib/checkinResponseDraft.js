const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';

function safeWordLimit(text, maxWords = 120) {
  const words = String(text || '').trim().split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) return words.join(' ');
  return `${words.slice(0, maxWords).join(' ')}...`;
}

export async function draftCheckinResponse({
  clientName,
  weightKg,
  weightChange,
  adherencePct,
  energyLevel,
  sleepHours,
  notes,
  clientGoal,
  weeksIntoProgram,
}) {
  try {
    const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error('Missing Anthropic API key');

    const response = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 240,
        system: `You are a fitness coach writing a weekly check-in response to your client. Be warm, specific, encouraging, and coach-like. Use their actual data. Keep it under 120 words. No emojis. Sound human, not like an AI. Client goal: ${clientGoal || 'general progress'}. Week ${weeksIntoProgram || 1}.`,
        messages: [
          {
            role: 'user',
            content: `Client: ${clientName || 'Client'}
Weight this week: ${weightKg ?? 'N/A'}kg (change: ${Number(weightChange) > 0 ? '+' : ''}${weightChange ?? 'N/A'}kg)
Adherence: ${adherencePct ?? 'N/A'}%
Energy: ${energyLevel ?? 'N/A'}/10, Sleep: ${sleepHours ?? 'N/A'}h
Their notes: "${notes || ''}"
Write a check-in response message from me (their coach).`,
          },
        ],
      }),
    });

    if (!response.ok) throw new Error('Anthropic request failed');
    const data = await response.json();
    return safeWordLimit(data?.content?.[0]?.text || '');
  } catch (error) {
    console.error('[checkinDraft] API call failed:', error);
    return null;
  }
}
