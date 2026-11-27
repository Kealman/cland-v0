---
id: T-2115
kind: task
title: system-processes 'a transient reservation release failure cannot block a later stop' fails intermittently under Linux batch load ('failed release is retried after the local call returns')
state: closed
status: done
size: S
criterion_seq: 1
labels:
  - needs-triage
assignee: null
parent: E-2072
blocked_by: []
regression_of: T-2031
topic: topic-1801
branch: t/T-2115-system-processes-a-transient-reservation
created: 2026-11-26T23:02:26.894Z
updated: 2026-11-27T00:57:17.967Z
closed: 2026-11-27T00:57:17.967Z
---

## Summary

Merge batch e9800fe2 (T-2114, run 218ef60e, A-23658/A-23655 line 8771, 2026-11-26) failed `hub/test/system-processes.test.ts::a transient reservation release failure cannot block a later stop in the live caller` with `AssertionError: failed release is retried after the local call returns` (actual false). The bisect named T-2114, but the case calls `probe(body)` without a platform, so `systemProcessProbe` forces `darwin` and never reaches the Linux children walk T-2114 changed. The case passed 5/5 locally on the same head and in every recent Linux run checked (A-23572 through A-23598). It looks like a timing race in the retry-after-return assertion under load.

## What to build

Make the retry observable through an explicit receipt or a bounded wait in the shared helper, rather than a check right after the local call returns, so the assertion doesn't depend on scheduling.

## Acceptance criteria

- [x] C1. A planted transient reservation-release failure never escapes as an uncaught error and is retried after the local call returns, proven by an awaited receipt with no timing-dependent assertion, and the case passes in the item's Linux droplet verify (test).
  - verified: rev-35 [reviewer] · run rev-35-2115-evidence-1 · 2026-11-27T00:25:16.754Z · commit c07dc7c1268fcf6cbdcb2c3f9275fc70bf28c9f8
  - done: impl-2115 · 2026-11-27T00:25:20.761Z

## Comments

### coord · 2026-11-26T23:38:15.519Z

Reclassified by coord, 2026-11-26 23:38Z: no longer treated as a flake. The case failed again in T-2112's batch 3d8c050e (A-23662), this time with the planted `transient reservation unlink failure` escaping as an uncaught exception from `fs.rm`, instead of being caught and retried. Its two failures both came after T-2031 landed (2db9e2a44), and it passed in every earlier run. The likely cause is T-2031's stop/inspection change altering how a failed reservation release is caught or retried on Linux under load. Moved to E-2072 stage 3 as a regression of T-2031: find why the planted release error escapes (on Linux, despite the darwin probe), and make it stay pending and retried.

### coord · 2026-11-26T23:38:45.224Z

Exact escape path from impl-2112's reading of A-23662: the planted `transient reservation unlink failure` thrown by `fs.rm` (eval1:130) propagates through `hub/lock.ts:466` → `termination-owner.ts:67` (`TerminationOwner.release`) → `systemProcessProbe` → the test at line 863, uncaught. Start from `TerminationOwner.release` and the lock release at lock.ts:466: a failed release should leave the reservation pending for retry rather than throwing out of the stop.

### coord · 2026-11-26T23:40:14.823Z

Cause found by impl-2115 (2026-11-26 23:40Z), a test-fixture defect rather than a production one. Every synthetic probe in system-processes uses fake PID 420100 but the real shared path /tmp/cland-termination-<uid>/420100. Parallel probe children therefore see each other's holders as dead through the synthetic kill(0), and reclaim or replace each other's reservations. The planted fs.rm hook also catches acquisition's stale-holder unlink. T-2031 added more synthetic probes, which made the collision likely on Linux. Production release ownership is unchanged and intentional. Fix: isolate reservation paths per probe scratch root, scope the hook to the release unlink, and await the unlink receipt.

### impl-2115 · 2026-11-26T23:42:06.532Z

Consumer inventory: system-process-probe.ts is imported by system-processes.test.ts, claude-code-sessions-lifecycle.test.ts, prune-process-lifecycle.test.ts and suite-cancel.test.ts (4 reachable test files). No production contract changes. Root cause proven red: simultaneous probes reuse real global reservation pathname for synthetic PID 420100; synthetic liveness lets a second probe replace the first nonce. Redirect all asynchronous reservation filesystem operations into each probe scratch root; retain real lock algorithm and isolate both link/rename operands. Retry assertion now awaits completed unlink and ENOENT after two planted release failures. Production cleanup propagation remains unchanged.

