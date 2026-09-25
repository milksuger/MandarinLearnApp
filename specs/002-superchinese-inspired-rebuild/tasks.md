# Rebuild implementation plan

Work from durable product/domain decisions toward visible navigation, then ship each complete vertical slice. A checked item means implemented and verified at the stated environment; it does not imply production deployment.

## Phase 0 — product reference and boundaries

- [x] Read the SuperChinese interface/curriculum research and distinguish confirmed features from inferred page details.
- [x] Define a functional-reference boundary that preserves original branding, authored content, and licensed sources.
- [x] Record the long-term learner areas, free-service constraints, Talk launch gate, and admin outcomes.

## Phase 1 — navigation and content discovery

- [x] Replace the four-tab shell with a five-destination learner navigation that works on phone and tablet.
- [x] Add data-backed Discover search and curriculum-kind filters without duplicating content or learner history.
- [x] Add a Practice landing page that routes to existing writing, course, and review activities.
- [x] Keep profile reachable from the account control and preserve direct URLs/back navigation.

## Phase 2 — lesson experience

- [x] Model reusable lesson activities and ordered scenario content with additive migrations.
- [x] Build a predictable unit flow for objectives, vocabulary, examples, grammar, dialogue, short stories, guided writing, comprehension and a result summary.
- [x] Record learning outcomes against content/reading/skill and source placement; preserve idempotent sync.
- [x] Make the learner resume at the saved activity cursor after navigation, refresh, or another device.
- [ ] Add an open-ended scenario response task with a suitable no-cost, non-automated feedback method.

## Phase 3 — course depth and placement

- [x] Add optional Pinyin foundations with tone contours and licensed example recordings.
- [x] Add an app-authored placement check with an explainable recommendation; label it as non-official and persist the result.
- [x] Expand original daily-life scenarios and HSK-aligned (not official) content through staged authored releases.
- [ ] Add automated content validation, localization, audio completeness and provenance gates to publishing.

## Phase 4 — independent learning areas

- [x] Build Practice by skill using shared content IDs and distinct assessment dimensions (writing, speaking self-record/compare, comprehension, handwriting and review).
- [x] Upgrade Review with skill filters and shared vocabulary/reading IDs.
- [x] Build Discover collections for words, grammar, dialogues and stories.
- [x] Design and implement Talk moderation, reporting, blocking and rate limits before opening community access.

## Phase 5 — admin and operations alignment

- [x] Extend audited individual progress to skill/activity and placement views.
- [x] Add lesson/activity provenance and completeness context to the admin content workflow.
- [ ] Monitor free-tier use, queue health, sync failures, media integrity, and recognition abstentions.

## Phase 6 — release readiness

- [ ] Complete iPad 8 Safari portrait/landscape and stylus acceptance checks.
- [ ] Review keyboard/screen-reader access, contrast, touch targets, offline recovery and account sync.
- [ ] Verify content/media credits and no paid-service paths before deployment.
