import { ArticleStatus } from '../modules/content/domain/article-status.js';
import { ContentStatus } from '../modules/content/domain/content-status.js';
import { ProjectStage } from '../modules/content/domain/project-stage.js';
import type { ContentBlock } from '../modules/content/domain/value-objects/article-content.js';
import type { ArticleOrmEntity } from '../modules/content/infrastructure/persistence/article.orm-entity.js';
import type { ProjectOrmEntity } from '../modules/content/infrastructure/persistence/project.orm-entity.js';

// Sample content for local development (`pnpm db:seed:content`), adapted from the
// while-building-web mocks. Includes drafts so the "published only" rule is
// visible. Not real writing: the content is a short placeholder.

type SampleArticle = Omit<ArticleOrmEntity, 'id' | 'author'>;
type SampleProject = Omit<ProjectOrmEntity, 'id'>;

export const sampleArticles: SampleArticle[] = [
  {
    slug: 'running-postgresql-on-a-kubernetes-homelab',
    title: 'Running PostgreSQL on a Kubernetes Homelab',
    excerpt:
      'What I learned while running PostgreSQL on a small Kubernetes homelab.',
    category: 'DevOps',
    coverImage: null,
    authorId: null,
    status: ArticleStatus.PUBLISHED,
    publishedAt: new Date('2026-09-12T00:00:00Z'),
    createdAt: new Date('2026-09-05T09:00:00Z'),
    updatedAt: new Date('2026-09-12T08:30:00Z'),
    content: blocks([
      'I moved the database for my side projects from a Docker Compose file into the k3s cluster on my Mini PC.',
      '',
      '## Storage first',
      'A StatefulSet with a local-path PersistentVolume was enough for a single node. The important part was',
      'knowing where the data actually lives on disk, so backups and restores are boring.',
      '',
      '## Backups',
      'A nightly CronJob runs `pg_dump` and copies the archive off the machine. I tested a restore before',
      'trusting it — the first attempt failed because of a missing role.',
      '',
      '## Lessons',
      '- Set resource requests, or PostgreSQL gets evicted under memory pressure.',
      '- Keep connection counts low; use a pooler once more than one app connects.',
    ]),
  },
  {
    slug: 'building-a-nestjs-api-from-scratch',
    title: 'Building a NestJS API from Scratch',
    excerpt: 'Notes and lessons from building a backend with NestJS.',
    category: 'Backend',
    coverImage: null,
    authorId: null,
    status: ArticleStatus.PUBLISHED,
    publishedAt: new Date('2026-08-27T00:00:00Z'),
    createdAt: new Date('2026-08-18T10:00:00Z'),
    updatedAt: new Date('2026-08-27T07:45:00Z'),
    content: blocks([
      'The While Building API is a NestJS monorepo app organised by bounded context: auth, users and content.',
      '',
      '## Layers',
      'Each module has domain, application, infrastructure and presentation layers. The domain knows nothing',
      'about NestJS or TypeORM; an architecture test fails the build if that rule is broken.',
      '',
      '## Authentication',
      'Short-lived JWT access tokens live in memory on the client; a rotating refresh token sits in an',
      'httpOnly cookie. Every request re-checks the session, so logout and role changes apply immediately.',
      '',
      '## What I would do again',
      '- Validate environment variables once at startup and fail fast.',
      '- Keep migrations explicit and never let the ORM synchronize the schema.',
    ]),
  },
  {
    slug: 'what-i-learned-running-my-first-k3s-cluster',
    title: 'What I Learned Running My First k3s Cluster',
    excerpt: 'Things I learned while experimenting with k3s on a Mini PC.',
    category: 'Kubernetes',
    coverImage: null,
    authorId: null,
    status: ArticleStatus.PUBLISHED,
    publishedAt: new Date('2026-08-09T00:00:00Z'),
    createdAt: new Date('2026-08-01T15:20:00Z'),
    updatedAt: new Date('2026-08-09T06:10:00Z'),
    content: blocks([
      'k3s made a single-node Kubernetes cluster realistic on a Mini PC with 16 GB of RAM.',
      '',
      '## Good surprises',
      '- Traefik and a local-path storage class work out of the box.',
      '- Upgrades are a single binary swap.',
      '',
      '## Rough edges',
      'DNS inside the cluster broke after I changed the host network, and Argo CD took a while to make sense.',
      'Writing everything as manifests in Git turned out to be the real win.',
    ]),
  },
  {
    slug: 'things-i-broke-while-building-my-homelab',
    title: 'Things I Broke While Building My Homelab',
    excerpt:
      'A collection of failures, debugging sessions and lessons learned.',
    category: 'Homelab',
    coverImage: null,
    authorId: null,
    status: ArticleStatus.PUBLISHED,
    publishedAt: new Date('2026-07-21T00:00:00Z'),
    createdAt: new Date('2026-07-10T18:00:00Z'),
    updatedAt: new Date('2026-07-21T09:00:00Z'),
    content: blocks([
      'A list of mistakes so I make different ones next time.',
      '',
      '1. **Filled the disk with logs.** No log rotation on a chatty container took the node down.',
      '2. **Lost a certificate.** The Cloudflare tunnel token lived only on the machine I reinstalled.',
      '3. **Upgraded everything at once.** When it broke I could not tell which change caused it.',
      '',
      'Each failure ended with a small runbook in the repo.',
    ]),
  },
  {
    slug: 'splitting-a-frontend-into-a-monorepo',
    title: 'Splitting a Frontend into a Monorepo',
    excerpt: 'Moving a single Vite app to pnpm workspaces and Turborepo.',
    category: 'Frontend',
    coverImage: null,
    authorId: null,
    status: ArticleStatus.DRAFT,
    publishedAt: null,
    createdAt: new Date('2026-09-24T10:00:00Z'),
    updatedAt: new Date('2026-09-26T16:40:00Z'),
    content: blocks(['Draft — not public yet.']),
  },
  {
    slug: 'cookie-based-auth-for-an-spa',
    title: 'Cookie-Based Auth for an SPA',
    excerpt:
      'httpOnly refresh cookies, in-memory access tokens and what can go wrong.',
    category: 'Security',
    coverImage: null,
    authorId: null,
    status: ArticleStatus.DRAFT,
    publishedAt: null,
    createdAt: new Date('2026-09-20T08:00:00Z'),
    updatedAt: new Date('2026-09-25T11:15:00Z'),
    content: blocks(['Draft — not public yet.']),
  },
  {
    slug: 'my-first-docker-compose-setup',
    title: 'My First Docker Compose Setup',
    excerpt: 'An early write-up, replaced by the k3s articles.',
    category: 'DevOps',
    coverImage: null,
    authorId: null,
    status: ArticleStatus.DRAFT,
    publishedAt: null,
    createdAt: new Date('2026-04-28T10:00:00Z'),
    updatedAt: new Date('2026-08-10T10:00:00Z'),
    content: blocks(['Unpublished — replaced by the k3s articles.']),
  },
];

