# While Building — backend

Backend for **While Building** — _Things I build, things I learn, things I break._

A monorepo of NestJS applications and the technical packages they share, managed with pnpm
workspaces and Turborepo. It is not a microservice system: each app is an independent NestJS
application that can be built, run and later deployed (or split further) on its own.

## Layout

| Workspace            | Package                        | Port | Responsibility                                                                       |
| -------------------- | ------------------------------ | ---- | ------------------------------------------------------------------------------------ |
| `apps/api`           | `@while-building/api`          | 3000 | The business API: auth, users, (next) content. See [its README](apps/api/README.md). |
| `apps/notification`  | `@while-building/notification` | 3001 | Future notification delivery (email…). Application shell only (`GET /health`).       |
| `apps/webhook`       | `@while-building/webhook`      | 3002 | Future inbound webhooks from external providers. Application shell only.             |
| `apps/integration`   | `@while-building/integration`  | 3003 | Future third-party integrations (OAuth, external APIs). Application shell only.      |
| `packages/shared`    | `@while-building/shared`       | —    | Framework-free primitives (`AppError`).                                              |
| `packages/config`    | `@while-building/config`       | —    | Environment readers and validation helpers, duration parsing.                        |
| `packages/database`  | `@while-building/database`     | —    | `DATABASE_*` settings and PostgreSQL/TypeORM conventions.                            |
| `packages/messaging` | `@while-building/messaging`    | —    | Reserved for generic messaging infrastructure; empty until an app needs it.          |

`docker/docker-compose.yml` runs a local PostgreSQL; the apps themselves run on the host.

## Rules

- **Business logic lives in the app that owns it.** `auth`, `users` and `content` — with their
  entities, repositories, migrations and events — stay in `apps/api`.
- **Packages are technical only:** generic helpers any app could use. No business modules
  (`packages/users`, `packages/modules`, …), entities, repositories or business events.
- **Dependencies point one way: apps → packages.** Packages never depend on apps, and apps never
  import each other; when they need to talk, they will do it over an explicit boundary (HTTP,
  messages).

`pnpm lint` enforces the last rule with `turbo boundaries`: each workspace is tagged `app` or
`package` in its own `turbo.json`, nothing may depend on an `app`, and no file may reach into another
workspace by relative path or import a package it doesn't declare.

## Getting started

Requires Node.js 22.13+ or 24.11+, pnpm 12 and PostgreSQL 13+ (or Docker).

```bash
pnpm install
cp apps/api/.env.example apps/api/.env              # then set the JWT secrets and ROOT_* values
docker compose -f docker/docker-compose.yml up -d   # local PostgreSQL, if you don't have one
pnpm db:migrate                                     # create the API's schema
pnpm db:seed                                        # create the ROOT user
pnpm dev                                            # every app (or: pnpm dev:api)
```

Each app reads its own `apps/<app>/.env` (see its `.env.example`). The new apps need none: their
defaults are `NODE_ENV=development` and the ports above. Real environment variables override `.env`
values, also through Turborepo (`"envMode": "loose"` in `turbo.json` passes them to every task), e.g.
`DATABASE_NAME=other pnpm db:migrate`.

## Commands

```bash
pnpm dev              # every app in watch mode; editing a package restarts the apps that use it
pnpm dev:api          # one app (also dev:notification, dev:webhook, dev:integration)
pnpm build            # compile every package and app to its dist/
pnpm typecheck        # TypeScript, no emit
pnpm lint             # ESLint (type-checked) in every workspace, then turbo boundaries
pnpm test             # unit tests, plus the new apps' boot tests (no database needed)
pnpm test:e2e         # the API's e2e tests against PostgreSQL
pnpm format:check     # Prettier (pnpm format to fix)
pnpm db:migrate       # the API's database scripts: db:migrate, db:migrate:status,
                      # db:migrate:revert, db:migration:generate <path>, db:seed
```

To run a task for one workspace, filter it — Turborepo builds the packages it depends on first:

```bash
pnpm turbo run build --filter=@while-building/webhook
```

Plain pnpm filters (`pnpm --filter api build`, `pnpm --filter api start:prod`) run a workspace's own
script directly, so they need its packages built already (after any root command, or with
`pnpm --filter "api..." build`).

### How the packages are built

Apps run on plain Node.js, so each package compiles to `dist/` (JavaScript and type declarations)
and apps import that output. Turborepo builds packages before any task that needs them
(`"dependsOn": ["^build"]` in `turbo.json`). After a fresh clone, run one root command (e.g.
`pnpm build`) so your editor can resolve the `@while-building/*` imports.

Shared TypeScript options live in `tsconfig.base.json`, and one ESLint config
(`eslint.config.mjs`) and Prettier config cover every workspace.

## Adding an app or a package

1. Create `apps/<name>` (a NestJS app) or `packages/<name>` with a `package.json` named
   `@while-building/<name>`, a `tsconfig.json` extending `../../tsconfig.base.json`, and `build`,
   `typecheck`, `lint` and `test` scripts (apps also `dev`).
2. Tag it in its own `turbo.json` (`"tags": ["app"]` or `["package"]`) and list it in the root
   `tsconfig.json` references.
3. Depend on packages with `"@while-building/<package>": "workspace:*"` — never on an app.
