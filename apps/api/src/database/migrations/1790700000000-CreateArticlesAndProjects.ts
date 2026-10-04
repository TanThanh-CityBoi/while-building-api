import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The content context's first tables. Only published rows are ever exposed
 * publicly; slugs are the public identifiers.
 */
export class CreateArticlesAndProjects1790700000000 implements MigrationInterface {
  name = 'CreateArticlesAndProjects1790700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."content_status" AS ENUM('DRAFT', 'PUBLISHED', 'ARCHIVED')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."project_stage" AS ENUM('active', 'experimental', 'archived')`,
    );

    await queryRunner.query(`
      CREATE TABLE "articles" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "slug" character varying(200) NOT NULL,
        "title" character varying(200) NOT NULL,
        "description" character varying(500) NOT NULL,
        "category" character varying(50) NOT NULL,
        "status" "public"."content_status" NOT NULL DEFAULT 'DRAFT',
        "body" text,
        "reading_time_minutes" integer NOT NULL DEFAULT 0,
        "published_at" TIMESTAMP WITH TIME ZONE,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "articles_pkey" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "articles_slug_key" ON "articles" ("slug")`,
    );
    await queryRunner.query(
      `CREATE INDEX "articles_status_published_at_idx" ON "articles" ("status", "published_at")`,
    );

    await queryRunner.query(`
      CREATE TABLE "projects" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "slug" character varying(200) NOT NULL,
        "name" character varying(200) NOT NULL,
        "description" character varying(500) NOT NULL,
        "technologies" text array NOT NULL DEFAULT '{}',
        "stage" "public"."project_stage",
        "featured" boolean NOT NULL DEFAULT false,
        "status" "public"."content_status" NOT NULL DEFAULT 'DRAFT',
        "links" jsonb NOT NULL DEFAULT '[]',
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "projects_slug_key" ON "projects" ("slug")`,
    );
    await queryRunner.query(
      `CREATE INDEX "projects_status_idx" ON "projects" ("status")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "projects"`);
    await queryRunner.query(`DROP TABLE "articles"`);
    await queryRunner.query(`DROP TYPE "public"."project_stage"`);
    await queryRunner.query(`DROP TYPE "public"."content_status"`);
  }
}
