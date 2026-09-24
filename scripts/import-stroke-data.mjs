import { createHash } from "node:crypto";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { createRequire } from "node:module";
import OpenCC from "opencc-js/t2cn";

const require = createRequire(import.meta.url);
const packageRoot = dirname(require.resolve("hanzi-writer-data/package.json"));
const packageInfo = JSON.parse(await readFile(join(packageRoot, "package.json"), "utf8"));
const simplify = OpenCC.Converter({ from: "t", to: "cn" });
const characters = [...new Set(process.argv.slice(2).join("").replace(/[\s,，、]/gu, ""))];

if (characters.length === 0) {
  console.error("Usage: npm run content:import-strokes -- 你好");
  process.exit(2);
}

const outputDirectory = resolve("public/media/strokes");
const manifestPath = resolve("content/stroke-assets-manifest.json");
await mkdir(outputDirectory, { recursive: true });
await mkdir(dirname(manifestPath), { recursive: true });

let manifest = { source: "hanzi-writer-data", version: packageInfo.version, license: packageInfo.license, characters: [] };
try {
  manifest = JSON.parse(await readFile(manifestPath, "utf8"));
} catch {
  // A first import creates the manifest.
}
const byCharacter = new Map(manifest.characters.map((item) => [item.character, item]));

for (const character of characters) {
  if ([...character].length !== 1 || !/\p{Script=Han}/u.test(character)) {
    throw new Error(`Expected one Han character, received: ${character}`);
  }
  if (simplify(character) !== character) {
    throw new Error(`Refusing non-simplified character ${character}; import the simplified form instead.`);
  }
  const sourcePath = join(packageRoot, `${character}.json`);
  const raw = await readFile(sourcePath);
  const parsed = JSON.parse(raw.toString("utf8"));
  if (!Array.isArray(parsed.strokes) || parsed.strokes.length === 0 ||
      !Array.isArray(parsed.medians) || parsed.medians.length !== parsed.strokes.length) {
    throw new Error(`Upstream stroke data is malformed for ${character}`);
  }
  const codePoint = character.codePointAt(0).toString(16).toUpperCase().padStart(4, "0");
  const fileName = `${codePoint}.json`;
  const destination = join(outputDirectory, fileName);
  await copyFile(sourcePath, destination);
  byCharacter.set(character, {
    character,
    codePoint: `U+${codePoint}`,
    key: `media/strokes/${fileName}`,
    strokeCount: parsed.strokes.length,
    sha256: createHash("sha256").update(raw).digest("hex"),
    sourceVersion: packageInfo.version,
    sourceUrl: "https://github.com/chanind/hanzi-writer-data",
    license: "Arphic Public License",
    licenseUrl: "https://github.com/chanind/hanzi-writer-data/blob/master/ARPHICPL.TXT",
    copiedUnmodified: true,
  });
}

manifest = {
  source: "hanzi-writer-data",
  version: packageInfo.version,
  license: "Arphic Public License",
  licenseFile: "licenses/ARPHICPL.TXT",
  characters: [...byCharacter.values()].sort((a, b) => a.codePoint.localeCompare(b.codePoint)),
};
await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
console.log(`Imported ${characters.length} unchanged simplified-character file(s) from hanzi-writer-data ${packageInfo.version}.`);
console.log(`Review ${manifestPath} and add corresponding character/provenance rows in a new D1 migration.`);
