import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { escapeLike } from '../../../../shared/persistence/escape-like.js';
import type { Article } from '../../domain/entities/article.js';
import { ArticleSlugTakenError } from '../../domain/errors/article.errors.js';
import {
  ArticleRepository,
  type ArticleListCriteria,
  type ArticleListPage,
} from '../../domain/repositories/article.repository.js';
import type { ArticleSlug } from '../../domain/value-objects/article-slug.js';
import { ArticleMapper } from '../mappers/article.mapper.js';
import { ArticleOrmEntity } from './article.orm-entity.js';

const SLUG_UNIQUE_CONSTRAINT = 'articles_slug_key';
const PG_UNIQUE_VIOLATION = '23505';

@Injectable()
export class TypeOrmArticleRepository extends ArticleRepository {
  constructor(
    @InjectRepository(ArticleOrmEntity)
    private readonly records: Repository<ArticleOrmEntity>,
  ) {
    super();
  }

  async list(criteria: ArticleListCriteria): Promise<ArticleListPage> {
    const { page, pageSize, search, category, status, sort } = criteria;
    const query = this.records.createQueryBuilder('article');

    if (status) query.andWhere('article.status = :status', { status });
    if (category) {
      query.andWhere('lower(article.category) = lower(:category)', {
        category,
      });
    }
    if (search) {
      query.andWhere(
        '(article.title ILIKE :search OR article.excerpt ILIKE :search OR article.slug ILIKE :search OR article.category ILIKE :search)',
        { search: `%${escapeLike(search)}%` },
      );
    }

    const field = sort?.field ?? 'publishedAt';
    const direction = sort?.direction === 'asc' ? 'ASC' : 'DESC';
    query.orderBy(
      `article.${field}`,
      direction,
      direction === 'DESC' ? 'NULLS LAST' : 'NULLS FIRST',
    );
    if (field !== 'createdAt') query.addOrderBy('article.createdAt', 'DESC');

    const [records, total] = await query
      .addOrderBy('article.id', 'ASC')
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();

    return {
      articles: records.map((record) => ArticleMapper.toDomain(record)),
      total,
    };
  }

  async findById(id: string): Promise<Article | null> {
    const record = await this.records.findOneBy({ id });
    return record ? ArticleMapper.toDomain(record) : null;
  }

  async findBySlug(slug: string): Promise<Article | null> {
    const record = await this.records.findOneBy({ slug });
    return record ? ArticleMapper.toDomain(record) : null;
  }

  existsBySlug(slug: ArticleSlug, exceptId?: string): Promise<boolean> {
    const query = this.records
      .createQueryBuilder('article')
      .where('article.slug = :slug', { slug: slug.value });
    if (exceptId) query.andWhere('article.id != :exceptId', { exceptId });
    return query.getExists();
  }

  async create(article: Article): Promise<void> {
    try {
      await this.records.insert(ArticleMapper.toPersistence(article));
    } catch (error) {
      throw translateError(error);
    }
  }

  async save(article: Article): Promise<void> {
    const { id, ...fields } = ArticleMapper.toPersistence(article);
    try {
      await this.records.update({ id }, fields);
    } catch (error) {
      throw translateError(error);
    }
  }

  async delete(id: string): Promise<void> {
    await this.records.delete({ id });
  }
}

/** A unique-slug race becomes a domain error instead of a 500. */
function translateError(error: unknown): unknown {
  const driverError =
    error instanceof QueryFailedError
      ? (error.driverError as
          { code?: string; constraint?: string } | undefined)
      : undefined;
  if (
    driverError?.code === PG_UNIQUE_VIOLATION &&
    driverError.constraint === SLUG_UNIQUE_CONSTRAINT
  ) {
    return new ArticleSlugTakenError();
  }
  return error;
}
