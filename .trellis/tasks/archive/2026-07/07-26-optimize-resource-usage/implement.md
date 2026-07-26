# Resource optimization implementation plan

## 0. Preparation and baselines

- [x] Load `trellis-before-dev` and the active local/Workers crypto deployment contract.
- [x] Capture the current Docker image size and layer history before editing; request Docker daemon access if required.
- [x] Save the existing Next build and crypto microbenchmark results to `research/resource-results.md`.
- [x] Confirm the worktree contains only this task's planning artifacts before source edits.

## 1. Scheduled scan memory and database I/O

- [x] Extend `local/src/lib/auto-update-service.test.ts` to assert the lightweight first query, no heavy query when nothing is due, due-only bounded full-row reads, stable order and summaries.
- [x] Refactor `runLocalSubscriptionAutoUpdateCron` into lightweight candidate selection plus bounded due-row loading without changing refresh completion helpers.
- [x] Cover concurrent disappearance/disable handling explicitly.
- [x] Run the focused auto-update service and cron route contract tests.

Rollback point: revert the query refactor only; no stored state changes are introduced.

## 2. Encryption CPU and allocation reduction

- [x] Add v3 crypto tests for sequential and concurrent same-key derivation reuse, key replacement, rejected-derivation retry and unchanged fixed-vector behavior.
- [x] Implement a single-entry promise cache around v3 key derivation, reuse `TextDecoder`, and remove avoidable hex conversion CPU without changing the v3 format.
- [x] Re-run the fixed microbenchmark with the same Node version, payload and round count.
- [x] Run all server-core crypto and local encryption dispatch tests.

Rollback point: restore per-operation derivation; ciphertext remains fully compatible.

## 3. Static request reduction

- [x] Prototype an explicit immutable rule and build the Docker/Node Next target.
- [x] Reject and remove the rule after Next warned that custom static Cache-Control can break development behavior.
- [x] Confirm the final production build has no custom static Cache-Control warning and preserves the original header config.

Rollback point: restore the single catch-all header rule.

## 4. Docker runner size

- [x] Add `local/prisma-runtime/package.json` with exact minimal dependencies and generate its lockfile.
- [x] Add a dedicated migration dependency stage to `local/Dockerfile`; remove the complete `local/node_modules` copy from the runner and isolate only the migration runtime under `/opt`.
- [x] Preserve migration-before-server ordering and Prisma schema/migration copies without exposing CLI dependencies to the Next process.
- [x] Inspect the baseline image/layers, measure the final Alpine migration tree, and add a structural runner test; exact final compressed image output remains unavailable because Docker Hub metadata timed out on every build attempt.
- [x] Validate on Alpine with PostgreSQL 18: first and idempotent second migration, standalone start, `/api/health/live`, and `/api/health/ready` all pass.

Rollback point: restore `COPY --from=deps /package/local/node_modules local/node_modules` if the isolated migrator is not robust.

## 5. Full validation and results

- [x] Run `npm run lint`.
- [x] Run `npm run test:unit` outside bwrap for the sandbox-sensitive self-host shell tests, plus `npm run test:core`.
- [x] Run `npm run check:local-app`.
- [x] Run `npm --workspace @subboost/local run build:worker` and the Worker dry-run required by the active spec.
- [x] Compare final CPU/memory, query shape and image data with the baseline; document environment and any noise/limitations in `research/resource-results.md`.
- [x] Inspect `git diff --check`, generated/untracked files and public contract diffs.
- [x] Load `trellis-check` for the Phase 2 quality gate.
