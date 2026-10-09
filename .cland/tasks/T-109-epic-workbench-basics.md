---
id: T-109
kind: epic
title: "Epic: Workbench basics"
state: open
labels:
  - epic
  - v0.1
  - ready-for-agent
assignee: null
parent: T-130
blocked_by: []
topic: null
branch: null
created: 2026-10-09T21:51:33.419Z
updated: 2026-10-09T23:02:37.614Z
---

## Goal

The human drives the workbench by keys: one key moves focus out of a harness or between windows, the layout survives a restart, and one palette reaches every action and object. The items panel becomes a vertical board of the current release in status sections ordered by rank, and the sessions panel groups sessions by state. Today a terminal is left only with `C-\ C-n`, panel sizes are formulas re-applied on every change, the board lists every item, and there is no palette.

## Contents

- **§3.12 Focus and keys**: `C-h`, `C-j`, `C-k` and `C-l` move focus in every mode, a lone `C-\` leaves Terminal mode, Esc always reaches the harness, `cland doctor` warns about the two local conditions that break the keys, `[keys] layouts` sets `langmap`, and the kitty base-layout check is made once and recorded.
- **UI state** (map T-81, "Settled while charting"): `.cland/ui.json`, ignored by git, keeps the preset, the panels and their sizes, the items panel's filters and the human's pick of the current release (§3.1, `e` and `E`), and a manual resize beats the layout formulas.
- **§3.11 The workbench panels**: the items panel as a vertical board of the current release with the rank keys `K`, `J` and `T` and the "next" mark, the sessions panel grouped by state with the stopped sessions folded, and the `␣p` palette over every object and every registered action with its key.

Not in this epic:

- The fields the board reads (status, rank, and the current release by its default rule): "v0.1 release and status". The vertical board's tickets are blocked by its status and rank tickets.
- The "yours" group, `a` and `␣A` (launching an Aide), and the brief at launch: "The human's own session". The brief belongs there because it changes the hub's first delivery and each adapter's injection order, which "A quiet Coordinator" reworks; this epic stays inside Neovim and starts at once.
- The verified/total fraction from the hub's marks: "Criteria that live". Until it lands, the fraction counts the item's checked boxes under `## Acceptance criteria`, as the prototype does.
- Dimming by layer: "Visibility and artifacts" brings the classifier. Until then the palette dims closed items, stopped sessions and closed topics.
- The stage tag on rows: "The epic plan". The crew summary in the sessions panel header: "Leads and the crew".

The spec and the prototype disagree on the digit keys: §3.11 keeps the v0 filters on `1` to `5`, while `prototype/panels` puts the board on `1` and the filters on `2` to `6`. The spec's words win.

## Tracer-bullet order

1. **Focus and leaving a terminal.** The four Ctrl chords in every mode, the lone `C-\`, the newline keys kept, `cland doctor`'s two warnings, `[keys] layouts` with `langmap`, and the kitty base-layout check recorded in `nvim/README.md`. Demo: leave an attached Claude Code session with `C-h`, come back with `C-l`, and type a newline with Shift+Enter; under the Russian layout the Normal-mode keys still work.
2. **The layout persists.** `.cland/ui.json` with the preset, panel visibility, sizes and filters; a manual resize wins over the formulas without breaking the presets; the managed `.cland/.gitignore` that `cland init` and `cland update` write lists the file. Demo: resize the items panel, switch views and presets, restart Neovim: the sizes and filters come back.
3. **The action registry and the palette.** Every `:Cland` subcommand, panel toggle, view switch, launch and ask answer registered with a title and its key; `␣p` over actions and objects with the prefixes and the group order; `␣a` on `~`. Demo: `␣p` and a few letters toggle the sessions panel, `#` and an id open an item, and an open ask is answered from the palette.
4. **Sessions grouped by state.** The groups, the folded stopped line, the expanding selected row with the approval's command, the keys, and the sessions chip counting now-layer sessions plus the waiting ones. Demo: a session waiting for approval moves to the waiting group and shows the command it waits on; `za` unfolds the stopped sessions.
5. **The vertical board.** The items panel as a vertical board of the current release on the hub's status and rank: sections, folds, rows, glyphs, the "next" mark, the epic tab row, the v0 filters on `1` to `5` and `f`, `K`, `J` and `T` through `cland task rank`, and `e` and `E` with the pick kept in `ui.json`. Demo: `T` on a planned task makes it the "next" row; `e` scopes the board to another container and the choice survives a restart.

## Definition of done

The human attaches a session in the centre, leaves it with `C-h` for the items panel, and sees v0.1's in-progress, review, qa, ready and planned sections; `T` on a planned task gives it the "next" mark. `␣p` and a few letters run any action or open any item, session, artifact or topic, with each action's key shown. The sessions panel shows who is waiting, busy and idle, with the stopped sessions folded into one line. The human resizes the panels, restarts Neovim, and gets the same layout, filters and scope back.

