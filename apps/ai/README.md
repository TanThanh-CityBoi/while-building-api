# While Building AI app

`apps/ai` is the backend of the **While Building assistant**: the CMS's chat page sends the
conversation to `POST /chat`, and an agent answers it with an LLM, looking things up with the
read-only tools of the [MCP server](../mcp/README.md). The answer streams back as server-sent events.

```text
CMS ── POST /chat (Bearer access token) ──► apps/ai ── GET /auth/me ──► apps/api
                 ◄── text/event-stream ──     │
                                              ├─ AgentService (tool loop)
                                              ├─ LlmProvider ◄─ AnthropicLlmProvider ──► Anthropic API
                                              └─ McpGateway  ◄─ McpClientService ──► apps/mcp ──► apps/api
```

- **No business logic here.** Content comes from the MCP server (which reads the API); who the user
  is comes from the API. The app only orchestrates.
- **LLM credentials stay here.** `ANTHROPIC_API_KEY` is server-side only; the browser never sees it.
- **Provider-neutral agent.** `AgentService` only knows `LlmProvider` (`src/llm/llm-provider.ts`)
  and `McpGateway`. Anthropic-specific code lives in `src/llm/anthropic/`; another provider is a new
  adapter plus a change in `LlmModule`.

## POST /chat

Requires `Authorization: Bearer <access token>` — the CMS's in-memory access token from the API.
Every request is checked by the API (`GET /auth/me`), so logout and role changes apply at once; the
user needs `CONTENT_READ` (every role has it). No cookies: CORS allows `CORS_ORIGIN` without credentials.

Body: `{ "messages": [{ "role": "user" | "assistant", "content": "…" }] }` — the conversation so
far, oldest first, starting and ending with a user message. Up to 20 messages, 8 000 characters each,
32 000 in total. Earlier turns are replayed as plain text; nothing is stored server-side.

Errors **before** the stream starts are the usual JSON `{ statusCode, message, error }`:

| Status | When                                                                         |
| ------ | ---------------------------------------------------------------------------- |
| `400`  | Invalid body (unknown fields, limits, conversation not ending with the user) |
| `401`  | Missing, invalid or expired token                                            |
| `403`  | No `CONTENT_READ` permission                                                 |
| `429`  | More than `AI_RATE_LIMIT` requests per user in `AI_RATE_LIMIT_WINDOW`        |
| `503`  | The API can't be reached to check the token                                  |

Otherwise the response is `200 text/event-stream`: one event per object, with `event:` set to its
`type` and the object as JSON `data:`; `: ping` comments keep idle connections open. Every stream ends
with exactly one `done` or `error`.

| Event     | Data                                                                                        |
| --------- | ------------------------------------------------------------------------------------------- |
| `status`  | `{ phase: "thinking" }`, `{ phase: "tool_start", tool }`, `{ phase: "tool_end", tool, ok }` |
| `text`    | `{ delta }` — the next piece of the answer                                                  |
| `sources` | `{ sources: [{ kind: "article" \| "project", slug, title, uri }] }` — what the tools found  |
| `done`    | `{}` — the answer is complete                                                               |
| `error`   | `{ code, message }` — `message` is safe to show; codes below                                |

Error codes: `unavailable` (LLM down or misconfigured), `rate_limited` (LLM busy), `refused` (the
model declined), `timeout` (over `AI_REQUEST_TIMEOUT`), `internal`. Details are only logged.

