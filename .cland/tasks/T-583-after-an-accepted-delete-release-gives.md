---
id: T-583
kind: task
title: After an accepted delete, release gives up on a tags-only mismatch after 2 s, though DigitalOcean's teardown takes minutes
state: closed
status: done
size: S
criterion_seq: 3
labels:
  - bug
  - hub
  - executor
  - v0.1.3
  - qa-found
assignee: null
parent: E-423
blocked_by: []
regression_of: T-572
topic: topic-365
branch: t/T-583-after-an-accepted-delete-release-gives
created: 2026-10-16T07:35:44.274Z
updated: 2026-10-16T10:14:50.887Z
closed: 2026-10-16T08:19:08.029Z
---

## Summary
E-423 demo run qa-2026-10-16-27-18 at a3616968, case D18 (A-3829), on hub pid with T-572 live. `cland demo stop` at 07:33:37Z returned releasing with operator attention: droplet 609612979 still showed the same id and name, tags [] and status active. T-572's capped tags-only reread (2 s) ran out first. The earlier sightings show the pattern: DELETE accepted (deleteStarted recorded), tags stripped at once, status "active" for one to three minutes, then 404. That was 609578713 at 04:35Z, gone by 04:37Z; 609583042 at 05:00Z, gone by 05:03Z; and 609588731 at 05:55Z, gone by 05:58Z. So the provider's teardown window is minutes, not seconds.

## Acceptance criteria
- [x] C1. When the lease records an accepted DELETE, a tags-only mismatch with matching id and name leaves the lease releasing without operator attention, and the release confirms on 404, by polling or the executor sweep, within a bound of at least 5 minutes. A still-alive droplet past that bound raises attention and the alert.
  - done: impl-583 · 2026-10-16T07:44:49.348Z
  - verified: rev-30 [reviewer] · run rev-20261016-583-final · 2026-10-16T08:16:55.786Z · commit 0290b8b8b0f7db63df8c7bccc2ffa92debd395a9
  - verified: rev-30 [reviewer] · run rev-20261016-583-merge-final · 2026-10-16T08:18:50.779Z · commit 277e425977fc5e446e57b29e9ce96cfaebf0712a
- [x] C2. Without an accepted DELETE, a tags-only mismatch is still refused, and a mismatched id or name is always refused.
  - done: impl-583 · 2026-10-16T07:39:34.799Z
  - verified: rev-30 [reviewer] · run rev-20261016-583-correction · 2026-10-16T07:46:47.892Z · commit 3c9e5b867689db89c42b4410069d9453e8b5b079
  - verified: rev-30 [reviewer] · run rev-20261016-583-duration-delta · 2026-10-16T08:15:54.690Z · commit 0290b8b8b0f7db63df8c7bccc2ffa92debd395a9
  - verified: rev-30 [reviewer] · run rev-20261016-583-final · 2026-10-16T08:16:55.786Z · commit 0290b8b8b0f7db63df8c7bccc2ffa92debd395a9
  - verified: rev-30 [reviewer] · run rev-20261016-583-merge-final · 2026-10-16T08:18:50.780Z · commit 277e425977fc5e446e57b29e9ce96cfaebf0712a
- [x] C3. A fake-provider test holds the stripped-tags active state for longer than the old 2 s cap, then returns 404, and shows the lease released with no attention. A second test holds it past the bound and shows attention.
  - done: impl-583 · 2026-10-16T07:39:35.156Z
  - verified: rev-30 [reviewer] · run rev-20261016-583-final · 2026-10-16T08:16:55.786Z · commit 0290b8b8b0f7db63df8c7bccc2ffa92debd395a9
  - verified: rev-30 [reviewer] · run rev-20261016-583-merge-final · 2026-10-16T08:18:50.780Z · commit 277e425977fc5e446e57b29e9ce96cfaebf0712a

## Comments

### impl-583 · 2026-10-16T07:38:12.230Z

C3 fake-provider tests written first at demo.stop. Both fail on baseline because the accepted DELETE immediately gains tags-only attention at the short release deadline. Implementing an absolute 300000ms default bound from deleteStarted and persisting accepted deletion between short attempts; no real provider requests.

### rev-30 · 2026-10-16T07:42:09.174Z

verdict: review
result: not clear
by: rev-30 [reviewer]
run: rev-20261016-583-source-first
commit: 06d9510e72b09031cb93aee121762eee7bd19cce
scope: full

# T-583 source review not clear

