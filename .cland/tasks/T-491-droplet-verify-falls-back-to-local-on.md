---
id: T-491
kind: task
title: Droplet verify falls back to local on 'lock acquisition deadline reached' under load
state: open
status: ready
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
updated: 2026-10-16T07:23:20.035Z
---

## Summary

Under load, a verify that should go to a droplet falls back to the local slot with "lock acquisition deadline reached". This happened to 7453981f for T-453 at 12:04Z on 2026-10-15, with 1-min load around 34–44 and a droplet slot and budget free. The fallback lands in the serial Mac queue, the one place that's already overloaded, so load feeds more load.

## Acceptance criteria

- [x] C1. A spend-ledger or executor lock that misses its deadline retries with backoff, within a bounded wait, before falling back to local. The fallback notice names the lock and how long it waited.
  - done: impl-491 · 2026-10-16T06:15:10.642Z
  - verified: rev-30 [reviewer] · run rev-20261016-491-source · 2026-10-16T06:17:27.469Z · commit 81b6671b1c38ae61e0289c6f398e994f5ee83b42
  - verified: rev-30 [reviewer] · run rev-20261016-491-correction · 2026-10-16T06:55:19.600Z · commit d39752a1d1974f104c94a20c10b7e06c23d5a557
  - verified: rev-30 [reviewer] · run rev-20261016-491-final · 2026-10-16T07:23:19.377Z · commit d39752a1d1974f104c94a20c10b7e06c23d5a557
- [x] C2. A test holds the lock past the old deadline while a remote slot and budget are free, and shows the run still goes remote once the lock frees within the bounded wait.
  - done: impl-491 · 2026-10-16T06:54:01.959Z
  - verified: rev-30 [reviewer] · run rev-20261016-491-final · 2026-10-16T07:23:19.377Z · commit d39752a1d1974f104c94a20c10b7e06c23d5a557

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

### rev-30 · 2026-10-16T06:43:43.896Z

verdict: review
result: not clear
by: rev-30 [reviewer]
run: rev-20261016-491-linux-first
commit: 81b6671b1c38ae61e0289c6f398e994f5ee83b42
scope: evidence

# T-491 Linux evidence not clear at 81b6671b

Reviewed run **35dc4189-ccd2-4706-9833-267e2c21b18c / A-3790**, exact source-clear head `81b6671b1c38ae61e0289c6f398e994f5ee83b42`. Actual Linux x64 c-8 lon1, four workers, Node24.21.0/Neovim0.12.5. Exit1:1917 tests,1911 pass,1 ordinary failure,5 skips; hub-only selected by shared infrastructure. Neovim smoke was not reached. Suite1414.17s, peak load16.17, extra load-gate wall14.16s; lifetime/cost unknown. Routine duration notices are not the blockers.

## Standards

No new Standards findings. Existing production ownership/retry source analysis A-3783 remains applicable; this receipt does not establish a production lock regression.

## Spec

**M1 — medium — hub/test/territory-lock.test.ts:516.** The new probe-deadline/backoff test records every global setTimeout call, then requires exactly `[25]`. The actual Linux ordinary assertion is `[3000,25]` versus `[25]`: existing process identity probing schedules its own3000ms timeout. The same new identity fails0/5 fresh repetitions. Thus the test's observer is coupled to unrelated native-probe timer setup/cold state instead of isolating the claimed retry backoff. Correct the observer/control so it still proves timeout retry and25ms backoff without treating the native probe deadline as another retry. Preserve filesystem/ownership assertions; do not waive or retry unchanged.

**Additional unresolved own evidence blocker:** spend-lock C2 passes ordinary remote execution but only4/5 new-test load repetitions. The receipt supplies no assertion detail for that failed repetition, so its cause is unknown and must not be attributed to the timer assertion or classified as an unrelated flake. The executor-lock C2 is5/5; bounded path/elapsed and filesystem propagation tests are each5/5. These greens do not satisfy the failed spend proof.

C1's source verification stands; C2's runtime proof is not clear. Fail C2 for the incomplete own test/load evidence. The claimant already reports investigation with no head change or resubmission (3f430bd5). Diagnose the spend repetition, make a demonstrated correction, publish raw controlled red/green + whole affected-file proof under the assigned local slot, push the new head and request delta source review before fresh verification. No unchanged retry.

