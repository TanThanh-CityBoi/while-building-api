# While Building MCP server

`apps/mcp` exposes While Building's **published content** to AI agents through the
[Model Context Protocol](https://modelcontextprotocol.io): read-only tools and resources over the
articles and projects of [`apps/api`](../api/README.md).

It is an interface layer, not a second domain layer. It has no database and no business rules:
every answer comes from the API's public content routes over HTTP (apps never import each other), so
visibility (published only), search and ordering are decided by the API alone. Nothing here can
change data.

## Endpoint

`POST /mcp` — [Streamable HTTP](https://modelcontextprotocol.io/specification/2026-07-28), built with
the MCP TypeScript SDK v2 (`@modelcontextprotocol/server` + `@modelcontextprotocol/node`).

- **Stateless:** every request gets a fresh server, so 2025-era session operations (`GET` / `DELETE
/mcp`) answer `405`. Both 2026-07-28 and 2025 clients are served.
- **JSON responses:** no tool streams progress, so results are plain JSON bodies.
- **Internal only (V1):** no authentication. The server binds to `127.0.0.1` by default and accepts
  only the `Host` / `Origin` hostnames in `MCP_ALLOWED_HOSTS` (DNS rebinding protection). Expose it
  only on a private network.

`GET /health` answers `{ "status": "ok" }`.

## Tools

All tools are annotated `readOnlyHint: true`, reject unknown arguments, and return
`structuredContent` (also serialised as JSON text). Every item carries the `uri` of its resource.

| Tool              | Input                                                       | Output                                   |
| ----------------- | ----------------------------------------------------------- | ---------------------------------------- |
| `search_articles` | `query?`, `category?`, `limit` (1–20, default 5)            | `{ articles: ArticleSummary[], total }`  |
| `get_article`     | `slug`                                                      | `{ article: ArticleSummary & { body } }` |
| `search_projects` | `query?`, `technology?`, `featured?`, `limit` (1–20, def 5) | `{ projects: Project[], total }`         |
| `get_project`     | `slug`                                                      | `{ project: Project }`                   |

`ArticleSummary` = `{ slug, title, description, category, publishedAt, readingTimeMinutes, uri }`;
`Project` = `{ slug, name, description, technologies, stage, featured, links, uri }`. Fields are an
explicit whitelist (`src/mcp/content.mappers.ts`): ids and timestamps are left out.

Errors are tool results with `isError: true`, so a model can react to them: invalid input ("Input
validation error…", without calling the API), an unknown or unpublished slug ("No published article
with slug …"), or a generic "temporarily unavailable" when the API can't be reached (details are only
logged). An empty search is a normal result with an empty list.

## Resources

| URI template       | Content                                                                                    |
| ------------------ | ------------------------------------------------------------------------------------------ |
| `article://{slug}` | Markdown: front matter (title, description, category, published date, reading time) + body |
| `project://{slug}` | Markdown: name, description, stage, featured, technologies, links                          |

`resources/list` advertises the 50 latest published articles and projects. Unknown, unpublished or
malformed URIs answer the SDK's resource-not-found error (`-32602` with `data.uri`).

## Environment

The app reads `apps/mcp/.env` (see [`.env.example`](.env.example)); real environment variables win.

| Variable            | Required | Default                     | Description                                                       |
| ------------------- | -------- | --------------------------- | ----------------------------------------------------------------- |
| `API_URL`           | yes      | —                           | Base URL of the While Building API, e.g. `http://localhost:3000`. |
| `API_TIMEOUT`       | no       | `5s`                        | Timeout of each API request.                                      |
| `PORT`              | no       | `3005`                      | HTTP port.                                                        |
| `MCP_HOST`          | no       | `127.0.0.1`                 | Interface to bind to.                                             |
| `MCP_ALLOWED_HOSTS` | no       | `localhost,127.0.0.1,[::1]` | Accepted `Host` / `Origin` hostnames, comma-separated.            |
| `NODE_ENV`          | no       | `development`               | `development`, `production` or `test`.                            |

## Development

```bash
pnpm dev:api                                   # the API must be running (with content: pnpm db:seed:content)
pnpm dev:mcp                                   # http://127.0.0.1:3005/mcp
npx @modelcontextprotocol/inspector --cli http://localhost:3005/mcp --transport http --method tools/list
npx @modelcontextprotocol/inspector --cli http://localhost:3005/mcp --transport http \
  --method tools/call --tool-name search_articles --tool-arg query=kubernetes
```

`pnpm turbo run test --filter=@while-building/mcp` runs the tests without the API: tools and
resources through a real MCP client over an in-memory transport, the HTTP endpoint (handshake, `405`,
host checks) and the API client, all against a fake `ContentApi`.

```text
src/
├── content-api/   # ContentApi port (DI token) + HttpContentApi (fetch to the API), wire types
├── mcp/
│   ├── tools/        # search/get tools, result helpers (ok / fail / runTool)
│   ├── resources/    # article:// and project:// templates, Markdown rendering
│   ├── content.mappers.ts   # field whitelist + output schemas + resource URIs
│   ├── mcp-server.factory.ts
│   └── mcp.controller.ts    # /mcp: host/origin checks → createMcpHandler (stateless, JSON)
├── config/        # environment validation
└── health/
```
