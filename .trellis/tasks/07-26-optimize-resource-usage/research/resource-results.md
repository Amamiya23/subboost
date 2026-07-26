# Resource measurements

## Environment

- Date: 2026-07-26
- Host runtime: Node.js 22 (repository-supported local runtime)
- Target: Docker/PostgreSQL first; Workers/D1 compatibility validation second

## Baseline

### Next production build

Command:

```bash
/usr/bin/time -v npm --prefix local run build
```

Result:

- wall time: 48.16 s
- user CPU: 70.53 s
- system CPU: 13.99 s
- peak RSS: 1,158,076 KiB
- build: passed (Next.js 16.2.11, webpack)

Build output sizes:

- `.next/standalone`: 74,031,676 logical bytes (78 MB disk usage)
- `local/node_modules`: 459,125,501 logical bytes (455 MB disk usage)
- `.next/static` + `public`: 3,735,347 logical bytes
- current runner payload before base image/Alpine packages: approximately 536.9 MB logical bytes

### V3 encryption microbenchmark

Input: 50 sequential encryptions followed by 50 sequential decryptions, one 64 KiB payload, one repeated master key.

Current implementation:

```json
{"rounds":50,"payloadBytes":65536,"encryptMs":170.983252,"decryptMs":141.456783,"totalMs":312.440035}
```

Control using one derived key for equivalent AES-GCM operations (excluding the current hex serialization work):

```json
{"rounds":50,"payloadBytes":65536,"encryptMs":10.632056,"decryptMs":12.338341,"totalMs":22.970397}
```

The control is a hotspot proof, not a direct expected speedup because it excludes hex conversion.

### Docker image

Two baseline builds were attempted with:

```bash
docker build -t subboost:resource-baseline-0576fc1-20260726 -f local/Dockerfile .
```

Both failed before executing Dockerfile steps because Docker Hub metadata lookup for `node:22-alpine` timed out. A locally cached `ghcr.io/amamiya23/subboost:main` image created 2026-07-25 was therefore inspected as the actual baseline:

- `docker image inspect` content size: 372,918,619 bytes;
- `docker images` unpacked/virtual size: 1.87 GB;
- `docker history` full `local/node_modules` layer: 1.26 GB;
- `docker history` standalone layer: 64.1 MB.

## Final

### Scheduled scan residency and database bytes

- The first query now selects only `id`, interval timestamps and `lastAttemptedAt`.
- Encrypted URL/node/config/subscription-info fields are never read for skipped subscriptions.
- Full rows are fetched only for due IDs, in batches of 10, and processed in original candidate order.
- Deterministic tests cover zero-due, due-only, 11-row batching, reversed SQL result order and concurrent disappearance.

This changes skipped-scan large-field residency from proportional to all enabled subscriptions to zero; peak full-row residency is bounded by 10 due subscriptions.

### V3 encryption CPU

Five-sample warmed benchmark, same 50 encryptions + 50 decryptions and 64 KiB payload:

- exact pre-change algorithm median: 600.71 ms (samples 433.04–681.42 ms);
- final implementation median: 101.91 ms (samples 85.34–122.24 ms);
- median CPU-wall reduction in this microbenchmark: approximately 83.0%.

The final path reuses a single derived key, shares in-flight derivation, caches one decoder and uses lookup/character-code hex conversion. Ciphertext layout and the fixed compatibility vector remain unchanged.

### Next production build

Final `/usr/bin/time -v npm --prefix local run build`:

- wall time: 42.48 s (baseline 48.16 s; 11.8% lower, considered incidental rather than a product claim);
- user CPU: 66.18 s;
- system CPU: 13.30 s;
- peak RSS: 1,168,036 KiB (0.86% above baseline, within observed build noise);
- no custom static Cache-Control warning after rejecting the candidate override.

### Docker runner payload and startup

- final standalone logical bytes: 74,033,530;
- final Alpine/musl migration runtime logical bytes: 211,548,808 (226 MB disk usage);
- static + public logical bytes: 3,735,347;
- expected new application payload: approximately 289.3 MB before the unchanged base/Alpine package layers;
- compared with the cached image's approximately 1.26 GB full-dependency layer plus 64.1 MB standalone layer, the uncompressed application payload falls by roughly 78%.

The final Docker build could not resolve Docker Hub's `node:22-alpine` metadata after repeated attempts, so an exact final compressed image byte count is unavailable. The following equivalent runtime boundaries were validated inside the cached Alpine/Node image:

1. `npm ci --omit=dev` installed all 95 locked migration packages and selected `schema-engine-linux-musl-openssl-3.0.x`.
2. With `NODE_PATH` scoped only to Prisma, the CLI loaded `prisma.config.ts`, `dotenv/config`, the PostgreSQL schema and the musl engine.
3. An ephemeral PostgreSQL 18 server accepted both migrations; the second `prisma migrate deploy` reported no pending migrations.
4. The final PostgreSQL standalone build started and returned 200 JSON responses from both live and ready health endpoints.

### Quality checks

- `npm run lint`: passed.
- `npm run local:typecheck`: passed.
- `npm run test:unit`: 208 files / 1,100 tests passed outside bwrap; the escalation was required because `local/scripts/selfhost-shell.test.ts` uses `setsid`, which hangs inside the sandbox.
- `npm run test:core`: 58 files / 350 tests passed.
- `npm run check:local-app`: passed, including final PostgreSQL Next build.
- Workers OpenNext build: passed.
- Wrangler deploy dry-run: passed; only the existing generated direct-eval warnings were emitted.
- PostgreSQL Prisma client was regenerated after Worker validation.
