# Product rebuild: scenario-based Mandarin learning

**Status:** Approved implementation direction from the user's request and the 2026-09-25 SuperChinese product research. This is a functional product reference, not authorization to reuse third-party source code, brand assets, illustrations, recordings, or course copy.

## Outcome

Turn MandarinLearnApp into a free, Indonesian-first Mandarin learning product with the broad learning structure described in the research: a continuous scenario-led main course, separate practice, discovery, review, community, and profile areas. Keep the product's own name, visual identity, original lessons, and attribution practices.

## Learner navigation

- **Home:** one clear continue-learning action, daily target, streak/progress, and a short explanation of the learning loop.
- **Main Course:** optional Pinyin primer or suggested placement check; daily-life path and separately versioned HSK 2.0/HSK 3.0 paths; unit, activity, completion, and resume state.
- **Practice:** independent skill practice (listening, speaking/record-and-compare, reading, guided writing, freehand writing), with results connected to the source content and skill.
- **Discover:** searchable, filterable original vocabulary, grammar, dialogues, stories, and short themed lessons; each item can link back to its originating content and related course placements.
- **Review:** due queue across words, readings, grammar and writing, with filters and separate skill outcomes.
- **Talk:** optional learner community; requires a moderation/report/block model, privacy rules, and server-side rate limits before public launch.
- **Profile:** account, goals, language, device sync, offline preferences, data export/deletion, credits, and help.

The phone/tablet bottom bar will keep at most five primary destinations. Profile stays in the top account control; the remaining destination can link to Talk from Discover until product research determines whether community merits a primary slot. All screens must work on iPad 8 portrait/landscape and third-party stylus input.

## Main-course learning loop

1. Determine a starting point through optional Pinyin foundations or an app-authored placement check.
2. Present a practical scenario objective and its vocabulary/grammar.
3. Teach vocabulary in context with exact-reading audio, character breakdown, and Indonesian meaning.
4. Present original dialogue/story/example material, with listen/read/record-and-compare activities.
5. Practice linked character stroke order and freehand character identity separately.
6. Check comprehension and recall; show actionable feedback at the measured word, syllable, stroke, or skill.
7. Finish with a scenario task, a unit summary, due-review scheduling, and a clear continue action.

Keep activity results append-only and link them to reusable content IDs, readings, skill, curriculum version, unit and placement. Do not flatten a word into independent front/back flashcards or copy content per course path.

## Content scope and rights

- Author original Indonesian-targeted teaching copy and dialogues. HSK level/stage labels may guide app-authored sequencing but must not be represented as official classification or exam certification.
- Target a long-term curriculum scale informed by the report (scenario-based units and short activities), while publishing only material that has been authored, checked, sourced/licensed and migrated. Do not fill counts with empty units or generated filler.
- Keep source, license, attribution, source/version date, checksum where applicable, editorial review, and replacement history for every imported dataset and media asset.
- Reference SuperChinese interaction patterns at the level of learning flow and navigation. Do not reuse its logo, mascot, screenshots, exact layouts, lesson wording, audio, or other protected expression.

## Service and cost constraints

- User requirement remains zero paid runtime services. Do not call paid speech recognition/TTS, handwriting, analytics, email, or hosting services, and do not enable a billable fallback.
- Use exact, appropriately licensed human recordings when available. Device-local Mandarin speech may be offered only with a clear synthetic/device label; missing audio must never silently become a fabricated or concatenated reading.
- Keep speech recording transient by default. Do not upload or retain microphone/handwriting raw data without a separate, explicit purpose and consent.
- Cloudflare Workers/D1 remain the first deployment target. Preserve provider-neutral domain and repository boundaries for later migration.

## Admin outcomes

Administrators can inspect individual learner progress by curriculum, unit, content, and skill; review sourced content/audio; see aggregate service and sync health; and handle privacy requests. Sensitive individual-profile access remains role-checked and audited. Routine dashboards must not expose raw handwriting or microphone recordings.

## Release gates

- Every visible destination has a useful, data-backed purpose; no dead-end placeholder cards.
- Navigation and browser back/forward preserve the learner's expected place and support deep links.
- Content, attempts, progress projections and review scheduling remain separate entities.
- Free and offline behavior is honest, accessible, touch-friendly, and usable on iPad Safari.
- Talk is not opened to the public until reporting, blocking, moderation/audit, rate limits, and privacy controls exist.
- Do not claim parity with SuperChinese in proprietary content or unverified speech scoring; describe only functionality actually delivered.
