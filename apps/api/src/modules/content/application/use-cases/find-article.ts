import type { Article } from '../../domain/entities/article.js';
import type { ArticleRepository } from '../../domain/repositories/article.repository.js';
import { ArticleNotFoundError } from '../errors/content.errors.js';

/** Loads an article by id, in any status (for the CMS). */
export async function findArticle(
  articles: ArticleRepository,
  id: string,
): Promise<Article> {
  const article = await articles.findById(id);
  if (!article) throw new ArticleNotFoundError();
  return article;
}
