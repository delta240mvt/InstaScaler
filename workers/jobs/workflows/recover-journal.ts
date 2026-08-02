import { WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep } from "cloudflare:workers";
import type { JobsEnv } from "@/lib/cloudflare/env";
import { executeWorkflowTask, withJobRun } from "@/workers/jobs/workflows/services";

export class RecoverJournalWorkflow extends WorkflowEntrypoint<JobsEnv, Record<string, never>> {
  run(_event: WorkflowEvent<Record<string, never>>, step: WorkflowStep) {
    return withJobRun("recover-journal", this.env, () => step.do("recover-journal", { retries: { limit: 3, delay: "10 seconds", backoff: "exponential" }, timeout: "5 minutes" }, () => executeWorkflowTask("recover-journal", this.env)));
  }
}
