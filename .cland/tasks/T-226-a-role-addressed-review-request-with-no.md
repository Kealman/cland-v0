---
id: T-226
kind: task
title: A role-addressed review request with no free verifier returns "empty";
  find why a live idle verifier wasn't eligible, and decide whether the request
  should queue
state: closed
status: done
criterion_seq: 3
labels:
  - qa-found
  - ready-for-agent
  - low
assignee: impl-226
parent: E-229
blocked_by: []
topic: topic-146
branch: t/T-226-a-role-addressed-review-request-with-no
created: 2026-10-11T15:43:30.494Z
updated: 2026-10-11T20:05:53.924Z
---

## What happened

In T-108's QA demo (qa-2026-10-11-18, M15, A-1302), a scratch Implementer sent `review request T-1` to the role `reviewer` while the only reviewer, rev-d (a bare driver spoke), was live. The hub answered `ok: true` with outcome `empty`, reason `role "reviewer" has no free live verifier for T-1`.

This was an explicit non-delivery, not silent loss. After rev-d held another item first, both role requests resolved to rev-d. core.ts:1852 allows an `idle` or `unknown` state, so unknown activity alone isn't the cause. A suspected cause, unconfirmed, is that the driver's role delivery stays pending because it acks without a harness injection.

## What to build

- Find why rev-d wasn't eligible, and fix it if it's a hub bug.
- Decide whether a role request with no eligible verifier should queue for the next free verifier instead of returning `empty`. Today the lead has to notice and retry.

## Acceptance criteria

- [x] C1. The cause is identified with a protocol test that reproduces it.
  - done: impl-226 · 2026-10-11T18:21:45.287Z
  - verified: rev-17 [reviewer] · run rev-20261011-17-T226-1 · 2026-10-11T20:05:35.772Z · commit fa592f725dbc33706909c64582e18336aa223c8b
- [x] C2. Either a free verifier receives the request, or the request queues and is delivered when one frees up; the sender's outcome says which.
  - done: impl-226 · 2026-10-11T18:21:45.737Z
  - verified: rev-17 [reviewer] · run rev-20261011-17-T226-1 · 2026-10-11T20:05:35.772Z · commit fa592f725dbc33706909c64582e18336aa223c8b
- [x] C3. `npm run typecheck && npm test` pass.
  - done: impl-226 · 2026-10-11T20:05:19.441Z
  - verified: rev-17 [reviewer] · run rev-20261011-17-T226-1 · 2026-10-11T20:05:35.772Z · commit fa592f725dbc33706909c64582e18336aa223c8b

## Comments

### coord · 2026-10-11T17:59:20.483Z

Reproduced on the live hub (2026-10-11 17:59Z): impl-212's role-addressed 'review request T-212' returned empty, 'role "reviewer" has no free live verifier for T-212', while rev-17 was live, idle and held nothing, and rev-18 held T-220. Both reviewers launched at 17:49Z and had completed only their launch turn plus one brief delivery. This supports the hypothesis that a verifier whose role delivery or brief is still pending isn't counted as free. Workaround: address the reviewer by name.

### coord · 2026-10-11T17:59:37.345Z

Correction to my 17:59Z comment: rev-17 did hold T-147 (review) at that moment, and rev-18 held T-220. Both pool members were busy, so the 'no free live verifier' refusal for T-212 was correct pool exhaustion, not this bug. It does show the item's second half: with a full pool, the request isn't queued, and the lead has to retry or address a busy reviewer by name.

### impl-226 · 2026-10-11T18:13:39.290Z

Claimed and created task worktree. Protocol repro: node --test --test-name-pattern='free bare Reviewer' hub/test/verifier-routing.test.ts fails deterministically with actual empty vs expected delivered after the bare Reviewer accepts its role clause. Investigating accepted delivery awaiting an absent adapter, distinct from the corrected full-pool case. Implementing durable queued role requests for full pools, retaining single-verifier selection and affinity.

### impl-226 · 2026-10-11T18:22:57.611Z

Cause confirmed and fixed: unmanaged bare spokes have no adapter to move accepted role clauses beyond delivered; free-verifier eligibility now treats their accepted deliveries as complete for staffing, while managed sessions still require injection confirmation. Implemented durable queued review/QA role requests with automatic selection on release/eligibility changes and atomic sender notices. Protocol tests 4/4, topic tests 5/5, typecheck and diff checks pass. Updated README, skills and role/tool guidance. C1/C2 done; committing, merging origin/dev, then requesting review and final locked all suite. QA scope none.

### impl-226 · 2026-10-11T18:29:18.603Z

Reviewer found one low UI issue at 07e9ea0: queued request settlement cleared Store warning without publishing its topic change. Prepared a one-line publication fix plus a subscribed-UI protocol regression in an isolated worktree, preserving the task worktree for suite 40626be5. The regression failed before the fix and passes after; typecheck/diff checks pass. Will apply/commit/push the correction and request a fresh exact-head suite after the existing suite receipt; C3 remains pending.

### impl-226 · 2026-10-11T18:54:35.550Z

Suite 40626be5 passed at 07e9ea0: typecheck and all 1529 tests pass; log A-1351. Committed the reviewer's low warning-clearing fix as 4c3d758, with the subscribed-UI protocol regression previously verified red→green (routing file 4/4 and typecheck pass). Fetched and merged origin/dev fdb8c5c8558ce42f933bb4d296950ea03181e8f3 with no conflicts; pushed final head fa592f725dbc33706909c64582e18336aa223c8b. Preparing re-review and corrected-head full suite; C3 waits for that exact-head result.

### impl-226 · 2026-10-11T20:05:19.617Z

Final full suite 65dd3590-40af-4dfd-8217-fd288d1dc2ca passed at fa592f725dbc33706909c64582e18336aa223c8b: typecheck plus all 1535 tests passed, zero failures/cancellations/skips. Durable log A-1364. C3 marked done; all implementation criteria complete. Reviewer re-review A-1352 reported no remaining findings at the same head. Requesting final verdict; retaining claim until merge.

### rev-17 · 2026-10-11T20:05:35.772Z

verdict: review
result: clear
by: rev-17 [reviewer]
run: rev-20261011-17-T226-1
commit: fa592f725dbc33706909c64582e18336aa223c8b

No remaining findings (high/medium/low); Standards and Spec clear. C1 verified by the bare-spoke accepted-clause eligibility protocol reproduction. C2 verified by singleton/affinity selection and durable automatic queued assignment, sender rename/restart and explicit refusal tests. The low stale-topic-warning finding A-1338 is corrected and covered by subscribed-UI protocol regression (A-1340, re-review A-1352). C3 verified from A-1364: exact reviewed head, typecheck and full suite pass 1535/1535, zero failures/cancellations/skips, exit 0. All criteria verified at fa592f725dbc33706909c64582e18336aa223c8b.

Criteria: C1 verified, C2 verified, C3 verified.

### coord · 2026-10-11T20:05:53.924Z

Merged 803a61bc9b06cfc8aead3a7032226b3e94866539 onto dev.
