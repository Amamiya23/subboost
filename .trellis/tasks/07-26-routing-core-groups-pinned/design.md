# Design — Pin private/cn/global routing rules

## 设计总览

引入「常驻后台规则组（pinned background rule group）」概念：保留 `private`/`cn`/`global` 三个模块在 `PROXY_GROUP_MODULES` 中（避免大面积改动模板/校验/名称解析），但给它们打上 `pinned` 标记并指定固定目标。生成器对 `pinned` 模块走特殊分支：

- 规则：始终生成，目标写死，忽略 `enabledModules` 与针对它们的 `builtinRuleEdits`。
- 代理组：永不生成。
- UI：从核心组列表过滤掉。
- `customRuleSets` 目标命中 pinned 组名时：重定向到该组的固定目标。

## 数据模型变更

### `packages/core/src/generator/proxy-group-modules.ts`

在 `ProxyGroupModule` 上新增可选字段：

```ts
export interface ProxyGroupModule {
  // ...existing fields...
  /**
   * 常驻后台规则：标记后该模块不生成代理组、不出现在 UI 核心组列表，
   * 但其规则始终按固定目标写入 rules / rule-providers。
   * target 为 "DIRECT" | "REJECT" 或一个模块 id（如 "select"），运行时解析为组名。
   */
  pinned?: { target: "DIRECT" | "REJECT" | string };
}
```

给三个模块加标记：

```ts
{ id: "private", ..., pinned: { target: "DIRECT" } }
{ id: "cn",      ..., pinned: { target: "DIRECT" } }
{ id: "global",  ..., pinned: { target: "select" } }   // select → 解析为 🚀 节点选择
```

新增导出辅助：

```ts
export const PINNED_MODULE_IDS: ReadonlySet<string> = new Set(
  PROXY_GROUP_MODULES.filter((m) => m.pinned).map((m) => m.id)
);

export function isPinnedModule(moduleId: string): boolean {
  return PINNED_MODULE_IDS.has(moduleId);
}

/**
 * 解析 pinned 模块规则的固定目标字符串。
 * "DIRECT"/"REJECT" 原样返回；否则按模块 id 解析为组名（受 overrides 影响）。
 */
export function resolvePinnedTarget(
  moduleId: string,
  proxyGroupNameOverrides?: Record<string, string>
): string {
  const module = PROXY_GROUP_MODULES.find((m) => m.id === moduleId);
  const target = module?.pinned?.target ?? "DIRECT";
  if (target === "DIRECT" || target === "REJECT") return target;
  return resolveModuleName(target, proxyGroupNameOverrides);
}
```

注：`resolveModuleName` 已从 `./rules` 导出，`proxy-group-modules.ts` 目前不依赖它。为避免循环依赖，把 `resolvePinnedTarget` 放在 `rules.ts`（它已 import `proxy-group-modules`），或在该辅助里做轻量内联查找。决策：放在 `rules.ts`，从那里 re-export。

## 各层改动

### 1. 规则生成 `packages/core/src/generator/rules.ts`

**`buildModuleRuleEntry`**：当前用 `resolveModuleNameFromModule(module, ...)` 作为默认 target，并允许 `edit?.target` 覆盖。为 pinned 模块增加分支：

```ts
const isPinned = isPinnedModule(module.id);
const defaultTarget = isPinned
  ? resolvePinnedTarget(module.id, proxyGroupNameOverrides)
  : resolveModuleNameFromModule(module, proxyGroupNameOverrides);
// pinned 模块忽略 edit.target 与 edit.enabled
const targetName = isPinned
  ? defaultTarget
  : resolveProxyGroupTargetName(edit?.target || defaultTarget, { ... });
```

返回的 entry：`editable: false`、`enabled: true`（pinned 不可关）。

**`buildCanonicalRuleEntries`**：当前 `for (const moduleId of RULE_ORDER)` 内 `if (!enabledSet.has(moduleId)) continue;`。改为：