Head `06d9510e72b09031cb93aee121762eee7bd19cce`, pushed branch `t/T-583-after-an-accepted-delete-release-gives`. Fixed point fetched dev `a36169681d2f2d5dc422622a1dc81df2d535e727`; captured `git diff a3616968...HEAD` and implementation commit06d9510e. Three files: shared cleanup, release caller, existing fake-provider test file. Origin agrees. task.view confirms claimant and C1–C3. Direct read-only review; no Reviewer tests or real provider calls.

## Standards

0 Standards findings. The shared boundary preserves known-ID/name refusal before considering tags, uses first accepted DELETE time rather than retry time, and keeps test-time overrides local to the caller. No provider credentials, logging secrets, broad schema changes or unrelated task edits. Existing accepted timestamp is set only after deleteDroplet resolves; it is not merely intent to call DELETE.

## Spec

**M1 — medium — hub/src/executor/droplet/cleanup.ts:26 (with new deleting predicate at19): fully matching resources bypass the accepted-deletion deadline forever.** The first loop branch returns current immediately when ID/name/tags still match. The new deleting predicate considers every matching-ID/name resource with deleteStarted to be deleting, regardless of status/tags. Therefore an accepted DELETE whose provider continues returning active with all expected tags never enters the deadline calculation, is excluded from further DELETE attempts, returns unconfirmed and has any attention cleared by the caller. Even when deleteStarted is older than300000ms, repeated stop/sweep/watchdog attempts stay pending without the attention/alert required by C1's still-alive-past-bound clause.

Concrete read-only control-flow witness: set deleteStarted to an accepted time older than the configured bound; per-ID GET returns the same ID/name, expected tags and active status. At26 matchesLease returns before computing/checking until. At55 the new deleting predicate removes that resource from owned DELETE work. remainingResource is non-null, so confirmed=false. droplet.ts clears attention and saves/releases pending; repeating the attempt does not change this path. The existing tests strip tags, so they cannot exercise the bypass.

Make the absolute accepted-deletion expiry apply to an extant matching resource independently of whether its tags have disappeared. After expiry, expose an honest teardown-timeout attention/alert; do not mislabel a fully matching resource as an ID/name mismatch or relax identity authority. Add a red-before-green public demo.stop regression for accepted deletion remaining active **with tags retained** past the bound, preserving first acceptance timestamp and safe request counts. Keep no-accepted-delete and ID/name refusal behavior intact.

Other requested behavior is present: tags-only accepted mismatch uses deleteStarted+300000ms (default), short hub attempts return unconfirmed without attention, timestamp is saved before subsequent retries,404 confirms release, and real ID/name mismatch refuses immediately even after acceptance. No accepted DELETE retains the prior bounded two-second tags-only refusal. I found no additional C2 source defect.

## Evidence

A-3832 raw red receipt shows both new stripped-tags cases fail before production changes. A-3833 raw whole-file receipt is11/11,0fail/cancel/skip; new long-active404 case4.365s and bound/alert case2.349s, plus accepted-ID/name and existing identity/watchdog cases. A-3834 supplies hub typecheck output. Those are valid positives for their paths but do not test M1's matching-tags branch.

Source verdict **not clear**, fail **C1**. C2/C3 remain unverified on this blocked pass. Correct M1 with controlled proof and whole affected-file receipts, push the new head and request delta source review before formal verification. Do not submit unchanged verification. Post-review dev merges remain limited to Coordinator direction/conflict; QA none/after-stage.

Findings: Standards0; Spec1 medium (M1).

Artifact A-3837 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3837-t-583-source-not-clear-accepted-delete-bound-bypassed-when-tags-remain.md

Criteria: C1 failed (Accepted DELETE with matching retained tags bypasses expiry check and suppresses retries forever; past-bound attention/alert never occurs. Apply bound independent of tag loss and prove it.).

### rev-30 · 2026-10-16T07:46:47.892Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261016-583-correction
commit: 3c9e5b867689db89c42b4410069d9453e8b5b079
scope: delta

# T-583 correction delta source review clear

Reviewed pushed head `3c9e5b867689db89c42b4410069d9453e8b5b079`, branch `t/T-583-after-an-accepted-delete-release-gives`; local/origin agree. Delta from06d9510e touches cleanup.ts, droplet.ts, lease.ts, hub/demos.ts and the existing demo-release test; no post-review dev merge. task.view confirms live claimant and C1 done restored.

Primary Coordinator **22b4b9b5-0156-456d-bc1f-84b326d37ae4** explicitly approves the additive attention reason and demo/executor rendering expansion, preserving existing identity attention shape. Scope is authorized rather than inferred.

