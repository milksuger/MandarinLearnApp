import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const contentPath = resolve(root, process.argv[2] ?? 'content/course-expansion-2026-09.json');
const strokePath = resolve(root, 'content/stroke-assets-manifest.json');
const outputPath = resolve(root, process.argv[3] ?? 'migrations/0012_expand_course_content.sql');
const content = JSON.parse(await readFile(contentPath, 'utf8'));
const strokeManifest = JSON.parse(await readFile(strokePath, 'utf8'));

function sql(value) {
  if (value === null || value === undefined) return 'NULL';
  return `'${String(value).replaceAll("'", "''")}'`;
}

function values(rows) {
  return rows.map((row) => `(${row.map(sql).join(',')})`).join(',\n  ');
}

function hanCharacters(text) {
  return [...text].filter((character) => {
    const point = character.codePointAt(0);
    return (point >= 0x3400 && point <= 0x9fff) || (point >= 0x20000 && point <= 0x3134f);
  });
}

function pinyinTone(syllable) {
  const tones = { '\u0304': 1, '\u0301': 2, '\u030c': 3, '\u0300': 4 };
  let tone = 0;
  for (const point of syllable.normalize('NFD')) if (tones[point]) tone = tones[point];
  return tone;
}

function pinyinBase(syllable) {
  return syllable.normalize('NFD').replace(/u\u0308/g, 'v').replace(/[\u0300-\u036f]/g, '').replaceAll('ü', 'v');
}

