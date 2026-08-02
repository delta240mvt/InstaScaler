import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const roots = ["app", "components"];
const forbidden = [
  "@/lib/db",
  "@/app/generated/prisma",
  "@/lib/workspace",
  "@/lib/billing",
  "@/lib/queue",
  "@/lib/meta",
];

function sourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const candidate = path.join(directory, entry);
    if (statSync(candidate).isDirectory()) return sourceFiles(candidate);
    return /\.[cm]?[jt]sx?$/.test(candidate) ? [candidate] : [];
  });
}

describe("OpenNext Web dependency boundary", () => {
  it("does not import database, workspace, queue, billing, or Meta server modules", () => {
    const violations = roots.flatMap(sourceFiles).flatMap((file) => {
      const source = readFileSync(file, "utf8");
      return forbidden.filter((specifier) => source.includes(specifier)).map((specifier) => `${file}: ${specifier}`);
    });
    expect(violations).toEqual([]);
  });
});
