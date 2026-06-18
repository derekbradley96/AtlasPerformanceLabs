import { describe, it, expect } from 'vitest';
import {
  normalizeRole,
  isCoach,
  isClient,
  displayRoleLabel,
} from '@/lib/roles';

describe('normalizeRole', () => {
  it('maps trainer → coach', () => {
    expect(normalizeRole('trainer')).toBe('coach');
  });

  it('maps solo → personal', () => {
    expect(normalizeRole('solo')).toBe('personal');
  });

  it('maps athlete → personal (legacy read)', () => {
    expect(normalizeRole('athlete')).toBe('personal');
  });

  it('coach stays coach', () => {
    expect(normalizeRole('coach')).toBe('coach');
  });

  it('null uses default role', () => {
    expect(normalizeRole(null)).toBe('personal');
  });

  it('reads role from profile object', () => {
    expect(normalizeRole({ role: 'trainer' })).toBe('coach');
  });
});

describe('displayRoleLabel', () => {
  it('trainer shows Coach', () => {
    expect(displayRoleLabel('trainer')).toBe('Coach');
  });

  it('solo shows Personal', () => {
    expect(displayRoleLabel('solo')).toBe('Personal');
  });

  it('unknown raw role normalizes to personal label', () => {
    expect(typeof displayRoleLabel('unknown')).toBe('string');
    expect(displayRoleLabel('unknown')).toBe('Personal');
  });
});

describe('isCoach / isClient', () => {
  it('isCoach true for trainer legacy', () => {
    expect(isCoach('trainer')).toBe(true);
  });

  it('isClient true for client', () => {
    expect(isClient('client')).toBe(true);
  });

  it('isClient false for trainer', () => {
    expect(isClient('trainer')).toBe(false);
  });
});
