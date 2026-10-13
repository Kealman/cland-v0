---
id: T-328
kind: task
title: "Planned from the plan: the hub moves the current stage's backlog tasks to planned, moves the next stage when one completes, and a closed epic reports its stages closed"
state: open
status: backlog
labels:
  - v0.1.2
  - hub
  - ready-for-agent
assignee: null
parent: E-270
blocked_by: []
topic: null
branch: null
created: 2026-10-13T14:04:09.203Z
updated: 2026-10-13T14:04:16.229Z
---

## Summary

With a plan, the hub sets the backlog tasks of an epic's current stage to `planned` and leaves the rest of the epic in `backlog`. When the stage completes, the hub moves the next stage the same way. A closed epic reports every stage of its plan closed. Without a plan, `planned` stays a hand status, as before.

## Parent

E-270: Status, fields and instrumentation. Spec: `docs/spec/v0.1.2.md` §3.2 (Planned derives from the plan) and §3.9 (the prototype's answers: closing an epic closes its plan's stages). Decided in T-238. GLOSSARY: Status, Plan, Stage. ADR 0007: the moves reach sessions as the `task` events they already subscribe to.

## What to build

**The current stage.** The current stage of an epic is the first stage that `#stagesOf` in `hub/src/tracker/tracker.ts` reports `open`. A stage completes when `#stagesOf` reports it `closed`: its items landed or closed, and its after-stage QA clear where the plan asks for one. This ticket adds no new completion rule.

**The move.** The hub sets `status: planned` on each open task of the current stage whose status is `backlog`.

- It is a hub write, actor `hub`, through `#mutate`, as the ready check does in `#checkReady`. The write logs `task-written` with op `planned`. The usual `status changed backlog → planned` text rides the existing `task` event.
- Only `backlog` moves. The hub never moves an item back to `backlog`. A status the Coordinator or the human set stays.
- Only tasks move. Questions and specs in a lane have no status.
- An item of a later stage stays as it is. A blocked task still moves: the panel already draws a blocked planned row with `◌`.

**Once per entry.** A hand edit back to `backlog` inside the current stage must stay. So the hub moves an item once, when its stage becomes current or when the item joins the current stage, never on every recompute. Record what was moved in `tracker_meta` (`hub/src/tracker/index-db.ts`), for example a key per epic naming the current stage and the item numbers moved in it. A plan change that adds an item to the current stage moves that item only.

**When it runs.**

- When a plan is accepted: `task.plan set`, a valid hand save taken by `#acceptPlan`, and an approval.
- When a stage closes: one of its items closes or lands, or its stage QA verdict is recorded.
- At hub start, one pass over the open epics that have a plan.
- An epic whose plan waits for approval moves nothing until it is approved.

**Bounded work.** The recompute is coalesced once per epic per tick (T-293).

- Find the affected epics from the changed item's number through the indexed plans (`IndexDb.plan`), never by scanning every epic.
- Read the stage items from index rows. Read the epic's own file once for its stage verdicts, as `#stagesOf` needs. Read no other item file except the tasks it writes.
- No synchronous full tracker hydration per event (the T-321 lesson). No `this.list()` inside the recompute.

**A closed epic closes its stages.** `#stagesOf` reports every stage `closed` when the epic is closed, whatever its stage evidence. `cland task plan show` and `task.view` show it. A reopened epic goes back to the derived states. Stage QA admission (`#stageEvidence`, `#stageCurrent`) is unchanged.

**Docs.**

- `hub/README.md`: the Task status (T-120) paragraph gains the plan-driven move.
- `docs/agents/issue-tracker.md` and its template `skills/templates/docs/agents/issue-tracker.md`: the status line says who sets `planned`.
- `GLOSSARY.md`: the Status entry adds "and on an epic plan's current stage" to the hub's moves.
- `.agents/skills/plan-epic/SKILL.md`: a plan set on an epic now sets its first stage `planned`, so the Coordinator does not set it by hand.

No role clause changes. The Coordinator's clause already takes "the lowest-ranked unblocked `planned` task" outside an epic plan.

**Demo** (the epic's words). In a scratch project, an epic with a two-stage plan shows stage one `planned` and stage two `backlog`, and merging stage one's items turns stage two `planned`.

**Out of scope.** The release scope in the items panel (T-329). Any Neovim change: the panels already read `planned`. Moving container status: containers have none (v0.1 §3.2). A new completion rule for stages.

**Constraints.**

- Tests go through the frame protocol first: a real hub, a real spoke and the CLI on a temporary project (`hub/test/harness.ts`). Landing goes through `cland merge` on a temporary git territory, as `hub/test/merge.test.ts` and `hub/test/stage-qa.test.ts` do. The fake harnesses in `hub/test/fakes/` come second.
- No new seams inside the hub. New test helpers go in the test file or a new helper module, never in `hub/test/harness.ts`.
- A test that reads `hub.log` or `journal.jsonl` after an action first waits on the `hub.status` `flushLogs` barrier (T-291).
- The recompute is coalesced once per tick (T-293). Its work stays bounded by the epic's stage, not by the tracker's size. A query-count regression in the style of `hub/test/inbox-workload.test.ts` pins it with many unrelated items.
- Any panel test waits on state, never on a sleep. Every key goes through the action registry. This ticket adds neither.
- Suites run through `cland verify`, only after a clear source review and at the exact reviewed head (D25). Run suite-weight work only when `cland verify queue --json` shows no holder.
- Commit on the task branch and push it to `origin`. `dev` is reached only through `cland merge`. Everything is in English.

## Acceptance criteria

- [ ] C1. A hub test on a temporary project sets a two-stage plan with `cland task plan set`. `cland task list --under E-<n> --json` then shows stage one's tasks `planned` and stage two's `backlog`.
- [ ] C2. Landing stage one's tasks through `cland merge` turns stage two's backlog tasks `planned`. With an after-stage QA policy on stage one, stage two moves only after the clear stage verdict.
- [ ] C3. A task of stage two already `in progress` is not touched. A task of the current stage set back to `backlog` by hand stays `backlog` after a later recompute. No item ever moves to `backlog`.
- [ ] C4. An epic without a plan moves nothing. An epic whose plan waits for approval moves nothing until `cland task plan approve`.
- [ ] C5. Closing the epic shows every stage `closed` in `cland task plan show` and `task.view`. Reopening it restores the derived states.
- [ ] C6. Each move logs `task-written` with op `planned`, read from the journal after the `flushLogs` barrier. A session subscribed to the epic's subtree receives one `status changed backlog → planned` event per moved task.
- [ ] C7. A query-count regression with 64 unrelated items and 8 unrelated epics with plans: one stage item landing stays under a fixed query bound, and a burst of ten closes in one tick runs one recompute per affected epic.
- [ ] C8. `hub/README.md`, `docs/agents/issue-tracker.md` with its template, the GLOSSARY Status entry and the `plan-epic` skill describe the plan-driven `planned`.
