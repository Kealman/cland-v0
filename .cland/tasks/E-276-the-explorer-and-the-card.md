---
id: E-276
kind: epic
title: The explorer and the card
state: closed
criterion_seq: 8
plan_approval:
  hash: 7d9178add3203769d0cd6ca9bc615859816dc47c7f1ca41d6ea7c4e7d2711567
  by: human
  at: 2026-10-13T20:55:30.341Z
labels:
  - epic
  - v0.1.2
  - ready-for-agent
assignee: null
parent: R-228
blocked_by:
  - E-275
  - E-269
topic: topic-254
branch: null
created: 2026-10-12T11:35:14.567Z
updated: 2026-10-14T18:49:07.602Z
closed: 2026-10-14T18:49:07.602Z
---

## Goal

The human studies and plans the work in an explorer in the centre of the workbench: an outline tree of the release, its epics and tasks, with categories, unscheduled items and other releases as further roots, and the card of the row under the cursor beside it. The explorer edits nothing by hand; its one action is a message to the Coordinator about an item or a selection. Today the side panel shows status in real time, and the item view shows the agents' Markdown body.

## Contents

- **§3.8 The item explorer**, whole:
  - **Form and keys.** An outline tree in the centre with in-place folding; the root is the current release, with folded roots for the categories, the unscheduled items and the other releases; `l` and `h` unfold and fold (with `za`), `j` and `k` move over the visible rows; the card follows the cursor and Enter moves the focus into it; `s` rebases the tree on a node with breadcrumbs in the winbar, and `␣␣` goes back. `␣e` opens the explorer; it is the centre view at startup when nothing else is open; `gi` opens it with the card on the item, replacing the item view. The board (`␣b`), the graph (`␣G`) and the plan view (`gp`) stay.
  - **Rows.** A release row: the version, epics done/total, the status breakdown. An epic row: tasks done/total, the in-progress, review and qa counts as a compact bar, the stage in work, the lead. A task row: the status glyph, the id, the title, the claim or holder, the latest verdict with its round, the criteria fraction. Live items in rank order and done items after them in the order they closed, in the done colour; `D` hides done items in the whole tree, kept in `ui.json`.
  - **Read-only.** The explorer edits nothing by hand. `m` sends to General with the item context riding along; `M` creates the item's topic when it has none and sends there; on a visual selection both go to General, with the scope and one line per item (id, kind, status, container, rank, title). The board's rank keys and the plan approval (`gp`) stay as they are.
  - **The accepted mockups (P1 to P22) and the prototype's answers**: an epic's glyph and status from its tasks and a release's from its epics; one bar cell per child in status order; the lead column reading the Coordinator while `leads` is empty; an epic with a plan grouping its live tasks under one label per stage and its done tasks under one "done" label; "Direct tasks (N)" folded after a release's epics, also when the release has no epics; "Other releases" listing open releases and `A` toggling the archived roots; maps under Unscheduled; the card taking the right panel's place when the centre is narrow; the header's done count for the current scope; messages naming items by their display id once the migration has run; `l` on a leaf focusing the card, `h` going to the parent, `s` on a leaf scoping to its container; the v0.1 item view on `gI` and in the palette; the model rebuilt on every hub event and redrawn only on a visible change, under 15 milliseconds for a tree of 300 items.
- **§3.9 The item card and the summary**: the summary from a `## Summary` section or, when it is missing, the fallback refined by T-258 (the first section that is not Parent, Notes, Sources, References, Acceptance criteria or Definition of done; its first prose paragraph without its leading provenance sentences, or its first list item; two whole sentences and 50 words at most), run on the parsed body, with the dimmed provenance line; the facts (status, layer, labels, size, the parent path, lead, claim, holds, the ordinal within the container, the raw rank only when set by hand); the progress (the children's breakdown for a container, the criteria with their marks for a task); the plan stage for an epic; the latest verdict with its one-line reason, its round and its scope; blocked by, blocks and `regression_of`; the branch and the latest `cland verify` result for a task; created, updated and the last activity (the later of `updated` and the topic's latest message, naming which); the Decision block; the agents' text behind `zb`, with its sections and size on the fold line; a container's glyph, status line and layer from its children, its claims and holds from its tasks, and its latest verdict and last activity from its subtree; Enter focuses the card, whose header lists its keys, and `h` or `␣␣` returns to the tree.
- **§3.10 Categories, the Neovim side**: the categories as a root section with counts; an unfolded category shows its top three items by rank, then "N more", with its open count and how many done items `D` hides; a category named in `idle_from` carries an "idle work" mark; promotion is a message to the Coordinator.
- **§3.11 The side panel at release scope**: the items panel lists the release's epics as folded rows with done/total and the status breakdown, in rank order; an unfolded epic shows its status sections as the epic scope does; the epic tab row stays for narrowing to one epic; direct tasks sit under a folded "Direct tasks (N)" row after the epics.
- **§3.3 Done items distinct from backlog** (T-242): a done node keeps a readable title, with a green filled glyph and the title in the done colour `#98bfa2`, not the backlog grey, and no strikethrough; container nodes in the graph carry done/total of their children and the count in work; the same rule for done rows in the items panel and on the board.

