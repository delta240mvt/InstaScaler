import { describe, expect, it, vi } from "vitest";
import { journalEvent, loadJournalEvent, verifyMetaSignature, type EventEnvelope } from "@/lib/events/journal";

const encoder = new TextEncoder();

async function signature(secret: string, body: string) {
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return `sha256=${Array.from(new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(body))), (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

describe("R2 webhook journal", () => {
  it("verifies Meta signatures", async () => {
    const body = '{"object":"instagram"}';
    await expect(verifyMetaSignature(body, await signature("secret", body), "secret")).resolves.toBe(true);
    await expect(verifyMetaSignature(body, "sha256=00", "secret")).resolves.toBe(false);
  });

  it("writes a deterministic, compact event before Queue delivery", async () => {
    const put = vi.fn(async () => undefined);
    const bucket = { put, get: vi.fn() };
    const envelope: EventEnvelope = { version: 1, externalId: "comment-1", instagramAccountId: "account-1", kind: "COMMENT", receivedAt: "2026-08-02T00:00:00.000Z", payload: { commentId: "comment-1" } };
    const result = await journalEvent(bucket, envelope);
    expect(result.key).toMatch(/^events\/2026-08-02\/[a-f0-9]{64}\.json$/);
    expect(put).toHaveBeenCalledOnce();
    expect(await loadJournalEvent({ get: async () => ({ text: async () => JSON.stringify(envelope) }) }, result.key)).toEqual(envelope);
  });
});
