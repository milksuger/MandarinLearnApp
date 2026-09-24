# Implementation plan and status

Work follows this order so domain and privacy decisions precede UI duplication. A checked item is completed only when the corresponding code/docs exist; it is not a claim of production deployment.

## Phase 0 — Spec and design source

- [x] Inspect repository and Stitch export archive.
- [x] Record user requirements, interface map, color tokens, data invariants, constraints, and acceptance gates.
- [x] Choose an initial Cloudflare-compatible application boundary and portable persistence contracts.
- [x] Record exact dependency/data/audio licenses in the source credits before preview release.

## Phase 1 — Runtime foundation and canonical schema

- [x] Create React/Vite/TypeScript app with the Cloudflare Workers Vite plugin and `/api/v1` worker entry.
- [x] Add versioned D1 migrations for identity extension tables, reusable learning graph, provenance, attempts, projections, recovery, and audit.
- [x] Add domain types, runtime validators, repository ports, D1 adapters, and explicit seed-content provenance.
- [x] Add `/health` and content-read APIs; confirm local D1 never points at production by default.

## Phase 2 — Accounts, sync, and privacy baseline

- [x] Wire Better Auth to D1; default new accounts to learner; add secure role checks and an operator-only first-owner bootstrap.
- [x] Implement one-time recovery codes without a paid mail/SMS sender; revoke sessions on password recovery.
- [x] Add profile/preferences, account export/deletion request, and append-only audit records.
- [x] Implement IndexedDB lesson cache/outbox, idempotent attempt batch API, acknowledgment, retry, and visible sync states.

## Phase 3 — Learner app from Stitch

- [x] Build phone sign-in/onboarding, Home, path chooser, and profile/settings.
- [x] Build contextual vocabulary/readings/examples and exact-context source-verified audio playback state.
- [x] Build responsive guided practice on mobile and iPad portrait/landscape; support touch/stylus, canvas controls, stroke hints, and separate feedback dimensions.
- [x] Build freehand recognition state machine, review queue, session summary, and skill/curriculum progress.

## Phase 4 — Admin portal

- [x] Build PC overview, learner directory, individual progress profile, content/audio provenance review, writing quality view, and audit/privacy screens.
- [x] Enforce role guards, audited profile access, masked identifiers, safe aggregate metrics, and no raw diagnostics by default.

## Phase 5 — Content/recognition quality and release

- [x] Select and license-check the bundled stroke-data/recognizer assets; record notices and tested version.
- [x] Import a source-verified initial word/character set and daily-life lesson seed without unlicensed bulk content.
- [x] Bundle licensed, exact-context audio with source attestation, pending pronunciation review, and admin review/takedown controls.
- [x] Document migrations, seed/import workflow, free-tier deployment, backup/export, security configuration, GitHub license/credits, and rollback.
- [ ] Perform the target-browser/device and security acceptance pass before any public deployment.

## Open decisions that remain gates

- [ ] Which HSK curriculum source may be redistributed, and under what exact terms?
- [ ] Which additional native-speaker audio assets can be licensed for the next content release?
- [ ] Which local freehand recognizer/data combination passes iPad Safari and third-party stylus checks while preserving the intended MIT application license?
- [ ] Exact content retention and audit retention periods before public community launch.
