# OpenCode CI Setup

Headless OpenCode runs in GitHub Actions for pull-request review and manual test generation.

## Required GitHub Secret

- `OPENROUTER_API_KEY` — OpenRouter API key for model access.

Add it under **Settings → Secrets and variables → Actions → New repository secret**.

## Workflows

1. **`.github/workflows/opencode-review.yml`** — runs on every PR to `main` or `develop` when the PR is opened or synchronized. It reviews the diff, posts a summary comment, and does **not** block the PR initially.
2. **`.github/workflows/opencode-tests.yml`** — manual `workflow_dispatch` trigger. Provide `target_path`, generate tests, and download `generated-tests.md` as an artifact for review before committing.

## CI Image

`infrastructure/opencode/Dockerfile` builds `noctowl/opencode-ci` from `oven/bun:1` and installs the pinned OpenCode v2 CLI:

```bash
docker build -t noctowl/opencode-ci -f infrastructure/opencode/Dockerfile .
```

The image runs as UID 1000 and uses `opencode` as its entrypoint.

## Cost Control

- Review workflow runs on PR open/sync only.
- Test generation is manual only.
- `continue-on-error: true` on the review step prevents CI failures from LLM issues.
- Model: `claude-sonnet-4-20250514` via OpenRouter (balanced cost/quality).

## When to Enable Blocking

After 2 weeks of stable reviews with no false positives, set `continue-on-error: false` in `opencode-review.yml`.

## Notes

- The CLI uses `--auto` in headless mode so non-denied permissions are approved automatically; explicit deny rules still apply.
- The knowledge-base MCP server remains optional and is not configured in CI.
