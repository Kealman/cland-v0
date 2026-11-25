---
id: T-1912
kind: task
title: A merge landing's follow-up cannot stop the item's Codex Implementer ("process identity cannot be verified"), so every landing needs a manual cland merge repair
state: closed
status: done
size: S
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: E-2076
blocked_by: []
topic: topic-1760
branch: t/T-1912-a-merge-landing-s-follow-up-cannot-stop
created: 2026-11-16T14:04:44.964Z
updated: 2026-11-25T04:55:18.547Z
closed: 2026-11-25T04:55:18.547Z
---

## Summary

On 2026-11-16 the landing follow-up failed with `stop sessions: could not stop "impl-<n>": its process identity cannot be verified; it is still watched` for T-1877, T-1878 and T-1905, all Codex Implementers on the local host. Each time, `session.stop` from the Coordinator a minute later succeeded at once, and `cland merge T-n` then finished the follow-up (worktree removal). Once the follow-up's stop failed because `ps failed or timed out`; the other times `ps` answered in milliseconds. The landing itself is unaffected, but each case leaves a worktree and a watched session behind until someone repairs it.

## What to build

Find why the follow-up's identity check fails where a direct `session.stop` moments later passes: a stale captured identity, a race with the Implementer's own exit, or a `ps` call with too short a bound. Make the follow-up stop succeed in that case, or retry it once before reporting a failure.

## Acceptance criteria

- [x] C1. A landing whose Implementer is still running stops it and removes the worktree without a manual `cland merge` repair, in a fake-process test that reproduces the identity mismatch (test, red before the fix).
  - done: impl-1912 · 2026-11-25T01:59:55.989Z
  - verified: rev-41 [reviewer] · run rev-41-20261125-1912-final · 2026-11-25T03:10:06.740Z · commit b205b6e5f9b6ba22d2c529652513f39e7ae5b2d8
- [x] C2. A genuinely unverifiable process (identity changed) is still refused and reported, as today (test).
  - done: impl-1912 · 2026-11-25T01:52:46.601Z
  - verified: rev-41 [reviewer] · run rev-41-20261125-1912-final · 2026-11-25T03:10:06.740Z · commit b205b6e5f9b6ba22d2c529652513f39e7ae5b2d8

## Comments

### impl-1912 · 2026-11-25T01:46:53.243Z

Consumer search: afterMerge is produced only by dispatch.ts -> Sessions.stopAfterMerge. TaskMerges consumers: merge-batches.test.ts and merge-component-support.ts; stopAfterMerge direct test: launch-admission.test.ts. Searches covered src, test, docs and shipped skills for afterMerge, stopAfterMerge and stop sessions. Wire/result shape unchanged. Mitigation retries the retained owner once, preserving identity and authorization checks; ToolForbidden is never retried. Red before fix: landing retries a transient Codex identity failure and removes the worktree failed with 1 !== 2 stop attempts. After fix both transient and changed-birth cases pass locally on Node 24.21.0/macOS, fake Host only. Historical OS failure root cause remains unverified; this implements the explicitly permitted bounded retry.

### rev-41 · 2026-11-25T01:54:39.045Z

verdict: review
result: not clear
by: rev-41 [reviewer]
run: rev-41-20261125-1912-source1
commit: d3c8c9be30d62e5fda7572cfae7a4cd5323656e6
scope: full
findings: [{"severity":"medium","text":"M1: fixtureNativeGuard(t) installs its cleanup/restore hook before fixture(t) and later raw t.after hooks. Its guard is verified/restored before suiteUnit/tracker/queue/adapter/merge cleanup, so cleanup-time native launches escape the claimed fake-only boundary. Enroll/collect and join exact resource/root hooks before final guard verification; add a cleanup-boundary positive control. fenced:true alone does not enroll raw hooks.","file":"hub/test/merge-batches.test.ts","line":2158}]
finding_counts: {"high":0,"medium":1,"low":0}

Full source review not clear at d3c8c9be30d62e5fda7572cfae7a4cd5323656e6 against 5ecdfaf5ae45a1cd38b29a10e2c2fd6b805ec7c9. Standards1medium/Spec0separate findings. M1 at merge-batches.test.ts:2158: default fixtureNativeGuard(t) registers afterCleanup/drain first; suiteUnit and later tracker/queue/adapter/runner/TaskMerges cleanup use subsequently registered raw t.after hooks. Guard verification/restoration therefore precedes actual cleanup. The claimed guard-through-cleanup proof is absent (rule38); migrate these exact hooks to a joined lifecycle and prove a cleanup-time native attempt remains guarded. fenced:true alone leaves raw hooks outside the owner.

Production retry logic read through dispatch->Sessions.stopAfterMerge->Sessions.stop->CodexAdapter.stop: one retry through callback, normal native-birth and current item/crew policy checks remain; ToolForbidden retains type and is not retried; shutdown suppresses retry; second failure preserves worktree/report repair path. No separate production finding. Four fake controls assert bounded attempts/retry logs, no signal for changed/unavailable birth, prune only after successful stop, visible failure and continued later landings. Historical OS cause remains unverified; bounded retry is explicitly allowed by spec.

