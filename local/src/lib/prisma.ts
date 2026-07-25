import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { getWorkersEnv, type WorkersEnv } from "./workers-env";

const globalForPrisma = globalThis as unknown as {
  localPrisma?: PrismaClient;
};

function createNodePrismaClient(): PrismaClient {
  const connectionString =
    process.env.DATABASE_URL?.trim() ||
    "postgresql://subboost_local_dev:subboost_local_dev_password@localhost:5432/subboost_local_dev?schema=public";
  return new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

function getCloudflareWorkersEnv(): WorkersEnv | null {
  try {
    // Keep the Worker-only helper out of the Docker runtime path.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getCloudflareContext } = require("@opennextjs/cloudflare") as {
      getCloudflareContext: () => { env: WorkersEnv };
    };
    return getCloudflareContext().env;
  } catch {
    return null;
  }
}

function createWorkersPrismaClient(env: WorkersEnv): PrismaClient {
  // Do not load the D1 adapter when creating the Docker PostgreSQL client.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { PrismaD1 } = require("@prisma/adapter-d1") as {
    PrismaD1: new (db: unknown) => unknown;
  };
  return new PrismaClient({
    adapter: new PrismaD1(env.DB) as never,
    log: ["error"],
  });
}

function createPrismaClient(): PrismaClient {
  const workersEnv = getWorkersEnv() ?? getCloudflareWorkersEnv();
  return workersEnv?.DB ? createWorkersPrismaClient(workersEnv) : createNodePrismaClient();
}

function resolveUnderlyingClient(): PrismaClient {
  if (process.env.NODE_ENV !== "production") {
    globalForPrisma.localPrisma ??= createPrismaClient();
    return globalForPrisma.localPrisma;
  }
  if (!cachedClient) cachedClient = createPrismaClient();
  return cachedClient;
}

let cachedClient: PrismaClient | null = null;

export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const client = resolveUnderlyingClient();
    const value = Reflect.get(client, prop as PropertyKey);
    return typeof value === "function" ? (value as (...args: unknown[]) => unknown).bind(client) : value;
  },
});
