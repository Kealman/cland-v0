---
id: T-385
kind: task
title: "A hung test holds the verify queue forever: no per-test timeout and no stall kill"
state: open
status: review
size: S
criterion_seq: 4
labels:
  - v0.1.2
  - hub
  - ready-for-agent
  - qa-found
assignee: null
parent: R-228
blocked_by: []
topic: topic-246
branch: t/T-385-a-hung-test-holds-the-verify-queue
created: 2026-10-14T12:21:44.443Z
updated: 2026-10-14T13:58:27.485Z
---

## Summary

A full verify can hang forever. T-359's run 6a9dce81 stopped producing output after 1228 tests: the `node --test` runner and a child `cland-spoke` sat at 0% CPU for over 55 minutes while four runs queued behind it. The runner has no per-test timeout, and the suite has no wall-clock cap that kills a silent run.

## Evidence

- Run 6a9dce81 (T-359 at its head, full mode), started at 11:12Z. `suite.log` stopped growing at 11:27Z, and the human noticed at 12:21Z.
- Processes at 12:21Z: suite-worker pid 81684 at 69 min, `node --test --test-concurrency=4` pid 48725 at 58 min and 0% CPU, child `cland-spoke.ts` pid 77520 at 55 min. Machine load about 2.
- The last started tests in the log were merge-gate cases ("a verdict whose session changes role…", "release, topic closure and cleanup failures…", "retrying a completed merge preserves staged deletion…").
- Cost: about one hour of the single local slot, with four Implementers waiting.

## Acceptance criteria

- [x] C1. Every test file runs with a per-test timeout, for example `--test-timeout` set from a duration manifest or a default of 120 s, so a hung test fails with its name instead of blocking.
  - done: impl-385 · 2026-10-14T12:35:29.096Z
- [x] C2. The suite worker kills a run whose log has been silent for longer than a configured stall limit (default 10 min). The result reads `stalled: no output for <n> min` and names the last started tests. The process tree, test children and spokes included, is reaped.
  - done: impl-385 · 2026-10-14T13:48:02.595Z
- [x] C3. A test reproduces a hung test file and shows the timeout failure, and another shows the stall kill and cleanup with no orphan processes left.
  - done: impl-385 · 2026-10-14T12:41:20.416Z
- [x] C4. The hanging test from run 6a9dce81 is identified from its log and fixed, or filed separately with evidence.
  - done: impl-385 · 2026-10-14T12:32:34.448Z
  - verified: rev-23 [reviewer] · run rev-2026-10-14-385-3 · 2026-10-14T13:54:50.143Z · commit 699bf7b51b55479ccaf5c56faf2206b26dc97567

## Comments

### impl-385 · 2026-10-14T12:34:30.789Z

Implemented default/configurable 120s per-test timeout and 10m silent-command guard in the local suite worker. Protocol regressions reproduced the missing timeout and missing stall result before changes, then passed with named failures, removal of test/spoke/detached TERM-resistant child, and successor admission. C4 filed separately as T-397; original held-ps cases pass isolated, attribution/root cause remains unproven. Validating all touched test files and cancellation compatibility before source review.

### impl-385 · 2026-10-14T12:44:09.790Z

Source ready at pushed 96ec6543db68c02b577850364b1fcfe2f85713fe. Complete touched suite.test 65/65 (A-2361), final strengthened stall/output checks 2/2 (A-2366), suite-runner 50/50, root typecheck (A-2367), and diff check pass. C1–C4 done; original incident investigated separately as T-397. Fetched origin/dev; its delta is tracker-only e0cecd00, so no dependency/conflict merge under the latest build rule. Requesting source review before queued verification; qaPolicy none.

### rev-23 · 2026-10-14T12:48:02.800Z

verdict: review
result: not clear
by: rev-23 [reviewer]
run: rev-2026-10-14-385-1
commit: 96ec6543db68c02b577850364b1fcfe2f85713fe
scope: full

Medium — hub/src/suite-command.ts:27–29: stall cleanup captures only the npm identity at timeout; if npm has exited while a background child keeps pipes open, endProcess's absent-leader path returns true without capturing/reaping that child. Destroying pipes then completes the supervisor and releases admission despite the orphan. Custom commands without package root/runner metadata are not covered by the later lease sweep. Retain verified child ownership and add a real-frame exited-parent/inherited-pipe regression. All nine changed files reviewed; no additional findings in timeout policy, partial-output, ordinary held-parent cleanup, cancellation or C4's T-397 filing. No suite yet. A-2372: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2372-t-385-source-review-exited-parent-can-leave-inherited-pipe-orphan.md.

