---
id: T-1106
kind: task
title: subscription-frame test reads a torn journal line right after flushLogs
state: open
status: review
size: XS
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: R-377
blocked_by: []
topic: topic-849
branch: t/T-1106-subscription-frame-test-reads-a-torn
created: 2026-10-22T11:55:11.188Z
updated: 2026-10-22T13:33:47.100Z
---

## Summary

Periodic dev T3 run c9d66ec4 (A-9142, dev 733afdba, Linux droplet) failed `hub/test/subscription-frame.test.ts` "Claude Code consumes one ordered subscription digest through the native frame" with `SyntaxError: Expected ':' after property name in JSON at position 159` at line 61. The test reads `.cland/journal.jsonl` right after `hub.status { flushLogs: true }` and parses every line, but the journal's last line was still incomplete, so it read a torn write. The test passed in 14 other runs today.

## Acceptance criteria

- [x] C1. The test waits, with a bound, for the journal entries it asserts (the `event-delivery` and `injected` records for the message id), parsing only complete lines, or `flushLogs` guarantees the journal's last line is complete before replying, with a regression for whichever side is fixed; every existing assertion stays (rule 9) (test).
  - done: impl-1106 · 2026-10-22T13:21:25.714Z
  - verified: rev-23 [reviewer] · run rev-20261022-1106-source-2 · 2026-10-22T13:23:28.235Z · commit 7b208e63f37eb03822af01ce8c35a705189ce16f
  - verified: rev-23 [reviewer] · run rev-20261022-1106-linux-evidence · 2026-10-22T13:33:47.100Z · commit 7b208e63f37eb03822af01ce8c35a705189ce16f
- [ ] C2. The test passes 20/20 in a local loop on macOS under a parallel CPU load, in a disposable root under rule 15 and outside any stage cover, with every sample listed in the item topic; the mode-free Linux run at the head covers any T1/T2 test this change adds, and the file's Linux T3 receipt comes from the next periodic dev T3 or stage cover after landing (test).

## Comments

### impl-1106 · 2026-10-22T13:17:06.968Z

Implemented at 3918dbbd34d63dcb6d7db16285b5d6f37e9489fa. flushLogs contract drains accepted prefix and does not freeze later producers, so fixed test observation. Shared strict complete-line framing migrated across flushLogs journal parsers; subscription waits require event-delivery and injected for exact id. T1 regression red→green, macOS hub typecheck and report-mode test lint passed. Runtime T2/T3 attempt refused by cover-quiet; waiting for the lift. C2 pending its announced impl-1106 load window. Source review requested early per Coordinator instruction; this is not final evidence review.

### rev-23 · 2026-10-22T13:20:09.313Z

verdict: review
result: not clear
by: rev-23 [reviewer]
run: rev-20261022-1106-source
commit: 3918dbbd34d63dcb6d7db16285b5d6f37e9489fa
scope: full
findings: [{"severity":"medium","text":"M1: this live read-then-split/JSON.parse path and merge-policy.test.ts:150–153 remain outside the shared framing migration and A-9160 inventory. Both read after flushLogs with active writers, preserving the same torn-tail exposure. Migrate both through completeJournalLines and retain all existing assertions.","file":"hub/test/session-resume-component.test.ts","line":145}]
finding_counts: {"high":0,"medium":1,"low":0}

Full source review at 3918dbbd34d63dcb6d7db16285b5d6f37e9489fa/tree 7de6f026d7ad7390f7dc9f468abdd629a779ea8a from fixed base fae121eca210c1385acac6e9b1e30c89c5e8f469: not clear for incomplete requested inventory. Flush-prefix contract choice, exact-id/event bounded subscription waits, strict malformed-complete-line T1 regression and preservation of existing assertions are otherwise appropriate; no production change needed. A-9160 reported local checks are narrative, not independently certified raw runtime receipts. T2/T3 attempt refused before setup; C2 macOS load loop and exact-head Linux T1/T2 evidence remain pending under Coordinator sequence, Linux native T3 deferred to post-landing periodic/stage. No Reviewer test/probe/recorder during cover-quiet. Correct M1 and request fresh exact-head source review before mode-free verify.

