import { RefreshSession } from '../../domain/entities/refresh-session.js';
import type { RefreshSessionOrmEntity } from '../persistence/refresh-session.orm-entity.js';

export type RefreshSessionRecord = Omit<RefreshSessionOrmEntity, 'user'>;

export const RefreshSessionMapper = {
  toDomain(record: RefreshSessionRecord): RefreshSession {
    return RefreshSession.restore({
      id: record.id,
      userId: record.userId,
      tokenHash: record.tokenHash,
      previousTokenHash: record.previousTokenHash,
      rotatedAt: record.rotatedAt,
      userSessionVersion: record.userSessionVersion,
      expiresAt: record.expiresAt,
      revokedAt: record.revokedAt,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    });
  },

  toPersistence(session: RefreshSession): RefreshSessionRecord {
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
  },
};
