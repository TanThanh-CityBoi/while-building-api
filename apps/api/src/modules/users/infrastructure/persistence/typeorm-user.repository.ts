import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { escapeLike } from '../../../../shared/persistence/escape-like.js';
import type { User } from '../../domain/entities/user.js';
import { EmailAlreadyInUseError } from '../../domain/errors/user.errors.js';
import {
  UserRepository,
  type UserListCriteria,
  type UserListPage,
} from '../../domain/repositories/user.repository.js';
import type { Role } from '../../domain/role.js';
import type { Email } from '../../domain/value-objects/email.js';
import { UserMapper } from '../mappers/user.mapper.js';
import { UserOrmEntity } from './user.orm-entity.js';

const EMAIL_UNIQUE_CONSTRAINT = 'users_email_key';
const PG_UNIQUE_VIOLATION = '23505';

@Injectable()
export class TypeOrmUserRepository extends UserRepository {
  constructor(
    @InjectRepository(UserOrmEntity)
    private readonly records: Repository<UserOrmEntity>,
  ) {
    super();
  }

  async findById(id: string): Promise<User | null> {
    const record = await this.records.findOneBy({ id });
    return record ? UserMapper.toDomain(record) : null;
  }

  async findCredentialsByEmail(
    email: Email,
  ): Promise<{ user: User; passwordHash: string } | null> {
    const record = await this.records.findOne({
      where: { email: email.value },
      // password_hash is `select: false`, so every wanted column is listed.
      select: {
        id: true,
        email: true,
        passwordHash: true,
        name: true,
        role: true,
        status: true,
        sessionVersion: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    return record
      ? { user: UserMapper.toDomain(record), passwordHash: record.passwordHash }
      : null;
  }

  existsByEmail(email: Email): Promise<boolean> {
    return this.records.existsBy({ email: email.value });
  }

  existsWithRole(role: Role): Promise<boolean> {
    return this.records.existsBy({ role });
  }

  async list(criteria: UserListCriteria): Promise<UserListPage> {
    const { page, pageSize, search, role, status, excludeRole } = criteria;
    const query = this.records.createQueryBuilder('user');

    if (excludeRole)
      query.andWhere('user.role != :excludeRole', { excludeRole });
    if (search) {
      query.andWhere('(user.name ILIKE :search OR user.email ILIKE :search)', {
        search: `%${escapeLike(search)}%`,
      });
    }
    if (role) query.andWhere('user.role = :role', { role });
    if (status) query.andWhere('user.status = :status', { status });

    const [records, total] = await query
      .orderBy('user.createdAt', 'DESC')
      .addOrderBy('user.id', 'ASC')
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();

    return {
      users: records.map((record) => UserMapper.toDomain(record)),
      total,
    };
  }

  async create(user: User, passwordHash: string): Promise<void> {
    try {
      await this.records.insert({
        ...UserMapper.toPersistence(user),
        passwordHash,
      });
    } catch (error) {
      throw translateError(error);
    }
  }

  async save(
    user: User,
    changes: { passwordHash?: string } = {},
  ): Promise<void> {
    const { id, ...fields } = UserMapper.toPersistence(user);
    try {
      await this.records.update(
        { id },
        changes.passwordHash === undefined
          ? fields
          : { ...fields, passwordHash: changes.passwordHash },
      );
    } catch (error) {
      throw translateError(error);
    }
  }

  async saveLastLogin(user: User): Promise<void> {
    await this.records.update(
      { id: user.id },
      { lastLoginAt: user.lastLoginAt },
    );
  }

  async delete(id: string): Promise<void> {
    await this.records.delete({ id });
  }
}

/** A unique-email race becomes a domain error instead of a 500. */
function translateError(error: unknown): unknown {
  const driverError =
    error instanceof QueryFailedError
      ? (error.driverError as
          { code?: string; constraint?: string } | undefined)
      : undefined;
  if (
    driverError?.code === PG_UNIQUE_VIOLATION &&
    driverError.constraint === EMAIL_UNIQUE_CONSTRAINT
  ) {
    return new EmailAlreadyInUseError();
  }
  return error;
}
