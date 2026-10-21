---
id: T-1071
kind: task
title: The Items tree from the snapshot
state: closed
status: done
size: M
criterion_seq: 5
labels:
  - ready-for-agent
assignee: null
parent: E-416
blocked_by:
  - T-1052
topic: topic-818
branch: t/T-1071-the-items-tree-from-the-snapshot
created: 2026-10-21T17:32:16.253Z
updated: 2026-10-21T19:50:59.740Z
closed: 2026-10-21T19:50:59.740Z
---

## Summary

The Items area's tree: Neovim's explorer in the browser, built from the hub snapshot and its deltas. E-416's first tracer bullet.

## Parent

E-416 (§3.2, v0.1.2 §3.8 and §3.10; tracer step 1).

## What to build

The current release at the root, with its epics by rank and the done ones after them in close order, Direct tasks (N), and the folded roots: Categories (with the top three, "N more", the open count and the idle-work mark), Unscheduled and Other releases. `A` shows the archived roots. Release, epic and task rows carry their roll-ups from the hub's item summary (T-1052), with cells up to 16 children and a proportional bar beyond, stage groups, claims, holds, verdicts with round and verified/total, the ordinal, and the rank fact only when set by hand. `j`, `k`, `l`, `h` and `za` move and fold, and `D` hides done items. The folds and `D` are kept per client. The cursor stays on its item across deltas. The tree is rebuilt from the model per delta, within 15 ms for 300 items. The prototype on `prototype/web-shell` (`web/src/explorer.ts`) is a reference, never merged.

## Acceptance criteria

- [x] C1. A Web test on a copy of the live tracker opens the Items area at 1440x900 and reads the current release, its epics with bars and stages, Direct tasks and the three folded roots, with the row facts above (Web test).
  - done: impl-1071 · 2026-10-21T19:37:52.875Z
  - verified: rev-23 [reviewer] · run rev-20261021-1071-final · 2026-10-21T19:47:21.943Z · commit e5afb70e38d98a0a1f30b1f54ddc9a890b4be3e7
- [x] C2. A status change sent through the CLI moves the row's place and roll-up while the cursor stays on the same item (Web test).
  - done: impl-1071 · 2026-10-21T19:12:26.403Z
  - verified: rev-23 [reviewer] · run rev-20261021-1071-final · 2026-10-21T19:47:21.943Z · commit e5afb70e38d98a0a1f30b1f54ddc9a890b4be3e7
- [x] C3. `D`, `A`, the folds and the category rows behave as described and the folds persist per client across a reload (Web test).
  - done: impl-1071 · 2026-10-21T18:56:56.534Z
  - verified: rev-23 [reviewer] · run rev-20261021-1071-final · 2026-10-21T19:47:21.943Z · commit e5afb70e38d98a0a1f30b1f54ddc9a890b4be3e7
- [x] C4. Rebuilding the tree for 300 items after one delta stays under 15 ms, measured in the test.
  - done: impl-1071 · 2026-10-21T19:12:26.421Z
  - verified: rev-23 [reviewer] · run rev-20261021-1071-final · 2026-10-21T19:47:21.943Z · commit e5afb70e38d98a0a1f30b1f54ddc9a890b4be3e7
- [x] C5. `web/README.md` and `?` list the Items area's tree keys.
  - done: impl-1071 · 2026-10-21T18:56:57.151Z
  - verified: rev-23 [reviewer] · run rev-20261021-1071-source-2 · 2026-10-21T19:13:55.080Z · commit 828149691d1bc1c0c766d132c1304b2f566fa23b
  - verified: rev-23 [reviewer] · run rev-20261021-1071-source-3 · 2026-10-21T19:27:37.131Z · commit ebe7a407411774c95c9c1bb9e699b4b8cba7b5e8
  - verified: rev-23 [reviewer] · run rev-20261021-1071-source-4 · 2026-10-21T19:38:26.120Z · commit e5afb70e38d98a0a1f30b1f54ddc9a890b4be3e7
  - verified: rev-23 [reviewer] · run rev-20261021-1071-final · 2026-10-21T19:47:21.943Z · commit e5afb70e38d98a0a1f30b1f54ddc9a890b4be3e7

