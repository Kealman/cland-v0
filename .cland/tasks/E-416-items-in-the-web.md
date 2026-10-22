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
updated: 2026-10-22T14:14:16.828Z
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
        - T-1097
        - T-1102
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

### qa-676 · 2026-10-22T10:22:03.157Z

verdict: qa
result: clear
by: qa-676 [qa]
run: qa-s2-2026-10-22-2
commit: 7887f694ace91db414735b9af93ab20bedbc8c45
stage: views and messages
stage_hash: 261f8b285d4e0f13697d92f47a06bcb6807509147c14f4da28108753aac42e70
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

| Case | Result | Observation |
| --- | --- | --- |
| E416S2-00 | PASS | HEAD/dev equal S and clean; all six stage merges and ten files exist. Full fixtureEnvironment after overlays, 37 inherited names removed, credential-prefix count 0; system TMPDIR retained. |
| E416S2-01 | PASS | Web build exit 0; source digest e1fef2bb4cf8aaaf0735df6c5097ce7abcf52dc1383709e90755cc73080e052e; clean tree. |
| E416S2-02 | PASS | 7/7 action tests pass; three selected items sent once to the fake Coordinator in General; seven fixture censuses after 0. |
| E416S2-03 | PASS | Action test confirms missing item topic created once and two messages persisted with correct attribution. |
| E416S2-04 | PASS | Scope/back/closed-link ancestor test passes; screenshot shows T-900012 below unfolded C-900010/E-900011 and matching card. |
| E416S2-05 | PASS | Delayed-link navigation and non-first Board/Graph selections pass; later navigation supersedes lookup. |
| E416S2-06 | PASS | Tracker summary 12/12 and item summary 10/10 pass, including compact by-id rows and bounded large pages. |
| E416S2-07 | PASS | Board 4/4 pass; screenshot confirms authoritative 2/9 progress, status groups, blocked/next marks; census after 0. |
| E416S2-08 | PASS | Board scope/filter/selected-task round trip passes in E416S2-07. |
| E416S2-09 | PASS | Board inert rank/move test passes; static draggable/onDrag/task.rank/task.move grep has no matches. |
| E416S2-10 | PASS | Graph 4/4 pass; screenshot shows closed 1/1, 0 in work, check glyph; open 1/6, 4 in work and routed edge; census after 0. |
| E416S2-11 | PASS | Graph shared scope, filter, selection, card and Tree round trip passes in E416S2-10. |
| E416S2-12 | PASS | Token guard clean exit 0; planted colour refused exit 1 at ItemsGraph.module.css:16; checkout restores 0 changed paths. |
| E416S2-13 | PASS | Tree 8/8, card 6/6 and order 1/1 pass; all 12 fixture censuses after 0. |
| E416S2-14 | PASS | Shell 9/9, palette 11/11 and connection 4/4 pass. Both complete help-scroll viewport cases pass; 32-key marker count 1; four fixture censuses after 0. |
| E416S2-15 | PASS | Keymap 1/1; listeners only keyboard.ts; bindings only keymap.ts/keyboard.ts; storage only interface-state plus reload guard; no manifest/lock changes. |
| E416S2-16 | PASS | Typecheck, colour/contrast/hooks guards and tier lint exit 0; six classifications correct. Board 9.7 s allowance confirmed as report-only. |
| E416S2-17 | PASS | Twenty documentation markers each 1 and 15 key rows; surrounding README Items tree/views and hub by-id paragraphs have no observed contradiction. |
| E416S2-18 | PASS | Committed brief lint passes exit 0. |
| E416S2-19 | PASS | Both Coordinator stage covers green at S; stage plan lists all six merged items and cover complete at tree 49f40ab16197e914336f63b7a3999bf31b2c28a7. |
| E416S2-21 | PASS | Live index/stamp 200, tested/live/root source digests equal, hub code diff empty. Anonymous cland QA profile shows Offline, Items Tree, disabled Plan, Items breadcrumb, three folded roots and no card. |
| E416S2-22 | PASS | Board/Graph/Tree share D filter. Graph survives reload. Isolated second client starts Tree with null items record, Offline, off-origin 0 and owned process census after 0. |
| E416S2-23 | PASS | All 32 key labels present, exactly one Esc row and no rank/move action. At unchanged window size, scrolling shows the complete final Enter row inside the dialog; Escape closes it. |
| E416S2-24 | PASS | Offline root chords s,x,m,Shift+M,Space Space,gs,gt,gi preserve Unscheduled focus/fold with no composer/card/alert or browser chrome action; Escape focuses rail Items. Defaults restored and own tab closed. |

