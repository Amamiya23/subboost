# Pin private/cn/global routing rules with fixed targets

## Goal

把 `🏠 私有网络`、`🔒 国内服务`、`🌍 非中国` 三个核心组从「可选分流规则组」中移除，改为「常驻后台规则」：无论用户是否勾选，这些组的规则都默认写入最终 Clash 配置，并写死分流目标，同时不再生成对应的代理组。

## Background

当前行为（已通过代码确认）：

- `packages/core/src/generator/proxy-group-modules.ts:34` 定义了全部模块，`private`/`cn`/`global` 的 `category` 均为 `"core"`。
- 规则生成 `packages/core/src/generator/rules.ts:438` 仅遍历 `enabledModules`：`if (!enabledSet.has(moduleId)) continue;`。未勾选的组，其规则不会出现在最终配置里。
- 代理组生成 `packages/core/src/generator/proxy-groups.ts:452` 同样跳过未启用模块。
- UI `packages/ui/src/product/converter/advanced-mode/sections/proxy-groups-categories.tsx:150` 按 `hiddenProxyGroups` 过滤、按 `category` 分组渲染；核心组可被用户关闭/隐藏。
- 模板校验 `packages/core/src/templates/config-template.ts:29` 的 `BUILTIN_MODULE_IDS` 来自 `PROXY_GROUP_MODULES`，因此保留这三个模块在列表中即可让历史模板通过校验。

用户痛点：只要不勾选这些组，对应域名规则就缺失，访问国内/私有/非中国域名时匹配不到任何规则，只能落到 `MATCH`。期望让这些规则常驻并固定目标。

## Key Decisions（已与用户确认）

| 决策点 | 选择 | 说明 |
|---|---|---|
| `private` 规则目标 | `DIRECT` | 覆盖 LAN/loopback，保持本地网络可达（用户原文写"走代理"，已确认改为直连） |
| `cn` 规则目标 | `DIRECT` | 国内域名走直连 |
| `global`（非中国）规则目标 | `🚀 节点选择` | 受 `proxyGroupNameOverrides` 影响；规则目标解析走 `resolveModuleName("select")` |
| UI 处理 | 完全从高级模式核心组列表移除 | 用户看不到也勾不到 |
| 代理组生成 | 不再为这三个模块生成 proxy-group | 配置里不再出现 🏠/🔒/🌍 组 |
| 历史模板兼容 | 保留模块在 `PROXY_GROUP_MODULES` | `enabledProxyGroups` 含这三项时不报错，只是不再产出组；规则照常常驻 |

## Requirements

### R1 — 常驻规则固定目标

- `private`、`cn`、`global` 三组的规则无论是否在 `enabledModules` 中，都按规范顺序写入 `rules`。
- 目标固定：`private` → `DIRECT`；`cn` → `DIRECT`；`global` → `🚀 节点选择`（受名称覆盖影响）。
- 规则顺序沿用现有 `RULE_ORDER`（`private` 靠前、`cn` 居中、`global` 靠后），保证子域名优先于父规则命中。
- `cn-ip` 规则的 `no-resolve` 仍由 `cnIpNoResolve` 控制（默认 `true`）。

### R2 — 规则提供者常驻

- 这三组规则对应的 `rule-providers` 始终生成，独立于 `enabledModules`。

### R3 — 不再生成代理组

- `generateProxyGroups` 跳过这三个模块：配置 `proxy-groups` 中不出现 `🏠 私有网络`/`🔒 国内服务`/`🌍 非中国`。
- 其它核心组（`select`/`auto`/`ad`/`final`）行为不变。

### R4 — UI 移除

- 高级模式「核心组」分类下不再渲染这三个模块的卡片（既不在列表、也不在「已隐藏」恢复菜单）。
- 用户无法通过 UI 关闭/隐藏/重命名它们。
- 依赖这些模块的次级 UI（`cn` 的实验性 cn 规则、cn 候选子规则、cn-ip no-resolve 开关）随面板一起消失。

### R5 — 向后兼容

- `enabledProxyGroups` 含 `private`/`cn`/`global` 时：不报错、不产出组、规则照常常驻。
- `hiddenProxyGroups` 含这三项时：静默忽略。
- `builtinRuleEdits` 中针对这三组规则的编辑（`module:private:*`、`module:cn:*`、`module:global:*`）：忽略 `enabled`/`target` 改写，规则始终启用且目标固定。
- `customRuleSets` 中 `target` 指向这三个组名（被用户「移动规则」进来）的：重定向到该组的固定目标（`private`/`cn` → `DIRECT`，`global` → `🚀 节点选择`），保留用户原本的分流意图。
- 实验性 `experimentalCnUseCnRuleSet`：该开关原本依赖 `cn` 组，现退役；若 persisted 为 `true`，不再追加实验性 `cn` 规则（避免与常驻 `cn→DIRECT` 重复）。

## Out of Scope

- 不改动其它核心组（`select`/`auto`/`ad`/`final`）行为。
- 不改动 `RULE_ORDER` 的相对顺序，仅改变目标解析与启用判定。
- 不做历史 `builtinRuleEdits` 数据迁移/清理，仅运行时忽略。
- 不调整模板预设（`minimal`/`standard`/`full` 仍可包含这三项，只是不再产出组）。

## Acceptance Criteria

- [ ] 不勾选 `private`/`cn`/`global` 时，生成的 `rules` 仍包含其全部规则，目标分别为 `DIRECT`/`DIRECT`/`🚀 节点选择`。
- [ ] 生成的 `proxy-groups` 不再包含 `🏠 私有网络`/`🔒 国内服务`/`🌍 非中国` 三个组。
- [ ] 生成的 `rule-providers` 始终包含 `private`/`private-ip`/`geolocation-cn`/`cn-ip`/`geolocation-!cn`。
- [ ] 高级模式 UI 核心组列表中看不到这三个模块。
- [ ] 含这三项的历史模板/config 能正常加载并生成配置（不报错）。
- [ ] `customRuleSets` 曾被移进这三个组的规则，重定向到对应固定目标。
- [ ] `npm run lint && npm run typecheck && npm run test:unit` 全绿（核心 + UI 套件）。

## Open Questions

无。所有关键决策已与用户确认。
