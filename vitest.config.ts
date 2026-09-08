import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  plugins: [{
    name: "cloudflare-prisma-wasm-in-node-tests",
    enforce: "pre",
    load(id) {
      if (id.endsWith(".wasm?module")) return `import { readFileSync } from "node:fs"; export default new WebAssembly.Module(readFileSync(${JSON.stringify(id.slice(0, -7))}));`;
    },
  }],
  test: {
    globals: true,
    environment: "node",
    include: ["__tests__/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
      "cloudflare:workers": path.resolve(__dirname, "test-support/cloudflare-workers.ts"),
    },
  },
});
