# Manual checklist: Neovim as host (ticket #11, PROTOTYPE)

The automated checks (`checks/run-checks.sh`, captures in `evidence/`, results in the "Prototype ready for the human's verdict" comment on [#11](https://github.com/Kealman/cland-v0/issues/11)) used stand-in programs inside tmux. These items need a real terminal (Ghostty) and the real harnesses. Starting a harness costs nothing; sending it a prompt does, so keep the prompts short.

## Setup

1. From the repo root: `git checkout prototype/nvim-host`, then `prototypes/nvim-host/run.sh` in Ghostty. The first run downloads Neovim 0.12.5 into `prototypes/nvim-host/.nvim/` and prints the exact command it runs.
2. `<Space>?` shows the keys. To leave Terminal mode press `<C-\><C-n>`. `<C-\>c` goes to the composer and `<C-\>j` to the focused session. Both work from any mode.
3. Write each result in the table at the bottom (pass / fail / notes), then paste the table into a comment on [#11](https://github.com/Kealman/cland-v0/issues/11).

## Items

### 1. Shift+Enter multi-line input in each harness

- **Do:** `<Space>1` starts Claude Code. Type `line one`, press Shift+Enter, type `line two`, then check the input box. Repeat with `<Space>2` (Codex) and `<Space>3` (OpenCode).
  - Then run `:ClandShiftEnter csi-u` (Shift+Enter is sent as `ESC [ 13 ; 2 u`) and try again in each harness.
  - Then try `:ClandShiftEnter esc-cr` (sent as ESC CR). Also try Alt+Enter and Ctrl+J with the mode `off`; Alt+Enter needs Ghostty's `macos-option-as-alt`.
- **Look for:** a second line appears in the input and nothing is submitted. Note which mode works for which harness.
- **Background:** with the mode `off`, Shift+Enter reaches the harness as plain Enter unless the harness turns on kitty "disambiguate" (check b). The statusline shows the current mode (`S-Enter:`).

### 2. Pasting a multi-line prompt with TABs

- **Do:** copy the text of `prototypes/nvim-host/checks/paste-sample.txt` (three lines, two with TABs) from another window. Paste it with Cmd+V into each harness's input.
  - Then run `:set termpastefilter=BS,ESC,DEL` and paste again.
- **Look for:** the three lines arrive as one input and nothing is sent line by line. Check whether the TABs survive: the default `'termpastefilter'` removes them (check c), and `BS,ESC,DEL` keeps them.

### 3. The ask dialog over a live harness

- **Do:** in Claude Code, get a conversation longer than the window: one short prompt, for example "print the numbers 1 to 80, one per line". From Terminal mode press `<C-\>a`, wait two seconds, press `q`, then type into the Claude Code input.
  - Then the exact steps of neovim#40915: `:luafile prototypes/nvim-host/checks/repro-40915.lua`, `<C-\><C-n>`, `<Space>k`, `i`, and type.
- **Look for:** after the float closes, the Claude Code screen and the typed text line up. Note any leftover border or misplaced text. The automated check d with stand-ins found none.

### 4. The feel of switching between chat and sessions

- **Do:** have two or three sessions open (`<Space>s`, `<Space>1` …). Move between them with `<C-\>n` / `<C-\>p` and back to the composer with `<C-\>c`. Pick a topic in the left column with `<C-\>l`, `j`/`k` and Enter, and send a message from the composer with Enter. Try `<Space>T` to tile all sessions.
- **Look for:**
  - Whether the switching is quick.
  - Whether you lose track of Terminal versus Normal mode.
  - Whether keys land where you expect.
  - Whether the statusline and winbars tell you what is focused.

### 5. `:restart` with a real harness attached through tmux

- **Do:**
  1. `<Space>t1` starts Claude Code inside a tmux session (`cland-claude` on the socket `cland-proto`). Send it one short prompt.
  2. `<C-\><C-n>`, then `:restart`.
  3. Then `:restart!`, then `<Space>t1` again.
  4. For contrast, do the same with a Neovim-owned `<Space>1` session.
- **Look for:**
  - After `:restart`, the same Claude Code conversation is back in the session column, already re-attached.
  - After `:restart!`, `<Space>t1` re-attaches to it.
  - The Neovim-owned session comes back as a fresh Claude Code with the conversation gone (check e).
  - Note anything odd in the re-attached TUI: size, colours, keys. Shift+Enter through tmux needs `:ClandShiftEnter csi-u` (check b-7).
  - Also press Shift+Tab, which cycles modes in Claude Code. With `extended-keys always`, tmux sends it as `ESC [ 9 ; 2 u` (check b-6), so a harness that does not parse that form would miss it.
- **Cleanup:** `tmux -L cland-proto kill-server`.

### 6. History in each harness

- **Do:** after a long answer in each harness, `<C-\><C-n>`, then `gg` or `/` to search in the session buffer. Also scroll with the mouse wheel.
- **Look for:** whether the earlier output is in the buffer. Full-screen (alternate-screen) programs leave no scrollback (check f). For tmux-owned sessions the history lives in tmux, not in the Neovim buffer.

## Cleanup after testing

`tmux -L cland-proto kill-server`; `rm -rf ~/.local/state/cland-proto` (created by `NVIM_APPNAME=cland-proto`); `rm -rf prototypes/nvim-host/.nvim prototypes/nvim-host/.run` (the download and run state, both gitignored).

## Results

| # | Item | Claude Code | Codex | OpenCode | Notes |
|---|---|---|---|---|---|
| 1 | Shift+Enter, mode off |  |  |  |  |
| 1 | Shift+Enter, `csi-u` / `esc-cr` |  |  |  |  |
| 1 | Alt+Enter / Ctrl+J |  |  |  |  |
| 2 | Paste with TABs, default filter |  |  |  |  |
| 2 | Paste with TABs, `BS,ESC,DEL` |  |  |  |  |
| 3 | Ask float over a live harness |  | n/a | n/a |  |
| 3 | neovim#40915 exact steps |  | n/a | n/a |  |
| 4 | Feel of switching | n/a | n/a | n/a |  |
| 5 | `:restart` with tmux-owned session |  |  |  |  |
| 6 | History in the session buffer |  |  |  |  |
