import type { RefreshSession } from '../entities/refresh-session.js';

/** Persistence port for refresh sessions (an abstract class so it doubles as the DI token). */
export abstract class RefreshSessionRepository {
  abstract create(session: RefreshSession): Promise<void>;

  abstract findById(id: string): Promise<RefreshSession | null>;

  /**
   * Stores a rotation only if the stored token hash is still
   * `expectedTokenHash` (optimistic concurrency). Resolves `false` when a
   * concurrent refresh rotated the session first.
   */
  abstract saveRotation(
    session: RefreshSession,
    expectedTokenHash: string,
  ): Promise<boolean>;

  /** Ends a session. Idempotent. */
  abstract revoke(id: string, at: Date): Promise<void>;
}
