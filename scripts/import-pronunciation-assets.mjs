import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve, sep } from 'node:path';
import { spawn } from 'node:child_process';

const root = process.cwd();
function projectPath(relativePath) {
  const target = resolve(root, relativePath);
  if (!target.startsWith(`${root}${sep}`)) throw new Error(`Path must stay inside the project: ${relativePath}`);
  return target;
}

const importPath = projectPath(process.argv[2] ?? 'content/pronunciation-import-2026-09.json');
const manifestPath = join(root, 'content/audio-assets-manifest.json');
const noticesPath = join(root, 'THIRD_PARTY_NOTICES.md');
const importSpec = JSON.parse(await readFile(importPath, 'utf8'));
const migrationPath = projectPath(importSpec.migrationFile);
if (!migrationPath.startsWith(`${join(root, 'migrations')}${sep}`)) throw new Error('Generated migration must be inside migrations/.');
const course = importSpec.courseFile ? JSON.parse(await readFile(projectPath(importSpec.courseFile), 'utf8')) : { words: [] };
const words = new Map(course.words.map((word) => [word.id, word]));
const expectedLicense = new Map([
  ['CC0', 'http://creativecommons.org/publicdomain/zero/1.0/deed.en'],
  ['CC BY-SA 4.0', 'https://creativecommons.org/licenses/by-sa/4.0'],
  ['CC BY-SA 3.0 us', 'https://creativecommons.org/licenses/by-sa/3.0/us/deed.en'],
  ['CC BY 2.0 fr', 'https://creativecommons.org/licenses/by/2.0/fr/deed.en'],
]);
const userAgent = 'MandarinLearnApp/0.1 (https://github.com/milksuger/MandarinLearnApp; open source educational project)';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function sha1(bytes) {
  return createHash('sha1').update(bytes).digest('hex');
}

function sql(value) {
  return value == null ? 'NULL' : `'${String(value).replaceAll("'", "''")}'`;
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('error', reject);
    child.on('close', (code) => code === 0
      ? resolve({ stdout, stderr })
      : reject(new Error(`${command} exited ${code}: ${stderr}`)));
  });
}

