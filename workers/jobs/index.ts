import type { JobsEnv } from "@/lib/cloudflare/env";
import { AccountRateLimiter } from "@/workers/jobs/account-rate-limiter";
import { scheduledTasksForCron } from "@/workers/jobs/scheduled";

type QueueBatch = {
  messages: unknown[];
};

export default {
  async queue(batch: QueueBatch, _env: JobsEnv): Promise<void> {
    console.log("Received Instagram job batch", { size: batch.messages.length });
  },
  async scheduled(event: { cron: string }): Promise<void> {
    for (const task of scheduledTasksForCron(event.cron)) console.log("Starting scheduled Jobs task", { task });
  },
};

export { AccountRateLimiter };
