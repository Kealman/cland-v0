---
id: T-385
kind: task
title: "A hung test holds the verify queue forever: no per-test timeout and no stall kill"
state: open
status: review
size: S
criterion_seq: 4
labels:
  - v0.1.2
  - hub
  - ready-for-agent
  - qa-found
assignee: null
parent: R-228
blocked_by: []
topic: topic-246
branch: t/T-385-a-hung-test-holds-the-verify-queue
created: 2026-10-14T12:21:44.443Z
updated: 2026-10-14T19:36:19.921Z
---

## Summary

A full verify can hang forever. T-359's run 6a9dce81 stopped producing output after 1228 tests: the `node --test` runner and a child `cland-spoke` sat at 0% CPU for over 55 minutes while four runs queued behind it. The runner has no per-test timeout, and the suite has no wall-clock cap that kills a silent run.

## Evidence

- Run 6a9dce81 (T-359 at its head, full mode), started at 11:12Z. `suite.log` stopped growing at 11:27Z, and the human noticed at 12:21Z.
- Processes at 12:21Z: suite-worker pid 81684 at 69 min, `node --test --test-concurrency=4` pid 48725 at 58 min and 0% CPU, child `cland-spoke.ts` pid 77520 at 55 min. Machine load about 2.
- The last started tests in the log were merge-gate cases ("a verdict whose session changes role…", "release, topic closure and cleanup failures…", "retrying a completed merge preserves staged deletion…").
- Cost: about one hour of the single local slot, with four Implementers waiting.

## Acceptance criteria

- [x] C1. Every test file runs with a per-test timeout, for example `--test-timeout` set from a duration manifest or a default of 120 s, so a hung test fails with its name instead of blocking.
  - done: impl-385 · 2026-10-14T12:35:29.096Z
  - verified: rev-23 [reviewer] · run rev-2026-10-14-385-7 · 2026-10-14T18:16:29.996Z · commit b40e992784790b9e4a37626dfa3cf7e9836dad06
- [x] C2. The suite worker kills a run whose log has been silent for longer than a configured stall limit (default 10 min). The result reads `stalled: no output for <n> min` and names the last started tests. The process tree, test children and spokes included, is reaped.
  - done: impl-385 · 2026-10-14T13:48:02.595Z
  - verified: rev-23 [reviewer] · run rev-2026-10-14-385-7 · 2026-10-14T18:16:29.996Z · commit b40e992784790b9e4a37626dfa3cf7e9836dad06
- [x] C3. A test reproduces a hung test file and shows the timeout failure, and another shows the stall kill and cleanup with no orphan processes left.
  - done: impl-385 · 2026-10-14T12:41:20.416Z
  - verified: rev-23 [reviewer] · run rev-2026-10-14-385-7 · 2026-10-14T18:16:29.996Z · commit b40e992784790b9e4a37626dfa3cf7e9836dad06
- [x] C4. The hanging test from run 6a9dce81 is identified from its log and fixed, or filed separately with evidence.
  - done: impl-385 · 2026-10-14T12:32:34.448Z
  - verified: rev-23 [reviewer] · run rev-2026-10-14-385-3 · 2026-10-14T13:54:50.143Z · commit 699bf7b51b55479ccaf5c56faf2206b26dc97567
  - verified: rev-23 [reviewer] · run rev-2026-10-14-385-5 · 2026-10-14T16:26:06.837Z · commit b40e992784790b9e4a37626dfa3cf7e9836dad06
  - verified: rev-23 [reviewer] · run rev-2026-10-14-385-7 · 2026-10-14T18:16:29.996Z · commit b40e992784790b9e4a37626dfa3cf7e9836dad06
  - verified: rev-23 [reviewer] · run rev-2026-10-14-385-8 · 2026-10-14T18:32:29.319Z · commit 33b1c9208f9717faacc361651ff1e8f803c7f4e5

## Comments

### impl-385 · 2026-10-14T12:34:30.789Z

Implemented default/configurable 120s per-test timeout and 10m silent-command guard in the local suite worker. Protocol regressions reproduced the missing timeout and missing stall result before changes, then passed with named failures, removal of test/spoke/detached TERM-resistant child, and successor admission. C4 filed separately as T-397; original held-ps cases pass isolated, attribution/root cause remains unproven. Validating all touched test files and cancellation compatibility before source review.

