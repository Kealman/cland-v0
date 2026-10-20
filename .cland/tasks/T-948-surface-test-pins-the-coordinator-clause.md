---
id: T-948
kind: task
title: surface.test pins the Coordinator clause wording T-945 replaced, and T-829's new restart test has no duration allowance
state: closed
status: done
size: XS
criterion_seq: 3
labels:
  - ready-for-agent
assignee: null
parent: E-617
blocked_by: []
regression_of: T-945
found_by: cover
topic: topic-707
branch: t/T-948-surface-test-pins-the-coordinator-clause
created: 2026-10-20T08:18:26.704Z
updated: 2026-10-20T08:33:41.361Z
closed: 2026-10-20T08:33:41.361Z
---

## Summary

The Linux stage cover 4f153ef2 at release candidate 6, 3cc4bede (A-7225), went red on both shards:
- Shard 2: `hub/test/surface.test.ts:81` asserts `/You alone put decision questions to the human/`. T-945 (b1abc9e9) shortened that clause line to "You alone ask the human for decisions: use `ask`, never plain text." and updated roles.test.ts:117 but not surface.test.ts.
- Shard 1: zero failing tests, but the new-test duration rule failed the T3 phase. `hub/test/session-resume-lifecycle.test.ts::restart retains undiscoverable harness PIDs and session stop reaps their spokes and descendants`, added by T-829, takes 15.7 s (11.3 s in the earlier periodic run) with no entry in hub/test/durations.json, and a new test over 5 s fails a run even in report mode.
Both are T3 and so not run by T1-only batches (D67).

## Acceptance criteria

- [x] C1. surface.test.ts asserts the clause's current decision-question rule (the `ask` wording), not the old sentence, and still proves decision questions stay with the Coordinator.
  - verified: rev-31 [reviewer] · run rev-20261020-948-source · 2026-10-20T08:21:56.345Z · commit 1279bbc86e9b3a89ca5365b14e2e1f11b71597fb
  - verified: rev-31 [reviewer] · run rev-20261020-948-final · 2026-10-20T08:28:59.656Z · commit 1279bbc86e9b3a89ca5365b14e2e1f11b71597fb
  - done: impl-948 · 2026-10-20T08:29:21.620Z
- [x] C2. hub/test/durations.json has an `allow` entry for the T-829 restart test with seconds that cover the observed 11–16 s plus load headroom, owner E-880, added 2026-10-20, expires 2026-11-19 (D72's 31-day legacy-owner rule) and a reason naming the two real hubs it starts; the duration lint accepts it.
  - verified: rev-31 [reviewer] · run rev-20261020-948-final · 2026-10-20T08:28:59.656Z · commit 1279bbc86e9b3a89ca5365b14e2e1f11b71597fb
  - done: impl-948 · 2026-10-20T08:29:22.206Z
- [x] C3. surface.test.ts and session-resume-lifecycle.test.ts pass whole as targeted runs, and a mode-free `cland verify` at the reviewed head is green.
  - verified: rev-31 [reviewer] · run rev-20261020-948-final · 2026-10-20T08:28:59.656Z · commit 1279bbc86e9b3a89ca5365b14e2e1f11b71597fb
  - done: impl-948 · 2026-10-20T08:29:22.687Z

## Comments

### impl-948 · 2026-10-20T08:19:09.504Z

Implementation scope: update the stale Coordinator clause assertion and add the specified E-880 30-second restart allowance. Searched hub/test and nvim/test: surface.test.ts is the only old 'put decision questions' pin.

### impl-948 · 2026-10-20T08:19:58.334Z

C1/C2 implemented. Whole targeted runs passed: surface.test.ts 3/3; session-resume-lifecycle.test.ts 2/2 (restart 5.965 s locally); suite-duration-budget.test.ts 9/9. Root npm run typecheck and node hub/test/lint-tiers.ts passed. No old 'put decision questions' phrase remains in hub/test or nvim/test. origin/dev fetched and merged before first review (already current). Additional durations.test.ts run in progress.

### rev-31 · 2026-10-20T08:21:56.345Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261020-948-source
commit: 1279bbc86e9b3a89ca5365b14e2e1f11b71597fb
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-7233: full source clear. Exact current ask wording preserves Coordinator exclusivity and other routing controls. Sole normalized manifest change is exact restart allowance 30s/E-880/Oct20–Nov19, reason names two hubs; A-7225 raw 15.7196s verifies need/headroom. Complete targeted stdout A-7230/A-7231 read; standalone-exit/lint-status limitations retained from 3e9bde4f. C1 verified; C2/C3 await clean exact-head mode-free evidence/admission checks.

Criteria: C1 verified.

### impl-948 · 2026-10-20T08:28:29.874Z

Same reviewed-head mode-free verify 4786f104-40d6-4a73-962d-362809092ba0 is green: 1946/1946, exit 0; all T1 and fallback all T2, exact head 1279bbc86e9b3a89ca5365b14e2e1f11b71597fb. Linux x64 c-8 lon1, lifetime 349 s, cost $0.0242. Log A-7234. T3 files have retained targeted whole-file passes (A-7230/A-7231); source review rev-20261020-948-source clear. Awaiting Reviewer final verdict.

### rev-31 · 2026-10-20T08:28:59.656Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261020-948-final
commit: 1279bbc86e9b3a89ca5365b14e2e1f11b71597fb
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-7235: exact-head A-7234/4786f104 audited: 1946 ordinary passes, accepted manifest/check/T1/fallback T2 green, zero resource/duration failures. C1–C3 verified with source A-7233 and original whole-file surface 3/3 A-7230 / lifecycle 2/2 A-7231 plus normal lint output A-7232. Individual numeric-exit limitations preserved; task excludes changed T3 files, no repaired stage cover claimed. Claimant done marks absent at view.

Criteria: C1 verified, C2 verified, C3 verified.

### coord · 2026-10-20T08:33:41.361Z

Merged 4db6399ccc67532233e64417b60f601dc6cce5c6 onto dev.
