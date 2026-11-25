# NoctOwl Project Instructions

NoctOwl is a safety-oriented night-travel companion platform. The repository is a monorepo containing a NestJS API, Next.js web app, FastAPI AI service, and Expo/React Native mobile app, backed by Docker Compose infrastructure.

OpenCode reads this file automatically at the start of every session. Follow these rules when working in this repository.

## Project Overview

- **Product:** NoctOwl — safety-oriented night-travel companion platform.
- **Architecture:** Offline-first mobile client, real-time trip tracking, geofenced safe zones, AI risk scoring, and admin/operations tooling.
- **Monorepo services:**
  - `apps/api/` — NestJS backend, Prisma ORM.
  - `apps/web/` — Next.js 15 App Router web app.
  - `apps/ai-service/` — FastAPI risk engine.
  - `apps/mobile/` — React Native app built with Expo.
- **Infrastructure:** Docker Compose, PostgreSQL + PostGIS, Redis, Valhalla, MinIO, observability and backup tooling.

## Project Structure

- `apps/api/` — NestJS backend with Prisma ORM and modules for auth, users, trips, tracking, realtime, routing, ai, notifications, geofencing, maps, sync, and admin.
- `apps/web/` — Next.js 15 App Router app using shadcn/ui, TanStack Query, and Recharts.
- `apps/ai-service/` — FastAPI risk engine with pytest-based tests.
- `apps/mobile/` — Expo/React Native app with SQLite offline queueing and MapLibre.
- `infrastructure/` — Dockerfiles, observability configs, backup scripts, and deployment support files.
- `tests/load/` — k6 load tests.

## Code Standards

### TypeScript / NestJS

- Use TypeScript strict mode. Do not introduce `any` types.
- Document exceptions only when unavoidable, such as generated Prisma internals, third-party modules without complete typings, or explicitly justified test fixtures.
- API DTOs must use `class-validator` decorators.
- Services should inject `PrismaService` rather than constructing database clients directly.
- Protect authenticated routes with the appropriate NestJS guards.
- Keep route-specific validation in DTOs, not ad hoc controller checks.

### Prisma

- Create schema changes with `npx prisma migrate dev`.
- Never edit migration files after they have been generated or applied.
- If a correction is needed, create a new migration.

### Tests and Coverage

- API: Jest unit and e2e tests. Coverage threshold: **≥80%**.
- Web: Jest and TypeScript checks. Coverage threshold: **≥60%** for hooks/lib code.
- Mobile: Jest and TypeScript checks. Coverage threshold: **≥70%** for db/sync/location code.
- AI service: pytest.

### Python

- Add type hints to all functions.
- Never use bare `except`; catch specific exceptions.

## Testing Commands

```bash
# API
cd apps/api && npm test && USE_REAL_REDIS=true npm run test:e2e

# Web
cd apps/web && npm test && npx tsc --noEmit

# AI Service
cd apps/ai-service && pytest

# Mobile
cd apps/mobile && npm test && npx tsc --noEmit

# Backup restore verification
./infrastructure/scripts/test-restore.sh
```

## Formatting & Diagnostics

### Formatters (automatic)

OpenCode runs these formatters automatically after `write`, `edit`, or `patch` tools change files:

- **TypeScript/JavaScript/JSON/Markdown**: `prettier --write`
- **Python**: `ruff format`
- **Prisma**: `prisma format`

Do NOT run formatters manually — OpenCode handles them. Formatter executables still need to be available (`prettier`, `ruff`). Prisma formatting uses the API workspace's Prisma 7 CLI via `npm --prefix apps/api exec -- prisma format`; root-level `npx prisma` resolves to an incompatible newer major.

### Type Checking (manual, run when needed)

```bash
# API (NestJS)
cd apps/api && npx tsc --noEmit

# Web (Next.js)
cd apps/web && npx tsc --noEmit

# Mobile (React Native)
cd apps/mobile && npx tsc --noEmit

# AI Service (Python)
cd apps/ai-service && pyright app/
```

### LSP Note

`opencode.json` keeps the LSP block with `deno` disabled because this project uses Node/npm; the object form preserves the V1-style `eslint`, `prisma`, and `pyright` enablement. OpenCode v2 accepts and preserves LSP configuration but does not run language servers, expose LSP tools, or produce LSP diagnostics. `opencode debug lsp` is unavailable in v2. Treat any editor/LSP feedback as supplementary. Always run the typecheck commands above before committing — they are the authoritative source.

## Docker Commands

```bash
# Start dev stack
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build

# Start prod stack
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d

# Check health
docker compose ps
```

The dev override is required for local API access from the host/physical devices. The base compose file keeps the API on an internal network.