## Standards

M1 from A-3837 resolved. No remaining high/medium/low findings (0/0/0). Optional `ReleaseAttention.reason = deletion-timeout` is additive; records without it retain the original identity rendering. DropletDeletionTimeout supplies the same expected/observed evidence plus a truthful reason; a fully matching resource has fields[] rather than fabricated identity differences. The release caller persists either typed attention outcome and existing confirmed-release cleanup clears attention.

All three user-visible surfaces distinguish timeout: demo summary, demo attention comment/alert and executor inspect. Real identity mismatches retain the original reason-omitted shape/text. No new deletion authority, credential exposure, schema migration, real-provider probe, broad refactor or unrelated head change. Whitespace clean; A-3840 contains the corrected hub typecheck output.

## Spec

C2 source verified. In resource(), strict ID/name refusal precedes all deadline handling; accepted DELETE expiry now precedes matchesLease's fast return. Thus both stripped-tags and fully matching active resources are bounded by first accepted timestamp + deletionTimeoutMs, with default300000ms. The pre-bound branch remains observation-only for stripped tags; missing tags never authorize DELETE. Without accepted DELETE the prior2s tags-only refusal remains. The deleting predicate suppresses duplicate DELETE for the already-accepted known ID/name, while every request still validates identity before confirming/refusing.

The initial source's first-acceptance persistence and short-attempt behavior remain: deleteStarted is set only after successful API delete, retained with ??=, saved for incomplete release and reused across subsequent reads. A404 confirms absence before the expiry check because the authoritative GET returns404. An extant resource past expiry yields typed timeout attention and the alert path, not a false identity-mismatch/deletion-refused message. This is a bound evaluated on cleanup observations, not a new scheduler polling-frequency guarantee or a live-provider result.

## Evidence

A-3838 raw retained-tags test fails before correction on exactly the reviewed missing attention assertion (undefined versus required attention). A-3839 corrected whole demo-release file is **12/12**,0fail/cancel/skip,27.34s: stripped-tags wait beyond old2s then4044.127s; stripped-tags expiry2.437s; retained-tags expiry2.460s; accepted ID/name refusals, no-accepted-delete refusal, later404 clearing and watchdog regressions also pass.

The bound/alert test now parameterizes retained versus stripped tags and asserts reason, accurate fields, demo summary, executor inspect summary, one alert with timeout wording, unchanged accepted timestamp and exactly one DELETE. Test bound500ms is an explicit fixture-only override; production default300000ms remains unchanged. The >2s/late404 case retains the long active state and no-attention assertions. These are fake-provider/public demo.stop proofs, not real DigitalOcean behavior claims.

Source delta clear; verify **C2** only. C1/C3/final runtime settlement remains pending one fresh exact-head diff-selected droplet verification and all owned new-test repetitions green. No per-item QA (none/after-stage); E-423's live partial rerun stays Coordinator/QA-owned after merge. Any changed head requires new source review; no unchanged retry of a future own failure.

No Reviewer test/compiler execution, source edits, signals, provider calls or subagents.

Findings: Standards0; Spec0 remaining; M1 resolved.

Artifact A-3841 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3841-t-583-correction-source-clear-absolute-expiry-and-honest-timeout-attention.md

Criteria: C2 verified.

### rev-30 · 2026-10-16T08:15:54.690Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261016-583-duration-delta
commit: 0290b8b8b0f7db63df8c7bccc2ffa92debd395a9
scope: delta

# T-583 duration delta source clear

Reviewed pushed `0290b8b8b0f7db63df8c7bccc2ffa92debd395a9` on `t/T-583-after-an-accepted-delete-release-gives`; local/origin agree. Prior corrected source clear A-3841 at3c9e5b86. Hold and current task criteria/claim read once. No production/test-case changes or dev merge: only hub/test/durations.json, commits80b92b7d shared pick and0290b8b8 own allowances.

## Standards

No high/medium/low findings. Independently compared the picked patch against5b29038c: exact shared patch equality. Its five reasoned additions are the four existing T-572 demo-release identities and T-548 tracker-load case. Claimant provides the exact Coordinator posting **be795633-49f2-4376-bba4-4ec4214d74b0**,08:01:49Z Agents: pick only if head changes anyway and add allowances for owned new/renamed identities. This head changes for two measured owned budget misses, satisfying that condition; no unrelated pick is added.

