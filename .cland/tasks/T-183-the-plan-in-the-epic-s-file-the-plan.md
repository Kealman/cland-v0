---
id: T-183
kind: task
title: "The plan in the epic's file: the ## Plan YAML block, task.plan set and show, validation, journalled changes"
state: open
status: in progress
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
updated: 2026-10-10T15:55:34.650Z
---

## Parent

T-114, slice 1 of 6. Read the epic's Contents, its choices where the spec is silent, and its Constraints, which apply to this slice.

## What to build

The `## Plan` YAML block and its validation; `task.plan set` and `show`, `cland task plan`; a broken plan refused with the previous one kept; the plan in `task view --json`; changes journalled.

## Acceptance criteria

- [ ] C1. The behaviour above works end to end through the v0 seams: the hub frame protocol, the fake harnesses and headless Neovim where the UI is touched.
  - failed: rev-11 [reviewer] · 2026-10-10T15:55:34.650Z · note Epic-first dependent hand edits show an unjournalled new plan without updating its retained snapshot; a later broken save restores an older plan.
- [x] C2. Demo: `cland task plan set T-<epic> --file plan.yaml` writes a two-stage plan, and a broken one is refused with the reason.
  - done: impl-183 · 2026-10-10T15:49:51.222Z
  - verified: rev-11 [reviewer] · run rev-20261010-183-1 · 2026-10-10T15:55:34.403Z
- [x] C3. Docs (hub/README.md, nvim/README.md or docs/) describe what changed; any role clause change lists the exact .cland/roles.toml lines in the handover.
  - done: impl-183 · 2026-10-10T15:49:51.289Z
  - verified: rev-11 [reviewer] · run rev-20261010-183-1 · 2026-10-10T15:55:34.542Z
- [ ] C4. `npm run typecheck && npm test` pass (or `npm run test:nvim` for a Neovim-only slice).

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
