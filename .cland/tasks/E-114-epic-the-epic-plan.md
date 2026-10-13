---
id: E-114
kind: epic
title: "The epic plan"
state: closed
criterion_seq: 8
labels:
  - epic
  - v0.1
  - ready-for-agent
assignee: null
parent: R-130
blocked_by:
  - E-113
topic: topic-128
branch: null
created: 2026-10-09T21:51:34.340Z
updated: 2026-10-11T10:54:45.631Z
closed: 2026-10-11T10:54:45.904Z
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

QA runs the demo below on `dev`, playing the human's part through the `cland` CLI and a headless workbench (one `nvim --headless` process, keys by `nvim_input`, the screen read with `screenstring()`), and records a clear verdict on this epic with each checkbox verified by its id; the epic then closes. The human does not run this demo: the human accepts only the release (T-117), decision D16.

Before an epic starts, its Lead or the Coordinator runs `plan-epic`. The human opens `gp` on the epic and sees its stages, lanes and QA policy; in a scratch project with `approval = "human"` they approve it with `a`, and only then do the first stage's sessions launch, one per lane. Mid-way, the items of an after-stage stage merge on review alone and one QA run on `dev` closes the stage; the gate refuses an item of a per-item stage that has no QA verdict; a plan change shows in the watch colour until the human opens the view.

- [ ] C1. The hub parses and validates `## Plan`; a broken plan is refused and the previous one stays; `task.plan` and `cland task plan` set, show and approve.
  - verified: qa-17 [qa] · run qa-2026-10-11-17-114 · 2026-10-11T10:54:40.899Z
- [ ] C2. The gate takes each item's QA policy from its plan or `[plan] qa_default`; `qa-required` is retired; `ready` agrees with the gate.
  - verified: qa-17 [qa] · run qa-2026-10-11-17-114 · 2026-10-11T10:54:40.899Z
- [ ] C3. After-stage QA: the stage's items merge on review, one QA verdict on the stage closes it, and a not-clear stage verdict keeps it open.
  - verified: qa-17 [qa] · run qa-2026-10-11-17-114 · 2026-10-11T10:54:40.899Z
- [ ] C4. Criteria the plan marks for QA need a QA verification before the merge.
  - verified: qa-17 [qa] · run qa-2026-10-11-17-114 · 2026-10-11T10:54:40.899Z
- [ ] C5. `plan-epic` writes a valid plan; `approval = "human"` holds the epic's launches until the human or an Aide approves.
  - verified: qa-17 [qa] · run qa-2026-10-11-17-114 · 2026-10-11T10:54:40.899Z
- [ ] C6. `gp` opens the plan view before the start and mid-way as §3.13 describes; the items panel shows the stage tags.
  - verified: qa-17 [qa] · run qa-2026-10-11-17-114 · 2026-10-11T10:54:40.899Z
- [ ] C7. A plan change is journalled, leaves merged items alone, and stays marked for the human until they open the view.
  - verified: qa-17 [qa] · run qa-2026-10-11-17-114 · 2026-10-11T10:54:40.899Z
- [ ] C8. `docs/review-and-qa.md`, the `merge` and `qa` skills, the role clauses and `nvim/README.md` describe the plan and its view.
  - verified: qa-17 [qa] · run qa-2026-10-11-17-114 · 2026-10-11T10:54:40.899Z

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

## Comments

### coord · 2026-10-10T17:04:49.044Z

Spec gap from T-183's review (rev-11, A-685): with a custom ladder, which level owns a plan? T-183 pins it to tracker.levels[1] (the level under the top), so ['release','epic','feature'] plans on epic, as hub/README.md's example expects. §3.10 says only 'the epic's item file'; it should name the rule. Settle when §3.10 is next amended; no v0.1 project uses a deeper ladder.

### qa-17 · 2026-10-11T10:54:40.899Z

verdict: qa
result: clear
by: qa-17 [qa]
run: qa-2026-10-11-17-114
commit: fa139c8158ec383943ad36742e06805462b59451

