---
id: T-99
kind: question
title: "Workbench panels: vertical board, session groups, the palette"
state: closed
labels:
  - wayfinder:prototype
assignee: null
parent: T-81
blocked_by:
  - T-88
  - T-94
topic: null
branch: null
created: 2026-10-09T19:09:50.900Z
updated: 2026-10-09T20:50:26.068Z
---

## Question

Do the three panel changes work in practice: the items panel as a vertical board, the sessions panel grouped by state with stopped sessions folded, and `␣p` as the command palette?

## Context

Settled while charting (map Notes): the sessions panel groups waiting, busy, idle and folds stopped; `␣p` becomes one palette over objects and actions with prefixes. The status ticket defines the sections of the vertical board (in progress, review, QA, next planned; done hidden; scoped to the open parent; rank visible and movable); visibility levels say what each panel shows by default. Today the items panel is an always-expanded tree in id order with five filters, the sessions panel lists every session in three lines, and the picker covers four kinds without actions.

## Prototype

Canvas mockups first for the two panels and the palette (three artboards). Then branch `prototype/panels` (never merged) on real data: the items panel sections with rank moves, the sessions groups with fold and unfold, and the palette with registered actions and prefixes, built on Neovim's fuzzy matching. The human uses it for a working session and says what works.

Resolve with the human's reaction: the panel sections, the keys and the palette's action list for the spec, recorded as a comment with the branch and canvas links.

## Comments

### human · 2026-10-09T20:31:02.415Z

