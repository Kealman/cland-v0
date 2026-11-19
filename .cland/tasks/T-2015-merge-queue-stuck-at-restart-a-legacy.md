---
id: T-2015
kind: task
title: "Merge queue stuck at restart: a legacy merge-batch candidate from a pre-T-1956 hub blocks the queue, and cancel plus re-enqueue doesn't clear the blocked batch"
state: open
status: review
size: S
criterion_seq: 4
labels:
  - ready-for-agent
assignee: null
parent: E-1883
blocked_by: []
regression_of: T-1956
topic: topic-1665
branch: t/T-2015-merge-queue-stuck-at-restart-a-legacy
created: 2026-11-19T20:30:31.689Z
updated: 2026-11-19T21:07:20.509Z
---

## Summary

At hub restart #89 (2026-11-19 20:27Z, from 5e3a2005c to a8fc01d32), merge batch 16ac6f59 (T-1890, T-1903, tree a5ad6b10) had been prepared by the previous hub. That hub predates T-1956's candidate ownership marker. The new hub refuses to clean the unmarked candidate root `.cland/run/merge-batches/16ac6f59-…` ("candidate cleanup ownership unavailable; root preserved") and blocks the batch. The documented recovery (`cland merge T-n --cancel`, then re-enqueue) doesn't clear it: the blocked batch record stays at the head of the queue, and the re-enqueued members never start. The whole merge queue is stopped. T-1956 added upgrade recovery for legacy dev-T3 probe candidates, but not for merge-batch candidates created by a pre-T-1956 hub.

## What to build

When the hub meets a merge-batch candidate without an ownership marker (a legacy root from before T-1956), it preserves that root (no adoption at deletion), records a durable secondary diagnostic naming the path and reason (rule 39), retires the batch record, and lets the queue form a fresh batch with a fresh candidate path. Cancelling every member of a blocked batch must also clear the blocked batch itself.

## Acceptance criteria

- [x] C1. A persisted legacy merge-batch candidate without a marker, met after an upgrade restart, leaves its root untouched and diagnosed while the queue forms and runs a new batch for the same members (test, red on the current code).
  - done: impl-2015 · 2026-11-19T20:40:03.904Z
- [x] C2. Cancelling all members of a blocked batch clears the blocked batch from `cland merge queue` (test).
  - done: impl-2015 · 2026-11-19T21:05:24.890Z
- [x] C3. A marked candidate whose identity changed is still refused, unchanged from T-1956 (test).
  - done: impl-2015 · 2026-11-19T20:40:05.340Z
- [x] C4. Candidate ownership capture compares the candidate's committed verification tree (the shared reader, excluding `.cland/tasks` and RULES), not the native `HEAD^{tree}`, so a fresh batch on a real project tree, with those paths present and differing, is captured and lands. The regression goes through the actual native inspector and keeps the head, native-birth and private-marker checks (test, red on the current code).
  - done: impl-2015 · 2026-11-19T20:56:42.958Z

## Comments

### impl-2015 · 2026-11-19T20:32:42.873Z

Consumer inventory (rules 20/41): merge-batches.ts durable batch, diagnosis jobs, cleanup retries and reports; merge-queue.ts retained same-head enqueue; merge-batch-territory.ts checkout/removal; dispatch.ts boundary and merge/suite/status publication; dev-t3-probe.ts upgrade preservation; daemon.ts and git-maintenance.ts retained paths; suites.ts persisted batch run identity; CLI merge.ts/suite.ts projections; protocol.ts/shared wire and web VerifyLine/verification/state/connection plus nvim verification/state/hub readers retain their existing optional shape. Tests searched across all tiers: merge-batches, merge-queue, merge-batch-dependencies, dev-t3-search, durations, suite-persistence, verification-tree, suite-t3-interactions, merge-gate, git-maintenance(-recovery), executor-prepare-component, host-allow-list; QA batch briefs, merge skill, frozen CLI usage commands.json searched. No wire or help bytes change; existing clients stay compatible. Internal optional ownership validation boundary will recover idle legacy candidates only; marked roots keep existing cleanup validation.

### coord · 2026-11-19T20:33:43.068Z

Live recovery, 2026-11-19 20:32Z: with the human's explicit authorization (General, answer to ask 9c95cd27: «Удали сам (разрешаю)»), coord removed the legacy candidate worktree `.cland/run/merge-batches/16ac6f59-d5fc-4b4e-be83-4e81907512f9` with `git worktree remove --force`. It was clean, detached at 164afec3a: the two batch commits on top of a8fc01d32. Within 40 s the hub formed fresh batch 63c81cf8 for T-1890 and T-1903, so the queue recovered. That confirms the blockage was the preserved unmarked root alone. This item still needs the product fix, so a future restart doesn't need a human removal.

