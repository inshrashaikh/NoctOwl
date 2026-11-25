---
name: noctowl-test-suite
description: Run full NoctOwl test suite across all services
---

# NoctOwl Test Suite

Run all tests to verify the project is healthy before any commit.

## Steps

1. Backend unit tests:

```bash
cd apps/api && npm test
```

2. Backend E2E tests (requires running PostgreSQL + Redis):

```bash
cd apps/api && USE_REAL_REDIS=true npm run test:e2e
```

3. Web tests:

```bash
cd apps/web && npm test && npx tsc --noEmit
```

4. AI service tests:

```bash
cd apps/ai-service && pytest
```

5. Mobile tests:

```bash
cd apps/mobile && npm test && npx tsc --noEmit
```

## Success Criteria

- All tests pass (exit code 0).
- No TypeScript errors.
- Coverage thresholds are met: API ≥80%, Web ≥60%, Mobile ≥70%.
