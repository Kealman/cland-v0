---
id: E-416
kind: epic
title: Items in the web
state: open
labels:
  - epic
  - v0.2
  - ready-for-agent
assignee: null
parent: R-377
blocked_by:
  - E-412
  - E-415
topic: topic-830
branch: null
created: 2026-10-14T15:59:23.825Z
updated: 2026-10-22T06:45:25.677Z
---

## Summary

The Items area brings Neovim's explorer to the browser: the tree with its roll-ups and folded roots, the card in the drawer, scoping, and the Board, Graph and Plan views that keep the scope, the filter and the selection. The human steers from it as in Neovim, by a message to the Coordinator, a plan approval or a criteria edit, and edits nothing else by hand.

## Goal

The human studies and plans the work in the browser as in Neovim's explorer, with the room a page gives: the release, its epics and their stages, the card of the row under the cursor, and the board, the graph and the plan of an epic one view switcher apart. Today only Neovim draws them. The Q-405 prototype drew the tree and the card from the live hub's 410 items and stubbed scoping, the other views and every write.

## Contents

- **§3.2 The Items area.** The tree (the explorer), with Board, Graph and Plan as views beside it in the area's header: the view switcher keeps the scope, the filter and the selection, and Plan shows the plan of the selected epic. The accepted Main board: the grid with one cell per child up to 16 children and a proportional bar beyond (P5); the card in the drawer with Split and Close (P6); the quick message on the card (P8); the card's blocks (P9); the ordinal on each row, and the rank fact only when it was set by hand.
- **v0.1.2 §3.8 The item explorer, as the prototype built it.** The current release at the root with its epics by rank and the done ones after them in the order they closed; Direct tasks (N); the folded roots Categories, Unscheduled (with the maps) and Other releases, with `A` showing the archived roots; release, epic and task rows with their roll-ups, the stage groups of an epic with a plan, claims, holds, verdicts with their round and verified/total; `D` hiding done items; `j`, `k`, `l`, `h`, `za`, Enter into the card and back; `s` scoping to a node with breadcrumbs and a back stack; the cursor kept on its item across deltas.
- **v0.1.2 §3.9 The card.** The summary with its provenance line; the facts; the progress; the plan stage; the latest verdict boxed in its colour with its reason, round and scope; blocked by, blocks and regression of; the branch and the latest `cland verify`; the dates and the last activity; the Decision block; the agents' text folded.
- **v0.1.2 §3.10 Categories, the web side.** The categories root with its counts; an unfolded category shows its top three by rank, "N more", its open count and what `D` hides, and the idle-work mark of `idle_from`.
- **v0.1.2 §3.11 at release scope, as the Board view.** The board of v0.1 §3.11 as a view: status sections with counts, rows with the parent prefix, the claim or verdict mark, verified/total, the blocked glyph and the next mark; at release scope, the epics as folded rows with done/total and the breakdown, unfolding into status sections, the epic tabs, Direct tasks (N) and the categories' count line.
- **The Graph view** (v0.1 §3.15, v0.1.2 §3.3): the task graph of the scope, with done nodes in the done colour and the green glyph, and container nodes with done/total and the count in work.
- **The Plan view** (v0.1 §3.13): the selected epic's plan with its stages, lanes and QA policy, what starts and closes each stage, the right column, and the changes since the human's last look in the watch colour; `a` approves a plan waiting under `[plan] approval = "human"`, at desktop width only (§3.6); `d` writes to the Lead in the epic's topic.
- **§3.4 Addressing** as in Neovim (v0.1.2 §3.8): `m` sends to General with the item's context, `M` to the item's topic, created when it has none, and a selection goes to General with one line per item.
- **§3.5 Editing: parity with Neovim.** The web edits nothing by hand that Neovim does not: the message to the Coordinator, the plan approval and the criteria edits of the item view (v0.1 §3.4). Dragging rank or moving items between epics with the mouse is 0.2.x.