```ts
const isPinned = isPinnedModule(moduleId);
if (!isPinned && !enabledSet.has(moduleId)) continue;
```

末尾「兜底遍历 PROXY_GROUP_MODULES」同样加 `isPinned || enabledSet.has(...)` 判定。

**`customRuleSets` 重定向**：在 `buildCustomRuleSetEntry` 之前，对 `customRuleSets` 做 target 重写——若 `resolveProxyGroupTargetName(ruleSet.target, ...)` 命中某个 pinned 模块名，则把 target 改为 `resolvePinnedTarget(thatModuleId, ...)`。实现上在 `buildCanonicalRuleEntries` 里预处理一次：

```ts
const pinnedNameToModuleId = new Map(
  PINNED_MODULE_IDS_ARRAY.map((id) => [
    resolveModuleName(id, proxyGroupNameOverrides), id
  ])
);
const remappedCustomRuleSets = customRuleSets.map((rs) => {
  const name = resolveProxyGroupTargetName(rs.target, { moduleNames, customProxyGroups });
  const pinnedId = pinnedNameToModuleId.get(name);
  if (!pinnedId) return rs;
  const pinnedTarget = resolvePinnedTarget(pinnedId, proxyGroupNameOverrides);
  return { ...rs, target: pinnedTarget };
});
```

随后 `customTargetIsDisabled`、`buildOrderedEditableEntries` 都用 `remappedCustomRuleSets`。

**实验性 cn 规则**：`buildCanonicalRuleEntries` 末尾：

```ts
if (Boolean(experimentalCnUseCnRuleSet) && enabledSet.has("cn")) { ... }
```

改为不再追加（pinned `cn` 已常驻 `DIRECT`）。删除该 if 块；`EXPERIMENTAL_CN_RULE` 常量与 UI 入口随 cn 面板消失而失效，保留常量定义以免破坏 import（但 UI 侧的引用随面板移除）。

### 2. 规则提供者 `packages/core/src/generator/proxy-groups.ts` `generateRuleProviders`

当前 `if (!enabledSet.has(proxyModule.id)) continue;`。改为：

```ts
if (!isPinnedModule(proxyModule.id) && !enabledSet.has(proxyModule.id)) continue;
```

实验性 cn provider 块（`experimentalCnUseCnRuleSet && enabledSet.has("cn")`）：删除。

### 3. 代理组生成 `packages/core/src/generator/proxy-groups.ts` `generateProxyGroups`

`PROXY_GROUP_ORDER` 仍含 `private`/`cn`/`global`，循环里已 `if (!enabledSet.has(moduleId)) continue;`。 pinned 模块即便在 `enabledSet` 里也不应产出组，所以加：

```ts
if (isPinnedModule(moduleId)) continue;   // 在 enabledSet 检查前后均可
```

放在 `if (!enabledSet.has(moduleId)) continue;` **之前**，这样即使用户历史配置里勾选了也跳过。

`availableMemberProxyNames` 里 `PROXY_GROUP_MODULES.filter(m => enabledSet.has(m.id))` 会把 pinned 组名带进候选成员列表——需要排除 pinned（否则别的 select 组可能把 `🔒 国内服务` 当作可选成员）。改为 `.filter(m => enabledSet.has(m.id) && !isPinnedModule(m.id))`。

`getAllGroupNames`：同样排除 pinned（它用于规则目标候选，pinned 组不应作为目标）。

`getModulesForTemplate`：保持不变（含这三项无副作用，规则照常、组不产出）。

### 4. UI `packages/ui/src/product/converter/advanced-mode/sections/proxy-groups-categories.tsx`

`modulesByCategory`（:150）已按 `hiddenProxyGroups` 过滤。叠加 pinned 过滤：

```ts
for (const proxyMod of PROXY_GROUP_MODULES) {
  if (hidden.has(proxyMod.id)) continue;
  if (isPinnedModule(proxyMod.id)) continue;   // ← 新增
  ...
}
```