Not in this epic: the hub's fields that the card reads ("Status, fields and instrumentation"); the category kind, the prefixes and `idle_from` ("Prefixes and categories"); search and filter inside the explorer, and lazy folds for large trees, which the map left in the fog.

Choices where the spec is silent:

- The prototype's code on `prototype/explorer` (`explorer.lua`, `explorer_card.lua`, `explorer_summary.lua` and its edits marked `-- prototype`) is ported slice by slice, never merged: the `CLAND_EXPLORER` flag goes, and so do the stand-ins its `-- choice:` notes name (an open root epic standing in for a category, `updated` as the closing time, the connect-time `suites` snapshot); the card reads the hub's fields instead.
- The summary rule runs in Neovim on the body the workbench already holds, as the prototype's port of the research script does; the hub does not compute it.
- The card's width, the default folds, the order in which columns drop and the bars' scale are the prototype's: 42 percent of the explorer between 36 and 72 columns, the release open one level, a category open on its top three, columns dropped right to left, bars proportional past 16 cells.
- The explorer's folds, scope, `D` and `A` live under an `explorer` key in `ui.json`, which the workbench now keeps.
- The plan approval: `[plan] approval` is a project-wide setting in `config.toml`, and §4 wants `human` for this epic only. The project stays at `none`; the Coordinator writes this epic's plan with the `plan-epic` skill, asks the human to approve it in the plan view (`gp`, then `a`), and launches no Implementer under this epic until `cland task plan show` reads it approved by the human.

## Tracer-bullet order

1. **The tree and the card from the prototype.** The explorer and a first card, ported from `prototype/explorer` behind no flag: `␣e`, the centre at startup, `gi` on the card, the rows per level, rank then close order, `l`, `h`, `za`, `j`, `k`, `s` with breadcrumbs, `␣␣`, `D` and `A`. Demo: the headless workbench at 200x50 opens on `R-228` with its epics, and the card follows the cursor.
2. **The card in full.** The summary with its provenance line, the facts, the progress, the plan stage, the latest verdict with its round, reason and scope, the relations with `regression_of`, the branch and the latest verify, the dates and the last activity, the Decision block, `zb`, the focus keys, and the card over the right panel when the centre is narrow. Demo: the card of a task filed after "Status, fields and instrumentation" shows its size, its `regression_of` and its latest `cland verify` result without a `task view` per row.
3. **The messages.** `m` to General with the context, `M` into the item's topic (created when it has none), and a visual selection to General with one line per item, naming items by their display ids. Demo: `V` over three rows and `m` sends one message to General naming the three items by their display ids, as the Coordinator receives it.
4. **The roots.** The categories root with its counts, top three and "N more", the idle-work mark from `idle_from`, Unscheduled with the maps, and Other releases with `A` for the closed ones. Demo: with `idle_from = ["C-216"]`, the Categories root shows Tech debt with its idle-work mark and its top three tasks.
5. **The side panel at release scope.** The items panel lists the release's epics as folded rows with done/total and the breakdown, unfolds them into status sections, keeps the epic tab row, and ends with "Direct tasks (N)" and the count line. Demo: the items panel at `R-228` lists the release's epics in rank order with their fractions.
6. **Done distinct.** The done colour and the green glyph on done nodes and rows in the graph, the items panel and the board, and container nodes in the graph carrying done/total and the count in work. Demo: `␣G` on `R-228` shows a closed epic in the done colour with its full fraction, and an open one with its count in work.
7. **Live and fast.** The model rebuilt on each hub event with redraws only on a visible change, the cursor kept on its item, `gI` and the palette for the v0.1 item view, and a bench over 300 items. Demo: a status change on a visible task moves its row while the cursor stays on its item, and the bench reports under 15 milliseconds.

