---
description: Debug a trip by ID (locations, risk, notifications)
agent: build
---

# Trip Debug: $1

## Trip Data
Query the database for trip $1:
!`cd apps/api && npx prisma db execute --stdin <<< "SELECT id, status, \"startTime\", \"endTime\" FROM \"Trip\" WHERE id = '$1';" 2>/dev/null || echo "Query failed"`

## Recent Locations
!`cd apps/api && npx prisma db execute --stdin <<< "SELECT lat, lon, speed, timestamp FROM \"TripLocation\" WHERE \"tripId\" = '$1' ORDER BY timestamp DESC LIMIT 10;" 2>/dev/null`

## Risk Assessments
!`cd apps/api && npx prisma db execute --stdin <<< "SELECT \"riskScore\", \"assessedAt\" FROM \"RiskAssessment\" WHERE \"tripId\" = '$1' ORDER BY \"assessedAt\" DESC LIMIT 5;" 2>/dev/null`

## Notifications
!`cd apps/api && npx prisma db execute --stdin <<< "SELECT type, status, \"createdAt\" FROM \"Notification\" WHERE \"tripId\" = '$1' ORDER BY \"createdAt\" DESC LIMIT 10;" 2>/dev/null`

Analyze the trip data above. Report:
1. Trip status and duration
2. Location trail anomalies (gaps, speed spikes)
3. Risk score trend
4. Notification delivery issues
5. Suggested fixes
