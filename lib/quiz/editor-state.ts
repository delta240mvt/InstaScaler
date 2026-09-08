import { MAX_QUIZ_NODES, type QuizGraph, type QuizNode } from "./contracts";

export const nodeLabels: Record<QuizNode["type"], string> = { start: "Start", message: "Wiadomość", question: "Pytanie", condition: "Warunek", action: "Akcja", end: "Koniec" };
export function newNode(type: QuizNode["type"], id: string): QuizNode {
  const b = { id, label: nodeLabels[type], x: 40, y: 40 };
  switch (type) {
    case "start": return { ...b, type, keyword: "START", allPosts: false, postIds: [], text: "Kliknij, aby rozpocząć quiz.", cta: "Zaczynamy", next: "" };
    case "message": return { ...b, type, text: "", next: "" };
    case "question": return { ...b, type, text: "", input: "text", field: id, required: true, choices: [], next: "" };
    case "condition": return { ...b, type, when: { mode: "any", rules: [{ kind: "email" }] }, yes: "", no: "" };
    case "action": return { ...b, type, addTags: [], removeTags: [], setFields: {}, next: "" };
    case "end": return { ...b, type, outcome: "completed" };
  }
}
export function connectNodes(graph: QuizGraph, sourceId: string, port: string, targetId: string): QuizGraph {
  return { ...graph, nodes: graph.nodes.map(n => {
    if (n.id !== sourceId) return n;
    if (n.type === "question" && port.startsWith("choice:")) return { ...n, choices: n.choices.map(c => c.id === port.slice(7) ? { ...c, next: targetId } : c) };
    if (n.type === "condition" && (port === "yes" || port === "no")) return { ...n, [port]: targetId };
    if ("next" in n && port === "next") return { ...n, next: targetId };
    return n;
  }) };
}
export function deleteNode(graph: QuizGraph, id: string): QuizGraph {
  if (graph.nodes.find(n => n.id === id)?.type === "start") throw new Error("Nie można usunąć Startu.");
  return { ...graph, nodes: graph.nodes.filter(n => n.id !== id).map(n => {
    if (n.type === "end") return n;
    if (n.type === "condition") return { ...n, yes: n.yes === id ? "" : n.yes, no: n.no === id ? "" : n.no };
    return { ...n, next: n.next === id ? "" : n.next, ...(n.type === "question" ? { choices: n.choices.map(c => ({ ...c, next: c.next === id ? "" : c.next })) } : {}) };
  }) };
}
export function duplicateNode(graph: QuizGraph, id: string, newId: string): QuizGraph {
  const node = graph.nodes.find(n => n.id === id);
  if (!node || node.type === "start" || graph.nodes.length >= MAX_QUIZ_NODES) throw new Error("Nie można zduplikować kroku.");
  const copy = { ...structuredClone(node), id: newId, label: `${node.label} (kopia)`.slice(0, 100), x: Math.min(5000, node.x + 280), y: node.y };
  if (copy.type === "question") copy.choices = copy.choices.map((c, i) => ({ ...c, id: `${newId}-a${i}` }));
  return { ...graph, nodes: [...graph.nodes, copy] };
}