## Definition of done

QA runs the demo below on `dev`, playing the human's part through the `cland` CLI and a headless workbench (one `nvim --headless` process, keys by `nvim_input`, the screen read with `screenstring()`), and records a clear verdict on this epic with each checkbox verified by its id; the epic then closes. The human does not run this demo (D16 and D19 of v0.1 §4).

In a scratch project holding a copy of the live tracker and the fake harnesses, QA opens the workbench headless at 200x50: the explorer is the centre, rooted at the current release, with its epics, their bars and stages, and the folded roots. QA moves with `j` and `k`, unfolds an epic with `l`, scopes to it with `s` and comes back with `␣␣`, and hides done items with `D`; focuses the card with Enter and reads the summary, the facts, the criteria, the latest verdict and the branch and suite block; opens the agents' text with `zb`. QA selects three rows with `V`, presses `m`, and reads the one message in General with one line per item; `M` on an item without a topic creates the topic and sends there. QA reads the Categories root with Tech debt's idle-work mark, the items panel at release scope with the epics as rows, and the graph with done nodes in the done colour; `gI` still opens the v0.1 item view. On the live tracker, `cland task plan show` on this epic reads approved by the human.

- [ ] C1. The explorer is the centre outline tree of §3.8: the roots, the rows per level, rank then close order, the folds, `s` with breadcrumbs and `␣␣`, `D` and `A` kept in `ui.json`; `␣e` opens it, it is the centre at startup, and `gi` opens it on the item.
  - verified: qa-27 [qa] · run qa-2026-10-14-27-10 · 2026-10-14T18:48:44.267Z · commit 5663ed12f5667be2a5d84330e9e4f3ad690dd86a
- [ ] C2. The card shows what §3.9 lists, from the hub's fields without a `task view` per row, with the summary rule and its provenance line, the Decision block and `zb`; `gI` keeps the v0.1 item view.
  - verified: qa-27 [qa] · run qa-2026-10-14-27-10 · 2026-10-14T18:48:44.267Z · commit 5663ed12f5667be2a5d84330e9e4f3ad690dd86a
- [ ] C3. The explorer changes nothing by hand; `m` and `M` send the message with the item context, and a selection goes to General with one line per item.
  - verified: qa-27 [qa] · run qa-2026-10-14-27-10 · 2026-10-14T18:48:44.267Z · commit 5663ed12f5667be2a5d84330e9e4f3ad690dd86a
- [ ] C4. The categories root shows its counts, the top three, "N more", the done count `D` hides and the idle-work mark.
  - verified: qa-27 [qa] · run qa-2026-10-14-27-10 · 2026-10-14T18:48:44.268Z · commit 5663ed12f5667be2a5d84330e9e4f3ad690dd86a
- [ ] C5. The items panel at release scope lists the epics as folded rows with done/total and the breakdown, with "Direct tasks (N)" after them.
  - verified: qa-27 [qa] · run qa-2026-10-14-27-10 · 2026-10-14T18:48:44.268Z · commit 5663ed12f5667be2a5d84330e9e4f3ad690dd86a
- [ ] C6. Done nodes and rows are in the done colour with the green glyph everywhere, and container nodes in the graph carry done/total and the count in work.
  - verified: qa-27 [qa] · run qa-2026-10-14-27-10 · 2026-10-14T18:48:44.268Z · commit 5663ed12f5667be2a5d84330e9e4f3ad690dd86a
- [ ] C7. Live updates keep the cursor on its item and redraw only on a visible change; a tree of 300 items builds in under 15 milliseconds.
  - verified: qa-27 [qa] · run qa-2026-10-14-27-10 · 2026-10-14T18:48:44.268Z · commit 5663ed12f5667be2a5d84330e9e4f3ad690dd86a
