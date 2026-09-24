import { openDB, type IDBPDatabase } from "idb";

export interface AttemptPayload {
  contentType: "vocabulary" | "character";
  contentId: string;
  readingId?: string;
  curriculumPlacementId?: string;
  activityMode: "listen" | "meaning" | "guided_writing" | "freehand_writing";
  dimensions: Record<string, string>;
  engineVersion?: string;
  createdAtClient: string;
}

type OutboxRecord =
  | { kind: "attempt"; ownerUserId: string; idempotencyKey: string; payload: AttemptPayload }
  | { kind: "recognition"; ownerUserId: string; idempotencyKey: string; payload: { hanzi: string; candidateRank: number } };

interface OutboxDB {
  attempts: { key: string; value: OutboxRecord };
}

let dbPromise: Promise<IDBPDatabase<OutboxDB>> | undefined;
function openOutbox() {
  dbPromise ??= openDB<OutboxDB>("mandarinlearnapp-outbox", 1, {
    upgrade(db) { db.createObjectStore("attempts", { keyPath: "idempotencyKey" }); },
  });
  return dbPromise;
}

export async function enqueueAttempt(attempt: Omit<AttemptPayload, "createdAtClient"> & { createdAtClient: string }, ownerUserId: string) {
  const record: OutboxRecord = { kind: "attempt", ownerUserId, idempotencyKey: crypto.randomUUID(), payload: attempt };
  await (await openOutbox()).put("attempts", record);
  return record;
}

export async function enqueueRecognition(payload: { hanzi: string; candidateRank: number }, ownerUserId: string) {
  const record: OutboxRecord = { kind: "recognition", ownerUserId, idempotencyKey: crypto.randomUUID(), payload };
  await (await openOutbox()).put("attempts", record);
  return record;
}

export async function pendingAttempts(ownerUserId?: string) {
  const records = await (await openOutbox()).getAll("attempts");
  return ownerUserId ? records.filter((record) => record.ownerUserId === ownerUserId) : records;
}

export async function acknowledgeAttempts(keys: string[]) {
  const db = await openOutbox();
  const transaction = db.transaction("attempts", "readwrite");
  await Promise.all(keys.map((key) => transaction.store.delete(key)));
  await transaction.done;
}

export async function syncOutbox(ownerUserId: string) {
  if (!navigator.onLine) return { state: "offline" as const, pending: (await pendingAttempts(ownerUserId)).length };
  const entries = await pendingAttempts(ownerUserId);
  if (!entries.length) return { state: "synced" as const, pending: 0 };
  for (let start = 0; start < entries.length; start += 50) {
    const batch = entries.slice(start, start + 50);
    const attempts = batch.filter((record): record is Extract<OutboxRecord, { kind: "attempt" }> => record.kind === "attempt");
    if (attempts.length) {
      const response = await fetch("/api/v1/attempts", {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attempts: attempts.map((record) => ({ ...record.payload, idempotencyKey: record.idempotencyKey, createdAtClient: new Date().toISOString() })) }),
      });
      if (response.status === 401) return { state: "sign-in-required" as const, pending: entries.length };
      if (!response.ok) return { state: "sync-error" as const, pending: entries.length };
      const body = await response.json() as { accepted?: Array<{ idempotencyKey: string }>; rejected?: Array<{ idempotencyKey: string; message: string }> };
      await acknowledgeAttempts(body.accepted?.map((item) => item.idempotencyKey) ?? []);
      // Invalid events stay queued so the learner cannot silently lose progress.
      if (body.rejected?.length) return { state: "sync-error" as const, pending: (await pendingAttempts(ownerUserId)).length };
    }
    const recognitions = batch.filter((record): record is Extract<OutboxRecord, { kind: "recognition" }> => record.kind === "recognition");
    for (const record of recognitions) {
      const response = await fetch("/api/v1/recognitions/confirm", {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...record.payload, idempotencyKey: record.idempotencyKey }),
      });
      if (response.status === 401) return { state: "sign-in-required" as const, pending: entries.length };
      if (!response.ok) return { state: "sync-error" as const, pending: entries.length };
      await acknowledgeAttempts([record.idempotencyKey]);
    }
  }
  const pending = (await pendingAttempts(ownerUserId)).length;
  return { state: pending ? "pending" as const : "synced" as const, pending };
}
