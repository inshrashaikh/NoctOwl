export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS offline_queue (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  payload TEXT NOT NULL,
  occurred_at TEXT NOT NULL,
  synced INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_offline_queue_pending
  ON offline_queue (synced, occurred_at);

CREATE TABLE IF NOT EXISTS trip_locations (
  id TEXT PRIMARY KEY,
  trip_id TEXT NOT NULL,
  lat REAL NOT NULL,
  lon REAL NOT NULL,
  speed REAL,
  heading REAL,
  timestamp TEXT NOT NULL,
  synced INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_trip_locations_trip
  ON trip_locations (trip_id, timestamp);

CREATE TABLE IF NOT EXISTS auth (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`;
