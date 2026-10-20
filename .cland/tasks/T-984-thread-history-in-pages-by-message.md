---
id: T-984
kind: task
title: Thread history in pages by message number
state: open
status: review
size: S
criterion_seq: 5
labels:
  - ready-for-agent
assignee: null
parent: E-412
blocked_by:
  - T-979
topic: topic-776
branch: t/T-984-thread-history-in-pages-by-message
created: 2026-10-20T16:50:00.375Z
updated: 2026-10-20T21:04:21.980Z
---

## Summary

Each message carries its number, and `topic.history` reads a thread in pages before or after a number, at most 200 a page. A client can then read a long thread without gaps or repeats.

## What to build

Messages get a monotonically increasing number in the store, and the number rides on `TopicMessage`. `topic.history` takes `before` or `after` a number. Without either, it answers as it does today, so Neovim keeps working. `events.list` keeps its own cursor.

## Acceptance criteria

- [x] C1. Each stored message carries a number, and `topic.history` with `before` or `after` returns at most 200 messages a page (test).
  - done: impl-984 · 2026-10-20T21:03:16.599Z
- [x] C2. A thread of 450 messages reads in three pages backwards and three pages forwards with no gap and no repeat (test).
  - done: impl-984 · 2026-10-20T21:03:16.640Z
- [x] C3. A message recorded between two page reads appears once, in a later `after` page (test).
  - done: impl-984 · 2026-10-20T21:03:16.688Z
- [x] C4. `topic.history` without `before` or `after` answers as today, and Neovim's thread tests pass without edits.
  - done: impl-984 · 2026-10-20T21:03:16.724Z
- [x] C5. `hub/README.md` documents the pages.
  - done: impl-984 · 2026-10-20T21:03:16.757Z
  - verified: rev-23 [reviewer] · run rev-20261020-984-source · 2026-10-20T21:04:21.980Z · commit b30718ea7883b58659f3100ee676bb2d19ee2529

## Comments

### impl-984 · 2026-10-20T20:59:18.494Z

Existing messages.seq/counters.message_seq already provide durable monotonic numbering and messages_seq(topic,seq) indexing. Plan: expose seq on TopicMessage and support numeric exclusive before/after; retain string before for Neovim. No new schema migration/backfill is needed. Store/core T1 tests will cover the 450-message traversal, interleaved insert, filter/cursor validation, and legacy limit/order.

### rev-23 · 2026-10-20T21:04:21.980Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261020-984-source
commit: b30718ea7883b58659f3100ee676bb2d19ee2529
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

# T-984 source review

Head b30718ea7883b58659f3100ee676bb2d19ee2529; tree 0d00ad700c3a94c32f2ce1ec8596509b7f640fe0. Fixed base e58f0c45eb529ad422de59e5fd58b5d2ec6b5f3d (pre-review merged dev). Reviewed all nine task files; Neovim thread.test.ts is unchanged.

## Standards
No findings. Reuses the existing durable messages.seq counter and (topic,seq) index with no new schema/backfill/startup write change. Numeric cursor values are safe non-negative integers, before/after are mutually exclusive on the wire and at HubCore, and Agents filters remain restricted and applied before the limit. SQL values remain bound parameters. Default/message-id queries retain their prior created_at/rowid selection order.
Live message publication and human-send results read seq from the recorded row; history and inbox expose that same durable field. TypeScript shared/wire contract and conformance assertions agree. Existing process boundaries are retained; new pagination tests use the in-process core/store. Matching API/test docs describe the new fields and compatibility. Diff check is clear.

## Spec
No findings. Numeric after selects earliest matching seq above the exclusive cursor; numeric before selects latest below it, then returns ascending output. Both cap at 200, preserving the default 50 and old no-cursor/string-before behavior. Tests traverse 450 rows in 200/200/50 pages both directions, with intentionally reversed timestamps and interleaved other-topic seq gaps. They verify no duplicates/missing ids, empty terminal pages, filtering and monotonic cursor retention after pruning.
Interleaved human insertion appears once at the later forward tail, with live event/send result sequence equality. Component checks exercise before/after through the real client request boundary. Existing migration tests verify old rows keep their durable numbers across reopen. events.list is untouched. C5 README explains page semantics, boundaries, defaults and compatibility.

## Evidence and verdict
A-8060 is a separately labelled diagnostic on a consistent SQLite backup in an isolated fixture environment, not a live mutation or suite receipt: 271,052,800 bytes, 79,386 numbered messages, single observed Store startup 484.092 ms, unchanged schema, one existing counter reconciliation, no message rewrite. It identifies implementation source by SHA-256 and qualifies measurement scope; no new migration is claimed.
Lead reports local macOS store T1 24/24, topics-component T2 4/4, and unedited Neovim thread 23/23 after the dev merge. Earlier check/static evidence predates the unrelated artifact-render dev merge and is not represented as a current full gate. No Reviewer tests, database opens or product processes ran.
Source clear, verify C5 by source only. C1–C4 runtime settlement awaits the normal exact-head configured mode-free gate; targeted compatibility evidence stays separate. Inherited affected after-stage QA remains separate.
Standards 0 findings; Spec 0 findings.

Criteria: C5 verified.
