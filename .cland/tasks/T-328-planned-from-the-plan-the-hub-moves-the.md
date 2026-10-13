---
id: T-328
kind: task
title: "Planned from the plan: the hub moves the current stage's backlog tasks to planned, moves the next stage when one completes, and a closed epic reports its stages closed"
state: closed
status: done
criterion_seq: 8
labels:
  - v0.1.2
  - hub
  - ready-for-agent
assignee: null
parent: E-270
blocked_by: []
topic: topic-206
branch: t/T-328-planned-from-the-plan-the-hub-moves-the
created: 2026-10-13T14:04:09.203Z
updated: 2026-10-13T16:04:09.237Z
closed: 2026-10-13T16:04:07.052Z
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

- [x] C1. A hub test on a temporary project sets a two-stage plan with `cland task plan set`. `cland task list --under E-<n> --json` then shows stage one's tasks `planned` and stage two's `backlog`.
  - done: impl-328 · 2026-10-13T14:38:55.376Z
  - verified: rev-23 [reviewer] · run rev-2026-10-13-328-5 · 2026-10-13T16:03:52.099Z · commit a3a04a91fd879085fbd7c183463326f18568be97
- [x] C2. Landing stage one's tasks through `cland merge` turns stage two's backlog tasks `planned`. With an after-stage QA policy on stage one, stage two moves only after the clear stage verdict.
  - done: impl-328 · 2026-10-13T14:38:56.563Z
  - verified: rev-23 [reviewer] · run rev-2026-10-13-328-5 · 2026-10-13T16:03:52.099Z · commit a3a04a91fd879085fbd7c183463326f18568be97
- [x] C3. A task of stage two already `in progress` is not touched. A task of the current stage set back to `backlog` by hand stays `backlog` after a later recompute. No item ever moves to `backlog`.
  - done: impl-328 · 2026-10-13T14:49:58.785Z
  - verified: rev-23 [reviewer] · run rev-2026-10-13-328-5 · 2026-10-13T16:03:52.099Z · commit a3a04a91fd879085fbd7c183463326f18568be97
- [x] C4. An epic without a plan moves nothing. An epic whose plan waits for approval moves nothing until `cland task plan approve`.
  - done: impl-328 · 2026-10-13T14:38:58.469Z
  - verified: rev-23 [reviewer] · run rev-2026-10-13-328-5 · 2026-10-13T16:03:52.099Z · commit a3a04a91fd879085fbd7c183463326f18568be97
- [x] C5. Closing the epic shows every stage `closed` in `cland task plan show` and `task.view`. Reopening it restores the derived states.
  - done: impl-328 · 2026-10-13T14:38:59.373Z
  - verified: rev-23 [reviewer] · run rev-2026-10-13-328-5 · 2026-10-13T16:03:52.099Z · commit a3a04a91fd879085fbd7c183463326f18568be97
- [x] C6. Each move logs `task-written` with op `planned`, read from the journal after the `flushLogs` barrier. A session subscribed to the epic's subtree receives one `status changed backlog → planned` event per moved task.
  - done: impl-328 · 2026-10-13T14:39:01.621Z
  - verified: rev-23 [reviewer] · run rev-2026-10-13-328-5 · 2026-10-13T16:03:52.099Z · commit a3a04a91fd879085fbd7c183463326f18568be97
- [x] C7. A query-count regression with 64 unrelated items and 8 unrelated epics with plans: one stage item landing stays under a fixed query bound, and a burst of ten closes in one tick runs one recompute per affected epic.
  - done: impl-328 · 2026-10-13T14:49:59.699Z
  - verified: rev-23 [reviewer] · run rev-2026-10-13-328-5 · 2026-10-13T16:03:52.100Z · commit a3a04a91fd879085fbd7c183463326f18568be97
- [x] C8. `hub/README.md`, `docs/agents/issue-tracker.md` with its template, the GLOSSARY Status entry and the `plan-epic` skill describe the plan-driven `planned`.
  - done: impl-328 · 2026-10-13T14:39:02.886Z
  - verified: rev-23 [reviewer] · run rev-2026-10-13-328-2 · 2026-10-13T14:53:55.270Z · commit fcf4211d45942da6c913aa2f86b20ab4b89c7847
  - verified: rev-23 [reviewer] · run rev-2026-10-13-328-4 · 2026-10-13T15:42:28.380Z · commit a3a04a91fd879085fbd7c183463326f18568be97
  - verified: rev-23 [reviewer] · run rev-2026-10-13-328-5 · 2026-10-13T16:03:52.100Z · commit a3a04a91fd879085fbd7c183463326f18568be97

## Comments

### impl-328 · 2026-10-13T14:39:03.591Z

Implemented durable plan-stage entry tracking and indexed affected-epic lookup. Current-stage backlog tasks move through hub #mutate as op planned; plan acceptance/approval, stage completion/QA and startup trigger coalesced checks. Closed epics report closed stages without planned writes. CLI/frame tests cover merges, approval, hand resets/new members, restart/offline changes, subscribed events/journal and native query bounds. Concurrent hand status saves win during a gated planned write. Targeted checks: 68 tests across planned-stage, task-plan, plan-approval, stage-qa and tracker-async passed; typecheck and shard admission passed. Full verification follows clear source review per D25.

### rev-23 · 2026-10-13T14:43:30.400Z

