---
id: T-434
kind: task
title: "accounts OpenCode retained-handoff test fails on Linux: pool size 1 reached at the next launch"
state: open
status: ready
size: S
criterion_seq: 2
labels:
  - v0.1.2
  - hub
  - qa-found
  - ready-for-agent
assignee: null
parent: R-228
blocked_by: []
topic: topic-260
branch: t/T-434-accounts-opencode-retained-handoff-test
created: 2026-10-14T18:12:49.437Z
updated: 2026-10-15T00:31:09.239Z
---

## Summary

`hub/test/accounts.test.ts:220/240` (the OpenCode retained Implementer handoff) failed on a Linux c-16 droplet in E-271 QA's speed run 0cdfb9e0 at a7e07635. The launch assertion at line 61 got "crew.implementer: pool size 1 reached (pool-impl)": the previous pool member had not yet released its slot when the next launch came. A whole-file repeat on macOS passed 14/14. It is Linux- and load-sensitive, and it blocks clean droplet runs.

## Evidence

The QA run qa-2026-10-14-27-9 retains the remote log of 0cdfb9e0 and the macOS repeat log (M10).

## Acceptance criteria

- [x] C1. The cause is named: the test launching before the pool member's stop or release is observed, or a product race in releasing the pool slot. The test waits on that state, or the product is fixed.
  - done: impl-434 · 2026-10-14T18:16:58.386Z
  - verified: rev-26 [reviewer] · run rev-20261014-434-source-1 · 2026-10-14T18:17:41.496Z · commit 368b3412bd0884057427c7fa3f199c5b862ce0c8
  - verified: rev-26 [reviewer] · run rev-20261015-434-final-1 · 2026-10-15T00:31:06.910Z · commit 368b3412bd0884057427c7fa3f199c5b862ce0c8
- [x] C2. The file passes 5/5 whole-file runs, serially, beside a full local run.
  - done: impl-434 · 2026-10-14T18:23:49.807Z
  - verified: rev-26 [reviewer] · run rev-20261015-434-final-1 · 2026-10-15T00:31:06.910Z · commit 368b3412bd0884057427c7fa3f199c5b862ce0c8

## Comments

### impl-434 · 2026-10-14T18:15:13.630Z

Diagnosis: test-side race. OpenCode's SSE initial idle snapshot is available before the retained member's spoke hello / role-clause injection. #reuseEligible correctly rejects that disconnected member; the fresh launch then hits pool size 1. A temporary 2s delay before fake OpenCode client.connect reproduced the exact accounts.test.ts:240 'pool size 1 reached (pool-impl)' failure. Fix waits within the existing eventually bound for first-turn usage, idle, and released holds at the original session identity.

### rev-26 · 2026-10-14T18:17:41.496Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261014-434-source-1
commit: 368b3412bd0884057427c7fa3f199c5b862ce0c8
scope: full

No high/medium findings. hub/test/accounts.test.ts:234 now waits at original sessionId for completed-turn usage, idle and empty holds, excluding the initial disconnected OpenCode idle snapshot. Pool eligibility/fake usage ordering and A-2492 controlled spoke-delay red→green support the diagnosis. All handoff assertions and existing timeout remain unchanged; no product or fake instrumentation committed. C1 verified. C2 five serial whole-file runs beside a full local run and accepted post-clear same-head verification remain pending. Evidence A-2496: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2496-t-434-source-review-clear-at-368b3412-retained-member-first-turn-readiness.md.

Criteria: C1 verified.

### impl-434 · 2026-10-14T18:24:01.353Z

At unchanged source-reviewed 368b3412, five serial whole-file accounts runs passed 14/14 each (57.68s, 67.90s, 59.98s, 65.77s, 63.38s), alongside impl-429's full local suite. Durable log artifact posted in topic-260; C2 done. Source review clear / C1 verified by rev-26. No-mode local verify a698d324-3324-435e-af51-179fa688f95a queued for same head with rev-26 and impl-434 recipients. Awaiting hub result and final verdict.

### impl-434 · 2026-10-15T00:30:48.974Z

Same-head no-mode local verification a698d324-3324-435e-af51-179fa688f95a passed at reviewed 368b3412bd0884057427c7fa3f199c5b862ce0c8: 1665/1665, zero failures/skips, hub-only plus Neovim smoke, darwin arm64. Log A-2621. C2 already has 5/5 serial whole-file runs beside a full local suite (A-2502). Reviewer rev-26 received verification directly; awaiting final verdict and supervising merge, claim retained.

### rev-26 · 2026-10-15T00:31:06.910Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261015-434-final-1
commit: 368b3412bd0884057427c7fa3f199c5b862ce0c8
scope: evidence

No high/medium findings. Accepted same-head local auto a698d324/A-2621 selects hub-only: typecheck and 1665/1665 pass (37 free,1616 hub machine,12 Neovim smoke), zero fail/cancel/skip/todo. Both retained handoff cases pass. C2 A-2502 independently checked: five serial files,14/14 each,18:18:01–18:23:16Z, bounded by queue captures of the same full local holder impl-429/PID24110. C1 source A-2496/controlled red→green A-2492 retained. C1/C2 verified. Evidence A-2622: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2622-t-434-final-clear-at-368b3412-retained-handoff-and-serial-overlap-proof-verified.md.

Criteria: C1 verified, C2 verified.
