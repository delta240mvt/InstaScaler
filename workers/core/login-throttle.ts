type DurableStorage = {
  get<T>(key: string): Promise<T | undefined>;
  put<T>(key: string, value: T): Promise<void>;
};

type DurableState = { storage: DurableStorage };

export class LoginThrottle {
  constructor(private readonly state: DurableState, _env: unknown) {}

  async checkAndRecord(success: boolean): Promise<{ allowed: boolean; retryAfterSeconds: number }> {
    const now = Date.now();
    const failures = ((await this.state.storage.get<number[]>("failures")) ?? []).filter(
      (timestamp) => now - timestamp < 900_000,
    );
    if (success) {
      await this.state.storage.put("failures", []);
      return { allowed: true, retryAfterSeconds: 0 };
    }
    if (failures.length >= 5) {
      return { allowed: false, retryAfterSeconds: Math.ceil((failures[0] + 900_000 - now) / 1000) };
    }
    failures.push(now);
    await this.state.storage.put("failures", failures);
    return { allowed: true, retryAfterSeconds: 0 };
  }
}
