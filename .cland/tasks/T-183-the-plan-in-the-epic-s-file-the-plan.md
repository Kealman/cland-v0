---
id: T-183
kind: task
title: "The plan in the epic's file: the ## Plan YAML block, task.plan set and show, validation, journalled changes"
state: closed
status: done
criterion_seq: 4
labels:
  - v0.1
  - ready-for-agent
assignee: null
parent: T-114
blocked_by: []
topic: topic-90
branch: t/T-183-the-plan-in-the-epic-s-file-the-plan
created: 2026-10-10T15:38:37.301Z
updated: 2026-10-10T17:51:23.010Z
---

## Parent

T-114, slice 1 of 6. Read the epic's Contents, its choices where the spec is silent, and its Constraints, which apply to this slice.

## What to build

The `## Plan` YAML block and its validation; `task.plan set` and `show`, `cland task plan`; a broken plan refused with the previous one kept; the plan in `task view --json`; changes journalled.

## Acceptance criteria

- [x] C1. The behaviour above works end to end through the v0 seams: the hub frame protocol, the fake harnesses and headless Neovim where the UI is touched.
  - done: impl-183 · 2026-10-10T15:59:08.845Z
  - verified: rev-11 [reviewer] · run rev-20261010-183-2 · 2026-10-10T16:00:56.113Z
  - verified: rev-11 [reviewer] · run rev-20261010-183-3 · 2026-10-10T17:04:31.628Z
- [x] C2. Demo: `cland task plan set T-<epic> --file plan.yaml` writes a two-stage plan, and a broken one is refused with the reason.
  - done: impl-183 · 2026-10-10T15:49:51.222Z
  - verified: rev-11 [reviewer] · run rev-20261010-183-1 · 2026-10-10T15:55:34.403Z
  - verified: rev-11 [reviewer] · run rev-20261010-183-2 · 2026-10-10T16:00:56.113Z
  - verified: rev-11 [reviewer] · run rev-20261010-183-3 · 2026-10-10T17:04:31.628Z
- [x] C3. Docs (hub/README.md, nvim/README.md or docs/) describe what changed; any role clause change lists the exact .cland/roles.toml lines in the handover.
  - done: impl-183 · 2026-10-10T15:49:51.289Z
  - verified: rev-11 [reviewer] · run rev-20261010-183-1 · 2026-10-10T15:55:34.542Z
  - verified: rev-11 [reviewer] · run rev-20261010-183-2 · 2026-10-10T16:00:56.113Z
  - verified: rev-11 [reviewer] · run rev-20261010-183-3 · 2026-10-10T17:04:31.628Z
- [x] C4. `npm run typecheck && npm test` pass (or `npm run test:nvim` for a Neovim-only slice).
  - done: impl-183 · 2026-10-10T17:49:56.071Z
  - verified: rev-14 [reviewer] · run rev-20261010-183-4 · 2026-10-10T17:50:55.864Z

## Comments

### impl-183 · 2026-10-10T15:43:26.392Z

Implementation underway: validated stages/lanes with root per-item qa and qa_criteria overrides (Coordinator-approved shape). Plans live in the epic's ## Plan YAML block; the tracker retains the last accepted plan across invalid hand edits and restart. Adding task.plan set/show through MCP, frame protocol and CLI, with before/after journal records.

### rev-11 · 2026-10-10T15:55:34.650Z

verdict: review
result: not clear
by: rev-11 [reviewer]
run: rev-20261010-183-1
commit: bd4bce420ea5b73d3e5d98e60a2de7a9363666c3

Medium — hub/src/tracker/tracker.ts:637: revalidate dependent epic plans after child indexing. Saving an epic override C2 before its child's new C2 is indexed refuses the epic; indexing the child never accepts or journals it. View/show at :757 then returns the new C2 plan, but a subsequent broken save falls back to retained C1. Confirmed with the existing file boundary and in-memory database; violates §3.10 previous-plan retention and change journalling. Standards: no findings. Spec: one medium finding. C2 and C3 verified separately under this run; C1 failed. Typecheck passed; C4 full suite remains unverified. Detailed evidence in the review artifact in topic-90.

