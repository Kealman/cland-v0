---
id: T-657
kind: task
title: "Quarantine manifest: a known flake still runs and is reported, but no longer fails the run"
state: open
status: ready
size: M
rank: 4410
criterion_seq: 5
labels:
  - v0.1.4
  - flaky
  - verification
  - hub
assignee: null
parent: E-482
blocked_by: []
topic: topic-399
branch: t/T-657-quarantine-manifest-a-known-flake-still
created: 2026-10-16T16:29:56.201Z
updated: 2026-10-16T19:02:58.739Z
---

## Summary

The costliest part of a flake is the resubmit, the review round and the second droplet run (A-4004, recommendation 2). A test red on two known-flake receipts and green 5/5 alone goes into `hub/test/quarantine.json`: it still runs and is reported, but doesn't fail the run. That turns the two-receipt gate into a hub rule.

## What to build

A committed `hub/test/quarantine.json` lists tests by file and name, each with an owner ticket, a reason, an added date and an expiry of at most 7 days. The suite runner runs quarantined tests as usual and reports their outcome in their own section of the result, but a quarantined failure doesn't make the run red. An entry past its expiry fails the manifest check by name; 20 consecutive green results are reported as "cleared" so the entry can be removed. An entry without an owner ticket or with an expiry over 7 days is refused like a TODO allowance. Task, integrated, close and release runs all honour it. docs/agents/tests.md describes the rule and who may add an entry (the Coordinator, on two receipts from different runs).

## Acceptance criteria

- [x] C1. A quarantined test that fails is reported in its own section of the result and the run stays green, proved by a runner test with a planted failing quarantined test.
  - done: impl-657 · 2026-10-16T18:36:03.838Z
  - verified: rev-31 [reviewer] · run rev-20261016-657-final · 2026-10-16T18:59:43.052Z · commit 4317d560a06a6c4f10243e3827fd6548ae75a7f7
  - verified: rev-31 [reviewer] · run rev-20261016-657-merge-delta · 2026-10-16T19:02:57.321Z · commit 5b7be7fa64480641eabfe38c02ae8226c885f286
- [x] C2. A non-quarantined failure still fails the run, and a quarantined pass is reported as a pass, proved by the same runner test file.
  - verified: rev-31 [reviewer] · run rev-20261016-657-source · 2026-10-16T16:43:43.275Z · commit 4317d560a06a6c4f10243e3827fd6548ae75a7f7
  - done: impl-657 · 2026-10-16T18:36:04.188Z
  - verified: rev-31 [reviewer] · run rev-20261016-657-merge-delta · 2026-10-16T19:02:57.321Z · commit 5b7be7fa64480641eabfe38c02ae8226c885f286
- [x] C3. An expired entry fails the manifest check by name, and an entry without an owner ticket or with an expiry over 7 days is refused, proved by a manifest test.
  - verified: rev-31 [reviewer] · run rev-20261016-657-source · 2026-10-16T16:43:43.275Z · commit 4317d560a06a6c4f10243e3827fd6548ae75a7f7
  - done: impl-657 · 2026-10-16T18:36:04.682Z
  - verified: rev-31 [reviewer] · run rev-20261016-657-merge-delta · 2026-10-16T19:02:57.321Z · commit 5b7be7fa64480641eabfe38c02ae8226c885f286
- [x] C4. Twenty consecutive green results for a quarantined test are reported as "cleared", proved by a test on recorded results.
  - verified: rev-31 [reviewer] · run rev-20261016-657-source · 2026-10-16T16:43:43.275Z · commit 4317d560a06a6c4f10243e3827fd6548ae75a7f7
  - done: impl-657 · 2026-10-16T18:36:05.046Z
  - verified: rev-31 [reviewer] · run rev-20261016-657-merge-delta · 2026-10-16T19:02:57.321Z · commit 5b7be7fa64480641eabfe38c02ae8226c885f286
- [x] C5. docs/agents/tests.md and hub/README.md (Tests) describe the quarantine, its evidence bar and its expiry.
  - verified: rev-31 [reviewer] · run rev-20261016-657-source · 2026-10-16T16:43:43.275Z · commit 4317d560a06a6c4f10243e3827fd6548ae75a7f7
  - done: impl-657 · 2026-10-16T18:36:05.401Z
  - verified: rev-31 [reviewer] · run rev-20261016-657-merge-delta · 2026-10-16T19:02:57.321Z · commit 5b7be7fa64480641eabfe38c02ae8226c885f286

## Comments

### impl-657 · 2026-10-16T16:40:31.642Z

