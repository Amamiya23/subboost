import { PROXY_GROUP_MODULES, type ProxyGroupRule } from "@subboost/core/generator/proxy-groups";
import type { HiddenPresetRuleIds } from "@subboost/core/generator/module-rules";
import { resolveProxyGroupModuleName } from "@subboost/core/proxy-group-name";
import { resolveProxyGroupTargetName } from "@subboost/core/proxy-group-targets";
import type { BuiltinRuleEdits, CustomProxyGroup, CustomRuleSet } from "@subboost/core/types/config";

// Both built-in and custom groups must include presets retargeted via builtinRuleEdits.
export function buildProxyGroupRuleSetView({
  customRuleSets = [],
  builtinRuleEdits = {},
  customProxyGroups = [],
  proxyGroupNameOverrides = {},
}: {
  customRuleSets?: CustomRuleSet[];
  builtinRuleEdits?: BuiltinRuleEdits;
  customProxyGroups?: CustomProxyGroup[];
  proxyGroupNameOverrides?: Record<string, string>;
}) {
  const ruleSetsByTarget: Record<string, ProxyGroupRule[]> = {};
  const hiddenPresetRuleIds: HiddenPresetRuleIds = {};
  const moduleNames = Object.fromEntries(
    PROXY_GROUP_MODULES.map((module) => [
      module.id,
      resolveProxyGroupModuleName(module, proxyGroupNameOverrides[module.id]),
    ]),
  );
  const targetIdsByName = new Map([
    ...Object.entries(moduleNames).map(([id, name]) => [name, id] as const),
    ...customProxyGroups.map((group) => [group.name, group.id] as const),
  ]);
  const targetOptions = { moduleNames, customProxyGroups };
  const pushRule = (targetId: string, rule: ProxyGroupRule) => {
    (ruleSetsByTarget[targetId] ??= []).push(rule);
  };

  for (const ruleSet of customRuleSets) {
    const targetId = targetIdsByName.get(resolveProxyGroupTargetName(ruleSet.target, targetOptions));
    if (!targetId) continue;
    const { id, name, behavior, path, noResolve } = ruleSet;
    pushRule(targetId, { id, name, behavior, path, ...(noResolve ? { noResolve: true } : {}) });
  }

  for (const [key, edit] of Object.entries(builtinRuleEdits)) {
    const match = key.match(/^module:([^:]+):(.+)$/);
    if (!match) continue;
    const [, sourceModuleId, ruleId] = match;
    const sourceModule = PROXY_GROUP_MODULES.find((module) => module.id === sourceModuleId);
    const sourceRule = sourceModule?.rules?.find((rule) => rule.id === ruleId);
    if (!sourceRule) continue;
    const defaultTarget = moduleNames[sourceModuleId];
    const editTarget = edit.target
      ? resolveProxyGroupTargetName(edit.target, { ...targetOptions, fallbackTarget: defaultTarget })
      : defaultTarget;
    const isMoved = editTarget !== defaultTarget;

    if (edit.enabled === false || isMoved) {
      (hiddenPresetRuleIds[sourceModuleId] ??= []).push(ruleId);
    }
    if (edit.enabled === false || !isMoved) continue;
    const targetId = targetIdsByName.get(editTarget);
    if (targetId) pushRule(targetId, sourceRule);
  }

  return { ruleSetsByTarget, hiddenPresetRuleIds };
}