Criteria: C1 failed (Epic-first dependent hand edits show an unjournalled new plan without updating its retained snapshot; a later broken save restores an older plan.).

### impl-183 · 2026-10-10T15:59:09.049Z

Fixed review A-652: a lane task's new criteria, kind or parent now revalidate cached epic candidates, so an epic-first save becomes retained and journalled after the child is indexed. Reads also retain and journal the exact valid hand-saved plan they show. The new protocol regression first failed with C1 restored after C2 was shown, then passed; all 8 plan cases and npm run typecheck pass. Old-head suite cancelled at Coordinator request; queuing full validation on the fix head.

### rev-11 · 2026-10-10T16:00:56.113Z

verdict: review
result: clear
by: rev-11 [reviewer]
run: rev-20261010-183-2
commit: d4561fb9f2ca01b65523ec6dca8e114d47419e2b

No remaining high or medium findings. A-652 is resolved: hub/src/tracker/tracker.ts:770 retains epic candidates and retries them after child indexing, while :869 accepts and journals the exact valid plan before returning it. The same read-only reproduction now journals C1→C2 and retains C2 after a broken save; the real-protocol regression checks journal acceptance before a plan read. Standards: no findings. Spec: no findings. C1–C3 verified for this full-item verdict. Typecheck passed independently; C4 remains unverified pending the queued full suite.

Criteria: C1 verified, C2 verified, C3 verified.

### impl-183 · 2026-10-10T17:01:51.917Z

Committed configured-levels fix as 0b5aa971fbb8e553d5e1706a920d46b1f9f40ec9 and pushed origin. Plan ownership follows tracker.levels[1]; custom milestone/initiative integration regression passes. Targeted plan tests 9/9, source guard 2/2 and typecheck pass. Full suite queued through the dummy-proven completion reporter; orphan-server cleanup race remains T-172.

### rev-11 · 2026-10-10T17:04:31.628Z

verdict: review
result: clear
by: rev-11 [reviewer]
run: rev-20261010-183-3
commit: 0b5aa971fbb8e553d5e1706a920d46b1f9f40ec9

No supported high or medium findings. Standards: no findings. Spec: accept the documented levels[1] convention; §3.1 allows leaves under any container and the existing [release, epic, feature] example at hub/README.md:915 places a level below the epic, so the spec does not mandate lowest-level ownership. With [release, milestone, epic], milestone is the second semantic role; kind names are configurable, not reserved. Arbitrary deeper-ladder role mapping is underspecified in §3.10, so this is an interpretation. All set/show/validation/candidate guards use the same predicate; renamed-level protocol regression covers retention. Actual predicate checks and typecheck passed independently. Prior unchanged behavior and A-652 resolution carry forward from A-659. C1–C3 verified; C4 waits for full-suite evidence.

Criteria: C1 verified, C2 verified, C3 verified.

### rev-14 · 2026-10-10T17:50:55.864Z

verdict: review
result: clear
by: rev-14 [reviewer]
run: rev-20261010-183-4
commit: 0b5aa971fbb8e553d5e1706a920d46b1f9f40ec9

No findings in the focused C4 evidence review. A-694:2–11 records both typecheck phases and the complete package test command; :1181–1187 reports hub 1031/1031 and :1427–1433 reports Neovim 232/232, both with zero failures, cancellations, skips or todos. package.json:16–17 and hub/test/run-suite.ts:221–239 establish full inventories and failure propagation. Independently confirmed clean task worktree and matching HEAD/local origin at the pinned commit; lead reports both commands exit 0. No tests rerun or repository edits. Standards: 0 findings; Spec: 0 findings. C4 verified; C1–C3 marks and same-head full-item clearance from rev-20261010-183-3 carry forward. Details: A-696 at /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-696-t-183-c4-review-at-0b5aa97-full-validation-verified.md.

Criteria: C4 verified.

### coord · 2026-10-10T17:51:23.010Z

Merged f0724328586a346ffc6d7c84881389e3909d7e4e onto dev.
