import { describe, expect, it, vi } from "vitest";
import { scheduledTasksForCron, startScheduledWorkflows } from "@/workers/jobs/scheduled";
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
    await expect(startScheduledWorkflows("7 * * * *", {} as JobsEnv)).resolves.toEqual({ started: 0, skipped: true });
  });
  it("starts hourly Workflows from the free Worker cron trigger", async () => {
    const reconcile = { create: vi.fn(async () => ({})) };
    const recover = { create: vi.fn(async () => ({})) };
    const env = { DATABASE_URL: "postgresql://configured", RECONCILE_WORKFLOW: reconcile, RECOVER_JOURNAL_WORKFLOW: recover } as unknown as JobsEnv;
    await expect(startScheduledWorkflows("7 * * * *", env)).resolves.toEqual({ started: 2, skipped: false });
    expect(reconcile.create).toHaveBeenCalledWith({ id: expect.stringMatching(/^workflow-reconcile-/) });
    expect(recover.create).toHaveBeenCalledWith({ id: expect.stringMatching(/^workflow-recover-journal-/) });
  });
});
