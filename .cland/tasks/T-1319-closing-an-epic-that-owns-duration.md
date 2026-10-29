---
id: T-1319
kind: task
title: Closing an epic that owns duration allowances strands them with a closed owner and turns the next full run red
state: open
status: in progress
size: S
criterion_seq: 1
labels:
  - ready-for-agent
assignee: null
parent: E-1444
blocked_by: []
topic: topic-1197
branch: t/T-1319-closing-an-epic-that-owns-duration
created: 2026-10-26T01:52:55.592Z
updated: 2026-10-29T17:01:55.284Z
---

## Summary

Closing an epic that still owns duration allowances in hub/test/durations.json leaves those allowances with a closed owner. The next full run on a tree whose tracker shows the epic closed fails shard planning: `lintDurations` throws "duration allowance has closed owner". On 2026-10-26 this turned the macOS release cover d1dfed4b (A-12230) red, after E-1282 and E-1284 were closed during the run. The Coordinator re-owned the seven allowances to E-880 (3a488be5), and both release covers had to rerun.

## What to build

Make `task close` on an epic refuse, or name the allowances it owns with the command to re-own them, while hub/test/durations.json lists that epic as an allowance owner. Keep the existing allowance lint unchanged.

## Acceptance criteria

- [x] C1. Closing an epic that owns a duration allowance is refused with a reason naming each owned allowance key and the re-own step, and closing it succeeds once no allowance names it (test).
  - done: impl-1319 · 2026-10-29T16:58:25.854Z

## Comments

### impl-1319 · 2026-10-29T16:56:01.335Z

Contract consumer inventory before changes: task.close and task.edit --state closed share Tracker close admission; task.import also checks container close. CLI hub/src/cli/task.ts, spoke/task-tools.ts, tracker/requests.ts and web/nvim frame clients preserve existing ok/error refusal shape. Production release closure is top-level, not planning-epic. Tests across tiers: epic-close, tracker-component/status/async/levels/criterion-write, task-card/size, stage-closure/planned-stage/task-plan/lead-launch, release-item, subscriptions/session lifecycle, CLI identity/help/tool arguments. Duration consumers suite-shards.ts, duration-budget.ts, test/durations.ts and durations/suite-duration-budget/suite-tiers tests retain unchanged lint and manifest shape. Shipped merge/plan-epic skills, docs tracker/tests/README and QA briefs describe epic closure; skill wording will be proposed to Coordinator only. New guard affects planning-container closure only when project hub/test/durations.json allow entries name its exact owner id; other callers/fixtures without that manifest remain unaffected. Existing frames and persisted tracker/manifest records unchanged. Regression at existing frame shape will test refusal + state unchanged, then successful close after re-owning.

### rev-26 · 2026-10-29T17:01:55.284Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261029-1319-source-1
commit: 4c18aeb94dd50744874dc896ce97f668629cc5ab
scope: full
findings: [{"severity":"medium","text":"M1: TASK_USAGE changed without its frozen commands.json row migration; unchanged compatibility/full-help guards fail. Migrate only owning fixture row with guard red/green preserved, and remove the table-breaking index blank before the new Notes row.","file":"hub/src/cli/usage.ts","line":27},{"severity":"medium","text":"M2: new cases acquire projectHub/connectUi before bounded pre-owned startup/socket/Store disposal; partial or aborted setup can escape drainage before root removal. Reuse shared owned setup/component seam and omitted/aborted controls while preserving all C1 frame assertions.","file":"hub/test/epic-close.test.ts","line":378}]
finding_counts: {"high":0,"medium":2,"low":0}

A-13832 full9-file audit complete; consolidated M1/M2 only, no additional product finding. Spec close guard correctly shares tracked async/resumed evidence across close/override/edit/existing import; exact owned keys/re-own step, optional absent manifest and unchanged lint/expiry. Rule20 callers/fixtures/docs inventory checked; skill proposal held by Coordinator. Working fixes outside head; commit/push and fresh source before verification. C1 runtime pending, no criterion failure inferred from standards findings. Local A-13825 is summary only; no Reviewer workloads.
