---
id: T-487
kind: task
title: Neovim stub fixtures dated Oct 8–9 fall past the seven-day archive line from 2026-10-15 10:01Z
state: open
status: ready
size: S
criterion_seq: 3
labels:
  - ready-for-agent
assignee: null
parent: E-482
blocked_by: []
topic: topic-288
branch: t/T-487-neovim-stub-fixtures-dated-oct-8-9-fall
created: 2026-10-15T10:45:56.388Z
updated: 2026-10-15T10:56:57.860Z
---

## Problem

`nvim/test/stub-hub.ts:128` uses `Date.now()` unless `CLAND_STUB_NOW` is set. The stub's message fixtures carry fixed timestamps from 8–9 October 2026. Visibility marks a message older than seven days as archive, and threads hide archived messages.

From 2026-10-15 10:01Z the October 8 fixtures crossed that line, so every full Neovim phase now fails: 86 failures in the local gate b446298b (A-2890). Examples:
- `shell.test.ts` startShell expects "Starting T-12" (ts Oct 8 10:01) but shows "No messages".
- THREAD-001 and THREAD-002 wait for the Oct 8 day header, but the screenshots show only Oct 9.

impl-483 reproduced it: with now set to Oct 15 09:59 the message is watch; at 10:02 it is archive. This is a dev defect and fails on dev alone, so the fix is shared and gets cherry-picked into every branch that runs the full Neovim phase.

## Acceptance criteria

- [x] C1. Neovim tests no longer depend on the wall clock relative to fixed fixture timestamps: the stub's default clock, or the fixtures, are pinned so that results don't change with the date, and no test assertion is weakened.
  - done: impl-487 · 2026-10-15T10:50:33.431Z
  - verified: rev-30 [reviewer] · run rev-20261015-487-source · 2026-10-15T10:51:40.078Z · commit c402545fcd67119a1e7b74ca5f0d7c737d9cda9f
  - verified: rev-30 [reviewer] · run rev-20261015-487-final · 2026-10-15T10:56:51.553Z · commit c402545fcd67119a1e7b74ca5f0d7c737d9cda9f
- [x] C2. The full Neovim phase is green locally at the fix head, with the wall clock past 2026-10-15T10:02Z.
  - done: impl-487 · 2026-10-15T10:50:35.076Z
  - verified: rev-30 [reviewer] · run rev-20261015-487-final · 2026-10-15T10:56:51.554Z · commit c402545fcd67119a1e7b74ca5f0d7c737d9cda9f
- [x] C3. A search of nvim/test for other fixed-date fixtures that rely on the real clock is recorded in the commit message, and each one found is pinned the same way.
  - done: impl-487 · 2026-10-15T10:50:36.589Z
  - verified: rev-30 [reviewer] · run rev-20261015-487-source · 2026-10-15T10:51:40.078Z · commit c402545fcd67119a1e7b74ca5f0d7c737d9cda9f
  - verified: rev-30 [reviewer] · run rev-20261015-487-final · 2026-10-15T10:56:51.554Z · commit c402545fcd67119a1e7b74ca5f0d7c737d9cda9f

## Comments

### impl-487 · 2026-10-15T10:47:50.111Z

Reproduced exact shell failure locally with node --test --test-name-pattern='the workbench opens on General' nvim/test/shell.test.ts (Starting T-12 absent despite connected hub). Pinning one shared fixture clock for both generated stub timestamps and Visibility, retaining CLAND_STUB_NOW. Audit found two relative-age layer tests: deriving their old/recent dates from that same pin preserves archive behavior. Existing shell and archive assertions remain unchanged; full local phase before source review per Coordinator.

### rev-30 · 2026-10-15T10:51:40.078Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261015-487-source
commit: c402545fcd67119a1e7b74ca5f0d7c737d9cda9f
scope: full

Source review clear; no high, medium or low findings.

Standards: no findings against repo test guidance or baseline smells; three test-only files, no changed assertions/deadlines.
Spec: C1 verified. nvim/test/fixtures/clock.ts pins Oct 13 noon; stub-hub.ts shares that pin for generated timestamps and Visibility while preserving CLAND_STUB_NOW. layers.test.ts derives recent/eight-day-old messages from the pin; archive/reply/pagination assertions remain intact.
C3 verified. Commit body records the fixed-date/clock rg audit; independent search agrees that fixed shell/palette/item-prefix message fixtures inherit the pin, thread already explicitly pins its clock, and metadata/direct-rendering dates need no age repair.

A-2894 records exact shell red/green. A-2896 local phase after 2026-10-15 10:43Z reports Neovim 387/387 + hub smoke 16/16, zero failures/skips, including THREAD-001/002 and archive scenarios. C2 is left unverified in this source pass; final evidence review awaits same-head post-source verification. Direct Coordinator c5e6a11b exempts deterministic expiry from 5/5 timing-flake repeats.

Criteria: C1 verified, C3 verified.

### impl-487 · 2026-10-15T10:56:27.563Z

Same-head post-source-review verification63b6103f completed exit0 at c402545f: nvim-only, Linux x64 droplet c-8 lon1,400pass/3platform skips/0fail,152.65s suite,243s lifetime,$0.0169. Durable log A-2900. Local full Neovim phase A-2896 passed403/403 with zero skips. No head changes; awaiting Reviewer's final settlement.

### rev-30 · 2026-10-15T10:56:51.554Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261015-487-final
commit: c402545fcd67119a1e7b74ca5f0d7c737d9cda9f
scope: evidence

Final review clear; no high, medium or low findings. Current branch, source review and post-source gate all match c402545fcd67119a1e7b74ca5f0d7c737d9cda9f.

Standards: no findings; source review rev-20261015-487-source stands.
Spec: C1/C3 remain verified by shared fixture-clock source, unchanged assertions/overrides, and the commit's audited fixed-date search. C2 verified from full local phase A-2896 after 2026-10-15 10:43Z (published 10:50Z): Neovim 387/387 + hub smoke 16/16, zero failures/skips, 99.65 s.

Post-source gate 63b6103f/A-2900: exit 0, host/remote typecheck green, Linux x64 droplet c-8, Node v24.21.0, Neovim v0.12.5; nvim-only + hub smoke, 400 pass/403 total, 0 fail/cancelled, 3 macOS sandbox-exec skips in qa.test.ts. THREAD-001/002 and both archive-age tests ran and passed. Local A-2896 covers all platform cases without skips.

Coordinator c5e6a11b explicitly accepts exact red/green + local phase + post-source verify for deterministic expiry, exempting 5/5 timing-flake repeats. No Reviewer tests or source changes.

Criteria: C1 verified, C2 verified, C3 verified.
