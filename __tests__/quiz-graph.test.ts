import { expect, it } from "vitest";
import { parseQuizDraft } from "@/lib/quiz/contracts";
import { createDemoGraph } from "@/lib/quiz/demo";
import { validateGraph } from "@/lib/quiz/graph";

it("publishes a complete branching Polish demo within ten steps", () => {
  const graph = createDemoGraph();
  expect(graph.nodes.length).toBeLessThanOrEqual(10);
  expect(validateGraph(graph)).toEqual([]);
  expect(parseQuizDraft({ name: "Ścieżka", instagramAccountId: "acc", graph }).name).toBe("Ścieżka");
});
it("rejects eleven steps in a draft, duplicate ids and cycles at publication", () => {
  const graph = createDemoGraph();
  while (graph.nodes.length < 11) graph.nodes.push({ id: `end${graph.nodes.length}`, label: "Koniec", x: 0, y: 0, type: "end", outcome: "completed" });
  expect(() => parseQuizDraft({ name: "Quiz", instagramAccountId: "acc", graph })).toThrow();
  const cycle = createDemoGraph();
  const start = cycle.nodes[0];
  if (start.type !== "start") throw new Error("start");
  start.next = start.id;
  expect(validateGraph(cycle).some(i => i.code === "CYCLE")).toBe(true);
  cycle.nodes.push({ ...start });
  expect(validateGraph(cycle).some(i => i.code === "DUPLICATE_ID")).toBe(true);
});
it("rejects unsafe links, fields and four buttons", () => {
  const graph = createDemoGraph();
  const question = graph.nodes.find(n => n.type === "question");
  if (!question || question.type !== "question") throw new Error("question");
  question.choices.push(...question.choices);
  expect(() => parseQuizDraft({ name: "Quiz", instagramAccountId: "acc", graph })).toThrow();
  question.choices = [];
  question.field = "__proto__";
  expect(() => parseQuizDraft({ name: "Quiz", instagramAccountId: "acc", graph })).toThrow();
});
