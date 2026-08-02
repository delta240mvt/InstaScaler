import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function files(root: string): string[] {
  if (!existsSync(root)) return [];
  return readdirSync(root).flatMap((name) => {
    const target = path.join(root, name);
    if (target.replaceAll("\\", "/").includes("app/generated/")) return [];
    return statSync(target).isDirectory() ? files(target) : /\.[cm]?[jt]sx?$/.test(target) ? [target] : [];
  });
}

describe("Cloudflare-native cutover", () => {
  it("has no legacy runtime packages or scripts", () => {
    const pkg = JSON.parse(readFileSync("package.json", "utf8")) as { dependencies: Record<string, string>; scripts: Record<string, string> };
    for (const dependency of ["@prisma/adapter-pg", "pg", "bullmq", "ioredis", "next-auth", "@auth/prisma-adapter", "@vercel/analytics"]) {
      expect(pkg.dependencies).not.toHaveProperty(dependency);
    }
    expect(pkg.scripts).not.toHaveProperty("worker");
  });

  it("has no legacy modules, generated-client imports, or workspace schema", () => {
    for (const target of ["lib/db/client.ts", "lib/workspace.ts", "lib/workspace-access.ts", "lib/workspace-invitations.ts", "prisma/schema.cf-native.prisma"]) expect(existsSync(target), target).toBe(false);
    for (const directory of ["lib/queue", "lib/billing", "lib/polling", "worker", "prisma/cf-native-migrations"]) expect(files(directory), directory).toEqual([]);
    const source = files("lib").concat(files("workers"), files("app"), files("components")).map((file) => readFileSync(file, "utf8")).join("\n");
    expect(source).not.toContain("app/generated/cf-native");
    expect(readFileSync("prisma/schema.prisma", "utf8")).not.toContain("workspaceId");
  });
});
