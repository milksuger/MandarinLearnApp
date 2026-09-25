# Architecture decisions for the scenario-based rebuild

## Keep and extend the current domain

Retain the existing reusable graph: vocabulary entries, characters, contextual readings, glosses, examples, curriculum units/placements, sourced audio/stroke assets, immutable learning attempts, progress projections, and review schedules. Do not create a second flashcard table or duplicate vocabulary for each curriculum.

## Add concepts only when their workflow is implemented

The next domain additions should be versioned lesson activities, grammar/usage notes, dialogue turns, skill practice sessions, learner preferences/placement results, and community posts/reports. Each should have stable IDs, publication state, provenance, locale, ordering, and curriculum/content links where relevant. Practice attempts should identify the exact activity, skill, reading/content context, engine version and measured outcome. Keep raw voice and stroke samples ephemeral unless a separately consented diagnostic workflow is designed.

Use additive D1 migrations and repository/service boundaries. Migrations already applied to preview/production are immutable. Before remote schema work, make and verify an export outside the repository. Keep HTTP payload validation and authorization in the Worker and do not expose D1 from the frontend.

## Frontend organization target

Move the current large route module incrementally into route-level feature folders (home, course, practice, discover, review, profile, admin). Share layouts, navigation, lesson-progress components, audio controls, and accessibility primitives. Preserve React Router deep links. Use feature-owned API clients/contracts instead of putting SQL knowledge or content policy in UI components.

## Audio, handwriting, and evaluation boundaries

Human source recordings, device-local synthetic speech, recording-and-compare exercises, pronunciation evaluation, guided stroke-order evaluation, and freehand identity recognition are distinct capabilities. Never label one as another. Start with exact playback and transparent self-comparison when automated scoring is unavailable. Each scoring engine must return dimensions plus `uncertain`/`not assessed`; it cannot manufacture confidence or claim calibrated accuracy.

## Community boundary

Talk requires persistent content ownership, report/block controls, moderation queue, retention/deletion rules, rate limits, and audited moderator access before enabling public posting. It must not be implemented as an unmoderated text box or a visual-only placeholder.

## Deployment

Continue with the current single-origin Cloudflare Worker/static assets/D1 setup. Keep optional R2 use behind the media storage adapter. Any future provider switch must preserve the same content/progress contracts and exportability. No paid provider is permitted by default.
