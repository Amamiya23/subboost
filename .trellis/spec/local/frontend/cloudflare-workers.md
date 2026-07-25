# Cloudflare Workers Deployment

## Scenario: OpenNext, D1, and Cron Triggers

### 1. Scope / Trigger

- Trigger: a `local/` change that affects Cloudflare Workers, D1, generated Prisma clients, or scheduled jobs.
- The Worker runs OpenNext with D1; the Docker path continues to use PostgreSQL.
- Do not reuse an existing PostgreSQL or v2-encrypted dataset for a Worker deployment.

### 2. Signatures

- `npm --workspace @subboost/local run build:worker`: runs OpenNext with `SUBBOOST_RUNTIME=workers` so `local/prisma/schema-d1.prisma` generates the SQLite/D1 Prisma client.
- `npm --workspace @subboost/local run db:migrate:d1:local`: applies `local/prisma/migrations-d1/*/migration.sql` to local D1 state.
- `npm --workspace @subboost/local run db:migrate:d1:remote`: applies the same migrations to the configured production D1 database.
- Scheduled handler: `runScheduledJob(controller: ScheduledController): Promise<void>`.
  - `*/5 * * * *` calls `runUpdateSubscriptionsJob()`.
  - `0 3 * * *` calls `runUpdateRuleIndexJob()`.

### 3. Contracts

- `local/wrangler.jsonc` must define a `DB` D1 binding, `migrations_dir`, and `migrations_pattern` for nested Prisma-style migration files.
- Replace `REPLACE_WITH_D1_DATABASE_ID` before a remote deployment. It is a configuration value, not a secret.
- Required Worker secrets: `ENCRYPTION_KEY`, `JWT_SECRET`, `CRON_SECRET`, and `APP_URL`.
- `local/src/lib/prisma.ts` chooses `PrismaD1` when a Workers `DB` binding is available; otherwise it creates the existing `PrismaPg` client.
- `local/worker/index.ts` captures `env` for scheduled handlers. Next request handlers obtain bindings through OpenNext context, because the outer custom worker and the OpenNext server bundle do not share module state.

### 4. Validation & Error Matrix

| Condition | Expected behavior |
|---|---|
| D1 migration already applied | `db:migrate:d1:local` reports no migrations to apply |
| No D1 binding during a Worker request | database access fails; `/api/health/ready` returns `503` |
| Placeholder production database ID | do not deploy; replace it in `wrangler.jsonc` |
| `SUBBOOST_RUNTIME` omitted | Prisma generation uses PostgreSQL schema for Docker/local Node builds |
| Worker build lacks `SUBBOOST_RUNTIME=workers` | reject the build path because Prisma will generate the PostgreSQL client |
| v2 encrypted field in a v3 deployment | decryption fails by design; deploy against a clean database |

### 5. Good / Base / Bad Cases

- Good: `build:worker` generates from `schema-d1.prisma`, `wrangler deploy --dry-run` succeeds, `/api/health/ready` returns `{ "ok": true, "database": "ready" }`, and both scheduled expressions complete locally.
- Base: Docker `npm run build` generates from `schema.prisma` and continues to use `PrismaPg`.
- Bad: running `prisma generate --schema prisma/schema.prisma` after a D1 generation and before OpenNext bundling. This silently overwrites the Worker-compatible client.

### 6. Tests Required

- `npm run lint`, `npm run test:unit`, and `npm run check:local-app` for the Node/Docker path.
- `npm --workspace @subboost/local run build:worker` followed by `cd local && npx wrangler deploy --dry-run` for the Worker bundle.
- Apply local D1 migrations, run `wrangler dev --local`, and assert:
  - `GET /api/health/ready` returns 200.
  - Admin setup/login and a subscription create/list round trip succeed.
  - `GET /cdn-cgi/handler/scheduled?cron=*/5+*+*+*+*` executes the subscription job.
  - `GET /cdn-cgi/handler/scheduled?cron=0+3+*+*+*` executes the rule-index job.

### 7. Wrong vs Correct

#### Wrong

```json
"build:worker": "npm run db:generate:d1 && npx opennextjs-cloudflare build"
```

OpenNext invokes `npm run build` internally, which regenerates the PostgreSQL client and overwrites the D1 client.

#### Correct

```json
"db:generate": "node scripts/generate-prisma.cjs",
"build:worker": "SUBBOOST_RUNTIME=workers npx opennextjs-cloudflare build"
```

The environment variable is inherited by OpenNext's internal `npm run build`, so every generate step selects `schema-d1.prisma`.

> **Warning**: Prisma's D1 adapter does not provide Prisma `$transaction` atomicity. Keep D1 deployments to the single-admin workflow; use Docker/PostgreSQL where strict concurrent multi-write atomicity is required.
