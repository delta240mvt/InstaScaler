import type { JobsEnv } from "@/lib/cloudflare/env";
import { nextHourlyAlarm, scheduledTasksForTime, startWorkflowTasks } from "@/workers/jobs/scheduled";
import { DurableObject } from "cloudflare:workers";

type SchedulerState = {
  blockConcurrencyWhile<T>(callback: () => Promise<T>): Promise<T>;
  storage: { setAlarm(timestamp: number): Promise<void> };
};

export class WorkflowScheduler extends DurableObject<JobsEnv> {
  constructor(private readonly state: SchedulerState, env: JobsEnv) {
    super(state as never, env);
  }

  bootstrap(): Promise<{ nextAlarm: number }> {
    return this.state.blockConcurrencyWhile(async () => {
      const nextAlarm = nextHourlyAlarm();
      await this.state.storage.setAlarm(nextAlarm);
      return { nextAlarm };
    });
  }

  alarm(): Promise<void> {
    return this.state.blockConcurrencyWhile(async () => {
      try { await startWorkflowTasks(scheduledTasksForTime(new Date()), this.env); }
      finally { await this.state.storage.setAlarm(nextHourlyAlarm(Date.now() + 1_000)); }
    });
  }
}
