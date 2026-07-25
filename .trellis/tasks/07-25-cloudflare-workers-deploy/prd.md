# Deploy SubBoost on Cloudflare Workers

## Goal

让 SubBoost (`local` app) 能够部署到 Cloudflare Workers,达到生产可用状态。保留 Docker 部署路径并行可用。

## Background

当前架构(已通过代码审查确认):

- **运行时**:Next.js 16 (App Router) + Node.js 22,`output: "standalone"`,见 `local/next.config.mjs:5`
- **部署方式**:Docker 镜像,见 `local/Dockerfile`,基于 `node:22-alpine`,内含 `prisma migrate deploy` + `node server.js`
- **数据库**:PostgreSQL,通过 `@prisma/adapter-pg`(已在 driver adapters 模式下运行),见 `local/src/lib/prisma.ts:1,11`;schema 见 `local/prisma/schema.prisma`(4 张表:`LocalAdmin`、`LocalTemplate`、`Subscription`、`SubscriptionAutoUpdateState`)
- **加密**:`packages/server-core/src/crypto/encrypted-field.ts:1` 使用 `node:crypto` 的 `createCipheriv`/`createDecipheriv`/`hkdfSync`/`randomBytes`,AES-256-GCM + HKDF,v2 格式 `v2:<ivHex>:<authTagHex>:<encryptedHex>`
- **版本解析**:`packages/server-core/src/app-version.ts:1-3,56` 使用 `node:fs`/`node:path`/`node:crypto:createHash`(可通过 env 覆盖,见 `resolveAppVersionInfo` 的 `readFile`/`cwd` 参数)
- **失败分析**:`packages/server-core/src/subscription/auto-update-failure.ts:1,68` 使用 `createHash("sha256")`
- **UUID**:`local/src/lib/subscription-service.ts:1` 使用 `node:crypto.randomUUID`(Web Crypto 同名 API,易替换)
- **Cron**:两个 POST 路由 `local/app/api/cron/update-subscriptions/route.ts` 和 `update-rule-index/`,使用 `CRON_SECRET` bearer 鉴权(无 Workers Cron 集成)
- **运行时声明**:仅 `local/app/favicon.ico/route.ts:3` 显式 `runtime = "nodejs"`,其余 route 走默认
- **环境变量**:`DATABASE_URL`、`ENCRYPTION_KEY`、`JWT_SECRET`、`APP_URL`、`CRON_SECRET`(见 `local/local.env.example`)

## Key Decisions (已确认)

| 决策点 | 选择 | 影响 |
|---|---|---|
| 数据库方案 | **Workers D1 (SQLite)** | 需要 schema 调整(`@db.Text` 移除);无外部 DB 依赖 |
| 加密兼容性 | **不要求向后兼容,新 v3 格式** | 直接用 Web Crypto 重写,Docker 端同步切换到 v3 |
| Cron 调度 | **Workers Cron Triggers(原生)** | `wrangler.jsonc` 配置 `triggers.crons`,worker 入口添加 `scheduled` handler |
| update-subscriptions 频率 | **每 5 分钟** | 与现有最短刷新间隔对齐 |
| update-rule-index 频率 | **每天 1 次**(由设计阶段决定默认值) | 规则目录变更不频繁 |
| Docker 部署路径 | **并行保留** | crypto 模块单一实现(Web Crypto 在 Node 22 上原生可用),不维护双后端 |
| CI/CD | **GitHub Actions 自动部署** | 推送 `main` 触发 `wrangler deploy`,需要 `CLOUDFLARE_API_TOKEN` secret |
| Next.js 适配 | **OpenNext Cloudflare**(已验证支持 Next.js 16 + driver adapters + scheduled handler) | 通过 `@opennextjs/cloudflare` 包接入 |

## Requirements

### R1 — OpenNext Cloudflare 接入

