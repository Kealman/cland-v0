---
id: Q-85
kind: question
title: Free keys in the three harness TUIs for focus moves and leaving a terminal
state: closed
labels:
  - wayfinder:research
assignee: human
parent: M-81
blocked_by: []
topic: null
branch: null
created: 2026-10-09T19:09:39.577Z
updated: 2026-10-09T20:30:34.182Z
closed: 2026-10-09T20:30:34.183Z
---

## Question

Which key chords are free across the TUIs of Claude Code, Codex and OpenCode, the terminal emulators in use (Ghostty; tmux when present) and Neovim's terminal mode, so that cland can bind four focus moves that work in every mode and one key that leaves a session's terminal without the harness ever seeing it?

## Context

Settled while charting: `C-h/j/k/l` are to move focus between windows in every mode, terminal included, so that leaving a session is a move; Esc always goes to the harness (a double Esc is an interrupt for some harnesses, so no cland binding may involve Esc); one "leave terminal" key never reaches the harness. Today a terminal is left only with `C-\ C-n`. Check at least `C-h/j/k/l`, `C-w`, `C-\`, `C-]`, `C-Space`, `C-;`, `M-` chords (they arrive as Esc-prefixed sequences and collide with Esc timing) and the chords each harness documents or observably consumes (newline, interrupt, history, mode switches).

## Deliverable

`docs/research/free-keys.md` on branch `research/free-keys`: a table chord × harness × terminal with consumed, free or risky, the method (documentation plus observation in a real TUI where possible), and a recommended set: the four focus moves, the leave-terminal key, and fallbacks. The spec's focus section takes the bindings from it.

## Comments

### human · 2026-10-09T20:30:30.748Z

Resolution: research on branch research/free-keys, file docs/research/free-keys.md (commit ef4831c).

- **C-h, C-j, C-k and C-l reach Neovim intact on every path tested:** from Ghostty in both of its encodings, and through tmux with and without extended keys, where their Terminal-mode mappings fired (observed P4, P5). Such a mapping fires within 0.1 ms of the key (observed P3). The cost is in the harnesses. All three bind C-j (newline) and C-k (delete to end of line); Claude Code and Codex also bind C-h (Backspace) and C-l (redraw). OpenCode's main TUI binds neither C-h nor C-l (observed P6 to P8).
- **What taking them removes:**
  - The newline has other keys in all three: Shift+Enter, through cland's existing `<S-CR>` mapping, and Alt+Enter (observed P9).
  - Backspace is a separate key from C-h.
  - Delete-to-end-of-line has no other default key in any of the three.
  - Claude Code and Codex lose their redraw key.
- **No harness reacts to `C-\`, `C-Space`, `C-;`, `C-q`, `C-^` or `M-h/j/k/l` inside Neovim's terminal** (observed P6 to P8). C-] is bound by Claude Code (reopen the session's latest artifact, in the Global context) and by Codex (skip a pending question) (documented).
- **`C-\` is the strongest leave-terminal key.**
  - Neovim's Terminal mode already never forwards a lone `C-\`.
  - No harness, Ghostty default or tmux default binds it, and it decodes intact in both encodings.
  - Mapped alone, it leaves at once, and the old `C-\ C-n` still leaves (observed P3).
  - Among the chords tested, `C-q` is the only other one free on every layer.
- **This machine's macOS and Ghostty settings rule out two candidates** (documented; P1, P11):
  - Control+Space opens Spotlight here. By default macOS uses it to switch input sources whenever several are enabled, as ABC and Russian are here.
  - Option is not Alt in Ghostty here. An unset `macos-option-as-alt` means Alt only on the U.S. and U.S. International layouts.
- **Meta chords depend on timing wherever the kitty keyboard protocol is not in effect.** Through tmux, M-h arrives as ESC h, since tmux sends Meta as an ESC prefix (tmux key notes). Neovim reads ESC then h as `<M-h>` within 'ttimeoutlen' (50 ms), and as `<Esc>` plus `h` after it (observed P4, P5). So a quick Esc-then-h becomes a focus move, and a delayed M-h becomes an Esc to the harness. C-; needs CSI u: Ghostty always sends it that way, but tmux turns it into a plain `;` unless `extended-keys` is on (observed P5).
- **Three local conditions break C-h/j/k/l** (observed P4):
  - This machine's Ghostty line `keybind = shift+enter=text:\n` makes Shift+Enter arrive as `<NL>`, the same key as `<C-j>`.
  - Under the Russian layout, Ghostty's kitty encoding sends the Cyrillic letter. Ctrl+H then arrives as `<C-р>` (Ctrl+J, K and L as `<C-о>`, `<C-л>`, `<C-д>`), and only a mapping of that key fires.
  - A tty whose erase character is ^H turns legacy C-h into `<BS>`.
- **All three harnesses turn on the kitty keyboard protocol in Neovim's terminal** (`CSI > 5 u`, observed P6 to P8). So a chord cland leaves unmapped reaches them as CSI u: C-; does not type `;`, and C-h is not a raw 0x08.

Open points for the ticket this research feeds: what cland does about a Ghostty `shift+enter=text:\n` line (it collides with C-j and is on this machine); whether the Cyrillic keys (`<C-р>` `<C-о>` `<C-л>` `<C-д>`) are mapped too; whether losing delete-to-end-of-line (Ctrl+K) in all three harnesses is acceptable; the attach clients and the harnesses' dialogs were not probed.

### human · 2026-10-09T20:30:34.182Z

Resolved: see the resolution comment
