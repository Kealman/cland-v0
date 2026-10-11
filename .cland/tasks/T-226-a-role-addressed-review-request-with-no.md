---
id: T-226
kind: task
title: A role-addressed review request with no free verifier returns "empty"; find why a live idle verifier wasn't eligible, and decide whether the request should queue
state: open
status: backlog
labels:
  - qa-found
  - ready-for-agent
  - tech-debt
  - low
assignee: null
parent: T-229
blocked_by: []
topic: null
branch: null
created: 2026-10-11T15:43:30.494Z
updated: 2026-10-11T17:48:36.912Z
---

## What happened

In T-108's QA demo (qa-2026-10-11-18, M15, A-1302), a scratch Implementer sent `review request T-1` to the role `reviewer` while the only reviewer, rev-d (a bare driver spoke), was live. The hub answered `ok: true` with outcome `empty`, reason `role "reviewer" has no free live verifier for T-1`.

This was an explicit non-delivery, not silent loss. After rev-d held another item first, both role requests resolved to rev-d. core.ts:1852 allows an `idle` or `unknown` state, so unknown activity alone isn't the cause. A suspected cause, unconfirmed, is that the driver's role delivery stays pending because it acks without a harness injection.

## What to build

- Find why rev-d wasn't eligible, and fix it if it's a hub bug.
- Decide whether a role request with no eligible verifier should queue for the next free verifier instead of returning `empty`. Today the lead has to notice and retry.

## Acceptance criteria

- [ ] The cause is identified with a protocol test that reproduces it.
- [ ] Either a free verifier receives the request, or the request queues and is delivered when one frees up; the sender's outcome says which.
- [ ] `npm run typecheck && npm test` pass.