- `local/` 安装 `@opennextjs/cloudflare` 依赖
- 新增 `local/open-next.config.ts`(默认导出适配器配置)
- 新增 `local/wrangler.jsonc`,包含:
  - `main: ".open-next/worker.js"`
  - `compatibility_flags: ["nodejs_compat"]`
  - `compatibility_date: "2024-12-30"` 或更新
  - `assets.directory: ".open-next/assets"`
  - `services` 自引用绑定
  - D1 数据库绑定(应用业务库)
  - `triggers.crons: ["*/5 * * * *", "0 3 * * *"]` 等
- `local/next.config.mjs` 增加 `serverExternalPackages: ["@prisma/client", ".prisma/client"]`
- 新增 `local/package.json` scripts:`build:worker`、`deploy:worker`、`preview:worker`

**验收**:本地 `wrangler deploy --dry-run` 通过;`npm run preview:worker` 起得来

### R2 — Prisma schema 与 adapter 切换

- `local/prisma/schema.prisma`:
  - 移除 `output = "../src/generated/prisma"`(按 OpenNext 文档要求)
  - 改 `provider = "sqlite"`,业务表 `@db.Text` 注解全部移除(SQLite 无此类型)
  - 保留 `cuid()`、`@updatedAt`、`@default(now())`(在 Prisma 层处理,跨 DB 通用)
- `local/src/lib/prisma.ts`:运行时检测,D1 绑定存在时用 `PrismaD1`,否则回退 `PrismaPg`(保留 Docker 路径)
- 业务代码的 `from "../generated/prisma"` 改为 `from "@prisma/client"`
- 新增 `local/prisma/migrations-d1/` 目录,记录 SQLite 迁移(与 Postgres 迁移隔离)
- 新增 `local/scripts/d1-migrate.cjs`(用 `wrangler d1 migrations apply` 包装)

**验收**:`wrangler d1 migrations apply --local` 成功;`curl /api/health` 返回 db ok

### R3 — crypto v3(Web Crypto 重写)

- 新文件 `packages/server-core/src/crypto/encrypted-field-v3.ts`:
  - 使用 `crypto.subtle.deriveBits`(HKDF)+ `crypto.subtle.encrypt/decrypt`(AES-256-GCM)
  - 格式 `v3:<ivHex>:<tagHex>:<dataHex>`,与 v2 字段顺序一致(便于人类阅读)
  - `crypto.getRandomValues` 生成 IV
  - 输入/输出接口与 v2 一致
- `packages/server-core/src/crypto/encrypted-field.ts` 改为 re-export v3 实现;v2 实现保留到 `encrypted-field-v2.ts`(供测试和潜在回滚)
- `packages/server-core/src/crypto/encrypted-field.test.ts` 新增 v3 矢量(已知输入→期望密文)
- 不写 v2↔v3 跨格式解密

**验收**:原有测试套件除明确 v2 二进制矢量外全部通过;新增 v3 测试通过

### R4 — 移除 `node:` 阻塞依赖

- `packages/server-core/src/app-version.ts`:把 `createHash("sha256")` 替换为 `crypto.subtle.digest`(异步);`readFileSync`/`join` 路径改为当 `cwd` 为空时跳过 fs 探测,只用 env
- `packages/server-core/src/subscription/auto-update-failure.ts:68`:`createHash` 替换为 `crypto.subtle.digest` 封装工具
- 新增 `packages/server-core/src/crypto/hash.ts` 提供统一 `sha256Hex(input: string): Promise<string>` 工具,所有原 `createHash` 调用点改用此工具
- `local/src/lib/subscription-service.ts:1`:`randomUUID` 改用 `globalThis.crypto.randomUUID()`(Node 22 和 Workers 都原生支持)
- `local/app/layout.tsx:42`:由于 `resolveAppVersionInfo` 异步化,改为 await

**验收**:`npm run lint && npm run typecheck` 全绿;`packages/server-core` 在 Workers runtime 下无 `node:` import

### R5 — Workers Cron Triggers 接入