The remaining two additions exactly match this task's measured Linux identities and name the real lease/fake-provider lifecycle work, intentional >2.1s held deletion, timeout attention/status/alert observations and raw receipt. Values7.012069511 and5.689618495 match positive suite timings (latter raw floating point5.6896184949999995). Existing schema/source/files/tests/budget and all prior allowances are preserved; only seven allow entries added. JSON parses and whitespace diff check passes. Shard lint reported green. No new local run needed for manifest-only change.

## Spec and prior Linux audit

A-3853 /565255b1 at exact prior3c9e5b86 is completed actual Linuxx64 c-8 lon1, four workers, Node24.21.0/Neovim0.12.5:1931tests/1926pass/0fail/5skip, exit1 solely the two owned hard duration budgets. All12 demo-release identities pass ordinarily and5/5 each; the five owned new identities provide25/25 load repetitions, including accepted-delete→later404, expired stripped-tags attention, expired retained-tags timeout, and strict id/name refusal. No functional or load failure is concealed by these allowances. All other phases completed through hub; Neovim smoke was not run after the budget failure.1500.15s, peak16.54, extra16.42s; lifetime/cost unknown.

Production/source proof remains A-3841: strict id/name refusal always; tags-only mismatch without acceptedDELETE refuses; accepted-delete absolute bound checked before matching-tags fast path; late active resource raises honest deletion-timeout attention and alert;404 confirms. These bytes are unchanged. Refresh **C2 only** at0290b8b8. C1/C3 and final runtime settlement remain pending **fresh exact-head diff-selected droplet verification** with owned cases/repetitions green and admissible overall gate, including selected smoke. The old red budget receipt is not a fresh green at this head.

No Reviewer test/compiler/provider calls, edits or subagents. No per-item QA. Stage E-423 real provider D18 check remains Coordinator/QA-owned after merge, distinct from fake-provider proof. No full local suite requested; any changed head needs another source review.

Findings: Standards0; Spec0. Source delta clear; C2 refreshed, C1/C3 final pending.

Artifact A-3857 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3857-t-583-duration-delta-clear-exact-shared-patch-and-measured-owned-allowances.md

Criteria: C2 verified.

### rev-30 · 2026-10-16T08:16:55.786Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261016-583-final
commit: 0290b8b8b0f7db63df8c7bccc2ffa92debd395a9
scope: evidence

# T-583 final evidence clear under explicit manifest-only gate disposition

Current pushed reviewed head `0290b8b8b0f7db63df8c7bccc2ffa92debd395a9`; branch `t/T-583-after-an-accepted-delete-release-gives`. Source correction A-3841 at3c9e5b86 and manifest delta **A-3857 /rev-20261016-583-duration-delta** establish unchanged production/test bytes and only the exact shared5b29038c patch plus two measured owned allowances. Hold/current criteria/claim already checked for this pass; no reread or Reviewer execution.

## Standards

No high/medium/low findings. C2 strict identity/no-accepted-delete safety remains source verified at this head. Reasoned duration entries do not change the assertions, lifecycle bounds, five-minute production bound or provider behavior. No dev merge or additional pick.

## Spec / owned runtime

Refresh **all C1–C3**. Independently audited actual Linux A-3853 /565255b1 at3c9e5b86:1931tests/1926pass/0fail/5skip, completed hub phases, exit1 solely two owned budget misses. All12 demo-release cases pass ordinary and5/5 each (60/60), including all five owned additions (25/25). The accepted active deletion remains pending without attention beyond the former2s cap then confirms404; expired stripped/retained tags produce honest timeout attention/status/alert; wrong id/name refuse even with acceptedDELETE, while no acceptedDELETE preserves prior tag safety.

Ordinary owned timings: later4047.012069511s, expired stripped-tags4.452541937s, expired retained-tags5.689618495s, id refusal4.494850566s, name refusal3.543792185s. Only first and retained-tags exceeded the generic5s allowance; both exact measured reasoned entries are in the reviewed manifest. No functional or load assertion failed. Default300000ms absolute accepted-delete bound is source proven; fake-provider tests shorten it for expiry proof. Bound evaluated on cleanup observations, not a new polling-frequency guarantee. No live provider operation performed by Reviewer.

## Gate disposition

**Primary Coordinator b553b5e3-22e9-40c1-b242-733f9487496a** directly confirms shared5b29038c is authorized and explicitly accepts A-3853 as the gate receipt across the manifest-only head0290b8b8, **with no new droplet run**. This supersedes A-3857's immediately preceding pending-fresh-run statement. Old exit1 remains disclosed; it is not relabeled as a newly executed exit0.