Findings: Standards0; Spec1 medium (M1); additional unclassified own-test evidence blocker. Final verdict **not clear**, scope evidence. No Reviewer execution, edits or signals.

Artifact A-3792 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3792-t-491-linux-not-clear-timer-observer-assertion-and-spend-load-proof-fail.md

Criteria: C2 failed (Own Linux evidence fails: spend-lock load proof 4/5 and probe-deadline timer assertion ordinarily plus 0/5; diagnose/correct before fresh verification.).

### impl-491 · 2026-10-16T06:54:02.319Z

Test-only correction pushed atd39752a1, no production changes or dev merge since81b6671b. Probe cold red A-3793 → corrected5/5 A-3802; lock full20/20 A-3803. Spend original load failure details unavailable(T-571); unchanged cold5/5 A-3794; controlled2.5s readiness red A-3798 → green A-3801. Final corrected safety full22/22 A-3807, typecheck green. C2 fixture now separates startup,10s machine readiness, worker done timestamp(30s) and downstream report waits. Delta review requested before fresh verify.

### rev-30 · 2026-10-16T06:55:19.600Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261016-491-correction
commit: d39752a1d1974f104c94a20c10b7e06c23d5a557
scope: delta

# T-491 correction delta source review clear

Head `d39752a1d1974f104c94a20c10b7e06c23d5a557`, pushed branch `t/T-491-droplet-verify-falls-back-to-local-on`. Compare prior reviewed `81b6671b1c38ae61e0289c6f398e994f5ee83b42` to this head: **two test files only,17 additions/3 deletions**. No production, manifest or dev-merge change. Origin agrees; whitespace clean. task.view confirms live claimant, C1's old verification stale from head movement, C2 claimant done restored.

## Standards

0 high,0 medium,0 low remaining source findings. M1 from A-3792 is addressed by arranging both real process identities through a separate public UTC lock before installing the timer observer. The test still induces the 15-second attempt deadline, requires exactly two acquisitions and exactly `[25]` backoff; it does not delete or broaden the assertion to hide arbitrary retry behavior. Identity locking uses existing ownership/cleanup rules and releases before measurement.

Admission-fixture changes stay test-local: public executor.status awaits dispatcher #dropletReady before lock arrangement; periodic sweep is spaced beyond the fixture lifetime; machine readiness is10s instead of the unrelated2s fake-fixture default. Production lock wait limit/backoff/fallback semantics and spend enforcement are unchanged. The120s outer test bound aligns with runner default. No new global timers, provider policy, process termination or instrumentation remains.

## Spec

Refresh C1 source verification from A-3783 unchanged production. Both lock integrations retain real lock acquisition, free remote_budget1/$3 cap, key-readiness anchor, full16-second hold, no provider create/result/local switch while held, exactly one eventual create, successful Executor-droplet receipt and absence of fallback notice.

After release the test observes the worker's own valid done timestamp with a30s bound, then begins the separately bounded result-report wait. This preserves the admission claim and follows rule10 instead of consuming report timeout while the worker is still executing. Initial reconciliation is explicitly awaited; disabled periodic fixture sweeps are outside this test's admission assertion and remain exercised by the existing whole-file sweep tests.

## Evidence and limits

A-3793 reproduces M1 in a cold Mac process (`[3000,3000,25]`); corrected cold probe runs5/5 in A-3802, and whole territory-lock20/20 in A-3803. A-3794's unchanged spend repetitions5/5 do not erase the original Linux4/5 failure. A-3798 demonstrates a distinct controlled2.5s machine-readiness delay producing local fallback with the old2s fixture limit; A-3801 passes that same controlled delay with corrected readiness/completion/report arrangement. The temporary delay is not present in the committed diff. A-3807 whole executor-safety22/22 passes, including corrected spend21.871s and executor20.824s. No fails/cancels/skips in those corrected green receipts. Hub typecheck is reported green in A-3809.

The original Linux failed spend repetition's assertion is unavailable due reporter detail loss (T-571); neither claimant nor this verdict claims its precise cause reproduced. The controlled test identifies a genuine fixture failure mode and the final gate must establish the corrected source under Linux load. No known-flake waiver or unchanged retry is accepted.

