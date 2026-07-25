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
import { prisma } from "./prisma";
import {
  buildSubscriptionCacheExpiry,
  buildSubscriptionFetchCallbacks,
  MAX_NODES_PER_SUBSCRIPTION,
  readSubscriptionSecrets,
  type SubscriptionRow,
} from "./subscription-service";
import { LOCAL_AUTO_UPDATE_MIN_SECONDS } from "./auto-update-policy";

type AutoUpdateSubscriptionRow = SubscriptionRow & {
  owner: {
    username: string | null;
  };
};

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
  await prisma.$transaction([
    prisma.subscription.update({
      where: { id: subscriptionId },
      data: extraSubscriptionData,
    }),
    prisma.subscriptionAutoUpdateState.upsert({
      where: { subscriptionId },
      create: { subscriptionId, ...state },
      update: state,
    }),
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
    lastUpdatedAt: cachedAt,
    cacheExpiresAt: buildSubscriptionCacheExpiry(cachedAt),
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

export async function runLocalSubscriptionAutoUpdateCron(now = new Date()): Promise<FinalCronUpdateSummary> {
  const subscriptions = (await prisma.subscription.findMany({
    where: { autoUpdateInterval: { not: null } },
    include: { owner: { select: { username: true } }, autoUpdateState: true },
  })) as AutoUpdateSubscriptionRow[];

  const accumulator = createCronUpdateAccumulator(subscriptions.length);
  for (const subscription of subscriptions) {
    let requestedHosts: string[] = [];
    let attemptStartedAt: Date | null = null;
    try {
      const currentAutoUpdateState = resolveSubscriptionAutoUpdateState(subscription);
      const intervalSeconds = Math.max(
        Number(subscription.autoUpdateInterval) || 0,
        LOCAL_AUTO_UPDATE_MIN_SECONDS
      );
      const scheduleState = resolveAutoUpdateScheduleState({
        createdAt: subscription.createdAt,
        lastUpdatedAt: subscription.lastUpdatedAt,
        lastAttemptedAt: currentAutoUpdateState.lastAttemptedAt,
        now,
        intervalSeconds,
      });

      if (!scheduleState.due) {
        recordCronUpdateSkipped(accumulator);
        continue;
      }

      attemptStartedAt = new Date();
      const prepared = await prepareLocalRefresh(subscription, currentAutoUpdateState, attemptStartedAt);
      requestedHosts = prepared.requestedHosts;
      const outcome = await completeLocalRefresh({
        subscription,
        currentAutoUpdateState,
        prepared,
        attemptedAt: attemptStartedAt,
        intervalSeconds,
      });
      applyCronUpdateOutcome(accumulator, outcome);
    } catch (error) {
      applyCronUpdateOutcome(
        accumulator,
        await recordUnexpectedFailure({ subscription, requestedHosts, error, attemptStartedAt })
      );
    }
  }

  return finalizeCronUpdateSummary(accumulator, { maxTopHosts: 50, maxTopUsers: 50 });
}
