ALTER TABLE learner_activity_progress
  ADD COLUMN correct_count INTEGER NOT NULL DEFAULT 0 CHECK(correct_count >= 0);

CREATE TABLE learner_activity_character_progress (
  user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  activity_id TEXT NOT NULL REFERENCES curriculum_activities(id) ON DELETE CASCADE,
  character_id TEXT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  completed_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY(user_id, activity_id, character_id)
);

CREATE INDEX learner_activity_character_progress_activity_idx
  ON learner_activity_character_progress(user_id, activity_id);
