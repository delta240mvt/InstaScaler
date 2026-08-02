export class CoreApiError extends Error {
  constructor(public readonly status: number, public readonly code: string, public readonly requestId?: string) {
    super(code);
    this.name = "CoreApiError";
  }
}
