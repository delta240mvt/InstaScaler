import { afterEach, describe, expect, it, vi } from "vitest";
import { executeWorkflowTask, withJobRun } from "@/workers/jobs/workflows/services";
import type { JobsEnv } from "@/lib/cloudflare/env";

const { getDb } = vi.hoisted(() => ({ getDb: vi.fn() }));
vi.mock("@/lib/db/neon", () => ({ createPrisma: getDb }));
vi.mock("@/lib/core/meta-oauth", () => ({ decryptToken: async () => "test-token" }));
afterEach(() => vi.unstubAllGlobals());

describe("durable workflow bookkeeping", () => {
  it.each(["PROCESSING", "FAILED"])("re-enters %s account work and propagates a transient failure for step retry", async (status) => {
    getDb.mockReturnValue({
      instagramAccount: { findMany: async () => [{ id: "account", accessToken: "encrypted" }] },
      jobRun: { findUnique: async () => ({ id: "run", status }), update: async () => ({ id: "run" }) },
      operationalEvent: { create: async () => ({}) },
      $transaction: async (work: (tx: unknown) => Promise<unknown>) => work({ dailyBudget: { upsert: async () => ({}), updateMany: async () => ({ count: 1 }) }, dailyAggregate: { upsert: async () => ({}) } }),
    });
    vi.stubGlobal("fetch", async () => { throw new Error("temporary network outage"); });
    await expect(executeWorkflowTask("snapshot-followers", {} as JobsEnv)).rejects.toThrow("temporary network outage");
  });
  it("resumes the durable step after an interrupted processing run", async () => {
    let status = "PROCESSING";
    getDb.mockReturnValue({ jobRun: { findUnique: async () => ({ id: "run", status }), update: async ({ data }: { data: { status: string } }) => { status = data.status; return { id: "run" }; } } });
    const result = await withJobRun("reconcile", { DATABASE_URL: "configured" } as JobsEnv, async () => ({ published: 2 }));
    expect(result).toEqual({ published: 2 });
    expect(status).toBe("COMPLETED");
  });

  it("stores a safe code for an upstream workflow failure", async () => {
    let diagnostic: string | undefined;
    getDb.mockReturnValue({ jobRun: { findUnique: async () => null, create: async () => ({ id: "run" }), update: async ({ data }: { data: { errorMessage?: string } }) => { diagnostic = data.errorMessage; } } });
    await expect(withJobRun("reconcile", { DATABASE_URL: "configured" } as JobsEnv, async () => { throw new Error("failed access_token=private-value"); })).rejects.toThrow();
    expect(diagnostic).toBe("TRANSIENT_FAILURE");
  });
});
