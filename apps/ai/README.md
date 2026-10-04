# While Building AI app

`apps/ai` is the backend of the **While Building assistant**: the CMS's chat page sends the
conversation to `POST /chat`, and an agent answers it with an LLM — Anthropic (Claude), OpenAI or
Google Gemini, as the user chooses — looking things up with the read-only tools of the
[MCP server](../mcp/README.md). The answer streams back as server-sent events.

```text
CMS ── POST /chat (Bearer access token) ──► apps/ai ── GET /auth/me ──► apps/api
                 ◄── text/event-stream ──     │
                                              ├─ AgentService (tool loop)
                                              ├─ LlmRegistry ─┬─ AnthropicLlmProvider ──► Anthropic API
                                              │               ├─ OpenAILlmProvider ────► OpenAI API
                                              │               └─ GeminiLlmProvider ────► Gemini API
                                              └─ McpGateway  ◄─ McpClientService ──► apps/mcp ──► apps/api
```

- **No business logic here.** Content comes from the MCP server (which reads the API); who the user
  is comes from the API. The app only orchestrates.
- **LLM credentials stay here.** `ANTHROPIC_API_KEY`, `OPENAI_API_KEY` and `GEMINI_API_KEY` are
  separate, server-side only, and each is read only by its own adapter; the browser never sees them.
- **Provider-neutral agent.** `AgentService` only knows the `LlmProvider` port
  (`src/llm/llm-provider.ts`), reached through `LlmRegistry`, and `McpGateway`. Provider-specific
  code lives in `src/llm/anthropic/`, `src/llm/openai/` and `src/llm/gemini/`.
- **The server owns providers and models.** `src/llm/model-catalog.ts` lists what is supported;
  the environment enables providers and chooses models among them; `GET /models` tells the CMS what
  to offer, and `POST /chat` validates every choice.

## POST /chat

Requires `Authorization: Bearer <access token>` — the CMS's in-memory access token from the API.
Every request is checked by the API (`GET /auth/me`), so logout and role changes apply at once; the
user needs `CONTENT_READ` (every role has it). No cookies: CORS allows `CORS_ORIGIN` without credentials.

Body: `{ "messages": [{ "role": "user" | "assistant", "content": "…" }], "provider"?: "…", "model"?: "…" }`
— the conversation so far, oldest first, starting and ending with a user message. Up to 20 messages,
8 000 characters each, 32 000 in total. Earlier turns are replayed as plain text (nothing is stored
server-side), so each question may go to a different provider or model.

`provider` and `model` are optional: without them the answer uses `AI_DEFAULT_PROVIDER` and its
first model. They must be one of the enabled providers and one of its models, as listed by
`GET /models`; anything else is a `400`.

Errors **before** the stream starts are the usual JSON `{ statusCode, message, error }`:

| Status | When                                                                                                        |
| ------ | ----------------------------------------------------------------------------------------------------------- |
| `400`  | Invalid body (unknown fields, limits, conversation not ending with the user, unavailable provider or model) |
| `401`  | Missing, invalid or expired token                                                                           |
| `403`  | No `CONTENT_READ` permission                                                                                |
| `429`  | More than `AI_RATE_LIMIT` requests per user in `AI_RATE_LIMIT_WINDOW`                                       |
| `503`  | The API can't be reached to check the token                                                                 |

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

## GET /models

Same authentication as `/chat` (no rate limit). Returns what the CMS may offer — only enabled
providers and their allowed models, the first model of each being its default:

```json
{
  "data": {
    "defaultProvider": "anthropic",
    "providers": [
      {
        "id": "anthropic",
        "label": "Anthropic",
        "defaultModel": "claude-opus-5-5",
        "models": [
          { "id": "claude-opus-5-5", "label": "Claude Opus 5.5" },
          { "id": "claude-sonnet-5-5", "label": "Claude Sonnet 5.5" }
        ]
      },
      {
        "id": "openai",
        "label": "OpenAI",
        "defaultModel": "gpt-5.5",
        "models": [
          { "id": "gpt-5.5", "label": "GPT-5.5" },
          { "id": "gpt-5.4-mini", "label": "GPT-5.4 mini" }
        ]
      },
      {
        "id": "gemini",
        "label": "Google Gemini",
        "defaultModel": "gemini-pro-latest",
        "models": [
          { "id": "gemini-pro-latest", "label": "Gemini Pro (latest)" },
          { "id": "gemini-flash-latest", "label": "Gemini Flash (latest)" },
          { "id": "gemini-3.8-flash", "label": "Gemini 3.8 Flash" }
        ]
      }
    ]
  }
}
```

