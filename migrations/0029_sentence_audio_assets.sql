PRAGMA foreign_keys = ON;

-- Sentence recordings are reusable media assets. Keep them separate from
-- vocabulary/character readings and attach them through typed foreign keys.
CREATE TABLE content_audio_assets (
  id TEXT PRIMARY KEY NOT NULL CHECK(id GLOB 'snt-*'),
  source_id TEXT NOT NULL REFERENCES asset_sources(id),
  storage_key TEXT NOT NULL,
  sha256 TEXT NOT NULL,
  original_sha256 TEXT,
  format TEXT NOT NULL CHECK(format IN ('audio/mpeg','audio/ogg','audio/wav','audio/mp4')),
  size_bytes INTEGER NOT NULL CHECK(size_bytes > 0),
  duration_ms INTEGER NOT NULL CHECK(duration_ms > 0),
  speaker_id TEXT,
  dialect TEXT NOT NULL DEFAULT 'zh-CN',
  recording_context TEXT NOT NULL,
  source_page_url TEXT NOT NULL,
  source_attested_at TEXT,
  source_attestation_method TEXT,
  derivative_notes TEXT,
  pronunciation_review TEXT NOT NULL DEFAULT 'pending' CHECK(pronunciation_review IN ('pending','passed','failed')),
  reviewer_user_id TEXT REFERENCES user(id) ON DELETE SET NULL,
  reviewed_at TEXT,
  status TEXT NOT NULL DEFAULT 'candidate' CHECK(status IN ('candidate','approved','rejected','retired')),
  replaces_asset_id TEXT REFERENCES content_audio_assets(id),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX content_audio_assets_status_idx ON content_audio_assets(status, pronunciation_review);

CREATE TABLE example_audio_links (
  example_id TEXT NOT NULL REFERENCES examples(id) ON DELETE CASCADE,
  asset_id TEXT NOT NULL REFERENCES content_audio_assets(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'primary' CHECK(role IN ('primary','slow','alternate')),
  ordinal INTEGER NOT NULL DEFAULT 0 CHECK(ordinal >= 0),
  PRIMARY KEY(example_id, asset_id, role),
  UNIQUE(example_id, role, ordinal)
);
CREATE TABLE dialogue_turn_audio_links (
  dialogue_turn_id TEXT NOT NULL REFERENCES dialogue_turns(id) ON DELETE CASCADE,
  asset_id TEXT NOT NULL REFERENCES content_audio_assets(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'primary' CHECK(role IN ('primary','slow','alternate')),
  ordinal INTEGER NOT NULL DEFAULT 0 CHECK(ordinal >= 0),
  PRIMARY KEY(dialogue_turn_id, asset_id, role),
  UNIQUE(dialogue_turn_id, role, ordinal)
);
CREATE TABLE story_paragraph_audio_links (
  story_paragraph_id TEXT NOT NULL REFERENCES story_paragraphs(id) ON DELETE CASCADE,
  asset_id TEXT NOT NULL REFERENCES content_audio_assets(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'primary' CHECK(role IN ('primary','slow','alternate')),
  ordinal INTEGER NOT NULL DEFAULT 0 CHECK(ordinal >= 0),
  PRIMARY KEY(story_paragraph_id, asset_id, role),
  UNIQUE(story_paragraph_id, role, ordinal)
);

CREATE INDEX example_audio_links_target_idx ON example_audio_links(example_id, role, ordinal);
CREATE INDEX dialogue_audio_links_target_idx ON dialogue_turn_audio_links(dialogue_turn_id, role, ordinal);
CREATE INDEX story_audio_links_target_idx ON story_paragraph_audio_links(story_paragraph_id, role, ordinal);
