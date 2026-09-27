import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateUsersAndAuthSessions1790500000000 implements MigrationInterface {
  name = 'CreateUsersAndAuthSessions1790500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."user_role" AS ENUM('ROOT', 'ADMIN', 'EDITOR', 'AUTHOR')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."user_status" AS ENUM('ACTIVE', 'DISABLED')`,
    );
    // gen_random_uuid() is built into PostgreSQL 13+ (no extension required).
    await queryRunner.query(`
      CREATE TABLE "users" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "email" character varying(254) NOT NULL,
        "password_hash" character varying(255) NOT NULL,
        "name" character varying(100) NOT NULL,
        "role" "public"."user_role" NOT NULL,
        "status" "public"."user_status" NOT NULL DEFAULT 'ACTIVE',
        "last_login_at" TIMESTAMP WITH TIME ZONE,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "users_pkey" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "users_email_key" ON "users" ("email")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "users_single_root_idx" ON "users" ("role") WHERE "role" = 'ROOT'`,
    );

    await queryRunner.query(`
      CREATE TABLE "auth_sessions" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL,
        "token_hash" character varying(64) NOT NULL,
        "previous_token_hash" character varying(64),
        "rotated_at" TIMESTAMP WITH TIME ZONE,
        "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL,
        "revoked_at" TIMESTAMP WITH TIME ZONE,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "auth_sessions_pkey" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "auth_sessions_user_id_idx" ON "auth_sessions" ("user_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "auth_sessions_expires_at_idx" ON "auth_sessions" ("expires_at")`,
    );
    await queryRunner.query(`
      ALTER TABLE "auth_sessions"
        ADD CONSTRAINT "auth_sessions_user_id_fkey"
        FOREIGN KEY ("user_id") REFERENCES "users"("id")
        ON DELETE CASCADE ON UPDATE NO ACTION
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "auth_sessions"`);
    await queryRunner.query(`DROP TABLE "users"`);
    await queryRunner.query(`DROP TYPE "public"."user_status"`);
    await queryRunner.query(`DROP TYPE "public"."user_role"`);
  }
}
