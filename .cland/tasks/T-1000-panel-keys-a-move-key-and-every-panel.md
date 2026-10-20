---
id: T-1000
kind: task
title: Panel keys, a move key and every panel opener follow the panel's side
state: open
status: ready
size: S
criterion_seq: 7
labels:
  - ready-for-agent
assignee: null
parent: E-789
blocked_by:
  - T-999
topic: topic-759
branch: t/T-1000-panel-keys-a-move-key-and-every-panel
created: 2026-10-20T16:57:44.090Z
updated: 2026-10-20T18:13:01.879Z
---

## Summary

The panel keys (`␣i`, `␣n`, `␣s`, `␣t`) open or hide a panel on the side it lives on, and one new key inside a panel sends it to the other side. Everything else that opens a panel (the top-bar chips, `gp` beside a plan, palette actions scoped to a panel) finds it on its side.

## What to build

The panel keys stay toggles on the panel's side (Coordinator decision, 2026-10-20). Inside any panel, `gm` ("go move") sends that panel to the other side; it is a registered action with a title in `␣?` and the palette, and `gm` was found free in the panel buffers' keymaps and the registered actions of `nvim/lua/cland`. The human presses `gm` in Items and it moves to the right; `␣i` then toggles Items on the right. Clicking the needs-you or sessions chip, or pressing `gp`, opens the Inbox, Sessions or Items where the human put it, never back on its old side. `C-h` and `C-l` from the centre reach whichever panel sits on each side.

Neovim's `CTRL-W H`, `L`, `r` and `x` on a panel window are left alone. `nvim/README.md` says that sides move only through cland's key, the palette or `:Cland panel <kind> left|right`.

## Acceptance criteria

- [x] C1. `␣i`, `␣n`, `␣s` and `␣t` open or hide their panel on its current side, including after a move to the other side, proved by a T2 stub-hub test.
  - done: impl-1000 · 2026-10-20T18:04:25.158Z
  - verified: rev-23 [reviewer] · run rev-20261020-1000-final · 2026-10-20T18:12:58.147Z · commit a6ce03227d147775ee4d0882606c8c54b28d64a2
- [x] C2. `gm` inside a panel sends it to the other side with the same result as the palette action (the 789-1 move rule), and works in all four panels, proved by a T2 stub-hub test.
  - done: impl-1000 · 2026-10-20T18:04:25.774Z
  - verified: rev-23 [reviewer] · run rev-20261020-1000-final · 2026-10-20T18:12:58.147Z · commit a6ce03227d147775ee4d0882606c8c54b28d64a2
- [x] C3. The chip clicks (needs you, sessions, the Coordinator chip with no Coordinator), `gp`, and a palette action scoped to a panel open that panel on its side, proved by T2 tests with Items on the right and Sessions on the left.
  - done: impl-1000 · 2026-10-20T18:04:26.380Z
  - verified: rev-23 [reviewer] · run rev-20261020-1000-final · 2026-10-20T18:12:58.148Z · commit a6ce03227d147775ee4d0882606c8c54b28d64a2
- [x] C4. `C-h` and `C-l` from the centre focus the left and the right panel whatever they show, in Normal and Terminal mode, proved by a T2 test.
  - done: impl-1000 · 2026-10-20T18:04:26.889Z
  - verified: rev-23 [reviewer] · run rev-20261020-1000-final · 2026-10-20T18:12:58.148Z · commit a6ce03227d147775ee4d0882606c8c54b28d64a2
- [x] C5. `gm` appears with its title in `␣?` and the palette, and `actions.audit()` reports no drift (the existing headless audit test passes).
  - done: impl-1000 · 2026-10-20T18:04:27.506Z
  - verified: rev-23 [reviewer] · run rev-20261020-1000-final · 2026-10-20T18:12:58.148Z · commit a6ce03227d147775ee4d0882606c8c54b28d64a2
