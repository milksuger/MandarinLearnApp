# MandarinLearnApp

An open-source Mandarin-learning app for Indonesian-speaking learners. The initial product focuses on reliable pronunciation playback and Chinese-character writing practice, with both a daily-vocabulary path and a versioned HSK curriculum.

## Project status

This repository is in the product-design stage. The current deliverable is a Google Stitch prototype prompt and a research/architecture baseline. Application code, licensed content imports, and deployment have not started.

## Design documents

- [Google Stitch prototype prompt](docs/stitch-prototype-prompt.md)
- [Research and architecture baseline](docs/research-and-architecture-baseline.md)

## Platforms

The product is planned as a responsive web app for desktop, phone, and iPad, with special attention to stylus writing on iPad (8th generation). Accounts and server-backed progress synchronization are required. Local storage may cache lessons and queue offline attempts, but the server remains the canonical account record.

## Sources and licensing

The repository is intended to be public. The software license still needs to be selected. Dictionary, stroke-order, and audio resources have separate source-specific terms; no third-party dataset or generated audio is included in this design-stage repository. Before publication, each imported asset must have a recorded source, version, license, attribution, and review status.