- [ ] `C-h`, `C-j`, `C-k` and `C-l` move focus in every mode, and a lone `C-\` leaves Terminal mode, in Ghostty in both encodings and through tmux with and without extended keys.
- [ ] `cland doctor` warns about the Ghostty Shift+Enter line and a `^H` erase; `[keys] layouts` sets `langmap`; the kitty base-layout check is recorded.
- [ ] `.cland/ui.json` is ignored by git and restores the preset, panels, sizes, filters and the picked scope after a restart; a manual resize survives later layout changes.
- [ ] The palette reaches every registered action, with its key, and every item, session, artifact and topic; the prefixes narrow it; an open ask's options are actions.
- [ ] The sessions panel groups sessions by state with the stopped ones folded; the sessions chip counts now-layer sessions and the waiting ones.
- [ ] The items panel is a vertical board of the current release on the hub's status and rank, with the sections, folds, rows, glyphs and "next" mark of §3.11; `K`, `J` and `T` rank through the hub.
- [ ] Headless QA cases cover the focus keys, the persistence, the palette, the session groups and the board, as successors of `PANELS-001` to `PANELS-004` on `prototype/panels`.
- [ ] `nvim/README.md` documents the keys, the palette, the panels and `ui.json`.

## Dogfooding

From this epic on, the human follows the build on the vertical board of v0.1 and drives the workbench through the palette and the focus keys. The headless QA cases of the later Neovim epics ("Threads that read", "The human's own session", "The task graph", "Visibility and artifacts") reach their views through the palette's registered actions.

## Constraints

- **ADRs.** 0005 (Neovim is the host): Lua inside the standalone build, no plugins, the palette on Neovim's built-in fuzzy matching. 0003 (The hub is a per-project daemon extracted from the BCAS driver hub): the UI reads status, rank and sessions from the hub over its socket and never derives them.
- **Research.** `research/free-keys` (`docs/research/free-keys.md`, T-85, with its probe kit): which keys reach Neovim on every path and the three local conditions that break them. `research/neovim-engine` (`docs/research/neovim-engine.md`): the terminal workarounds the focus keys must not undo.
- **References.** The prototype on `prototype/panels` (`nvim/lua/cland/vboard.lua`, `panels.lua`, `palette.lua`, `rank.lua`; QA cases `PANELS-001` to `PANELS-004`), never merged. The mockups `ItemsBoard.dc.html`, `SessionsPanel.dc.html` and `Palette.dc.html` in `docs/design/main-screen/`, with `screens/v01-items-board.png`, `v01-sessions-panel.png` and `v01-palette.png`. Where they disagree, the spec's words win, then the prototype's behaviour, then the mockups (the precedence rule in `docs/design/main-screen/README.md`).
- **Risks** from the sizing: status and rank from the hub in place of the prototype's derivation; every key and command joining one action registry; manual sizes winning over the layout formulas without breaking presets; Ctrl chords that arrive as Cyrillic letters under the Russian layout.
- **The v0 tail.** No open tail item touches this code.
- **Order.** First in the Neovim lane, unblocked; it runs beside the hub lane. "Threads that read", "The human's own session" and "Visibility and artifacts" wait for it; "Threads that read" comes next because both edit the Neovim layout and `init`, where the v0 run paid for merge conflicts.
- **Git and the gate.** Commit on the task branch `t/<id>-<slug>` in its worktree and push it to `origin`, the local territory; work reaches `dev` only through `cland merge` and its verdict gate; only `cland release` pushes to GitHub.
- **Language.** Every artifact, item, commit and doc in English.
- **Tests** through the v0 seams, in this order: the hub's frame protocol first (a real hub process and a real spoke over MCP and WebSocket, the UI over the JSON-lines socket, the `cland` CLI against a temporary project; `hub/test/harness.ts`); the harness process boundary second, with the fake Claude Code, Codex and OpenCode in `hub/test/fakes/`; the Neovim UI headless from the protocol's other side (`nvim/test` on the stub hub, QA cases in `qa/cases/` run by `cland --headless --qa`). No new seams inside the hub. This epic lives on the Neovim side; `cland doctor` is tested through the CLI.

## Links

- Spec: `docs/spec/v0.1.md` on `dev`, §3.11 The workbench panels, §3.12 Focus and keys; §3.1 (Tree and scope) and §3.2 for what the board reads.
- Map T-81: Notes, "Settled while charting" (UI state, sessions panel, focus, palette); decisions T-99 and T-85.
- GLOSSARY: Palette, Status, Rank, Release, Unscheduled, Session.
- ADRs: `docs/adr/0005-neovim-is-the-host.md`, `docs/adr/0003-hub-is-a-per-project-daemon-from-the-bcas-core.md`.
- Branches: `prototype/panels`, `research/free-keys`, `research/neovim-engine`.
- Mockups: `docs/design/main-screen/ItemsBoard.dc.html`, `SessionsPanel.dc.html`, `Palette.dc.html`; `docs/design/main-screen/README.md`.

## Comments

### coord · 2026-10-09T21:58:31.917Z

Tickets cut with /to-tickets on 2026-10-09 at 21:57Z, following the epic's tracer-bullet order: T-124 (focus and keys; no blockers), T-125 (ui.json; T-124), T-126 (registry and palette; T-125), T-127 (sessions by state; T-126), T-128 (vertical board; T-126, and across lanes T-123). The human's stand-in approved them as filed at 21:59Z. T-124 started with impl-124. Delegated decision: the kitty base-layout check (§3.12), probed in T-124, reported to the stand-in when taken.
