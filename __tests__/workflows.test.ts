import { describe, expect, it } from "vitest";
import { scheduledTasksForCron } from "@/workers/jobs/scheduled";

describe("Jobs schedules", () => {
  it("runs reconciliation and journal recovery hourly at minute seven", () => {
    expect(scheduledTasksForCron("7 * * * *")).toEqual(["reconcile", "recover-journal"]);
  });
  it("runs retention at its UTC schedule", () => {
    expect(scheduledTasksForCron("20 3 * * *")).toEqual(["retention"]);
  });
});
