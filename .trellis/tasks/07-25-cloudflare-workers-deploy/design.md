# Technical Design — Cloudflare Workers Deployment

## 1. Architecture

### 1.1 部署拓扑

```
┌──────────────────────────────────────────────────────────────┐
│ Cloudflare Edge                                              │
│                                                              │
│   wrangler.jsonc                                             │
│   ┌─────────────────────────────────────────────────────┐    │
│   │ Worker (subboost-local)                             │    │
│   │   ├── fetch handler  ← OpenNext (.open-next/worker) │    │
│   │   └── scheduled      ← worker/scheduled.ts          │    │
│   │                                                     │    │
│   │ Bindings:                                           │    │
│   │   ├── DB: D1 (subboost-db)                          │    │
│   │   ├── ASSETS: .open-next/assets                     │    │
│   │   └── WORKER_SELF_REFERENCE                         │    │
│   │ Secrets:                                            │    │
│   │   ├── ENCRYPTION_KEY                                │    │
│   │   ├── JWT_SECRET                                    │    │
│   │   └── CRON_SECRET (HTTP route only)                 │    │
│   │ Triggers:                                           │    │
│   │   ├── */5 * * * *   → update-subscriptions          │    │
│   │   └── 0 3 * * *     → update-rule-index             │    │
│   └─────────────────────────────────────────────────────┘    │
│                                                              │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│ Docker (并行保留,默认开发/现有部署)                          │
│   Node 22 + Postgres + Prisma adapter-pg                     │
│   └── cron 由外部调度器(Vercel cron / system cron)POST 路由  │
└──────────────────────────────────────────────────────────────┘
```

### 1.2 包依赖关系

```
local (Next.js app)
 ├── @subboost/core          (无变更)
 ├── @subboost/config        (无变更)
 ├── @subboost/ui            (无变更)
 ├── @subboost/server-core   (crypto v3 重写, hash 工具, app-version 异步化)
 ├── @prisma/client          (从 ../generated/prisma 改为此处)
 ├── @prisma/adapter-pg      (Docker 路径)
 ├── @prisma/adapter-d1      (新增,Workers 路径)
 └── @opennextjs/cloudflare  (新增,Workers 构建适配)
```

## 2. Data Flow & Contracts

### 2.1 加密 v3 格式

```
v3:<ivHex>:<tagHex>:<dataHex>
    │       │        └─ AES-256-GCM 密文 (hex)
    │       └─ 认证 tag,16 字节 (hex)
    └─ IV,12 字节 (hex)
```

派生:`key = HKDF-SHA256(masterKey, salt="subboost:encrypted-field:v3", info="subboost:aes-256-gcm:v3", length=32)`

加密:`ciphertext, tag = AES-256-GCM(key, iv, plaintext)`(Web Crypto 把 tag 拼到密文末尾,需要手动拆最后 16 字节)

Web Crypto 实现:

```ts
async function deriveV3Key(masterKey: string): Promise<CryptoKey> {
  const baseKey = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(masterKey),
    "HKDF",
    false,
    ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: new TextEncoder().encode("subboost:encrypted-field:v3"),
      info: new TextEncoder().encode("subboost:aes-256-gcm:v3"),
    },
    baseKey,
    256
  );
  return crypto.subtle.importKey("raw", bits, "AES-GCM", false, [
    "encrypt",
    "decrypt",
  ]);
}

export async function encryptEncryptedFieldV3(
  plaintext: string,
  masterKey: string
): Promise<string> {
  const key = await deriveV3Key(masterKey);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv, tagLength: 128 },
      key,
      new TextEncoder().encode(plaintext)
    )
  );
  const tag = encrypted.slice(encrypted.length - 16);
  const data = encrypted.slice(0, encrypted.length - 16);
  return [
    "v3",
    toHex(iv),
    toHex(tag),
    toHex(data),
  ].join(":");
}
```

接口签名从同步改为 `Promise<string>`,所有调用点(`local/src/lib/crypto.ts`、相关 service)需要 await 链式传播。

### 2.2 Prisma 客户端选择

