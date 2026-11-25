---
name: noctowl-docker-health
description: Start Docker stack and verify all services healthy
---

# NoctOwl Docker Health Check

## Steps

1. Start the dev stack:

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build
```

2. Wait for health:

```bash
sleep 15
docker compose ps
```

3. Verify endpoints:

```bash
curl -f http://localhost:3000/health || echo "API FAILED"
curl -f http://localhost:8000/health || echo "AI FAILED"
```

## Success Criteria

- All services show `healthy` in `docker compose ps`.
- Both health endpoints return HTTP 200.
