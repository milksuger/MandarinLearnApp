# Architecture decisions: MandarinLearnApp foundation

## 1. Deployment and runtime

- One React + TypeScript SPA is built with Vite and deployed with its API as a Cloudflare Worker using the Cloudflare Vite plugin. This keeps app navigation and API same-origin and avoids cross-origin session-cookie configuration.
- D1 is the initial canonical relational database. R2 is introduced only when approved audio/assets are available and size/traffic justify it.
- The Worker exposes a versioned `/api/v1/*` contract. The front end never accesses D1, R2, secrets, or provider admin APIs directly.
- Local development uses the Workerd runtime and Wrangler's local D1 simulator; local and remote databases are explicitly separate.
- Cloudflare resource bindings are adapters. Domain services use repository/storage interfaces so a later PostgreSQL/Supabase adapter can preserve the product model.

Cloudflare's current React/Vite guide scaffolds a React SPA, Worker API, static assets, and Vite plugin together. D1 supports local development with a local-only binding and migration workflow; do not enable remote D1 for ordinary development.

## 2. Application boundaries

```text
src/
  app/                 routes, accessible layouts, learner/admin UI
  features/             auth, learning, practice, review, progress, admin
  domain/               stable content/progress types and policies
  ports/                 repository, audio, recognition, sync contracts
  adapters/cloudflare/   D1/R2/Worker implementations
  worker/                API routes, auth wiring, middleware, entrypoint
  shared/                validation, errors, localization, ID/time helpers
migrations/             ordered SQLite-compatible schema changes
content/                 licensed/versioned import manifests and seed content
```

UI components do not run SQL. HTTP payload validation and domain rules live on the server; the shared TypeScript types describe contracts but do not replace runtime validation.

## 3. Persistence model (initial entities)

### Identity and access

- Better Auth tables for users, credentials/accounts, sessions, and verification.
- `learner_profiles`: preferences and current path/goal; keyed by auth user ID.
- `account_roles`: `owner_admin` and `content_reviewer` grants; default is learner and grant changes are audited.
- `recovery_codes`: only a one-way hash, created/used/revoked timestamps; plaintext appears once to the owner.
- `audit_events`: append-only actor, action, subject type/opaque ID, time, outcome, request ID, and minimal metadata.

Better Auth supports a direct D1 binding in its current release line. Password reset by email is deliberately excluded because Cloudflare Email Service's current Free plan cannot send to arbitrary community recipients; user-held recovery codes provide a no-cost recovery route. Adding another mail provider requires explicit confirmation that it remains free at expected scale.

### Learning graph

- `vocabulary_entries`, `characters`, `readings`, `glosses`, `vocabulary_characters`, and `examples` use stable opaque IDs.
- `curricula`, `curriculum_units`, and `curriculum_placements` model daily-life, HSK 2.0, and HSK 3.0 without duplicating the underlying content. Every attempt may retain its placement context; its derived outcome is separate from the measured dimensions.
- `asset_sources`, `audio_assets`, and `stroke_data_assets` store provenance, license, checksum/version, review state, and replacement links.
- `learning_attempts` store derived assessment dimensions, client idempotency ID, curriculum placement context, sync timestamps, and engine/data versions; no raw stroke/media by default.
- `learner_progress` and `review_schedules` are projections, not the source event log.
- `privacy_requests` record export/deletion/diagnostic-consent workflows and status.

Content examples and all initial counts are marked sample/seed data. The import pipeline rejects missing source, license, checksum/version, locale, or review-state fields for externally sourced data.

## 4. API surface (first version)

