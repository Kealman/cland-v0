---
id: T-1975
kind: task
title: "inbox.list takes 17–19% of the hub's main thread on an idle hub (5% after restart #83)"
state: closed
status: done
size: M
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: E-1883
blocked_by: []
topic: topic-1638
branch: t/T-1975-inbox-list-takes-17-19-of-the-hub-s-main
created: 2026-11-18T12:37:47.082Z
updated: 2026-11-19T02:53:32.607Z
closed: 2026-11-19T02:53:32.607Z
---

## Summary

From the profile behind T-1973 (2026-11-18, hub pid 52877, three 8 s profiles at 12:31–12:32Z). `inbox.list` (hub/src/hub/inbox.ts:335, via :713) took 17–19% inclusive of the main thread, with `inboxMessages` (store.ts:1948) at 9–11%, against 5% after restart #83. The inbox grows with every topic message, and each list call appears to read and decode more of it than the page it returns.

## What to build

Bound `inbox.list` work by the page it returns: indexed queries over the unread and recent window, and no full decode of retained history per call. Keep the reply shape and ordering unchanged.

## Acceptance criteria

- [x] C1. With 100,000 retained messages, an inbox page decodes at most the rows it returns plus a bounded overhead, counted through a seam (test).
  - done: impl-1975 · 2026-11-19T01:30:20.913Z
  - verified: rev-39 [reviewer] · run rev-20261119-1975-final-4 · 2026-11-19T01:56:07.911Z · commit 734ab705e84dc4177c47da0c7bebedd9710766b9
- [x] C2. Inbox results (order, unread counts, cursors) are identical to the current implementation on a recorded fixture, and every inbox.list consumer is listed (rule 20).
  - done: impl-1975 · 2026-11-19T00:57:37.765Z
  - verified: rev-39 [reviewer] · run rev-20261119-1975-final-4 · 2026-11-19T01:56:07.911Z · commit 734ab705e84dc4177c47da0c7bebedd9710766b9

## Comments

### impl-1975 · 2026-11-19T00:45:10.220Z

C1 positive control on pre-fix candidate query (macOS, Node 24.21.0, local targeted T2): literal failure `AssertionError [ERR_ASSERTION]: decoded 100000 for 3 returned messages`. C2 baseline captured before source change: IDs retained-99999, retained-99998, retained-99997; needsYou=3; topic retained unread=100000/readSeq=0. No pagination cursor exists on Inbox; readSeq is the retained topic cursor. Post-change first targeted run decodes 3 with identical facts and whole-reply comparison to frozen oldInboxMessages oracle. More compatibility/plan checks pending.

### impl-1975 · 2026-11-19T00:47:43.436Z

Rule 20/41 consumer inventory: docs/hub/inbox-window-consumers.md lists all 191 matching production, CLI, web, Neovim, heartbeat/budget, setup, remote, raw protocol, shipped docs/skills, frozen-fixture and T1–T4/Web test files (with tier where declared). Searches covered inbox.list, inboxMessages, inbox.list(), needsYou, archiveToday across hub/src, web/src, nvim/lua, shared, .agents, docs and all test roots, including JSON fixtures. All wire readers stay unaffected: no reply field, ordering, cursor or aggregate changes. Retained regression compares the entire new-board reply against a board supplied by frozen oldInboxMessages, including preferences/old override/read/reply transitions. Conservative fallback for nonstandard timestamps and explicit old pins/old=now policy is documented.

### rev-39 · 2026-11-19T01:03:39.903Z

verdict: review
result: clear
by: rev-39 [reviewer]
run: rev-20261119-1975-source-1
commit: f3de3ec7f2e3d640bbfed8ccf211dc4e273b6e99
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source review clear at f3de3ec7f2e3d640bbfed8ccf211dc4e273b6e99 (tree c8c30b2fc0b9e156dccc8a1b20d9d71dd5ce7f56), base a6f2006b15c70ca108cf9d129825d5b2cad23ae4. Standards: no findings. Spec: no findings. Indexed recent candidates preserve the seven-day boundary, conservative legacy timestamp fallback, pins/old=now, and age-independent requests/latest waiting rows/durable waits; ordering and reply construction remain unchanged. Whole-reply frozen-query regressions and 100,000-row production decoder/query-plan seam cover the requested contracts; 191-consumer inventory recorded. A-21466: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-21466-t-1975-exact-head-source-review-at-f3de3ec7f.md. C1/C2 remain unverified pending same-head configured evidence. A-21464 targeted final 38/38 macOS Node24.21.0 and lint/typecheck inspected; its earlier 100-file T1 evidence predates the last timestamp guard and is not treated as final-head full coverage. No Reviewer execution or configured/Web/T3/T4 pass claimed. Candidate-query scope only; Coordinator-kept durable wait reconciliation stays separate M Tech debt.