Not in this epic: the hub's fields that the tree and the card read (E-413); the Topics area and the threads (E-417); the phone, where the planning views open read-only through More (E-419).

Choices where the spec is silent:

- **The hub's fields.** The tree and the card read the fields of E-413 (the summary, the roll-ups, `blocked`, `next`, the verdict's reason, the Decision block, the stage states). This epic has no edge to E-413, so the Coordinator orders the slices that need them after the first slice of E-413 lands. A slice that must go first uses the prototype's port (`web/src/explorer.ts`, `web/src/summary.ts`) behind the differential test against the Lua, and the port goes when the fields arrive.
- **The current release** is the lowest open version unless the release switcher picks another, as in the prototype; the pick is per client.
- **Selection.** `x` toggles a row into the selection, Shift with `j` or `k` extends it, and Esc clears it; `m` on a selection sends one message to General.
- **The quick message** is a one-line field on the card, focused by `m`; the switch beside it, or `M`, sends it to the item's topic instead (P8).
- **Keys** follow Neovim's: `␣␣` goes back in the scope stack, `gi`, `gt` and `gs` jump, and an item id in any text opens the item in the Items area with its ancestors unfolded.
- **The Board view has no rank keys** in 0.2.0: §3.5 names the web's hand edits, and ranking is not among them. The rank order, the next mark and the blocked glyph come from the hub.
- **The Graph view** ports the layered layout of `nvim/lua/cland/graph_layout.lua` to TypeScript, with a differential test against the Lua on the QA graph fixture (`qa/cases/GRAPH-001.items.json`); no layout library; SVG drawn from the tokens.
- **The Plan view** offers no plan editing: the YAML is edited through the `plan-epic` skill, Neovim and the CLI. Approval is offered at desktop width only.
- **The criteria edits** live on the card's criteria block: `e` opens it to add, edit and remove criteria and to set the done mark as the human, through `task.criterion`; ids are never reused. Labels and the body stay in Neovim.
- **Speed.** The tree is rebuilt from the model on every delta and redrawn only where it changed: under 15 ms for a tree of 300 items, as in Neovim (v0.1.2 §3.8).

## Tracer-bullet order

1. **The tree from the snapshot.** The explorer at the current release on the hub's edge, the folded roots, the rows per level with cells or a bar, rank then close order, `D`, `A`, the folds remembered and the cursor kept across deltas. Demo: on a copy of the live tracker the tree paints within a second of navigation, and a status change on a visible task moves its row while the cursor stays on its item.
2. **The card in the drawer.** The card's blocks from the snapshot's facts, the verdict box, the Decision block, the agents' text on demand, and the focus moving into the card and back. Demo: the card of a task with a not-clear verdict shows its reason and round with no request for the item, and the agents' text loads only when it is opened.
3. **Scope, selection and the messages.** `s` with breadcrumbs and the back stack, the selection, `m` to General with the context, `M` to the item's topic, and item ids as links. Demo: three rows selected and `m` send one message to General naming the three items by their display ids, as the Coordinator receives it.
4. **The Board view.** The status sections, the release scope with its epics as folded rows, the epic tabs, Direct tasks and the categories' line, and the switcher keeping the scope, the filter and the selection. Demo: switching from Tree to Board and back on a scoped epic keeps the scope and the selected task.
5. **The Graph view.** The ported layout with done nodes and container counts. Demo: the Graph of the release shows a closed epic in the done colour with its full fraction and an open one with its count in work, and the layout equals the Lua's on the QA fixture.
6. **The Plan view and the edits.** The selected epic's plan with its changes since the last look, `a` approving, `d` discussing, and the criteria edits on the card. Demo: with `[plan] approval = "human"`, `a` in the Plan view approves an epic's plan, and `cland task plan show` reads it approved by the human.

## Definition of done