```text
/api/auth/*                         Better Auth session/account flows
/api/v1/me                          current profile and sync status
/api/v1/paths                       available daily/HSK curriculum paths
/api/v1/units/:unitId               unit/lesson content summary
/api/v1/vocabulary/:entryId         lexical item with contextual readings
/api/v1/characters/:characterId     stroke metadata and context-linked readings
/api/v1/audio/:assetId              exact approved audio only
/api/v1/attempts                    idempotent batch write / outbox acknowledgement
/api/v1/reviews                     due items and per-skill results
/api/v1/progress                    personal skill/curriculum summary
/api/v1/profile                     profile, settings, export/deletion request
/api/v1/admin/overview              aggregate operational metrics
/api/v1/admin/learners               bounded search/list
/api/v1/admin/learners/:id           audited single learner profile
/api/v1/admin/content/*             provenance and review queues
/api/v1/admin/audit                  append-only, filtered event log
```

All learner endpoints derive the principal from the verified server session. Admin endpoints apply explicit role guards and emit audit records for sensitive reads/writes.

## 5. Offline model

- Cache the app shell and explicitly approved lesson/audio assets only. Do not treat cached content as account storage.
- IndexedDB stores a versioned retry outbox with one stable idempotency ID per attempt. It stores derived attempt payloads only, not raw stroke traces.
- A single sync coordinator posts bounded batches after startup/reconnect/foreground. Acknowledged items are removed; retryable failures remain queued; permanent validation errors are surfaced without silent data loss.
- Server responses define accepted attempt IDs and server timestamps. Duplicate IDs return the original acknowledgment.
- The UI exposes `offline`, `pending`, `syncing`, `synced`, and `sync error` states.

## 6. Audio and handwriting adapters

- `PronunciationAssetRepository` returns only approved asset metadata/bytes for the exact reading/context. It has no cloud TTS fallback. An unavailable exact audio returns an explicit domain result, not a generic URL.
- `StrokeOrderEvaluator` consumes local versioned stroke data and returns order, direction, shape, or abstention findings.
- `CharacterRecognizer` is a separate local/offline adapter with candidate, uncertain, and no-match outcomes. Its dependency/code/data license must remain separable and be reviewed before bundling.
- A `RecognitionDiagnosticsConsent` gate is required before retaining raw sample input; ordinary attempts persist result summaries and engine version only.

## 7. Auth and recovery

- Use Better Auth on the Worker with D1 and HTTP-only secure cookies; sign-up defaults to learner.
- Password recovery is based on user-held high-entropy recovery code(s), hashed at rest and shown once. Code issuance/rotation requires a fresh authenticated session; reset consumes the code and revokes all sessions.
- Avoid requiring email sending for registration or recovery. If a free mailer is considered later, it must be optional and fail closed without billing or paid failover.
- Admin role bootstrap is an operator-controlled one-time command/migration, never an unauthenticated public endpoint.

## 8. Security and operations

- Zod or equivalent runtime schemas at every API boundary; small pagination/batch bounds; normalized IDs; parameterized D1 queries.
- Apply same-origin/CSRF protections to cookie-authenticated state changes, secure cookie flags in production, CSP/security headers, auth/recovery rate limits, and generic recovery responses.
- Never log passwords, recovery codes, session cookies, authorization headers, raw audio, or raw stroke samples.
- Use structured request IDs, aggregated metrics, and error categories with data minimization.
- SQL migrations are sequential and reviewed. Never run a remote migration without a prepared backup/export and explicit deployment step.

## 9. Portability and licensing

- Keep SQL in `migrations/`; repositories implement domain ports, not D1 calls throughout route handlers.
- Version API payloads and content bundles. Include data export/import scripts for accounts, progress, and provenance records.
- App source uses MIT. Every bundled data set, recognition engine/data, font, and audio asset retains its own notices and terms. A source is not included until redistribution terms are recorded.
- Current platform references (checked 2026-09-24): [Cloudflare React + Vite](https://developers.cloudflare.com/workers/framework-guides/web-apps/react/), [Workers Vite plugin](https://developers.cloudflare.com/workers/vite-plugin/), [D1 local development](https://developers.cloudflare.com/d1/best-practices/local-development/), [D1 migrations](https://developers.cloudflare.com/d1/reference/migrations/), [Better Auth D1 support](https://better-auth.com/blog/1-5), and [Cloudflare Email Service pricing](https://developers.cloudflare.com/email-service/platform/pricing/).
