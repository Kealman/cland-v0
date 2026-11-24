---
id: T-2081
kind: task
title: One `node hub/test/lint-tests.ts` run reaches about 2.2 GB RSS within 22 s, so concurrent lints, verify T0s and enqueue preflights push the Mac into swap
state: open
status: backlog
size: M
labels:
  - needs-triage
assignee: null
parent: C-216
blocked_by: []
topic: null
branch: null
created: 2026-11-24T11:05:11.767Z
updated: 2026-11-24T11:05:11.767Z
---

## Summary

cland-impl measured on 2026-11-24 at about 11:04Z that a single `node hub/test/lint-tests.ts` (pid 40854, one lint-slot run) reaches 2.19 GB RSS within 22 s of starting. `npm run test:lint`, every verify's T0 host gate (`npm run check`) and every enqueue preflight (also `npm run check`) all run it. At 09:03 to 09:08Z, eight concurrent lints would have asked for about 17 GB. Machine swap grew from 1.5 GB to 4.1 GB, the swap file reached 5 GB, and hub #100 logged tracker-storage stalls of 6 to 10 s. The Coordinator now serializes all of these behind one local slot. That rule is a workaround for a memory cost, and it throttles the crew's checks.

## What to build

Make lint-tests.ts stream or shard its inputs, so it never holds the whole test-source corpus or its parse graph at once. Process files in bounded batches and release each batch's ASTs. Record peak RSS in the lint's report line so regressions show.

## Acceptance criteria

- [ ] C1. A full `npm run test:lint` on the current repository peaks under a documented RSS bound, for example 600 MB, measured from the process's own peak-RSS receipt (measurement).
- [ ] C2. Findings and refusals are byte-identical to the current lint on the same tree (test comparing both outputs).
