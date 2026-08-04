import { generateClashYaml } from "@subboost/core/generator";
import { buildGenerateOptionsFromConfig, getEffectiveTestOptions } from "@subboost/core/subscription/config-utils";
import { buildProxyProvidersFromConfig } from "@subboost/core/subscription/proxy-providers";
import type { SubscriptionResponseInfo } from "@subboost/core/subscription/subscription-response-info";
import type { ParsedNode } from "@subboost/core/types/node";
import {
  buildManualRefreshFailureResponse,
  buildManualRefreshSuccessResponseBody,
  normalizeSubscriptionConfigForPersistence,
  normalizeSubscriptionInfoForPersistence,
  normalizeSubscriptionName,
  normalizeSubscriptionNodeList,
  normalizeSubscriptionUrlList,
  prepareRefreshCacheResult,
  refreshNodeSnapshot,
  serializeSubscriptionDetailData,
  serializeSubscriptionSummaryData,
  type SavedSource,
  type RefreshNodeSnapshotResult,
} from "@subboost/server-core/subscription";
import { decryptJson, decryptJsonObject, encryptJson } from "./crypto";
import { dbBatch, dbExecute, dbQuery, generateId, stmt, type BindValue } from "./db";
import { getAppUrl } from "./env";
import { mapSubscriptionRow } from "./row-mappers";
import { fetchSourceUserInfoHeadersDirect, importSourceUrlDirect } from "./source-import";
import { normalizeLocalAutoUpdateIntervalSeconds } from "./auto-update-policy";

export const MAX_NODES_PER_SUBSCRIPTION = 10000;
export const CACHE_TTL_SECONDS = 3600;

export type SubscriptionRow = {
  id: string;
  ownerId: string;
  name: string;
  token: string;
  isPrimary: boolean;
  encryptedUrls: string;
  encryptedNodes: string;
  encryptedConfig: string;
  encryptedSubscriptionInfo: string | null;
  autoUpdateInterval: number | null;
  cacheExpiresAt: Date | null;
  lastAccessedAt: Date | null;
  lastUpdatedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  autoUpdateState?: {
    externalFailureCount: number;
    failureSourceState: string | null;
    lastFailedAt: Date | null;
    lastAttemptedAt: Date | null;
    disabledAt: Date | null;
    disabledReason: string | null;
    disabledPreviousInterval: number | null;
  } | null;
};

export type SubscriptionSummary = {
  id: string;
  name: string;
  token: string;
  subscriptionUrl: string;
  nodeCount: number;
  sourceCount: number;
  yamlUrl: string;
  isPrimary: boolean;
  autoUpdateInterval: number | null;
  smartNodeMatchingEnabled: boolean;
  cacheExpiresAt: string | null;
  lastAccessedAt: string | null;
  lastUpdatedAt: string | null;
  createdAt: string;
  updatedAt: string;
  autoUpdateState: {
    externalFailureCount: number;
    lastFailedAt: string | null;
    lastAttemptedAt: string | null;
    disabledAt: string | null;
    disabledReason: string | null;
    disabledPreviousInterval: number | null;
  };
};

export type SubscriptionDetail = SubscriptionSummary & {
  urls: string[];
  nodes: ParsedNode[];
  config: Record<string, unknown>;
  subscriptionInfo: Record<string, unknown>;
};

export type GeneratedSubscriptionYaml = {
  yaml: string;
  name: string;
  subscriptionInfo: SubscriptionResponseInfo;
  cacheExpirySeconds: number;
  autoUpdateIntervalSeconds: number | null;
  isAdmin: boolean;
};

const SUBSCRIPTION_SELECT_COLUMNS = `
  s.id, s.ownerId, s.name, s.token, s.isPrimary, s.encryptedUrls, s.encryptedNodes,
  s.encryptedConfig, s.encryptedSubscriptionInfo, s.autoUpdateInterval,
  s.cacheExpiresAt, s.lastAccessedAt, s.lastUpdatedAt, s.createdAt, s.updatedAt,
  u.externalFailureCount as state_externalFailureCount,
  u.failureSourceState as state_failureSourceState,
  u.lastFailedAt as state_lastFailedAt,
  u.lastAttemptedAt as state_lastAttemptedAt,
  u.disabledAt as state_disabledAt,
  u.disabledReason as state_disabledReason,
  u.disabledPreviousInterval as state_disabledPreviousInterval
`;

