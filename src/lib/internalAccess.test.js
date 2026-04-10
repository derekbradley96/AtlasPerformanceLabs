import { describe, it, expect } from 'vitest';
import { isInternalAdmin, isOwnerUser } from '@/lib/internalAccess';

describe('internalAccess', () => {
  it('allows owner email only', () => {
    expect(isOwnerUser({ email: 'derekbradley96@gmail.com' })).toBe(true);
    expect(isOwnerUser({ email: 'DEREKBRADLEY96@GMAIL.COM' })).toBe(true);
    expect(isOwnerUser({ email: 'coach@example.com' })).toBe(false);
    expect(isOwnerUser(null)).toBe(false);
  });

  it('internal admin mirrors owner access (fail closed)', () => {
    expect(isInternalAdmin({ email: 'derekbradley96@gmail.com' })).toBe(true);
    expect(isInternalAdmin({ id: 'some-user' })).toBe(false);
    expect(isInternalAdmin(undefined)).toBe(false);
  });
});

