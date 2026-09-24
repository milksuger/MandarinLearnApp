PRAGMA foreign_keys = ON;

-- Source-level verification lets us ship an unchanged, licensed upstream asset
-- without pretending that a human reviewed every file. Manual review fields
-- remain available for later corrections and takedowns.
ALTER TABLE asset_sources ADD COLUMN license_verification TEXT NOT NULL DEFAULT 'pending'
  CHECK (license_verification IN ('pending','verified','restricted','rejected'));
ALTER TABLE asset_sources ADD COLUMN verification_method TEXT;
ALTER TABLE asset_sources ADD COLUMN verified_at TEXT;

ALTER TABLE audio_assets ADD COLUMN source_page_url TEXT;
ALTER TABLE audio_assets ADD COLUMN source_attested_at TEXT;
ALTER TABLE audio_assets ADD COLUMN source_attestation_method TEXT;
ALTER TABLE audio_assets ADD COLUMN original_sha256 TEXT;
ALTER TABLE audio_assets ADD COLUMN derivative_notes TEXT;

ALTER TABLE characters ADD COLUMN stroke_data_source_page_url TEXT;
ALTER TABLE characters ADD COLUMN stroke_data_attested_at TEXT;
ALTER TABLE characters ADD COLUMN stroke_data_attestation_method TEXT;

INSERT INTO asset_sources(id,name,version,source_url,license_id,license_url,attribution,checksum,notes,license_verification,verification_method,verified_at)
VALUES
('source-hanzi-writer-data','Hanzi Writer character data / Make Me a Hanzi','2.0.1',
 'https://github.com/chanind/hanzi-writer-data',
 'Arphic Public License',
 'https://github.com/chanind/hanzi-writer-data/blob/master/ARPHICPL.TXT',
 'Make Me a Hanzi contributors; character graphics derived from Arphic Technology fonts. Preserve ARPHICPL.TXT.',
 'npm-sha1:09ce12eb1c47d86aeb33313e622f17ba5cbac1ad',
 'The data is formally redistributable under APL, but is not represented as a PRC Ministry of Education stroke-order standard.',
 'verified','Upstream license and exact npm package integrity inspected','2026-09-24T00:00:00Z'),
('source-commons-nihao','Wikimedia Commons file Zh_nǐ_hǎo.ogg','2011-02-15T09:14:09Z',
 'https://commons.wikimedia.org/wiki/File:Zh_n%C7%90_h%C7%8Eo.ogg',
 'CC BY-SA 3.0','https://creativecommons.org/licenses/by-sa/3.0',
 '“Zh nǐ hǎo.ogg” by Sjors Provoost, via Wikimedia Commons, CC BY-SA 3.0; unchanged.',
 'sha1:fe6ceb1eae191c00075a47991c63cd79742209f8',
 'Wiktionary lists this exact file for the Mandarin Hanyu Pinyin reading nǐ hǎo. Community recording, not a government-certified voice.',
 'verified','Exact Wiktionary reading page, Commons file metadata, license, and downloaded bytes matched','2026-09-24T00:00:00Z'),
('source-commons-ni','Wikimedia Commons file Zh-nǐ.ogg','2007-11-08T19:45:42Z',
 'https://commons.wikimedia.org/wiki/File:Zh-n%C7%90.ogg',
 'CC BY 2.0 fr','https://creativecommons.org/licenses/by/2.0/fr/deed.en',
 '“Zh-nǐ.ogg” by Wei Gao and Vion Nicolas, via Wikimedia Commons, CC BY 2.0 fr; unchanged.',
 'sha1:5d3f4d22d7463d215c97d0b5e71828f9506cabfa',
 'Commons file description identifies the recording as Mandarin 你 nǐ and the speaker as from Beijing.',
 'verified','Commons file metadata, license, and downloaded bytes matched','2026-09-24T00:00:00Z'),
('source-starter-content','MandarinLearnApp starter lesson','1.0.0',
 NULL,
 'MIT','https://opensource.org/license/mit/',
 'Original minimal starter gloss and lesson structure by MandarinLearnApp contributors.',
 NULL,'The single introductory greeting is authored for this project; this is not an HSK word-list import.',
 'verified','Project-authored starter content','2026-09-24T00:00:00Z');

INSERT INTO characters(id,hanzi,unicode_code_point,stroke_count,stroke_data_source_id,stroke_data_storage_key,
 stroke_data_checksum,stroke_data_version,stroke_data_license_id,stroke_data_status,status,source_id,
 stroke_data_source_page_url,stroke_data_attested_at,stroke_data_attestation_method)
VALUES
('char-ni','你','U+4F60',7,'source-hanzi-writer-data','media/strokes/4F60.json',
 '21057a26cb5c1753ea710d503b759cc17948263501ffd76ef1737cb2b5d5f966',
 '2.0.1','Arphic Public License','approved','approved','source-hanzi-writer-data',
 'https://github.com/chanind/hanzi-writer-data/blob/master/%E4%BD%A0.json','2026-09-24T00:00:00Z',
 'upstream_package_license_and_character_file'),