- [ ] C8. `nvim/README.md`, the Coordinator's clause (the messages the explorer sends it) and the help lines describe the explorer and the card.
  - verified: qa-27 [qa] · run qa-2026-10-14-27-10 · 2026-10-14T18:48:44.268Z · commit 5663ed12f5667be2a5d84330e9e4f3ad690dd86a

## Dogfooding

The explorer becomes the human's daily view of the build as soon as its first slice merges: the release, its epics and their stages, the categories that collect what the crew finds, and a card for each item; the human steers with `m` instead of opening item files. The plan of this epic waits for the human's approval, as §4 decided.

## Constraints

- **Standing rules.** Every artifact, item, commit and doc in English. Sub-agents never use the hub: the cland tools belong to the session that started them. Only `cland release` pushes to GitHub: commit on the task branch `t/<id>-<slug>` in its worktree, push it to `origin`, the local territory, and reach `dev` only through `cland merge` and its verdict gate. Suites run through `cland verify`. Tests go through the hub's frame protocol first (a real hub, a real spoke, the CLI against a temporary project; `hub/test/harness.ts`) and the fake harnesses in `hub/test/fakes/` second, with the Neovim UI headless from the protocol's other side (`nvim/test` on the stub hub, QA cases in `qa/cases/`); no new seams inside the hub. The DigitalOcean token is never stored. Accounts are never rotated.
- **Precedence.** The spec's words, then the prototype on `prototype/explorer` (`nvim/EXPLORER-PROTOTYPE.md`: keys, choices, measurements, the recorded screen), then the boards Explorer, ExplorerEpic, Categories, CardEpic and CardTask, as the design README orders them. The prototype is a reference, never merged.
- **Prior art.** `docs/research/explorer-prior-art.md` on `research/explorer-prior-art`: render from the model with the folds keyed by item id and Vim folds off, restore the cursor by identity with a fixed fallback, debounce the card about 100 milliseconds.
- **ADRs.** 0005 (Neovim is the host): the explorer and the card are buffers drawn from the item model, with no plugins. 0006 (The hierarchy is the item tree).
- **Risks.** The model is rebuilt on every hub event, so at ten times today's items a per-subtree check or lazy folds would be needed (the prototype's point 19); the card must not cost a hub request per cursor move.
- **Order.** Last in the Neovim lane: it waits for "Sessions: stopped sessions, verifiers' items, the queue line" and for "Prefixes and categories". Its second slice also needs the hub's fields from "Status, fields and instrumentation", which has no blocking edge to this epic; the Coordinator orders that slice after it lands. "Release v0.1.2 from the item" waits for this epic.

## Links

- Spec: `docs/spec/v0.1.2.md` on `dev`, §3.3, §3.8, §3.9, §3.10, §3.11; `docs/spec/v0.1.md` §3.11 to §3.15 (the panels, the keys, the plan view and the graph it sits beside).
- Tickets: T-243, T-244, T-237 and T-242 (decided, closed into this epic) and T-245 (its Neovim side); the map T-264 with T-258, T-259, T-260, T-262 and T-263.
- GLOSSARY: Explorer, Card, Summary, Category, Unscheduled.
- ADRs: `docs/adr/0005-neovim-is-the-host.md`, `docs/adr/0006-the-hierarchy-is-the-item-tree.md`.
- Branches: `prototype/explorer` (`nvim/EXPLORER-PROTOTYPE.md`, `nvim/lua/cland/explorer.lua`, `explorer_card.lua`, `explorer_summary.lua`, `nvim/test/explorer.test.ts`), `research/explorer-prior-art` (`docs/research/explorer-prior-art.md`).
- Mockups: `docs/design/main-screen/Explorer.dc.html`, `ExplorerEpic.dc.html`, `Categories.dc.html`, `CardEpic.dc.html`, `CardTask.dc.html`; `screens/v012-explorer.png`, `v012-explorer-epic.png`, `v012-categories.png`, `v012-card-epic.png`, `v012-card-task.png`.

## Plan

```yaml
stages:
  - name: the tree, the done colour and the hand rank
    qa:
      scope: none
      when: after-stage
    lanes:
      - - T-350
        - T-351
      - - T-357
        - T-358
      - - T-353
  - name: the card
    qa:
      scope: none
      when: after-stage
    lanes:
      - - T-352
        - T-354
  - name: messages, roots, live and startup
    qa:
      scope: none
      when: after-stage
    lanes:
      - - T-355
        - T-356
        - T-359
```

