<!-- markdownlint-disable MD033 MD041 -->
<div align="center">
  <p><img src="docs/assets/logo.png" alt="SubBoost" width="96"></p>
  <h1>SubBoost · Cloudflare Workers 版</h1>
  <p>
    <img src="https://img.shields.io/badge/platform-Cloudflare%20Workers-F38020.svg" alt="平台：Cloudflare Workers">
    <img src="https://img.shields.io/badge/runtime-D1%20Edge-blue.svg" alt="运行时：D1 边缘数据库">
    <img src="https://img.shields.io/badge/tier-Free%20(%E2%89%A4%203%20MiB)-brightgreen.svg" alt="免费套餐（≤ 3 MiB）">
    <img src="https://img.shields.io/badge/license-AGPL--3.0--only-red.svg" alt="AGPL-3.0-only">
  </p>
</div>
<!-- markdownlint-enable MD033 MD041 -->

**SubBoost** 是一个 **Clash/Mihomo 订阅转换、增强和管理** 工具。本分支专为零成本部署优化，可运行在 **Cloudflare Workers 免费套餐** 上，使用 **D1（SQLite 边缘数据库）** 作为存储。Worker bundle gzip 体积约 **1.66 MiB**，远低于免费版 3 MiB 上限。

> 本分支为 Workers 专用，移除了原 Docker/PostgreSQL 部署路径。需要 Docker 版本请前往上游 [`SubBoost/subboost`](https://github.com/SubBoost/subboost)。

## 亮点

- **订阅转换**：支持订阅链接、YAML 文件和节点链接等多种格式导入。
- **节点管理**：支持批量重命名、删除或配置监听端口。
- **节点筛选**：可在分流组高级模式中按导入源、地区和自定义规则筛选节点。
- **链式代理**：一键可视化配置链式代理和中转代理组。
- **精确分流**：内置 30 多个常用代理组和 2000 多条远程规则集。
- **规则管理**：可修改规则顺序，深度自定义。
- **防 DNS 泄露**：默认基础和 DNS 配置可防止 DNS 泄露。
- **自动刷新**：定时自动刷新订阅，智能匹配节点（Workers Cron 触发）。

## 部署到 Cloudflare Workers（免费版）

### 准备工作

1. 注册 [Cloudflare 账号](https://www.cloudflare.com/)（免费即可）。
2. 安装 [Node.js](https://nodejs.org/) ≥ 22.13.0（建议 24.x LTS）。
3. 克隆仓库并安装依赖：

   ```bash
   git clone https://github.com/Amamiya23/subboost.git
   cd subboost
   npm ci
   ```

### 步骤 1：配置 Wrangler 登录

```bash
cd local
npx wrangler login
```

浏览器会弹出 Cloudflare 授权页，点击 Allow 完成登录。

### 步骤 2：创建 D1 数据库

```bash
# 创建数据库（只需执行一次）
npx wrangler d1 create subboost-db
```

命令会输出类似：

```
✅ Successfully created DB 'subboost-db'
[[d1_databases]]
database_id = "45cb5ac4-5e0f-4656-ac08-b18a8801cf89"
```

把 `database_id` 填入 [`local/wrangler.jsonc`](./local/wrangler.jsonc) 的 `d1_databases[0].database_id` 字段。已存在的占位 ID 需要替换为你自己的。

### 步骤 3：应用数据库 Migration（建表）

```bash
# 应用到生产 D1
npm run db:migrate:d1:remote
```

或先在本地 D1 测试：

```bash
npm run db:migrate:d1:local
```

### 步骤 4：设置 Secrets

需要设置 4 个环境变量。**如果你从 Docker 版本迁移**，必须使用与原部署**完全一致**的 `ENCRYPTION_KEY` 和 `JWT_SECRET`，否则已加密的订阅数据无法解密。

```bash
# 加密密钥：用于加密订阅 URL、节点、配置等敏感字段
# 必须与原 Docker 部署一致（如迁移）；新部署请生成强随机字符串
npx wrangler secret put ENCRYPTION_KEY

# JWT 签名密钥：用于管理员会话 token
# 必须与原 Docker 部署一致（如迁移）；否则已登录用户需重新登录
npx wrangler secret put JWT_SECRET

# Cron 鉴权密钥：保护定时刷新 API
npx wrangler secret put CRON_SECRET

# 应用外部访问 URL：用于生成订阅链接
# 替换成你部署后的 Workers 域名
npx wrangler secret put APP_URL
# 输入例如：https://subboost-local.<your-subdomain>.workers.dev
```

**生成强随机密钥**：

```bash
openssl rand -base64 32
```

### 步骤 5：构建并部署

```bash
npm run deploy:worker
```

部署成功后，输出类似：

```
Deployed subboost-local triggers
  https://subboost-local.<your-subdomain>.workers.dev
  schedule: */5 * * * *
  schedule: 0 3 * * * *
```

### 步骤 6：设置管理员账号

1. 浏览器访问你的 Workers URL。
2. 首次访问会跳转到设置页面，输入管理员用户名和密码。
3. 设置完成后用该账号登录即可使用。

## 从 Docker 版本迁移数据

如果你之前在 Docker/PostgreSQL 上运行过 SubBoost，可以把数据迁移到 D1。

### 导出原数据库

从原 Docker 容器的 PostgreSQL 导出数据为 SQL 文件。例如用 `pg_dump` 或 DBX 等工具导出为 `subboost.sql`。

### 转换并导入

PostgreSQL 的 SQL 与 D1（SQLite）格式有差异，需要转换：

- 去掉 `public.` schema 前缀
- `TRUE`/`FALSE` → `1`/`0`
- 跳过 `_prisma_migrations` 表
- 跳过 `CREATE TABLE`（D1 已通过 migration 建表）

转换后只保留 `INSERT INTO` 语句，然后导入到 D1：

```bash
npx wrangler d1 execute subboost-db --remote --file=path/to/converted.sql
```

**关键提醒**：

- `ENCRYPTION_KEY` 和 `JWT_SECRET` 必须与原 Docker 部署**完全一致**，否则加密的订阅字段无法解密。
- 时间戳格式 `'2026-07-25 16:41:52.945'` 对 SQLite 原生兼容，无需转换。

## Cron 定时任务

部署后，以下两个定时任务会自动运行（定义在 [`local/wrangler.jsonc`](./local/wrangler.jsonc)）：

| 表达式 | 功能 |
|---|---|
| `*/5 * * * *` | 每 5 分钟检查并刷新到期的订阅 |
| `0 3 * * *` | 每天 03:00 UTC 更新远程规则索引 |

Cloudflare Workers 免费套餐每月提供 100,000 次请求和 1,000 次 Cron 触发，完全够个人使用。

## 常用命令速查

```bash
cd local

# 本地开发预览（需先 build:worker）
npm run preview:worker

# 重新构建并部署
npm run deploy:worker

# 仅构建 Worker bundle（不部署）
npm run build:worker

# 查看 D1 数据
npx wrangler d1 execute subboost-db --remote --command='SELECT * FROM LocalAdmin;'

# 应用新的 migration 到远程 D1
npm run db:migrate:d1:remote

# 查看 Worker 实时日志
npx wrangler tail

# 更新某个 secret
npx wrangler secret put ENCRYPTION_KEY
```

## 本地开发

```bash
# 从仓库根目录
npm ci
npm run dev     # Next.js 开发模式（http://127.0.0.1:3001）
```

常用检查：

```bash
npm run lint
npm run test:unit
npm run local:typecheck
```

## 体积优化说明

本分支针对 Workers 免费版做了以下优化：

| 优化项 | gzip 节省 | 说明 |
|---|---|---|
| 移除 Prisma ORM | ~2 MiB | 替换为原生 D1 SQL 查询层（[`local/src/lib/db.ts`](./local/src/lib/db.ts)） |
| icon.png 移到 public/ | ~1.5 MiB | 避免 Next.js metadata 把图片 base64 内联到 Worker bundle |
| `optimizePackageImports` | ~50 KiB | 按需导入 `lucide-react` 图标 |
| 移除 pg 依赖链 | ~200 KiB | 不再需要 PostgreSQL 适配器 |

**结果**：Worker bundle gzip 从 5.75 MiB 降到 **1.66 MiB**，约为免费版上限（3 MiB）的 55%。

## 技术架构

```
浏览器 → Cloudflare Workers (OpenNext) → D1 数据库 (SQLite 边缘存储)
                 ↓
        Cloudflare Cron 触发器
                 ↓
        定时订阅刷新 / 规则索引更新
```

- **框架**：Next.js 16 + OpenNext for Cloudflare
- **数据库**：Cloudflare D1（SQLite 边缘数据库，免费版 5 GB）
- **认证**：`jose`（JWT）+ `bcryptjs`（密码哈希），均为 Workers 兼容
- **加密**：Web Crypto API（v3 格式），支持读取原 Node.js v2 格式加密字段
- **定时任务**：Workers Cron Triggers

## 相关链接

- 上游项目：[SubBoost/subboost](https://github.com/SubBoost/subboost)（Docker/PostgreSQL 版本）
- Cloudflare Workers 文档：[workers.cloudflare.com](https://developers.cloudflare.com/workers/)
- D1 文档：[developers.cloudflare.com/d1](https://developers.cloudflare.com/d1/)

## 开源许可

SubBoost 公开源码以 [GNU Affero General Public License v3.0 only](./LICENSE) 授权。

如果你修改 SubBoost 并通过网络向用户提供服务，AGPL-3.0 要求你向这些用户提供对应源码。

## 免责声明

本项目不提供任何代理服务，不对第三方订阅内容的可用性与合法性作出保证。
