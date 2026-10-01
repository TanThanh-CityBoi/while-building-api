import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GetPublishedArticleUseCase } from './application/use-cases/get-published-article.use-case.js';
import { GetPublishedProjectUseCase } from './application/use-cases/get-published-project.use-case.js';
import { ListPublishedArticlesUseCase } from './application/use-cases/list-published-articles.use-case.js';
import { ListPublishedProjectsUseCase } from './application/use-cases/list-published-projects.use-case.js';
import { ArticleRepository } from './domain/repositories/article.repository.js';
import { ProjectRepository } from './domain/repositories/project.repository.js';
import { ArticleOrmEntity } from './infrastructure/persistence/article.orm-entity.js';
import { ProjectOrmEntity } from './infrastructure/persistence/project.orm-entity.js';
import { TypeOrmArticleRepository } from './infrastructure/persistence/typeorm-article.repository.js';
import { TypeOrmProjectRepository } from './infrastructure/persistence/typeorm-project.repository.js';
import { ArticlesController } from './presentation/controllers/articles.controller.js';
import { ProjectsController } from './presentation/controllers/projects.controller.js';

/**
 * Content bounded context: articles and projects (later tags, categories and
 * publishing), organised like the other modules. It also owns the CONTENT_*
 * permissions (domain/content-permission.ts).
 *
 * For now the API only reads published content, publicly; content is written
 * by the dev seed (`pnpm db:seed:content`) until the CMS manages it.
 */
@Module({
  imports: [TypeOrmModule.forFeature([ArticleOrmEntity, ProjectOrmEntity])],
  controllers: [ArticlesController, ProjectsController],
  providers: [
    { provide: ArticleRepository, useClass: TypeOrmArticleRepository },
    { provide: ProjectRepository, useClass: TypeOrmProjectRepository },
    ListPublishedArticlesUseCase,
    GetPublishedArticleUseCase,
    ListPublishedProjectsUseCase,
    GetPublishedProjectUseCase,
  ],
})
export class ContentModule {}
