---
id: T-1878
kind: task
title: "Soak run's deadline plan leaves no room for Web: d5150de3 timed out (exit 124) in the Web tier after T0–T4 passed"
state: open
status: in progress
size: S
labels: []
assignee: null
parent: E-1888
blocked_by: []
topic: topic-1537
branch: t/T-1878-soak-run-s-deadline-plan-leaves-no-room
created: 2026-11-16T04:19:13.815Z
updated: 2026-11-16T07:41:03.576Z
---

## Summary

The hub's soak run d5150de3 at dev 92dd61bcf (2026-11-16, droplet c-8 ams3, A-19799) ended with exit 124: `timeout: 8328 tests completed, 0 failed`. Four Web files were in flight (events, item-card, inbox, hosts-view), so Web was not executed to the end. T0 to T4 had exited 0. The soak deadline plan printed `projected 3539.0 s <= 3540.0 s (20% margin + 60 s overhead)`. That projection appears to leave about 1 s of headroom, and T3 alone observed 2877 s against its projection, so the plan didn't hold under the run's real durations.

## What to build

Find out why the soak's deadline plan admitted a selection that reached the deadline. Check whether Web's projected wall is in the plan, and why a projection 1 s under the limit counts as fitting. Then fix it: either the plan keeps enough margin for every tier it selects, or the soak trims its repetitions to fit. A soak that times out reports which tiers were unexecuted as such.

## Acceptance criteria

- [ ] C1. With the recorded durations of A-19799, the soak plan either fits all selected tiers with real margin or trims repetitions, shown by a test over a fake duration manifest (test).
- [ ] C2. A soak that times out names its unexecuted tiers and files in the result, as unexecuted, never as passed (test).

## Comments

### impl-1878 · 2026-11-16T07:34:42.336Z

Consumer sweep (rule 20): soakDeadlinePlan caller is hub/src/hub/suites.ts; selection.reason is presentation text consumed by describeSelection, suite logs, suiteSummary and suite-soak-component tests. TierPlan comes from suite-tier-report, reused by local runner, suites, shards and tier-report tests. Timeout progress is consumed by hub dispatch interruptionLines, run-suite, batch-flakes, dev-t3-probe, merge-batches, soak-quarantine, suite-progress/durations-runner/suite-runner/hung-component tests. Plan: keep existing progress and wire fields unchanged; add optional execution inventory to result.json and additive timeout text lines. Legacy result readers use code/cause/progress and ignore additive fields. Searched production, web/nvim, all test tiers, docs, skills and QA guidance for soakDeadlinePlan, tierPlan, suiteProgress, progressLines, interruptionLines, result.json and timeout text. Update shared procedures and running reference; no role permission change.

### impl-1878 · 2026-11-16T07:41:03.576Z

Implemented conservative base budgeting and additive timeout execution inventories. Evidence A-19837 records red-before-green at both confirmed seams. Local macOS arm64 Node v24.21.0: planner 1/1, timeout component 3/3, soak component 38/38. Consumer sweep also covers suite-log semantic retention: additive unexecuted/incomplete tier lines retained for dispatch interruptionLines; result.json execution is optional, and legacy/no-tier-plan progress tests remain unchanged. origin/dev fetched and merged once before first review (edbe8da2c, tracker-only fast-forward). Static lint found new guide heading format; corrected. Remaining static checks/typecheck and source review await Coordinator load-hold release; no verification submitted.
