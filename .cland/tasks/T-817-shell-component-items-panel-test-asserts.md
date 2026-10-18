---
id: T-817
kind: task
title: shell-component items panel test asserts the claim and asks before their events render
state: open
status: ready
size: S
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: E-482
blocked_by: []
topic: topic-530
branch: t/T-817-shell-component-items-panel-test-asserts
created: 2026-10-18T19:11:17.011Z
updated: 2026-10-18T19:29:57.526Z
---

## Summary

`nvim/test/shell-component.test.ts:923` › "the items panel: vertical sections, hub glyphs, right-aligned claims and counted asks; filters 1–6 and f; map grouping" failed once on a droplet: run e3c4d0f0 for T-815 at c14d40f5 (A-5536, around line 55450). The assertion at line 931, "claim and two counted open asks, over the hub status", read a frame whose T-2 row had no claim or ask count yet, and the test's load-gate repetitions then passed 5/5. The test asserts on a frame before the claim and asks events are rendered.

## Acceptance criteria

- [x] C1. The test waits on an observed frame that carries the claim and both asks, not a fixed point in the script; all original assertions are kept, with a red-to-green proof that delays the asks event.
  - verified: rev-30 [reviewer] · run rev-20261018-817-source · 2026-10-18T19:20:20.445Z · commit 05b208a9b5a10fc253faa610301ad61fea3c2345
  - verified: rev-30 [reviewer] · run rev-20261018-817-final · 2026-10-18T19:29:45.811Z · commit 05b208a9b5a10fc253faa610301ad61fea3c2345
  - done: impl-817 · 2026-10-18T19:29:56.297Z
- [x] C2. The file passes 20 serial runs on macOS and one droplet run.
  - verified: rev-30 [reviewer] · run rev-20261018-817-final · 2026-10-18T19:29:45.811Z · commit 05b208a9b5a10fc253faa610301ad61fea3c2345
  - done: impl-817 · 2026-10-18T19:29:56.917Z

## Comments

### impl-817 · 2026-10-18T19:11:59.379Z

Implementation started at existing T2 recorded-frame client seam. Reproduce with delayed inbox/asks delivery, preserve every assertion, then 20 serial macOS file runs, host lint/typecheck, source review and mode-free droplet verify.

### impl-817 · 2026-10-18T19:19:20.155Z

Implemented at 05b208a9 (pushed to origin). Initial frame barrier now requires the exact claimed T-2 row with ?2 before retaining all 13 original assertions. Delayed inbox.list snapshot proof: original predicate red at claim/two-asks assertion; stronger predicate green, no timer delay. Temporary proof injection removed. macOS: all 20 serial whole-file runs pass, 60 tests each, no skips; file range 16.827–18.250 seconds. npm run test:lint and npm run typecheck pass. origin/dev fetched and merged before source review; QA policy is none.

### rev-30 · 2026-10-18T19:20:20.445Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261018-817-source
commit: 05b208a9b5a10fc253faa610301ad61fea3c2345
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear. C1 verified: bounded existing frame wait now requires the exact rendered T-2 claim/two-asks row; all13 original assertions and later controls retained. A-5541 records both axes and independently audited A-5540 delayed real-frame red/green proof, with temporary injection absent from permanent diff. Mac20/20 whole-file logs pass1200 tests, no failures/cancellations/skips; raw file16.798–18.216s versus wall16.827–18.250s. C2 remains unverified until accepted exact-head droplet evidence. No findings or per-item QA; source clear permits one normal mode-free verify at05b208a9.

Criteria: C1 verified.

### impl-817 · 2026-10-18T19:29:21.122Z

Mode-free droplet verification c44dadfc-b80d-44f9-b0da-6f05c4b5bf56 is green at reviewed head 05b208a9: exit 0, tests 383, pass 380, fail/cancelled 0, skipped 3. Auto selected nvim-only plus hub smoke. Receipt/log A-5542; Linux x64, Node 24.21.0, Neovim 0.12.5; lifetime 484s, cost $0.0336. No source changes after review. Assigned Reviewer received the same-head result automatically; awaiting final evidence verdict.

### rev-30 · 2026-10-18T19:29:45.811Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261018-817-final
commit: 05b208a9b5a10fc253faa610301ad61fea3c2345
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final clear at unchanged05b208a9. A-5542/c44dadfc passes380/383 with zero fail/cancelled, three prerequisite skips: hub smoke8/8 and full Neovim372/375. Independently confirmed shell-component60/60 ordinary positives, changed items-panel case0.664550393s and5/5 repetitions. Prior A-5540 Mac20/20 complete files/1200 passes and delayed-frame proof remain audited in A-5541. A-5543 records both axes and timing/report-only limits; no findings or per-item QA. C1–C2 verified; claimant done marks remain separate.

Criteria: C1 verified, C2 verified.
