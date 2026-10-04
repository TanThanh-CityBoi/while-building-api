import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthorDirectory } from './application/ports/author-directory.js';
import { CreateArticleUseCase } from './application/use-cases/create-article.use-case.js';
import { DeleteArticleUseCase } from './application/use-cases/delete-article.use-case.js';
import { GetArticleUseCase } from './application/use-cases/get-article.use-case.js';
import { GetPublishedArticleUseCase } from './application/use-cases/get-published-article.use-case.js';
import { GetPublishedProjectUseCase } from './application/use-cases/get-published-project.use-case.js';
import { ListArticlesUseCase } from './application/use-cases/list-articles.use-case.js';
import { ListPublishedArticlesUseCase } from './application/use-cases/list-published-articles.use-case.js';
import { ListPublishedProjectsUseCase } from './application/use-cases/list-published-projects.use-case.js';
import { PublishArticleUseCase } from './application/use-cases/publish-article.use-case.js';
import { UnpublishArticleUseCase } from './application/use-cases/unpublish-article.use-case.js';
import { UpdateArticleUseCase } from './application/use-cases/update-article.use-case.js';
import { ArticleRepository } from './domain/repositories/article.repository.js';
import { ProjectRepository } from './domain/repositories/project.repository.js';
import { ArticleOrmEntity } from './infrastructure/persistence/article.orm-entity.js';
import { ProjectOrmEntity } from './infrastructure/persistence/project.orm-entity.js';
import { TypeOrmArticleRepository } from './infrastructure/persistence/typeorm-article.repository.js';
import { TypeOrmAuthorDirectory } from './infrastructure/persistence/typeorm-author-directory.js';
import { TypeOrmProjectRepository } from './infrastructure/persistence/typeorm-project.repository.js';
import { ArticlesController } from './presentation/controllers/articles.controller.js';
import { ManagedArticlesController } from './presentation/controllers/managed-articles.controller.js';
import { ProjectsController } from './presentation/controllers/projects.controller.js';

/**
 * Content bounded context: articles and projects (later tags, categories,
 * revisions), organised like the other modules. It also owns the CONTENT_*
 * permissions (domain/content-permission.ts).
 *
 * Articles are written and published from the CMS (`/content/articles`, with
 * permissions); the public reads published articles and projects
 * (`/articles`, `/projects`). Projects are still written by the dev seed
 * (`pnpm db:seed:content`).
 */
@Module({
  imports: [TypeOrmModule.forFeature([ArticleOrmEntity, ProjectOrmEntity])],
  controllers: [
    ArticlesController,
    ManagedArticlesController,
    ProjectsController,
  ],
  providers: [
    { provide: ArticleRepository, useClass: TypeOrmArticleRepository },
    { provide: ProjectRepository, useClass: TypeOrmProjectRepository },
    { provide: AuthorDirectory, useClass: TypeOrmAuthorDirectory },
    ListPublishedArticlesUseCase,
    GetPublishedArticleUseCase,
    ListArticlesUseCase,
    GetArticleUseCase,
    CreateArticleUseCase,
    UpdateArticleUseCase,
    PublishArticleUseCase,
    UnpublishArticleUseCase,
    DeleteArticleUseCase,
    ListPublishedProjectsUseCase,
    GetPublishedProjectUseCase,
  ],
})
export class ContentModule {}
