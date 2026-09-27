import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { UserOrmEntity } from '../../../users/infrastructure/persistence/user.orm-entity.js';

/** Database record for a refresh session (table `auth_sessions`). */
@Entity({ name: 'auth_sessions' })
@Index('auth_sessions_user_id_idx', ['userId'])
@Index('auth_sessions_expires_at_idx', ['expiresAt'])
export class RefreshSessionOrmEntity {
  // Normally chosen by the application (it is embedded in the refresh token);
  // the database only generates one when an insert doesn't provide it.
  @PrimaryGeneratedColumn('uuid', {
    primaryKeyConstraintName: 'auth_sessions_pkey',
  })
  id!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @ManyToOne(() => UserOrmEntity, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'user_id',
    foreignKeyConstraintName: 'auth_sessions_user_id_fkey',
  })
  user?: UserOrmEntity;

  @Column({ name: 'token_hash', type: 'varchar', length: 64 })
  tokenHash!: string;

  @Column({
    name: 'previous_token_hash',
    type: 'varchar',
    length: 64,
    nullable: true,
  })
  previousTokenHash!: string | null;

  @Column({ name: 'rotated_at', type: 'timestamptz', nullable: true })
  rotatedAt!: Date | null;

  @Column({ name: 'user_session_version', type: 'integer', default: 0 })
  userSessionVersion!: number;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt!: Date;

  @Column({ name: 'revoked_at', type: 'timestamptz', nullable: true })
  revokedAt!: Date | null;

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'now()' })
  createdAt!: Date;

  @Column({ name: 'updated_at', type: 'timestamptz', default: () => 'now()' })
  updatedAt!: Date;
}
