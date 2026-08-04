import {
  applyCronUpdateOutcome,
  createCronUpdateAccumulator,
  extractHostsFromSubscriptionUrls,
  finalizeCronUpdateSummary,
  prepareRefreshCacheResult,
  refreshNodeSnapshot,
  recordCronUpdateSkipped,
  resolveAutomaticRefreshCompletionDecision,
  resolveAutoUpdateScheduleState,
  resolveAutomaticRefreshUnexpectedFailureCompletion,
  resolveAutomaticRefreshFailureAnalysis,
  resolveSubscriptionAutoUpdateState,
  type AutomaticRefreshCompletionTarget,
  type CronUpdateOutcome,
  type FinalCronUpdateSummary,
  type PreparedRefreshCacheResult,
  type RefreshNodeSnapshotResult,
  type SubscriptionAutoUpdateStateFields,
} from "@subboost/server-core/subscription";
import { encryptJson } from "./crypto";
import { dbBatch, dbQuery, stmt, type BindValue } from "./db";
import {
  buildSubscriptionCacheExpiry,
  buildSubscriptionFetchCallbacks,
  MAX_NODES_PER_SUBSCRIPTION,
  readSubscriptionSecrets,
  type SubscriptionRow,
} from "./subscription-service";
import { mapSubscriptionWithOwnerRow } from "./row-mappers";
import { LOCAL_AUTO_UPDATE_MIN_SECONDS } from "./auto-update-policy";

type AutoUpdateSubscriptionRow = SubscriptionRow & {
  owner: {
    username: string | null;
  };
};

type AutoUpdateScheduleCandidate = Pick<
  SubscriptionRow,
  "id" | "autoUpdateInterval" | "createdAt" | "lastUpdatedAt"
> & {
  autoUpdateState: Pick<SubscriptionAutoUpdateStateFields, "lastAttemptedAt"> | null;
};

type DueAutoUpdateCandidate = {
  id: string;
  intervalSeconds: number;
};

const AUTO_UPDATE_FULL_ROW_BATCH_SIZE = 10;

type PreparedLocalRefresh = {
  config: Record<string, unknown>;
  requestedHosts: string[];
  snapshot: RefreshNodeSnapshotResult;
  refreshResult: PreparedRefreshCacheResult;
  failureState: Awaited<ReturnType<typeof resolveAutomaticRefreshFailureAnalysis>>["failureState"];
  failureReason: string;
};

function toCompletionTarget(subscription: AutoUpdateSubscriptionRow): AutomaticRefreshCompletionTarget {
  return {
    id: subscription.id,
    name: subscription.name,
    userId: subscription.ownerId,
    username: subscription.owner.username,
    autoUpdateInterval: subscription.autoUpdateInterval,
  };
}

async function writeAutoUpdateState(
  subscriptionId: string,
  state: SubscriptionAutoUpdateStateFields,
  extraSubscriptionData: Record<string, unknown> = {}
) {
  const now = new Date().toISOString();
  const setClauses = Object.keys(extraSubscriptionData).map((key) => `${key} = ?`);
  const subscriptionUpdateBinds: BindValue[] = [
    ...(Object.values(extraSubscriptionData) as BindValue[]),
    now,
    subscriptionId,
  ];

  const stateSetClauses = [
    "externalFailureCount = excluded.externalFailureCount",
    "failureSourceState = excluded.failureSourceState",
    "lastFailedAt = excluded.lastFailedAt",
    "lastAttemptedAt = excluded.lastAttemptedAt",
    "disabledAt = excluded.disabledAt",
    "disabledReason = excluded.disabledReason",
    "disabledPreviousInterval = excluded.disabledPreviousInterval",
    "updatedAt = excluded.updatedAt",
  ];

  const subscriptionStmt = setClauses.length > 0
    ? stmt(
        `UPDATE Subscription SET ${setClauses.join(", ")}, updatedAt = ? WHERE id = ?`,
        ...subscriptionUpdateBinds,
      )
    : stmt("UPDATE Subscription SET updatedAt = ? WHERE id = ?", now, subscriptionId);

  await dbBatch([
    subscriptionStmt,
    stmt(
      `INSERT INTO SubscriptionAutoUpdateState
       (subscriptionId, externalFailureCount, failureSourceState, lastFailedAt, lastAttemptedAt,
        disabledAt, disabledReason, disabledPreviousInterval, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(subscriptionId) DO UPDATE SET ${stateSetClauses.join(", ")}`,
      subscriptionId,
      state.externalFailureCount,
      state.failureSourceState,
      state.lastFailedAt?.toISOString() ?? null,
      state.lastAttemptedAt?.toISOString() ?? null,
      state.disabledAt?.toISOString() ?? null,
      state.disabledReason,
      state.disabledPreviousInterval,
      now,
      now,
    ),
  ]);
}

