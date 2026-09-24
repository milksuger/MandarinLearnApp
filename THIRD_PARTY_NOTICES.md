# Third-party code, data, and fonts

The application is MIT licensed. Third-party components below retain their own licenses; the root MIT license does not replace them.

## Runtime components

| Component | Version | Purpose | License / source |
|---|---:|---|---|
| React / React DOM | 19.3.0 | Mobile/tablet and admin UI | MIT · [React](https://github.com/facebook/react) |
| React Router | 7.18.4 | Client navigation | MIT · [React Router](https://github.com/remix-run/react-router) |
| Hono | 4.13.9 | Worker API | MIT · [Hono](https://github.com/honojs/hono) |
| Better Auth | 1.7.5 | Password authentication and sessions | MIT · [Better Auth](https://github.com/better-auth/better-auth) |
| Zod | 4.6.5 | Request validation | MIT · [Zod](https://github.com/colinhacks/zod) |
| `idb` | 8.0.3 | Account-partitioned offline outbox | ISC · [idb](https://github.com/jakearchibald/idb) |
| Lucide React | 1.48.0 | Interface icons | ISC · [Lucide](https://github.com/lucide-icons/lucide) |
| Hanzi Writer | 3.7.3 | Guided stroke-order rendering and quiz | MIT · [source](https://github.com/chanind/hanzi-writer); copy: [`licenses/HANZI-WRITER-MIT.txt`](licenses/HANZI-WRITER-MIT.txt) |
| OpenCC JS | 1.4.2 | Traditional-to-simplified candidate normalization | MIT · [source](https://github.com/nk2028/opencc-js); copy: [`licenses/OPENCC-JS-MIT.txt`](licenses/OPENCC-JS-MIT.txt) |
| OpenCC data | 1.4.2 | Conversion dictionaries bundled by OpenCC JS | Apache-2.0 · copy: [`licenses/OPENCC-DATA-APACHE-2.0.txt`](licenses/OPENCC-DATA-APACHE-2.0.txt); upstream details in the package's `THIRD_PARTY_LICENSES.md` |
| Plus Jakarta Sans | 5.3.0 | Self-hosted UI typeface | SIL Open Font License 1.1 · [source](https://github.com/fontsource/fontsource); copy: [`licenses/PLUS-JAKARTA-SANS-OFL.txt`](licenses/PLUS-JAKARTA-SANS-OFL.txt) |

Build tooling and direct development dependencies are recorded, with exact versions and package metadata, in [`package.json`](package.json) and [`package-lock.json`](package-lock.json). Their package licenses remain applicable to redistributed build artifacts.

## Offline Chinese handwriting recognition

The WASM recognizer is the unmodified prebuilt output of [`gugray/hanzi_lookup`](https://github.com/gugray/hanzi_lookup), upstream commit `01f90c3ab99a8fadf0696c28e5eb097223c500db`.

- Rust library and generated JavaScript glue: GNU LGPL-3.0; source, Cargo manifest, and upstream build notes are preserved under [`third_party/hanzi_lookup/`](third_party/hanzi_lookup/). The browser loads this separate WASM library at runtime from the app's own origin.
- Embedded stroke-shape data: Arphic Public License. The upstream source and data notice are [`third_party/hanzi_lookup/LICENSE-APL`](third_party/hanzi_lookup/LICENSE-APL); binary source data is preserved at [`third_party/hanzi_lookup/data/mmah.bin`](third_party/hanzi_lookup/data/mmah.bin).
- No raw handwriting points are sent to this library's upstream, a cloud recognition service, or the app server.
- The matcher ranks similar shapes. It is not a calibrated probability or a guarantee that the first suggestion is correct; learners explicitly confirm a candidate.

## Pronunciation recordings

The original Wikimedia Ogg files are preserved in [`third_party/audio_sources/`](third_party/audio_sources/). MP3 copies in `public/media/audio/` were transcoded for broader iPad/Safari support with FFmpeg 2013 and libmp3lame, CBR 128 kbit/s, mono, 22.05 kHz. The audio content was not edited. Original and derivative SHA-256 values, file sizes, duration, source pages, and license attribution are recorded in the seeded `audio_assets` rows in [`migrations/0005_source_verified_assets.sql`](migrations/0005_source_verified_assets.sql).

| Recording | Author and source | Terms | Product scope |
|---|---|---|---|
| `你好` (`nǐ hǎo`) | Sjors Provoost, [Wikimedia Commons file](https://commons.wikimedia.org/wiki/File:Zh_n%C7%90_h%C7%8Eo.ogg); exact Mandarin reading is listed at [Wiktionary](https://en.wiktionary.org/wiki/n%C7%90_h%C7%8Eo) | CC BY-SA 3.0 | Community phrase recording; speaker identity is not stated. This is not a government-certified recording. |
| `你` (`nǐ`) | Wei Gao and Vion Nicolas, [Wikimedia Commons file](https://commons.wikimedia.org/wiki/File:Zh-n%C7%90.ogg) | CC BY 2.0 fr | The Commons description identifies Mandarin 你 and a Beijing speaker. |

No standalone `好` recording is bundled. No TTS fallback is enabled, and unrelated syllables are never spliced to synthesize a word or phrase. Source/license attestation permits these exact files to appear in the learner preview while `pronunciation_review` remains pending; administrators can still review, reject, or retire them. “Source verified” describes provenance and reuse terms, not official pronunciation certification.

## Character stroke-order data

`public/media/strokes/4F60.json` (你) and `public/media/strokes/597D.json` (好) are copied unchanged from [`hanzi-writer-data` 2.0.1](https://github.com/chanind/hanzi-writer-data), whose stroke shapes derive from Make Me a Hanzi and Arphic font glyphs. They are licensed under the **Arphic Public License**; preserve [`licenses/ARPHICPL.TXT`](licenses/ARPHICPL.TXT). This dataset is formally redistributable under its license, but it is not claimed to be a PRC Ministry of Education or national stroke-order standard. Source URLs, file hashes, counts, and version are in [`content/stroke-assets-manifest.json`](content/stroke-assets-manifest.json). Future imports should retain this provenance and support admin review/takedown without blocking verified licensed source data from initial display.
