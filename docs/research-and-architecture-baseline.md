# Research and architecture baseline

Research checked on 2026-09-24. This note records product decisions and verified source candidates; it is not a legal opinion or a claim that any provider has passed a pronunciation quality test.

## User-confirmed product requirements

- Teach simplified Chinese characters only.
- Support an everyday-vocabulary learning path and a complete HSK path.
- Include guided stroke practice with stroke-order feedback and a separate freehand-writing mode that attempts to recognize the learner's writing.
- Support desktop, phone, and iPad, with special attention to stylus input on iPad (8th generation).
- Require accounts, a backend, a database, and cross-device progress synchronization in the first release.
- A local cache may support offline practice and backups. It is not the sole or authoritative store.
- Include a protected administrator area for observing product usage.
- Start on Cloudflare and preserve the ability to move or extend the backend later.
- Publish the project on GitHub as open source and credit technical and content sources.

## Product and data design

### Keep the content graph separate from lessons and learner progress

Do not model a vocabulary item as one front/back flashcard row. Keep reusable language content, curriculum placement, and per-learner history as separate records:

- A vocabulary entry has a stable ID, simplified written form, tokenized character references, syllable-by-syllable pinyin with tone numbers, one or more Indonesian glosses, optional part-of-speech and usage labels, example phrases/sentences, pronunciation references, source metadata, and editorial/review status.
- A character has a Unicode identity, simplified glyph, stroke count and ordered vector paths, radical/component relations when sourced, reading relations, the stroke-data source/version/license, and coverage/review status.
- A reading is a contextual relation, not a single pronunciation field on a character. It records pinyin, tone, locale/standard, the word or phrase that disambiguates it, and the approved audio asset.
- Examples and lesson items reference stable vocabulary/character IDs. The same word can appear in daily-life topics and HSK curricula without copying its definition or learner history.
- A learner attempt records account ID, content ID, activity mode, assessment dimensions, result/confidence, timestamps, and the curriculum context. Progress summaries and review schedules are separate and can be recalculated from history.
- Content records retain source, source version/date, license, attribution, data checksum, editorial changes, and review state. HSK placement includes the standard version and level.

Keep code, externally licensed datasets, and generated audio as separable packages with explicit licenses. Do not commit bulk source data until its redistribution terms and attribution are recorded.

## Pronunciation quality policy

Correctness takes priority over always producing sound. A TTS provider is not a pronunciation authority:

1. Store audio against a reviewed reading and a context phrase, never only against an ambiguous character.
2. Compare provider samples for Mainland Standard Mandarin on a curated benchmark that includes tone contrasts, tone sandhi, neutral tone, and polyphonic characters in context. Have a qualified Mandarin speaker review the chosen samples before they become approved content.
3. Store the approved recording or approved generated output as a versioned audio asset in server storage/CDN. Record provider/model/voice, input text, reading ID, asset hash, license/terms, reviewer state, and replacement history.
4. Runtime fallback may play only another approved asset for the exact same reading and text. It must never synthesize a different or ambiguous reading just to avoid silence.
5. If no approved asset is available, keep the lesson usable with visible tone-marked pinyin and retry/status messaging, and do not play an unverified sound. Cache approved assets for offline playback where possible.

Candidate providers to audition, not yet selected:

- Google Cloud Text-to-Speech publishes a supported voice list and tiered per-character pricing. Its pricing page says billing must be enabled; free allowances depend on voice family.
- Azure Speech lists Simplified Mandarin (zh-CN) neural voices such as Xiaoxiao. Its current voice catalog and prices must be checked when selecting a provider.
- Tencent Cloud Text-to-Speech documents Mandarin support, SSML, and a beta free-use statement. Region availability, service terms, reliability, and actual samples still require verification.
- Cloudflare Workers AI offers MeloTTS with a listed per-audio-minute price and a shared daily free Neurons allocation. It is a candidate to compare, not an assumed quality fallback.
- Browser Web Speech synthesis uses device/platform voices and cannot guarantee the same Mandarin voice on every browser or device.

The final primary provider and backup policy depend on a listening review and the accepted operating budget. Do not expose provider credentials in the browser; provider calls, if used, go through a server adapter with limits and monitoring.

## Handwriting recognition scope

Guided stroke practice and freehand recognition are different capabilities. Hanzi Writer provides character animation and guided quiz interactions. Google ML Kit Digital Ink Recognition supports on-device recognition on Android and iOS, but it is a native mobile SDK and does not by itself cover desktop web. A cross-platform web implementation must therefore use a replaceable recognizer/validator design and test real input on Safari/iPadOS, desktop browsers, and phones.

