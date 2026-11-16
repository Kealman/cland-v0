---
id: T-1724
kind: task
title: Executor status reports "unknown (inspection deferred)" when the local snapshot-key read exceeds its 250 ms bound under load
state: open
status: review
size: S
criterion_seq: 2
labels: []
assignee: null
parent: E-1881
blocked_by: []
topic: topic-1539
branch: t/T-1724-executor-status-reports-unknown
created: 2026-11-06T11:49:25.020Z
updated: 2026-11-16T07:43:34.823Z
---

## Summary

`hub/src/executor/droplet.ts` `inspect()` computes the snapshot key with `within(this.#key(), 250, this.clock)`. When the local `prepareKey` and Git read takes longer than 250 ms, freshness becomes `unknown (inspection deferred)`. That happens under load or with a slow disk. The live executor status showed exactly this on 2026-11-05/06, and `hub/test/executor-prepare.test.ts:197` ("prepare builds a reusable snapshot, reports its key and replaces it after the committed lock changes") expects `current` from a single read. impl-1708 hit `unknown (inspection deferred)` in a preservation batch (T-1708 head 8495f3eb, macOS, load about 5). The code is identical on dev 0eb62a96, where the case passed once, so this is a pre-existing load-sensitive bound, not T-1708's change.

## What to build

Decide what the 250 ms bound is for. If it's status responsiveness, keep it and cache the key per HEAD/lock digest, so a repeated status read is current once computed and a deferred read can complete in the background. If not, move it to a named setting. Then the test checks the status after the key's first computation, with its assertion unchanged, or the product makes the first read reliable within budget. Never weaken the assertion.

## Acceptance criteria

- [x] C1. A test that holds the key computation past 250 ms reports `unknown (inspection deferred)` once, and the next status read after the computation completes reports `current` (test, red before the fix).
  - done: impl-1724 · 2026-11-16T07:42:58.189Z
- [ ] C2. executor-prepare.test.ts passes 10/10 on macOS at a one-minute load of 12 or more, with its assertions unchanged (evidence).

## Comments

### coord · 2026-11-06T12:35:53.449Z

Second variant of the same family (impl-1708, 2026-11-06, T-1708 head 239362c9, macOS, under load). `hub/test/executor-prepare.test.ts:238` expected `stale: base|nvim` after a pin commit and push, but saw `current`, so freshness read stale state after the change. An alternating comparison afterwards at load of about 3 passed 5/5 on both the T-1708 head and dev 6c0e7703, twice each, so it's intermittent and not tied to T-1708. Both variants of this case (`unknown (inspection deferred)` at :197, and current-instead-of-stale at :238) should be covered by this item's fix.
