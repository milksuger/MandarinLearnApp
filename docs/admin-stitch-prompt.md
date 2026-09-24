# Google Stitch Prompt: Administrator Portal

Use this standalone prompt to generate the protected administrator experience for **Belajar Mandarin**. The learner-facing product and architecture constraints are documented in [the main Stitch prompt](stitch-prototype-prompt.md) and [the research baseline](research-and-architecture-baseline.md).

Copy the text between **BEGIN PROMPT** and **END PROMPT** into Google Stitch. The prompt is in English so the screen and behavior requirements stay precise. In the generated admin UI, use Bahasa Indonesia as the default interface language and offer Simplified Chinese as an admin-language option. All people and measurements in the prototype must be clearly marked as mock data.

---

## BEGIN PROMPT

You are a senior product designer designing a polished, secure, responsive administrator portal for **Belajar Mandarin**, a free open-source Mandarin-learning platform for Indonesian-speaking learners.

### Product and operating constraints

- The learner product is free: no subscription, lesson quota, paid speech API, paid handwriting-recognition API, or payment screen.
- The first release uses a server-backed account and database, with progress synchronized across devices. Cloudflare is the first hosting target, but the design must not depend on Cloudflare-specific UI or terminology.
- Learners study Simplified Chinese through two connected paths: everyday vocabulary and a versioned HSK 3.0 curriculum with three stages and nine levels.
- Character practice has separate guided stroke-order feedback and freehand character recognition. Character identity, stroke order, direction, and shape are separate results. Uncertain recognition must remain uncertain; it must never be presented as a definite pass or failure.
- Speech assets must be linked to a reviewed reading and context. A generated or device voice is not automatically an approved pronunciation. Show unavailable audio as unavailable rather than implying a verified voice exists.
- This portal exists to monitor the product, inspect an individual learner’s progress, maintain content provenance and quality, and protect learner data. It is not a billing console or an advertising dashboard.

### Administrator roles, privacy, and trust

- Every admin route and action is role-protected. Design a protected admin sign-in and clear access-denied state.
- Use role-based permissions throughout the UI. Show a future-ready role model such as **Owner admin** (manage access and privacy settings) and **Content reviewer** (review course/audio provenance, no account/security settings). Make the signed-in role visible.
- Administrators may open an individual learner’s progress because individual review is a required product capability. Log every individual profile view in the audit trail with administrator, learner ID, time, and action.
- Never display passwords, authentication tokens, raw microphone audio, or raw handwriting traces in routine admin views. Do not silently capture diagnostic data. A diagnostic sample may be retained only with learner consent, a stated purpose, a retention deadline, and an access log.
- Use pseudonymous learner identifiers in tables and mockups. Mask contact details. Avoid collecting or displaying unnecessary personal attributes.
- Provide visible paths for privacy requests such as data export, account deletion, and diagnostic-data consent/revocation. Do not imply that an admin can inspect a learner’s private device files.
- Include a compact privacy notice and an audit view. Show which individual-data pages are access-logged.
- No real names, emails, handwriting, recordings, or production statistics in the prototype. Label every record and chart **Data contoh / Mock data**.

### Visual system and responsive behavior

- Use the attached Super Chinese screenshot as an explicit visual-style reference for the shared product identity: polished and approachable learning UX, clear progress cues, uncluttered light surfaces, crisp Chinese writing, simple controls, and encouraging feedback. Ignore its PLUS membership paywall; this product has no subscription or paid features.
- Adapt that reference into an original admin visual system rather than copying Super Chinese branding, logo, exact screen composition, proprietary icons, or distinctive assets. Carry over the learner app’s warm neutral surfaces, deep ink/indigo text, teal/green actions, restrained amber status accents, and calm notebook-like structure. Keep the tone adult and respectful.
- Admin screens should feel focused and information-dense without looking like a generic dark-mode SaaS template. Use a clear typographic hierarchy, strong table alignment, readable chart labels, and generous enough spacing for long Indonesian words.
- Default admin interface language: Bahasa Indonesia. Include a language switch for Simplified Chinese. Keep Hanzi and tone-marked Pinyin visually distinct in content-review screens.
- Required primary design frame: PC desktop 1440 × 900. Also create a usable iPad 8th-generation landscape and portrait layout where practical. A phone admin layout is out of scope for the first release. On tablet widths, convert data tables to readable learner cards with the important status and action visible; do not force horizontal scrolling.
- Make controls keyboard-accessible with visible focus, accessible names, 44 px/pt minimum touch targets, non-color status labels, and reduced-motion support.
- Provide connected routes and interaction states: loading, empty, filtered-no-results, error/retry, success, access denied, session expired, and offline/read-only where relevant.

### Navigation

Create an admin shell that is visually distinct from learner study mode, with a clear “Admin” label and a safe route back to the learner app. Use these navigation areas:

1. **Ringkasan** (Overview)
2. **Pelajar** (Learners)
3. **Kurikulum & konten** (Curriculum and content)
4. **Kualitas audio** (Audio quality)
5. **Kualitas tulisan** (Writing-recognition quality)
6. **Audit & privasi** (Audit and privacy)
7. **Pengaturan admin** (Admin settings; visible only to Owner admin)

