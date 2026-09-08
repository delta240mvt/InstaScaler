import { Hono } from "hono";
import { z } from "zod";
import type { CoreEnv } from "@/lib/cloudflare/env";
import { requireAdmin } from "../middleware/auth";
import { createPath, duplicatePath, getPath, listPaths, publishPath, saveDraft, setPathState } from "@/lib/quiz/paths";
import { parseQuizDraft } from "@/lib/quiz/contracts";
import type { QuizDb } from "@/lib/quiz/repository";

export function quizPathRoutes(getDb: (env: CoreEnv) => QuizDb) {
  const app = new Hono<{ Bindings: CoreEnv }>();
  app.use("/quiz-paths", requireAdmin);
  app.use("/quiz-paths/*", requireAdmin);
  app.get("/quiz-paths", async c => c.json({ data: await listPaths(getDb(c.env), c.req.query()) }));
  app.post("/quiz-paths", async c => c.json({ data: await createPath(getDb(c.env), parseQuizDraft(await c.req.json())) }, 201));
  app.get("/quiz-paths/:id", async c => c.json({ data: await getPath(getDb(c.env), c.req.param("id")) }));
  app.put("/quiz-paths/:id/draft", async c => {
    const b = z.object({ expectedRevision: z.number().int().positive(), draft: z.unknown() }).strict().parse(await c.req.json());
    return c.json({ data: await saveDraft(getDb(c.env), c.req.param("id"), b.expectedRevision, parseQuizDraft(b.draft)) });
  });
  app.post("/quiz-paths/:id/publish", async c => {
    const b = z.object({ expectedRevision: z.number().int().positive() }).strict().parse(await c.req.json());
    return c.json({ data: await publishPath(getDb(c.env), c.req.param("id"), b.expectedRevision) });
  });
  app.post("/quiz-paths/:id/duplicate", async c => c.json({ data: await duplicatePath(getDb(c.env), c.req.param("id")) }, 201));
  app.patch("/quiz-paths/:id/state", async c => {
    const b = z.object({ acceptsEntries: z.boolean(), halted: z.boolean() }).strict().parse(await c.req.json());
    return c.json({ data: await setPathState(getDb(c.env), c.req.param("id"), b.acceptsEntries, b.halted) });
  });
  return app;
}