**Clear: all 24 scoped cases PASS.** Stage `views and messages`; no epic criterion marks. Findings: none.

Run **qa-s2-2026-10-22-2** at **7887f694ace91db414735b9af93ab20bedbc8c45** on a clean detached worktree. Dev remained at that SHA. Six merged stage items: T-1074, T-1095, T-1097, T-1102, T-1075 and T-1076. The printed plan governs the count. This is a fresh run; the earlier qa-s2-2026-10-22-1 evidence A-8971 remains historical, with no verdict retry.

77/77 targeted tests across 12 files passed locally on macOS arm64, Node v24.21.0, using pinned Chrome Headless Shell where applicable. Zero failures, cancelled tests or skips. These are targeted files, not a full suite. The palette total is now 11 (the new parent and two small-viewport subtests); tracker-summary totals 12 with parameterized expansion. Build, typecheck including colour/contrast/hooks guards, tier lint and brief lint pass. The colour plant failed as expected and was reverted. The brief-authorized root node_modules symlink supplied the prerequisite's fixed relative path; no dependency install or product fix.

Native computer use inspected only http://127.0.0.1:56935/ in the existing cland QA Chrome profile, normal HOME/keychain, anonymously. The live and tested bundle sources digest is e1fef2bb4cf8aaaf0735df6c5097ce7abcf52dc1383709e90755cc73080e052e; hub-code diff empty. Final help row is visibly complete, not just present in the accessibility tree. Native JPEGs and fixture PNGs are unedited. Shared-filter screenshots were supplemented after the initial AX captures; a stale native element-id error during restoration changed no product result, and a fresh AX read supplied the valid control. No window resize, sign-in, live write, settings/profile/keychain/layout change. Signed-in live-data checks remain out of scope, as the brief says.

Isolation: full fixtureEnvironment after scratch overlays; 37 inherited names removed, credential-prefix count 0, disposable HOME/XDG/Git configuration, system TMPDIR. Targeted files ran serially after the local queue was quiet. All 25 Web fixture census lines end `after 0; scratch hub stopped`; second client group 32927 ends after 0. Tree/Items defaults, folded roots, Done shown/Archive hidden, one unfolded Inbox and unchanged rail restored; only the opened QA tab was closed. Clean-tree receipt retained. Scratch removal is recorded in cleanup.txt; evidence stays durable.

Existing Coordinator stage covers at the same full S (verification tree 49f40ab16197e914336f63b7a3999bf31b2c28a7), with check/typecheck and T1, T2, T3, T4 base and Web completed:

- Linux droplet df7383e5-83bc-4b0e-821c-0ac075464999, A-9079; 3732 tests, 3724 passed, 8 platform skips, 0 failed. Linux x64 6.8.0-142-generic, Node v24.21.0, Neovim v0.12.5, two shards. Web 11 files / 27 tests. Queued 09:47:40.879Z to finished 10:07:23.696Z: **1182.817 s queued-to-finish wall**.
- Shard 1 A-9080: cland-v0-b8140030, c-8 lon1; admission-to-remote-finish 1160.28 s; lifetime 1144 s; $0.0795.
- Shard 2 A-9081: cland-v0-2ae4caec, c-8 lon1; admission-to-remote-finish 988.27 s; lifetime 974 s; $0.0676. **Total droplet cost $0.1471.**
- Local macOS 309b6c7a-cbe2-4d28-b1da-02ed7484d9a9, A-9083; 3732/3732 passed, no skips, darwin arm64, Node v24.21.0, Neovim v0.12.5, workers 2. Web 11 files / 27 tests. Queued 09:47:48.056Z to finished 10:08:16.277Z: **1228.221 s queued-to-finish wall**; cost not applicable.

