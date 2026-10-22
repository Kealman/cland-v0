---
id: T-1081
kind: task
title: The items snapshot carries closed tasks and nears its 1 MiB cap; page closed tasks on demand
state: closed
status: done
size: M
criterion_seq: 6
labels:
  - ready-for-agent
assignee: null
parent: E-413
blocked_by: []
topic: topic-823
branch: t/T-1081-the-items-snapshot-carries-closed-tasks
created: 2026-10-21T18:52:28.328Z
updated: 2026-10-22T01:02:47.265Z
closed: 2026-10-22T01:02:47.265Z
---

## Summary

The items domain of the snapshot carries every item, closed tasks included. On a copy of the live tracker (about 1,070 items) it is 836,897 bytes after T-1052, 80% of the 1 MiB items cap. T-1058's card facts push it toward 98%. The tracker grows by about 50 items a day, so the cap is days away, and `snapshot.refused frame-too-large` would break every client's connect.

## What to build

The snapshot's items domain carries the open items and every container (releases, epics, categories) with their roll-ups. Closed tasks are not in the first snapshot. A client gets them per container on demand: a bounded page request that the Neovim explorer and the web tree call when a closed child list is unfolded or `D` shows done items. The page request has the same per-reply budget. Deltas still carry a task that closes, then drop it from the open set. The Neovim workbench keeps working against the new shape; its explorer already loads open items first (T-1007).

## Acceptance criteria

- [x] C1. On a copy of the live tracker, the snapshot's items domain stays at or below 50% of the cap, measured in a boundary test.
  - done: impl-1081 · 2026-10-21T22:08:04.815Z
  - verified: rev-26 [reviewer] · run rev-20261022-1081-final-1 · 2026-10-22T00:57:45.051Z · commit fb64bf1135a179b3b4ad99002d25dcc26953c38b
- [x] C2. A frame client unfolding a closed epic, or turning on `D`, receives its closed tasks through bounded pages, and their counts match the container's roll-up (test).
  - done: impl-1081 · 2026-10-22T00:16:51.808Z
  - verified: rev-26 [reviewer] · run rev-20261022-1081-task-evidence-3 · 2026-10-22T00:26:18.074Z · commit fb64bf1135a179b3b4ad99002d25dcc26953c38b
  - verified: rev-26 [reviewer] · run rev-20261022-1081-final-1 · 2026-10-22T00:57:45.051Z · commit fb64bf1135a179b3b4ad99002d25dcc26953c38b
- [x] C3. A task that closes arrives in a delta and then leaves the open set; a client holding the closed page sees it there (test).
  - done: impl-1081 · 2026-10-21T22:08:04.846Z
  - verified: rev-26 [reviewer] · run rev-20261021-1081-task-evidence · 2026-10-21T22:41:24.848Z · commit 7abc0af7e431f28e4674e3b6e325d69e94257ba9
  - verified: rev-26 [reviewer] · run rev-20261021-1081-task-evidence-2 · 2026-10-21T23:41:19.639Z · commit 7163b97c5497d3acbd8b8dffd8a391a19d284b22
  - verified: rev-26 [reviewer] · run rev-20261022-1081-task-evidence-3 · 2026-10-22T00:26:18.074Z · commit fb64bf1135a179b3b4ad99002d25dcc26953c38b
  - verified: rev-26 [reviewer] · run rev-20261022-1081-final-1 · 2026-10-22T00:57:45.051Z · commit fb64bf1135a179b3b4ad99002d25dcc26953c38b
- [x] C4. The Neovim explorer and board render closed children through the page request with the same counts as before, in headless tests on the copied tracker.
  - done: impl-1081 · 2026-10-21T22:08:04.861Z
  - verified: rev-26 [reviewer] · run rev-20261022-1081-final-1 · 2026-10-22T00:57:45.051Z · commit fb64bf1135a179b3b4ad99002d25dcc26953c38b
- [x] C5. `hub/README.md` and `nvim/README.md` describe the open snapshot and the closed pages.
  - done: impl-1081 · 2026-10-21T22:08:04.882Z
  - verified: rev-26 [reviewer] · run rev-20261021-1081-source-2 · 2026-10-21T22:18:49.413Z · commit 99c434e83c92f5f7817492499957c3a5f37c5c0e
  - verified: rev-26 [reviewer] · run rev-20261021-1081-source-3 · 2026-10-21T22:32:11.373Z · commit 7abc0af7e431f28e4674e3b6e325d69e94257ba9
  - verified: rev-26 [reviewer] · run rev-20261021-1081-source-4 · 2026-10-21T23:30:29.198Z · commit 7163b97c5497d3acbd8b8dffd8a391a19d284b22
  - verified: rev-26 [reviewer] · run rev-20261022-1081-source-6 · 2026-10-22T00:17:32.053Z · commit fb64bf1135a179b3b4ad99002d25dcc26953c38b
  - verified: rev-26 [reviewer] · run rev-20261022-1081-final-1 · 2026-10-22T00:57:45.051Z · commit fb64bf1135a179b3b4ad99002d25dcc26953c38b
