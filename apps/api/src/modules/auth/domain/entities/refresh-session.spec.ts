import { describe, expect, it } from 'vitest';
import { RefreshSession, ROTATION_GRACE_MS } from './refresh-session.js';

const now = new Date('2026-09-27T12:00:00Z');
const inAWeek = new Date('2026-10-04T12:00:00Z');
const owner = (
  overrides: Partial<{
    id: string;
    sessionVersion: number;
    active: boolean;
  }> = {},
) => {
  const { id = 'u1', sessionVersion = 0, active = true } = overrides;
  return { id, sessionVersion, canLogin: () => active };
};

const start = () =>
  RefreshSession.start(
    { id: 's1', user: owner(), tokenHash: 'hash-1', expiresAt: inAWeek },
    now,
  );

describe('RefreshSession', () => {
  it('is valid for its active owner until it expires', () => {
    const session = start();
    expect(session.isValidFor(owner(), now)).toBe(true);
    expect(session.isValidFor(owner(), inAWeek)).toBe(false);
  });

  it('is invalid for another user, a disabled user, or after the user was signed out everywhere', () => {
    const session = start();
    expect(session.isValidFor(owner({ id: 'u2' }), now)).toBe(false);
    expect(session.isValidFor(owner({ active: false }), now)).toBe(false);
    expect(session.isValidFor(owner({ sessionVersion: 1 }), now)).toBe(false);
  });

  it('is invalid once revoked', () => {
    const session = RefreshSession.restore({
      id: 's1',
      userId: 'u1',
      tokenHash: 'hash-1',
      previousTokenHash: null,
      rotatedAt: null,
      userSessionVersion: 0,
      expiresAt: inAWeek,
      revokedAt: now,
      createdAt: now,
      updatedAt: now,
    });
    expect(session.isValidFor(owner(), now)).toBe(false);
  });

  it('rotates the token, keeping the replaced one acceptable only within the grace window', () => {
    const session = start();
    const nextWeek = new Date(inAWeek.getTime() + 60_000);
    session.rotate('hash-2', nextWeek, now);

    expect(session.isCurrentToken('hash-2')).toBe(true);
    expect(session.isCurrentToken('hash-1')).toBe(false);
    expect(session.expiresAt).toEqual(nextWeek);
    expect(session.isRecentlyReplacedToken('hash-1', now)).toBe(true);
    expect(
      session.isRecentlyReplacedToken(
        'hash-1',
        new Date(now.getTime() + ROTATION_GRACE_MS),
      ),
    ).toBe(false);
    expect(session.isRecentlyReplacedToken('something-else', now)).toBe(false);
  });
});