| Case | Surface | Result | Observation / evidence |
| --- | --- | --- | --- |
| M0 | hub-api | PASS | All six children closed; T-130 release; eight positional criteria. T-113 open at start, explicitly allowed; now closed. [capture](/Users/evgeniyivanov/Projects/cland/v0/.cland/qa/T-114/qa-2026-10-11-17-114/M0.txt) |
| M1 | hub-api | PASS | per-group draft helper chains T-3/T-4 and separates cross-lane dependent T-6; valid plan accepted pending approval. [capture](/Users/evgeniyivanov/Projects/cland/v0/.cland/qa/T-114/qa-2026-10-11-17-114/M1.txt) |
| M2 | hub-api | PASS | Curated plan set/show/view agrees; journal stores previous and new plans. [capture](/Users/evgeniyivanov/Projects/cland/v0/.cland/qa/T-114/qa-2026-10-11-17-114/M2.txt) |
| M3 | hub-api | PASS | Invalid scope, foreign item and malformed YAML refused; accepted plan unchanged. [capture](/Users/evgeniyivanov/Projects/cland/v0/.cland/qa/T-114/qa-2026-10-11-17-114/M3.txt) |
| M4 | hub-api | PASS | Broken hand save retains last valid plan and journals refusal; restoring clears planError. [capture](/Users/evgeniyivanov/Projects/cland/v0/.cland/qa/T-114/qa-2026-10-11-17-114/M4.txt) |
| M5 | hub-api | PASS | Coordinator approval forbidden; task approval refused; epic remains pending. [capture](/Users/evgeniyivanov/Projects/cland/v0/.cland/qa/T-114/qa-2026-10-11-17-114/M5.txt) |
| M6 | hub-api | PASS | Legacy label migration produces T-8 override and T-9 default fallback; journal records both; rerun idempotent. [capture](/Users/evgeniyivanov/Projects/cland/v0/.cland/qa/T-114/qa-2026-10-11-17-114/M6.txt) |
| M7 | hub-api | PASS | Outside-plan T-9 uses affected/per-item default; review alone is not ready and merge reports qa-missing. [capture](/Users/evgeniyivanov/Projects/cland/v0/.cland/qa/T-114/qa-2026-10-11-17-114/M7.txt) |
| M8 | hub-api | PASS | Approval hold rejects launch before creating a process or worktree. [capture](/Users/evgeniyivanov/Projects/cland/v0/.cland/qa/T-114/qa-2026-10-11-17-114/M8.txt) |
| M9 | headless-grid | PASS | gp, palette, graph and command open plan; lanes, QA lines, scoped stage tags, Lead metadata and approval card checked. [capture](/Users/evgeniyivanov/Projects/cland/v0/.cland/qa/T-114/qa-2026-10-11-17-114/M9.txt) |
| M10 | headless-grid | PASS | d composes to Lead without sending; e opens the epic source at ## Plan without saving. [capture](/Users/evgeniyivanov/Projects/cland/v0/.cland/qa/T-114/qa-2026-10-11-17-114/M10.txt) |
| M11 | headless-grid | PASS | a approves as human; persistence/journal confirmed; held Implementer launch then succeeds. [capture](/Users/evgeniyivanov/Projects/cland/v0/.cland/qa/T-114/qa-2026-10-11-17-114/M11.txt) |
| M12 | hub-api | PASS | Three base items ready and merged on review alone; early stage QA refused; stage remains open until QA. [capture](/Users/evgeniyivanov/Projects/cland/v0/.cland/qa/T-114/qa-2026-10-11-17-114/M12.txt) |
| M13 | hub-api | PASS | Human stage verdict refused; live QA not-clear keeps open, clear closes stage with exact scratch dev and run; epic unmarked. [capture](/Users/evgeniyivanov/Projects/cland/v0/.cland/qa/T-114/qa-2026-10-11-17-114/M13.txt) |
| M14 | headless-grid | PASS | Mid-way closed/current/planned styling, stage QA round, lane session, progress and board tags verified. [capture](/Users/evgeniyivanov/Projects/cland/v0/.cland/qa/T-114/qa-2026-10-11-17-114/M14.txt) |
| M15 | hub-api | PASS | Lead moves T-8 with reason; journal/history updated, merged item bytes and closed stage preserved; unseen receipt unchanged. [capture](/Users/evgeniyivanov/Projects/cland/v0/.cland/qa/T-114/qa-2026-10-11-17-114/M15.txt) |
| M16 | headless-grid | PASS | First visit shows move marks in #c2a15e; second visit consumes marks, retains history and saves receipt. [capture](/Users/evgeniyivanov/Projects/cland/v0/.cland/qa/T-114/qa-2026-10-11-17-114/M16.txt) |
| M17 | hub-api | PASS | Aide launched without item and approved through CLI; approved-by-aide card updated. [capture](/Users/evgeniyivanov/Projects/cland/v0/.cland/qa/T-114/qa-2026-10-11-17-114/M17.txt) |
| M18 | hub-api | PASS | Per-item QA verdict and QA-specific C1 verification each block merge/ready until supplied by QA. [capture](/Users/evgeniyivanov/Projects/cland/v0/.cland/qa/T-114/qa-2026-10-11-17-114/M18.txt) |
| M19 | hub-api | PASS | Six targeted files passed: task-plan 10, plan-gate 8, stage-qa 11, plan-approval 2, Neovim plan 11, selected graph case 1. [capture](/Users/evgeniyivanov/Projects/cland/v0/.cland/qa/T-114/qa-2026-10-11-17-114/M19.txt) |
| M20 | hub-api | PASS | QA/merge docs and skills, stage brief template, default/generated role clauses and Neovim plan-view docs checked. [capture](/Users/evgeniyivanov/Projects/cland/v0/.cland/qa/T-114/qa-2026-10-11-17-114/M20.txt) |
| BUILD-DELTA | hub-api | PASS | T-217 delta inspected; approval/launch tests rerun on current code: 2/2. [capture](/Users/evgeniyivanov/Projects/cland/v0/.cland/qa/T-114/qa-2026-10-11-17-114/BUILD-DELTA.txt) |
| D1 | deferred | BLOCKED | Deferred to v0.1.1 under D19. [scope](/Users/evgeniyivanov/Projects/cland/v0/.cland/qa/T-114/qa-2026-10-11-17-114/D1.txt) |
| D2 | deferred | BLOCKED | Deferred to v0.1.1 under D19. [scope](/Users/evgeniyivanov/Projects/cland/v0/.cland/qa/T-114/qa-2026-10-11-17-114/D2.txt) |
| D3 | deferred | BLOCKED | Deferred to v0.1.1 under D19. [scope](/Users/evgeniyivanov/Projects/cland/v0/.cland/qa/T-114/qa-2026-10-11-17-114/D3.txt) |
| D4 | deferred | BLOCKED | Deferred to v0.1.1 under D19. [scope](/Users/evgeniyivanov/Projects/cland/v0/.cland/qa/T-114/qa-2026-10-11-17-114/D4.txt) |

