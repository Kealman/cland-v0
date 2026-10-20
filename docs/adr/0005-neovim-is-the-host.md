# Neovim is the host

cland lives inside Neovim as Lua and ships as a standalone build of the official Neovim release (0.12.5 at the time of the decision), started under its own `NVIM_APPNAME=cland-nvim` with `--clean -u`, so the user's own Neovim configuration never loads. Neovim's state, data and log paths are separate from the hub's per-user `cland` directory (T-830); the first start moves only workbench-owned legacy UI and restart files, preserves existing destinations and leaves hub files untouched. A feasibility prototype (branch `prototype/nvim-host`, ticket #11) passed the three showstoppers: many interactive harness sessions in built-in terminals, a chat panel built from Neovim's own UI primitives (including floats over streaming terminals), and a standalone start; the human's checklist with the real harnesses passed too.

## Considered options

- **Neovim as an embedded component** inside a host we write, over `--embed` and msgpack-RPC: rejected. It would re-implement the TUI's work (grid rendering, key encoding, OSC 52 and OSC 8, images) and would not remove any of the prototype's failures, which all sit in libvterm and would remain in an embedded Neovim.

## Consequences

The failures the prototype found are handled in cland's own configuration and design:

- Shift+Enter reaches a harness as plain Enter unless it enables the kitty keyboard mode; cland maps `<S-CR>` in terminal mode to `ESC[13;2u`.
- Pastes drop TABs by default; cland sets `'termpastefilter'` to `BS,ESC,DEL`.
- Terminals created at startup get a scrollback cap of 1,000,000 lines, which slows heavy output 33 times; cland sets the cap to 10,000 itself.
- Neovim-owned terminals die on `:restart`; sessions are owned outside Neovim (harness servers, `attach` commands) and the terminal only attaches, so `:restart` re-attaches them.
- Alternate-screen output never reaches scrollback; history for full-screen harness TUIs comes from the harness itself.
- Outside requests and scheduled UI updates wait while the user has input pending; cland never produces hit-enter prompts and applies UI updates through `vim.schedule`.
- A terminal window one row high keeps no scrollback; cland never tiles a session below three rows.
