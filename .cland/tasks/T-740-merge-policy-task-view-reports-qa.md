---
id: T-740
kind: task
title: "merge-policy: 'task view reports QA satisfaction…' saw 'lane or gate inputs changed during lookup' on a loaded droplet"
state: open
status: review
size: S
labels:
  - v0.1.4
  - verification
  - hub
  - flake
  - ready-for-agent
assignee: null
parent: E-482
blocked_by: []
topic: topic-448
branch: t/T-740-merge-policy-task-view-reports-qa
created: 2026-10-17T15:12:22.689Z
updated: 2026-10-17T15:25:07.820Z
---

## Summary

In T-719's run 122d1a12 (A-4563, droplet c-8, peak load 13.1), `hub/test/merge-policy.test.ts::task view reports QA satisfaction from the same durable evidence as the merge gate` failed with `merge-changed: T-1: lane or gate inputs changed during lookup; try again`. The whole file passed 5/5 on the Mac both at T-719's head and at dev (A-4569). That fixture uses projectHub's native defaults, and the file and merge.ts are byte-identical to dev. The gate re-reads its inputs, and something in the fixture or in the hub's own background work changed one between the two reads.

## What to build

Find which input changed: a tracker write, a background sweep or a clock-stamped field. Then either make the test wait for that write's receipt before the lookup, or, if the hub changes a gate input with no user action, fix the hub.

## Acceptance criteria

- [ ] C1. The changed input is named with evidence, and the case passes 10/10 whole-file on the Mac plus once in a droplet verify.

## Comments

### coord · 2026-10-17T15:15:11.962Z

Second occurrence in a different branch: T-694's run 46d9eea8 (A-4572) at 9215c35e, same case, same merge base 42ebe8a0. The hub flagged it as a shared-defect candidate. Both branches carry T-704's merge-policy.test.ts and validation-support.ts (800b7861), so this is treated as a dev defect from T-704's migration, not branch work. Fix forward.

### impl-740 · 2026-10-17T15:19:05.818Z

Diagnosis: the final hand restore races watcher publication. In a red diagnostic widening the existing watcher/gate window, laneRevision changed only the T-1 indexed file hash (84e29b3e… → 615fbaff…) between reads; E-2 hash, claim, holds and receipt list were unchanged. task-reindexed at 15:17:39.184Z follows capture at 15:17:39.045Z. Direct task views saw identical restored ready/QA detail at both ends, showing why a detail read is not an indexing receipt. Added status-publication waits around accepted QA, comment removal and restore; the same diagnostic window passes. Original assertions retained. Required Mac repetitions and reviewed-head droplet run pending.

### impl-740 · 2026-10-17T15:23:45.915Z

Implementation committed/pushed as 1de38f0c7aafb6d36019f9b4676414e178a34b6d. Only merge-policy.test.ts changed; all assertions retained and diagnostic source changes removed. Typecheck and test:tiers green (A-4587). Mac whole-file 10/10, 12 tests each, 20.284–23.803s per file, max sampled load 8.1011 (<15): A-4585 raw log, A-4586 timing/load JSON. origin/dev 7984cc24 merged before source request (its intervening changes were tracker only). Reviewer request queued automatically; awaiting assignment/source verdict before exact-head droplet verify. C1 done mark waits for that Linux receipt.