Criteria: C1 failed (Requested shared journal-reader inventory/migration omits live flushLogs parsers in session-resume-component and merge-policy; both still JSON.parse an unterminated tail.).

### impl-1106 · 2026-10-22T13:21:25.777Z

M1 fixed and pushed at 7b208e63f37eb03822af01ce8c35a705189ce16f. Migrated session-resume-component and merge-policy variable-based parsers with all assertions unchanged. Re-audited variable split patterns across all flushLogs+journal files. Hub typecheck and diff check pass on correction tree; no runtime retry during cover-quiet. Updated inventory and original retained check output published in the item topic. Requesting fresh source review; C2 remains pending.

### rev-23 · 2026-10-22T13:23:28.235Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261022-1106-source-2
commit: 7b208e63f37eb03822af01ce8c35a705189ce16f
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Corrected full source clear at 7b208e63f37eb03822af01ce8c35a705189ce16f/tree 7696ce51d220615a2471f976a3e2ce2ea9e5f771 from fixed base fae121ec. A-9162 M1 resolved: both omitted variable-based live journal parsers use shared framing; assertions preserved and independent follow-up inventory checked. Flush-prefix contract, exact-message bounded waits, strict malformed-complete-record T1 regression and remaining migration accepted. A-9167 original local implementation red/green 3/3/typecheck/report-only lint retained; no new-head configured/Linux pass inferred. C1 source-established, C2 pending announced local macOS parallel-load 20/20 and exact-head mode-free Linux T1/T2 receipt; native Linux T3 deferred to post-landing periodic/stage. Quiet lifted by c415b5ba but load loops still wait for explicit window after QA. No Reviewer runtime; zero Standards/Spec findings. Initial recording attempt failed during hub restart and did not persist.

Criteria: C1 verified.

### impl-1106 · 2026-10-22T13:33:11.866Z

Exact reviewed head 7b208e63 mode-free Linux droplet verify cfeb14d7-03ff-4e54-b3cb-847893e56360 completed exit 0: 2446 passed, 0 failed; T1 733, T2 1602, Web 29; full T2 fallback across hub/Neovim. A-9173 holds raw log. Lint/duration gates report-only, with reported budget findings; typecheck reused host gate 8946e83ed29a701720d39ce732b02d27d0b8885f, not repeated remotely. Executor c-8 lon1 linux x64, Node v24.21.0, Neovim v0.12.5, workers 2, lifetime 473 s, cost $0.0329. T3 absent/deferred to post-landing periodic/stage per amended C2. C2 remains pending explicit impl-1106 local load window; no CPU load started.

### rev-23 · 2026-10-22T13:33:47.100Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261022-1106-linux-evidence
commit: 7b208e63f37eb03822af01ce8c35a705189ce16f
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Linux evidence portion accepted at unchanged 7b208e63/tree 7696ce51; final C2 remains pending. A-9173/cfeb14d7 original records and hub passed state checked: aggregate/T1/all-T2 hub+Neovim/Web exit 0, 2446 ordinary test and 375 file passes plus five load test/file passes. New T1 ordinary 1261 0.000858802 s; distinct load finishes 1272/1297/1339/1376/1443 max 0.002648474 s, explicit 5/5 at 1446. C1 refreshed. C2's 20/20 local macOS native loop under parallel CPU load still requires explicit Coordinator window; pure T1 repetitions do not substitute. Native Linux T3 deferred to post-landing periodic/stage, no T3/T4/QA/final-ready claim. Linux x64 c-8 lon1, 473 s/$0.0329, reused host 8946e83e; report-only lint/duration/ratchet, two missing baselines. No further unchanged-head verify requested; retain this green receipt.

Criteria: C1 verified.
