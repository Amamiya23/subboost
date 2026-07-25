# Implementation Plan — Cloudflare Workers Deployment

执行顺序按 checkpoint 分组。每个 checkpoint 结束后跑验证命令,通过再进下一组。

## Checkpoint 0 — 前置准备

- [ ] 0.1 在 Cloudflare Dashboard 创建 D1 数据库 `subboost-db`,记录 `database_id`
- [ ] 0.2 创建 `CLOUDFLARE_API_TOKEN`(权限:Workers Scripts:Edit、D1:Edit、Account:Read)
- [ ] 0.3 记录 `CLOUDFLARE_ACCOUNT_ID`
- [ ] 0.4 创建 GitHub repo secrets:`CLOUDFLARE_API_TOKEN`、`CLOUDFLARE_ACCOUNT_ID`

**验证**:无(Dashboard 操作)

---

## Checkpoint 1 — 移除 `node:` 阻塞依赖(无破坏性)

**目标**:让 `packages/server-core` 在 Workers runtime 下也能跑,不引入 Worker 配置

- [ ] 1.1 新建 `packages/server-core/src/crypto/hash.ts`,提供 `sha256Hex(input: string): Promise<string>`(用 `crypto.subtle.digest`)
- [ ] 1.2 改 `packages/server-core/src/app-version.ts`:
  - 第 3 行 `import { createHash } from "node:crypto"` 删除
  - `formatVersionToken` 改为 async,内部 `await sha256Hex(...)`
  - `resolveAppVersionInfo` 改为 async
  - `readPackageVersion` 调用点改为 `await`,且 `cwd` 为空字符串时跳过 fs 探测
- [ ] 1.3 改 `packages/server-core/src/subscription/auto-update-failure.ts`:
  - 第 1 行 `import { createHash }` 删除
  - 第 68 行改 `await sha256Hex(...)`
  - 调用链上游全部 async 传播
- [ ] 1.4 改 `packages/server-core/src/app-version.test.ts`:测试改 async(`async () => { ... await ... }`)
- [ ] 1.5 改 `local/src/lib/subscription-service.ts:1`:`node:crypto.randomUUID` → `globalThis.crypto.randomUUID`
- [ ] 1.6 改 `local/app/layout.tsx:42`:`resolveAppVersionInfo` 改为 await,组件改 async
- [ ] 1.7 改 `local/app/api/releases/latest/route.ts:50`:cwd 用法同步调整

**验证**:
```bash
npm run lint
npm run test:core
npm --workspace @subboost/local run typecheck
```

**回滚点**:Checkpoint 1 提交独立 commit,失败可单独 revert

---

## Checkpoint 2 — crypto v3 重写

**目标**:Web Crypto 替换 v2,Docker 也切到 v3(用户已确认接受 breaking)

- [ ] 2.1 把现 `packages/server-core/src/crypto/encrypted-field.ts` 内容搬到新文件 `encrypted-field-v2.ts`(保留 v2 实现供测试)
- [ ] 2.2 新建 `packages/server-core/src/crypto/encrypted-field-v3.ts`,实现 `encryptEncryptedFieldV3`/`decryptEncryptedFieldV3`(用 `crypto.subtle`,见 design.md §2.1)
- [ ] 2.3 `encrypted-field.ts` 改为 re-export v3,接口签名同步改 `Promise<string>`(导出名保持 `encryptEncryptedFieldV2`/`decryptEncryptedFieldV2` 不变,避免大范围改名 —— 改名为 V3 留待后续清理)
  - 替代方案:直接导出 `encryptEncryptedField`/`decryptEncryptedField`(无版本后缀),旧名作 alias;**选这个**,语义更清晰
- [ ] 2.4 新增 `packages/server-core/src/crypto/encrypted-field-v3.test.ts`:已知输入 + 主密钥 → 期望密文(矢量从 Node 端跑一次 Web Crypto 实现生成)
- [ ] 2.5 改 `local/src/lib/crypto.ts`:所有函数改 `async` 返回 Promise
- [ ] 2.6 全局搜索 `encryptText(`、`decryptText(`、`encryptJson(`、`decryptJson(`、`decryptJsonObject(` 调用点,全部加 `await`
- [ ] 2.7 旧 v2 测试改名为 `encrypted-field-v2.test.ts`,保留矢量

**验证**:
```bash
npm run lint
npm run test:unit
npm --workspace @subboost/local run typecheck
```

**回滚点**:Checkpoint 2 独立 commit

---

## Checkpoint 3 — Prisma schema 调整

