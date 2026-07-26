# Docker Runtime

## Scenario: Standalone app with isolated migration dependencies

### 1. Scope / Trigger

- Trigger: changing `local/Dockerfile`, Next standalone output, Prisma CLI versions, startup migrations, or production dependency copies.
- Goal: keep the single app-container startup contract while preventing build and Worker dependencies from entering the runner.

### 2. Signatures

- Migration package install: `cd local/prisma-runtime && npm ci --omit=dev`.
- Docker migration stage: `COPY local/prisma-runtime/package*.json ./` followed by `npm ci --omit=dev`.
- Runner startup order:
  ```sh
  NODE_PATH=/opt/prisma-runtime/node_modules /opt/prisma-runtime/node_modules/.bin/prisma migrate deploy --schema prisma/schema.prisma && node server.js
  ```

### 3. Contracts

- `local/prisma-runtime/package.json` and `package-lock.json` own the exact startup-migration dependency closure.
- Next runtime files come from `local/.next/standalone`; do not copy the complete build `local/node_modules` into the runner.
- Migration packages live under `/opt/prisma-runtime/node_modules`, outside the standalone module tree.
- `NODE_PATH` is scoped to the Prisma command only. The `node server.js` process must resolve modules exclusively from the standalone trace.
- `local/prisma.config.ts`, `local/prisma/`, static assets, and public assets remain available at the existing runner paths.
- A migration failure prevents server startup; a successful or already-applied migration starts the server.

### 4. Validation & Error Matrix

| Condition | Expected behavior |
|---|---|
| Fresh PostgreSQL database | Apply every checked-in migration, then start Next |
| All migrations already applied | Report no pending migrations, then start Next |
| Database unavailable or migration invalid | Exit before `node server.js` |
| Prisma runtime lockfile missing/stale | `npm ci` fails the image build |
| Migration dependency absent | Runner fails before server start; never fall back to build dependencies |
| Next runtime import absent from standalone | Server fails; `/opt/prisma-runtime` must not mask the tracing defect |

### 5. Good / Base / Bad Cases

- Good: the runner contains standalone files plus the locked `/opt/prisma-runtime` tree, two consecutive migrations succeed, and live/ready return 200.
- Base: a normal upgrade reports no pending migrations and starts with the same Compose topology and environment keys.
- Bad: copying `/package/local/node_modules` into the runner to make the Prisma binary available; this restores hundreds of megabytes of build-only packages.
- Bad: setting global `ENV NODE_PATH=/opt/prisma-runtime/node_modules`; Prisma Studio dependencies can then shadow or mask missing standalone dependencies.

### 6. Tests Required

- `local/dockerfile-runtime.test.ts` must assert the dedicated stage, absence of the full dependency copy, isolated destination, scoped `NODE_PATH`, and migration-before-server command order.
- Run `npm ci --omit=dev` from `local/prisma-runtime` and assert the Prisma CLI loads `prisma.config.ts` plus the target platform schema engine.
- Run a PostgreSQL smoke test with first and second `prisma migrate deploy`, then assert `/api/health/live` and `/api/health/ready` return 200.
- Run `npm run check:local-app` to validate the PostgreSQL standalone trace.
- When shared runtime code changes, also run the Worker build contract in `cloudflare-workers.md`.

### 7. Wrong vs Correct

#### Wrong

```dockerfile
COPY --from=deps /package/local/node_modules local/node_modules
ENV NODE_PATH=/opt/prisma-runtime/node_modules
CMD ["sh", "-c", "./node_modules/.bin/prisma migrate deploy --schema prisma/schema.prisma && node server.js"]
```

#### Correct

```dockerfile
COPY --from=builder /package/local/.next/standalone ./
COPY --from=migration-deps /migration/node_modules /opt/prisma-runtime/node_modules
CMD ["sh", "-c", "NODE_PATH=/opt/prisma-runtime/node_modules /opt/prisma-runtime/node_modules/.bin/prisma migrate deploy --schema prisma/schema.prisma && node server.js"]
```
