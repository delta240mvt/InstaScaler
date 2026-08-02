export class WorkflowEntrypoint<Env = unknown> {
  protected env: Env;
  constructor(_context?: unknown, env?: Env) { this.env = env as Env; }
}

export class DurableObject<Env = unknown> {
  protected env: Env;
  constructor(_state?: unknown, env?: Env) { this.env = env as Env; }
}
