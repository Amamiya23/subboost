import { beforeEach, describe, expect, it, vi } from "vitest";
import { refreshNodeSnapshot } from "@subboost/server-core/subscription";
import { dbQuery, dbBatch } from "@local/lib/db";
import { runLocalSubscriptionAutoUpdateCron } from "@local/lib/auto-update-service";

vi.mock("@local/lib/crypto", () => ({
  decryptJson: vi.fn((ciphertext: string | null | undefined, fallback: unknown) =>
    ciphertext ? JSON.parse(ciphertext.replace(/^json:/, "")) : fallback
  ),
  decryptJsonObject: vi.fn((ciphertext: string | null | undefined) =>
    ciphertext ? JSON.parse(ciphertext.replace(/^json:/, "")) : {}
  ),
  encryptJson: vi.fn((value: unknown) => `encrypted:${JSON.stringify(value)}`),
}));

vi.mock("@local/lib/db", () => ({
  dbQuery: vi.fn(),
  dbExecute: vi.fn(),
  dbBatch: vi.fn(),
  dbQueryOne: vi.fn(),
  generateId: vi.fn(() => "test-id"),
  stmt: (sql: string, ...binds: unknown[]) => ({ sql, binds }),
}));

vi.mock("@subboost/server-core/subscription", async (importActual) => {
  const actual = await importActual<typeof import("@subboost/server-core/subscription")>();
  return {
    ...actual,
    refreshNodeSnapshot: vi.fn(),
  };
});

const node = {
  name: "node-a",
  type: "trojan",
  server: "example.com",
  port: 443,
  password: "secret",
};

function scheduleRawRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "sub-1",
    autoUpdateInterval: 3600,
    createdAt: "2026-06-01T00:00:00.000Z",
    lastUpdatedAt: null,
    state_lastAttemptedAt: null,
    ...overrides,
  };
}

function fullRawRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "sub-1",
    ownerId: "admin-1",
    name: "Main",
    token: "token-1",
    isPrimary: 0,
    encryptedUrls: 'json:["https://example.com/sub.yaml"]',
    encryptedNodes: "json:[]",
    encryptedConfig: 'json:{"sources":[{"id":"src-1","type":"url","content":"https://example.com/sub.yaml"}]}',
    encryptedSubscriptionInfo: "json:{}",
    autoUpdateInterval: 3600,
    cacheExpiresAt: null,
    lastAccessedAt: null,
    lastUpdatedAt: null,
    createdAt: "2026-06-01T00:00:00.000Z",
    updatedAt: "2026-06-01T00:00:00.000Z",
    state_externalFailureCount: null,
    state_failureSourceState: null,
    state_lastFailedAt: null,
    state_lastAttemptedAt: null,
    state_disabledAt: null,
    state_disabledReason: null,
    state_disabledPreviousInterval: null,
    owner_username: "root",
    ...overrides,
  };
}

beforeEach(() => {
  vi.mocked(dbQuery).mockReset();
  vi.mocked(dbBatch).mockReset();
  vi.mocked(refreshNodeSnapshot).mockReset();
});

describe("local subscription auto-update service", () => {
  it("skips subscriptions that are not due yet", async () => {
    vi.mocked(dbQuery).mockResolvedValueOnce([
      scheduleRawRow({
        createdAt: "2026-06-02T00:00:00.000Z",
        lastUpdatedAt: "2026-06-02T00:00:00.000Z",
      }),
    ] as never);

    const summary = await runLocalSubscriptionAutoUpdateCron(new Date("2026-06-02T00:30:00.000Z"));
    expect(summary.results).toMatchObject({ total: 1, updated: 0, skipped: 1, failed: 0 });
    expect(refreshNodeSnapshot).not.toHaveBeenCalled();
    expect(dbBatch).not.toHaveBeenCalled();
  });

  it("refreshes due subscriptions and persists the refreshed cache", async () => {
    vi.mocked(dbQuery)
      .mockResolvedValueOnce([scheduleRawRow()] as never)
      .mockResolvedValueOnce([fullRawRow()] as never);
    vi.mocked(refreshNodeSnapshot).mockResolvedValue({
      nodes: [node],
      subscriptionInfo: { upload: 0, download: 0, total: 1024 },
      savedSources: [{ id: "src-1", type: "url", content: "https://example.com/sub.yaml" }],
      attemptedUrlFetch: true,
      usedUrlFetch: true,
      refreshableSourceCount: 1,
      refreshedSourceCount: 1,
      refreshedUrlSourceCount: 1,
      refreshedStaticSourceCount: 0,
      detachedSourceCount: 0,
      failedSourceCount: 0,
      failedSources: [],
    } as never);

    const summary = await runLocalSubscriptionAutoUpdateCron(new Date("2026-06-02T02:00:00.000Z"));
    expect(summary.results).toMatchObject({ total: 1, updated: 1, skipped: 0, failed: 0 });
    expect(refreshNodeSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({
        urls: ["https://example.com/sub.yaml"],
        storedNodes: [],
      })
    );
    expect(dbBatch).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          sql: expect.stringContaining("UPDATE Subscription"),
          binds: expect.arrayContaining([
            expect.stringContaining("node-a"),
            expect.stringContaining("src-1"),
          ]),
        }),
        expect.objectContaining({
          sql: expect.stringContaining("INSERT INTO SubscriptionAutoUpdateState"),
        }),
      ])
    );
  });
});
