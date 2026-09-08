import { expect, it, vi } from "vitest";
import { executeWorkflowTask } from "@/workers/jobs/workflows/services";
import type { JobsEnv } from "@/lib/cloudflare/env";

const { getDb } = vi.hoisted(() => ({ getDb: vi.fn() }));
vi.mock("@/lib/db/neon", () => ({ createPrisma: getDb }));

it("deletes only the expired event rows whose journals were selected for cleanup", async () => {
  const remaining = new Set(["selected", "next-page"]);
  const journals = new Set(["events/selected.json", "events/next-page.json"]);
  getDb.mockReturnValue({
    instagramAccount: { findMany: async () => [] },
    processedEvent: {
      findMany: async () => [{ id: "selected", r2Key: "events/selected.json" }],
      deleteMany: async ({ where }: { where: { id?: { in: string[] } } }) => { const ids = where.id?.in ?? [...remaining]; for (const id of ids) remaining.delete(id); return { count: ids.length }; },
    },
    dmLog: { deleteMany: async () => ({ count: 0 }) }, operationalEvent: { deleteMany: async () => ({ count: 0 }) },
    $transaction: async (work: Promise<unknown>[]) => Promise.all(work),
  });
  await executeWorkflowTask("retention", { EVENT_JOURNAL: { delete: async (key: string) => { journals.delete(key); } } } as unknown as JobsEnv);
  expect([...remaining]).toEqual(["next-page"]);
  expect([...journals]).toEqual(["events/next-page.json"]);
});
