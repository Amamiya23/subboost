import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildSubscriptionCacheExpiry,
  buildSubscriptionFetchCallbacks,
  createSubscription,
  deleteSubscription,
  formatSubscription,
  formatSubscriptionDetail,
  generateSubscriptionYaml,
  getSubscription,
  listSubscriptions,
  refreshSubscription,
  updateSubscription,
  type SubscriptionRow,
} from "./subscription-service";

const mocks = vi.hoisted(() => ({
  generateClashYaml: vi.fn(),
  buildGenerateOptionsFromConfig: vi.fn(),
  getEffectiveTestOptions: vi.fn(),
  buildProxyProvidersFromConfig: vi.fn(),
  prepareRefreshCacheResult: vi.fn(),
  refreshNodeSnapshot: vi.fn(),
  buildManualRefreshFailureResponse: vi.fn(),
  buildManualRefreshSuccessResponseBody: vi.fn(),
  importSourceUrlDirect: vi.fn(),
  fetchSourceUserInfoHeadersDirect: vi.fn(),
  getAppUrl: vi.fn(),
  dbQuery: vi.fn(),
  dbExecute: vi.fn(),
  dbBatch: vi.fn(),
  generateId: vi.fn(() => "test-id"),
}));

vi.mock("@subboost/core/generator", () => ({
  generateClashYaml: mocks.generateClashYaml,
}));

vi.mock("@subboost/core/subscription/config-utils", () => ({
  buildGenerateOptionsFromConfig: mocks.buildGenerateOptionsFromConfig,
  getEffectiveTestOptions: mocks.getEffectiveTestOptions,
}));

vi.mock("@subboost/core/subscription/proxy-providers", () => ({
  buildProxyProvidersFromConfig: mocks.buildProxyProvidersFromConfig,
}));

vi.mock("@subboost/server-core/subscription", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@subboost/server-core/subscription")>();
  return {
    ...actual,
    buildManualRefreshFailureResponse: mocks.buildManualRefreshFailureResponse,
    buildManualRefreshSuccessResponseBody: mocks.buildManualRefreshSuccessResponseBody,
    prepareRefreshCacheResult: mocks.prepareRefreshCacheResult,
    refreshNodeSnapshot: mocks.refreshNodeSnapshot,
  };
});

vi.mock("./crypto", () => ({
  encryptJson: async (value: unknown) => JSON.stringify(value),
  decryptJson: async (value: string | null | undefined, fallback: unknown) => {
    if (!value) return fallback;
    try {
      return JSON.parse(value);
    } catch {
      return fallback;
    }
  },
  decryptJsonObject: async (value: string | null | undefined) => {
    if (!value) return {};
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
    } catch {
      return {};
    }
  },
}));

vi.mock("./env", () => ({
  getAppUrl: mocks.getAppUrl,
}));

vi.mock("./db", () => ({
  dbQuery: mocks.dbQuery,
  dbExecute: mocks.dbExecute,
  dbBatch: mocks.dbBatch,
  generateId: mocks.generateId,
  stmt: (sql: string, ...binds: unknown[]) => ({ sql, binds }),
}));

vi.mock("./source-import", () => ({
  importSourceUrlDirect: mocks.importSourceUrlDirect,
  fetchSourceUserInfoHeadersDirect: mocks.fetchSourceUserInfoHeadersDirect,
}));

function node(name = "Node") {
  return {
    name,
    type: "ss",
    server: "node.example.com",
    port: 443,
    cipher: "aes-128-gcm",
    password: "secret",
  };
}

