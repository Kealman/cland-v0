---
id: Q-407
kind: question
title: "The protocol extension: the WebSocket entry, several human clients, snapshot and deltas, history pages"
state: closed
labels:
  - wayfinder:grilling
assignee: null
parent: M-399
blocked_by:
  - Q-400
  - Q-402
topic: null
branch: null
created: 2026-10-14T13:03:51.086Z
updated: 2026-10-14T14:25:06.211Z
closed: 2026-10-14T14:25:06.211Z
---

## Question

The protocol extension for a browser (spec v0.2 §3.1, §3.3): the WebSocket entry and the token exchange, several human clients, the snapshot on connect, deltas with sequence numbers and the catch-up after a drop, pages of history, and what Neovim adopts of it; decided on the client-surface and stack research.

## Comments

### human · 2026-10-14T14:25:05.994Z

Resolution (2026-10-14, the human decided). The web edge: a separate listener in the hub on ws, a stable loopback port in hub.json, /, /auth and /ws, a one-time link from cland web traded for an HttpOnly SameSite=Strict cookie named per port, Host and Origin checks, only client hellos. Authority: the cookie carries the human's authority except hub stop and restart, release and artifact creation from arbitrary paths, which stay in the CLI and Neovim in 0.2.0. Snapshot with epoch and sequence, numbered deltas, resume from a ring buffer or a fresh snapshot, history pages by message number; Neovim adopts it in 0.2.x. Hub-computed fields for both clients and read marks per human; the wire types in a hub-free module. Approvals relayed where the harness protocol allows (Codex app-server, OpenCode permission API), Claude Code's stay in the TUI and the web says so; one gate, the first answer wins. The terminal's eight reservations stand. Recorded in docs/spec/v0.2.md §3.3, §3.7, §3.8 and GLOSSARY (Snapshot, Delta, Web workbench, Rail, Drawer).

### human · 2026-10-14T14:25:06.211Z

Resolved: see the resolution comment; spec v0.2 §3.3, §3.7, §3.8
