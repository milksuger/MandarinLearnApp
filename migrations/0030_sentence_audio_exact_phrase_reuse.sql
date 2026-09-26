PRAGMA foreign_keys = ON;

-- Reuse the already bundled, source-verified human recording of the exact
-- phrase 你好 for the greeting dialogue turn 你好！. The only normalization
-- is terminal punctuation, which has no spoken audio segment of its own.
-- No media bytes are duplicated: both records resolve to the same storage key.
INSERT INTO content_audio_assets (
  id, source_id, storage_key, sha256, original_sha256, format, size_bytes,
  duration_ms, speaker_id, dialect, recording_context, source_page_url,
  source_attested_at, source_attestation_method, derivative_notes,
  pronunciation_review, status
)
SELECT
  'snt-commons-zh-nihao', a.source_id, a.storage_key, a.sha256,
  'f87ad432d8ec6f81b4970782d65db7bb33e52818f98e98168020f6085ec2fd80',
  a.format, a.size_bytes, a.duration_ms, a.speaker_id, a.dialect,
  'Exact human recording of 你好 / nǐ hǎo; reused for dialogue text 你好！ after terminal-punctuation normalization.',
  a.source_page_url, a.source_attested_at, a.source_attestation_method,
  'Reuses the unchanged bundled MP3 from legacy audio asset audio-nihao; no audio editing or second file.',
  a.pronunciation_review, a.status
FROM audio_assets a
JOIN asset_sources s ON s.id = a.source_id AND s.license_verification = 'verified'
WHERE a.id = 'audio-nihao' AND a.status = 'approved'
  AND a.source_attested_at IS NOT NULL
  AND EXISTS (SELECT 1 FROM dialogue_turns d WHERE d.id = 'dialogue-greetings-1'
    AND d.simplified_text = '你好！' AND d.status = 'approved');

INSERT INTO dialogue_turn_audio_links (dialogue_turn_id, asset_id, role, ordinal)
SELECT 'dialogue-greetings-1', 'snt-commons-zh-nihao', 'primary', 0
WHERE EXISTS (SELECT 1 FROM content_audio_assets WHERE id = 'snt-commons-zh-nihao')
  AND NOT EXISTS (SELECT 1 FROM dialogue_turn_audio_links
    WHERE dialogue_turn_id = 'dialogue-greetings-1' AND role = 'primary' AND ordinal = 0);
