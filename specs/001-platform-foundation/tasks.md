# Implementation plan and status

Work follows this order so domain and privacy decisions precede UI duplication. A checked item is completed only when the corresponding code/docs exist; it is not a claim of production deployment.

## Phase 0 — Spec and design source

- [x] Inspect repository and Stitch export archive.
- [x] Record user requirements, interface map, color tokens, data invariants, constraints, and acceptance gates.
- [x] Choose an initial Cloudflare-compatible application boundary and portable persistence contracts.
- [ ] Record exact dependency/data/audio licenses in the source credits before public release.

## Phase 1 — Runtime foundation and canonical schema

- [ ] Create React/Vite/TypeScript app with the Cloudflare Workers Vite plugin and `/api/v1` worker entry.
- [ ] Add versioned D1 migrations for identity extension tables, reusable learning graph, provenance, attempts, projections, recovery, and audit.
- [ ] Add domain types, runtime validators, repository ports, D1 adapters, and explicit seed-content provenance.
- [ ] Add `/health` and content-read APIs; confirm local D1 never points at production by default.

## Phase 2 — Accounts, sync, and privacy baseline

- [ ] Wire Better Auth to D1; default new accounts to learner; add secure role checks and an operator-only first-owner bootstrap.
- [ ] Implement one-time recovery codes without a paid mail/SMS sender; revoke sessions on password recovery.
- [ ] Add profile/preferences, account export/deletion request, and append-only audit records.
- [ ] Implement IndexedDB lesson cache/outbox, idempotent attempt batch API, acknowledgment, retry, and visible sync states.

## Phase 3 — Learner app from Stitch

- [ ] Build phone sign-in/onboarding, Home, path chooser, HSK overview, and profile/settings.
- [ ] Build contextual vocabulary/readings/examples and exact-approved-audio playback state.
- [ ] Build responsive guided practice on mobile and iPad portrait/landscape; support touch/stylus, canvas controls, stroke hints, and separate feedback dimensions.
- [ ] Build freehand recognition state machine, review queue, session summary, and skill/curriculum progress.

## Phase 4 — Admin portal

- [ ] Build PC overview, learner directory, individual progress profile, content/audio provenance review, writing quality view, and audit/privacy screens.
- [ ] Enforce role guards, audited profile access, masked identifiers, safe aggregate metrics, and no raw diagnostics by default.

## Phase 5 — Content/recognition quality and release

- [ ] Select and license-check the bundled stroke-data/recognizer assets; record notices and tested version.
- [ ] Import a reviewed initial word/character set and full curriculum placement skeleton without unlicensed bulk content.
- [ ] Assemble only licensed, exact-context audio candidates; keep them unavailable to learners until a reviewer approves them.
- [ ] Document migrations, seed/import workflow, free-tier deployment, backup/export, security configuration, GitHub license/credits, and rollback.
- [ ] Perform the target-browser/device and security acceptance pass before any public deployment.

## Open decisions that remain gates

- [ ] Which first curriculum/content source may be redistributed, and under what exact terms?
- [ ] Which native-speaker audio assets can be licensed and reviewed for the first release?
- [ ] Which local freehand recognizer/data combination passes iPad Safari and third-party stylus checks while preserving the intended MIT application license?
- [ ] Exact content retention and audit retention periods before public community launch.
