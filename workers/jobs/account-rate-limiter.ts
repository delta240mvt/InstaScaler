import { reserveAccountCapacity } from "@/lib/jobs/account-rate-limit";

type State = { storage: { get<T>(key: string): Promise<T | undefined>; put<T>(key: string, value: T): Promise<void>; delete(key: string): Promise<boolean>; setAlarm(timestamp: number): Promise<void> } };

export class AccountRateLimiter {
  constructor(private readonly state: State, _env: unknown) {}

  async reserve(input: { amount: number; now: number }): Promise<{ allowed: boolean; retryAt: number | null; remaining: number }> {
    const hour = new Date(input.now).toISOString().slice(0, 13);
    const current = await this.state.storage.get<{ hour: string; used: number }>("capacity");
    const used = current?.hour === hour ? current.used : 0;
    const result = reserveAccountCapacity({ used, limit: 200, amount: input.amount, now: input.now });
    if (result.allowed) await this.state.storage.put("capacity", { hour, used: used + input.amount });
    if (result.retryAt) await this.state.storage.setAlarm(result.retryAt + 60_000);
    return result;
  }

  async alarm(): Promise<void> { await this.state.storage.delete("capacity"); }
}
