# Audio-to-text alignment audit

**Date:** 2026-09-26
**Scope:** Published learner vocabulary/character placements, all published sentence-audio targets, and the reported `你好` playback.

## Checks performed

- Read the live `/api/v1/paths` and each published path's units, then fetched each unit's public lesson data.
- Compared every returned `audio_id` with `content/audio-assets-manifest.json` by exact simplified text.
- Checked the live `/api/v1/vocabulary/word-nihao` record and the public audio response headers.
- Confirmed the placement-question database lookup for the exact prompt `你好` selects the full phrase asset. Other prompts do not receive an unrelated word/character recording.
- Collected 130 distinct published sentence targets (examples, dialogue turns, and story paragraphs) from the live API and queried each exact text against Tatoeba's official sentence API at a rate-limited pace, retrying server throttling and recording failures.
- Reviewed the official Tatoeba [Downloads](https://tatoeba.org/en/downloads) policy and its `sentences_with_audio` fields. Tatoeba states that contributors choose per-file audio licenses and that a blank audio-license field means that file may not be reused outside Tatoeba.
- Checked Mozilla Common Voice Scripted Speech 27.0 for Chinese (China), the current `zh-CN` human-recorded corpus. Its dataset page lists CC0-1.0 and 59,170 validated sentences, but also forbids re-hosting or re-sharing the full dataset; its package is 21.40 GB.
- Found the smaller [Common Voice Scripted Speech 26.0 Beijing Chinese segment](https://mozilladatacollective.com/datasets/cmruwsbag00c8md07lk1n7i1e): 2,860 human clips (train/dev/test), 113.39 MB, CC0-1.0, filtered to validated recordings from self-declared Beijing/standard-Mandarin accents. Its page lists no redistribution ban; it does prohibit trying to identify speakers. The official download flow requires a Mozilla Data Collective API key/account, which was not available in this session.
- Checked the 58,782-row validated-sentence index and train/dev/test transcript splits from the public Common Voice 17.0 Chinese (China) copy. None of the 130 lesson sentences appeared in the validated sentence index or the audio-bearing splits, so this release contributes no exact-match recording for the current course.
- Enumerated all 29 files in Wikimedia Commons' [Audio files in Mandarin Chinese](https://commons.wikimedia.org/wiki/Category:Audio_files_in_Mandarin_Chinese) category. Six filenames identify sentence recordings; none matched the 130 published sentence targets after simplifying Traditional Chinese titles and normalizing terminal punctuation. No clips were imported.
- Checked PORTULAN CLARIN's [SpeakerID corpus](https://portulanclarin.net/repository/browse/speakerid/c70ec5e8b70511eaae0e02420a000403b386f32b421e46db8a51659e6357bc78/), which contains 50 Mandarin sentence stimuli read by five male speakers. Its explicit CC BY-NC-ND terms restrict it to academic, noncommercial use and prohibit derivatives, so it cannot supply audio for this app. No recordings were downloaded.

## Results

- 352 published curriculum placements expose an audio recording; these resolve to 134 unique audio IDs and 134 distinct vocabulary/character records.
- All 134 audio IDs had a manifest entry, and every manifest `text` exactly matched the lesson's displayed vocabulary or character. No text-association mismatch was found.
- `word-nihao` is linked to reading `reading-word-nihao`, with pinyin `ni3 hao3`; the live API returns `audio-nihao`. Its manifest lists `你好`, `nǐ hǎo`, and the source file `Zh_nǐ_hǎo.ogg`. The endpoint responds HTTP 200 with `audio/mpeg` and the expected derivative SHA-256 ETag.
- The single-character `你` uses a different asset (`audio-character-ni`) attached to the character reading `reading-character-ni`; it was not attached to `你好`.
- One interface path, the placement question, previously used device speech even when its full prompt exactly matched a vocabulary reading. The UI now requests the source recording for an exact match, including `你好`. The tone-change lesson example also explicitly uses `audio-nihao`.
- Of the 130 distinct published sentence targets, only three had exact-text Tatoeba recordings: `晚上好。`, `今天天气很好。`, and `这个词是什么意思？`. All three were attributed to `fucongcong`, and all three had a blank file-specific audio license. No Tatoeba sentence recording passed the reuse filter; none was downloaded or imported.
- The large Common Voice 27.0 full corpus is not suitable for copying into the app because its page explicitly forbids re-hosting/re-sharing. The smaller v26 Beijing segment appears suitable for exact-match import under its CC0 page terms, but the archive was not accessible without the required account/API key and therefore its transcripts were not scanned. It is a concrete next source to check, not counted as coverage.
- Common Voice 17's validated sentence inventory and Wikimedia Commons' categorized Mandarin audio files produced no exact match for these course sentences.
- PORTULAN CLARIN's SpeakerID corpus is human-recorded but its CC BY-NC-ND license is incompatible with publishing or adapting those recordings in this app.
- `dialogue-greetings-1` (`你好！`) now reuses the project's existing exact human phrase recording `audio-nihao` through a sentence-level alias. Only terminal punctuation differs; the served MP3, original source, source page, verified CC BY-SA 3.0 metadata, and audio bytes are the same. This is one sentence target with a source recording; the remaining 129 distinct targets do not currently have an approved exact human recording.
- Sentence content never invokes the device speech synthesizer. A missing sentence recording is shown as a disabled human-recording control. Word and character controls keep their separately labeled on-device fallback behavior.

## Limits

This audit verifies database/API links, displayed text, manifest text, source-file description, sentence target coverage search, and HTTP delivery. It does **not** claim that all 134 word/character files were individually auditioned. The app's admin pronunciation-review field currently marks only 3 of the 140 approved vocabulary audio rows as manually passed; other source-attested recordings remain pending listening review. These searches do not establish a complete search of every public audio collection. Future source searches should use the same exact-text and per-recording-license checks; do not fill gaps with a nearby sentence or device speech synthesis.