const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function download(url, label) {
  let lastStatus = 0;
  for (let attempt = 0; attempt < 7; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);
    let response;
    try {
      response = await fetch(url, {
        headers: { 'User-Agent': userAgent },
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }
    if (response.ok) return response;
    lastStatus = response.status;
    if (![429, 500, 502, 503, 504].includes(response.status)) break;
    const retryAfter = Number(response.headers.get('retry-after'));
    if (Number.isFinite(retryAfter) && retryAfter > 30) {
      throw new Error(`Wikimedia asks clients to retry ${label} after ${retryAfter}s; rerun this resumable import later.`);
    }
    await sleep(Math.max(Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 0, 1200 * (attempt + 1)));
  }
  throw new Error(`Download failed for ${label}: ${lastStatus}`);
}

assert(importSpec.recordings.length > 0, 'The curated recording list is empty.');
for (const recording of importSpec.recordings) {
  const word = words.get(recording.wordId) ?? { id: recording.wordId, form: recording.form, pinyin: recording.pinyin };
  const profile = importSpec.profiles[recording.profile];
  assert(word, `Unknown word id: ${recording.wordId}`);
  assert(profile, `Unknown profile: ${recording.profile}`);
  if (recording.sourceType === 'shtooka') {
    const sourceReading = recording.fileTitle.replace(/^Zh-/, '').replace(/\.ogg$/i, '').normalize('NFC');
    const spacedReading = word.pinyin.join(' ').normalize('NFC');
    const compactReading = word.pinyin.join('').normalize('NFC');
    const legacyReading = recording.fileTitlePinyin?.normalize('NFC');
    assert(sourceReading === spacedReading || sourceReading === compactReading || sourceReading === legacyReading, `File pinyin does not match ${word.form}: ${recording.fileTitle}`);
  } else {
    assert(recording.fileTitle.includes('(cmn)-'), `Not tagged as Mandarin: ${recording.fileTitle}`);
    const fileWord = recording.fileTitle.replace(/\.wav$/i, '').slice(recording.fileTitle.lastIndexOf('-') + 1).replace(/[?!.，。！？]+$/u, '').normalize('NFC');
    assert(fileWord === word.form.normalize('NFC'), `File text does not match ${word.form}: ${recording.fileTitle}`);
  }
  assert(expectedLicense.has(profile.license), `Unexpected license for ${recording.fileTitle}`);
  assert(Array.isArray(word.pinyin) && word.pinyin.length > 0, `Missing pinyin for ${recording.wordId}`);
}

const pagesByTitle = new Map();
for (let offset = 0; offset < importSpec.recordings.length; offset += 40) {
  const titles = importSpec.recordings.slice(offset, offset + 40).map(({ fileTitle }) => `File:${fileTitle}`).join('|');
  const apiUrl = new URL('https://commons.wikimedia.org/w/api.php');
  for (const [key, value] of Object.entries({
    action: 'query', format: 'json', formatversion: '2', prop: 'imageinfo',
    iiprop: 'url|sha1|size|mime|extmetadata',
    iiextmetadatafilter: 'LicenseShortName|LicenseUrl|Artist|DateTimeOriginal|Credit|Description',
    titles,
  })) apiUrl.searchParams.set(key, value);

  const apiResponse = await fetch(apiUrl, { headers: { 'User-Agent': userAgent } });
  assert(apiResponse.ok, `Wikimedia Commons API returned ${apiResponse.status}`);
  const apiData = await apiResponse.json();
  for (const page of apiData.query?.pages ?? []) pagesByTitle.set(page.title, page);
}
const now = new Date().toISOString();
const archiveRoot = join(root, 'third_party/audio_sources');
const publicRoot = join(root, 'public/media/audio');
await mkdir(archiveRoot, { recursive: true });
await mkdir(publicRoot, { recursive: true });

const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
const importedAssets = [];
for (const recording of importSpec.recordings) {
  const word = words.get(recording.wordId) ?? { id: recording.wordId, form: recording.form, pinyin: recording.pinyin };
  const profile = importSpec.profiles[recording.profile];
  const title = `File:${recording.fileTitle}`;
  const page = pagesByTitle.get(title);
  const info = page?.imageinfo?.[0];
  const metadata = info?.extmetadata ?? {};
  assert(info && !page.missing, `Commons file missing: ${title}`);
  const sourceType = recording.sourceType ?? 'lingualibre';
  const sourceExtension = sourceType === 'shtooka' ? 'ogg' : 'wav';
  const sourceMime = sourceType === 'shtooka' ? 'application/ogg' : 'audio/wav';
  assert(info.mime === sourceMime, `Expected ${sourceMime} for ${title}, got ${info.mime}`);
  assert(metadata.LicenseShortName?.value === profile.license, `License mismatch: ${title}`);
  assert(metadata.LicenseUrl?.value === expectedLicense.get(profile.license), `License URL mismatch: ${title}`);
  assert(profile.speakerQid
    ? metadata.Artist?.value?.includes(profile.speakerQid)
    : metadata.Artist?.value?.includes(profile.artist), `Speaker/artist metadata mismatch: ${title}`);

  let sourceDescription = '';
  if (sourceType === 'shtooka') {
    const pageUrl = new URL('https://commons.wikimedia.org/w/api.php');
    for (const [key, value] of Object.entries({ action: 'parse', format: 'json', prop: 'wikitext', page: title })) pageUrl.searchParams.set(key, value);
    const pageResponse = await fetch(pageUrl, { headers: { 'User-Agent': userAgent } });
    assert(pageResponse.ok, `Wikimedia Commons page lookup returned ${pageResponse.status}: ${title}`);
    const pageData = await pageResponse.json();
    const wikitext = pageData.parse?.wikitext?.['*'] ?? '';
    assert(wikitext.includes(recording.descriptionCheck), `Commons description does not confirm the target word ${word.form}: ${title}`);
    sourceDescription = wikitext;
  }

  const sourceSlug = sourceType === 'shtooka' ? 'shtooka' : 'lingualibre';
  const originalPath = join(archiveRoot, `${sourceSlug}-${recording.wordId}-original.${sourceExtension}`);
  let original;
  let downloadedFromSource = false;
  try {
    original = await readFile(originalPath);
  } catch {
    const sourceUrl = new URL(info.url);
    sourceUrl.search = '';
    const fileResponse = await download(sourceUrl, title);
    original = Buffer.from(await fileResponse.arrayBuffer());
    downloadedFromSource = true;
  }
  assert(sha1(original) === info.sha1, `Commons SHA-1 mismatch for ${title}`);

  const audioId = recording.audioId ?? `audio-${recording.wordId}`;
  const productPath = join(publicRoot, `${sourceSlug}-${recording.wordId}.mp3`);
  await writeFile(originalPath, original);
  await run('ffmpeg', [
    '-y', '-i', originalPath,
    '-vn', '-map_metadata', '-1', '-acodec', 'libmp3lame', '-ab', '128k',
    '-ac', '1', '-ar', '22050', productPath,
  ]);

  const product = await readFile(productPath);
  const probe = await run('ffprobe', [
    '-v', 'error', '-show_entries', 'format=duration', '-of', 'json', productPath,
  ]);
  const durationSeconds = Number(JSON.parse(probe.stdout).format?.duration);
  assert(Number.isFinite(durationSeconds) && durationSeconds > 0, `Could not determine audio duration for ${title}`);
  const asset = {
    id: audioId,
    readingId: recording.readingId ?? `reading-${recording.wordId}`,
    text: word.form,
    pinyin: word.pinyin.join(' '),
    sourceFile: `third_party/audio_sources/${sourceSlug}-${recording.wordId}-original.${sourceExtension}`,
    sourceSha256: sha256(original),
    sourceSha1: info.sha1,
    sourceTitle: recording.fileTitle,
    sourcePage: `https://commons.wikimedia.org/wiki/${encodeURIComponent(title).replaceAll('%3A', ':').replaceAll('%20', '_')}`,
    readingReference: profile.profileUrl,
    creator: profile.creator ?? profile.speaker,
    recordedBy: profile.recorder,
    license: profile.license,
    licenseUrl: expectedLicense.get(profile.license),
    speakerIdentity: recording.speakerIdentity ?? `${profile.speaker}; listed as the speaker in Commons metadata for a recording tagged cmn`,
    speakerProfile: profile.profileUrl,
    productFile: `public/media/audio/${sourceSlug}-${recording.wordId}.mp3`,
    productSha256: sha256(product),
    sizeBytes: product.byteLength,
    durationMs: Math.round(durationSeconds * 1000),
    transformation: `Lossy compatibility transcode from unchanged Wikimedia ${sourceType === 'shtooka' ? 'Shtooka OGG' : 'Lingua Libre WAV'} using FFmpeg 2013/libmp3lame, CBR 128 kbit/s, mono, 22.05 kHz; no speech editing`,
    sourceDescription,
    sourceType,
    sourceSlug,
    sourceUrl: profile.sourceUrl,
  };
  importedAssets.push({ ...asset, wordId: recording.wordId, readingId: recording.readingId ?? `reading-${recording.wordId}`, profileKey: recording.profile, profile, fileTitle: recording.fileTitle });
  console.log(`Imported ${word.form} ${asset.durationMs} ms (${profile.license})`);
  if (downloadedFromSource) await sleep(900);
}

const importIds = new Set(importedAssets.map((asset) => asset.id));
manifest.assets = [...manifest.assets.filter((asset) => !importIds.has(asset.id)), ...importedAssets.map((asset) => {
  const { wordId, profileKey, profile: _profile, fileTitle: _fileTitle, ...publicAsset } = asset;
  return publicAsset;
})];
await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

const noticeText = await readFile(noticesPath, 'utf8');
const tableStart = '<!-- pronunciation-recordings:start -->';
const tableEnd = '<!-- pronunciation-recordings:end -->';
assert(noticeText.includes(tableStart) && noticeText.includes(tableEnd), 'Pronunciation attribution table markers are missing from THIRD_PARTY_NOTICES.md');
const tableRows = manifest.assets.map((asset) => {
  const author = [asset.creator, asset.recordedBy ? `recorded by ${asset.recordedBy}` : null].filter(Boolean).join('; ');
  const sourceLink = `[Wikimedia Commons source](${asset.sourcePage})`;
  const profileLink = asset.speakerProfile ? ` · [speaker profile](${asset.speakerProfile})` : '';
  return `| ${asset.text} (${asset.pinyin}) | ${author} · [${asset.sourceTitle ?? 'Wikimedia Commons file'}](${asset.sourcePage})${profileLink} | [${asset.license}](${asset.licenseUrl}) | ${asset.transformation} |`;
}).join('\n');
const attributionTable = `${tableStart}\n| Recording | Creator and source | Terms | Changes in app |\n|---|---|---|---|\n${tableRows}\n${tableEnd}`;
const updatedNotices = noticeText.replace(new RegExp(`${tableStart}[\\s\\S]*?${tableEnd}`), attributionTable);
await writeFile(noticesPath, updatedNotices);

const profiles = Object.entries(importSpec.profiles);
const sourceSql = profiles.map(([profileKey, profile]) => {
  const sourceId = profile.sourceId ?? `source-lingualibre-${profileKey}`;
  const sourceUrl = profile.sourceUrl ?? 'https://commons.wikimedia.org/wiki/Category:Lingua_Libre_pronunciation-cmn';
  const sourceName = profile.sourceName ?? `Wikimedia Commons Lingua Libre Mandarin recordings by ${profile.speaker}`;
  const attribution = `${sourceName}; ${profile.creator ? `creator: ${profile.creator}; ` : `creator/speaker: ${profile.speaker}; `}profile/source: ${profile.profileUrl}; Wikimedia Commons; ${profile.license}. Individual file pages are recorded per audio asset.`;
  const notes = profile.sourceNotes ?? 'Exact word recordings tagged LL-Q9192 (cmn); speaker and recorder are read from per-file Commons metadata. Reuse license is stated per Commons file and verified against downloaded bytes. Community recording, not government-certified audio.';
  const verification = profile.verificationMethod ?? 'Commons exact file title, cmn language tag, speaker/creator metadata, license metadata and downloaded SHA-1 verified by importer';
  return `INSERT OR IGNORE INTO asset_sources(id,name,version,source_url,license_id,license_url,attribution,checksum,notes,license_verification,verification_method,verified_at)\nVALUES(${sql(sourceId)},${sql(sourceName)},${sql(importSpec.version)},${sql(sourceUrl)},${sql(profile.license)},${sql(expectedLicense.get(profile.license))},${sql(attribution)},NULL,${sql(notes)},'verified',${sql(verification)},${sql(now)});`;
}).join('\n\n');
const assetRows = importedAssets.map((asset) => {
  const sourceId = asset.profile.sourceId ?? `source-lingualibre-${asset.profileKey}`;
  const sourcePage = asset.sourcePage;
  const matchDescription = asset.sourceType === 'shtooka'
    ? `Commons description confirms pronunciation ${asset.pinyin} for ${asset.text}; listed voice: ${asset.speakerIdentity}; source SHA-1 ${asset.sourceSha1} and license ${asset.license} verified against Commons metadata.`
    : `Exact Commons Lingua Libre filename identifies ${asset.text} and is tagged cmn; SHA-1 ${asset.sourceSha1}, license ${asset.license}, speaker profile ${asset.profile.speakerQid}; original and derivative hashes retained in content manifest.`;
  const derivative = `${asset.transformation}. CC BY-SA assets remain available under the same terms with attribution.`;
  return `(${sql(asset.id)},${sql(asset.readingId)},${sql(sourceId)},${sql(`media/audio/${asset.sourceSlug}-${asset.wordId}.mp3`)},${sql(asset.productSha256)},'audio/mpeg',${asset.sizeBytes},${asset.durationMs},${sql(asset.profile.speaker)},'cmn',${sql(`Exact isolated Mandarin pronunciation ${asset.text} / ${asset.pinyin}`)},'pending','approved',${sql(sourcePage)},${sql(now)},${sql(matchDescription)},${sql(asset.sourceSha256)},${sql(derivative)})`;
}).join(',\n');
const migration = `PRAGMA foreign_keys = ON;\n\n-- Source-verified, exact licensed Mandarin human word recordings.\n-- Pronunciation review remains available to admins; source attestation allows\n-- these licensed community recordings to be used while the review is pending.\n${sourceSql}\n\nINSERT OR IGNORE INTO audio_assets(\n id,reading_id,source_id,storage_key,sha256,format,size_bytes,duration_ms,speaker_id,dialect,\n recording_context,pronunciation_review,status,source_page_url,source_attested_at,\n source_attestation_method,original_sha256,derivative_notes\n) VALUES\n${assetRows};\n`;
await writeFile(migrationPath, migration);
console.log(`Updated ${manifest.assets.length} manifest entries and generated ${migrationPath}`);
