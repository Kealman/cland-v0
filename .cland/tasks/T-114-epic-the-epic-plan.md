---
id: T-114
kind: epic
title: "Epic: The epic plan"
state: open
labels:
  - epic
  - v0.1
  - ready-for-agent
assignee: null
parent: T-130
blocked_by:
  - T-113
topic: null
branch: null
created: 2026-10-09T21:51:34.340Z
updated: 2026-10-09T23:02:38.498Z
---

## Goal

Every epic is worked from a plan: ordered stages of parallel lanes with a QA policy per stage, written by the `plan-epic` skill before the epic starts, kept in the epic's file, and read by the merge gate. The human opens the plan view with `gp` to see the stages, approves the plan when the project asks for approval, and follows it mid-way with every change marked since their last look. Today the order of an epic lives in the Coordinator's head, and QA is a label (`qa-required`).

## Contents

- **§3.10 The epic plan**: stages of parallel lanes with a QA policy per stage (`scope`, `when`) and per-item overrides, kept as a validated YAML block under `## Plan` in the epic's file; written by the `plan-epic` skill before the epic starts and approved per `[plan] approval`; set, shown and approved with `task.plan` and `cland task plan`; read by the merge gate in place of `qa-required`, with after-stage QA closing a stage in one run on `dev`; changed mid-epic through the same tool, journalled, and marked for the human.
- **§3.13 The plan view**: `gp` on an epic (or from its item view, a stage in the graph and the palette) shows the stages top to bottom with lanes as columns, each stage's QA policy and closing condition, an approval card before the start, and mid-way progress with changes marked in the watch colour `#c2a15e` until the human opens the view.
- **Around it**: the `per-group` policy that "Leads and the crew" validates launches one session per lane; `ready` (§3.2) follows the plan's QA policy; the items panel shows each row's stage ("S2").

Not in this epic: the graph's grouping by stage, and opening the plan view from a stage in the graph: "The task graph". Where watch-layer notifications sit in the inbox: "Visibility and artifacts"; this epic sends them.

Choices where the spec is silent:

- A QA verdict on a stage is recorded on the epic's item and names the stage.
- A not-clear stage verdict keeps the stage open: its findings become items in that stage, through a plan change, and a new QA run on `dev` closes it; the role clause holds the next stage's launches until then.
- `[plan] qa_default` has the shape of a stage's `qa` (`scope` and `when`).
- §3.13 names a motion `gb` beside `gi`, `gt` and `gs`, but no section defines it; this epic adds `gp` only.

## Tracer-bullet order

1. **The plan in the epic's file.** The `## Plan` YAML block and its validation; `task.plan set` and `show`, `cland task plan`; a broken plan refused with the previous one kept; the plan in `task view --json`; changes journalled. Demo: `cland task plan set T-<epic> --file plan.yaml` writes a two-stage plan, and a broken one is refused with the reason.
2. **The gate reads the plan.** An item's QA policy from its stage or its override, `[plan] qa_default` outside any plan, `qa-required` retired with the labelled items migrated, `ready` from the policy, and QA-marked criteria. Demo: an item in a stage with `scope: none` merges on review; one in a `per-item` stage is refused without its QA verdict.
3. **Stage QA.** After-stage items merge on review alone; one QA run on `dev` closes the stage with a verdict on the epic naming the stage; a not-clear stage verdict keeps the stage open; the `qa` skill writes a stage brief. Demo: three items merge on review, then one QA run closes stage 1.
4. **The plan-epic skill and approval.** The skill drafts a plan from the epic's tickets, their blocking edges and criteria, and the crew, and sets it; `[plan] approval`; `task.plan approve` by the human or an Aide; the clauses follow the stage order; `per-group` gives one session per lane. Demo: `plan-epic` on an epic yields a valid plan; with `approval = "human"`, nothing launches until it is approved.
5. **The plan view before the start.** `gp`, the header, the stage boxes with lanes as columns, the QA lines, the start and close lines, the approval card with `a`, `d` and `e`, the right column, and the items panel filtered to the epic with stage tags. Demo: the human opens `gp` on an epic that has not started and approves it with `a`.
6. **The plan view mid-way.** Closed stages' marks and QA runs, the stage in work with its sessions, dimmed planned stages, change marks until the human opens the view, the right column, and the "S2" tag on the items panel's rows. Demo: a lead moves an item between stages; the view marks the move in the watch colour with its reason until the human looks.

## Definition of done

