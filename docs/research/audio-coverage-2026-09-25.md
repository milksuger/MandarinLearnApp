# Course and human-audio coverage audit — 2026-09-25

This is a read-only production snapshot and repository-media audit. No course rows or production assets were changed during the audit.

## Counting rules

- Vocabulary coverage counts distinct approved simplified vocabulary forms placed in published units. A form repeated in daily-life, HSK 2.0, and HSK 3.0 is one word for the global word-coverage denominator and one placement in each applicable course denominator.
- “Human recording available” means an approved audio asset exists for an approved contextual reading and is playable through the production API because its source is attested or its pronunciation review passed. Browser `speechSynthesis` is device-generated speech and is excluded.
- A source/license attestation is not a pronunciation-quality review. The database's `pronunciation_review` value is reported separately.
- Example, dialogue, story, and single-character recordings are not inferred from the existence of a related vocabulary recording.

## Production curriculum snapshot

| Course | Published units | Vocabulary placements | Distinct vocabulary forms | Forms with examples | Forms with playable word audio |
| --- | ---: | ---: | ---: | ---: | ---: |
| Daily life | 19 | 138 | 138 | 121 | 134 |
| HSK 2.0 | 6 | 100 | 100 | 89 | 98 |
| HSK 3.0 | 9 | 124 | 124 | 113 | 120 |
| Total placements | 34 | 362 | 138 across all routes | — | 352 placements |

Global word-audio coverage is **134/138 (97.1%)**. Placement coverage is **352/362 (97.2%)**; the larger apparent placement gap is caused by the same four words being reused across courses. The four words without an imported audio match for their canonical taught reading are `已经` (`yǐ jīng`), `早到` (`zǎo dào`), `还没` (`hái méi`), and `面条` (`miàn tiáo`). They affect ten placements in total.

All 185 distinct characters linked from course vocabulary have approved stroke data. Only one of those 185 has an approved character-level audio reading; word-level audio coverage must not be reported as single-character coverage.

Daily-life units all have vocabulary, reading, comprehension, and writing activities. Four also have a scenario-output activity. Approved grammar and dialogues occur in three daily-life units each; approved stories occur in two. The HSK 2.0 and HSK 3.0 units have vocabulary, reading, comprehension, and writing activities, but no approved grammar, dialogue, or story content. No curriculum unit has an activity explicitly typed as listening or speaking. This is a lesson-catalog count; the app also has a separate speaking-practice route.

There are 121 approved course example records, eight approved dialogue turns, and two approved story paragraphs. Examples have no dedicated sentence-audio association or playback control in the lesson flow. The eight dialogue turns have no `reading_id`; dialogue and story playback uses labeled local device speech. Therefore **none of these 131 example/dialogue/story text units is backed by a linked human sentence recording**.

## Production audio and file integrity

- Production D1 reports 140 approved audio-asset rows: 140 source-attested, 3 manually passed, 137 pending, and 0 failed. All 140 rows join to a source record whose license verification is marked verified.
- `content/audio-assets-manifest.json` contains 139 distinct product-file paths. All 139 files exist in the checkout, and every file's SHA-256 matches the manifest. The extra production row is a legacy alias of the `你` recording.
- A GET to the public `audio-nihao` endpoint returned HTTP 200 with `audio/mpeg`. This was a playback-delivery spot check, not a full HTTP/hash check of every production asset.
- The deployed Worker uses the static `ASSETS` binding for bundled files; this project has no configured R2 media binding.

## Candidate-source review for the four uncovered forms

### `已经`

Commons has [File:Zh-yǐjing.ogg](https://commons.wikimedia.org/wiki/File:Zh-y%C7%90jing.ogg), described as Mandarin from a male speaker in Beijing and licensed CC BY 2.0 FR. Its file title and description use `yǐjing`, with a neutral final syllable. Wiktionary lists `yǐjing` as a toneless-final variant of `yǐjīng` on its [Mandarin pronunciation entry](https://en.wiktionary.org/wiki/%E5%B7%B2%E7%B6%93#Mandarin). This is a plausible alternate pronunciation, but it does not match the course's stored `yi3 jing1` reading. It was not imported or relabeled as the canonical reading. If later supported as an alternate, it needs a separate reading row, visible tone/variant label, and audio selection that cannot override the canonical recording.

The [audio-cmn repository](https://github.com/hugolpz/audio-cmn) also contains a `96k/hsk/cmn-已经.mp3` file and identifies the word collection's speaker as Yue Tan. Its README gives only generic “CC-by-sa” terms and links to the original [Shtooka pack license/readme](http://packs.shtooka.net/cmn-caen-tan/readme.txt). That upstream host did not resolve during the audit, so the precise license version and file-specific attribution could not be independently confirmed. This candidate was not imported. The same repository path did not contain exact simplified filenames for `早到`, `还没`, or `面条`.

### Other three forms

The current AnySearch pass and direct Commons namespace-title queries found no exact Mandarin word recording for `早到`, `还没`, or `面条`. The previously audited `面条儿` Shtooka file is not an exact replacement: it adds erhua and an additional written `儿`.

The repository's earlier full category scan covered 5,160 files in [Category:Chinese pronunciation](https://commons.wikimedia.org/wiki/Category:Chinese_pronunciation) and 4,122 files in [Category:Lingua Libre pronunciation-cmn](https://commons.wikimedia.org/wiki/Category:Lingua_Libre_pronunciation-cmn). The present search did not find a new exact candidate for those three words.

## Source and reuse notes

[Lingua Libre](https://lingualibre.org/) describes itself as a participatory linguistic media library. A community source page and a verified license establish provenance/reuse conditions, not studio quality or an individual listening review. Commons' [Shtooka project page](https://commons.wikimedia.org/wiki/Commons:Shtooka) says each audio collection has its own license, so the individual file/collection terms matter. The Forvo [API terms](https://api.forvo.com/documentation/general-information/) state that generated audio links expire after two hours and that caching is not allowed; it is not a suitable source for files bundled and served from this app.

## Jev and search-tool note

AnySearch was available and used for candidate discovery and page extraction; its results were then checked against Commons file metadata, a Wiktionary pronunciation entry, and the source repository. No callable Jev tool was present in this Codex session, and `TYPESAFE_API_KEY` was absent, so no Jev judgment was sent. Jev would not replace file-level license verification or a human pronunciation check.

## Recommended follow-up

1. Keep the four canonical readings marked as lacking bundled human audio until the exact reading and reuse rights are established.
2. For `已经`, either verify and formally support the neutral-final variant as a separate reading, or obtain a recording of the canonical `yǐ jīng` realization.
3. Invite Mandarin-speaking contributors to record the four exact word readings and prioritized sentence/dialogue clips under a clear, compatible open license with explicit speaker consent and attribution.
4. Expand sentence playback as a first-class, separately sourced audio entity rather than attaching a whole-sentence recording to an unrelated vocabulary reading.
5. Re-run the same production counts after the next content migration and keep this dated snapshot immutable.
