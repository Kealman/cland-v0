---
id: T-1493
kind: task
title: Pin the authoritative request head at verifier admission
state: open
status: backlog
size: S
labels:
  - needs-triage
assignee: null
parent: C-327
blocked_by: []
topic: null
branch: null
created: 2026-10-30T19:25:08.372Z
updated: 2026-10-30T19:25:08.372Z
---

## Summary

Review and QA requests carry free text. The hub parses only `{item, kind}` from them and holds no authoritative head for the request, so pending-reservation retirement (T-1487) works on ordered request and verdict receipts, not on the commit a request was for. Pinning the request head at admission, from the claimant's pushed head or an explicit field, would allow head-exact and ancestry-aware retirement and freshness checks.

Origin: impl-1487's T-1487 scope note (2026-10-30). T-1487 kept the ordered-receipt design on purpose.

## Acceptance criteria

- [ ] C1. A role-addressed review or QA request records the head it was admitted for, and pending retirement can compare a later verdict's commit with that head (same, descendant, or unrelated), with legacy text-only requests still accepted.
