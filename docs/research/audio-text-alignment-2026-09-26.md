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

## Results

- 352 published curriculum placements expose an audio recording; these resolve to 134 unique audio IDs and 134 distinct vocabulary/character records.
- All 134 audio IDs had a manifest entry, and every manifest `text` exactly matched the lesson's displayed vocabulary or character. No text-association mismatch was found.
- `word-nihao` is linked to reading `reading-word-nihao`, with pinyin `ni3 hao3`; the live API returns `audio-nihao`. Its manifest lists `你好`, `nǐ hǎo`, and the source file `Zh_nǐ_hǎo.ogg`. The endpoint responds HTTP 200 with `audio/mpeg` and the expected derivative SHA-256 ETag.
- The single-character `你` uses a different asset (`audio-character-ni`) attached to the character reading `reading-character-ni`; it was not attached to `你好`.
- One interface path, the placement question, previously used device speech even when its full prompt exactly matched a vocabulary reading. The UI now requests the source recording for an exact match, including `你好`. The tone-change lesson example also explicitly uses `audio-nihao`.
- Of the 130 distinct published sentence targets, only three had exact-text Tatoeba recordings: `晚上好。`, `今天天气很好。`, and `这个词是什么意思？`. All three were attributed to `fucongcong`, and all three had a blank file-specific audio license. No Tatoeba sentence recording passed the reuse filter; none was downloaded or imported.
- `dialogue-greetings-1` (`你好！`) now reuses the project's existing exact human phrase recording `audio-nihao` through a sentence-level alias. Only terminal punctuation differs; the served MP3, original source, source page, verified CC BY-SA 3.0 metadata, and audio bytes are the same. This is one sentence target with a source recording; the remaining 129 distinct targets do not currently have an approved exact human recording.
- Sentence content never invokes the device speech synthesizer. A missing sentence recording is shown as a disabled human-recording control. Word and character controls keep their separately labeled on-device fallback behavior.

## Limits

This audit verifies database/API links, displayed text, manifest text, source-file description, sentence target coverage search, and HTTP delivery. It does **not** claim that all 134 word/character files were individually auditioned. The app's admin pronunciation-review field currently marks only 3 of the 140 approved vocabulary audio rows as manually passed; other source-attested recordings remain pending listening review. Tatoeba's exact sentence results do not establish a complete search of every public audio collection. Future source searches should use the same exact-text and per-recording-license checks; do not fill gaps with a nearby sentence or device speech synthesis.
