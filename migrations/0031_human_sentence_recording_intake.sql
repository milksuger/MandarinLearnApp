PRAGMA foreign_keys = ON;

-- Keep the speaker's publication consent attached to recordings made inside
-- the admin studio. The uploaded WAV remains a separate immutable media asset.
ALTER TABLE content_audio_assets ADD COLUMN recording_method TEXT
  CHECK (recording_method IS NULL OR recording_method IN ('source_import', 'in_app_human'));
ALTER TABLE content_audio_assets ADD COLUMN contributor_display_name TEXT;
ALTER TABLE content_audio_assets ADD COLUMN contributor_consent_version TEXT;
ALTER TABLE content_audio_assets ADD COLUMN contributor_consent_at TEXT;

CREATE INDEX content_audio_recording_method_idx
  ON content_audio_assets(recording_method, status, created_at);
