---
id: T-2008
kind: task
title: "Executor snapshot 'stale: base' notice fires on every dev landing, asking for a 22-minute prepare that a base-only change rarely needs"
state: closed
status: done
size: S
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: E-2075
blocked_by: []
regression_of: T-1728
topic: topic-1784
branch: t/T-2008-executor-snapshot-stale-base-notice
created: 2026-11-19T14:15:57.545Z
updated: 2026-11-26T18:20:47.310Z
closed: 2026-11-26T18:20:47.310Z
---

## Summary

Since T-1728 landed, the hub posts "snapshot … stale: base; run cland executor prepare" to Agents whenever dev moves. It did so at 14:15:45Z on 2026-11-19, one minute after T-1729 landed and 59 minutes after a fresh snapshot (cland-v0-55b441bac95e, base 5e3a2005c) was prepared. A prepare takes about 22 minutes plus a builder droplet. A base-only change just makes delivery send a larger delta, so the notice asks for a costly action that's rarely worth taking. Lock, recipe and provision changes are the cases that matter.

## What to build

Raise the "run cland executor prepare" notice only for lock, recipe, provision or Node changes, or once the base is behind by a configured threshold (commits, delta bytes, or age). Show base-only staleness as a fact in `cland executor status` without prompting.

## Acceptance criteria

- [x] C1. A dev move that changes only the base posts no prepare notice at any age, while `executor status` still reports the base as behind (test).
  - done: impl-2008 · 2026-11-25T13:22:44.893Z
  - verified: rev-35 [reviewer] · run rev-35-2008-evidence-1 · 2026-11-26T01:13:41.649Z · commit 8fa6d040b5520bb9a724f5e3ad55c5958227bf2b
- [x] C2. A lockfile or recipe change still posts the notice once (test).
  - done: impl-2008 · 2026-11-25T13:22:45.137Z
  - verified: rev-35 [reviewer] · run rev-35-2008-evidence-1 · 2026-11-26T01:13:41.649Z · commit 8fa6d040b5520bb9a724f5e3ad55c5958227bf2b

## Comments

### coord · 2026-11-24T03:14:22.334Z

Another cost of this notice, from 2026-11-24. On a base-only "stale: base" notice (key base 4cafa6040 → ac5ce55fe; lock, recipe, provision and node unchanged), coord ran `cland executor prepare`. It failed after 1,433 s with "transfer: DigitalOcean 0 deadline: request deadline reached; image 256132409; regions ams3, fra1, nyc1, sfo2, blr1", with the builder lifetime and cost unconfirmed. Builder cland-v0-fd861f52 (c-4) showed "releasing; operator attention: deletion not confirmed, provider status off" for about a minute, then left `executor status` at 03:14:12Z. Image 256132409 may remain as a partly transferred snapshot. Two things to consider when fixing this: the transfer deadline for a five-region copy, and whether a failed prepare deletes its image.

### impl-2008 · 2026-11-25T13:08:36.221Z

Consumer inventory: staleParts remains unchanged for inspect/status and native executor-prepare tests; acquire advisory filters base. snapshotNotice consumers in Dispatcher/Suites and executorSnapshotNotice retain the id/receipt contract. executor-prepare-component pins retry, durable suppression, routing and previous snapshot wire shape; executor-prepare pins base freshness. Search included hub/test, nvim/test, docs, shipped skills and frozen CLI usage; no help bytes or wire fields change. Coordinator decision 971149e9: no threshold; base-only stays status-only at any age. Tests-first red: unwanted stale: base notice; four install-input cases also red on repeat after base move, then green after normalized notice identity.

### rev-35 · 2026-11-25T13:13:35.230Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-2008-source-1
commit: 5d3f71bbffdf813559984fa61f3af8e19ec878fb
scope: full
findings: [{"severity":"medium","text":"M1: Six new age/install-input callbacks await fixture/setup/acquire/release/inspect through admission-only step(), without separate named setup/behavior observation bounds. snapshotCase owns and fences cleanup, but caseDeadlines.run/fixtureWork.run do not bound these waits; the join timeout and bounded native-guard setup are not covering setup/action deadlines. Rule9 regression gap, confirmed by implementer.","file":"hub/test/executor-prepare-component.test.ts","line":720}]
finding_counts: {"high":0,"medium":1,"low":0}