- [x] C6. startup-replies-scale's thousand-item test reports its first completed hub.status under 10 s on a Linux droplet at the task head (12.4 s at T-1058's head, A-8722), so the 15 s budget regains margin; the test's fixture setup cost stays with T-1068.
  - done: impl-1081 · 2026-10-21T23:29:33.918Z
  - verified: rev-26 [reviewer] · run rev-20261022-1081-final-1 · 2026-10-22T00:57:45.051Z · commit fb64bf1135a179b3b4ad99002d25dcc26953c38b

## Comments

### impl-1081 · 2026-10-21T22:02:56.859Z

TDD slices implemented at frame, headless Neovim and Web boundaries. Closed tasks leave the initial snapshot and load through per-parent cursor pages (100 rows/256 KiB). Copied-live snapshot measured 240,825 bytes/1 MiB on local Darwin arm64, Lua differential zero differences after page reconstruction. Neovim held-page test exposed and now covers reopen deduplication. C6 profiling found branchless non-ready tasks with retained verdicts unnecessarily rereading ancestor plans in startup readiness checks; new filesystem/frame regression red before fix, green afterward. Required exact-head Linux timing, source review and verification remain pending.

### rev-26 · 2026-10-21T22:12:10.575Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261021-1081-source-1
commit: 4fc4be206fb1e140990e42baf6d4c1a0688f72df
scope: full
findings: [{"severity":"medium","text":"M1: Stage merged/state is calculated from loaded closed rows. When D hides done, no parent pages are requested, so removing those rows from the snapshot makes merged progress read 0/N and can regress workflow state. Use hub stages merged/total/statuses and cover hidden-done with no archive pages.","file":"web/src/items-tree.ts","line":75},{"severity":"medium","text":"M2: The global done-hidden total counts connection.items, which now excludes closed tasks even after separate parent caches load. It undercounts hidden work; use an authoritative total or an explicitly narrower honest scope and add a no-page hidden-done regression.","file":"web/src/ItemsTree.tsx","line":124}]
finding_counts: {"high":0,"medium":2,"low":0}

Full source audit A-8743: Standards 0 findings; Spec 2 medium findings. Removing closed tasks from initial items breaks two Web loaded-row calculations when D hides done: stage merged/state and the global done-hidden total. Correct both and request fresh source review before verification. A-8733 remains local working-tree supporting evidence; original retained receipts/provenance requested. C6 whole-test Linux <10 s remains unverified, separately from first-status latency. Required full pre-merge suite remains Coordinator-owned.

Criteria: C2 failed (Web counts regress with closed task pages unloaded: stage merged/state and the global done-hidden total omit closed tasks.).

### rev-26 · 2026-10-21T22:18:49.413Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261021-1081-source-2
commit: 99c434e83c92f5f7817492499957c3a5f37c5c0e
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear; corrected full source audit A-8753. M1 now uses hub stage merged/total/statuses/state/QA; M2 supplies authoritative done_items in snapshots and task mutations and consumes it independently of loaded pages. Original M1 red actual was 'S1planned0/3 mergedreview onlyPartially merged'; M2 red was locator.waitFor timeout for exact '3 done hidden'. Both corrected regressions pass. Exact-head local macOS targets A-8746 Web 7/7 and A-8747 snapshot 12/12; A-8748 check is explicitly a precommit dirty-tree receipt, runtime lint report-only. Standards 0; Spec 0. C5 source-verified; C1–C4 await same-head configured/full receipts. C6 remains pending native whole-test Linux <10 s evidence, distinct from first-status latency. Coordinator owns the separate full pre-merge suite; no after-stage QA pass claimed.

Criteria: C5 verified.

### rev-26 · 2026-10-21T22:26:40.491Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261021-1081-evidence-1
commit: 99c434e83c92f5f7817492499957c3a5f37c5c0e
scope: evidence
findings: [{"severity":"medium","text":"M3: Required configured run fails because the deletion event now carries authoritative done_items:0, but the exact expected object omits it. Include the new count while retaining exact id/null-item assertions and audit matching task-frame contracts.","file":"hub/test/tracker-component.test.ts","line":340}]
finding_counts: {"high":0,"medium":1,"low":0}