## Providers and models

`src/llm/model-catalog.ts` is the list of supported providers and models (a model is listed once its
request shape is known to work with the adapter):

| Provider    | Models (catalog order)                                         | Adapter                                         |
| ----------- | -------------------------------------------------------------- | ----------------------------------------------- |
| `anthropic` | `claude-opus-5-5`, `claude-sonnet-5-5`                         | Messages API (`src/llm/anthropic/`)             |
| `openai`    | `gpt-5.5`, `gpt-5.4-mini`                                      | Responses API (`src/llm/openai/`)               |
| `gemini`    | `gemini-pro-latest`, `gemini-flash-latest`, `gemini-3.8-flash` | Gemini API, `@google/genai` (`src/llm/gemini/`) |

`AI_PROVIDERS` enables providers (default: `anthropic` only), `AI_DEFAULT_PROVIDER` picks the
default, and `AI_<PROVIDER>_MODELS` offers a subset of a provider's catalog models (all of them by
default; the first is the default). Unknown providers or models fail at startup. `gemini-pro-latest`
and `gemini-flash-latest` are Google's aliases for its latest Pro and Flash models and move with
Google's releases; `gemini-3.8-flash` is a pinned, numbered model.

- **Adding a model:** one line in the catalog.
- **Adding a provider:** a catalog entry, an adapter implementing `LlmProvider` under
  `src/llm/<provider>/`, a factory in `LlmModule` (`PROVIDER_FACTORIES`) and its API key in
  `src/config/env.validation.ts`.

## How an answer is made

1. Connect to the MCP server and list its tools (one connection per request; if the server is down
   the model answers without tools and says it can't look things up).
2. Stream a model turn. If it asks for tools, run them **in parallel** through MCP, send all results
   back in one message (tool errors included, so the model can recover), and repeat.
3. After `AI_MAX_TOOL_ROUNDS` rounds the model must answer with what it has (`tool_choice: none`).
4. Send the sources found in the tools' structured results, then `done`.

All adapters stream, call the MCP tools in parallel, never force a tool call, end refusals with a
`refused` error and map their SDK's typed errors to `LlmError` (`unavailable`, `rate_limited`,
`rejected`):

- **Anthropic** — Messages API with adaptive thinking and `output_config.effort` (`AI_EFFORT`),
  server-side `fallbacks: "default"` (a turn a safety classifier declines is retried on Anthropic's
  recommended model in the same call) and prompt caching of the stable prefix.
- **OpenAI** — Responses API with `store: false` (OpenAI keeps no copy of the conversation); for
  reasoning models the encrypted reasoning items are requested and echoed back within an answer,
  and `AI_OPENAI_REASONING_EFFORT` sets `reasoning.effort` when given. Tool errors go back as output
  prefixed `Error:` (the API has no error flag).
- **Gemini** — `generateContentStream` with function declarations (the MCP JSON Schemas as
  `parametersJsonSchema`) and function calling `AUTO` / `NONE`. The model's parts are echoed back as
  received within an answer, so thinking models get their thought signatures back with their
  function calls; function responses carry the function name (and Gemini's call id when it gives
  one) and Gemini's native `error` field for tool errors. `AI_GEMINI_THINKING_LEVEL` sets
  `thinkingConfig.thinkingLevel` when given; safety stops and blocked prompts end as refusals.

Logs record the user id, provider/model, rounds, tool calls, token usage and duration — never
message contents or keys.

## Environment

The app reads `apps/ai/.env` (see [`.env.example`](.env.example)); real environment variables win.

