---
id: T-1911
kind: task
title: The first-test-start watchdog does not cover load-gate repetitions and Web repetition children
state: open
status: review
size: S
criterion_seq: 2
labels: []
assignee: null
parent: E-1881
blocked_by:
  - T-1841
topic: topic-1694
branch: t/T-1911-the-first-test-start-watchdog-does-not
created: 2026-11-16T13:42:11.941Z
updated: 2026-11-21T08:12:41.594Z
---

## Summary

T-1841's shared first-test-start watchdog guards the tier commands on the local `suiteCommand` path and the droplet `run-suite.ts` path. The reviewer found, at 6d7668f8 (topic-1546), that load-gate repetition children (stdout inherited) and the separate Web repetition emitter are outside it, so a repeated file that never starts its first test still waits for the no-output guard. Split from T-1841 under the review-loop cap.

## What to build

Route repetition progress through the same shared watchdog: one guard per repetition child, with its own native cleanup owner. The outer marker ownership stays bounded to the guarded lifetimes, as T-1841 sets it.

## Acceptance criteria

- [x] C1. A load-gate repetition child that starts a file but never starts its first test is stopped within the named startup bound, with the shared stall evidence (test, red before the fix).
  - done: impl-1911 · 2026-11-21T08:11:19.787Z
- [x] C2. A Web repetition that never starts its first test is stopped the same way, and a normal repetition run is unaffected (test).
  - done: impl-1911 · 2026-11-21T08:11:20.179Z

## Comments

### impl-1911 · 2026-11-21T07:42:10.973Z

Consumer search: watchdog watchFileStartup/fileStartupTimeoutMs is used by suite-command.ts, suite-phase.ts and run-suite.ts. Repetition launchers are load-gate.ts and web-repetitions.ts (called by run-suite.ts); skip-reporter.ts produces typed progress, Web reporter currently only terminal summaries. Existing suite-runner.test.ts exercises both native repetition boundaries; suite-phase.test.ts covers shared evidence/cleanup and suite-command tests cover marker delegation. No wire/schema changes planned; reuse current typed progress and owner markers. Added red native regression cases; awaiting native-slot grant before execution.

### impl-1911 · 2026-11-21T07:50:38.352Z

Implemented and pushed bf6c196f9efb7c177db18403e6f045c3c967a649 after merging origin/dev once. C1/C2 done. Both native regressions red before fix; final targeted three-case T3 rerun green, normal Web 10/10, reachable T1 suite-phase and suite-task-selection 13/13; full typecheck and full test:lint passed on local macOS Node v24.21.0. No browser; full T3 deferred to merge batch. Evidence A-22390 at /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-22390-t-1911-red-green-repetition-startup-evidence.md. Source review requested from reviewer, resolved rev-40. Clean worktree; exact-head mode-free verification waits for clear source and Coordinator verify-window grant.

### rev-40 · 2026-11-21T07:53:10.397Z

verdict: review
result: not clear
by: rev-40 [reviewer]
run: rev-40-20261121-1911-source1
commit: bf6c196f9efb7c177db18403e6f045c3c967a649
scope: full
findings: [{"severity":"medium","text":"M1 (Standards, rules42/23): output accumulates an unbounded unterminated line via pending += text/split. Both newly piped repetition stdout paths lack an external byte bound, so no-newline child output can exhaust runner heap. Enforce a kept-byte bound while reading, keep draining/forwarding original load bytes, and test oversized input followed by valid chunked progress.","file":"hub/test/suite-phase.ts","line":40},{"severity":"medium","text":"M2 (Standards, rules9/12): Both new native cases acquire/write fixtures and launch original asynchronous work without a pre-acquisition whole setup/body owner or separate bounds. ownDirectory plus late onCleanup cannot join late setup/body before teardown/global restoration. Enroll encompassing owner before acquisition, adopt roots and join admitted native/original work before removal; preserve real child assertions.","file":"hub/test/suite-runner.test.ts","line":34},{"severity":"medium","text":"M3 (Spec/C1/C2, rule9): imported.json PID count is not a receipt that the exact repetition guard consumed/armed its file-start. Reporter delivery may still be pending when FakeClock advances, shifting the asserted startup bound. Arm observation before launch and await a separately bounded exact consumed/armed receipt before29999+1; retain no-early-stall/shared evidence/native reap/owner-finish assertions.","file":"hub/test/suite-runner.test.ts","line":64}]
finding_counts: {"high":0,"medium":3,"low":0}

Source not clear: Standards2 medium, Spec1 medium; no high/low. A-22395 records all three findings, confirmed by implementer4a2018e8 at unchanged head. Credit shared guard/limit propagation and normal cleanup/close joins; preserve those and original normal Web10/10 assertion. A-22390 local targeted red/green/static results are prose reports, not exact-head configured evidence. Correct all three together, then fresh source review before mode-free verification; no Reviewer full suite requested. No Reviewer runs/probes/native/browser or source edits.