function assertPinyinMatches(pinyin, numberedPinyin, id, label) {
  const numbered = numberedPinyin.split(/\s+/);
  assert(numbered.length === pinyin.length, `${label} tone-number syllable count mismatch: ${id}`);
  for (let index = 0; index < pinyin.length; index += 1) {
    const match = numbered[index].match(/^(.+?)([0-5])$/);
    assert(match && pinyinBase(pinyin[index]) === match[1].toLowerCase().replaceAll('ü', 'v') && pinyinTone(pinyin[index]) === Number(match[2]),
      `${label} pinyin/tone-number mismatch at syllable ${index + 1}: ${id}`);
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(/^source-course-expansion-\d{4}-\d{2}(?:-[a-z0-9-]+)?$/.test(content.sourceId), 'Unexpected or missing authored-content source ID.');
assert(content.words.length > 0 && content.dailyUnits.length > 0, 'Expansion must include words and daily units.');

const wordById = new Map();
const existingWordById = new Map((content.existingWords ?? []).map((word) => [word.id, word]));
assert(existingWordById.size === (content.existingWords ?? []).length, 'Duplicate existing word reference.');
const forms = new Set((content.existingWords ?? []).map((word) => word.form));
assert(forms.size === (content.existingWords ?? []).length, 'Duplicate existing word form reference.');
for (const word of content.words) {
  assert(!wordById.has(word.id), `Duplicate word ID: ${word.id}`);
  assert(!existingWordById.has(word.id), `New word ID is already marked as an existing reference: ${word.id}`);
  assert(!forms.has(word.form), `Duplicate new word form: ${word.form}`);
  assert(hanCharacters(word.form).length === word.pinyin.length, `Word reading syllable count mismatch: ${word.id}`);
  assert(word.example.trim().length > 0 && hanCharacters(word.example).length === word.examplePinyin.length,
    `Example reading syllable count mismatch: ${word.id}`);
  assert(word.pinyin.join(' '), `Missing word pinyin: ${word.id}`);
  assertPinyinMatches(word.pinyin, word.numberedPinyin, word.id, 'Word');
  assertPinyinMatches(word.examplePinyin, word.exampleNumberedPinyin, word.id, 'Example');
  wordById.set(word.id, word);
  forms.add(word.form);
}

const allUnits = [...content.dailyUnits, ...content.hskUnits];
const unitIds = new Set();
for (const unit of allUnits) {
  assert(!unitIds.has(unit.id), `Duplicate unit ID: ${unit.id}`);
  unitIds.add(unit.id);
  assert(unit.words.length > 0, `Empty unit: ${unit.id}`);
  assert(new Set(unit.words).size === unit.words.length, `Duplicate word placement in unit: ${unit.id}`);
  for (const wordId of unit.words) assert(wordById.has(wordId) || existingWordById.has(wordId), `Unknown word ${wordId} in ${unit.id}`);
}
for (const unit of content.dailyUnits) assert(Number.isInteger(unit.ordinal) && unit.ordinal >= 5, `Invalid daily unit ordinal: ${unit.id}`);

const manifestByCharacter = new Map(strokeManifest.characters.map((item) => [item.character, item]));
const requiredCharacters = [...new Set(content.words.flatMap((word) => [
  ...hanCharacters(word.form), ...hanCharacters(word.example),
]))];
const missingStrokes = requiredCharacters.filter((character) => !manifestByCharacter.has(character));
assert(missingStrokes.length === 0, `Stroke data is missing for: ${missingStrokes.join(' ')}`);

const stamp = content.verifiedAt ?? `${content.sourceId.match(/\d{4}-\d{2}/)?.[0] ?? '1970-01'}-01T00:00:00Z`;
const sourceRows = `INSERT INTO asset_sources(
  id,name,version,source_url,license_id,license_url,attribution,checksum,notes,
  license_verification,verification_method,verified_at
) VALUES (
  ${sql(content.sourceId)},
  ${sql(content.sourceName ?? 'MandarinLearnApp original Indonesian course expansion')},
  ${sql(content.version ?? '1.0.0')},NULL,'CC BY 4.0','https://creativecommons.org/licenses/by/4.0/',
  ${sql(`Original Chinese example sentences, Indonesian glosses, and course sequencing by MandarinLearnApp contributors. ${content.sourceName ?? ''}`)},
  NULL,
  'Project-authored learning content. HSK placements are app learning paths, not official HSK vocabulary lists or syllabus content.',
  'verified','Original content authored for this project; no third-party dictionary or official HSK list text is reproduced.',${sql(stamp)}
);`;

const characterRows = requiredCharacters.map((character) => {
  const asset = manifestByCharacter.get(character);
  assert(asset.copiedUnmodified, `Stroke data must remain unchanged: ${character}`);
  const codePoint = character.codePointAt(0).toString(16).toUpperCase().padStart(4, '0');
  const id = `char-${character.codePointAt(0).toString(16)}`;
  return [id, character, `U+${codePoint}`, asset.strokeCount, 'source-hanzi-writer-data', asset.key,
    asset.sha256, asset.sourceVersion, asset.license, 'approved', 'approved', 'source-hanzi-writer-data',
    `https://github.com/chanind/hanzi-writer-data/blob/master/${encodeURIComponent(character)}.json`, stamp,
    'upstream_package_license_and_character_file'];
});

const readingRows = content.words.map((word) => [
  `reading-${word.id}`, null, word.id, `Everyday word reading: ${word.form}`,
  JSON.stringify(word.pinyin), word.numberedPinyin, '[]', content.sourceId, 'approved',
]);
const glossRows = content.words.map((word) => [
  `gloss-${word.id}`, 'id', word.gloss, word.usage, content.sourceId, 'approved',
]);
const exampleRows = content.words.map((word) => [
  `example-${word.id}`, word.id, null, word.example, JSON.stringify(word.examplePinyin),
  word.exampleNumberedPinyin, 'id', word.translation, content.sourceId, 'approved',
]);
const vocabularyRows = content.words.map((word) => [word.id, word.form, word.partOfSpeech, 'approved', content.sourceId]);
const vocabularyCharacterRows = content.words.flatMap((word) => [...new Set(hanCharacters(word.form))]
  .map((character, position) => [word.id, character, position]));
const glossLinkRows = content.words.map((word) => [word.id, `gloss-${word.id}`]);

const dailyUnitRows = content.dailyUnits.map((unit) => [
  unit.id, 'curriculum-daily-life', unit.slug, unit.title, unit.description, unit.ordinal, 'published',
]);
const labelForWord = (wordId) => wordById.get(wordId)?.form ?? existingWordById.get(wordId)?.form ?? wordId;
const dailyPlacementRows = content.dailyUnits.flatMap((unit) => unit.words.map((wordId, ordinal) => [
  `pl-${unit.id}-${wordId}`, unit.id, wordId, ordinal, `Menggunakan ${labelForWord(wordId)} dalam konteks pelajaran.`, content.sourceId,
]));
const hskPlacementRows = content.hskUnits.flatMap((unit) => unit.words.map((wordId, ordinal) => [
  `pl-${unit.id}-${wordId}`, unit.id, wordId, ordinal, `Latihan kosakata ${labelForWord(wordId)} dalam jalur belajar aplikasi; bukan daftar resmi HSK.`, content.sourceId,
]));

const chunks = [
  'PRAGMA foreign_keys = ON;',
  `-- Generated from ${contentPath.replaceAll('\\', '/')}. Edit the source data and regenerate; do not hand-maintain duplicate seed rows.`,
  sourceRows,
  `INSERT OR IGNORE INTO characters(\n  id,hanzi,unicode_code_point,stroke_count,stroke_data_source_id,stroke_data_storage_key,stroke_data_checksum,\n  stroke_data_version,stroke_data_license_id,stroke_data_status,status,source_id,stroke_data_source_page_url,\n  stroke_data_attested_at,stroke_data_attestation_method\n) VALUES\n  ${values(characterRows)};`,
  `INSERT INTO vocabulary_entries(id,simplified_form,part_of_speech,status,source_id) VALUES\n  ${values(vocabularyRows)};`,
  `INSERT INTO readings(id,character_id,vocabulary_id,context_label,pinyin_json,numbered_pinyin,sandhi_json,source_id,status) VALUES\n  ${values(readingRows)};`,
  `INSERT INTO glosses(id,locale,text,usage_label,source_id,status) VALUES\n  ${values(glossRows)};`,
  `INSERT INTO vocabulary_glosses(vocabulary_id,gloss_id) VALUES\n  ${values(glossLinkRows)};`,
  `WITH links(vocabulary_id,hanzi,position) AS (VALUES\n  ${values(vocabularyCharacterRows)})\nINSERT INTO vocabulary_characters(vocabulary_id,character_id,position)\nSELECT links.vocabulary_id,characters.id,links.position FROM links JOIN characters ON characters.hanzi=links.hanzi;`,
  `INSERT INTO examples(id,vocabulary_id,character_id,simplified_text,pinyin_json,numbered_pinyin,locale,translation,source_id,status) VALUES\n  ${values(exampleRows)};`,
  `INSERT INTO curriculum_units(id,curriculum_id,slug,title,description,ordinal,status) VALUES\n  ${values(dailyUnitRows)};`,
  `INSERT INTO curriculum_placements(id,unit_id,vocabulary_id,ordinal,learning_objective,source_id) VALUES\n  ${values(dailyPlacementRows)};`,
  `INSERT INTO curriculum_placements(id,unit_id,vocabulary_id,ordinal,learning_objective,source_id) VALUES\n  ${values(hskPlacementRows)};`,
  `UPDATE curricula SET version=${sql(content.dailyLifeCurriculumVersion ?? '1.2.0')},status='published',description='Kosakata keseharian, pinyin, latihan tulis, serta contoh berbahasa Indonesia yang dibuat untuk aplikasi.' WHERE id='curriculum-daily-life';`,
  ...content.hskUnits.map((unit) => `UPDATE curriculum_units SET title=${sql(unit.title)},description=${sql(unit.description ?? 'Materi asli aplikasi; pemetaan belajar ini bukan daftar kosakata resmi HSK.')},status='published' WHERE id=${sql(unit.id)};`),
];

await writeFile(outputPath, `${chunks.join('\n\n')}\n`, 'utf8');
console.log(`Generated ${outputPath} with ${content.words.length} new words, ${content.existingWords?.length ?? 0} reused words, ${requiredCharacters.length} stroke characters, ${content.dailyUnits.length} daily units and ${content.hskUnits.length} HSK placements.`);
