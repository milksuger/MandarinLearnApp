PRAGMA foreign_keys = ON;

-- Source-verified, exact licensed Mandarin human word recordings.
-- Pronunciation review remains available to admins; source attestation allows
-- these licensed community recordings to be used while the review is pending.
INSERT OR IGNORE INTO asset_sources(id,name,version,source_url,license_id,license_url,attribution,checksum,notes,license_verification,verification_method,verified_at)
VALUES('source-lingualibre-levi','Wikimedia Commons Lingua Libre Mandarin recordings by Levi Highway (列维劳德)','1.0.0','https://commons.wikimedia.org/wiki/Category:Lingua_Libre_pronunciation-cmn','CC0','http://creativecommons.org/publicdomain/zero/1.0/deed.en','Wikimedia Commons Lingua Libre Mandarin recordings by Levi Highway (列维劳德); creator/speaker: Levi Highway (列维劳德); profile/source: https://lingualibre.org/wiki/Q1573006; Wikimedia Commons; CC0. Individual file pages are recorded per audio asset.',NULL,'Exact word recordings tagged LL-Q9192 (cmn); speaker and recorder are read from per-file Commons metadata. Reuse license is stated per Commons file and verified against downloaded bytes. Community recording, not government-certified audio.','verified','Commons exact file title, cmn language tag, speaker/creator metadata, license metadata and downloaded SHA-1 verified by importer','2026-09-25T04:22:46.122Z');

INSERT OR IGNORE INTO audio_assets(
 id,reading_id,source_id,storage_key,sha256,format,size_bytes,duration_ms,speaker_id,dialect,
 recording_context,pronunciation_review,status,source_page_url,source_attested_at,
 source_attestation_method,original_sha256,derivative_notes
) VALUES
('audio-word-de','reading-vocabulary-word-de','source-lingualibre-levi','media/audio/lingualibre-word-de.mp3','1387685a2b63325853f189536f591ec4789d16a267e7929ae1094e5fb8b011ae','audio/mpeg',10911,653,'Levi Highway (列维劳德)','cmn','Exact isolated Mandarin pronunciation 的 / de','pending','approved','https://commons.wikimedia.org/wiki/File:LL-Q9192_(cmn)-Levi_Highway_(%E5%88%97%E7%BB%B4%E5%8A%B3%E5%BE%B7)-%E7%9A%84.wav','2026-09-25T04:22:46.122Z','Exact Commons Lingua Libre filename identifies 的 and is tagged cmn; SHA-1 ccd1ea44e925c05a415fa0ec1e48eb507e27a6d0, license CC0, speaker profile Q1573006; original and derivative hashes retained in content manifest.','a13b8e513ddb8a8eadbd09e471a962577745cf7fee1f023525302aea4c5248cd','Lossy compatibility transcode from unchanged Wikimedia Lingua Libre WAV using FFmpeg 2013/libmp3lame, CBR 128 kbit/s, mono, 22.05 kHz; no speech editing. CC BY-SA assets remain available under the same terms with attribution.');