### Screen 1 — Protected admin sign-in and access states

Design a quiet sign-in screen that clearly identifies the protected administrator portal. Include email/username and password fields, show/hide password, sign-in action, loading state, invalid-credentials error, session-expired state, and access-denied state for an account without an admin role. Do not put admin credentials in sample copy or expose them in the prototype.

### Screen 2 — Overview dashboard

Create an at-a-glance dashboard with a date-range filter and a visible mock-data label. Show only useful product and service-health measures:

- Active learners and newly active learners.
- Completed study sessions and review activity.
- Daily-path and HSK 3.0 progress by stage/level.
- Account synchronization success/failure and pending-sync trend.
- Approved pronunciation playback success, unavailable-asset rate, and approved-asset fallback count.
- Guided-writing completion, freehand-recognition abstention/uncertainty, and retry trend.
- Current Cloudflare service-health/free-quota indicators (requests, D1 storage/reads/writes, and approved-audio storage) as operational indicators, not a guarantee of future provider pricing.
- A short list of operational alerts with severity, affected feature, first seen, and a link to the relevant detail page.

Charts must use clear labels and meaningful time ranges. Do not invent an accuracy percentage or display a recognition score as proven accuracy. If sample values are included, label them mock values. Keep raw learner content out of aggregate charts.

### Screen 3 — Learner directory

Design a searchable, filterable learner list. Filters should include account state, last-active period, selected path (everyday / HSK 3.0 / both), HSK stage/level, sync status, and progress status. Include sort controls and pagination or a clear load-more pattern.

Show privacy-minimized rows/cards with:

- Pseudonymous learner ID (for example, `Pelajar-0042`).
- Masked contact or a neutral “contact hidden” label.
- Account status and approximate join date.
- Last activity and last successful server sync.
- Selected path and current unit/HSK level.
- Overall learning summary plus separate reading, pronunciation/listening, guided-stroke, and freehand-recognition signals.
- Items due for review and a clear “Lihat progres” action.

Do not collapse progress into one “mastered/not mastered” badge. Distinguish “needs practice” from “recognition uncertain.” Make the privacy/access-log notice visible near the table.

Include empty, loading, API-error, and no-results states, plus a tablet-card variant. Do not add bulk actions that alter or delete learner accounts.

### Screen 4 — Individual learner progress profile

This is a core screen, not a hidden drill-down. Make it easy to return to the learner directory and show the pseudonymous learner ID at the top. Include a restrained banner: “Akses profil ini dicatat di log audit” / “Access to this profile is recorded.”

Organize the profile into clear sections or tabs:

**A. Account and sync summary**

- Account state, created date, last active, last successful sync, current sync issues, and enrolled learner devices shown only by generic type (for example, tablet/phone).
- Masked contact details. No password, token, or sensitive authentication information.

**B. Curriculum progress**

- Everyday-life path by topic/unit.
- HSK 3.0 version, stage, level 1–9, completed/in-progress/not-started units, and prerequisite links.
- Show the same reusable word/character in multiple curriculum placements without duplicating its progress history.
- Include a path/level filter and clear completion counts.

**C. Skill development over time**

- Separate trends for reading/meaning, listening/pronunciation, guided stroke order, and freehand recognition.
- Show practice volume, consistency, review due/overdue, and recent trend. Keep the chart interpretable and avoid a single opaque learner score.
- Use states such as **Solid**, **Needs practice**, **Not enough attempts**, and **Uncertain recognition**. Never convert uncertain recognition to a pass/fail result.

**D. Words and characters needing support**

- A ranked review list with simplified character/word, tone-marked Pinyin, concise Indonesian meaning, relevant path/unit, last practiced, review due, and separate skill flags.
- Include an explanation such as “笔顺需要练习” / “Urutan goresan perlu dilatih” and a link to the relevant lesson preview.
- For polyphonic characters, show the contextual reading/word, not an unexplained character-only pronunciation.

**E. Recent learning activity timeline**

- Date/time, lesson/path, activity mode, content ID, result by assessment dimension, sync status, and a modest confidence category only if the recognizer supports calibrated categories.
- If no calibrated confidence exists, use “recognized / uncertain / not recognized” instead of a numeric score.
- Include device/browser family and recognizer/content version only when useful for troubleshooting.
- Do not show a replay control for audio captured from the learner and do not show raw handwriting. Provide a clear link to learner-approved diagnostics only when consent exists; otherwise state that no diagnostic sample is stored.

**F. Profile-access context**

- Show current admin role, access timestamp, and a small link to the corresponding audit event.
- Provide a “privacy request status” area for pending export/deletion requests without exposing extra personal data.

Include no-activity, newly registered, long-inactive, sync-error, and recognition-uncertain example states. Use mock data only.

### Screen 5 — Curriculum and content provenance

Design a content catalog for reusable vocabulary, contextual readings, characters, examples, and lesson placements. Include search, filters, and a content detail drawer/page.

For each item, show:

