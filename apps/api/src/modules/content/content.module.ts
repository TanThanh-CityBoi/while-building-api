import { Module } from '@nestjs/common';

/**
 * Content bounded context: the future home of articles, projects, tags,
 * categories and publishing, organised like the other modules
 * (domain / application / infrastructure / presentation).
 *
 * For now it only defines its permissions (domain/content-permission.ts).
 */
@Module({})
export class ContentModule {}
