---
id: T-722
kind: task
title: Task runs take workers and test limits from the hub's config, not the candidate tree's
state: closed
status: done
size: S
rank: 6899
criterion_seq: 2
labels:
  - v0.1.4
  - verification
  - hub
assignee: null
parent: E-676
blocked_by: []
topic: topic-417
branch: t/T-722-task-runs-take-workers-and-test-limits
created: 2026-10-16T20:36:58.759Z
updated: 2026-10-17T04:13:38.671Z
closed: 2026-10-17T04:13:38.671Z
---

## Summary

A task run takes its worker count and test limits from the candidate tree's `.cland/config.toml` (`suiteLimits(input.cwd, …)` in hub/src/hub/suites.ts, around lines 301 and 329). Only runs from the root follow the hub's loaded config. So after D53 set `[verification.droplet] workers = 2`, branches cut before that commit kept running at 4 workers: T-628's run 77556e4a (A-4188) peaked at load 16.4 on a c-8. A project's verification policy is the hub's, not the branch's.

## What to build

Task runs take workers, the load-gate workers and the test and stall timeouts from the hub's loaded project config, exactly as root runs do. An explicit `--workers` still overrides. The candidate tree's config is still validated by admission where it is already checked, but it no longer sets the policy a run executes under. The run log's `Workers` line says which source it came from.

## Acceptance criteria

- [x] C1. A task run from a worktree whose config says 4 droplet workers runs at the hub config's 2, and an explicit `--workers 3` still runs at 3, proved by a suite-queue test with two configs.
  - done: impl-722 · 2026-10-17T03:30:27.250Z
  - verified: rev-30 [reviewer] · run rev-20261017-722-final · 2026-10-17T04:13:08.871Z · commit 52cd201f061838738460071b91ed9c487d35897c
- [x] C2. Test and stall timeouts and load-gate workers for a task run come from the hub's config, and the run log names the policy source, proved by the same test file.
  - done: impl-722 · 2026-10-17T03:30:27.577Z
  - verified: rev-30 [reviewer] · run rev-20261017-722-final · 2026-10-17T04:13:08.871Z · commit 52cd201f061838738460071b91ed9c487d35897c

## Comments

### impl-722 · 2026-10-17T03:30:02.162Z

Implemented hub-owned submission and launch-time policy for all candidate worktrees; explicit workers remain authoritative and Workers log lines name the source. New T2 suite-queue-policy regression uses a linked task worktree and fake executor boundaries, covering conflicting configs, dry-run, droplet overrides, reload before local admission, and preserved candidate-config validation. Focused preview tests: 4/4, 2.08 s file. Timeout compatibility tests: 7/7, 33.87 s file. Typecheck passes. Preparing current-dev merge and review head.

### rev-30 · 2026-10-17T03:33:13.344Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261017-722-source
commit: 52cd201f061838738460071b91ed9c487d35897c
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source review T-722 at 52cd201f061838738460071b91ed9c487d35897c, fixed point c3effa9628f23f6dd6bc71d42b3b6ba853e872ac. Read-only review; no Reviewer execution.

## Standards
No findings. The new suite-queue-policy test is declared T2 in its header and sorted tier manifest. Executor and host typecheck boundaries are faked; Git establishes the linked-worktree fixture. It observes executor delivery with a bounded condition and retains the policy/log assertions. No new literal wait or process lifecycle is introduced.

## Spec
No findings. Submission validates candidate config but derives execution workers, load-gate workers and test/stall timeouts from the loaded hub config. Admission refreshes those fields for task worktrees as for root runs. Explicit workers remain authoritative; the persisted fallback count retains the hub local policy. Worker log entries identify the source and admitted count. The new table proves hub droplet 2 against candidate 4, explicit 3, local preview 1 followed by reload to 5, refreshed timeouts/load-gate workers, and invalid candidate rejection.

A-4291 reports causal red/green, queue-policy 1/1, dry-run 4/4, timeouts 7/7, typecheck and tier lint. These are claimant targeted receipts, not a completed task verification run. Both C1 and C2 remain unverified pending same-head normal diff-selected verification; source is clear to submit that run.

### rev-30 · 2026-10-17T04:13:08.871Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261017-722-final
commit: 52cd201f061838738460071b91ed9c487d35897c
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final evidence review T-722 at 52cd201f061838738460071b91ed9c487d35897c, unchanged from source clearance A-4292 / rev-20261017-722-source. The origin task branch and hub verification record both identify this exact head.

## Standards
No findings. Source standards review stands; this pass audits the completed receipt read-only.

## Spec
C1 verified: A-4297 records the queue-policy regression passing ordinarily in 0.760 s and all five fresh load repetitions. Its reviewed assertions prove candidate droplet workers 4 executes with hub workers 2 and explicit workers 3 remains effective.
C2 verified: the same executed regression checks hub test/stall timeouts and load-gate workers, the source-labelled admitted Workers line, refreshed policy after a queued config reload, and preserved invalid-candidate refusal. Existing dry-run (4 cases) and timeout (7 cases) compatibility files all have passing timing receipts.

Normal mode-free droplet run d03ffcba-5435-4f11-8812-f24918b1c4fc / A-4297 exits zero in hub-only mode plus Neovim smoke. Phase totals independently sum to 2073 tests: 2068 passed, zero failed/cancelled, five skipped (free 44/44; machine 2012 pass/5 skip; smoke 12/12). Both typechecks complete. Two workers, suite wall 2261.21 s, peak one-minute load 10.26. Duration-regression notices are non-failing; no hard budget failure appears. The serving hub's outer Workers line remains its older format; source attribution is proven by the candidate's executed queue regression, not claimed as a live-hub rollout observation.

Final review clear, C1 and C2 verified at this head. No additional run requested.

Criteria: C1 verified, C2 verified.

### coord · 2026-10-17T04:13:38.671Z

Merged e9ac214b88aadac7a479d6ea96cfbe8469ee2c00 onto dev.