Source delta clear; C1 refreshed only. C2/final remains pending one fresh exact-head diff-selected droplet verification, including own spend/executor/probe5/5 gates. A subsequent own failure still blocks final settlement. No per-item QA; merge/restart holds remain Coordinator-controlled. No Reviewer test/compiler execution, edits, signals or subagents.

Findings: Standards0; Spec0 remaining; M1 resolved, original Linux gate superseded only after a new qualifying receipt.

Artifact A-3811 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3811-t-491-correction-source-clear-isolated-retry-observer-and-bounded-readiness-repo.md

Criteria: C1 verified.

### rev-30 · 2026-10-16T07:23:19.377Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261016-491-final
commit: d39752a1d1974f104c94a20c10b7e06c23d5a557
scope: evidence

# T-491 final evidence review clear

Unchanged reviewed/pushed head `d39752a1d1974f104c94a20c10b7e06c23d5a557`, branch `t/T-491-droplet-verify-falls-back-to-local-on`. Local/origin heads agree. task.view confirms current C1 source verification, C2 claimant done and fresh exact-head945cbfdb passed. Evidence-only settlement after correction review A-3811.

## Standards

No remaining high, medium or low findings (0/0/0). Original production review A-3783 stands: executor/spend acquisition retries live contention and typed probe/guard timeouts with25ms→1s backoff, at most60s or earlier caller deadline, preserves ownership/recovery/cleanup failure authority, and supplies lock path plus elapsed wait to the existing fallback notice.

A-3792 M1's overbroad timer observer was corrected at this head; A-3811 reviewed both test-only changes and bounded worker-completion/report separation. Production and duration allowances were unchanged by that correction. No new finding from this run.

## Spec and owned runtime proof

Both C1/C2 verified. Raw **A-3822 /945cbfdb-4201-47b4-a739-97003a262444** confirms:
- Spend-lock held16s beyond the old15s admission limit: ordinary **22.822s**, **5/5** fresh load repetitions.
- Executor-lock equivalent: ordinary **22.327s**, **5/5**.
- Probe-deadline/backoff observer: ordinary **0.0756s**, **5/5**.
- Bounded exhaustion/path/elapsed test: ordinary **0.1912s**, **5/5**.
- Filesystem non-retry test: ordinary **0.0104s**, **5/5**.

Thus all five owned identities pass ordinary and **25/25** load repetitions, including both cases that blocked the prior gate. C2 retains real-held-lock/free-budget remote execution, pre-release concurrency assertions, exactly one provider create and no local fallback. No known-flake exception or unchanged-head retry waiver is needed.

The prior Linux spend failure's exact assertion remains unavailable (T-571); this final verdict does not invent that historical cause. The demonstrated readiness correction and isolated timer arrangement were source-reviewed, and the new corrected-head gate supplies the required positive runtime evidence.

## Overall gate

Actual Linux x64 c-8 lon1, Node24.21.0, Neovim0.12.5, four workers. Hub-only package run due shared executor infrastructure. Raw phases: hub free38/38; hub machine1874pass/0fail/5skip; Neovim smoke12/12. Total **1929tests /1924pass /0fail /0cancelled /5skips**, exit0. Host and delivered root typechecks complete. No hard duration-budget or load-gate failures; ordinary known regression notices are informational. This is Neovim smoke, not a full Neovim package claim.

Suite1516.02s, peak one-minute load16.64, load-gate extra wall21.41s. Lifetime/cost unknown in receipt. Mac source/correction proof A-3802/A-3803/A-3807 remains part of the chain.

Final review clear; refresh **C1/C2** atd39752a1. Prior not-clear runtime verdict is superseded by this qualifying corrected-head result. No further run/head movement required for T-491. Coordinator restart/merge holds remain in force; no per-item QA. No Reviewer test/compiler execution, edits, signals, provider actions or subagents.

Findings: Standards0; Spec0; M1 resolved.

Artifact A-3823 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3823-t-491-final-clear-corrected-linux-gate-and-all-five-owned-load-proofs-green.md

Criteria: C1 verified, C2 verified.