### rev-35 · 2026-11-26T23:48:25.358Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-2115-source-1
commit: 725d003886c329c0348a2446d071ed95591e43b5
scope: full
findings: [{"severity":"medium","text":"M1: the new parallel control's outer asynchronous mkdtemp/root acquisition has no separate setup observation deadline. fixtureWork owns/adopts and bounds cleanup, not this await; nested probe deadlines start afterward. Add a named shared/load-scaled setup bound while retaining/joining the root producer across expiry/cancellation.","file":"hub/test/system-processes.test.ts","line":868}]
finding_counts: {"high":0,"medium":1,"low":0}

Source not clear; A-23665 records one finite setup-bound finding, confirmed absent/no exclusion by claimant2f268433. Namespace isolation covers async reservation operations including both link/rename operands; transient fault targets the acquired holder after thaw and awaits completed rm+ENOENT before later stop. No separate functional/production blocker identified. Preserve those improvements, real two-probe nonce/close assertions and final retry receipt. Add bounded setup without abandoning a raced asynchronous root acquisition; its original sequence must stay owned/joined through late adoption/cleanup. A-23664 remains authored local macOS results/diagnosis, not Linux verification. C1 failed/unverified; hold released for scoped correction and fresh committed-head review. No Reviewer edits or test/probe/run.

Criteria: C1 failed (The new real-process contamination regression lacks a separately bounded outer root setup; preserve its producer ownership while adding that bound, then obtain Linux configured proof.).

### rev-35 · 2026-11-26T23:52:14.393Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-2115-source-2
commit: c07dc7c1268fcf6cbdcb2c3f9275fc70bf28c9f8
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Corrected source clear; A-23666 records M1 resolution. A pre-admission owner.release join retains the original acquiringRoot promise, while within/testSetupWaitMs separately observes setup with an explicit incomplete diagnostic. Verified fixtureWork closes admission, joins that retained acquisition/late scope.root adoption, and only then allows disposal; no abandoned root race. Nonce handshake, both child closes, namespace redirection and completed-unlink+ENOENT-before-later-stop assertions remain unchanged. Helper/production diff empty in correction; guide matches. Reported corrected local68/68/typecheck/lint0 are scoped macOS/Node24.21 observations, not Linux/full-closure proof; preceding helper-consumer results remain predecessor-scoped. No findings; C1 intentionally unverified pending exact-head Linux configured receipt. Hold released, request Coordinator verify window. No Reviewer changes or test/probe/run.

### rev-35 · 2026-11-27T00:25:16.754Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-2115-evidence-1
commit: c07dc7c1268fcf6cbdcb2c3f9275fc70bf28c9f8
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final same-head evidence clear; A-23668 records independent8a5ac28f/A-23667 audit. Producer code0/empty cause, unfinished[], complete0 T0/T1/T2/selected11 T3/Web at canonical72d874e33dc5ec930b39d8100572966d63123ce8. C1 exact transient-release case passes at log42119, retaining caught first rejection, two failures/completed third unlink, awaited completed-rm+ENOENT before later stop and final empty rows/retry assertion. Parallel nonce-isolation control passes42115. All4 helper consumer files pass: system68/Claude20/prune7/cancel22; adjacent lock27/cleanup4 pass. Linux runner with intended synthetic darwin child process boundary is explicit, not native macOS/procfs proof. Paired7897pass/1macOS prerequisite skip; known3 finish-only records separate, other265 T3/18 T4 unexecuted, no repetitions claimed. Linuxc8nyc1 Node24.21/Nvim0.12.5 workers2, isolated HeadlessShell1248/Chrome156.0.8078.4; advisory/cache scope retained. Prior batch/source failures remain history; source2 setup fix plus current receipt settle C1. Findings none; no Reviewer changes or additional run.

Criteria: C1 verified.

### coord · 2026-11-27T00:57:17.967Z

Merged 50dbdb4cd1470b2f9e9f7b98acc66ce5a88339fe onto dev.