const SUBSCRIPTION_LEFT_JOIN =
  "LEFT JOIN SubscriptionAutoUpdateState u ON u.subscriptionId = s.id";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function buildLocalSubscriptionUrl(token: string): string {
  return `${getAppUrl()}/api/subscriptions/${token}/config.yaml`;
}

function buildLocalSubscriptionConfig(
  body: Record<string, unknown>,
  existingConfig: Record<string, unknown> = {}
): Record<string, unknown> {
  return normalizeSubscriptionConfigForPersistence(
    {
      config: body.config,
      smartNodeMatchingEnabled: body.smartNodeMatchingEnabled,
    },
    {
      existingConfig,
      idFactory: generateId,
      splitUrlLines: true,
      defaultSmartNodeMatchingEnabled: true,
    }
  );
}

export async function readSubscriptionSecrets(row: SubscriptionRow) {
  return {
    urls: await decryptJson<string[]>(row.encryptedUrls, []),
    nodes: await decryptJson<ParsedNode[]>(row.encryptedNodes, []),
    config: await decryptJsonObject(row.encryptedConfig),
    subscriptionInfo:
      normalizeSubscriptionInfoForPersistence(await decryptJson<unknown>(row.encryptedSubscriptionInfo, {})) ?? {},
  };
}

export async function formatSubscription(row: SubscriptionRow): Promise<SubscriptionSummary> {
  const secrets = await readSubscriptionSecrets(row);
  const subscriptionUrl = buildLocalSubscriptionUrl(row.token);
  return serializeSubscriptionSummaryData(row, secrets, {
    subscriptionUrl,
    yamlUrl: subscriptionUrl,
    dateMode: "iso",
    includeCounts: true,
    includeFailureSourceState: false,
    includeLastAttemptedAt: true,
  }) as SubscriptionSummary;
}

export async function formatSubscriptionDetail(row: SubscriptionRow): Promise<SubscriptionDetail> {
  const secrets = await readSubscriptionSecrets(row);
  const subscriptionUrl = buildLocalSubscriptionUrl(row.token);
  return serializeSubscriptionDetailData(row, secrets, {
    subscriptionUrl,
    yamlUrl: subscriptionUrl,
    dateMode: "iso",
    includeCounts: true,
    includeFailureSourceState: false,
    includeLastAttemptedAt: true,
  }) as SubscriptionDetail;
}

async function fetchSubscriptionById(id: string, ownerId: string): Promise<SubscriptionRow | null> {
  const rows = await dbQuery<Record<string, unknown>>(
    `SELECT ${SUBSCRIPTION_SELECT_COLUMNS} FROM Subscription s ${SUBSCRIPTION_LEFT_JOIN}
     WHERE s.id = ? AND s.ownerId = ?`,
    id,
    ownerId,
  );
  return rows.length > 0 ? mapSubscriptionRow(rows[0] as never) : null;
}

async function fetchSubscriptionByToken(token: string): Promise<SubscriptionRow | null> {
  const rows = await dbQuery<Record<string, unknown>>(
    `SELECT ${SUBSCRIPTION_SELECT_COLUMNS} FROM Subscription s ${SUBSCRIPTION_LEFT_JOIN}
     WHERE s.token = ?`,
    token,
  );
  return rows.length > 0 ? mapSubscriptionRow(rows[0] as never) : null;
}

export async function listSubscriptions(ownerId: string): Promise<SubscriptionSummary[]> {
  const rows = await dbQuery<Record<string, unknown>>(
    `SELECT ${SUBSCRIPTION_SELECT_COLUMNS} FROM Subscription s ${SUBSCRIPTION_LEFT_JOIN}
     WHERE s.ownerId = ? ORDER BY s.updatedAt DESC`,
    ownerId,
  );
  return Promise.all(rows.map((row) => formatSubscription(mapSubscriptionRow(row as never))));
}

