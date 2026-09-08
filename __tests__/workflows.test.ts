import { describe, expect, it, vi } from "vitest";
import { nextHourlyAlarm, scheduledTasksForCron, scheduledTasksForTime, startScheduledWorkflows } from "@/workers/jobs/scheduled";
import { withJobRun, workflowExternalId, workflowJobKind } from "@/workers/jobs/workflows/services";
import type { JobsEnv } from "@/lib/cloudflare/env";
import { assignNextMedia } from "@/lib/workflows/next-media";

describe("Jobs schedules", () => {
  it("runs reconciliation, journal recovery and next-media attachment hourly at minute seven", () => {
    expect(scheduledTasksForCron("7 * * * *")).toEqual(["reconcile", "recover-journal", "attach-next-reel"]);
  });
  it("runs retention at its UTC schedule", () => {
    expect(scheduledTasksForCron("20 3 * * *")).toEqual(["retention"]);
  });
  it("uses one idempotency key per hourly or daily workflow window", () => {
    const date = new Date("2026-08-02T11:59:00.000Z");
    expect(workflowExternalId("reconcile", date)).toBe("workflow:reconcile:2026-08-02T11");
    expect(workflowExternalId("attach-next-reel", date)).toBe("workflow:attach-next-reel:2026-08-02T11");
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
  it("starts the hourly Workflows through their bindings", async () => {
    const reconcile = { create: vi.fn(async () => ({})) };
    const recover = { create: vi.fn(async () => ({})) };
    const attach = { create: vi.fn(async () => ({})) };
    const env = { DATABASE_URL: "postgresql://configured", RECONCILE_WORKFLOW: reconcile, RECOVER_JOURNAL_WORKFLOW: recover, ATTACH_NEXT_REEL_WORKFLOW: attach } as unknown as JobsEnv;
    await expect(startScheduledWorkflows("7 * * * *", env)).resolves.toEqual({ started: 3, skipped: false });
    expect(reconcile.create).toHaveBeenCalledWith({ id: expect.stringMatching(/^workflow-reconcile-/) });
    expect(recover.create).toHaveBeenCalledWith({ id: expect.stringMatching(/^workflow-recover-journal-/) });
    expect(attach.create).toHaveBeenCalledWith({ id: expect.stringMatching(/^workflow-attach-next-reel-/) });
  });
  it("reports only successfully created workflows", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    try {
      const env = { DATABASE_URL: "postgresql://configured", RECONCILE_WORKFLOW: { create: async () => { throw new Error("unavailable"); } }, RECOVER_JOURNAL_WORKFLOW: { create: async () => ({}) }, ATTACH_NEXT_REEL_WORKFLOW: { create: async () => ({}) } } as unknown as JobsEnv;
      expect(await startScheduledWorkflows("7 * * * *", env)).toEqual({ started: 2, skipped: false });
    } finally { warn.mockRestore(); }
  });
  it("does not log upstream secrets when workflow creation fails", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    try {
      const env = { DATABASE_URL: "postgresql://configured", RETENTION_WORKFLOW: { create: async () => { throw new Error("request failed access_token=synthetic-private-value"); } } } as unknown as JobsEnv;
      expect(await startScheduledWorkflows("20 3 * * *", env)).toEqual({ started: 0, skipped: false });
      expect(warn).toHaveBeenCalledExactlyOnceWith("Scheduled Workflow was not created", { task: "retention", code: "workflow_create_failed" });
    } finally { warn.mockRestore(); }
  });
  it("maps one hourly Durable Object alarm to hourly and daily work", () => {
    expect(scheduledTasksForTime(new Date("2026-08-02T05:07:00Z"))).toEqual(["reconcile", "recover-journal", "attach-next-reel", "refresh-tokens"]);
    expect(nextHourlyAlarm(new Date("2026-08-02T05:08:00Z").getTime())).toBe(new Date("2026-08-02T06:07:00Z").getTime());
  });

  it("attaches each waiting campaign to the first eligible new post or Reel", () => {
    const assignments = assignNextMedia(
      [
        { id: "campaign-a", createdAt: new Date("2026-08-02T10:00:00Z") },
        { id: "campaign-b", createdAt: new Date("2026-08-02T10:30:00Z") },
      ],
      [
        { id: "old", media_type: "IMAGE", timestamp: "2026-08-02T09:59:00Z" },
        { id: "post", media_type: "IMAGE", timestamp: "2026-08-02T10:15:00Z" },
        { id: "reel", media_type: "VIDEO", media_product_type: "REELS", timestamp: "2026-08-02T10:45:00Z" },
      ]
    );

    expect(assignments.map(({ automation, media }) => [automation.id, media.id])).toEqual([
      ["campaign-a", "post"],
      ["campaign-b", "reel"],
    ]);
  });
  it("arms an edited campaign from its last save instead of its original creation", () => {
    const assignments = assignNextMedia([{ id: "existing", createdAt: new Date("2026-08-01T00:00:00Z"), updatedAt: new Date("2026-09-08T10:00:00Z") }], [
      { id: "already-published", media_type: "IMAGE", timestamp: "2026-09-08T09:00:00Z" },
      { id: "next", media_type: "VIDEO", timestamp: "2026-09-08T11:00:00Z" },
    ]);
    expect(assignments.map(item => item.media.id)).toEqual(["next"]);
  });
});
