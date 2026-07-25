import {
  AUTO_UPDATE_DISABLED_REASON,
  updateAutoUpdateFailureSourceState,
  type AutoUpdateFailureSourceStateUpdate,
} from "./auto-update-failure";
import type { RefreshNodeSnapshotResult } from "./refresh-node-snapshot";

export type SubscriptionAutoUpdateStateFields = {
  externalFailureCount: number;
  failureSourceState: string | null;
  lastFailedAt: Date | null;
  lastAttemptedAt: Date | null;
  disabledAt: Date | null;
  disabledReason: string | null;
  disabledPreviousInterval: number | null;
};

export type SubscriptionAutoUpdateStateSource = {
  autoUpdateState?: Partial<SubscriptionAutoUpdateStateFields> | null;
};

export type AutomaticRefreshFailureAnalysis = {
  failureState: AutoUpdateFailureSourceStateUpdate | null;
  failureReason: string;
};

export type AutomaticRefreshAutoUpdateStateResult = {
  state: SubscriptionAutoUpdateStateFields;
  externalFailureCount: number;
  shouldDisableAutoUpdate: boolean;
};

export function resolveSubscriptionAutoUpdateState<T extends SubscriptionAutoUpdateStateSource>(
  subscription: T
): SubscriptionAutoUpdateStateFields {
  const state = subscription.autoUpdateState;
  return {
    externalFailureCount: state?.externalFailureCount ?? 0,
    failureSourceState: state?.failureSourceState ?? null,
    lastFailedAt: state?.lastFailedAt ?? null,
    lastAttemptedAt: state?.lastAttemptedAt ?? null,
    disabledAt: state?.disabledAt ?? null,
    disabledReason: state?.disabledReason ?? null,
    disabledPreviousInterval: state?.disabledPreviousInterval ?? null,
  };
}

export function createResetSubscriptionAutoUpdateState(): SubscriptionAutoUpdateStateFields {
  return {
    externalFailureCount: 0,
    failureSourceState: null,
    lastFailedAt: null,
    lastAttemptedAt: null,
    disabledAt: null,
    disabledReason: null,
    disabledPreviousInterval: null,
  };
}

export async function resolveAutomaticRefreshFailureAnalysis(params: {
  currentState: Pick<SubscriptionAutoUpdateStateFields, "failureSourceState">;
  snapshot: RefreshNodeSnapshotResult;
  failedAt: Date;
}): Promise<AutomaticRefreshFailureAnalysis> {
  const refreshableSources = params.snapshot.savedSources.filter(
    (source) => !(source.type === "url" && source.useProxyProviders === true)
  );
  const failureState =
    params.snapshot.failedSourceCount > 0
      ? await updateAutoUpdateFailureSourceState({
          previousStateRaw: params.currentState.failureSourceState,
          sources: refreshableSources,
          failedSources: params.snapshot.failedSources,
          failedAt: params.failedAt,
        })
      : null;
  const failureReason =
    failureState?.disableSource?.reason ??
    failureState?.stableFailedSources[0]?.reason ??
    failureState?.failedSources[0]?.reason ??
    "缺少失败源明细";

  return { failureState, failureReason };
}

export function buildAutomaticRefreshAutoUpdateState(params: {
  failureState: AutoUpdateFailureSourceStateUpdate | null;
  attemptedAt: Date;
  failedAt?: Date;
  previousAutoUpdateInterval: number | null;
}): AutomaticRefreshAutoUpdateStateResult {
  const externalFailureCount = params.failureState?.maxFailureCount ?? 0;
  const shouldDisableAutoUpdate = params.failureState?.shouldDisableAutoUpdate ?? false;
  const failureMarkedAt = params.failedAt ?? params.attemptedAt;

  return {
    externalFailureCount,
    shouldDisableAutoUpdate,
    state: {
      externalFailureCount,
      failureSourceState: params.failureState?.serializedSourceState ?? null,
      lastFailedAt: externalFailureCount > 0 ? failureMarkedAt : null,
      lastAttemptedAt: params.attemptedAt,
      disabledAt: shouldDisableAutoUpdate ? failureMarkedAt : null,
      disabledReason: shouldDisableAutoUpdate ? AUTO_UPDATE_DISABLED_REASON : null,
      disabledPreviousInterval: shouldDisableAutoUpdate ? params.previousAutoUpdateInterval : null,
    },
  };
}

export function markAutomaticRefreshAttempted(
  currentState: SubscriptionAutoUpdateStateFields,
  attemptedAt: Date
): SubscriptionAutoUpdateStateFields {
  return {
    ...currentState,
    lastAttemptedAt: attemptedAt,
  };
}

export function buildAutomaticRefreshUnexpectedFailureState(attemptedAt: Date): SubscriptionAutoUpdateStateFields {
  return {
    externalFailureCount: 0,
    failureSourceState: null,
    lastFailedAt: null,
    lastAttemptedAt: attemptedAt,
    disabledAt: null,
    disabledReason: null,
    disabledPreviousInterval: null,
  };
}
