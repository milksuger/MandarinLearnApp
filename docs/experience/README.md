# MandarinLearnApp experience library

This is the repository's working knowledge base for future Codex sessions and contributors. Record verified project behavior and reusable decisions here so they do not need to be rediscovered. Keep dated facts tied to evidence; do not turn a prior assumption into a permanent rule.

## Start here

1. Read the applicable requirements in [`research-and-architecture-baseline.md`](../research-and-architecture-baseline.md).
2. For lessons and assets, follow [`content-data.md`](../content-data.md) and the source manifests under `content/`.
3. For Cloudflare changes, follow [`deployment.md`](../deployment.md); use a production D1 export outside Git before applying a remote migration.
4. Check this file's decision notes, then add new source JSON and a new migration. Never edit a migration already applied in any environment.

## Stable product and architecture decisions

- The learner experience is for phones and tablets, especially iPad 8th generation with a third-party stylus. Admin desktop layout is a separate target.
- All user learning state is account-backed and synchronized through the backend/database. Browser storage is an offline queue/cache, not the source of truth.
- A word is a reusable content entity with contextual readings, Indonesian meanings, usage notes, examples, character relations, and multiple curriculum placements. Learner history references stable IDs and is independent of the lesson card.
- Mandarin must be simplified Chinese. Pinyin and tone are stored per syllable; a character may have multiple readings, so pronunciation belongs to a contextual `reading`, not a bare character.
- The HSK routes use public framework/level labels as navigation. Original app content may be organized into those routes, but it must not be represented as an official copied HSK word list or official exam preparation syllabus.
- No paid services. Use an exact licensed recording when available. For uncovered words, the learner may use the browser/device's installed Simplified Mandarin (`zh-CN`) speech voice, labeled as device speech; do not claim it is a human recording, call a paid TTS endpoint, splice syllables, or imply all devices have the same voice.
- The application is MIT licensed; each data set, voice recording, and recognition component keeps its own license and source attribution.

## Content authoring checklist

- Design lessons for a learning path, not a list of isolated definitions: sequence concrete high-frequency language before less common abstract language; revisit old words in new contexts.
- Each word needs a stable unique ID, simplified form, part of speech, tone-marked pinyin for each spoken syllable, matching tone-number pinyin, Indonesian gloss, usage note, natural simplified example, syllable-aligned example pinyin/tone numbers, and Indonesian translation.
- Check polyphonic characters in the actual word. Check neutral tones, common particles, and third-tone sequences; do not mechanically assign a character's most common standalone sound.
- Examples should sound like something a learner could actually say. Keep punctuation outside pinyin arrays. The count of pinyin syllables must match the Han character count for the current schema.
- A lesson should have a clear communicative goal and about 6–10 new words. Keep daily-life placement and HSK-style placement independent so one entry can be reused without duplicating meaning or progress.
- Introduce a grammar pattern in an Indonesian usage note and demonstrate it with a natural example. Avoid claiming that one sentence covers every use of a pattern.
- When a word requires stroke practice, make sure every Han character has licensed stroke data and the file/hash/version are present in `content/stroke-assets-manifest.json`.
- Newly authored course text and examples are attributed separately under CC BY 4.0. Do not bundle third-party dictionary definitions or HSK list text unless reuse and attribution terms are verified.

## Asset and quality lessons

- Source verification and quality review are different facts. A matching source filename, native-language profile, license, and checksum establish provenance/reuse evidence; they do not certify a correct or high-quality recording.
- For audio, verify the exact source file title/form, Mandarin language tag, speaker/recorder attribution, exact license, source bytes/hash, derivative hash, format, and duration. Retain the untouched source. CC BY-SA derivatives must retain the applicable license and attribution.
- Lingua Libre is a community recording collection, not an official government pronunciation authority. Describe it accurately in the app credits and preserve an admin route to reject or replace an asset.
- Hanzi Writer Data 2.0.1 is reusable under the included Arphic Public License; it is not asserted to be a Ministry of Education standard. Preserve the upstream file and per-character checksum.
- Never expose raw downloaded API metadata HTML as creator text. Normalize creator, recorder, profile, and source title into explicit fields for the database and credits page.

## Workflow and operational lessons