Before an epic starts, its Lead or the Coordinator runs `plan-epic`. The human opens `gp` on the epic and sees its stages, lanes and QA policy; in a scratch project with `approval = "human"` they approve it with `a`, and only then do the first stage's sessions launch, one per lane. Mid-way, the items of an after-stage stage merge on review alone and one QA run on `dev` closes the stage; the gate refuses an item of a per-item stage that has no QA verdict; a plan change shows in the watch colour until the human opens the view.

- [ ] The hub parses and validates `## Plan`; a broken plan is refused and the previous one stays; `task.plan` and `cland task plan` set, show and approve.
- [ ] The gate takes each item's QA policy from its plan or `[plan] qa_default`; `qa-required` is retired; `ready` agrees with the gate.
- [ ] After-stage QA: the stage's items merge on review, one QA verdict on the stage closes it, and a not-clear stage verdict keeps it open.
- [ ] Criteria the plan marks for QA need a QA verification before the merge.
- [ ] `plan-epic` writes a valid plan; `approval = "human"` holds the epic's launches until the human or an Aide approves.
- [ ] `gp` opens the plan view before the start and mid-way as §3.13 describes; the items panel shows the stage tags.
- [ ] A plan change is journalled, leaves merged items alone, and stays marked for the human until they open the view.
- [ ] `docs/review-and-qa.md`, the `merge` and `qa` skills, the role clauses and `nvim/README.md` describe the plan and its view.

## Dogfooding

Once `plan-epic` lands, the rest of this epic, "Visibility and artifacts", "The task graph" and "Release from the item" each get a plan before their next launch, with `[plan] approval = "none"` because the human is away during the build. Their QA follows the plans instead of the `qa-required` label. The human reads the plans and their change marks in the plan view when they return.

## Constraints

- **ADRs.** 0002 (Task tracker: Markdown files are the source of truth, the hub keeps the index): the plan lives in the epic's file, and the hub validates and indexes it. 0004 (Agents work on a local git territory): the gate reads the policy, and stage QA runs on `dev`. 0006 (The hierarchy is the item tree; leads are hub-held claims on nodes): the epic's lead writes its plan. 0001 (Roles are hub-held state delivered as events): the clauses carry the stage order.
- **References.** The mockups `PlanBefore.dc.html` and `PlanMidway.dc.html` in `docs/design/main-screen/` (renders `screens/v01-plan-before.png` and `v01-plan-midway.png`), accepted by the human; the stage grouping and the small plan parser of the graph prototype (`prototype/graph`, commit `847d4ff`). No Neovim prototype of the plan view exists. Where sources disagree, the spec's words win, then the mockups.
- **Risk** from the sizing: after-stage QA puts a verdict on a stage, which is not an item, after its items merged.
- **The v0 tail.** T-78 (merge, worktree and release checks read the tracker's synchronous view) and T-103 (the tracker's storage queue has no deadline) touch this code. Neither is a prerequisite: the Coordinator takes one first only if it blocks this work; otherwise they carry `tech-debt`.
- **Order.** Fifth in the hub lane, after "Leads and the crew", whose Leads write plans and whose `per-group` staffs lanes; "Release from the item" waits for it.
- **Git and the gate.** Commit on the task branch `t/<id>-<slug>` in its worktree and push it to `origin`, the local territory; work reaches `dev` only through `cland merge` and its verdict gate; only `cland release` pushes to GitHub.
- **Language.** Every artifact, item, commit and doc in English.
- **Tests** through the v0 seams, in this order: the hub's frame protocol first (a real hub process and a real spoke over MCP and WebSocket, the UI over the JSON-lines socket, the `cland` CLI against a temporary project; `hub/test/harness.ts`); the harness process boundary second, with the fake Claude Code, Codex and OpenCode in `hub/test/fakes/`; the Neovim UI headless from the protocol's other side (`nvim/test` on the stub hub, QA cases in `qa/cases/` run by `cland --headless --qa`). No new seams inside the hub. Here the protocol covers plans set, refused and approved, the gate on each QA policy, and stage verdicts.

## Links

- Spec: `docs/spec/v0.1.md` on `dev`, §3.10 The epic plan, §3.13 The plan view; §3.4 (QA-marked criteria), §3.8 (`per-group`).
- Map T-81: decisions T-96 and T-100.
- GLOSSARY: Plan, Stage, Lane, Lead, Crew, Verdict, Criterion.
- ADRs: `docs/adr/0002-tracker-files-are-the-source-of-truth.md`, `docs/adr/0004-agents-work-on-a-local-git-territory.md`, `docs/adr/0006-the-hierarchy-is-the-item-tree.md`, `docs/adr/0001-roles-are-hub-held-state.md`.
- Branches: `prototype/graph` (stages).
- Mockups: `docs/design/main-screen/PlanBefore.dc.html`, `PlanMidway.dc.html`.
