---
description: Run full verification (tests + Docker health)
agent: build
---

# Verify NoctOwl

Run the complete verification suite:

1. Use skill `noctowl-docker-health` to start and verify the Docker stack.
2. Use skill `noctowl-test-suite` to run all tests.
3. Report results in a table:

| Check | Status |
|---|---|
| Docker stack | ✅/❌ |
| API unit | ✅/❌ |
| API E2E | ✅/❌ |
| Web tests | ✅/❌ |
| AI tests | ✅/❌ |
| Mobile tests | ✅/❌ |

If any check fails, do NOT proceed. Report the failure and suggest fixes.
