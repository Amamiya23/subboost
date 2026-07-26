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
  const candidates = (await prisma.subscription.findMany({
    where: { autoUpdateInterval: { not: null } },
    select: {
      id: true,
      autoUpdateInterval: true,
      createdAt: true,
      lastUpdatedAt: true,
      autoUpdateState: { select: { lastAttemptedAt: true } },
    },
  })) as AutoUpdateScheduleCandidate[];

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
    const subscriptions = (await prisma.subscription.findMany({
      where: {
        id: { in: batch.map(({ id }) => id) },
        autoUpdateInterval: { not: null },
      },
      include: { owner: { select: { username: true } }, autoUpdateState: true },
    })) as AutoUpdateSubscriptionRow[];
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
