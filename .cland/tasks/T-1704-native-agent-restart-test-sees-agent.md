---
id: T-1704
kind: task
title: Native agent restart test sees "agent closed" while cleaning unfinished spawn and worktree preparations (one dev T3 occurrence after T-1698)
state: open
status: backlog
size: S
labels:
  - needs-triage
assignee: null
parent: E-1533
blocked_by: []
regression_of: T-1698
found_by: droplet
topic: null
branch: null
created: 2026-11-06T05:34:21.418Z
updated: 2026-11-06T18:53:01.975Z
---

## Summary

Periodic dev T3 b9aa9e7d at dev 4df6c1ad (A-17027, Linux x64 droplet, peak load 7.6) failed `hub/test/host-prepared.test.ts:52` "native agent restart cleans actual unfinished spawn and worktree preparations before publishing readiness" after 2.46 s. The error was `Error: agent closed` at `hub/src/host/agent-client.ts:30`. It is the first failure of this test seen. T-1698 (e6a2a9f9) is the last change to `hub/src/host/agent/prepared.ts`: it added captured checkout receipts and the preparation and refresh paths. The same code tree passed in the stage 6 Linux cover 38e6c547 (72ba2260), so this is one occurrence and the cause is unknown.

The same run's other failure, host-relaunch-native C2 `push retry required`, belongs to T-1702.

## What to build

1. Reproduce it: run host-prepared.test.ts 10 times on macOS at a load of 12 or more, and 5 times in a Linux `docker run --init` run. Do it on dev, and on 36492afe from before T-1698, to see whether T-1698 introduced it.
2. Find what closes the agent connection during the restart cleanup, and whether a client request races the agent's planned restart.
3. Fix it in the product or in the test's observation of the restart, never by weakening an assertion.

## Acceptance criteria

- [ ] C1. The cause of `agent closed` is named with a reproduction, or a differential of 10 macOS runs under load and 5 Linux runs shows no recurrence on either tree (evidence).
- [ ] C2. When a cause is named: a deterministic test is red before the fix and green after, and host-prepared.test.ts passes 10/10 under load on macOS and 5/5 on Linux `--init` (evidence).

## Comments

### coord · 2026-11-06T05:37:45.440Z

The hub's failing-file rerun 54ea67cd (A-17028, Linux x64 c-8 nyc1, dev fa60199a, peak load 1.3) passed host-prepared.test.ts alone: 15 of 15 tests. Like T-1702, this points to a race that shows only under load, not a deterministic regression. The item stays in Bugs; promote it into E-1532 stage 6 if it recurs in the next stage covers.

### coord · 2026-11-06T18:52:48.959Z

coord: second occurrence.

E-1533 stage-1 Linux cover 2424aed9 at dev e19c3496 (A-17186; droplet c-8 sfo2, 2 shards, old image 250987220) failed shard-2 on `hub/test/host-prepared.test.ts` "native agent restart cleans actual unfinished spawn and worktree preparations before publishing readiness". It failed after 1.80 s with the same `Error: agent closed` at `hub/src/host/agent-client.ts:30:124`.

It was the only failure in that run: 7415 passed. The test is identical to the first occurrence (b9aa9e7d at 4df6c1ad, before stage 1). Stage 1 changes neither `hub/src/host/agent/prepared.ts` nor `agent-client.ts`.

Two occurrences in about 10 h on Linux. Promoted into E-1533 stage 2 as its own lane, so it is fixed before it reddens more covers.
