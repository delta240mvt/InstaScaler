import { Hono } from "hono";
import type { CoreEnv } from "@/lib/cloudflare/env";

const app = new Hono<{ Bindings: CoreEnv }>();

app.get("/health", (context) =>
  context.json({ status: "ok", service: "core" }),
);

export default {
  fetch: app.fetch,
};
