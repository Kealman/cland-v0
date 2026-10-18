---
id: T-712
kind: task
title: "A red batch is bisected by failing file: the culprit is refused with merge-bisected, the rest land, a culprit-less repeat proposes quarantine"
state: open
status: planned
size: M
labels:
  - v0.1.4
  - verification
  - hub
assignee: null
parent: E-678
blocked_by:
  - T-711
topic: null
branch: null
created: 2026-10-16T19:59:43.692Z
updated: 2026-10-18T20:04:46.162Z
---

## Summary

A red batch must never become an Implementer's resubmit. The hub finds the culprit by rerunning only the failing files, which cost 10–60 s each as file-level jobs (memo §5.2.5; report-strategy §3c and §4.2.6). With at most three heads, leave-one-out reruns find a single culprit in at most three file-level jobs, and the green leave-one-out tree is exactly the tree the remaining heads land on.

## What to build

- **Batch of one.** A red batch with one member refuses it with `merge-bisected`, naming the failing files and tests.
- **Leave-one-out.** In a larger batch, the hub reruns the failing files on each tree that leaves one member out. If exactly one removal makes them green, that member is refused with `merge-bisected` (naming the file and test that fail with it in), and the rest land on the green leave-one-out tree through T-711's landing.
- **No single culprit.** The failing files rerun once on the batch tree. Green means a flake: the batch lands and each failing file gets a flake observation. Red means every member is refused with `merge-bisect-unresolved` and the Coordinator gets one notice with the evidence.
- **Quarantine proposal.** A test with flake observations in two different batches produces a quarantine proposal, an ask to the Coordinator carrying both receipts, in the form `docs/agents/tests.md` requires for `quarantine.json`.
- **Cost.** File-level jobs and their seconds and cost appear in the batch result.

## Acceptance criteria

- [ ] C1. A red batch of one is refused with `merge-bisected` naming the failing test, proved by a test on the in-process provider.
- [ ] C2. In a red batch of three with one culprit, the culprit is refused with `merge-bisected` and the other two land on the leave-one-out tree after at most three file-level jobs, proved by a test.
- [ ] C3. A red batch whose failing files pass on rerun lands and records a flake observation, and a second observation of the same test in another batch posts a quarantine proposal to the Coordinator, proved by tests.
- [ ] C4. A red batch with no single culprit and a red rerun refuses every member with `merge-bisect-unresolved` and posts one Coordinator notice, proved by a test.
- [ ] C5. The batch result lists each file-level job with its tree, seconds and cost, proved by a report test.
