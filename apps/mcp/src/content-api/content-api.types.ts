// Wire shapes of the While Building API's public content routes
// (apps/api: GET /articles, /articles/:slug, /projects, /projects/:slug).
// Dates arrive as ISO strings.

export interface Page<T> {
  data: T[];
  meta: { page: number; pageSize: number; total: number; totalPages: number };
}

export interface ApiArticleSummary {
  id: string;
  slug: string;
  title: string;
  description: string;
  category: string;
  publishedAt: string | null;
  readingTimeMinutes: number;
  createdAt: string;
  updatedAt: string;
}

export interface ApiArticle extends ApiArticleSummary {
  body: string | null;
}

export interface ApiProject {
  id: string;
  slug: string;
  name: string;
  description: string;
  technologies: string[];
  stage: 'active' | 'experimental' | 'archived' | null;
  featured: boolean;
  links: { label: string; href?: string }[];
  createdAt: string;
  updatedAt: string;
}

export interface ArticleQuery {
  page?: number;
  pageSize?: number;
  search?: string;
  category?: string;
}

export interface ProjectQuery {
  page?: number;
  pageSize?: number;
  search?: string;
  technology?: string;
  featured?: boolean;
}