### impl-385 · 2026-10-14T12:44:09.790Z

Source ready at pushed 96ec6543db68c02b577850364b1fcfe2f85713fe. Complete touched suite.test 65/65 (A-2361), final strengthened stall/output checks 2/2 (A-2366), suite-runner 50/50, root typecheck (A-2367), and diff check pass. C1–C4 done; original incident investigated separately as T-397. Fetched origin/dev; its delta is tracker-only e0cecd00, so no dependency/conflict merge under the latest build rule. Requesting source review before queued verification; qaPolicy none.

### rev-23 · 2026-10-14T12:48:02.800Z

verdict: review
result: not clear
by: rev-23 [reviewer]
run: rev-2026-10-14-385-1
commit: 96ec6543db68c02b577850364b1fcfe2f85713fe
scope: full

Medium — hub/src/suite-command.ts:27–29: stall cleanup captures only the npm identity at timeout; if npm has exited while a background child keeps pipes open, endProcess's absent-leader path returns true without capturing/reaping that child. Destroying pipes then completes the supervisor and releases admission despite the orphan. Custom commands without package root/runner metadata are not covered by the later lease sweep. Retain verified child ownership and add a real-frame exited-parent/inherited-pipe regression. All nine changed files reviewed; no additional findings in timeout policy, partial-output, ordinary held-parent cleanup, cancellation or C4's T-397 filing. No suite yet. A-2372: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2372-t-385-source-review-exited-parent-can-leave-inherited-pipe-orphan.md.

Criteria: C2 failed (If npm exits while a child retains inherited pipes, stall cleanup treats the absent leader as reaped and can report/release admission with that orphan still alive.).

### impl-385 · 2026-10-14T13:01:29.920Z

Corrected source review finding rev-2026-10-14-385-1 in pushed 7987c2be4ba6492fa2817c8b77b1b91396e79b49. A-2373 reproduces the exited-parent inherited-pipe orphan red. A-2374 passes corrected orphan/held-parent/cancellation checks 3/3 with unrelated same-command/cwd process preserved. Complete corrected suite.test 66/66, 346.66s (A-2377); root typecheck passes (A-2378); unchanged runner policy has prior complete 50/50 evidence A-2369. Captures are ancestry-proven and serialized once/sec; endProcess rechecks every retained identity. Fetched origin/dev now 6ae9b8ed (T-366 unrelated accounts work; no dependency/conflict merge). No verify submitted; requesting corrected source review.

### rev-23 · 2026-10-14T13:03:56.068Z

verdict: review
result: not clear
by: rev-23 [reviewer]
run: rev-2026-10-14-385-2
commit: 7987c2be4ba6492fa2817c8b77b1b91396e79b49
scope: full

Medium — hub/src/suite-command.ts:42, :62–63: periodic capture closes the exited-parent hole only for observed children. A child created and reparented between snapshots remains outside owned; after npm exits, cleanup of the absent root returns true and the supervisor can finish with that inherited-pipe orphan alive. The new regression holds its parent for 3 seconds and guarantees capture. Add the fast-exit boundary and retain verified ownership or explicitly preserve unproven cleanup rather than claiming a completed reap/admission release. Captured-child and unrelated-process safeguards are sound; existing held-parent/spoke/stubborn-child/cancellation assertions remain. C1/C4 unchanged. A-2380: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2380-t-385-correction-review-fast-exit-ownership-gap-remains.md.

Criteria: C2 failed (A pipe-holding child spawned and reparented between one-second ownership snapshots is never captured; the absent-root cleanup can still report completion and release admission with it alive.).

### coord · 2026-10-14T13:05:57.503Z

Coordinator decision on C2's edge case (2026-10-14 13:06Z): a detached writer that can't be verified doesn't hold the queue. The run reports 'stalled … cleanup incomplete' with its evidence, all verified identities are terminated, one warn notice goes to the human and is journalled, then the lease is released and the next run admitted. There's no OS pipe-ownership machinery and no false reap claim. The fast-exit regression covers it.

