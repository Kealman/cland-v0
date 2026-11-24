---
id: T-1955
kind: task
title: projectHub leaves an acquired hub daemon and log without teardown when registerHubCards or the readiness assertion rejects
state: open
status: ready
size: S
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: E-2072
blocked_by: []
topic: topic-1722
branch: t/T-1955-projecthub-leaves-an-acquired-hub-daemon
created: 2026-11-18T02:12:33.701Z
updated: 2026-11-24T11:11:28.443Z
---

## Summary

In hub/test/harness.ts, projectHub's catch paths clean up after serveProject and processLog.flush failures. But registerHubCards and the readiness assertion can reject after the daemon and log are acquired and before stopFixtureHub is assigned, which leaves a live hub and log with no teardown owner. Found by impl-1947 while reviewing T-1947 (topic-1608, 2026-11-18). T-1947 left this path out of scope (A-21005), and nothing has been reproduced.

## What to build

Teardown ownership is installed as soon as the daemon and log are acquired, so any later rejection stops the hub and flushes and closes the log before the error propagates. This uses the same whole-case ownership pattern that T-1947 adds.

## Acceptance criteria

- [x] C1. A fake registerHubCards rejection and a failing readiness assertion each leave no live hub process, socket or open log after the test, and both reject with their original error (test).
  - done: impl-1955 · 2026-11-24T09:51:39.310Z
  - verified: rev-41 [reviewer] · run rev-41-20261124-1955-final · 2026-11-24T11:11:27.683Z · commit 6301b9f289c65b142c6d5884111797f975063739
- [x] C2. projectHub's callers are unaffected: the T-1947 census list (A-21000) is checked against the change (rule 41).
  - done: impl-1955 · 2026-11-24T09:51:39.761Z
  - verified: rev-41 [reviewer] · run rev-41-20261124-1955-final · 2026-11-24T11:11:27.683Z · commit 6301b9f289c65b142c6d5884111797f975063739

## Comments

### impl-1955 · 2026-11-24T09:06:52.633Z

Consumer census C2: checked A-21000 (1,098 existing paths across production/source, hub T1–T4, nvim, Web, QA, docs, shipped skills and frozen fixtures); refreshed hidden-file name/path search (770 textual consumers). Every census row is unaffected at the interface: ProjectHubOptions, return fields, normal startup, stop/dispose and wrapper signatures stay unchanged. Only acquired-startup rejection now joins cleanup before propagation. T1 conservative candidates (25 files) will run locally before requesting verify; T2 aide-migration passed 12/12; other T2/T3/T4/Web callers defer to configured selection and later occasions, with no runtime proof claimed by this census. No shared wire/schema/help/policy contract changes.

### rev-35 · 2026-11-24T09:35:27.650Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1955-source-1
commit: 7aecf83bb0746fa01a2179b842418f315f6ef5a2
scope: full
findings: [{"severity":"medium","text":"M1: the new catch awaits stopFixtureHub before rethrowing the startup error; daemon-stop or process-log-close rejection replaces that original cards/readiness error. Preserve the selected startup primary, retain cleanup rejection as secondary/incomplete ownership, and cover rejected-then-confirmed cleanup without losing the original rejection identity.","file":"hub/test/harness.ts","line":647},{"severity":"medium","text":"M2: the new controls keep acquired projectHub cleanup hooks in a local array drained only on normal continuation. Their fallback is not a required-close owner, while migrationControl restores global mocks/native guard in finally after settled work without positive resource-close gating. Assertion/cancellation/cleanup failure can release seams with the hub/log still unclosed. Enroll these exact hooks before acquisition and test actual guarded removal/refused restoration through rejection and repair.","file":"hub/test/aide-migration.test.ts","line":59}]
finding_counts: {"high":0,"medium":2,"low":0}

Source review against Standards and Spec at 7aecf83bb0746fa01a2179b842418f315f6ef5a2: not clear. Two medium findings are detailed in A-22788. M1: harness.ts:647 can replace the original cards/readiness rejection with a cleanup failure. M2: aide-migration.test.ts:59 keeps synthetic hooks outside a required-close owner, allowing restoration after incomplete cleanup. Both are confirmed by the implementer in 87a7a86f. C1 failed; C2 census was independently checked (all 1,098 retained paths exist at this head), but remains unverified pending correction/final evidence. No tests, probes, edits or configured verification were run by this review. This concludes and releases the source evidence hold; correct both together and request fresh review before verification.

Criteria: C1 failed (Startup cleanup rejection can replace the original error; synthetic close hooks and seam restoration lack positive-close ownership.).

### impl-1955 · 2026-11-24T09:41:05.927Z

