import { graphSchema, type GraphIssue, type QuizGraph, type QuizNode, type RuleGroup } from "./contracts";

export function targets(n: QuizNode): string[] {
  if (n.type === "end") return [];
  if (n.type === "condition") return [n.yes, n.no];
  if (n.type === "question" && n.input === "choice") return [...n.choices.map(c => c.next), ...(!n.required ? [n.next] : [])];
  return [n.next];
}
export function validateGraph(graph: QuizGraph): GraphIssue[] {
  const issues: GraphIssue[] = [];
  const add = (code: string, message: string, nodeId?: string) => issues.push({ code, message, ...(nodeId ? { nodeId } : {}) });
  if (!graphSchema.safeParse(graph).success) { add("INVALID_STRUCTURE", "Sprawdź limity treści, przycisków i 10 kroków."); return issues; }
  const nodes = new Map(graph.nodes.map(n => [n.id, n]));
  if (nodes.size !== graph.nodes.length) add("DUPLICATE_ID", "Identyfikatory kroków muszą być unikalne.");
  const starts = graph.nodes.filter(n => n.type === "start");
  if (starts.length !== 1) add("START_COUNT", "Ścieżka musi mieć dokładnie jeden Start.");
  const fields = new Set(graph.nodes.flatMap(n => n.type === "question" ? [n.field] : n.type === "action" ? Object.keys(n.setFields) : []));
  const checkRules = (group: RuleGroup, nodeId?: string) => {
    if (!group.rules.length) add("EMPTY_RULES", "Dodaj co najmniej jeden warunek.", nodeId);
    for (const rule of group.rules) {
      if ((rule.kind === "answer" || rule.kind === "completed") && (!nodes.has(rule.nodeId) || (rule.kind === "answer" && nodes.get(rule.nodeId)?.type !== "question"))) add("INVALID_RULE_STEP", "Warunek odwołuje się do nieprawidłowego kroku.", nodeId);
      if (rule.kind === "field" && !fields.has(rule.key)) add("INVALID_RULE_FIELD", "Warunek odwołuje się do niezdefiniowanego pola.", nodeId);
    }
  };
  checkRules(graph.qualification);
  for (const n of graph.nodes) {
    for (const t of targets(n)) if (!t || !nodes.has(t)) add("MISSING_TARGET", "Wybierz następny krok.", n.id);
    if (n.type === "start" && (!n.keyword.trim() || !n.text.trim() || !n.cta.trim() || (n.trigger !== "dm" && !n.allPosts && !n.postIds.length))) add("INCOMPLETE_START", n.trigger === "dm" ? "Uzupełnij hasło w DM, wiadomość i przycisk Startu." : "Uzupełnij hasło, posty, wiadomość i przycisk Startu.", n.id);
    if (n.type === "start" && n.trigger === "dm" && n.keyword.trim().toUpperCase() === "STOP") add("RESERVED_KEYWORD", "STOP służy do zakończenia rozmowy. Wybierz inne hasło.", n.id);
    if ((n.type === "message" || n.type === "question") && !n.text.trim()) add("EMPTY_TEXT", "Uzupełnij wiadomość.", n.id);
    if (n.type === "question") {
      if (!n.field || (n.input === "choice" && (!n.choices.length || n.choices.some(c => !c.label.trim()) || new Set(n.choices.map(c => c.id)).size !== n.choices.length))) add("INVALID_QUESTION", "Uzupełnij pole i unikalne odpowiedzi.", n.id);
    }
    if (n.type === "condition") checkRules(n.when, n.id);
  }
  // Iterative traversal also checks unreachable cycles, without treating shared descendants as cycles.
  const visited = new Set<string>();
  for (const root of graph.nodes) {
    const stack = [{ id: root.id, ancestors: new Set<string>() }];
    while (stack.length) {
      const { id, ancestors } = stack.pop()!;
      if (ancestors.has(id)) { add("CYCLE", "Połączenie tworzy pętlę.", id); break; }
      const n = nodes.get(id);
      if (!n) continue;
      if (root.id === starts[0]?.id) visited.add(id);
      const path = new Set([...ancestors, id]);
      for (const t of targets(n)) stack.push({ id: t, ancestors: path });
    }
  }
  for (const n of graph.nodes) if (!visited.has(n.id)) add("UNREACHABLE", "Ten krok nie jest połączony ze Startem.", n.id);
  return issues;
}