- The generated SQL is an immutable release artifact; human-readable JSON is the editable content source. Regenerate before adding the migration. Record the exact source file and generator in docs.
- Run the generator and production build, then inspect the migration and data counts. For release, export D1 to a protected temp location outside the repository, apply the migration, deploy, and verify live lesson-to-asset links and served file hashes.
- Do not use local-only D1 or IndexedDB evidence as proof that production was updated. Verify the production API after a deploy.
- Tool failures are not root-cause evidence. For example, AnySearch may return a temporary capability error; disclose it, then use a suitable public/primary-source fallback and mark what was directly verified.
- TypeSafe/Jev returns structured judgments to support choices. A probability/confidence score is not proof of truth; keep deterministic checks and source evidence in code and treat Jev's choice as a prioritization aid.
- Existing vocabulary audio coverage is partial. Playback should prefer source-attested assets and clearly label built-in device speech as the free fallback. Device speech is not a downloadable audio asset and can vary by operating system/installed voice.

### 2026-09-25 course and playback update

- Added 32 foundation/intermediate words and 24 upper-intermediate words, totaling seven new daily-life units. HSK 2.0 levels 4/5/6 and HSK 3.0 levels 4–9 now have app-authored learning placements; this is not the complete official HSK syllabus. Local inspection found that HSK 2.0 level 1 already had 20 placements; trust the database and migration history over earlier content notes.
- Native-browser playback is an on-device fallback for words without a bundled exact recording. It must select only `zh-CN`, identify itself as device speech, and explain when the user's device has no Mandarin voice. Bundled source recordings remain separately attributed and are preferred.
- Generator accepts an explicit source JSON and output migration path; this enables additive releases without rewriting a migration already applied.

## Dated decisions

### 2026-09-25

- Added 20 exact Lingua Libre Mandarin word recordings to the 56-word course expansion. Fourteen are CC0 and six CC BY-SA 4.0. Other words without exact licensed recordings now use a clearly labeled local `zh-CN` device voice when installed; those are not stored source recordings.
- Production verification checked all 20 new audio endpoints against the committed MP3 SHA-256. Admin pronunciation review remains available; source attestation and human pronunciation review are separate fields.
- AnySearch temporarily returned `Capabilities temporarily unavailable` during content research. The task continued using official/primary pages after disclosing the outage.
- The advanced course expansion lives in `content/course-expansion-2026-09-advanced.json` and is emitted as immutable migration `0015_expand_upper_intermediate_course.sql`; all referenced simplified character stroke files are in the manifest. The generator normalizes marked ü (`ǚ`) to numbered-pinyin `v` before checking.

### 2026-09-25 interface update

- Learner navigation must remain visible on phone and tablet widths, including 768–1100 CSS pixel tablet landscape. Keep the fixed bottom bar above the safe area and reserve content padding so it does not cover lesson actions.
- Never use browser history as the only way out of the path chooser. The path chooser returns to `/`, and each curriculum path returns to `/paths`; the chooser itself must also return to `/` to prevent the `/paths` ↔ path-detail loop.
- Use Lucide SVG icons instead of isolated Chinese glyphs in course-category tiles. The home illustration is decorative and credited in-app.

### 2026-09-25 pronunciation expansion

- Exact human recording coverage is 137/141 published word forms. The Commons manifest contains 139 entries; one legacy DB row is an alternate reading alias of an already represented `你` recording. Four exact word forms remain without a redistributable source recording: `已经`, `早到`, `还没`, and `面条`.
- New imports `0016`–`0021` include exact Lingua Libre and Shtooka word files. Supported licenses now include CC0, CC BY-SA 4.0, CC BY 2.0 fr, and CC BY-SA 3.0 US. Preserve the exact file metadata, creator/speaker, license, hash, and original audio for each item.
- A full Wikimedia Commons title scan covered the 5,160-file Chinese pronunciation category and the 4,122-file Lingua Libre Mandarin category. The available `面条儿` clip is an erhua/form variant and is not an exact substitute for `面条`.
- Source/licensing attestation is independent from listening review. This user explicitly asked not to make per-file human review a publication blocker; keep admin correction/rejection tools and never describe a source-verified clip as officially certified or manually reviewed.
- AnySearch was used for candidate discovery and Jev was used once to prioritize the safe search policy. Jev's structured judgment is a choice aid only; Commons metadata and source hashes remain the evidence.
