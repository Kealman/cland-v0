---
id: T-210
kind: task
title: T-178's verifier-launch reparent test sees a different protective refusal
  under full-suite load
state: closed
status: done
criterion_seq: 3
labels:
  - ready-for-agent
  - high
assignee: impl-210
parent: E-19
blocked_by: []
topic: topic-114
branch: t/T-210-t-178-s-verifier-launch-reparent-test
created: 2026-10-11T03:50:08.620Z
updated: 2026-10-11T05:17:44.969Z
closed: 2026-10-11T05:17:40.647Z
---

## What to build

Under full-suite load (T-205 run A-1017, 2026-10-11 03:49Z), T-178's verifier-launch test expected the launch-reservation refusal but got the standing-worktree refusal before its cleanup checks. Run alone it passes on dev 75b133d (13.7s) and on T-205 efcaa7a (10.5s), through the reparent and cleanup assertions. Both refusals are protective, so no unprotected prune happened.

Make the test wait on the state it means, or accept either protective refusal where both are correct, without weakening the no-prune check.

## Acceptance criteria

- [x] C1. The test asserts one deterministic refusal path, or explicitly accepts the protective ones, and still proves nothing is pruned.
  - done: impl-210 · 2026-10-11T04:22:52.634Z
  - verified: rev-13 [reviewer] · run rev-13-20261011-210-1 · 2026-10-11T05:17:21.980Z
- [x] C2. It passes 20 runs alone and 20 under four-worker load.
  - done: impl-210 · 2026-10-11T05:16:58.063Z
  - verified: rev-13 [reviewer] · run rev-13-20261011-210-1 · 2026-10-11T05:17:21.980Z
- [x] C3. `npm run typecheck && npm test` pass.
  - done: impl-210 · 2026-10-11T05:16:58.230Z
  - verified: rev-13 [reviewer] · run rev-13-20261011-210-1 · 2026-10-11T05:17:21.980Z

## Notes

Size XS. A successor to T-172's load-sensitive cases.

## Comments

### coord · 2026-10-11T04:18:07.905Z

Standing exception (Coordinator, 2026-10-11 04:18Z): until T-210 merges, reviewers may name this test as an exception, if both suite phases ran on the head, the test passes alone there, and there is no other failure. It was seen on T-205 (A-1017) and T-186 (A-1025).

### impl-210 · 2026-10-11T04:19:21.951Z

Claimed in the task worktree. Targeted reproduction command: node --test --test-name-pattern='a verifier spawned while' hub/test/lead-permissions.test.ts. The test's spawn marker does not guarantee prune observes only the launch reservation; it may also observe the verifier standing in the worktree. Will accept exactly those protective refusals and assert removed=[] plus worktree existence before continuing the reparent/cleanup checks.

### impl-210 · 2026-10-11T04:24:06.254Z

Head bdc0129 pushed to origin. C1 done. All 20 standalone repetitions passed, 1 target scenario per Node invocation and no skips. Started 20 isolated target-test imports with --test-concurrency=4 via runSuite under its default /tmp/cland-suite.lock; full reproduction harness and logs will follow as an artifact.

### impl-210 · 2026-10-11T05:16:58.364Z

C2/C3 complete at unchanged bdc01290b653b248a3e1d4b85950b0477ae9fba1. A-1029 contains all 20 standalone passes; A-1030 is the exact repetition harness; A-1057 contains 20/20 loaded target scenarios at Node --test-concurrency=4 via standard runSuite, default machine suite lock, exit 0, no failures/cancellations/skips/todo. Loaded duration 65.60s, lock wait 1750.37s. Full hub-managed suite a747b02f-ca9d-4fe3-a9b1-3d83982595fd passed typecheck and hub 1132/1132 plus Neovim 253/253 (1385 total), all zero failures/cancellations/skips/todo; durable log A-1055. No additional code changes.

### rev-13 · 2026-10-11T05:17:21.980Z

verdict: review
result: clear
by: rev-13 [reviewer]
run: rev-13-20261011-210-1
commit: bdc01290b653b248a3e1d4b85950b0477ae9fba1

No high or medium findings. Standards and Spec clear: exact two refusals match existing production protections; explicit removed=[], single same-item failure and all worktree/reparent/authorization/cleanup/claim assertions retained.

C2 checked: A-1029 standalone20/20 and A-1057 four-worker20/20, all zero fail/cancel/skip/todo; A-1030 harness uses independent fixtures, standardrunSuite/defaultmachine lock, no retries/bypass. C3 checked: A-1055 typecheck+hub1132/1132+Neovim253/253, combined1385/1385,zero fail/cancel/skip/todo,exit0. Clean unchanged pinnedhead; durable full logs read-only, writing suites notindependentlyrerun. No exception applied.

C1,C2,C3 all verified; final readiness clear. A-1059: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1059-t-210-final-review-at-bdc0129-40-repetition-passes-and-full-1385-1385.md

Criteria: C1 verified, C2 verified, C3 verified.

### coord · 2026-10-11T05:17:40.549Z

Merged da0d0c43fab7f906006db1a6ad19834e5f4715c3 onto dev.

### coord · 2026-10-11T05:17:44.969Z

Merged. The standing T-210 exception ends for any head containing this merge; runs on older heads keep it.
