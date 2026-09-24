# MandarinLearnApp

An open-source Mandarin-learning app for Indonesian-speaking learners. The initial product focuses on reliable pronunciation playback and Chinese-character writing practice, with both a daily-vocabulary path and a versioned HSK curriculum.

## Project status

This repository now contains the first runnable Cloudflare preview implementation, based on the user-provided Stitch export and the product decisions in `specs/001-platform-foundation/`. It is an early content preview, not a complete HSK course: the seeded lesson currently contains the greeting 你好 and its two characters.

## Design documents

- [Google Stitch prototype prompt](docs/stitch-prototype-prompt.md)
- [Administrator portal Stitch prompt](docs/admin-stitch-prompt.md)
- [Research and architecture baseline](docs/research-and-architecture-baseline.md)
- [Stitch export visual reference](docs/stitch-design-reference.md)
- [Product spec](specs/001-platform-foundation/spec.md)
- [Architecture decisions](specs/001-platform-foundation/architecture.md)
- [Implementation order and status](specs/001-platform-foundation/tasks.md)

## Platforms

The learner app targets phones and tablets only, with special attention to stylus writing on iPad (8th generation); a learner-facing PC layout is out of scope. The protected administrator portal is designed for PC browsers. Accounts and server-backed progress synchronization are required. Local storage may cache lessons and queue offline attempts, but the server remains the canonical account record.

## Current implementation direction

- React + TypeScript + Vite for the mobile/tablet learner PWA and PC-only admin portal.
- Cloudflare Workers for the versioned API and D1 for canonical account, curriculum, activity, and audit records.
- Provider-independent domain/repository contracts and SQL migrations to make a later database move practical.
- No paid runtime speech, handwriting-recognition, email, or hosting services. Pronunciation playback uses exact contextual recordings whose source/license is verified, or which receive an individual pronunciation review. Missing audio remains unavailable; no synthesized or syllable-spliced fallback is used.
- Starter preview: account registration/sign-in, server-backed learner records and sync, phone/tablet writing practice, local freehand handwriting suggestions, the desktop admin portal, stroke guidance for 你/好, and sourced recordings for 你 and 你好. The 你好 recording is community audio with an unidentified speaker; it is not described as an official government recording. Standalone 好 audio is not yet bundled.
- The initial curriculum schema supports reusable daily-life and versioned HSK paths. A complete, redistributable HSK vocabulary set is not bundled yet; the app must not imply that the current one-lesson preview is a complete curriculum.
- Standalone `好` pronunciation is intentionally marked unavailable until an exact-context, reusable recording is sourced.

## Sources and licensing

The application source code is licensed under the MIT License; see [LICENSE](LICENSE). Dictionary, stroke-order, fonts, voice models, and audio resources keep their own source-specific terms. The starter release bundles Arphic-licensed Hanzi Writer stroke data and two openly licensed Wikimedia recordings; sources, checksums, attribution, transformation details, and licenses are recorded in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md), [content/stroke-assets-manifest.json](content/stroke-assets-manifest.json), and migration `0005_source_verified_assets.sql`.

The product has a zero-paid-service requirement. It uses free-tier hosting and appropriately licensed recordings. Source and license verification can make an unchanged upstream asset available while retaining a pronunciation-review field and admin review/takedown controls. This does not claim official government certification. If free quotas are exhausted, the app must degrade safely or pause the affected operation; it must not silently switch to a paid service or upgrade.

## Administrator portal

The protected admin experience includes aggregate service/content health and audited access to an individual learner's progress. Routine admin views show learning results and attempt metadata, not raw handwriting or microphone recordings. See the dedicated [admin Stitch prompt](docs/admin-stitch-prompt.md).

## Cloudflare preview deployment

The app uses one Cloudflare Worker and a project-specific D1 database. Static files, including the small starter audio/stroke assets, ship with the Worker so the preview does not require an R2 bucket. Do not commit secrets.

1. Install dependencies with `npm ci` and configure Wrangler authentication.
2. Put a random 32+ character `BETTER_AUTH_SECRET` in the Worker secret store and set `APP_URL` to the final HTTPS Worker origin.
3. Apply versioned schema/data migrations with `npm run db:migrate:remote`.
4. Deploy with `npm run deploy`.

The current `wrangler.jsonc` is connected to the preview D1 database. For another environment, create its own D1 database and replace the database ID. Admin owner bootstrap requires an account to be registered first and a temporary `BOOTSTRAP_ADMIN_SECRET`; remove that Worker secret immediately after bootstrap. See [deployment and data operations](docs/deployment.md) for the full procedure.
