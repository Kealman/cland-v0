---
id: Q-15
kind: question
title: "Prototype: the chat screen with topics"
state: closed
labels:
  - wayfinder:prototype
assignee: Kealman
parent: M-1
blocked_by:
  - Q-7
  - Q-11
topic: null
branch: null
created: 2026-10-07T14:52:34Z
updated: 2026-10-08T13:17:15.595Z
github:
  repo: Kealman/cland-v0
  number: 15
  url: https://github.com/Kealman/cland-v0/issues/15
---

## Question

What should the chat screen look like in the terminal? Build a throwaway UI prototype of the main screen: a topic list on the left with statuses, a thread view, a composer, and the "waiting for you" signal. Try several radically different layouts. The human reacts; the verdict records the chosen layout and interaction model.

## Comments

### Kealman · 2026-10-07T19:01:23Z

<!-- github-comment: 6044787185 -->

## Prototype ready for the human's verdict

This is a throwaway UI prototype for this ticket: four radically different layouts of the main chat screen, switchable at runtime, over one fake in-memory state. It is built on the engine prototype of #11 (Neovim 0.12.5 as the host, ADR 0005). Nothing is decided here; the verdict is yours.

- **Branch:** [`prototype/chat-screen`](https://github.com/Kealman/cland-v0/tree/prototype/chat-screen), commit `1b891e0`, branched from `prototype/nvim-host`. It is never merged and has no PR.
- **Guide:** [`prototypes/nvim-host/VARIANTS.md`](https://github.com/Kealman/cland-v0/blob/prototype/chat-screen/prototypes/nvim-host/VARIANTS.md).
- **Previews:** [A](https://github.com/Kealman/cland-v0/blob/prototype/chat-screen/prototypes/nvim-host/screens/A-slack.png), [B](https://github.com/Kealman/cland-v0/blob/prototype/chat-screen/prototypes/nvim-host/screens/B-inbox-first.png), [C](https://github.com/Kealman/cland-v0/blob/prototype/chat-screen/prototypes/nvim-host/screens/C-session-centric.png), [D](https://github.com/Kealman/cland-v0/blob/prototype/chat-screen/prototypes/nvim-host/screens/D-tabs.png). Each is a render of a tmux capture of the real TUI at 200×50.

### How to run

From the repo root:

```sh
git fetch origin prototype/chat-screen
git checkout prototype/chat-screen
prototypes/nvim-host/run.sh
```

Or keep your current checkout and use a worktree:

```sh
git fetch origin prototype/chat-screen
git worktree add ../cland-chat-screen prototype/chat-screen
../cland-chat-screen/prototypes/nvim-host/run.sh
```

- **First run.** It downloads the official Neovim 0.12.5 macOS arm64 build into `prototypes/nvim-host/.nvim/` (checksum verified, gitignored). Later runs reuse it.
- **First variant.** `CLAND_VARIANT=inbox prototypes/nvim-host/run.sh` starts on a given variant: `slack`, `inbox`, `session` or `tabs`.
- **Terminal size.** Best at 200×50; it works down to about 160×45. Colours assume a dark terminal.
- **Nothing real runs.** There is no hub and no harness. A session terminal prints a canned harness screen, then runs your `$SHELL` without rc files.

### Switching

- `<Space>v` goes to the next variant and `<Space>V` to the previous one. `<C-\>v` does the same from Insert or Terminal mode.
- `:ClandVariant slack|inbox|session|tabs` (or `A` to `D`) jumps to a variant.
- The pink pill on the statusline names the current variant. It is prototype chrome, not part of any design.
- Each switch echoes a one-line state summary. `:ClandState` shows the full fake state, and `<Space>?` lists the keys.

### Variants

- **A `slack`:** topics on the left, grouped as needs you / open / closed, with unread badges. The thread and a multi-line composer are in the centre. A sessions board on the right shows name, role, harness, model, state and current item.
- **B `inbox-first`:** a "needs you" queue across topics on top: open asks with their options and keys, approvals, waits, a vacant Coordinator, then unread topics as a weaker section. The thread is below. The topic list exists only behind a `<Space>t` fuzzy picker.
- **C `session-centric`:** the active session's terminal fills the screen, with a narrow thread strip on the right. The bottom bar shows the last message's delivery stage and the session's state. Topics and sessions are reachable through pickers.
- **D `tabs`:** one Neovim tab per topic; the tabline shows glyph, title and unread count. Inside each tab are a thread and a composer. A status bar shows every session's state and the Coordinator's. An open ask pops up as a float with numbered options.

### Try in each variant

1. **Send from the composer.** Shift+Enter or Alt+Enter adds a line. The stage goes queued → delivered → injected, and a canned reply arrives after 1 s. `@impl-1` or `@reviewer` addresses someone other than the Coordinator.
2. **Answer the ask in T-12:** `1` to `3`, or `4` for your own words. `<Space>a` jumps to it.
3. **Open an artifact and the Agents topic.** Enter on `A-7` or `A-9` opens it. The Agents topic shows role changes and session starts.
4. **Fire an event elsewhere** with `<Space>x` or `:ClandSim reply|ask|approval|vacant`, and watch where each layout tells you about it.

### Questions for you

1. **Daily use.** Which layout would you use every day, or which parts of which?
2. **The "needs you" signal.** Where must it live: a pinned group (A), a dedicated queue (B), a counter in a bar (C, D), a tabline glyph (D), or an interrupting float (D)? Should it ever interrupt?
3. **Sessions.** Do they deserve a permanent column (A), a status bar (D), the whole screen (C), or only a picker (B)? Where should a session's terminal open?
4. **Asks.** Inline options in the thread (A–C), a queue line with direct keys (B), or a float with numbered options (D)? How should the free answer work?
5. **What is missing?** Some candidates:
   - Stage marks on every message, or only when a message is stuck?
   - Unread counts next to the status glyph?
   - In C, should the composer address the session on screen?
   - Search, topic create / rename / close, a topic's artifact list.

### Verified here

The prototype was driven in a private tmux server through the real Neovim 0.12.5 TUI, at 200×50 and at 160×45:

- Every variant builds and switches.
- Shift+Enter (sent as `ESC[13;2u`) adds a line in the composer.
- Stages advance and replies land.
- An answer closes the ask in every variant.
- The pickers filter.
- D adds a tab for a topic created while D is shown.
- `:messages` stays empty.

Not checked: Ghostty itself and Linux.

### Kealman · 2026-10-08T09:21:15Z

<!-- github-comment: 6056765261 -->

## Workbench prototype ready for the human's verdict

The second round of this ticket builds the design canvas you approved: one shell, panels that toggle, and the item list at the centre of everything. It is a throwaway prototype in Neovim 0.12.5 (ADR 0005) over fake, in-memory data, and it replaces the four variants of round 1. Nothing is decided here; the verdict is yours.

- **Branch:** [`prototype/workbench`](https://github.com/Kealman/cland-v0/tree/prototype/workbench), commit `0529e1e`, branched from `prototype/chat-screen`. It is never merged and has no PR.
- **Guide:** [`prototypes/nvim-host/WORKBENCH.md`](https://github.com/Kealman/cland-v0/blob/prototype/workbench/prototypes/nvim-host/WORKBENCH.md).
- **Previews:** [workbench](https://github.com/Kealman/cland-v0/blob/prototype/workbench/prototypes/nvim-host/screens/workbench.png), [stage 1](https://github.com/Kealman/cland-v0/blob/prototype/workbench/prototypes/nvim-host/screens/stage-charting.png), [stage 2](https://github.com/Kealman/cland-v0/blob/prototype/workbench/prototypes/nvim-host/screens/stage-watch.png), [stage 3](https://github.com/Kealman/cland-v0/blob/prototype/workbench/prototypes/nvim-host/screens/stage-steady.png). Each is a render of a tmux capture of the real TUI at 200×50.

### How to run

The fastest way uses the agent's worktree, where Neovim 0.12.5 is already downloaded:

```sh
cd /Users/evgeniyivanov/Projects/cland/v0/.claude/worktrees/agent-ae65e9db41085f34c
prototypes/nvim-host/run.sh
```

Or, from the repo root, in a worktree of your own:

```sh
git fetch origin prototype/workbench
git worktree add --detach ../cland-workbench origin/prototype/workbench
cd ../cland-workbench && prototypes/nvim-host/run.sh
```

- **Why `--detach`.** The branch is checked out in the agent's worktree, so `git checkout prototype/workbench` works only after that worktree is removed.
- **First run.** In a fresh worktree, `run.sh` downloads the official Neovim 0.12.5 macOS arm64 build into `prototypes/nvim-host/.nvim/` (checksum verified, gitignored). Later runs reuse it.
- **A preset at start.** `CLAND_LAYOUT=watch prototypes/nvim-host/run.sh` (or `charting`, `steady`).
- **Terminal size.** Best at 200×50; usable down to about 160×45. It assumes truecolor and a dark ground.
- **Nothing real runs.** There is no hub and no harness. A session terminal prints the attach command and a canned harness screen, then runs your `$SHELL` without rc files.

### Keys

Space is the leader (`␣`). `␣?` shows the keys inside Neovim.

| Key | Where | What it does |
|---|---|---|
| `␣i` | anywhere | Toggle the items panel (left). |
| `␣n` `␣s` `␣t` | anywhere | Inbox, sessions or topics in the right panel. The active key hides the panel. |
| `␣T` | anywhere | Dock topics above the right panel (the Watch layout). |
| `␣g` `␣b` `␣N` | anywhere | General, the board, the inbox full width in the centre. `␣b` and `␣N` again go back. |
| `␣␣` | anywhere | The previous centre view; twice returns. |
| `gi` `gt` `gs` | any panel or view | The item, topic or session of what is under the cursor, else of the centre view. |
| `␣p` `␣a` | anywhere | The one picker, on items or on artifacts. Tab switches items · topics · sessions · artifacts. |
| `↵` `C-v` `C-t` `C-s` `C-i` `C-a` | picker | Open; split; its topic; its session; its item; attach to the composer. |
| `↵` | panels, inbox, board | Open the row in the centre. On a session or an approval it attaches the terminal. |
| `1`-`5` `f` `Tab` `c` | items panel | All · in work · needs you · done · map; next filter; fold; claim for a session. |
| `1`-`9` `i` `d` `D` | inbox | Answer the ask; free answer; dismiss a notification; dismiss all. |
| `x` / `n` | sessions / topics | Stop the session (again: start it) / new topic. |
| `1`-`3` `i` `↵` `r` | thread | Answer the ask; type (on a card: free answer); open A-7, T-12 or rev-1; reply. |
| `Enter` `Shift+Enter` | composer | Send (the stage goes ⌁ queued → ✓ delivered → ✓✓ injected); newline. |
| `e` | item view | The item's Markdown file. |
| `C-\ C-n` | session terminal | Leave Terminal mode. Until then every key goes to the session. |
| `␣x`, `:ClandSim …` | anywhere | Simulate `reply`, `ask`, `approval`, `vacant`, `verdict` or `died`. |
| `:ClandState` | anywhere | The fake state, layout included. |

### The three presets

`:ClandLayout charting|watch|steady` arranges the shell like the three stage artboards. A preset only opens and closes panels, sets the items filter and picks the centre view; everything still toggles afterwards.

| Preset | Items panel | Centre | Right panel |
|---|---|---|---|
| `charting` | open, map filter (decided / frontier / in work by sub-agents / blocked) | General | hidden |
| `watch` | open, in work | the T-12 thread with its ask | topics docked over the inbox |
| `steady` | hidden | the board | inbox |

### Worth trying first

1. **Approve in the harness.** Press `↵` on "rev-1 · run: npm test" in the inbox, then `y` in the harness's own prompt. The answer travels back to the workbench: the inbox, the ▲ on rev-1 and T-15, and the top bar count all update.
2. **Answer the ask.** In the inbox press `2`, or `i` for your own words. Or answer from the T-12 thread.
3. **The motions.** On T-13 in the items panel press `gs`, then `C-\ C-n`, `gi`, `gt` and `␣␣`.
4. **Simulate.** Run each `:ClandSim` event and watch where it shows up: inbox, item badges, session states, top bar.

### Questions for you

1. **The item list.** Does it show the right things? The glyphs, the claim, the `?` badge, `by T-12` for blocked items, `n of m` for epics. Are the filters right: all · in work · needs you · done · map? Should "all" float what needs you to the top, or hide done items?
2. **The inbox.** Is the placement right: the right panel by default, `␣N` full width, hidden in stage 1? Is one open card plus one-line rows the right weight for asks? Is it right that notifications never count toward "needs you"?
3. **The motions.** Do `gi` / `gt` / `gs` feel right? A reference under the cursor wins, then the row, then the view. `gs` shows a session in Normal mode, while `↵` attaches it in Terminal mode. Is it fine that they shadow Neovim's own `gi`, `gt` and `gs`?
4. **The panels.** One left panel, three right-panel contents and a topics dock: too many, or not enough? Should sessions dock like topics?
5. **The presets.** Do they help, or should cland just remember the last layout?
6. **What is missing?** Candidates:
   - An items panel scoped to the item's epic (Item artboard).
   - A way to cycle focus between panels.
   - Search.
   - The picker's letter actions (`n` new, `r` role, `p` promote).
   - Stage marks only when a message is stuck.

### Departures from the artboards

The artboards disagree in places; WORKBENCH.md lists the choices.

- **The ask.** It lives in the T-12 topic (Watch, Inbox, #7), not in General (Main).
- **Q-19.** The open question is Q-19, because the map uses Q-3.
- **The map.** It is the Charting artboard's frozen snapshot.
- **The top bar.** It is the tabline, not a 1-row window: a split costs a separator row under `laststatus=3` and needs focus guards. The tabline is one full-width row, and its chips are clickable.

### Verified here

The prototype was driven through `run.sh` in a private tmux server at 200×50, and the start screen at 160×45:

- **Panels.** Every panel and filter, the fold and the claim; the dock; closing a panel with `:q`.
- **Views.** Every centre view, the back stack and a `C-v` split.
- **Picker.** All four kinds, the filter and the chords.
- **Motions.** `gi`, `gt` and `gs` from the panels, the thread, the item view and the session.
- **Composer.** Sending with `Shift+Enter`, sent as `ESC[13;2u`; the stages advance and replies land.
- **Inbox and approvals.** The ask answered from the inbox and with a free answer; the approval answered inside rev-1's terminal; notifications dismissed.
- **Events and layout.** All six `:ClandSim` events, the three presets, and clicks on the top bar chips.
- **Smoke run.** A headless run of 77 steps with checks for errors and stray globals came out clean.

Not checked: Ghostty itself and Linux.

### Kealman · 2026-10-08T11:32:13Z

<!-- github-comment: 6058916789 -->

## Resolution

**Verdict (2026-10-08): the workbench is accepted for v0 as the skeleton of the main screen.** The human found it somewhat dense at first and attributes that to habit; tuning happens in use.

The first prototype (branch `prototype/chat-screen`) offered four layouts: different focuses one wants at different times, with acceptable elements, but none fit as a whole. The design pass that followed (canvas https://claude.ai/artifact/PMVXaxAkQJQ6mSNEo3k7eB) turned them into one shell with toggleable panels, the item list at the centre of everything, an inbox as the intake centre, one floating picker, and the three motions `gi` / `gt` / `gs`; stage presets are examples, not modes. The second prototype (branch `prototype/workbench`, commit 0529e1e) implements that design and was driven in the real TUI; the human ran it and accepted it.

The layout is recorded in `docs/spec/v0.md`, section 5 (225f725). Both prototypes stay on their branches as primary sources; nothing is merged.

**Parked in the fog** (the human's intent, to think through later): a per-item "change tour", a way to look at what an item changed as the project is now, navigated by file structure, with new or changed places marked in the gutter rather than a red and green diff, and spawning a session on the item's worktree or context to ask for a diagram or an explanation.
