---
id: T-996
kind: task
title: The palette and the keys help
state: open
status: planned
size: M
labels:
  - ready-for-agent
assignee: null
parent: E-415
blocked_by:
  - T-995
topic: null
branch: null
created: 2026-10-20T16:51:40.983Z
updated: 2026-10-21T12:56:04.190Z
---

## Summary

The palette opens on ⌘K and Space p over the dimmed shell, with the five prefixes and each action's key. `?` lists the area's keys. Both read the one key map, so the keys they show are the keys that work.

## What to build

The palette is one input with results grouped in the order of v0.1 §3.11, the matches in blue. The prefixes are `>` for actions, `#` for items, `@` for sessions, `~` for artifacts and `/` for topics. Enter opens the result, ⌘Enter opens it in a pane, Tab changes the kind, and Esc closes without acting. Each action shows its key from the key map. The objects come through the hub's ordinary reads on the web edge until E-412's snapshot is on `dev`. `?` lists the current area's keys from the same key map. `web/README.md` lists the shell's keys.

## Acceptance criteria

- [ ] C1. ⌘K and Space p open the palette over the dimmed shell, and Esc closes it without acting or sending a frame (browser test).
- [ ] C2. The prefixes `>`, `#`, `@`, `~` and `/` narrow the results to actions, items, sessions, artifacts and topics, grouped in the order of v0.1 §3.11, each action with its key (browser test).
- [ ] C3. Enter opens the result, ⌘Enter opens it in a pane, and Tab changes the kind (browser test).
- [ ] C4. `?` lists the current area's keys from the key map, and every key shown matches by code with Cyrillic key values (browser test).
- [ ] C5. `web/README.md` lists the shell's keys.
