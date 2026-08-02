import { describe, expect, it, vi } from "vitest";
import { processInstagramJob } from "@/lib/delivery";

describe("Queue consumer", () => {
  it("does not deliver a duplicate external event twice", async () => {
    const delivery = vi.fn(async () => ({ status: "sent" as const, code: "SENT" }));
    const db = { processedEvent: { findUnique: async () => ({ id: "existing" }), create: vi.fn(), update: vi.fn() } };
    const result = await processInstagramJob({ db, load: async () => ({ commentId: "comment" }), deliver: delivery }, { version: 1, kind: "COMMENT", externalId: "event", instagramAccountId: "account", r2Key: "events/x.json" });
    expect(result).toEqual({ status: "skipped", code: "DUPLICATE_EVENT" });
    expect(delivery).not.toHaveBeenCalled();
  });
});
