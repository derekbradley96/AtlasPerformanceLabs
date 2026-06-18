import { describe, it, expect } from 'vitest';
import { normalizeInviteCode } from '@/lib/supabaseStripeApi';

describe('normalizeInviteCode', () => {
  it('lowercases', () => {
    expect(normalizeInviteCode('ATLAS123')).toBe('atlas123');
  });

  it('trims', () => {
    expect(normalizeInviteCode('  abc123  ')).toBe('abc123');
  });

  it('handles null', () => {
    expect(normalizeInviteCode(null)).toBe('');
  });

  it('handles undefined', () => {
    expect(normalizeInviteCode(undefined)).toBe('');
  });

  it('handles non-string', () => {
    expect(normalizeInviteCode(123)).toBe('');
  });

  it('already lowercase unchanged', () => {
    expect(normalizeInviteCode('abc123')).toBe('abc123');
  });
});
