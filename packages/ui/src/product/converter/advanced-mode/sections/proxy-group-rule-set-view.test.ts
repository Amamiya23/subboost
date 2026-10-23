import { describe, expect, it } from "vitest";
import { PROXY_GROUP_MODULES } from "@subboost/core/generator/proxy-groups";
import { getEffectiveModuleRuleItems, isModuleRuleMovedFrom } from "@subboost/core/generator/module-rules";
import { buildGeneratedRuleEntries } from "@subboost/core/generator/rules";
import { initialState } from "@subboost/ui/store/config-store/definitions";
import { createProxyGroupActions } from "@subboost/ui/store/config-store/actions/proxy-group-actions";
import type { StoreState, SetAndGenerateConfig } from "@subboost/ui/store/config-store/store-types";
import { buildProxyGroupRuleSetView } from "./proxy-group-rule-set-view";

const streamingGroup = {
  id: "custom-streaming",
  name: "🎬 流媒体",
  emoji: "🎬",
  groupType: "select" as const,
};
const youtubeModule = PROXY_GROUP_MODULES.find((module) => module.id === "youtube")!;
const youtubeRule = youtubeModule.rules.find((rule) => rule.id === "youtube")!;

function createHarness() {
  let state = {
    ...structuredClone(initialState),
    enabledProxyGroups: ["select", "auto"],
    customProxyGroups: [streamingGroup, { ...streamingGroup, id: "custom-other", name: "Other" }],
    customRuleSets: [],
    builtinRuleEdits: {},
  } as unknown as StoreState;
  const setAndGenerateConfig: SetAndGenerateConfig = (updater) => {
    state = { ...state, ...updater(state) };
  };
  const actions = createProxyGroupActions(() => undefined, () => state, setAndGenerateConfig);
  const view = () => buildProxyGroupRuleSetView(state);
  const generatedYoutubeRule = () => buildGeneratedRuleEntries({
    ...state,
    enabledModules: state.enabledProxyGroups,
  }).find((entry) => entry.key === "module:youtube:youtube");
  return { actions, view, generatedYoutubeRule, getState: () => state };
}

describe("buildProxyGroupRuleSetView", () => {
  it("shows a saved preset move in a custom group and marks its source as moved", () => {
    const view = buildProxyGroupRuleSetView({
      customProxyGroups: [streamingGroup],
      builtinRuleEdits: { "module:youtube:youtube": { target: streamingGroup.name } },
      customRuleSets: [{
        id: "streaming-domain",
        name: "Streaming Domain",
        behavior: "domain",
        path: "geosite/streaming-domain.mrs",
        target: streamingGroup.name,
      }],
    });

    expect(view.ruleSetsByTarget[streamingGroup.id].map((rule) => rule.id)).toEqual([
      "streaming-domain", "youtube",
    ]);
    expect(view.hiddenPresetRuleIds.youtube).toEqual(["youtube"]);
    expect(isModuleRuleMovedFrom("youtube", "youtube", view.ruleSetsByTarget)).toBe(true);
    expect(getEffectiveModuleRuleItems(youtubeModule, view.ruleSetsByTarget, view.hiddenPresetRuleIds)).toEqual([]);
  });

  it("keeps the move visible with the source group disabled and restores its default target", () => {
    const { actions, view, generatedYoutubeRule, getState } = createHarness();
    actions.moveModuleRule("youtube", "youtube", { kind: "custom", id: streamingGroup.id });

    expect(getState().enabledProxyGroups).not.toContain("youtube");
    expect(view().ruleSetsByTarget[streamingGroup.id]).toEqual([youtubeRule]);
    expect(generatedYoutubeRule()?.target).toBe(streamingGroup.name);
    expect(isModuleRuleMovedFrom("youtube", "youtube", view().ruleSetsByTarget)).toBe(true);

    actions.resetModuleRuleTarget("youtube", "youtube");
    const restored = view();
    expect(restored.ruleSetsByTarget[streamingGroup.id]).toBeUndefined();
    expect(restored.hiddenPresetRuleIds.youtube).toBeUndefined();
    expect(getEffectiveModuleRuleItems(youtubeModule, restored.ruleSetsByTarget, restored.hiddenPresetRuleIds))
      .toEqual([{ ...youtubeRule, source: "preset" }]);
    expect(getState().builtinRuleEdits).toEqual({});
  });
  it("supports moving a preset again from a custom group and deleting and restoring it", () => {
    const { actions, view, generatedYoutubeRule, getState } = createHarness();
    actions.moveModuleRule("youtube", "youtube", { kind: "custom", id: streamingGroup.id });
    actions.moveModuleRule(streamingGroup.id, "youtube", { kind: "custom", id: "custom-other" });
    expect(view().ruleSetsByTarget[streamingGroup.id]).toBeUndefined();
    expect(view().ruleSetsByTarget["custom-other"]).toEqual([youtubeRule]);
    expect(generatedYoutubeRule()?.target).toBe("Other");

    actions.moveModuleRule("custom-other", "youtube", { kind: "module", id: "google" });
    expect(view().ruleSetsByTarget["custom-other"]).toBeUndefined();
    expect(view().ruleSetsByTarget.google).toEqual([youtubeRule]);
    expect(getState().enabledProxyGroups).toContain("google");

    actions.removeModuleRule("google", "youtube");
    expect(view().ruleSetsByTarget.google).toBeUndefined();
    expect(view().hiddenPresetRuleIds.youtube).toEqual(["youtube"]);
    expect(isModuleRuleMovedFrom("youtube", "youtube", view().ruleSetsByTarget)).toBe(false);
    expect(generatedYoutubeRule()).toBeUndefined();

    actions.restoreModuleRule("youtube", "youtube");
    expect(view().ruleSetsByTarget.google).toEqual([youtubeRule]);
    actions.resetModuleRuleTarget("youtube", "youtube");
    expect(view().ruleSetsByTarget.google).toBeUndefined();
    expect(view().hiddenPresetRuleIds.youtube).toBeUndefined();
  });

  it("resolves stable group references after a custom group is renamed", () => {
    const renamed = { ...streamingGroup, name: "🎬 新流媒体" };
    const view = buildProxyGroupRuleSetView({
      customProxyGroups: [renamed],
      builtinRuleEdits: {
        "module:youtube:youtube": { target: { kind: "custom", id: renamed.id } },
        "module:ai:openai": { target: { kind: "module", id: "google" } },
      },
      proxyGroupNameOverrides: { google: "Google Renamed" },
    });

    expect(view.ruleSetsByTarget[renamed.id]).toEqual([youtubeRule]);
    expect(view.ruleSetsByTarget.google.map((rule) => rule.id)).toEqual(["openai"]);
    expect(isModuleRuleMovedFrom("youtube", "youtube", view.ruleSetsByTarget)).toBe(true);
  });

  it("keeps deleted moved presets out of target groups", () => {
    const view = buildProxyGroupRuleSetView({
      customProxyGroups: [streamingGroup],
      builtinRuleEdits: {
        "module:youtube:youtube": { target: streamingGroup.name, enabled: false },
        "module:ai:openai": { target: "🔍 谷歌服务", enabled: false },
      },
    });

    expect(view.ruleSetsByTarget).toEqual({});
    expect(view.hiddenPresetRuleIds).toEqual({ youtube: ["youtube"], ai: ["openai"] });
  });
});