## Comments

### coord · 2026-10-13T20:54:23.245Z

Decision (stand-in, D24, 2026-10-13 ~20:33Z, lane flow): unlinked from E-270. All of E-270's code is merged (T-328 to T-334, stages closed); only its QA demo remains, and it runs on a frozen dev. This epic's first stage starts after the 21:05Z hub restart in parallel with that demo. Its merges onto dev wait for E-270's QA verdict, so the verdict sits on the dev tip.

### coord · 2026-10-13T20:54:29.660Z

Stand-in approval under D24 (2026-10-13 ~20:55Z): the ten tickets T-350 to T-359, the three-stage plan and the Coordinator's recommendations Q1–Q13 (drafts' NOTES) are approved as written. Q1: the startup view lands last, in T-359. Q2: only gi routes to the explorer. Q3: T-353, the hand-rank flag. Q4: a loose suite bench plus the 15 ms check on the dev machine. Q5: M on a closed item without a topic points to m. Q6: topic title '<id> <title>'. Q7: epic rows only under board. Q8: stage via cached plan.get. Q9: trim the V selection to 8192 bytes. Q10: card over the right panel below 80 columns. Q11: unresolved-closed items sort first among done by updated. Q12: 'no open release'. Q13: commit counts are out of scope. Added at approval: the card shows the human's picture first and folds the agents' text (§3.9, T-244); see T-352 C9 and T-354 C11. The plan file reads approval not required, so the stand-in records the human approval with task plan approve.

### human · 2026-10-13T20:55:30.859Z

Plan approved by the human's stand-in under D24 (2026-10-13 ~21:15Z): the ten tickets, three stages and Q1-Q13 match the accepted explorer prototype and spec 3.8-3.9; human-picture-first is T-352 C9 and T-354 C11.

### qa-27 · 2026-10-14T18:48:44.268Z

verdict: qa
result: clear
by: qa-27 [qa]
run: qa-2026-10-14-27-10
commit: 5663ed12f5667be2a5d84330e9e4f3ad690dd86a

| Case/check | Result | Observation |
|---|---|---|
| M0 | PASS | Pinned build; all children merged/closed; human plan approval. |
| M1 | PASS | Node 24.21.0, pinned Neovim; queue/load/lock baseline recorded. |
| M2 | PASS | Explorer 19/19. |
| M3 | PASS | Card 15/15. |
| M4 | PASS | Summary 1/1. |
| M5 | PASS | Compose 9/9; merged T-411 regression green. |
| M6 | PASS | Roots 8/8. |
| M7 | PASS | Release board 4/4. |
| M8 | PASS | Graph 3/3 and items 1/1, sequential. |
| M9 | PASS | Criteria freshness 1/1. |
| M10 | PASS | Rank 5/5. |
| M11 | PASS | Roles/clause 2/2. |
| M12 | PASS | 300-item unfolded build median 6.1055 ms <15 ms. |
| EXPLORER-001 / M13 | PASS, amended | Original and diagnostic FAIL visible coord retained; width-dependent lead omission accepted. M16 covers every assertion after coord. T-436. |
| EXPLORER-002 | PASS | Catalogue case, exit 0. |
| PANELS-013 | PASS | Catalogue case, exit 0. |
| PANELS-014 | PASS | Catalogue case, exit 0. |
| ITEMS-002 | PASS | Catalogue case, exit 0. |
| GRAPH-001 | PASS | Catalogue case, exit 0. |
| M14 | PASS, amended | 434 copied items stable; private lock and budget 2→1; human-only delivery filter excludes role clause. Original BLOCKED retained. |
| M15 | PASS | Normal-mode explorer startup at R-228; 95 done; card width 62. |
| M16 | PASS, amended | Rank/close order, fractions, folded direct tasks, done colour; lead conditional on width. |
| M17 | PASS | j/k/counts, l/h/za, zR/zM. |
| M18 | PASS | Epic/leaf/virtual scopes and cursor-preserving back. |
| M19 | PASS, amended | Unfold C-216 before more; top three, six more, 14 hidden done, idle mark, archive and card links. Original FAIL retained. |
| M20 | PASS | Summary/fallback, facts, criteria, verdicts, relations, Decision, plans, focus/body fold; 20j fetches only rested T-355 once. |
| M21 | PASS, amended | Card replaces right panel, edge 200; saved preference retained; Esc leaves General composer before global shortcut. Original FAIL retained. |
| M22 | PASS | Release items panel, epic/direct folds, status sections, tabs, category count. |
| M23 | PASS, amended | Exactly six sends/one created topic/no tracker writes; 8192 bytes,37 complete rows+148 omitted=185; separate live initial-footer check. |
| M24 | PASS | gi reveals without changing saved folds; gI/palette retain legacy item view. |
| M25 | PASS | Graph/board/panel done titles #98bfa2, green glyph, no strike. |
| M26 | PASS | Hidden burst renders206→216 with tree67/card86 writes unchanged; visible change tree68; same-timestamp marks refresh once; reparent fallback. |
| M27 | PASS | Whole435-item scratch bench; view restored. Corroboration, not 300-item gate. |
| M28 | PASS | Clean restart preserves scope E-386, D/A, and release fold. |
| M29 | PASS after doc fix | Original README inventory FAIL retained; 5663ed12 adds one row; all doc counts ≥1 and clause counts exactly1. |
| M30 | PASS | Scratch hub/workbench/drivers stopped; no shared suite lock path. |
| M31 | PASS | Live T-347 passed suite; E-276 human approval and three closed stages. |
| M32 | PASS | Guarded mirror root connected; mark_read patched before keys. |
| M33 | PASS | Live explorer matches JSON:6/10 epics,89/105 tasks,correct order/colour. |
| M34 | PASS | Live T-347 suite/review/merged time and E-276 stage times/approval match JSON. |
| M35 | PASS, amended | 26 read audit calls; account startup reads allowed; guard retained,live ui checksum unchanged,all QA processes gone. |

