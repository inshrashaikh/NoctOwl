---
name: noctowl-release
description: Prepare a release — run full test suite, verify Docker, generate changelog
---

# NoctOwl Release Preparation

## Steps

1. Run full verification:

```bash
cd apps/api && npm test && USE_REAL_REDIS=true npm run test:e2e
cd apps/web && npm test && npx tsc --noEmit
cd apps/ai-service && pytest
cd apps/mobile && npm test && npx tsc --noEmit
```

2. Verify Docker stack health:

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build
docker compose ps
```

3. Verify backup restore:

```bash
./infrastructure/scripts/test-restore.sh
```

4. Generate changelog from git log since last tag:

```bash
git log $(git describe --tags --abbrev=0)..HEAD --oneline --no-merges
```

5. Create release notes in `docs/releases/vX.Y.Z.md` with:

- Summary
- Breaking changes
- Features
- Bug fixes

## Success Criteria

All tests pass, Docker healthy, restore test PASSED, changelog generated.
