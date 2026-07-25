import { describe, expect, it } from "vitest";
import {
  buildAutomaticRefreshAutoUpdateState,
  buildAutomaticRefreshUnexpectedFailureState,
  createResetSubscriptionAutoUpdateState,
  markAutomaticRefreshAttempted,
  resolveAutomaticRefreshFailureAnalysis,
  resolveSubscriptionAutoUpdateState,
  type SubscriptionAutoUpdateStateFields,
} from "./auto-update-state";

const attemptedAt = new Date("2026-06-01T01:00:00.000Z");
const failedAt = new Date("2026-06-01T01:00:05.000Z");

describe("subscription auto-update state helpers", () => {
  it("resolves partial persisted state with stable defaults", () => {
    const disabledAt = new Date("2026-06-01T00:00:00.000Z");

    expect(resolveSubscriptionAutoUpdateState({})).toEqual(createResetSubscriptionAutoUpdateState());
    expect(
      resolveSubscriptionAutoUpdateState({
        autoUpdateState: {
          externalFailureCount: 2,
          disabledAt,
          disabledReason: "reason",
        },
      })
    ).toMatchObject({
      externalFailureCount: 2,
      failureSourceState: null,
      disabledAt,
      disabledReason: "reason",
    });
  });

  it("marks attempts without clearing existing failure details", () => {
    const current: SubscriptionAutoUpdateStateFields = {
      externalFailureCount: 2,
      failureSourceState: "state",
      lastFailedAt: failedAt,
      lastAttemptedAt: null,
      disabledAt: null,
      disabledReason: null,
      disabledPreviousInterval: null,
    };

    expect(markAutomaticRefreshAttempted(current, attemptedAt)).toEqual({
      ...current,
      lastAttemptedAt: attemptedAt,
    });
    expect(buildAutomaticRefreshUnexpectedFailureState(attemptedAt)).toEqual({
      externalFailureCount: 0,
      failureSourceState: null,
      lastFailedAt: null,
      lastAttemptedAt: attemptedAt,
      disabledAt: null,
      disabledReason: null,
      disabledPreviousInterval: null,
    });
  });

  it("builds successful, failed, and disabling state transitions", () => {
    expect(
      buildAutomaticRefreshAutoUpdateState({
        failureState: null,
        attemptedAt,
        previousAutoUpdateInterval: 3600,
      })
    ).toMatchObject({
      externalFailureCount: 0,
      shouldDisableAutoUpdate: false,
      state: {
        lastFailedAt: null,
        lastAttemptedAt: attemptedAt,
        disabledAt: null,
      },
    });

    const failed = buildAutomaticRefreshAutoUpdateState({
      failureState: {
        sourceState: {},
        serializedSourceState: "{}",
        maxFailureCount: 3,
        stableFailedSources: [],
        failedSources: [],
        disableSource: {
          sourceId: "source-a",
          count: 3,
          isStableExternalFailure: true,
          reason: "目标订阅服务返回 HTTP 403",
        },
        shouldDisableAutoUpdate: true,
      },
      attemptedAt,
      failedAt,
      previousAutoUpdateInterval: 7200,
    });

    expect(failed).toMatchObject({
      externalFailureCount: 3,
      shouldDisableAutoUpdate: true,
      state: {
        failureSourceState: "{}",
        lastFailedAt: failedAt,
        lastAttemptedAt: attemptedAt,
        disabledAt: failedAt,
        disabledReason: "订阅源连续拉取失败",
        disabledPreviousInterval: 7200,
      },
    });
  });

  it("derives failure reasons from failed source state when source details exist", async () => {
    const result = await resolveAutomaticRefreshFailureAnalysis({
      currentState: { failureSourceState: null },
      failedAt,
      snapshot: {
        nodes: [],
        subscriptionInfo: {},
        savedSources: [
          {
            id: "source-a",
            type: "url",
            content: "https://example.com/sub",
          },
          {
            id: "provider",
            type: "url",
            content: "https://provider.example.com/sub",
            useProxyProviders: true,
          },
        ],
        attemptedUrlFetch: true,
        usedUrlFetch: false,
        refreshableSourceCount: 1,
        refreshedSourceCount: 0,
        refreshedUrlSourceCount: 0,
        refreshedStaticSourceCount: 0,
        detachedSourceCount: 0,
        failedSourceCount: 1,
        failedSources: [
          {
            id: "source-a",
            type: "url",
            content: "https://example.com/sub",
            errorMessage: "HTTP 403",
            httpStatus: 403,
          },
        ],
      },
    });

    expect(result.failureState?.maxFailureCount).toBe(1);
    expect(result.failureReason).toBe("目标订阅服务返回 HTTP 403");

    expect(
      await resolveAutomaticRefreshFailureAnalysis({
        currentState: { failureSourceState: null },
        failedAt,
        snapshot: {
          nodes: [],
          subscriptionInfo: {},
          savedSources: [],
          attemptedUrlFetch: false,
          usedUrlFetch: false,
          refreshableSourceCount: 0,
          refreshedSourceCount: 0,
          refreshedUrlSourceCount: 0,
          refreshedStaticSourceCount: 0,
          detachedSourceCount: 0,
          failedSourceCount: 0,
          failedSources: [],
        },
      })
    ).toEqual({
      failureState: null,
      failureReason: "缺少失败源明细",
    });
  });
});
