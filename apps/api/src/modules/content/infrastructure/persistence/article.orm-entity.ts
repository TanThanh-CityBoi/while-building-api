import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { ContentStatus } from '../../domain/content-status.js';

/** Database record for an article (table `articles`). Not the domain model: see ArticleMapper. */
@Entity({ name: 'articles' })
@Index('articles_slug_key', ['slug'], { unique: true })
// Public lists filter on status and sort by publication date.
@Index('articles_status_published_at_idx', ['status', 'publishedAt'])
export class ArticleOrmEntity {
  @PrimaryGeneratedColumn('uuid', { primaryKeyConstraintName: 'articles_pkey' })
  id!: string;

  @Column({ type: 'varchar', length: 200 })
  slug!: string;

  @Column({ type: 'varchar', length: 200 })
  title!: string;

  @Column({ type: 'varchar', length: 500 })
  description!: string;

  @Column({ type: 'varchar', length: 50 })
  category!: string;

  @Column({
    type: 'enum',
    enum: ContentStatus,
    enumName: 'content_status',
    default: ContentStatus.DRAFT,
  })
  status!: ContentStatus;

  @Column({ type: 'text', nullable: true })
  body!: string | null;

  @Column({ name: 'reading_time_minutes', type: 'integer', default: 0 })
  readingTimeMinutes!: number;

  @Column({ name: 'published_at', type: 'timestamptz', nullable: true })
  publishedAt!: Date | null;

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'now()' })
  createdAt!: Date;

  @Column({ name: 'updated_at', type: 'timestamptz', default: () => 'now()' })
  updatedAt!: Date;
}
