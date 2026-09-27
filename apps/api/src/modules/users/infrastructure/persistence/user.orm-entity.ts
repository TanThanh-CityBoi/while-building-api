import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { Role } from '../../domain/role.js';
import { UserStatus } from '../../domain/user-status.js';

/** Database record for a user (table `users`). Not the domain model: see UserMapper. */
@Entity({ name: 'users' })
// Emails are stored normalized (trimmed, lower-case), so this is case-insensitive in practice.
@Index('users_email_key', ['email'], { unique: true })
// At most one ROOT account can ever exist.
@Index('users_single_root_idx', ['role'], {
  unique: true,
  where: `"role" = 'ROOT'`,
})
export class UserOrmEntity {
  @PrimaryGeneratedColumn('uuid', { primaryKeyConstraintName: 'users_pkey' })
  id!: string;

  @Column({ type: 'varchar', length: 254 })
  email!: string;

  /** Argon2id PHC string. Never selected unless asked for explicitly. */
  @Column({
    name: 'password_hash',
    type: 'varchar',
    length: 255,
    select: false,
  })
  passwordHash!: string;

  @Column({ type: 'varchar', length: 100 })
  name!: string;

  @Column({ type: 'enum', enum: Role, enumName: 'user_role' })
  role!: Role;

  @Column({
    type: 'enum',
    enum: UserStatus,
    enumName: 'user_status',
    default: UserStatus.ACTIVE,
  })
  status!: UserStatus;

  @Column({ name: 'session_version', type: 'integer', default: 0 })
  sessionVersion!: number;

  @Column({ name: 'last_login_at', type: 'timestamptz', nullable: true })
  lastLoginAt!: Date | null;

  // Timestamps are set by the domain; the defaults only cover direct inserts.
  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'now()' })
  createdAt!: Date;

  @Column({ name: 'updated_at', type: 'timestamptz', default: () => 'now()' })
  updatedAt!: Date;
}
