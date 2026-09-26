# Course content and pronunciation data

## Content model

Published vocabulary is stored in the database as reusable word, contextual reading, localized gloss, example, character, and curriculum-placement records. Lesson order and HSK placement refer to those stable content IDs. Learner attempts are separate from the vocabulary item; do not turn this into a front/back flashcard table.

## Authored lessons

The September 2026 expansion sources are `content/course-expansion-2026-09-foundation.json` (32 terms) and `content/course-expansion-2026-09-advanced.json` (24 terms). They contain original Indonesian explanations, pinyin, examples, and placements under CC BY 4.0. They are not a copied dictionary, official HSK word list, or official examination syllabus.

The foundation source adds four lessons and placements to HSK 2.0 levels 4–6 and HSK 3.0 levels 4–6. The advanced source adds three daily-life units and app-authored placements at HSK 3.0 levels 7–9. These are app learning routes, not complete HSK syllabi. The production snapshot audited on 2026-09-25 contains 138 distinct published vocabulary forms and 19 daily-life units. The dated audit and its counting rules are in [`docs/research/audio-coverage-2026-09-25.md`](research/audio-coverage-2026-09-25.md).

To regenerate an additive course migration, pass both the source JSON and a new output path to `scripts/generate-course-expansion-migration.mjs`. Never overwrite a migration already applied to any environment. Add complete readings, glosses, examples, and independent curriculum placements; do not attach progress to lesson-card copies.

Structured scenario content is authored in [`content/scenario-content-2026-09.json`](../content/scenario-content-2026-09.json) and shipped as immutable snapshots in migrations `0024` and `0025`. This release adds reusable grammar points, dialogues, short readings, and an optional app-authored starting-point diagnostic. Their use of HSK-like complexity is an internal learning recommendation only; it does not reproduce the official test, list, or syllabus. A future content release must add a new source JSON version and additive migration, validate that each Mandarin text matches its pinyin syllable count, and preserve the same CC BY 4.0 attribution.

Migration `0026` adds original scenario-output prompts to four introductory daily-life units as a fifth lesson step. Learners can save a short Mandarin response and self-assessment to their authenticated account. Responses are private to that learner; admin reporting receives completion and self-assessment status only, never the response text. This is not automated correction and does not claim that the sentence is correct.

Hanzi Writer character geometry is redistributed unchanged from `hanzi-writer-data` 2.0.1 under the Arphic Public License. The dataset is not represented as an official education-ministry standard. The 262 simplified character files, source URLs, hashes, counts, and version are recorded in `content/stroke-assets-manifest.json`.

The login-page learning companion at `public/images/auth-learning-companion.png` is an original AI-generated illustration made with OpenAI ImageGen on 2026-09-25. It was generated for this project without third-party reference artwork; it contains no logos or copied course assets.

## Human pronunciation audio

In the production snapshot audited on 2026-09-25, source-recorded human audio covers 134 of 138 distinct published simplified vocabulary forms (97.1%). This count is by vocabulary form; repeated placements in daily-life and HSK routes do not increase the distinct-word denominator. The repository manifest contains 139 playable audio files; the public D1 database has 140 approved rows because one is a legacy alias of an already represented `你` recording. Audio is associated with a contextual reading rather than a character alone. Three of the 140 approved rows passed manual pronunciation review, 137 remain pending, and none are marked failed. Source/license verification and pronunciation review are separate.

Recordings come from Wikimedia Commons Lingua Libre (`CC0`, `CC BY-SA 4.0`) and Shtooka (`CC BY 2.0 fr`, `CC BY-SA 3.0 us`). The importer verifies exact file title and transcription, Mandarin language identity, contributor/creator, MIME type, file-specific license and license URL, and original-byte SHA-1. It archives unchanged WAV/OGG originals and makes unedited MP3 compatibility transcodes. Attribution, profile/file links, hashes, duration, transformations, and license terms are in `content/audio-assets-manifest.json` and `THIRD_PARTY_NOTICES.md`. ShareAlike derivatives retain the applicable terms and attribution.

These are human community recordings according to their source-page metadata. They are not official government audio, studio-quality guarantees, or recordings that have each received a separate human pronunciation review. The source/license verification and pronunciation-review workflow are separate: an administrator can still reject or replace a recording. Do not claim that provenance verification certifies pronunciation quality.

Four canonical course readings still have no imported recording that matches their taught tone annotation and has a confirmed file-specific redistribution license: `已经` (`yǐ jīng`), `早到`, `还没`, and `面条`. A Commons Shtooka recording for `已经` is labeled `yǐjing` with a neutral final syllable; it is not attached to the course's `yǐ jīng` reading. A separate public audio collection contains an `已经` file but only states a generic `CC-by-sa` license and points to an upstream license page that could not be verified during the audit. Neither candidate is imported until the reading/license evidence is sufficient. A Shtooka clip for `面条儿` remains excluded because it is an erhua pronunciation with an additional written `儿`, not the standard `面条` reading taught here. Do not substitute another word's audio or splice syllables together to fill a gap.

Where a source recording is absent, the learner may use a clearly labelled on-device `zh-CN` speech voice if the device has one installed. This is free local synthetic speech, depends on the operating system/voice, and is neither certified nor counted as a human recording. If no Chinese voice is installed, show playback as unavailable instead of selecting a different language.

## Adding source audio

Add a new dated JSON import specification and a monotonically numbered migration. Run `npm run content:import-pronunciation -- <spec.json>`. The importer records file-specific source metadata and hashes, checks that the transcription and reading agree, preserves source bytes, transcodes without speech editing, updates the manifest and attribution table, and emits the named migration. Do not edit an applied migration. File and license checks are deterministic; the importer does not listen to or certify audio quality.

Sentence recordings use the additive schema in migration `0029_sentence_audio_assets.sql`. They are separate from vocabulary/character `readings` and attach to stable `examples`, `dialogue_turns`, or `story_paragraphs` through typed foreign-key tables. Lesson APIs return a sentence audio ID only when the exact source license is verified and the asset is approved plus either manually passed or source-attested. Existing word-audio records and the `/api/v1/audio/:assetId` contract remain compatible. Sentence content must use real recordings only: when one is unavailable, show a disabled human-recording control and never invoke device speech synthesis. Do not bulk-import from Tatoeba: its contributor chooses each audio file's license, and blank license means reuse outside Tatoeba is not permitted.

On 2026-09-26, a read-only sweep of all published curriculum placements compared each returned audio ID against the manifest's simplified text: 352 placements referenced 134 unique audio IDs and none had a text mismatch or missing manifest entry. The live `word-nihao` record returned `audio-nihao`, whose manifest text/pinyin are `你好` / `nǐ hǎo`; its source file is explicitly titled for that phrase. This verifies the database/API-to-manifest association, not a human listening audit of every file. The tone-change example and exact-match `你好` placement question now explicitly use `audio-nihao` instead of device speech.

The 2026-09-26 sentence-level source scan queried 130 distinct published examples, dialogue turns, and story paragraphs against Tatoeba. Three exact-text human-audio candidates were returned, each with a blank per-audio license, so none was imported. The only currently linked sentence recording is the existing verified human phrase `你好` reused for the dialogue `你好！` after terminal-punctuation normalization. The remaining 129 targets have no approved exact human recording and must not use synthetic speech.

## Publication scope

Daily-life learning covers greetings, family, time and routine, food, shopping, directions, health, weather, and additional intermediate/advanced situations. HSK 2.0 and HSK 3.0 labels organize app-authored material; they do not imply the official syllabus is complete or reproduced.
