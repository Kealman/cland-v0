---
id: T-799
kind: task
title: A droplet run that hits its run timeout loses the machine shard's results, so the hung test can't be named
state: open
status: ready
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
updated: 2026-10-18T15:17:41.724Z
---

## Summary

Twice on 2026-10-18 a task verify hit the 75 min run timeout with exit 124: T-759 7efa2911 (A-5076) and T-709 2119e998 (A-5221). Only the free shard's results were collected. The machine shard's `suite start` lines are present, but its `✔`/`✖` and `suite timing` lines were lost with the killed reporter: in A-5221, 2145 tests started and only 275 completed. So the hung file has to be found by bisecting on the Mac, which takes about an hour per incident.

## Acceptance criteria

- [x] C1. When a run reaches its run timeout (or is cancelled), the result names every test that started but never finished, with its file and how long it had been running. A T2 test with a planted hanging test on the in-process provider proves it.
  - done: impl-799 · 2026-10-18T13:30:48.345Z
  - verified: rev-30 [reviewer] · run rev-20261018-799-final · 2026-10-18T14:04:03.580Z · commit 7ffa557cb967ae32a45d9a4e8a1b3714daecced3
  - verified: rev-30 [reviewer] · run rev-20261018-799-integration-final · 2026-10-18T15:12:00.025Z · commit 3350ad94fae88a3e3d203d8a529dfff2d87f7719
  - verified: rev-30 [reviewer] · run rev-20261018-799-summary-composition · 2026-10-18T15:17:40.623Z · commit be6741ba45d654a1fb42d44d5ef4b2d5e7c2e853
- [x] C2. Completed tests in the timed-out shard are kept in the result and its log, without depending on the reporter flushing at exit.
  - done: impl-799 · 2026-10-18T13:30:48.724Z
  - verified: rev-30 [reviewer] · run rev-20261018-799-final · 2026-10-18T14:04:03.580Z · commit 7ffa557cb967ae32a45d9a4e8a1b3714daecced3
  - verified: rev-30 [reviewer] · run rev-20261018-799-integration-final · 2026-10-18T15:12:00.025Z · commit 3350ad94fae88a3e3d203d8a529dfff2d87f7719
  - verified: rev-30 [reviewer] · run rev-20261018-799-summary-composition · 2026-10-18T15:17:40.623Z · commit be6741ba45d654a1fb42d44d5ef4b2d5e7c2e853
- [x] C3. The suite result's first lines after "exit 124" say "hung: <file> :: <test> (running N s)" for the longest-running unfinished test.
  - done: impl-799 · 2026-10-18T13:30:49.196Z
  - verified: rev-30 [reviewer] · run rev-20261018-799-final · 2026-10-18T14:04:03.580Z · commit 7ffa557cb967ae32a45d9a4e8a1b3714daecced3
  - verified: rev-30 [reviewer] · run rev-20261018-799-integration-final · 2026-10-18T15:12:00.025Z · commit 3350ad94fae88a3e3d203d8a529dfff2d87f7719
  - verified: rev-30 [reviewer] · run rev-20261018-799-summary-composition · 2026-10-18T15:17:40.623Z · commit be6741ba45d654a1fb42d44d5ef4b2d5e7c2e853

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

### rev-30 · 2026-10-18T14:04:03.580Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261018-799-final
commit: 7ffa557cb967ae32a45d9a4e8a1b3714daecced3
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final evidence clear, A-5339. Unchanged source-reviewed head passes full droplet 037b2b67/A-5338: 2653 pass, zero fail/cancelled, eight prerequisite skips; hub free/machine and Neovim finalize. Independent timings plus positive reporter lines confirm progress 4/4, hung component 2/2, durations-runner 15/15 and quarantine-runner 10/10; seven reported load groups pass 35/35. Timeout/cancellation and both repetition-only SIGTERM/SIGKILL controls pass, retaining unfinished identities, completed siblings and ordinary-only timings. Durable recovery, per-machine cutoff and longest-hung result ordering controls pass. C1–C3 verified with A-5329 source review; M1/A-5317 retained as corrected history. One inherited init-next report-only execFile trip remains C-326, no scoped carrier trips; no global zero-trip claim or hard budget failure. No source change, reviewer execution or per-item QA.

Criteria: C1 verified, C2 verified, C3 verified.

### impl-799 · 2026-10-18T14:44:58.893Z

