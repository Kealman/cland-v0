---
id: T-124
kind: task
title: "Focus and leaving a terminal: C-h/j/k/l in every mode, a lone C-\\ leaves Terminal mode, doctor's two key warnings, [keys] layouts with langmap, the kitty base-layout check recorded"
state: open
labels:
  - ready-for-agent
  - v0.1
assignee: null
parent: T-109
blocked_by: []
topic: topic-42
branch: t/T-124-focus-and-leaving-a-terminal-c-h-j-k-l
created: 2026-10-09T21:57:02.030Z
updated: 2026-10-09T22:00:09.956Z
---

## Parent

T-109 (Workbench basics), slice 1 of 5. Spec §3.12 (Focus and keys); research `research/free-keys` (`docs/research/free-keys.md`, T-85, with its probe kit).

## What to build

- **Focus.** `C-h`, `C-j`, `C-k` and `C-l` move focus between windows in every mode, Terminal mode included, so leaving an attached session is a focus move.
- **Leaving a terminal.** A lone `C-\` leaves Terminal mode, and `C-\ C-n` keeps working. Esc always reaches the harness, and no cland binding involves Esc or Meta chords.
- **Newlines.** Shift+Enter, through cland's `<S-CR>` mapping, and Alt+Enter still type a newline in the composer and in a harness, because `C-j` is taken.
- **Doctor.** `cland doctor` warns about a Ghostty `keybind = shift+enter=text:\n` line, which makes Shift+Enter the same code as `C-j`. It also warns about a tty erase character of `^H`. Each warning gives its fix.
- **Layouts.** `[keys] layouts = ["ru"]` in `config.toml` sets Neovim's `langmap` for each named layout, one option string per layout, so Normal-mode keys work in that layout. Typing in the composer and in a terminal is untouched. No Cyrillic duplicates of the Ctrl chords are mapped.
- **The kitty check.** Check once whether Neovim can take the kitty protocol's base-layout key for Ctrl chords. If it can, use it, so the four chords work in any layout. Otherwise they stay English-only, which is the human's accepted choice. Record the result, with the evidence, in `nvim/README.md`, and report it to the Coordinator; the decision is delegated to the Coordinator within §3.12.

## Acceptance criteria

- [ ] Headless tests: from Terminal, Insert and Normal mode, each chord moves focus to the expected window; a lone `C-\` leaves Terminal mode; `<S-CR>` in a terminal sends a newline, not `C-j`.
- [ ] Manual checks from the research's probe kit, recorded in the report: Ghostty in both encodings, and tmux with and without extended keys.
- [ ] `cland doctor` reports both local conditions with a fix line and stays quiet when they are absent, tested through the CLI with fixture config files.
- [ ] `[keys] layouts` sets `langmap`; a Normal-mode key typed in the Russian layout acts as its English counterpart; the composer receives Cyrillic text unchanged.
- [ ] The kitty base-layout result is recorded in `nvim/README.md`, with the probe.
- [ ] `npm run typecheck && npm test` pass.

## Notes

Size M. Implementer: Codex. ADR 0005: Lua inside the standalone build, no plugins. Do not undo the terminal workarounds of `research/neovim-engine`. First in the Neovim lane, with no blockers. Defaults against instances: if a new `config.toml` default is added, list this project's line in the report.

## Comments

### impl-124 · 2026-10-09T22:00:09.956Z

Kitty probe A on the pinned 0.12.5 TUI decodes CSI 1088::104;5u as <C-р>, not <C-h>; Coordinator chose the English-only fallback, with Normal-mode Russian langmap. Evidence A-219 in topic-42. Implementing single-chord focus mappings and removing launcher Ctrl+H shadowing; terminal mitigations are preserved.
