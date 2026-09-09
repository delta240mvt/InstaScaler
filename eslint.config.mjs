import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  { rules: { "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }] } },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    ".open-next/**",
    ".open-next-stale-*/**",
    ".firecrawl/**",
    "test-results/**",
    "playwright-report/**",
    ".wrangler/**",
    "dist/**",
    "dist-*/**",
    "landing/**",
    "app/generated/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
