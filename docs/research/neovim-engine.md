# Neovim as the cland engine: what the latest release offers

Research for wayfinder ticket [#4](https://github.com/Kealman/cland-v0/issues/4), made on 2026-10-07.

- **Version examined: Neovim 0.12.5**, the current stable release (tag `v0.12.5`, commit `5885a30e`, published 2026-08-23). The previous release line is 0.11.x. Unreleased work on `master` (snapshot `27ee55c`, 2026-10-07) appears only where it is marked "master, unreleased".
- **Local machine:** `nvim --version` reports `NVIM v0.11.2` (Homebrew, `/opt/homebrew/bin/nvim`). That is older than the latest release, so every check below used the official 0.12.5 build, downloaded into a scratch directory.
- **Citations:** every `:h` link points at the help file in the `v0.12.5` tag, and every source link points at the same tag, so the version is in each URL. "Observed (En)" marks an experiment run on the official 0.12.5 macOS arm64 build; [Appendix A](#appendix-a-method-and-conventions) lists the experiments. [Appendix B](#appendix-b-not-verified) lists what could not be verified.

## Bottom line

- **The current release is Neovim 0.12.5**, a patch release of 0.12. Version 0.12.0 (2026-03-29) is the big update. `master` is already 0.13-dev, and the GitHub milestone for 0.13 is due 2026-10-15.
- **0.12 brings most of the new pieces cland would use.** These are a built-in plugin manager, `vim.pack` (experimental, Git-based, with a lockfile); HTTP GET through `vim.net.request()`; `nvim_ui_send()`, which writes raw escape sequences to the host terminal; floats with statuslines; multi-line prompt buffers; an experimental redesign of messages and the cmdline (`ui2`); `:restart` and `:connect`; and terminal upgrades (synchronized output, scrollback up to 1,000,000 lines, the exit code shown).
- **The built-in terminal can host several harness TUIs at once, with real limits.** It is still libvterm. PTYs resize with their windows, and mouse, bracketed paste and focus events reach the program. The limits:
  - Keys: the TUI asks the host terminal for kitty keyboard flags 1 and 2 only. The embedded terminal implements only the kitty "disambiguate" mode, so Shift+Enter reaches a harness as a distinct key only when the harness turns that mode on.
  - Pastes lose TAB and ESC characters by default.
  - There is no image protocol, and full-screen (alternate-screen) output never reaches scrollback.
  - Terminal contents are lost when Neovim restarts.
  - A draft PR to replace libvterm with libghostty-vt exists, but no release targets it.
- **The UI primitives cover a chat panel with topics, on a monospace cell grid.**
  - What exists: splits and floats with borders and titles; extmarks with virtual text and lines; winbar, statusline and statuscolumn with click handlers; prompt buffers, which the docs list for "chat UI"; and treesitter Markdown with conceal.
  - The message area is being redesigned: `ui2` is experimental, and the message events in the UI protocol changed in 0.12.
  - Images need plugins that use the Kitty graphics protocol. The first-party `vim.ui.img` exists only on `master`.
- **A standalone build is workable.**
  - The official per-platform tarballs are relocatable. The macOS arm64 binary links only system libraries, and the Linux x86_64 one needs glibc 2.34 or later.
  - `NVIM_APPNAME` isolates config, data, state and cache completely (observed).
  - `-u` alone still loads the user's plugins, and `--clean -u` works only in that argument order (observed).
  - The macOS arm64 binary is only ad-hoc signed, and the release notes have users clear the quarantine flag with `xattr -c` (observed).
- **Lua has the process and networking basics, with three gaps.**
  - Available: LuaJIT with FFI; `vim.uv` with TCP, Unix sockets and named pipes, timers, file watching and threads; msgpack-RPC in both directions; and `vim.json`.
  - Gaps: there is no built-in WebSocket or SQLite, but FFI to libsqlite3 works. A public structured-async API (`vim.async`) exists only on `master`.

## 1. Version and the 0.12 update

### 1.1 Which version is current

- **0.12.5 is the stable release**, published 2026-08-23 and marked "Latest" on GitHub ([release v0.12.5](https://github.com/neovim/neovim/releases/tag/v0.12.5)). A moving `stable` release is published from the same commit. MAINTAIN.md says CI force-pushes the `stable` tag on each release ([MAINTAIN.md, Release policy](https://github.com/neovim/neovim/blob/v0.12.5/MAINTAIN.md#L38-L57)), so a pinned build should reference `vX.Y.Z` tags.
- **The neovim.io manual tracks `master`.** neovim.io links "stable release" to GitHub's `releases/latest` ([neovim.io](https://neovim.io/)). Its online manual follows `master`, not the release: its news page starts "Notable changes since Nvim 0.12" ([neovim.io/doc/user/news](https://neovim.io/doc/user/news/), read 2026-10-07). That is why this document cites help files at the tag.
- **Release history**, from the GitHub releases API:

| Release | Published | Note |
|---|---|---|
| 0.11.0 | 2025-03-26 | previous minor release |
| 0.11.7 | 2026-03-28 | latest 0.11 patch |
| 0.12.0 | 2026-03-29 | the big update ([changelog](https://github.com/neovim/neovim/commit/fc7e5cf6c93fef08effc183087a2c8cc9bf0d75a)) |
| 0.12.1 | 2026-04-06 | [changelog](https://github.com/neovim/neovim/commit/7ac5a26d5633a41d7e291141488ca635242973a5) |
| 0.12.2 | 2026-04-22 | terminal fixes ([changelog](https://github.com/neovim/neovim/commit/4b35336f6f850ce68a230716401cdaa21bdb6a25)) |
| 0.12.3 | 2026-06-10 | security fix in `vim.secure.read()` ([changelog](https://github.com/neovim/neovim/commit/35b57441b0bac035dcfc591830e82abc560720b1)) |
| 0.12.4 | 2026-07-05 | [changelog](https://github.com/neovim/neovim/commit/68ea43cd0c28af25cd47731308c94fedfcfd1b0b) |
| 0.12.5 | 2026-08-23 | current stable ([changelog](https://github.com/neovim/neovim/commit/5885a30e1e1225349079e7a1c4a3848aa8e43e42)) |

- **What comes next.** Milestone `0.12.6` was due 2026-09-15 and has no release yet. Milestone `0.13` is due 2026-10-15, with 81 open and 231 closed issues. Milestone `1.0` is due 2026-12-31 ([milestones](https://github.com/neovim/neovim/milestones), read 2026-10-07). These are planning dates, and 0.12.6 has already passed its date.

### 1.2 What 0.12 added that bears on cland

Source: `:h news` at 0.12.5 ([news.txt](https://github.com/neovim/neovim/blob/v0.12.5/runtime/doc/news.txt)), plus the 0.12.0 changelog linked above.

- **Built-in plugin manager `vim.pack`**, experimental; see §5 ([news L374](https://github.com/neovim/neovim/blob/v0.12.5/runtime/doc/news.txt#L374)).
- **`vim.net.request()`** fetches HTTP content; see §6 ([news L298](https://github.com/neovim/neovim/blob/v0.12.5/runtime/doc/news.txt#L298)).
- **`nvim_ui_send()`** writes arbitrary data to a UI's stdout, meaning escape sequences to the host terminal ([news L110](https://github.com/neovim/neovim/blob/v0.12.5/runtime/doc/news.txt#L110), [`:h nvim_ui_send()`](https://github.com/neovim/neovim/blob/v0.12.5/runtime/doc/api.txt#L3755)).
- **`ui2`, an experimental redesign of the messages and cmdline UI.**
  - It is opt-in through `require('vim._core.ui2').enable()`. It has no "Press ENTER" prompts, highlights the cmdline while typing, and gives the pager its own buffer and window ([news L426-L432](https://github.com/neovim/neovim/blob/v0.12.5/runtime/doc/news.txt#L426-L432)).
  - During development the work was called "extui". The 0.12.0 changelog has `extui:` commits, and in 0.12.5 `:checkhealth` flags leftover `lua/vim/_extui*.lua` files as stale ([health.lua L28-L31](https://github.com/neovim/neovim/blob/v0.12.5/runtime/lua/vim/health/health.lua#L28-L31)).
- **Window changes.** Floating windows can show a `'statusline'`, `nvim_win_set_config()` can move floats to other tabpages, and `nvim_open_tabpage()` is new ([news L116-L119](https://github.com/neovim/neovim/blob/v0.12.5/runtime/doc/news.txt#L116-L119)).
- **Decoration providers gained `on_range`**, which deprecates `on_line` ([news L122](https://github.com/neovim/neovim/blob/v0.12.5/runtime/doc/news.txt#L122)).
- **Prompt buffers support multi-line input and paste, undo and redo** ([news L183](https://github.com/neovim/neovim/blob/v0.12.5/runtime/doc/news.txt#L183)).
- **Terminal changes** ([news L391-L403](https://github.com/neovim/neovim/blob/v0.12.5/runtime/doc/news.txt#L391-L403), [L124](https://github.com/neovim/neovim/blob/v0.12.5/runtime/doc/news.txt#L124), [L210](https://github.com/neovim/neovim/blob/v0.12.5/runtime/doc/news.txt#L210), [L476](https://github.com/neovim/neovim/blob/v0.12.5/runtime/doc/news.txt#L476)):
  - `nvim_open_term()` accepts a non-empty buffer.
  - CSI 3 J (clear scrollback) and DEC mode 2026 (synchronized output) are supported.
  - A suspended PTY process shows "[Process suspended]" and resumes on a key press.
  - On exit, "[Process exited]" appears as virtual text, and the exit code appears in the statusline and in `nvim_get_chan_info()`.
  - `TermRequest` gained a `terminator` field.
  - The `'scrollback'` maximum rose to 1,000,000.
  - The 0.12.0 changelog adds "jobs: jobstart(term=true) accepts width/height #33904".
- **TUI changes** ([news L414-L422](https://github.com/neovim/neovim/blob/v0.12.5/runtime/doc/news.txt#L414-L422)). `TermResponse` handles DA1 and APC replies, `Progress` events get native progress bars through OSC 9;4, and the SGR dim, blink, conceal and overline attributes render.
- **`:restart` and `:connect`.** `:restart` restarts the server and reattaches all UIs; `:connect` moves the current UI to another server ([news L433-L435](https://github.com/neovim/neovim/blob/v0.12.5/runtime/doc/news.txt#L433-L435)).
- **Status signals.** A per-buffer `'busy'` flag and progress messages (`nvim_echo` with `kind='progress'`) both appear in the default statusline ([news L144-L147](https://github.com/neovim/neovim/blob/v0.12.5/runtime/doc/news.txt#L144-L147), [L345](https://github.com/neovim/neovim/blob/v0.12.5/runtime/doc/news.txt#L345)).
- **Markdown files get treesitter highlighting by default** ([news L154](https://github.com/neovim/neovim/blob/v0.12.5/runtime/doc/news.txt#L154)).
- **Build options.** Nvim can be built without Unibilium, and there is an experimental Zig build ([news L129-L135](https://github.com/neovim/neovim/blob/v0.12.5/runtime/doc/news.txt#L129-L135)).

### 1.3 Breaking changes, deprecations and removals that matter to a product

- **UI message events changed.** In the UI protocol, `msg_show.return_prompt` and `msg_history_clear` are no longer emitted, and `msg_clear` was repurposed. `msg_show.bufwrite` and `msg_show.completion` became `msg_show.progress` ([news L22-L23](https://github.com/neovim/neovim/blob/v0.12.5/runtime/doc/news.txt#L22-L23), [L49-L54](https://github.com/neovim/neovim/blob/v0.12.5/runtime/doc/news.txt#L49-L54)). The changelog lists it as BREAKING: "ui: decouple ext_messages from message grid #27963". Any custom message UI built on `vim.ui_attach()`, and any external UI, has to follow these changes.
- **Deprecated in 0.12** ([`:h deprecated-0.12`](https://github.com/neovim/neovim/blob/v0.12.5/runtime/doc/deprecated.txt#L16-L66)):
  - The `hit-enter` prompt, which `ui2` never triggers.
  - The decoration provider's `on_line`.
  - The `buffer` key in the autocmd APIs and in `vim.keymap` options, renamed `buf`; the old key is still accepted.
  - `vim.diff`, renamed `vim.text.diff`.
- **`termopen()` has been deprecated since 0.11**; use `jobstart(cmd, {term = true})` instead ([`:h deprecated-0.11`](https://github.com/neovim/neovim/blob/v0.12.5/runtime/doc/deprecated.txt#L121)). It still works in 0.12.5 and is marked `deprecated = true` ([eval.lua L12556-L12566](https://github.com/neovim/neovim/blob/v0.12.5/src/nvim/eval.lua#L12556-L12566)).
- **Smaller removals and changes** ([news L38-L40](https://github.com/neovim/neovim/blob/v0.12.5/runtime/doc/news.txt#L38-L40), [L70-L84](https://github.com/neovim/neovim/blob/v0.12.5/runtime/doc/news.txt#L70-L84)):
  - The "shellmenu" plugin was removed.
  - `:TOhtml` became opt-in (`:packadd nvim.tohtml`).
  - `'shelltemp'` now defaults to off.
  - `i_CTRL-R` inserts registers literally.
- **Patch releases are not only bug fixes.**
  - 0.12.5 contains BREAKING entries: `:restart` without a bang now saves and restores the session, and `ZR` restores it too ([v0.12.5 changelog](https://github.com/neovim/neovim/commit/5885a30e1e1225349079e7a1c4a3848aa8e43e42)).
  - 0.12.3 fixed "vim.secure: read() command injection vulnerability #39918" ([v0.12.3 changelog](https://github.com/neovim/neovim/commit/35b57441b0bac035dcfc591830e82abc560720b1)).
  - 0.12.1 through 0.12.4 also carry several Vim patches marked `[security]` (see their changelogs).
- **Terminal fixes in patch releases.**
  - 0.12.2 ([changelog](https://github.com/neovim/neovim/commit/4b35336f6f850ce68a230716401cdaa21bdb6a25)): "terminal: do not reflow altscreen on resize", "terminal: forward streamed bracketed paste properly" and "channel: fix Ctrl-C handling regression in terminal".
  - 0.12.5 ([changelog](https://github.com/neovim/neovim/commit/5885a30e1e1225349079e7a1c4a3848aa8e43e42)): "terminal: OSC 52 multiline copy replaces newlines with NUL", "socket: --listen silently truncates long paths" and "channel: handle socket accept failure".

### 1.4 Stability rules for building on Neovim

- **The API contract** ([`:h api-contract`](https://github.com/neovim/neovim/blob/v0.12.5/runtime/doc/api.txt#L223-L255)):
  - Released function signatures do not change, except by additions: new map fields, an optional `opts` parameter, or a void return type that becomes non-void.
  - Deprecated functions stay until Nvim 2.0.
  - `nvim__*` functions and undocumented interfaces are not covered.
- **Several relevant features are explicitly experimental:** `vim.pack` ([`:h vim.pack`](https://github.com/neovim/neovim/blob/v0.12.5/runtime/doc/pack.txt#L208-L211)), `ui2` ([`:h ui2`](https://github.com/neovim/neovim/blob/v0.12.5/runtime/doc/lua.txt#L5559-L5562)), `vim.ui_attach()` ([`:h vim.ui_attach()`](https://github.com/neovim/neovim/blob/v0.12.5/runtime/doc/lua.txt#L798-L800)), `nvim__exec_lua_fast()` ([api.txt L1723](https://github.com/neovim/neovim/blob/v0.12.5/runtime/doc/api.txt#L1723-L1724)), and `vim.pos` and `vim.range` ([lua.txt L4258](https://github.com/neovim/neovim/blob/v0.12.5/runtime/doc/lua.txt#L4258)).
- **The deprecation policy** for non-experimental features goes from soft deprecation to hard deprecation to removal, across successive releases ([MAINTAIN.md](https://github.com/neovim/neovim/blob/v0.12.5/MAINTAIN.md#L62-L95)).

### 1.5 Master, unreleased: may change before 0.13

All items come from the `master` news file at `27ee55c` ([news.txt](https://github.com/neovim/neovim/blob/27ee55c09d088c88b6c5ab5e8e2c4eaf86d6df71/runtime/doc/news.txt)).

- **`vim.async`**, structured concurrency for Lua ([L395](https://github.com/neovim/neovim/blob/27ee55c09d088c88b6c5ab5e8e2c4eaf86d6df71/runtime/doc/news.txt#L395), [lua-async.txt](https://github.com/neovim/neovim/blob/27ee55c09d088c88b6c5ab5e8e2c4eaf86d6df71/runtime/doc/lua-async.txt)).
- **`vim.ui.img`**, an experimental image API (PNG through the Kitty graphics protocol) ([L398](https://github.com/neovim/neovim/blob/27ee55c09d088c88b6c5ab5e8e2c4eaf86d6df71/runtime/doc/news.txt#L398), [lua.txt L5728](https://github.com/neovim/neovim/blob/27ee55c09d088c88b6c5ab5e8e2c4eaf86d6df71/runtime/doc/lua.txt#L5728-L5807)).
- **Extmarks and editing.** `virt_lines_overflow = "wrap"` on extmarks ([L234](https://github.com/neovim/neovim/blob/27ee55c09d088c88b6c5ab5e8e2c4eaf86d6df71/runtime/doc/news.txt#L234)), and multicursor ([L277](https://github.com/neovim/neovim/blob/27ee55c09d088c88b6c5ab5e8e2c4eaf86d6df71/runtime/doc/news.txt#L277)).
- **`vim.net.request()` gains custom headers and HTTP methods** ([L400-L401](https://github.com/neovim/neovim/blob/27ee55c09d088c88b6c5ab5e8e2c4eaf86d6df71/runtime/doc/news.txt#L400-L401)).
- **`vim.pack` additions:** `:packupdate`, `:packdel`, `'packlockfile'` and `vim.pack-manifest` ([L311](https://github.com/neovim/neovim/blob/27ee55c09d088c88b6c5ab5e8e2c4eaf86d6df71/runtime/doc/news.txt#L311), [L433](https://github.com/neovim/neovim/blob/27ee55c09d088c88b6c5ab5e8e2c4eaf86d6df71/runtime/doc/news.txt#L433), [L456](https://github.com/neovim/neovim/blob/27ee55c09d088c88b6c5ab5e8e2c4eaf86d6df71/runtime/doc/news.txt#L456)).
- **Channels and UIs.** `:detach!` marks a UI as detachable ([L306](https://github.com/neovim/neovim/blob/27ee55c09d088c88b6c5ab5e8e2c4eaf86d6df71/runtime/doc/news.txt#L306)), a `ChanClose` event is added ([L337](https://github.com/neovim/neovim/blob/27ee55c09d088c88b6c5ab5e8e2c4eaf86d6df71/runtime/doc/news.txt#L337)), and `nvim_create_autocmd()` becomes callable from fast callbacks ([L242](https://github.com/neovim/neovim/blob/27ee55c09d088c88b6c5ab5e8e2c4eaf86d6df71/runtime/doc/news.txt#L242)).
- **Breaking on master.** `stdpath("log")` moves to `stdpath("state")/logs` ([L122](https://github.com/neovim/neovim/blob/27ee55c09d088c88b6c5ab5e8e2c4eaf86d6df71/runtime/doc/news.txt#L122)), `nvim -ll` is removed ([L163](https://github.com/neovim/neovim/blob/27ee55c09d088c88b6c5ab5e8e2c4eaf86d6df71/runtime/doc/news.txt#L163)), and Ex mode is reworked ([L104](https://github.com/neovim/neovim/blob/27ee55c09d088c88b6c5ab5e8e2c4eaf86d6df71/runtime/doc/news.txt#L104)).
- **Still missing on master:** a resize callback for `nvim_open_term()`. `term_resize` remains an empty stub with `TODO(bfredl): Lua callback` ([api/vim.c L1231-L1234](https://github.com/neovim/neovim/blob/27ee55c09d088c88b6c5ab5e8e2c4eaf86d6df71/src/nvim/api/vim.c#L1231-L1234)).

## 2. Built-in terminal

### 2.1 Engine and how to start a terminal

- **The emulator is libvterm-based.** Nvim embeds a VT220/xterm terminal emulator based on libvterm. A terminal is a special `'buftype'`, updated as data arrives ([`:h terminal`](https://github.com/neovim/neovim/blob/v0.12.5/runtime/doc/terminal.txt#L7-L20)). The libvterm code is vendored into `src/nvim/vterm` ([README](https://github.com/neovim/neovim/blob/v0.12.5/src/nvim/vterm/README.md)). It answers XTVERSION with `libvterm(0.3)` (observed, E5).
- **Ways to create one:** `:terminal`, `jobstart(cmd, {term = true})`, `nvim_open_term()`, or editing a `term://` buffer ([`:h terminal-start`](https://github.com/neovim/neovim/blob/v0.12.5/runtime/doc/terminal.txt#L24-L43)).
- **`jobstart` with `term`** starts the command in a new pseudo-terminal connected to the current, unmodified buffer ([`:h jobstart()`](https://github.com/neovim/neovim/blob/v0.12.5/runtime/doc/vimfn.txt#L5464), [`:h jobstart-options`](https://github.com/neovim/neovim/blob/v0.12.5/runtime/doc/vimfn.txt#L5507-L5557)). Height and width default to the window, and `$TERM` defaults to `xterm-256color`. The same page says: "Lua: Prefer vim.system() (unless using rpc, pty, or term)".
- **Child environment.**
  - Children get `$NVIM` set to the parent's `v:servername`, while `$NVIM_LISTEN_ADDRESS`, `$NVIM_LOG_FILE`, `$VIM` and `$VIMRUNTIME` are unset ([`:h jobstart-env`](https://github.com/neovim/neovim/blob/v0.12.5/runtime/doc/vimfn.txt#L5498-L5505)).
  - For PTY jobs, Nvim also drops the inherited `COLUMNS`, `LINES`, `TERMCAP`, `COLORFGBG` and `COLORTERM`. It sets `COLORTERM=truecolor` only when `'termguicolors'` is on ([funcs.c L3355-L3423](https://github.com/neovim/neovim/blob/v0.12.5/src/nvim/eval/funcs.c#L3355-L3423)).
  - Observed (E6): the child saw `TERM=xterm-256color`, `$NVIM` set, and no `COLORTERM`. The run was headless, so `'termguicolors'` was off, although `COLORTERM=truecolor` was set in the parent environment.
- **`nvim_open_term(buf, {on_input = …})` makes a terminal with no process behind it.** Bytes sent with `nvim_chan_send()` are rendered, and keystrokes arrive raw in `on_input` ([`:h nvim_open_term()`](https://github.com/neovim/neovim/blob/v0.12.5/runtime/doc/api.txt#L1260-L1301)). Its resize hook is an empty stub in 0.12.5 ([api/vim.c L1236-L1239](https://github.com/neovim/neovim/blob/v0.12.5/src/nvim/api/vim.c#L1236-L1239)). A PTY owned by another program therefore gets no resize notification through this API.

### 2.2 Several TUIs at once

- **Each terminal is its own PTY job and buffer.** `'bufhidden'` defaults to "hide", so closing the window does not end the job ([`:h terminal`](https://github.com/neovim/neovim/blob/v0.12.5/runtime/doc/terminal.txt#L11-L20)).
- **Observed (E3):** 20 terminal jobs started together, each sleeping 0.5 s, all finished within 546 ms.
- **Keys go only to the focused terminal.** Only the window in Terminal-mode receives keys; other terminals keep updating ([`:h terminal-input`](https://github.com/neovim/neovim/blob/v0.12.5/runtime/doc/terminal.txt#L46-L94)).
- **A terminal shown in no window keeps its last size.** The resize step is skipped when no window displays it ([terminal.c L771-L805](https://github.com/neovim/neovim/blob/v0.12.5/src/nvim/terminal.c#L771-L805)).
- **Harness Sessions end with the editor process.** Jobs are killed when Nvim exits unless started with `detach` ([`:h jobstart-options`](https://github.com/neovim/neovim/blob/v0.12.5/runtime/doc/vimfn.txt#L5507-L5557)), and `:restart` stops the server with `:qall` ([`:h :restart`](https://github.com/neovim/neovim/blob/v0.12.5/runtime/doc/gui.txt#L78-L105)). So a harness Session running in an Nvim terminal ends when that Nvim process ends.

### 2.3 Input passthrough and key handling

- **Terminal-mode passes everything except `<C-\>`.** `<C-\><C-N>` returns to Normal mode, and `<C-\><C-O>` runs one Normal-mode command. Terminal-mode mappings (`:tnoremap`) apply before keys reach the program ([`:h terminal-input`](https://github.com/neovim/neovim/blob/v0.12.5/runtime/doc/terminal.txt#L46-L71)).
- **From the host terminal into Nvim** ([`:h tui-input`](https://github.com/neovim/neovim/blob/v0.12.5/runtime/doc/tui.txt#L136-L185)):
  - The TUI asks the host for kitty keyboard flags 1 (disambiguate) and 2 (report event types) with `CSI > 3 u`, and otherwise falls back to modifyOtherKeys.
  - It does not request flags 8 or 16, so `<S-Space>` and `<Space>` cannot be told apart.
- **From Nvim into the program.**
  - The embedded terminal has "experimental support for the Kitty keyboard protocol … Only the 'Disambiguate escape codes' mode is currently supported" ([news-0.11 L373-L375](https://github.com/neovim/neovim/blob/v0.12.5/runtime/doc/news-0.11.txt#L373-L375)).
  - In the source, a modified Enter, Tab or Backspace is sent as `CSI <code>;<mod> u` only when the program has enabled that mode. Otherwise the modifier is dropped, except Alt, which adds an ESC prefix ([vterm/keyboard.c L230-L256](https://github.com/neovim/neovim/blob/v0.12.5/src/nvim/vterm/keyboard.c#L230-L256)).
  - So Shift+Enter reaches a harness as a distinct key only if the harness turns on kitty disambiguation; otherwise it arrives as a plain CR. This comes from reading the source; it was not tested with the harnesses.
- **Mouse.** Events are forwarded when the program has enabled mouse reporting. Otherwise a click leaves Terminal-mode and acts on the buffer ([`:h terminal-input`](https://github.com/neovim/neovim/blob/v0.12.5/runtime/doc/terminal.txt#L88-L97)).
- **Paste.**
  - Nvim wraps pasted text in bracketed-paste markers only when the program has enabled mode 2004 ([vterm/keyboard.c L304-L316](https://github.com/neovim/neovim/blob/v0.12.5/src/nvim/vterm/keyboard.c#L304-L316)).
  - It strips the characters listed in `'termpastefilter'` from every paste into a terminal. The default, `BS,HT,ESC,DEL`, removes TAB characters ([`:h 'termpastefilter'`](https://github.com/neovim/neovim/blob/v0.12.5/runtime/doc/options.txt#L6809-L6828), [terminal.c L1300-L1344](https://github.com/neovim/neovim/blob/v0.12.5/src/nvim/terminal.c#L1300-L1344)).
  - A paste from the host terminal in Terminal-mode takes the same path, through `vim.paste()` and `nvim_put()` ([editor.lua L153-L186](https://github.com/neovim/neovim/blob/v0.12.5/runtime/lua/vim/_core/editor.lua#L153-L186)).
- **Focus.** Focus-in and focus-out (`CSI I`, `CSI O`) go to the program when Terminal-mode is entered and left, if the program enabled mode 1004 ([terminal.c L927](https://github.com/neovim/neovim/blob/v0.12.5/src/nvim/terminal.c#L927), [L960](https://github.com/neovim/neovim/blob/v0.12.5/src/nvim/terminal.c#L960), [vterm/state.c L2453-L2465](https://github.com/neovim/neovim/blob/v0.12.5/src/nvim/vterm/state.c#L2453-L2465)). An open issue says that returning to a terminal window resets the mode to Normal ([#26881](https://github.com/neovim/neovim/issues/26881), backlog).

### 2.4 Scrollback

- **Limits.** `'scrollback'` applies only to terminal buffers. It defaults to 10,000 and has a maximum of 1,000,000, up from 100,000 before 0.12. Lines past the limit are deleted from the top ([`:h 'scrollback'`](https://github.com/neovim/neovim/blob/v0.12.5/runtime/doc/options.txt#L5230-L5238), [news L476](https://github.com/neovim/neovim/blob/v0.12.5/runtime/doc/news.txt#L476)).
- **Observed (E3):** with `'scrollback'` set to 1000, printing 20,000 lines left 1,022 lines in the buffer (1,000 plus 22 visible rows), starting at line 18,980.
- **Only the primary screen feeds scrollback.** Output on the alternate screen (DEC 1049, which full-screen TUIs use) never reaches it ([vterm/screen.c L164-L175](https://github.com/neovim/neovim/blob/v0.12.5/src/nvim/vterm/screen.c#L164-L175), [L644-L651](https://github.com/neovim/neovim/blob/v0.12.5/src/nvim/vterm/screen.c#L644-L651)).
- **Reflow covers visible lines only.** Since 0.11, a horizontal resize re-wraps visible lines; lines already in scrollback are not reflowed ([news-0.11 L359-L361](https://github.com/neovim/neovim/blob/v0.12.5/runtime/doc/news-0.11.txt#L359-L361), [`:h 'scrollback'`](https://github.com/neovim/neovim/blob/v0.12.5/runtime/doc/options.txt#L5230-L5238)). Full reflow is one motivation for replacing libvterm ([#33155](https://github.com/neovim/neovim/issues/33155)).
- **Terminal buffers are ordinary buffers in Normal mode.** They can be searched and yanked, and output is followed while the cursor is on the last line ([`:h terminal`](https://github.com/neovim/neovim/blob/v0.12.5/runtime/doc/terminal.txt#L11-L20)).

### 2.5 Resize

- **The PTY size is the largest width and the largest height**, each taken separately, among all windows showing the buffer, minus any number, sign or fold columns. Nothing changes when no window shows the buffer ([terminal.c L771-L805](https://github.com/neovim/neovim/blob/v0.12.5/src/nvim/terminal.c#L771-L805)).
- **Observed (E4):**
  - A 40×8 float started the program at `8 40`, and resizing the float to 60×12 sent SIGWINCH with `12 60`.
  - A second, smaller window on the same buffer changed nothing. Widening that second window to 70 columns gave `12 70`.
- **`jobresize(job, width, height)` resizes a `pty` job** ([`:h jobresize()`](https://github.com/neovim/neovim/blob/v0.12.5/runtime/doc/vimfn.txt#L5451-L5462)). Observed (E3): `jobstart(…, {pty = true, width = 33, height = 7})` gave `stty size` = `7 33`.
- **Resize fixes and open issues.** Since 0.12.2 the alternate screen is not reflowed on resize (changelog above). Still open: ":terminal text clipped after resize" ([#4997](https://github.com/neovim/neovim/issues/4997), from 2016, backlog), and a request for a fixed-width terminal independent of window size ([#12980](https://github.com/neovim/neovim/issues/12980)).

### 2.6 What the terminal reports to programs that probe it (observed, E5)

A script inside `:terminal` sent each query and printed the raw reply:

| Query | Reply | Reading |
|---|---|---|
| DA1 `CSI c` | `CSI ? 61;22;52 c` | No `4`, so no sixel. `52` advertises OSC 52 clipboard. |
| XTVERSION `CSI > 0 q` | `DCS >\|libvterm(0.3) ST` | libvterm |
| DECRQM `?1049` | `0` (not recognized) | Mode 1049 still works when set. Only DECRQM for 1047 is answered ([state.c L854-L944](https://github.com/neovim/neovim/blob/v0.12.5/src/nvim/vterm/state.c#L854-L944)). |
| DECRQM `?2004` | `2` (recognized, reset) | bracketed paste |
| DECRQM `?2026` | `2` | synchronized output |
| DECRQM `?2027` | `0` | grapheme-cluster mode not supported |
| DECRQM `?2031` | `2` | theme-change notifications |
| DECRQM `?2048` | `0` | in-band resize reports not supported |
| kitty keyboard `CSI ? u` | `CSI ? 0 u` | protocol recognized |
| XTWINOPS `14t`, `16t`, `18t` | no reply | no pixel size reporting |
| OSC 11 `?` | `rgb:0000/0000/0000` | fixed reply from a Lua handler, see §2.7 |
| Kitty graphics query (APC `G`) | no reply | no Kitty graphics |
| DECRQSS `m` | `DCS 1 $ r m ST` | supported |

### 2.7 OSC and other escape sequences

- **OSC 52.** A program can copy to the system clipboard through Nvim's clipboard provider. Reading the clipboard is refused, and OSC 52 does not raise `TermRequest` ([`:h terminal-osc52`](https://github.com/neovim/neovim/blob/v0.12.5/runtime/doc/terminal.txt#L188-L201)).
- **OSC 8 hyperlinks** from programs are kept and shown as links in host terminals that support OSC 8 ([news-0.11 L362-L363](https://github.com/neovim/neovim/blob/v0.12.5/runtime/doc/news-0.11.txt#L362-L363), [terminal.c L349-L384](https://github.com/neovim/neovim/blob/v0.12.5/src/nvim/terminal.c#L349-L384)).
- **OSC 7 (working directory) and OSC 133 (prompt marks)** reach Lua through `TermRequest`. A default handler marks OSC 133 prompts for `[[` and `]]` ([`:h terminal-events`](https://github.com/neovim/neovim/blob/v0.12.5/runtime/doc/terminal.txt#L141-L246)).
- **`TermRequest` fires for every OSC, DCS and APC sequence**, with the raw `sequence`, its `terminator` and the `cursor` position ([`:h TermRequest`](https://github.com/neovim/neovim/blob/v0.12.5/runtime/doc/autocmd.txt#L1204-L1216), [terminal.c L349-L440](https://github.com/neovim/neovim/blob/v0.12.5/src/nvim/terminal.c#L349-L440)). Observed (E3): OSC 8, OSC 7, OSC 1337 (iTerm2 inline image), APC `G…` (Kitty graphics) and DCS `q…` (sixel) each raised `TermRequest`. None of them drew anything.
- **OSC 10 and 11 colour queries get a fixed answer.** A default Lua handler replies with white or black depending on `'background'`, not with the real colours ([defaults.lua L641-L676](https://github.com/neovim/neovim/blob/v0.12.5/runtime/lua/vim/_core/defaults.lua#L641-L676)).
- **DEC 2026 synchronized output** (0.12) lets programs batch screen updates, and **DEC 2031** theme-change notifications have worked since 0.11 ([news L396](https://github.com/neovim/neovim/blob/v0.12.5/runtime/doc/news.txt#L396), [news-0.11 L371-L372](https://github.com/neovim/neovim/blob/v0.12.5/runtime/doc/news-0.11.txt#L371-L372)). **Bells** from terminals are silent by default ([news-0.11 L57](https://github.com/neovim/neovim/blob/v0.12.5/runtime/doc/news-0.11.txt#L57-L58)).
- **Images: no Kitty, sixel or iTerm2 rendering inside `:terminal`.** The feature request is open ([#32189](https://github.com/neovim/neovim/issues/32189), milestone "needs-owner").

### 2.8 Known problems and open issues (state on 2026-10-07)

- **A float that covers a terminal can leave it misrendered.** If an editor-relative float covers a `:terminal` and then closes, the terminal can stay misrendered; the report says this "can be observed with claude code". The workaround is a manual redraw. Open, backlog ([#40915](https://github.com/neovim/neovim/issues/40915)).
- **Large output slows the editor.** Open, backlog ([#11090](https://github.com/neovim/neovim/issues/11090)). Separately, a terminal can become laggy after long use and several remote reconnects; open ([#35107](https://github.com/neovim/neovim/issues/35107)).
- **A crash with Codex was reported.** It was a SIGSEGV in `putglyph` after an outer-terminal resize, with the Codex TUI in a plugin's panel. It was closed on 2026-06-02 because the reporter could no longer reproduce it on nightly; no fix was identified ([#40069](https://github.com/neovim/neovim/issues/40069)).
- **A redraw problem with a bottom split.** Terminal apps redraw wrongly after `nvim_win_set_config` with `win = -1`; the reproduction mentions opencode. Open, backlog ([#37140](https://github.com/neovim/neovim/issues/37140)).
- **Replacing libvterm is proposed, not scheduled.**
  - The issue to replace libvterm with libghostty is open in the backlog, with the most reactions among open terminal issues ([#33155](https://github.com/neovim/neovim/issues/33155)).
  - The draft PR "feat(terminal): replace libvterm with libghostty-vt" has been open since 2026-05-13, is not merged, and has no milestone ([#39773](https://github.com/neovim/neovim/pull/39773)).
  - Behaviour described in this section may change if it lands.
- **Terminal contents do not persist.**
  - `:mksession` restores a terminal by starting its command again ([`:h terminal-start`](https://github.com/neovim/neovim/blob/v0.12.5/runtime/doc/terminal.txt#L39-L41)).
  - The tracking issue states that terminals "lose all content when Neovim restarts"; it is a GSoC 2026 item in the backlog, blocked on #39773 ([#40017](https://github.com/neovim/neovim/issues/40017)).

## 3. UI extension points for a chat panel with topics

### 3.1 Windows

- **`nvim_open_win(buf, enter, config)` creates splits and floats** ([`:h nvim_open_win()`](https://github.com/neovim/neovim/blob/v0.12.5/runtime/doc/api.txt#L3820-L3990)).
  - Splits use `split`, `vertical` and `win`.
  - Floats use `relative`, which takes `editor`, `win`, `cursor`, `mouse`, `laststatus` or `tabline`. They also take `row`, `col`, `width`, `height`, `anchor`, `bufpos`, `zindex`, `focusable`, `mouse`, `hide`, `fixed`, `style = "minimal"`, `border`, and `title` and `footer` with positions.
  - Splits cannot have a border, title or footer.
  - The built-in UI clips floats to the editor grid and rounds fractional positions down.
  - `external` windows exist only for multigrid UIs, such as GUIs.
- **New in 0.12:**
  - Floats can show a `'statusline'`.
  - `nvim_win_set_config()` can move a float to another tabpage, and the changelog adds "can move split to other tp as floatwin".
  - `nvim_open_tabpage()` opens a tabpage ([news L116-L119](https://github.com/neovim/neovim/blob/v0.12.5/runtime/doc/news.txt#L116-L119)).
- **Float defaults and transparency.** `'winborder'` sets a default float border: bold, double, rounded, shadow, single, solid, or eight custom characters ([`:h 'winborder'`](https://github.com/neovim/neovim/blob/v0.12.5/runtime/doc/options.txt#L7514-L7528)). `'winblend'` gives pseudo-transparency and works best with RGB colours ([`:h 'winblend'`](https://github.com/neovim/neovim/blob/v0.12.5/runtime/doc/options.txt#L7505-L7512)).

### 3.2 Buffers for a topic list, a thread view and a composer

- **Scratch buffers.** `nvim_create_buf(listed, scratch)` creates a throwaway buffer that is always `'nomodified'` ([`:h nvim_create_buf()`](https://github.com/neovim/neovim/blob/v0.12.5/runtime/doc/api.txt#L596-L611)).
- **Prompt buffers.** `'buftype'` `prompt` is documented as "Useful for implementing: chat UI, REPL or shell plugins, advanced picker plugins" ([`:h prompt-buffer`](https://github.com/neovim/neovim/blob/v0.12.5/runtime/doc/channel.txt#L174-L250)).
  - Only the input section is editable, and Enter calls `prompt_setcallback()`.
  - Shift-Enter adds a line, which depends on the host terminal delivering `<S-CR>`; see §2.3.
  - `prompt_appendbuf()` adds output above the prompt, and `prompt_getinput()` reads the pending input; both are new in 0.12 ([vimfn.txt L7577-L7628](https://github.com/neovim/neovim/blob/v0.12.5/runtime/doc/vimfn.txt#L7577-L7628)).
- **Markdown text renders through treesitter.**
  - The Markdown ftplugin calls `vim.treesitter.start()` ([ftplugin/markdown.lua](https://github.com/neovim/neovim/blob/v0.12.5/runtime/ftplugin/markdown.lua)).
  - The `markdown` and `markdown_inline` parsers are bundled; observed in `lib/nvim/parser` of the release tarball.
  - The bundled queries hide code-fence lines with `conceal_lines`, which takes effect only when `'conceallevel'` is 2 or more and respects `'concealcursor'` ([highlights.scm L53-L59](https://github.com/neovim/neovim/blob/v0.12.5/runtime/queries/markdown/highlights.scm#L53-L59), [`:h treesitter-highlight-conceal`](https://github.com/neovim/neovim/blob/v0.12.5/runtime/doc/treesitter.txt#L496-L517), [decoration.c L867-L873](https://github.com/neovim/neovim/blob/v0.12.5/src/nvim/decoration.c#L867-L873)).
  - `vim.lsp.util.stylize_markdown()` is deprecated in favour of `vim.treesitter.start()` with `conceallevel=2` ([`:h deprecated-0.12`](https://github.com/neovim/neovim/blob/v0.12.5/runtime/doc/deprecated.txt#L16-L66)).

### 3.3 Extmarks, virtual text and lines, decorations

- **What `nvim_buf_set_extmark()` offers** ([`:h nvim_buf_set_extmark()`](https://github.com/neovim/neovim/blob/v0.12.5/runtime/doc/api.txt#L3199-L3362)):
  - Range highlights, with `hl_group` stackable, plus `line_hl_group`, `number_hl_group` and `hl_eol`.
  - Signs, through `sign_text`.
  - `virt_text` at `eol`, `eol_right_align`, `overlay`, `right_align` or `inline` positions, or at `virt_text_win_col`.
  - `virt_lines` above or below a line, or in the leftmost column.
  - `conceal` and `conceal_lines`.
  - `url`, which the TUI emits as an OSC 8 link.
  - `ephemeral`, `invalidate` and `ui_watched`.
- **Virtual lines do not wrap in 0.12.5.** `'wrap'` does not apply to them, and overflow is either "trunc" or "scroll". Wrapping exists only on master (§1.5).
- **Decoration providers** call Lua during redraw: `on_start`, `on_buf`, `on_win`, `on_range` and `on_end`. Setting extmarks is the only supported action inside them ([`:h nvim_set_decoration_provider()`](https://github.com/neovim/neovim/blob/v0.12.5/runtime/doc/api.txt#L3379-L3440)).

### 3.4 Winbar, statusline, tabline, statuscolumn

- **One format for all four bars.** `'winbar'`, `'statusline'`, `'tabline'` and `'statuscolumn'` share the statusline format ([`:h 'winbar'`](https://github.com/neovim/neovim/blob/v0.12.5/runtime/doc/options.txt#L7488-L7503), [`:h 'statusline'`](https://github.com/neovim/neovim/blob/v0.12.5/runtime/doc/options.txt#L6283-L6420), [`:h 'tabline'`](https://github.com/neovim/neovim/blob/v0.12.5/runtime/doc/options.txt#L6628), [`:h 'statuscolumn'`](https://github.com/neovim/neovim/blob/v0.12.5/runtime/doc/options.txt#L6227-L6280)). `%N@Func@…%X` makes a clickable label whose function receives the click count, button and modifiers ([options.txt L6398-L6420](https://github.com/neovim/neovim/blob/v0.12.5/runtime/doc/options.txt#L6398-L6420)). Floats need a window-local `'winbar'`.
- **New in 0.12:** highlight groups can stack in `'statusline'`. The default statusline shows `vim.diagnostic.status()`, `vim.ui.progress_status()`, the terminal exit code, and `'busy'` as ◐ ([news L144-L147](https://github.com/neovim/neovim/blob/v0.12.5/runtime/doc/news.txt#L144-L147), [L345-L349](https://github.com/neovim/neovim/blob/v0.12.5/runtime/doc/news.txt#L345-L349), [L441](https://github.com/neovim/neovim/blob/v0.12.5/runtime/doc/news.txt#L441)).
- **Progress messages.** `nvim_echo(chunks, true, {kind = 'progress', id, percent, status, title})` creates or updates one and fires the `Progress` event ([`:h progress-message`](https://github.com/neovim/neovim/blob/v0.12.5/runtime/doc/message.txt#L881-L910)). The TUI also shows a native progress bar through OSC 9;4 ([news L417](https://github.com/neovim/neovim/blob/v0.12.5/runtime/doc/news.txt#L417-L418)).

### 3.5 Messages and the cmdline

- **`ui2` is experimental.** It uses four special windows and buffers: `cmd`, `msg`, `pager` and `dialog`, each with a matching `'filetype'`. Long messages collapse behind a `[+x]` marker, and `g<` shows them in full ([`:h ui2`](https://github.com/neovim/neovim/blob/v0.12.5/runtime/doc/lua.txt#L5559-L5605)).
- **`vim.ui_attach(ns, {ext_…}, callback)` is experimental.** It delivers UI events (popupmenu, cmdline, messages) to Lua, and `msg_show` callbacks for internal messages run in a fast context ([`:h vim.ui_attach()`](https://github.com/neovim/neovim/blob/v0.12.5/runtime/doc/lua.txt#L798-L847)).

### 3.6 `vim.ui` hooks

- **The hooks** are `vim.ui.select()` (with `kind` and `preview_item`), `vim.ui.input()` (with `scope`, new in 0.12), `vim.ui.open()` (the OS handler) and `vim.ui.progress_status()`. Plugins may override `select` to provide a picker ([`:h vim.ui`](https://github.com/neovim/neovim/blob/v0.12.5/runtime/doc/lua.txt#L5107-L5240)).

### 3.7 Styling limits

- **The display is a cell grid.** The default UI model is "a terminal-like grid with a single, monospace font" ([`:h ui-protocol`](https://github.com/neovim/neovim/blob/v0.12.5/runtime/doc/api-ui-events.txt#L15-L20)).
- **Highlight attributes** ([`:h nvim_set_hl()`](https://github.com/neovim/neovim/blob/v0.12.5/runtime/doc/api.txt#L1531-L1590)):
  - Colours: `fg`, `bg` and `sp`, as names or `#RRGGBB`.
  - Text styles: `bold`, `italic`, `underline`, `undercurl`, `underdouble`, `underdotted`, `underdashed`, `strikethrough`, `reverse`, `standout`, `nocombine`, `altfont` and `blend`.
  - New in 0.12: `dim`, `blink`, `conceal` and `overline`.
- **24-bit colour needs `'termguicolors'`**, which Nvim turns on automatically when the host terminal supports it ([`:h 'termguicolors'`](https://github.com/neovim/neovim/blob/v0.12.5/runtime/doc/options.txt#L6798-L6806)).
- **Borders and separators are characters.** Pictures need terminal graphics protocols; see §7.

## 4. Packaging a standalone build

### 4.1 Official release artifacts

Sources: the [v0.12.5 release](https://github.com/neovim/neovim/releases/tag/v0.12.5), the GitHub releases API for sizes and digests, and the experiments marked below.

| Platform | Asset | Size | Notes |
|---|---|---|---|
| macOS arm64 | `nvim-macos-arm64.tar.gz` | 9.6 MB (37 MB unpacked) | Links only system libraries. Ad-hoc signed. `minos 11.0` (observed, E9). |
| macOS x86_64 | `nvim-macos-x86_64.tar.gz` | 9.8 MB | Built with `MACOSX_DEPLOYMENT_TARGET: 11.0` ([release.yml L114](https://github.com/neovim/neovim/blob/v0.12.5/.github/workflows/release.yml#L114)). |
| Linux x86_64, arm64 | `.tar.gz` and `.appimage` | about 11 MB each | x86_64 needs glibc 2.34 or later and only libc, libm and libgcc_s (observed, E9). |
| Windows x64, arm64 | `.zip` and `.msi` | about 12-13 MB | The zip runs from any folder. |

- **macOS install steps.** The release notes tell macOS users to run `xattr -c` on the tarball "to avoid 'unknown developer' warning". The arm64 binary carries only an ad-hoc, linker-generated signature (observed, E9).
- **Linux builds** are made on `ubuntu-22.04` runners ([release.yml L48](https://github.com/neovim/neovim/blob/v0.12.5/.github/workflows/release.yml#L48)). Builds for older glibc exist but are "unsupported" (release notes). The AppImage "might not work if your Linux distribution is more than 4 years old" ([INSTALL.md](https://github.com/neovim/neovim/blob/v0.12.5/INSTALL.md)).
- **INSTALL.md disagrees with the build.** It still says "macOS 10.15+", but the release workflow targets 11.0, and the arm64 binary declares `minos 11.0` (observed, E9).
- **Layout.**
  - The tarball holds `bin/nvim`, `lib/nvim/parser/*.so` and `share/nvim/runtime`, and `$VIMRUNTIME` resolves relative to the binary, so the tree can be moved (observed, E2).
  - For the Windows zip, INSTALL.md says "`$VIMRUNTIME` will be set to that location automatically".
- **Checksums.** Every asset has a `sha256` digest in the GitHub API. The macOS arm64 tarball matched its digest `65fb0000…` (observed).
- **Licence.** Apache 2.0, except for parts contributed under the Vim licence ([LICENSE.txt](https://github.com/neovim/neovim/blob/v0.12.5/LICENSE.txt)).

### 4.2 Not loading the user's own config

**Observed (E1).** A fake user config in scratch XDG directories held an `init.lua`, a `plugin/` file and a `pack/*/start` package:

| Command | User `init.lua` | User `plugin/` and `pack/*/start` | Product init file |
|---|---|---|---|
| `nvim` | loaded | loaded | not loaded |
| `nvim -u cland.lua` | skipped | **loaded** | loaded |
| `nvim --clean -u cland.lua` | skipped | skipped | loaded |
| `nvim -u cland.lua --clean` | skipped | skipped | **not loaded** (order matters) |
| `NVIM_APPNAME=cland nvim` | skipped (reads `~/.config/cland`) | skipped (reads `~/.local/share/cland/site`) | loaded from the cland directories |

- **`--clean`.** It "mimics a fresh install": it skips init files and environment variables, reads and writes no shada, excludes user directories from `'runtimepath'`, and still loads the built-in plugins ([`:h --clean`](https://github.com/neovim/neovim/blob/v0.12.5/runtime/doc/starting.txt#L90-L95)).
  - In the source, `--clean` sets the vimrc to `NONE` and the shada file to `NONE` ([main.c L1190-L1193](https://github.com/neovim/neovim/blob/v0.12.5/src/nvim/main.c#L1190-L1193)), and keeps `'loadplugins'` on ([main.c L480](https://github.com/neovim/neovim/blob/v0.12.5/src/nvim/main.c#L480)).
  - A later `-u FILE` replaces the vimrc but keeps the clean `'runtimepath'`.
- **`-u FILE`.** Only that file is sourced: no system vimrc, no user config, no exrc ([`:h -u`](https://github.com/neovim/neovim/blob/v0.12.5/runtime/doc/starting.txt#L326-L344), [main.c L2217-L2236](https://github.com/neovim/neovim/blob/v0.12.5/src/nvim/main.c#L2217-L2236)). But `'runtimepath'` still contains the user directories, so their `plugin/` files and start packages load at the load-plugins step ([`:h initialization`](https://github.com/neovim/neovim/blob/v0.12.5/runtime/doc/starting.txt#L432-L556)).
- **System directories stay on `'runtimepath'` even with `--clean`.** `runtimepath_default()` drops only the user config and data homes; the `$XDG_CONFIG_DIRS` and `$XDG_DATA_DIRS` entries stay ([runtime.c L1823-L1881](https://github.com/neovim/neovim/blob/v0.12.5/src/nvim/runtime.c#L1823-L1881)).
  - Observed (E2): under `--clean`, `'runtimepath'` still held `/etc/xdg/nvim`, `/usr/local/share/nvim/site`, `/usr/share/nvim/site`, and `/Applications/Ghostty.app/Contents/Resources/ghostty/../nvim/site`. The host terminal added the last one through `$XDG_DATA_DIRS`.
  - With `NVIM_APPNAME=cland`, all of these became `…/cland/…` paths.
- **`$NVIM_APPNAME`.** It sets the sub-directory Nvim reads from, and creates, in each base directory. It accepts a name or a relative path ([`:h $NVIM_APPNAME`](https://github.com/neovim/neovim/blob/v0.12.5/runtime/doc/starting.txt#L1428-L1449)).
  - Observed (E2): `stdpath()` for config, data, state, cache and log, and `config_dirs` and `data_dirs`, all switched to `cland`.
  - On first start Nvim created `~/.local/share/<name>` (empty) and `~/.local/state/<name>` (with `nvim.log` and `shada/`).
- **`'exrc'` is off by default.** When it is on, 0.12 also searches parent directories and runs only files on the `:trust` list ([`:h 'exrc'`](https://github.com/neovim/neovim/blob/v0.12.5/runtime/doc/options.txt#L2614-L2623)).

### 4.3 Bundling a config and plugins

- **Packages.** `pack/*/start/*` load at startup, and `pack/*/opt/*` load with `:packadd`. Both are found through `'packpath'` ([`:h packages`](https://github.com/neovim/neovim/blob/v0.12.5/runtime/doc/pack.txt#L11-L60), [`:h :packadd`](https://github.com/neovim/neovim/blob/v0.12.5/runtime/doc/repeat.txt#L265)). A product can set `'runtimepath'` and `'packpath'` in its `-u` file, or ship files into its `NVIM_APPNAME` directories.
- **`vim.pack` installs at runtime.** It downloads plugins over the network with `git` (§5). Vendoring plugins under a packpath directory avoids downloads at first start; that is an inference, not tested.

### 4.4 Distribution channels and version pinning

- **GitHub.** A version tag such as `v0.12.5` names one release; only the `stable` tag is documented as force-pushed on each release (§1.1). A nightly prerelease exists ([INSTALL.md](https://github.com/neovim/neovim/blob/v0.12.5/INSTALL.md)).
- **Homebrew.** The formula `neovim` is at 0.12.5, revision 1, built from source against shared Homebrew libraries: libuv, luajit, luv, tree-sitter, unibilium, utf8proc, gettext and lpeg. There is no versioned formula; `neovim@0.11` returns 404 ([formulae.brew.sh API](https://formulae.brew.sh/api/formula/neovim.json), read 2026-10-07).
- **nixpkgs.** `neovim-unwrapped` is 0.12.5 on `nixos-unstable` and 0.12.4 on `nixos-26.05` ([package.nix](https://github.com/NixOS/nixpkgs/blob/nixos-unstable/pkgs/by-name/ne/neovim-unwrapped/package.nix), read 2026-10-07).
- **Version checks at runtime.** `has('nvim-0.12.5')` tests the patch level ([`:h has()`](https://github.com/neovim/neovim/blob/v0.12.5/runtime/doc/vimfn.txt#L4658-L4690)), and `vim.version()` returns the running version ([lua.txt L5322](https://github.com/neovim/neovim/blob/v0.12.5/runtime/doc/lua.txt#L5322)).

## 5. Plugin management: `vim.pack`

- **Status.** "WARNING: It is still considered experimental, yet should be stable enough for daily use." It manages only `site/pack/core/opt` under `stdpath('data')`, and needs that `site` directory on `'packpath'`. That may not hold under `--clean` or when `$XDG_DATA_HOME` is set during startup ([`:h vim.pack`](https://github.com/neovim/neovim/blob/v0.12.5/runtime/doc/pack.txt#L208-L235)).
- **Requirements.** A `git` executable is required. Plugin versions are expected as semver tags such as `v1.2.0`.
- **Lockfile.** It lives at `$XDG_CONFIG_HOME/nvim/nvim-pack-lock.json`; in the source, that is `stdpath('config')` ([pack.lua L228-L232](https://github.com/neovim/neovim/blob/v0.12.5/runtime/lua/vim/pack.lua#L228-L232)). Plugins listed in the lockfile are installed at the locked revision on the first `vim.pack` call. The lockfile path is fixed in 0.12.5; `'packlockfile'` exists only on master.
- **API** ([pack.txt L403-L542](https://github.com/neovim/neovim/blob/v0.12.5/runtime/doc/pack.txt#L403-L542)):
  - `vim.pack.add(specs, {confirm, load})`: installs missing plugins in parallel through a partial blobless clone, then runs `:packadd`.
  - `vim.pack.update(names, {force, offline, target = 'version'|'lockfile'})`: shows a confirmation buffer unless `force` is set.
  - `vim.pack.del(names, {force})`.
  - `vim.pack.get(names, {info})`.
  - A spec has `src`, `name`, `version` (a branch, tag, commit or `vim.version.range()`) and `data`.
- **Events and logs.** The `PackChangedPre` and `PackChanged` events carry `kind` (install, update or delete), `spec`, `path` and `active`, and can drive build hooks. Updates are logged to `nvim-pack.log` under `stdpath('log')`.
- **Observed (E8)**, with `NVIM_APPNAME=cland` and scratch XDG directories:
  - `vim.pack.add({{src = 'https://github.com/tpope/vim-surround', version = 'v2.2'}}, {confirm = false})` installed the plugin into `$XDG_DATA_HOME/cland/site/pack/core/opt/vim-surround`.
  - It wrote `$XDG_CONFIG_HOME/cland/nvim-pack-lock.json` with `rev`, `src` and `version`.
  - Progress messages were printed headless.

## 6. Process and networking APIs in Lua

### 6.1 Processes

- **`vim.system(cmd, opts, on_exit)`** runs a process directly, without a shell. It is asynchronous when `on_exit` is given; `:wait()` blocks.
  - Options: `cwd`, `env`, `clear_env`, `stdin` (a string, a list, or `true` for a pipe written with `:write()`), `stdout` and `stderr` callbacks, `text`, `timeout` and `detach`.
  - The child inherits the environment with `NVIM` set to `v:servername` ([`:h vim.system()`](https://github.com/neovim/neovim/blob/v0.12.5/runtime/doc/lua.txt#L4833-L4995)).
- **`jobstart()`** remains the entry point for PTYs (`pty`, `term`) and msgpack-RPC over stdio (`rpc`) ([`:h jobstart()`](https://github.com/neovim/neovim/blob/v0.12.5/runtime/doc/vimfn.txt#L5464-L5557)).

### 6.2 `vim.uv` (libuv through luv)

- **The bindings.** `vim.uv` exposes luv, the libuv bindings that Nvim uses for networking, filesystem and processes ([`:h vim.uv`](https://github.com/neovim/neovim/blob/v0.12.5/runtime/doc/lua.txt#L471-L475)). Observed (E7): luv 1.52.1 on LuaJIT 2.1.1774638290.
- **Handles available:**
  - TCP ([`:h uv.new_tcp()`](https://github.com/neovim/neovim/blob/v0.12.5/runtime/doc/luvref.txt#L1749)) and UDP.
  - Pipes, which are "local domain sockets on Unix and named pipes on Windows" ([`:h uv_pipe_t`](https://github.com/neovim/neovim/blob/v0.12.5/runtime/doc/luvref.txt#L1987-L1990)).
  - Timers ([`:h uv.new_timer()`](https://github.com/neovim/neovim/blob/v0.12.5/runtime/doc/luvref.txt#L794)).
  - File-system events ([`:h uv.new_fs_event()`](https://github.com/neovim/neovim/blob/v0.12.5/runtime/doc/luvref.txt#L2775)).
  - Process spawning, signals, DNS, the work queue and threads ([`:h uv.new_thread()`](https://github.com/neovim/neovim/blob/v0.12.5/runtime/doc/luvref.txt#L3766)).
  - The help includes a TCP echo-server example and a file-watch example ([`:h tcp-server`](https://github.com/neovim/neovim/blob/v0.12.5/runtime/doc/lua.txt#L551-L578), [`:h watch-file`](https://github.com/neovim/neovim/blob/v0.12.5/runtime/doc/lua.txt#L513-L537)). Linux users may need to raise inotify limits ([`:h inotify-limitations`](https://github.com/neovim/neovim/blob/v0.12.5/runtime/doc/lua.txt#L538-L549)).
- **Callbacks run in a fast context.** Calling most of `vim.api` there is error E5560, so the work must be scheduled with `vim.schedule()`, `vim.schedule_wrap()` or `vim.defer_fn()` ([`:h lua-loop-callbacks`](https://github.com/neovim/neovim/blob/v0.12.5/runtime/doc/lua.txt#L477-L496), [`:h api-fast`](https://github.com/neovim/neovim/blob/v0.12.5/runtime/doc/api.txt#L157-L168)).
- **Threads.** `vim.uv.new_thread` runs a separate Lua state with no editor access. A subset of `vim.*` is available there, including `vim.uv`, `vim.json` and `vim.mpack` ([`:h lua-loop-threading`](https://github.com/neovim/neovim/blob/v0.12.5/runtime/doc/lua.txt#L580-L598)).

### 6.3 msgpack-RPC

- **The protocol is msgpack-RPC with two extra constraints:** responses come in reverse order of requests, and messages are processed in arrival order ([`:h api-rpc`](https://github.com/neovim/neovim/blob/v0.12.5/runtime/doc/api.txt#L17-L40)).
- **Nvim as a server.**
  - It opens a default socket at startup, named in `v:servername`. `--listen ADDR` takes a pipe path (a Unix domain socket on Unix, a named pipe on Windows) or a `host:port`, and `serverstart()` and `serverstop()` add and remove endpoints ([`:h rpc-connecting`](https://github.com/neovim/neovim/blob/v0.12.5/runtime/doc/api.txt#L42-L55), [`:h --listen`](https://github.com/neovim/neovim/blob/v0.12.5/runtime/doc/starting.txt#L423-L430), [`:h serverstart()`](https://github.com/neovim/neovim/blob/v0.12.5/runtime/doc/vimfn.txt#L8793-L8830)).
  - The help warns that localhost TCP sockets "are generally less secure than named pipes, and can lead to vulnerabilities like remote code execution".
  - `serverlist({peer = true})` also lists servers not started by `serverstart()`; this is new in 0.12 and not supported on Windows ([`:h serverlist()`](https://github.com/neovim/neovim/blob/v0.12.5/runtime/doc/vimfn.txt#L8773-L8790)).
- **Nvim as a client.** `sockconnect('pipe'|'tcp', addr, {rpc = true})` connects out; without `rpc` the channel carries raw bytes ([`:h sockconnect()`](https://github.com/neovim/neovim/blob/v0.12.5/runtime/doc/vimfn.txt#L10079-L10110)). There is no WebSocket client in the runtime or source: a search for "websocket" matched only syntax files.
- **Calls and identity.**
  - `vim.rpcrequest()` blocks until the reply arrives. `vim.rpcnotify()` returns at once, works in fast callbacks, and broadcasts to every channel when given channel 0 (since 0.11) ([`:h vim.rpcnotify()`](https://github.com/neovim/neovim/blob/v0.12.5/runtime/doc/lua.txt#L695-L717), [news-0.11 L20-L25](https://github.com/neovim/neovim/blob/v0.12.5/runtime/doc/news-0.11.txt#L20-L25)).
  - `nvim_set_client_info()` names a client and its type: `embedder`, `host`, `msgpack-rpc`, `plugin`, `remote` or `ui` ([`:h nvim_set_client_info()`](https://github.com/neovim/neovim/blob/v0.12.5/runtime/doc/api.txt#L1419-L1480)).
  - `nvim_exec_lua()` runs Lua over RPC ([api.txt L754](https://github.com/neovim/neovim/blob/v0.12.5/runtime/doc/api.txt#L754-L780)). `nvim__exec_lua_fast()`, experimental and new in 0.12, can run during fast contexts ([api.txt L1723](https://github.com/neovim/neovim/blob/v0.12.5/runtime/doc/api.txt#L1723-L1745)).
  - `nvim_buf_attach()` streams buffer changes ([api.txt L2316](https://github.com/neovim/neovim/blob/v0.12.5/runtime/doc/api.txt#L2316)). The `ChanOpen` and `ChanInfo` events fire as channels change ([autocmd.txt L405-L420](https://github.com/neovim/neovim/blob/v0.12.5/runtime/doc/autocmd.txt#L405-L420)).
- **Startup modes for embedders** ([`:h --embed`](https://github.com/neovim/neovim/blob/v0.12.5/runtime/doc/starting.txt#L381-L421)):
  - `--embed` serves RPC on stdio and waits for `nvim_ui_attach()` before loading config.
  - `--embed --headless` serves non-UI embedders.
  - `--embed --listen ADDR` puts the UI protocol on a socket.
- **A terminal program can call back into Nvim.** Observed (E6): a program inside `:terminal` ran `nvim --server "$NVIM" --remote-expr "g:cland_probe"` and got the parent's variable back. Any script a harness launches inside an Nvim terminal can therefore reach that Nvim over RPC ([`:h --server`](https://github.com/neovim/neovim/blob/v0.12.5/runtime/doc/remote.txt#L55-L63)).
- **A Node client is maintained.** The official client, [neovim/node-client](https://github.com/neovim/node-client) (npm `neovim` 5.5.0, published 2026-09-11), had its last push on 2026-10-05.

### 6.4 HTTP

- **`vim.net.request(url, opts, on_response)` performs an asynchronous HTTP GET in 0.12.5.** The body goes to the callback, `outpath` or `outbuf`, and `retry` defaults to 3 ([`:h vim.net.request()`](https://github.com/neovim/neovim/blob/v0.12.5/runtime/doc/lua.txt#L4198-L4252)). It runs the `curl` executable through `vim.system` ([net.lua L58-L81](https://github.com/neovim/neovim/blob/v0.12.5/runtime/lua/vim/net.lua#L58-L81)). There is no way to set headers or other methods in 0.12.5; both exist only on master (§1.5).

### 6.5 JSON and other codecs

- **`vim.json.encode()` and `vim.json.decode()`.**
  - JSON `null` decodes to `vim.NIL`, or to `nil` with `luanil`. An empty object decodes to `vim.empty_dict()`.
  - New in 0.12: `indent` and `sort_keys` for encoding, and `skip_comments` for decoding ([`:h vim.json`](https://github.com/neovim/neovim/blob/v0.12.5/runtime/doc/lua.txt#L3577-L3640)).
  - `vim.mpack` and `vim.base64` also exist ([lua.txt L4172](https://github.com/neovim/neovim/blob/v0.12.5/runtime/doc/lua.txt#L4172), [L2272](https://github.com/neovim/neovim/blob/v0.12.5/runtime/doc/lua.txt#L2272)).

### 6.6 SQLite

- **Nvim has no SQLite module.** A search of the runtime and `src/nvim` found nothing beyond SQL syntax and filetype support.
- **LuaJIT with FFI is available.** Plugins should check the `jit` global before relying on it ([`:h lua-luajit`](https://github.com/neovim/neovim/blob/v0.12.5/runtime/doc/lua.txt#L36-L51)). Observed (E7): `ffi.load('sqlite3')` worked against the macOS system library and returned `sqlite3_libversion()` = 3.54.0.
- **sqlite.lua** is a LuaJIT FFI binding that needs a system `libsqlite3`. Windows users set `g:sqlite_clib_path` ([README](https://github.com/kkharji/sqlite.lua)). Its last push was 2025-03-14 (GitHub API), and its compatibility with 0.12.5 was not tested.
- **Other routes:** run the `sqlite3` CLI through `vim.system()`, or leave storage to the Hub. The BCAS hub already uses SQLite ([#2](https://github.com/Kealman/cland-v0/issues/2)).

### 6.7 Async patterns

- **Callbacks plus scheduling.** `vim.schedule()`, `vim.schedule_wrap()` and `vim.defer_fn()` cover the basics ([lua.txt L719](https://github.com/neovim/neovim/blob/v0.12.5/runtime/doc/lua.txt#L719-L730), [L1276](https://github.com/neovim/neovim/blob/v0.12.5/runtime/doc/lua.txt#L1276), [L1461](https://github.com/neovim/neovim/blob/v0.12.5/runtime/doc/lua.txt#L1461)).
- **`vim.wait()`** polls a condition "while Nvim processes other events" and cannot be called in a fast context ([`:h vim.wait()`](https://github.com/neovim/neovim/blob/v0.12.5/runtime/doc/lua.txt#L856-L899)). `SystemObj:wait()` blocks until the process exits.
- **Coroutines** are plain Lua. Nvim 0.12.5 ships a private `vim._async`, used internally (observed present, E7). The help says underscore-prefixed functions "are internal/private and must not be used by plugins" ([lua.txt L467-L468](https://github.com/neovim/neovim/blob/v0.12.5/runtime/doc/lua.txt#L467-L468)). The public `vim.async` exists only on master (§1.5).

## 7. Rendering richer content in the terminal

### 7.1 Images

- **Inside Nvim windows, 0.12.5 has no first-party image API.**
  - Its building blocks are `nvim_ui_send()`, which writes raw escape sequences such as Kitty graphics commands to the host terminal (§1.2), and `TermResponse`, which now delivers APC replies for capability queries ([news L416](https://github.com/neovim/neovim/blob/v0.12.5/runtime/doc/news.txt#L416)).
  - Master adds the experimental `vim.ui.img.set/get/del`, which places PNG images at screen row and column with a `zindex` through the Kitty graphics protocol (§1.5).
- **image.nvim** ([3rd/image.nvim](https://github.com/3rd/image.nvim), last push 2026-09-04) offers backends for the Kitty graphics protocol (Kitty 28.0 or later recommended), Überzug++, and sixel. It needs ImageMagick, through the CLI or the `magick` rock.
- **snacks.nvim image** ([docs/image.md](https://github.com/folke/snacks.nvim/blob/main/docs/image.md), last push 2026-05-25) uses the Kitty graphics protocol.
  - It lists kitty, ghostty and wezterm (limited, no inline images) and tmux (passthrough); zellij is not supported.
  - It renders inline images in Markdown, HTML and other formats, and needs ImageMagick for every format except PNG.
- **Inside `:terminal`, images do not render.** Image sequences from a program are not drawn and surface only as `TermRequest` events (§2.7).

### 7.2 Markdown

- **First-party:** treesitter highlighting with conceal, on by default for Markdown in 0.12, with bundled parsers (§3.2).
- **Plugins:** [render-markdown.nvim](https://github.com/MeanderingProgrammer/render-markdown.nvim) needs Neovim 0.9 or later (0.10 or later recommended) and treesitter parsers; last push 2026-10-06. [markview.nvim](https://github.com/OXY2DEV/markview.nvim) previews Markdown, Typst, LaTeX, inline HTML and AsciiDoc; last push 2026-09-17. Neither was tested here.

### 7.3 Hyperlinks and HTML

- **Hyperlinks.** An extmark's `url` becomes an OSC 8 link in the TUI (§3.3), and `:terminal` passes programs' OSC 8 links through (§2.7). `vim.ui.open()` hands a path or URL to the OS handler: `open`, `xdg-open` or `explorer.exe` ([`:h vim.ui.open()`](https://github.com/neovim/neovim/blob/v0.12.5/runtime/doc/lua.txt#L5143-L5176)).
- **HTML.** Nvim has no HTML renderer. `:TOhtml` goes the other way, from buffer to HTML, and is opt-in in 0.12 (§1.3).

## Implications for the host-versus-component prototype

Ticket [#11](https://github.com/Kealman/cland-v0/issues/11) names three showstoppers. "Host" means cland lives inside Neovim as Lua, shipped as a standalone build. "Component" means Neovim is embedded in a program we write. This section collects facts and risks only; it makes no decision.

### Showstopper 1: interactive harness Sessions in built-in terminals

- **Supported today:**
  - Many PTY terminals in parallel (E3).
  - PTY size following window size, with SIGWINCH (E4).
  - Mouse, bracketed paste and focus forwarding, and DEC 2026 synchronized output (§2.3, §2.6).
  - OSC 8 and OSC 52 copy, and hooks for OSC, DCS and APC sequences.
  - A callback path from a terminal program to Nvim through `$NVIM` (E6).
- **Risks** (§2):
  - Key fidelity: the host gets kitty flags 1 and 2 only, and the child side supports only the kitty disambiguate mode.
  - TAB and ESC are stripped from pastes by default.
  - OSC 10 and 11 replies are fixed colours.
  - There are no image protocols.
  - Alternate-screen apps leave no scrollback.
  - Scrollback is not reflowed.
  - Open rendering issues include one reported with Claude Code (#40915).
  - A crash report with Codex was closed without an identified fix (#40069).
  - Terminal contents are lost on restart (#40017).
  - The planned libvterm replacement (#39773, draft) would change the emulator.
- **Not exercised here:** the three harnesses themselves (Claude Code, Codex, OpenCode) running in `:terminal`, interactive key delivery from a real host terminal, and rendering quality. All of that needs the TUI and is the prototype's job.

### Showstopper 2: a chat panel with topics in Neovim primitives

- **Available** (§3): splits and floats with borders, titles and statuslines; prompt buffers documented for chat UIs, with Shift-Enter multi-line input; extmarks with virtual text and lines; clickable winbar, statusline and statuscolumn; progress messages and `'busy'`; and treesitter Markdown with conceal.
- **Risks:**
  - Everything is a monospace cell grid.
  - Virtual lines do not wrap in 0.12.5.
  - The message and cmdline layer is mid-redesign (`ui2` experimental, message events changed in 0.12).
  - Images only through Kitty-protocol plugins, or `vim.ui.img` on master.

### Showstopper 3: a standalone build that ignores the user's config

- **Available** (§4): relocatable official tarballs (the macOS arm64 binary links system libraries only; the Linux x86_64 one needs glibc 2.34 or later), and `NVIM_APPNAME` isolation of every XDG path (E1, E2).
- **Risks:**
  - `-u` alone leaks the user's `plugin/` files and packages.
  - `--clean -u` depends on argument order.
  - `$XDG_DATA_DIRS` entries added by third parties stay on `'runtimepath'` unless `NVIM_APPNAME` renames them (E2).
  - The macOS arm64 binary is only ad-hoc signed (E9); the release notes say to run `xattr -c` "to avoid 'unknown developer' warning".
  - `vim.pack` needs `git` and the network on first start, and its lockfile path is fixed under the config directory in 0.12.5.

### Facts that differ between the two options

- **Host** (Lua inside Nvim):
  - All of §2 and §3 applies directly.
  - Lua runs on the editor's main loop. libuv callbacks are fast-context and must schedule editor work (§6.2), and `vim.rpcrequest()` and `SystemObj:wait()` block.
  - Harness Sessions started with `jobstart(…, {term = true})` are children of the Nvim server, so they end on `:restart` or exit (§2.2).
  - `:detach` and `:connect` let UIs leave and rejoin a running server ([`:h :detach`](https://github.com/neovim/neovim/blob/v0.12.5/runtime/doc/gui.txt#L62-L76), [`:h :connect`](https://github.com/neovim/neovim/blob/v0.12.5/runtime/doc/gui.txt#L109-L120)). Jobs are children of that server, so they should keep running while it does; this is an inference, not tested.
- **Component** (Nvim embedded in our program):
  - The built-in TUI is itself a client of an `nvim --embed` server ([`:h startup-tui`](https://github.com/neovim/neovim/blob/v0.12.5/runtime/doc/tui.txt#L16-L35)).
  - An embedding host calls `nvim_ui_attach()` and must render `redraw` grid batches, optionally with `ext_multigrid`, `ext_messages`, `ext_cmdline`, `ext_popupmenu` and `ext_tabline` ([`:h ui-option`](https://github.com/neovim/neovim/blob/v0.12.5/runtime/doc/api-ui-events.txt#L23-L120)).
  - When several UIs attach, the active capabilities are the intersection of what each requested, unless `override` is set.
  - Terminal buffers inside an embedded Nvim are still libvterm, drawn into the grid.
  - If the host runs harness PTYs itself, it needs its own terminal emulator. Alternatively it feeds bytes to Nvim with `nvim_open_term()`, which has no resize callback in 0.12.5 or on master (§2.1).
  - Everything the TUI does for the host terminal would need to be re-done by the host: key encoding, bracketed paste, OSC 52 and OSC 8, and images.
  - The map rules out "A GUI outside the terminal" for v0 ([#1](https://github.com/Kealman/cland-v0/issues/1)), so a component host would itself be a terminal program.
- **Hub transport, either way** (§6):
  - msgpack-RPC over a Unix socket or named pipe in either direction, with the maintained npm `neovim` client on the Node side.
  - Raw bytes or JSON over `vim.uv` TCP and pipes.
  - HTTP GET only, through curl.
  - No built-in WebSocket client. The BCAS hub's spoke protocol is WebSocket ([#2](https://github.com/Kealman/cland-v0/issues/2)).

## Appendix A: Method and conventions

- **Primary sources only:** the Neovim help files, the source and `.github/workflows` at tag `v0.12.5`; the GitHub release notes and changelog commits; GitHub issues, PRs and milestones read through `gh` on 2026-10-07; the master news file at commit `27ee55c09d08`; and the official Homebrew and nixpkgs package metadata.
- **Binary used.** All experiments ran on the official `nvim-macos-arm64.tar.gz` for v0.12.5, sha256 `65fb000099e4…`, matching the GitHub digest. Every run was `--headless` on macOS (Darwin 27, arm64), with scratch XDG directories where config or plugins were involved. Headless runs exercise the terminal emulator, PTYs and Lua APIs, but not the TUI, the host terminal or rendering.
- **The experiments:**
  - **E1:** which user files load under `nvim`, `-u`, `--clean -u`, `-u … --clean` and `NVIM_APPNAME`, using a fake user config with an init file, a `plugin/` file and a start package.
  - **E2:** `'runtimepath'`, `'packpath'`, `stdpath()` and `$VIMRUNTIME` under `--clean` and under `NVIM_APPNAME`.
  - **E3:** in `:terminal`, which escape sequences raise `TermRequest`; scrollback trimming at `'scrollback'=1000`; 20 parallel terminal jobs; `stty size` in a 50×10 float; and `jobstart` with `pty`, `width` and `height`.
  - **E4:** SIGWINCH on window resize, and the size rule with two windows on one terminal buffer.
  - **E5:** capability queries (DA1, XTVERSION, DECRQM, kitty keyboard, XTWINOPS, OSC 11, a Kitty graphics query, DECRQSS) sent from a script inside `:terminal`.
  - **E6:** the child environment (`TERM`, `COLORTERM`, `VIMRUNTIME`, `NVIM`) and an RPC call back into the parent with `nvim --server "$NVIM" --remote-expr`.
  - **E7:** the LuaJIT and FFI versions, `ffi.load('sqlite3')`, the luv version, and whether `vim.pack`, `vim.net`, `vim._async`, `vim.async`, `ui2`, `vim.ui.img`, `nvim_ui_send` and `termopen` exist.
  - **E8:** `vim.pack.add()` with `NVIM_APPNAME`: install location and lockfile contents.
  - **E9:** binary inspection. `otool -L` and `otool -l` gave the macOS libraries and `minos`; `codesign -dv` showed the ad-hoc signature; `objdump -p` on the Linux x86_64 binary gave `NEEDED` libraries and the highest `GLIBC_2.34` symbol version.

## Appendix B: Not verified

- **The harnesses themselves.** How Claude Code, Codex and OpenCode behave inside `:terminal`, including whether they enable kitty disambiguation (which decides Shift+Enter), whether they use the alternate screen, and their rendering. This was not run.
- **Anything needing the TUI and a host terminal:** real key delivery, the rendering glitch in #40915, performance under heavy output (#11090), and how images from plugins look.
- **Linux and Windows at runtime.** The Linux binary was only inspected statically, and the glibc floor of 2.34 is inferred from symbol versions, not stated by the project. The macOS x86_64 binary was not inspected; its deployment target is taken from the workflow.
- **Plugin compatibility.** sqlite.lua, image.nvim, snacks.nvim, render-markdown.nvim and markview.nvim were not tested on 0.12.5; their facts come from their own READMEs.
- **Dates.** Whether 0.13 ships near its milestone date (2026-10-15), and whether master items listed in §1.5 survive into the release.
- **Detached servers and jobs.** That terminal jobs survive `:detach` is an inference from the docs and process model, not a test.
