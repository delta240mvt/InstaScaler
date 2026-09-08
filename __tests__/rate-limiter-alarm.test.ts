import { afterEach, expect, it, vi } from "vitest";
import { AccountRateLimiter } from "@/workers/jobs/account-rate-limiter";

afterEach(() => vi.useRealTimers());

it("does not clear current-hour capacity when an older alarm fires late", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-08T10:01:00Z"));
  const rows = new Map<string, number>();
  const state = {
    blockConcurrencyWhile: async <T,>(work: () => Promise<T>) => work(),
    storage: { setAlarm: async () => undefined, sql: { exec: <T,>(query: string, ...params: unknown[]): T[] => {
      if (query.startsWith("SELECT")) return (rows.has(String(params[0])) ? [{ used: rows.get(String(params[0])) }] : []) as T[];
      if (query.startsWith("INSERT")) rows.set(String(params[0]), Number(params[1]));
      if (query.startsWith("DELETE")) for (const key of rows.keys()) if (params.length === 0 || key < String(params[0])) rows.delete(key);
      return [];
    } } },
  };
  const limiter = new AccountRateLimiter(state, {});
  await limiter.reserve({ amount: 200, now: Date.now() });
  await limiter.alarm();
  expect((await limiter.reserve({ amount: 1, now: Date.now() })).allowed).toBe(false);
});