For freehand mode, preserve the user's ordered stroke samples and compare the recognized character and stroke sequence with the selected target. Separate the judgments for character identity, stroke order, direction, and shape. When the recognizer is uncertain, ask for a retry or offer guided practice; do not mark the learner wrong or correct without sufficient confidence. Do not claim that character recognition alone proves correct stroke order.

Prototype and implementation acceptance must include finger and third-party stylus input, missed/extra strokes, different writing sizes, rotation, undo/clear, offline queueing, and uncertain-recognition states. Do not require Apple Pencil-only features.

## HSK and course content

The official Chinese Test Service HSK page describes the New HSK framework as three stages and nine levels and links to its examination syllabus. The course model should represent HSK 3.0 levels 1–9 and retain the standard version in every curriculum item. Keep the everyday-vocabulary path independent; both paths can refer to the same reusable content.

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

### Audio and handwriting services

- [Google Cloud Text-to-Speech voice catalog](https://docs.cloud.google.com/text-to-speech/docs/list-voices-and-types) and [pricing](https://cloud.google.com/text-to-speech/pricing).
- [Azure Speech language and voice support](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/language-support) and [pricing](https://azure.microsoft.com/en-us/pricing/details/speech/).
- [Tencent Cloud TextToVoice API](https://www.tencentcloud.com/document/product/1154/48916).
- [Cloudflare Workers AI MeloTTS](https://developers.cloudflare.com/workers-ai/models/melotts/) and [Workers AI pricing](https://developers.cloudflare.com/workers-ai/platform/pricing/).
- [Web Speech API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API) documents platform speech synthesis.
- [ML Kit Digital Ink Recognition](https://developers.google.com/ml-kit/vision/digital-ink-recognition), with [Android](https://developers.google.com/ml-kit/vision/digital-ink-recognition/android) and [iOS](https://developers.google.com/ml-kit/vision/digital-ink-recognition/ios) guides.
- [MyScript web SDK overview](https://developer.myscript.com/docs/interactive-ink/4.3/web/overview/introduction/) describes web ink capture and recognition APIs. Chinese coverage, cost, service availability, and data terms need evaluation before any selection.

### Cloudflare hosting candidates

- [Pages limits](https://developers.cloudflare.com/pages/platform/limits/): the current Free plan lists 500 builds/month, up to 20,000 files, and a 25 MiB per-file asset limit.
- [Workers limits](https://developers.cloudflare.com/workers/platform/limits/): Free lists 100,000 requests/day.
- [D1 pricing and quotas](https://developers.cloudflare.com/d1/platform/pricing/): Free lists 5 million rows read/day, 100,000 rows written/day, and 5 GB total account storage. [D1 database limits](https://developers.cloudflare.com/d1/platform/limits/) list a 500 MB maximum size per Free database.
- [R2 pricing](https://developers.cloudflare.com/r2/pricing/): current Free allowance lists 10 GB-month storage, one million Class A operations/month, and 10 million Class B operations/month; internet egress is free.

Use Cloudflare Pages for the web shell, Workers for versioned API endpoints, D1 for account/content/progress records, and R2 for approved audio objects if the chosen asset size and traffic fit current limits. Keep SQL migrations portable, use repository/provider interfaces, version API contracts, and support account/data export so a later move to Supabase or another host does not require redesigning the learning model.

## Account and administrator privacy

- The server is the canonical account/progress store. IndexedDB/service-worker caches support downloaded lessons and a retryable outbox for offline attempts; show sync status and last successful sync.
- Restrict administrator routes and operations to an explicit admin role with audited access.
- Default analytics to aggregate usage and product-quality measures: active accounts, completed practice, curriculum progress, sync failures, audio fallback/error rate, and handwriting uncertainty/error rate.
- Do not expose raw microphone audio or raw handwriting strokes in routine admin analytics. Collect any diagnostic samples only with explicit consent, a retention limit, and access logging.

## Open decisions before public GitHub publication

- Repository owner/name.
- Software source license (keep separate from external dataset and audio licenses).
- Whether a paid primary/backup speech provider is acceptable and the monthly usage ceiling.
- Exact HSK 3.0 import/reuse terms and editorial review process.
- Account authentication choice and whether open registration is enabled.
- Admin analytics retention and whether per-account activity is needed beyond aggregated metrics.