### impl-385 · 2026-10-14T13:48:04.059Z

Source corrected per Coordinator decision 0e5224c8 at pushed 699bf7b51b55479ccaf5c56faf2206b26dc97567. Reap all verified identities; if inherited pipes remain, fail explicitly with `cleanup incomplete: unverified inherited-pipe writer`, preserve unknown processes, post exactly one warn in Agents/inbox and journal it, then release admission. T-410 covers exact-writer ownership. Deterministic after-snapshot/before-next-snapshot fixture proves this and successor admission even while original result is held by recipient hygiene. A-2389 red; A-2392 decision/implementation; A-2394 full suite.test 67/67; A-2395 final boundary; A-2399 visibility 15/15, A-2400 inbox 5/5, A-2401 events 6/6, A-2403 journal flush, A-2404 root typecheck. Prior unchanged runner 50/50 A-2369. Clean diff check, fetched origin/dev at 31dd9918 (tracker/unrelated T-366); requesting source review before no-mode verify.

### rev-23 · 2026-10-14T13:54:50.143Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-2026-10-14-385-3
commit: 699bf7b51b55479ccaf5c56faf2206b26dc97567
scope: full

No high or medium findings remain across Standards and Spec in all 15 changed files. Clear under the Coordinator’s recorded C2 exception: terminate all verified identities; an unverified inherited-pipe writer is preserved, explicitly fails cleanup, produces one Agents/inbox/journal warning, and releases admission. The deterministic fast-exit regression covers held/retried reporting and successor admission without a false complete-reap claim. Exact writer ownership is T-410. C4 verified through T-397’s incident filing; root cause remains unproven. C1–C3 remain unverified until complete no-mode cland verify at this exact head. Evidence and full review: A-2405 — /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2405-t-385-corrected-source-review-bounded-stall-and-explicit-incomplete-cleanup.md.

Criteria: C4 verified.

### impl-385 · 2026-10-14T13:58:27.485Z

After clear source review rev-2026-10-14-385-3 (A-2405), submitted no-mode cland verify at exact head 699bf7b51b55479ccaf5c56faf2206b26dc97567. Run 6930503c-e90b-4e95-89d6-635151bf9128 queued at position 4; result recipients rev-23 and impl-385. Waiting for hub result.

### rev-23 · 2026-10-14T16:16:58.292Z

verdict: review
result: not clear
by: rev-23 [reviewer]
run: rev-2026-10-14-385-4
commit: 699bf7b51b55479ccaf5c56faf2206b26dc97567
scope: evidence

Medium — hub/test/claude-code-accounts.test.ts:131 / verification gate: 6930503c/A-2444 exits 1, signed-out directory count 2 vs 1; 1639/1640 hub pass, Neovim not reached. Untouched case matches merged T-382’s known pre-latch counting-window defect; inspected head still has hook-only startup readiness and sleep(250) baseline, missing ee3f2393’s correction. Source A-2405/C4 stand; C1–C3 pending full passing gate, no new individual T-385 feature failure asserted. Shared-fix adoption reported to lead; any changed head requires delta source review before no-mode verify after hub-back. A-2446: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2446-t-385-red-verification-known-t-382-correction-absent.md.

### impl-385 · 2026-10-14T16:24:57.615Z

Integrated Coordinator-requested landed fixes after red verify 6930503c (A-2444): T-382 ee3f2393 cherry-picked as 104eff19, T-398 8af83889 as b40e9927. Pushed exact head b40e992784790b9e4a37626dfa3cf7e9836dad06. All ten changed test files pass sequentially, 70/70; root typecheck and diff check pass (A-2448). Requesting delta source review of shared-fix integration; no-mode verification is held until Coordinator's hub-back post. T-385 implementation unchanged from source-clear 699bf7b5.

### rev-23 · 2026-10-14T16:26:06.837Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-2026-10-14-385-5
commit: b40e992784790b9e4a37626dfa3cf7e9836dad06
scope: delta

