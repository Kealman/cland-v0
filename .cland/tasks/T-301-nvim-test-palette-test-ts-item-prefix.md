---
id: T-301
kind: task
title: nvim/test/palette.test.ts "item prefix opens an item; C-v opens another
  beside the centre" times out under the full run's load
state: open
status: backlog
labels:
  - nvim
  - ready-for-agent
assignee: null
parent: C-216
blocked_by: []
topic: null
branch: null
created: 2026-10-12T19:50:26.478Z
updated: 2026-10-12T19:50:26.478Z
---

## Summary

A load flake: in T-279's census at 5d92ef5 (A-1610) the palette case "item prefix opens an item; C-v opens another beside the centre" timed out, while the whole unchanged file passes 18/18 alone. Fix it at its cause as T-292 and T-300 do: wait for the state, or a documented test-only window; no retry, no loosened assertion.

## Parent

T-216 Tech debt. Found by impl-279 on 2026-10-12; same class as T-292 (plan view) and T-300 (prompt drafts).

## Acceptance criteria

- [ ] The cause is named in the item.
- [ ] The case waits for the state it checks, or gets a documented test-only window, with its assertions unchanged in strength.
- [ ] The file passes 20 runs under four concurrent workers; `npm run test:nvim` passes.
