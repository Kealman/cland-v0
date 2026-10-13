---
id: T-162
kind: task
title: "Graph stages: stage tags on nodes, s groups columns by stage and names
  edges against the plan, gp on a stage"
state: closed
status: done
criterion_seq: 5
labels:
  - v0.1
  - ready-for-agent
assignee: impl-162
parent: E-116
blocked_by:
  - T-161
  - T-183
  - T-187
topic: topic-100
branch: t/T-162-graph-stages-stage-tags-on-nodes-s
created: 2026-10-10T07:49:36.763Z
updated: 2026-10-10T21:27:20.016Z
closed: 2026-10-10T21:27:20.176Z
---

## Parent

T-116 (The task graph), slice 4 of 5. Spec §3.10 (stages), §3.13 (opening the plan view from a stage).

## What to build

Stages in the graph. With an epic plan, nodes carry their stage tag; `s` groups the columns by stage and names the edges that go back against the plan; `gp` on a stage opens the plan view.

## Acceptance criteria

- [x] C1. Nodes show their stage when the parent has a plan.
  - done: impl-162 · 2026-10-10T19:45:22.512Z
  - verified: rev-13 [reviewer] · run rev-13-20261010-162-2 · 2026-10-10T20:09:09.581Z
- [x] C2. `s` groups columns by stage and lists the edges that run against the plan.
  - done: impl-162 · 2026-10-10T20:08:14.511Z
  - verified: rev-13 [reviewer] · run rev-13-20261010-162-2 · 2026-10-10T20:09:09.581Z
- [x] C3. `gp` on a stage opens the plan view.
  - done: impl-162 · 2026-10-10T19:39:36.532Z
  - verified: rev-13 [reviewer] · run rev-13-20261010-162-1 · 2026-10-10T19:41:21.998Z
  - verified: rev-13 [reviewer] · run rev-13-20261010-162-2 · 2026-10-10T20:09:09.581Z
- [x] C4. Demo: an epic with a plan regroups by stage on `s`; a headless test covers it.
  - done: impl-162 · 2026-10-10T19:39:36.631Z
  - verified: rev-13 [reviewer] · run rev-13-20261010-162-1 · 2026-10-10T19:41:22.083Z
- [x] C5. `npm run typecheck && npm run test:nvim` pass.
  - done: impl-162 · 2026-10-10T21:26:39.586Z
  - verified: rev-13 [reviewer] · run rev-13-20261010-162-3 · 2026-10-10T21:26:59.619Z

## Blocked by

- T-161 (Graph cursor and live updates)
- The plan-parsing and plan-view tickets of T-114 (The epic plan), not yet cut; until then, blocked by the epic.

## Comments

### impl-162 · 2026-10-10T19:29:54.909Z

Claimed in isolated worktree. Confirmed test seams: headless graph against stub hub, plus a real-hub plan-set → stage-tag case. Reusing graph_layout fixed-rank support for stage grouping; plan.lua remains the accepted-plan adapter.

### impl-162 · 2026-10-10T19:37:29.157Z

Implemented stage tags, s grouping in plan order, gp on stage headings, live regrouping, and unplanned visibility. Targeted graph suite passed 13/13 before the added narrow-band regression (which also passes); real-hub plan-to-graph tags pass. Two-axis self-review found an incoming-port overlap and obsolete README limitation; both fixed, with an edge visibility regression. Review notes artifact A-734. Merged origin/dev (already current) before final typecheck/Neovim suite. Callback proved by a real delivered self-message.

### rev-13 · 2026-10-10T19:41:22.191Z

verdict: review
result: not clear
by: rev-13 [reviewer]
run: rev-13-20261010-162-1
commit: 90d27520025976d20f30dc035f25bf93795353f4

Medium — nvim/lua/cland/graph.lua:120: compose fetches a plan only when the displayed parent is tracker.levels[2]. For release/epic/phase, tasks below a phase can belong to the accepted epic plan but lose stage tags and s grouping. The hub accepts those descendants (tracker.ts:750); plan.owner(phase) resolves the epic. Resolve the owning epic before fetching and bind stage navigation to it. §3.10/§3.15 require stage tags and grouping when the epic has a plan.

Separate Standards axis: no findings. Independent typecheck/diff check passed; clean pinned head. Read-only headless compose probe reproduced missing S1/S2 tags/headings for valid phase children. C1/C2 failed; C3/C4 verified separately from inspected headless coverage and A-735 demo. C5 stays unverified pending final suite evidence.

Review A-737: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-737-t-162-review-at-90d2752-nested-container-stage-gap.md.

Criteria: C1 failed (Graph tasks beneath deeper configured containers omit stage tags from their accepted owning epic plan.), C2 failed (s does not group planned tasks when the displayed graph parent is a deeper configured container.).

### impl-162 · 2026-10-10T19:44:22.520Z

Fixed rev-13 finding: graph now resolves plan.owner(parent), fetches that epic's accepted plan, and binds headings to the owner. New headless release→epic→phase regression first failed on missing tags, then passed for tags, s grouping and gp navigation. The earlier full suite started before this fix and is superseded; awaiting its callback before starting one fresh final suite for the corrected head.

### rev-13 · 2026-10-10T20:09:09.581Z

verdict: review
result: clear
by: rev-13 [reviewer]
run: rev-13-20261010-162-2
commit: 9344ab86a12ef6cad0b30d970b7de9fa00295b7d

No high or medium findings. A-737 fixed: graph resolves the owning epic plan for deeper configured containers and binds stage headings to that epic. New headless release/epic/phase regression covers tags, s grouping and gp; separate Standards/Spec delta reviews found no issues.

Independent typecheck/diff check and read-only headless compose probes pass nested tags, both orientations, epic heading metadata and toggle retention. C1/C2/C3 verified; prior C4 demo/test verification remains. C5 stays unverified pending a fresh final suite; superseded A-754 does not establish readiness.

Review A-755: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-755-t-162-re-review-at-9344ab8-nested-stages-fixed.md.

Criteria: C1 verified, C2 verified, C3 verified.

### impl-162 · 2026-10-10T21:26:39.750Z

Final verification passed at 9344ab86a12ef6cad0b30d970b7de9fa00295b7d: npm run typecheck && npm run test:nvim exit 0, 244/244 tests passed, zero skips. Full durable log A-803: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-803-t-162-verification-after-t-201-queue-hold.txt. C5 marked done; reviewer asked to verify it. Worktree clean; previously clear delta review A-755 at same head. No additional suite needed.

### rev-13 · 2026-10-10T21:26:59.619Z

verdict: review
result: clear
by: rev-13 [reviewer]
run: rev-13-20261010-162-3
commit: 9344ab86a12ef6cad0b30d970b7de9fa00295b7d

No remaining high or medium findings. C5 verified from A-803: npm run typecheck && npm run test:nvim completed exit0, Neovim244/244, zero failures/cancellations/skips/todo. Clean unchanged reviewed head; claimant C5 done mark present. Prior C1–C4 and separate Standards/Spec A-737/A-755 remain supported. Earlier A-754 thread-fold failure is superseded by this final-head successful run. Durable writing/headless evidence inspected rather than independently rerun.

Review A-808: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-808-t-162-c5-verification-at-9344ab8-244-tests-pass.md.

Criteria: C5 verified.

### coord · 2026-10-10T21:27:20.016Z

Merged 28a6f3ffcb8b8419fc3478ecdc2390230b9fb0bd onto dev.
