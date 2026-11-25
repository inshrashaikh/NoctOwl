---
description: Check if current changes are ready for a PR
agent: build
---

# PR Readiness Check

## Uncommitted Changes
!`git diff --stat`

## Test Status (API)
!`cd apps/api && npm test 2>&1 | tail -20`

## Test Status (Web)
!`cd apps/web && npm test 2>&1 | tail -20`

## TypeScript Check
!`cd apps/api && npx tsc --noEmit 2>&1 | head -20`

## Migration Check
!`cd apps/api && npx prisma migrate status 2>&1 | tail -5`

## Security Quick Scan
!`grep -r "password\s*=\s*['\"][^'\"]*['\"]" apps/api/src --include="*.ts" | head -5 || echo "No hardcoded passwords found"`

Evaluate readiness:
- [ ] All tests pass
- [ ] No TypeScript errors
- [ ] No pending migrations
- [ ] No hardcoded secrets in code
- [ ] Changes are focused (not sprawling)

Report: READY or NOT READY with reasons.
