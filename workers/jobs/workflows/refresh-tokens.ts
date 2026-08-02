import { WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep } from "cloudflare:workers";
import type { JobsEnv } from "@/lib/cloudflare/env";
import { executeWorkflowTask, withJobRun } from "@/workers/jobs/workflows/services";

export class RefreshTokensWorkflow extends WorkflowEntrypoint<JobsEnv, Record<string, never>> {
  run(_event: WorkflowEvent<Record<string, never>>, step: WorkflowStep) {
    return withJobRun("refresh-tokens", this.env, () => step.do("refresh-tokens", { retries: { limit: 3, delay: "10 seconds", backoff: "exponential" }, timeout: "5 minutes" }, () => executeWorkflowTask("refresh-tokens", this.env)));
  }
}
