---
id: T-85
kind: question
title: Free keys in the three harness TUIs for focus moves and leaving a terminal
state: open
labels:
  - wayfinder:research
assignee: human
parent: T-81
blocked_by: []
topic: null
branch: null
created: 2026-10-09T19:09:39.577Z
updated: 2026-10-09T19:13:43.917Z
---

## Question

Which key chords are free across the TUIs of Claude Code, Codex and OpenCode, the terminal emulators in use (Ghostty; tmux when present) and Neovim's terminal mode, so that cland can bind four focus moves that work in every mode and one key that leaves a session's terminal without the harness ever seeing it?

## Context

Settled while charting: `C-h/j/k/l` are to move focus between windows in every mode, terminal included, so that leaving a session is a move; Esc always goes to the harness (a double Esc is an interrupt for some harnesses, so no cland binding may involve Esc); one "leave terminal" key never reaches the harness. Today a terminal is left only with `C-\ C-n`. Check at least `C-h/j/k/l`, `C-w`, `C-\`, `C-]`, `C-Space`, `C-;`, `M-` chords (they arrive as Esc-prefixed sequences and collide with Esc timing) and the chords each harness documents or observably consumes (newline, interrupt, history, mode switches).

## Deliverable

`docs/research/free-keys.md` on branch `research/free-keys`: a table chord × harness × terminal with consumed, free or risky, the method (documentation plus observation in a real TUI where possible), and a recommended set: the four focus moves, the leave-terminal key, and fallbacks. The spec's focus section takes the bindings from it.
