---
id: T-1493
kind: task
title: Pin the authoritative request head at verifier admission
state: open
status: review
size: S
criterion_seq: 1
labels:
  - needs-triage
assignee: null
parent: R-1523
blocked_by: []
topic: topic-1269
branch: t/T-1493-pin-the-authoritative-request-head-at
created: 2026-10-30T19:25:08.372Z
updated: 2026-10-31T14:50:24.991Z
---

## Summary

Review and QA requests carry free text. The hub parses only `{item, kind}` from them and holds no authoritative head for the request, so pending-reservation retirement (T-1487) works on ordered request and verdict receipts, not on the commit a request was for. Pinning the request head at admission, from the claimant's pushed head or an explicit field, would allow head-exact and ancestry-aware retirement and freshness checks.

Origin: impl-1487's T-1487 scope note (2026-10-30). T-1487 kept the ordered-receipt design on purpose.

## Acceptance criteria

- [x] C1. A role-addressed review or QA request records the head it was admitted for, and pending retirement can compare a later verdict's commit with that head (same, descendant, or unrelated), with legacy text-only requests still accepted.
  - done: impl-1493 · 2026-10-31T14:50:24.480Z

## Comments

### impl-1493 · 2026-10-31T14:45:54.227Z

Contract inventory: verifierRequest parser consumers are core sendFromSession/sendFromHuman, launch/reuse briefs, rememberVerification and queue drain; dispatch Lead routing; Store pending lead routing. PendingVerification consumers: protocol and shared/wire conformance, server session projections, web/nvim pending displays (additive head ignored), routing/resolver tests and memory/inbox workload fixtures. Durable admission consumers: Store schema/migration and verifier-routing restart fixtures; receipt/accepted meta readers in core. lastVerifier consumers: core retirement/affinity and tracker/index wrapper. Shipped flow docs: implement skill, issue-tracker, review-and-qa, hub README; QA briefs/startup probes contain no direct private admission/receipt consumers. Plan: explicit full-SHA Head: line pinned in private admission storage before delivery; optional pending.head projection; legacy absent head retains ordered retirement; pinned requests retire only on proven same/descendant commits using existing asynchronous freshness ancestry cache.
