import type { MiddlewareHandler } from "hono";

export const errorBoundary: MiddlewareHandler = async (_context, next) => {
  await next();
};
