---
id: T-1074
kind: task
title: Scope, selection and messages to the Coordinator in the Items area
state: open
status: review
size: M
criterion_seq: 3
labels:
  - ready-for-agent
assignee: null
parent: E-416
blocked_by:
  - T-1071
topic: topic-831
branch: t/T-1074-scope-selection-and-messages-to-the
created: 2026-10-21T17:32:16.621Z
updated: 2026-10-22T04:34:38.358Z
---

## Summary

Scoping, selection, the messages to the Coordinator and item ids as links in the Items area.

## Parent

E-416 (§3.4, v0.1.2 §3.8; tracer step 3).

## What to build

`s` scopes to a node with breadcrumbs and a back stack, and `␣␣` goes back. `x` toggles a row into the selection, Shift with `j` or `k` extends it, and Esc clears it. `m` opens the card's one-line quick message to General, with the item's context. `M`, or the switch beside the field, sends to the item's topic and creates it when missing. `m` on a selection sends one message to General with one line per item. `gi`, `gt` and `gs` jump, and an item id in any text opens the item with its ancestors unfolded.

## Acceptance criteria

- [x] C1. Three selected rows and `m` deliver one message to General naming the three items by display id, as a fake Coordinator receives it (Web test with the fake harness).
  - done: impl-1074 · 2026-10-22T04:33:01.239Z
- [x] C2. `M` on an item without a topic creates its topic and sends there (Web test).
  - done: impl-1074 · 2026-10-22T04:23:18.695Z
- [x] C3. `s`, the breadcrumbs, `␣␣` and item-id links behave as described (Web test).
  - done: impl-1074 · 2026-10-22T04:23:18.865Z

## Comments

### impl-1074 · 2026-10-22T04:13:33.188Z

C1 test-first public browser seam reached red with [] instead of the three expected selected ids (trace A-8890). Shared Items state extracted at 59b7d6ca for parallel T-1075; selection and General quick message implemented. Targeted fixture delivery setup being completed; no source review or suite receipt yet.

### impl-1074 · 2026-10-22T04:23:34.144Z

Implemented and pushed 2a4093c1 (tree ae430f1b); origin/dev merge already current. C1–C3 marked done and source review requested from Reviewer. Exact-head macOS arm64 root check exit0 A-8895, Web actions3/3 A-8896; rendering A-8897. Lint report-only132 findings/59 files,0 refusals. No queued verification or Linux receipt yet. Stage QA remains after-stage.

### rev-23 · 2026-10-22T04:29:07.145Z

verdict: review
result: not clear
by: rev-23 [reviewer]
run: rev-20261022-1074-source
commit: 2a4093c1b1ac4acc85129e14b9fa8e63f772d5d6
scope: full
findings: [{"severity":"medium","text":"M1: A marked selection cannot open its composer after the cursor moves to an unmarked item. The target uses selection ids, but both ItemCard render sites (286/307) mount QuickMessage only if the displayed item's id belongs to that target. Mark A/B/C, move to unmarked D without clearing marks, then press m: D remains the drawer/split card and receives no message prop, so no input appears. Anchor the composer independently of cursor membership or reveal an appropriate target, and extend the fake-Coordinator regression through an unmarked cursor while retaining one General delivery with exactly the three marked display ids.","file":"web/src/Shell.tsx","line":110},{"severity":"medium","text":"M2: A delayed item-link lookup overrides subsequent navigation. navigationSerial increments only inside openItem; setArea, selectRow and openResult never invalidate it. Click an unloaded/closed item link, choose Sessions or another item while the by-id task.list response is pending, then release the response: the old continuation passes this guard and resets scope/filter/area/selection at 201–203. Invalidate pending navigation when a newer user navigation supersedes it; add a held-response browser regression that proves the later area/selection survives.","file":"web/src/Shell.tsx","line":191}]
finding_counts: {"high":0,"medium":2,"low":0}

Full source audit against fixed base a0ab9836 is not clear: M1 selection composer disappears with an unmarked cursor; M2 late item-link responses override subsequent navigation. A-8904 retains consolidated source paths, concrete triggers and regression requirements. A-8895 check and A-8896 three targeted Web passes are supporting local evidence, not configured verification, and do not cover either gap. No additional standards/lows. C1–C3 remain unverified; correct and request fresh source review before verify. Affected after-stage QA separate.

Criteria: C1 failed (Marked selection plus m has no visible composer when the cursor is on an unmarked row (M1; A-8904).).

### impl-1074 · 2026-10-22T04:33:34.245Z

Reviewer M1/M2 corrected at 497ea238/tree4c41ddc6, pushed without dev merge. Test-first reds A-8905 (no composer after unmarked cursor), A-8906 (late lookup replaces Sessions with Items). Corrected local macOS arm64 check exit0 A-8909, actions4/4 A-8907, card6/6 A-8908. C1 done restored; fresh source review requested before verification. No Linux/configured-suite receipt yet.

### rev-23 · 2026-10-22T04:34:38.358Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261022-1074-source-2
commit: 497ea2384373957475e0486c87d552a2564269ad
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Corrected full source clear; A-8911 retains the five-file re-review against prior audit A-8904 and pinned base a0ab9836. M1 composer card anchor is separate from marked context ids; M2 later navigation invalidates pending link application. Retained old-source red A-8905/A-8906 and corrected local Web actions4/4/card6/6 plus exact check A-8907–A-8909 support both corrections. No remaining findings. C1–C3 unverified pending exact-head configured mode-free receipt. Affected after-stage QA remains separate.
