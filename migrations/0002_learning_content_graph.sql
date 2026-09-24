PRAGMA foreign_keys = ON;

-- All externally supplied learning material must retain source, license, version,
-- checksum and an editorial review state. Original app-written items are marked too.
CREATE TABLE asset_sources (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  version TEXT NOT NULL,
  source_url TEXT,
  license_id TEXT NOT NULL,
  license_url TEXT,
  attribution TEXT NOT NULL,
  checksum TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE(name, version)
);

CREATE TABLE vocabulary_entries (
  id TEXT PRIMARY KEY NOT NULL,
  simplified_form TEXT NOT NULL,
  part_of_speech TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','needs_review','approved','rejected','retired')),
  source_id TEXT NOT NULL REFERENCES asset_sources(id),
  revision INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX vocabulary_form_idx ON vocabulary_entries(simplified_form);
CREATE INDEX vocabulary_status_idx ON vocabulary_entries(status, simplified_form);

CREATE TABLE characters (
  id TEXT PRIMARY KEY NOT NULL,
  hanzi TEXT NOT NULL UNIQUE,
  unicode_code_point TEXT NOT NULL UNIQUE,
  stroke_count INTEGER NOT NULL CHECK(stroke_count > 0),
  radical TEXT,
  stroke_data_source_id TEXT REFERENCES asset_sources(id),
  stroke_data_storage_key TEXT,
  stroke_data_checksum TEXT,
  stroke_data_version TEXT,
  stroke_data_license_id TEXT,
  stroke_data_status TEXT NOT NULL DEFAULT 'unavailable' CHECK(stroke_data_status IN ('unavailable','candidate','approved','rejected')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','needs_review','approved','rejected','retired')),
  source_id TEXT NOT NULL REFERENCES asset_sources(id),
  revision INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX characters_status_idx ON characters(status, hanzi);

CREATE TABLE readings (
  id TEXT PRIMARY KEY NOT NULL,
  character_id TEXT REFERENCES characters(id) ON DELETE CASCADE,
  vocabulary_id TEXT REFERENCES vocabulary_entries(id) ON DELETE CASCADE,
  context_label TEXT NOT NULL,
  pinyin_json TEXT NOT NULL,
  numbered_pinyin TEXT NOT NULL,
  sandhi_json TEXT NOT NULL DEFAULT '[]',
  ipa TEXT,
  source_id TEXT NOT NULL REFERENCES asset_sources(id),
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','needs_review','approved','rejected','retired')),
  revision INTEGER NOT NULL DEFAULT 1,
  CHECK ((character_id IS NOT NULL) OR (vocabulary_id IS NOT NULL))
);
CREATE INDEX readings_character_idx ON readings(character_id, status);
CREATE INDEX readings_vocabulary_idx ON readings(vocabulary_id, status);

CREATE TABLE glosses (
  id TEXT PRIMARY KEY NOT NULL,
  locale TEXT NOT NULL CHECK(locale IN ('id','en')),
  text TEXT NOT NULL,
  usage_label TEXT,
  source_id TEXT NOT NULL REFERENCES asset_sources(id),
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','needs_review','approved','rejected','retired')),
  revision INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE character_glosses (
  character_id TEXT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  gloss_id TEXT NOT NULL REFERENCES glosses(id) ON DELETE CASCADE,
  PRIMARY KEY(character_id, gloss_id)
);
CREATE TABLE vocabulary_glosses (
  vocabulary_id TEXT NOT NULL REFERENCES vocabulary_entries(id) ON DELETE CASCADE,
  gloss_id TEXT NOT NULL REFERENCES glosses(id) ON DELETE CASCADE,
  PRIMARY KEY(vocabulary_id, gloss_id)
);
CREATE TABLE vocabulary_characters (
  vocabulary_id TEXT NOT NULL REFERENCES vocabulary_entries(id) ON DELETE CASCADE,
  character_id TEXT NOT NULL REFERENCES characters(id) ON DELETE RESTRICT,
  position INTEGER NOT NULL CHECK(position >= 0),
  PRIMARY KEY(vocabulary_id, character_id),
  UNIQUE(vocabulary_id, position)
);

CREATE TABLE examples (
  id TEXT PRIMARY KEY NOT NULL,
  vocabulary_id TEXT REFERENCES vocabulary_entries(id) ON DELETE CASCADE,
  character_id TEXT REFERENCES characters(id) ON DELETE CASCADE,
  simplified_text TEXT NOT NULL,
  pinyin_json TEXT NOT NULL,
  numbered_pinyin TEXT NOT NULL,
  locale TEXT NOT NULL DEFAULT 'id' CHECK(locale IN ('id','en')),
  translation TEXT NOT NULL,
  source_id TEXT NOT NULL REFERENCES asset_sources(id),
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','needs_review','approved','rejected','retired')),
  revision INTEGER NOT NULL DEFAULT 1,
  CHECK ((vocabulary_id IS NOT NULL) OR (character_id IS NOT NULL))
);

CREATE TABLE curricula (
  id TEXT PRIMARY KEY NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  locale TEXT NOT NULL DEFAULT 'id',
  curriculum_kind TEXT NOT NULL CHECK(curriculum_kind IN ('daily_life','hsk')),
  version TEXT NOT NULL,
  external_source_id TEXT REFERENCES asset_sources(id),
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','published','retired')),
  description TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE TABLE curriculum_units (
  id TEXT PRIMARY KEY NOT NULL,
  curriculum_id TEXT NOT NULL REFERENCES curricula(id) ON DELETE CASCADE,
  parent_id TEXT REFERENCES curriculum_units(id) ON DELETE CASCADE,
  slug TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  ordinal INTEGER NOT NULL CHECK(ordinal >= 0),
  level_number INTEGER,
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','published','retired')),
  UNIQUE(curriculum_id, slug),
  UNIQUE(curriculum_id, ordinal)
);
CREATE INDEX curriculum_units_parent_idx ON curriculum_units(parent_id, ordinal);
CREATE TABLE curriculum_placements (
  id TEXT PRIMARY KEY NOT NULL,
  unit_id TEXT NOT NULL REFERENCES curriculum_units(id) ON DELETE CASCADE,
  vocabulary_id TEXT REFERENCES vocabulary_entries(id) ON DELETE CASCADE,
  character_id TEXT REFERENCES characters(id) ON DELETE CASCADE,
  ordinal INTEGER NOT NULL CHECK(ordinal >= 0),
  learning_objective TEXT,
  source_id TEXT REFERENCES asset_sources(id),
  CHECK ((vocabulary_id IS NOT NULL) <> (character_id IS NOT NULL)),
  UNIQUE(unit_id, ordinal)
);
CREATE INDEX curriculum_placements_word_idx ON curriculum_placements(vocabulary_id);
CREATE INDEX curriculum_placements_char_idx ON curriculum_placements(character_id);

CREATE TABLE audio_assets (
  id TEXT PRIMARY KEY NOT NULL,
  reading_id TEXT NOT NULL REFERENCES readings(id) ON DELETE CASCADE,
  source_id TEXT NOT NULL REFERENCES asset_sources(id),
  storage_key TEXT NOT NULL,
  sha256 TEXT NOT NULL,
  format TEXT NOT NULL,
  size_bytes INTEGER NOT NULL CHECK(size_bytes > 0),
  duration_ms INTEGER NOT NULL CHECK(duration_ms > 0),
  speaker_id TEXT,
  dialect TEXT NOT NULL DEFAULT 'zh-CN',
  recording_context TEXT NOT NULL,
  pronunciation_review TEXT NOT NULL DEFAULT 'pending' CHECK(pronunciation_review IN ('pending','passed','failed')),
  reviewer_user_id TEXT REFERENCES user(id) ON DELETE SET NULL,
  reviewed_at TEXT,
  status TEXT NOT NULL DEFAULT 'candidate' CHECK(status IN ('candidate','approved','rejected','retired')),
  replaces_asset_id TEXT REFERENCES audio_assets(id),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX audio_assets_approved_idx ON audio_assets(reading_id, status, pronunciation_review);

-- Safe structural curriculum skeleton only. No borrowed HSK word list is bundled.
INSERT INTO curricula(id,slug,name,curriculum_kind,version,status,description)
VALUES
 ('curriculum-daily-life','daily-life','Belajar dari keseharian','daily_life','1.0-draft','draft','Editorially authored daily-life path; units must pass content review before publication.'),
 ('curriculum-hsk-3','hsk-3','HSK 3.0','hsk','2021-draft','draft','Nine-level structural outline only; official lists and placements are not bundled without redistribution permission.');

INSERT INTO curriculum_units(id,curriculum_id,slug,title,ordinal,status)
VALUES
 ('unit-daily-greetings','curriculum-daily-life','greetings','Salam & Perkenalan',0,'draft'),
 ('unit-daily-home','curriculum-daily-life','home','Rumah & Keluarga',1,'draft'),
 ('unit-daily-food','curriculum-daily-life','food','Makanan & Minuman',2,'draft'),
 ('unit-daily-movement','curriculum-daily-life','getting-around','Bepergian',3,'draft');

WITH RECURSIVE levels(level) AS (SELECT 1 UNION ALL SELECT level + 1 FROM levels WHERE level < 9)
INSERT INTO curriculum_units(id,curriculum_id,slug,title,ordinal,level_number,status)
SELECT 'unit-hsk-' || level,'curriculum-hsk-3','level-' || level,'HSK Tingkat ' || level,level - 1,level,'draft' FROM levels;
