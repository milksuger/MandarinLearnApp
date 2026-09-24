import type { CharacterContent, ContentProvenance, PinyinSyllable, VocabularyContent } from "./content";

const editorialDraft: ContentProvenance = {
  sourceId: "belajar-mandarin-editorial-seed",
  sourceName: "Belajar Mandarin editorial sample",
  sourceVersion: "0.1.0",
  license: "CC BY-SA 4.0 (project-authored sample; pending editorial review)",
  attribution: "Belajar Mandarin editorial team",
  editorialNotes: "Prototype seed only. Verify Indonesian usage, pronunciation context, and curriculum placement before release.",
  reviewState: "draft",
};

const syllables = (...values: Array<[string, 1 | 2 | 3 | 4 | 5, string, (1 | 2 | 3 | 4 | 5)?]>): PinyinSyllable[] =>
  values.map(([base, tone, display, surfaceTone]) => ({
    base,
    tone,
    ...(surfaceTone && surfaceTone !== tone ? { surfaceTone } : {}),
    display,
    numbered: `${base}${tone}`,
  }));

export const demoCharacters: CharacterContent[] = [
  {
    id: "char-shan",
    hanzi: "山",
    unicodeCodePoint: "U+5C71",
    strokeCount: 3,
    radical: "山",
    glossId: "gloss-char-shan-id-1",
    readings: [{ id: "reading-shan-in-gaoshan", contextWordId: "word-gaoshan", pinyin: syllables(["shan", 1, "shān"]), audio: { state: "unavailable" } }],
    provenance: editorialDraft,
  },
  {
    id: "char-gao",
    hanzi: "高",
    unicodeCodePoint: "U+9AD8",
    strokeCount: 10,
    radical: "高",
    glossId: "gloss-char-gao-id-1",
    readings: [{ id: "reading-gao-in-gaoshan", contextWordId: "word-gaoshan", pinyin: syllables(["gao", 1, "gāo"]), audio: { state: "unavailable" } }],
    provenance: editorialDraft,
  },
];

export const demoVocabulary: VocabularyContent[] = [
  {
    id: "word-gaoshan",
    simplifiedForm: "高山",
    characterIds: ["char-gao", "char-shan"],
    readings: [{
      id: "reading-word-gaoshan",
      contextText: "高山",
      pinyin: syllables(["gao", 1, "gāo"], ["shan", 1, "shān"]),
      audio: { state: "unavailable" },
    }],
    senses: [{ id: "sense-gaoshan-id-1", locale: "id", text: "gunung tinggi", usageLabel: "Kata benda", provenance: editorialDraft }],
    examples: [{
      simplifiedText: "那是一座高山。",
      pinyin: syllables(["na", 4, "nà"], ["shi", 4, "shì"], ["yi", 1, "yí", 2], ["zuo", 4, "zuò"], ["gao", 1, "gāo"], ["shan", 1, "shān"]),
      indonesian: "Itu sebuah gunung yang tinggi.",
      provenance: editorialDraft,
    }],
    curriculumPlacements: [{
      curriculumId: "daily-life",
      curriculumVersion: "2026.1",
      unitId: "nature-landscape",
      label: "Alam & Lanskap",
    }],
    provenance: editorialDraft,
  },
];

export function formatPinyin(syllables: PinyinSyllable[]): string {
  return syllables.map((syllable) => syllable.display).join(" ");
}