async function prepareLocalRefresh(
  subscription: AutoUpdateSubscriptionRow,
  currentAutoUpdateState: SubscriptionAutoUpdateStateFields,
  attemptedAt: Date
): Promise<PreparedLocalRefresh> {
  const secrets = await readSubscriptionSecrets(subscription);
  const requestedHosts = extractHostsFromSubscriptionUrls(secrets.urls);
  const snapshot = await refreshNodeSnapshot({
    config: secrets.config,
    urls: secrets.urls,
    storedNodes: secrets.nodes,
    ...buildSubscriptionFetchCallbacks(),
  });
  const { failureState, failureReason } = await resolveAutomaticRefreshFailureAnalysis({
    currentState: currentAutoUpdateState,
    snapshot,
    failedAt: attemptedAt,
  });
  const refreshResult = prepareRefreshCacheResult({
    config: secrets.config,
    snapshot,
    maxNodesPerSubscription: MAX_NODES_PER_SUBSCRIPTION,
  });

  return {
    config: secrets.config,
    requestedHosts,
    snapshot,
    refreshResult,
    failureState,
    failureReason,
  };
}

async function completeAllSourcesFailed(params: {
  subscription: AutoUpdateSubscriptionRow;
  prepared: PreparedLocalRefresh;
  decision: Extract<ReturnType<typeof resolveAutomaticRefreshCompletionDecision>, { kind: "all_sources_failed" }>;
}): Promise<CronUpdateOutcome> {
  await writeAutoUpdateState(params.subscription.id, params.decision.nextAutoUpdateState.state, {
    ...(params.decision.nextAutoUpdateState.shouldDisableAutoUpdate ? { autoUpdateInterval: null } : {}),
  });

  if (params.decision.nextAutoUpdateState.shouldDisableAutoUpdate) {
    console.warn("[local-subscription-cron] auto update disabled", {
      subscriptionId: params.subscription.id,
      reason: params.prepared.failureReason,
    });
  }

  return params.decision.outcome;
}

async function completeSuccess(params: {
  subscription: AutoUpdateSubscriptionRow;
  prepared: PreparedLocalRefresh;
  attemptedAt: Date;
  intervalSeconds: number;
}): Promise<CronUpdateOutcome> {
  const refreshResult = params.prepared.refreshResult;
  if (!refreshResult.ok) throw new Error(`Unexpected refresh failure reason: ${refreshResult.reason}`);

  const cachedAt = new Date();
  const decision = resolveAutomaticRefreshCompletionDecision({
    target: toCompletionTarget(params.subscription),
    currentAutoUpdateState: resolveSubscriptionAutoUpdateState(params.subscription),
    prepared: params.prepared,
    attemptedAt: params.attemptedAt,
    successAttemptedAt: cachedAt,
    maxNodesPerSubscription: MAX_NODES_PER_SUBSCRIPTION,
  });
  if (decision.kind !== "success") throw new Error(`Unexpected refresh completion decision: ${decision.kind}`);
  const config = { ...params.prepared.config, sources: params.prepared.snapshot.savedSources };

  await writeAutoUpdateState(params.subscription.id, decision.nextAutoUpdateState.state, {
    encryptedNodes: await encryptJson(refreshResult.cacheEntry.nodes),
    encryptedConfig: await encryptJson(config),
    encryptedSubscriptionInfo: await encryptJson(refreshResult.cacheEntry.subscriptionInfo),
    lastUpdatedAt: cachedAt.toISOString(),
    cacheExpiresAt: buildSubscriptionCacheExpiry(cachedAt).toISOString(),
    ...(decision.nextAutoUpdateState.shouldDisableAutoUpdate ? { autoUpdateInterval: null } : {}),
  });

  console.info("[local-subscription-cron] updated", {
    subscriptionId: params.subscription.id,
    nodeCount: refreshResult.nodeCount,
    intervalSeconds: params.intervalSeconds,
    externalFailureCount: decision.nextAutoUpdateState.externalFailureCount,
    autoUpdateDisabled: decision.nextAutoUpdateState.shouldDisableAutoUpdate,
  });

  return decision.outcome;
}

