# The workbench (ticket #15, PROTOTYPE)

A throwaway UI prototype for [#15 "Prototype: the chat screen with topics"](https://github.com/Kealman/cland-v0/issues/15), second round. It builds the design canvas the human approved: one shell, panels that toggle, and the item list at the centre of everything. It replaces the four variants of the first round ([VARIANTS.md](VARIANTS.md)). Neovim 0.12.5 is the host (ADR 0005). Never merge it.

**The question:** does this workbench work in a terminal, inside Neovim? Are the item list, the inbox, the panels and the three motions right?

The `screens/` folder has four previews, each a render of a tmux capture of the real TUI at 200×50:

- [workbench](screens/workbench.png): items, the T-15 item view, the sessions panel.
- [stage 1, charting](screens/stage-charting.png): the map beside General.
- [stage 2, watch](screens/stage-watch.png): items in work, the T-12 thread with its ask, topics docked over the inbox.
- [stage 3, steady](screens/stage-steady.png): the board and the inbox.

## Run

From the repo root:

```sh
git fetch origin prototype/workbench
git checkout prototype/workbench
prototypes/nvim-host/run.sh
```

To keep your checkout, use a worktree: `git worktree add ../cland-workbench prototype/workbench`, then `cd ../cland-workbench && prototypes/nvim-host/run.sh`.

- **First run.** `run.sh` downloads the official Neovim 0.12.5 macOS arm64 build into `prototypes/nvim-host/.nvim/` (gitignored) and checks it against the release digest. Later runs reuse it.
- **A preset at start.** `CLAND_LAYOUT=watch prototypes/nvim-host/run.sh` (or `charting`, `steady`).
- **Terminal size.** Drawn for 200×50; usable down to about 160×45. Colours assume truecolor.
- **Nothing is real.** No hub, no harness. A session terminal prints the attach command and a canned harness screen, then runs your `$SHELL` without rc files. Quitting forgets everything.

## Keys

Space is the leader, written `␣`. `␣?` shows this in Neovim.

| Key | Where | What it does |
|---|---|---|
| `␣i` | anywhere | Toggle the items panel (left). |
| `␣n` `␣s` `␣t` | anywhere | Inbox, sessions or topics in the right panel. The active key hides the panel. |
| `␣T` | anywhere | Dock topics above the right panel (the Watch layout). |
| `␣g` `␣b` `␣N` | anywhere | General, the board, the inbox full width in the centre. `␣b` and `␣N` again go back. |
| `␣␣` | anywhere | The previous centre view; twice returns, like `CTRL-^`. |
| `gi` `gt` `gs` | any panel or view | The item, topic or session of what is under the cursor, else of the centre view. |
| `␣p` `␣a` | anywhere | The picker, on items or on artifacts. Tab switches items · topics · sessions · artifacts. |
| `↵` `C-v` `C-t` `C-s` `C-i` `C-a` | picker | Open; open in a split; its topic; its session; its item; attach to the composer. `Esc` closes. |
| `↵` | panels, inbox, board | Open the row in the centre. On a session or an approval it attaches the terminal. |
| `1`-`5` `f` `Tab` `c` | items panel | Filters all · in work · needs you · done · map; next filter; fold; claim for a session. |
| `1`-`9` `i` `d` `D` `Tab` | inbox | Answer the ask; free answer; dismiss; dismiss all; expand another ask. |
| `x` / `n` | sessions / topics panel | Stop the session (again: start it) / new topic. |
| `1`-`3` `i` `↵` `gb` `r` | thread | Answer the ask; type (on a card: free answer); open A-7, T-12 or rev-1; browser; reply to the sender. |
| `Enter` `Shift+Enter` `C-c` | composer | Send; newline (`Alt+Enter` too); cancel a free answer. `␣c` focuses the composer. |
| `␣o` | thread, composer | The composer's text as a prompt artifact: `S` sends it, `A` attaches it, `q` keeps the draft. |
| `e` `gb` `x` | item view | The item's Markdown file; branch (stub); close (stub). |
| `f` | board | Epic scope. |
| `C-\ C-n` | session terminal | Leave Terminal mode. Until then every key goes to the session. |
| `␣x`, `:ClandSim …` | anywhere | Simulate a hub event (below). |
| `:ClandLayout …` | anywhere | `charting`, `watch` or `steady` (below). |
| `:ClandState [json]` | anywhere | The fake state, layout included. |

The top bar's chips are clickable: the Coordinator attaches it, "needs you" opens the inbox, "sessions" the sessions panel.

## The three presets

Examples of the three stage artboards, never modes: a preset only opens and closes panels, sets the items filter and picks the centre view. Everything still toggles afterwards.

| `:ClandLayout` | Items panel | Centre | Right panel |
|---|---|---|---|
| `charting` | open, map filter | General | hidden |
| `watch` | open, in work | the T-12 thread | topics docked over the inbox |
| `steady` | hidden | the board | inbox |

## The fake data

From the artboards, kept consistent with #7, #8, #9, #10 and #13:

- **Items.** Epics E-1 Hub and spoke, E-2 Roles and E-3 Tracker hold T-10 to T-25. M-1 is the map and Q-19 a question for you.
- **Sessions.** coord-1 (Coordinator, Claude Code, busy), impl-1 (OpenCode, idle), impl-2 (Claude Code opus, busy), rev-1 (Codex sol, waiting for approval) and qa-1 (Codex astra, idle).
- **Asks and artifacts.** One open ask, the spoke identity on reconnect. Artifacts A-7 (diagram), A-9 (prompt), A-6 and A-4.
- **Topics and inbox.** Nine topics; six inbox notifications.

The artboards disagree in places, so four choices were made:

- **The ask.** It lives in the T-12 topic (Watch, Inbox; #7 puts an ask about a task in the task's topic), not in General (Main).
- **Q-19.** The open question is Q-19, because the map already uses Q-3 for "Harness integration surfaces".
- **The map.** The map filter shows the Charting artboard's M-1 as a frozen charting-stage snapshot: decided 7, frontier 3, in work by sub-agents 2, blocked 5. So M-1 is in progress, not done.
- **Blocking edges.** T-14 is blocked by T-12 and T-16 by T-15 (Item artboard). T-19 is back in progress, unclaimed, after a not-clear review and impl-3's death.

## Things to try

1. **Toggle panels.** Try `␣i`, `␣n`, `␣s`, `␣t` and `␣T`. The centre keeps its view.
2. **Answer the ask.** In the inbox press `2`, or `i` for your own words. Or answer from the T-12 thread. The inbox, the `?` badge on T-12 and the top bar count all update.
3. **Approve in the harness.** Press `↵` on "rev-1 · run: npm test" in the inbox. The terminal attaches in Terminal mode; press `y` in the harness's own prompt. The answer comes back to the workbench: the approval leaves the inbox, ▲ leaves rev-1, and rev-1 turns busy, then idle.
4. **The motions.** On T-13 in the items panel, `gs` opens impl-2's terminal. Then `gi` opens the item, `gt` the topic, and `␣␣` goes back.
5. **Send a message.** In General, the stage goes ⌁ queued → ✓ delivered → ✓✓ injected, and a canned reply arrives after a second. `@rev-1` addresses someone else.
6. **The picker.** Press `␣p` and type `spo`, then Tab through the kinds. `C-t` or `C-s` jumps straight to the topic or the session.
7. **Simulate an event.** Watch where each one shows up:

| `:ClandSim` | What happens | Where it shows |
|---|---|---|
| `reply` | impl-2 replies in T-13. Next time, coord-1 asks you in prose in General. | Topic unread badge. Then inbox "waiting for you" and the top bar. |
| `ask` | coord-1 asks about T-13 (next time, in a new topic). | Inbox asks, T-13's `?` badge, topics "needs you", the top bar. |
| `approval` | impl-2 waits to run `npm run build`. | Inbox approvals, sessions ▲, "impl-2 ▲" on T-13, the top bar. |
| `vacant` | coord-1 stops; next time it comes back. | Top bar "no coordinator", inbox notification, "hub: n queued". |
| `verdict` | rev-1 clears T-15's review; next time qa-1 fails its QA. | Board column, item glyph and verdicts, inbox notification. |
| `died` | impl-2 dies (then qa-1 and the others). | Sessions ✗, "unclaimed" on T-13, inbox notification, sessions count. |

## Questions for you

1. **The item list.** Does it show the right things? The glyphs, the claim, the `?` badge, `by T-12` for blocked items, `n of m` for epics. Are the filters right: all · in work · needs you · done · map? Should "all" float what needs you to the top, or hide done items?
2. **The inbox.** Is the placement right: the right panel by default, `␣N` full width, hidden in stage 1? Is one open card plus one-line rows the right weight for asks? Is it right that notifications never count toward "needs you"?
3. **The motions.** Do `gi` / `gt` / `gs` feel right? A reference under the cursor wins, then the row, then the view. `gs` shows a session in Normal mode, while `↵` attaches it in Terminal mode. Is it fine that they shadow Neovim's own `gi`, `gt` and `gs`?
4. **The panels.** One left panel, three right-panel contents and a topics dock: too many, or not enough? Should sessions dock like topics?
5. **The presets.** Do they help, or should cland just remember the last layout?
6. **What is missing?** Some candidates:
   - An items panel scoped to the item's epic (Item artboard).
   - A way to cycle focus between panels.
   - Search.
   - The picker's letter actions (`n` new, `r` role, `p` promote), which need a Normal mode in the picker.
   - Stage marks only when a message is stuck.

## Neovim notes

What did not work as drawn, and the workaround in this prototype:

- **Top bar.** It is the tabline (`showtabline=2`), not a 1-row window: under `laststatus=3` a split costs a separator row and needs guards against focus, `:only` and `CTRL-W`. The tabline is one full-width row and supports click regions.
- **Winbar height.** `nvim_win_get_height()` counts the winbar and `winheight()` does not. Padding uses `winheight()`; the composer is 4 rows, the winbar plus 3 lines.
- **Bar colours.** A fg-only group in a bar does not take the bar's background, so every such group gets a `…Bar` and a `…Chip` twin. Kept from round 1.
- **Stale scroll.** A re-rendered thread can keep a stale top line, so `to_tail()` goes via line 1 (kept). A panel that shrank kept its old top line too, hiding its first rows; the top line resets when the content fits.
- **Insert mode after floats.** The picker leaves Insert mode on close. Entering Terminal mode after a pick waits two ticks and checks that the window holds a terminal.
- **Floats per tab page.** No tab pages are used any more and the variant pill is gone, so this no longer comes up.
- **Hit-enter prompts.** A message longer than the screen raises a hit-enter prompt that blocks every callback, so all messages are cut to one line and `vim.notify` is overridden.
- **`<cWORD>`.** It takes the next word when the cursor is on a blank, so the motions use a reference only when the cursor is on it.
- **Approvals.** The fake harness sends the answer as an OSC 777 sequence and `TermRequest` catches it; this works in 0.12.5. A real adapter would report the state change instead.
- **Card backgrounds.** A background extmark under a foreground extmark combines, which gives the cards and the fields column their tint.

## Files

- **New.** `WORKBENCH.md` (this file) and in `lua/cland_proto/`:
  - `layout.lua`: the windows, the centre views, the presets.
  - `bars.lua`: the top bar, the status line, the panel headers.
  - `items.lua`, `inbox.lua`, `lists.lua`: the panels (lists are sessions and topics).
  - `board.lua`, `itemview.lua`: two centre views.
  - `motions.lua`, `sim.lua`, `draw.lua`, `hl.lua`.
- **Reworked from round 1.** `app.lua`, `state.lua`, `data.lua`, `chat.lua`, `ask.lua`, `sessions.lua`, `picker.lua`, `artifacts.lua`, `init.lua` and `bin/fake-harness`.
- **Removed.** `switcher.lua` and `variants/`.
- **Kept as they were.** `run.sh` and `probe.lua`, plus the #11 files: `checks/`, `evidence/`, `CHECKLIST.md`, `tmux-sessions.conf` and the other stand-ins in `bin/`.
