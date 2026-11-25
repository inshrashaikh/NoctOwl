# Multi-Region Architecture Considerations

Design evaluation for expanding NoctOwl beyond a single cloud region. **No multi-region implementation is performed in M9.**

---

## 1. Drivers for Multi-Region Deployment

- **User Latency**: Reducing GPS breadcrumb ingestion and risk-check round trips for travelers across geographically distant continents.
- **Regional Disaster Recovery**: Surviving full cloud-region outages without extended downtime (`RTO < 15m`).
- **Compliance & Data Residency**: Keeping user location histories and emergency contacts inside jurisdictional borders (e.g., EU GDPR, India DPDP).

---

## 2. Component Requirements for Multi-Region NoctOwl

- **PostgreSQL + PostGIS**:
  - Cross-region read replicas (RDS Cross-Region Read Replicas / Cloud SQL) for read-heavy analytics & admin dashboards, or globally distributed SQL (Amazon Aurora Global Database / Cloud Spanner) if active-active writes are needed.
  - Note: Route `PrismaService` read traffic to regional replicas while keeping trip/location writes anchored or home-sharded by user region.
- **Redis & BullMQ**:
  - Cross-region active-active Redis replication creates split-brain risk for BullMQ emergency notification locks (`notify:<tripId>` deduplication keys).
  - **Recommended pattern**: Run independent regional Redis + BullMQ workers per region so emergency notifications are processed locally in the region handling the trip.
- **AI Risk Service (`apps/ai-service`)**:
  - Stateless FastAPI container — deploy identical replicas in every region alongside local `Valhalla` routing tiles.
- **Object Storage (`backups` / assets)**:
  - Enable S3 Cross-Region Replication (CRR) to mirror encrypted database dumps to a secondary region.
- **Global Traffic Routing**:
  - Use Route53 latency-based DNS routing or Cloudflare Load Balancing with `/health` origin probes and automatic regional failover.

---

## 3. Complexity & Cost Tradeoffs

- **Data Consistency**: Cross-region asynchronous replication introduces replication lag (`~100ms–2s`); trip start/emergency state transitions require careful write-locality or strong global consensus.
- **Infrastructure Cost**: Minimum **2x baseline compute/DB cost**, plus cross-region data transfer egress charges for database WAL shipping, S3 CRR, and centralized telemetry.
- **Operational Overhead**: Coordinated zero-downtime Prisma migrations across regions, federated Prometheus/Loki/Grafana observability, and distributed failover drills.

---

## 4. Phased Recommendation

1. **Stay Single-Region Now**: Maintain the current single-region architecture with verified daily backups and tested restore procedures (M8) **until** single-region `p95` latency exceeds **`200ms`** for target users or legal data residency requires regional isolation.
2. **Stage 1 — Read Replicas**: Add secondary-region PostgreSQL read replicas for analytics/reporting while keeping writes single-region.
3. **Stage 2 — Active-Passive Failover**: Stand up warm stateless API + AI + Web capacity in the backup region with automated DNS failover and S3-replicated backups.
4. **Stage 3 — Regional Cell / Active-Active**: Shard users by home region with local PostgreSQL, local Redis/BullMQ, and local AI/Valhalla stacks.
