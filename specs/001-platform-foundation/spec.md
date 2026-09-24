# Product specification: MandarinLearnApp foundation

**Status:** Approved scope from user messages; implementation in progress.  
**Visual source:** User-provided Stitch export, summarized in `docs/stitch-design-reference.md`.  
**Product language:** Indonesian interface; Simplified Chinese learning content; English only for developer/admin diagnostics where useful.

## 1. Product outcome

Build a free, open-source Mandarin-learning product for Indonesian-speaking learners. Learners can understand contextual vocabulary, hear the exact approved Mandarin reading, learn stroke order, practise writing with touch/stylus, review prior learning, and continue on another signed-in device. Administrators can inspect service/content health and an individual learner's progress with server-enforced access control and an audit trail.

The app is a responsive web PWA. Learner layouts target phones and tablets, especially iPad (8th generation) in portrait and landscape with third-party stylus support. Learner-facing PC design is out of scope. The admin console is PC-first and remains usable on a tablet.

## 2. User roles

- **Learner:** owns an account, joins one or both curriculum paths, practises, reviews, and synchronizes attempts.
- **Owner admin:** views aggregate health, manages roles/content, opens audited individual learner records, and handles privacy requests.
- **Content/audio reviewer:** reviews source, license, translation, reading context, and audio candidates. This role cannot grant itself owner privileges.

New public registrations receive learner permissions only. Admin authorization is checked by the API for every protected operation; hiding a UI link is not authorization.

## 3. Main learner journeys

1. Create/sign into an account, learn that progress is account-backed, and set level, chosen path(s), and daily goal.
2. Continue from Home into a daily-life unit or the versioned HSK 3.0 curriculum (three stages, levels 1–9).
3. Study a contextual word: see its Simplified form, tone-marked Pinyin, Indonesian sense(s), component characters, examples, and an exact-context audio state.
4. Enter guided character practice. Replay/slow the stroke animation, trace/write with a stylus or finger, undo/clear/hint, and receive separate order/direction/shape feedback.
5. Enter freehand mode only after the guide is hidden. Run local recognition; report candidate/uncertain/abstained outcomes separately from stroke-order judgments.
6. Save a derived attempt summary and review schedule. When offline, queue an idempotent attempt and show pending sync; after reconnect, acknowledge it once from the server.
7. Review due items, inspect progress by skill, and manage profile/sync/privacy settings.

## 4. Main administrator journeys

1. Sign in with an administrator role and review aggregate learner, database, content, audio, synchronization, and recognition-health indicators.
2. Search the pseudonymous learner directory, view a learner profile, and record every individual profile access in an append-only audit event.
3. Inspect curriculum membership/progress, separate reading/listening/guided-writing/freehand dimensions, due reviews, and recent attempt summaries.
4. Review content/audio provenance and candidates. A candidate may be played in the review console; only an explicitly approved asset for the same contextual reading can be served to learners.
5. Inspect recognition outcome distributions and system incidents without routine access to raw handwriting or audio captured from learners.

## 5. Functional requirements

### 5.1 Accounts and synchronization

- Authentication, profiles, progress, and attempts are stored server-side in D1; IndexedDB is cache/outbox only.
- Authentication state uses secure, HTTP-only cookies and server sessions through an established auth library.
- Provide account recovery without a paid email/SMS dependency. The initial design uses user-held recovery codes with one-time use, hashes at rest, revocation on use, and a regenerate flow available only after fresh authentication. Recovery codes are never returned again after creation.
- Support account export and deletion requests. Deletion is an explicit user action, not an admin directory bulk operation.
- Every syncable attempt has a client-generated stable idempotency ID and server acknowledgement to prevent duplicate credit after retries.
- Keep last successful sync and queued-attempt count visible but secondary.

### 5.2 Reusable learning content

- Do not model words as isolated front/back cards. Content, curriculum placements, audio, stroke assets, learner attempts, and review schedules are independently identified records.
- One vocabulary item can be placed in a daily-life unit and an HSK version/level without duplicating its readings or learner history.
- A character can have multiple readings. Each reading links to a context word/phrase and exact audio asset; no context-free guess is played.
- Store original source form, source/version/date, license, attribution, checksum, editorial changes, locale, review state, and replacement history for every imported content/asset item.
- Seed only original/editorially reviewed examples and minimal demonstration words until the redistribution terms for a full HSK or dictionary data set are confirmed.
- HSK curriculum records always carry an explicit standard version and levels 1–9. Do not silently merge older HSK vocabulary.

### 5.3 Pronunciation

