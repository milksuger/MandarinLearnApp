# MandarinLearnApp

An open-source Mandarin-learning app for Indonesian-speaking learners. The initial product focuses on reliable pronunciation playback and Chinese-character writing practice, with both a daily-vocabulary path and a versioned HSK curriculum.

## Project status

The project is moving from prototype into a spec-driven implementation. The user-provided Stitch export is the visual reference; the functional and data requirements in `specs/001-platform-foundation/` are the implementation source of truth. Prototype values are fictional and are not production analytics or verified curriculum data.

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
- No paid runtime speech, handwriting-recognition, email, or hosting services. Pronunciation playback uses only exact, approved audio assets; missing audio remains visibly unavailable. Freehand recognition must be local/offline and report uncertainty honestly.

## Sources and licensing

The application source code is licensed under the MIT License; see [LICENSE](LICENSE). Dictionary, stroke-order, fonts, voice models, and audio resources keep their own source-specific terms. No third-party dataset or audio is included in this design-stage repository. Before importing or publishing any asset, record its source, version, license, attribution, checksum, and review status in the project credits/provenance records.

The product has a zero-paid-service requirement. It is planned around free-tier hosting and locally generated or appropriately licensed, human-reviewed audio assets. If free quotas are exhausted, the app must degrade safely or pause the affected operation; it must not silently switch to a paid service or upgrade.

## Administrator portal

The protected admin experience includes aggregate service/content health and audited access to an individual learner's progress. Routine admin views show learning results and attempt metadata, not raw handwriting or microphone recordings. See the dedicated [admin Stitch prompt](docs/admin-stitch-prompt.md).