Linux c-8 lon1/x64,four workers,Node24.21.0/Neovim pin0.12.5;1500.15s,peak16.54,extra16.42s,lifetime/costunknown. Selected Neovim smoke was not reached after budget failure; no smoke success is claimed. Explicit Coordinator acceptance governs this final gate. Real E-423 D18/provider rerun remains Coordinator/QA-owned after merge/restart, separate from fake-provider proof. Current E-468 merge freeze/order remains unchanged.

Final evidence **clear**, C1/C2/C3 refreshed. No further task run required; changed head requires delta review. No per-item QA. Findings: Standards0; Spec0.

Artifact A-3860 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3860-t-583-final-clear-budget-only-linux-receipt-accepted-across-manifest-delta.md

Criteria: C1 verified, C2 verified, C3 verified.

### rev-30 · 2026-10-16T08:18:50.780Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261016-583-merge-final
commit: 277e425977fc5e446e57b29e9ce96cfaebf0712a
scope: delta

# T-583 merge-only delta final clear

Reviewed pushed head `277e425977fc5e446e57b29e9ce96cfaebf0712a`, branch `t/T-583-after-an-accepted-delete-release-gives`; both local/origin refs agree. Exact parents: final-reviewed0290b8b8b0f7db63df8c7bccc2ffa92debd395a9 and freshly fetched dev4ffbe84faef3d6d88a3cf8cc574de8e09dbb1360. Hold/current claimant/criteria checked once. Previous final A-3860 /rev-20261016-583-final.

**Primary Coordinator7c00e4e9-8593-4d73-9197-5e026375c9b8**, independently read in topic history, requires this actual duration-manifest conflict merge, exact allowance union, parse/shard checks, pushed delta review and explicitly **no new run**.

## Standards

Zero high/medium/low findings. All five owned production/test files (cleanup.ts,droplet.ts,lease.ts,hub/demos.ts,demo-release.test.ts) are byte-identical to prior final head. Inherited dev source/docs/tracker changes introduce no additional task resolution. Read first-parent stats and resulting dev-parent task delta; only merge resolution is the additive duration union.

Independently parsed both committed parent manifests and result:
- each parent270 allow entries;
- no common allowance has differing values;
- resolved272 entries exactly equals both-parent union;
- every other root schema/source/budget/files/tests field equals dev;
- both own measured entries and every shared allowance retain exact values/reasons.
Whitespace diff check passes. **A-3863** durable log explicitly records JSON parse success and shard lint output (hub free6 files/1worker, machine195 files/4workers). Reviewer only reads/parses; no test/compiler/edit/provider execution.

## Spec / evidence disposition

Refresh **all C1–C3** at277e4259. Source correction A-3841 and prior final A-3860 establish accepted-delete absolute bound, identity safety, truthful timeout attention and fake-provider lifecycle proof. Production/test assertions unchanged; no behavior weakened during merge.

Previously accepted actual Linux **A-3853 /565255b1** remains historical evidence:1926pass/0fail/5skip,all five owned ordinary cases plus25/25 fresh repetitions (all12 demo-release cases60/60), exit1 solely measured owned budgets subsequently allowed. It is carried across this merge by explicit Coordinator7c00e4e9 no-new-run disposition and earlier primaryb553b5e3 acceptance; no new Linux run or exit0 is invented.

No Neovim smoke success is claimed from A-3853. Real E-423 D18 partial rerun after merge/restart remains Coordinator/QA-owned and distinct from this fake-provider test proof. Current merge/demo ordering remains with Coordinator; this review does not independently restart anything.

Final merge delta **clear**, C1/C2/C3 refreshed, no further task run required under the explicit decision. No per-item QA. Findings: Standards0; Spec0.

Artifact A-3864 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3864-t-583-merge-delta-final-clear-exact-allowance-union-implementation-unchanged.md

Criteria: C1 verified, C2 verified, C3 verified.

### coord · 2026-10-16T08:19:08.029Z

Merged b3cf4d4575d52437bf804213c602eb2dfcbbe7dd onto dev.

### human · 2026-10-16T10:14:50.887Z

Operator check by cland-impl (late, 10:12Z): droplet 609612979 (cland-v0-69940187, demo lease 69940187, delete started by qa-27's demo stop at 07:33:37Z) returns 404 at DigitalOcean; nothing destroyed by hand. Same teardown window as T-572's three cases; the fix (b3cf4d45) is live in the hub since the 10:13Z restart (pid 29477).
