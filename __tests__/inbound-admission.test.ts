import { describe, expect, it, vi } from "vitest";
import { admitInboundEvent, type AdmissionDb } from "@/lib/jobs/budget";

function fixture(capacity = true) {
  const events = new Map<string, { terminalStatus: string }>();
  let received = 0;
  const db: AdmissionDb = { $transaction: async (work) => work({
    dailyBudget: { upsert: async () => ({}), updateMany: async () => { if (!capacity) return { count: 0 }; received++; return { count: 1 }; } },
    dailyAggregate: { upsert: async () => ({}) },
    processedEvent: { findUnique: async (args) => events.get((args as { where: { externalId: string } }).where.externalId) ?? null, create: async (args) => { const data = (args as { data: { externalId: string; terminalStatus: string } }).data; events.set(data.externalId, data); } },
  }) };
  return { db, events, received: () => received };
}
const input = { externalId: "comment:1", instagramAccountId: "account", kind: "COMMENT" as const, r2Key: "events/comment.json" };

describe("atomic inbound admission", () => {
  it("creates a durable RECEIVED event with its inbound reservation", async () => {
    const f = fixture();
    expect(await admitInboundEvent(f.db, input)).toBe("admitted");
    expect(f.events.get(input.externalId)?.terminalStatus).toBe("RECEIVED");
    expect(f.received()).toBe(1);
  });
  it("does not charge another inbound reservation for a webhook replay", async () => {
    const f = fixture();
    await admitInboundEvent(f.db, input);
    expect(await admitInboundEvent(f.db, input)).toBe("duplicate");
    expect(f.received()).toBe(1);
  });
  it("does not mark over-budget events as admitted", async () => {
    const f = fixture(false);
    expect(await admitInboundEvent(f.db, input)).toBe("exhausted");
    expect(f.events.size).toBe(0);
  });
  it("treats a concurrent unique admission as a duplicate after rollback", async () => {
    const db = { $transaction: vi.fn(async () => { throw { code: "P2002" }; }) };
    expect(await admitInboundEvent(db, input)).toBe("duplicate");
  });
});
