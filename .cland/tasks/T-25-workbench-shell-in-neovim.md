---
id: T-25
kind: task
title: Workbench shell in Neovim
state: open
labels:
  - ready-for-agent
  - slice-1
assignee: null
parent: T-19
blocked_by:
  - T-24
topic: null
branch: null
created: 2026-10-08T11:53:51Z
updated: 2026-10-08T13:17:15.601Z
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
