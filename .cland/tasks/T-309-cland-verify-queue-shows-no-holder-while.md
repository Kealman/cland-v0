---
id: T-309
kind: task
title: cland verify queue shows no holder while a hand run holds the legacy
  machine lease, and a stale sweep may take a live holder's lease
state: closed
status: done
criterion_seq: 3
labels:
  - hub
  - bug
  - ready-for-agent
  - v0.1.2
assignee: null
parent: C-216
blocked_by: []
topic: topic-183
branch: t/T-309-cland-verify-queue-shows-no-holder-while
created: 2026-10-12T21:49:51.411Z
updated: 2026-10-12T22:32:26.571Z
---

## Summary

Hand runs that take the legacy machine leases (the package runner's `npm test`, census runs, a container proof wrapper) are invisible to `cland verify queue --json`: it reports `holder: null` while both owner records are live. Sessions that gate on "no holder" then start suite-weight work beside them. On 2026-10-12 at 21:49Z a second session's runner judged a just-exited holder stale and took both leases mid-handoff. Make the queue show lease holders, and make sure a stale judgement never takes a lease from a live, verified owner.

## Parent

T-216 Tech debt. Found in the v0.1.2 build (T-281's Linux proof wrapper PID 60689, T-291's stress proofs; the Coordinator's own 14:16Z false stall on T-277's census, T-204's log).

## What to build

`cland verify queue --json` and the sessions panel's verify line report a hand-run holder of the legacy leases (pid, worktree, since, the run kind), the same way they report an admitted hub run. Find out whether the 21:49Z sequence was a live holder killed or merely a holder that had already exited (impl-281's diagnosis on T-281), and if a stale sweep can take or signal a live verified owner, fix it at its cause with a protocol test.

## Acceptance criteria

- [x] C1. The verify queue and the verify line show a hand-run lease holder with its pid, worktree and start.
  - verified: rev-23 [reviewer] · run rev-2026-10-12-309-1 · 2026-10-12T22:09:39.182Z · commit eea04359fb8d21dbbd808e797cef6f1c953ba9ac
  - done: impl-309 · 2026-10-12T22:10:00.195Z
  - verified: rev-23 [reviewer] · run rev-2026-10-12-309-2 · 2026-10-12T22:31:43.108Z · commit eea04359fb8d21dbbd808e797cef6f1c953ba9ac
- [x] C2. A stale-lease judgement never takes or signals a lease whose owner is alive and verified; a test proves it.
  - verified: rev-23 [reviewer] · run rev-2026-10-12-309-1 · 2026-10-12T22:09:39.183Z · commit eea04359fb8d21dbbd808e797cef6f1c953ba9ac
  - done: impl-309 · 2026-10-12T22:10:01.468Z
  - verified: rev-23 [reviewer] · run rev-2026-10-12-309-2 · 2026-10-12T22:31:43.108Z · commit eea04359fb8d21dbbd808e797cef6f1c953ba9ac
- [x] C3. Targeted tests pass and `cland verify` is green.
  - verified: rev-23 [reviewer] · run rev-2026-10-12-309-2 · 2026-10-12T22:31:43.108Z · commit eea04359fb8d21dbbd808e797cef6f1c953ba9ac
  - done: impl-309 · 2026-10-12T22:31:44.672Z

## Comments

### coord · 2026-10-12T21:50:16.527Z

Evidence (impl-281 and impl-291, 21:48–21:50Z): T-281's host wrapper PID 60689 took both legacy leases at 21:48:23Z, with matching owner records and token gkydFlQHjB7RTQ, verified by impl-291 at 21:48:36Z. impl-291's runner logged "taking over stale suite lock held by pid 60689" just before its next round at 21:48:54Z. The wrapper then vanished with exit 137 and no cleanup or duration line. The Docker container stayed running, OOMKilled false, so neither the OOM killer nor Docker stopped it. This points to the stale-lock takeover in the runner's lock code judging a live, verified owner stale and killing it, which is this item's second criterion. Raised into the v0.1.2 build: any hand run, the human's `npm test` included, can be killed this way.

### impl-309 · 2026-10-12T21:59:42.128Z

Reproduced at existing public seams: a real UTC package holder is invisible to a Honolulu hub's suite.queue, and a Honolulu package contender signals the live holder's phase runner and takes the isolated lease. Cause: raw local-time ps lstart comparison. Fix in progress: UTC-marked new lease and recovery-guard identities, conservative legacy timezone ambiguity handling, UTC cleanup anchors, hand-run UI metadata, fixture hub lock-path isolation. All repro paths use fixture leases; no live machine leases taken.

### rev-23 · 2026-10-12T22:09:39.183Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-2026-10-12-309-1
commit: eea04359fb8d21dbbd808e797cef6f1c953ba9ac

No high/medium findings. C1/C2 verified: hand-holder metadata reaches queue/CLI/sessions, canonical UTC identities protect current owners and legacy timezone ambiguity remains held. Real-runner/frame tests cover live current/legacy owners, no takeover/signals, killed recovery and PID reuse. Hot run-suite change is identity-only; fixture leases are isolated. Historical killer PID remains unknown as A-1660 states. C3 awaits full exact-head cland verify. Evidence A-1663: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1663-t-309-source-review-utc-lease-identity-and-hand-holder-display.md.

Criteria: C1 verified, C2 verified.

### rev-23 · 2026-10-12T22:31:43.108Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-2026-10-12-309-2
commit: eea04359fb8d21dbbd808e797cef6f1c953ba9ac

No high/medium findings. C1/C2 assessment retained; C3 verified by full exact-head cland verify a76743d3, A-1669: typecheck and all phases, 1690/1690, zero skips/cancellations, exit 0. Current/legacy live-owner protection, cross-timezone killed recovery, PID reuse, scratch isolation and sessions hand-holder display regressions pass. Evidence A-1670: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1670-t-309-final-review-full-utc-lease-verification-green.md.

Criteria: C1 verified, C2 verified, C3 verified.

### impl-309 · 2026-10-12T22:31:46.983Z

Exact-head full verification a76743d3-50a7-4b55-a56c-c9d10ad53234 at eea04359fb8d21dbbd808e797cef6f1c953ba9ac passed: exit 0, 1690 tests/pass 1690, fail/cancelled/skipped/todo 0. Both typechecks included. Durable log A-1669: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1669-suite-a76743d3-50a7-4b55-a56c-c9d10ad53234-all-at-eea0435.log. C1/C2 source review clear and verified; all three implementer done marks recorded. Reviewer has the result to verify C3.

### coord · 2026-10-12T22:32:02.805Z

Merged 92a0f50361f623633f516c382793c2aacfd00d37 onto dev.
