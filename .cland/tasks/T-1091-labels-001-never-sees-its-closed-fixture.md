---
id: T-1091
kind: task
title: LABELS-001 never sees its closed fixture question under the stdio hub after T-1089
state: open
status: ready
size: XS
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: E-413
blocked_by: []
regression_of: T-1089
topic: topic-829
branch: t/T-1091-labels-001-never-sees-its-closed-fixture
created: 2026-10-22T02:34:06.693Z
updated: 2026-10-22T02:52:53.740Z
---

## Summary

The E-413 "fields" Linux stage cover 07c4c00a (A-8860, dev c6ee6406, T3 shard-1) fails `nvim/test/qa.test.ts` "fixture values YAML would read as structure reach the client whole, the same under the stdio hub and the stub hub": LABELS-001 under `--hub stdio` ends INCONCLUSIVE with "wait_for timed out after 10000 ms: the two fixture items". The fixture's second item is Q-2, a closed question under the open task T-1. Since T-1089 the real hub's first payload carries closed items of every kind only through parent pages, so the case never sees Q-2. The stub hub path passed earlier at the T-1089 head; the stdio path runs only in T3.

## Acceptance criteria

- [x] C1. LABELS-001 passes under both `--hub stdio` and `--hub stub` at the task head, with Q-2's fields (closed, parent T-1, blocked_by T-1, labels) still asserted in full; the case reaches Q-2 the way the client now does (its parent page or the item view), not by restoring closed items to the first payload (test).
  - done: impl-1091 · 2026-10-22T02:41:31.018Z
  - verified: rev-23 [reviewer] · run rev-20261022-1091-final · 2026-10-22T02:52:53.563Z · commit 182666cd7f90858354e885e0e7d6e075daf6d09a
- [x] C2. Every other QA case and Neovim T3 test that reads a closed item from the first payload is listed in the item topic, as checked or fixed, from a search of qa/cases and nvim/test (doc).
  - done: impl-1091 · 2026-10-22T02:41:31.087Z
  - verified: rev-23 [reviewer] · run rev-20261022-1091-source · 2026-10-22T02:43:53.501Z · commit 182666cd7f90858354e885e0e7d6e075daf6d09a
  - verified: rev-23 [reviewer] · run rev-20261022-1091-final · 2026-10-22T02:52:53.563Z · commit 182666cd7f90858354e885e0e7d6e075daf6d09a

## Comments

### impl-1091 · 2026-10-22T02:41:30.958Z

Implementation at 182666cd7f90858354e885e0e7d6e075daf6d09a (tree 78934ece616f1742e12de8cf2d4edac8799b8933), after fetching/merging origin/dev df935454. C1: LABELS explicitly expands T-1's page and observes Q-2; all original Q-2 fields remain exact assertions under stdio/stub. Per Coordinator b1a4f1f also fixed FOLLOWS to expand E-2, retain five fixture items, fetch relationship facts through E-4 card, explicitly focus the card, and preserve all follows/card/item-view assertions. Added T3 regression under both hubs. C2 audit published in topic-829 as A-8864, listing all shipped closed-row startup readers and T3 checks. Red receipts A-8865/A-8866 show actual 10s startup timeouts. Exact-head local direct nvim/test/qa.test.ts: Darwin arm64, Node v24.21.0, 24/24 passed, zero skipped/failed, wall 17.798325625s; no suite duration/load gate enforced. Both LABELS and FOLLOWS run stdio and stub. Execution used disposable cwd/HOME/XDG/Git config and shared credential filtering. Coordinator fe15d11c directs mode-free droplet gate after source review and Linux T3 via later dev stage covers; no Linux T3 pass claimed.

### rev-23 · 2026-10-22T02:43:53.501Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261022-1091-source
commit: 182666cd7f90858354e885e0e7d6e075daf6d09a
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear, no findings. LABELS waits for T-1 then Q-2 via its parent page; all original full-field assertions remain. Coordinator-authorized FOLLOWS loads E-2 page, retains five-item/card/item-view checks and adds stdio/stub exact-identity T3 regression. C2 audit A-8864 independently checked against searches/tiers/producers and verified. A-8867 direct local Darwin24/24 supports C1; configured exact-head mode-free droplet receipt still required. Linux T3 deferred to Coordinator's dev stage covers per fe15d11c; no extra full run. Review artifact A-8868.

Criteria: C2 verified.

### rev-23 · 2026-10-22T02:52:53.563Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261022-1091-final
commit: 182666cd7f90858354e885e0e7d6e075daf6d09a
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

C1/C2 verified. A-8867 local Darwin T3 qa.test.ts24/24 proves LABELS/FOLLOWS stdio and stub with full fields/identity/card assertions. A-8869 exactly matches reviewed head: configured Linux T1/all-T2/Web exit 0,2394 ordinary passes/363 files, no failures/skips. No T3 or scoped load finishes in task receipt; no inferred Linux native/5/5 proof. Coordinator fe15d11c explicitly defers Linux T3 to post-landing dev stage covers. C2 audit already source-verified. Existing report-only diagnostics and after-stage QA limits retained. Final audit A-8870; ready for Coordinator enqueue.

Criteria: C1 verified, C2 verified.
