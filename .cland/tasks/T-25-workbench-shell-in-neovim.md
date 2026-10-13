---
id: T-25
kind: task
title: Workbench shell in Neovim
state: closed
status: done
labels:
  - ready-for-agent
  - slice-1
assignee: Kealman
parent: E-19
blocked_by:
  - T-24
topic: null
branch: null
created: 2026-10-08T11:53:51Z
updated: 2026-10-10T00:58:17.340Z
github:
  repo: Kealman/cland-v0
  number: 25
  url: https://github.com/Kealman/cland-v0/issues/25
---

## Parent

Part of #19. Spec section 5 is authoritative; design mockups in `docs/design/main-screen/` on main (`Main.dc.html` is the interactive reference; read its markup for every panel's content and keys); prototype branch `prototype/workbench` (`prototypes/nvim-host/WORKBENCH.md` for the key map and presets, `lua/cland_proto/` for the Neovim workarounds: winbar height, bar highlight twins, stale scroll, insert mode after floats, no hit-enter prompts); ADR 0005.

## What to build

The real shell in `nvim/`, replacing the minimal client of the General ticket: a top bar as the tabline (project, centre view title, Coordinator chip with state, "needs you" count, sessions count), a status line with the centre view's context and key hints, a centre area with one view at a time (the thread first; the item, board, session and Agents views arrive with later tickets but the view switch exists now), a left panel slot and a right panel slot that toggle with one key each, one floating picker with kinds switched by Tab (topics and sessions now; items and artifacts later), the motions `gi` / `gt` / `gs` wired as a dispatch on the reference under the cursor or the current context, and `<Space><Space>` back to the previous view. Terminal buffers attach to sessions through the adapter's attach command, never by owning the process. The `cland` command starts the hub if absent and then Neovim as the standalone build with the ADR 0005 mitigations (Shift+Enter mapping, `termpastefilter`, scrollback cap, `vim.schedule` for all updates, no hit-enter prompts). The prototype is a reference for behaviour and workarounds, not code to merge.

## Acceptance criteria

- [ ] `cland` from the repo root opens the workbench on General with the Claude Code session visible in the sessions panel; Enter attaches it in the centre; `:restart` re-attaches rather than kills it
- [ ] Panels toggle with the keys of `WORKBENCH.md`; pressing the active right-panel key hides the panel; the state line always names the centre view
- [ ] Shift+Enter inserts a newline in the composer and reaches a harness TUI in a terminal buffer as the kitty CSI-u sequence; pasting text with tabs into a terminal buffer keeps the tabs
- [ ] No hit-enter prompt can be triggered by hub events; UI updates land while the user is typing
- [ ] Headless tests drive the shell with `nvim_input` and assert `screenstring()` for each panel toggle and view switch against a stub hub over stdio

## Comments

### Kealman · 2026-10-08T14:21:34Z

<!-- github-comment: 6061948436 -->

## Manual smoke (acceptance criterion 1)

Real hub in a temporary project (`git init`), `cland session launch coord --role coordinator --model opus` against the fake Claude Code from `hub/test/fakes/claude-code/` (first on `PATH`), then `cland` (no command, on a terminal) in a tmux pane of 160x45. Captured with `tmux capture-pane -p`; runs of empty rows are squeezed.

### 1. `cland` opens the workbench on General, the launched session in the sessions panel

```
 cland demo │ General                                                         ○ coord Coordinator · Claude Code · opus · idle    ✓ needs you 0    sessions  1
 General · to @coordinator                                                                                  topic open │ SESSIONS            1 live · 0 waiting
 No messages in General yet.                                                                                           │ ○ coord  coordinator              free
                                                                                                                       │   Claude Code · opus · idle
                                                                                                                       │
      … 33 more rows like the one above
───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
 to: Coordinator (coord)                                                                 Enter sends · S-Enter newline │
› Message General…  Enter sends · Shift+Enter newline                                                                  │
                                                                                                                       │
                                                                                                                       │ ↵ attach · gi item · gt topic
 INSERT  General · topic open · to @coordinator (coord) │ hub: connected │ sessions: 0 busy · 0 waiting · 1 idle     Enter sends · S-Enter newline · Esc leaves
```

### 2. `Esc`, `␣s ␣s` (focus the panel), `gg`, Enter: the session attached in the centre through `claude attach <id>`, Terminal mode

The fake's `attach` prints one line and exits; the real one stays attached.

```
 cland demo │ coord [coordinator]                                             ○ coord Coordinator · Claude Code · opus · idle    ✓ needs you 0    sessions  1
 coord · coordinator                                                                       ○ Claude Code · opus · idle │ SESSIONS            1 live · 0 waiting
fake claude attached to 133848b7 (coord)                                                                               │ ○ coord  coordinator              free
                                                                                                                       │   Claude Code · opus · idle
[Process exited 0]                                                                                                     │
                                                                                                                       │
      … 36 more rows like the one above
                                                                                                                       │ ↵ attach · gi item · gt topic
 TERMINAL  coord · session · attached · idle │ hub: connected │ sessions: 0 busy · 0 waiting · 1 idle    keys go to the session · C-\ C-n leaves · then ␣␣ back
```

### 3. `C-\ C-n`, `:restart`: the new Neovim re-runs the attach command; the session itself is untouched

`:echo getpid()` before and after a second `:restart`: `nvim pid 80164` then `nvim pid 82800`. `cland session list` after the restarts: `coord  claude-code  running  [idle]  (coordinator)  opus  pid 79110`, the pid it was launched with.

```
 cland demo │ coord [coordinator]                                             ○ coord Coordinator · Claude Code · opus · idle    ✓ needs you 0    sessions  1
 coord · coordinator                                                                       ○ Claude Code · opus · idle │ SESSIONS            1 live · 0 waiting
fake claude attached to 133848b7 (coord)                                                                               │ ○ coord  coordinator              free
                                                                                                                       │   Claude Code · opus · idle
[Process exited 0]                                                                                                     │
                                                                                                                       │
      … 36 more rows like the one above
                                                                                                                       │ ↵ attach · gi item · gt topic
 NORMAL  coord · session · attached · idle │ hub: connected │ sessions: 0 busy · 0 waiting · 1 idle           ␣i ␣s ␣t ␣n panels · ␣p pick · ␣␣ back · gi gt gs
```

### Kealman · 2026-10-08T14:45:46Z

<!-- github-comment: 6062426768 -->

Done on main (c375810..5f04496, merged at 3a16ec3): the workbench shell in nvim/ (tabline top bar with the Coordinator chip, status line, centre views with thread/session and placeholders, left items panel, right panel inbox/sessions/topics with toggles, floating picker, gi/gt/gs, presets, cland open, real :restart re-attach), 21 headless tests against a stub hub over stdio; smoke captures in the issue. Three nvim review findings fixed (draft kept on refusal, stale hub.json autostart, launcher path escaping). Open: panels write the role lower-case while the hub now sends a capitalised label.
