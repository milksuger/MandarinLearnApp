# Stitch export reference

The visual reference came from the user-provided `stitch_mandarinlearnapp_belajar_mandarin (1).zip` on 2026-09-24. The ZIP contains 13 screen PNGs, generated standalone HTML files, and `DESIGN.md`. The HTML is a static design export, not application architecture or production behavior. It is not copied into the app.

## Screen inventory

Learner phone/tablet screens:

- Sign-in and synchronization.
- Home and today's study goal.
- Daily vocabulary / HSK 3.0 path selection and HSK overview.
- Vocabulary in context with sound, characters, examples, and meanings.
- Guided writing on phone, iPad portrait, and iPad landscape.
- Freehand writing and recognition with an explicit uncertain state.
- Session summary and practice feedback.
- Profile, settings, and synchronization.

Administrator PC screens:

- Operational overview and service/content health.
- Learner progress profile with separate learning dimensions and access-audit context.
- Curriculum and audio provenance/review.

## Visual tokens

These values reflect the exported design direction and are the starting point for app tokens. Validate text contrast when applied to real components.

| Token | Value | Intended use |
|---|---|---|
| Canvas | `#F6F8FA` | Cool near-white app background |
| Surface | `#FFFFFF` | Cards and practice surfaces |
| Ink | `#1F2438` | Main text, Hanzi, and stroke ink |
| Muted text | `#636A84` | Supporting labels and Pinyin context |
| Primary amber | `#FFB800` | Main actions and progress |
| Pressed amber | `#D99B00` | Pressed state / button edge |
| Positive mint | `#00C48C` | Correct/approved states |
| Alert coral | `#FF5B5B` | Errors only, never uncertain input |
| Border | `#EAECF2` | Fine card/input outlines |

Use Plus Jakarta Sans for Indonesian UI where available, with system sans fallback; use system CJK fallbacks such as PingFang SC / Noto Sans SC for Hanzi. Preserve large, uncluttered writing space, crisp white cards, 12–16 px rounded corners, restrained shadows, visible progress, and 44 px minimum touch targets. The learner app uses a compact bottom bar on phones and a roomier tablet layout. Admin uses a left rail and dense, legible desktop tables.

## Design boundaries

- The Stitch export supersedes the earlier warm-paper/teal prompt palette.
- Keep the Super Chinese-inspired lesson hierarchy and writing focus, but do not copy its logo, proprietary assets, or exact screen composition.
- Treat every figure, person, timestamp, service state, voice identity, and accuracy percentage in prototype screens as fictional placeholder data. Do not persist or display it as a measured result.
- Do not add the prototype's unsupported accuracy claims to the real product. Keep guided stroke-order evaluation separate from freehand character recognition.
- The reference indicates some copy that needs editorial correction. Store Simplified Chinese, tone-marked Pinyin, and Indonesian glosses as content records rather than embedding the text in UI components.
