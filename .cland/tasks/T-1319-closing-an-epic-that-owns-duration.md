---
id: T-1319
kind: task
title: Closing an epic that owns duration allowances strands them with a closed owner and turns the next full run red
state: open
status: review
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
updated: 2026-10-29T16:59:24.355Z
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
