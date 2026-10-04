import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Articles become writable from the CMS:
 * - their own status (DRAFT / PUBLISHED; archived articles become drafts),
 * - the Markdown `body` becomes `content`, a JSON block document (each
 *   paragraph of the old body becomes a paragraph block),
 * - `description` becomes the optional `excerpt`, `category` turns optional,
 * - the reading time is derived from the content instead of stored,
 * - a cover image and an author (kept as NULL when the user is deleted).
 */
export class ArticlePublishing1790800000000 implements MigrationInterface {
  name = 'ArticlePublishing1790800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."article_status" AS ENUM('DRAFT', 'PUBLISHED')`,
    );
    await queryRunner.query(
      `UPDATE "articles" SET "published_at" = NULL WHERE "status" <> 'PUBLISHED'`,
    );
    await queryRunner.query(
      `ALTER TABLE "articles" ALTER COLUMN "status" DROP DEFAULT`,
    );
    await queryRunner.query(`
      ALTER TABLE "articles" ALTER COLUMN "status" TYPE "public"."article_status"
        USING (CASE WHEN "status" = 'PUBLISHED' THEN 'PUBLISHED' ELSE 'DRAFT' END)::"public"."article_status"
    `);
    await queryRunner.query(
      `ALTER TABLE "articles" ALTER COLUMN "status" SET DEFAULT 'DRAFT'`,
    );

    await queryRunner.query(
      `ALTER TABLE "articles" RENAME COLUMN "description" TO "excerpt"`,
    );
    await queryRunner.query(
      `ALTER TABLE "articles" ALTER COLUMN "excerpt" DROP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "articles" ALTER COLUMN "category" DROP NOT NULL`,
    );

    await queryRunner.query(
      `ALTER TABLE "articles" ADD "content" jsonb NOT NULL DEFAULT '[]'`,
    );
    // One paragraph block per blank-line-separated chunk of the old body.
    await queryRunner.query(`
      UPDATE "articles" SET "content" = (
        SELECT coalesce(jsonb_agg(
          jsonb_build_object(
            'type', 'paragraph',
            'content', jsonb_build_array(
              jsonb_build_object('type', 'text', 'text', trim(chunk), 'styles', '{}'::jsonb)
            )
          ) ORDER BY position
        ), '[]'::jsonb)
        FROM regexp_split_to_table("body", '\\n\\s*\\n') WITH ORDINALITY AS split(chunk, position)
        WHERE trim(chunk) <> ''
      )
      WHERE "body" IS NOT NULL
    `);
    // A published article must have content.
    await queryRunner.query(`
      UPDATE "articles" SET "status" = 'DRAFT', "published_at" = NULL
      WHERE "status" = 'PUBLISHED' AND "content" = '[]'::jsonb
    `);
    await queryRunner.query(`ALTER TABLE "articles" DROP COLUMN "body"`);
    await queryRunner.query(
      `ALTER TABLE "articles" DROP COLUMN "reading_time_minutes"`,
    );

    await queryRunner.query(
      `ALTER TABLE "articles" ADD "cover_image" character varying(2048)`,
    );
    await queryRunner.query(`ALTER TABLE "articles" ADD "author_id" uuid`);
    await queryRunner.query(`
      ALTER TABLE "articles" ADD CONSTRAINT "articles_author_id_fkey"
        FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION
    `);
    await queryRunner.query(
      `CREATE INDEX "articles_author_id_idx" ON "articles" ("author_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "articles_updated_at_idx" ON "articles" ("updated_at")`,
    );
  }

  /** Back to Markdown bodies as plain text: formatting and nested blocks are lost. */
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."articles_updated_at_idx"`);
    await queryRunner.query(`DROP INDEX "public"."articles_author_id_idx"`);
    await queryRunner.query(
      `ALTER TABLE "articles" DROP CONSTRAINT "articles_author_id_fkey"`,
    );
    await queryRunner.query(`ALTER TABLE "articles" DROP COLUMN "author_id"`);
    await queryRunner.query(`ALTER TABLE "articles" DROP COLUMN "cover_image"`);

    await queryRunner.query(
      `ALTER TABLE "articles" ADD "reading_time_minutes" integer NOT NULL DEFAULT 0`,
    );
    await queryRunner.query(`ALTER TABLE "articles" ADD "body" text`);
    await queryRunner.query(`
      UPDATE "articles" SET "body" = (
        SELECT string_agg(
          (SELECT string_agg(coalesce(run->>'text', ''), '')
           FROM jsonb_array_elements(
             CASE WHEN jsonb_typeof(block->'content') = 'array' THEN block->'content' ELSE '[]'::jsonb END
           ) AS run),
          E'\\n\\n' ORDER BY position
        )
        FROM jsonb_array_elements("content") WITH ORDINALITY AS blocks(block, position)
      )
    `);
    await queryRunner.query(`ALTER TABLE "articles" DROP COLUMN "content"`);

    await queryRunner.query(
      `UPDATE "articles" SET "category" = '' WHERE "category" IS NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "articles" ALTER COLUMN "category" SET NOT NULL`,
    );
    await queryRunner.query(
      `UPDATE "articles" SET "excerpt" = '' WHERE "excerpt" IS NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "articles" ALTER COLUMN "excerpt" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "articles" RENAME COLUMN "excerpt" TO "description"`,
    );

    await queryRunner.query(
      `ALTER TABLE "articles" ALTER COLUMN "status" DROP DEFAULT`,
    );
    await queryRunner.query(`
      ALTER TABLE "articles" ALTER COLUMN "status" TYPE "public"."content_status"
        USING "status"::text::"public"."content_status"
    `);
    await queryRunner.query(
      `ALTER TABLE "articles" ALTER COLUMN "status" SET DEFAULT 'DRAFT'`,
    );
    await queryRunner.query(`DROP TYPE "public"."article_status"`);
  }
}
