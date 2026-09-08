import { expect, it } from "vitest";
import { createDemoGraph } from "@/lib/quiz/demo";
import { connectNodes, deleteNode, duplicateNode, newNode } from "@/lib/quiz/editor-state";
it("removes incoming links without silently selecting another step", () => {
  const graph = deleteNode(createDemoGraph(), "email");
  const action = graph.nodes.find(n => n.id === "tag-pomoc");
  expect(action?.type === "action" && action.next).toBe("");
});
it("connects a choice to a shared step and creates independent copies", () => {
  const graph = connectNodes(createDemoGraph(), "wybor", "choice:pomoc", "email");
  const question = graph.nodes.find(n => n.id === "wybor");
  expect(question?.type === "question" && question.choices[1].next).toBe("email");
  const copy = duplicateNode(graph, "wybor", "wybor2").nodes.at(-1);
  expect(copy?.type === "question" && copy.choices[0].id).not.toBe("material");
});
it("prevents eleven nodes and a second start", () => {
  const graph = createDemoGraph();
  while (graph.nodes.length < 10) graph.nodes.push(newNode("message", `m${graph.nodes.length}`));
  expect(() => duplicateNode(graph, "wybor", "copy")).toThrow();
  expect(() => duplicateNode(createDemoGraph(), "start", "copy")).toThrow();
});