function row(overrides: Partial<SubscriptionRow> = {}): SubscriptionRow {
  return {
    id: "sub-1",
    ownerId: "owner-1",
    name: "Saved",
    token: "token-1",
    isPrimary: true,
    encryptedUrls: JSON.stringify(["https://example.com/sub"]),
    encryptedNodes: JSON.stringify([node()]),
    encryptedConfig: JSON.stringify({
      sources: [{ id: "source-1", type: "url", content: "https://example.com/sub" }],
      smartNodeMatchingEnabled: false,
      testUrl: "https://test.example.com",
      testInterval: 600,
    }),
    encryptedSubscriptionInfo: JSON.stringify({ upload: 2048, total: 4096 }),
    autoUpdateInterval: 86400,
    cacheExpiresAt: new Date("2026-06-01T01:00:00.000Z"),
    lastAccessedAt: new Date("2026-06-01T02:00:00.000Z"),
    lastUpdatedAt: new Date("2026-06-01T03:00:00.000Z"),
    createdAt: new Date("2026-06-01T00:00:00.000Z"),
    updatedAt: new Date("2026-06-01T04:00:00.000Z"),
    autoUpdateState: {
      externalFailureCount: 2,
      failureSourceState: null,
      lastFailedAt: new Date("2026-06-01T05:00:00.000Z"),
      lastAttemptedAt: new Date("2026-06-01T06:00:00.000Z"),
      disabledAt: null,
      disabledReason: null,
      disabledPreviousInterval: null,
    },
    ...overrides,
  };
}

function rawRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "sub-1",
    ownerId: "owner-1",
    name: "Saved",
    token: "token-1",
    isPrimary: 1,
    encryptedUrls: JSON.stringify(["https://example.com/sub"]),
    encryptedNodes: JSON.stringify([node()]),
    encryptedConfig: JSON.stringify({
      sources: [{ id: "source-1", type: "url", content: "https://example.com/sub" }],
      smartNodeMatchingEnabled: false,
      testUrl: "https://test.example.com",
      testInterval: 600,
    }),
    encryptedSubscriptionInfo: JSON.stringify({ upload: 2048, total: 4096 }),
    autoUpdateInterval: 86400,
    cacheExpiresAt: "2026-06-01T01:00:00.000Z",
    lastAccessedAt: "2026-06-01T02:00:00.000Z",
    lastUpdatedAt: "2026-06-01T03:00:00.000Z",
    createdAt: "2026-06-01T00:00:00.000Z",
    updatedAt: "2026-06-01T04:00:00.000Z",
    state_externalFailureCount: 2,
    state_failureSourceState: null,
    state_lastFailedAt: "2026-06-01T05:00:00.000Z",
    state_lastAttemptedAt: "2026-06-01T06:00:00.000Z",
    state_disabledAt: null,
    state_disabledReason: null,
    state_disabledPreviousInterval: null,
    ...overrides,
  };
}

