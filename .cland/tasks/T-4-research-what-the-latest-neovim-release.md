---
id: T-4
kind: question
title: "Research: what the latest Neovim release offers as the cland engine"
state: closed
labels:
  - wayfinder:research
assignee: null
parent: T-1
blocked_by: []
topic: null
branch: null
created: 2026-10-07T14:51:53Z
updated: 2026-10-08T13:17:15.588Z
github:
  repo: Kealman/cland-v0
  number: 4
  url: https://github.com/Kealman/cland-v0/issues/4
---

## Question

What does the latest Neovim release offer that bears on using Neovim as the cland engine? Identify the current stable version and what the recent "big update" contained, then assess:

- The built-in terminal: running interactive harness TUIs inside Neovim, input passthrough, scrollback, resize, many terminals at once.
- UI extension points for a custom chat panel with topics: floating and split windows, virtual text, extmarks, winbar and statusline, any new UI features.
- Packaging a standalone, self-contained build: `NVIM_APPNAME`, `--clean -u`, bundling a config and plugins, release artifacts per platform.
- Plugin management (`vim.pack` or equivalent).
- Process and networking APIs in Lua: `vim.system`, `vim.uv`, sockets, msgpack-RPC, `--embed`, `--listen`.
- Rendering images or HTML-like content in the terminal.

Primary sources: Neovim docs, release notes, source. Record the version examined.

## Comments

### Kealman · 2026-10-07T15:45:55Z

<!-- github-comment: 6041430390 -->

## Resolution

**Bottom line.** The current stable release is **Neovim 0.12.5** (2026-08-23), a patch release of 0.12. Version 0.12.0 (2026-03-29) is the big update; 0.13 is on `master`, and its milestone is due 2026-10-15.

- 0.12 provides most of what cland needs as Lua-level primitives, and a standalone build is workable with `NVIM_APPNAME`.
- The weakest area is the built-in terminal, which is still libvterm. It runs several harness TUIs at once, but key fidelity is limited, pastes lose TAB and ESC by default, it renders no images, and its contents are lost on restart.
- The local machine has `nvim v0.11.2`, which is older. All checks used the official 0.12.5 build.

**Findings that matter most for the engine decision**

1. **Version and pinning.** 0.12.5 is the stable release (tag `v0.12.5`, commit `5885a30`). The `stable` tag is force-pushed on every release, so a build should pin `vX.Y.Z`. The online manual at neovim.io/doc tracks `master`, not the release. Patch releases can contain breaking changes: 0.12.5 changed `:restart`.
2. **Many terminals at once.** 20 PTY terminals ran in parallel (observed). The API is `jobstart(cmd, {term = true})`; `termopen()` has been deprecated since 0.11.
3. **Resize.** A PTY takes the largest width and the largest height among the windows showing its buffer, and SIGWINCH is delivered on window resize (observed).
4. **Key fidelity.**
   - The TUI asks the host terminal for kitty keyboard flags 1 and 2 only, so `<S-Space>` cannot be told from `<Space>`.
   - The embedded terminal implements only the kitty "disambiguate" mode. Shift+Enter therefore reaches a harness as a distinct key only if the harness turns that mode on; otherwise it arrives as a plain CR (from the source).
5. **Paste and colour queries.**
   - `'termpastefilter'` defaults to `BS,HT,ESC,DEL`, so every paste into a terminal loses its TAB characters.
   - Bracketed-paste markers are sent only if the program enabled mode 2004.
   - OSC 10 and 11 colour queries get a fixed black or white answer.
6. **Scrollback.** The default is 10,000 lines and the maximum is 1,000,000 (raised in 0.12). Alternate-screen output never reaches scrollback, and lines in scrollback are not reflowed on resize.
7. **Escape sequences.** OSC 8 links and OSC 52 copy work, and OSC, DCS and APC sequences surface as `TermRequest` events. Kitty graphics, sixel and iTerm2 images are not drawn inside `:terminal` (observed), and there is no pixel-size reporting.
8. **Terminal risks.**
   - Open: #40915, a float over a terminal leaves it misrendered, reported with Claude Code; #11090, large output slows the editor; #40017, terminal contents are lost on restart.
   - #40069, a crash with Codex, was closed without an identified fix.
   - Replacing libvterm with libghostty-vt is a draft PR (#39773) with no milestone.
9. **Chat panel primitives.**
   - Available: splits and floats with borders and titles (floats can show a statusline since 0.12); extmarks with virtual text and lines, `conceal_lines` and `url`; winbar, statusline and statuscolumn with click handlers; and treesitter Markdown with conceal by default.
   - `buftype=prompt` is documented for "chat UI", with multi-line input, Shift-Enter and `prompt_appendbuf()`.
   - Limits: a monospace cell grid, and virtual lines that do not wrap in 0.12.5.
10. **Messages and cmdline are changing.** `ui2` is experimental, the message events of the UI protocol changed in 0.12, and `vim.ui_attach()` is experimental.
11. **Release artifacts.**
    - The official tarballs are relocatable.
    - The macOS arm64 binary links only system libraries, is only ad-hoc signed, and declares `minos 11.0`.
    - The Linux x86_64 binary needs glibc 2.34 or later.
    - The Homebrew build is linked against shared Homebrew libraries.
12. **Config isolation (observed).**
    - `NVIM_APPNAME=cland` isolates every XDG path.
    - `-u file` alone still loads the user's `plugin/` files and `pack/*/start` packages.
    - `--clean -u file` works; `-u file --clean` does not source the file.
    - Under `--clean`, system `$XDG_DATA_DIRS` entries stay on `'runtimepath'`; on this machine that included one added by Ghostty.
13. **Plugin management.** `vim.pack` is built in and experimental, and uses Git. Its lockfile lives at `stdpath('config')/nvim-pack-lock.json`, a path that is fixed in 0.12.5. Installing needs `git` and the network; vendoring plugins under a packpath directory avoids that (inference).
14. **Processes and networking.**
    - Available: `vim.system()`; `vim.uv` (TCP, Unix sockets and named pipes, timers, file events, threads); msgpack-RPC as server and client (`--listen`, `serverstart()`, `sockconnect()`, `--embed`); and `vim.json`.
    - Programs in a terminal get `$NVIM` and can make RPC calls back into Nvim (observed).
    - Gaps: `vim.net.request()` is GET-only and runs `curl`. There is no WebSocket client and no SQLite module, but FFI to libsqlite3 works.
15. **Host versus component.**
    - Terminals inside Nvim die with the Nvim server, on `:restart` or exit.
    - For a PTY owned by the host, `nvim_open_term()` has no resize callback, in 0.12.5 or on `master`.
    - Embedding Nvim as a component means rendering the UI protocol grid and redoing what the TUI does: key encoding, OSC 52 and OSC 8, and images.
    - On `master`, unreleased: `vim.async`, `vim.ui.img` (PNG through Kitty graphics) and wrapping virtual lines.

Full findings with sources: `docs/research/neovim-engine.md` on branch `research/neovim-engine` (https://github.com/Kealman/cland-v0/tree/research/neovim-engine).