verdict: review
result: not clear
by: rev-23 [reviewer]
run: rev-2026-10-13-328-1
commit: 355b9c7d5de611fb11316c862289e14c23f60b81

Medium — hub/src/tracker/tracker.ts:1691,1701 checks planned source only before rename; a late in-place save is detected after rename but only criterion writes refuse/capture it, so a human status can be overwritten. Cover that window and retain the saved source/status. Medium — hub/src/tracker/tracker.ts:971 retries every refused plan on each affected task write, making planned work depend on unrelated invalid epics; index candidate dependencies and add refused-plan workload coverage. Full run remains pending D25/QA priority. Evidence A-1968: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1968-t-328-source-review-not-clear-hand-save-race-and-refused-plan-fan-out.md.

Criteria: C3 failed (A late in-place hand save after the planned pre-rename hash read is overwritten; post-rename source protection handles only criterion writes.), C7 failed (Each planned task write retries all refused plan candidates via #planErrors.keys, so work is not bounded to indexed affected epics.).

### impl-328 · 2026-10-13T14:50:00.204Z

Corrected C3/C7 findings from source review rev-2026-10-13-328-1. Planned writes now use the existing guarded capture/link mechanism, detect the post-publication old-fd save, and restore the saved inode only over the generated publication using the same guard. The late-window regression retains the hand review status and source and announces no planned event. Accepted and parseable candidate plan dependencies share the reverse index; removal/reparent/criterion/new-child recovery targets only affected candidates. Added eight unrelated refused plans to the workload; old source reproduced 192 unrelated validation reads, corrected source counts zero. Candidate ancestor-reparent recovery passes. Targeted checks after correction: planned-stage 10, task-plan 10, plan-approval 3 and tracker-criterion-write 13 (36 total) pass; typecheck, shard admission and diff check pass. Fresh source review is required before any full verification; E-269 QA priority remains in force.

### rev-23 · 2026-10-13T14:53:55.270Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-2026-10-13-328-2
commit: fcf4211d45942da6c913aa2f86b20ab4b89c7847

No high or medium source findings remain. C3/C7 corrections preserve the late editor inode/status through guarded publication with no false planned event, and index refused candidate dependencies without unrelated retry fan-out; recovery/query bounds remain covered. Original stage/approval/entry semantics remain applicable. C8 docs verified; C1–C7 final runtime verification awaits the complete exact-head run. Respect D25 and the E-269 QA-end admission hold. Evidence A-1977: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1977-t-328-corrected-source-review-clear-at-fcf4211.md.

Criteria: C8 verified.

### rev-23 · 2026-10-13T15:37:47.259Z

verdict: review
result: not clear
by: rev-23 [reviewer]
run: rev-2026-10-13-328-3
commit: fcf4211d45942da6c913aa2f86b20ab4b89c7847

Medium — hub/test/default-subscriptions.test.ts:433,438,443 counts the newly required planned event as an extra ready delivery; preserve one immediate ready delivery and no premature turn while accounting for planned. Medium — hub/test/task-prefixes.test.ts:114 requires standalone channel content, missing the routed message present in a planned-event turn digest; preserve exact message/recipient/topic guarantees. Full A-1990 fails 3/1482 and does not reach Neovim. No product criterion failure inferred; C1–C7 final verification pending, C8 source mark retained. Evidence A-1991: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1991-t-328-exact-head-full-verification-not-clear.md.

### impl-328 · 2026-10-13T15:41:41.030Z

Full run A-1990's three failures reproduced as stale integration assumptions caused by the required planned setup event. Pushed test-only correction a3a04a91: baseline/assert setup planned event by id and turn digest, retain no-premature-turn/exactly-one-ready-now/journal counts, and match legacy report's exact body line inside plain or digest while checking canonical recipient/topic/item. Coordinator shared palette fix 7210621b cherry-picked unchanged as 3a16e9d9. Sequential targeted checks: ready 2, full prefix file 8, palette case 1 pass; typecheck/shard/diff checks pass. No production code change. Fresh source delta review requested; full verification pending.

### rev-23 · 2026-10-13T15:42:28.380Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-2026-10-13-328-4
commit: a3a04a91fd879085fbd7c183463326f18568be97

Source delta clear: no findings. Planned setup is explicitly asserted and excluded by its sole known id; no premature Coordinator turn, one ready-now event, restart and settled journal counts remain. Legacy routing checks exact body line plus recipient/topic/canonical item. Shared palette cherry-pick matches 7210621b and waits on snapshot state with original assertions retained. No production delta; C8 refreshed, C1–C7 await complete same-head full verification. Evidence A-1993: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1993-t-328-integration-assertion-delta-source-clear-at-a3a04a91.md.

Criteria: C8 verified.

### rev-23 · 2026-10-13T16:03:52.100Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-2026-10-13-328-5
commit: a3a04a91fd879085fbd7c183463326f18568be97

No high, medium, or low findings remain. Source A-1977/A-1993 and complete exact-head A-1996 establish C1–C8, including stage/QA activation, hand-save preservation, subscribed journal events, closed/reopened stages and bounded candidate work. Typecheck and all phases pass 1801/1801, exit 0, zero skips/cancellations. Previously failing integration cases are green with reviewed assertions. Evidence A-1997: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1997-t-328-final-exact-head-review-clear.md.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified, C6 verified, C7 verified, C8 verified.

### coord · 2026-10-13T16:04:09.237Z

Merged 7b9cc31af14b689b52ff68d49b94eeea28cccd11 onto dev.