QA runs the demo below on `dev`, playing the human's part through the `cland` CLI and headless Chromium (Chrome Headless Shell through `playwright-core`, keys sent with their physical codes, the screen read from the DOM), and records a clear verdict on this epic with each checkbox verified by its id; the epic then closes. The human does not run this demo (spec §4: no separate human acceptance pass).

In a scratch project holding a copy of the live tracker, the fake harnesses and `[plan] approval = "human"`, QA opens the web at 1440x900 through `cland web --no-open`: the Items area shows the current release with its epics, their bars and stages, Direct tasks and the folded roots. QA moves with `j` and `k`, unfolds an epic with `l`, scopes to it with `s` and comes back with `␣␣`, hides done items with `D` and shows the archived roots with `A`; it reads a task's card in the drawer (the summary, the facts, the criteria, the latest verdict with its reason and round, the branch and the verify result, the relations, the Decision block) and opens the agents' text. QA selects three rows and presses `m`, and reads one message in General with one line per item; `M` on an item without a topic creates the topic and sends there. QA switches to Board, Graph and Plan and back, keeping the scope and the selection; in the Plan view of an epic waiting for approval it presses `a`, and `cland task plan show` reads the plan approved by the human. QA adds a criterion on the card and reads it with `cland task view`. A status change made through the CLI moves its row while the cursor stays on its item. An unfolded category shows its top three, "N more" and the idle-work mark.

- [ ] C1. The tree shows the current release and the folded roots (Categories with the top three, "N more" and the idle-work mark; Unscheduled; Other releases behind `A`), with rows per level, cells or a proportional bar past 16 children, stage groups, claims, holds, verdicts with their round and verified/total; `D` and the folds are kept per client.
- [ ] C2. The card in the drawer shows what v0.1.2 §3.9 lists from the snapshot's facts with no request per card, with the ordinal on the row and the rank fact only when set by hand.
- [ ] C3. `s` scopes with breadcrumbs and a back stack, the cursor stays on its item across deltas, and an item id in any text opens the item.
- [ ] C4. `m` sends to General with the item's context, `M` to the item's topic (created when missing), and a selection to General with one line per item.
- [ ] C5. Board, Graph and Plan sit in the Items header as views that keep the scope, the filter and the selection; the Board shows the release scope's epics as folded rows, and the Graph draws done and container nodes as v0.1.2 §3.3 says.
- [ ] C6. The Plan view shows the selected epic's plan with the changes since the human's last look, and approves a waiting plan on `a` at desktop width.
- [ ] C7. The only hand edits in the Items area are the messages, the plan approval and the criteria edits; nothing ranks or moves with the mouse.
- [ ] C8. `web/README.md` and `?` describe the Items area and its keys.

## Dogfooding

The human studies and plans the rest of the build in the Items area from its first slice: the release, the epics with their stages, the card of each item, and `m` to the Coordinator from the browser in place of Neovim's explorer.

## Constraints

- **Standing rules.** Every artifact, item, commit and doc in English. Sub-agents never use the hub: the cland tools belong to the session that started them. Only `cland release` pushes to GitHub: commit on the task branch `t/<id>-<slug>` in its worktree, push it to `origin`, the local territory, and reach `dev` only through `cland merge` and its verdict gate. Suites run through `cland verify` (D25 and D29 of v0.1 §4). The hub's frame protocol is the first test seam (a real hub, real clients, the CLI against a temporary project; `hub/test/harness.ts`), the fake harnesses in `hub/test/fakes/` the second, and Playwright the third (headless Chromium through `playwright-core` under `node:test`, only for what needs a page); no new seams inside the hub. The web never sees the hub's secret. No hex colour outside the tokens in `web/src/tokens.css`. No iframe has `allow-scripts` together with `allow-same-origin`. Keys match by physical key (`KeyboardEvent.code`).
- **Precedence.** The spec's words; then the prototype's tree and card (`web/src/explorer.ts`, `summary.ts` and `items/` on `prototype/web-shell`), ported and never merged; then the Main board. Neovim's explorer, board, graph and plan view (`nvim/lua/cland/explorer*.lua`, `vboard.lua`, `graph_layout.lua`, `plan.lua`) define the behaviour where the web copies it.
- **Risks.** The graph's layered layout is the largest piece (1,225 lines of Lua), and the differential test keeps the port honest. The rebuild per delta must stay within the 15 ms bar as the tracker grows. The card must never cost a request per cursor move.
- **Size.** About seven sessions on the v0 scale.
- **Order.** Second in the web lane: it waits for E-412 and E-415. E-417 and E-418 wait for it. It reads the fields of E-413 without an edge (see the choices).