Failed task evidence A-8758 audited in A-8759. Actual deletion event {type:'task',id:'T-1',item:null,done_items:0} differs from exact expected event without done_items at tracker-component.test.ts:340. This is a stale expectation for the newly documented wire field, not a timing/transport diagnosis. T1 exited 0, T2 exited 1; 2001 ordinary passes/1 failure plus 10 separate load passes. Neovim/Web and T3/T4 have no passing completed receipt; C6 Linux whole-test timing remains pending. C5 source verification stays current. Correct the contract assertion and request source review at a new head before another run.

Criteria: C2 failed (Same-head configured task run is red on the exact task-frame contract assertion after adding done_items; a corrected passing runtime gate is required.).

### rev-26 · 2026-10-21T22:32:11.374Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261021-1081-source-3
commit: 7abc0af7e431f28e4674e3b6e325d69e94257ba9
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear; audit A-8763 incorporates A-8753 and resolves M3. Exact deletion event assertion now includes done_items:0 while preserving id/item:null. A new never-paged client observes an unloaded closed task's removal/count and compares a fresh snapshot; docs specify removal semantics. No production algorithm changes. Standards 0; Spec 0. Local precommit dirty-tree A-8760/A-8761 targets passed 11/11 and 9/9, explicitly not exact-head Linux/suite evidence. C5 source-verified at this head; C1–C4 and C6 await same-head configured/full receipts. C2 needs claimant done mark restored. Historical A-8758 stays failed; Coordinator owns required full pre-merge evidence.

Criteria: C5 verified.

### rev-26 · 2026-10-21T22:41:24.848Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261021-1081-task-evidence
commit: 7abc0af7e431f28e4674e3b6e325d69e94257ba9
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Task evidence clear for C2/C3, audit A-8766. Same-head 93db283b/A-8765 exited 0: T1/all hub+Neovim T2/Web, 2362 ordinary passes plus 10 separate load passes. Parent-page/closed-delta/removal test and readiness test each have explicit 5/5; Web page/reconnect and hidden-count regressions passed ordinarily, no Web 5/5 claimed. Former exact deletion-frame failure is green. Linux x64 c-8 lon1, lifetime 471 s/$0.0327; host gate 4f7272db reused, lint/budget/ratchet report-only. T3/T4 absent: C1 copied size, C4 real copied Neovim and C6 whole-test Linux <10 s remain pending separate required full pre-merge receipt. C5 remains source-verified. No final-ready or after-stage QA claim; historical A-8758 stays failed.

Criteria: C2 verified, C3 verified.

### rev-26 · 2026-10-21T23:30:29.198Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261021-1081-source-4
commit: 7163b97c5497d3acbd8b8dffd8a391a19d284b22
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear, audit A-8794. Only delta from 7abc0af7 is the exact closed-pages T3 identity's 22 s allowance, E-880, dated 2026-10-21→2026-10-28, approximately 1.5× actual Linux 14.616116916 s; no assertions/fixtures/product changes. A-8792 stays overall exit 1: enforcing new-identity duration 14.616 >5 s, T1/T2 green/T3 red, Web absent, 3562 passes/8 skips/0 assertion failures. Confirmed Coordinator 2c57d104 and tracker narrow C6 to first completed hub.status <10 s: old-head receipt 9388.7 ms; whole test 11.842717161 s did not meet former target. Revised C6 and all runtime criteria await matching-head replacement evidence; C5 source-verified. A-8793 local dirty-tree manifest lint exit 0 is labelled supporting evidence. Standards 0; Spec 0; no after-stage QA pass claimed.

Criteria: C5 verified.

### rev-26 · 2026-10-21T23:41:19.640Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261021-1081-task-evidence-2
commit: 7163b97c5497d3acbd8b8dffd8a391a19d284b22
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Replacement task evidence clear for C2/C3; audit A-8796. Same-head 2cdf6e8c/A-8795 exited 0 with T1/all hub+Neovim T2/Web: 2362 ordinary passes plus 10 separate load repetitions. Parent-page/close/removal and readiness identities explicitly 5/5; Web page/reconnect and hidden-count ordinary passes, no Web 5/5 claimed. Linux x64 c-8 lon1, lifetime 577 s/$0.0400, host febaa072 reused; lint/duration/ratchet report-only. T3/T4 absent. C1/C4 and revised C6 first completed hub.status <10 s await matching-head Coordinator full pre-merge evidence. C5 remains source-verified. No final-ready or after-stage QA claim; historical failed receipts stay failed.

Criteria: C2 verified, C3 verified.

