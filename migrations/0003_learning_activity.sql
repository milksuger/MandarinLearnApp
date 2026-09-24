PRAGMA foreign_keys = ON;

CREATE TABLE learning_attempts (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  idempotency_key TEXT NOT NULL,
  content_type TEXT NOT NULL CHECK(content_type IN ('vocabulary','character')),
  content_id TEXT NOT NULL,
  reading_id TEXT REFERENCES readings(id) ON DELETE SET NULL,
  placement_id TEXT REFERENCES curriculum_placements(id) ON DELETE SET NULL,
  activity_mode TEXT NOT NULL CHECK(activity_mode IN ('listen','meaning','guided_writing','freehand_writing')),
  dimensions_json TEXT NOT NULL,
  engine_version TEXT,
  created_at_client TEXT NOT NULL,
  accepted_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE(user_id, idempotency_key)
);
CREATE INDEX learning_attempts_user_time_idx ON learning_attempts(user_id, accepted_at DESC);
CREATE INDEX learning_attempts_content_idx ON learning_attempts(user_id, content_type, content_id, accepted_at DESC);
CREATE INDEX learning_attempts_placement_idx ON learning_attempts(user_id, placement_id, accepted_at DESC);

CREATE TABLE learner_progress (
  user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  content_type TEXT NOT NULL CHECK(content_type IN ('vocabulary','character')),
  content_id TEXT NOT NULL,
  attempts_count INTEGER NOT NULL DEFAULT 0,
  correct_count INTEGER NOT NULL DEFAULT 0,
  last_seen_at TEXT,
  next_review_at TEXT,
  dimension_summary_json TEXT NOT NULL DEFAULT '{}',
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY(user_id, content_type, content_id)
);
CREATE INDEX learner_progress_due_idx ON learner_progress(user_id, next_review_at);

CREATE TABLE review_schedules (
  user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  content_type TEXT NOT NULL CHECK(content_type IN ('vocabulary','character')),
  content_id TEXT NOT NULL,
  algorithm_id TEXT NOT NULL DEFAULT 'leitner-v1',
  interval_days REAL NOT NULL DEFAULT 0,
  ease_factor REAL NOT NULL DEFAULT 2.5,
  repetition INTEGER NOT NULL DEFAULT 0,
  due_at TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY(user_id, content_type, content_id)
);
CREATE INDEX review_schedules_due_idx ON review_schedules(user_id, due_at);

CREATE TABLE sync_receipts (
  user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  idempotency_key TEXT NOT NULL,
  accepted_at TEXT NOT NULL,
  PRIMARY KEY(user_id, idempotency_key)
);
