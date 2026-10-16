---
id: T-583
kind: task
title: After an accepted delete, release gives up on a tags-only mismatch after 2 s, though DigitalOcean's teardown takes minutes
state: open
status: review
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
updated: 2026-10-16T07:46:47.892Z
---

## Summary
E-423 demo run qa-2026-10-16-27-18 at a3616968, case D18 (A-3829), on hub pid with T-572 live. `cland demo stop` at 07:33:37Z returned releasing with operator attention: droplet 609612979 still showed the same id and name, tags [] and status active. T-572's capped tags-only reread (2 s) ran out first. The earlier sightings show the pattern: DELETE accepted (deleteStarted recorded), tags stripped at once, status "active" for one to three minutes, then 404. That was 609578713 at 04:35Z, gone by 04:37Z; 609583042 at 05:00Z, gone by 05:03Z; and 609588731 at 05:55Z, gone by 05:58Z. So the provider's teardown window is minutes, not seconds.

## Acceptance criteria
- [x] C1. When the lease records an accepted DELETE, a tags-only mismatch with matching id and name leaves the lease releasing without operator attention, and the release confirms on 404, by polling or the executor sweep, within a bound of at least 5 minutes. A still-alive droplet past that bound raises attention and the alert.
  - done: impl-583 · 2026-10-16T07:44:49.348Z
- [x] C2. Without an accepted DELETE, a tags-only mismatch is still refused, and a mismatched id or name is always refused.
  - done: impl-583 · 2026-10-16T07:39:34.799Z
  - verified: rev-30 [reviewer] · run rev-20261016-583-correction · 2026-10-16T07:46:47.892Z · commit 3c9e5b867689db89c42b4410069d9453e8b5b079
- [x] C3. A fake-provider test holds the stripped-tags active state for longer than the old 2 s cap, then returns 404, and shows the lease released with no attention. A second test holds it past the bound and shows attention.
  - done: impl-583 · 2026-10-16T07:39:35.156Z

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
