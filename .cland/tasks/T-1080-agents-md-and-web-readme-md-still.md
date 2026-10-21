---
id: T-1080
kind: task
title: AGENTS.md and web/README.md still describe the key map and Linux Web libraries as future work
state: open
status: backlog
size: XS
labels:
  - ready-for-agent
assignee: null
parent: C-326
blocked_by: []
topic: null
branch: null
created: 2026-10-21T17:54:44.347Z
updated: 2026-10-21T17:54:44.347Z
---

## Summary

Two documents still carry forward-looking wording from before their slices landed (E-415 DoD QA, DOD-19 at 128444a0). `AGENTS.md`'s web rule says the physical-code key map is something "the shell-key slice adds", but the map exists. `web/README.md`'s Browser tests section says "Until T-993 supplies Linux libraries", but T-993 is closed and every Web file passes on Linux droplets.

## Acceptance criteria

- [ ] C1. `AGENTS.md`'s web rule names the existing key map (`web/src/keymap.ts`) without "the shell-key slice adds it".
- [ ] C2. `web/README.md`'s Browser tests section describes the current Linux and macOS Web phase without the T-993 caveat.
