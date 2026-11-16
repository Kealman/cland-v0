---
id: T-1878
kind: task
title: "Soak run's deadline plan leaves no room for Web: d5150de3 timed out (exit 124) in the Web tier after T0–T4 passed"
state: closed
status: done
size: S
criterion_seq: 2
labels: []
assignee: null
parent: E-1888
blocked_by: []
topic: topic-1537
branch: t/T-1878-soak-run-s-deadline-plan-leaves-no-room
created: 2026-11-16T04:19:13.815Z
updated: 2026-11-16T11:15:56.949Z
closed: 2026-11-16T11:14:46.236Z
---

## Summary

The hub's soak run d5150de3 at dev 92dd61bcf (2026-11-16, droplet c-8 ams3, A-19799) ended with exit 124: `timeout: 8328 tests completed, 0 failed`. Four Web files were in flight (events, item-card, inbox, hosts-view), so Web was not executed to the end. T0 to T4 had exited 0. The soak deadline plan printed `projected 3539.0 s <= 3540.0 s (20% margin + 60 s overhead)`. That projection appears to leave about 1 s of headroom, and T3 alone observed 2877 s against its projection, so the plan didn't hold under the run's real durations.

## What to build

Find out why the soak's deadline plan admitted a selection that reached the deadline. Check whether Web's projected wall is in the plan, and why a projection 1 s under the limit counts as fitting. Then fix it: either the plan keeps enough margin for every tier it selects, or the soak trims its repetitions to fit. A soak that times out reports which tiers were unexecuted as such.

## Acceptance criteria

- [x] C1. With the recorded durations of A-19799, the soak plan either fits all selected tiers with real margin or trims repetitions, shown by a test over a fake duration manifest (test).
  - done: impl-1878 · 2026-11-16T07:46:10.173Z
  - verified: rev-35 [reviewer] · run rev-35-1878-final-1 · 2026-11-16T09:01:25.637Z · commit 2685356bcbc82b741441bb13f34d911b4f28957b
- [x] C2. A soak that times out names its unexecuted tiers and files in the result, as unexecuted, never as passed (test).
  - done: impl-1878 · 2026-11-16T08:04:21.539Z
  - verified: rev-35 [reviewer] · run rev-35-1878-final-1 · 2026-11-16T09:01:25.637Z · commit 2685356bcbc82b741441bb13f34d911b4f28957b

## Comments

### impl-1878 · 2026-11-16T07:34:42.336Z

Consumer sweep (rule 20): soakDeadlinePlan caller is hub/src/hub/suites.ts; selection.reason is presentation text consumed by describeSelection, suite logs, suiteSummary and suite-soak-component tests. TierPlan comes from suite-tier-report, reused by local runner, suites, shards and tier-report tests. Timeout progress is consumed by hub dispatch interruptionLines, run-suite, batch-flakes, dev-t3-probe, merge-batches, soak-quarantine, suite-progress/durations-runner/suite-runner/hung-component tests. Plan: keep existing progress and wire fields unchanged; add optional execution inventory to result.json and additive timeout text lines. Legacy result readers use code/cause/progress and ignore additive fields. Searched production, web/nvim, all test tiers, docs, skills and QA guidance for soakDeadlinePlan, tierPlan, suiteProgress, progressLines, interruptionLines, result.json and timeout text. Update shared procedures and running reference; no role permission change.

### impl-1878 · 2026-11-16T07:41:03.576Z

Implemented conservative base budgeting and additive timeout execution inventories. Evidence A-19837 records red-before-green at both confirmed seams. Local macOS arm64 Node v24.21.0: planner 1/1, timeout component 3/3, soak component 38/38. Consumer sweep also covers suite-log semantic retention: additive unexecuted/incomplete tier lines retained for dispatch interruptionLines; result.json execution is optional, and legacy/no-tier-plan progress tests remain unchanged. origin/dev fetched and merged once before first review (edbe8da2c, tracker-only fast-forward). Static lint found new guide heading format; corrected. Remaining static checks/typecheck and source review await Coordinator load-hold release; no verification submitted.

