---
id: T-1374
kind: task
title: Tracker hand-edit re-index test asserts a 1 s wall-clock bound that a loaded macOS cover misses
state: closed
status: done
size: S
criterion_seq: 1
labels:
  - ready-for-agent
assignee: null
parent: R-1278
blocked_by: []
topic: topic-1117
branch: t/T-1374-tracker-hand-edit-re-index-test-asserts
created: 2026-10-27T14:47:10.797Z
updated: 2026-10-27T16:16:59.881Z
closed: 2026-10-27T16:16:59.881Z
---

## Summary

The combined macOS stage cover 1e276de4 at dev 91d2dc4a (A-12809) failed in T3 on hub/test/tracker.test.ts "a hand edit of an item file is re-indexed within a second": `AssertionError: re-indexed 1314 ms after the write` (tracker.test.ts:73), at a peak 1-minute load of about 7. Run alone on the same Mac afterwards, it passed 5/5. T-1362 (77d11337) was the last change to touch that file. The cause is a real-time bound under load (the wall-clock-assertion lint kind), not a correctness failure.

## What to build

Replace the 1 s wall-clock assertion with a receipt-based check: the watcher's re-index event for that file arrives. Prove promptness through an injected clock or the watcher's own debounce settings, not elapsed real time. If the T-1362 remote-state push added work to the re-index path, record that too.

## Acceptance criteria

- [x] C1. The test asserts the re-index receipt without a real-time bound and passes 10/10 under the load gate's CPU load at two workers (test).
  - done: impl-1374 · 2026-10-27T15:49:35.184Z
  - verified: rev-26 [reviewer] · run rev-20261027-1374-evidence-1 · 2026-10-27T16:10:23.265Z · commit 257a98a6f325d778c036471a20b875882aa3d3e1

## Comments

### coord · 2026-10-27T15:17:01.397Z

A second case of the same class, 2026-10-27 15:16Z. The macOS stage cover rerun ce65f192 at 91d2dc4a (A-12817, peak load 10.2) failed only hub/test/verdict-commit.test.ts "a hand-copied clear verdict cannot replay hub provenance after a later not-clear verdict". The provenance list came back ['hub','hub'] where ['hub','hub','file'] was expected: the hand-edited verdict file hadn't been re-indexed when the assertion ran. Run alone afterwards, it passed 5/5. Both cases are a file-watcher re-index racing a bounded wait under load. Include this case in C1: wait on the re-index receipt for the edited file, not on elapsed time.

### impl-1374 · 2026-10-27T15:35:27.924Z

Read scope and recorded red evidence: tracker.test.ts failed `AssertionError: re-indexed 1314 ms after the write` (A-12809); verdict-commit.test.ts read ['hub','hub'] instead of ['hub','hub','file'] before watcher completion (A-12817). Planned repair uses existing task-reindexed log receipts, armed for the exact filename before every relevant hand edit; bounded harness until waits provide failure diagnostics, with all result/provenance assertions retained. No production or wire contract change. Inspecting existing deterministic debounce coverage to preserve the 100 ms settling contract independently of OS scheduling. Local runtime tests blocked by Coordinator cover-quiet.

### impl-1374 · 2026-10-27T15:38:00.480Z

Consumer/contract assessment: changes are limited to test fixtures, native watcher regressions and a fake-time debounce regression; no shared production contract changes. T-1362 inspection (`git show 77d11337`): tracker.test.ts only gains the initial remote.state consumption. RemoteWorkbench subscribes to remote-store/config/native messenger changes; it does not add a tracker re-index listener or scheduling work. Existing tracker DEBOUNCE_MS remains 100; production unchanged. Native receipt helper excludes the pre-write log prefix and matches the exact filename/source.

### impl-1374 · 2026-10-27T15:49:35.120Z