## Git Conventions

- Use conventional commits:
  - `feat(module):`
  - `fix(module):`
  - `test(module):`
  - `chore(module):`
- Never commit directly to `main`; CI/CD deploys from `main`.
- Run the full test suite before committing.

## Critical Rules

- **NEVER hardcode secrets.** Use gitignored `.env` files and keep templates in `.env.example`.
- **NEVER modify Prisma migration files** after they have been applied. Create a new migration instead.
- **NEVER expose OTP values in API responses** in production mode.
- FCM service account JSON belongs in the `FCM_SERVICE_ACCOUNT_JSON` environment variable only.
- AI service URL comes from `AI_SERVICE_URL`, defaulting to `http://ai-service:8000`.

## Knowledge Base (MCP, optional)

Cross-session project memory can be provided by `lancedb-mcp`. It requires an OpenAI-compatible embedding endpoint; for local development use Ollama with `ollama pull nomic-embed-text`. This integration is currently optional and is not enabled in environments where Ollama is unavailable, so `kb_*` tools may not exist.

When the knowledge base MCP server is configured:

- Use `kb_add` whenever you discover a project convention, decision, or fix that should be remembered across sessions.
  - `text`: the fact/decision, e.g. `"Migrations must use Prisma, never manual SQL"`.
  - `source`: `"convention"`, `"decision"`, or `"bugfix"`.
- Before starting a complex task, search the knowledge base with `kb_search` to recall relevant context.

Examples:

```text
kb_search({ query: "backup restore procedure" })
kb_add({ text: "FCM failures mark notification FAILED with reason 'FCM not configured' rather than crashing", source: "decision" })
```

## Tool Compatibility

This project is configured for both Antigravity (primary IDE agent) and OpenCode (terminal/CI agent).

### Shared Resources
- `AGENTS.md` — Read by both. No YAML frontmatter (Antigravity requirement).
- `.opencode/skills/` — OpenCode skills (primary source)
- `.agents/skills/` — Symlinked/copied for Antigravity compatibility

### Tool-Specific
- **OpenCode**: `opencode.json` configures formatters, LSP, permissions, MCP
- **Antigravity**: Reads `AGENTS.md` and `.agents/skills/` only; ignores `opencode.json`

### When to update skills
1. Edit skill in `.opencode/skills/<name>/SKILL.md`
2. Run sync script (or manual copy) to `.agents/skills/<name>/`
3. Both tools now see the update

## Custom Tools & Hooks

### Available Tools
- `noctowl_test(suite, e2e?)` — Run test suites by name (`api | web | ai | mobile | all`). Use instead of manual `cd apps/api && npm test`.
- `noctowl_migration_check()` — Check pending Prisma migration for destructive patterns (`DROP`, `TRUNCATE`, `ALTER COLUMN ... TYPE`) before applying.

### Safety Hooks (automatic)
- **Applied migration protection:** Editing `prisma/migrations/*/migration.sql` after first migration is blocked. Create a new migration instead.
- **Secret protection:** Writing real secrets (not placeholders) to `.env` is blocked. Use `.env.example`.

### When to use
- Before `prisma migrate dev`, run `noctowl_migration_check` to preview destructive changes.
- Use `noctowl_test` instead of raw bash for consistent test execution.

## Cross-Tool Sync (Antigravity + OpenCode)

When adding new customizations to OpenCode:

1. **Skills:** Add to `.opencode/skills/<name>/SKILL.md`, then copy to `.agents/skills/<name>/` (or run `infrastructure/scripts/sync-agents.sh`).
2. **Agents:** Add to `.opencode/agents/<name>.md`, then create a simplified `.agents/agents/<name>.md` (strip `model` and `permissions` fields, keep `description` and `mode`).
3. **MCP:** Update `opencode.json` MCP config, then mirror to `.agents/mcp_config.json`.
4. **Safety rules:** TypeScript plugin hooks (OpenCode) don't run in Antigravity. Document critical rules as `.agents/rules/*.md` with `trigger: model_decision`.

**Antigravity does NOT read `.opencode/`.** All Antigravity customizations must live in `.agents/` or `~/.gemini/config/`.

## Advanced Commands (OpenCode)

These commands use shell output injection (`!command`) and file references (`@file`):

- `/status` — Live project health (git, Docker, migrations, tests)
- `/trip-debug <tripId>` — Query trip data from DB and analyze
- `/review-file <path>` — Review a specific file with git history
- `/pr-ready` — Pre-PR checklist with test/typecheck/migration status

**Antigravity equivalent:** Use `project-status` skill for `/status` behavior. Other commands are OpenCode-specific due to shell injection.
