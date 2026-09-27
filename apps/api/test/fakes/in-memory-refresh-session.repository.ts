import {
  RefreshSession,
  type RefreshSessionProps,
} from '../../src/modules/auth/domain/entities/refresh-session.js';
import { RefreshSessionRepository } from '../../src/modules/auth/domain/repositories/refresh-session.repository.js';

/** RefreshSessionRepository for unit tests, with the same compare-and-swap rotation. */
export class InMemoryRefreshSessionRepository extends RefreshSessionRepository {
  private readonly rows = new Map<string, RefreshSessionProps>();

  all(): RefreshSession[] {
    return [...this.rows.values()].map((props) =>
      RefreshSession.restore(props),
    );
  }

  create(session: RefreshSession): Promise<void> {
    this.rows.set(session.id, propsOf(session));
    return Promise.resolve();
  }

  findById(id: string): Promise<RefreshSession | null> {
    const props = this.rows.get(id);
    return Promise.resolve(props ? RefreshSession.restore(props) : null);
  }

  saveRotation(
    session: RefreshSession,
    expectedTokenHash: string,
  ): Promise<boolean> {
    const stored = this.rows.get(session.id);
    if (!stored || stored.tokenHash !== expectedTokenHash || stored.revokedAt) {
      return Promise.resolve(false);
    }
    this.rows.set(session.id, propsOf(session));
    return Promise.resolve(true);
  }

  revoke(id: string, at: Date): Promise<void> {
    const stored = this.rows.get(id);
    if (stored && !stored.revokedAt)
      this.rows.set(id, { ...stored, revokedAt: at });
    return Promise.resolve();
  }
}

function propsOf(session: RefreshSession): RefreshSessionProps {
  return {
    id: session.id,
    userId: session.userId,
    tokenHash: session.tokenHash,
    previousTokenHash: session.previousTokenHash,
    rotatedAt: session.rotatedAt,
    userSessionVersion: session.userSessionVersion,
    expiresAt: session.expiresAt,
    revokedAt: session.revokedAt,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
  };
}