async function completeLocalRefresh(params: {
  subscription: AutoUpdateSubscriptionRow;
  currentAutoUpdateState: SubscriptionAutoUpdateStateFields;
  prepared: PreparedLocalRefresh;
  attemptedAt: Date;
  intervalSeconds: number;
}): Promise<CronUpdateOutcome> {
  const refreshResult = params.prepared.refreshResult;

  if (!refreshResult.ok) {
    const decision = resolveAutomaticRefreshCompletionDecision({
      target: toCompletionTarget(params.subscription),
      currentAutoUpdateState: params.currentAutoUpdateState,
      prepared: params.prepared,
      attemptedAt: params.attemptedAt,
      maxNodesPerSubscription: MAX_NODES_PER_SUBSCRIPTION,
    });

    if (decision.kind === "all_sources_failed") {
      return completeAllSourcesFailed({ ...params, decision });
    }
    if (decision.kind === "success") throw new Error("Unexpected successful completion decision");

    await writeAutoUpdateState(params.subscription.id, decision.attemptedState);
    return decision.outcome;
  }

  return completeSuccess(params);
}

async function recordUnexpectedFailure(params: {
  subscription: AutoUpdateSubscriptionRow;
  requestedHosts: string[];
  error: unknown;
  attemptStartedAt: Date | null;
}): Promise<CronUpdateOutcome> {
  const completion = resolveAutomaticRefreshUnexpectedFailureCompletion({
    target: toCompletionTarget(params.subscription),
    requestedHosts: params.requestedHosts,
    error: params.error,
    attemptStartedAt: params.attemptStartedAt,
  });
  if (completion.attemptedState) {
    await writeAutoUpdateState(params.subscription.id, completion.attemptedState).catch(() => undefined);
  }

  console.error("[local-subscription-cron] failed", {
    subscriptionId: params.subscription.id,
    message: completion.message,
  });

  return completion.outcome;
}

const SCHEDULE_SELECT_COLUMNS = `
  s.id, s.autoUpdateInterval, s.createdAt, s.lastUpdatedAt,
  u.lastAttemptedAt as state_lastAttemptedAt
`;

const FULL_SELECT_COLUMNS = `
  s.id, s.ownerId, s.name, s.token, s.isPrimary, s.encryptedUrls, s.encryptedNodes,
  s.encryptedConfig, s.encryptedSubscriptionInfo, s.autoUpdateInterval,
  s.cacheExpiresAt, s.lastAccessedAt, s.lastUpdatedAt, s.createdAt, s.updatedAt,
  u.externalFailureCount as state_externalFailureCount,
  u.failureSourceState as state_failureSourceState,
  u.lastFailedAt as state_lastFailedAt,
  u.lastAttemptedAt as state_lastAttemptedAt,
  u.disabledAt as state_disabledAt,
  u.disabledReason as state_disabledReason,
  u.disabledPreviousInterval as state_disabledPreviousInterval`;

const STATE_LEFT_JOIN = "LEFT JOIN SubscriptionAutoUpdateState u ON u.subscriptionId = s.id";

