import { describe, expect, it, vi } from "vitest";
import { validateSubBoostTemplateConfig } from "@subboost/core/templates/config-template";
import type { ParsedNode } from "@subboost/core/types/node";
import { createSettingsActions } from "./actions/settings-actions";
import { initialState } from "./definitions";
import { computeGeneratedYaml } from "./generated-yaml";
import { normalizePersistedConfigState, partializeConfigState } from "./persistence";
import type { StoreState, SetAndGenerateConfig } from "./store-types";

describe("saved proxy group emoji preference", () => {
  it("regenerates preview output, survives draft/template serialization, and restores the exact original output", () => {
    let state = {
      ...structuredClone(initialState),
      nodes: [{ name: "🇺🇸 My node", type: "ss", server: "example.com", port: 8388, cipher: "aes-128-gcm", password: "secret" } as ParsedNode],
      customProxyGroups: [{ id: "custom", name: "🎨 私人策略", emoji: "🎨", groupType: "select" }],
    } as StoreState;
    const original = computeGeneratedYaml(state);
    const sourceNames = structuredClone({ overrides: state.proxyGroupNameOverrides, custom: state.customProxyGroups });
    const update: SetAndGenerateConfig = (updater) => {
      state = { ...state, ...updater(state) };
      state.generatedYaml = computeGeneratedYaml(state);
    };
    const actions = createSettingsActions(vi.fn(), () => state, update);
    actions.setProxyGroupEmojiEnabled(false);

    expect(state.generatedYaml).not.toContain("🚀 节点选择");
    expect(state.generatedYaml).not.toContain("🎨 私人策略");
    expect(state.generatedYaml).toContain("🇺🇸 My node");
    expect({ overrides: state.proxyGroupNameOverrides, custom: state.customProxyGroups }).toEqual(sourceNames);
    const serializedDraft = JSON.parse(JSON.stringify(partializeConfigState(state)));
    expect(normalizePersistedConfigState(serializedDraft).proxyGroupEmojiEnabled).toBe(false);
    expect(normalizePersistedConfigState({}).proxyGroupEmojiEnabled).toBe(true);
    const template = validateSubBoostTemplateConfig({ ...state, schema: "subboost-template-config/v1" });
    expect(template.ok).toBe(true);
    if (template.ok) expect(template.config.proxyGroupEmojiEnabled).toBe(false);

    actions.setProxyGroupEmojiEnabled(true);
    expect(state.generatedYaml).toBe(original);
  });
});