T4 repetitions were skipped by the load gate; its 10 files ran in base phase only. Test lint, budgets, duration allowances and T3 ratchet are report-only. Projections are not measured wall times and are not claimed as timing passes. No full suite submitted by QA. Full merged/shard logs remain in their durable artifacts; cover-reports.json preserves hub results.

Rule proposal: real-browser help acceptance must demonstrate that the final row is visibly reachable at the unchanged window size; accessibility counts alone are insufficient. This run establishes both.

Evidence: A-9085 — /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-9085-e-416-views-and-messages-at-7887f694-24-pass-final-help-row-visible/report.md

### qa-676 · 2026-10-22T13:36:47.456Z

verdict: qa
result: clear
by: qa-676 [qa]
run: qa-s3-2026-10-22-1
commit: fae121eca210c1385acac6e9b1e30c89c5e8f469
stage: plan and edits
stage_hash: 2adbddb318afb7170589c8b378fc98c43d4eb7664a55d52871c5f03880a714cd
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

# E-416 stage “plan and edits” — QA clear

Run: `qa-s3-2026-10-22-1`. Tested commit: `fae121eca210c1385acac6e9b1e30c89c5e8f469`.
Request: `da87febe-9de1-46c0-98b8-8bc3c2dd5904`, topic-830. Brief: `qa/briefs/E-416-stage-3.md` at that commit; affected, after-stage. Stage members T-1077 and T-1078 are both merged/done. The first two stages are closed; the stage cover is complete at verification tree `88cf98d0372e397bd63410e1409aaa75528eb63c`.

All 22 scoped cases PASS. Thirteen targeted files ran serially on local macOS arm64 with Node v24.21.0: 69 tests, 69 passed, zero failures/cancelled/skipped/todo. Web behavior used Chrome Headless Shell with fixture-owned sealed scratch hubs; real-browser checks used native computer use in the existing Chrome cland QA profile, anonymous on the allowed local page, without resizing, zooming, changing layout or settings. Source stamp `2e0b568b9e2effa9ea7ed972d535d5a22cc7915845d27a0cc9e224a71a908c29` matches the live edge, root bundle and detached build; hub-code diff is empty.

## Case table

