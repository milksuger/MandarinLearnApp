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
- Open-ended productive-language responses belong to the authenticated learner and a stable `scenario_output` activity ID. Store the response and self-assessment server-side; never send private writing to AI or expose its text in admin reports. Admin progress may show completion and self-assessment only.
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

- At the 2026-09-25 production audit, source-recorded human audio covers 134/138 distinct published word forms. The Commons manifest contains 139 product files; the production D1 database has 140 approved rows, including one legacy alias for an already represented `你` recording. Manual listening status is independent: 3 rows passed, 137 remain pending, and none failed. See [`docs/research/audio-coverage-2026-09-25.md`](../research/audio-coverage-2026-09-25.md) for the read-only query scope and current results.
- New imports `0016`–`0021` include exact Lingua Libre and Shtooka word files. Supported licenses now include CC0, CC BY-SA 4.0, CC BY 2.0 fr, and CC BY-SA 3.0 US. Preserve the exact file metadata, creator/speaker, license, hash, and original audio for each item.
- A full Wikimedia Commons title scan covered the 5,160-file Chinese pronunciation category and the 4,122-file Lingua Libre Mandarin category. The available `面条儿` clip is an erhua/form variant and is not an exact substitute for `面条`.
- Source/licensing attestation is independent from listening review. This user explicitly asked not to make per-file human review a publication blocker; keep admin correction/rejection tools and never describe a source-verified clip as officially certified or manually reviewed.
- A Commons candidate for `已经` is transcribed `yǐjing` (neutral final syllable), while the course teaches `yǐ jīng`; do not attach it to that reading without representing and labeling the alternate reading. A public HSK audio mirror has a matching file but only states generic `CC-by-sa` terms and refers to an upstream license page that could not be verified; do not bundle it until exact terms and attribution are confirmed. The other three missing forms still have no verified exact recording candidate.
- AnySearch was used for candidate discovery and Jev was used once to prioritize the safe search policy. Jev's structured judgment is a choice aid only; Commons metadata and source hashes remain the evidence.

### 2026-09-25 productive-language activity

- Migration `0026` adds private per-learner scenario responses and an authored fifth lesson step for four introductory daily-life units. Response text is 1–1200 characters; self-assessment is stored separately from correctness and is not an automatic score.
- Both read and write routes require authentication and a currently published activity. The read route returns only the signed-in learner's response. The admin progress view must not select or reveal `response_text`.
- Completing an activity is monotonic: general progress updates may advance a cursor but cannot downgrade a completed activity to in-progress.
- Lesson resume selects a valid in-progress activity or the earliest incomplete activity; completed activities do not pin a learner back to an old step. Before moving the visible step, save the current state and open the destination on the server so reloads and device switches preserve the path.
- Guided writing carries the lesson's stable writing-activity ID into the character practice route. Each approved character is tracked separately on the server, and the writing activity completes only after all approved lesson characters are practiced. Characters without approved stroke data are excluded from practice and the remaining step can be explicitly skipped.
- The API rejects premature completion of a writing activity. Migration `0028` reopens historical writing completions that have no per-character records for all currently approved lesson characters, since the earlier flow could complete the whole step after one character.
- Recall quizzes persist both the next question and the correct-answer count after each answer is acknowledged, so resuming on another device does not show a fabricated zero score. The final quiz answer marks the activity complete server-side.
- Final scenario save completes the fifth activity and renders a lesson-finished state with routes back to courses or home. The stepper reflects server-accepted completion immediately.

### 2026-09-26 sentence audio and text-audio audit

- Sentence audio is a separate media entity from vocabulary/character readings. Migration `0029` adds sentence assets plus typed example, dialogue-turn, and story-paragraph links; keep these foreign keys and content IDs stable.
- The existing audio endpoint remains compatible. New sentence recordings are served only when their source license is marked verified and the asset is approved with either a passed listening review or source attestation. A pending listening review must remain visible in metadata; source verification is not acoustic certification.
- Tatoeba is a candidate-discovery source only: its official downloads page says each contributor chooses the audio license; a blank license prevents reuse outside Tatoeba. Verify each recording separately before import.
- A read-only production API sweep on 2026-09-26 checked 352 course placements and 134 unique audio IDs against the committed manifest's simplified text; all matched. `word-nihao` resolves to `audio-nihao` (`你好`, `nǐ hǎo`) and the endpoint returned HTTP 200. This confirms data linkage and delivery, not that a person listened to all 134 recordings.
- The tone-change explanation and exact-text `你好` placement question now supply the existing `audio-nihao` asset instead of falling back to device speech. Keep matching sourced audio attached wherever the exact recording exists.
- Sentence examples, dialogue, stories, and placement prompts never use device speech synthesis. If no exact human recording is approved, render the disabled "Rekaman manusia belum tersedia" control; word and character fallback rules remain separate.
- The 2026-09-26 exact-text scan covered 130 distinct published sentence targets. Tatoeba returned only three exact matches, all with blank file-specific audio licenses, so none was reused. One sentence target (`你好！`) is linked to the existing exact `你好` recording; the other 129 currently lack an approved human recording.
- Follow-up batch matching compared the published lines to FLEURS `cmn_hans_cn` transcripts (4,600 rows, CC BY 4.0), the 4,122-file Lingua Libre Mandarin category, and the broader Commons Mandarin-language category. No new exact course sentence was found; the Lingua Libre hits are the already-covered `你好` phrase family. Do not restart those same broad scans unless a new corpus release appears.
- A 2026-09-26 comparison also matched the 130 published lines against 16,898 official CoVoST 2 Chinese-to-English transcript rows and found no exact text matches after punctuation/whitespace normalization. The current Mozilla Data Collective audio release lists CC BY-NC 4.0, research/non-commercial scope, and a prohibition on speaker identification, so no clip was imported. ESD requires a separate research-only license; OpenSLR Free ST is CC BY-NC-ND 4.0.
- Migrations `0031` and `0032` add consent audit fields and a short-clip D1 BLOB store. The owner-admin recording studio captures WAV, requires human-speech and CC BY 4.0 confirmations, creates pending assets and keeps learner playback disabled until an admin listening review passes. Deployed 2026-09-26; it does not create a recording by itself. Production currently has 1/130 distinct target lines covered, leaving 129 for a human contributor to record and an administrator to review.
- Mozilla Common Voice Scripted Speech 27.0 is an appealing large `zh-CN` community corpus (CC0-1.0, 59,170 validated sentences), but its dataset page forbids re-hosting or re-sharing. It was not copied into our static assets.
- A smaller Common Voice 26.0 Beijing Chinese segment contains 2,860 validated clips, lists CC0-1.0, and prohibits speaker identification without stating a re-hosting ban. It requires a Mozilla Data Collective API key to download. Exact sentence overlap remains unknown; scan only after obtaining the archive and keep speaker identities undiscoverable.
- Common Voice 17.0's 58,782-row validated Mandarin sentence index and train/dev/test splits contained no exact match to the current published sentence targets. Wikimedia Commons' 29-file Mandarin audio category also had no exact sentence-title matches.
- PORTULAN CLARIN's SpeakerID corpus contains 50 Mandarin sentence stimuli but is CC BY-NC-ND with academic/noncommercial restrictions, so do not reuse it in the learner application.
