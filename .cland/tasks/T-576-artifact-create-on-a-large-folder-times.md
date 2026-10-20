---
id: T-576
kind: task
title: artifact.create on a large folder times out at 10 s while the hub completes it, losing the result and inviting a duplicate publish
state: open
status: review
size: S
criterion_seq: 2
labels:
  - bug
  - hub
assignee: null
parent: E-952
blocked_by: []
topic: topic-710
branch: t/T-576-artifact-create-on-a-large-folder-times
created: 2026-10-16T06:13:36.210Z
updated: 2026-10-20T09:59:53.529Z
---

## Summary
Found by impl-466 on 2026-10-16. `artifact.create` for T-466's 15,554-file census evidence folder returned "the hub did not answer within 10s", but the hub completed and published it as A-3775. The caller found it only through `artifact.list`. A naive retry would publish it twice. This is the same class as T-537 (verify admission vs the CLI's 15 s reply limit): a long hub operation whose success is lost at a fixed client timeout.

## Acceptance criteria
- [x] C1. artifact.create has its own 120 s client budget (artifact.list keeps 10 s); a fake-clock T2 test publishes a folder slower than 10 s and returns exactly one artifact id, and a boundary test shows the budget expiring with a clear error and no duplicate publication.
  - done: impl-576 · 2026-10-20T09:45:56.917Z
- [x] C2. A test publishes a folder large enough to exceed the old 10 s limit and shows exactly one artifact, with the caller receiving its id.
  - done: impl-576 · 2026-10-20T09:45:57.794Z

## Comments

### impl-576 · 2026-10-20T09:43:02.598Z

Confirmed A-7125 row against source: artifact.create shares default 10 s with listing, but creation serially copies each source file and has no operation-level deadline. Regression seam is the real MCP tool handler plus HubClient against a delayed in-process WebSocket peer and FakeClock (T2), as requested by the launch brief. Budget-scope question sent to lead T-576 because C1 currently asks for a scaled bound or durable operation protocol.

### impl-576 · 2026-10-20T09:45:58.700Z

Implemented the Coordinator-confirmed 120 s artifact.create budget; artifact.list retains 10 s. A-7270 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-7270-t-576-implementation-and-regression-evidence.md) records triage, red/green fake-clock proof and scope. New tests cover >10 s folder receipt, 120 s boundary, listing deadline and no duplicate request after late publication. npm run check and all 16 tests in the three targeted files pass; latest origin/dev merged before first review. qaPolicy scope is none; no per-item QA brief is required.