- [ ] 3.1 改 `local/prisma/schema.prisma`:
  - 移除 `output = "../src/generated/prisma"`
  - 所有 `@db.Text` 删除(4 处:`LocalTemplate.encryptedConfig`、`Subscription.encryptedUrls/Nodes/Config/SubscriptionInfo`、`SubscriptionAutoUpdateState.failureSourceState`)
  - `datasource db` 的 `provider = "postgresql"` 保留(动态切换由 `prisma.ts` 处理;Prisma schema provider 字段对 driver adapter 模式影响小,但实测 sqlite 与 postgresql 在生成 SQL 时有差异 —— 改为 `provider = "sqlite"` 会让生成的 client 假设 SQLite)
  - **决策**:`provider = "postgresql"` 保留,D1 走 `@prisma/adapter-d1` 时 Prisma 5+ driver adapter 会用 D1 的 SQL 方言
  - **复查点**:若 Prisma 在 D1 上报 SQL 错误,改回双 schema 文件方案
- [ ] 3.2 改所有 `from "../generated/prisma"` → `from "@prisma/client"`(grep 确认调用点)
- [ ] 3.3 `local/src/lib/prisma.ts`:实现运行时双 adapter 检测(见 design.md §2.2)
- [ ] 3.4 新增 `local/prisma/migrations-d1/0000_init/migration.sql`:从现有 Postgres `0000_init` 转换为 SQLite 语法(`TEXT` 代替 `TEXT`、`CURRENT_TIMESTAMP` 不变、`UNIQUE INDEX` 不变)
- [ ] 3.5 新增 `local/prisma/migrations-d1/migration_lock.toml`(provider = sqlite)
- [ ] 3.6 新增 `local/scripts/d1-migrate.cjs`:`child_process` 调用 `wrangler d1 migrations apply subboost-db --local`

**验证**:
```bash
npm --workspace @subboost/local run db:generate
npm --workspace @subboost/local run typecheck
# 本地 D1 migrate
node local/scripts/d1-migrate.cjs
```

**回滚点**:Checkpoint 3 独立 commit

---

## Checkpoint 4 — OpenNext 接入

- [ ] 4.1 `local/package.json` 加依赖:
  - `@opennextjs/cloudflare` (latest)
  - `wrangler` (devDependency)
- [ ] 4.2 `local/next.config.mjs`:
  - 加 `serverExternalPackages: ["@prisma/client", ".prisma/client"]`
  - 保留 `output: "standalone"`(OpenNext 兼容)
- [ ] 4.3 新建 `local/open-next.config.ts`:
  ```ts
  import { defineCloudflareConfig } from "@opennextjs/cloudflare";
  export default defineCloudflareConfig();
  ```
- [ ] 4.4 新建 `local/wrangler.jsonc`(配置见 design.md §1.1):
  - `main: "worker/index.ts"` (OpenNext 会在 build 时处理)
  - 或 `main: ".open-next/worker.js"`(默认),自定义 worker 入口则改用前者
  - **选默认**:用 `.open-next/worker.js`,自定义 scheduled 通过 OpenNext 的 custom worker 模式接入
- [ ] 4.5 新建 `local/worker/index.ts`(见 design.md §2.4)
- [ ] 4.6 新建 `local/worker/scheduled.ts`(见 design.md §2.3)
- [ ] 4.7 `local/tsconfig.json`:确认包含 `worker/**/*.ts`
- [ ] 4.8 `local/package.json` scripts 增加:
  - `"build:worker": "npx opennextjs-cloudflare build"`
  - `"preview:worker": "npm run build:worker && wrangler dev"`
  - `"deploy:worker": "npm run build:worker && wrangler deploy"`

**验证**:
```bash
cd local && npx opennextjs-cloudflare build
npx wrangler deploy --dry-run
```

**回滚点**:Checkpoint 4 独立 commit;失败移除 `wrangler.jsonc`、`open-next.config.ts`、`worker/`

---

## Checkpoint 5 — Cron 重构

- [ ] 5.1 新建 `local/src/lib/cron-jobs.ts`:
  - `runUpdateSubscriptionsJob(env?)`:封装 `runLocalSubscriptionAutoUpdateCron` 调用
  - `runUpdateRuleIndexJob(env?)`:封装 rule-index 路由的业务逻辑
- [ ] 5.2 改 `local/app/api/cron/update-subscriptions/route.ts`:调用 `runUpdateSubscriptionsJob`,保留 auth 中间件
- [ ] 5.3 改 `local/app/api/cron/update-rule-index/route.ts`:同上
- [ ] 5.4 改 `local/worker/scheduled.ts`:根据 `event.cron` 分发到对应 job
- [ ] 5.5 更新 `local/test/cron-route-contract.test.ts`:验证 job 抽取未破坏契约

