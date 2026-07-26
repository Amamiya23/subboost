# Migrate UI to minimal grayscale visual system (v1)

## Goal

把现有「紫色玻璃风」（indigo `#6366f1` + `backdrop-blur-xl` + `rounded-2xl` + 渐变 + 发光）整套替换为 Vercel/Linear 式极简灰阶视觉系统。设计稿：[`design/v1-system.html`](../../../design/v1-system.html)。

## Background

现状（已审查）：
- token 源：`packages/config/tailwind-preset.ts`（`primary` = indigo）+ `packages/ui/src/styles/globals.css`（`--primary`、`glass-card`、`glow-border`、`text-gradient`、`btn-primary` 等 component 类）。
- 核心 UI 原语：`packages/ui/src/components/ui/{button,card,input,badge,switch,dialog,select,tabs,...}.tsx`，多数内嵌 indigo 与 rounded-xl/2xl。
- 散落硬编码：54 个文件直接用 `indigo-*` / `backdrop-blur` / `glass-card` / `rounded-2xl` / `shadow-primary` / `from-indigo` / `to-purple`。

## Key Decisions（已与用户对齐）

| 决策点 | 选择 | 说明 |
|---|---|---|
| 主操作按钮 | 白底黑字（Vercel 反向强调） | `btn-primary`/Button default = `bg-white text-black` |
| 强调色 | 去除 indigo，强调动作 = 白；状态色仅红(REJECT)/绿(active)/琥珀(warning) | `primary` token 退役为中性白系 |
| 卡片 | 实色 surface + hairline 描边，6px 圆角 | 移除 `glass-card`/`glow-border`/`backdrop-blur-xl` |
| 文字 | 无渐变，纯灰阶透明度分级 100/70/45/30 | 移除 `text-gradient` |
| 圆角 | 4/6/8px，默认 6px | `rounded-xl`/`rounded-2xl` → `rounded-md` |
| 焦点环 | 白色低透明 ring，无彩色 | `ring-indigo-500/50` → `ring-white/20` |
| Switch | 开 = 白底，关 = `white/15` | 移除 `primary-500` tint |

## Requirements

### R1 — Token 重定义
- `tailwind-preset.ts`：`primary` 色板改为白系（DEFAULT/500→`#ffffff`，低阶 → 透明灰），保留键名以兼容现有 `primary-*` 引用。
- `globals.css`：`--primary`/`--primary-hover` 改白；`@theme` `--color-primary-*` 同步。
- 移除 `bg-gradient-radial`（radial 紫色背景）。

### R2 — 原语重写
- `button.tsx`：default = 白底黑字；outline/secondary = hairline 描边；ghost 不变；destructive 保留红；link 改 `text-white` underline。
- `card.tsx`：`rounded-2xl` → `rounded-md`，`bg-[#141414]` → `bg-surface`，`border-white/10` 保留。
- `input.tsx` / `textarea.tsx` / `select.tsx`：`rounded-xl` → `rounded`；`focus:ring-indigo-500/50` → `focus:ring-white/20`；`focus:border-indigo-500` → `focus:border-white/20`。
- `badge.tsx`：default = 白系；保留 success/warning/destructive 状态色（降低饱和）。
- `switch.tsx`：checked = `bg-white`，unchecked = `bg-white/15`，移除 indigo border。
- `dialog.tsx`：移除 `glass-card`/`rounded-2xl`，改 `rounded-lg bg-surface border hairline`。
- `tabs.tsx`：ring-indigo → ring-white。

### R3 — Component 类清理
- `globals.css`：删除 `.glass-card`、`.glass-card-hover`、`.glow-border`、`.text-gradient`、`.btn-primary`(紫)、`.tag-accent`；`.custom-scrollbar` 紫色 → 中性灰。

### R4 — 硬编码清扫
- 54 个文件中的 `indigo-*` → 对应 `white` 或 `white/XX`（按语义：强调 = white，激活态 bg = `white/8`，icon accent = `white/60`）。
- `backdrop-blur-xl` / `backdrop-blur-md` / `backdrop-blur-sm` 在卡片/弹层中保留极轻（`backdrop-blur-sm` 用于 sticky header），其余移除。
- `rounded-2xl` → `rounded-md`；`rounded-xl` → `rounded`。
- `shadow-primary-500/*` / `shadow-indigo-*` → 移除或换 `shadow-black/20`。
- `from-indigo*` / `to-purple*` 渐变 → 移除，改实色。

### R5 — 视觉一致性保留
- 状态色（红/绿/琥珀/蓝）保留但降低饱和（border/8 + bg/8-10）。
- emoji 在分组名中保留（产品语义）。
- 既有布局结构、交互逻辑、可访问性不变。

## Out of Scope

- 不改任何业务逻辑、状态管理、API。
- 不改页面信息架构、不增删页面。
- 不动 `packages/core` / `packages/server-core`。
- 不动 Trellis 任务文件。

## Acceptance Criteria

- [ ] `npm run lint` 干净。
- [ ] `npm run local:typecheck` 干净。
- [ ] `npx vitest run` 全绿（视觉改动不应破坏行为测试；snapshot 类断言按需更新）。
- [ ] 关键页面手动核对：首页、转换器快捷模式、转换器高级模式、YAML 预览，无残留紫色/玻璃/渐变。
- [ ] `primary` token 不再是 indigo（grep `#6366f1` 应无业务引用）。

## Open Questions

无（方向已通过设计稿对齐）。
