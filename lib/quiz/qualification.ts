import { emailSchema, type Criterion, type Qualification, type RuleGroup, type Snapshot } from "./contracts";

function evaluate(c: Criterion, s: Snapshot): { matched: boolean; reason: string } {
  switch (c.kind) {
    case "email": return { matched: emailSchema.safeParse(s.email).success, reason: "email" };
    case "interest": return { matched: s.interest, reason: "interest" };
    case "tag": return { matched: s.tags.includes(c.value), reason: `tag:${c.value}` };
    case "answer": return { matched: Object.hasOwn(s.answers, c.nodeId) && s.answers[c.nodeId] === c.value, reason: `answer:${c.nodeId}` };
    case "field": return { matched: Object.hasOwn(s.fields, c.key) && s.fields[c.key] === c.value, reason: `field:${c.key}` };
    case "completed": return { matched: s.completedNodeIds.includes(c.nodeId), reason: `completed:${c.nodeId}` };
  }
}
export function qualify(rule: RuleGroup, snapshot: Snapshot): Qualification {
  const matches = rule.rules.map(c => evaluate(c, snapshot));
  return { qualified: matches.length > 0 && (rule.mode === "all" ? matches.every(m => m.matched) : matches.some(m => m.matched)), reasons: matches.filter(m => m.matched).map(m => m.reason) };
}
