export type ScheduledTask = "reconcile" | "recover-journal" | "refresh-tokens" | "attach-next-reel" | "snapshot-followers" | "retention";

const CRON_TASKS: Record<string, ScheduledTask[]> = {
  "7 * * * *": ["reconcile", "recover-journal"],
  "0 5 * * *": ["refresh-tokens"],
  "0 6 * * *": ["attach-next-reel"],
  "0 7 * * *": ["snapshot-followers"],
  "20 3 * * *": ["retention"],
};

export function scheduledTasksForCron(cron: string): ScheduledTask[] { return CRON_TASKS[cron] ?? []; }
