---
description: Show live project health (git status, Docker state, test summary)
agent: build
---

# NoctOwl Project Status

## Git Status
!`git status --short`

## Current Branch
!`git branch --show-current`

## Docker Services
!`docker compose ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}" 2>/dev/null || echo "Docker not running"`

## Recent Commits
!`git log --oneline -5`

## Pending Migrations
!`cd apps/api && npx prisma migrate status 2>&1 | tail -5`

Based on the above, summarize:
1. Any uncommitted changes that need attention
2. Docker services that are not healthy
3. Pending database migrations
4. Recommended next action
