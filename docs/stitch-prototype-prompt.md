# Google Stitch Prototype Prompt

Research and product constraints for this prompt are recorded in [research-and-architecture-baseline.md](research-and-architecture-baseline.md).

Copy the prompt between **BEGIN PROMPT** and **END PROMPT** into Google Stitch. The prompt is in English to make the layout and interaction requirements explicit; all learner-facing UI copy must be in Bahasa Indonesia, with Simplified Chinese and tone-marked Pinyin shown as learning content.

---

## BEGIN PROMPT

You are a senior product designer creating a polished, connected, responsive prototype for **Belajar Mandarin**, a Mandarin-learning web app for Indonesian-speaking beginners.

### Product goal

Help learners understand, hear, write, and retain Simplified Chinese words and characters. The primary study loop is:

Choose a learning path → study a word in context → hear its verified Mandarin pronunciation → learn its characters → practise guided strokes → write from memory → review later.

The product has two parallel curriculum paths:

1. **Daily vocabulary**, organized around useful real-life situations.
2. **HSK 3.0**, organized into three stages and nine levels, with the standard version visible in the curriculum UI.

The same word and character can appear in both paths. Do not present the product as a collection of isolated flip cards. Show the relationships between a word, its characters, its readings, meanings, examples, and course placements.

### Non-negotiable product requirements

- The learner must sign in. Their account, learning progress, and practice history synchronize through the server across phone, iPad, and desktop.
- The app may cache lessons and approved audio for offline study. If attempts are made offline, show that they are queued and pending server sync. The device is not the canonical account database.
- Include a protected administrator area for observing usage and content quality.
- The learner-facing app must have no subscription wall, lesson quota, or feature paywall.
- Use Simplified Chinese only. Do not add Traditional Chinese characters or region-specific Traditional-writing controls.
- The interface language is Bahasa Indonesia. Learning content includes Simplified Hanzi, tone-marked Pinyin, and concise Indonesian meanings and instructions.
- Audio must be tied to an approved reading and context. Never play an unverified voice just to avoid silence. If no verified audio is available, keep the tone-marked Pinyin visible and provide a clear retry or unavailable state.
- Distinguish guided stroke practice from freehand writing recognition. Recognition may be uncertain; provide a retry or guided-practice route instead of falsely marking uncertain work as correct or incorrect.
- Treat the attached Super Chinese screenshot only as context for the vocabulary-to-writing flow and the frustration caused by a lesson paywall. Create an original identity and layout. Do not reproduce that product's branding, logo, colors, or exact composition.

### Target devices and responsive layouts

Create responsive layouts for all of these:

- Phone portrait around 390 × 844 px.
- iPad 8th-generation portrait around 810 × 1080 CSS px.
- iPad 8th-generation landscape around 1080 × 810 CSS px.
- Desktop around 1440 × 900 px.

The iPad is the primary writing device. Make its handwriting canvas large and central, and leave room for the learner to rest a hand while using a third-party stylus. Accept stylus, finger, and mouse input. Do not depend on Apple Pencil-only pressure or hover features.

Use a two-pane learning layout on iPad landscape and desktop: learning context and feedback in one pane, a large writing area in the other. On iPad portrait, keep the word and audio controls above a large writing area. On phones, use a clear vertical flow. Never require horizontal scrolling.

### Visual direction

Create a calm, confident study-workbook aesthetic with a warm ivory background, dark ink text, teal/green primary actions, and restrained amber accents for progress and feedback. Use generous whitespace, a clear grid, readable Indonesian text, and crisp Chinese glyph rendering. Keep the style adult and encouraging rather than childish or overly gamified. Use a temporary text wordmark “Belajar Mandarin”; do not invent a detailed logo.

Use a consistent type scale and spacing system. Make normal text readable at mobile size. Maintain strong contrast, visible keyboard focus, accessible labels for icon buttons, and touch targets of at least 44 px/pt. Do not rely on color alone to signal success or errors. Respect larger text and reduced-motion preferences. Use hover only as an enhancement; every action must work with tap, stylus, or keyboard.

### Learner navigation

Use a simple, predictable navigation structure:

- Home
- Learn
- Review
- Progress
- Profile

On phones, use a compact bottom navigation with no more than five items. On iPad and desktop, use a side navigation or a spacious top navigation that leaves the study canvas uncluttered.

### Screens and connected flows to generate

Create high-fidelity connected screens with realistic Indonesian UI text. Include empty, loading, error, success, offline, and synchronization states where listed.

#### 1. Sign in and account setup

Show sign-in, account creation, password recovery, and a clear privacy link. The learner should understand that progress is tied to their account and syncs across devices. Include loading and sign-in error states. Keep this screen warm and welcoming rather than sales-focused.

#### 2. First-use onboarding

Ask only for useful setup choices:

- Learner’s current Mandarin level.
- Whether to begin with daily vocabulary, HSK 3.0, or both.
- A modest daily study goal.

Provide a skip/back path and explain that these settings can be changed later. Do not imply that onboarding locks the learner into a path.

#### 3. Home

Show:

- A personal greeting.
- Today’s practice goal and completed amount.
- A clear “Continue learning” action.
- Review items due today.
- Entry points for Daily vocabulary and HSK 3.0.
- A small, calm progress summary.
- Account sync status and last successful sync, without making sync status the dominant element.

Use sample values only as prototype data. Avoid streak-shaming, urgency banners, and membership upsells.

#### 4. Learning paths

Create a Daily vocabulary overview with situation-based units such as introductions, home, food, transport, and everyday needs. Show completed, in-progress, and not-yet-started units.

Create an HSK 3.0 overview grouped into:

- Elementary: Levels 1–3.
- Intermediate: Levels 4–6.
- Advanced: Levels 7–9.