**验证**:
```bash
npm run test:unit
npm --workspace @subboost/local run typecheck
cd local && npx wrangler dev --test-scheduled
# 另一终端
curl "http://localhost:8787/__scheduled?cron=*/5+*+*+*+*"
```

---

## Checkpoint 6 — 本地端到端验证(Phase 1 完成)

- [ ] 6.1 配置 `local/.dev.vars`(从 `.dev.vars.example` 复制,填测试 secrets)
- [ ] 6.2 `npx wrangler d1 create subboost-db`(本地)
- [ ] 6.3 `node scripts/d1-migrate.cjs`
- [ ] 6.4 `npm run preview:worker`
- [ ] 6.5 手动验证链路:
  - 浏览器访问 `http://localhost:8787`
  - 注册 admin / 登录
  - 创建模板
  - 创建订阅(填假订阅 URL)
  - 列表 / 详情 / 删除
  - 加密字段往返
- [ ] 6.6 触发 scheduled:`curl "http://localhost:8787/__scheduled?cron=*/5+*+*+*+*"`
- [ ] 6.7 跑完整 quality gate:`npm run check:local-app`

---

## Checkpoint 7 — CI/CD 与文档

- [ ] 7.1 新建 `.github/workflows/deploy-cloudflare.yml`:
  ```yaml
  name: Deploy to Cloudflare Workers
  on:
    push:
      branches: [main]
    workflow_dispatch:
  jobs:
    deploy:
      runs-on: ubuntu-latest
      steps:
        - uses: actions/checkout@v4
        - uses: actions/setup-node@v4
          with:
            node-version: 22
            cache: npm
        - run: npm ci
        - run: npm --workspace @subboost/local run build:worker
          env:
            APP_VERSION: ${{ github.sha }}
        - run: npx wrangler deploy
          working-directory: local
          env:
            CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
            CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
  ```
- [ ] 7.2 新建 `local/.dev.vars.example`
- [ ] 7.3 改 `docs/release-notes.md`:新增 "v3 加密格式 breaking change" 段落
- [ ] 7.4 改 `README.md` / `README-CN.md`:新增 "Deploy to Cloudflare Workers" 章节(链接到详细文档或简短步骤)
- [ ] 7.5 新建 `docs/deploy/cloudflare-workers.md`:详细步骤(D1 创建、迁移、secret 配置、域名绑定)

**验证**:
```bash
npm run lint
```

---

## Checkpoint 8 — 首次部署验证(Phase 2 完成)

- [ ] 8.1 推送 PR 到 main 分支
- [ ] 8.2 GitHub Actions 跑通,自动 deploy 到 Cloudflare
- [ ] 8.3 在 staging 子域跑 Phase 1 的所有手动验证链路
- [ ] 8.4 Cloudflare Dashboard → Workers → Crons,确认两个 cron 已注册
- [ ] 8.5 等待 5 分钟,Dashboard → Logs 看 `update-subscriptions` 执行日志
- [ ] 8.6 等待次日 03:00 UTC,看 `update-rule-index` 执行日志
- [ ] 8.7 绑定正式域名
- [ ] 8.8 验证 Docker 路径仍可用:`docker compose -f local/docker-compose.yml up`

---

## 风险登记

| 风险 | 概率 | 影响 | 缓解 |
|---|---|---|---|
| Prisma driver adapter 在 D1 上 schema `provider = "postgresql"` 报错 | 中 | 高 | Checkpoint 3 验证;如失败改双 schema 文件 |
| OpenNext build 把 `@prisma/adapter-d1` 拉进 Docker bundle | 低 | 中 | `require` 动态加载 + webpack ignore |
| Workers CPU 30s 限制被 `update-subscriptions` 超出 | 低 | 中 | Checkpoint 6 监控;如超,拆分 cron |
| 加密接口同步→异步遗漏某处 await | 中 | 中 | `npm run typecheck` 在编译期捕获 |
| OpenNext 自定义 worker 入口与 OpenNext build 产物路径冲突 | 中 | 中 | Checkpoint 4 优先用默认 `.open-next/worker.js` |
| Cloudflare Node 22 兼容性缺失某些 API | 低 | 高 | Checkpoint 6 完整链路验证 |

## Review Gates

- Checkpoint 1 后:async 改造影响面 review
- Checkpoint 2 后:crypto 接口与 v3 矢量 review
- Checkpoint 3 后:schema 变更 review
- Checkpoint 4 后:OpenNext 配置 review
- Checkpoint 6 完成后:Phase 1 完成,可与用户确认是否进 Phase 2
- Checkpoint 8 完成后:任务收尾,触发 `trellis-finish-work`
