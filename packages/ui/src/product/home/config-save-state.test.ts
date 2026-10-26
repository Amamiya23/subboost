import { describe, expect, it } from "vitest";
import type { ConfigState } from "@subboost/ui/store/config-store/definitions";
import { getConfigSnapshot, hasUnsavedConfig } from "./config-save-state";

function state(): ConfigState {
  return {
    nodes: [{ name: "Example" }],
    sources: [{ id: "source", type: "url", content: "https://example.com/sub", parsed: true }],
    generatedYaml: "proxies: []",
    dnsYaml: "",
    savedConfigSnapshot: null,
  } as unknown as ConfigState;
}

describe("configuration save state", () => {
  it("is clean after save and after reverting a configuration edit", () => {
    const config = state();
    expect(hasUnsavedConfig(config)).toBe(true);
    config.savedConfigSnapshot = getConfigSnapshot(config);
    expect(hasUnsavedConfig(config)).toBe(false);
    config.dnsYaml = "enable: true";
    expect(hasUnsavedConfig(config)).toBe(true);
    config.dnsYaml = "";
    expect(hasUnsavedConfig(config)).toBe(false);
  });

  it("ignores import progress and blank placeholder sources", () => {
    const config = state();
    config.savedConfigSnapshot = getConfigSnapshot(config);
    config.sources[0]!.parsing = true;
    config.sources[0]!.error = "temporary error";
    config.sources.push({ id: "empty", type: "url", content: " " } as ConfigState["sources"][number]);
    expect(hasUnsavedConfig(config)).toBe(false);
  });

  it("does not clear edits made while saving or manual YAML changes", () => {
    const config = state();
    const submittedSnapshot = getConfigSnapshot(config);
    config.generatedYaml = "proxies: [manual]";
    config.savedConfigSnapshot = submittedSnapshot;
    expect(hasUnsavedConfig(config)).toBe(true);
    config.generatedYaml = "proxies: []";
    config.sources[0]!.content = "https://example.com/changed";
    expect(hasUnsavedConfig(config)).toBe(true);
  });

  it("treats unapplied base YAML as unsaved without changing the saved configuration snapshot", () => {
    const config = state();
    const saved = getConfigSnapshot(config);
    config.savedConfigSnapshot = saved;
    config.baseConfigDraft = "dns: [unfinished";
    expect(hasUnsavedConfig(config)).toBe(true);
    expect(getConfigSnapshot(config)).toBe(saved);
    config.baseConfigDraft = null;
    expect(hasUnsavedConfig(config)).toBe(false);
    config.baseConfigDraft = config.dnsYaml;
    expect(hasUnsavedConfig(config)).toBe(false);
  });
});
