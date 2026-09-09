import type { DatabaseEnv } from "@/lib/db/types";
import type { InstagramJob } from "@/lib/jobs/contracts";
import type { JournalBucket } from "@/lib/events/journal";
import type { ManualMessageInput, ManualMessageResult } from "@/lib/delivery/manual-message";

export type QueueBinding = {
  send(message: InstagramJob, options?: { delaySeconds?: number }): Promise<void>;
};

export type WorkflowBinding = {
  create(options?: { id?: string; params?: unknown }): Promise<unknown>;
};

export type WorkflowSchedulerBinding = {
  idFromName(name: string): unknown;
  get(id: unknown): { bootstrap(): Promise<{ nextAlarm: number }> };
};

export type LoginThrottleStub = {
  checkAndRecord(success: boolean): Promise<{ allowed: boolean; retryAfterSeconds: number }>;
};

export type LoginThrottleBinding = {
  idFromName(name: string): unknown;
  get(id: unknown): LoginThrottleStub;
};

export type CoreEnv = DatabaseEnv & {
  APP_BASE_URL: string;
  ADMIN_LOGIN: string;
  ADMIN_PASSWORD_PEPPER: string;
  ADMIN_PASSWORD_VERIFIER: string;
  META_APP_SECRET: string;
  META_APP_ID: string;
  META_REDIRECT_URI: string;
  META_WEBHOOK_VERIFY_TOKEN: string;
  OAUTH_STATE_KEY: string;
  ENCRYPTION_KEY: string;
  IP_HASH_SALT: string;
  SESSION_SIGNING_KEY: string;
  LOGIN_THROTTLE: LoginThrottleBinding;
  JOBS_API: { sendManualMessage(input: ManualMessageInput): Promise<ManualMessageResult>; processEvent(job: InstagramJob): Promise<import("@/lib/delivery").JobResult> };
  INSTAGRAM_EVENTS: QueueBinding;
  EVENT_JOURNAL: JournalBucket;
};

export type JobsEnv = DatabaseEnv & {
  ENCRYPTION_KEY: string;
  APP_BASE_URL: string;
  EVENT_JOURNAL: JournalBucket;
  INSTAGRAM_EVENTS: QueueBinding;
  ACCOUNT_RATE_LIMITER: {
    idFromName(name: string): unknown;
    get(id: unknown): { reserve(input: { amount: number; now: number }): Promise<{ allowed: boolean; retryAt: number | null; remaining: number }> };
  };
  RECONCILE_WORKFLOW: WorkflowBinding;
  RECOVER_JOURNAL_WORKFLOW: WorkflowBinding;
  REFRESH_TOKENS_WORKFLOW: WorkflowBinding;
  ATTACH_NEXT_REEL_WORKFLOW: WorkflowBinding;
  SNAPSHOT_FOLLOWERS_WORKFLOW: WorkflowBinding;
  RETENTION_WORKFLOW: WorkflowBinding;
  WORKFLOW_SCHEDULER: WorkflowSchedulerBinding;
  SCHEDULER_BOOTSTRAP_TOKEN: string;
};