| Case | Result | Observation |
|---|---|---|
| E416S3-00 | PASS | HEAD=dev=S; clean detached tree; both landings and required files present. System TMPDIR retained; full fixtureEnvironment applied after overlays: 37 inherited names removed, credential-prefix count 0 before scratch launch. |
| E416S3-01 | PASS | Sealed npm run build --workspace web exit 0; source stamp 2e0b568b9e2effa9ea7ed972d535d5a22cc7915845d27a0cc9e224a71a908c29; index, one JS and one CSS asset; tracked changes 0. |
| E416S3-02 | PASS | plan.test.ts 4/4; C1 human approval and CLI receipt, closed member by-id summaries, discussion routing and Plan facts. Screenshot inspected. Owned census 1/0. |
| E416S3-03 | PASS | C2 passed: shared mark advances on entry, visit highlights preserved, subsequent visit consumes changes. CSS watch token at ItemsPlan.module.css:11,23. |
| E416S3-04 | PASS | C3 passed: approval absent/inert at 1279 and 390, restored at 1280; desktop human approval succeeds. |
| E416S3-05 | PASS | item-criteria.test.ts 4/4: add/edit/remove preserve stable ids, removed id never reused, invalid prefix retains draft, external update preserves another draft, legacy rows readonly until assignment. Owned census 1/0. |
| E416S3-06 | PASS | Criteria C2 passed: exactly one done frame attributed to human without as field; disabled done action; CLI readback. |
| E416S3-07 | PASS | Criteria C3 passed: other fields readonly, e outside criteria inert; screenshot shows one-line C1/C2/C3 fields and human done attribution. |
| E416S3-08 | PASS | Read/write frame inventory matches brief; task.plan only show/approve; discussion to lead exactly once; criterion ops add/edit/remove/done; no as; both tooltips present. |
| E416S3-09 | PASS | Board 4/4, graph 4/4, item actions 7/7; Plan enabled; all nine owned fixture census lines after 0. |
| E416S3-10 | PASS | Items 8/8, card 6/6, order 1/1, folds 6/6; all 13 owned fixture census lines after 0. |
| E416S3-11 | PASS | Shell 9/9, palette 11/11, connection 4/4; all 33 help rows exercised at 1280 x 720 and 1024 x 600, physical Cyrillic chords, reconnect/build guard; four censuses after 0. |
| E416S3-12 | PASS | Token guard clean exit 0; two planted values rejected exit 1 at ItemsPlan.module.css:30 and ItemCriteria.module.css:9; both restored; changed paths 0. |
| E416S3-13 | PASS | web-keymap.test.ts 1/1; key listeners only keyboard.ts; codes keymap/keyboard; preference storage interface-state, reload guard connection; no changed manifest/lock. |
| E416S3-14 | PASS | Typecheck/tier lint exit 0; colour/contrast/hooks guards pass. Web plan/criteria/palette and T1 keymap classifications correct. Allowances 8.2/17.3/7.5 s, E-880, added 2026-10-22/expires 2026-10-29; duration lines report-only, no timing pass asserted. |
| E416S3-15 | PASS | 23 present checks 1, two absent checks 0,16 README key rows. Read surrounding Tree/Views/Plan and criteria docs; no contradiction found. |
| E416S3-16 | PASS | Committed stage brief QA lint passes, exit 0. |
| E416S3-17 | PASS | Printed plan: first two stages closed; plan and edits has T-1077 and T-1078, both merged/done. Stage cover complete at tree 88cf98d0372e397bd63410e1409aaa75528eb63c; Linux A-9163 and macOS A-9168 green, Web executed. |
| E416S3-21 | PASS | Native Chrome cland QA anonymous Offline; index/stamp 200; live/root/tested source digests equal, hub-code diff 0 bytes. Tree pressed; Board/Graph/Plan enabled; one Items breadcrumb, three folded roots, no card. |
| E416S3-22 | PASS | Native Plan empty heading correct; a/d inert; reload preserves Plan. Isolated second client starts Tree with items-record-before null, writes only its own {"view":"tree"}; Plan no buttons, no writes/alerts;1279 help 15,1280/1440 help 16; off-origin 0; owned census after 0. |
| E416S3-23 | PASS | Native Plan help 16 rows, one Esc, shared 14 plus Approve a and Discuss d; no Tree keys. Scroll screenshot shows final Discuss plan with Lead d fully visible; Escape closes. |
| E416S3-24 | PASS | Native Tree help 33 entries, Edit criteria e follows Message item topic; no Plan actions, one Esc. Final Enter row fully visible after scroll. Root e/a/d inert; Escape focuses Items rail. Inbox/Tree/folds/filters restored, own tab closed. |

## Findings, ranked by severity

High: none. Medium: none. Low: none. No product fix, probe correction or repeat was needed. The intentional colour plants failed as expected, were restored, and are not product failures. Browser screenshots substantiate final-row reachability rather than relying solely on AX counts. Plan help showed the desktop 16-row variant; no CSS width was directly measured in native Chrome. The isolated client explicitly checked 1440, 1279 and 1280 px.

## Scope and marks

Signed-in real Chrome checks are out of scope because there is no human grant. No live approval, discussion, criteria edit, cookie minting or sign-in occurred. The brief assigns these behaviors to sealed fixture tests with CLI readbacks, which passed. Phone behavior and the 1279/1280 boundary are proven in fixtures; native window size/zoom remained unchanged. This is a stage verdict, not an epic DoD verdict; no epic criterion marks are submitted.

## Stage-cover receipts

