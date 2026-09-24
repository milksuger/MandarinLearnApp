# MandarinLearnApp

An open-source Mandarin-learning app for Indonesian-speaking learners. The initial product focuses on reliable pronunciation playback and Chinese-character writing practice, with both a daily-vocabulary path and a versioned HSK curriculum.

## Project status

This repository is in the product-design stage. The current deliverable is a Google Stitch prototype prompt and a research/architecture baseline. Application code, licensed content imports, and deployment have not started.

## Design documents

- [Google Stitch prototype prompt](docs/stitch-prototype-prompt.md)
- [Administrator portal Stitch prompt](docs/admin-stitch-prompt.md)
- [Research and architecture baseline](docs/research-and-architecture-baseline.md)

## Platforms

The product is planned as a responsive web app for desktop, phone, and iPad, with special attention to stylus writing on iPad (8th generation). Accounts and server-backed progress synchronization are required. Local storage may cache lessons and queue offline attempts, but the server remains the canonical account record.

## Sources and licensing

The application source code is licensed under the MIT License; see [LICENSE](LICENSE). Dictionary, stroke-order, fonts, voice models, and audio resources keep their own source-specific terms. No third-party dataset or audio is included in this design-stage repository. Before importing or publishing any asset, record its source, version, license, attribution, checksum, and review status in the project credits/provenance records.

The product has a zero-paid-service requirement. It is planned around free-tier hosting and locally generated or appropriately licensed, human-reviewed audio assets. If free quotas are exhausted, the app must degrade safely or pause the affected operation; it must not silently switch to a paid service or upgrade.

## Administrator portal

The protected admin experience includes aggregate service/content health and audited access to an individual learner's progress. Routine admin views show learning results and attempt metadata, not raw handwriting or microphone recordings. See the dedicated [admin Stitch prompt](docs/admin-stitch-prompt.md).
