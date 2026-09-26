const appBase = (process.env.MANDARIN_APP_BASE ?? "https://mandarinlearnapp.wangzi102410.workers.dev").replace(/\/$/, "");
const tatoebaBase = "https://api.tatoeba.org/v1";
const requestDelayMs = 1_500;
const checkpointPath = `${process.env.TEMP ?? process.env.TMP ?? "."}/mandarin-sentence-audio-scan-checkpoint.json`;

async function getJson(url) {
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const response = await fetch(url, { headers: { accept: "application/json", "user-agent": "MandarinLearnApp-research/1.0" }, signal: AbortSignal.timeout(30_000) });
    if (response.ok) return response.json();
    if (response.status !== 429 && response.status < 500) throw new Error(`${response.status} ${url}`);
    const retryAfter = Number(response.headers.get("retry-after"));
    const waitMs = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1_000 : Math.min(60_000, 1_500 * (2 ** attempt));
    await new Promise((resolve) => setTimeout(resolve, waitMs));
  }
  throw new Error(`Rate limit/retry budget exhausted: ${url}`);
}

function spokenTextKey(value) {
  return value.normalize("NFC").replace(/[。．.!！?？、，,；;：:]+$/u, "").replace(/\s+/gu, "");
}

const paths = (await getJson(`${appBase}/api/v1/paths`)).paths;
const content = new Map();
for (const path of paths) {
  const { units } = await getJson(`${appBase}/api/v1/paths/${encodeURIComponent(path.id)}/units`);
  for (const unit of units) {
    const lesson = await getJson(`${appBase}/api/v1/units/${encodeURIComponent(unit.id)}`);
    for (const item of lesson.items ?? []) {
      if (item.example_text) content.set(spokenTextKey(item.example_text), { text: item.example_text, kind: "example", unit: unit.id });
    }
    for (const turn of lesson.dialogueTurns ?? []) content.set(spokenTextKey(turn.simplifiedText), { text: turn.simplifiedText, kind: "dialogue_turn", unit: unit.id });
    for (const paragraph of lesson.storyParagraphs ?? []) content.set(spokenTextKey(paragraph.simplifiedText), { text: paragraph.simplifiedText, kind: "story_paragraph", unit: unit.id });
  }
}

const targets = [...content.values()];
let checkpoint = [];
try { checkpoint = JSON.parse(await (await import("node:fs/promises")).readFile(checkpointPath, "utf8")); } catch { /* No previous scan checkpoint. */ }
const byText = new Map(checkpoint.map((row) => [spokenTextKey(row.text), row]));
for (const [index, target] of targets.entries()) {
  if (byText.has(spokenTextKey(target.text))) continue;
  const params = new URLSearchParams({ q: target.text, lang: "cmn", has_audio: "yes", sort: "relevance", limit: "100", include: "audios" });
  try {
    const response = await getJson(`${tatoebaBase}/sentences?${params}`);
    const exact = (response.data ?? []).filter((sentence) => spokenTextKey(sentence.text) === spokenTextKey(target.text));
    byText.set(spokenTextKey(target.text), { ...target, matches: exact.map((sentence) => ({
      sentenceId: sentence.id,
      text: sentence.text,
      script: sentence.script,
      sentenceLicense: sentence.license,
      audios: (sentence.audios ?? []).map((audio) => ({
        audioId: audio.id,
        author: audio.author,
        license: audio.license,
        attributionUrl: audio.attribution_url,
        downloadUrl: audio.download_url,
      })),
    })) });
  } catch (error) {
    byText.set(spokenTextKey(target.text), { ...target, error: error instanceof Error ? error.message : String(error) });
  }
  checkpoint = [...byText.values()];
  await (await import("node:fs/promises")).writeFile(checkpointPath, JSON.stringify(checkpoint), "utf8");
  if ((index + 1) % 10 === 0) console.error(`Scanned ${index + 1}/${targets.length} exact sentence queries.`);
  await new Promise((resolve) => setTimeout(resolve, requestDelayMs));
}
const results = targets.map((target) => byText.get(spokenTextKey(target.text)) ?? { ...target, error: "Not queried." });

const exactMatches = results.flatMap((target) => (target.matches ?? []).flatMap((match) => match.audios.map((audio) => ({
  targetText: target.text,
  targetKind: target.kind,
  unit: target.unit,
  ...match,
  ...audio,
}))));
const hasFileSpecificLicense = exactMatches.filter((match) => Boolean(match.license?.trim()));
const reusableByOpenLicense = hasFileSpecificLicense.filter((match) => /^(CC0|CC BY(?: |$)|CC BY-SA(?: |$))/i.test(match.license.trim()));
const report = {
  scannedAt: new Date().toISOString(),
  appBase,
  targetCount: targets.length,
  completedQueries: results.filter((target) => target.matches !== undefined).length,
  coverageComplete: results.every((target) => target.matches !== undefined),
  exactTextMatches: results.filter((target) => target.matches?.length).length,
  exactAudioCount: exactMatches.length,
  withFileSpecificLicense: hasFileSpecificLicense.length,
  candidateCountUnderCC0ByBySA: reusableByOpenLicense.length,
  failures: results.filter((target) => target.error),
  candidates: reusableByOpenLicense,
  exactMatchesWithoutFileSpecificLicense: exactMatches.filter((match) => !match.license?.trim()),
};
console.log(JSON.stringify(report, null, 2));
