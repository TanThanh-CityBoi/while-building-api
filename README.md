# while-building-api

Backend API for **While Building** — _Things I build, things I learn, things I break._

## Project Overview

This repository contains only the backend. The React/Vite frontend lives in a
separate repository, [`while-building-web`](https://github.com/TanThanh-CityBoi/while-building-web),
and talks to this API over HTTP.

The API will eventually serve articles, projects, experiments and other site
features. For now it is intentionally minimal: it boots, validates its
configuration, connects to PostgreSQL, exposes a health check and allows CORS
requests from the configured frontend origin(s). It is a plain Node.js process
with no provider-specific code, so it can run on Render, in Docker, on
Kubernetes/k3s or on any other Node.js host.

## Tech Stack

- [NestJS](https://nestjs.com/) 12 (ESM) with the Express platform
- TypeScript 6 (strict mode)
- PostgreSQL 18, accessed through [TypeORM](https://typeorm.io/) (`@nestjs/typeorm`)
- `@nestjs/config` for environment configuration
- REST
- pnpm
- ESLint (flat config, `typescript-eslint` type-checked rules) + Prettier
- Vitest + Supertest for unit and e2e tests

## Requirements

- Node.js `^22.13.0` or `>=24.11.0`
- pnpm 12 (the exact version is pinned in `package.json` → `packageManager`; `corepack enable` will pick it up)
- Docker with Docker Compose, for the local PostgreSQL container

## Environment Setup

Copy the example file and adjust it if needed:

```bash
cp .env.example .env
```

`.env` is git-ignored — never commit real credentials. In production, set the
same variables through your hosting provider instead of a `.env` file.

| Variable            | Required | Default | Description                                                                                     |
| ------------------- | -------- | ------- | ----------------------------------------------------------------------------------------------- |
| `PORT`              | no       | `3000`  | HTTP port the API listens on.                                                                   |
| `DATABASE_HOST`     | yes      | —       | PostgreSQL host.                                                                                |
| `DATABASE_PORT`     | no       | `5432`  | PostgreSQL port.                                                                                |
| `DATABASE_USER`     | yes      | —       | PostgreSQL user.                                                                                |
| `DATABASE_PASSWORD` | no       | empty   | PostgreSQL password.                                                                            |
| `DATABASE_NAME`     | yes      | —       | PostgreSQL database name.                                                                       |
| `CORS_ORIGIN`       | yes      | —       | Allowed browser origin(s), comma-separated, e.g. `https://example.com,https://www.example.com`. |

Variables are validated at startup (`src/config/env.validation.ts`); the app
refuses to start and lists every problem if something is missing or malformed.
`CORS_ORIGIN` entries must be bare origins — scheme, host and optional port,
with no path or trailing slash — because browsers match them exactly.

## PostgreSQL

Start a local PostgreSQL 18 container with a persistent volume:

```bash
docker compose -f docker/docker-compose.yml up -d
```

The container's defaults match `.env.example` (`postgres` / `postgres`,
database `while_building`, port `5432`). If you change any `DATABASE_*` value in
`.env` — for example to use port `5433` because another PostgreSQL already
listens on `5432` — pass the same file to Compose so both sides agree:

```bash
docker compose --env-file .env -f docker/docker-compose.yml up -d
```

Other useful commands:

```bash
docker compose -f docker/docker-compose.yml ps        # status / health
docker compose -f docker/docker-compose.yml down      # stop, keep data
docker compose -f docker/docker-compose.yml down -v   # stop and delete data
```

Data lives in the `while-building-api_postgres-data` volume and survives
container restarts. No tables are created yet; the schema will be managed with
migrations in a later phase.

## Installation

```bash
pnpm install
```

## Development

```bash
cp .env.example .env                                # first time only
docker compose -f docker/docker-compose.yml up -d   # start PostgreSQL
pnpm install
pnpm start:dev                                      # http://localhost:3000, restarts on change
```

Quality checks:

```bash
pnpm typecheck      # TypeScript, no emit
pnpm lint           # ESLint
pnpm format:check   # Prettier (pnpm format to fix)
pnpm test           # unit tests
pnpm test:e2e       # boots the full app; needs PostgreSQL running and .env configured
```

## API

### `GET /health`

Checks that the API is up and that PostgreSQL answers a `SELECT 1`.
Suitable for load balancer and Kubernetes readiness/liveness probes.

```bash
curl http://localhost:3000/health
```

`200 OK`

```json
{ "status": "ok", "database": "up" }
```

`503 Service Unavailable` when the database cannot be reached:

```json
{ "status": "error", "database": "down" }
```

## Build

```bash
pnpm build        # compiles src/ to dist/
pnpm start:prod   # runs node dist/main
```

The production process only needs `dist/`, production dependencies
(`pnpm install --prod`) and the environment variables above. It listens on
`PORT` on all interfaces and shuts down cleanly on `SIGTERM`.

## Project Structure

```text
src/
├── config/             # environment variable validation and types
├── database/           # TypeORM / PostgreSQL connection module
├── modules/            # feature modules
│   └── health/         # GET /health
├── app.module.ts       # root module wiring config, database and features
├── configure-app.ts    # app-level HTTP setup (CORS, shutdown hooks) shared with e2e tests
└── main.ts             # entry point
test/                   # end-to-end tests against a running database
docker/
└── docker-compose.yml  # local PostgreSQL
```

Unit tests sit next to the code they test (`*.spec.ts`); e2e tests live in
`test/` (`*.e2e-spec.ts`). New features go in `src/modules/<feature>/`, each as
its own small Nest module; shared cross-cutting code can go in `src/common/`
once there is some.

## Future Roadmap

Planned, not implemented yet:

- Articles API
- Projects API
- Experiments API
- Markdown/MDX integration
- Authentication
- Admin
- Search
- Analytics
- Comments
- RSS
- Sitemap
- Kubernetes deployment