No high or medium delta findings. Shared T-382 ee3f2393 and T-398 8af83889 applied without changed patch semantics: T-398 exact whole diff, T-382 exact added/removed lines and test blobs; sessions/fake full-blob differences are prior unrelated T-366 base context. T-385 supervisor/warning implementation unchanged under A-2405’s Coordinator C2 exception. A-2448 ten sequential files 70/70, zero failure/cancel/skip/todo, root typecheck/diff check clean. C4 refreshed through T-397 filing; C1–C3 await complete exact-head no-mode verify after hub-back. Prior red 6930503c/A-2444 was known T-382 correction absent; old-head isolated passes not used for unchanged retry. A-2449: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2449-t-385-shared-t-382-t-398-delta-source-clearance.md.

Criteria: C4 verified.

### impl-385 · 2026-10-14T16:38:39.924Z

After clear delta source review rev-2026-10-14-385-5 (A-2449) and Coordinator hub-back post, submitted no-mode verify --executor droplet at exact head b40e992784790b9e4a37626dfa3cf7e9836dad06: run 44f177e9-f200-4d2b-8769-3562ae31b134. Hub fallback: no prepared snapshot, running locally. Reported to Coordinator/reviewer; keeping the run/head intact and awaiting hub result.

### impl-385 · 2026-10-14T16:49:04.508Z

Coordinator snapshot-ready instruction 01c3c1e4: cancelled queued local-fallback 44f177e9 (A-2453) and resubmitted same-head no-mode --executor droplet with rev-23/impl-385 recipients. CLI acknowledgement timed out; reconciled task.view confirms b1603160-39e7-494f-8e96-87248f3ef907 accepted, executor droplet, state launching, exact reviewed b40e992784790b9e4a37626dfa3cf7e9836dad06. No duplicate retry.

### impl-385 · 2026-10-14T17:13:21.039Z

Droplet verification b1603160 at exact source-clear b40e9927 failed outside T-385's changed test files: init re-init while live Claude session (`database is locked`, init.test.ts:438), restart merge fixture leaves task worktree (merge.test.ts:1079), flooding responsiveness timing (request-guard.test.ts:76,708ms vs204ms baseline). A-2465; Linux x64 c-8 lon1, lifetime1403s, cost$0.0974;1635pass/3fail/3skip. Reported Bugs finds aside to lead (S each) and reviewer. No automatic multi-failure retry; awaiting shared-fix/adoption or Linux diagnosis disposition.

### rev-23 · 2026-10-14T17:13:42.214Z

verdict: review
result: not clear
by: rev-23 [reviewer]
run: rev-2026-10-14-385-6
commit: b40e992784790b9e4a37626dfa3cf7e9836dad06
scope: evidence

Medium — hub/test/init.test.ts:438/:90: cland init returns database locked, so Linux full gate fails. Medium — hub/test/merge.test.ts:1079: ref-movement restart expected false, got true. Medium — hub/test/request-guard.test.ts:76: competing client waited 708ms, baseline 204ms, outside asserted bound. A-2465 droplet b1603160 exits 1: typecheck succeeds, 1635 pass/3 fail/3 macOS-only skips, Neovim not reached; c-8 lon1 Linux x64, lifetime1403s/$0.0974. Changed timeout/stall cases pass; no T-385 causal source defect asserted. Bugs S aside each reported to lead; multiple failures do not qualify for single-test same-head retry. Source A-2449/C4 stand, C1–C3 pending passing complete evidence, no individual feature criterion newly failed. A-2467: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2467-t-385-linux-verification-red-three-outside-test-blockers.md.

### impl-385 · 2026-10-14T17:19:03.119Z

Human decision de65131f relayed by Coordinator 7df2bdac permits local task verification pending shared Linux fixes T-429/T-430; Reviewer judges same-head local instead of red droplet. Submitted no-mode --executor local at unchanged source-clear b40e992784790b9e4a37626dfa3cf7e9836dad06:0e68bdde-744e-4733-a2d8-13306ca6da00, queued position2, rev-23/impl-385 recipients. Awaiting hub result.

### impl-385 · 2026-10-14T18:15:38.535Z

Authorized same-head local verification 0e68bdde-744e-4733-a2d8-13306ca6da00 passed at source-clear b40e992784790b9e4a37626dfa3cf7e9836dad06:2019/2019, full hub+Neovim, no failures/skips; A-2489. darwin arm64 Node24.21.0 Neovim0.12.5,1351.94s. Reviewer notified for C1–C3/final evidence verdict under human decision de65131f superseding red Linux b1603160. No head changes.

