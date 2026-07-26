# Implementation plan: Saved subscription list visibility

1. Reproduce the reported state through service/route/dashboard tests and identify the failing boundary.
2. Add a regression test that fails on the current behavior.
3. Apply the smallest backend or adapter fix required for the create/list round trip.
4. Add explicit dashboard load-error state and retry behavior.
5. Run focused subscription service, route-contract, local-page, and dashboard tests.
6. Run type checking and the proportionate project quality gate.

## Rollback Points

- No database migration or data mutation is required.
- Backend contract and dashboard-state changes can be reverted independently.