describe("local subscription service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAppUrl.mockReturnValue("http://127.0.0.1:3001");
    mocks.prepareRefreshCacheResult.mockReturnValue({ ok: true, nodeCount: 1 });
    mocks.refreshNodeSnapshot.mockResolvedValue({
      nodes: [node("Fresh")],
      savedSources: [{ id: "source-1", type: "url", content: "https://example.com/sub" }],
      subscriptionInfo: { upload: 1, total: 2048 },
    });
    mocks.buildManualRefreshFailureResponse.mockReturnValue({ error: "refresh failed" });
    mocks.buildManualRefreshSuccessResponseBody.mockReturnValue({ ok: true, nodeCount: 1 });
    mocks.getEffectiveTestOptions.mockReturnValue({ testUrl: "https://test.example.com", testInterval: 600 });
    mocks.buildProxyProvidersFromConfig.mockReturnValue(null);
    mocks.buildGenerateOptionsFromConfig.mockReturnValue({ nodes: [node()] });
    mocks.generateClashYaml.mockReturnValue("mixed-port: 7890\n");
    mocks.dbQuery.mockResolvedValue([rawRow()]);
    mocks.dbExecute.mockResolvedValue(1);
    mocks.dbBatch.mockResolvedValue(undefined);
    mocks.importSourceUrlDirect.mockResolvedValue({
      ok: true,
      parsedNodes: [node("Imported")],
      parseErrors: [],
      headers: { "subscription-userinfo": "upload=1; total=2048" },
    });
    mocks.fetchSourceUserInfoHeadersDirect.mockResolvedValue({ "subscription-userinfo": "upload=1; total=2048" });
  });

  it("formats subscription summaries and details from encrypted fields", async () => {
    const summary = await formatSubscription(row());
    expect(summary).toMatchObject({
      id: "sub-1",
      name: "Saved",
      subscriptionUrl: "http://127.0.0.1:3001/api/subscriptions/token-1/config.yaml",
      nodeCount: 1,
      sourceCount: 1,
      isPrimary: true,
      autoUpdateInterval: 86400,
      smartNodeMatchingEnabled: false,
      cacheExpiresAt: "2026-06-01T01:00:00.000Z",
      autoUpdateState: {
        externalFailureCount: 2,
        lastFailedAt: "2026-06-01T05:00:00.000Z",
        lastAttemptedAt: "2026-06-01T06:00:00.000Z",
      },
    });

    expect(await formatSubscriptionDetail(row())).toMatchObject({
      urls: ["https://example.com/sub"],
      nodes: [expect.objectContaining({ name: "Node" })],
      config: expect.objectContaining({ smartNodeMatchingEnabled: false }),
      subscriptionInfo: { upload: 2048, total: 4096 },
    });

    expect(
      await formatSubscription(
        row({
          encryptedUrls: "not json",
          encryptedNodes: "not json",
          encryptedConfig: JSON.stringify([]),
          encryptedSubscriptionInfo: null,
          cacheExpiresAt: null,
          lastAccessedAt: null,
          lastUpdatedAt: null,
          autoUpdateInterval: null,
          autoUpdateState: null,
        })
      )
    ).toMatchObject({
      nodeCount: 0,
      sourceCount: 0,
      smartNodeMatchingEnabled: true,
      cacheExpiresAt: null,
      lastAccessedAt: null,
      lastUpdatedAt: null,
      autoUpdateInterval: null,
      autoUpdateState: {
        externalFailureCount: 0,
        lastFailedAt: null,
        lastAttemptedAt: null,
        disabledAt: null,
        disabledReason: null,
        disabledPreviousInterval: null,
      },
    });
  });

  it("lists, gets, and deletes subscriptions through db", async () => {
    await expect(listSubscriptions("owner-1")).resolves.toHaveLength(1);
    expect(mocks.dbQuery).toHaveBeenCalledWith(
      expect.stringContaining("FROM Subscription s"),
      "owner-1",
    );

    await expect(getSubscription("owner-1", "sub-1")).resolves.toMatchObject({
      id: "sub-1",
      urls: ["https://example.com/sub"],
    });

    mocks.dbQuery.mockResolvedValueOnce([]);
    await expect(getSubscription("owner-1", "missing")).resolves.toBeNull();

    await expect(deleteSubscription("owner-1", "sub-1")).resolves.toBe(true);
    expect(mocks.dbExecute).toHaveBeenCalledWith(
      "DELETE FROM Subscription WHERE id = ? AND ownerId = ?",
      "sub-1",
      "owner-1",
    );

    mocks.dbExecute.mockResolvedValueOnce(0);
    await expect(deleteSubscription("owner-1", "missing")).resolves.toBe(false);
  });

  it("creates subscriptions with normalized inputs and rejects invalid bodies", async () => {
    await expect(createSubscription("owner-1", null)).rejects.toThrow("Invalid request body.");
    await expect(createSubscription("owner-1", { name: "  " })).rejects.toThrow("Subscription name is required.");
    await expect(createSubscription("owner-1", { name: "A", urls: [] })).rejects.toThrow(
      "At least one URL or node is required."
    );

    mocks.dbQuery.mockResolvedValueOnce([rawRow({ name: "Created" })]);
    await expect(
      createSubscription("owner-1", {
        name: " Created ",
        urls: [" https://example.com/sub ", ""],
        nodes: [node()],
        autoUpdateInterval: "3600",
        subscriptionInfo: { upload: 2048, total: 4096 },
        config: {
          sources: [{ type: "url", content: "https://example.com/sub" }],
        },
        smartNodeMatchingEnabled: false,
      })
    ).resolves.toMatchObject({ name: "Created" });

    expect(mocks.dbExecute).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO Subscription"),
      expect.any(String), // id
      "owner-1",
      "Created",
      expect.any(String), // token
      0, // isPrimary
      JSON.stringify(["https://example.com/sub"]),
      expect.stringContaining('"name":"Node"'),
      expect.stringContaining('"smartNodeMatchingEnabled":false'),
      expect.stringContaining('"total":4096'),
      3600,
      expect.any(String), // createdAt
      expect.any(String), // updatedAt
    );

    mocks.dbQuery.mockResolvedValueOnce([rawRow({ name: "Nodes only" })]);
    await createSubscription("owner-1", {
      name: "Nodes only",
      nodes: [node("Only")],
      autoUpdateInterval: -1,
      config: "ignored",
      subscriptionInfo: "ignored",
    });
    expect(mocks.dbExecute).toHaveBeenLastCalledWith(
      expect.stringContaining("INSERT INTO Subscription"),
      expect.any(String), // id
      "owner-1",
      "Nodes only",
      expect.any(String), // token
      0,
      JSON.stringify([]),
      expect.stringContaining('"name":"Only"'),
      expect.stringContaining('"smartNodeMatchingEnabled":true'),
      JSON.stringify({}),
      null,
      expect.any(String),
      expect.any(String),
    );

    mocks.dbQuery.mockResolvedValueOnce([rawRow({ name: "Six minutes" })]);
    await createSubscription("owner-1", {
      name: "Six minutes",
      nodes: [node("Fast")],
      autoUpdateInterval: 360,
    });
    expect(mocks.dbExecute).toHaveBeenLastCalledWith(
      expect.stringContaining("INSERT INTO Subscription"),
      expect.any(String),
      "owner-1",
      "Six minutes",
      expect.any(String),
      0,
      expect.any(String),
      expect.any(String),
      expect.any(String),
      expect.any(String),
      360,
      expect.any(String),
      expect.any(String),
    );

    await expect(
      createSubscription("owner-1", {
        name: "Too fast",
        nodes: [node("Too fast")],
        autoUpdateInterval: 359,
      })
    ).rejects.toThrow("自动更新最小间隔为 0.1 小时");
  });

  it("updates subscriptions and preserves existing values when fields are omitted", async () => {
    await expect(updateSubscription("owner-1", "missing", { name: "A" })).resolves.toMatchObject({ id: "sub-1" });

    mocks.dbQuery.mockResolvedValueOnce([]);
    await expect(updateSubscription("owner-1", "missing", { name: "A" })).resolves.toBeNull();

    await expect(updateSubscription("owner-1", "sub-1", null)).rejects.toThrow("Invalid request body.");
    await expect(updateSubscription("owner-1", "sub-1", { urls: [], nodes: [] })).rejects.toThrow(
      "At least one URL or node is required."
    );

    await updateSubscription("owner-1", "sub-1", {
      name: " Updated ",
      urls: ["https://new.example/sub"],
      nodes: [node("New")],
      config: { sources: [{ id: "s1", type: "url", content: "https://new.example/sub" }] },
      smartNodeMatchingEnabled: true,
      subscriptionInfo: { download: 4096, total: 8192 },
      autoUpdateInterval: "",
    });

    expect(mocks.dbExecute).toHaveBeenCalledWith(
      expect.stringContaining("UPDATE Subscription"),
      "Updated",
      JSON.stringify(["https://new.example/sub"]),
      expect.stringContaining('"name":"New"'),
      expect.stringContaining('"smartNodeMatchingEnabled":true'),
      expect.stringContaining('"download":4096'),
      null,
      expect.any(String),
      "sub-1",
    );

    await updateSubscription("owner-1", "sub-1", {
      name: "   ",
      nodes: [node("Node only update")],
      smartNodeMatchingEnabled: false,
      autoUpdateInterval: "7200",
    });
    expect(mocks.dbExecute).toHaveBeenLastCalledWith(
      expect.stringContaining("UPDATE Subscription"),
      "Saved",
      expect.stringContaining('"name":"Node only update"'),
      expect.stringContaining('"smartNodeMatchingEnabled":false'),
      7200,
      expect.any(String),
      "sub-1",
    );
  });

  it("builds fetch callbacks for refresh source imports", async () => {
    const callbacks = buildSubscriptionFetchCallbacks();

    await expect(
      callbacks.fetchUrlNodes({
        id: "source-1",
        type: "url",
        content: "https://example.com/sub",
        userinfoUrl: "https://example.com/info",
        userinfoUserAgent: "UA",
      } as any)
    ).resolves.toEqual({
      ok: true,
      nodes: [node("Imported")],
      errors: [],
      headers: { "subscription-userinfo": "upload=1; total=2048" },
    });

    mocks.importSourceUrlDirect.mockResolvedValueOnce({
      ok: false,
      responseStatus: 500,
      error: "HTTP 500",
      publicReason: "HTTP 500",
      errorInfo: { category: "network" },
    });
    await expect(callbacks.fetchUrlNodes({ id: "bad", type: "url", content: "https://bad.example" } as any)).resolves.toMatchObject({
      ok: false,
      responseStatus: 500,
      error: "HTTP 500",
    });

    await expect(callbacks.fetchUrlUserInfo({ id: "source-1", type: "url", content: "", userinfoUrl: "x" } as any)).resolves.toEqual({
      "subscription-userinfo": "upload=1; total=2048",
    });

    await callbacks.fetchUrlNodes({ id: "source-2", type: "url", content: "https://example.com/sub" } as any);
    expect(mocks.importSourceUrlDirect).toHaveBeenLastCalledWith({ url: "https://example.com/sub" });

    mocks.importSourceUrlDirect.mockResolvedValueOnce({
      ok: false,
      error: "network",
      errorInfo: { category: "network" },
    });
    await expect(callbacks.fetchUrlNodes({ id: "bad-2", type: "url", content: "https://bad.example" } as any)).resolves.toEqual({
      ok: false,
      nodes: [],
      responseStatus: undefined,
      error: "network",
      errorInfo: { category: "network" },
      publicReason: undefined,
    });
  });

  it("refreshes subscriptions and persists successful snapshots", async () => {
    expect(buildSubscriptionCacheExpiry(new Date("2026-06-01T00:00:00.000Z")).toISOString()).toBe(
      "2026-06-01T01:00:00.000Z"
    );

    await expect(refreshSubscription("owner-1", "sub-1")).resolves.toEqual({
      ok: true,
      body: { ok: true, nodeCount: 1 },
    });
    expect(mocks.dbBatch).toHaveBeenCalled();

    mocks.prepareRefreshCacheResult.mockReturnValueOnce({ ok: false, reason: "too_many_nodes" });
    await expect(refreshSubscription("owner-1", "sub-1")).resolves.toEqual({
      ok: false,
      response: { error: "refresh failed" },
    });

    mocks.dbQuery.mockResolvedValueOnce([]);
    await expect(refreshSubscription("owner-1", "missing")).resolves.toBeNull();
  });

  it("generates YAML and updates access time when a subscription has nodes or proxy providers", async () => {
    await expect(generateSubscriptionYaml("token-1")).resolves.toMatchObject({
      yaml: "mixed-port: 7890\n",
      name: "Saved",
      subscriptionInfo: { upload: 2048, total: 4096 },
      cacheExpirySeconds: 3600,
      autoUpdateIntervalSeconds: 86400,
      isAdmin: true,
    });
    expect(mocks.buildGenerateOptionsFromConfig).toHaveBeenCalledWith(
      expect.objectContaining({ sources: expect.any(Array) }),
      expect.objectContaining({ nodes: [expect.objectContaining({ name: "Node" })], proxyProviders: null })
    );
    expect(mocks.dbExecute).toHaveBeenCalledWith(
      "UPDATE Subscription SET lastAccessedAt = ? WHERE id = ?",
      expect.any(String),
      "sub-1",
    );

    mocks.dbQuery.mockResolvedValueOnce([]);
    await expect(generateSubscriptionYaml("missing")).resolves.toBeNull();

    mocks.dbQuery.mockResolvedValueOnce([
      rawRow({ encryptedNodes: JSON.stringify([]), encryptedConfig: JSON.stringify({}) }),
    ]);
    mocks.buildProxyProvidersFromConfig.mockReturnValueOnce(null);
    await expect(generateSubscriptionYaml("empty")).resolves.toBeNull();

    mocks.dbQuery.mockResolvedValueOnce([
      rawRow({
        encryptedNodes: JSON.stringify([]),
        encryptedConfig: JSON.stringify({ proxyProviders: { provider: {} } }),
      }),
    ]);
    mocks.buildProxyProvidersFromConfig.mockReturnValueOnce({ provider: { url: "https://example.com/provider.yaml" } });
    await expect(generateSubscriptionYaml("provider-only")).resolves.toMatchObject({ yaml: "mixed-port: 7890\n" });
  });
});
