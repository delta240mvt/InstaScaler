import { Hono } from "hono";
import { z } from "zod";
import type { CoreEnv } from "@/lib/cloudflare/env";
import type { QuizDb } from "@/lib/quiz/repository";
import { contactPatchSchema, getQuizContact, listContactRuns, listQuizContacts, listRunEvents, updateQuizContact } from "@/lib/quiz/contacts";
import { deleteQuizContact } from "@/lib/quiz/privacy";
import { controlQuizRun } from "@/lib/quiz/recovery";
import { advanceQuizRun } from "@/lib/quiz/execution";
import { dispatchQuizWork } from "@/lib/delivery/quiz-work";
import { requireAdmin } from "../middleware/auth";

export function quizContactRoutes(getDb: (env: CoreEnv) => QuizDb) {
  const app = new Hono<{ Bindings: CoreEnv }>();
  app.use("/quiz-contacts", requireAdmin); app.use("/quiz-contacts/*", requireAdmin); app.use("/quiz-runs/*", requireAdmin);
  app.get("/quiz-contacts", async c => c.json({ data: await listQuizContacts(getDb(c.env), c.req.query()) }));
  app.get("/quiz-contacts/:id", async c => c.json({ data: await getQuizContact(getDb(c.env), c.req.param("id")) }));
  app.get("/quiz-contacts/:id/runs", async c => c.json({ data: await listContactRuns(getDb(c.env), c.req.param("id"), c.req.query()) }));
  app.get("/quiz-runs/:id/events", async c => c.json({ data: await listRunEvents(getDb(c.env), c.req.param("id"), c.req.query()) }));
  app.patch("/quiz-contacts/:id", async c => c.json({ data: await updateQuizContact(getDb(c.env), c.req.param("id"), contactPatchSchema.parse(await c.req.json())) }));
  app.delete("/quiz-contacts/:id", async c => { await deleteQuizContact(getDb(c.env), c.env.EVENT_JOURNAL, c.req.param("id")); return c.body(null, 204); });
  app.post("/quiz-runs/:id/control", async c => {
    const { action } = z.object({ action: z.enum(["pause", "resume", "stop", "restart"]) }).strict().parse(await c.req.json());
    const db = getDb(c.env);
    const run = await controlQuizRun(db, c.req.param("id"), action);
    const next = await advanceQuizRun(db, run.id);
    if (next.workId) await dispatchQuizWork(db, c.env, next.workId);
    return c.json({ data: { id: run.id, status: run.status } });
  });
  return app;
}
