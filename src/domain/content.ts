export type ReviewState = "draft" | "needs_review" | "approved" | "rejected" | "retired";

export type AudioState = "approved" | "candidate" | "unavailable";

export interface ContentProvenance {
  sourceId: string;
  sourceName: string;
  sourceVersion: string;
  sourceUrl?: string;
  license: string;
  attribution: string;
  checksum?: string;
  editorialNotes?: string;
  reviewState: ReviewState;
}

export interface PinyinSyllable {
  base: string;
  tone: 1 | 2 | 3 | 4 | 5;
  /** Surface tone after context-sensitive tone sandhi, when applicable. */
  surfaceTone?: 1 | 2 | 3 | 4 | 5;
  display: string;
  numbered: string;
}

export interface AudioAssetSummary {
  state: AudioState;
  assetId?: string;
  durationMs?: number;
  provenance?: ContentProvenance;
}

export interface CharacterContent {
  id: string;
  hanzi: string;
  unicodeCodePoint: string;
  strokeCount: number;
  radical?: string;
  glossId: string;
  readings: Array<{
    id: string;
    contextWordId: string;
    pinyin: PinyinSyllable[];
    audio: AudioAssetSummary;
  }>;
  strokeData?: {
    sourceId: string;
    sourceVersion: string;
    license: string;
    checksum: string;
    reviewState: ReviewState;
  };
  provenance: ContentProvenance;
}

export interface ExampleSentence {
  simplifiedText: string;
  pinyin: PinyinSyllable[];
  indonesian: string;
  provenance: ContentProvenance;
}

export interface VocabularyContent {
  id: string;
  simplifiedForm: string;
  characterIds: string[];
  readings: Array<{
    id: string;
    contextText: string;
    pinyin: PinyinSyllable[];
    audio: AudioAssetSummary;
  }>;
  senses: Array<{
    id: string;
    locale: "id";
    text: string;
    usageLabel?: string;
    provenance: ContentProvenance;
  }>;
  examples: ExampleSentence[];
  curriculumPlacements: Array<{
    curriculumId: string;
    curriculumVersion: string;
    unitId: string;
    label: string;
  }>;
  provenance: ContentProvenance;
}

export interface LearningAttemptInput {
  idempotencyKey: string;
  contentType: "vocabulary" | "character";
  contentId: string;
  readingId?: string;
  curriculumPlacementId?: string;
  activityMode: "listen" | "meaning" | "guided_writing" | "freehand_writing";
  dimensions: {
    characterIdentity?: "recognized" | "uncertain" | "not_recognized";
    strokeOrder?: "correct" | "needs_practice" | "uncertain";
    strokeDirection?: "correct" | "needs_practice" | "uncertain";
    shape?: "close_enough" | "needs_practice" | "uncertain";
  };
  engineVersion?: string;
  createdAtClient: string;
}

export interface SyncAcknowledgement {
  accepted: Array<{ idempotencyKey: string; acceptedAt: string; duplicate: boolean }>;
  rejected: Array<{ idempotencyKey: string; code: string; message: string }>;
  serverTime: string;
}