```ts
// local/src/lib/prisma.ts
import { PrismaClient } from "@prisma/client";

declare global {
  const D1: D1Database | undefined;  // Workers binding
}

function createPrismaClient(): PrismaClient {
  if (typeof D1 !== "undefined") {
    const { PrismaD1 } = require("@prisma/adapter-d1");
    return new PrismaClient({ adapter: new PrismaD1(D1) });
  }
  const { PrismaPg } = require("@prisma/adapter-pg");
  const url = process.env.DATABASE_URL || "postgresql://...";
  return new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
}
```

`require` 而非 `import`:避免在 Docker 构建时把 `@prisma/adapter-d1` 拉进 bundle(`@prisma/adapter-d1` 依赖 `workers:Contracts`,只有 Workers 环境有)。

### 2.3 Scheduled Handler 契约

```ts
// local/worker/scheduled.ts
import { runUpdateSubscriptionsJob, runUpdateRuleIndexJob } from "./cron-jobs";

export async function scheduled(
  event: ScheduledEvent,
  env: Env,
  ctx: ExecutionContext
): Promise<void> {
  if (event.cron === "*/5 * * * *") {
    ctx.waitUntil(runUpdateSubscriptionsJob(env));
  } else if (event.cron === "0 3 * * *") {
    ctx.waitUntil(runUpdateRuleIndexJob(env));
  }
}
```

`cron-jobs.ts` 是从两个 `route.ts` 抽取出的纯函数(接收 env,不依赖 request/auth),route 和 scheduled 复用。

### 2.4 Worker 入口

```ts
// local/worker/index.ts
// @ts-ignore — generated by OpenNext build
import worker from "../.open-next/worker.js";
import { scheduled } from "./scheduled";

export default {
  fetch: worker.fetch,
  scheduled,
} satisfies ExportedHandler<Env>;
```

`wrangler.jsonc` 的 `main` 指向 `local/worker/index.js`(编译后)。

## 3. 关键变更点(file:line 锚定)

| 文件 | 变更类型 | 描述 |
|---|---|---|
| `local/prisma/schema.prisma:1-8` | 改 | 移除 `output`,`provider = "sqlite"`,所有 `@db.Text` 删除 |
| `local/prisma/migrations-d1/` | 新增 | D1 单独迁移目录,避免与 Postgres 迁移混淆 |
| `local/src/lib/prisma.ts:1-23` | 改 | 双 adapter 运行时检测,`require` 动态加载 |
| `local/src/lib/crypto.ts:1-28` | 改 | 函数返回 `Promise`,所有调用点 await |
| `local/src/lib/subscription-service.ts:1` | 改 | `node:crypto.randomUUID` → `globalThis.crypto.randomUUID` |
| `local/src/lib/cron-jobs.ts` | 新增 | 从 cron route 抽取的纯函数 |
| `local/app/api/cron/*/route.ts` | 改 | 调用 `cron-jobs.ts` 的共用函数 |
| `local/app/layout.tsx:42` | 改 | `resolveAppVersionInfo` 异步化后改为 await |
| `local/next.config.mjs` | 改 | 加 `serverExternalPackages`,删 `output: "standalone"` 改条件判断 |
| `local/open-next.config.ts` | 新增 | OpenNext 适配器默认配置 |
| `local/worker/index.ts` | 新增 | 自定义 worker 入口(fetch + scheduled) |
| `local/worker/scheduled.ts` | 新增 | Cron Trigger 分发 |
| `local/wrangler.jsonc` | 新增 | Worker 配置 + D1 绑定 + Cron |
| `local/.dev.vars.example` | 新增 | 本地开发 secrets 模板 |
| `local/scripts/d1-migrate.cjs` | 新增 | `wrangler d1 migrations apply` 包装 |
| `local/package.json` scripts | 改 | 加 `build:worker`、`deploy:worker`、`preview:worker`、`db:migrate:d1` |
| `packages/server-core/src/crypto/encrypted-field.ts` | 改 | re-export v3 实现 |
| `packages/server-core/src/crypto/encrypted-field-v2.ts` | 新增 | 原 v2 代码搬入(测试与回滚用) |
| `packages/server-core/src/crypto/encrypted-field-v3.ts` | 新增 | Web Crypto 实现 |
| `packages/server-core/src/crypto/hash.ts` | 新增 | `sha256Hex` 工具 |
| `packages/server-core/src/app-version.ts:1-3,56,92-118` | 改 | fs 探测改为可选,digest 改用 Web Crypto |
| `packages/server-core/src/subscription/auto-update-failure.ts:1,68` | 改 | `createHash` → `sha256Hex` |
| `.github/workflows/deploy-cloudflare.yml` | 新增 | CI/CD |
| `docs/release-notes.md` | 改 | 记录 v3 加密 breaking change |
| `README.md` / `README-CN.md` | 改 | 增加 Workers 部署章节 |

