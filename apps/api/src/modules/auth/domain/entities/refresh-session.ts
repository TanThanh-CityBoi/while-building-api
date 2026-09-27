import type { User } from '../../../users/domain/entities/user.js';

/**
 * How long a just-replaced refresh token is still accepted. Covers concurrent
 * refreshes (e.g. several tabs restoring at once) without rotating twice.
 */
export const ROTATION_GRACE_MS = 30_000;

export interface RefreshSessionProps {
  id: string;
  userId: string;
  /** Hash of the current refresh token (tokens themselves are never stored). */
  tokenHash: string;
  /** Hash of the token replaced by the last rotation. */
  previousTokenHash: string | null;
  rotatedAt: Date | null;
  /** The user's session version when this session started (see User.invalidateSessions). */
  userSessionVersion: number;
  expiresAt: Date;
  revokedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

type SessionOwner = Pick<User, 'id' | 'sessionVersion' | 'canLogin'>;

/** One sign-in, kept alive by a rotating refresh token. */
export class RefreshSession {
  private constructor(private readonly props: RefreshSessionProps) {}

  static start(
    input: {
      id: string;
      user: SessionOwner;
      tokenHash: string;
      expiresAt: Date;
    },
    now: Date,
  ): RefreshSession {
    return new RefreshSession({
      id: input.id,
      userId: input.user.id,
      tokenHash: input.tokenHash,
      previousTokenHash: null,
      rotatedAt: null,
      userSessionVersion: input.user.sessionVersion,
      expiresAt: input.expiresAt,
      revokedAt: null,
      createdAt: now,
      updatedAt: now,
    });
  }

  static restore(props: RefreshSessionProps): RefreshSession {
    return new RefreshSession({ ...props });
  }

  get id(): string {
    return this.props.id;
  }
  get userId(): string {
    return this.props.userId;
  }
  get tokenHash(): string {
    return this.props.tokenHash;
  }
  get previousTokenHash(): string | null {
    return this.props.previousTokenHash;
  }
  get rotatedAt(): Date | null {
    return this.props.rotatedAt;
  }
  get userSessionVersion(): number {
    return this.props.userSessionVersion;
  }
  get expiresAt(): Date {
    return this.props.expiresAt;
  }
  get revokedAt(): Date | null {
    return this.props.revokedAt;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }
  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  /**
   * Whether this session may still authenticate its user: not revoked, not
   * expired, the user may sign in, and they haven't been signed out everywhere
   * since the session started.
   */
  isValidFor(user: SessionOwner, now: Date): boolean {
    return (
      this.props.userId === user.id &&
      this.props.revokedAt === null &&
      this.props.expiresAt > now &&
      this.props.userSessionVersion === user.sessionVersion &&
      user.canLogin()
    );
  }

  isCurrentToken(tokenHash: string): boolean {
    return constantTimeEquals(tokenHash, this.props.tokenHash);
  }

  /** The token replaced by the last rotation, still within the grace window. */
  isRecentlyReplacedToken(tokenHash: string, now: Date): boolean {
    const { previousTokenHash, rotatedAt } = this.props;
    return (
      previousTokenHash !== null &&
      rotatedAt !== null &&
      now.getTime() - rotatedAt.getTime() < ROTATION_GRACE_MS &&
      constantTimeEquals(tokenHash, previousTokenHash)
    );
  }

  /** Replaces the refresh token; the session's expiry slides forward. */
  rotate(newTokenHash: string, expiresAt: Date, now: Date): void {
    this.props.previousTokenHash = this.props.tokenHash;
    this.props.tokenHash = newTokenHash;
    this.props.rotatedAt = now;
    this.props.expiresAt = expiresAt;
    this.props.updatedAt = now;
  }
}

/** Compares two hashes without leaking where they differ. */
function constantTimeEquals(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let i = 0; i < a.length; i++) {
    difference |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return difference === 0;
}