('char-hao','好','U+597D',6,'source-hanzi-writer-data','media/strokes/597D.json',
 'c9f085fe651e2b2c9653c7edf51bdbc78339fcc0b10f94c1f33c7f4f4d4a3a5',
 '2.0.1','Arphic Public License','approved','approved','source-hanzi-writer-data',
 'https://github.com/chanind/hanzi-writer-data/blob/master/%E5%A5%BD.json','2026-09-24T00:00:00Z',
 'upstream_package_license_and_character_file');

INSERT INTO vocabulary_entries(id,simplified_form,part_of_speech,status,source_id)
VALUES('word-nihao','你好','greeting','approved','source-starter-content');

INSERT INTO readings(id,character_id,vocabulary_id,context_label,pinyin_json,numbered_pinyin,sandhi_json,source_id,status)
VALUES
('reading-character-ni','char-ni',NULL,'Isolated character reading','["nǐ"]','ni3','[]','source-commons-ni','approved'),
('reading-word-nihao',NULL,'word-nihao','Everyday greeting: 你好','["nǐ","hǎo"]','ni3 hao3',
 '[{"index":0,"underlyingTone":3,"surfaceTone":2,"condition":"third tone before third tone"}]',
 'source-commons-nihao','approved');

INSERT INTO glosses(id,locale,text,usage_label,source_id,status)
VALUES('gloss-nihao-id','id','Halo','Sapaan umum','source-starter-content','approved');
INSERT INTO vocabulary_glosses(vocabulary_id,gloss_id) VALUES('word-nihao','gloss-nihao-id');
INSERT INTO vocabulary_characters(vocabulary_id,character_id,position)
VALUES('word-nihao','char-ni',0),('word-nihao','char-hao',1);

INSERT INTO audio_assets(id,reading_id,source_id,storage_key,sha256,format,size_bytes,duration_ms,speaker_id,dialect,
 recording_context,pronunciation_review,status,source_page_url,source_attested_at,source_attestation_method,original_sha256,derivative_notes)
VALUES
('audio-nihao','reading-word-nihao','source-commons-nihao','media/audio/commons-zh-nihao.mp3',
 '4b49eb40e5981810dffbef2bcd15999345ce6c2e62ac274b1a7601a5c0841bd2',
 'audio/mpeg',18434,1123,'speaker-not-identified','zh-CN','Exact phrase 你好 / Hanyu Pinyin nǐ hǎo; source page associates this file with this reading',
 'pending','approved','https://commons.wikimedia.org/wiki/File:Zh_n%C7%90_h%C7%8Eo.ogg','2026-09-24T00:00:00Z',
 'wiktionary_exact_reading_and_commons_license_metadata',
 'f87ad432d8ec6f81b4970782d65db7bb33e52818f98e98168020f6085ec2fd80',
 'Lossy compatibility transcode from the archived original Ogg/Vorbis to MP3 using FFmpeg 2013, libmp3lame CBR 128 kbit/s, mono 22050 Hz; no speech editing.'),
('audio-character-ni','reading-character-ni','source-commons-ni','media/audio/commons-zh-ni.mp3',
 '2ffc2472805ddcf022967b7ceff36c3989afe9a5a1d1e0745cfcc38fa4a2ef25',
 'audio/mpeg',20106,1228,'Wei Gao','zh-CN','Isolated character 你 / Hanyu Pinyin nǐ; Shtooka HSK 1 recording by a Beijing speaker',
 'pending','approved','https://commons.wikimedia.org/wiki/File:Zh-n%C7%90.ogg','2026-09-24T00:00:00Z',
 'commons_character_description_and_license_metadata',
 'e8218d402c238c66f83252592d3e292e2f2bf1054a1dd138faeaa2d6afa4d570',
 'Lossy compatibility transcode from the archived original Ogg/Vorbis to MP3 using FFmpeg 2013, libmp3lame CBR 128 kbit/s, mono 22050 Hz; no speech editing.');

UPDATE curricula SET version='1.0.0',status='published',description='Jalur harian dimulai dengan satu sapaan dasar yang bersumber dan berlisensi.' WHERE id='curriculum-daily-life';
UPDATE curriculum_units SET description='Sapaan dasar: dengarkan 你好, pahami maknanya, lalu tulis kedua karakternya.',status='published' WHERE id='unit-daily-greetings';
INSERT INTO curriculum_placements(id,unit_id,vocabulary_id,ordinal,learning_objective,source_id)
VALUES('placement-nihao-greetings','unit-daily-greetings','word-nihao',0,'Mengenali dan menulis sapaan dasar','source-starter-content');
