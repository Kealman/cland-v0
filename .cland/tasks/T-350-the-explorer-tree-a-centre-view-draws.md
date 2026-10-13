---
id: T-350
kind: task
title: "The explorer tree: a centre view draws the current release as an outline of its epics and tasks, with the rows per level, live items by rank and done items in closing order, and the folded roots"
state: closed
status: done
size: L
criterion_seq: 8
labels:
  - v0.1.2
  - nvim
  - ready-for-agent
assignee: null
parent: E-276
blocked_by: []
topic: topic-217
branch: t/T-350-the-explorer-tree-a-centre-view-draws
created: 2026-10-13T20:53:51.399Z
updated: 2026-10-13T21:52:03.804Z
closed: 2026-10-13T21:52:03.804Z
---

## Summary

A new centre view, the explorer, draws the current release as an outline tree from the items the workbench already holds. Each level has its row: the release with its epics' bar, an epic with its tasks' bar, counts, stage and lead, and a task with its claim, verdict and criteria fraction. `␣e` and `:Cland explorer [id]` open it. The folds, the keys and the card come in the next tickets.

## Parent

E-276: The explorer and the card, tracer bullet 1 (first half). Spec: `docs/spec/v0.1.2.md` §3.8 (Form, Rows, the accepted mockups P1 to P22, the prototype's answers) and §3.3. Prototype: `prototype/explorer` (`nvim/EXPLORER-PROTOTYPE.md`, `nvim/lua/cland/explorer.lua`). Prior art: `docs/research/explorer-prior-art.md` on `research/explorer-prior-art`. ADR 0005 (Neovim is the host), ADR 0006 (the hierarchy is the item tree). GLOSSARY: Explorer, Unscheduled, Category.

## What to build

**Port, never merge.** Port the model, rows, paint and render parts of the prototype's `explorer.lua` into a new `nvim/lua/cland/explorer.lua` on a branch from `dev`. Leave out every prototype stand-in:

- no `CLAND_EXPLORER` flag and no `-- prototype` markers;
- no `M.norm`, `M.did` or title stripping: since T-314 every item id carries its kind's prefix and any prefix resolves;
- no open root epic standing in for a category: categories are a kind (`items.is_category`, T-315);
- no `updated` as the closing time: the summary carries `closed` (T-330);
- no criteria fraction from `task.view`: the summary carries `criteria` counts (T-330).

The prototype's base is 28 Neovim commits behind `dev`, so the port is by hand against today's `items.lua`, `vboard.lua`, `plan.lua`, `layout.lua` and `views.lua`.

**The view.** A centre view kind `explorer`, `{ kind = 'explorer', id = <scope key or nil> }`.

- `views.lua`: `placeholder`, `render_placeholder` and `title` dispatch to the explorer.
- `layout.lua`: `centre_opts` sets `wrap = false` for it.
- `bars.lua`: the context line (`Explorer · R-228 0.1.2 Working with items`), the winbar head (`EXPLORER <scope>` and the done count of the current scope, see below) and the status-line hint.
- The buffer's `vim.b.cland_role` is `explorer`.
- `␣e` (global, `<leader>e`, not taken today) and `:Cland explorer [id]` open it. The id may use any prefix. The view's `id` is a scope key; the root view has none.

**The model.** `explorer.index()` is built once per render from `state.S.items` and `state.S.sibling_orders`:

- items by id;
- children per parent, sorted with `items.compare_rank` and the final sibling order of rank events, as `items.children` sorts them, without `items.children`'s scan per node.

A container is a level kind or a map (`items.is_container`), or any item with children.

**Derived status (P2).** A container has no status of its own (v0.1 §3.2).

- Closed: `done`, glyph ● in green.
- Any task under it in progress, review, qa or ready: `in work`, ◐ in teal.
- Else any planned: `planned`, ○ in the text colour.
- Else `backlog`, ○ dim.

An epic derives from its tasks. A release derives from its epics, or from its direct tasks when it has no epic. A question or spec reads `done` when closed and `backlog` when open.

**Ordering.** Inside a container the live items come in rank order. The done items follow in the order they closed, by `closed`. An item closed before T-330's backfill without a `closed` time sorts first among the done items, by `updated`. The `## Notes` of the item record that fallback.

**The roots.**

- The current release, `items.scope()` climbed to its open release-kind ancestor, else `items.default_release()`, opens one level by default.
- Then three folded roots: `Categories (N)`, `Unscheduled (N)` and `Other releases (N)`. In this ticket each unfolds to plain item rows: the open categories, the open root items that are neither releases nor categories, and the open releases other than the root. Ticket T-356 gives them their counts, top three, idle-work mark and archive.
- A release's direct tasks sit under a folded `Direct tasks (N)` row after its epics. This holds also when the release has no epics (the prototype's answer 1).
- With no open release, for example a ladder of `["epic"]` in a QA fixture, the explorer shows `no open release` and the folded roots.
- While `task.list` has not answered, it shows `loading the items…`.