Findings by severity

High: none. Medium: none.

Low — M29, nvim/README.md module inventory: `grep -c -F explorer_compose.lua nvim/README.md` initially returned 0. The Coordinator fixed it in **5663ed12f5667be2a5d84330e9e4f3ad690dd86a**, exactly one file and one added line. M29-amended reran every documentation grep, all ≥1. Resolved in this pass; original FAIL kept.

Low — EXPLORER-001 catalogue expectation, **T-436**: the unchanged 200x50 case and one authorized diagnostic run both stop at `visible coord`. The tree has 85 content columns; nvim/lua/cland/explorer.lua:397–402 omits lead below118. README says columns drop from the right as the centre narrows. Q10 relocates the card only below80 tree columns. Product behavior is correct; the Coordinator accepted the expectation amendment. Original and diagnostic FAIL records and screens are retained. **M16 explicitly covers every assertion after coord:** live rank order, closed-after-live order, direct tasks initially folded, Cl and done title colour, wrap=false, foldenable=false, action registry audit=[]; M17 additionally exercises fold keys. No expectation/size/key was changed in the diagnostic case.

Build and scope

Code tested at **878d70e7731bd9ec63c02170284d98147f5c8c8a**, run **qa-2026-10-14-27-10**, plus diagnostic segment **qa-2026-10-14-27-10-diag**. Verdict at **5663ed12f5667be2a5d84330e9e4f3ad690dd86a** after the authorized one-line README fix. Final diff excludes tracker/briefs and the authorized planning-doc paths (docs/spec/v0.1.3.md, docs/spec/v0.2.md, GLOSSARY.md); the sole additional difference is that exact README line. No hub/Neovim source changed. Root tracked modifications are tracker-only. The task initially had eight positional criteria; map by the brief's text to C1–C8.

68 targeted tests in M2–M11 plus M12's one bench test passed, zero failing/skipped; one file at a time beside the Coordinator-authorized local holder. Five catalogue cases passed directly. EXPLORER-001 passes by the authorized width amendment and explicit manual coverage above. No full suite or droplet was started by QA.

Bench evidence

