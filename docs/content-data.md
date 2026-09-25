# Course content data and updates

## Content model

Published words are versioned database records. A word links to one or more readings, localized glosses, examples, character records, and curriculum placements. Lesson order and curriculum membership live in `curriculum_placements`, not in a client-side card list. Audio remains an independent exact-reading asset; a word without a verified recording does not inherit another word's audio.

## Authored expansion (September 2026)

`content/course-expansion-2026-09.json` is the editable source for this release's 56 new words, Indonesian explanations, pinyin, example sentences, and course placement. These are project-authored learning materials under CC BY 4.0. They are not a copied dictionary, official HSK word list, or official examination syllabus. The HSK curricula use public level numbering as navigation; each exercise selection is authored for this app.

The source data includes simplified characters only. The generator checks unique IDs and forms, syllable counts against Han character counts, pinyin and numbered-tone alignment, lesson references, placement duplicates, and availability of every required stroke asset before it emits `migrations/0012_expand_course_content.sql`.

To extend the data, add complete entries and unit placements to the JSON, import any missing unchanged Hanzi Writer data through `npm run content:import-strokes -- <简体汉字>`, then run `npm run content:generate-expansion`. For a later release, use a new dated source JSON and a new migration; never edit a migration already applied to any environment.

Hanzi Writer character geometry is redistributed unchanged from `hanzi-writer-data` 2.0.1 under the Arphic Public License. It is not represented as an official education-ministry standard. Per-character hashes, source links, and attribution are retained in `content/stroke-assets-manifest.json` and the database.

## Word audio and provenance

`content/pronunciation-import-2026-09.json` curates exact word recordings for 20 of the 56 new words. `npm run content:import-pronunciation` looks up each exact Commons file, rejects a mismatch in the simplified form, `cmn` tag, speaker profile, audio type, or license, checks downloaded bytes against Commons SHA-1, archives the original WAV, and transcodes an unedited MP3. It updates `content/audio-assets-manifest.json`, the generated license table in `THIRD_PARTY_NOTICES.md`, and the migration named by `migrationFile` in the import specification.

The served voice tracks are human community contributions, not government-certified recordings. The selected Lingua Libre profiles list Mandarin Chinese as a native language; individual pronunciation review remains available in the admin queue. Audio without a matching source stays unavailable: no unrelated syllables are concatenated and no fallback TTS is used. For CC BY-SA 4.0 recordings, the compatibility MP3 derivative keeps the same license and attribution. Original WAV files, per-source terms, profile links, and original/product hashes remain in the repository.

When adding more recordings, create a new dated specification, choose a new monotonically numbered migration filename, and add exact file titles and profile/license metadata. Do not edit any migration already applied to an environment. Inspect/verify profile and source terms before adding the mapping; the importer repeats file-level checks but does not judge sound quality by listening.

## Current publication scope

This release extends daily-life learning through greetings, family, time and routine, food, shopping, directions, health, and weather. HSK 2.0 levels 1–3 and HSK 3.0 levels 1–3 contain exercises; higher levels remain visible as framework navigation and need separately authored content. This is a substantial starter library, not a claim that every curriculum level is complete.