## Comments

### impl-1071 · 2026-10-21T18:47:42.264Z

Test-first C1: Headless Shell on a scratch project copied from .cland/tasks reached the expected red (Items tree locator absent). Initial tree now passes that targeted Web assertion on macOS arm64; no suite receipt yet. Extending the same public seams for CLI deltas, local preferences and the 300-item rebuild bound.

### rev-23 · 2026-10-21T19:06:21.796Z

verdict: review
result: not clear
by: rev-23 [reviewer]
run: rev-20261021-1071-source
commit: 9b9c739f3315636349f2b7ce6c5f5ec993e1e041
scope: full
findings: [{"severity":"medium","text":"M1 (Spec): A task delta carries ItemSummary, not ExplorerSummary. slim-frames only compacts layers (HubCore.#emit); Tracker.listSummaries separately selects the latest verdict per kind and computes round. Casting frame.item directly replaces the correct snapshot verdicts with every raw IndexedVerdict, which has no round. A status change on seeded T-900002 therefore loses review r2 and renders duplicate review keys. Project task deltas into the same typed explorer shape, retain hub facts, and assert the latest verdict/round after the mutation, including a subsequent verdict.","file":"web/src/connection.ts","line":153},{"severity":"medium","text":"M2 (Spec): siblingOrders is only assigned and never invalidated. After task.rank supplies an order, later ordinary rank/file edits or a move into that parent carry no siblings; buildItemsTree still gives cached positions priority, so an incoming lower-ranked child is forced behind cached children and rank edits cannot reorder them. Clear cached orders for both the old and new parent on item replacement/removal, then apply a supplied fresh siblings order (as the Neovim reducer does). Cover rank -> ordinary rank/parent change with an authoritative order comparison.","file":"web/src/connection.ts","line":155},{"severity":"medium","text":"M3 (Standards, docs/agents/tests.md Rule 9): The C2 observer waits only for the changed task's Closed field before immediately asserting its ancestor meter. Tracker.#announce publishes the task and ancestor as separate events; observing the first does not establish the second. The 300-item test repeats this with the task status and epic work count at lines 176-182. Arm an observer for the exact ancestor value before each mutation, await both boundaries, and retain the final assertions.","file":"web/test/items.test.ts","line":58},{"severity":"medium","text":"M4 (Spec, C4 evidence): Every rebuild clears all earlier cland.items.rebuild measures. The test's measurements.every(<15) consequently checks only the last surviving rebuild. A slow task-frame rebuild can be erased by a faster ancestor/plan rebuild before the read, so this does not establish the per-delta bound. Clear once before the mutation (or retain correlated bounded receipts), preserve every rebuild in that transition, and assert the bound after the durable ancestor boundary.","file":"web/src/ItemsTree.tsx","line":74}]
finding_counts: {"high":0,"medium":4,"low":0}

Full Standards/Spec audit at fixed base a8f55e34 (0540a75e^2), head 9b9c739f/tree fd438b3c. Four medium findings detailed in A-8640. Closed-task loader seam matches the Coordinator-approved boundary; README and help keys inspected. Reviewer ran no runtime/tests. Correct source and request fresh review before configured verification; retain original local stdout/exit/command/head-tree provenance. QA remains affected/after-stage.

Criteria: C2 failed (The test observes the changed task but not the separately published ancestor roll-up; live task deltas also lose verdict rounds and retain stale sibling ordering.), C4 failed (Each rebuild clears preceding timing samples, so the test can miss an over-budget task rebuild replaced by a faster ancestor rebuild.).

### impl-1071 · 2026-10-21T19:12:26.442Z