**Rows per level** (the mockups, the prototype's columns):

- A header row of column names. Then rows of left chunks (fold glyph, status glyph, id, title) and right columns.
- **Release row.** The version and title (`items.display_title`) and epics done/total. Its bar has one cell per epic in status order. Two label rows follow: the tasks done/total with one cell per task (at most 48, proportional past that), and the count per status in words (`2 in progress · 18 backlog`).
- **Epic row.** Tasks done/total. A bar with one cell per task in status order, proportional past 16 cells. The in-progress, review and qa counts in their own columns (◐, `rev`, `qa`). The stage in work (`S2`), from `require('cland.plan').get(epic)`: one `task.plan show` per visible epic, cached, as the items panel's stage tags already do. The lead: the claim when its role is `lead`, else the Coordinator's name (`state.coordinator()`) while `leads` in crew.toml is empty. A done epic shows `closed <when>` in place of the stage and the lead.
- **Task row.** The status glyph, with ◌ for an unstarted task with an open blocker, as the board draws it. The id and the title. The claim, or the verifier's hold while in review or qa, as `vboard.who` decides. A done row shows `merged <when>` from `closed`. A blocked row shows `blocked by <ids>`. Then the latest verdict of each kind, with its round when it is not the first or not clear (`✗ review r2`). Then the criteria fraction verified/total from the summary's `criteria`.
- **Bar cells.** done ■ green, ready □ green, qa and review ■ amber, in progress ■ teal, planned □ dim, backlog ■ dark (`ClandCellBacklog`, `#3d4756`). Status order: done, ready, qa, review, in progress, planned, backlog.
- **Done rows.** The green ● and the title in the done colour `ClandDone` (`#98bfa2`, §3.3), with no strikethrough. If ticket T-357 has not landed, add `ClandDone` to `hl.lua` exactly as 08 specifies (in `TWINS`). Whichever ticket merges second drops the duplicate line.
- **An epic with a plan** groups its live tasks under one label row per stage: `S<n> <name>  <closed | in work | planned | backlog> · <merged> of <n> merged · <qa policy>`. Tasks the plan does not name follow under `not in the plan`. The done tasks follow under one `✓ done  in the order they closed` label. Stage states come from `plan.get` (closed epics report every stage closed, T-328).
- **Narrow widths.** Columns drop right to left as the tree narrows (lead, counts, stage, role word, verdict), at the prototype's widths 118, 96 and 74.

**Rendering** (prior art):

- Vim folds stay off. The fold state is a table keyed by item id or virtual key (`:categories`, `:unscheduled`, `:releases`, `:direct:<id>`), in memory in this ticket.
- The buffer is rewritten only when its text or highlights differ from what is drawn.
- The cursor is captured by row key before a rewrite and put back on the same key, else the first row. Ticket T-359 adds the full fallback order.
- Rows are painted with extmarks in one namespace.
- The render runs from `layout.render` through `views.render_placeholder`, so it is already coalesced once per tick by `state.changed`.

**Keys in this ticket.** Plain `j` and `k` move the cursor. `za` toggles the fold of the row under the cursor through the action registry. The rest is ticket T-351.

**Docs.** `nvim/README.md` gains an "Explorer" section: the view, the roots, the rows per level, the ordering, the stage groups and the done colour. The Modules list names `explorer.lua`. `M.HELP` in `init.lua` gains an Explorer line. `␣?` lists `␣e` through the registry.

**Demo** (the epic's tracer bullet 1). The headless workbench at 200x50 on a stub hub holding a copy of R-228's shape: `␣e` shows R-228 with its epics in rank order, a closed epic after them in the done colour, the epics' bars, counts, stages and leads, `Direct tasks (N)` folded, and the three folded roots.

**Out of scope.**

- The fold keys `l`, `h`, `zo`, `zc`, `zR` and `zM`, the moves `j` and `k` over label rows, `s` and `␣␣`, `D`, `A` and ui.json (ticket T-351).
- The card (tickets T-352 and 05). The messages (ticket T-355).
- The roots' counts, top three, `N more`, idle-work mark and maps (ticket T-356).
- The startup centre and the bench (ticket T-359). `gi` (ticket T-352).
- Search, filter and lazy folds (the map's fog).

**Constraints.**

- Neovim is the host, with no plugins (ADR 0005). The explorer is a buffer drawn from the item model.
- Tests run headless on the stub hub (`nvim/test/stub-hub.ts`) through the frame protocol. One `nvim --headless` process per test via `startClient`. Keys go through `nvim_input` (`c.input`), and the screen is read with `screenstring()` (`c.screen`, `c.waitScreen`). Resize to 200x50 with `nvim_ui_try_resize` as `criteria.test.ts` does.
- New tests go in `nvim/test/explorer.test.ts`. Add one catalogue case, `qa/cases/EXPLORER-001.lua` (stub hub): `␣e` shows the release, its epics and the folded roots.
- Tests wait on state, never on a sleep. Every key goes through the action registry (`nvim/lua/cland/actions.lua`).
- No hub request per row. The only requests are `task.plan show` once per visible epic, cached by `plan.get`, as today. No `task.view` for a row.
- The explorer edits nothing by hand (§3.8).
- A Neovim-only delta needs `npm run test:nvim` green. Suites run through `cland verify`, only after a clear source review and at the exact reviewed head (D25), and only when `cland verify queue --json` shows no holder.
- Commit on the task branch and push it to `origin`. `dev` is reached only through `cland merge`. Everything is in English.

## Acceptance criteria

- [x] C1. `␣e` and `:Cland explorer` open the explorer in the centre. `:Cland explorer E-2` (any prefix) opens it scoped to that item. The top bar, the context line and `␣?` name it.
  - done: impl-350 · 2026-10-13T21:10:22.076Z
  - verified: rev-23 [reviewer] · run rev-2026-10-13-350-3 · 2026-10-13T21:51:41.210Z · commit 45e032e8fdc4ae9c2e29892dbb431a9e3571c764
- [x] C2. On a stub fixture with a release, three epics (one closed), tasks in every status, a category and an unscheduled item, the screen shows the release row with epics done/total and its two label rows, the epics in rank order with the closed one last in the done colour, each epic's bar, counts, stage and lead, `Direct tasks (N)` folded, and `Categories`, `Unscheduled` and `Other releases` folded.
  - done: impl-350 · 2026-10-13T21:04:56.923Z
  - verified: rev-23 [reviewer] · run rev-2026-10-13-350-3 · 2026-10-13T21:51:41.211Z · commit 45e032e8fdc4ae9c2e29892dbb431a9e3571c764
- [x] C3. A task row shows its claim, the reviewer's hold while in review, `merged <when>` from `closed` when done, the latest verdict with its round, and verified/total from the summary's `criteria`. The test checks that no `task.view` frame reached the stub hub while the tree was drawn.
  - done: impl-350 · 2026-10-13T21:04:57.314Z
  - verified: rev-23 [reviewer] · run rev-2026-10-13-350-3 · 2026-10-13T21:51:41.211Z · commit 45e032e8fdc4ae9c2e29892dbb431a9e3571c764
- [x] C4. An epic with a plan groups its live tasks under one label per stage with the stage's state and merged count, and its done tasks under one `done` label in the order of their `closed` times.
  - done: impl-350 · 2026-10-13T21:04:57.847Z
  - verified: rev-23 [reviewer] · run rev-2026-10-13-350-3 · 2026-10-13T21:51:41.211Z · commit 45e032e8fdc4ae9c2e29892dbb431a9e3571c764
- [x] C5. A container's glyph derives from its children: ◐ with a task in review, ○ in the text colour with only planned tasks, ● green when closed. A release with no epic derives from its direct tasks.
  - done: impl-350 · 2026-10-13T21:10:23.668Z
  - verified: rev-23 [reviewer] · run rev-2026-10-13-350-3 · 2026-10-13T21:51:41.211Z · commit 45e032e8fdc4ae9c2e29892dbb431a9e3571c764
- [x] C6. A second render with no visible change does not rewrite the buffer. The test counts buffer writes through `nvim_buf_attach` `on_lines` or a render counter. `za` on an epic unfolds it with the cursor kept on the epic.
  - done: impl-350 · 2026-10-13T21:04:58.715Z
  - verified: rev-23 [reviewer] · run rev-2026-10-13-350-3 · 2026-10-13T21:51:41.211Z · commit 45e032e8fdc4ae9c2e29892dbb431a9e3571c764
- [x] C7. At 120 and 80 columns the right columns drop right to left and no row wraps.
  - done: impl-350 · 2026-10-13T21:04:59.344Z
  - verified: rev-23 [reviewer] · run rev-2026-10-13-350-3 · 2026-10-13T21:51:41.212Z · commit 45e032e8fdc4ae9c2e29892dbb431a9e3571c764
- [x] C8. `nvim/README.md` (Explorer section and Modules), the help line and `qa/cases/EXPLORER-001.lua` describe and exercise the view.
  - done: impl-350 · 2026-10-13T21:05:00.094Z
  - verified: rev-23 [reviewer] · run rev-2026-10-13-350-2 · 2026-10-13T21:12:26.130Z · commit 45e032e8fdc4ae9c2e29892dbb431a9e3571c764
  - verified: rev-23 [reviewer] · run rev-2026-10-13-350-3 · 2026-10-13T21:51:41.212Z · commit 45e032e8fdc4ae9c2e29892dbb431a9e3571c764

## Comments

### impl-350 · 2026-10-13T21:02:39.738Z

Implementation notes: the explorer uses summary criteria/closed fields and cached task.plan show, never task.view per row. Legacy closed items without closed sort before resolved closing times using updated, with rank as a stable tie-breaker. Added the headless frame/screen tests, README Explorer section and EXPLORER-001 catalogue case; targeted explorer tests are green. Full verification follows source review.

### coord · 2026-10-13T21:07:24.427Z

Coordinator decision (2026-10-13 21:07Z, asked by rev-23): the header's done count covers the current scope only (§3.8). At scope nil that is the release named in the winbar, counting its descendants. Categories, Unscheduled and Other releases are separate roots with their own counts (T-356), and after s the count follows the scope node. The prototype's whole-outline count diverged from the spec. A test asserts that a done item in a category leaves the header count at release scope unchanged.

### rev-23 · 2026-10-13T21:08:38.928Z

verdict: review
result: not clear
by: rev-23 [reviewer]
run: rev-2026-10-13-350-1
commit: eb734e6706ca8b9edf116f0632149cbe56dd895a
scope: full

Medium — nvim/lua/cland/explorer.lua:130: literal release checks break configured root selection/derived status and fail the existing container-source guard; centralize hub-ladder root selection and add coverage. Medium — nvim/lua/cland/explorer.lua:683: nil-scope done count includes categories/unscheduled/other releases; Coordinator e438215c requires only the named release subtree, with an unrelated done-item regression. C1/C5 failed. Remaining full source checks found no other blocker; corrected head requires review before suite. A-2065: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2065-t-350-full-source-review-configured-roots-and-scoped-done-count.md.

Criteria: C1 failed (Literal release checks miss configured roots, and nil-scope header counts unrelated roots instead of the named release subtree (Coordinator e438215c).), C5 failed (Derived release handling uses a literal kind, so configured roots derive from the wrong child set when direct tasks coexist with containers.).

### rev-23 · 2026-10-13T21:12:26.130Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-2026-10-13-350-2
commit: 45e032e8fdc4ae9c2e29892dbb431a9e3571c764
scope: full

No remaining high or medium findings. Configured root handling is centralized in a hub-ladder predicate; nil-scope done count is restricted to the release subtree per Coordinator e438215c. Dedicated configured/direct-task and unrelated-done-item regressions cover the fixes. Full preceding review A-2065 remains applicable. C8 verified; C1–C7 await exact-head complete Neovim verification. A-2069: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2069-t-350-corrected-full-source-review-at-45e032e.md.

Criteria: C8 verified.

### rev-23 · 2026-10-13T21:51:41.212Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-2026-10-13-350-3
commit: 45e032e8fdc4ae9c2e29892dbb431a9e3571c764
scope: evidence

No high or medium findings. Exact-head full cland verify 35cdd40c / A-2094 passed typecheck and all 1854/1854 tests across three phases, with zero failures/cancellations/skips/todo. Explorer fixtures and real-hub entry, summary-only rows, stage ordering, configured roots, scoped counts, no-op writes, fold cursor and narrow layouts all pass. Source review A-2069 remains applicable. C1–C8 verified. A-2095: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2095-t-350-final-exact-head-evidence-review.md.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified, C6 verified, C7 verified, C8 verified.

### coord · 2026-10-13T21:52:03.804Z

Merged cc823753c97d3ce3ddf3dbd46993ec84804d6917 onto dev.
