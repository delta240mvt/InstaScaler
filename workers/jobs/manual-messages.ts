import { WorkerEntrypoint } from "cloudflare:workers";
import type { JobsEnv } from "@/lib/cloudflare/env";
import { processQueuedEvent } from "@/lib/delivery/queued-event";
import { parseInstagramJob } from "@/lib/jobs/contracts";
import { createPrisma } from "@/lib/db/neon";
import { sendManualMessage, type ManualMessageInput, type ManualMessageResult } from "@/lib/delivery/manual-message";

/** Available only through the Core service binding; no public HTTP endpoint. */
export class ManualMessages extends WorkerEntrypoint<JobsEnv> {
  async processEvent(input: unknown) {
    const job = parseInstagramJob(input);
    if (!["COMMENT", "POSTBACK", "MESSAGE"].includes(job.kind)) return { status: "failed" as const, code: "INVALID_IMMEDIATE_JOB" };
    return processQueuedEvent(this.env, job);
  }
  async sendManualMessage(input: ManualMessageInput): Promise<ManualMessageResult> {
    return sendManualMessage(createPrisma(this.env.DATABASE_URL), this.env, input);
  }
}
