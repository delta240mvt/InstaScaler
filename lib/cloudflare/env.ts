import type { DatabaseEnv } from "@/lib/db/types";
import type { InstagramJob } from "@/lib/jobs/contracts";

export type QueueBinding = {
  send(message: InstagramJob, options?: { delaySeconds?: number }): Promise<void>;
};

export type CoreEnv = DatabaseEnv & {
  ADMIN_SESSION_SECRET: string;
  META_APP_SECRET: string;
  META_WEBHOOK_VERIFY_TOKEN: string;
  INSTAGRAM_JOBS: QueueBinding;
};

export type JobsEnv = DatabaseEnv & {
  META_APP_SECRET: string;
};
