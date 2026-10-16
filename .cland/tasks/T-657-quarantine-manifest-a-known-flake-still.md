---
id: T-657
kind: task
title: "Quarantine manifest: a known flake still runs and is reported, but no longer fails the run"
state: open
status: review
size: M
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
updated: 2026-10-16T16:43:43.275Z
---

## Summary

The costliest part of a flake is the resubmit, the review round and the second droplet run (A-4004, recommendation 2). A test red on two known-flake receipts and green 5/5 alone goes into `hub/test/quarantine.json`: it still runs and is reported, but doesn't fail the run. That turns the two-receipt gate into a hub rule.

## What to build

A committed `hub/test/quarantine.json` lists tests by file and name, each with an owner ticket, a reason, an added date and an expiry of at most 7 days. The suite runner runs quarantined tests as usual and reports their outcome in their own section of the result, but a quarantined failure doesn't make the run red. An entry past its expiry fails the manifest check by name; 20 consecutive green results are reported as "cleared" so the entry can be removed. An entry without an owner ticket or with an expiry over 7 days is refused like a TODO allowance. Task, integrated, close and release runs all honour it. docs/agents/tests.md describes the rule and who may add an entry (the Coordinator, on two receipts from different runs).

## Acceptance criteria

- [ ] C1. A quarantined test that fails is reported in its own section of the result and the run stays green, proved by a runner test with a planted failing quarantined test.
- [ ] C2. A non-quarantined failure still fails the run, and a quarantined pass is reported as a pass, proved by the same runner test file.
  - verified: rev-31 [reviewer] · run rev-20261016-657-source · 2026-10-16T16:43:43.275Z · commit 4317d560a06a6c4f10243e3827fd6548ae75a7f7
- [ ] C3. An expired entry fails the manifest check by name, and an entry without an owner ticket or with an expiry over 7 days is refused, proved by a manifest test.
  - verified: rev-31 [reviewer] · run rev-20261016-657-source · 2026-10-16T16:43:43.275Z · commit 4317d560a06a6c4f10243e3827fd6548ae75a7f7
- [ ] C4. Twenty consecutive green results for a quarantined test are reported as "cleared", proved by a test on recorded results.
  - verified: rev-31 [reviewer] · run rev-20261016-657-source · 2026-10-16T16:43:43.275Z · commit 4317d560a06a6c4f10243e3827fd6548ae75a7f7
- [ ] C5. docs/agents/tests.md and hub/README.md (Tests) describe the quarantine, its evidence bar and its expiry.
  - verified: rev-31 [reviewer] · run rev-20261016-657-source · 2026-10-16T16:43:43.275Z · commit 4317d560a06a6c4f10243e3827fd6548ae75a7f7

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
