declare module "cloudflare:workers" {
  export type WorkflowEvent<T> = { payload: T; instanceId: string; timestamp: Date };
  export type WorkflowStep = {
    do<T>(name: string, config: { retries: { limit: number; delay: string; backoff: "constant" | "linear" | "exponential" }; timeout?: string }, callback: () => Promise<T>): Promise<T>;
  };
  export abstract class WorkflowEntrypoint<Env = unknown, Params = unknown> {
    protected env: Env;
    abstract run(event: WorkflowEvent<Params>, step: WorkflowStep): Promise<unknown>;
  }
  export abstract class DurableObject<Env = unknown> {
    protected env: Env;
    constructor(state: unknown, env: Env);
  }
}
