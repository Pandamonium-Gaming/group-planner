import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const globalForPrisma = globalThis as typeof globalThis & { groupPlannerPrisma?: PrismaClient };

export function getPrisma() {
  if (globalForPrisma.groupPlannerPrisma) return globalForPrisma.groupPlannerPrisma;
  const connectionString = process.env.APP_DATABASE_URL;
  if (!connectionString) throw new Error('APP_DATABASE_URL is required for standalone data access');
  const client = new PrismaClient({
    adapter: new PrismaPg({ connectionString, max: 5, connectionTimeoutMillis: 15000 }),
  });
  globalForPrisma.groupPlannerPrisma = client;
  return client;
}
