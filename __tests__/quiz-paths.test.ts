import { expect, it } from "vitest";
import { triggersOverlap } from "@/lib/quiz/trigger-conflicts";
import { createDemoGraph } from "@/lib/quiz/demo";
import { validateGraph } from "@/lib/quiz/graph";

it("blocks overlapping posts/keywords in both directions conservatively", () => {
  const start = { allPosts: false, postIds: ["123"], keyword: "START" };
  expect(triggersOverlap(start, { allPosts: false, postIds: ["123"], keywords: ["start"], matchAnyWord: false })).toBe(true);
  expect(triggersOverlap(start, { allPosts: false, postIds: ["456"], keywords: ["start"], matchAnyWord: false })).toBe(false);
  expect(triggersOverlap(start, { allPosts: true, postIds: [], keywords: [], matchAnyWord: true })).toBe(true);
});
it("allows incomplete drafts but reports precise publication problems", () => {
  const graph = createDemoGraph();
  const node = graph.nodes[0];
  if (node.type !== "start") throw new Error("start");
  node.next = "";
  expect(validateGraph(graph)).toContainEqual({ code: "MISSING_TARGET", message: "Wybierz następny krok.", nodeId: "start" });
});
