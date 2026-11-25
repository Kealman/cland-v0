---
id: T-1979
kind: task
title: guardedLeaseCase restores seams after drainFixtureWork even when a rejected resource-cleanup promise has already left the pending set
state: closed
status: done
size: S
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: E-2072
blocked_by: []
topic: topic-1769
branch: t/T-1979-guardedleasecase-restores-seams-after
created: 2026-11-18T13:25:29.069Z
updated: 2026-11-25T05:39:59.140Z
closed: 2026-11-25T05:39:59.140Z
---

## Summary

Found by impl-1973 in T-1973's second review (2026-11-18). The shared executor lease fixture `guardedLeaseCase` restores its seams in `afterCleanup`, after `drainFixtureWork`. A resource-cleanup promise that rejects has already left the pending set by then, so its settlement is treated as if the resource closed successfully. The native-launch guard and the seams can be restored while that resource is still open. T-1973 corrects its own new uses, and this item covers the shared fixture and its existing callers.

## What to build

`guardedLeaseCase` keeps its guard and seams until every resource has a positive successful-close receipt. A rejected cleanup keeps the guard in place and reports the rejection as the case's failure (rule 39), never as a successful close.

## Acceptance criteria

- [x] C1. A resource whose cleanup rejects keeps the native-launch guard and seams installed, and the case fails with that rejection (test with a positive control).
  - done: impl-1979 · 2026-11-25T02:14:03.431Z
  - verified: rev-40 [reviewer] · run rev-40-20261125-1979-final · 2026-11-25T03:47:42.758Z · commit 7cec18426163f6a1556393b1bf741367dc843dfa
- [x] C2. Every caller of `guardedLeaseCase` is listed with its disposition (rule 41) and passes unchanged.
  - done: impl-1979 · 2026-11-25T02:14:03.851Z
  - verified: rev-40 [reviewer] · run rev-40-20261125-1979-final · 2026-11-25T03:47:42.758Z · commit 7cec18426163f6a1556393b1bf741367dc843dfa

## Comments

### coord · 2026-11-19T02:23:15.907Z

Confirmed again by impl-1957 during T-1957 (A-21490): the generic `guardedLeaseCase` default can restore seams and the native guard after a rejected cleanup, once the global pending set has emptied. T-1957 opts only its own new cases into a positive settlement fence; all legacy callers keep the old default. This item should migrate and audit those callers.

### coord · 2026-11-19T03:20:58.510Z

Second local opt-in: T-1857 adds a successful-cleanup fence limited to its new case, using the same names as T-1957's seam (`deferRestore`, `canRestore`, `releaseSeams`). This item should fold both T-1957's and T-1857's opt-ins into the shared `guardedLeaseCase` default and migrate the legacy callers.

### coord · 2026-11-19T10:07:31.374Z

Third opt-in success fence: T-1933 adds one in process-cleanup for its newly migrated guards, leaving the legacy default unchanged. That's alongside T-1957's and T-1857's fences in guardedLeaseCase. This item should consolidate all three into the shared default.

### impl-1979 · 2026-11-25T02:11:27.594Z

Consumer audit: repository search for guardedLeaseCase, executor-lease-fixture, canRestore, deferRestore, releaseSeams and fenceFixtureCleanup covers hub/test, nvim/test, shared, test-support, QA and shipped skills/docs. All 13 pre-existing direct caller files retain their APIs unchanged: executor-admission.test.ts (lease-state predicate remains extra proof); executor-prepare-component.test.ts (two close predicates remain); aide-migration.test.ts (explicit repair predicate remains); suite-retention-fixture.ts and suite-billing-fixture.ts (deferred restoration and original-body/repair/root predicates remain); config-reload-component.test.ts, evidence-publish.test.ts, executor-safety-component.test.ts, suite-accounting.test.ts, suite-close-component.test.ts, executor-droplet-component.test.ts, executor-admission-lock.test.ts, executor-run-rules.test.ts (default now gets positive owner receipts). New caller case-deadlines.test.ts proves rejection retention and same-owner repair. Existing fenceFixtureCleanup readers use release; canRelease is additive, with guardedLeaseCase its only new consumer. No protocol, persisted shape, CLI/help or frozen text changes. Indirect retention/billing consumers are included in focused checks. A conservative import closure selects 159 existing T1 files via the shared cleanup owner for pre-review execution.

### rev-40 · 2026-11-25T02:15:52.554Z

verdict: review
result: clear
by: rev-40 [reviewer]
run: rev-40-20261125-1979-source
commit: 7cec18426163f6a1556393b1bf741367dc843dfa
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear; no findings. Default guardedLeaseCase now fences before acquisition, records successful owner receipts and restores in release phase after checks; manual release checks resources/hubs/directories plus existing caller predicate. Rejected cleanup retains controls; positive same-owner repair regression preserves exact original rejection and seam/guard identities before successful restoration. Thirteen existing direct caller dispositions match source, including deferred billing/retention repair paths. Additive canRelease leaves existing release API intact. C1/C2 final verification pending configured exact-head named-case/caller receipts; local107 selected tests and static exits0 are not full932-file reachability coverage. No Reviewer runs. A-23161: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-23161-t-1979-source-clear-at-7cec18426.md.

### rev-40 · 2026-11-25T03:47:42.758Z

verdict: review
result: clear
by: rev-40 [reviewer]
run: rev-40-20261125-1979-final
commit: 7cec18426163f6a1556393b1bf741367dc843dfa
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final clear; A-23236. Exact-head825373f8/A-23234 passed, canonicald5d63921 matches reviewed executable source. C1 named rejected-resource-close/native-guard+seam retention/same-owner repair case structured pass15451 and separate5/5load15947. C2 all13direct caller dispositions retained; eleven test-file case receipts plus billing/retention helper consumers independently checked. Unrelated macOS stageCase selector skip not counted as guarded caller pass; indirect retention-scale T4 unexecuted/not claimed. Actual T0/all247T1/fallback448T2/selected261T3/55Web exit0; remaining coverage policy preserved. Noncached Linuxx64 c8fra1 workers2 Node24.21/Nvim.12.5 HeadlessShell1248/CfT156.0.8078.4.12prerequisite skips and report-only budget notices retained; no performance clearance or932-file reachability-as-coverage claim. No Reviewer execution/edits.

Criteria: C1 verified, C2 verified.

### coord · 2026-11-25T05:39:59.140Z

Merged 820dd4e04ddb4f75cf9b58e514857b1b45b0a327 onto dev.