## Links

- Spec: `docs/spec/v0.2.md` on `dev`, §3.2, §3.4 (addressing), §3.5 and §3.6 (plan approval on the desktop); `docs/spec/v0.1.2.md` §3.3 and §3.8 to §3.11; `docs/spec/v0.1.md` §3.4, §3.10, §3.11, §3.13 and §3.15.
- Map M-399 and the tickets this epic absorbs: Q-404 (the Main board, P4 to P9, and the reaction that made Board, Graph and Plan views of Items), Q-405 (the prototype's tree and card).
- Research: `research/web-prior-art` (`docs/research/web-prior-art.md` §7.1: the peek, the palette, bulk actions on selected rows).
- Prototype: `prototype/web-shell` (`web/PROTOTYPE.md`; `web/src/explorer.ts`, `summary.ts`, `items/ItemsArea.tsx`, `items/Tree.tsx`, `items/Card.tsx`; `web/proto/model.test.ts`, `web/proto/summary-lua.test.ts`).
- Mockups: `docs/design/web/Main.dc.html` and `screens/v02-main.png`; the v0.1.2 boards in `docs/design/main-screen/` (Explorer, ExplorerEpic, Categories, CardEpic, CardTask) and the v0.1 plan boards (PlanBefore, PlanMidway).
- GLOSSARY: Explorer, Card, Summary, Category, Unscheduled, Plan, Stage, Criterion.

## Plan

```yaml
stages:
  - name: tree, card and layout
    qa:
      scope: affected
      when: after-stage
    lanes:
      - - T-1071
        - T-1073
      - - T-1072
  - name: views and messages
    qa:
      scope: affected
      when: after-stage
    lanes:
      - - T-1074
        - T-1095
      - - T-1075
        - T-1076
  - name: plan and edits
    qa:
      scope: affected
      when: after-stage
    lanes:
      - - T-1077
      - - T-1078
```

## Comments

### qa-676 · 2026-10-22T04:08:33.370Z

verdict: qa
result: clear
by: qa-676 [qa]
run: qa-s1-2026-10-22-1
commit: a0ab98362a9c34e7cefd4660ca62d9c264a3fcbc
stage: tree, card and layout
stage_hash: 0945450af3ed6b60700b632e6ed35cfe4c086ca81e9fa6cedf1e02cfbabe99a9
findings: [{"severity":"low","text":"Request/brief scope mismatch resolved by Coordinator 6479acd9: case25 has no sign-in grant and is out of scope. Original BLOCKED recorder line retained historically; no sign-in attempted and no PASS claimed.","file":"qa/briefs/E-416-stage-1.md"}]
finding_counts: {"high":0,"medium":0,"low":1}

| Case | Result | Evidence |
|---|---|---|
| E416S1-00 | PASS | A-8889 report and per-case captures |
| E416S1-01 | PASS | A-8889 report and per-case captures |
| E416S1-02 | PASS | A-8889 report and per-case captures |
| E416S1-03 | PASS | A-8889 report and per-case captures |
| E416S1-04 | PASS | A-8889 report and per-case captures |
| E416S1-05 | PASS | A-8889 report and per-case captures |
| E416S1-06 | PASS | A-8889 report and per-case captures |
| E416S1-07 | PASS | A-8889 report and per-case captures |
| E416S1-08 | PASS | A-8889 report and per-case captures |
| E416S1-09 | PASS | A-8889 report and per-case captures |
| E416S1-10 | PASS | A-8889 report and per-case captures |
| E416S1-11 | PASS | A-8889 report and per-case captures |
| E416S1-12 | PASS | A-8889 report and per-case captures |
| E416S1-13 | PASS | A-8889 report and per-case captures |
| E416S1-14 | PASS | A-8889 report and per-case captures |
| E416S1-15 | PASS | A-8889 report and per-case captures |
| E416S1-16 | PASS | A-8889 report and per-case captures |
| E416S1-17 | PASS | A-8889 report and per-case captures |
| E416S1-18 | PASS | A-8889 report and per-case captures |
| E416S1-19 | PASS | A-8889 report and per-case captures |
| E416S1-21 | PASS | A-8889 report and per-case captures |
| E416S1-22 | PASS | A-8889 report and per-case captures |
| E416S1-23 | PASS | A-8889 report and per-case captures |
| E416S1-24 | PASS | A-8889 report and per-case captures |

Low finding: request 939dac5d initially required E416S1-25 BLOCKED; Coordinator correction 6479acd9 restores the committed brief's Out of scope. E416S1-25 is out of scope: no human grant to sign the cland QA profile in to the live hub. Original blocked record remains unchanged as historical evidence, excluded from this verdict scope. No product failure observed.

Fresh local macOS arm64 checks: 56/56 targeted tests pass, no skips; serial, isolated HOME/XDG/Git, system TMPDIR, credential filter, browser census 0→0. Build/typechecks/tier lint pass. Graph differential covers 1092 copied items/67 container graphs. DOM plant rejected document with TS2584 exit1, restored clean. Model-only rebuild samples 0.1–0.4 ms for 300 items exclude transport/React. Chrome cland QA anonymous cases pass; matching source stamps, Offline, filters/folds persist, independent client defaults, 22 help rows, group card boundary/split/close; restored page state and closed owned tab. Probe errors (stale AX id; unsupported shift+/ spelling corrected to question keysym) retained separately, not product failures.

Coordinator covers at same full SHA/tree16bac2b0: Linux 468f6bae A-8883, shard logs A-8884/A-8885, 3682 pass/8 skip/0 fail; local macOS 6143d5e7 A-8887, 3690 pass/no skips. Both check/T1–T3/T4 base/Web executed, T4 extra repetitions skipped; lint/budgets/ratchet report-only. Linux x64 droplet 2 workers, run wall1053.328s, cost$0.1344125: shard1 cland-v0-90e45f3d run939.960s/lifetime927.449s/$0.06440618; shard2 cland-v0-e3ffcabd run1015.960s/lifetime1008.091s/$0.07000632; both released. macOS arm64 2 workers run1211.542s, remote cost N/A. Node24.21.0/Neovim0.12.5. Measured run walls distinguished from projected tier budgets and lease lifetimes.

HEAD=dev=request and clean before/after; stage cover complete. No epic criterion marks. Evidence A-8889: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-8889-e-416-stage-tree-card-and-layout-at-a0ab9836-24-pass-signed-in-case-out-of-scope/report.md

### coord · 2026-10-22T06:45:25.677Z

Stage "views and messages" QA run qa-s2-2026-10-22-1 at dev 918951c2 (qa-676, evidence A-8971): 23 checks PASS and E416S2-23 FAIL (medium). In real Chrome at the unchanged window size, the Items help dialog's last two rows (A, Enter) stay below the visible window after scrolling. 74/74 targeted tests passed. The verdict was not recorded: the hub refused it because T-1095, the fix for this finding, had already been added to the stage by the Coordinator before the verdict ("all stage items must merge onto dev before stage QA"). That was the Coordinator's ordering error, not QA's, and the stage stays open either way. A fresh run follows after T-1095 lands.
