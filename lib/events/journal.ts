import { parseInstagramJob, type InstagramJob } from "@/lib/jobs/contracts";

const encoder = new TextEncoder();

export type EventEnvelope = {
  version: 1;
  externalId: string;
  instagramAccountId: string;
  kind: "COMMENT" | "POSTBACK" | "MESSAGE";
  receivedAt: string;
  payload: Record<string, string | number | boolean | null>;
};

export type JournalBucket = {
  put(key: string, value: string, options?: { httpMetadata?: { contentType: string } }): Promise<unknown>;
  get(key: string): Promise<{ text(): Promise<string> } | null>;
  delete?(key: string): Promise<void>;
  list?(options?: { prefix?: string; cursor?: string; limit?: number }): Promise<{ objects: Array<{ key: string }>; truncated: boolean; cursor?: string }>;
};

function hex(bytes: Uint8Array) { return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(""); }
function equal(left: Uint8Array, right: Uint8Array) { if (left.length !== right.length) return false; let diff = 0; for (let i = 0; i < left.length; i += 1) diff |= left[i] ^ right[i]; return diff === 0; }

export async function verifyMetaSignature(body: string, header: string | undefined, secret: string): Promise<boolean> {
  if (!header || header.length !== 71 || !/^sha256=[a-fA-F0-9]{64}$/.test(header)) return false;
  const actual = new Uint8Array((header.slice(7).match(/.{1,2}/g) ?? []).map((part) => Number.parseInt(part, 16)));
  if (actual.length !== 32 || actual.some(Number.isNaN)) return false;
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return equal(new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(body))), actual);
}

export async function journalEvent(bucket: JournalBucket, envelope: EventEnvelope): Promise<{ key: string; externalId: string }> {
  const serialized = JSON.stringify(envelope);
  if (encoder.encode(serialized).byteLength >= 64 * 1024) throw new Error("EVENT_TOO_LARGE");
  const digest = hex(new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(envelope.externalId))));
  const key = `events/${envelope.receivedAt.slice(0, 10)}/${digest}.json`;
  await bucket.put(key, serialized, { httpMetadata: { contentType: "application/json" } });
  return { key, externalId: envelope.externalId };
}

export async function loadJournalEvent(bucket: Pick<JournalBucket, "get">, key: string): Promise<EventEnvelope> {
  const object = await bucket.get(key);
  if (!object) throw new Error("JOURNAL_EVENT_NOT_FOUND");
  return JSON.parse(await object.text()) as EventEnvelope;
}

export async function deleteJournalEvent(bucket: Required<Pick<JournalBucket, "delete">>, key: string): Promise<void> { await bucket.delete(key); }

export async function journalFollowUpJob(bucket: JournalBucket, job: Extract<InstagramJob, { kind: "FOLLOW_UP" }>): Promise<Extract<InstagramJob, { kind: "FOLLOW_UP" }> & { r2Key: string }> {
  const digest = hex(new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(job.externalId))));
  const r2Key = `follow-ups/${digest}.json`;
  const existing = await bucket.get(r2Key);
  if (existing) {
    const saved = parseInstagramJob(JSON.parse(await existing.text()));
    if (saved.kind !== "FOLLOW_UP" || saved.externalId !== job.externalId || saved.instagramAccountId !== job.instagramAccountId) throw new Error("JOURNAL_JOB_MISMATCH");
    return { ...saved, r2Key };
  }
  const saved = { ...job, r2Key };
  await bucket.put(r2Key, JSON.stringify(saved), { httpMetadata: { contentType: "application/json" } });
  return saved;
}
