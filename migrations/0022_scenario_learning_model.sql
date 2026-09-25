PRAGMA foreign_keys = ON;

-- Reusable, versioned teaching objects. A vocabulary entry remains the same
-- content record when it appears in several lessons or independent practice.
CREATE TABLE grammar_points (
  id TEXT PRIMARY KEY NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  pattern TEXT NOT NULL,
  explanation TEXT NOT NULL,
  usage_notes TEXT NOT NULL DEFAULT '',
  locale TEXT NOT NULL DEFAULT 'id' CHECK(locale IN ('id','en')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','needs_review','approved','rejected','retired')),
  source_id TEXT NOT NULL REFERENCES asset_sources(id),
  revision INTEGER NOT NULL DEFAULT 1 CHECK(revision > 0),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE dialogues (
  id TEXT PRIMARY KEY NOT NULL,
  unit_id TEXT NOT NULL REFERENCES curriculum_units(id) ON DELETE CASCADE,
  slug TEXT NOT NULL,
  title TEXT NOT NULL,
  objective TEXT NOT NULL,
  locale TEXT NOT NULL DEFAULT 'id' CHECK(locale IN ('id','en')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','needs_review','approved','rejected','retired')),
  source_id TEXT NOT NULL REFERENCES asset_sources(id),
  revision INTEGER NOT NULL DEFAULT 1 CHECK(revision > 0),
  UNIQUE(unit_id, slug)
);

CREATE TABLE dialogue_turns (
  id TEXT PRIMARY KEY NOT NULL,
  dialogue_id TEXT NOT NULL REFERENCES dialogues(id) ON DELETE CASCADE,
  ordinal INTEGER NOT NULL CHECK(ordinal >= 0),
  speaker_role TEXT NOT NULL CHECK(speaker_role IN ('A','B','narrator')),
  speaker_label TEXT NOT NULL,
  simplified_text TEXT NOT NULL,
  pinyin_json TEXT NOT NULL CHECK(json_valid(pinyin_json)),
  translation TEXT NOT NULL,
  reading_id TEXT REFERENCES readings(id) ON DELETE SET NULL,
  source_id TEXT NOT NULL REFERENCES asset_sources(id),
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','needs_review','approved','rejected','retired')),
  UNIQUE(dialogue_id, ordinal)
);

CREATE TABLE stories (
  id TEXT PRIMARY KEY NOT NULL,
  unit_id TEXT NOT NULL REFERENCES curriculum_units(id) ON DELETE CASCADE,
  slug TEXT NOT NULL,
  title TEXT NOT NULL,
  objective TEXT NOT NULL,
  locale TEXT NOT NULL DEFAULT 'id' CHECK(locale IN ('id','en')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','needs_review','approved','rejected','retired')),
  source_id TEXT NOT NULL REFERENCES asset_sources(id),
  revision INTEGER NOT NULL DEFAULT 1 CHECK(revision > 0),
  UNIQUE(unit_id, slug)
);

CREATE TABLE story_paragraphs (
  id TEXT PRIMARY KEY NOT NULL,
  story_id TEXT NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  ordinal INTEGER NOT NULL CHECK(ordinal >= 0),
  simplified_text TEXT NOT NULL,
  pinyin_json TEXT NOT NULL CHECK(json_valid(pinyin_json)),
  translation TEXT NOT NULL,
  source_id TEXT NOT NULL REFERENCES asset_sources(id),
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','needs_review','approved','rejected','retired')),
  UNIQUE(story_id, ordinal)
);

CREATE TABLE curriculum_activities (
  id TEXT PRIMARY KEY NOT NULL,
  unit_id TEXT NOT NULL REFERENCES curriculum_units(id) ON DELETE CASCADE,
  activity_kind TEXT NOT NULL CHECK(activity_kind IN ('vocabulary','grammar','dialogue','story','listening','speaking','reading','writing','comprehension','scenario_output','review')),
  title TEXT NOT NULL,
  objective TEXT NOT NULL,
  instructions TEXT NOT NULL,
  ordinal INTEGER NOT NULL CHECK(ordinal >= 0),
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','published','retired')),
  source_id TEXT NOT NULL REFERENCES asset_sources(id),
  revision INTEGER NOT NULL DEFAULT 1 CHECK(revision > 0),
  UNIQUE(unit_id, ordinal),
  UNIQUE(unit_id, id)
);
CREATE INDEX curriculum_activities_published_idx ON curriculum_activities(unit_id, status, ordinal);

-- Typed links keep lesson activity items attached to shared content records.
CREATE TABLE curriculum_activity_items (
  activity_id TEXT NOT NULL REFERENCES curriculum_activities(id) ON DELETE CASCADE,
  ordinal INTEGER NOT NULL CHECK(ordinal >= 0),
  placement_id TEXT REFERENCES curriculum_placements(id) ON DELETE CASCADE,
  grammar_point_id TEXT REFERENCES grammar_points(id) ON DELETE CASCADE,
  dialogue_turn_id TEXT REFERENCES dialogue_turns(id) ON DELETE CASCADE,
  story_paragraph_id TEXT REFERENCES story_paragraphs(id) ON DELETE CASCADE,
  example_id TEXT REFERENCES examples(id) ON DELETE CASCADE,
  reading_id TEXT REFERENCES readings(id) ON DELETE CASCADE,
  PRIMARY KEY(activity_id, ordinal),
  CHECK ((placement_id IS NOT NULL) + (grammar_point_id IS NOT NULL) + (dialogue_turn_id IS NOT NULL) +
         (story_paragraph_id IS NOT NULL) + (example_id IS NOT NULL) + (reading_id IS NOT NULL) = 1)
);

CREATE TABLE learner_activity_progress (
  user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  activity_id TEXT NOT NULL REFERENCES curriculum_activities(id) ON DELETE CASCADE,
  state TEXT NOT NULL DEFAULT 'not_started' CHECK(state IN ('not_started','in_progress','completed')),
  current_item_ordinal INTEGER NOT NULL DEFAULT 0 CHECK(current_item_ordinal >= 0),
  started_at TEXT,
  completed_at TEXT,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY(user_id, activity_id),
  CHECK ((state = 'completed' AND completed_at IS NOT NULL) OR state != 'completed')
);
CREATE INDEX learner_activity_progress_recent_idx ON learner_activity_progress(user_id, updated_at DESC);

ALTER TABLE learning_attempts RENAME TO learning_attempts_before_scenario_model;
CREATE TABLE learning_attempts (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  idempotency_key TEXT NOT NULL,
  content_type TEXT NOT NULL CHECK(content_type IN ('vocabulary','character')),
  content_id TEXT NOT NULL,
  reading_id TEXT REFERENCES readings(id) ON DELETE SET NULL,
  placement_id TEXT REFERENCES curriculum_placements(id) ON DELETE SET NULL,
  activity_id TEXT REFERENCES curriculum_activities(id) ON DELETE SET NULL,
  skill TEXT NOT NULL CHECK(skill IN ('listening','speaking','reading','writing','grammar','vocabulary','comprehension')),
  activity_mode TEXT NOT NULL CHECK(activity_mode IN ('listen','record_compare','meaning','guided_writing','freehand_writing')),
  dimensions_json TEXT NOT NULL CHECK(json_valid(dimensions_json)),
  engine_version TEXT,
  created_at_client TEXT NOT NULL,
  accepted_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  assessment_outcome TEXT NOT NULL DEFAULT 'not_assessed' CHECK(assessment_outcome IN ('passed','needs_practice','uncertain','not_assessed')),
  UNIQUE(user_id, idempotency_key)
);
INSERT INTO learning_attempts(id,user_id,idempotency_key,content_type,content_id,reading_id,placement_id,activity_id,skill,
  activity_mode,dimensions_json,engine_version,created_at_client,accepted_at,assessment_outcome)
SELECT id,user_id,idempotency_key,content_type,content_id,reading_id,placement_id,NULL,
  CASE WHEN activity_mode = 'listen' THEN 'listening'
    WHEN activity_mode IN ('guided_writing','freehand_writing') THEN 'writing'
    ELSE 'comprehension' END,
  activity_mode,dimensions_json,engine_version,created_at_client,accepted_at,assessment_outcome
FROM learning_attempts_before_scenario_model;
DROP TABLE learning_attempts_before_scenario_model;
CREATE INDEX learning_attempts_user_time_idx ON learning_attempts(user_id, accepted_at DESC);
CREATE INDEX learning_attempts_content_idx ON learning_attempts(user_id, content_type, content_id, accepted_at DESC);
CREATE INDEX learning_attempts_placement_idx ON learning_attempts(user_id, placement_id, accepted_at DESC);
CREATE INDEX learning_attempts_user_placement_time_idx ON learning_attempts(user_id, placement_id, accepted_at DESC);
CREATE INDEX learning_attempts_skill_recent_idx ON learning_attempts(user_id, skill, accepted_at DESC);

-- A learner may have a different schedule for the same word's listening,
-- meaning and writing skills, and for separate contextual readings.
CREATE TABLE skill_review_schedules (
  user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  content_type TEXT NOT NULL CHECK(content_type IN ('vocabulary','character')),
  content_id TEXT NOT NULL,
  reading_key TEXT NOT NULL DEFAULT '',
  reading_id TEXT REFERENCES readings(id) ON DELETE CASCADE,
  skill TEXT NOT NULL CHECK(skill IN ('listening','speaking','reading','writing','grammar','vocabulary','comprehension')),
  algorithm_id TEXT NOT NULL DEFAULT 'leitner-skill-v1',
  interval_days REAL NOT NULL DEFAULT 0 CHECK(interval_days >= 0),
  ease_factor REAL NOT NULL DEFAULT 2.5 CHECK(ease_factor >= 1.3),
  repetition INTEGER NOT NULL DEFAULT 0 CHECK(repetition >= 0),
  due_at TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY(user_id, content_type, content_id, reading_key, skill),
  CHECK ((reading_id IS NULL AND reading_key = '') OR (reading_id IS NOT NULL AND reading_key = reading_id))
);
CREATE INDEX skill_review_due_idx ON skill_review_schedules(user_id, due_at, skill);

CREATE TABLE learner_skill_progress (
  user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  content_type TEXT NOT NULL CHECK(content_type IN ('vocabulary','character')),
  content_id TEXT NOT NULL,
  reading_key TEXT NOT NULL DEFAULT '',
  reading_id TEXT REFERENCES readings(id) ON DELETE CASCADE,
  skill TEXT NOT NULL CHECK(skill IN ('listening','speaking','reading','writing','grammar','vocabulary','comprehension')),
  attempts_count INTEGER NOT NULL DEFAULT 0 CHECK(attempts_count >= 0),
  passed_count INTEGER NOT NULL DEFAULT 0 CHECK(passed_count >= 0),
  uncertain_count INTEGER NOT NULL DEFAULT 0 CHECK(uncertain_count >= 0),
  needs_practice_count INTEGER NOT NULL DEFAULT 0 CHECK(needs_practice_count >= 0),
  last_seen_at TEXT,
  dimensions_json TEXT NOT NULL DEFAULT '{}',
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY(user_id, content_type, content_id, reading_key, skill),
  CHECK ((reading_id IS NULL AND reading_key = '') OR (reading_id IS NOT NULL AND reading_key = reading_id))
);
CREATE INDEX learner_skill_progress_recent_idx ON learner_skill_progress(user_id, skill, last_seen_at DESC);

INSERT INTO learner_skill_progress(user_id, content_type, content_id, reading_key, reading_id, skill,
  attempts_count, passed_count, uncertain_count, needs_practice_count, last_seen_at, dimensions_json)
SELECT a.user_id, a.content_type, a.content_id, COALESCE(a.reading_id, ''), a.reading_id, a.skill,
  COUNT(*), SUM(CASE WHEN a.assessment_outcome = 'passed' THEN 1 ELSE 0 END),
  SUM(CASE WHEN a.assessment_outcome = 'uncertain' THEN 1 ELSE 0 END),
  SUM(CASE WHEN a.assessment_outcome = 'needs_practice' THEN 1 ELSE 0 END), MAX(a.accepted_at), '{}'
FROM learning_attempts a
GROUP BY a.user_id, a.content_type, a.content_id, COALESCE(a.reading_id, ''), a.reading_id, a.skill;

-- Preserve the current published unit flow as data, not a permanent hard-coded
-- four-step JSX sequence. New authored activity kinds can be inserted later.
INSERT INTO curriculum_activities(id, unit_id, activity_kind, title, objective, instructions, ordinal, status, source_id)
SELECT 'activity-' || u.id || '-vocabulary', u.id, 'vocabulary', 'Kenali kata',
  'Memahami kata inti dan cara membacanya.', 'Dengarkan rekaman yang tersedia, baca pinyin dan arti, lalu buka contoh penggunaan.', 0, 'published', s.id
FROM curriculum_units u JOIN curriculum_placements cp ON cp.unit_id = u.id
LEFT JOIN vocabulary_entries v ON v.id = cp.vocabulary_id
LEFT JOIN characters ch ON ch.id = cp.character_id
JOIN asset_sources s ON s.id = COALESCE(cp.source_id, v.source_id, ch.source_id)
WHERE u.status = 'published' GROUP BY u.id;

INSERT INTO curriculum_activities(id, unit_id, activity_kind, title, objective, instructions, ordinal, status, source_id)
SELECT 'activity-' || u.id || '-context', u.id, 'reading', 'Pahami contoh',
  'Melihat kata dipakai dalam kalimat.', 'Baca contoh Mandarin, pinyin dan terjemahan bahasa Indonesia.', 1, 'published', s.id
FROM curriculum_units u JOIN curriculum_placements cp ON cp.unit_id = u.id
LEFT JOIN vocabulary_entries v ON v.id = cp.vocabulary_id
LEFT JOIN characters ch ON ch.id = cp.character_id
JOIN asset_sources s ON s.id = COALESCE(cp.source_id, v.source_id, ch.source_id)
WHERE u.status = 'published' GROUP BY u.id;

INSERT INTO curriculum_activities(id, unit_id, activity_kind, title, objective, instructions, ordinal, status, source_id)
SELECT 'activity-' || u.id || '-writing', u.id, 'writing', 'Belajar menulis',
  'Mengenali bentuk dan urutan guratan.', 'Ikuti tutorial guratan. Latihan bentuk bebas tidak menggantikan pemeriksaan urutan.', 2, 'published', s.id
FROM curriculum_units u JOIN curriculum_placements cp ON cp.unit_id = u.id
LEFT JOIN vocabulary_entries v ON v.id = cp.vocabulary_id
LEFT JOIN characters ch ON ch.id = cp.character_id
JOIN asset_sources s ON s.id = COALESCE(cp.source_id, v.source_id, ch.source_id)
WHERE u.status = 'published' GROUP BY u.id;

INSERT INTO curriculum_activities(id, unit_id, activity_kind, title, objective, instructions, ordinal, status, source_id)
SELECT 'activity-' || u.id || '-recall', u.id, 'comprehension', 'Uji ingatan',
  'Mengingat kembali makna kata.', 'Pilih arti bahasa Indonesia. Materi yang perlu diulang akan masuk ke pusat ulasan.', 3, 'published', s.id
FROM curriculum_units u JOIN curriculum_placements cp ON cp.unit_id = u.id
LEFT JOIN vocabulary_entries v ON v.id = cp.vocabulary_id
LEFT JOIN characters ch ON ch.id = cp.character_id
JOIN asset_sources s ON s.id = COALESCE(cp.source_id, v.source_id, ch.source_id)
WHERE u.status = 'published' GROUP BY u.id;

INSERT INTO curriculum_activity_items(activity_id, ordinal, placement_id)
SELECT a.id, cp.ordinal, cp.id FROM curriculum_activities a JOIN curriculum_placements cp ON cp.unit_id = a.unit_id
WHERE a.activity_kind IN ('vocabulary','writing','comprehension');

INSERT INTO curriculum_activity_items(activity_id, ordinal, example_id)
SELECT a.id, ROW_NUMBER() OVER (PARTITION BY a.id ORDER BY e.id) - 1, e.id
FROM curriculum_activities a JOIN curriculum_placements cp ON cp.unit_id = a.unit_id
JOIN examples e ON e.vocabulary_id = cp.vocabulary_id AND e.status = 'approved' AND e.locale = 'id'
WHERE a.activity_kind = 'reading';

-- Migrate old per-content review dates into the new skill-aware schedule while
-- preserving learner dates. Learners can now review dimensions independently.
INSERT OR IGNORE INTO skill_review_schedules(user_id, content_type, content_id, reading_key, reading_id, skill, due_at)
SELECT rs.user_id, rs.content_type, rs.content_id, '', NULL,
  CASE WHEN rs.content_type = 'character' THEN 'writing' ELSE 'comprehension' END,
  rs.due_at FROM review_schedules rs;

INSERT OR IGNORE INTO skill_review_schedules(user_id, content_type, content_id, reading_key, reading_id, skill, due_at)
SELECT a.user_id, a.content_type, a.content_id, COALESCE(a.reading_id, ''), a.reading_id, a.skill,
  COALESCE(MAX(CASE WHEN rs.due_at IS NOT NULL THEN rs.due_at END), datetime(MAX(a.accepted_at), '+1 day'))
FROM learning_attempts a LEFT JOIN review_schedules rs
  ON rs.user_id = a.user_id AND rs.content_type = a.content_type AND rs.content_id = a.content_id
GROUP BY a.user_id, a.content_type, a.content_id, COALESCE(a.reading_id, ''), a.reading_id, a.skill;

PRAGMA foreign_keys = ON;