## 4. Schema 迁移影响分析

| Schema 元素 | Postgres 行为 | SQLite (D1) 行为 | 处理 |
|---|---|---|---|
| `@default(cuid())` | JS 层生成 | JS 层生成 | 无影响 |
| `@updatedAt` | JS 层生成 | JS 层生成 | 无影响 |
| `@default(now())` | DB 层 `CURRENT_TIMESTAMP` | DB 层 `CURRENT_TIMESTAMP` | 无影响 |
| `@db.Text` | `TEXT` 类型 | 不存在 | 全部移除,SQLite 默认 TEXT,PG 仍为 TEXT |
| `String @unique` | VARCHAR + unique index | TEXT + unique index | 无影响 |
| Prisma transaction `$transaction([..])` | 支持 | Prisma D1 adapter executes individual queries | 单管理员场景可用;严格并发原子性要求改用 Docker/PostgreSQL |

**结论**:schema 变更安全,不破坏 Docker 端 Postgres 行为。

## 5. 兼容性 & Trade-offs

### 5.1 选择 Web Crypto 单一实现的理由

- Node 22+ 原生提供 `globalThis.crypto.subtle`,Docker 路径无破坏
- 避免维护 `node:crypto` vs Web Crypto 双后端
- 加密格式 v3 在两端一致,跨部署数据可读(虽然不打算跨部署迁移)
- 代价:`encryptText` 等接口同步→异步,需链式 await;但调用层数有限(<10 处)

### 5.2 选择 D1 单独 migrations 目录的理由

- Prisma migrations 包含 DB-specific SQL(`CREATE TABLE "LocalAdmin"` for PG,vs D1 期望不同语法)
- 不让两套 SQL 互相污染;Postgres 迁移保留给 Docker 路径
- 代价:同一 schema 产生两套迁移,需要双向维护(本次 schema 稳定,可接受)

### 5.3 Cron 鉴权策略

- HTTP route 保留 `requireLocalCronAuth`(供 Docker 路径下外部调度)
- Workers scheduled handler 内部直接调用 job 函数,跳过 HTTP auth
- Trade-off:Workers 上若同时保留 HTTP route 暴露,仍需鉴权(防止外部未授权调用),已实现

### 5.4 Workers CPU 时间风险

- `update-subscriptions` 单次执行涉及多订阅网络拉取 + 解析 + 加密 + 写库
- Workers 付费版限制:30s CPU / 单请求,Wall time 不限
- 单 cron 触发预计 wall time 远超 30s(网络 IO 等待),CPU 时间预计 < 5s
- 风险:大量订阅用户时可能超 CPU 上限
- 缓解:Phase 1 监控 CPU 时间;若超出,Phase 2 拆分为多个 cron trigger 时段或用 Durable Objects 编排

## 6. Rollback / Rollout

### 6.1 Rollback 路径

- Cloudflare Dashboard → Workers → 选择版本回滚(每次 `wrangler deploy` 都有版本快照)
- GitHub Actions 失败不影响生产(`wrangler deploy` 是原子的)
- 极端情况:回滚到 Docker 部署(路径仍可用)

### 6.2 Rollout 顺序

1. 合并 PR 但不部署(GitHub Actions 仅在 main 触发)
2. 本地 `npm run preview:worker` 全量验证
3. 部署到 Cloudflare(自定义子域 staging)
4. 跑生产 D1 migrations
5. 配置生产 secrets
6. 绑定正式域名,DNS 切换
7. 监控 24h 后下线旧部署(若存在)

## 7. 不引入的东西

- **不引入** KV:数据全部走 D1
- **不引入** R2:OpenNext 的 incremental cache Phase 1 用内存,D1 数据量小
- **不引入** Durable Objects:CPU 时间风险可控时不引入
- **不引入** Workers Logs:用 Cloudflare 内置 logging
- **不引入** Postgres → D1 数据迁移工具:用户接受新部署新数据