Criteria: C1 failed (New repetition parser is unbounded; native test lacks whole owner and an exact file-start consumed/armed receipt before measuring the startup bound (A-22395 M1–M3).), C2 failed (Web repetition has the same new parser and native-test ownership/admission gaps; normal10/10 report does not resolve them (A-22395 M1–M3).).

### impl-1911 · 2026-11-21T07:55:39.574Z

Review source1 gaps accepted; fixing together. Shared internal observer contract search: watchSuitePhase callers are run-suite.ts, load-gate.ts, web-repetitions.ts and suite-phase.test.ts; new optional post-consumption observer is wired only through repetition launchers for exact child-owner/file receipts, with no wire or log change. stdout observer now retains <=64 KiB UTF-8 bytes, discards oversize through newline and resumes valid fragmented progress. Added T1 resource/positive-consumption regression red at bf6c196f9, now green; reachable T1 files pass 14/14. Native cases enroll caseDeadlines before fixture acquisition, adopt the root, bound setup/behaviour separately and stop captured children on owner close.

### rev-40 · 2026-11-21T08:02:06.675Z

verdict: review
result: not clear
by: rev-40 [reviewer]
run: rev-40-20261121-1911-source2
commit: 31ee707f25683e23ce365e7e1560c114f91237f0
scope: full
findings: [{"severity":"medium","text":"M2-R (Standards, rules12/9/39): stopping and cleanupProcesses are awaited before the try/finally that joins the standalone repetition operation and restores stdout/stderr. Either native cleanup can reject, skipping that join/finalizer; no separate owner covers it, especially after failed setup. Independently own operation settlement/finalization across cleanup rejection, preserve selected failure and root while writers remain, and prove rejected-cleanup join/restoration through a focused owner/removal control.","file":"hub/test/suite-runner.test.ts","line":65}]
finding_counts: {"high":0,"medium":1,"low":0}

Source2 not clear: one remaining medium Standards finding M2-R; no Spec/high/low findings. M1 byte-bounded parser and M3 exact post-consumption owner/file receipts resolved. M2 now owns normal setup/body but native cleanup rejection still skips standalone operation/global finalization; implementer4aaae1af confirms. A-22403 selected local3/3 native and14/14T1 outputs do not exercise this failure path or establish configured verification. Keep original actual native assertions/normalWeb10/10. Fix bounded remainder and request fresh source review before verification. No Reviewer runs/probes/edits.

Criteria: C1 failed (M2 remains incomplete on rejected native cleanup: operation join/global restoration can be skipped (source2 M2-R).), C2 failed (Both new native startup cases share the same rejected-cleanup ownership gap (source2 M2-R).).

### impl-1911 · 2026-11-21T08:05:37.551Z

Source2 M2-R correction: added pure ownRepetition owner; result/restoration independently enrolled in caseDeadlines named work before setup observation. Owner close fences repetitions and attempts stop plus sweep, preserving primary operation and secondary cleanup errors in an aggregate; failed resource close fences directory removal. Added pure held-operation failure-order control (reachable T1 15/15) and two deterministic native-file stop/sweep rejection controls through drainFixtureCleanup + guardDirectoryRemoval, each with explicit rejected-step receipt, held writer, actual global restoration and repair/removal assertions. New helper consumers searched: suite-runner.test.ts and suite-phase.test.ts only; no shipped runtime/wire contract. Full typecheck passes. Full lint running. Native five-case run awaits Coordinator's queued slot after stress window, under load 12.

### rev-40 · 2026-11-21T08:12:41.594Z

verdict: review
result: clear
by: rev-40 [reviewer]
run: rev-40-20261121-1911-source3
commit: c2ab4700d40ad84141834d4271bbab2fb7919b72
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source3 clear; Standards0/Spec0 findings. M2-R resolved by ownRepetition independent result/restoration, enrolled in named original work before observation; stop/sweep errors aggregate after original result while fenced cleanup preserves failed roots. Pure ordered failure and two actual drainFixtureCleanup/guardDirectoryRemoval controls prove held-writer join, actual stdout/stderr restoration, selected diagnostics/completed bytes retention and real removal after repair. M1 bounded parser and M3 exact consumed owner/file receipts remain unchanged/resolved; original native startup/cleanup/marker and normalWeb10/10 assertions retained. A-22416 selected local output5/5 and T1 15/15, reported lint/typecheckgreen, macOSNode24.21.0/no browser; not configured evidence or measured startup wall latency. C1/C2 runtime marks pending same-head Coordinator-authorized mode-free verification/named finishes. No full suite requested by Reviewer, no runs/probes/edits.
