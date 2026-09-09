import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { NodeForm } from "@/components/quiz/node-form";
import { QuizPreview } from "@/components/quiz/preview";
import { createDemoGraph } from "@/lib/quiz/demo";

it.each(["comment", "dm"] as const)("renders the %s trigger controls and matching preview without a browser", trigger => {
  const graph = createDemoGraph(trigger);
  const form = renderToStaticMarkup(createElement(NodeForm, { node: graph.nodes[0], graph, onChange: () => undefined }));
  expect(form).toContain('type="radio"');
  expect(form).toContain(trigger === "dm" ? "Hasło w DM" : "Hasło w komentarzu");
  if (trigger === "dm") expect(form).not.toContain("Wszystkie posty tego konta");
  else expect(form).toContain("Wszystkie posty tego konta");
  const preview = renderToStaticMarkup(createElement(QuizPreview, { graph }));
  expect(preview).toContain(trigger === "dm" ? "Słowo w DM" : "Komentarz pod postem");
  expect(preview).toContain("START");
});
