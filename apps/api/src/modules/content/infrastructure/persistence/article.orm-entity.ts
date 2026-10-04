import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ArticleStatus } from '../../domain/article-status.js';

/** Database record for an article (table `articles`). Not the domain model: see ArticleMapper. */
@Entity({ name: 'articles' })
@Index('articles_slug_key', ['slug'], { unique: true })
// Public lists filter on status and sort by publication date.
@Index('articles_status_published_at_idx', ['status', 'publishedAt'])
// The CMS lists the most recently updated articles first.
@Index('articles_updated_at_idx', ['updatedAt'])
@Index('articles_author_id_idx', ['authorId'])
export class ArticleOrmEntity {
  @PrimaryGeneratedColumn('uuid', { primaryKeyConstraintName: 'articles_pkey' })
  id!: string;

  @Column({ type: 'varchar', length: 200 })
  slug!: string;

  @Column({ type: 'varchar', length: 200 })
  title!: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  excerpt!: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  category!: string | null;

  @Column({
    type: 'enum',
    enum: ArticleStatus,
    enumName: 'article_status',
    default: ArticleStatus.DRAFT,
  })
  status!: ArticleStatus;

  /**
   * The editor's block document, stored as-is. Typed loosely: the domain
   * (ArticleContent) checks its shape when reading it back.
   */
  @Column({ type: 'jsonb', default: () => `'[]'` })
  content!: object[];

  @Column({
    name: 'cover_image',
    type: 'varchar',
    length: 2048,
    nullable: true,
  })
  coverImage!: string | null;

  @Column({ name: 'author_id', type: 'uuid', nullable: true })
  authorId!: string | null;

  // Referenced by entity name: the content context doesn't import the users
  // module (see architecture.spec.ts). Deleting the user keeps the article.
  @ManyToOne('UserOrmEntity', { onDelete: 'SET NULL' })
  @JoinColumn({
    name: 'author_id',
    foreignKeyConstraintName: 'articles_author_id_fkey',
  })
  author?: unknown;

  @Column({ name: 'published_at', type: 'timestamptz', nullable: true })
  publishedAt!: Date | null;

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'now()' })
  createdAt!: Date;

  @Column({ name: 'updated_at', type: 'timestamptz', default: () => 'now()' })
  updatedAt!: Date;
}
