---
id: T-680
kind: task
title: "A droplet run typechecks once: the host gate's result travels with the candidate tree hash"
state: open
status: review
size: S
criterion_seq: 3
labels:
  - v0.1.4
  - verification
  - hub
assignee: null
parent: E-676
blocked_by: []
topic: topic-409
branch: t/T-680-a-droplet-run-typechecks-once-the-host
created: 2026-10-16T19:59:27.759Z
updated: 2026-10-16T21:06:38.557Z
---

## Summary

Every droplet run typechecks twice: the host gate runs `npm run typecheck` on the Mac before any droplet is made (`hub/src/hub/suites.ts` `#hostGate`, ~12 s), and the droplet runs it again as command 0 (`hub/src/hub/suite-worker.ts` `suiteCommands`, 14–19 s residual) (report-strategy §1.1, memo §5.2.7). The second run proves nothing the first did not, because the tree is the same.

## What to build

The host gate records what it checked: the candidate tree hash, the command and its exit. The run's job carries that record to the droplet. The droplet worker compares the tree it checked out with the recorded one: equal means it skips the typecheck and logs `typecheck: host gate at <tree> (not repeated)`; different, or no record, means it runs the typecheck as today. Local runs, which have no host gate, keep exactly one typecheck in the worker. The result names which machine ran the typecheck.

This is the step later tickets hang the T0 test lint on (T-682), so the "check step" runs once per run wherever it runs. E-614's T-668 moves the host gate to the project's `check` command; whichever of the two lands second carries the rule over to the other's command.

## Acceptance criteria

- [x] C1. A droplet run whose host gate passed at tree X runs no typecheck on the droplet and logs the reuse line naming X, proved by a remote-fixture test.
  - done: impl-680 · 2026-10-16T20:07:25.721Z
- [x] C2. A droplet run whose delivered tree differs from the host gate's runs the typecheck on the droplet, proved by a planted-difference test.
  - done: impl-680 · 2026-10-16T20:07:26.211Z
  - verified: rev-31 [reviewer] · run rev-20261016-680-source · 2026-10-16T20:09:36.634Z · commit 2394853d421e5fe26adeda6562a5d940e1005dad
  - verified: rev-31 [reviewer] · run rev-20261016-680-source-2 · 2026-10-16T21:06:38.557Z · commit 64a5729c187403b32c3be2e1e3bcd5244c380c09
- [x] C3. A local run executes the typecheck exactly once, proved by a suite test.
  - done: impl-680 · 2026-10-16T20:07:27.013Z
  - verified: rev-31 [reviewer] · run rev-20261016-680-source · 2026-10-16T20:09:36.634Z · commit 2394853d421e5fe26adeda6562a5d940e1005dad
  - verified: rev-31 [reviewer] · run rev-20261016-680-source-2 · 2026-10-16T21:06:38.557Z · commit 64a5729c187403b32c3be2e1e3bcd5244c380c09

## Comments

### impl-680 · 2026-10-16T20:03:10.136Z

Implementation seams: existing remote-fixture coverage for receipt reuse and planted checkout difference, existing suite CLI coverage for one local typecheck. Tests retain existing assertions, with remote typecheck-failure case forced through the mismatch fallback. C4 escalated to lead as post-merge evidence.

### coord · 2026-10-16T20:03:59.902Z

Coordinator (D51): C4, ten post-merge droplet runs showing no remote typecheck, is removed from this ticket because it can only be shown after merge. It's covered by E-676's Definition of done C6 and measured at the epic demo. C1–C3 gate the merge.

### coord · 2026-10-16T20:04:19.235Z

Coordinator, precision: the removed C4 measured the median droplet lifetime gain of at least 12 s over 10 runs after the merge against 10 before. I record that measurement at E-676's demo alongside C6.

### rev-31 · 2026-10-16T20:09:36.634Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261016-680-source
commit: 2394853d421e5fe26adeda6562a5d940e1005dad
scope: full
findings: [{"severity":"low","text":"Modified broad T3 reuse scenario measures15.872s against D53 target10s; report-only tier budget migration follow-up, existing allowance14.986s.","file":"hub/test/executor-run.test.ts","line":49}]
finding_counts: {"high":0,"medium":0,"low":1}

Source clear; Standards1low/Spec0 findings, A-4174. All8files and scheduler/shard/recovery/delivered-shell/local/result seams reviewed. Persisted successful receipt carries exact command/canonical tree; remote shell independently hashes clean actual candidate via private index, and absent/mismatch/unreadable/failed evidence runs typecheck normally. Shards inherit durable parent receipt; old jobs fallback safely; local scheduling remains one check with provenance. Planted committed difference preserves remote failure-stops-tests assertion. A-4172 targeted executor21of21/suite11of11/close2of2 and typecheckgreen; independent ref/diffcheck confirmed. C2/C3 source-established; C1 final execution waits exact-head task verify after explicit Coordinator hold lift, no forced full run requested. Former C4 lifetime comparison explicitly moved to epic demo. Low T3 target issue is report-only per D53; Tech debt/S follow-up to lead, no medium blocker. No Reviewer edits/tests.

Criteria: C2 verified, C3 verified.

### impl-680 · 2026-10-16T21:05:47.033Z

Droplet e410fa45/A-4202 failed changed remote subcase: old HOME substring detector exited 3 at actual Linux host gate before remote creation. Reproduced locally by changing only fixture host HOME to a Linux-like runner path; kept it as regression and used explicit host-only fake-machine marker instead. Fixture-only fix 64a5729c pushed, no dev merge after review (rule 11). Full executor-run file 21/21 in 97.98s; committed-head typecheck green. Evidence A-4203; requesting new source review before verify retry.

### rev-31 · 2026-10-16T21:06:38.557Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261016-680-source-2
commit: 64a5729c187403b32c3be2e1e3bcd5244c380c09
scope: full
findings: [{"severity":"low","text":"Broad T3 reuse scenario still measures15.685s versus D53 report-only10s target; existing Tech debt/S migration follow-up remains.","file":"hub/test/executor-run.test.ts","line":49}]
finding_counts: {"high":0,"medium":0,"low":1}

Corrected source clear; Standards1low/Spec0 remaining findings, A-4204. Six-line fixture correction only, production unchanged/no devmerge. Independently inspected A-4202 Linux failure: HOME substring caused host exit3 before remote; stronger provenance assertion correctly failed. A-4203 deterministic Linux-style tempHOME red retains regression; corrected host-only fake-machine marker is present at hostgate and omitted by fakeSSH remote allowlist. Committed tree mismatch, remoteexit3, stops-tests and allprovenance assertions retained. Whole executor21of21/97.977s and exact-head typecheck reportedgreen; ref/diffcheck confirmed. C2/C3 source marks current; C1 awaits new exact-head no-mode droplet taskgate. Existing low broadT3 duration target remains report-only, not blocking. A-4202 historical exit1 not waived. No Reviewer edits/tests.

Criteria: C2 verified, C3 verified.
