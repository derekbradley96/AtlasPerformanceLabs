/**
 * Coach template check-ins store Q&A in public.checkins.questions as JSON text
 * (array of { question_id?, question_text?, answer? }).
 * Mirrors supabase/functions/_shared/checkinTemplateAnswers.ts for the web app.
 */
export function parseCheckinTemplateAnswers(questions) {
  if (questions == null || questions === '') return [];
  let arr;
  if (Array.isArray(questions)) {
    arr = questions;
  } else if (typeof questions === 'string') {
    const t = questions.trim();
    if (!t.startsWith('[')) return [];
    try {
      const parsed = JSON.parse(t);
      if (!Array.isArray(parsed)) return [];
      arr = parsed;
    } catch {
      return [];
    }
  } else {
    return [];
  }
  const out = [];
  for (const item of arr) {
    if (!item || typeof item !== 'object') continue;
    const hasQuestionLabel =
      typeof item.question_text === 'string' || typeof item.question_id === 'string';
    if (!hasQuestionLabel) continue;
    const ans = item.answer;
    if (ans !== undefined && ans !== null && typeof ans !== 'string' && typeof ans !== 'number') continue;
    out.push({
      question_id: typeof item.question_id === 'string' ? item.question_id : undefined,
      question_text: typeof item.question_text === 'string' ? item.question_text : undefined,
      answer: ans == null ? '' : String(ans),
    });
  }
  return out;
}

/** Prefer API `answers`; else parse `questions` (older payloads / edge not yet deployed). */
export function resolveCheckinTemplateAnswers(checkin) {
  if (!checkin) return [];
  if (Array.isArray(checkin.answers) && checkin.answers.length > 0) return checkin.answers;
  return parseCheckinTemplateAnswers(checkin.questions);
}
