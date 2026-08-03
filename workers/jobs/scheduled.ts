import type { JobsEnv, WorkflowBinding } from "@/lib/cloudflare/env";
import { workflowExternalId } from "@/workers/jobs/workflows/services";

export type ScheduledTask = "reconcile" | "recover-journal" | "refresh-tokens" | "attach-next-reel" | "snapshot-followers" | "retention";

const CRON_TASKS: Record<string, ScheduledTask[]> = {
  "7 * * * *": ["reconcile", "recover-journal", "attach-next-reel"],
  "0 5 * * *": ["refresh-tokens"],
  "0 7 * * *": ["snapshot-followers"],
  "20 3 * * *": ["retention"],
};

export function scheduledTasksForCron(cron: string): ScheduledTask[] { return CRON_TASKS[cron] ?? []; }

export function scheduledTasksForTime(now: Date): ScheduledTask[] {
  const tasks: ScheduledTask[] = ["reconcile", "recover-journal", "attach-next-reel"];
  if (now.getUTCHours() === 3) tasks.push("retention");
  if (now.getUTCHours() === 5) tasks.push("refresh-tokens");
  if (now.getUTCHours() === 7) tasks.push("snapshot-followers");
  return tasks;
}

export function nextHourlyAlarm(now = Date.now()): number {
  const next = new Date(now);
  next.setUTCMinutes(7, 0, 0);
  if (next.getTime() <= now) next.setUTCHours(next.getUTCHours() + 1);
  return next.getTime();
}

function bindingForTask(env: JobsEnv, task: ScheduledTask): WorkflowBinding {
  if (task === "reconcile") return env.RECONCILE_WORKFLOW;
  if (task === "recover-journal") return env.RECOVER_JOURNAL_WORKFLOW;
  if (task === "refresh-tokens") return env.REFRESH_TOKENS_WORKFLOW;
  if (task === "attach-next-reel") return env.ATTACH_NEXT_REEL_WORKFLOW;
  if (task === "snapshot-followers") return env.SNAPSHOT_FOLLOWERS_WORKFLOW;
  return env.RETENTION_WORKFLOW;
}

export async function startScheduledWorkflows(cron: string, env: JobsEnv): Promise<{ started: number; skipped: boolean }> {
  return startWorkflowTasks(scheduledTasksForCron(cron), env);
}

export async function startWorkflowTasks(tasks: ScheduledTask[], env: JobsEnv): Promise<{ started: number; skipped: boolean }> {
  if (!env.DATABASE_URL) return { started: 0, skipped: true };
  await Promise.all(tasks.map(async (task) => {
    const id = workflowExternalId(task).replaceAll(":", "-");
    try { await bindingForTask(env, task).create({ id }); }
    catch (error) { console.warn("Scheduled Workflow was not created", { task, error: error instanceof Error ? error.message : "unknown" }); }
  }));
  return { started: tasks.length, skipped: false };
}
