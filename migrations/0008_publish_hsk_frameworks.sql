PRAGMA foreign_keys = ON;

-- Record the official framework page as a reference only. The published HSK
-- word lists and syllabus text are not copied into this project.
INSERT OR IGNORE INTO asset_sources(
  id,name,version,source_url,license_id,license_url,attribution,checksum,notes,
  license_verification,verification_method,verified_at
) VALUES (
  'source-hsk-framework-reference',
  'Chinese Tests Service Website HSK framework reference',
  '2026-09',
  NULL,
  'Reference-only structural facts; no syllabus or vocabulary data redistributed',
  'https://www.chinesetest.cn/hsk',
  'Chinese Tests Service Website / CTI. MandarinLearnApp uses only the public six-level and three-stage/nine-level structure as navigation metadata.',
  NULL,
  'The official page describes the existing six-level system and the New HSK three-stage/nine-level framework. This record does not claim a license for the official syllabus, vocabulary, grammar, or example content; none of that material is copied.',
  'restricted',
  'Official HSK page and terms linked; structural metadata only, no bulk text or word list copied',
  '2026-09-24T00:00:00Z'
);

-- Publish only versioned navigation skeletons. Actual sourced lesson content
-- will be added as separate reusable records after its redistribution rights
-- and Indonesian gloss quality are established.
UPDATE curricula SET
  name='HSK 3.0 · 9 tingkat',
  version='2021-framework',
  external_source_id='source-hsk-framework-reference',
  status='published',
  description='Kerangka tiga tahap dan sembilan tingkat HSK Baru. Daftar kosakata serta materi silabus resmi belum disalin ke aplikasi.'
WHERE id='curriculum-hsk-3';

UPDATE curriculum_units SET
  title='Tingkat ' || level_number,
  description=CASE
    WHEN level_number BETWEEN 1 AND 3 THEN 'Tahap 1 · Pemula. Ini slot struktur; daftar kata HSK belum disertakan.'
    WHEN level_number BETWEEN 4 AND 6 THEN 'Tahap 2 · Menengah. Ini slot struktur; daftar kata HSK belum disertakan.'
    ELSE 'Tahap 3 · Lanjut. Ini slot struktur; daftar kata HSK belum disertakan.'
  END,
  status='published'
WHERE curriculum_id='curriculum-hsk-3' AND level_number BETWEEN 1 AND 9;

INSERT OR IGNORE INTO curricula(
  id,slug,name,locale,curriculum_kind,version,external_source_id,status,description
) VALUES (
  'curriculum-hsk-2','hsk-2','HSK 2.0 · 6 tingkat','id','hsk','six-level-framework',
  'source-hsk-framework-reference','published',
  'Kerangka HSK enam tingkat. Daftar kosakata dan materi ujian resmi belum disalin ke aplikasi.'
);

WITH RECURSIVE levels(level) AS (
  SELECT 1 UNION ALL SELECT level + 1 FROM levels WHERE level < 6
)
INSERT OR IGNORE INTO curriculum_units(
  id,curriculum_id,slug,title,description,ordinal,level_number,status
)
SELECT
  'unit-hsk-2-' || level,
  'curriculum-hsk-2',
  'level-' || level,
  'Tingkat ' || level,
  'Slot struktur HSK 2.0 tingkat ' || level || '. Daftar kata resmi belum disertakan.',
  level - 1,
  level,
  'published'
FROM levels;

-- Make the existing daily-life topic map visible while being explicit that
-- only the greeting lesson currently has published learning placements.
UPDATE curriculum_units SET
  description=CASE slug
    WHEN 'home' THEN 'Topik rumah dan keluarga; kosakata akan ditambahkan bertahap.'
    WHEN 'food' THEN 'Topik makanan dan minuman; kosakata akan ditambahkan bertahap.'
    WHEN 'getting-around' THEN 'Topik bepergian; kosakata akan ditambahkan bertahap.'
    ELSE COALESCE(description,'Topik keseharian; materi akan ditambahkan bertahap.')
  END,
  status='published'
WHERE curriculum_id='curriculum-daily-life';
