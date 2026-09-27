import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Lets the users context end all of a user's sessions without knowing about
 * sessions: disabling a user or resetting their password increments
 * `users.session_version`, and a session is only valid while it matches the
 * version it started with (`auth_sessions.user_session_version`).
 *
 * Existing rows get 0 on both sides, so current sessions stay valid.
 */
export class AddSessionVersions1790600000000 implements MigrationInterface {
  name = 'AddSessionVersions1790600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD "session_version" integer NOT NULL DEFAULT 0`,
    );
    await queryRunner.query(
      `ALTER TABLE "auth_sessions" ADD "user_session_version" integer NOT NULL DEFAULT 0`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "auth_sessions" DROP COLUMN "user_session_version"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN "session_version"`,
    );
  }
}