Closing the connection (the CMS's stop button) cancels the answer on the server: the LLM stream and
any tool calls are aborted.

## How an answer is made

1. Connect to the MCP server and list its tools (one connection per request; if the server is down
   the model answers without tools and says it can't look things up).
2. Stream a model turn. If it asks for tools, run them **in parallel** through MCP, send all results
   back in one message (tool errors included, so the model can recover), and repeat.
3. After `AI_MAX_TOOL_ROUNDS` rounds the model must answer with what it has (`tool_choice: none`).
4. Send the sources found in the tools' structured results, then `done`.

The Anthropic adapter uses the Messages API with streaming, adaptive thinking and `output_config.effort`,
server-side `fallbacks: "default"` (a turn a safety classifier declines is retried on Anthropic's
recommended model in the same call), prompt caching of the stable prefix, and never forces a tool
call. Refusals end the answer with a `refused` error. Typed SDK errors map to `LlmError`
(`unavailable`, `rate_limited`, `rejected`).

Logs record the user id, rounds, tool calls, token usage and duration — never message contents or keys.

## Environment

The app reads `apps/ai/.env` (see [`.env.example`](.env.example)); real environment variables win.

| Variable               | Required   | Default           | Description                                                                                           |
| ---------------------- | ---------- | ----------------- | ----------------------------------------------------------------------------------------------------- |
| `CORS_ORIGIN`          | yes        | —                 | Browser origins allowed to call `/chat` (the CMS).                                                    |
| `API_URL`              | yes        | —                 | The While Building API (`GET /auth/me`).                                                              |
| `MCP_URL`              | yes        | —                 | The MCP endpoint, e.g. `http://127.0.0.1:3005/mcp`.                                                   |
| `ANTHROPIC_API_KEY`    | production | —                 | In development the SDK also accepts `ANTHROPIC_AUTH_TOKEN` or an `ant auth login` profile.            |
| `AI_MODEL`             | no         | `claude-opus-5-5` | A current model with adaptive thinking and server-side fallbacks (e.g. `claude-sonnet-5-5`, cheaper). |
| `AI_EFFORT`            | no         | `medium`          | `low`, `medium`, `high`, `xhigh` or `max`.                                                            |
| `AI_MAX_OUTPUT_TOKENS` | no         | `64000`           | Per model turn.                                                                                       |
| `AI_MAX_TOOL_ROUNDS`   | no         | `5`               | Tool rounds per answer.                                                                               |
| `AI_REQUEST_TIMEOUT`   | no         | `90s`             | Total time for one answer.                                                                            |
| `AI_TOOL_TIMEOUT`      | no         | `10s`             | Each MCP call (connect, list, tool call).                                                             |
| `AI_RATE_LIMIT`        | no         | `20`              | Chat requests per user per window.                                                                    |
| `AI_RATE_LIMIT_WINDOW` | no         | `10m`             | Rate-limit window.                                                                                    |
| `PORT`                 | no         | `3004`            | HTTP port.                                                                                            |
| `TRUST_PROXY`          | no         | —                 | Express `trust proxy` behind a reverse proxy.                                                         |
| `NODE_ENV`             | no         | `development`     | `production` requires `ANTHROPIC_API_KEY`.                                                            |

## Development

```bash
pnpm dev:api        # the API (with content: pnpm db:seed:content)
pnpm dev:mcp        # the MCP server
pnpm dev:ai         # http://localhost:3004 (needs ANTHROPIC_API_KEY in apps/ai/.env)
curl -N -X POST http://localhost:3004/chat \
  -H "Authorization: Bearer $ACCESS_TOKEN" -H 'Content-Type: application/json' \
  -d '{"messages":[{"role":"user","content":"Which articles are about Kubernetes?"}]}'
```

`pnpm turbo run test --filter=@while-building/ai` needs no external service: the agent runs against a
scripted fake LLM and fake MCP tools, the Anthropic adapter against canned SSE responses (through the
SDK's `fetch` option), the MCP client against an in-process MCP server, and `/chat` end to end with
fakes for the API, the LLM and MCP.

```text
src/
├── chat/         # POST /chat: DTO, SSE writer, controller (guards: auth, then per-user rate limit)
├── agent/        # AgentService (tool loop), system prompt, event types, sources
├── llm/          # LlmProvider port + provider-neutral types; anthropic/ adapter
├── mcp-client/   # McpGateway port + McpClientService (Streamable HTTP)
├── auth/         # ApiAuthGuard + AuthApi (GET /auth/me)
├── config/       # environment validation
└── health/
```
