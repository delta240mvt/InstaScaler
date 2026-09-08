import { beforeEach, describe, expect, it, vi } from "vitest";
import { executeWorkflowTask } from "@/workers/jobs/workflows/services";
import type { JobsEnv } from "@/lib/cloudflare/env";

const { getDb } = vi.hoisted(() => ({ getDb: vi.fn() }));
vi.mock("@/lib/db/neon", () => ({ createPrisma: getDb }));

beforeEach(() => getDb.mockReturnValue({ processedEvent: { findUnique: async () => ({ terminalStatus: "COMPLETED" }) }, instagramAccount: { findUnique: async () => null } }));

describe("journal recovery", () => {
  it.each([true, false])("reserves inbound admission before recovering a previously unadmitted event (capacity: %s)", async (capacity) => {
    let admissions = 0;
    let eventStatus: string | undefined;
    getDb.mockReturnValue({ processedEvent: { findUnique: async () => null }, instagramAccount: { findUnique: async () => ({ id: "account" }) }, $transaction: async (work: (tx: unknown) => Promise<unknown>) => work({
      processedEvent: { findUnique: async () => null, create: async ({ data }: { data: { terminalStatus: string } }) => { eventStatus = data.terminalStatus; } },
      dailyBudget: { upsert: async () => ({}), updateMany: async ({ where }: { where: { received?: unknown } }) => { if (where.received) { admissions++; return { count: capacity ? 1 : 0 }; } return { count: 1 }; } }, dailyAggregate: { upsert: async () => ({}) },
    }) });
    const send = vi.fn();
    const env = { EVENT_JOURNAL: { list: async ({ prefix }: { prefix: string }) => ({ objects: prefix === "events/" ? [{ key: "events/unadmitted.json" }] : [], truncated: false }), get: async (key: string) => key.startsWith("events/") ? { text: async () => JSON.stringify({ externalId: "comment:1", instagramAccountId: "ig", kind: "COMMENT" }) } : null, put: async () => undefined }, INSTAGRAM_EVENTS: { send } } as unknown as JobsEnv;
    await executeWorkflowTask("recover-journal", env);
    expect(admissions).toBe(1);
    expect(send).toHaveBeenCalledTimes(capacity ? 1 : 0);
    expect(eventStatus).toBe(capacity ? "RECEIVED" : undefined);
  });
  it("removes retained terminal journals without publishing another delivery", async () => {
    const retained = new Set(["events/old.json"]);
    const send = vi.fn();
    const env = { EVENT_JOURNAL: {
      list: async ({ prefix }: { prefix: string }) => ({ objects: [...retained].filter(key => key.startsWith(prefix)).map(key => ({ key })), truncated: false }),
      get: async (key: string) => key.startsWith("control/") ? null : ({ text: async () => JSON.stringify({ externalId: "completed", instagramAccountId: "ig", kind: "COMMENT" }) }),
      put: async () => undefined,
      delete: async (key: string) => { retained.delete(key); },
    }, INSTAGRAM_EVENTS: { send } } as unknown as JobsEnv;
    expect(await executeWorkflowTask("recover-journal", env)).toEqual({ recovered: 0 });
    expect(retained.size).toBe(0);
    expect(send).not.toHaveBeenCalled();
  });

  it("continues recovery if a listed journal was just removed by a consumer", async () => {
    const env = { EVENT_JOURNAL: { list: async () => ({ objects: [{ key: "events/missing.json" }], truncated: false }), get: async () => null, put: async () => undefined } } as unknown as JobsEnv;
    await expect(executeWorkflowTask("recover-journal", env)).resolves.toEqual({ recovered: 0 });
  });

  it("bounds journal scans even when no event is eligible for replay", async () => {
    let page = 0;
    let savedCursor: string | null = null;
    const env = { EVENT_JOURNAL: {
      list: async ({ prefix }: { prefix: string }) => prefix === "events/" ? ({ objects: Array.from({ length: 100 }, (_, i) => ({ key: `events/${page}-${i}` })), truncated: ++page < 10, cursor: String(page) }) : ({ objects: [], truncated: false }),
      get: async (key: string) => key.startsWith("control/") ? null : ({ text: async () => JSON.stringify({ externalId: "completed", instagramAccountId: "ig", kind: "COMMENT" }) }),
      put: async (key: string, value: string) => { if (!key.includes("follow-up")) savedCursor = JSON.parse(value); },
    } } as unknown as JobsEnv;
    await executeWorkflowTask("recover-journal", env);
    expect(page).toBe(5);
    expect(savedCursor).toBe("5");
  });

  it("recovers a due follow-up after the Queue retry budget deferred it", async () => {
    const job = { version: 1, kind: "FOLLOW_UP", externalId: "followup:campaign:comment", instagramAccountId: "ig", automationId: "campaign", userId: "user", dueAt: "2026-01-01T00:00:00Z", r2Key: "follow-ups/job.json" };
    getDb.mockReturnValue({ processedEvent: { findUnique: async () => ({ terminalStatus: "RETRYING" }) }, instagramAccount: { findUnique: async () => ({ id: "account" }) }, $transaction: async (work: (tx: unknown) => Promise<unknown>) => work({ dailyBudget: { upsert: async () => ({}), updateMany: async () => ({ count: 1 }) }, dailyAggregate: { upsert: async () => ({}) } }) });
    const send = vi.fn();
    const env = { EVENT_JOURNAL: {
      list: async ({ prefix }: { prefix: string }) => ({ objects: prefix === "follow-ups/" ? [{ key: job.r2Key }] : [], truncated: false }),
      get: async (key: string) => key === job.r2Key ? { text: async () => JSON.stringify(job) } : null,
      put: async () => undefined,
    }, INSTAGRAM_EVENTS: { send } } as unknown as JobsEnv;
    expect(await executeWorkflowTask("recover-journal", env)).toEqual({ recovered: 1 });
    expect(send).toHaveBeenCalledWith(job);
  });
});