A-23117 reports literal pre-fix red1!==2; localmacOS Node24.21.0 merge-batches160/160 and merge-recovery65/65, full typecheck/lint exit0, zero refusals/report-only advisories; initial typecheck failure/correction disclosed. These are selected local receipts, not configured/native/T3/T4/Web proof. C1 failed for cleanup guard gap; C2 unverified. Detailed review A-23120 at .cland/artifacts/A-23120-t-1912-source-review-not-clear-at-d3c8c9be3.md. Reviewer ran no tests/native/provider/browser work or edits. Fresh source review needed before verification.

Criteria: C1 failed (New fake-process controls restore their native guard before actual acquired-resource cleanup, leaving the required fake-only lifecycle proof incomplete.).

### impl-1912 · 2026-11-25T01:58:18.810Z

M1 correction: four identity controls now use existing joined/fenced flakyReceiptCase -> suiteCase, with ownedSuiteUnit deferring roots. Captured resource hooks join before owned root removal, guard verification and restoration. Actual adapter-close hook calls new guard.control; it validates captured spawn identity before calling only the throwing guard and excludes its known control from unexpected launches. Paired early-restore control proves detection without native invocation. Additive shared test-helper consumers were searched by import graph: 14 reachable T1 files scheduled serially (dev-t3-search, executor-admission, executor-run-rules, lifecycle-serialization, merge-batches, merge-queue-unit, prune-probe-budget, suite-coordinator, suite-cover, suite-persistence, suite-soak, suite-stage-rules, suite-task-selection, tracker-summary). Existing fakeNativeGuard callers retain verify/restore behavior; guardControl is additive to suiteCase callback and used only by the four controls. Production is unchanged from source1. Typecheck and full test:lint pass with zero refusals after correction.

### rev-41 · 2026-11-25T02:01:37.749Z

verdict: review
result: clear
by: rev-41 [reviewer]
run: rev-41-20261125-1912-source2
commit: b205b6e5f9b6ba22d2c529652513f39e7ae5b2d8
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Fresh full source review clear at b205b6e5f9b6ba22d2c529652513f39e7ae5b2d8 against5ecdfaf5a and source1d3c8c9be3/A-23120. Standards0/Spec0 findings. M1 resolved: four controls use existing fenced flakyReceiptCase/suiteCase, captured raw resource hooks join before ownedSuiteUnit roots, final guard verification and patch restoration. Actual adapter-close hook awaits close then invokes guardControl while guarded. Whole-case/setup ownership and named step bounds retained.

New fakeNativeGuard.control verifies unexpected-launch count, checks exact cp.spawn guard identity, invokes only the throwing guard, and records its one known denial. Paired early-restore control fails identity check before any native function invocation. Existing verify/restore users remain compatible; helper additions are internal/additive, consumer names searched across all test tiers/docs/skills with no wire/persisted/frozen-help change. Matching per-file docs corrected. All four retry/refusal/worktree/continued-landing assertions remain.

Production unchanged since source1: one retry via Sessions callback, fresh item/crew/authorization/native-birth checks, ToolForbidden and shutdown suppress retry, second failure retains worktree/report/manual repair. Historical OS root cause remains unverified; bounded mitigation is permitted by item.

A-23134 corrects original guard claim and reports selected14T1files/425generated cases passing, localmacOS Node24.21.0, including four behavior cases plus `native guard cleanup control detects early restoration without launching a process`. Original red1!==2 retained. Full typecheck/lint exit0, zero refusals/growthreport0; earlier-head merge-recovery65/65 explicitly not reused for corrected source. C1/C2 execution verification remains pending exact-head configured receipt. Details A-23138 at .cland/artifacts/A-23138-t-1912-source-review-clear-at-b205b6e5f.md. Reviewer ran no tests/native/provider/browser work or edits.

### rev-41 · 2026-11-25T03:10:06.740Z

verdict: review
result: clear
by: rev-41 [reviewer]
run: rev-41-20261125-1912-final
commit: b205b6e5f9b6ba22d2c529652513f39e7ae5b2d8
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final clear. Exact-head runffa9e15d/A-23217 finished/passed; source-matching verification treeafb859ec checked. All five new identities (four landing retry/refusal outcomes plus early-restore guard control) have paired base1/1 and load5/5 passes; base and25 load file finishes pass through cleanup. Reviewed assertions retain worktree removal only on successful stop, changed/unavailable identity refusal, permission finality and no duplicate landing. C1/C2 verified. Codex-adapter14, merge-recovery-native12 and session-stop-races6 base cases/file finishes pass. T0/T1/fallback all T2/244 selected T3/Web exit0; selected T3 once, other T3 remains merge-batch evidence, T4 unexecuted. Linux x64 droplet c-8 fra1, Node24.21, Neovim0.12.5, Chrome for Testing156.0.8078.4 Headless Shell1248, two workers;12 prerequisite skips retained, cached status unknown, advisories report-only. A-23218: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-23218-t-1912-final-review-clear-at-b205b6e5f.md. No historical OS-root-cause diagnosis or Reviewer execution claimed.

Criteria: C1 verified, C2 verified.

### coord · 2026-11-25T04:55:18.547Z

Merged b66ecd5af98d08836f95cd61b20897a305c8af85 onto dev.
