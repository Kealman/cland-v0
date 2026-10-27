---
id: T-1374
kind: task
title: Tracker hand-edit re-index test asserts a 1 s wall-clock bound that a loaded macOS cover misses
state: open
status: in progress
size: S
labels:
  - ready-for-agent
assignee: null
parent: R-1278
blocked_by: []
topic: topic-1117
branch: t/T-1374-tracker-hand-edit-re-index-test-asserts
created: 2026-10-27T14:47:10.797Z
updated: 2026-10-27T15:38:00.480Z
---

## Summary

The combined macOS stage cover 1e276de4 at dev 91d2dc4a (A-12809) failed in T3 on hub/test/tracker.test.ts "a hand edit of an item file is re-indexed within a second": `AssertionError: re-indexed 1314 ms after the write` (tracker.test.ts:73), at a peak 1-minute load of about 7. Run alone on the same Mac afterwards, it passed 5/5. T-1362 (77d11337) was the last change to touch that file. The cause is a real-time bound under load (the wall-clock-assertion lint kind), not a correctness failure.

## What to build

Replace the 1 s wall-clock assertion with a receipt-based check: the watcher's re-index event for that file arrives. Prove promptness through an injected clock or the watcher's own debounce settings, not elapsed real time. If the T-1362 remote-state push added work to the re-index path, record that too.

## Acceptance criteria

- [ ] C1. The test asserts the re-index receipt without a real-time bound and passes 10/10 under the load gate's CPU load at two workers (test).

## Comments

### coord · 2026-10-27T15:17:01.397Z

A second case of the same class, 2026-10-27 15:16Z. The macOS stage cover rerun ce65f192 at 91d2dc4a (A-12817, peak load 10.2) failed only hub/test/verdict-commit.test.ts "a hand-copied clear verdict cannot replay hub provenance after a later not-clear verdict". The provenance list came back ['hub','hub'] where ['hub','hub','file'] was expected: the hand-edited verdict file hadn't been re-indexed when the assertion ran. Run alone afterwards, it passed 5/5. Both cases are a file-watcher re-index racing a bounded wait under load. Include this case in C1: wait on the re-index receipt for the edited file, not on elapsed time.

### impl-1374 · 2026-10-27T15:35:27.924Z

Read scope and recorded red evidence: tracker.test.ts failed `AssertionError: re-indexed 1314 ms after the write` (A-12809); verdict-commit.test.ts read ['hub','hub'] instead of ['hub','hub','file'] before watcher completion (A-12817). Planned repair uses existing task-reindexed log receipts, armed for the exact filename before every relevant hand edit; bounded harness until waits provide failure diagnostics, with all result/provenance assertions retained. No production or wire contract change. Inspecting existing deterministic debounce coverage to preserve the 100 ms settling contract independently of OS scheduling. Local runtime tests blocked by Coordinator cover-quiet.

### impl-1374 · 2026-10-27T15:38:00.480Z

Consumer/contract assessment: changes are limited to test fixtures, native watcher regressions and a fake-time debounce regression; no shared production contract changes. T-1362 inspection (`git show 77d11337`): tracker.test.ts only gains the initial remote.state consumption. RemoteWorkbench subscribes to remote-store/config/native messenger changes; it does not add a tracker re-index listener or scheduling work. Existing tracker DEBOUNCE_MS remains 100; production unchanged. Native receipt helper excludes the pre-write log prefix and matches the exact filename/source.
