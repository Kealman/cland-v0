---
id: T-491
kind: task
title: Droplet verify falls back to local on 'lock acquisition deadline reached' under load
state: open
status: review
size: S
criterion_seq: 2
labels:
  - needs-triage
assignee: null
parent: E-425
blocked_by: []
topic: topic-360
branch: t/T-491-droplet-verify-falls-back-to-local-on
created: 2026-10-15T12:05:32.122Z
updated: 2026-10-16T06:17:27.469Z
---

## Summary

Under load, a verify that should go to a droplet falls back to the local slot with "lock acquisition deadline reached". This happened to 7453981f for T-453 at 12:04Z on 2026-10-15, with 1-min load around 34–44 and a droplet slot and budget free. The fallback lands in the serial Mac queue, the one place that's already overloaded, so load feeds more load.

## Acceptance criteria

- [x] C1. A spend-ledger or executor lock that misses its deadline retries with backoff, within a bounded wait, before falling back to local. The fallback notice names the lock and how long it waited.
  - done: impl-491 · 2026-10-16T06:15:10.642Z
  - verified: rev-30 [reviewer] · run rev-20261016-491-source · 2026-10-16T06:17:27.469Z · commit 81b6671b1c38ae61e0289c6f398e994f5ee83b42
- [x] C2. A test holds the lock past the old deadline while a remote slot and budget are free, and shows the run still goes remote once the lock frees within the bounded wait.
  - done: impl-491 · 2026-10-16T06:15:11.002Z

## Comments

### coord · 2026-10-16T01:58:13.828Z

Occurrence with real impact, 2026-10-16 01:27–01:58Z. Four verify runs got "executor-release-unconfirmed … lock acquisition deadline reached" with lease id null (no droplet created), or, for T-550's 609534539, a lease released at 01:30Z. All four stayed listed in `cland verify queue` as running remote holders: T-548 efff3e59, T-469 cd760b4c, T-527 2d023454, T-550 97a70087. `executor status` showed only two active droplets. Those phantoms held 4 of the 6 remote slots for up to 30 minutes, while five real waiters (T-505, T-517, T-523, T-556, T-559) sat "waiting for remote". The workaround is that owners cancel by full id and resubmit. A failed or never-created lease must release its queue slot and give the run a result.

### impl-491 · 2026-10-16T05:56:53.078Z

C2 regressions written first at real remote-admission seam for spend and executor locks (16s hold past old 15s deadline; require remote receipt after release). No production changes yet. Local red pending T-466 census-done per Mac load restriction; design/evidence artifact posted in topic-360.

### impl-491 · 2026-10-16T06:15:31.646Z

Implementation committed and pushed at81b6671b after pre-review merge of origin/dev40d62406. C2 old-source red A-3773, green A-3776; whole executor-safety22/22 A-3779, territory-lock20/20 A-3777, hub typecheck exit0. Shared 60s bounded retry (25ms→1s) with 15s attempts and path/elapsed exhaustion cause. suites.ts unchanged. Source review requested from reviewer role in topic-360; no per-item QA required by scope:none after-stage policy.

### rev-30 · 2026-10-16T06:17:27.469Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261016-491-source
commit: 81b6671b1c38ae61e0289c6f398e994f5ee83b42
scope: full

# T-491 source review clear

Head `81b6671b1c38ae61e0289c6f398e994f5ee83b42`, pushed origin branch `t/T-491-droplet-verify-falls-back-to-local-on` agrees. Fixed point/pre-review dev `40d624061fdc39d579903b6daa8edd6079a3fd0a`; reviewed `git diff 40d62406...HEAD` and commit list (implementation fc3d5a2a, pre-review merge 81b6671b). task.view confirms live claimant and C1/C2. Direct Standards/Spec review under Reviewer role; no subagents or test/compiler execution.

## Standards

0 high, 0 medium, 0 low findings. Six files: shared lock helper, two executor callers, two test files, two reasoned duration allowances. Existing fail-fast `acquireLockAsync` contract is preserved; the new helper centralizes the duplicated executor/spend retry loops. No scheduler policy, lock ownership algorithm, lock recovery authority, suites.ts, protocol or package changes. No applicable documented-standard or Fowler-baseline smell findings.

`LockAcquisitionTimeout` distinguishes retryable deadline/guard exhaustion from filesystem/ownership failures. Live `HubLocked` and that typed timeout retry, while unrelated errors propagate unchanged. Existing cleanup errors retain their primary type and append `; cleanup failed:`; the helper explicitly excludes those from retries. It does not unlink a live holder or weaken guarded exclusive creation/nonce/start-time release checks. Non-executor callers retain their prior fail-fast behavior.

The manifest changes only `allow`: two measured 16-second contention integrations with reasons and raw receipt A-3776. No prior allowance edits/removals or other root-key changes. Whitespace check clean. Hub typecheck exit0 is claimant-reported in A-3780; no invented separate compiler log.

## Spec

C1 source verified. `acquireLockWithRetry` caps total acquisition wait at the earlier caller deadline or 60 seconds, bounds each attempt to at most 15 seconds, and backs off 25 ms exponentially to 1 second, clipping sleep to remaining time. Executor budget reservation supplies its existing run deadline; spend operations use the bounded default. On exhaustion, the message names the full lock path and elapsed milliseconds with the last retryable cause. Unchanged suites.ts forwards Error.message into persisted fallback cause; dispatch.ts includes that cause in the human-visible droplet-unavailable notice. Required explicit-remote/no-local-fallback scheduler behavior remains unchanged.

The held-lock tests configure remote_budget=1 and daily_spend_usd=3 in isolated fixture state. Both acquire the real lock before submission, observe key readiness, hold another 16 seconds, assert no provider create/local switch/result while held, then release and require an exit0 Executor-droplet receipt, exactly one provider create and no fallback notice. This is real hub/lock/CLI/delivered shell against the existing fake provider, not a paid real-provider claim. Cleanup registers lock release before fixture teardown.

A-3773 captures old-source failures for both cases: spend returns Executor local; executor is already local while still held. A-3776 corrected-source receipt passes both (21.9705/21.0885 seconds). A-3777 whole territory-lock file20/20 includes simulated 15-second probe timeout recovery/backoff, short bounded exhaustion with path/elapsed message, and exact EACCES propagation with one attempt, plus existing filesystem/ownership regressions. A-3779 whole executor-safety file22/22 includes both integrations again (21.918/21.948 seconds) and existing spend, admission, fallback, cleanup and watchdog behavior. No failures/cancellations/skips in those green whole-file receipts.

Local checks preceded the final dev merge; A-3780 states the merge changed unrelated test/tracker/allowance inputs, not T-491 production/tests. The next gate must cover this exact merged head. Source clear verifies C1 only; C2/final runtime settlement remains pending fresh exact-head diff-selected droplet verification and required new-test load repetitions. No per-item QA (none/after-stage). Any changed head needs delta review before verify.

Findings: Standards0; Spec0.

Artifact A-3783 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3783-t-491-source-clear-bounded-lock-retries-preserve-ownership-and-fallback-cause.md

Criteria: C1 verified.