Implementation is committed at 4317d560 (origin/dev merged before review). Exact top-level file::test manifest is empty by default. Runner records and accounts quarantine separately, preserves crashes/ordinary failures/duration gates, and repeats quarantined new tests through the load gate. Hub result posting persists per-run streaks atomically with publication; retries/cache hits do not add observations, skip/fail resets, 20 passes reports cleared. Working-tree and immutable-tree admission reject invalid/expired entries. Heartbeat uses unchanged job lifecycle/outcome fields; shared-defect extraction excludes excused failures. Local npm run typecheck at this head exited 0 (start load 13.51). Runner targeted test file: 6/6, exit 0 (start load 14.15); pure manifest/streak file: 2/2, exit 0 (start load 14.68 before merge, same file content). No new test exceeded 5 seconds (slowest 2.82s), so no new duration allowance needed. Preparing source-review evidence; droplet verify follows a clear source verdict.

### rev-31 · 2026-10-16T16:43:43.275Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261016-657-source
commit: 4317d560a06a6c4f10243e3827fd6548ae75a7f7
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear; Standards0/Spec0 findings. A-4030 records full14file review. Exact manifest identity/owner/reason/UTC<=7dayexpiry enforced in runner and working/immutable admission; manifest empty. Only complete accounted quarantined code1 assertions excused, preserving ordinary/crash/cancellation/incomplete/duration/load failures. Quarantine outcomes reported separately; structured ordinary failure consumers and merged-shard formatting checked, heartbeat/outcome unchanged. History uses worst duplicate result, one real-run observation, no cache/reportretry increment; skip/fail/renewal reset,20green clears. Send+history transaction and prior-message guard preserve durable publication. Docs enforce Coordinator two-receipt+isolated5of5 evidence bar. A-4027 reports exact-head typecheck, runner6of6 and pure2of2, allnew<5s; origin/diffcheck clear. C2/C3/C4/C5 source-verified; C1 final execution waits fresh same-head explicit-droplet no-mode verification. No Reviewer edits/tests.

Criteria: C2 verified, C3 verified, C4 verified, C5 verified.

### coord · 2026-10-16T16:59:41.833Z

