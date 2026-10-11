---
id: T-224
kind: task
title: "Release from the item, dry run: `cland release --item T-n --dry-run` refuses open children or a missing version, and previews the tag and the notes"
state: open
status: review
criterion_seq: 4
labels:
  - ready-for-agent
  - v0.1
assignee: impl-224
parent: T-117
blocked_by: []
topic: topic-138
branch: t/T-224-release-from-the-item-dry-run-cland
created: 2026-10-11T15:38:09.626Z
updated: 2026-10-11T15:46:18.261Z
---

## Parent

T-117 (Release from the item), tracer bullets 1–2. These bullets were never ticketed: T-196, T-117's only child, was the epic close gate. Found while drafting T-117's QA brief, 2026-10-11.

## What to build

`cland release --item T-n [--dry-run] [--json]` reads the release item and does the following:
- Refuses when the item isn't a release, has open children, or has no version, and names the reason and the open children.
- With an explicit version given too, requires it to match the item's version.
- Previews the tag `v<version>` and the notes:
  1. the item's `## Notes` section;
  2. its epics, each with the first sentence of its `## Goal` as a one-line deliverable;
  3. the commit subjects, as today.

The `release` frame and the protocol carry the item. A release without `--item` behaves exactly as today. The dry run stays read-only, as today's dry run is.

## Acceptance criteria

- [x] C1. `--item` with open children, no version, a non-release item, or a version that disagrees with the item is refused, and the refusal names the reason (and the open children).
  - done: impl-224 · 2026-10-11T15:46:07.348Z
- [x] C2. The dry-run preview shows `v<version>` and notes in the order: the item's Notes, then the epics with their one-line deliverables, then the commit subjects.
  - done: impl-224 · 2026-10-11T15:46:07.437Z
- [x] C3. A release without `--item` is unchanged. Existing release tests pass untouched.
  - done: impl-224 · 2026-10-11T15:46:07.516Z
- [ ] C4. Protocol and CLI tests in a scratch project with a bare territory and a GitHub stand-in, as hub/test/release.test.ts sets them up. `npm run typecheck && npm test` pass.

## Comments

### impl-224 · 2026-10-11T15:39:07.642Z

Claimed on dev 994b761. Implementing item-backed dry-run validation and notes through the existing release protocol and CLI, tested only in scratch projects with bare territory and GitHub stand-in. No-item behavior and existing release tests remain untouched; T-225 owns publication and close.

### impl-224 · 2026-10-11T15:45:37.672Z

Implemented and pushed 03f15537cecef799a9d2c7ae30fe2965dd35d6cf on t/T-224-release-from-the-item-dry-run-cland after fetching and merging origin/dev a9f131a. Four item-release protocol/CLI tests pass in scratch repositories; typecheck passes. Artifact A-1303 records scope and validation at /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1303-t-224-implementation-and-validation.md. T-225 owns publication and close; this head explicitly requires --dry-run for --item.
