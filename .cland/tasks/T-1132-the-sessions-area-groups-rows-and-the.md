---
id: T-1132
kind: task
title: "The Sessions area: groups, rows and the unfolded row"
state: open
status: in progress
size: M
labels:
  - ready-for-agent
assignee: null
parent: E-418
blocked_by:
  - T-1130
  - T-1147
topic: topic-860
branch: t/T-1132-the-sessions-area-groups-rows-and-the
created: 2026-10-22T15:16:15.097Z
updated: 2026-10-22T17:04:54.205Z
---

## Summary

The Sessions area shows the hub's merged session rows in the groups Yours, Waiting, Busy, Idle and Stopped with their counts and folds remembered per client, the rows of P22, and the selected row unfolded in place with what it waits on.

## Parent

E-418 (§3.2 the Sessions area, P22; v0.1 §3.11; v0.1.2 §3.4 and §3.5; tracer step 1).

## What to build

- **The header** carries each group's count (waiting, busy, idle, yours) and the archive toggle; Launch a session and New Aide join it in the launch slice.
- **The groups**, in order: Yours (the live Aides), Waiting, Busy, Idle and Stopped, each a fold with its count, its folded state remembered in this browser. Stopped shows the latest 20 with the count of the archived; `A` or the toggle shows the archived sessions (`session.list` with `archived`). A stopped Aide is under Stopped.
- **A row** (P22): the state glyph, the name, the role in its role colour, the harness, the model and the account, the item (the claim; a verifier's latest hold with its role and +N; a requested item dimmed until the hold exists, v0.1.2 §3.4), the state words with their age, and the usage (the cost, else the tokens).
- **Selection.** `j`, `k`, ↓ and ↑ move it; the selected row unfolds in place with what the session waits on (the pending approval's command in full, or the topic waiting for the human). The actions join the unfolded row in the actions slice. `gs` from an item lands on its session's row.

There is no Attach anywhere in the area. Rows come from the hub's merged session rows and their deltas; nothing merges sessions in the browser. The prototype's `web/src/sessions.ts` and `sessions/SessionsArea.tsx` on `prototype/web-shell` and Neovim's `state.lua` (`session_group`) define the grouping.

## Acceptance criteria

- [ ] C1. With fake sessions in every state (an Aide, one waiting for approval, busy, idle and stopped), each of Yours, Waiting, Busy, Idle and Stopped lists its sessions with its count in the group and the header (Web test with the fake harness).
- [ ] C2. Idle folded stays folded after a reload, and folding sends no hub request (Web test).
- [ ] C3. A row shows the glyph, name, role, harness, model, account, item, state with its age and usage from the hub's merged row, with a verifier's hold and +N and a requested item dimmed (Web test).
- [ ] C4. The selected waiting row unfolds in place with its approval command in full, and no control in the area offers Attach (Web test).
- [ ] C5. Stopped lists at most the latest 20 with the archived count, and `A`, which `?` lists in Sessions, shows the archived sessions (Web test).
- [ ] C6. `web/README.md` gains a Sessions section with the groups, the row and the keys (docs).

## Comments

### impl-1132 · 2026-10-22T16:51:02.057Z

Test-first slice 1: web/test/sessions.test.ts uses the explicitly specified Web/fake-harness seam. Red on the T-1130 base: locator for Yours/my-aide timed out because SessionGroups is still a reserved slot. Implementing group projection and shared browser-only Fold next.

### impl-1132 · 2026-10-22T17:04:54.205Z

Implementation checkpoint 99141306 committed; merged origin/dev (including ec539bca shared area-slots duration allowance) before first source review. Non-archive targeted Web and static lint evidence are local macOS working-tree results, not a task verification receipt. Archive read is wired to T-1147’s documented additive merged rows field and remains blocked on that prerequisite; no verification enqueued.
