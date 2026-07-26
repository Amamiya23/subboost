# Fix saved subscription list visibility

## Goal

Ensure subscriptions that were persisted successfully and counted by `/api/auth/me` appear in "我的订阅" for the same authenticated administrator.

## Background

- The user reports two persisted subscriptions (`2 / 9999` in the user menu) and remotely usable generated URLs, while the dashboard shows none.
- Creation persists and formats a record in `local/src/lib/subscription-service.ts:171`.
- The account counter independently queries `Subscription.count` in `local/app/api/auth/me/route.ts:7`.
- The dashboard collection path is `local/app/dashboard/page.tsx:27` → `/api/subscriptions` → `listSubscriptions` at `local/src/lib/subscription-service.ts:162`.
- The dashboard currently catches any collection failure and replaces the list with `[]` at `packages/ui/src/dashboard/subscription-dashboard-surface.tsx:141`, making an API/decryption/query failure indistinguishable from a genuinely empty account.
- Root cause: the v3 Web Crypto migration removed v2 read compatibility. One legacy v2 row rejects the list's `Promise.all`, while the independent count query and newly written v3 token routes continue to work.

## Requirements

- Trace and fix the first failing boundary in the authenticated create/list/render round trip.
- Preserve owner isolation and the existing protected API response shape `{ subscriptions: Subscription[] }`.
- Keep generated subscription URLs and YAML generation compatible.
- Render a retryable error state if the collection request fails; do not display the normal empty-state claim in that case.
- Add regression coverage at the boundary where the defect is reproduced and for the dashboard error behavior.

## Acceptance Criteria

- [x] After a successful create, listing with the same owner returns the created item.
- [x] The dashboard displays every subscription returned by the collection adapter.
- [x] A failed collection request displays an error and retry affordance rather than "暂无订阅".
- [x] A retry can replace the error state with the returned subscription list.
- [x] Authentication, owner filtering, creation, detail retrieval, and YAML route contract tests remain green.

## Out of Scope

- Subscription schema migrations, quota changes, or destructive data repair.
- Changes to subscription generation/routing semantics unrelated to list visibility.
