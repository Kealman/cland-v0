---
id: Q-11
kind: question
title: "Prototype: Neovim as host versus Neovim as embedded component"
state: closed
labels:
  - wayfinder:prototype
assignee: Kealman
parent: M-1
blocked_by:
  - Q-4
topic: null
branch: null
created: 2026-10-07T14:52:19Z
updated: 2026-10-08T13:17:15.593Z
github:
  repo: Kealman/cland-v0
  number: 11
  url: https://github.com/Kealman/cland-v0/issues/11
---

## Question

Can Neovim as the host (cland lives inside Neovim as Lua, shipped as a standalone build) carry cland, or must Neovim be an embedded component inside a host we write?

Build a throwaway prototype on the latest Neovim that checks three showstoppers:

1. Interactive harness sessions in built-in terminals: launch Claude Code, Codex and OpenCode; type into them; switch between them; resize.
2. A custom chat panel with a topic list and a thread view, rendered with Neovim UI primitives.
3. Packaging as a standalone program that starts without the user's own Neovim config.

Record a verdict per showstopper, the overall choice, and an ADR with the rejected option.

## Comments

### Kealman · 2026-10-07T16:19:41Z

<!-- github-comment: 6042039717 -->

## Facts from research to check in this prototype

From `docs/research/neovim-engine.md` (branch `research/neovim-engine`) and `docs/research/harness-surfaces.md` (branch `research/harness-surfaces`):

