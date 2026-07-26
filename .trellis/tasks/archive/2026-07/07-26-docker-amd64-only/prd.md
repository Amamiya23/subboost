# Build Docker images for amd64 only

## Goal

Temporarily publish only `linux/amd64` Docker images from every GHCR publication workflow.

## Background

- `docker-main.yml`, `release.yml`, and `dev-release.yml` currently build amd64 and arm64 separately, upload digest artifacts, then require at least two digests to create a multi-platform manifest.

## Requirements

- Retain existing triggers, checks, tags, build arguments, cache use, release assets, and digest-pinned references.
- Build only `linux/amd64`.
- Remove QEMU and architecture matrices that only support arm64.
- Publish tags from the single amd64 image digest without a two-digest validation.
- Update workflow summaries so they no longer claim a multi-architecture manifest.

## Acceptance Criteria

- [x] All three Docker publishing workflows specify only `linux/amd64`.
- [x] No Docker workflow contains `arm64`, `setup-qemu-action`, or "at least two architecture digests" logic.
- [x] Main, release, and dev tags still resolve to the built amd64 digest.
- [x] Release asset generation still receives the published digest and tag.
- [x] Workflow YAML parses and repository workflow-shape checks pass.

## Out of Scope

- Optimizing Dockerfile contents or changing image tags.
- Removing arm64 support from application source code.
- Changing Cloudflare Worker deployment.
