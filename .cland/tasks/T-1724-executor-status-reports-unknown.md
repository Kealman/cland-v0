---
id: T-1724
kind: task
title: Executor status reports "unknown (inspection deferred)" when the local snapshot-key read exceeds its 250 ms bound under load
state: open
status: backlog
size: S
labels:
  - needs-triage
assignee: null
parent: C-325
blocked_by: []
topic: null
branch: null
created: 2026-11-06T11:49:25.020Z
updated: 2026-11-06T11:49:25.020Z
---

## Summary

`hub/src/executor/droplet.ts` `inspect()` computes the snapshot key with `within(this.#key(), 250, this.clock)`. When the local `prepareKey` and Git read takes longer than 250 ms, freshness becomes `unknown (inspection deferred)`. That happens under load or with a slow disk. The live executor status showed exactly this on 2026-11-05/06, and `hub/test/executor-prepare.test.ts:197` ("prepare builds a reusable snapshot, reports its key and replaces it after the committed lock changes") expects `current` from a single read. impl-1708 hit `unknown (inspection deferred)` in a preservation batch (T-1708 head 8495f3eb, macOS, load about 5). The code is identical on dev 0eb62a96, where the case passed once, so this is a pre-existing load-sensitive bound, not T-1708's change.

## What to build

Decide what the 250 ms bound is for. If it's status responsiveness, keep it and cache the key per HEAD/lock digest, so a repeated status read is current once computed and a deferred read can complete in the background. If not, move it to a named setting. Then the test checks the status after the key's first computation, with its assertion unchanged, or the product makes the first read reliable within budget. Never weaken the assertion.

## Acceptance criteria

- [ ] C1. A test that holds the key computation past 250 ms reports `unknown (inspection deferred)` once, and the next status read after the computation completes reports `current` (test, red before the fix).
- [ ] C2. executor-prepare.test.ts passes 10/10 on macOS at a one-minute load of 12 or more, with its assertions unchanged (evidence).