- 新文件 `local/worker/scheduled.ts`:导出 `scheduled(event, env, ctx)` handler,根据 `event.cron` 字符串分发到 `runLocalSubscriptionAutoUpdateCron` 或 `runLocalRuleIndexUpdate`
- 将两个 cron route 的 POST 业务逻辑抽取到 `local/src/lib/cron-jobs.ts` 的纯函数 `runUpdateSubscriptionsJob()` / `runUpdateRuleIndexJob()`,route handler 和 scheduled handler 共用
- `local/app/api/cron/*/route.ts` 保留(便于 Docker 路径下用外部 cron 调用)
- 新文件 `local/worker/index.ts`:OpenNext 自定义 worker 入口,re-export `.open-next/worker.js` 的 fetch,并附加 `scheduled`
- `local/wrangler.jsonc` 的 `triggers.crons`:
  - `"*/5 * * * *"` → update-subscriptions
  - `"0 3 * * *"` → update-rule-index(每天 03:00 UTC)
- 鉴权:scheduled handler 内部直接调用,不走 `requireLocalCronAuth`;HTTP route 保留鉴权

**验收**:`wrangler dev --test-scheduled` + `curl /__scheduled?cron=*/5+*+*+*+*` 触发,日志可见 cron 执行

### R6 — 环境变量与 secrets

- 新增 `.dev.vars.example`(列出 `ENCRYPTION_KEY`、`JWT_SECRET`、`APP_URL`、`CRON_SECRET`)
- 文档说明 `wrangler secret put` 用法
- `local/src/lib/env.ts`:适配 Workers(`process.env` 在 OpenNext 下可用,但文档化推荐 binding 形式)

**验收**:secrets 配置后,登录、加密、订阅刷新链路全通

### R7 — GitHub Actions 部署工作流

- 新文件 `.github/workflows/deploy-cloudflare.yml`:
  - 触发:`push` 到 `main`,手动 `workflow_dispatch`
  - Steps:`setup-node 22` → `npm ci` → `npm run build:worker` → `wrangler deploy`
  - Secrets:`CLOUDFLARE_API_TOKEN`、`CLOUDFLARE_ACCOUNT_ID`
- README 增加 "Deploy to Cloudflare Workers" 章节(中英两份)

**验收**:推送到 main 自动部署成功;手动触发也成功

### R8 — Docker 路径不破坏

- `local/Dockerfile`、`local/docker-compose*.yml`、`local/scripts/start-standalone.cjs` 保持可用
- 加密切换到 v3 后,Docker 部署用户启动后旧密文无法解密(已在 Key Decisions 接受);在 `docs/release-notes.md` 显著标注 breaking change 与"如何重置数据"说明

**验收**:`npm run check:local-app` 通过;Docker 镜像 build + run 仍可拉起

## Out of Scope

- 改动业务逻辑、UI、订阅转换核心算法
- 改动 `packages/core`(纯函数库,无 Node API 依赖)
- 多区域 / Edge 分布式部署优化
- 现有 v2 密文数据迁移工具
- 旧 Postgres → D1 的数据迁移脚本(用户接受新部署新数据)

## Acceptance Criteria

### Phase 1 — PoC(本地验证)

- [ ] `cd local && npx wrangler deploy --dry-run` 成功
- [ ] `npx wrangler dev` 起来后,以下链路手动验证通过:
  - [ ] `/api/health` 返回 ok
  - [ ] `/login` 登录流程通过
  - [ ] 创建订阅 → 列表 → 删除
  - [ ] 加密字段能写入和读出(D1 持久化)
- [ ] `npm run lint && npm run typecheck && npm run test:unit` 全绿
- [ ] `curl /__scheduled?cron=*/5+*+*+*+*` 触发 scheduled handler,日志正常

### Phase 2 — Production

- [ ] GitHub Actions `deploy-cloudflare.yml` 推送 main 自动部署成功
- [ ] 生产 D1 数据库已 `migrations apply`,生产 secrets 已 `wrangler secret put`
- [ ] 自定义域名绑定并通过 HTTPS 访问
- [ ] Cron Triggers 在 Cloudflare 仪表盘可见,定时触发日志正常
- [ ] Docker 部署路径仍可用(`docker compose up` 起得来)
- [ ] `docs/release-notes.md` 记录 v3 加密 breaking change

## Open Questions

无阻塞性问题。`update-rule-index` cron 频率默认值 `0 3 * * *`(每天 03:00 UTC)可在 review 时调整。