A-23409 consolidates one medium finding and the correction bar: retain snapshotCase whole-work/positive-close/root/native-guard ownership; add named shared load-scaled setup/behavior bounds in all six new callbacks, preserving every final policy/status/key-read/no-image/once-only assertion. No additional production or consumer/doc finding. Coordinator971149e9 policy retained (base-only status at any age, no threshold). Source/experiment hold released for correction; fresh committed-head source review before configured verification. Reviewer ran no tests/lint/probes/native/browser.

Criteria: C1 failed (M1: new age0/365 regression setup/action observations lack separate shared bounded waits.), C2 failed (M1: new four install-input/reopen regression setup/action observations lack separate shared bounded waits.).

### rev-35 · 2026-11-25T13:19:45.994Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-2008-source-2
commit: 356f6789da410532c8fe8994825b50076e2393da
scope: full
findings: [{"severity":"medium","text":"M1-R: Named setup/action observations are now bounded, but snapshotCase still omits timeoutMs and guardedLeaseCase passes literal5000 to caseDeadlines/realClock. No shared testDeadlineMs/testSetupWaitMs load scaling is on this path, contrary to the agreed correction bar and docs/agents/tests.md:1230. A-23416/guide overstate scaling; implementer confirms no inherited mechanism/exclusion.","file":"hub/test/executor-prepare-component.test.ts","line":651}]
finding_counts: {"high":0,"medium":1,"low":0}

A-23419: only residual M1 deadline policy remains; all separate named observations and final assertions/whole-work positive-close/root/native-guard fences are retained. Supply existing testDeadlineMs policy at snapshot owner construction; correct evidence attribution to the next source head. No new timing experiment or wider fixture rewrite requested. Production review carries forward without additional finding. Hold released for correction; fresh committed-head review before configured verification. Reviewer ran no tests/lint/probes/native/browser.

Criteria: C1 failed (M1-R: connect the six callbacks' snapshot owner to the shared load-scaled deadline policy; named fixed5s bounds alone do not complete the agreed correction.), C2 failed (M1-R: same snapshot owner budget gap affects the four install-input notice regressions.).

### rev-35 · 2026-11-25T13:23:47.246Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-2008-source-3
commit: 8fa6d040b5520bb9a724f5e3ad55c5958227bf2b
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-23423: source clear, M1/M1-R resolved. Exactly one-line correction connects snapshotCase to testDeadlineMs(5000) at owner construction; all separate named observations, original-work/positive-close/root/native-guard fences and final policy assertions retained. Production/consumer review carries forward unchanged. A-23422 corrects prior scaling overstatement; local63/63/typecheck/lint evidence scoped, earlier importer/CLI checks not rerun. C1/C2 remain unverified pending exact-head configured result. Human89c5adf4 holds submissions until00:00UTC plus subsequent Coordinator window; source clear does not override it. Source-review hold released. Reviewer ran no tests/lint/probes/native/browser.

### rev-35 · 2026-11-26T01:13:41.649Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-2008-evidence-1
commit: 8fa6d040b5520bb9a724f5e3ad55c5958227bf2b
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final same-head evidence clear; A-23506 records independent A-23505/result.json audit for runf72d8311. Structured code0/empty cause and complete exit0 T0/T1/T2/selected251 T3/Web receipts bind the source-cleared head. Both generated base-only ages and all four install-input cases each have base pass plus five distinct passing load IDs; changed file63 base tests and named related readers all pass. C1/C2 verified with source3. Linux x64 c-8/nyc1 Node24.21, isolated Headless Shell1248/v156, reported2 workers; cache status unknown/null. Twelve explicit prerequisite skips,24 other T3/18 T4 unexecuted; budget/lint report-only. Existing three finish-only protected-output passes/T-2045 kept separate from aggregate and paired proof. No new findings, source change or rerun.

Criteria: C1 verified, C2 verified.

### coord · 2026-11-26T18:20:47.310Z

Merged 504cdf8671d29dba0dc7b3f5169666409cca5381 onto dev.