- **Key fidelity.** Neovim's embedded terminal implements only the kitty "disambiguate" keyboard mode; Shift+Enter reaches a harness as its own key only if the harness enables that mode. Check multi-line input in each of the three harnesses inside `:terminal`.
- **Paste.** `'termpastefilter'` drops TABs and ESC from pastes by default. Check pasting a multi-line prompt with tabs into a harness.
- **Floats over terminals.** Open issue neovim/neovim#40915: a float over a terminal leaves it misrendered, reported with Claude Code. Check the chat panel as a float over a running harness.
- **Session ownership.** Terminals die with the Neovim process (`:restart`, exit; neovim/neovim#40017). Codex and OpenCode run sessions on local servers that outlive the TUI (`codex resume --remote unix://...`, OpenCode service on 127.0.0.1:49374 or `--standalone`); Claude Code offers `--bg` plus `claude attach`. Check whether a Neovim terminal can attach to sessions owned outside Neovim, so an IDE restart does not kill them.
- **Scrollback and output.** Alternate-screen output never reaches scrollback; heavy output slows the editor (neovim/neovim#11090). Check history access and a verbose run for a full-screen harness TUI.
- **Images.** Nothing is drawn inside `:terminal`; `vim.ui.img` exists only on `master`.
- **Build.** The official 0.12.5 macOS arm64 tarball runs from any folder; `NVIM_APPNAME=cland` plus `--clean -u <file>` (in that order) isolates the build from the user's config, except plugin dirs injected through `$XDG_DATA_DIRS`.

### Kealman · 2026-10-07T17:58:29Z

<!-- github-comment: 6043735006 -->

## Prototype ready for the human's verdict

This is a throwaway prototype for this ticket: **Neovim as the host**, meaning cland as Lua inside the official Neovim 0.12.5, started as a standalone build.

- **Branch:** [`prototype/nvim-host`](https://github.com/Kealman/cland-v0/tree/prototype/nvim-host), commit `54179ee`, never merged.
- **Files:** [prototype](https://github.com/Kealman/cland-v0/tree/prototype/nvim-host/prototypes/nvim-host), [captures (`evidence/`)](https://github.com/Kealman/cland-v0/tree/prototype/nvim-host/prototypes/nvim-host/evidence), [manual checklist](https://github.com/Kealman/cland-v0/blob/prototype/nvim-host/prototypes/nvim-host/CHECKLIST.md).
- **Decision:** nothing is decided here and no ADR was written. The verdict on each showstopper and the overall choice are yours.

### How to run

From the repo root:

```sh
git checkout prototype/nvim-host
prototypes/nvim-host/run.sh
```

- **First run.** It downloads the official Neovim v0.12.5 macOS arm64 tarball into `prototypes/nvim-host/.nvim/`. The sha256 is checked against the release's asset digest; the release publishes no `shasum.txt`. Then it prints the command and runs it:

  ```
  env NVIM_APPNAME=cland-proto <repo>/prototypes/nvim-host/.nvim/nvim-macos-arm64/bin/nvim --clean -u <repo>/prototypes/nvim-host/init.lua
  ```

- **Keys.** `<Space>?` lists them. The main ones:
  - `<Space>1`, `<Space>2`, `<Space>3` start the real `claude`, `codex`, `opencode`.
  - `<Space>t1`, `<Space>t2`, `<Space>t3` start the same harness in a tmux session owned outside Neovim.
  - `<C-\>c` goes to the composer and `<C-\>j` to the focused session; `<C-\>n` and `<C-\>p` switch sessions. These work from any mode.
  - `<C-\>a` opens the ask dialog, and `<Space>T` tiles the sessions.
  - `:ClandShiftEnter off|csi-u|esc-cr` sets the Shift+Enter mode.
- **Layout.** Topics on the left (5 fake topics, with statuses drawn by extmarks), the thread in the centre, a prompt-buffer composer under it, and the sessions on the right. Winbars name each window, and the statusline shows the focused session.
- **Automated checks.** `prototypes/nvim-host/checks/run-checks.sh` takes about 15 minutes. It uses stand-ins only and never starts a real harness.

### Automated results

**Method.**
- The real Neovim TUI runs in a private tmux server (200×50). Keys go in with `tmux send-keys`; raw bytes go in with `-H` wherever the host terminal's encoding matters.
- State is read back over msgpack-RPC, and screens are saved with `capture-pane`.
- Stand-ins take the harnesses' place:
  - `bin/keylog`: raw tty; prints every `read()` as hex.
  - `bin/winch`: prints `stty size` on SIGWINCH.
  - `bin/tui-sim`: repaints one row only.
  - `bin/prompt-sim`: an Ink-style input box.
- tmux stands in for the host terminal; Ghostty is covered by the checklist.

| Check | Verdict | Evidence |
|---|---|---|
| a. Six terminals, typing, resize | pass | Six PTYs (`/dev/ttys006`–`011`). Each command's output appears only in its own buffer. On 200×50 → 160×40 → 200×50 every visible session got SIGWINCH, with `stty size` = its window minus the winbar row |
| a. Hidden sessions on resize | pass (by design) | They keep their last size and get SIGWINCH when shown again |
| b. Keys other than modified Enter | pass | Enter `0d`, Ctrl+C `03`, Esc `1b`, arrows `ESC[A`…`D`, Alt+Enter `1b 0d`, Ctrl+J `0a`, Tab `09`, Shift+Tab `ESC[Z` |
| b. Shift+Enter, program without kitty mode | **fail** | Neovim decodes `<S-CR>` from both `ESC[13;2u` and `ESC[27;2;13~`, but the program gets a plain `0d`. Ctrl+Enter becomes `0d` too |
| b. Shift+Enter, program with kitty "disambiguate" | pass | `ESC[13;2u`. In this mode Esc becomes `ESC[27;1u` and Shift+Tab `ESC[9;2u` |
| b. Shift+Enter with a terminal-mode `<S-CR>` mapping | pass | `:ClandShiftEnter csi-u` delivers `ESC[13;2u` from both host encodings, and Enter stays `0d`. `esc-cr` delivers `1b 0d` |
| b. Shift+Enter through a tmux-owned session | **fail** by default; pass with the mapping plus tmux `extended-keys always` | tmux 3.5a ignores the kitty request. `always` also turns Shift+Tab into `ESC[9;2u` |
| b. Shift+Enter in the composer | pass | The prompt buffer adds a line, and Enter sends a 2-line message |
| c. Paste with TABs, default `'termpastefilter'` | **fail** | `ESC[200~ alphaone␊betatwo␊gammathree ESC[201~`: the TABs are gone |
| c. Paste with `'termpastefilter'` `BS,ESC,DEL` or empty | pass | TABs arrive as `09`. With `BS,ESC,DEL`, ESC is still stripped |
| c. Paste into the composer | pass | Three lines with TABs, sent as one message |
| d. Ask float over streaming output | pass | After closing, the screen equals the buffer in all 47 rows: a scrolling stream, `yes`, and a TUI that repaints one row |
| d. neovim#40915, exact steps | pass (not reproduced) | Full-editor float with `border = "none"`, opened and closed in one mapping over an Ink-like prompt, with and without `ui2` |
| e. Neovim-owned sessions across `:restart` | **fail** (as documented) | The old PIDs are gone. The session restore re-runs each terminal's command: a fresh zsh, a fresh `cat -v`, history lost |
| e. tmux-owned session across `:restart` | pass | The tmux pane (same PID) survives `:restart`, `:restart!` and killing Neovim. `:restart` re-attaches it by itself, and text typed afterwards lands |
| e. `:detach`, then `nvim --remote-ui` | pass | The server and the session shell keep running. A new TUI gets the full layout back with the same shell PID |
| f. Alternate-screen output in scrollback | **fail** (as documented) | None of the lines of `less` or `vim --clean` are in the buffer |
| f. Scrollback cap | pass | With the cap at 10000, `seq 1 20000` leaves 10047 lines |
| g. Standalone start | pass | `:scriptnames`: 22 entries, bundled runtime plus our `init.lua`; none from `~/.config/nvim`, `~/.local/share/nvim` or Ghostty. Every `stdpath()` is under `cland-proto` |
| h. `seq 1 2000000`, `'scrollback'` 10000 | pass | 7.6 s (plain tmux pane 1.8 s, `/dev/null` 0.24 s). Composer keys show in 16–39 ms (idle 22–32 ms); loop lag ≤ 2.2 ms |
| h. The same, `'scrollback'` 1000000 | **fail** | 4 min 15 s. Composer keys 38–62 ms; loop lag up to 237 ms |
| i. Main loop while the human has input pending (extra) | **fail** for counts and prompts | RPC calls and `vim.schedule()` callbacks wait while a count is typed (3.1 s, until Esc), during a "Press ENTER" prompt (until Enter), and up to `'timeoutlen'` (0.8 s) after a mapping prefix. A pending operator, the cmdline and Insert mode do not block |

### Found on the way

1. **A terminal window one row high keeps no scrollback;** every line that scrolls off is lost. libvterm's `vterm_scroll_rect()` erases instead of scrolling when the scroll covers the whole region ([vterm.c L281-L285 at v0.12.5](https://github.com/neovim/neovim/blob/v0.12.5/src/nvim/vterm/vterm.c#L281-L285)). Repro: `checks/one-row-scrollback.lua`.
2. **The default `'scrollback'` depends on when the terminal is created:** 1000000 inside `VimEnter`, 10000 before or after. At 1000000, heavy output is 33× slower (check h). Repro: `checks/scrollback-default.lua`.
3. **A list-form `jobstart` terminal is named `term://…//pid:<argv[0]>`** ([funcs.c L3492-L3494](https://github.com/neovim/neovim/blob/v0.12.5/src/nvim/eval/funcs.c#L3492-L3494)).
   - `:restart` re-runs terminals from that name. `jobstart({'env', '-u', 'TMUX', 'tmux', …})` came back as `/usr/bin/env` alone.
   - Starting sessions from a string fixes it, and the prototype does so.
4. **A server started by `:restart` is re-parented to launchd and outlives its terminal**, sessions included. Early check runs left three such servers; they were killed.
5. **A key sent right after a paste can overtake it.** Enter reached the program before the pasted text.
6. **Pasted text containing `ESC[201~` ends bracketed paste early in Neovim's TUI** when the host terminal does not sanitise pastes (tmux does not), and the rest arrives as typed keys.
7. **tmux 3.5a does not offer the kitty keyboard protocol to programs** (no reply to `CSI ? u`).
8. **Raising `'scrollback'` on a terminal that already hit its cap kept about 750 fewer lines than expected** (reproduced twice). This is minor.

### What the evidence says per showstopper

These are facts for your verdict, not the verdict.

1. **Harness sessions in built-in terminals.**
   - **Works:** many PTYs, typing, switching, resize with SIGWINCH, floats over live output, and a responsive UI under 2M lines at the documented scrollback cap.
   - **Needs cland-side settings:**
     - A `<S-CR>` mapping, unless the harness turns on kitty mode.
     - `termpastefilter=BS,ESC,DEL`.
     - `'scrollback'` set explicitly.
     - Session windows of at least two rows.
     - Sessions started from string commands.
   - **Structural:** sessions die with the Neovim server on `:restart`, exit or a crash. To survive, they must be owned outside Neovim, or the server must run as a daemon:
     - The "sessions owned outside Neovim" pattern, measured: a tmux server on a private socket owns the harness, and the Neovim terminal runs only `tmux new-session -A -s <name>`. It costs a second terminal emulator in the path, and the history lives in tmux.
     - Neovim as a daemon, measured: `:detach` / `--remote-ui`. Sessions are still lost on a restart or crash.
2. **A chat panel in Neovim primitives.**
   - Drawn with stock 0.12.5 APIs and no plugins: topics with extmarks; a thread with role colours and right-aligned times; a prompt-buffer composer with Shift+Enter and TAB-safe paste; an ask float; winbars; a statusline.
   - **Risk for the hub:** updates that go through Neovim's main loop wait while the human has a count or a "Press ENTER" prompt pending.
3. **A standalone build.**
   - The official tarball, checked against the release digest, runs from any folder.
   - `NVIM_APPNAME` with `--clean -u` isolates config, plugins and shada, and moves Ghostty's `$XDG_DATA_DIRS` entry out of the way.
   - The only file written outside the repo is an empty `~/.local/state/cland-proto/nvim.log`.

### Open items that need you

These need Ghostty and the real harnesses. The details are in [CHECKLIST.md](https://github.com/Kealman/cland-v0/blob/prototype/nvim-host/prototypes/nvim-host/CHECKLIST.md). Fill in the table at its end and paste it here.

1. **Shift+Enter multi-line input** in Claude Code, Codex and OpenCode: mode `off`, `csi-u` and `esc-cr`; also Alt+Enter and Ctrl+J.
2. **Pasting a multi-line prompt with TABs** into each harness, with the default filter and with `BS,ESC,DEL`.
3. **The ask float over a live Claude Code**, plus the exact steps of neovim#40915.
4. **The feel of switching** between chat and sessions.
5. **`:restart` with a real harness attached through tmux** (`<Space>t1`), including Shift+Tab through tmux.
6. **Each harness's history** in the session buffer (alternate screen or not).

Not tested at all: Linux, several UIs at once, sessions running for hours, images.

<details>
<summary>Details per check: what was done and where the captures are</summary>

All captures are in [`prototypes/nvim-host/evidence/`](https://github.com/Kealman/cland-v0/tree/prototype/nvim-host/prototypes/nvim-host/evidence). The file names are given below.

**a. Many terminals and resize**
- **Done:**
  1. Opened 6 `$SHELL` sessions and tiled them.
  2. Typed `echo out-N:$((N*111)) on $(tty)` into each.
  3. Ran `bin/winch` in each and resized the tmux window to 160×40, then back to 200×50.
  4. Untiled, resized to 180×44, and showed a hidden session.
  5. Pressed `<Space>1/2/3` with fake harnesses (`CLAND_PROTO_FAKE_HARNESS=1` swaps them for `keylog`).
- **Captures:** `a-1-*`, `a-3-*`, `a-4-*` (session texts and window sizes), `a-5-*`, `a-6-*`, `a-7-fake-harness-state.json`, `a-8-one-row-scrollback.txt`.
- **Result:**
  - Windows `[7,90]` gave `stty size` `6 90`, and `[5,50]` gave `4 50`.
  - Hidden sessions kept their size and caught up when shown (`SIGWINCH #4 size=41 70`).
  - `claude(fake)`, `codex(fake)` and `opencode(fake)` opened.

**b. Key fidelity**
- **Done:**
  - `keylog`, plain and with `-k` (kitty "disambiguate" pushed; the reply to `CSI ? u` was `ESC[?1u`). A marker letter went before each key, and the Neovim key log recorded what the TUI decoded.
  - Then: the composer; `:ClandShiftEnter csi-u` and `esc-cr`; the same keyset inside a tmux-owned session; and the mapping through tmux with `extended-keys on` and with `always`.
- **Captures:** `b-1-keylog-plain.txt`, `b-2-keylog-kitty-disambiguate.txt`, `b-3-composer-shift-enter-thread.json`, `b-4-*`, `b-5-*`, `b-6-tmux-pane.txt`, `b-7-*`, `b-nvim-decoded-keys.log`.
- **Why Shift+Enter is lost:** libvterm sends a modified Enter as `CSI 13;<mod>u` only when the program enabled kitty "disambiguate". Otherwise it drops the modifier, except Alt, which becomes an ESC prefix ([vterm/keyboard.c at v0.12.5](https://github.com/neovim/neovim/blob/v0.12.5/src/nvim/vterm/keyboard.c#L230-L257)).
- **Raw bytes:** Ctrl+C and Ctrl+J stay raw even in kitty mode.

**c. Paste**
- **Done:** `tmux paste-buffer -p` of `alpha⇥one / beta⇥two / gamma⇥three` into `keylog -p`:
  - with the default filter;
  - with an empty filter;
  - into a program without bracketed paste;
  - with `BS,ESC,DEL` (the pasted text also held `ESC[201~injected`);
  - into the composer;
  - followed at once by Enter.
- **Captures:** `c-0-*` to `c-6-*`.
- **Result:** the default filter (`BS,HT,ESC,DEL`) drops TABs, and lines are joined with LF. `BS,ESC,DEL` keeps TABs and strips ESC.

**d. Float over a terminal**
- **Done:**
  1. The ask float was opened and closed over a 500-line `printf` stream, over `tui-sim`, and over `yes | head -c 200000`.
  2. After closing, the session rows on screen were compared with the buffer lines (`checks/compare_screen.py`, buffer read before and after the screen capture).
  3. Then the issue's exact keymap (`checks/repro-40915.lua`) over `prompt-sim`, by default and with `ui2`.
- **Captures:** `d-1`, `d-3` (float open), `d-2`, `d-4`, `d-5`, `d-6-*.compare.txt`, all "MATCH".
- **Note:** the issue was reported on 0.13-dev with `ui2`, foot and the real Claude Code.

**e. Restart and session ownership**
- **Done:**
  1. Created a tmux session outside Neovim running `cat -v` (socket `cland-proto`).
  2. In the prototype, opened a Neovim-owned `cat -v` (`:ClandRun cat -v`) and `:ClandAttach outside-cat`, and typed into both.
  3. Ran `:restart`, typed again, ran `:restart!`, then killed Neovim.
  4. Separately: killed the terminal of a normal start; and ran `:detach` with a `--remote-ui` re-attach.
- **Captures:** `e-0` to `e-8` (`e-2-restore-log.json` lists what the session file restarted; `e-3-processes-after-restart.txt` shows PIDs).
- **The pattern:**
  1. The tmux server on the private socket uses `tmux-sessions.conf`: no prefix key, no status bar, `escape-time 0`, `extended-keys always`.
  2. The terminal runs `env -u TMUX tmux -L cland-proto new-session -A -s <name> -e CLAND_PROTO_DIR=… <cmd>`. `-e` is needed because a tmux session gets the tmux server's environment, not the client's.
  3. The command is a string, so `:restart` re-runs it.

**f. Scrollback**
- **Done:** `less` and `vim --clean`, then searched the buffer; `seq 1 20000` in the startup session and in a later session; the cap raised to 100000 and `seq 1 60000`; `seq 1 500` in a tmux-owned session.
- **Captures:** `f-0` to `f-6`.
- **Result:**
  - The startup session had cap 1000000 and kept 20004 lines.
  - The later session kept 10047 lines (first line `9956`).
  - The tmux-owned session's Neovim buffer holds 47 lines (the screen), while tmux holds all 500.

**g. Standalone start**
- **Done:** read `v:argv`, `stdpath()`, `$XDG_DATA_DIRS`, `'runtimepath'`, `'packpath'` and `:scriptnames` over RPC and in the TUI; compared the runtimepath with and without `NVIM_APPNAME`; listed the created directories.
- **Captures:** `g-1` to `g-7`.
- **Result:** the TUI started the server as `nvim --embed --clean -u …/init.lua`, and `'shadafile'` is `NONE`.

**h. Heavy output**
- **Done:** `time (seq 1 2000000)` in a plain tmux pane, to `/dev/null`, in a cap-10000 session and in the startup session (cap 1000000). During each run, ten keys were typed into the composer, each timed until it showed on screen.
- **Captures:** `h-0` to `h-4`.

**i. Main loop while input is pending**
- **Done:** timed a trivial RPC call and the scheduled-callback probe (a 100 ms libuv timer that queues `vim.schedule()` work) in seven states: nothing pending, a count, an operator, the cmdline, Insert mode, a mapping prefix, and a "Press ENTER" prompt.
- **Capture:** `i-1-pending-input.txt`.
- **Result:** the 50 ms lag probe stayed at about 1 ms throughout, so libuv keeps running; only work that needs the main loop waits.

</details>

### Kealman · 2026-10-07T18:12:52Z

<!-- github-comment: 6043980729 -->

## Resolution

**Verdict: Neovim as the host.** Decided on 2026-10-07 by the human after running the prototype (branch `prototype/nvim-host`, commit 54179ee) and the manual checklist with the real harnesses: all six checklist items passed. ADR 0005, `docs/adr/0005-neovim-is-the-host.md` (5d47bbf), records the decision, the rejected option and the mitigations.

**Showstoppers**

1. Many interactive harness sessions in built-in terminals: **pass** (six terminals, input lands in the right buffer, resize reaches the programs; the human ran Claude Code, Codex and OpenCode inside the prototype).
2. A chat panel from Neovim's UI primitives: **pass** (topic list, thread, composer, an ask float over streaming terminal output without misrendering, with and without `ui2`).
3. Standalone start: **pass** (official 0.12.5 tarball, `NVIM_APPNAME`, `--clean -u`; `:scriptnames` shows only the bundled runtime and cland's `init.lua`).

**Failures found, all mitigated in cland's configuration** (see ADR 0005): Shift+Enter without kitty mode (mapping `<S-CR>` to `ESC[13;2u`); TABs stripped from pastes (`'termpastefilter'`); a 1,000,000-line scrollback default for terminals created at startup (cland sets 10,000); Neovim-owned terminals dying on `:restart` (sessions are owned outside Neovim and only attached); alternate-screen output absent from scrollback (history comes from the harness); UI updates waiting while input is pending (no hit-enter prompts, `vim.schedule`); one-row terminals keeping no scrollback (never tile below three rows).

**Other findings worth keeping:** `:restart` re-attaches an externally owned session automatically; `:detach` plus `nvim --remote-ui` restores the full layout with the same processes; tmux 3.5a does not offer the kitty keyboard protocol to programs, so a tmux-owned session needs `extended-keys always` for Shift+Enter (which also changes Shift+Tab); an Enter sent right after a paste can arrive before the pasted text; raising the scrollback cap on a full terminal drops lines.

**Rejected:** Neovim as an embedded component inside a host we write. It would re-implement grid rendering, key encoding, OSC 52 and OSC 8 and images, and would keep every libvterm failure listed above.

The prototype stays on its branch as a primary source; nothing of it is merged. The chat-screen prototype (#15) may build on it.
