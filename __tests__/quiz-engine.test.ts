import { expect, it } from "vitest";
import { createDemoGraph } from "@/lib/quiz/demo";
import { advanceNode, initialSnapshot, simulateQuiz } from "@/lib/quiz/engine";
import { qualify } from "@/lib/quiz/qualification";
import { newNode } from "@/lib/quiz/editor-state";
import type { QuizGraph } from "@/lib/quiz/contracts";

it("completes both branches, using declared choice values and optional email", () => {
  const graph = createDemoGraph();
  const help = simulateQuiz(graph, [{ kind: "answer", choiceId: "pomoc", value: "forged" }, { kind: "skip" }]);
  expect(help.snapshot.phase).toBe("completed");
  expect(help.snapshot.answers.wybor).toBe("pomoc");
  expect(help.snapshot.tags).toEqual(["pomoc"]);
  expect(help.qualification).toEqual({ qualified: true, reasons: ["interest"] });
  const material = simulateQuiz(graph, [{ kind: "answer", choiceId: "material", value: "" }, { kind: "answer", value: " osoba@example.com " }]);
  expect(material.snapshot.email).toBe("osoba@example.com");
  expect(material.qualification.reasons).toEqual(["email"]);
});
it("keeps unanswered/invalid questions incomplete and never mutates its input", () => {
  const graph = createDemoGraph();
  const before = initialSnapshot(graph);
  const copy = structuredClone(before);
  const prompt = advanceNode(graph, before);
  expect(prompt.after.phase).toBe("waiting");
  expect(prompt.after.completedNodeIds).not.toContain("wybor");
  expect(before).toEqual(copy);
  const invalid = simulateQuiz(graph, [{ kind: "answer", choiceId: "material", value: "" }, { kind: "answer", value: "bad-email" }]);
  expect(invalid.snapshot.nodeId).toBe("email");
  expect(invalid.snapshot.email).toBeNull();
  expect(invalid.qualification.qualified).toBe(false);
  expect(advanceNode(graph, prompt.after, { kind: "stop" }).after.phase).toBe("stopped");
});
it("supports every criterion and AND without qualifying empty groups", () => {
  const s = { ...initialSnapshot(createDemoGraph()), email: "osoba@example.com", interest: true, tags: ["pomoc"], fields: { etap: 2 }, answers: { wybor: "pomoc" }, completedNodeIds: ["wybor"] };
  const rules = [{ kind: "email" }, { kind: "interest" }, { kind: "tag", value: "pomoc" }, { kind: "field", key: "etap", value: 2 }, { kind: "answer", nodeId: "wybor", value: "pomoc" }, { kind: "completed", nodeId: "wybor" }] as const;
  expect(qualify({ mode: "all", rules: [...rules] }, s).qualified).toBe(true);
  expect(qualify({ mode: "all", rules: [...rules] }, { ...s, interest: false }).qualified).toBe(false);
  expect(qualify({ mode: "all", rules: [] }, s).qualified).toBe(false);
});
it("executes text, fields and both condition outcomes through human or completed ends", () => {
  const graph: QuizGraph = { schemaVersion: 1, qualification: { mode: "all", rules: [{ kind: "field", key: "cel", value: "pomoc" }, { kind: "completed", nodeId: "q" }] }, nodes: [
    { ...newNode("start", "s"), type: "start", trigger: "comment", allPosts: true, postIds: [], keyword: "START", text: "Start", cta: "Start", next: "q" },
    { ...newNode("question", "q"), type: "question", text: "Jaki cel?", input: "text", field: "cel", required: true, choices: [], next: "warunek" },
    { ...newNode("condition", "warunek"), type: "condition", when: { mode: "any", rules: [{ kind: "answer", nodeId: "q", value: "pomoc" }] }, yes: "human", no: "end" },
    { ...newNode("end", "human"), type: "end", outcome: "human" },
    { ...newNode("end", "end"), type: "end", outcome: "completed" },
  ] };
  expect(simulateQuiz(graph, [{ kind: "answer", value: "pomoc" }]).snapshot.phase).toBe("human");
  expect(simulateQuiz(graph, [{ kind: "answer", value: "pomoc" }]).qualification.qualified).toBe(true);
  expect(simulateQuiz(graph, [{ kind: "answer", value: "inny" }]).snapshot.phase).toBe("completed");
});
