---
id: T-709
kind: task
title: Neovim T2 tests reach the hub only through recorded protocol frames, so hub edits stop selecting them
state: open
status: in progress
size: M
criterion_seq: 4
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
updated: 2026-10-18T05:41:43.793Z
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
  - failed: rev-30 [reviewer] · 2026-10-18T05:41:43.793Z · note The new T2 helper path loses existing cover-quiet refusal before directory allocation and Neovim spawn; preserve actual-entry admission and add a direct control before verification.

## Blocked by

T-688 (type-only imports and Neovim narrowing), T-690 (Neovim T2 tags).

## Comments

### impl-709 · 2026-10-18T05:00:49.485Z

Implementation removes T2 runtime imports through Neovim-owned client/fixture helpers and a synchronous committed-frame replay catalog. Boundary guard currently returns [] over all 11 manifest T2 files plus stub-hub. A 40-landing replay reports zero import-decided T2 selections. Fixture refresh also exercises existing T3 stub consumers for T-774 reuse; full assertion audit and 5/5 whole-file Mac evidence are in progress. No per-item duration allowances added.

### impl-709 · 2026-10-18T05:07:40.160Z

C3 evidence: A-4969 (durable replay artifact) and docs/evidence/T-709-selection-replay.md replay exactly the last 40 task landings at origin/dev af981f17 using the current importer graph. All 11 T2 files have an empty hub import closure; nvim test import decides 0 T2 selections. Shared-contract/infrastructure and mixed-path fallbacks remain intact. C2 actual production-source plant/rewrite/restore proof is A-4968.

### rev-30 · 2026-10-18T05:41:43.793Z

verdict: review
result: not clear
by: rev-30 [reviewer]
run: rev-20261018-709-source
commit: 39e81384ccf0bcb63ee285b8125da97a45eddd85
scope: full
findings: [{"severity":"medium","text":"T2 stub-client/fixture imports no longer install cover-quiet admission; tempProject allocates and createClient spawns without a check. Restore admission before fixture resources while keeping the Neovim-only import boundary.","file":"nvim/test/client.ts","line":114}]
finding_counts: {"high":0,"medium":1,"low":0}

A-4996: Standards medium M1 at nvim/test/client.ts:114 (also fixture.ts:34): the T2-only helper path drops the hub harness's cover-quiet admission hook and allocates/spawns before any read-only admission check. Preserve actual-entry protection while retaining the empty hub runtime import closure; add direct refused-before-allocation/spawn proof and coordinate T-747. Spec inspections otherwise positive: 11 T2 import boundaries, producer/live recorder and actual prefix mutation/rewrite/restore, exact 40-landing replay window, and all 256 assertion sites/non-import statements preserved. Parsed 90 whole-file logs/1,095 passes with no failures/cancellations/skips; these do not cover the missing admission path. C4 failed; C1–C3 remain unverified until a clear verdict. New source head requires review before verification.

Criteria: C4 failed (The new T2 helper path loses existing cover-quiet refusal before directory allocation and Neovim spawn; preserve actual-entry admission and add a direct control before verification.).