### coord · 2026-11-19T20:35:47.537Z

Correction to my 20:33Z comment: the queue did not recover. Fresh batch 63c81cf8 blocked at 20:33:33Z on `candidate checkout identity differs from admitted commit`, then on cleanup ownership, and persists even though it has no members. impl-2015 found the second cause (now C4). T-1956's capture compares the native `HEAD^{tree}` with the verification tree, which excludes `.cland/tasks` and RULES, so every batch on a real project tree fails on a hub that includes T-1956. Removing the legacy root was necessary but not sufficient.

### impl-2015 · 2026-11-19T20:39:08.973Z

Additional C4 consumer search: batch-candidate-ownership.ts captures and validates CandidateOwnership.tree, merge-batch-territory.ts builds candidate.tree through committedTreeOrThrow; DevT3Probes upgrade/removal shares ownership. Actual native inspector previously read HEAD^{tree}; it now uses the same committedTreeOrThrow as admission. No ownership record fields or wire shape change; exact head, native directory births and private marker equality stay enforced. Native dependency fixture now commits tracker/RULES and positively asserts full != verification tree; old code red at capture, fixed code 2/2 green locally. C1/C2 red and selected T1 190/190 green; native slot released. Full lint exit 0 with 131 existing report-only findings; typecheck underway. No configured verify receipt yet.

### rev-35 · 2026-11-19T20:47:44.603Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-2015-source-1
commit: dff1f29490287bc6c64d129b9d1021217f239565
scope: full
findings: [{"severity":"medium","text":"M1 · Spec/C2: cancellation-to-empty still awaits successful guarded cleanup before retiring the batch. A marked/other cleanup refusal throws at #cleanup:392 because cancelled members are not completed/excluded/landed, leaving an empty queue blocked. Retire positively cancelled requests while retaining a separate durable cleanup obligation/root fence; keep C3's refusal to remove changed marked roots.","file":"hub/src/hub/merge-batches.ts","line":195},{"severity":"medium","text":"M2 · Standards/rule12: the new cancellation cases construct Tracker before registering stop and without pre-owned openDatabase capture; a constructor rejection after native DB open leaves that connection outside the calling owner's cleanup. Capture native connections before construction and retain root/guard release until positive close.","file":"hub/test/merge-batches.test.ts","line":639},{"severity":"medium","text":"M3 · Standards/rules9,12: changed native C4 callbacks retain raw-t/mkdtemp/ownDirectory and directly awaited Git without an encompassing pre-acquisition setup/body owner. Add separately bounded setup and original native work/resource joins through cancellation/rejected cleanup, retaining committed tracker/RULES/tree-difference and actual inspector assertions.","file":"hub/test/merge-batch-dependencies.test.ts","line":16}]
finding_counts: {"high":0,"medium":3,"low":0}

Source1 full review atdff1f29490287bc6c64d129b9d1021217f239565/tree8a1373ee4ba5ec413aec27152272b954f10a4acb. Three medium findings in A-21904 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-21904-t-2015-source1-marked-cancellation-and-test-acquisition-ownership-gaps.md).

M1, Spec/C2: merge-batches.ts:195 — positively cancelled-to-empty requests cannot retire if a marked candidate/other cleanup refusal is thrown; cleanup is still required before filtering/saving null. Persist the separate cleanup/preservation obligation and retain the root/fence while retiring cancelled batch membership, without weakening C3.
M2, Standards: merge-batches.test.ts:639 — new Tracker constructor precedes its stop registration and lacks pre-owned injectable DB capture through constructor rejection.
M3, Standards: merge-batch-dependencies.test.ts:16 — modified native callbacks have acquired-root ownership but no encompassing pre-acquisition setup/body/native join across cancellation/rejected cleanup. Preserve actual C4/native identity and sentinel assertions while adding the owner.

Leadc8904387 confirms no omitted control/exclusion. No additional source finding in the idle ownerless legacy preservation path, typed durable diagnosis, fresh candidate/run retirement or shared committed-tree identity fix. Marked-root removal refusal remains correct.

Marks: failed C2/C4; C1/C3 remain done/unverified; no verification marks added. Coordinator-published A-21903 now resolves evidence availability; it retains precommit candidate reds/intermediates/190selected T1 and2native passes, final lint/typecheck and their limits. No configured exact-head evidence yet. No Reviewer runtime/edit performed. Consolidate all three corrections then request fresh committed-head review before verification.

