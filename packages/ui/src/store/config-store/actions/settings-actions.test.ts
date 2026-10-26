import { describe, expect, it, vi } from "vitest";
import { createSettingsActions } from "./settings-actions";

function createStore(initial: Record<string, unknown> = {}) {
  let state = { ...initial };
  const set = vi.fn((next: any) => {
    const patch = typeof next === "function" ? next(state) : next;
    state = { ...state, ...patch };
  });
  const setAndGenerateConfig = vi.fn((updater: any) => {
    state = { ...state, ...updater(state) };
  });
  const get = vi.fn(() => state);
  return { get, set, setAndGenerateConfig, state: () => state };
}

describe("config store settings actions", () => {
  it("updates generated config settings through the generation path", () => {
    const store = createStore();
    const actions = createSettingsActions(store.set as any, store.get as any, store.setAndGenerateConfig as any);

    actions.setDnsYaml("dns: {}");
    actions.setMixedPort(7890);
    actions.setAllowLan(true);
    actions.setTestUrl("https://cp.cloudflare.com/generate_204");
    actions.setTestInterval(600);
    actions.setRuleProviderBaseUrl("https://rules.example.com");
    actions.setCnIpNoResolve(true);
    actions.setExperimentalCnUseCnRuleSet(1 as unknown as boolean);

    expect(store.state()).toEqual({
      dnsYaml: "dns: {}",
      baseConfigDraft: null,
      mixedPort: 7890,
      allowLan: true,
      testUrl: "https://cp.cloudflare.com/generate_204",
      testInterval: 600,
      ruleProviderBaseUrl: "https://rules.example.com",
      cnIpNoResolve: true,
      experimentalCnUseCnRuleSet: true,
    });
    expect(store.setAndGenerateConfig).toHaveBeenCalledTimes(8);
    expect(store.set).not.toHaveBeenCalled();
  });

  it("keeps an unapplied draft out of generated configuration and clears it on apply", () => {
    const store = createStore({ dnsYaml: "mixed-port: 7897", baseConfigDraft: null });
    const actions = createSettingsActions(store.set as any, store.get as any, store.setAndGenerateConfig as any);
    actions.setBaseConfigDraft("mixed-port: wrong");
    expect(store.state()).toEqual({ dnsYaml: "mixed-port: 7897", baseConfigDraft: "mixed-port: wrong" });
    expect(store.setAndGenerateConfig).not.toHaveBeenCalled();
    actions.setBaseConfigDraft("mixed-port: 7897");
    expect(store.state().baseConfigDraft).toBeNull();
    actions.setBaseConfigDraft("mixed-port: 7898");
    actions.setDnsYaml("mixed-port: 7898");
    expect(store.state()).toEqual({ dnsYaml: "mixed-port: 7898", baseConfigDraft: null });
  });
});