### rev-38 · 2026-11-16T07:52:54.986Z

verdict: review
result: not clear
by: rev-38 [reviewer]
run: rev-38-1878-source-1
commit: 95ddc3cc957ea9f2bda099a46787cc3a1e96e8c9
scope: full
findings: [{"severity":"medium","text":"Timeout execution derivation is guarded by remote; a local soak with a tier plan and exit124 gets no execution inventory or unexecuted/incomplete tier report. Share the calculation across executors and retain a local timeout regression.","file":"hub/src/hub/suites.ts","line":1572},{"severity":"medium","text":"Unbounded joined path lists enter priority interruption text before provenance/artifact references; T2 alone is 14,932 bytes in the pinned manifest, so the capped report truncates later tiers and its log pointer. Keep complete durable lists and add a bounded per-tier display with guaranteed artifact link, proven by a broad-plan report test.","file":"hub/src/suite-execution.ts","line":19}]
finding_counts: {"high":0,"medium":2,"low":0}

Complete first Standards/Spec source pass in A-19853. Two medium C2 findings; no other findings, including lows. C1's conservative serial base cost and existing margin/refusal/repetition policy are supported by source and checked against A-19799 baseline/projection records. A-19837 and 4ff6e702 are explicitly transcribed development-candidate red/green summaries, not same-head configured receipts. No criteria verified in source pass. Fix both C2 gaps on a fresh head and request new source review before verification. Reviewer read only; no tests, native/browser runs or edits.

Criteria: C2 failed (Local timeouts omit execution inventory, and broad remote inventories can truncate later tier states and artifact/provenance from capped reporting.).

### rev-35 · 2026-11-16T08:06:46.366Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1878-source-2
commit: 2685356bcbc82b741441bb13f34d911b4f28957b
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Replacement full Standards/Spec source clear, A-19874. Both A-19853 C2 source findings resolved: local execution inventory preserves worker progress; complete durable lists plus bounded per-tier summaries and broad report control. Conservative C1 planning unchanged. C1/C2 pending configured same-head named/file evidence and selected-tier disposition; A-19871 is explicitly candidate development output, not that receipt. No Reviewer runtime work. Hold released for authorized mode-free verification window.

### impl-1878 · 2026-11-16T08:59:16.848Z

Configured verification f50ae0c7-9dc2-49ac-8cc8-de566502a943 passed at head 2685356bcbc82b741441bb13f34d911b4f28957b / tree 724b0c42e8b595700942db8fae03efbb4f25ac98 (A-19920). Linux x64 droplet c-8 nyc1, Node v24.21.0; T0/T1/T2/Web exit0, 6383 pass, zero failures/skips/cancellations. All T2 fallback from unsupported skill CHANGES path. Checked exact planner case and all 5 timeout/cancellation generated suite timing receipts: all outcome pass. T3/T4 not executed by this task receipt; deferred evidence only. Web used isolated Headless Shell1248, Chrome for Testing156.0.8078.4. Duration/lint budget findings remain report-only. Droplet lifetime1460s cost$0.1014; this is executor lifetime, not suite wall. Await Reviewer final settlement.

### rev-35 · 2026-11-16T09:01:25.637Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1878-final-1
commit: 2685356bcbc82b741441bb13f34d911b4f28957b
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final same-head C1/C2 verified, A-19925/A-19924. Independently audited planner base+5, all five timeout cases/base file and new local/broad cases+5;6383base tests/701files plus225load tests/files all pass. All221T1/425T2/55Web files positive, no selected-file receipt missing. Conservative985manifest accounting retains267T3/17T4 deferred and original named consumer boundaries; no graph/runtime soak claim. Provenance matches reviewed head, uncached Linux/browser. Historical candidate/capture and report-only advisories retained. No Reviewer runtime work. Hold released; Coordinator landing gate remains.

Criteria: C1 verified, C2 verified.

### coord · 2026-11-16T11:14:46.236Z

Merged d5ea35a55b8ab20dcdfc502c0f007bce710afa2b onto dev.
