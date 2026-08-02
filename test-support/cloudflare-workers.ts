export class WorkflowEntrypoint<Env = unknown> {
  protected env: Env;
  constructor(_context?: unknown, env?: Env) { this.env = env as Env; }
}