export async function runLocalSubscriptionAutoUpdateCron(now = new Date()): Promise<FinalCronUpdateSummary> {
  const rawCandidates = await dbQuery<Record<string, unknown>>(
    `SELECT ${SCHEDULE_SELECT_COLUMNS}
     FROM Subscription s
     LEFT JOIN SubscriptionAutoUpdateState u ON u.subscriptionId = s.id
     WHERE s.autoUpdateInterval IS NOT NULL`,
  );

  const candidates: AutoUpdateScheduleCandidate[] = rawCandidates.map((row) => ({
    id: row.id as string,
    autoUpdateInterval: row.autoUpdateInterval === null ? null : Number(row.autoUpdateInterval),
    createdAt: new Date(row.createdAt as string),
    lastUpdatedAt: row.lastUpdatedAt === null ? null : new Date(row.lastUpdatedAt as string),
    autoUpdateState: row.state_lastAttemptedAt === null || row.state_lastAttemptedAt === undefined
      ? null
      : { lastAttemptedAt: new Date(row.state_lastAttemptedAt as string) },
  }));

  const accumulator = createCronUpdateAccumulator(candidates.length);
  const dueCandidates: DueAutoUpdateCandidate[] = [];
  for (const candidate of candidates) {
    const currentAutoUpdateState = resolveSubscriptionAutoUpdateState(candidate);
    const intervalSeconds = Math.max(
      Number(candidate.autoUpdateInterval) || 0,
      LOCAL_AUTO_UPDATE_MIN_SECONDS
    );
    const scheduleState = resolveAutoUpdateScheduleState({
      createdAt: candidate.createdAt,
      lastUpdatedAt: candidate.lastUpdatedAt,
      lastAttemptedAt: currentAutoUpdateState.lastAttemptedAt,
      now,
      intervalSeconds,
    });

    if (!scheduleState.due) {
      recordCronUpdateSkipped(accumulator);
      continue;
    }
    dueCandidates.push({ id: candidate.id, intervalSeconds });
  }

  for (let offset = 0; offset < dueCandidates.length; offset += AUTO_UPDATE_FULL_ROW_BATCH_SIZE) {
    const batch = dueCandidates.slice(offset, offset + AUTO_UPDATE_FULL_ROW_BATCH_SIZE);
    const placeholders = batch.map(() => "?").join(",");
    const rawRows = await dbQuery<Record<string, unknown>>(
      `SELECT ${FULL_SELECT_COLUMNS},
              a.username as owner_username
       FROM Subscription s
       ${STATE_LEFT_JOIN}
       LEFT JOIN LocalAdmin a ON a.id = s.ownerId
       WHERE s.id IN (${placeholders}) AND s.autoUpdateInterval IS NOT NULL`,
      ...batch.map((c) => c.id),
    );
    const subscriptions = rawRows.map((row) => mapSubscriptionWithOwnerRow(row as never));
    const subscriptionById = new Map(subscriptions.map((subscription) => [subscription.id, subscription]));

    for (const dueCandidate of batch) {
      const subscription = subscriptionById.get(dueCandidate.id);
      if (!subscription) {
        recordCronUpdateSkipped(accumulator);
        continue;
      }

      let requestedHosts: string[] = [];
      let attemptStartedAt: Date | null = null;
      try {
        const currentAutoUpdateState = resolveSubscriptionAutoUpdateState(subscription);
        attemptStartedAt = new Date();
        const prepared = await prepareLocalRefresh(subscription, currentAutoUpdateState, attemptStartedAt);
        requestedHosts = prepared.requestedHosts;
        const outcome = await completeLocalRefresh({
          subscription,
          currentAutoUpdateState,
          prepared,
          attemptedAt: attemptStartedAt,
          intervalSeconds: dueCandidate.intervalSeconds,
        });
        applyCronUpdateOutcome(accumulator, outcome);
      } catch (error) {
        applyCronUpdateOutcome(
          accumulator,
          await recordUnexpectedFailure({ subscription, requestedHosts, error, attemptStartedAt })
        );
      }
    }
  }

  return finalizeCronUpdateSummary(accumulator, { maxTopHosts: 50, maxTopUsers: 50 });
}