Show per-level progress and lesson counts. Keep the HSK standard version visible and make the path versionable. Do not mix older HSK content into the HSK 3.0 path.

#### 5. Vocabulary in context

Create a vocabulary detail or lesson-introduction screen that connects meaning, sound, characters, and examples.

Use this sample:

- Word: 高山
- Pinyin: gāo shān, with tone marks clearly visible
- Indonesian meaning: gunung tinggi
- Related characters: 高 and 山
- Example phrase or sentence with an Indonesian gloss
- A large audio play control for the exact phrase

Also show one isolated character example:

- Character: 山
- Pinyin: shān
- Indonesian meaning: gunung

Allow the learner to open the character details and start writing practice. Do not collapse multiple senses or polyphonic readings into one unexplained back-of-card answer.

#### 6. Guided character practice

Design this screen especially for iPad landscape, with a responsive phone version.

Show:

- The target character and contextual word.
- Tone-marked Pinyin and a clearly labeled pronunciation button.
- A stroke-order animation with controls to replay, slow down, and show/hide a hint.
- A large 田字格-style writing canvas with a subtle guide or ghost character.
- Clear progress such as “Stroke 2 of 3”.
- Undo, clear, hint, and continue controls.
- Immediate feedback with both text/icon and color.

Include distinct feedback states:

- Correct stroke.
- Wrong order.
- Wrong direction.
- Shape does not match closely enough.
- Input could not be classified confidently.

Use gentle Indonesian copy. For uncertain input, say that the writing was not recognized with enough confidence and offer retry or guided tracing. Do not imply that an uncertain stroke is definitely wrong.

#### 7. Freehand writing and recognition

Provide a separate mode in which the learner writes the complete target character without a ghost outline. The target may remain visible above the canvas, but hide the guide strokes during the attempt.

After submission, show separate judgments for:

- Whether the written character was recognized as the target.
- Stroke order.
- Stroke direction.
- Overall shape/completeness.

Include these result states:

- Correct character and acceptable stroke order.
- Correct character but a stroke-order issue, with a replayable explanation.
- Different character recognized, with a retry action.
- Recognition uncertain, with “Try again” and “Switch to guided practice”.
- No network while the account has queued the attempt for later sync.

Keep the learner in control with undo and clear. Do not reward a guessed recognition result as mastery.

#### 8. Practice summary and review

Show:

- Session completed and words/characters practised.
- The dimensions that need practice, such as writing, reading, or pronunciation.
- A simple “Review again” action.
- A return to the selected Daily or HSK path.
- The next review time or a clear statement that the item is ready for review later.

Do not show only a binary “learned/not learned” status. Use progress that can reflect separate writing, recognition, and reading skills.

#### 9. Profile, settings, and sync

Include account details, study language, daily goal, curriculum settings, font/text-size control, audio playback speed, backup/export, and sign-out.

Show clear sync states:

- Synced.
- Sync pending.
- Offline with attempts queued.
- Sync failed, with a retry action.

Explain that local cached content supports offline practice while the account’s history syncs to the server when connected.

#### 10. Protected administrator overview

Create a visually separate admin area with a role-protected entry. Use a desktop-first dashboard that remains usable on iPad.

Show aggregate usage and quality measures:

- Active learner accounts over time.
- Practice sessions started and completed.
- Daily and HSK curriculum progress.
- Review activity.
- Sync failure rate.
- Audio playback failures and approved-asset fallback rate.
- Handwriting recognition confidence and retry rate.

Use clear date filters and readable charts. Do not show raw microphone audio or raw handwriting strokes in routine analytics. Avoid fake personal details; use clearly marked mock data.

#### 11. Administrator content and audio quality

Create a content review screen with:

- Vocabulary/character search.
- Simplified form, Pinyin, Indonesian meaning, example context, and related characters.
- HSK standard/version and daily-topic placements.
- Source, version, license, attribution, and review status.
- Reading-specific audio asset, voice/model metadata, reviewer state, and playback preview.
- Clear states for pending review, approved, rejected, and replaced assets.

Show warnings when a polyphonic character lacks a context word or when a dictionary/stroke/audio source is missing. Keep source and license information visible to the administrator, not as clutter in the learner’s study view.

### Example interaction and copy

Use Indonesian learner-facing labels such as:

- “Lanjutkan belajar”
- “Latihan hari ini”
- “Kosakata sehari-hari”
- “Persiapan HSK 3.0”
- “Dengarkan pelafalan”
- “Ulangi animasi”
- “Tulis sendiri”
- “Coba lagi”
- “Tulisan belum terbaca dengan yakin”
- “Perubahan menunggu sinkronisasi”
- “Audio belum tersedia”

Keep Chinese text and tone-marked Pinyin visually distinct but readable. Never display Pinyin without its tone marks in the primary teaching view.

### Prototype delivery

Generate a connected prototype, not a set of unrelated mockups. Include the main learner flow from sign-in through a writing session and review, plus a separate protected admin flow. Create responsive variants for phone, iPad portrait, iPad landscape, and desktop. Show key interaction states for stylus writing, uncertain recognition, audio playback failure, offline attempts, and server synchronization.

Use consistent components and spacing across screens. Make the writing canvas the main visual focus during practice. Keep implementation/provider details out of learner-facing screens. Label any assumptions or placeholder values clearly; do not invent a voice-service guarantee, handwriting accuracy percentage, or copyrighted lesson text.

## END PROMPT

---

## Inputs to attach in Stitch

- Optionally attach the supplied Super Chinese screenshot as a behavior reference only.
- Do not attach private account data, credentials, or learner audio.
- After Stitch generates the prototype, review it on iPad 8th-generation portrait and landscape sizes before using it as the implementation reference.