| Variable                     | Required    | Default            | Description                                                                                               |
| ---------------------------- | ----------- | ------------------ | --------------------------------------------------------------------------------------------------------- |
| `CORS_ORIGIN`                | yes         | —                  | Browser origins allowed to call `/chat` (the CMS).                                                        |
| `API_URL`                    | yes         | —                  | The While Building API (`GET /auth/me`).                                                                  |
| `MCP_URL`                    | yes         | —                  | The MCP endpoint, e.g. `http://127.0.0.1:3005/mcp`.                                                       |
| `AI_PROVIDERS`               | no          | `anthropic`        | Enabled providers: `anthropic`, `openai`, `gemini` (comma-separated).                                     |
| `AI_DEFAULT_PROVIDER`        | no          | first enabled      | Used when a request names no provider.                                                                    |
| `AI_ANTHROPIC_MODELS`        | no          | all catalog models | Offered Anthropic models; the first is the default. Replaces the former `AI_MODEL`.                       |
| `AI_OPENAI_MODELS`           | no          | all catalog models | Offered OpenAI models; the first is the default.                                                          |
| `AI_GEMINI_MODELS`           | no          | all catalog models | Offered Gemini models; the first is the default.                                                          |
| `ANTHROPIC_API_KEY`          | production¹ | —                  | In development the SDK also accepts `ANTHROPIC_AUTH_TOKEN` or an `ant auth login` profile.                |
| `OPENAI_API_KEY`             | if enabled  | —                  | Required whenever `openai` is in `AI_PROVIDERS`.                                                          |
| `GEMINI_API_KEY`             | if enabled  | —                  | Required whenever `gemini` is in `AI_PROVIDERS`.                                                          |
| `AI_EFFORT`                  | no          | `medium`           | Anthropic effort: `low`, `medium`, `high`, `xhigh` or `max`.                                              |
| `AI_OPENAI_REASONING_EFFORT` | no          | model default      | OpenAI `reasoning.effort`: `none`, `minimal`, `low`, `medium`, `high`, `xhigh` (support varies by model). |
| `AI_GEMINI_THINKING_LEVEL`   | no          | model default      | Gemini thinking level: `minimal`, `low`, `medium`, `high` (support varies by model).                      |
| `AI_MAX_OUTPUT_TOKENS`       | no          | `64000`            | Per model turn.                                                                                           |
| `AI_MAX_TOOL_ROUNDS`         | no          | `5`                | Tool rounds per answer.                                                                                   |
| `AI_REQUEST_TIMEOUT`         | no          | `90s`              | Total time for one answer.                                                                                |
| `AI_TOOL_TIMEOUT`            | no          | `10s`              | Each MCP call (connect, list, tool call).                                                                 |
| `AI_RATE_LIMIT`              | no          | `20`               | Chat requests per user per window.                                                                        |
| `AI_RATE_LIMIT_WINDOW`       | no          | `10m`              | Rate-limit window.                                                                                        |
| `PORT`                       | no          | `3004`             | HTTP port.                                                                                                |
| `TRUST_PROXY`                | no          | —                  | Express `trust proxy` behind a reverse proxy.                                                             |
| `NODE_ENV`                   | no          | `development`      | ¹ `production` requires `ANTHROPIC_API_KEY` when `anthropic` is enabled.                                  |

## Development

```bash
pnpm dev:api        # the API (with content: pnpm db:seed:content)
pnpm dev:mcp        # the MCP server
pnpm dev:ai         # http://localhost:3004 (needs the enabled providers' keys in apps/ai/.env)
curl -H "Authorization: Bearer $ACCESS_TOKEN" http://localhost:3004/models
curl -N -X POST http://localhost:3004/chat \
  -H "Authorization: Bearer $ACCESS_TOKEN" -H 'Content-Type: application/json' \
  -d '{"messages":[{"role":"user","content":"Which articles are about Kubernetes?"}],"provider":"openai","model":"gpt-5.5"}'
```

`pnpm turbo run test --filter=@while-building/ai` needs no external service: the agent runs against a
scripted fake LLM and fake MCP tools, the three adapters against canned streamed responses (through
their SDKs' `fetch` option), the MCP client against an in-process MCP server, and `/chat` end to end with
fakes for the API, the LLM and MCP. Tests never read
`apps/ai/.env` (with `NODE_ENV=test` the app ignores the file), so local keys and provider choices
can't change their outcome.

```text
src/
├── chat/         # POST /chat (DTO, SSE writer, controller: auth, per-user rate limit), GET /models
├── agent/        # AgentService (tool loop), system prompt, event types, sources
├── llm/          # LlmProvider port + neutral types, model catalog, LlmRegistry; anthropic/, openai/, gemini/ adapters
├── mcp-client/   # McpGateway port + McpClientService (Streamable HTTP)
├── auth/         # ApiAuthGuard + AuthApi (GET /auth/me)
├── config/       # environment validation
└── health/
```
