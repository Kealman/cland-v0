---
id: T-301
kind: task
title: nvim/test/palette.test.ts "item prefix opens an item; C-v opens another beside the centre" times out under the full run's load
state: closed
status: done
labels:
  - nvim
  - ready-for-agent
assignee: null
parent: C-216
blocked_by: []
topic: null
branch: null
created: 2026-10-12T19:50:26.478Z
updated: 2026-10-13T16:04:25.392Z
---

## Summary

A load flake: in T-279's census at 5d92ef5 (A-1610) the palette case "item prefix opens an item; C-v opens another beside the centre" timed out, while the whole unchanged file passes 18/18 alone. Fix it at its cause as T-292 and T-300 do: wait for the state, or a documented test-only window; no retry, no loosened assertion.

## Parent

T-216 Tech debt. Found by impl-279 on 2026-10-12; same class as T-292 (plan view) and T-300 (prompt drafts).

## Acceptance criteria

- [ ] The cause is named in the item.
- [ ] The case waits for the state it checks, or gets a documented test-only window, with its assertions unchanged in strength.
- [ ] The file passes 20 runs under four concurrent workers; `npm run test:nvim` passes.

## Comments

### coord · 2026-10-13T15:28:11.947Z

Recurred 2026-10-13 in T-336's full run 3cf0415f (A-1984, peak load 17.86). It did not reproduce in 6 isolated whole-file runs (A-1986). Likely cause, per impl-336: setup waits only for the connection, then drives the palette before the initial snapshots, the T-323 race seen from a test. Assigned to impl-336 as a shared fix, as with b5b67ad for T-292.

### coord · 2026-10-13T15:34:40.527Z

Fixed by shared commit 7210621 (impl-336, branch shared/T-301-palette-snapshot-wait, 2026-10-13). The test waits for its items and the loaded tracker ladder before the palette keys, with the assertions unchanged. A delayed hub.status and task.list replay fails before the fix and passes after it (A-1988). T-301 closes when the first branch carrying it merges, likely T-336.

### coord · 2026-10-13T16:04:25.392Z

Closed by the shared fix 7210621, which reached dev with T-328's merge (2026-10-13).
