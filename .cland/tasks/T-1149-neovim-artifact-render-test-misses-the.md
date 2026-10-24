---
id: T-1149
kind: task
title: Neovim artifact-render test misses the artifact event within 10 s under Linux load
state: open
status: review
size: XS
criterion_seq: 1
labels:
  - flaky
  - ready-for-agent
assignee: null
parent: E-1196
blocked_by: []
topic: topic-985
branch: t/T-1149-neovim-artifact-render-test-misses-the
created: 2026-10-22T17:31:42.287Z
updated: 2026-10-24T12:59:21.764Z
---

## Summary

`nvim/test/artifact-render.test.ts` › "artifact events refresh an open projection and raw saves replace its cached version" failed on a Linux c-8 lon1 droplet in T-1118's verify 4d419525 (A-9386, head 451ef78a). The error was `the screen never showed artifact event reaches the rendered grid within 10000 ms`, with the grid still showing "Original live note". The same identity failed earlier in T-1004's run 5c627151 (A-8029). On dev d3e632bc it passes 5/5 alone on local macOS, and T-1118 touches no Neovim code.

## What to build

The test waits for the hub's artifact delivery receipt and the projection's refresh receipt rather than a 10 s screen poll under load, and keeps its final grid assertion.

## Acceptance criteria

- [x] C1. The named test passes 20/20 in a local load loop and in a mode-free `cland verify` on Linux, keeping its final grid assertion (test).
  - done: impl-1149 · 2026-10-24T12:58:42.703Z

## Comments

### impl-1149 · 2026-10-24T12:54:45.713Z

Baseline at 699a44dd on local macOS: the named artifact-render T2 test passed 1/1 alone (535 ms runner total), without burners; no full verification receipt. Historical failure remains the ticket's quoted Linux screen timeout. Coordinator granted scheduling a bounded 20x/two-burner window at the committed review head. Implementing an armed exact-artifact event observer and a changed projection-buffer/content receipt before final grid readback.

### impl-1149 · 2026-10-24T12:59:21.764Z

Committed/pushed 21698b8a52c4fdfdbbed16e873294aadf3c74613 after merging fresh origin/dev 16a7bbe5. Exact-head local macOS arm64 targeted named T2 case passed 20/20 under two CPU burners, 2026-10-24T12:58:00.088Z–12:58:09.445Z, in the Coordinator-granted rule-3 exclusive window; queue pre-check local:none/no local waiter; burner close receipts observed. Raw log A-11062, durable /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-11062-t-1149-committed-head-local-20-20-load-log.log. No full-suite or tier-gate pass claimed from this targeted loop. Source review request queued with reviewer role; Linux mode-free verification and C1 evidence review still pending.
