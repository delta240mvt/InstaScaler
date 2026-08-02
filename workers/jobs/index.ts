import type { JobsEnv } from "@/lib/cloudflare/env";

type QueueBatch = {
  messages: unknown[];
};

export default {
  async queue(batch: QueueBatch, _env: JobsEnv): Promise<void> {
    console.log("Received Instagram job batch", { size: batch.messages.length });
  },
};
