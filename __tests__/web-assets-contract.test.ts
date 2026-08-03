import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("OpenNext static assets", () => {
  it("publishes the generated asset directory with the Web Worker", () => {
    const config = readFileSync(resolve("wrangler.web.jsonc"), "utf8");
    expect(config).toContain('"assets"');
    expect(config).toContain('"directory": ".open-next/assets"');
  });
});
