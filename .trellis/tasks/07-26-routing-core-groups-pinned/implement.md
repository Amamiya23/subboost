# Implementation Plan — Pin private/cn/global routing rules

执行顺序自上而下。每个 step 标注验证命令；阶段末跑全量 lint/typecheck/test。

> **Status: 已完成。** 全量 `npm run lint` / `npm run local:typecheck` / `npx vitest run`（1088 用例）全绿。
> 与初版设计的偏差：实验性 `cn` 规则未删除，改为 retarget 到 pinned 目标（DIRECT）并放宽触发条件（不再要求 `enabledSet.has("cn")`），保留用户既有 opt-in。
> 额外 UI 收尾：`buildManualRuleTargets` 与三处 `visibleProxyGroupModules`（module-rules-panel / rules-library / added-rule-sets）以及 section 头部计数均排除 pinned，避免残留的「移动到 国内服务」目标与计数失真。

## Step 1 — 数据模型：pinned 字段与辅助函数

文件：`packages/core/src/generator/proxy-group-modules.ts`

- [ ] `ProxyGroupModule` 接口新增 `pinned?: { target: string }`。
- [ ] 给 `private`（target `DIRECT`）、`cn`（target `DIRECT`）、`global`（target `select`）加 `pinned`。
- [ ] 导出 `PINNED_MODULE_IDS: ReadonlySet<string>` 与 `isPinnedModule(id)`。

文件：`packages/core/src/generator/rules.ts`

- [ ] 新增并导出 `resolvePinnedTarget(moduleId, overrides?)`：`DIRECT`/`REJECT` 原样返回，否则 `resolveModuleName(target, overrides)`。
- [ ] 从 `proxy-group-modules` re-export `isPinnedModule`、`PINNED_MODULE_IDS`（或直接从 `proxy-groups.ts` 的 re-export 链路）。

验证：`npm run typecheck -w packages/core`

## Step 2 — 规则生成：常驻 + 固定目标 + 忽略编辑

文件：`packages/core/src/generator/rules.ts`

- [ ] `buildModuleRuleEntry`：pinned 分支——`defaultTarget = resolvePinnedTarget(...)`；忽略 `edit?.target`；返回 `enabled: true, editable: false`。
- [ ] `buildCanonicalRuleEntries` 的 `RULE_ORDER` 循环与末尾兜底循环：`isPinned || enabledSet.has(id)` 才跳过 enabled 检查。
- [ ] `customRuleSets` 预处理：构建 `pinnedNameToModuleId` map，target 命中则改写为 `resolvePinnedTarget`。
- [ ] 删除实验性 cn 规则追加块（`if (experimentalCnUseCnRuleSet && enabledSet.has("cn"))`）。

验证：`npm run test:unit -- packages/core/src/generator/rules.test.ts`

## Step 3 — 规则提供者与代理组生成

文件：`packages/core/src/generator/proxy-groups.ts`

- [ ] `generateRuleProviders`：`if (!isPinnedModule(id) && !enabledSet.has(id)) continue;`；删除实验性 cn provider 块。
- [ ] `generateProxyGroups`：`PROXY_GROUP_ORDER` 循环在 enabled 检查前加 `if (isPinnedModule(moduleId)) continue;`。
- [ ] `availableMemberProxyNames`：filter 增加 `&& !isPinnedModule(m.id)`。
- [ ] `getAllGroupNames`：filter 增加 `&& !isPinnedModule(m.id)`。

验证：`npm run test:unit -- packages/core/src/generator/proxy-groups.test.ts`

## Step 4 — UI 移除

文件：`packages/ui/src/product/converter/advanced-mode/sections/proxy-groups-categories.tsx`

- [ ] `modulesByCategory` 循环：`if (isPinnedModule(proxyMod.id)) continue;`。
- [ ] `hiddenModules`：filter 增加 `!isPinnedModule`。
- [ ] import `isPinnedModule` from `@subboost/core/generator/proxy-groups`（或 rules）。

验证：`npm run test:unit -- packages/ui/src/product/converter/advanced-mode/sections/proxy-groups-categories.test.ts`

## Step 5 — 测试更新

按设计文档「测试策略」：

- [ ] `packages/core/src/generator/rules.test.ts`：调整既有断言（cn-ip→DIRECT、global→🚀 节点选择）；新增 pinned 常驻、忽略 edits、customRuleSets 重定向用例。
- [ ] `packages/core/src/generator/proxy-groups.test.ts`：新增 pinned 不产出组、成员列表不含 pinned 组名。
- [ ] `packages/ui/src/product/converter/advanced-mode/sections/proxy-groups-categories.test.ts`：核心组列表不含 private/cn/global。
- [ ] 其它失败用例（`proxy-groups-module-rules-panel.test.ts`、`proxy-groups-section.test.ts` 等引用 cn/global 的）按新行为修正。

## Step 6 — 全量验证（Review Gate）

- [ ] `npm run lint`
- [ ] `npm run typecheck`
- [ ] `npm run test:unit`
- [ ] 手动 sanity：用 `generateClashConfig` 跑一个最小 config（`enabledGroups: ["select","final"]`），确认 rules 含 private/cn/global 规则、proxy-groups 不含三组。

## Rollback Points

- Step 1 后若 typecheck 红：检查 `pinned` 字段是否漏标可选 / 循环依赖。
- Step 2/3 后若测试大面积红：先修正断言（多数是目标名变更），不要回退生成逻辑。
- 任一步骤可单独 revert `pinned` 标记即可回到旧行为。