`hiddenModules`（:275，用于「已隐藏」恢复菜单）也要排除 pinned，避免用户看到不存在的项。

`generatedProxyGroupNodeCounts`（:160）调用 `generateProxyGroups`，pinned 组不再产出，无需额外改。

### 5. 类型 `packages/core/src/types/config.ts`

无需新增类型。`pinned` 字段加在 `ProxyGroupModule`（generator 层接口），不进 `SubBoostTemplateConfig`（不持久化）。

## 规则顺序不变性

`RULE_ORDER`（rules.ts:58）保持：`private` 在 `ad` 之后、`gemini`/`ai` 之前；`cn` 在 `ai` 之后、`youtube` 之前；`global` 在末尾。pinned 化不调整顺序，只改「是否启用」与「目标」。这保证：

- 私有网络/LAN 最先匹配（除广告外）。
- 国内域名在海外服务之前命中 → DIRECT。
- `geolocation-!cn` 作为非中国的兜底代理规则，紧贴 `MATCH` 之前。

## 数据流

```
enabledModules (可能含 private/cn/global)
   │
   ├─► generateProxyGroups:  pinned 模块跳过 → 不产出组
   ├─► generateRuleProviders: pinned 模块始终生成 provider
   └─► generateRules
         ├─ RULE_ORDER 遍历: pinned 模块始终进入，目标写死
         ├─ customRuleSets: target 命中 pinned 组名 → 重定向到固定目标
         └─ 实验性 cn 规则: 移除
```

## 兼容性矩阵

| 持久化字段 | 旧行为 | 新行为 |
|---|---|---|
| `enabledProxyGroups` 含 `private`/`cn`/`global` | 产出组 + 规则 | 不产出组；规则照常（固定目标） |
| `hiddenProxyGroups` 含这三项 | 从 UI 隐藏 | 静默忽略（UI 本就不显示） |
| `builtinRuleEdits["module:cn:cn-ip"]` 等 | 改 target/enabled | 忽略（规则固定） |
| `customRuleSets` target = `🔒 国内服务` | 规则进 cn 组 | 重定向 target → `DIRECT` |
| `experimentalCnUseCnRuleSet = true` | 追加实验 cn 规则 → cn 组 | 不追加 |
| `proxyGroupNameOverrides.cn` 等 | 重命名组 | 仍被 `resolveModuleName` 使用（影响 customRuleSets 重定向匹配），但无组可改 |

## 风险与回滚

- **风险 A**：用户依赖 `🔒 国内服务` 组把国内域名走代理（少数反直觉用法）。新行为强制 DIRECT。→ 已与用户确认接受。
- **风险 B**：`customRuleSets` 重定向改变了用户原本「移进 国内服务 → 走该组策略」的语义。→ 新语义：移进 国内服务 ≡ DIRECT，与组的新固定目标一致，语义自洽。
- **回滚**：`pinned` 字段是纯增量；移除三处 `pinned` 标记即回到旧行为。生成器分支用 `isPinnedModule()` 收敛，单点可控。

## 测试策略

- 核心 `rules.test.ts`：
  - 新增「pinned 规则在 enabledModules 为空时仍生成、目标正确」。
  - 新增「pinned 规则忽略 builtinRuleEdits」。
  - 新增「customRuleSets target 命中 pinned 组名 → 重定向」。
  - 调整既有断言：原本期望 `RULE-SET,cn-ip,🔒 国内服务` 的改为 `RULE-SET,cn-ip,DIRECT`；`geolocation-!cn` 目标改为 `🚀 节点选择`。
- 核心 `proxy-groups.test.ts`：
  - 新增「enabledModules 含 private/cn/global 时不产出对应组」。
  - 新增「availableMemberProxyNames 不含 pinned 组名」。
- UI `proxy-groups-categories.test.ts`：新增「核心组列表不含 private/cn/global」。
- 运行 `npm run test:unit`（含 core+ui）全绿。
