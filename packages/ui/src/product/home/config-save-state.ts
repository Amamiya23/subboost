import type { ConfigState } from "@subboost/ui/store/config-store/definitions";

const configKeys = [
  "nodes", "deletedNodeNames", "deletedNodes", "template", "enabledProxyGroups",
  "hiddenProxyGroups", "customProxyGroups", "proxyGroupAdvanced", "customRuleSets",
  "builtinRuleEdits", "customRules", "dialerProxyGroups", "proxyGroupNameOverrides",
  "proxyGroupEmojiEnabled", "proxyGroupOrder", "ruleOrder", "appliedTemplateId", "dnsYaml", "mixedPort",
  "allowLan", "testUrl", "testInterval", "ruleProviderBaseUrl", "cnIpNoResolve",
  "experimentalCnUseCnRuleSet", "listenerPorts",
] as const;

export function getConfigSnapshot(state: ConfigState): string {
  return JSON.stringify({
    ...Object.fromEntries(configKeys.map((key) => [key, state[key]])),
    // 忽略解析中、错误、流量信息等临时状态，以及未填写的占位输入。
    sources: (state.sources ?? []).filter((source) => source.content?.trim()).map((source) => ({
      id: source.id, type: source.type, content: source.content,
      tag: source.tag ?? "", nameTemplate: source.nameTemplate ?? "",
      useProxyProviders: Boolean(source.useProxyProviders),
      userinfoUrl: source.userinfoUrl ?? "", userinfoUserAgent: source.userinfoUserAgent ?? "",
    })),
    generatedYaml: state.nodes?.length || state.sources?.some((source) => source.content?.trim())
      ? state.generatedYaml ?? "" : "",
  });
}

export function hasUnsavedConfig(state: ConfigState): boolean {
  if (state.savedConfigSnapshot == null) {
    return Boolean(state.nodes?.length || state.sources?.some((source) => source.content?.trim()));
  }
  return getConfigSnapshot(state) !== state.savedConfigSnapshot;
}