No high, medium or low product findings. Known brief soft spots caused no failure: M5 returns “forbidden: task.plan:approve (only the human or an Aide approves a plan)” and “approve needs a valid epic plan”; T-9 remains backlog after review but is correctly not ready; M17's Aide launch without --item succeeds. Screen driving used one persistent Neovim process and one attached UI, with nvim_input, screenstring, plan/panel buffer reads and extmark inspection. No fresh per-step attach was needed.

**QA clear.** M0–M20 passed, with **43 tests passed, 0 failed, 0 skipped** across the six requested single-file invocations. The selected graph stage test ran through the specified name filter. A further **2 approval/launch tests passed** after dev moved: **45 passing test executions** total. All test files ran one at a time. Raw passing test names are in [M19-1](/Users/evgeniyivanov/Projects/cland/v0/.cland/qa/T-114/qa-2026-10-11-17-114/M19-1.txt), [M19-2](/Users/evgeniyivanov/Projects/cland/v0/.cland/qa/T-114/qa-2026-10-11-17-114/M19-2.txt), [M19-3](/Users/evgeniyivanov/Projects/cland/v0/.cland/qa/T-114/qa-2026-10-11-17-114/M19-3.txt), [M19-4](/Users/evgeniyivanov/Projects/cland/v0/.cland/qa/T-114/qa-2026-10-11-17-114/M19-4.txt), [M19-5](/Users/evgeniyivanov/Projects/cland/v0/.cland/qa/T-114/qa-2026-10-11-17-114/M19-5.txt), [M19-6](/Users/evgeniyivanov/Projects/cland/v0/.cland/qa/T-114/qa-2026-10-11-17-114/M19-6.txt).

