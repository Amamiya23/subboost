# Design: Saved subscription list visibility

## Data Flow

`POST /api/subscriptions` → authenticated owner → encrypted `Subscription` row → create response

`GET /api/auth/me` → owner-filtered count → user menu

`GET /api/subscriptions` → authenticated owner → owner-filtered rows → decrypt/serialize summaries → dashboard adapter → dashboard state

The defect is constrained to the final list path because count and token-based YAML retrieval succeed independently.

## Approach

1. Reproduce the list path with focused service/route tests and inspect the actual error boundary.
2. Correct the underlying query/serialization/client contract without weakening owner filtering or encryption.
3. Represent loading failure separately from an empty successful response in the shared dashboard surface. Retrying invokes the existing adapter again.
4. Add regression coverage for the reproduced root cause and the error-to-success transition.

## Compatibility and Risk

- Keep the collection payload shape unchanged.
- Do not modify tokens or persisted encrypted values.
- Avoid partial silent lists: if a backend item cannot be serialized, the API should fail visibly rather than pretend the account is empty.
- Rollback is limited to the focused service/API/UI changes; no migration is planned.
