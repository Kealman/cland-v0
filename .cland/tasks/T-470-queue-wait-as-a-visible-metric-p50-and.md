---
id: T-470
kind: task
title: "Queue wait as a visible metric: p50 and p90 in verify queue and hub status, with a v0.1.3 target of p90 under 20 minutes"
state: open
status: in progress
size: S
criterion_seq: 3
labels:
  - v0.1.3
  - hub
assignee: null
parent: E-387
blocked_by:
  - T-469
topic: topic-361
branch: t/T-470-queue-wait-as-a-visible-metric-p50-and
created: 2026-10-15T09:13:16.188Z
updated: 2026-10-16T07:01:30.316Z
---

## Summary

Retrospective A-2783, START 4: the run spent 6,618 queue-minutes against 3,411 machine-minutes, with a p90 wait of 56 minutes. The wait is shown today only as a summary line. Make it a first-class metric over a rolling window, with the target visible.

## What to build

`cland verify queue` and `hub status` show the wait p50 and p90 over the last 24 hours and the last 50 runs, split local and droplet, against the configured target (`[verification] wait_p90_target = "20m"`). The journal records the window values once an hour as `verification-wait` records, so a retrospective can plot them.

## Acceptance criteria

- [x] C1. `cland verify queue` and `hub status --json` report wait p50 and p90 for 24 h and the last 50 runs, by executor, with the target.
  - done: impl-470 · 2026-10-16T06:27:03.192Z
  - verified: rev-30 [reviewer] · run rev-20261016-470-source · 2026-10-16T06:30:17.108Z · commit 311933f19e64bc56a00f21ee14407f2b4ca6533a
- [x] C2. An hourly `verification-wait` journal record carries the same values, proven by a test with a fake clock.
  - done: impl-470 · 2026-10-16T06:27:03.496Z
- [x] C3. hub/README.md describes the metric and the setting.
  - done: impl-470 · 2026-10-16T06:27:03.854Z
  - verified: rev-30 [reviewer] · run rev-20261016-470-source · 2026-10-16T06:30:17.108Z · commit 311933f19e64bc56a00f21ee14407f2b4ca6533a

## Comments

### impl-470 · 2026-10-16T06:16:29.569Z

Plan: keep dispatch unchanged; add a dedicated metrics module with thin Suites snapshot/hourly hooks, config/CLI/docs wiring. Awaiting seam confirmation through the item lead and T-488 slot-done before any targeted local run. Durable queued/admitted/finished timestamps will prevent recovery time from shifting wait windows.

### rev-30 · 2026-10-16T06:30:17.108Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261016-470-source
commit: 311933f19e64bc56a00f21ee14407f2b4ca6533a
scope: full

# T-470 source review clear

Reviewed pushed head `311933f19e64bc56a00f21ee14407f2b4ca6533a` on `t/T-470-queue-wait-as-a-visible-metric-p50-and`. Fixed point/pre-review dev `4dc49979ee387541a360ca4e8661be7170c86b8e`; captured `git diff 4dc49979...HEAD` and commits dd7d6216 implementation /311933f1 pre-review merge. Origin and local head agree. task.view confirms claimant and C1–C3. Direct read-only Standards/Spec review; no Reviewer tests, compiler execution or subagents.

## Standards

0 high, 0 medium, 0 low findings. Eleven-file scope is cohesive: a dedicated 55-line metrics/checkpoint module, thin Suites constructor/tick/snapshot hooks, additive protocol field, config/daemon plumbing, existing queue CLI/journal seams, two test files/shard registration and README. dispatch.ts is unchanged; hub status already exposes the Suites snapshot. Existing last-20 wait/run metrics and ETA calculation are retained.

The helper reads durable job facts without mutating jobs or reusing recovery-derived runMs. Journal emission is registered in JOURNALLED and follows the existing tapped-log queue. Protocol queueWait remains optional for older producers/consumers. Existing suite-queue assertion retains its complete legacy-metrics expectation while separately asserting the additive field. No documented-standard breach or Fowler-baseline finding. Whitespace check clean.

## Spec

C1 and C3 source verified. The aggregation produces separate local/droplet 24-hour and last-50-completed-request windows with target, sample count, cache count, median p50 and nearest-rank p90; empty percentiles are null. Config defaults to 20m, validates positive duration strings through the existing duration parser, renders the setting, and passes it through daemon verification options. CLI text/JSON and hub status JSON use the same queue snapshot. README documents shape, windows, percentile convention, exclusions, target and journal cadence.

Primary Coordinator f8b97362 requires queued-to-admitted wait, effective-executor fallback attribution and durable recovery timestamps. Primary ee9caa53 requires cache exclusion from percentiles with separate cache counts. Claimant's explicit per-executor latest-50-completed-request policy (cf97aa1e) keeps cache requests inside the 50-request limit. The code matches these decisions. Never-admitted/invalid timing records yield no wait samples; parent shard jobs are excluded. Wait is derived directly from queued/admitted timestamps, rejecting non-finite, negative or admission-after-finish intervals. Failed executed runs can contribute legitimate waits. Completion windows prefer durable finished; cache requests instead use their own completedAt so borrowed source finish does not age a new hit incorrectly. Future completions are excluded.

