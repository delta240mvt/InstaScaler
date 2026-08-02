import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { gzipSync } from "node:zlib";
import path from "node:path";

const limit = Number(process.env.WORKER_GZIP_LIMIT_BYTES ?? 3 * 1024 * 1024);
function files(target) {
  if (!existsSync(target)) throw new Error(`Missing bundle: ${target}`);
  if (!statSync(target).isDirectory()) return [target];
  return readdirSync(target).flatMap((name) => files(path.join(target, name))).filter((file) => /\.[cm]?js$/.test(file));
}
for (const target of process.argv.slice(2)) {
  const bytes = files(target).reduce((sum, file) => sum + gzipSync(readFileSync(file)).byteLength, 0);
  console.log(`${target}: ${(bytes / 1024 / 1024).toFixed(2)} MiB gzip`);
  if (bytes > limit) throw new Error(`${target} exceeds the ${(limit / 1024 / 1024).toFixed(2)} MiB Free-plan limit`);
}
