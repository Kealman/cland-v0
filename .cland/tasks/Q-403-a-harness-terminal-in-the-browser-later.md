---
id: Q-403
kind: question
title: "A harness terminal in the browser, later: what the harnesses allow and what the protocol must not preclude"
state: open
labels:
  - wayfinder:research
assignee: cland-design
parent: M-399
blocked_by: []
topic: null
branch: null
created: 2026-10-14T13:03:49.936Z
updated: 2026-10-14T13:03:59.897Z
---

## Question

A harness terminal in the browser, for later (spec v0.2 §3.8 keeps it out of 0.2.0): what each harness allows today (Claude Code's --bg supervisor and attach, Codex app-server without a TUI, OpenCode v2 without attach), what a PTY bridge over the hub's WebSocket would need (xterm.js, resize, scrollback, who owns the PTY, security), and what the protocol extension of §3.3 must not preclude so that a terminal can be added without redesign. Deliver docs/research/web-terminal.md on research/web-terminal and the resolution comment here.
