---
id: T-799
kind: task
title: A droplet run that hits its run timeout loses the machine shard's results, so the hung test can't be named
state: open
status: review
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
updated: 2026-10-18T13:38:31.047Z
---

## Summary

Twice on 2026-10-18 a task verify hit the 75 min run timeout with exit 124: T-759 7efa2911 (A-5076) and T-709 2119e998 (A-5221). Only the free shard's results were collected. The machine shard's `suite start` lines are present, but its `✔`/`✖` and `suite timing` lines were lost with the killed reporter: in A-5221, 2145 tests started and only 275 completed. So the hung file has to be found by bisecting on the Mac, which takes about an hour per incident.

## Acceptance criteria

- [x] C1. When a run reaches its run timeout (or is cancelled), the result names every test that started but never finished, with its file and how long it had been running. A T2 test with a planted hanging test on the in-process provider proves it.
  - done: impl-799 · 2026-10-18T13:30:48.345Z
- [x] C2. Completed tests in the timed-out shard are kept in the result and its log, without depending on the reporter flushing at exit.
  - done: impl-799 · 2026-10-18T13:30:48.724Z
- [x] C3. The suite result's first lines after "exit 124" say "hung: <file> :: <test> (running N s)" for the longest-running unfinished test.
  - done: impl-799 · 2026-10-18T13:30:49.196Z

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

### impl-799 · 2026-10-18T13:30:49.609Z

M1 corrected at pushed head 7ffa557cb967ae32a45d9a4e8a1b3714daecced3. A-5324 retains the controlled repetition-only red/green proof, five completed repetition receipts, canonical file-envelope handling, and separate ordinary timing accounting. T1 suite-progress 4/4 (0.300 s), T2 suite-hung-component 2/2 (0.739 s), full T3 durations-runner 15/15 (30.331 s), quarantine-runner 7/7 (8.955 s); final lint/typecheck green. Native reporter control retains four bodies/four matching timings. Brief cover-quiet respected; full changed-file validation resumed only after lift. No post-review dev merge and no verification submitted.

### impl-799 · 2026-10-18T13:31:13.178Z

Validation count correction: quarantine-runner passed 10/10 tests, not 7/7. The A-5324 README and copied log already record 10 tests accurately; exit 0 and the measured 8.955 s are unchanged.

### rev-30 · 2026-10-18T13:36:56.248Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261018-799-repetition-correction
commit: 7ffa557cb967ae32a45d9a4e8a1b3714daecced3
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source correction clear, A-5329; M1 closed. Repetition workers stream uniquely scoped execution receipts while timings remain disabled; ordinary manifest phases alone emit timings. Native SIGTERM/SIGKILL controls observe phase completion before interruption and retain both held repetition identities, ordinary completions and exact ordinary-only timings; stable control retains five repeated completions. Shared alias/envelope handling and T2 completion-before-report/status-barrier cleanup reviewed. A-5324 raw 4/4+2/2+15/15+10/10 validation and exact four streamed/side timings checked. Prior A-5317 retained; no dev merge or further finding. C1–C3 await exact-head mode-free droplet evidence. No reviewer execution.

### impl-799 · 2026-10-18T13:38:31.047Z

Source correction clear rev-20261018-799-repetition-correction (A-5329). Submitted exactly one mode-free droplet verify, 037b2b67-8c38-4286-8248-e1f0d8116d53, at clean reviewed head 7ffa557cb967ae32a45d9a4e8a1b3714daecced3, reporting to reviewer and impl-799. CLI admission reply timed out at 15 s, but queue and task.view confirm admitted/launching remotely; no resubmission. Awaiting hub result at the unchanged reviewed head.
