---
id: T-799
kind: task
title: A droplet run that hits its run timeout loses the machine shard's results, so the hung test can't be named
state: open
status: in progress
size: S
criterion_seq: 3
labels:
  - ready-for-agent
assignee: null
parent: E-482
blocked_by: []
topic: topic-508
branch: t/T-799-a-droplet-run-that-hits-its-run-timeout
created: 2026-10-18T10:52:38.748Z
updated: 2026-10-18T13:18:03.266Z
---

## Summary

Twice on 2026-10-18 a task verify hit the 75 min run timeout with exit 124: T-759 7efa2911 (A-5076) and T-709 2119e998 (A-5221). Only the free shard's results were collected. The machine shard's `suite start` lines are present, but its `✔`/`✖` and `suite timing` lines were lost with the killed reporter: in A-5221, 2145 tests started and only 275 completed. So the hung file has to be found by bisecting on the Mac, which takes about an hour per incident.

## Acceptance criteria

- [ ] C1. When a run reaches its run timeout (or is cancelled), the result names every test that started but never finished, with its file and how long it had been running. A T2 test with a planted hanging test on the in-process provider proves it.
  - failed: rev-30 [reviewer] · 2026-10-18T13:18:03.266Z · note A running repetition has no streamed execution start/finish, so interrupted results cannot name every unfinished test.
- [x] C2. Completed tests in the timed-out shard are kept in the result and its log, without depending on the reporter flushing at exit.
  - done: impl-799 · 2026-10-18T13:14:00.513Z
- [ ] C3. The suite result's first lines after "exit 124" say "hung: <file> :: <test> (running N s)" for the longest-running unfinished test.
  - failed: rev-30 [reviewer] · 2026-10-18T13:18:03.266Z · note A repetition-only timeout produces no corresponding longest hung-test line after exit124.

## Comments

### impl-799 · 2026-10-18T13:06:10.806Z

Initial comparison: A-5076/A-5221/A-5301 end with worktree-cli starts because the machine target list is path-sorted, not because that file is identified as hung. T2 regression written first on in-process provider/FakeClock: red showed counts unavailable and no hung identities; now timeout/cancellation preserve completed results and list unfinished tests longest first. A separate T1 reporter test proves completion/timing before ordered pass or source EOF; recovery regression protects the durable result after machine deletion. Completing serial targeted validation before source review.

### rev-30 · 2026-10-18T13:18:03.266Z

verdict: review
result: not clear
by: rev-30 [reviewer]
run: rev-20261018-799-source
commit: a177b6f08f49f54d10838702fac6f99c212eefbd
scope: full
findings: [{"severity":"medium","text":"M1: repetition workers install only private loadGateReporter; execution progress is streamed only by the ordinary phase. Cancellation/timeout while a repetition remains active cannot name that body or preserve its execution records. Add repetition-only interruption coverage and distinct streamed progress without inflating ordinary suite timings.","file":"hub/test/load-gate.ts","line":81}]
finding_counts: {"high":0,"medium":1,"low":0}

Source not clear, A-5317. One medium integration gap M1; implementer 93b2b407 confirms and is correcting it, no verification submitted. Phase execution order, envelope identity, atomic remote persistence/recovery and cancellation/child cutoff paths otherwise have no finding. A-5312 targeted/native evidence reviewed, but phase-only controls do not cover repetition workers. C1/C3 failed; C2 remains unverified. Replacement committed head needs fresh source review before verification. No reviewer execution.

Criteria: C1 failed (A running repetition has no streamed execution start/finish, so interrupted results cannot name every unfinished test.), C3 failed (A repetition-only timeout produces no corresponding longest hung-test line after exit124.).
