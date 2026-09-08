import type { GraphIssue } from "./contracts";
export class QuizError extends Error {
  constructor(public code: string, public status: 400 | 404 | 409 = 400, public issues?: GraphIssue[]) { super(code); }
}
