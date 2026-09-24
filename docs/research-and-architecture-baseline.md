# Research and architecture baseline

Research checked on 2026-09-24. This note records product decisions and verified source candidates; it is not a legal opinion or a claim that any provider has passed a pronunciation quality test.

## User-confirmed product requirements

- Teach simplified Chinese characters only.
- Support an everyday-vocabulary learning path and a complete HSK path.
- Include guided stroke practice with stroke-order feedback and a separate freehand-writing mode that attempts to recognize the learner's writing.
- Learner app: support phones and tablets only, with special attention to third-party stylus input on iPad (8th generation); a learner-facing PC layout is out of scope.
- Administrator portal: support PC desktop browsers as the primary target; a usable iPad layout is desirable.
- Require accounts, a backend, a database, and cross-device progress synchronization in the first release.
- A local cache may support offline practice and backups. It is not the sole or authoritative store.
- Include a protected administrator area for aggregate usage and individual learner progress, with role-based access and an audit trail for individual profile views.
- Start on Cloudflare and preserve the ability to move or extend the backend later.
- Publish the project on GitHub as open source under the MIT license for the application code, and credit technical and content sources under their own licenses.
- Support a growing public community of Indonesian learners, not just one household.
- Do not incur charges: exclude paid APIs and paid hosting/services. If free-tier limits are approached or exhausted, throttle or pause the affected feature and notify the admin; do not silently upgrade, start billing, or fail over to a paid provider.

## Product and data design

### Keep the content graph separate from lessons and learner progress

Do not model a vocabulary item as one front/back flashcard row. Keep reusable language content, curriculum placement, and per-learner history as separate records:

- A vocabulary entry has a stable ID, simplified written form, tokenized character references, syllable-by-syllable pinyin with tone numbers, one or more Indonesian glosses, optional part-of-speech and usage labels, example phrases/sentences, pronunciation references, source metadata, and editorial/review status.
- A character has a Unicode identity, simplified glyph, stroke count and ordered vector paths, radical/component relations when sourced, reading relations, the stroke-data source/version/license, and coverage/review status.
- A reading is a contextual relation, not a single pronunciation field on a character. It records pinyin, tone, locale/standard, the word or phrase that disambiguates it, and the approved audio asset.
- Examples and lesson items reference stable vocabulary/character IDs. The same word can appear in daily-life topics and HSK curricula without copying its definition or learner history.
- A learner attempt records account ID, content ID, activity mode, assessment dimensions, result/confidence, timestamps, and the curriculum context. Progress summaries and review schedules are separate and can be recalculated from history.
- Content records retain source, source version/date, license, attribution, data checksum, editorial changes, and review state. HSK placement includes the standard version and level.

Keep MIT-licensed application code, externally licensed datasets, stroke-recognition packages, model weights, and audio assets as separable components with explicit notices. Do not commit bulk source data until its redistribution terms and attribution are recorded. Store per-source license and provenance independently of the app's MIT license.

## Pronunciation quality policy

Correctness takes priority over always producing sound. An audio source is not a pronunciation authority by itself:

1. Store audio against a reviewed reading and context phrase, never only against an ambiguous character.
2. Have a qualified Mandarin speaker review the exact recording or locally generated candidate against tone contrasts, tone sandhi, neutral tone, and polyphonic words in context before approval.
3. Store approved audio as a versioned asset. Record the exact text and reading ID, source or model/voice, checkpoint, asset hash, license/terms, reviewer state, and replacement history.
4. Runtime playback and offline cache may use only approved assets for the exact same reading and text. Do not synthesize a different or ambiguous reading as a fallback.
5. If no approved asset exists, keep the lesson usable with visible tone-marked Pinyin and “audio not available.” Do not play an unverified sound.

The user has set a zero-paid-service rule. Do not call a cloud TTS or speech API at runtime, do not enable paid Workers AI, and do not silently switch providers when a quota is exhausted. The product should use versioned, approved recordings or locally generated audio assets only when their voice/model, checkpoint, output-use terms, source text, and reviewer approval are recorded. Batch generation on a developer-controlled machine may be evaluated as an optional open-source workflow; it is not a runtime dependency or an automatic quality approval. Device Web Speech synthesis is not an approved pronunciation source because voice and reading can vary by platform. If an exact, reviewed audio asset is unavailable, show Pinyin and “audio not available” instead of playing a guessed voice.

The quality gate is a contextual Mandarin listening review covering tone contrasts, tone sandhi, neutral tone, and polyphonic words. No TTS candidate is selected or certified by this baseline. Free operation is a constraint, not proof of pronunciation quality; audio coverage must grow only as assets pass review.

