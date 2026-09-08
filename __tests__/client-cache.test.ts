import { afterEach, describe, expect, it, vi } from "vitest";
import { clearClientCache, readCache, writeCache } from "@/lib/client-cache";

afterEach(() => vi.unstubAllGlobals());
describe("session cache cleanup", () => {
  it("removes cached private account data when the session ends", () => {
    const data = new Map<string, string>();
    vi.stubGlobal("window", { sessionStorage: { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => data.set(k, v), removeItem: (k: string) => data.delete(k), key: (i: number) => [...data.keys()][i] ?? null, get length() { return data.size; } } });
    writeCache("inbox:msgs:one", [{ text: "private reply" }]);
    writeCache("ig-posts:one", [{ id: "post" }]);
    data.set("inbox:selectedAccount", "one");
    data.set("unrelated-preference", "keep");
    clearClientCache();
    expect(readCache("inbox:msgs:one", 1000).data).toBeNull();
    expect(data.has("ig-posts:one")).toBe(false);
    expect(data.has("inbox:selectedAccount")).toBe(false);
    expect(data.get("unrelated-preference")).toBe("keep");
  });
});
