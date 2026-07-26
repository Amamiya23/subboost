# Journal - amamiya (Part 1)

> AI development session journal
> Started: 2026-07-25

---



## Session 1: Fix subscription visibility and amd64 Docker publishing

**Date**: 2026-07-26
**Task**: Fix subscription visibility and amd64 Docker publishing
**Branch**: `main`

### Summary

Restored Web Crypto read compatibility for legacy v2 subscription records, added retryable dashboard load errors, and reduced all GHCR Docker publication workflows to linux/amd64.

### Main Changes

- Shared per-rule generation scope between Clash `rules` and `rule-providers`.
- Preserved moved preset rules after disabling their source proxy group without restoring sibling rules.
- Added helper-level and assembled-config regression coverage plus a core generator code-spec.

### Git Commits

| Hash | Message |
|------|---------|
| `85f28b5` | (see git log) |
| `939b2b6` | (see git log) |

### Testing

- `npm run lint`
- `npm run test:core` (58 files, 350 tests)
- `npm run local:typecheck`
- `npx vitest run local/zz-core-generation-contract.test.ts`

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 2: Fix moved ruleset omission

**Date**: 2026-07-26
**Task**: Fix moved ruleset omission
**Branch**: `main`

### Summary

Preserved moved preset rules and providers when their source proxy group is disabled, added regression coverage, and documented the shared generation-scope contract.

### Main Changes

- Detailed change bullets were not supplied; see the summary above.

### Git Commits

| Hash | Message |
|------|---------|
| `baf50ce` | (see git log) |

### Testing

- Validation was not recorded for this session.

### Status

[OK] **Completed**

### Next Steps

- None - task complete
