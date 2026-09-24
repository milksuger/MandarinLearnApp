-- Only learner-confirmed recognition output is retained. Raw pen coordinates stay on-device.
CREATE TABLE freehand_recognition_events (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  idempotency_key TEXT NOT NULL,
  hanzi TEXT NOT NULL CHECK(length(hanzi) = 1),
  unicode_code_point TEXT NOT NULL,
  engine_id TEXT NOT NULL,
  engine_version TEXT NOT NULL,
  candidate_rank INTEGER NOT NULL CHECK(candidate_rank BETWEEN 1 AND 8),
  occurred_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE(user_id, idempotency_key)
);
CREATE INDEX freehand_events_user_time_idx ON freehand_recognition_events(user_id, occurred_at DESC);
