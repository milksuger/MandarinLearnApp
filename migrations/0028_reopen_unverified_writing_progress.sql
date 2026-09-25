UPDATE learner_activity_progress
SET state = 'in_progress',
    completed_at = NULL,
    current_item_ordinal = 0,
    updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
WHERE state = 'completed'
  AND activity_id IN (
    SELECT id FROM curriculum_activities WHERE activity_kind = 'writing'
  )
  AND (
    SELECT COUNT(*)
    FROM learner_activity_character_progress p
    WHERE p.user_id = learner_activity_progress.user_id
      AND p.activity_id = learner_activity_progress.activity_id
  ) < (
    SELECT COUNT(DISTINCT ch.id)
    FROM curriculum_activities a
    JOIN curriculum_placements cp ON cp.unit_id = a.unit_id
    LEFT JOIN vocabulary_characters vc ON vc.vocabulary_id = cp.vocabulary_id
    JOIN characters ch ON ch.id = COALESCE(cp.character_id, vc.character_id)
    WHERE a.id = learner_activity_progress.activity_id
      AND ch.status = 'approved'
      AND ch.stroke_data_status = 'approved'
  );
