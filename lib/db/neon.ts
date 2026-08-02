import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "@/app/generated/prisma/client";

/**
 * Creates a Prisma client for the current Worker request or queue batch.
 * Workers must not retain a database client in module/global scope.
 */
export function createPrisma(connectionString: string): PrismaClient {
  const adapter = new PrismaNeon({ connectionString });
  return new PrismaClient({ adapter });
}
