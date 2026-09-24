PRAGMA foreign_keys = ON;

-- The official HSK page is recorded as a factual reference only; no license
-- for redistributing exam material is asserted in the license fields.
UPDATE asset_sources
SET license_id = 'No redistribution license asserted; structure metadata only',
    license_url = NULL
WHERE id = 'source-hsk-framework-reference';

-- The original placement index already covers this exact query key/order.
DROP INDEX IF EXISTS learning_attempts_user_placement_time_idx;