export async function createSubscription(ownerId: string, body: unknown): Promise<SubscriptionSummary> {
  if (!isRecord(body)) {
    throw new Error("Invalid request body.");
  }
  const name = normalizeSubscriptionName(body.name);
  if (!name) throw new Error("Subscription name is required.");

  const urls = normalizeSubscriptionUrlList(body.urls);
  const nodes = normalizeSubscriptionNodeList(body.nodes);
  if (urls.length === 0 && nodes.length === 0) throw new Error("At least one URL or node is required.");

  const config = buildLocalSubscriptionConfig(body);
  const autoUpdateInterval = normalizeLocalAutoUpdateIntervalSeconds(body.autoUpdateInterval);
  const subscriptionInfo = normalizeSubscriptionInfoForPersistence(body.subscriptionInfo) ?? {};

  const id = generateId();
  const token = generateId();
  const now = new Date().toISOString();
  await dbExecute(
    `INSERT INTO Subscription
     (id, ownerId, name, token, isPrimary, encryptedUrls, encryptedNodes, encryptedConfig,
      encryptedSubscriptionInfo, autoUpdateInterval, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    ownerId,
    name,
    token,
    0,
    await encryptJson(urls),
    await encryptJson(nodes),
    await encryptJson(config),
    await encryptJson(subscriptionInfo),
    autoUpdateInterval,
    now,
    now,
  );

  const row = await fetchSubscriptionById(id, ownerId);
  return formatSubscription(row!);
}

export async function updateSubscription(
  ownerId: string,
  id: string,
  body: unknown
): Promise<SubscriptionSummary | null> {
  if (!isRecord(body)) throw new Error("Invalid request body.");
  const current = await fetchSubscriptionById(id, ownerId);
  if (!current) return null;

  const currentSecrets = await readSubscriptionSecrets(current);
  const name = normalizeSubscriptionName(body.name) || current.name;
  const sets: string[] = ["name = ?"];
  const binds: BindValue[] = [name];
  const hasUrls = "urls" in body;
  const hasNodes = "nodes" in body;
  const hasConfig = "config" in body || "smartNodeMatchingEnabled" in body;

  if (hasUrls) {
    sets.push("encryptedUrls = ?");
    binds.push(await encryptJson(normalizeSubscriptionUrlList(body.urls)));
  }
  if (hasNodes) {
    sets.push("encryptedNodes = ?");
    binds.push(await encryptJson(normalizeSubscriptionNodeList(body.nodes)));
  }
  if (hasConfig) {
    const config = buildLocalSubscriptionConfig(body, currentSecrets.config);
    sets.push("encryptedConfig = ?");
    binds.push(await encryptJson(config));
  }
  if ("subscriptionInfo" in body) {
    sets.push("encryptedSubscriptionInfo = ?");
    binds.push(
      await encryptJson(normalizeSubscriptionInfoForPersistence(body.subscriptionInfo) ?? {}),
    );
  }

  if (hasUrls || hasNodes || hasConfig) {
    const nextUrls = hasUrls ? normalizeSubscriptionUrlList(body.urls) : currentSecrets.urls;
    const nextNodes = hasNodes ? normalizeSubscriptionNodeList(body.nodes) : currentSecrets.nodes;
    if (nextUrls.length === 0 && nextNodes.length === 0) {
      throw new Error("At least one URL or node is required.");
    }
  }

  if ("autoUpdateInterval" in body) {
    sets.push("autoUpdateInterval = ?");
    binds.push(normalizeLocalAutoUpdateIntervalSeconds(body.autoUpdateInterval));
  }

  sets.push("updatedAt = ?");
  binds.push(new Date().toISOString());
  binds.push(id);

  await dbExecute(`UPDATE Subscription SET ${sets.join(", ")} WHERE id = ?`, ...binds);

  const row = await fetchSubscriptionById(id, ownerId);
  return row ? await formatSubscription(row) : null;
}

export async function getSubscription(ownerId: string, id: string): Promise<SubscriptionDetail | null> {
  const row = await fetchSubscriptionById(id, ownerId);
  return row ? await formatSubscriptionDetail(row) : null;
}

export async function deleteSubscription(ownerId: string, id: string): Promise<boolean> {
  const changes = await dbExecute("DELETE FROM Subscription WHERE id = ? AND ownerId = ?", id, ownerId);
  return changes > 0;
}

export function buildSubscriptionFetchCallbacks() {
  return {
    fetchUrlNodes: async (source: SavedSource) => {
      const imported = await importSourceUrlDirect({
        url: source.content,
        ...(source.userinfoUrl ? { userinfoUrl: source.userinfoUrl } : {}),
        ...(source.userinfoUserAgent ? { userinfoUserAgent: source.userinfoUserAgent } : {}),
      });
      if (imported.ok) {
        return {
          ok: true,
          nodes: imported.parsedNodes,
          errors: imported.parseErrors,
          headers: imported.headers,
        };
      }
      return {
        ok: false,
        nodes: [],
        responseStatus: imported.responseStatus,
        error: imported.error,
        errorInfo: imported.errorInfo,
        publicReason: imported.publicReason ?? undefined,
      };
    },
    fetchUrlUserInfo: async (source: SavedSource) => {
      return fetchSourceUserInfoHeadersDirect(source);
    },
  };
}

export function buildSubscriptionCacheExpiry(from: Date): Date {
  return new Date(from.getTime() + CACHE_TTL_SECONDS * 1000);
}

async function persistRefreshSuccess(params: {
  subscriptionId: string;
  snapshot: RefreshNodeSnapshotResult;
  config: Record<string, unknown>;
  cachedAt: Date;
}) {
  const encryptedNodes = await encryptJson(params.snapshot.nodes);
  const encryptedConfig = await encryptJson({ ...params.config, sources: params.snapshot.savedSources });
  const encryptedSubscriptionInfo = await encryptJson(params.snapshot.subscriptionInfo);
  const cacheExpiresAt = buildSubscriptionCacheExpiry(params.cachedAt).toISOString();
  const cachedAtIso = params.cachedAt.toISOString();

  await dbBatch([
    stmt(
      `UPDATE Subscription
       SET encryptedNodes = ?, encryptedConfig = ?, encryptedSubscriptionInfo = ?,
           lastUpdatedAt = ?, cacheExpiresAt = ?, updatedAt = ?
       WHERE id = ?`,
      encryptedNodes,
      encryptedConfig,
      encryptedSubscriptionInfo,
      cachedAtIso,
      cacheExpiresAt,
      cachedAtIso,
      params.subscriptionId,
    ),
    stmt(
      `INSERT INTO SubscriptionAutoUpdateState
       (subscriptionId, externalFailureCount, failureSourceState, lastFailedAt, lastAttemptedAt,
        disabledAt, disabledReason, disabledPreviousInterval, createdAt, updatedAt)
       VALUES (?, 0, NULL, NULL, NULL, NULL, NULL, NULL, ?, ?)
       ON CONFLICT(subscriptionId) DO UPDATE SET
         externalFailureCount = 0,
         failureSourceState = NULL,
         lastFailedAt = NULL,
         lastAttemptedAt = NULL,
         disabledAt = NULL,
         disabledReason = NULL,
         disabledPreviousInterval = NULL,
         updatedAt = excluded.updatedAt`,
      params.subscriptionId,
      cachedAtIso,
      cachedAtIso,
    ),
  ]);
}

export async function refreshSubscription(ownerId: string, id: string) {
  const row = await fetchSubscriptionById(id, ownerId);
  if (!row) return null;

  const secrets = await readSubscriptionSecrets(row);
  const snapshot = await refreshNodeSnapshot({
    config: secrets.config,
    urls: secrets.urls,
    storedNodes: secrets.nodes,
    ...buildSubscriptionFetchCallbacks(),
  });
  const refreshResult = prepareRefreshCacheResult({
    config: secrets.config,
    snapshot,
    maxNodesPerSubscription: MAX_NODES_PER_SUBSCRIPTION,
  });

  if (!refreshResult.ok) {
    return {
      ok: false as const,
      response: buildManualRefreshFailureResponse({
        refreshResult,
        maxNodesPerSubscription: MAX_NODES_PER_SUBSCRIPTION,
      }),
    };
  }

  const cachedAt = new Date();
  await persistRefreshSuccess({ subscriptionId: row.id, snapshot, config: secrets.config, cachedAt });
  return {
    ok: true as const,
    body: buildManualRefreshSuccessResponseBody({
      subscriptionId: row.id,
      refreshResult,
      snapshot,
      cachedAt,
    }),
  };
}

export async function generateSubscriptionYaml(token: string): Promise<GeneratedSubscriptionYaml | null> {
  const row = await fetchSubscriptionByToken(token);
  if (!row) return null;
  const secrets = await readSubscriptionSecrets(row);
  const { testUrl, testInterval } = getEffectiveTestOptions(secrets.config);
  const proxyProviders = buildProxyProvidersFromConfig(secrets.config, { testUrl, testInterval });
  if (secrets.nodes.length === 0 && !proxyProviders) return null;
  const yaml = generateClashYaml(
    buildGenerateOptionsFromConfig(secrets.config, {
      nodes: secrets.nodes,
      proxyProviders,
    })
  );
  await dbExecute(
    "UPDATE Subscription SET lastAccessedAt = ? WHERE id = ?",
    new Date().toISOString(),
    row.id,
  );
  return {
    yaml,
    name: row.name,
    subscriptionInfo: secrets.subscriptionInfo,
    cacheExpirySeconds: CACHE_TTL_SECONDS,
    autoUpdateIntervalSeconds: row.autoUpdateInterval,
    isAdmin: true,
  };
}
