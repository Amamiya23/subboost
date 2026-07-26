# Implementation Plan — UI v1 visual system migration

杠杆式迁移：先 token（自动级联），再原语（结构性变化），再硬编码清扫（消除残留）。

## Wave 1 — Token 重定义（最大杠杆）

- [ ] `packages/config/tailwind-preset.ts`：`primary` 色板重写为白系（保留键名兼容）；移除 `gradient-radial` 紫背景。
- [ ] `packages/ui/src/styles/globals.css`：
  - `--primary` / `--primary-hover` → 白系。
  - `@theme --color-primary-*` → 白系/灰阶。
  - 删 `.glass-card` / `.glass-card-hover` / `.glow-border` / `.text-gradient` / `.btn-primary`(紫) / `.tag-accent`。
  - `.custom-scrollbar` 颜色 indigo → 中性灰。
  - 保留 `bg-gradient-radial` 类但移除其紫色定义（或删类）。

**验证**：`npm run local:typecheck`；grep `#6366f1` 应仅剩历史注释。

## Wave 2 — 核心 UI 原语

按调用频次顺序，每个文件单独改：

- [ ] `button.tsx`：default 白底黑字；outline/secondary hairline；link 改白；移除 `shadow-primary`/`rounded-xl`→`rounded-md`。
- [ ] `card.tsx`：`rounded-2xl`→`rounded-md`，`bg-[#141414]`→用 token。
- [ ] `input.tsx` + `textarea.tsx` + `select.tsx`：`rounded-xl`→`rounded`，indigo ring/border → `white/20`。
- [ ] `badge.tsx`：default 白系；状态色降饱和。
- [ ] `switch.tsx`：checked 白，unchecked `white/15`，去 indigo。
- [ ] `dialog.tsx`：去 `glass-card`/`rounded-2xl`，改 hairline surface。
- [ ] `tabs.tsx`：indigo ring → white。
- [ ] `dropdown-menu.tsx` / `toaster.tsx` / `confirm-dialog.tsx`：清 indigo。
- [ ] 其余 `components/ui/*`（accordion/select-content 等）：扫一遍补齐。

**验证**：`npm run lint`；启动 dev server 抽查首页与转换器。

## Wave 3 — 产品文件硬编码清扫

按目录分批 sed-style 替换（用 `edit` 工具，非 shell sed）：

- [ ] `components/layout/{header,footer,mobile-nav}.tsx`：indigo nav active、blur、渐变 avatar。
- [ ] `components/auth/user-menu.tsx`：avatar 渐变、菜单 `rounded-2xl`+glass。
- [ ] `components/subscription/smart-node-matching-help.tsx`。
- [ ] `product/converter/sections/*`：section-header icon、input-section、node-input-section 的 indigo 选择态。
- [ ] `product/converter/quick-mode/*`：templates-section 的 indigo 选中边框。
- [ ] `product/converter/advanced-mode/section-header.tsx` + `sections/*`：proxy-group-* 的 indigo accent（约 15 个文件，批量）。
- [ ] `product/preview/*`：visual-graph 节点色、yaml-preview-editor 的 blur。
- [ ] `product/home/*`：home-layout 的 indigo badge、subscription-link-dialog icon。

替换规则：
- `text-indigo-{300,400}` → `text-white/{70,60}`（按对比度需要）
- `bg-indigo-500/{10,15,20}` → `bg-white/{8,10,12}`
- `border-indigo-500/*` → `border-white/{15,20}`
- `ring-indigo-500/50` → `ring-white/20`
- `from-indigo-500 to-purple-600`（avatar 渐变）→ `bg-white/15`
- `backdrop-blur-xl`（卡片/弹层）→ 移除或 `backdrop-blur-sm`（sticky header 保留）

## Wave 4 — 验证与收尾

- [ ] `npm run lint`
- [ ] `npm run local:typecheck`
- [ ] `npx vitest run`
- [ ] grep 残留：`indigo-`, `glass-card`, `glow-border`, `text-gradient`, `#6366f1`, `backdrop-blur-xl`，逐一确认或清理。
- [ ] dev server 抽查关键页面截图（如可用）。

## Rollback Points

- Wave 1 后若 token 级联导致大面积颜色异常：回退 preset 即可。
- Wave 2/3 每个文件独立改，可单独 revert。
- 全程不动业务逻辑，行为测试失败 = 视觉断言失效，按需更新而非回退。