### rev-39 · 2026-11-19T01:27:20.580Z

verdict: review
result: not clear
by: rev-39 [reviewer]
run: rev-20261119-1975-evidence-2
commit: f3de3ec7f2e3d640bbfed8ccf211dc4e273b6e99
scope: evidence
findings: [{"severity":"medium","text":"Configured run 3cf67ab6 fails the enforced case budget: `inbox decodes only its recent window with 100,000 retained unread messages 5.229 s > 5 s`; T2 and overall exit 1 despite passing assertions. Resolve setup cost or Coordinator-owned bounded exception before fresh review/verification.","file":"hub/test/inbox-query.test.ts","line":16}]
finding_counts: {"high":0,"medium":1,"low":0}

Same-head configured evidence not clear: 3cf67ab6/A-21478 finished failed at source-clear f3de3ec7f2e3d640bbfed8ccf211dc4e273b6e99. Actual failure quoted in finding; enforced5s is separate from report-only2s advice. Positive receipts retained: decoder3/returned3, exact IDs/needsYou/unread/readSeq, actual recent index range plan; both new generated cases5/5 assertion-passing load repetitions. This does not make the configured run pass. C1 failed for case-budget rejection; C2 compatibility receipts retained, remains unverified. T0/T1 exit0; T2 exit1;6375 assertions passed before interruption, Web unexecuted, T3 merge-batch deferred,T4 unexecuted. Linuxx64 droplet c-8ams3 Node24.21.0 workers2; browser provenance null. Runner provenance tree82483a44c3e787f2aca59d5ff5e02a30f9ecb814 at exact head, no cache. Detailed evidence review artifact published in topic; source A-21466 remains audit, no new product correctness finding or Reviewer test run.

Criteria: C1 failed (Configured C1 test rejected by enforced 5-second case budget: 5.229s; decoder=3 and assertions passed, but run3cf67ab6 failed.).

### rev-39 · 2026-11-19T01:31:42.225Z

verdict: review
result: clear
by: rev-39 [reviewer]
run: rev-20261119-1975-source-3
commit: 734ab705e84dc4177c47da0c7bebedd9710766b9
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Fresh source clear at734ab705e84dc4177c47da0c7bebedd9710766b9, tree4f3592e93a5660fc20925fb96ee429bb5c236a3a. Standards0/Spec0 findings. Only duplicate 100k legacy decode/second board list removed; exact independent result facts, decoder bound and actual timestamp index plan remain. Separate complete-reply policy differential retains every assertion; guide corrected. Production and consumer inventory unchanged, prior full source audit A-21466 carried. A-21481: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-21481-t-1975-corrected-source-clear-at-734ab705e.md. A-21480 targeted local macOS Node24.21 C1 body2.577s/policy424ms and lint/typecheck0 reviewed; no new configured evidence. Prior3cf67ab6/A-21478 remains failed5.229s>5s, not superseded by targeted checks. No allowance introduced. C1/C2 await same-head configured result; no Reviewer runtime execution.

### rev-39 · 2026-11-19T01:56:07.911Z

verdict: review
result: clear
by: rev-39 [reviewer]
run: rev-20261119-1975-final-4
commit: 734ab705e84dc4177c47da0c7bebedd9710766b9
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final exact-head evidence clear. Run9973e1bd/A-21487 passed at734ab705e84dc4177c47da0c7bebedd9710766b9, branch unchanged; runner treea5f27811ae4ef680e4e09ad93263e0018f13e4f8/cache null. C1 generated case passed2.428580783s (<enforced5s), decoded3/returned3 with exact IDs/needsYou3/unread100000/readSeq0 and timestamp-index range plan. C2 complete policy reply differential passed0.612024390s; both generated cases each5/5 load receipts checked. C1/C2 verified with source audits A-21481/A-21466 and191-consumer inventory. T0/T1/T2/Web exit0; aggregate6891/6891 zero fail/cancel/skip; T3 batch-deferred,T4 unexecuted. Linuxx64 c-8ams3 Node24.21.0 Neovim0.12.5; actualChromeHeadlessShell1248/GoogleChromeTesting156.0.8078.4; duration/test-lint/ratchet advice report-only, no allowance. Parent3cf67ab6/A-21478 remains failed5.229s>5s, separately retained, not relabelled. A-21488: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-21488-t-1975-final-exact-head-evidence-clear-at-734ab705e.md. No Reviewer runtime execution or all-tier/whole-hub latency claim.

Criteria: C1 verified, C2 verified.

### coord · 2026-11-19T02:53:32.607Z

Merged 2d7fe873efb8abfedda195bdccd4835ad0d62f0d onto dev.