C2 implementation follows the actual scheduler interval: VerificationWait records at the first tick in each UTC hour, snapshots the same metric object, and stores the last hour in Store metadata. It does not invent samples for downtime. Same-hour restart suppresses duplicate log calls. This uses the journal's existing asynchronous best-effort log contract; no crash-atomic exactly-once delivery guarantee beyond that existing contract is claimed.

## Evidence

A-3788 is the durable claimant evidence note, not a separate raw-log bundle. It reports suite-wait-metrics5/5, existing suite-queue5/5, root typecheck and shard lint green on the final merged head, with serial guarded local work after T-488 slot release. I reviewed all committed test assertions:
- Aggregation cases cover executor split, effective local fallback, old durable finish versus late recovery, cache exclusion/counting, invalid/unadmitted/future records and child shards.
- 60 local requests establish independent last50 and 24h percentiles, plus remote/empty/cache-source-age cases.
- The fake-clock case drives a real Suites interval and real Store/Journal: first-hour output, no within-hour duplicates, next-hour expiration, reopening Store for same-hour restart deduplication, and flushed JSONL equality with snapshots. It tests ordinary restart, not abrupt-crash atomicity.
- Config round-trip/invalid target checks and real CLI queue + hub status JSON/text exercise output/config wiring.
- Existing queue lifecycle/cache regression preserves legacy metrics and separately observes two executed samples and21 hits.

Source clear verifies C1/C3. C2's final runtime verification and the overall final verdict remain pending a fresh exact-head diff-selected droplet gate, including new-test repetitions. No full local suite requested. No per-item QA (none/after-stage). Any changed head needs delta review before another verification run.

Findings: Standards0; Spec0.

Artifact A-3789 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3789-t-470-source-clear-durable-queue-wait-windows-and-hourly-journal-wiring.md

Criteria: C1 verified, C3 verified.

### rev-30 · 2026-10-16T07:00:36.450Z

verdict: review
result: not clear
by: rev-30 [reviewer]
run: rev-20261016-470-linux-first
commit: 311933f19e64bc56a00f21ee14407f2b4ca6533a
scope: evidence

# T-470 first Linux evidence not clear

Run **0b939cc1-03d3-4577-b069-23dcd72e18f3 / A-3815** at unchanged source-reviewed `311933f19e64bc56a00f21ee14407f2b4ca6533a`. Actual c-8 lon1 Linuxx64, four workers, Node24.21.0/Neovim0.12.5. Full selection due config import/README coverage path; exits1 before Neovim.1914pass/2fail/5skip,1921tests. Suite1666.32s, peak15.37, load-gate extra37.72s. Lifetime/cost unknown. No Reviewer execution.

## Standards

No new source finding. A-3789 source clearance C1/C3 stands at this head.

## Spec and owned evidence

All five suite-wait-metrics cases have positive ordinary timings and **5/5 load repetitions each (25/25)**. In particular, the real Suites/Store/Journal fake-clock C2 case passes ordinarily (0.1282s) and5/5. Config/CLI/status case passes ordinarily1.0788s and5/5. Owned evidence is retained; this receipt does not demonstrate a T-470 assertion failure.

## Gate blockers requiring lead classification

1. `hub/test/roles.test.ts:181`: role launch after editing roles.toml returns `claude-fable-5-1`, expected `claude-fake-edited`.
2. `hub/test/task-worktrees.test.ts:379`: resumed snapshot observation count3, expected2 (`both the initial snapshot and the post-I/O snapshot must run`).
3. Hard new-test duration budgets: `demo stop refuses a persistent tags mismatch and clears attention after a later404` **5.372s>5s**, and `the detached demo watchdog confirms an active droplet losing tags during its delete` **5.562s>5s**, both in demo-release.test.ts (T-572-owned cases).

These files are outside the task diff, but that fact alone is not a known-defect classification or waiver. Report ordinary signatures as Bugs/S candidates to lead T-470 for deduplication/Coordinator disposition; route duration allowance classification through the shared-fix owner. Do not create branch-local fixes, raise unrelated allowances, retry unchanged, or accept an exception without that disposition. Claimed existing T-470 implementation remains unchanged; claimant9f04fb30 confirms escalation and no retry/head change.

Final evidence verdict **not clear**. No criterion is failed solely for outside-diff reds: C1/C3 remain source verified, C2 and final settlement pending an admissible overall gate. Neovim was not reached and is not claimed green. No new high/medium/low source findings; unresolved evidence blockers are listed explicitly.

Findings: Standards0; Spec0 source findings; four outside-diff gate failures pending classification.

Artifact A-3816 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3816-t-470-linux-gate-not-clear-own-five-cases-green-other-failures-need-classificati.md

### impl-470 · 2026-10-16T07:01:30.316Z

Coordinator classified first receipt's outside-diff reds as known flakes T-580/T-581; Mac dev file checks passed roles8/8 and task-worktrees9/9. Demo-release hard budgets covered by shared allowance ac20175b. Exactly one fresh resubmit authorized at unchanged 311933f1, with no cherry-pick, after Coordinator announces the hub restart. Holding until that event.