Implemented at pushed head 08ad2ff6a2984fa77fa7188cc0bc271357ff296f (source commit cafe8dadf; subsequent pre-review origin/dev merge contains tracker records only). Existing pre-fix red receipts are A-12809/A-12817; Coordinator's c6a30da9 cover repeated the same verdict hand-copy race before this fix. Local macOS arm64 results: tracker-summary.test.ts 16/16 (including new deterministic debounce), tracker.test.ts 5/5, verdict-commit.test.ts 6/6. A-12822 holds individually checked exact named load receipts: both affected T3 identities 10/10, two production load-gate workers and owned CPU worker, 31.159 seconds total probe including setup/teardown, excluding earlier checks; CPU progress 273695/286899. CPU joined and all children drained before slot release. Source unchanged throughout probe; no browser. Final typecheck/test:lint/test:tiers all passed after fetch+merge. Test lint report-only, 0 refusals; no duration baseline fabricated (obsolete renamed identity removed). Exported only summary.json after secret-pattern scan with a seeded positive control. No new Linux test duration has yet been measured; new T1 is ~6 ms locally and renamed T3 ~0.9 s locally. Mode-free verification/evidence review pending; no QA required by qaPolicy:none.

### rev-26 · 2026-10-27T15:51:43.319Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261027-1374-source-1
commit: 08ad2ff6a2984fa77fa7188cc0bc271357ff296f
scope: full
findings: [{"severity":"medium","text":"M1 Standards: this guide and hub-test-verdict-commit.test.ts.md need exact test-path headings; both descriptive headings violate unchanged test-docs.test.ts. Keep guard unchanged, retain actual red/green exits, and push the two-heading correction for fresh source review.","file":"docs/agents/tests/hub-test-tracker.test.ts.md","line":1}]
finding_counts: {"high":0,"medium":1,"low":0}

Full source review consolidated in A-12824: Standards M1 medium, Spec no findings. Exact-file/new-log receipts are armed by pre-write log cursor; final CLI/provenance/restart assertions retained. Independent fake-time debounce test retains 100 ms contract; no production/wire change. Existing tiers, retired lint allowance and removed obsolete timing identity reviewed. A-12822 local 10/10-per-identity load summary is targeted macOS evidence, not configured/Linux proof. C1 runtime verification pending. No additional findings; push the prepared heading fix and request fresh review before verification.

### impl-1374 · 2026-10-27T15:52:02.297Z

Source-1 M1 fixed at pushed head 257a98a6f325d778c036471a20b875882aa3d3e1. Exactly two guide headings changed; implementation/test bytes unchanged. A-12823 retains actual test-docs.test.ts red at 08ad2ff6 (exit 1, 2/3) and green with the correction (exit 0, 3/3), local macOS arm64/browser none. No post-review dev merge and no further load run. Requesting fresh source review per consolidated audit.

### rev-26 · 2026-10-27T15:52:28.067Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261027-1374-source-2
commit: 257a98a6f325d778c036471a20b875882aa3d3e1
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Corrected full source clear: Standards 0, Spec 0. A-12825 incorporates A-12824; complete delta is exactly two required guide headings, guard/index/source/test bytes unchanged. Actual local owning guard red exit1 2/3 -> green exit0 3/3 inspected in A-12823. Exact re-index receipts, final CLI/provenance assertions and deterministic 100 ms debounce proof remain sound. C1 runtime mark pending unchanged-head configured evidence; A-12822 local 10/10-per-identity CPU-load proof remains separately attributed to unchanged test bytes. One mode-free configured run may proceed; no QA, Coordinator integrated cover/landing separate.

### rev-26 · 2026-10-27T16:10:23.265Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261027-1374-evidence-1
commit: 257a98a6f325d778c036471a20b875882aa3d3e1
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final original-record evidence clear, C1 verified. A-12828 exact source-2 head, exit0; independent dedup 3747 ordinary passes + 5 separate debounce load passes. Both affected T3 identities pass 1.415844882/4.831573662 s; 11/11 changed-T3 cases once, selected added wall17.753 s excluding machine wait. T1 debounce base .019014481 s + exact5/5 load, max .065631875 s. A-12822 local macOS two-worker CPU 10/10 each remains separately attributed to identical test bytes before heading-only fix; no Linux10/10 claim. T0/allT1/fallback allT2/changedT3/Web complete; broaderT3/T4 unrun. Existing provenance5.623524482 s, T3 ratchet and budgets/lint are report-only; Coordinator e1f4405f explicitly accepts and requires unchanged head. A-12829 preserves exact receipts, platform/browser/host-gate limits. QA none; Coordinator enqueue/landing separate.

Criteria: C1 verified.

### coord · 2026-10-27T16:16:59.881Z

Merged 41ba1bb3c09a46f2366e3af6aeee236c60be55b1 onto dev.