### rev-23 · 2026-10-14T18:16:29.996Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-2026-10-14-385-7
commit: b40e992784790b9e4a37626dfa3cf7e9836dad06
scope: evidence

Final clear; C1–C4 verified at unchanged clean b40e9927. Authorized same-head local0e68bdde/A-2489 passes typecheck and2019/2019 (37free,1604hub,378Neovim),zero failures/cancellations/skips/todo. Timeout, silent-tree/spoke cleanup, fast-exit warning/successor and partial-output cases pass. C2 remains under Coordinator0e5224c8 exception: verified identities terminated; unknown writer preserved with explicit failed incomplete cleanup and one warning before admission release; T-410 follows exact ownership. C4 remains T-397 filing, original cause unproven. Red Linuxb1603160/A-2465 superseded for gate by human de65131f/Coordinator7df2bdac, blockers T-429/T-430 retained, no Linux green claim. A-2491: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2491-t-385-final-local-gate-bounded-hangs-and-incomplete-cleanup-contract.md.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified.

### impl-385 · 2026-10-14T18:30:24.809Z

Resolved merge gate conflict by merging origin/dev878d70e7 as pushed33b1c9208f9717faacc361651ff1e8f803c7f4e5. Sole conflict in config verification type/default lines: union includes remoteBudget and T-385 testTimeoutMs/stallTimeoutMs; preserves lifetime/run_timeout/daily_spend_usd/executor/remote_budget. Complete suite.test67/67 A-2510; root typecheck A-2511, diff check clean. Incoming suite-remote-budget7/8 A-2506; sole notice-race failure is confirmed shared T-435, per Coordinator b51bf73f proceed to delta review unchanged; isolated pass A-2508. Additional incoming init/roles/account-limited targeted files still running sequentially. Requesting delta review before new exact-head local verification.

### rev-23 · 2026-10-14T18:32:29.319Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-2026-10-14-385-8
commit: 33b1c9208f9717faacc361651ff1e8f803c7f4e5
scope: delta

No high or medium integration findings. Sole config conflict correctly unions remoteBudget with testTimeoutMs/stallTimeoutMs and all prior verification fields; both parser/renderer paths retained. Other14 task-file edits exactly match original reviewed implementation relative to merged dev. A-2510 suite.test67/67/root typecheck A-2511/diff check pass. Incoming budget A-2506 is7/8 for known T-435 notice race; Coordinator b51bf73f directly confirms proceed unchanged, isolated A-2508 passes; not full gate evidence. C4 refreshed via T-397 filing; C1–C3 require complete new-head no-mode local verify after incoming targeted checks finish. C2 exception/T-410 retained. Old b40e9927 full pass cannot clear new commit. A-2513: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2513-t-385-dev-merge-source-review-timeout-keys-and-remote-budget-preserved.md.

Criteria: C4 verified.

### impl-385 · 2026-10-14T18:33:08.344Z

Delta source review rev-2026-10-14-385-8 clear at merged head 33b1c9208f9717faacc361651ff1e8f803c7f4e5 (A-2513). Remaining incoming targeted files pass 33/33 (init15, roles8, account-limited10; A-2515). Suite67/67 A-2510 and typecheck A-2511 remain green; known incoming T-435 race evidence A-2506/A-2508 left unchanged per Coordinator. Submitted exact-head no-mode --executor local: f8e54b25-eb73-496c-9da5-0833a7725a69, position2, rev-23/impl-385 recipients. Awaiting hub result.

### impl-385 · 2026-10-14T19:36:19.921Z

Local verification f8e54b25 at delta-clear33b1c920:2045/2046 pass; sole failure unchanged nvim/test/explorer-card.test.ts:243 gi/thread-reference case (A-2532). First isolated exact-head trial reproduced same cardT-11/no-row-under-cursor error (A-2533); stopped remaining trials, no automatic flake resubmission. Reported Bugs(S) find aside and blocker to lead/reviewer; awaiting shared-fix/adoption disposition. T-435 remote-budget test passed in this full run. Head unchanged.
