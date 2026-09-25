# Course content and pronunciation data

## Content model

Published vocabulary is stored in the database as reusable word, contextual reading, localized gloss, example, character, and curriculum-placement records. Lesson order and HSK placement refer to those stable content IDs. Learner attempts are separate from the vocabulary item; do not turn this into a front/back flashcard table.

## Authored lessons

The September 2026 expansion sources are `content/course-expansion-2026-09-foundation.json` (32 terms) and `content/course-expansion-2026-09-advanced.json` (24 terms). They contain original Indonesian explanations, pinyin, examples, and placements under CC BY 4.0. They are not a copied dictionary, official HSK word list, or official examination syllabus.

The foundation source adds four lessons and placements to HSK 2.0 levels 4–6 and HSK 3.0 levels 4–6. The advanced source adds three daily-life units and app-authored placements at HSK 3.0 levels 7–9. These are app learning routes, not complete HSK syllabi. Current production content comprises 141 published vocabulary forms and 19 daily-life units.

To regenerate an additive course migration, pass both the source JSON and a new output path to `scripts/generate-course-expansion-migration.mjs`. Never overwrite a migration already applied to any environment. Add complete readings, glosses, examples, and independent curriculum placements; do not attach progress to lesson-card copies.

Hanzi Writer character geometry is redistributed unchanged from `hanzi-writer-data` 2.0.1 under the Arphic Public License. The dataset is not represented as an official education-ministry standard. The 262 simplified character files, source URLs, hashes, counts, and version are recorded in `content/stroke-assets-manifest.json`.

## Human pronunciation audio

As of migrations `0013`–`0021`, exact source-recorded human audio covers 137 of the 141 published simplified vocabulary forms. The manifest contains 139 audio entries; a word can have multiple readings or an alternate audio record. The public D1 database also contains one legacy duplicate alias of the same `你` recording. Audio is associated with a contextual reading rather than a character alone.

Recordings come from Wikimedia Commons Lingua Libre (`CC0`, `CC BY-SA 4.0`) and Shtooka (`CC BY 2.0 fr`, `CC BY-SA 3.0 us`). The importer verifies exact file title and transcription, Mandarin language identity, contributor/creator, MIME type, file-specific license and license URL, and original-byte SHA-1. It archives unchanged WAV/OGG originals and makes unedited MP3 compatibility transcodes. Attribution, profile/file links, hashes, duration, transformations, and license terms are in `content/audio-assets-manifest.json` and `THIRD_PARTY_NOTICES.md`. ShareAlike derivatives retain the applicable terms and attribution.

These are human community recordings according to their source-page metadata. They are not official government audio, studio-quality guarantees, or recordings that have each received a separate human pronunciation review. The source/license verification and pronunciation-review workflow are separate: an administrator can still reject or replace a recording. Do not claim that provenance verification certifies pronunciation quality.

The four published forms with no exact, redistributable human word recording found are `已经`, `早到`, `还没`, and `面条`. The Commons discovery pass scanned all 5,160 files in `Category:Chinese pronunciation` and all 4,122 files in `Category:Lingua Libre pronunciation-cmn`. A Shtooka clip for `面条儿` was excluded because it is an erhua pronunciation with an additional written `儿`, not the standard `面条` reading taught here. Do not substitute another word's audio or splice syllables together to fill a gap.

Where a source recording is absent, the learner may use a clearly labelled on-device `zh-CN` speech voice if the device has one installed. This is free local synthetic speech, depends on the operating system/voice, and is neither certified nor counted as a human recording. If no Chinese voice is installed, show playback as unavailable instead of selecting a different language.

## Adding source audio

Add a new dated JSON import specification and a monotonically numbered migration. Run `npm run content:import-pronunciation -- <spec.json>`. The importer records file-specific source metadata and hashes, checks that the transcription and reading agree, preserves source bytes, transcodes without speech editing, updates the manifest and attribution table, and emits the named migration. Do not edit an applied migration. File and license checks are deterministic; the importer does not listen to or certify audio quality.

## Publication scope

Daily-life learning covers greetings, family, time and routine, food, shopping, directions, health, weather, and additional intermediate/advanced situations. HSK 2.0 and HSK 3.0 labels organize app-authored material; they do not imply the official syllabus is complete or reproduced.
