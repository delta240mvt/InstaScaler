import type { MiddlewareHandler } from "hono";
import { ZodError } from "zod";
import { QuizError } from "@/lib/quiz/errors";
import type { GraphIssue } from "@/lib/quiz/contracts";

export function errorPayload(error: unknown, requestId: string): { error: string; requestId: string; details?: unknown; issues?: GraphIssue[] } {
  if (error instanceof QuizError) return { error: error.code, requestId, issues: error.issues };
  if (error instanceof ZodError) return { error: "invalid_input", requestId, details: error.flatten() };
  if (error instanceof SyntaxError) return { error: "invalid_input", requestId };
  return { error: "internal_error", requestId };
}

export function errorStatus(error: unknown): 400 | 404 | 409 | 500 { return error instanceof QuizError ? error.status : error instanceof ZodError || error instanceof SyntaxError ? 400 : 500; }

export const errorBoundary: MiddlewareHandler = async (_context, next) => {
  await next();
};