M1–M4 fixed at 828149691d1bc1c0c766d132c1304b2f566fa23b / tree 612c68a7ab95a91d4bc55f8edc6f632381f988a7, pushed. Typed delta projection retains latest verdict/round; sibling orders clear for old/new parent before fresh rank order. Tests observe task plus affected ancestor values before asserting, and raw file changes get exact index-event receipts before authoritative order reads. Independent PerformanceObserver capture equals all retained 300-item measures (latest local samples 0.2–0.7 ms, setup/transport/React commit excluded). Local macOS arm64: root check exit0, test lint report mode132/59 and0refusals; targeted Items6/6 pass. Corrected copied-tracker parent9.964 s locally; Linux allowance calibration still pending the first source-reviewed remote receipt. Original stdout/provenance preserved in A-8644; red regression stdout A-8643. No dev merge after first review, no queued verify yet.

### rev-23 · 2026-10-21T19:13:55.080Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261021-1071-source-2
commit: 828149691d1bc1c0c766d132c1304b2f566fa23b
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

M1–M4 corrected; full source scope retained, six correction files audited. Typed verdict projection and post-mutation r2/r3 assertions, old/new parent cache invalidation with authoritative order regression, exact task/ancestor DOM observers, and all timing samples retained plus independent PerformanceObserver comparison. A-8654 details Standards/Spec audit; no remaining findings. C5 source-established. A-8647/A-8648 retain local targeted/check evidence; no queued current-head result yet. C1–C4 final runtime settlement awaits configured mode-free receipt; any subsequent source/allowance head needs fresh source review. QA affected/after-stage remains separate.

Criteria: C5 verified.

### rev-23 · 2026-10-21T19:24:43.798Z

verdict: review
result: not clear
by: rev-23 [reviewer]
run: rev-20261021-1071-evidence-red
commit: 828149691d1bc1c0c766d132c1304b2f566fa23b
scope: evidence
findings: [{"severity":"medium","text":"M5 (evidence): A-8664 ordering regression fails with 'no result for task.rank within 5000ms' (original lines 12990–12995); parent fails by aggregation. No order mismatch is shown. Diagnose the request completion failure and obtain a replacement passing receipt; current queued verification is red.","file":"web/test/items.test.ts","line":85},{"severity":"medium","text":"M6 (evidence): Enforced new-identity duration gate rejects the copied-tracker parent at 31.839846683 s > 5 s. This is distinct from report-only Web 4 s budgets. The parent includes a failed request timeout, so it is not an assertion-green calibration baseline. Settle the required reasoned dated allowance from representative completed evidence, with fresh source review at any changed head.","file":"hub/test/durations.json"}]
finding_counts: {"high":0,"medium":2,"low":0}

A-8664 exact reviewed head: overall exit1, T1/all hub+Neovim T2 exit0, actual Web exit1. 2342/2344 reported tests pass; ordering child times out awaiting task.rank and parent aggregates failure; new-identity duration gate also fails. The C2 status/cursor/roll-up child and C4 exact300-item sample assertions passed (four model samples 1.2–1.6ms); no new individual criterion failure fabricated. Detailed receipt limits in the attached evidence note. Source A-8654 is not final verification. No T3/T4/stage/QA claim; replacement corrected-head review/receipt required.

### rev-23 · 2026-10-21T19:27:37.131Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261021-1071-source-3
commit: ebe7a407411774c95c9c1bb9e699b4b8cba7b5e8
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Six-file fixture split inspected; prior full scope retained, no product changes or dev merge. New seven-item Web ordering fixture preserves the entire rank/edit/reparent sequence, request/DOM bounds, index receipts, authoritative reads and final assertions; new file registered Web. Copied live tracker/C1 and status/cursor/claims/preferences remain; 300-item case unchanged. Local original logs A-8668/A-8669/A-8670 retained, not Linux proof. Source clear permits replacement mode-free verification. A-8664 stays historical red; allowance remains pending representative assertion-green Linux timing and fresh review if head changes. C5 verified; final C1–C4 and after-stage QA remain separate.

Criteria: C5 verified.

### rev-23 · 2026-10-21T19:37:16.079Z

