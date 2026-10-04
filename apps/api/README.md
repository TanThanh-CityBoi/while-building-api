# While Building API

Backend API for **While Building** — _Things I build, things I learn, things I break._

## Overview

`apps/api` is the main business API of the [`while-building-api` monorepo](../../README.md):
authentication, users and authorization, article writing and publishing for the CMS, and public
read-only content (articles and projects); media, revisions and project management are next. It owns the backend's business logic. It is a plain Node.js process
with no provider-specific code, so it runs on Render, in Docker, on Kubernetes/k3s or any other
Node.js host.

Commands below run from the repository root unless noted. The root scripts use Turborepo, which
first builds the shared packages (`packages/*`) the API depends on.

## Frontend

The frontend lives in a separate repository,
[`while-building-web`](https://github.com/TanThanh-CityBoi/while-building-web), a monorepo with:

- **client** — the public website (only uses `GET /health` for now)
- **cms** — While Building CMS, the internal content management system, which signs in and
  manages users and articles through this API

The CMS's HTTP layer (`packages/api-client`) follows the contract documented below; both sides
use the same response shapes.

## Stack

- [NestJS](https://nestjs.com/) 12 (ESM) on Express, TypeScript 6 (strict)
- PostgreSQL (13+; Docker Compose uses 18) via [TypeORM](https://typeorm.io/) 1 with migrations
- JWT (`@nestjs/jwt`) — short-lived access tokens + rotating refresh tokens in an httpOnly cookie
- Argon2id password hashing (`@node-rs/argon2`)
- `class-validator` DTO validation, `@nestjs/throttler` login rate limiting
- OpenAPI docs via `@nestjs/swagger`
- Vitest + Supertest, ESLint (type-checked) + Prettier, pnpm workspaces + Turborepo

## Environment

Copy the example and fill it in (`.env` is git-ignored — never commit real values). The API reads
`apps/api/.env`; every app in the monorepo has its own:

```bash
cp apps/api/.env.example apps/api/.env
```

Everything is validated at startup (`src/config/env.validation.ts`, built on the generic readers in
`@while-building/config`); the app refuses to start and lists every problem at once.

| Variable                 | Required | Default                            | Description                                                                                                                    |
| ------------------------ | -------- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `PORT`                   | no       | `3000`                             | HTTP port.                                                                                                                     |
| `NODE_ENV`               | no       | `development`                      | `development`, `production` or `test`. Production enables secure cookies, disables Swagger and rejects placeholder secrets.    |
| `DATABASE_HOST`          | yes      | —                                  | PostgreSQL host.                                                                                                               |
| `DATABASE_PORT`          | no       | `5432`                             | PostgreSQL port.                                                                                                               |
| `DATABASE_USER`          | yes      | —                                  | PostgreSQL user.                                                                                                               |
| `DATABASE_PASSWORD`      | no       | empty                              | PostgreSQL password.                                                                                                           |
| `DATABASE_NAME`          | yes      | —                                  | Database name.                                                                                                                 |
| `CORS_ORIGIN`            | yes      | —                                  | Allowed browser origins, comma-separated, e.g. `http://localhost:5173,http://localhost:5174` (client, CMS). Bare origins only. |
| `JWT_ACCESS_SECRET`      | yes      | —                                  | Access-token signing secret, ≥ 32 characters.                                                                                  |
| `JWT_REFRESH_SECRET`     | yes      | —                                  | Refresh-token signing secret, ≥ 32 characters, different from the access secret.                                               |
| `JWT_ACCESS_EXPIRES_IN`  | no       | `15m`                              | Access-token lifetime (`900`, `15m`, `12h`, `7d`).                                                                             |
| `JWT_REFRESH_EXPIRES_IN` | no       | `7d`                               | Session lifetime; sliding, renewed on each refresh.                                                                            |
| `COOKIE_SECURE`          | no       | `true` in production, else `false` | `Secure` flag on the refresh cookie.                                                                                           |
| `COOKIE_SAME_SITE`       | no       | `lax`                              | `lax`, `strict` or `none` (`none` requires `COOKIE_SECURE=true`; only for cross-site deployments).                             |
| `COOKIE_DOMAIN`          | no       | —                                  | Cookie domain, if it must be shared across subdomains.                                                                         |
| `TRUST_PROXY`            | no       | —                                  | Express `trust proxy` (e.g. `1`) when behind a reverse proxy, so client IPs are right.                                         |
| `SWAGGER_ENABLED`        | no       | `true` unless production           | Serve OpenAPI docs at `/docs` (JSON at `/docs-json`).                                                                          |
| `ROOT_EMAIL`             | seed     | —                                  | ROOT account email (only read by `pnpm db:seed`).                                                                              |
| `ROOT_PASSWORD`          | seed     | —                                  | ROOT account password, ≥ 12 characters (only read by `pnpm db:seed`).                                                          |
| `ROOT_NAME`              | no       | `Root`                             | ROOT display name.                                                                                                             |

Generate secrets with:

```bash
node -e "console.log(require('node:crypto').randomBytes(48).toString('base64url'))"
```

## Database

### PostgreSQL

Start a local PostgreSQL 18 container with a persistent volume:

```bash
docker compose -f docker/docker-compose.yml up -d
```

The container's defaults match `apps/api/.env.example` (`postgres` / `postgres`, database
`while_building`, port `5432`). If you change any `DATABASE_*` value in `apps/api/.env`, pass the
same file to Compose:

```bash
docker compose --env-file apps/api/.env -f docker/docker-compose.yml up -d
```

Any PostgreSQL 13+ works (UUIDs use the built-in `gen_random_uuid()`).

### Migrations

The schema is managed only by migrations (`synchronize` is off, and the app never runs DDL on
startup — conventions from `@while-building/database`). Migrations live in
`src/database/migrations/` and are registered in `src/database/migrations/index.ts`. The TypeORM
models they correspond to live in each module's `infrastructure/persistence/` folder
(`*.orm-entity.ts`) and are listed in `src/database/typeorm.config.ts`. Both belong to the API, not
to the shared package.

| Migration                                  | Change                                                                                                                                                                                     |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `1790500000000-CreateUsersAndAuthSessions` | `users` and `auth_sessions` tables, role/status enums, indexes                                                                                                                             |
| `1790600000000-AddSessionVersions`         | `users.session_version`, `auth_sessions.user_session_version` (default 0; existing sessions stay valid)                                                                                    |
| `1790700000000-CreateArticlesAndProjects`  | `articles` and `projects` tables, `content_status` / `project_stage` enums, slug and status indexes                                                                                        |
| `1790800000000-ArticlePublishing`          | `article_status` enum (archived → draft), Markdown `body` → jsonb `content`, `description` → `excerpt`, `cover_image`, `author_id` (FK, `SET NULL`), indexes; drops `reading_time_minutes` |

**Pulling this change into an existing database?** Run `pnpm db:migrate` before starting the API.

```bash
pnpm db:migrate            # build, then apply pending migrations
pnpm db:migrate:status     # list applied / pending migrations
pnpm db:migrate:revert     # revert the last migration
pnpm db:migration:generate src/database/migrations/AddArticles   # diff entities → new migration (path relative to apps/api)
```

`pnpm db:migrate:prod` (run in `apps/api`) applies migrations from an existing `dist/` (production
images, where the Nest CLI isn't installed).

Current tables:

| Table           | Purpose                                                                                                                                                                                                                                                                                                     |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `users`         | `id` (uuid), unique `email`, `password_hash`, `name`, `role`, `status`, `session_version`, `last_login_at`, timestamps. A partial unique index allows only one ROOT.                                                                                                                                        |
| `articles`      | `id` (uuid), unique `slug`, `title`, `excerpt`, `category`, `status` (`DRAFT`/`PUBLISHED`), `content` (jsonb block document from the CMS editor), `cover_image`, `author_id` (→ `users`, `SET NULL` on delete), `published_at`, timestamps. Indexed by `(status, published_at)`, `updated_at`, `author_id`. |
| `projects`      | `id` (uuid), unique `slug`, `name`, `description`, `technologies` (text[]), `stage` (`active`/`experimental`/`archived`), `featured`, `status`, `links` (jsonb `{ label, href? }[]`), timestamps.                                                                                                           |
| `auth_sessions` | One row per sign-in: `user_id` (cascade delete), SHA-256 `token_hash` (+ previous hash for rotation), `user_session_version`, `expires_at`, `revoked_at`, timestamps. Indexed by `user_id` and `expires_at`.                                                                                                |

### Seed

```bash
pnpm db:seed          # build, then create the ROOT user if it doesn't exist
pnpm db:seed:prod     # same, from an existing dist/ (run in apps/api)
pnpm db:seed:content  # local development only: sample articles and projects (incl. drafts)
```

`db:seed:content` writes the sample content in `src/database/sample-content.ts` (matched by slug, so
re-running resets those rows and leaves others alone; the ROOT account, if seeded, becomes the
articles' author). It refuses to run with `NODE_ENV=production`. Projects only come from this seed
until the CMS manages them.

## Root account

- ROOT is created **only** by `pnpm db:seed`, from `ROOT_EMAIL` / `ROOT_PASSWORD` / `ROOT_NAME`.
  The password is hashed with Argon2id and never logged.
- The seed is idempotent: if a ROOT exists it does nothing — it never overwrites the password or
  changes a role. It refuses to run if `ROOT_EMAIL` belongs to an existing (non-root) user, and the
  database allows only one ROOT.
- ROOT is hidden from user management: it never appears in `GET /users`, and every `/users/:id`
  route answers `404` for it (the same as for an unknown id), so it can't be read, edited, disabled,
  deleted or assigned — not even by ROOT itself through this API.
- **Use your own strong credentials, and change them for production.** Placeholder passwords are
  rejected when `NODE_ENV=production`.

## Authentication

| Endpoint             | Auth   | Description                                                                                                                                                                                                        |
| -------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `POST /auth/login`   | public | `{ email, password }` → `{ accessToken, expiresIn, user }` and sets the refresh cookie. `401` invalid credentials (same message whether or not the email exists), `403` disabled account, `429` too many attempts. |
| `POST /auth/refresh` | cookie | → `{ accessToken, expiresIn }` and rotates the cookie. `401` if the session is missing, invalid, expired, revoked or its user is disabled.                                                                         |
| `POST /auth/logout`  | cookie | Ends the session and clears the cookie. Always `204`, safe to repeat.                                                                                                                                              |
| `GET /auth/me`       | bearer | `{ data: { id, email, name, role, permissions } }`.                                                                                                                                                                |

How it works:

- **Access token** — a JWT (15 min) returned in the body. Clients keep it in memory and send
  `Authorization: Bearer <token>`. Every request re-checks its session and user, so logout,
  disabling a user and role changes take effect immediately.
- **Refresh token** — a JWT (7 days) in the `wb_refresh` cookie: `HttpOnly`, `SameSite=Lax`,
  `Path=/auth` (never sent to other routes), `Secure` in production. It is never returned in a body
  or readable by JavaScript. The database stores only its SHA-256 hash.
- **Rotation** — each refresh issues a new refresh token (atomically). The previous token is still
  accepted for 30 seconds without rotating again (concurrent refreshes, e.g. several tabs); after
  that, presenting it counts as token reuse and revokes the whole session.
- **Signing out everywhere** — disabling a user or resetting their password increments the user's
  `session_version`; sessions started under an older version stop working (re-enabling the user
  does not bring them back). This keeps the users context free of any knowledge of sessions.
- **Login protection** — Argon2id verification runs even for unknown emails (uniform timing), and
  sign-in is rate-limited to 5 attempts per minute per IP + email and 30 per minute per IP.
- Access and refresh tokens use different secrets and a `typ` claim; only HS256 is accepted.

## Users

All routes require a bearer token and the listed permission. ROOT is never included.

| Endpoint                  | Permission     | Description                                                                                                                                                  |
| ------------------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `GET /users`              | `USERS_READ`   | `?page=1&pageSize=20&search=&role=&status=` → `{ data: User[], meta: { page, pageSize, total, totalPages } }`, newest first. `search` matches name or email. |
| `GET /users/:id`          | `USERS_READ`   | `{ data: User }`.                                                                                                                                            |
| `POST /users`             | `USERS_CREATE` | `{ email, name, password, role }` → `201 { data: User }`, status `ACTIVE`. `409` duplicate email; `role` can't be `ROOT`.                                    |
| `PATCH /users/:id`        | `USERS_UPDATE` | Any of `{ name, email, role, password }`. `password` is an admin reset and ends the user's sessions. You can't change your own role.                         |
| `PATCH /users/:id/status` | `USERS_UPDATE` | `{ status: "ACTIVE" \| "DISABLED" }`. Disabling ends the user's sessions. Not for yourself.                                                                  |
| `DELETE /users/:id`       | `USERS_DELETE` | Permanently deletes the user and their sessions (`204`). Not for yourself.                                                                                   |

`User` = `{ id, email, name, role, status, lastLoginAt, createdAt, updatedAt }` — never a password
or hash. Emails are stored trimmed and lower-cased. Passwords must be 8–128 characters.

Errors use the NestJS shape `{ "statusCode": 400, "message": "…" | ["…"], "error": "Bad Request" }`:
`400` invalid input (unknown fields are rejected), `401` not signed in, `403` missing permission,
`404` not found, `409` conflict, `429` rate limited. Server errors never include details or stack traces.

## Content

### Article management (CMS)

Authenticated routes; each needs the listed permission. Articles start as drafts; `publish` makes one
public (it needs a title, a slug and some content), `unpublish` makes it a draft again. Saving a
published article updates the public page right away (there are no revisions yet).

| Endpoint                               | Permission        | Description                                                                                                                                                            |
| -------------------------------------- | ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /content/articles`                | `CONTENT_READ`    | `?page=1&pageSize=20&search=&status=&sort=updatedAt&order=desc` → `{ data: ArticleSummary[], meta }`, every status, recently updated first.                            |
| `GET /content/articles/:id`            | `CONTENT_READ`    | `{ data: Article }`, with its `content`.                                                                                                                               |
| `POST /content/articles`               | `CONTENT_CREATE`  | `{ title, slug?, excerpt?, category?, coverImage?, content? }` → `201` draft by the signed-in user; the slug defaults to one derived from the title. `409` slug taken. |
| `PATCH /content/articles/:id`          | `CONTENT_UPDATE`  | Any of the create fields; `null` clears an optional one. Changing the title keeps the slug. `409` slug taken; `400` if a published article would lose its content.     |
| `POST /content/articles/:id/publish`   | `CONTENT_PUBLISH` | Draft → published (`publishedAt` = now). `409` already published, `400` no content.                                                                                    |
| `POST /content/articles/:id/unpublish` | `CONTENT_PUBLISH` | Published → draft (`publishedAt` = `null`). `409` not published.                                                                                                       |
| `DELETE /content/articles/:id`         | `CONTENT_DELETE`  | `204`; permanent.                                                                                                                                                      |

`Article` = `{ id, slug, title, excerpt, category, coverImage, status, author: { id, name } | null,
publishedAt, readingTimeMinutes, content, createdAt, updatedAt }`; `ArticleSummary` is the same
without `content`. `content` is the editor's block document (BlockNote JSON), stored as-is; the API
only checks that it's a list of blocks and reads its text (for `readingTimeMinutes`, 200 words a
minute, and the "has content" rule). Request bodies may be up to 1 MB.

### Public content

Public, read-only routes for the website (and the MCP server). They need no token and only ever
return `PUBLISHED` content: drafts answer `404`, the same as an unknown slug.

| Endpoint              | Description                                                                                                                                                                                     |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /articles`       | `?page=1&pageSize=10&search=&category=` → `{ data: PublishedArticleSummary[], meta }`, newest first. `search` matches title, excerpt, slug or category; `category` is exact (case-insensitive). |
| `GET /articles/:slug` | `{ data: PublishedArticle }` — the summary plus its `content`.                                                                                                                                  |
| `GET /projects`       | `?page=1&pageSize=10&search=&technology=&featured=` → `{ data: Project[], meta }`, featured first, then most recently updated. `technology` is exact (case-insensitive).                        |
| `GET /projects/:slug` | `{ data: Project }`.                                                                                                                                                                            |

`PublishedArticleSummary` = `{ id, slug, title, excerpt, category, coverImage, author: { id, name } | null, publishedAt, readingTimeMinutes, createdAt, updatedAt }`;
`Project` = `{ id, slug, name, description, technologies, stage, featured, links, createdAt, updatedAt }`.
Responses never include the publishing status. `pageSize` is at most 50; slugs are lower-case words
joined by hyphens (anything else is a `400`).

## Roles

| Role     | Meaning                                                                          |
| -------- | -------------------------------------------------------------------------------- |
| `ROOT`   | System account from the seed. Hidden from and protected against user management. |
| `ADMIN`  | Manages users and all content.                                                   |
| `EDITOR` | Edits and publishes content.                                                     |
| `AUTHOR` | Creates and edits content.                                                       |

## Permissions

Each bounded context owns its permissions (`USERS_*` in `modules/users/domain/user-permission.ts`,
`CONTENT_*` in `modules/content/domain/content-permission.ts`). The auth context maps roles to them in
one static table, `modules/auth/domain/authorization/role-permissions.ts`:

| Permission        | ROOT | ADMIN | EDITOR | AUTHOR |
| ----------------- | :--: | :---: | :----: | :----: |
| `USERS_READ`      |  ✓   |   ✓   |        |        |
| `USERS_CREATE`    |  ✓   |   ✓   |        |        |
| `USERS_UPDATE`    |  ✓   |   ✓   |        |        |
| `USERS_DELETE`    |  ✓   |   ✓   |        |        |
| `CONTENT_READ`    |  ✓   |   ✓   |   ✓    |   ✓    |
| `CONTENT_CREATE`  |  ✓   |   ✓   |   ✓    |   ✓    |
| `CONTENT_UPDATE`  |  ✓   |   ✓   |   ✓    |   ✓    |
| `CONTENT_DELETE`  |  ✓   |   ✓   |        |        |
| `CONTENT_PUBLISH` |  ✓   |   ✓   |   ✓    |        |

The CMS article routes check these permissions; the public content routes need none.

Authorization is enforced by two global guards: `AccessTokenGuard` (every route needs a valid access
token unless marked `@Public()`) and `PermissionsGuard` (routes marked `@Permissions(...)` need all
listed permissions). Handlers get the signed-in user with `@CurrentUser()`. Business invariants —
ROOT can't be disabled, deleted or given another role; nobody can be made ROOT — are enforced by
the `User` domain entity and the use cases, not by the guards. The frontend only uses permissions
to adapt its UI; this API is the security boundary.

```ts
@Permissions(UserPermission.USERS_READ)
@Get()
list(@CurrentUser() user: AuthenticatedUser) {}
```

## Development

```bash
pnpm install
cp apps/api/.env.example apps/api/.env              # first time; set JWT secrets and ROOT_* values
docker compose -f docker/docker-compose.yml up -d   # start PostgreSQL
pnpm db:migrate                                     # create the schema
pnpm db:seed                                        # create the ROOT user
pnpm dev:api                                        # http://localhost:3000 (docs: /docs)
```

`pnpm dev:api` restarts the API when its code, or a shared package it uses, changes.

Quality checks — the root scripts cover every app and package; for the API alone, use
`pnpm turbo run <task> --filter=@while-building/api`:

```bash
pnpm typecheck      # TypeScript, no emit
pnpm lint           # ESLint (type-checked rules) + workspace boundaries
pnpm format:check   # Prettier (pnpm format to fix)
pnpm test           # unit tests: domain rules, use cases (with in-memory fakes), architecture rules
pnpm test:e2e       # e2e tests against a real PostgreSQL (see below)
pnpm build          # compile to dist/
```

`pnpm test:e2e` uses its own database, `while_building_test` (created automatically on the server
from `apps/api/.env`; it refuses any database whose name doesn't end in `_test`), with test-only
secrets from `test/setup/test-env.ts`. It runs the migrations, then boots the real app for each test
file.

## Build

```bash
pnpm build --filter=@while-building/api        # compiles the API (and the packages it uses) to dist/
pnpm --filter @while-building/api start:prod   # runs node dist/main in apps/api
```

The production process needs `apps/api/dist/`, its production dependencies — including the built
workspace packages `@while-building/config`, `@while-building/database` and `@while-building/shared`
— and the environment variables above. Deploy order (in `apps/api`): `pnpm db:migrate:prod`, then
`pnpm db:seed:prod` (first deploy only), then `pnpm start:prod`. It listens on `PORT` and shuts down
cleanly on `SIGTERM`.

## Architecture

Module-first, pragmatic DDD. Each business module (bounded context) has four layers:

| Layer            | Contains                                                                                    | May depend on                                                                       |
| ---------------- | ------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `domain`         | Entities, value objects, business rules, repository ports (abstract classes), domain errors | Other `domain` code, `@while-building/shared` — no NestJS, ORM, JWT, Argon2 or HTTP |
| `application`    | One class per use case, ports for technical services, view models, application errors       | `domain`                                                                            |
| `infrastructure` | TypeORM models, repositories, mappers, Argon2, JWT                                          | `domain`, `application` (implements their ports)                                    |
| `presentation`   | Controllers, request/response DTOs, guards, decorators                                      | `application`, `domain`                                                             |

Bounded contexts depend in one direction: **auth → users, content**. `auth` finds and verifies users
through the users context's `UserRepository` and `PasswordHasher`; `users` never depends on `auth`
(its controllers only use auth's route-authorization decorators). These rules — plus "no circular
imports" and "shared/ doesn't depend on modules" — are checked by `src/architecture.spec.ts` on every
`pnpm test`.

Expected failures are `AppError`s (from `@while-building/shared`) with a transport-neutral `kind`;
the API's `AppErrorFilter` turns them into the usual `{ statusCode, message, error }` responses.

All business modules live here, in the API. The monorepo's `packages/` only provide technical
helpers (environment readers, PostgreSQL conventions, `AppError`), never business logic.

```text
src/
├── modules/
│   ├── auth/                        # sign-in, sessions, tokens, authorization policy
│   │   ├── domain/                  # RefreshSession, role → permission policy, RefreshSessionRepository
│   │   ├── application/             # Login, Logout, RefreshSession, GetCurrentUser, AuthenticateAccessToken; TokenService port
│   │   ├── infrastructure/          # TypeORM session repository + mapper, JwtTokenService
│   │   ├── presentation/            # AuthController, DTOs, AccessTokenGuard, PermissionsGuard, decorators, refresh cookie
│   │   └── auth.module.ts
│   ├── users/                       # accounts, roles, status, credentials
│   │   ├── domain/                  # User, Email, Role, UserStatus, UserPermission, UserRepository, errors
│   │   ├── application/             # List/Get/Create/Update/ChangeStatus/Delete user, BootstrapRootUser; PasswordHasher port
│   │   ├── infrastructure/          # TypeORM user repository + mapper, Argon2PasswordHasher
│   │   ├── presentation/            # UsersController, DTOs
│   │   └── users.module.ts
│   └── content/                     # articles (CMS writing + publishing, public reads) and projects (public reads); owns CONTENT_* permissions
├── shared/                          # AppErrorFilter (AppError → HTTP), pagination DTO, DTO transformers, escapeLike
├── config/                          # the API's environment schema and validation
├── database/                        # TypeORM config (entities, migrations), CLI data source, migrations, seeds
├── health/                          # GET /health (deliberately not layered)
├── app.module.ts
├── configure-app.ts                 # HTTP setup shared by main.ts and the e2e tests
├── swagger.ts                       # OpenAPI docs
└── main.ts
test/                                # e2e tests, setup, and in-memory fakes for unit tests
```

## Future roadmap

Planned, not implemented yet:

- Article revisions, scheduled publishing, tags; project management in the CMS; experiments
- Media storage
- Search, RSS and sitemap for the public site
- Analytics and comments
- Session management UI (list and revoke sessions), expired-session cleanup job
- Shared rate-limit storage for multiple API instances
- Kubernetes deployment
