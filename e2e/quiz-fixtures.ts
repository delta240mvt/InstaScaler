import type { Page } from "@playwright/test";
import { fixtureApi, account } from "./local-fixtures";
import { createDemoGraph } from "../lib/quiz/demo";
import { newNode } from "../lib/quiz/editor-state";
import type { ContactDetail, PathDetail, RunSummary } from "../lib/core-api/quiz-contracts";
import { initialSnapshot } from "../lib/quiz/engine";

export async function quizFixtureApi(page: Page, options: { saveFailure?: boolean; revisionConflict?: boolean; fullGraph?: boolean; contactConflict?: boolean } = {}) {
  await fixtureApi(page);
  const graph = createDemoGraph();
  if (options.fullGraph) while (graph.nodes.length < 10) graph.nodes.push({ ...newNode("message", `extra${graph.nodes.length}`), x: 340, y: graph.nodes.length * 100 });
  const stamp = "2026-09-08T10:00:00.000Z";
  const path: PathDetail = { id: "demo", name: "Quiz START", instagramAccountId: account.id, draft: { name: "Quiz START", instagramAccountId: account.id, graph }, draftRevision: 1, publishedVersionId: null, acceptsEntries: false, halted: false, createdAt: stamp, updatedAt: stamp, metrics: { started: 3, completed: 1, qualified: 2 } };
  const contacts: ContactDetail[] = [
    { id: "c1", instagramAccountId: account.id, instagramUserId: "901", username: "anna", email: "anna@example.com", fields: {}, tags: ["material"], qualified: true, updatedAt: stamp, lastInteractionAt: stamp },
    { id: "c2", instagramAccountId: account.id, instagramUserId: "902", username: "bartek", email: null, fields: {}, tags: ["pomoc"], qualified: true, updatedAt: stamp, lastInteractionAt: stamp },
    { id: "c3", instagramAccountId: account.id, instagramUserId: "903", username: "celina", email: null, fields: {}, tags: [], qualified: false, updatedAt: stamp, lastInteractionAt: stamp },
  ];
  const runs: Record<string, RunSummary[]> = Object.fromEntries(contacts.map(c => [c.id, [{ id: `run-${c.id}`, pathId: "demo", pathName: path.name, version: 1, status: "WAITING_REPLY", snapshot: { ...initialSnapshot(graph), phase: "waiting", email: c.email, interest: c.id === "c2", answers: { wybor: c.id === "c2" ? "pomoc" : "material" } }, sourcePostId: "1789000123", sourceMessageId: null, qualified: c.qualified, qualificationReasons: c.id === "c1" ? ["email"] : c.id === "c2" ? ["interest"] : [], lastInteractionAt: stamp, createdAt: stamp }]]));
  const state = { path, contacts, runs, sends: 0 };
  await page.route(url => url.pathname.startsWith("/api/quiz-"), async route => {
    const req = route.request(), url = new URL(req.url()), parts = url.pathname.split("/").filter(Boolean), method = req.method();
    const reply = (data: unknown, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(data) });
    const paged = (items: unknown[]) => ({ data: { items, total: items.length, page: 1, pageSize: 25 } });
    if (parts[1] === "quiz-paths") {
      if (method === "GET") return reply(parts.length === 2 ? paged([state.path]) : { data: state.path });
      if (method === "POST" && parts.length === 2) { const draft = req.postDataJSON(); state.path = { ...state.path, draft, name: draft.name }; return reply({ data: state.path }, 201); }
      if (parts[3] === "draft") {
        if (options.saveFailure) return reply({ error: "service_unavailable" }, 503);
        const body = req.postDataJSON();
        if (options.revisionConflict || body.expectedRevision !== state.path.draftRevision) return reply({ error: "quiz_revision_conflict" }, 409);
        state.path = { ...state.path, draft: body.draft, name: body.draft.name, draftRevision: state.path.draftRevision + 1 }; return reply({ data: state.path });
      }
      if (parts[3] === "publish") { state.path = { ...state.path, publishedVersionId: "v1", acceptsEntries: true }; return reply({ data: state.path }); }
      if (parts[3] === "state") { state.path = { ...state.path, ...req.postDataJSON() }; return reply({ data: state.path }); }
      if (parts[3] === "duplicate") return reply({ data: state.path }, 201);
    }
    if (parts[1] === "quiz-contacts") {
      if (parts.length === 2) {
        let items = state.contacts;
        if (url.searchParams.get("qualified") === "true") items = items.filter(c => c.qualified);
        if (url.searchParams.get("hasEmail") === "true") items = items.filter(c => c.email);
        if (url.searchParams.get("interested") === "true") items = items.filter(c => c.id === "c2");
        if (url.searchParams.get("instagramUserId")) items = items.filter(c => c.instagramUserId === url.searchParams.get("instagramUserId"));
        return reply(paged(items));
      }
      const contact = state.contacts.find(c => c.id === parts[2]);
      if (!contact) return reply({ error: "quiz_contact_not_found" }, 404);
      if (parts[3] === "runs") return reply(paged(state.runs[contact.id]));
      if (method === "PATCH") {
        if (options.contactConflict) return reply({ error: "quiz_revision_conflict" }, 409);
        const body = req.postDataJSON(); Object.assign(contact, { email: body.email, fields: body.fields, tags: body.tags, updatedAt: new Date().toISOString() });
      }
      if (method === "DELETE") { state.contacts = state.contacts.filter(c => c.id !== contact.id); return route.fulfill({ status: 204 }); }
      return reply({ data: contact });
    }
    if (parts[1] === "quiz-runs") {
      if (parts[3] === "events") return reply(paged([{ id: "e1", kind: "ANSWER", nodeId: "wybor", data: { value: "pomoc" }, createdAt: stamp }, { id: "e2", kind: "MATERIAL_SENT", nodeId: "material", data: {}, createdAt: stamp }]));
      const run = Object.values(runs).flat().find(r => r.id === parts[2]);
      if (run && parts[3] === "control") { const action = req.postDataJSON().action; run.status = action === "pause" ? "PAUSED" : action === "stop" ? "STOPPED" : "WAITING_REPLY"; return reply({ data: { id: run.id, status: run.status } }); }
    }
    return reply({ error: "not_found" }, 404);
  });
  return state;
}