Criteria: C2 failed (Cancellation-to-empty handles only unmarked cleanup refusal; marked/other refusal can keep an empty batch blocked. New Tracker test acquisition lacks constructor-failure DB capture.), C4 failed (Changed native regression callbacks lack encompassing pre-acquisition setup/body ownership and joined native cleanup on cancellation/rejected setup.).

### rev-35 · 2026-11-19T21:00:47.419Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-2015-source-2
commit: cc9cbe39c2fc88439f7d0543b529b6689d4e6111
scope: full
findings: [{"severity":"medium","text":"M4 · Spec/C2: diagnosis.unresolved is handled before cancelled membership and #unresolved drops the requests but still calls #cleanup without retiring=true. A marked/inspection refusal can therefore retain an empty blocked batch. Route this durable retired-diagnosis path through the separate guarded cleanup obligation and add a controller regression.","file":"hub/src/hub/merge-batches.ts","line":561},{"severity":"medium","text":"M5 · Standards/rules24,39: the new local ownedTracker duplicates the shared native-capture/close policy and synchronously closes in its constructor catch; a close failure replaces the selected constructor error. Reuse the shared owner seam, preserve the primary error and retain failed close as secondary registered cleanup with an exceptional-path control.","file":"hub/test/merge-batches.test.ts","line":654}]
finding_counts: {"high":0,"medium":2,"low":0}

Source2 full review atcc9cbe39c2fc88439f7d0543b529b6689d4e6111/tree683cda48544808b5b8b27d97baf2d31a58ffa12f. Two medium findings in A-21906 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-21906-t-2015-source2-unresolved-retirement-and-constructor-cleanup-outcome-gaps.md).

M4, Spec/C2: merge-batches.ts:561 — #unresolved runs before cancellation membership checks, durably drops members, then still awaits #cleanup without retiring=true. Marked/inspection refusal can keep the now-empty batch blocked. Preserve the guarded root/cleanup obligation while retiring that already-dropped diagnostic batch; retain actual controller coverage.
M5, Standards/rules24,39: merge-batches.test.ts:654 — local ownedTracker copies existing shared capture/close policy and its constructor catch can replace the original error if synchronous DB close throws. Reuse the shared seam, keep the selected construction error and registered secondary cleanup/positive-close fence. Lead9711979b confirms; M4 was also reported by lead d65e6b63 and traced statically.

Normal refusal/explicit-retry retirement, six cancellation variants, ordinary pre-owned DB capture and native whole-sequence/setup ownership from source1 are resolved. No additional source finding in legacy preservation, fresh candidate/run facts, shared committed-tree identity or C3 native/marker refusal. All original C4 native assertions remain.

Marks: C2 failed; C1/C3/C4 remain done/unverified; no verified marks. A-21905 contains candidate-epoch195selected T1/2native passes, retained reds/lint refusal and final lint/typecheck, not current-head configured proof. No Reviewer runtime/edit performed. Consolidate both corrections then fresh exact-head source review before configured verification.

Criteria: C2 failed (Unresolved diagnosis drops members but still uses non-retiring cleanup, so refused marked/inspection cleanup can hold an empty batch. Constructor-close failure also overwrites its selected construction outcome.).

### rev-35 · 2026-11-19T21:07:20.509Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-2015-source-3
commit: 3a95b1c95ae3907ba8ddb36cdefe6f21d8b9955e
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source3 full review clear at3a95b1c95ae3907ba8ddb36cdefe6f21d8b9955e/tree74e7771dccf28ed8bb225c85fb8d8c4480919a9c. Standards/Spec findings=[]. A-21909 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-21909-t-2015-source3-clear-retired-diagnostics-and-shared-constructor-ownership.md).

M4 resolved: unresolved diagnosis retires through the separate guarded cleanup obligation; normal/unresolved × legacy/marked/inspection × immediate/settled controller variants keep candidate authority and fresh queue/run facts. M5 resolved: local owner policy removed; shared ownedTracker preserves schema error identity while registered failed close remains unconfirmed and a later close settles the captured native DB. Existing fixture disposal gate remains.

Earlier legacy preservation, typed durable diagnosis, cancellation/explicit retry retirement, native setup/body ownership and shared committed-tree comparison fixes remain correct. Exact HEAD/native birth/private marker refusal and original native/sentinel assertions remain; no deletion adoption is introduced. Primary Coordinatora1825f02 assigns the earlier PRAGMA-open close-masking failure to T-1995 and approves this control's schema-scope narrowing; that failed occasion remains separate, not a pass.

No criterion marks added: C1–C4 remain runtime-unverified pending exact-head configured verification including changed native T3. A-21908's230selected T1/lint/typecheck are precommit candidate observations; native2/2 remains prior source2 epoch A-21905. No Reviewer runtime/edit performed. Any changed head requires fresh source review before verification.