Coordinator-authorized conflict merge completed once: 3350ad94fae88a3e3d203d8a529dfff2d87f7719 merges reviewed 7ffa557c with origin/dev 2a3aa788 (including T-714). Resolution retains occasion identity planning, soak propagation and selection-file cleanup alongside execution-order progress and disabled repetition timings. A-5362 includes both focused diffs and raw serial checks: suite-stage-rules 8/8 (1.293 s), durations-runner 15/15 (46.069 s), quarantine-runner 10/10 (13.057 s), then lint/typecheck green. Committed/pushed; requesting delta source review, then one new exact-head mode-free droplet gate as directed.

### rev-30 · 2026-10-18T14:46:29.325Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261018-799-occasion-integration
commit: 3350ad94fae88a3e3d203d8a529dfff2d87f7719
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Authorized integration source clear. Primary 6ca27255 authorizes the single dev merge and requires a new droplet gate. Resolution preserves T-714 occasion identity planner, both selection-carrier deletions and soak environment/selection propagation, plus T-799 scoped stdout execution receipts and repetition timing suppression. Incoming readTierAssignments and reviewed progress receipt support coexist in Suites. No test assertions, lifecycle controls or allowances changed. A-5362 raw logs independently confirm stage rules 8/8, durations-runner 15/15 and quarantine-runner 10/10 with positive passes and no skips/failures. Standards/spec: no findings. Previous A-5338 gate is historical; C1–C3 final marks await new exact-head evidence. No Reviewer execution or per-item QA.

### impl-799 · 2026-10-18T14:46:52.483Z

Delta source clear rev-20261018-799-occasion-integration (A-5370) at unchanged 3350ad94fae88a3e3d203d8a529dfff2d87f7719. Read queue, then submitted exactly one mode-free droplet verify 78d32726-1a09-4cf6-aaf4-21103305b1ff reporting to reviewer and impl-799. CLI confirmed admitted at position 1. Idle awaiting hub completion at the reviewed head; historical A-5338 is not claimed for this replacement head.

### rev-30 · 2026-10-18T15:12:00.025Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261018-799-integration-final
commit: 3350ad94fae88a3e3d203d8a529dfff2d87f7719
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Integration final evidence clear. A-5387/78d32726 passes at unchanged A-5370 source-reviewed head: 2615 pass, zero fail/cancelled, eight prerequisite skips; hub and full Neovim finalize. Independent timings and positive reporter audit confirms progress 4/4, hung component 2/2, durations-runner 15/15, quarantine-runner 10/10 and stage rules 8/8. Twelve carrier groups pass 60/60 repetitions. Both repetition-only signal controls positively pass alongside timeout/cancellation, durable completed receipts and ordinary-only timing controls; incoming occasion planner/cache/override cases pass. C1–C3 refreshed. Four inherited report-only trips remain C-326/T-803, none scoped; no global zero claim or hard gate failure. Prior gate remains historical. No source change, Reviewer execution or per-item QA.

Criteria: C1 verified, C2 verified, C3 verified.

### impl-799 · 2026-10-18T15:16:40.305Z

Coordinator-authorized one-time merge with dev c7baa5d6 completed and pushed as be6741ba45d654a1fb42d44d5ef4b2d5e7c2e853 (first parent reviewed/gated 3350ad94). dispatch.ts composes T-800 summary-first bounded priority delivery with T-799 interruption lines in mandatory headers before optional detail. Existing T2 timeout strengthened with oversized metadata: T-800-only composition red 0/2; combined green 2/2. All 40 serial tests pass: hung 2/2 .679 s, progress 4/4 .243 s, protocol 10/10 2.035 s, selection-report 4/4 14.959 s, cache-recovery 3/3 16.236 s, recovery 6/6 19.241 s, suite 11/11 28.424 s. Then lint/typecheck/whitespace clean. A-5396 contains raw proofs and focused diffs against both parents. Delta review requested to confirm composition-only condition; no new droplet run submitted during hold.

### rev-30 · 2026-10-18T15:17:40.623Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261018-799-summary-composition
commit: be6741ba45d654a1fb42d44d5ef4b2d5e7c2e853
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Composition-only delta clear. Primary 56019bd9 authorizes this merge and explicitly permits prior gate reuse when composition-only; condition met. Dispatch retains T-800 summary-first/bounded priority/cache delivery and T-799 interruption lines immediately after exit in all headers. Receipt producers, persistence/cutoffs, executor and runners are unchanged; core task reporter/parser files match prior parent byte-for-byte. Strengthened existing T2 timeout forces bounded delivery; red 0/2 before header composition, green 2/2 after. A-5396 raw summaries and positive lines confirm all forty serial regression cases pass, zero skips/failures. C1–C3 refreshed with prior full green A-5387/A-5389 under explicit exception; no new droplet needed. Coordinator merge/restart and submission holds remain in force. No findings, Reviewer execution or per-item QA.

Criteria: C1 verified, C2 verified, C3 verified.