Prototype ready for a working session: branch `prototype/panels` at 896fa01 (two commits, f1cdbe2 and 896fa01, on `dev`'s ab2e68c; pushed to `origin`, the local territory; never merged). It is the real plugin with the three changes, on real hub data: `task.list`, `task.view`, the `task` event, `session.list`, `hub.status`, `inbox.list`.

## Try it against the live hub

From the main worktree, with the hub running (it is):

```sh
git worktree add --detach ../v0-panels prototype/panels
../v0-panels/nvim/bin/cland-nvim .
```

That runs the branch's workbench on this project and its hub (found through `.cland/hub.json`), with the pinned Neovim already in the main worktree's cache. The only file it writes is `.cland/scratch/panels-prototype.json` (ignored by git), on the first rank move or epic pick. Afterwards: `git worktree remove ../v0-panels`. The keys are in `␣?` and in the branch's `nvim/README.md`, section "Prototype T-99".

## 1. Items panel: the vertical board (`␣i`)

```
 ▾ T-19 Epic: cland v0… 41/47 done
 IN PROGRESS · 1
 ◐ T-104 Concurrent … 0/3 impl-104
 REVIEW · 0
 QA · 0
 READY · 0
 PLANNED · 0

 ▸ backlog (5)
 ▸ unscheduled (11)
```

(today's tracker at 160 columns; the top bar reads `release T-19 Epic: cland v0 slice 1, the…`)

- Scoped to the current release. The tracker has no release kind, so an open epic stands in: the one picked with `e` (next) / `E` (previous), else the open epic with the lowest id (T-19 today, the only open one). Its name is in the top bar; its line counts the done tasks, which are otherwise hidden.
- Sections IN PROGRESS, REVIEW, QA, READY, PLANNED with their counts, empty ones included; then `▸ backlog (n)` and `▸ unscheduled (n)`, folded. Unscheduled is every open item whose parents reach no open epic (no parent, under a map, or under a closed epic), indented under its open parents. Today that is T-81 and its ten open questions. With no open epic at all, the board lists the unscheduled items unfolded.
- A row: the glyph (`◐` in progress, `◉` review or qa, green `◉` ready, `◔` planned, `○` backlog; `◆` needs you and `◌` blocked over any status), the id and the title. Then, on the right: verified/total on tasks in work, the claim or the verdict mark (`✓rev`, `✗qa`; a grey check is a stale verdict, one the hub marks `current: false`), and the ask badge.
- Keys:
  - `J` / `K` move the item below / above its next sibling (same parent) in its section.
  - `za`, `Tab` or `↵` on a fold line folds or unfolds it; `zo` and `zc` too; `zR` / `zM` act on all folds.
  - `↵` on a row opens the item view; `gi` `gt` `gs` are unchanged.
  - `2`–`6` are the v0 views (all, in work, needs you, done, map); `1` is the board; `f` / `F` cycle the views.
- The cursor stays on its item when a redraw moves rows.

Status derivation (`vboard.lua`, `M.status`). It reads what `board.lua` reads today (state, claim and its role, assignee, labels, verdicts in file order); the first rule that matches wins:

1. closed → done
2. claimed by a session holding reviewer → review
3. claimed by a session holding qa → qa
4. the latest verdict of either kind not clear → in progress (board.lua put a not-clear review in review; §3.2 sends it back)
5. the latest review verdict clear: stale (`current: false`) → review; label `qa-required` and no clear, fresh QA verdict → qa; else → ready
6. label `qa` → qa
7. label `review` → review
8. claimed (an Implementer, or any other session) → in progress
9. assigned → planned
10. otherwise → backlog

Needs you (an open ask in its topic, or its latest review or QA verdict not clear) and blocked (an open blocker) are glyphs over any status, not statuses.

## 2. Sessions panel: groups (`␣s`)

- Groups, each with its count:
  - YOURS: no crew role, or a name starting with `aide`. Hidden when empty.
  - WAITING, BUSY, IDLE. A live session in state unknown goes under IDLE.
  - One folded `▸ stopped (n)` line (stopped and dead sessions, newest first) that `za`, `Tab` or `↵` unfolds.
- One line per session: glyph, `name [Role]`, its item. The session under the cursor is marked `▎` and gets a second line: harness, model, state (with `(heuristic)`), usage. That line wraps onto two when the panel is narrow.
- `j` / `k` step from session to session over that second line. The selection stays on its session when a redraw moves it (a state change, the stop question).
- Unchanged: `↵` attach, `C-v` attach in a split, `x` stop (asks first), `c` capabilities, `l` launch, `L` Agents log.

## 3. `␣p`: one palette

- A query line over a grouped list. With no prefix it shows actions, items, sessions, artifacts and topics together: each group under its header with its count and its five best, and once you type, the group with the best match comes first.
- Prefixes: `>` actions, `#` items, `@` sessions, `~` artifacts, `/` topics. `Tab` / `S-Tab` cycle the prefix through none, `>`, `#`, `@`, `~`, `/`.
- Fuzzy matching is Neovim's `matchfuzzypos` over:
  - items: id, title and claiming session; open items first, then closed ones (the archive is reachable here);
  - sessions: name, role and harness; waiting ones first;
  - topics: title;
  - artifacts: id, kind and title;
  - actions: title and `:Cland` command.
- Actions, each with its key shown on the right:
  - the answers to every open ask (`1`–`9`, `i` on the ask), listed first;
  - every panel toggle and view switch (`␣i` `␣n` `␣s` `␣t` `␣T` `␣g` `␣b` `␣L` `␣N` `␣␣` `␣c` `ga`);
  - the items views `1`–`6`, `e` / `E`, and the three folds;
  - every `:Cland` subcommand: presets, view, panel, launch, topic new / close / resolve, prompt / send / attach, qa dump, refresh, help;
  - "Open an item / topic / artifact…" and "Attach a session…", which switch the prefix;
  - Launch a session (`␣l`) and Launch an Aide (`␣A`).
- `↵` runs the action or opens the object: an item's view, a session attached in Terminal mode, a topic's thread, an artifact.
- `C-v` opens a session (attached), an item's view, or a Markdown or Mermaid artifact in a split beside the centre; the centre view stays.
- `Esc` closes. The palette follows hub events while it is open.
- `␣a` opens the palette on `~`. The old picker has no key of its own: its kinds are the groups. `:Cland palette [query]` also opens it.
- `␣A` is the key picked for the Aide (§3.3). It opens the launcher with the name `aide-<n>`. The hub has no `aide` role yet and refuses unknown roles, so you pick the role; any `aide…` session shows under YOURS.

## Stand-ins and what is real

- Stand-ins:
  - the current release: an open epic, picked with `e` / `E`, kept in `.cland/scratch/panels-prototype.json`;
  - status: derived as above on every draw, nothing stored;
  - rank: a per-parent order of ids in the same file, so it survives a restart; nothing reaches the hub or the item files;
  - verified/total: checked/total of the item's checkboxes (its `## Acceptance criteria` section when it has one), from the body `task.view` returns, shown on tasks in work (planned to ready) as §3.4 says;
  - the Aide's role.
- Real: the items, claims, verdicts (with the hub's freshness), labels, assignees, bodies, asks, sessions, states, usage, topics and artifacts. Launch, attach, stop and answering an ask go to the hub as before.

## Verified

- Headless with `cland --headless --qa` on fixture projects, never the live hub; all PASS, repeated:
  - `qa/cases/PANELS-001.lua`: the board on the stub hub, with every status rule, the folds, a rank move read back from the file, `e` / `E`, and `gi` / `gs` from a row;
  - `PANELS-002`: the session groups, the selection, the stopped fold, `x` `c` `l`, and `gi` from a session;
  - `PANELS-003`: the palette's groups, typing, Tab, `@` + `↵`, `#` + `C-v`, `>` answering the ask, `/`, `␣a`, `␣A`;
  - `PANELS-004`: the board on a real stdio hub, with verdicts, `task.view` bodies, and a rank move stored in the fixture's scratch file.
- `ITEMS-001` (it now presses `2` for the tree) and `SHELL-001` PASS on both hubs.
- The same build ran on a stub hub serving the live `task list`, the live bodies and `hub status`.
- The v0 Neovim tests: `shell.test.ts` and `items.test.ts` run 62 tests; 41 pass and 21 fail. Every failure asserts a layout this branch replaces on purpose:
  - the picker, now the palette (also behind `␣a`);
  - the tree and the 1–5 filter numbers;
  - a meta line and `free` on every session row;
  - a session on the sessions panel's first row (it is now a group header);
  - stopped sessions shown inline;
  - `project │ view` in the top bar;
  - items with no parent, now folded under unscheduled.
- No Lua error in any run.

Not verified: a working session with you at the keys; widths over 160 columns (at 160 the left panel is 35 columns wide, so titles are cut early).

For your reaction: the sections and what a row shows; `J` / `K` and `e` / `E` (the epic key would pick the release once that kind exists); `za` / `↵` / `Tab` for folds; the expanded selected row; the palette's grouping and its five-per-group cap without a prefix; `␣A` for the Aide.

### human · 2026-10-09T20:50:14.678Z

Resolution (2026-10-09). The human accepted the three mockups (ItemsBoard, SessionsPanel, Palette on the design canvas, mirrored in docs/design/main-screen/) and the decisions the mockups and the prototype added: rank keys K/J and T, za for folds, ␣A for an Aide, the epic tab row as filter, the "next" mark, green ◉ for ready, fractions on planned rows, a 440 px items panel, the palette's cursor on the best match, unscheduled = parents reach no open container, only containers cycle as the scope. The Neovim prototype on prototype/panels (f1cdbe2, 896fa01; run command in the comment above) is the behavioural reference; a live working session was not held, and the human may try it at any time, with findings going to the build tickets.

Recorded in docs/spec/v0.1.md §3.11 (the panels) and §3.12 (focus and keys, from the T-85 research and the human's answers: C-h/j/k/l in every mode, a lone C-\ to leave a terminal, cland doctor warnings for the Ghostty shift+enter line and a ^H erase, langmap for layouts, no Cyrillic duplicates for the Ctrl chords). GLOSSARY: Palette.

### human · 2026-10-09T20:50:26.068Z

Resolved: see the resolution comment; spec v0.1 §3.11 and §3.12
