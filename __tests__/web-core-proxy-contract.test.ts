import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("Web-to-Core API proxy contract", () => {
  it("binds the Core Worker and proxies API calls through that binding", async () => {
    const [webConfig, proxyRoute] = await Promise.all([
      readFile("wrangler.web.jsonc", "utf8"),
      readFile("app/api/[...path]/route.ts", "utf8"),
    ]);

    expect(webConfig).toContain('"binding": "CORE_API"');
    expect(webConfig).toContain('"service": "instascaler-core"');
    expect(proxyRoute).toContain("getCloudflareContext");
    expect(proxyRoute).toContain("core.fetch");
    expect(proxyRoute).toContain('headers.set("origin", "https://core.internal")');
    expect(proxyRoute).toContain('redirect: "manual"');
  });
});
