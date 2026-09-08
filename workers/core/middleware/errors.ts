import type { MiddlewareHandler } from "hono";
import { ZodError } from "zod";

export function errorPayload(error: unknown, requestId: string): { error: string; requestId: string; details?: unknown } {
  if (error instanceof ZodError) return { error: "invalid_input", requestId, details: error.flatten() };
  if (error instanceof SyntaxError) return { error: "invalid_input", requestId };
  return { error: "internal_error", requestId };
}

export function errorStatus(error: unknown): 400 | 500 { return error instanceof ZodError || error instanceof SyntaxError ? 400 : 500; }

export const errorBoundary: MiddlewareHandler = async (_context, next) => {
  await next();
};
