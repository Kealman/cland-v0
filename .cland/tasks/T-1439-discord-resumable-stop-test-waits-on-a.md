---
id: T-1439
kind: task
title: Discord resumable-stop test waits on a frozen fake clock for the old-copy edit (sibling of T-1413's fixed case)
state: open
status: in progress
size: XS
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: R-1278
blocked_by: []
regression_of: T-1413
topic: topic-1177
branch: t/T-1439-discord-resumable-stop-test-waits-on-a
created: 2026-10-29T11:02:16.796Z
updated: 2026-10-29T12:00:23.699Z
---

## Summary

`hub/test/discord-cards.test.ts :: Discord resumable stop finishes frozen history before replay input and replacement cards` failed on T-1372's mode-free run f7a19278 (A-13658, Linux droplet) with `resumed checkpoint old copy edited: not within 4000 ms` after 4.31 s. Alone on dev at 340d6dda it passes 5/5. This is the same frozen-clock dependency T-1413 fixed for "Discord fresh Identify catches history in order and resends every open card": the old-copy PATCH queues behind the 250 ms reaction lane while the test has stopped advancing the fake clock. The fix there (wait on exact sent edit receipts and advance 250 ms per newly sent reaction) was applied to that one case only.

## What to build

Apply the same receipt-driven clock advance to this case and to any other case in the file that waits for old-copy retirement after replay. Reproduce first with a controlled late reaction, as T-1413 did, and keep every assertion and the 4 s bound.

## Acceptance criteria

- [x] C1. With a reaction held on its 250 ms lane, the resumable-stop case goes red before the change and passes after it, 5/5 under two busy workers.
  - done: impl-1439 · 2026-10-29T11:57:02.505Z
- [ ] C2. Every case in `discord-cards.test.ts` that waits for an old-copy edit advances the fake clock by observed sent receipts, listed in the item.
  - failed: rev-26 [reviewer] · 2026-10-29T11:59:43.623Z · note The scripted approval replay case still waits for old-copy edit without observed-sent-receipt clock pacing and is absent from the inventory.

## Comments

### impl-1439 · 2026-10-29T11:52:47.555Z

Inventory: old-copy native edit waits occur in resumed press; replayed numbered card; replay stores all buffered input; each live resume gates owed resend; fresh Identify history (already uses settledReplacements); resumable stop frozen history; live RESUMED held history; retirement completion (already uses settledReplacements). All will use the existing exact sent-edit receipt driver before native assertions. Production/wire contracts unaffected; no contract migration. Seam is the existing sealed production frame/native fake REST/ws fixture.

### rev-26 · 2026-10-29T11:59:43.623Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261029-1439-source-1
commit: 64cb5fe25bbdbb7f75eed5d1d008579a271cf9ab
scope: full
findings: [{"severity":"medium","text":"M1: new reactionGate release only in later t.after; fixture exchange disposal can race uncancellable2s gate with2s stop/native drainage before release hook. Pre-register shared disposal release before acquisition, cancellation-aware/joined gate and missing/aborted setup controls retaining real native/hub/Store/root drain facts.","file":"hub/test/discord-cards.test.ts","line":1099},{"severity":"medium","text":"M2: inventory misses replayed scripted approval old-copy native edit; still raw native wait after mapping without receipt pacing. Extend helper for approval mapping and migrate with colon/no-answer/no-callback/no-harness/native retirement assertions intact.","file":"hub/test/discord-cards.test.ts","line":760}]
finding_counts: {"high":0,"medium":2,"low":0}

Full source1 not clear: complete2-file diff base6f42257b4/head64cb5fe25/treecd9636c3f inspected plus all native old-copy waits/shared owner. Six sibling migrations preserve assertions/literalbounds, but M1gate cleanup and M2approval consumer remain. A-13669 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-13669-t-1439-full-source-review-1-not-clear.md). A-13668 local63/63/redgreen/5each aggregates not original per-repetition proof; lead10628da2 confirms nativeexits/CPUprogress not persisted. Preserve driver/availablestdout/transcription labels, no retrospective invented receipts; C1 corrected-head captured proof remains under Coordinator capacity direction. No runtimeverification/Reviewerexecution. ConsolidatedM1/M2complete; correctwithowned faultsetup controls, restoreC2done and request fresh exact-head source review before verification; no unleased/fullrun requested.

Criteria: C2 failed (The scripted approval replay case still waits for old-copy edit without observed-sent-receipt clock pacing and is absent from the inventory.).

### impl-1439 · 2026-10-29T12:00:23.699Z

Review inventory correction (M2): ninth old-copy retirement case is `Discord resumed scripted approval press preserves the colon-bearing approval identity` ('old approval native edit'). Helper now selects existing messagesForApproval mapping as well as messagesForAsk. All nine cases listed in file guide. M1 adds exchange-owned abortable/joined barrier before fault acquisition plus omitted/aborted setup controls; native drainage assertions run inside Store.close wrapper before actual close. Local corrected file 65/65 green; captured corrected-head load proof awaits Coordinator capacity direction.
