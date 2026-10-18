---
id: T-709
kind: task
title: Neovim T2 tests reach the hub only through recorded protocol frames, so hub edits stop selecting them
state: open
status: in progress
size: M
labels:
  - v0.1.4
  - verification
  - hub
  - nvim
  - tests
assignee: null
parent: E-677
blocked_by:
  - T-698
  - T-699
  - T-707
  - T-688
  - T-690
topic: topic-475
branch: t/T-709-neovim-t2-tests-reach-the-hub-only
created: 2026-10-16T19:59:37.953Z
updated: 2026-10-18T05:07:40.160Z
---

## Summary

Hub edits force Neovim tests because they import hub code (memo §3.6; report-strategy §1.3: `nvim test import` decided 66 task runs). `nvim/test/stub-hub.ts` imports the hub's tracker prefixes, kinds and criteria, visibility, visibility preferences and config, and `needs-you.test.ts` the `Store`. The type-only imports stop counting with T-688. Decision 6: Neovim tests go over the protocol before v0.2, after the adapter and executor class moves.

## What to build

- **Recorded frames.** The stub hub stops importing hub runtime modules. It serves frames from recorded fixtures: JSON files of protocol frames (item views, criteria summaries, visibility counts, config) that a T3 recorder test in the Neovim attach scenario (T-707 #9) produces from a real hub.
- **Drift fails loudly.** The recorder test fails when the live hub's frames differ from the committed fixtures, and `npm run test:nvim-fixtures` rewrites them, so a hub change that alters a frame shows up in T3, not as a silent stub mismatch.
- **Helpers from Neovim's side.** T2 Neovim files import Neovim-side helpers for temp projects and waits, not `hub/test/harness.ts`. T3 Neovim files that start a real hub may keep the harness.

## Acceptance criteria

- [ ] C1. No T2 Neovim file or helper it imports reaches a `hub/src` runtime module, proved by `nvimHubImports` over the T2 files returning an empty list.
- [ ] C2. The recorder test fails on a planted frame change in the hub and passes after the fixture rewrite, proved by a test.
- [ ] C3. The selection replay over the last 40 landings shows `nvim test import` deciding no T2 Neovim selection, recorded on this item.
- [ ] C4. An audit shows every Neovim T2 test's assertions unchanged in meaning, and each touched file passes 5/5 serially as a whole file on the Mac and once in the task's droplet verify.

## Blocked by

T-688 (type-only imports and Neovim narrowing), T-690 (Neovim T2 tags).

## Comments

### impl-709 · 2026-10-18T05:00:49.485Z

Implementation removes T2 runtime imports through Neovim-owned client/fixture helpers and a synchronous committed-frame replay catalog. Boundary guard currently returns [] over all 11 manifest T2 files plus stub-hub. A 40-landing replay reports zero import-decided T2 selections. Fixture refresh also exercises existing T3 stub consumers for T-774 reuse; full assertion audit and 5/5 whole-file Mac evidence are in progress. No per-item duration allowances added.

### impl-709 · 2026-10-18T05:07:40.160Z

C3 evidence: A-4969 (durable replay artifact) and docs/evidence/T-709-selection-replay.md replay exactly the last 40 task landings at origin/dev af981f17 using the current importer graph. All 11 T2 files have an empty hub import closure; nvim test import decides 0 T2 selections. Shared-contract/infrastructure and mixed-path fallbacks remain intact. C2 actual production-source plant/rewrite/restore proof is A-4968.