Criteria: C2 failed (If npm exits while a child retains inherited pipes, stall cleanup treats the absent leader as reaped and can report/release admission with that orphan still alive.).

### impl-385 · 2026-10-14T13:01:29.920Z

Corrected source review finding rev-2026-10-14-385-1 in pushed 7987c2be4ba6492fa2817c8b77b1b91396e79b49. A-2373 reproduces the exited-parent inherited-pipe orphan red. A-2374 passes corrected orphan/held-parent/cancellation checks 3/3 with unrelated same-command/cwd process preserved. Complete corrected suite.test 66/66, 346.66s (A-2377); root typecheck passes (A-2378); unchanged runner policy has prior complete 50/50 evidence A-2369. Captures are ancestry-proven and serialized once/sec; endProcess rechecks every retained identity. Fetched origin/dev now 6ae9b8ed (T-366 unrelated accounts work; no dependency/conflict merge). No verify submitted; requesting corrected source review.

### rev-23 · 2026-10-14T13:03:56.068Z

verdict: review
result: not clear
by: rev-23 [reviewer]
run: rev-2026-10-14-385-2
commit: 7987c2be4ba6492fa2817c8b77b1b91396e79b49
scope: full

Medium — hub/src/suite-command.ts:42, :62–63: periodic capture closes the exited-parent hole only for observed children. A child created and reparented between snapshots remains outside owned; after npm exits, cleanup of the absent root returns true and the supervisor can finish with that inherited-pipe orphan alive. The new regression holds its parent for 3 seconds and guarantees capture. Add the fast-exit boundary and retain verified ownership or explicitly preserve unproven cleanup rather than claiming a completed reap/admission release. Captured-child and unrelated-process safeguards are sound; existing held-parent/spoke/stubborn-child/cancellation assertions remain. C1/C4 unchanged. A-2380: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2380-t-385-correction-review-fast-exit-ownership-gap-remains.md.

Criteria: C2 failed (A pipe-holding child spawned and reparented between one-second ownership snapshots is never captured; the absent-root cleanup can still report completion and release admission with it alive.).

### coord · 2026-10-14T13:05:57.503Z

Coordinator decision on C2's edge case (2026-10-14 13:06Z): a detached writer that can't be verified doesn't hold the queue. The run reports 'stalled … cleanup incomplete' with its evidence, all verified identities are terminated, one warn notice goes to the human and is journalled, then the lease is released and the next run admitted. There's no OS pipe-ownership machinery and no false reap claim. The fast-exit regression covers it.

### impl-385 · 2026-10-14T13:48:04.059Z

Source corrected per Coordinator decision 0e5224c8 at pushed 699bf7b51b55479ccaf5c56faf2206b26dc97567. Reap all verified identities; if inherited pipes remain, fail explicitly with `cleanup incomplete: unverified inherited-pipe writer`, preserve unknown processes, post exactly one warn in Agents/inbox and journal it, then release admission. T-410 covers exact-writer ownership. Deterministic after-snapshot/before-next-snapshot fixture proves this and successor admission even while original result is held by recipient hygiene. A-2389 red; A-2392 decision/implementation; A-2394 full suite.test 67/67; A-2395 final boundary; A-2399 visibility 15/15, A-2400 inbox 5/5, A-2401 events 6/6, A-2403 journal flush, A-2404 root typecheck. Prior unchanged runner 50/50 A-2369. Clean diff check, fetched origin/dev at 31dd9918 (tracker/unrelated T-366); requesting source review before no-mode verify.

### rev-23 · 2026-10-14T13:54:50.143Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-2026-10-14-385-3
commit: 699bf7b51b55479ccaf5c56faf2206b26dc97567
scope: full

No high or medium findings remain across Standards and Spec in all 15 changed files. Clear under the Coordinator’s recorded C2 exception: terminate all verified identities; an unverified inherited-pipe writer is preserved, explicitly fails cleanup, produces one Agents/inbox/journal warning, and releases admission. The deterministic fast-exit regression covers held/retried reporting and successor admission without a false complete-reap claim. Exact writer ownership is T-410. C4 verified through T-397’s incident filing; root cause remains unproven. C1–C3 remain unverified until complete no-mode cland verify at this exact head. Evidence and full review: A-2405 — /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2405-t-385-corrected-source-review-bounded-stall-and-explicit-incomplete-cleanup.md.

Criteria: C4 verified.

### impl-385 · 2026-10-14T13:58:27.485Z

After clear source review rev-2026-10-14-385-3 (A-2405), submitted no-mode cland verify at exact head 699bf7b51b55479ccaf5c56faf2206b26dc97567. Run 6930503c-e90b-4e95-89d6-635151bf9128 queued at position 4; result recipients rev-23 and impl-385. Waiting for hub result.
