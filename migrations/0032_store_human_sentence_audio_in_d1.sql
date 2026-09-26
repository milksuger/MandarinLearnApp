PRAGMA foreign_keys = ON;

-- Keep the small human sentence clips on the same free-tier D1 database as
-- their consent, provenance, checksums, and review state. The size ceiling
-- stays below D1's per-row limit; long-form media needs a separate storage plan.
CREATE TABLE sentence_audio_media (
  asset_id TEXT PRIMARY KEY NOT NULL REFERENCES content_audio_assets(id) ON DELETE CASCADE,
  storage_key TEXT NOT NULL UNIQUE,
  sha256 TEXT NOT NULL,
  media_bytes BLOB NOT NULL CHECK (length(media_bytes) BETWEEN 44 AND 1500000),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
