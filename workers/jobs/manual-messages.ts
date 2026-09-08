import { WorkerEntrypoint } from "cloudflare:workers";
import type { JobsEnv } from "@/lib/cloudflare/env";
import { createPrisma } from "@/lib/db/neon";
import { sendManualMessage, type ManualMessageInput, type ManualMessageResult } from "@/lib/delivery/manual-message";

/** Available only through the Core service binding; no public HTTP endpoint. */
export class ManualMessages extends WorkerEntrypoint<JobsEnv> {
  async sendManualMessage(input: ManualMessageInput): Promise<ManualMessageResult> {
    return sendManualMessage(createPrisma(this.env.DATABASE_URL), this.env, input);
  }
}