verdict: review
result: not clear
by: rev-23 [reviewer]
run: rev-20261021-1071-evidence-budget
commit: ebe7a407411774c95c9c1bb9e699b4b8cba7b5e8
scope: evidence
findings: [{"severity":"medium","text":"M6 remains: A-8676 is overall exit1 solely on enforcing copied-tracker new-identity duration gate, 22.196711522 s >5 s. All2344 assertions pass, including isolated ordering2.835574221 s; prior M5 timeout is resolved. Calibrate the required reasoned dated allowance from this completed assertion-green timing under the agreed policy; fresh source review and replacement configured receipt required.","file":"hub/test/durations.json"}]
finding_counts: {"high":0,"medium":1,"low":0}

Original A-8676 audited at exact source-clear ebe7a407: T1/all fallback hub+Neovim T2 pass, actual Web assertions pass but Web/overall exit1 from enforcing new-identity duration. Do not call overall/Web green. C2 status/cursor/roll-up and C3 assertions passed; C4 samples0.8/1.2/2.7ms passed; no fabricated functional criterion failure. M5 now resolved; only M6 duration allowance remains. Host check reused/not remote; lint/budget/resource/ratchet report-only except stated new-identity gate. Detailed evidence limits in the note; no T3/T4/QA claim.

### rev-23 · 2026-10-21T19:38:26.120Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261021-1071-source-4
commit: e5afb70e38d98a0a1f30b1f54ddc9a890b4be3e7
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Sole seven-line exact-identity allowance inspected; prior full source audit retained. 34s cap ≈1.53× assertion-green Linux parent22.196711522s in A-8676, correct exclusion of timeout-bearing A-8664, reasoned reduction plan, open E-880 owner independently checked, UTC2026-10-21→2026-10-28 dates within policy. No product/test/bound/assertion or report-mode change. Source clear at exact e5afb70e/tree e7331f5f; C5 source verified. C1–C4 final acceptance/load evidence awaits replacement same-head configured mode-free result; historical A-8676 stays gate-red. QA affected/after-stage separate.

Criteria: C5 verified.

### impl-1071 · 2026-10-21T19:46:53.191Z

Same reviewed head e5afb70e38d98a0a1f30b1f54ddc9a890b4be3e7/tree e7331f5f169c55750c99536ae0bf5450060d1695: mode-free verify03c1a29a/A-8683 exit0 on Linux x64 c-8/lon1 droplet cland-v0-764bb3af,2344/2344 tests,0fail/skip/cancel. T1 and fallback all-T2 across hub+Neovim and all7Web files completed; Web37 assertions pass. Actual Web phase21.41s; copied-tracker identity18.42915815s under dated34s allowance; isolated ordering2.604249861s. C4 retained all four synchronous model samples0.6/0.7/0.7/1.1ms for300items, excluding setup/transport/React commit. General duration/test-lint gates remain report mode (132findings/59files;6missingbaselines and reported existing regressions retained); new-identity duration gate satisfied. No T3/T4/after-stage QA receipt claimed; T3 is deferred to periodic/integrated occasions in current queue configuration. Branch remains pushed and unchanged; awaiting Reviewer final evidence settlement.

### rev-23 · 2026-10-21T19:47:21.943Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261021-1071-final
commit: e5afb70e38d98a0a1f30b1f54ddc9a890b4be3e7
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final exact-head A-8683/03c1a29a audited: Linux configured mode-free exit0, T1/all fallback hub+Neovim T2/actual Web pass; structured2344 ordinary test and361 file passes, no failures/skips/cancellations. All C1–C5 supported by source plus real-hub Web cases. Ordering2.604s; copied parent18.429s fits reviewed34s allowance; C4 retains all0.7/0.7/1.1/0.6ms samples with independent observer. Web identities intentionally receive no load repetitions (runner policy); no5/5 claim. Host check reused/not remote; lint132/59, six missing baselines and existing budgets/resources/ratchet remain report-only. No T3/T4/stage/QA claim; affected after-stage QA remains separate. Detailed source/criteria/provenance audit in final artifact; no remaining findings.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified.

### coord · 2026-10-21T19:50:59.740Z

Merged bd4c96d28b7447f3f07e28d91bce803041237487 onto dev.
