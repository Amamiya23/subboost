# Resource optimization design

## 1. Scope and invariants

This task optimizes three independent costs without changing public contracts and rejects one unsafe candidate after build validation:

1. scheduled subscription scans transferring large encrypted fields for records that are not due;
2. repeated HKDF work for every v3 encrypted field operation;
3. copying the complete build dependency tree into the Docker runner.

The rejected candidate is an explicit cache override for hashed Next static assets; framework diagnostics showed that this would add behavior risk without proven benefit.

The following are invariants:

- Docker/PostgreSQL remains the primary runtime and keeps atomic Prisma transactions.
- Workers/D1 continues to compile and to use the Web Crypto-only v2/v3 paths.
- Ciphertext prefixes and bytes-on-disk remain compatible; only derived key reuse changes.
- Cron result shapes, refresh order, minimum interval, failure handling and logging contracts remain unchanged.
- The app container still runs `prisma migrate deploy` before `node server.js`.
- No Prisma schema or persisted application data changes are introduced.

## 2. Scheduled scan data flow

### Current

```text
full rows for every enabled subscription
  -> determine due state in JavaScript
  -> skip most rows or refresh sequentially
```

This makes peak resident data proportional to all enabled subscriptions, including encrypted node arrays.

### Proposed

```text
small scheduling projection for every enabled subscription
  -> determine due IDs in existing order
  -> fetch full rows only for due IDs in bounded batches
  -> refresh sequentially in original candidate order
```

The first Prisma query selects only:

- `id`, `autoUpdateInterval`, `createdAt`, `lastUpdatedAt`;
- the minimum auto-update state needed to call `resolveAutoUpdateScheduleState` (`lastAttemptedAt`).

It explicitly excludes `encryptedUrls`, `encryptedNodes`, `encryptedConfig`, `encryptedSubscriptionInfo`, token and owner data. Due IDs are fetched in bounded batches with the existing owner and full auto-update state includes. A candidate-order map restores deterministic processing order because SQL `in` queries do not promise input order.

If a candidate disappears between the projection and full-row query, it is counted as skipped rather than treated as a refresh failure. This is limited to a concurrent deletion race; no stable-state behavior changes. A record disabled after projection is not refreshed when the due-row query observes `autoUpdateInterval: null`.

The batch size is a module-level constant selected conservatively (10) to cap large-row residency. It is not user configuration because exposing it would add a new operational contract without evidence that tuning is needed.

## 3. Derived encryption key cache

`encrypted-field-v3.ts` owns key derivation, so reuse remains there rather than in Docker-only callers.

Use a single-entry cache:

```text
{ masterKey, promise<CryptoKey> }
```

- Repeated and concurrent calls with the same key return the same promise.
- A different key replaces the entry instead of growing a `Map`.
- If derivation rejects, clear the entry only when it is still the same promise, allowing a later retry.
- The cached `CryptoKey` remains non-extractable; the raw key is already retained by the process environment in production.
- AES-GCM receives a fresh random IV for every encryption, so ciphertext non-determinism is unchanged.
- Cache one `TextDecoder` alongside the existing `TextEncoder` to avoid per-decrypt allocation.

Tests spy on `deriveBits` with unique keys to verify sequential reuse, concurrent reuse, key replacement and retry behavior without exposing a production cache-reset API.

## 4. Rejected response-cache override

An explicit `/_next/static/:path*` immutable header rule was prototyped. Next 16.2.11 accepted the route but emitted a production-build warning that custom Cache-Control headers can break development behavior. Since Next owns hashed static-asset caching and the task requires behavior preservation, the override is rejected. `local/next.config.mjs` remains unchanged and no speculative network optimization is claimed.

## 5. Docker runner dependency boundary

### Current

The runner copies both the approximately 74 MB standalone closure and approximately 459 MB `local/node_modules`. The latter exists primarily so the Prisma CLI can run at startup and brings build/Worker tooling into production.

### Proposed

Add a small lockfile-backed package under `local/prisma-runtime/` containing exact `prisma` and `dotenv` versions. A dedicated Docker stage runs `npm ci --omit=dev` for this package.

The runner then:

1. copies the Next standalone closure;
2. copies the minimal migration dependency tree to `/opt/prisma-runtime/node_modules` and sets `NODE_PATH` only for the migration command, so `prisma.config.ts` resolves `dotenv/config` without exposing CLI dependencies to the Next server;
3. copies static/public assets, Prisma config, schema and migrations as today;
4. invokes the isolated Prisma binary, then runs `node server.js`; migration ordering and failure semantics remain unchanged.

This preserves the single-container topology and startup behavior while removing `@next/swc`, Wrangler, OpenNext and other build-only packages from the runner. The minimal package has its own lockfile so future root dependency changes cannot silently expand the migration layer.

## 6. Measurement

Record baseline and final values in `research/resource-results.md`:

- `/usr/bin/time -v npm --prefix local run build` for build context and regression visibility;
- a fixed Node microbenchmark using 50 v3 encryptions and decryptions of a 64 KiB payload, reported over repeated runs;
- query-shape tests as the deterministic proxy for skipped-cron database bytes and heap residency;
- `docker image inspect` size before and after, plus `docker history` to identify runner layers;
- container startup against PostgreSQL, readiness response and migration output;
- optional idle and request RSS/CPU samples from `docker stats --no-stream` under the same Compose inputs.

Timing results are evidence, not unit-test thresholds; CI variability must not make correctness tests flaky.

## 7. Compatibility, rollout and rollback

- No feature flag is required because each change is semantics-preserving and covered independently.
- Rollback is a normal code/image rollback; no data downgrade is needed.
- A failed key derivation is not cached permanently.
- A failed migration still prevents app startup exactly as before.
- If the minimal Prisma tree cannot load the config or migration engine, restore only the full dependency copy while retaining the runtime optimizations.
- If Worker compilation rejects the key cache, revert the cache implementation without touching encrypted data.
