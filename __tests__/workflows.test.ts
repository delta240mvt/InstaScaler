import { describe, expect, it } from "vitest";
import { scheduledTasksForCron } from "@/workers/jobs/scheduled";
import { workflowExternalId } from "@/workers/jobs/workflows/services";

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
});
