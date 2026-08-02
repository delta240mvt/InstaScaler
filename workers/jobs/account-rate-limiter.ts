import { reserveAccountCapacity } from "@/lib/jobs/account-rate-limit";
import { DurableObject } from "cloudflare:workers";

type Sql = { exec<T extends Record<string, unknown>>(query: string, ...params: unknown[]): Iterable<T> };
type State = {
  blockConcurrencyWhile<T>(callback: () => Promise<T>): Promise<T>;
  storage: { sql: Sql; setAlarm(timestamp: number): Promise<void> };
};

export class AccountRateLimiter extends DurableObject<unknown> {
  constructor(private readonly state: State, env: unknown) {
    super(state as never, env);
    void state.blockConcurrencyWhile(async () => {
      state.storage.sql.exec("CREATE TABLE IF NOT EXISTS capacity (hour TEXT PRIMARY KEY, used INTEGER NOT NULL)");
    });
  }

  reserve(input: { amount: number; now: number }): Promise<{ allowed: boolean; retryAt: number | null; remaining: number }> {
    return this.state.blockConcurrencyWhile(async () => {
      const hour = new Date(input.now).toISOString().slice(0, 13);
      const row = [...this.state.storage.sql.exec<{ used: number }>("SELECT used FROM capacity WHERE hour = ?", hour)][0];
      const result = reserveAccountCapacity({ used: row?.used ?? 0, limit: 200, amount: input.amount, now: input.now });
      if (result.allowed) {
        this.state.storage.sql.exec(
          "INSERT INTO capacity (hour, used) VALUES (?, ?) ON CONFLICT(hour) DO UPDATE SET used = excluded.used",
          hour,
          (row?.used ?? 0) + input.amount,
        );
      }
      const cleanupAt = result.retryAt ?? Date.UTC(new Date(input.now).getUTCFullYear(), new Date(input.now).getUTCMonth(), new Date(input.now).getUTCDate(), new Date(input.now).getUTCHours() + 1) + 60_000;
      await this.state.storage.setAlarm(cleanupAt);
      return result;
    });
  }

  alarm(): Promise<void> {
    return this.state.blockConcurrencyWhile(async () => {
      this.state.storage.sql.exec("DELETE FROM capacity");
    });
  }
}
