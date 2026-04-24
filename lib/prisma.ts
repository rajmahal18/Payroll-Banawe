import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
const createPrismaClient = () =>
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"]
  });

export const prisma = process.env.NODE_ENV === "development" ? createPrismaClient() : globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV === "production") {
  globalForPrisma.prisma = prisma;
}