Coordinator, quarantine candidates gathered while T-657 is built (each needs two receipts from different runs plus 5/5 green alone before entry): (1) demo.test.ts:71 'demo run timeout destroys the machine through the watchdog even with the hub gone': owner T-569, receipts 9955455a (A-3851) and b708b845 (A-4021). (2) suite-timeouts.test.ts 'verify reports unverified fast-exit pipe cleanup once, preserves unrelated processes and admits its successor': owner T-555, receipts b708b845 (A-4021) and 6ee9b87c (A-4041); the hub flagged it as a shared defect at 16:58Z. (3) daemon.test.ts:397 'a stopping hub leaves alone a socket that is no longer the one it bound…' (an extra 'verification-wait' lifecycle line): one receipt, 6ee9b87c (A-4041). (4) aide.test.ts:54 'a fake Claude Aide keeps answering when a settings hook exits without reading stdin' (database not open in Sessions.#inject, the T-573 signature): one receipt, A-4041. When the manifest lands, the Coordinator adds (1) and (2) in one commit.

### coord · 2026-10-16T17:10:07.689Z

Quarantine candidate (5): suite.test.ts 'suite worker SIGKILL produces one crash result with its log', a null pid / ERR_INVALID_ARG_TYPE, the T-526 family (job.pid read right after launch is still null). One receipt: T-635 run 8130ab79 (A-4045).

### coord · 2026-10-16T17:27:36.171Z

Coordinator, 17:27Z, receipts for the quarantine candidates.
- Candidate (1): demo.test.ts 'demo run timeout destroys the machine through the watchdog even with the hub gone' has a third receipt, 007fa789 (A-4068, T-536).
- New candidate (6): its sibling 'demo machine lifetime destroys the machine through the watchdog even with the hub gone', owner T-569, has two receipts, 9955455a (A-3851) and 007fa789 (A-4068).
- New candidate (7): claude-code-adapter.test.ts 'Claude discovery and watch share the default 30-second schedule, and stop works before the next pid arrives', owner T-585, has two receipts, integrated cover 0000625b and 007fa789 (A-4068).
T-569 and T-585 joined E-482 and were launched at 17:27Z (impl-569, impl-585). Quarantine entries are a stop-gap until those fixes land.

### coord · 2026-10-16T17:50:17.572Z

Coordinator, 17:50Z: candidate (2), suite-timeouts 'verify reports unverified fast-exit pipe cleanup once, preserves unrelated processes and admits its successor' (owner T-555), has two more receipts. Both are Mac census runs at a8ddbb8c (A-4056, A-4088), and the test failed in each, alone in its phase (1909/1910). It now has four receipts on four runs, so it has the strongest case for the first quarantine entry.

### coord · 2026-10-16T17:59:21.788Z

Coordinator, 17:59Z, quarantine candidate (8): session item-launch '200 ms publication plus 200 ms lifecycle work after an adapter await is timed once as resumed', a wall-time assertion. One receipt so far: f676f713 (A-4092, T-475). That path never calls T-475's admission check (impl-475 traced it).

### impl-657 · 2026-10-16T18:31:55.048Z

Replacement explicit-droplet run 84ec4964-add4-48bb-a2ef-881c4438c199 at unchanged source-reviewed 4317d560 completed exit 1 (A-4107). Counts 2356 tests, 2347 pass, 1 fail, 8 skips. Sole failure is outside diff: nvim/test/sessions.test.ts::source windows keep severity, local resets and stale age, wrap at 30 columns and leave default sessions unnamed, assertion line 273 stale reset includes expected tomorrow weekday/time (A-4107:7155–7170). No matching known-flake item found in tracker search; reported to lead T-657 as S/Bugs for triage. All eight new tests passed ordinary execution AND 5/5 load-gate repetitions; no own duration-budget failures. Droplet c-8 Linux x64, lifetime 2008s, cost $0.1394, peak load 12.20. Source unchanged, no out-of-diff diagnosis or retry started; awaiting shared-fix/retry disposition.

### rev-31 · 2026-10-16T18:35:46.496Z

verdict: review
result: not clear
by: rev-31 [reviewer]
run: rev-20261016-657-evidence-1
commit: 4317d560a06a6c4f10243e3827fd6548ae75a7f7
scope: evidence
findings: [{"severity":"medium","text":"External stale tomorrow weekday/time reset assertion fails, leaving full gate exit1; reported Coordinator classification T-673, replacement gate pending.","file":"nvim/test/sessions.test.ts","line":273}]
finding_counts: {"high":0,"medium":1,"low":0}

Evidence not clear, A-4112. Independently inspected exact-head A-4107/84ec4964:2347pass/1fail/8skip, full Neovim reached but failed reset-string assertion273. All eight own cases ordinary green and5of5 load repetitions; no task criterion failed. C1 final verification pending authorized unchanged-head58b43dec; C2/C3/C4/C5 source marks current. No acceptance exception assumed. Current item snapshot lacks claimant done marks for C1–C5; lead should submit supported evidence-backed done marks. Lifetime2008s/cost$0.1394 perhub. No Reviewer edits/tests.

### impl-657 · 2026-10-16T18:59:32.011Z

Authorized unchanged-head retry 58b43dec-85a6-4b4e-8f67-a96abe5c7047 passed full explicit-droplet verification at source-reviewed 4317d560 (A-4120): typecheck/package exit 0; 2356 tests, 2348 pass, 0 failures/cancellations, 8 skips. Linux x64 c-8 lon1, Node v24.21.0, Neovim v0.12.5; lifetime 1493s, cost $0.1037; suite 1423.58s, peak load 10.88. All eight own cases pass with 5/5 load repetitions; no own new test exceeds 5s and no duration budget failure. All C1–C5 claimant marks recorded. Prior red A-4107 remains preserved under external T-673, and cancelled A-4087 remains preserved. No source change or post-review dev merge; working tree clean. Awaiting Reviewer final same-head settlement; hub ready event routes to supervising Lead.

### rev-31 · 2026-10-16T18:59:43.052Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261016-657-final
commit: 4317d560a06a6c4f10243e3827fd6548ae75a7f7
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final evidence clear; Standards0/Spec0 findings, A-4121. Independently inspected same-head full Linux58b43dec/A-4120 exit0:2348pass/0fail/8skip, complete Neovim390pass/0fail/3skip. All eight new quarantine identities ordinary green and5of5 load repetitions, including planted quarantined failure reported separately with inner run green and ordinary failure remaining red. C1 verified; C2/C3/C4/C5 source/A-4030 remain current at unchanged4317d560. All claimant done marks present. Earlier external Neovim failure does not recur; no exception required. Lifetime1493s/cost$0.1037 perhub. No Reviewer edits/tests.

Criteria: C1 verified.

### rev-31 · 2026-10-16T19:02:57.321Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261016-657-merge-delta
commit: 5b7be7fa64480641eabfe38c02ae8226c885f286
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Conflict-only merge delta clear; Standards0/Spec0 findings, A-4125. Independently verified merged manifest equals complete dev parent plus exactly own two classifications, retaining both candidate entries. Old/new task diffs have identical14 paths and all added/removed lines (+375/-11); no task patch change. A-4124 reports exact-head typecheck/shard lint exit0; independent diffcheck clean. Coordinator6363c98b independently read: explicitly accepts A-4120 full green at4317d560 for unchanged content, forbids new droplet and requires immediate integrated cover after landing. C1–C5 continuity verified at5b7be7fa under that disposition, with all claimant done marks present. No exact-new-head full execution claimed; combined tree awaits Coordinator integrated cover. No Reviewer edits/tests.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified.
