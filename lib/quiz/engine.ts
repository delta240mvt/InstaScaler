import { emailSchema, MAX_QUIZ_NODES, profileFields, profileTags, type QuizGraph, type QuizInput, type QuizMessage, type Snapshot, type Transition } from "./contracts";
import { validateGraph } from "./graph";
import { qualify } from "./qualification";

export function initialSnapshot(graph: QuizGraph, profile: Partial<Pick<Snapshot, "email" | "fields" | "tags">> = {}): Snapshot {
  const start = graph.nodes.find(n => n.type === "start");
  if (!start || start.type !== "start") throw new Error("quiz_invalid_graph");
  return { nodeId: start.next, phase: "ready", answers: {}, fields: { ...profile.fields }, tags: [...(profile.tags ?? [])], email: profile.email ?? null, interest: false, completedNodeIds: [start.id] };
}
export function advanceNode(graph: QuizGraph, current: Snapshot, input?: QuizInput): Transition {
  const s = structuredClone(current);
  if (input?.kind === "stop") return { after: { ...s, phase: "stopped" } };
  if (!["ready", "waiting"].includes(s.phase)) return { after: s, ...(input ? { error: "UNEXPECTED_INPUT" as const } : {}) };
  const n = graph.nodes.find(n => n.id === s.nodeId);
  if (!n) throw new Error("quiz_invalid_graph");
  const complete = (next?: string) => {
    s.completedNodeIds = [...new Set([...s.completedNodeIds, n.id])];
    if (next !== undefined) { s.nodeId = next; s.phase = "ready"; }
  };
  if (input && (n.type !== "question" || s.phase !== "waiting")) return { after: s, error: "UNEXPECTED_INPUT" };
  if (n.type === "question") {
    if (s.phase === "ready") {
      s.phase = "waiting";
      return { after: s, outbound: { text: n.text, buttons: [...(n.input === "choice" ? n.choices.map(c => ({ kind: "answer" as const, id: c.id, label: c.label })) : []), ...(!n.required ? [{ kind: "skip" as const, label: "Pomiń" }] : [])] } };
    }
    if (!input) return { after: s };
    if (input.kind === "skip") {
      if (n.required) return { after: s, error: "ANSWER_REQUIRED" };
      complete(n.next); return { after: s };
    }
    let answer = input.value.trim();
    let next = n.next;
    if (n.input === "choice") {
      const choice = n.choices.find(c => c.id === input.choiceId);
      if (!choice) return { after: s, error: "INVALID_CHOICE" };
      answer = choice.value; next = choice.next;
    } else if (!answer || answer.length > 1000) return { after: s, error: "ANSWER_REQUIRED" };
    if (n.input === "email" && !emailSchema.safeParse(answer).success) return { after: s, error: "INVALID_EMAIL" };
    s.answers[n.id] = answer;
    if (n.field) s.fields[n.field] = answer;
    if (n.input === "email") s.email = answer;
    profileFields.parse(s.fields);
    complete(next); return { after: s };
  }
  if (n.type === "message") { complete(n.next); return { after: s, outbound: { text: n.text, buttons: [], ...(n.material ? { material: n.material } : {}) } }; }
  if (n.type === "action") {
    s.tags = profileTags.parse([...new Set([...s.tags.filter(t => !n.removeTags.includes(t)), ...n.addTags])]);
    s.fields = profileFields.parse({ ...s.fields, ...n.setFields });
    if (n.interest !== undefined) s.interest = n.interest;
    complete(n.next);
  } else if (n.type === "condition") complete(qualify(n.when, s).qualified ? n.yes : n.no);
  else if (n.type === "end") { complete(); s.phase = n.outcome; }
  else throw new Error("quiz_unexpected_start");
  return { after: s };
}
export function simulateQuiz(graph: QuizGraph, inputs: QuizInput[]) {
  if (validateGraph(graph).length) throw new Error("quiz_invalid_graph");
  let snapshot = initialSnapshot(graph);
  const messages: QuizMessage[] = [];
  let cursor = 0;
  // Each of ten nodes can emit a prompt and consume one input; invalid inputs stop the preview.
  for (let i = 0; i < MAX_QUIZ_NODES * 2 + inputs.length; i++) {
    if (!["ready", "waiting"].includes(snapshot.phase)) break;
    if (snapshot.phase === "waiting" && cursor >= inputs.length) break;
    const result = advanceNode(graph, snapshot, snapshot.phase === "waiting" ? inputs[cursor++] : undefined);
    snapshot = result.after;
    if (result.outbound) messages.push(result.outbound);
    if (result.error) messages.push({ text: result.error === "INVALID_EMAIL" ? "Wpisz poprawny adres e-mail lub wybierz Pomiń, jeśli jest dostępne." : "Wybierz jedną z dostępnych odpowiedzi.", buttons: [] });
  }
  return { snapshot, messages, qualification: qualify(graph.qualification, snapshot) };
}
