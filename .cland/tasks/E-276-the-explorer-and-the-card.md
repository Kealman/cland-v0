---
id: E-276
kind: epic
title: The explorer and the card
state: open
labels:
  - epic
  - v0.1.2
  - ready-for-agent
assignee: null
parent: R-228
blocked_by:
  - E-275
  - E-269
topic: null
branch: null
created: 2026-10-12T11:35:14.567Z
updated: 2026-10-13T20:54:29.660Z
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

- [ ] The explorer is the centre outline tree of §3.8: the roots, the rows per level, rank then close order, the folds, `s` with breadcrumbs and `␣␣`, `D` and `A` kept in `ui.json`; `␣e` opens it, it is the centre at startup, and `gi` opens it on the item.
- [ ] The card shows what §3.9 lists, from the hub's fields without a `task view` per row, with the summary rule and its provenance line, the Decision block and `zb`; `gI` keeps the v0.1 item view.
- [ ] The explorer changes nothing by hand; `m` and `M` send the message with the item context, and a selection goes to General with one line per item.
- [ ] The categories root shows its counts, the top three, "N more", the done count `D` hides and the idle-work mark.
- [ ] The items panel at release scope lists the epics as folded rows with done/total and the breakdown, with "Direct tasks (N)" after them.
- [ ] Done nodes and rows are in the done colour with the green glyph everywhere, and container nodes in the graph carry done/total and the count in work.
- [ ] Live updates keep the cursor on its item and redraw only on a visible change; a tree of 300 items builds in under 15 milliseconds.
- [ ] `nvim/README.md`, the Coordinator's clause (the messages the explorer sends it) and the help lines describe the explorer and the card.

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