- No runtime cloud TTS, paid API, or device Web Speech fallback.
- Learner playback accepts only an approved, licensed, versioned audio asset attached to the exact contextual reading and displayed text. Approval may come from a recorded source/license verification for an unchanged upstream asset, or individual pronunciation review; source verification must never be presented as official pronunciation certification.
- If no approved audio exists, show the correct tone-marked Pinyin and “Audio belum tersedia”; retry never substitutes an unreviewed voice.
- Store candidate/approved/rejected/replaced status, source or recording process, voice/model/checkpoint when applicable, usage terms, hash, duration, pronunciation review state, source attestation, reviewer, review timestamp, and content version. Keep admin review and takedown available even for source-attested assets.
- Admin candidate preview is distinct from learner playback and is audit-logged when approval changes.

### 5.4 Writing and recognition

- Guided stroke animation and stroke-order assessment use versioned stroke data with independent provenance/license metadata. An unchanged, licensed upstream dataset may be source-verified and used without a per-character human approval gate; retain admin review/takedown and do not mislabel third-party data as a government standard.
- The guided evaluator reports stroke order, direction, and shape separately. It must not infer mastery from character identity recognition alone.
- Freehand recognition is a separate local/offline replaceable engine. Store the engine/data version and categorical outcome. Never display an uncalibrated numeric confidence or turn uncertainty into pass/fail.
- Raw stroke paths remain in memory for the current assessment and are discarded by default. Consented diagnostic samples require purpose, expiry, revocable consent, and audited access.
- Support touch, third-party stylus via Pointer Events, hand-rest space, undo, clear, rotation, variable writing size, and interruption/retry.

### 5.5 Review and progress

- Keep append-only attempts distinct from recalculable progress and review schedules.
- Review scheduling uses per-learner content/reading/skill state; it is not a global “word card” status.
- Progress exposes separate dimensions and categories such as Solid, Needs practice, Not enough attempts, and Uncertain recognition; no opaque combined score.
- Do not reproduce the Stitch prototype's fictional accuracy percentages, dates, or aggregate counts as real data.

### 5.6 Administrator privacy and safety

- Default admin lists and profiles use pseudonymous IDs and masked contact fields.
- Profile reads, denied access, role changes, content/audio approvals, exports, privacy requests, and any diagnostic access are append-only audited.
- Never expose password hashes, auth tokens, raw learner audio, or routine raw handwriting.
- Use row-level ownership checks on learner APIs, authorization checks on every admin endpoint, request validation, bounded pagination, and rate limits for authentication/recovery flows.

### 5.7 No-paid-services rule

- The application must not invoke a paid API or silently switch to a paid tier/provider. No paid audio, handwriting, email, analytics, or hosting services are part of the runtime design.
- Deployment/resource usage is visible to the admin where measurable. At free-quota risk, pause or throttle nonessential work and preserve already accepted learning data.
- Cloudflare may host the app and D1 database initially; repositories, storage contracts, migrations, and API versions must permit moving later.

## 6. Content model invariants

- Stable, opaque IDs; human text is not a primary key.
- `vocabulary_entry` represents a lexical item; `reading` represents a contextual pronunciation; `character` represents a Unicode character; `gloss` is locale-specific.
- Ordered `vocabulary_character` and `example` relations preserve segmentation/context.
- `curriculum` → `unit` → `placement` links reusable content. HSK version/stage/level is data, not UI-only labels.
- `audio_asset` and `stroke_data_asset` are versioned licensed resources with review state.
- `attempt` is append-only; `progress_snapshot` and `review_schedule` may be rebuilt from accepted attempts.
- Every externally sourced row has a provenance record. Publishing requires source/license review and approved content state.

## 7. Acceptance gates

- The learner can use the phone layout without horizontal scrolling; iPad 8 portrait and landscape keep a large writing canvas and usable third-party stylus/finger input.
- Registration/sign-in, authenticated server progress, same-origin API, and a second-device sign-in are supported; local attempts never become canonical until acknowledged by the server.
- Attempt synchronization is idempotent and visibly reports offline/pending/synced states.
- No sound without exact reading context and verified reuse provenance or an individual pronunciation review can reach learner playback; source verification is never labeled as official pronunciation certification.
- Guided stroke validation and freehand identity recognition are separate interfaces and stored results.
- HSK has versioned levels 1–9, and everyday-topic placements coexist on the same content IDs.
- Admin profile reads are role-checked and audited; routine access does not reveal raw attempts.
- Cloudflare D1 migrations are repeatable and content/application layers do not depend on D1-specific IDs or query syntax.
- Every dependency/data/audio asset has a recorded license/provenance decision before public release.