**Build provenance.** The complete demo and six corroborating files ran at requested dev **25756cf464c4249d56b8123e43cac9850dafd509**. After they finished, T-217 merged at **21b1dddb75adc4042d888b34bde9afd6db9862fe**. Per Coordinator priority, T-113 was re-recorded first as qa-2026-10-11-17-r2 ([A-1191](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1191-t-113-qa-re-record-after-t-217-merge.md)) and closed. A tracker-only commit then made current dev **fa139c8158ec383943ad36742e06805462b59451**.

The only intervening product change is T-217's matching offline-claim launch/adoption logic in hub/src/hub/worktrees.ts, its tests and README. No plan parser, QA policy, stage gate, approval or UI implementation changed. I inspected this delta and reran hub/test/plan-approval.test.ts at **fa139c8158ec383943ad36742e06805462b59451**; both tests passed. The unchanged plan evidence is explicitly carried forward to this current-tip verdict. This is not a claim that the entire demo was freshly rerun on fa139c8158ec383943ad36742e06805462b59451. The BUILD-DELTA method labels the product merge as 21b1ddd; its recorded build is fa139c8, including the subsequent tracker-only commit.

Run: **qa-2026-10-11-17-114**. Root tracked changes stayed within .cland tracker state. Scratch commands cleared inherited CLAND_* and NVIM* variables; only scratch identity overrides and fake-harness settings were supplied intentionally. Every session launch explicitly used --harness claude-code with the fake first on PATH. [Plan configuration](/Users/evgeniyivanov/Projects/cland/v0/.cland/qa/T-114/qa-2026-10-11-17-114/scratch-config.toml) was edited before hub start. Root sessions were never launched or stopped. All scratch sessions, hub and Neovim stopped; scratch directories removed after captures. [Cleanup](/Users/evgeniyivanov/Projects/cland/v0/.cland/qa/T-114/qa-2026-10-11-17-114/cleanup.txt). No product files changed.

**Criterion marks:** C1,C2,C3,C4,C5,C6,C7,C8 verified; failed: none. Mapping: C1 M2–M5, M11/M15/M17/M19; C2 M6/M7/M18(T-6); C3 M12/M13; C4 M18(T-7); C5 M1/M5/M8/M11/M17; C6 M9/M10/M14/M16; C7 M15/M16; C8 M20. Positional legacy IDs C1–C8 are stamped by the structured verdict.

**Deferred to v0.1.1 under D19:** D1 real-model plan judgement and rationale; D2 real Lead per-group lane reuse and stage sequencing; D3 a real QA session executing a committed stage brief on a detached dev worktree; D4 real-terminal readability and human colour judgement. These are recorded BLOCKED and exempt from this verdict; every criterion has runnable proof.

Executed using the [qa skill](/Users/evgeniyivanov/Projects/cland/v0/.agents/skills/qa/SKILL.md). Every check has a qa-record.sh line in .cland/qa/runs.jsonl; evidence is durable under this run directory.

Report artifact: A-1193, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1193-t-114-qa-clear-epic-plan-demo-and-45-passing-test-executions.md

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified, C6 verified, C7 verified, C8 verified.

### coord · 2026-10-11T10:54:45.631Z

Closed on QA run qa-2026-10-11-17-114 (A-1193): clear at dev fa139c8, C1–C8 verified (D16). The full demo ran at 25756cf; the only product change since, T-217, was inspected and its boundary tests were rerun at the tip. D1–D4 are deferred to v0.1.1 (D19).
