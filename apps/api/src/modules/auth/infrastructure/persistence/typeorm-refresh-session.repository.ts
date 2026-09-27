import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import type { RefreshSession } from '../../domain/entities/refresh-session.js';
import { RefreshSessionRepository } from '../../domain/repositories/refresh-session.repository.js';
import { RefreshSessionMapper } from '../mappers/refresh-session.mapper.js';
import { RefreshSessionOrmEntity } from './refresh-session.orm-entity.js';

@Injectable()
export class TypeOrmRefreshSessionRepository extends RefreshSessionRepository {
  constructor(
    @InjectRepository(RefreshSessionOrmEntity)
    private readonly records: Repository<RefreshSessionOrmEntity>,
  ) {
    super();
  }

  async create(session: RefreshSession): Promise<void> {
    await this.records.insert(RefreshSessionMapper.toPersistence(session));
  }

  async findById(id: string): Promise<RefreshSession | null> {
    const record = await this.records.findOneBy({ id });
    return record ? RefreshSessionMapper.toDomain(record) : null;
  }

  async saveRotation(
    session: RefreshSession,
    expectedTokenHash: string,
  ): Promise<boolean> {
    // Compare-and-swap: only one of several concurrent refreshes can rotate.
    const result = await this.records
      .createQueryBuilder()
      .update(RefreshSessionOrmEntity)
      .set({
        tokenHash: session.tokenHash,
        previousTokenHash: session.previousTokenHash,
        rotatedAt: session.rotatedAt,
        expiresAt: session.expiresAt,
        updatedAt: session.updatedAt,
      })
      .where(
        'id = :id AND token_hash = :expectedTokenHash AND revoked_at IS NULL',
        {
          id: session.id,
          expectedTokenHash,
        },
      )
      .execute();
    return result.affected === 1;
  }

  async revoke(id: string, at: Date): Promise<void> {
    await this.records.update(
      { id, revokedAt: IsNull() },
      { revokedAt: at, updatedAt: at },
    );
  }
}
