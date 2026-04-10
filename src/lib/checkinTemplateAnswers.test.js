import { describe, it, expect } from 'vitest';
import { parseCheckinTemplateAnswers, resolveCheckinTemplateAnswers } from './checkinTemplateAnswers.js';

describe('checkinTemplateAnswers', () => {
  it('parses JSON array from questions string', () => {
    const q = JSON.stringify([
      { question_id: 'a', question_text: 'How was training?', answer: 'Good' },
    ]);
    expect(parseCheckinTemplateAnswers(q)).toEqual([
      { question_id: 'a', question_text: 'How was training?', answer: 'Good' },
    ]);
  });

  it('returns [] for non-JSON questions text', () => {
    expect(parseCheckinTemplateAnswers('Felt fine this week')).toEqual([]);
  });

  it('resolveCheckinTemplateAnswers prefers checkin.answers', () => {
    const checkin = {
      answers: [{ question_id: 'x', question_text: 'Q', answer: 'A' }],
      questions: '[]',
    };
    expect(resolveCheckinTemplateAnswers(checkin)).toHaveLength(1);
  });

  it('resolveCheckinTemplateAnswers falls back to questions', () => {
    const raw = JSON.stringify([{ question_text: 'Sleep?', answer: '7' }]);
    expect(resolveCheckinTemplateAnswers({ questions: raw })).toEqual([
      { question_id: undefined, question_text: 'Sleep?', answer: '7' },
    ]);
  });
});
