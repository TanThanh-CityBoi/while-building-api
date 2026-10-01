import { beforeEach, describe, expect, it } from 'vitest';
import { contentFixture } from '../../../../../test/fakes/content.fixture.js';
import { ProjectNotFoundError } from '../errors/content.errors.js';
import { GetPublishedProjectUseCase } from './get-published-project.use-case.js';

describe('GetPublishedProjectUseCase', () => {
  let getProject: GetPublishedProjectUseCase;

  beforeEach(() => {
    getProject = new GetPublishedProjectUseCase(contentFixture().projects);
  });

  it('returns a published project', async () => {
    const project = await getProject.execute('mcp-playground');
    expect(project).toMatchObject({
      slug: 'mcp-playground',
      technologies: ['TypeScript', 'NestJS', 'MCP'],
      featured: true,
      links: [{ label: 'GitHub' }],
    });
    expect(project).not.toHaveProperty('status');
  });

  it.each(['secret-cms', 'unknown'])(
    'reports %s as not found',
    async (slug) => {
      await expect(getProject.execute(slug)).rejects.toThrow(
        ProjectNotFoundError,
      );
    },
  );
});
