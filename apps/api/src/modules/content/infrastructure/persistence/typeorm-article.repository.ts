import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { escapeLike } from '../../../../shared/persistence/escape-like.js';
import type { Article } from '../../domain/entities/article.js';
import {
  ArticleRepository,
  type ArticleListCriteria,
  type ArticleListPage,
} from '../../domain/repositories/article.repository.js';
import { ArticleMapper } from '../mappers/article.mapper.js';
import { ArticleOrmEntity } from './article.orm-entity.js';

@Injectable()
export class TypeOrmArticleRepository extends ArticleRepository {
  constructor(
    @InjectRepository(ArticleOrmEntity)
    private readonly records: Repository<ArticleOrmEntity>,
  ) {
    super();
  }

  async list(criteria: ArticleListCriteria): Promise<ArticleListPage> {
    const { page, pageSize, search, category, status } = criteria;
    const query = this.records.createQueryBuilder('article');

    if (status) query.andWhere('article.status = :status', { status });
    if (category) {
      query.andWhere('lower(article.category) = lower(:category)', {
        category,
      });
    }
    if (search) {
      query.andWhere(
        '(article.title ILIKE :search OR article.description ILIKE :search OR article.category ILIKE :search)',
        { search: `%${escapeLike(search)}%` },
      );
    }

    const [records, total] = await query
      .orderBy('article.publishedAt', 'DESC', 'NULLS LAST')
      .addOrderBy('article.createdAt', 'DESC')
      .addOrderBy('article.id', 'ASC')
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();

    return {
      articles: records.map((record) => ArticleMapper.toDomain(record)),
      total,
    };
  }

  async findBySlug(slug: string): Promise<Article | null> {
    const record = await this.records.findOneBy({ slug });
    return record ? ArticleMapper.toDomain(record) : null;
  }
}
