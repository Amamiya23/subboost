# Fix subscription visibility and amd64 image builds

## Goal

Restore consistency between saved-subscription creation, account counters, remote subscription links, and the "我的订阅" dashboard, while temporarily reducing every GHCR Docker publication path to amd64 only.

## Child Tasks

- `07-26-fix-subscription-list-visibility`: diagnose and fix the saved-subscription list data flow.
- `07-26-docker-amd64-only`: simplify main, release, and dev-release Docker workflows to publish amd64 images only.

## Requirements

- A successfully created subscription owned by the current administrator must be returned by the protected collection API and rendered on the dashboard.
- The dashboard must not misrepresent a failed list request as a confirmed empty account.
- Existing remotely fetchable subscription URLs must remain valid.
- All GitHub Actions workflows that publish the self-hosted Docker image must build only `linux/amd64`; arm64/QEMU/multi-architecture assumptions must be removed.
- Do not change Cloudflare Worker deployment behavior.

## Acceptance Criteria

- [x] A create/list round trip returns the newly created subscription for the same owner.
- [x] The dashboard renders returned subscriptions and exposes a visible retryable error state when loading fails.
- [x] Existing subscription download/config routes continue to pass their contract tests.
- [x] `.github/workflows/docker-main.yml`, `release.yml`, and `dev-release.yml` contain no arm64 build matrix or two-digest requirement.
- [x] Relevant unit, route-contract, type, and workflow-shape checks pass.

## Out of Scope

- Restoring arm64 publication in this change.
- Changing subscription quota semantics or deleting/recreating saved data.
- Changing Cloudflare deployment workflows.
