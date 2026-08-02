import { describe, expect, it } from "vitest";
import { scheduledTasksForCron } from "@/workers/jobs/scheduled";
import { withJobRun, workflowExternalId, workflowJobKind } from "@/workers/jobs/workflows/services";
import type { JobsEnv } from "@/lib/cloudflare/env";

describe("Jobs schedules", () => {
  it("runs reconciliation and journal recovery hourly at minute seven", () => {
    expect(scheduledTasksForCron("7 * * * *")).toEqual(["reconcile", "recover-journal"]);
  });
  it("runs retention at its UTC schedule", () => {
    expect(scheduledTasksForCron("20 3 * * *")).toEqual(["retention"]);
  });
  it("uses one idempotency key per hourly or daily workflow window", () => {
    const date = new Date("2026-08-02T11:59:00.000Z");
    expect(workflowExternalId("reconcile", date)).toBe("workflow:reconcile:2026-08-02T11");
    expect(workflowExternalId("retention", date)).toBe("workflow:retention:2026-08-02");
  });
  it("records each workflow under its real diagnostic kind", () => {
    expect(workflowJobKind("reconcile")).toBe("RECONCILE");
    expect(workflowJobKind("recover-journal")).toBe("RECOVER_R2");
    expect(workflowJobKind("snapshot-followers")).toBe("SNAPSHOT_FOLLOWERS");
  });
  it("safely skips schedules until Neon is configured", async () => {
    await expect(withJobRun("reconcile", {} as JobsEnv, async () => { throw new Error("must not execute"); })).resolves.toEqual({ skipped: true, reason: "database_not_configured" });
  });
});