## Handwriting recognition scope

Guided stroke practice and freehand recognition are different capabilities. Hanzi Writer provides character animation and guided quiz interactions. The user excludes paid recognition services, so MyScript Cloud and other paid APIs are out of scope. Google ML Kit Digital Ink Recognition is a no-cost native SDK option for Android/iOS but does not by itself cover the responsive phone/tablet web app. A cross-platform offline candidate is [HanziLookupJS](https://github.com/gugray/HanziLookupJS) or its [Rust/WebAssembly port](https://github.com/gugray/hanzi_lookup): both return ranked character candidates from stroke input; the Rust port documents an LGPL code license and Arphic Public License-derived stroke data. The JavaScript project documents GPL code and APL-derived data. These candidates require component-level license notices/compliance and a real mobile/tablet browser benchmark before selection; the data license is not the same as the application MIT license. Recognition returns candidates, not a guarantee that arbitrary handwriting is correct.

Use replaceable `CharacterRecognizer` and `StrokeOrderEvaluator` interfaces. A local/offline recognizer may suggest candidates; a separate guided/deterministic evaluator assesses stroke sequence, direction, and shape. Character recognition alone does not prove correct stroke order. Benchmark real finger and third-party stylus input on Safari/iPadOS 14 or later, representative iPad browsers, and phone browsers; if confidence is not calibrated, show categorical uncertain/recognized states and abstain instead of pretending to give a precise probability. Preserve the learner's attempt result and recognizer/data version, not raw stroke traces by default. No free universal service has been approved as a cross-platform perfect recognizer; the product must expose uncertainty and keep guided practice usable.

For freehand mode, hold the ordered stroke samples in memory while the current attempt is assessed locally. Compare the recognized character and stroke sequence with the selected target, then persist derived outcomes, timestamps, and recognizer/data version by default; do not retain raw stroke traces without explicit, revocable diagnostic consent. Separate the judgments for character identity, stroke order, direction, and shape. When the recognizer is uncertain, ask for a retry or offer guided practice; do not mark the learner wrong or correct without sufficient confidence. Character recognition alone does not prove correct stroke order.

Prototype and implementation acceptance must include finger and third-party stylus input, missed/extra strokes, different writing sizes, rotation, undo/clear, offline queueing, and uncertain-recognition states. Do not require Apple Pencil-only features.

## HSK and course content

The [official Chinese Test Service HSK page](https://www.chinesetest.cn/hsk) describes the New HSK as an expansion from the existing six-level system to three stages and nine levels, with separate levels 1–6 and 7–9 navigation. The app therefore keeps **HSK 2.0 (six levels)** and **HSK 3.0 (three stages/nine levels)** as separate versioned paths. The current release publishes only those structural slots; it does not copy the official syllabus, word list, grammar, or examples because their bulk redistribution terms have not been confirmed. Keep the everyday-vocabulary path independent; both paths can refer to the same reusable content.

The [CC-CIDICT download page](https://cidict.org/download/) offers a UTF-8 U8 file and SQL export; its current page lists 125,318 entries in version 1.26, released 2026-08-26. Its [license terms](https://cidict.org/license-terms-of-use/) grant redistribution/adaptation under CC BY-SA 4.0 and require attribution to CC-CEDICT contributors, Harmony Mandarin, and CC-CIDICT; derivatives must retain CC BY-SA 4.0. The terms also disclaim data accuracy/fitness warranties, so imports should preserve exact source version and individual gloss provenance, and should not mislabel community dictionary entries as official HSK content. This version is a potential source for daily-life definitions, not currently bundled in full.

Create original explanations, examples, and exercises. Before redistributing official or third-party syllabus-derived lists, confirm their reuse terms. Preserve attribution and distinguish officially sourced fields from editorial additions.

## Source candidates and current notes

### Stroke order

- [Hanzi Writer documentation](https://hanziwriter.org/docs.html): character animation, quiz interactions, and character-data loading.
- [Hanzi Writer license](https://hanziwriter.org/license.html): source code is MIT; the character dataset is separately licensed under the Arphic Public License.
- [Make Me a Hanzi](https://github.com/skishore/makemeahanzi): common simplified/traditional character data and stroke vectors. Its [COPYING file](https://raw.githubusercontent.com/skishore/makemeahanzi/master/COPYING) assigns LGPL terms to dictionary.txt and Arphic Public License terms to graphics.txt. Do not treat the files as one license.

### Mandarin–Indonesian dictionary

- [CC-CIDICT](https://cidict.org/) publishes an open Chinese–Indonesian dictionary. Its [download page](https://cidict.org/download/) currently lists UTF-8 text and SQL downloads; JSONL and CSV are marked as coming soon.
- The project's [license terms](https://cidict.org/license-terms-of-use/) specify CC BY-SA 4.0, attribution, and ShareAlike for derivative data. Record the downloaded version and provide a visible credits page in the app.
- No official query API documentation was found during this research. Prefer a versioned import/build pipeline over a runtime dependency on the dictionary website.

### Audio and handwriting references (research only)

- Paid cloud TTS and handwriting endpoints were examined during research but are excluded by the user's zero-paid-service rule. They are not selected providers or fallback options.
- [Web Speech API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API) documents device-dependent browser synthesis; it is not an approved pronunciation source for this product.
- [ML Kit Digital Ink Recognition](https://developers.google.com/ml-kit/vision/digital-ink-recognition), with [Android](https://developers.google.com/ml-kit/vision/digital-ink-recognition/android) and [iOS](https://developers.google.com/ml-kit/vision/digital-ink-recognition/ios) guides, is a no-cost native SDK option but does not cover the responsive phone/tablet web app by itself.
- [HanziLookupJS](https://github.com/gugray/HanziLookupJS) documents a GPL code license and APL-derived data; the [Rust/WebAssembly port](https://github.com/gugray/hanzi_lookup) documents LGPL code and APL-derived data. Treat code and recognition data licenses separately and include required notices if selected.

### Cloudflare hosting candidates

- [Pages limits](https://developers.cloudflare.com/pages/platform/limits/): the current Free plan lists 500 builds/month, up to 20,000 files, and a 25 MiB per-file asset limit.
- [Workers limits](https://developers.cloudflare.com/workers/platform/limits/): Free lists 100,000 requests/day.
- [D1 pricing and quotas](https://developers.cloudflare.com/d1/platform/pricing/): Free lists 5 million rows read/day, 100,000 rows written/day, and 5 GB total account storage. [D1 database limits](https://developers.cloudflare.com/d1/platform/limits/) list a 500 MB maximum size per Free database.
- [R2 pricing](https://developers.cloudflare.com/r2/pricing/): current Free allowance lists 10 GB-month storage, one million Class A operations/month, and 10 million Class B operations/month; internet egress is free.

Use Cloudflare Pages for the web shell, Workers for versioned API endpoints, D1 for account/content/progress records, and R2 for approved audio objects if the chosen asset size and traffic fit current limits. Keep SQL migrations portable, use repository/provider interfaces, version API contracts, and support account/data export so a later move to Supabase or another host does not require redesigning the learning model.

## Account and administrator privacy

- The server is the canonical account/progress store. IndexedDB/service-worker caches support downloaded lessons and a retryable outbox for offline attempts; show sync status and last successful sync.
- Restrict administrator routes and operations to explicit server-enforced roles with audited access. Authorized administrators can inspect one learner's curriculum progress, separate skill trends, due reviews, and attempt outcomes.
- Record every opening of an individual learner profile in an append-only audit trail with administrator, learner ID, time, and action. Use pseudonymous admin lists and masked contact details by default.
- Default analytics to aggregate usage and product-quality measures: active accounts, completed practice, curriculum progress, sync failures, audio fallback/error rate, and handwriting uncertainty/error rate.
- Do not retain or expose raw microphone audio or raw handwriting strokes in routine admin views. Collect a diagnostic sample only with explicit, revocable consent, a stated purpose, short retention, and audited access; offer export/deletion workflows for account data.
- Show free-tier operational usage and use fixed safety thresholds. On quota risk or exhaustion, stop or rate-limit the relevant nonessential operation and alert the admin; never auto-upgrade or invoke a paid fallback.

## Decisions and remaining questions

- Settled: repository name `MandarinLearnApp`; application-code license MIT; no paid service budget; individual learner progress is visible to authorized admins and profile views are audited.
- Confirm the GitHub repository owner/account and authenticated publishing route before the first public push. Keep private Git identity information out of published commits.
- Confirm HSK 2.0/3.0 list redistribution terms before importing official exam lists. Do not assume the official test page grants bulk redistribution rights. CC-CIDICT is a separately licensed candidate for daily-life Chinese–Indonesian definitions, with ShareAlike attribution obligations.
- Choose account authentication and decide whether registration is open from day one.
- Set retention periods for attempt summaries, audit logs, and any consented diagnostic sample.
- Benchmark HanziLookupJS/Rust-WASM and the separate stroke evaluator on the target iPad and representative phones; finish license notices for each code/data component before bundling them.
- Approve an audio-source process (for example, appropriately licensed native-speaker recordings or quality-reviewed assets generated locally from a license-verified open model). Do not enable a paid or unreviewed runtime TTS fallback.