export const sampleProjects: SampleProject[] = [
  {
    slug: 'personal-homelab',
    name: 'Personal Homelab',
    description: 'A small Kubernetes-based homelab running on a Mini PC.',
    technologies: ['k3s', 'Docker', 'Argo CD', 'Cloudflare'],
    stage: ProjectStage.ACTIVE,
    featured: true,
    status: ContentStatus.PUBLISHED,
    links: [{ label: 'GitHub' }],
    createdAt: new Date('2026-06-01T10:00:00Z'),
    updatedAt: new Date('2026-09-10T10:00:00Z'),
  },
  {
    slug: 'mcp-analytics-playground',
    name: 'MCP Analytics Playground',
    description: 'An experiment around using MCP to analyze website data.',
    technologies: ['TypeScript', 'NestJS', 'MCP'],
    stage: ProjectStage.EXPERIMENTAL,
    featured: true,
    status: ContentStatus.PUBLISHED,
    links: [{ label: 'GitHub' }, { label: 'Demo' }],
    createdAt: new Date('2026-08-15T10:00:00Z'),
    updatedAt: new Date('2026-09-02T10:00:00Z'),
  },
  {
    slug: 'developer-playground',
    name: 'Developer Playground',
    description:
      'Small experiments, prototypes and things I build while learning.',
    technologies: ['React', 'Node.js', 'Docker'],
    stage: ProjectStage.ACTIVE,
    featured: true,
    status: ContentStatus.PUBLISHED,
    links: [{ label: 'GitHub' }],
    createdAt: new Date('2026-05-20T10:00:00Z'),
    updatedAt: new Date('2026-08-30T10:00:00Z'),
  },
  {
    slug: 'while-building-cms',
    name: 'While Building CMS',
    description: 'The internal tool used to manage this site.',
    technologies: ['React', 'TanStack Query', 'Turborepo'],
    stage: ProjectStage.EXPERIMENTAL,
    featured: false,
    status: ContentStatus.DRAFT,
    links: [],
    createdAt: new Date('2026-09-24T10:00:00Z'),
    updatedAt: new Date('2026-09-26T18:00:00Z'),
  },
];

/**
 * Builds a block document from Markdown-like lines: `#`/`##` headings, `-`
 * bullets, `1.` numbered items, paragraphs (consecutive lines join), and
 * inline `**bold**` / `` `code` ``. Just enough for the samples.
 */
function blocks(lines: string[]): ContentBlock[] {
  const result: ContentBlock[] = [];
  let paragraph: string[] = [];
  const flush = () => {
    if (paragraph.length > 0) {
      result.push({ type: 'paragraph', content: inline(paragraph.join(' ')) });
      paragraph = [];
    }
  };
  for (const line of lines) {
    const heading = /^(#{1,3}) (.*)$/.exec(line);
    const bullet = /^- (.*)$/.exec(line);
    const numbered = /^\d+\. (.*)$/.exec(line);
    if (heading || bullet || numbered || line.trim() === '') flush();
    if (heading) {
      result.push({
        type: 'heading',
        props: { level: heading[1].length },
        content: inline(heading[2]),
      });
    } else if (bullet) {
      result.push({ type: 'bulletListItem', content: inline(bullet[1]) });
    } else if (numbered) {
      result.push({ type: 'numberedListItem', content: inline(numbered[1]) });
    } else if (line.trim() !== '') {
      paragraph.push(line.trim());
    }
  }
  flush();
  return result;
}

function inline(text: string): ContentBlock['content'] {
  return text
    .split(/(\*\*[^*]+\*\*|`[^`]+`)/)
    .filter(Boolean)
    .map((part) =>
      part.startsWith('**')
        ? { type: 'text', text: part.slice(2, -2), styles: { bold: true } }
        : part.startsWith('`')
          ? { type: 'text', text: part.slice(1, -1), styles: { code: true } }
          : { type: 'text', text: part, styles: {} },
    );
}
