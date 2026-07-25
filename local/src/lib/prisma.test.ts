import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  PrismaClient: vi.fn(),
  PrismaPg: vi.fn(),
}));

async function loadPrismaModule(env: { DATABASE_URL?: string; NODE_ENV?: string }, existing?: unknown) {
  vi.resetModules();
  vi.doMock("@prisma/adapter-pg", () => ({ PrismaPg: mocks.PrismaPg }));
  vi.doMock("@prisma/client", () => ({ PrismaClient: mocks.PrismaClient }));

  vi.stubEnv("DATABASE_URL", env.DATABASE_URL);
  vi.stubEnv("NODE_ENV", env.NODE_ENV);
  if (existing === undefined) {
    delete (globalThis as { localPrisma?: unknown }).localPrisma;
  } else {
    (globalThis as { localPrisma?: unknown }).localPrisma = existing;
  }

  return import("./prisma");
}

function triggerLazyInit(prisma: unknown) {
  void (prisma as Record<PropertyKey, unknown>).__prisma_lazy_probe;
}

describe("local prisma singleton", () => {
  const originalDatabaseUrl = process.env.DATABASE_URL;
  const originalNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.PrismaPg.mockImplementation(function PrismaPg(this: { adapterOptions: unknown }, options: unknown) {
      this.adapterOptions = options;
    });
    mocks.PrismaClient.mockImplementation(function PrismaClient(this: { clientOptions: unknown }, options: unknown) {
      this.clientOptions = options;
    });
  });

  afterEach(() => {
    vi.stubEnv("DATABASE_URL", originalDatabaseUrl);
    vi.stubEnv("NODE_ENV", originalNodeEnv);
    vi.unstubAllEnvs();
    delete (globalThis as { localPrisma?: unknown }).localPrisma;
    vi.doUnmock("@prisma/adapter-pg");
    vi.doUnmock("@prisma/client");
  });

  it("creates a development client with a trimmed configured database URL", async () => {
    const mod = await loadPrismaModule({
      DATABASE_URL: " postgresql://local.example/db ",
      NODE_ENV: "development",
    });
    triggerLazyInit(mod.prisma);

    expect(mocks.PrismaPg).toHaveBeenCalledWith({ connectionString: "postgresql://local.example/db" });
    expect(mocks.PrismaClient).toHaveBeenCalledWith({
      adapter: expect.objectContaining({ adapterOptions: { connectionString: "postgresql://local.example/db" } }),
      log: ["warn", "error"],
    });
    expect((globalThis as { localPrisma?: unknown }).localPrisma).toBeDefined();
  });

  it("reuses an existing global client in non-production mode", async () => {
    const existing = { reused: true, __prisma_lazy_probe: undefined };
    const mod = await loadPrismaModule({ DATABASE_URL: "postgresql://ignored/db", NODE_ENV: "test" }, existing);
    triggerLazyInit(mod.prisma);

    expect((globalThis as { localPrisma?: unknown }).localPrisma).toBe(existing);
    expect(mocks.PrismaClient).not.toHaveBeenCalled();
  });

  it("uses the default URL and avoids global caching in production", async () => {
    const mod = await loadPrismaModule({ DATABASE_URL: "   ", NODE_ENV: "production" });
    triggerLazyInit(mod.prisma);

    expect(mocks.PrismaPg).toHaveBeenCalledWith({
      connectionString: "postgresql://subboost_local_dev:subboost_local_dev_password@localhost:5432/subboost_local_dev?schema=public",
    });
    expect(mocks.PrismaClient).toHaveBeenCalledWith({
      adapter: expect.objectContaining({
        adapterOptions: {
          connectionString: "postgresql://subboost_local_dev:subboost_local_dev_password@localhost:5432/subboost_local_dev?schema=public",
        },
      }),
      log: ["error"],
    });
    expect((globalThis as { localPrisma?: unknown }).localPrisma).toBeUndefined();
  });
});