Source1 correction census: projectHubStartupCleanupFailures is a new test-harness accessor keyed by the exact TestContext; it reports structured primary/cleanup identities without mutating thrown values (including frozen/primitive values). Search for startupCleanupFailures, projectHubStartupCleanupFailures and the receipt field names finds only its harness implementation, the new aide-migration controls and the file-specific guide. Existing ProjectHubOptions/return/wire shapes and all A-21000 dispositions stay unchanged. New controls use guardedLeaseCase with a positive context-drain canRestore gate; the exact synthetic context is enrolled before startup, whole-case cancellation is observed before checking guarded removal/seam refusal, and rejected-close repair confirms the same owner drained before restoration. No source1 evidence is projected onto this corrected tree.

### rev-41 · 2026-11-24T09:52:33.955Z

verdict: review
result: clear
by: rev-41 [reviewer]
run: rev-41-20261124-1955-source2
commit: 6301b9f289c65b142c6d5884111797f975063739
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Fresh full source review clear at6301b9f289c65b142c6d5884111797f975063739, against8a5ac9686 plus source1 findings at7aecf83bb/A-22788. Standards0/Spec0 findings. No dev merge since source1. Reviewed full3-file diff and shared fixture/cleanup owners; no Reviewer tests/native/browser or edits.

M1 resolved: acquired hub teardown installed before card registration/readiness. Outer catch attempts stopFixtureHub but rethrows exact selected startup value even if cleanup rejects; separate WeakMap keyed by exact TestContext retains primary/cleanup identities without modifying frozen/primitive errors. stop/dispose return/options normal paths unchanged. Context hooks retain retry ownership; log close follows confirmed daemon stop. Additive accessor consumer inventory contains harness,new controls,file guide; existing census dispositions remain interface-compatible.

M2 resolved for new controls: startupControl enrolls its exact fenced synthetic context close before acquisition, through guardedLeaseCase/caseDeadlines. close awaits admitted startup then full context drainage; canRestore remains false until successful close. Roots have guarded removal and seams/native guard release refuse unconfirmed closure. Rejected-close control checks original primary+secondary receipt, actual guarded removal refusal and open log/root, repairs then observes log/socket/discovery closure. Cancellation control invokes actual whole-case cleanup while log close held, observes admission closure, attempts guarded removal/release before fake-clock expiry, then releases producer,joins exact original rejection/drainage and checks actual root ENOENT. Existing controls and assertions retained.

A-22802 records deliberate old-await negative control red: planted process-log-close error replaces expected startup primary. Corrected selected T2 file14/14,25T1census files290/290,full typecheck/lint exit0 reported on macOSarm64 Node24.21; zero lint refusals/advisories report-only. Early control-only failures and source1 evidence retained without counting as new-tree pass. No configured/native-child/browser/stress/T3/T4 proof claimed. Earlier A-21000 census source1 independently checked1098paths; fresh item notes/additive accessor census and unchanged caller interfaces read. C1/C2 final execution/caller verification awaits exact-head configured receipt; no criterion mark added in this source pass.

### rev-41 · 2026-11-24T11:11:27.683Z

verdict: review
result: clear
by: rev-41 [reviewer]
run: rev-41-20261124-1955-final
commit: 6301b9f289c65b142c6d5884111797f975063739
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final evidence review clear; no findings. Exact head 6301b9f289c65b142c6d5884111797f975063739 remains unchanged from source2 rev-41-20261124-1955-source2 / A-22804, which resolved both earlier medium findings. Run 77a6cd14-81e0-48ee-8a04-e436f70fc454 is finished/passed. A-22872 records exit 0; bound verification tree c2d269f8fe0eb062ca9be4f70a557756959a2654 matches the reviewed commit outside documented tracker/rulebook exclusions.

C1 verified: `fixture cleanup owns the acquired hub after cards rejection`, `...readiness rejection`, `...rejected close rejection`, and `caller cancellation retains seams and root while rejected startup is still closing` each have one base pass plus five separate load-gate pass receipts. Their 5/5 summaries are A-22872:14406,14419,14794,14822, with positive file finishes. Source2 established exact original error preservation, secondary cleanup receipt ownership, confirmed daemon/log/socket cleanup, guarded root/seam refusal before repair, and cancellation joining before restoration. Embedded/fake-boundary controls are not claimed as native child launch coverage.

C2 verified: A-21000 census/source2 compatibility analysis and additive accessor consumer inventory remain valid at unchanged head. Configured file receipts for aide-migration, project-hub-lifecycle and orphan/socket/worker fixture lifecycle regressions pass. This is not a claim all 1,098 census paths executed.

T0/T1/fallback all T2/239 selected T3 importer files/Web exit 0; remaining T3 deferred to merge batch, T4 unexecuted. Linux x64 droplet c-8 nyc1, Node v24.21.0, Neovim v0.12.5, two workers, isolated Chrome for Testing 156.0.8078.4 headless shell/Playwright 1248. Platform/binary prerequisite skips retained; budgets/ratchet/lint advisory checks report-only, not enforced timing passes; no cache reuse. Detailed receipt/criteria map A-22875 at .cland/artifacts/A-22875-t-1955-final-evidence-review-clear-at-6301b9f28.md. No Reviewer tests/native/browser/provider work or source edits.

Criteria: C1 verified, C2 verified.