M12 on ten CPUs, load21.03/17.48/16.33, holder impl-429 (human interactive workbench also recorded): as-drawn336 rows model6.755416/draw2.092375 ms; **unfolded338 rows model6.1055/draw2.071125 ms**; card39 rows model0.3185/draw0.080666 ms. The brief explicitly passes under15 even on a loaded machine. M27, the entire435-item scratch tracker after the probe: as-drawn38 rows model5.1695/draw0.260292; unfolded494 rows model30.447375/draw3.65075; card90 rows model1.797125/draw0.545583 ms. Load11.26/12.79/14.86. M27 has no15ms bound; cursor/card/folds/filter preferences were restored.

Brief amendments and deviations

- Request: targeted files may run one at a time alongside the local holder; no30-minute wait. Allowed planning/tracker commits do not change the tested code. T-411/T-376 are merged fixes.
- EXPLORER-001/M16: lead visibility depends on available width (Coordinator18:25:32 and18:29:18Z). Original failures remain; T-436 tracks the catalogue fix.
- M14: filter delivery observations by `meta.from_kind === 'human'` so the Coordinator role clause's `from the explorer` text is not counted (18:30:50Z). Ready driver now count0. No expectation changed.
- M19: select C-216 and press l before examining its children/more; zM had folded it (18:34:55Z). Repeat a–c in amended evidence; original missing-row FAIL retained.
- M21: Esc before global shortcuts from General's insert-mode composer (18:37:09Z); original failed readiness checks retained.
- M23: a bare card.lua call passed an empty filename and raised E482. Explicit filenames are used thereafter. The Coordinator required a separate live observation: topic-less E-386 shows `M creates E-386's topic`, its M composer says created on send, Esc cancels, delivery count remains6 (18:39:38Z). No seventh message or extra topic.
- M29: Coordinator's exact one-line README fix5663ed12 allowed through the code gate and documentation check repeated (18:43:36Z).
- M35: add account.list/account.poll, the workbench's own accounts startup calls, to the read allowlist (18:45:56Z). Full26-line audit retained.
- Two long shell pastes were abandoned before execution because of shell quoting/continuation; short sourced helper scripts performed the checks. No product changes were made by QA.

Safety and live evidence

Scratch project used its own lock_path and local executor; budget2 correctly capped to1. No harness sessions or droplets launched. M23 workbench audit has exactly6 topic.send and1 topic.create with no tracker writes; all sends confined to scratch. Live mirror root used CLAND_COMMAND=false and patched mark_read before keys, and at teardown patched=true/reads=0. Live ui.json SHA-1 stayed **b4d7a325b6ade97404881b772ee52cc1adcbd293**. Live audit contains reads only under amended allowlist; no topic/inbox/visibility/tracker/session writes. T-347 suite3e038535-69e8-421c-a8b5-3fa3fecf22e7 passed at f238d824616860c44cc0166d87c7f59207fe6e27, review round14/evidence. E-276 shows all3 stages closed with displayed latest-child times01:06,03:11,16:22 and human approval2026-10-13T20:55:30.341Z. Scratch and mirror nvim exited normally; hub/drivers stopped; private scratch paths removed after captures. Queue/locks belong to crew runs and were never acquired or modified by QA.

Criterion marks

C1 verified: M2, EXPLORER-001 amended/M16 complete coverage, M15–19,M24,M28,M33. C2 verified: M3–4,M10,GRAPH-001,M20–21,M24,M34. C3 verified: M5,M11,M23. C4 verified: M6,EXPLORER-002,M19,M26d. C5 verified: M7,PANELS-013/014,M22. C6 verified: M7–8,EXPLORER-001 amended,ITEMS-002,GRAPH-001,M16,M19e,M25,M33. C7 verified: M2,M9,M12,ITEMS-002,M26–27. C8 verified: M11,M29-amended.

Result: clear, all eight criteria verified in this run after the recorded amendments and documentation fix. Original failures and diagnostic segment are retained without rewriting their runs.jsonl records.


Evidence: [A-2521 full run folder](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2521-e-276-qa-full-evidence-qa-2026-10-14-27-10/README.md). Earlier diagnostic snapshot: A-2507. Raw case/manual records are in runs.jsonl; commands, screens, state, helpers and audits are in the folder. Credential scan: 351 files, zero DigitalOcean token-pattern matches.

Verdict note: [A-2522](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2522-e-276-qa-clear-cases-amendments-benchmarks-and-findings.md).

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified, C6 verified, C7 verified, C8 verified.