- Stable content ID, simplified form, segmented character references, tone-marked Pinyin, Indonesian senses, part of speech/usage labels, and contextual example.
- Reading-to-context links for polyphonic characters.
- Everyday-topic placements and HSK 3.0 version/stage/level placements.
- Source name, source version/date, original source form, license, attribution, checksum/version, editorial changes, and review status.
- Clear separation between sourced facts and original editorial examples.
- Warnings for missing source/license, an ambiguous reading without context, an unreviewed translation, a missing character/stroke asset, or an unapproved audio asset.

Do not make “publish” or destructive bulk-edit controls the visual focus. Show content states: draft, needs review, approved, rejected, replaced, and retired.

### Screen 6 — Audio provenance and pronunciation review

Design a review queue and asset detail view, not a paid TTS console. Show the exact Mandarin text, contextual reading ID, tone-marked Pinyin, Indonesian gloss, source/recording or generator provenance, model/voice if applicable, license/terms, asset hash/version, reviewer and review date, and approval/replacement state.

Provide an audio preview only for the specific candidate asset being reviewed, with clear labels for **Candidate** and **Approved**. Include controls to compare approved alternatives only when they express the same exact reading and text. The design must never imply that a generated or device voice is approved by default.

If no approved asset exists, show **Audio belum tersedia** and make clear that the lesson still works with visible Pinyin. Do not show API-key fields, paid-plan selection, billing, subscription, or an unbounded “generate speech” action. If a future local open model is evaluated, present it as a candidate source that still needs provenance, license, and human quality review.

### Screen 7 — Writing and recognition quality

Show product-level quality and performance without exposing routine raw handwriting:

- Guided-practice error categories: wrong order, direction, incomplete shape, extra/missed stroke, and uncertain input.
- Freehand outcomes: target recognized, different candidate, uncertain/abstained, and retried.
- Breakdown by character, browser/device family, recognizer version, time range, and curriculum context.
- Recognition latency and local/offline availability where measured.
- Data coverage gaps and characters with repeated uncertainty.
- Clearly separate recognition (character identity) from the deterministic/guided stroke-order evaluator.

Do not show “accuracy” unless it has a defined, reviewed benchmark. Prefer count, trend, confidence calibration, and abstention metrics. Never present uncertain as incorrect. Do not provide a raw-stroke browser in routine admin mode. If there is a consented diagnostic sample, show purpose, expiry, who can access it, and an audit trail before offering access.

### Screen 8 — Audit, privacy, and administrator access

Design an append-only audit log with filters for administrator, action type, learner ID, date, and outcome. Include individual profile views, access denials, role changes, content/audio approvals, export/deletion requests, and diagnostic-sample access. Show who, what, which record, when, and result; never show secrets.

Add a privacy-request queue for learner data export, account deletion, diagnostic consent, and consent revocation. Show request status, due/retention date, and only the minimum identity reference needed to process it.

For Owner admin, include a permission matrix for Owner admin and Content reviewer, session/access overview, and configurable retention policy. Explain which event data is necessary to calculate learning progress and how raw diagnostics differ from normal attempt summaries. Do not invent jurisdiction-specific legal claims.

### Screen 9 — Settings and system health

Show admin locale, session/device list, role assignment, and integration/health status at a high level. The initial hosting target is Cloudflare Pages/Workers/D1/R2, but label its quota figures as current operational limits and avoid hard-coding provider-specific flow into the product UX. Show that paid third-party APIs are disabled/not configured by policy. Avoid storing credentials in frontend forms.

### Sample Bahasa Indonesia admin copy

- “Ringkasan”
- “Pelajar”
- “Cari ID pelajar”
- “Lihat progres”
- “Akses profil ini dicatat di log audit”
- “Progres belajar”
- “Perlu latihan”
- “Belum cukup data”
- “Pengenalan belum yakin”
- “Audio belum tersedia”
- “Sumber dan lisensi”
- “Menunggu peninjauan”
- “Disetujui”
- “Permintaan privasi”
- “Data contoh / Mock data”

Offer Simplified Chinese equivalents through the admin-language selector. Preserve accurate tone marks in Pinyin.

### Prototype delivery

Generate one connected administrator prototype with working navigation from overview → learner directory → an individual learner profile → a specific curriculum/activity detail → the audit event for opening that profile. Also connect content review → audio review and recognition-quality views. Design PC desktop as the required admin target and include iPad portrait/landscape adaptations; do not spend time on a phone admin layout. Include the required loading, no-data, error, access-denied, offline, uncertain-recognition, and privacy-request states.

Use realistic but clearly fictional mock data. Do not copy any existing product’s branding or exact layout. Do not invent accuracy guarantees, speech-provider guarantees, personal learner details, or licensing claims. Make it clear that individual profile views are authorized and audited.

## END PROMPT

---

## Suggested Stitch inputs

- Attach the learner-app prompt and supplied Super Chinese screenshot as visual-style references. Match the shared app identity while adapting the information hierarchy to a PC management console; ignore the PLUS paywall and do not copy branded assets or exact screens.
- Do not attach real learner records, contact details, recordings, handwriting, credentials, or production dashboards.
- Review the individual learner screen, directory, and audit trail together before treating the generated mockups as an implementation specification.
