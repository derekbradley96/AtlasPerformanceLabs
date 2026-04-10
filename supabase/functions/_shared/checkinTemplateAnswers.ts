/**
 * Coach template check-ins store Q&A in public.checkins.questions as JSON text
 * (array of { question_id?, question_text?, answer? }).
 */
export type CheckinTemplateAnswerRow = {
  question_id?: string;
  question_text?: string;
  answer?: string;
};

export function parseCheckinTemplateAnswers(questions: unknown): CheckinTemplateAnswerRow[] {
  if (questions == null || questions === "") return [];
  let arr: unknown[];
  if (Array.isArray(questions)) {
    arr = questions;
  } else if (typeof questions === "string") {
    const t = questions.trim();
    if (!t.startsWith("[")) return [];
    try {
      const parsed: unknown = JSON.parse(t);
      if (!Array.isArray(parsed)) return [];
      arr = parsed;
    } catch {
      return [];
    }
  } else {
    return [];
  }
  const out: CheckinTemplateAnswerRow[] = [];
  for (const item of arr) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const hasQuestionLabel =
      typeof o.question_text === "string" ||
      typeof o.question_id === "string";
    if (!hasQuestionLabel) continue;
    const ans = o.answer;
    if (ans !== undefined && ans !== null && typeof ans !== "string" && typeof ans !== "number") continue;
    out.push({
      question_id: typeof o.question_id === "string" ? o.question_id : undefined,
      question_text: typeof o.question_text === "string" ? o.question_text : undefined,
      answer: ans == null ? "" : String(ans),
    });
  }
  return out;
}
