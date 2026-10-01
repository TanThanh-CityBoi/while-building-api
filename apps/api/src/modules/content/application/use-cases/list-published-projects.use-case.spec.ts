import { beforeEach, describe, expect, it } from 'vitest';
import { contentFixture } from '../../../../../test/fakes/content.fixture.js';
import { ListPublishedProjectsUseCase } from './list-published-projects.use-case.js';

describe('ListPublishedProjectsUseCase', () => {
  let listProjects: ListPublishedProjectsUseCase;

  beforeEach(() => {
    listProjects = new ListPublishedProjectsUseCase(contentFixture().projects);
  });

  it('lists only published projects, featured first, without status', async () => {
    const result = await listProjects.execute({ page: 1, pageSize: 10 });

    expect(result.projects.map((p) => p.slug)).toEqual([
      'mcp-playground',
      'homelab',
    ]);
    expect(result.projects[0]).not.toHaveProperty('status');
    expect(result).toMatchObject({ total: 2, totalPages: 1 });
  });

  it('filters by technology, ignoring case', async () => {
    const result = await listProjects.execute({
      page: 1,
      pageSize: 10,
      technology: 'docker',
    });
    expect(result.projects.map((p) => p.slug)).toEqual(['homelab']);
  });

  it('filters by featured', async () => {
    const result = await listProjects.execute({
      page: 1,
      pageSize: 10,
      featured: false,
    });
    expect(result.projects.map((p) => p.slug)).toEqual(['homelab']);
  });

  it('searches names, descriptions and technologies of published projects only', async () => {
    const result = await listProjects.execute({
      page: 1,
      pageSize: 10,
      search: 'mcp',
    });
    expect(result.projects.map((p) => p.slug)).toEqual(['mcp-playground']);
  });
});
