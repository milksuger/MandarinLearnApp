# Sentence-level audio support

**Status:** Implemented; release authorized by the user on 2026-09-26
**Date:** 2026-09-26
**Scope:** Reusable Mandarin recordings attached to existing examples, dialogue turns, and story paragraphs.

## Problem

The application can currently associate a licensed recording only with a contextual vocabulary or character `reading`. Examples, dialogue turns, and story paragraphs have stable IDs and text, but their playback uses device speech. Sentence audio must be associated with the exact text record without creating fake vocabulary readings or duplicating the learning content.

## Goals

- Preserve existing `/api/v1/audio/:assetId` behavior and all existing vocabulary recordings.
- Model a recording as a reusable, source-attributed media asset, independently from the content it is attached to.
- Support typed associations to `examples`, `dialogue_turns`, and `story_paragraphs` with database-enforced foreign keys.
- Keep provenance, license, recording identity, exact source file hash, served derivative hash, format, duration, review status, and source attestation separate from pronunciation review.
- Return only approved recordings that are manually passed or have source attestation to learner-facing lesson APIs.
- Preserve an admin-only preview and an explicit pass/fail review decision for sentence assets.
- Use only free, redistributable human recordings for sentence content. Sentence examples, dialogue, stories, and placement-question sentences must never fall back to device speech synthesis.
- Keep all new schema changes additive and portable to a future database adapter.

## Non-goals for this pilot

- Bulk importing Tatoeba or any other corpus.
- Treating a corpus-wide sentence license as the license for each recording.
- Automatically approving pronunciation based on a filename, speaker profile, transcription, or checksum.
- Downloading audio from a live third-party API at playback time.
- Replacing or migrating the existing `audio_assets` table.
- Adding automated speech recognition, speech scoring, recording, or paid services.

## Data model

Add a `content_audio_assets` table for sentence-level audio metadata. Each asset references the existing `asset_sources` record, which remains the authority for license and attribution. Store storage key, SHA-256 for the served bytes, original-file SHA-256 when applicable, MIME type, size, duration, speaker, dialect, recording context, pronunciation-review decision, source page, source-attestation details, workflow status, replacement link, reviewer, and timestamps. Do not conflate source attestation with human listening review.

Add three explicit link tables: `example_audio_links`, `dialogue_turn_audio_links`, and `story_paragraph_audio_links`. Each has a foreign key to the target content record and to `content_audio_assets`; use a composite key and an ordinal/role so future variants can be added without changing the content row. This preserves relational integrity and allows one recording asset to be linked to more than one compatible record if reuse is justified.

Existing `audio_assets.reading_id` remains unchanged. Vocabulary and sentence audio are separate record types, both addressable by the versioned audio API. IDs for new sentence assets use a distinct prefix to prevent collision with legacy asset IDs.

## Import and publication rules

For every recording candidate, verify the exact Mandarin text/reading, the contributor and recording page, the per-file license and license URL, any required attribution, original bytes and hash, derivative bytes and hash, format, duration, and a permissible transformation path. Retain the unmodified source when distribution terms allow it. A license may require attribution or ShareAlike; preserve those terms in the application credits and `THIRD_PARTY_NOTICES.md`.

Source verification does not certify pronunciation quality. Keep `pronunciation_review` pending until a qualified listener reviews the actual sound; source-attested assets may be published under the project's existing rule while clearly retaining pending review status. Never call a community recording official, studio-certified, or manually reviewed unless the corresponding evidence exists.

Candidate discovery must not add rows to published content automatically. The importer must reject missing/ambiguous license information, text mismatch, unsupported media types, checksum mismatch, and unapproved transformations. Any downloaded or converted asset must be committed with its manifest entry and attribution update in the same release.

## API and client behavior

- Keep `GET /api/v1/audio/:assetId` and add a namespaced sentence asset lookup without changing existing clients.
- For sentence assets, serve only approved assets with a passed pronunciation review or a recorded source attestation. Candidate preview remains restricted to owner/content reviewers and audited.
- Extend the lesson response with an optional `audioId` (and duration where available) on each example, dialogue turn, and story paragraph. Select only currently approved, publishable assets and keep response text and content IDs unchanged.
- The learner UI shows the source recording when `audioId` exists. Otherwise it renders a disabled control labeled "Rekaman manusia belum tersedia". Sentence content must never invoke device speech synthesis, another voice, syllable splicing, or a paid provider.
- Extend the admin review queue and pass/fail route to support sentence assets while preserving the existing word-audio queue.

## Coverage found for this release

The source scan covered 130 unique published examples, dialogue turns, and story paragraphs. It found three exact Tatoeba candidates, but all had blank per-file licenses and therefore could not be reused. Mozilla Common Voice 27.0 has a large `zh-CN` corpus under CC0-1.0, but its dataset page forbids re-hosting or re-sharing; it was not imported. A smaller Common Voice 26.0 Beijing Chinese segment has 2,860 CC0 clips and no listed re-hosting restriction, but its API-key-protected archive was not available for exact transcript matching. The existing licensed `你好` recording is safely linked to the exact spoken phrase `你好！` because the only difference is terminal punctuation. Thus one target has a verified human recording and 129 remain uncovered until further corpus checks. The user requires sentence playback to use human recordings only; uncovered sentence controls stay disabled. Do not claim full sentence-audio coverage or replace the missing recordings with device speech.

## Validation and rollout

- Never alter an existing migration. Apply the additive migrations in order.
- The user has explicitly requested commit, production deployment, and remote acceptance checks for this release.
- Before each production D1 migration, create a protected D1 export outside the repository. Apply the migration before deploying Worker code that queries it, then remotely verify both a legacy word audio and a sentence recording endpoint.
- Full 130/130 sentence recording coverage remains a content-source limitation and must be disclosed as incomplete even if the infrastructure release succeeds.

## Source reference

- Tatoeba, [Downloads](https://tatoeba.org/en/downloads): its page states that each audio file's license is chosen by its contributor and is shown on the contributor's audio-files page. The export contains sentence ID, audio ID, username, license, and attribution URL; blank license means the audio must not be reused outside Tatoeba. This is a discovery source only, not blanket redistribution permission.