### rev-26 · 2026-10-22T00:12:24.437Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261022-1081-source-5
commit: 5f67271d441be4db34c273cab9642ca0d4ccedce
scope: delta
findings: [{"severity":"medium","text":"M4: Ordinal and denominator use loaded siblings after closed tasks leave the snapshot. Hidden done/no parent pages yields incorrect position/total; frame.siblings only fixes numerator while siblings.length remains incomplete. Preserve authoritative facts or visibly defer until complete and cover hidden-done/unloaded siblings.","file":"web/src/ItemCard.tsx","line":24}]
finding_counts: {"high":0,"medium":1,"low":0}

Authorized dev-merge delta audit A-8804: Standards 0; Spec 1 medium M4. Card ordinal/total still uses loaded siblings after closed tasks leave the snapshot: hidden-done/no pages can show 1 of 1 for the third of three siblings, and a full frame.siblings order can fix only the numerator, leaving 3 of 1. Retain authoritative ordering/counts or visibly defer until complete; add a no-parent-page browser regression. Remaining tracker/snapshot/connection/skill composition inspected without further findings. A-8803 raw targets are local macOS arm64 precommit dirty-tree evidence, not exact-head Linux verification; native121531B, copied250572B/1086+3/zero Lua differences. No same-head configured/full run claimed; revised C6 first-status Linux<10s pending. Correct and request fresh source review before verify; Coordinator owns subsequent full pre-merge coverage.

Criteria: C2 failed (Merged drawer card reports incomplete sibling counts/ordinal while closed task parent pages are unloaded.).

### rev-26 · 2026-10-22T00:17:32.053Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261022-1081-source-6
commit: fb64bf1135a179b3b4ad99002d25dcc26953c38b
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear; corrected merge audit A-8806 incorporates A-8804. M4 resolved: ordinal visibly defers until a complete sibling order/page, both numbers share that order, loaded previous rows retain parent identity, and unknown-old-parent mutations clear cached orders. Browser regression retains no-hidden-page assertion, full rank3/3, actual task.link parent receipt/stale-order invalidation, then completed-page2/2. A-8805 valid original red1 of1 vs em dash and real move timeout distinguished from invalid earlier probes. Local dirty-tree macOS arm64 card6/6/items7/7/final Web typecheck0 are supporting evidence, not exact-head Linux/full proof. No wire/payload growth. Standards0; Spec0. C5 source-verified; runtime C1-C4/revised C6 await matching configured and Coordinator-owned full receipts. No final-ready or after-stage QA claim.

Criteria: C5 verified.

### rev-26 · 2026-10-22T00:26:18.074Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261022-1081-task-evidence-3
commit: fb64bf1135a179b3b4ad99002d25dcc26953c38b
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Same-head configured evidence clear for C2/C3; audit A-8809. A-8808/run960f0125 exits0 with T1/all hub+Neovim T2/Web:2369 ordinary passes plus10 separate load passes, no failures/skips/cancels. Parent-page/close/removal and readiness each explicit5/5. Web page/reconnect, hidden authoritative counts and corrected ordinal cases pass; ordinal1.378949327s, no Web5/5 claimed. Linux x64 c-8 lon1,448s/$0.0311; host9d49db9e reused, not repeated remotely. Generic lint/budget/ratchet report-only and seven missing baselines retained. T3/T4 absent: C1/C4/revised C6 first-status<10s and required full pre-merge settlement remain pending matching-head Coordinator receipt. C5 source-current. No final-ready/after-stage QA claim.

Criteria: C2 verified, C3 verified.

### rev-26 · 2026-10-22T00:57:45.051Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261022-1081-final-1
commit: fb64bf1135a179b3b4ad99002d25dcc26953c38b
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final same-head source/configured/full audit A-8817. Coordinator A-8816/df518f44 T1/T2/T3/actual Web exits0:3608 ordinary passes,8 unowned skips,0 failures/cancels. C1 copied snapshot250572B<=524288;1086+3 rows/0 Lua differences. C4 real copied Neovim explorer/board/card passes14.930207462s within dated22s allowance. Revised C6 first completed hub.status9194.9ms<10000; whole11.754643312s explicitly not<10. Native first payload121531B<=120KiB margin, original guards/negative controls pass. C2/C3 current configured A-8808/A-8809 pages/deltas/removal/ordinal plus owned5/5 retained; M4 full browser pass1.6148s. C5 source-current; no remaining Standards/Spec findings. Linux x64 c-8 lon1, Node24.21/Neovim0.12.5; host gate reused9d49db9e, not repeated remotely. Lint/duration/resource/T3-ratchet diagnostics report-only, including actual T3wall1314.40>900 and would-refuse ratchet growth; no claim those budgets pass. Eight platform/binary skips outside owned coverage retained; no T4/after-stage QA pass claimed. All C1-C6 verified.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified, C6 verified.

### coord · 2026-10-22T01:02:47.265Z

Merged 780e7ba7d04e6f66c335d2d0bf4a18cab0d97976 onto dev.
