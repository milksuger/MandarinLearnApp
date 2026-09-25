# Project guidance for coding agents

Before changing course data, audio, or stroke assets, read [`docs/experience/README.md`](docs/experience/README.md) and the relevant section in [`docs/content-data.md`](docs/content-data.md).

- Keep language content, curriculum placement, learner attempts, and progress as separate records. Do not collapse learning into duplicated flashcard rows.
- Treat applied SQL migrations as immutable. Edit source data, add a new dated/versioned migration, validate it locally, back up production outside the repository, then deploy.
- Write original simplified-Chinese learning material for Indonesian speakers. Do not copy HSK vocabulary lists or imply that app placements are official exam classifications.
- Preserve per-syllable pinyin, tone numbers, localized meaning, usage guidance, and a natural example with aligned pinyin and Indonesian translation. Validate character and pinyin counts before publishing.
- Prefer the exact, licensed recording for a reading. If none exists, use the browser's installed `zh-CN` system voice as a clearly labeled device-generated fallback; never call a paid speech service, splice syllables, or present generated speech as a sourced human recording.
- Keep upstream data and attribution separate from the MIT application license. Retain source links, exact licenses, hashes, and transformations; update both the learner-facing credits and `THIRD_PARTY_NOTICES.md`.
- Stay within the user's zero-paid-service constraint and Cloudflare free-tier deployment plan. Never silently enable a billable provider or upgrade.
- Use a scoped D1 export outside the repository before remote migrations, and never commit production exports, secrets, or account data.