- [x] C6. A headless-grid case PANELS-018 moves Items to the right and the Inbox to the left with `gm`, and reads both from the grid.
  - done: impl-1000 · 2026-10-20T18:04:28.018Z
  - verified: rev-23 [reviewer] · run rev-20261020-1000-final · 2026-10-20T18:12:58.148Z · commit a6ce03227d147775ee4d0882606c8c54b28d64a2
- [x] C7. The Keys and Commands sections of `nvim/README.md` describe `gm`, the palette and `:Cland panel <kind> left|right`, and state that Neovim's `CTRL-W H/L/r/x` are not part of moving panels.
  - done: impl-1000 · 2026-10-20T18:04:28.629Z
  - verified: rev-23 [reviewer] · run rev-20261020-1000-source · 2026-10-20T18:05:45.772Z · commit a6ce03227d147775ee4d0882606c8c54b28d64a2
  - verified: rev-23 [reviewer] · run rev-20261020-1000-final · 2026-10-20T18:12:58.148Z · commit a6ce03227d147775ee4d0882606c8c54b28d64a2

## Comments

### impl-1000 · 2026-10-20T18:00:38.787Z

Implementation at the task-prescribed T2 stub-hub seam: four registered gm actions map through place_panel, preserving the same replacement/close/home rule as palette placement. Red proof: Items gm test timed out with 'right panel contains ITEMS: not within 15000 ms' before source change. All four new per-panel move/toggle/help/palette tests now pass locally (Darwin arm64, targeted direct execution; no suite/load gate). Adding opener/focus cases and shipped PANELS-018 before review.

### rev-23 · 2026-10-20T18:05:45.772Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261020-1000-source
commit: a6ce03227d147775ee4d0882606c8c54b28d64a2
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Standards and Spec: no findings. Four scoped gm entries/mappings delegate to existing place_panel and preserve move/replacement/home/dock semantics. Registry/help/palette and docs align; native CTRL-W controls untouched. Existing home-aware openers covered by7 new T2 cases including chips/gp/scoped action and in-memory Terminal focus; PANELS-018 reads physical grid. No existing protocol dictionary entries modified/deleted. A-7873 local Mac126 targeted passes inspected; generation log distinguished from replay, no suite/load/duration or stageQA claim. C7 verified; C1–C6 runtime final marks await exact-head mode-free gate. Audit A-7875. After-stage E-789 QA unchanged; Reviewer ran no tests.

Criteria: C7 verified.

### impl-1000 · 2026-10-20T18:12:40.255Z

Same reviewed head a6ce03227d147775ee4d0882606c8c54b28d64a2 remains clean and pushed. Mode-free run eac2511e-4f75-4c8a-a07c-b228bc8f1a1a / A-7884 exited 0: 2095/2095 passes, no fail/cancel/skip. Actual Linux x64 droplet c-8 lon1, 2 workers, Node v24.21.0, Neovim v0.12.5; lifetime 360 s, $0.0250. T1 and fallback all T2 across both packages completed; T3/T4 absent from this receipt. Test lint/budget/ratchet report-only, 2 missing duration baselines. Host typecheck gate 74a5554a not repeated remotely; exact-tree local typecheck and separate 126 targeted Darwin tests remain in A-7873. Reviewer received the same-head receipt automatically; final verdict pending. E-789 after-stage QA stays separate after T-1002.

### rev-23 · 2026-10-20T18:12:58.148Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261020-1000-final
commit: a6ce03227d147775ee4d0882606c8c54b28d64a2
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Standards and Spec: no findings. A-7884/eac2511e exact-head audit:2095 ordinary tests/329 files all pass, Linux T1/all-T2 including Neovim. Panel13/shell60/palette13 pass; all seven new identities actual5/5 load passes establish moves/toggles/registry/openers/focus. C6 physical-grid PANELS-018 local T4 proof remains separately attributed A-7873, absent this task gate; C7 source A-7875 retained. C1–C7 review marks verified. Host74a5554a not repeated remotely; lint/budgets/ratchet report-only,two missing baselines. Lifetime360s/$0.0250. No T3/T4/integrated task or stageQA verdict. Full E-789 QA after T-1002 remains. Audit A-7885; Reviewer ran no tests.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified, C6 verified, C7 verified.
