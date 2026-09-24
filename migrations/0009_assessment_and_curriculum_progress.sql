PRAGMA foreign_keys = ON;

-- Persist a mode-independent summary outcome while retaining each measured
-- dimension as the detailed source of truth. Empty assessments stay explicit.
ALTER TABLE learning_attempts ADD COLUMN assessment_outcome TEXT NOT NULL DEFAULT 'not_assessed'
  CHECK(assessment_outcome IN ('passed','needs_practice','uncertain','not_assessed'));

UPDATE learning_attempts
SET assessment_outcome = CASE
  WHEN json_valid(dimensions_json) = 0
    OR NOT EXISTS (SELECT 1 FROM json_each(learning_attempts.dimensions_json))
    THEN 'not_assessed'
  WHEN EXISTS (SELECT 1 FROM json_each(learning_attempts.dimensions_json) WHERE value IN ('needs_practice','not_recognized'))
    THEN 'needs_practice'
  WHEN EXISTS (SELECT 1 FROM json_each(learning_attempts.dimensions_json) WHERE value = 'uncertain')
    THEN 'uncertain'
  WHEN NOT EXISTS (SELECT 1 FROM json_each(learning_attempts.dimensions_json) WHERE value NOT IN ('correct','recognized','close_enough'))
    THEN 'passed'
  ELSE 'needs_practice'
END;

-- Repair the old "any dimension passed" projection using the new all-measured-
-- dimensions outcome. Keep the latest dimension detail and review date intact.
UPDATE learner_progress
SET attempts_count = (SELECT COUNT(*) FROM learning_attempts a
    WHERE a.user_id = learner_progress.user_id AND a.content_type = learner_progress.content_type AND a.content_id = learner_progress.content_id),
    correct_count = (SELECT COUNT(*) FROM learning_attempts a
    WHERE a.user_id = learner_progress.user_id AND a.content_type = learner_progress.content_type AND a.content_id = learner_progress.content_id AND a.assessment_outcome = 'passed'),
    last_seen_at = (SELECT MAX(a.accepted_at) FROM learning_attempts a
    WHERE a.user_id = learner_progress.user_id AND a.content_type = learner_progress.content_type AND a.content_id = learner_progress.content_id),
    dimension_summary_json = COALESCE((SELECT a.dimensions_json FROM learning_attempts a
    WHERE a.user_id = learner_progress.user_id AND a.content_type = learner_progress.content_type AND a.content_id = learner_progress.content_id
    ORDER BY a.accepted_at DESC LIMIT 1), dimension_summary_json),
    updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
WHERE EXISTS (SELECT 1 FROM learning_attempts a
  WHERE a.user_id = learner_progress.user_id AND a.content_type = learner_progress.content_type AND a.content_id = learner_progress.content_id);

CREATE INDEX learning_attempts_user_placement_time_idx
  ON learning_attempts(user_id, placement_id, accepted_at DESC);
