# 部署到 Cloudflare Workers

此部署方案使用 OpenNext Cloudflare、Cloudflare D1 和 Workers Cron Triggers。现有的 Docker 部署路径仍然可用，但 Worker 部署会使用新的 D1 数据库。

## 前置条件

- 已启用 Workers 和 D1 的 Cloudflare 账户。
- Node.js `22.13.0` 至 `22.x`，或 Node.js `24+`。
- 一个干净的数据库。Workers 使用 Web Crypto v3 加密，不会读取现有的 v2 加密字段，也不会迁移 PostgreSQL 数据。

## 创建 D1

安装依赖，然后创建生产数据库：

```bash
npm ci
npx wrangler d1 create subboost-db
```

将返回的数据库 ID 填入 `local/wrangler.jsonc`，替换其中的 `REPLACE_WITH_D1_DATABASE_ID`。数据库 ID 不属于机密信息，应与部署配置一起提交到版本库。

应用项目中包含的 D1 迁移：

```bash
npm --workspace @subboost/local run db:migrate:d1:remote
```

## 配置 Secrets

将所有应用配置设置为 Worker secret：

```bash
cd local
npx wrangler secret put ENCRYPTION_KEY
npx wrangler secret put JWT_SECRET
npx wrangler secret put CRON_SECRET
npx wrangler secret put APP_URL
```

为 `ENCRYPTION_KEY`、`JWT_SECRET` 和 `CRON_SECRET` 使用密码学安全的随机值。将 `APP_URL` 设置为最终的公开 HTTPS 地址，例如 `https://subboost.example.com`。

## 部署

构建兼容 D1 的 Prisma 客户端，构建 OpenNext Worker，然后进行部署：

```bash
npm --workspace @subboost/local run deploy:worker
```

如需本地预览，请先将 `local/.dev.vars.example` 复制为 `local/.dev.vars`，填入仅用于本地的 secret，然后运行：

```bash
npm --workspace @subboost/local run db:migrate:d1:local
npm --workspace @subboost/local run preview:worker
```

预览服务监听 `http://127.0.0.1:8787`。使用应用前，请访问 `/api/health/ready` 检查服务是否就绪。

## D1 事务语义

Prisma D1 adapter 当前会将 Prisma 事务 API 作为独立查询执行。此部署方案适用于 SubBoost 的单管理员工作流，但无法为并发多写操作提供严格的原子性保证。如有此类保证要求，请使用 Docker/PostgreSQL 部署路径。

## 定时任务

Workers Cron Triggers 配置在 `local/wrangler.jsonc` 中：

- `*/5 * * * *`：刷新符合条件的订阅。
- `0 3 * * *`：每天 03:00 UTC 刷新远程规则索引。

经过身份验证的 `/api/cron/*` 路由仍可用于 Docker 部署。Worker Cron Triggers 会直接调用底层任务，因此不需要 HTTP 请求或 `CRON_SECRET`。

## GitHub Actions

`Deploy to Cloudflare Workers` 工作流会在每次推送到 `main` 时执行部署。启用该工作流前，请配置以下仓库 secrets：

- `CLOUDFLARE_API_TOKEN`：具有 Workers Scripts 编辑、D1 编辑和账户读取权限的 token。
- `CLOUDFLARE_ACCOUNT_ID`：目标 Cloudflare 账户 ID。

合并到 `main` 前，请确保 `local/wrangler.jsonc` 中已填写真实的 D1 数据库 ID。
