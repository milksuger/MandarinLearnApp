PRAGMA foreign_keys = ON;

-- Source-verified, exact licensed Mandarin human word recordings.
-- Pronunciation review remains available to admins; source attestation allows
-- these licensed community recordings to be used while the review is pending.
INSERT OR IGNORE INTO asset_sources(id,name,version,source_url,license_id,license_url,attribution,checksum,notes,license_verification,verification_method,verified_at)
VALUES('source-commons-shtooka-by20fr','Wikimedia Commons Shtooka Mandarin pronunciations (CC BY 2.0 fr)','1.0.0','https://commons.wikimedia.org/wiki/Commons:Shtooka','CC BY 2.0 fr','https://creativecommons.org/licenses/by/2.0/fr/deed.en','Wikimedia Commons Shtooka Mandarin pronunciations (CC BY 2.0 fr); creator: Wei Gao, Vion Nicolas; profile/source: https://commons.wikimedia.org/wiki/Commons:Shtooka; Wikimedia Commons; CC BY 2.0 fr. Individual file pages are recorded per audio asset.',NULL,'The Commons Shtooka file page supplies the exact simplified word and marked pinyin, per-file speaker description, creator, license, and original file. Voice details must be taken from each file page; this collection includes different speakers and regions.','verified','Commons file title and page description match the word and marked pinyin; creator, license URL, MIME type and downloaded original SHA-1 verified against Wikimedia Commons metadata.','2026-09-25T04:16:13.951Z');

INSERT OR IGNORE INTO audio_assets(
 id,reading_id,source_id,storage_key,sha256,format,size_bytes,duration_ms,speaker_id,dialect,
 recording_context,pronunciation_review,status,source_page_url,source_attested_at,
 source_attestation_method,original_sha256,derivative_notes
) VALUES
('audio-word-zhengzai','reading-word-zhengzai','source-commons-shtooka-by20fr','media/audio/shtooka-word-zhengzai.mp3','a172dce1033f1231bcec42a5b2014c66e28d76bce74d357568f815f0956bbbe1','audio/mpeg',18434,1123,'Shtooka Mandarin speaker; see file-specific voice description','cmn','Exact isolated Mandarin pronunciation 正在 / zhèng zài','pending','approved','https://commons.wikimedia.org/wiki/File:Zh-zh%C3%A8ngz%C3%A0i.ogg','2026-09-25T04:16:13.951Z','Commons description confirms pronunciation zhèng zài for 正在; listed voice: Male voice; Commons says the speaker is from Beijing, China.; source SHA-1 47892558316e1c091f75a12d3b49740bab6f2d74 and license CC BY 2.0 fr verified against Commons metadata.','4cc25e1a0c30c00395f76f4d5d3dd1ef23eb3712d71577d3f86251a2cde77568','Lossy compatibility transcode from unchanged Wikimedia Shtooka OGG using FFmpeg 2013/libmp3lame, CBR 128 kbit/s, mono, 22.05 kHz; no speech editing. CC BY-SA assets remain available under the same terms with attribution.');