These are the Coordinator's existing stage runs at the full tested SHA, not new QA suites. Both executed check plus T1, T2, T3, T4 base and Web. T4 load repetitions were skipped; they are not claimed as run or passed. Projection and report-only budget output is not an enforced timing pass.

- Linux: `fbbc8898-9835-4498-9ff9-a9fb995e6287`, merged [A-9163](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-9163-suite-fbbc8898-9835-4498-9ff9-a9fb995e6287-all-at-fae121e.log), shards [A-9164](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-9164-suite-fbbc8898-9835-4498-9ff9-a9fb995e6287-shard-1-at-fae121e.log) and [A-9165](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-9165-suite-fbbc8898-9835-4498-9ff9-a9fb995e6287-shard-2-at-fae121e.log). Droplet Linux x64 6.8.0-142-generic, Node v24.21.0, Neovim v0.12.5, two shards, workers 2. Exit 0: 3742 total, 3734 passed, 8 skipped, 0 failed/cancelled/todo. Web: 13 files, 29 reported tests, executed. Shard 1 machine cland-v0-f7c170fd (c-8 lon1): admission-to-remote-finish 1128.10 s, lifetime 1122 s, cost $0.0780, collection 29.77 s. Shard 2 cland-v0-3ce8249e (c-8 lon1): 1025.10 s, lifetime 1018 s, cost $0.0707, collection 27.14 s. Merged measured overall wall 1158.36 s, total cost $0.1486 (hub rounding retained).
- macOS: `1077c4a3-d20c-4cf7-b56a-3e94955a7df7`, [A-9168](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-9168-suite-1077c4a3-d20c-4cf7-b56a-3e94955a7df7-all-at-fae121e.log). Local darwin arm64, Node v24.21.0, Neovim v0.12.5, workers 2. Exit 0: 3742/3742 passed, none skipped/failed/cancelled/todo. Web: 13 files, 29 reported tests, executed. Reported phase elapsed durations T1 31 s, T2 177 s, T3 921 s, T4 48 s, Web 27 s. No consolidated total-wall/cost field in the cited local receipt; neither is represented as zero. Queue timestamp 13:01:16.218Z to artifact creation 13:21:40.127Z is 1223.909 s of receipt turnaround, not an execution-only wall measurement.

Both report 132 test-lint findings in 59 files and two missing duration baselines in report-only mode. T3 projected wall exceeds its report-only budget. Linux Web measured phase wall 44.916 s exceeds the report-only 40 s budget; local Web phase wall 24.947 s. Existing dated allowances at S: Plan 8.2 s, criteria 17.3 s, palette scroll 7.5 s, owner E-880, added 2026-10-22, expires 2026-10-29. This stage makes no performance pass claim from these lines. Full original receipts are in cover-receipts.json and the linked immutable logs.

## Isolation, cleanup and evidence

Full fixtureEnvironment applied after overlays, scratch HOME/XDG/Git, inherited Git overrides removed, system TMPDIR retained; credential-prefix count 0 before launching any scratch process. Native browser kept normal HOME/keychain solely for the granted page. Fixture outputs contain 28 owned browser census lines after 0 and scratch hubs stopped; the independent second client also reports after 0. Final pid/ppid/pgid/basename census confirms all 29 owned groups absent. Scratch root removed; plants restored; detached HEAD and dev still equal S, tracked changes 0. Native tab closed after restoring Inbox, Tree view, folded roots, Done shown, Archive hidden and the original rail state; the original New Tab remains.

The evidence directory retains exact commands, stdout/TAP logs, screenshots, AX captures, test-summary.txt, cleanup.txt and 22 recorder lines. Generated environment exports are not published. No fixes or live tracker data mutations were made by test commands.

Rule proposal sent to Coordinator: conditional shared shortcuts should pair positive fixture receipts with inert checks in the wrong view, without a selected item, and below their action-width boundary.

Durable evidence: A-9175 — /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-9175-e-416-plan-and-edits-at-fae121ec-22-pass-plan-and-criteria-receipts/report.md
