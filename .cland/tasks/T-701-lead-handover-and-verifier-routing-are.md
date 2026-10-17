---
id: T-701
kind: task
title: Lead, handover and verifier routing are asserted on the hub's recorded messages in T2, with one process proof per family
state: open
status: review
size: M
criterion_seq: 5
labels:
  - v0.1.4
  - verification
  - hub
  - tests
assignee: null
parent: E-677
blocked_by:
  - T-686
  - T-687
topic: topic-421
branch: t/T-701-lead-handover-and-verifier-routing-are
created: 2026-10-16T19:59:36.941Z
updated: 2026-10-17T08:16:35.377Z
---

## Summary

Routing to a Lead or a verifier is a hub rule, but these files launch two to five fake Claude Leads and read `fake.log` to prove where a message went (memo §2.2 wins 9–10; report-slice2 #2 and anti-pattern B, report-slice4 #4, report-slice1 #4):

| File | Seconds | Note |
|---|---:|---|
| `lead-permissions.test.ts` | 57.5 | |
| `lead-handover.test.ts` | 51.9 | |
| `lead-routing.test.ts` | 26.4 | |
| `verifier-routing.test.ts` | 40.5 | "three live Reviewers receive one request" alone is 12.9 s |
| `lead-launch.test.ts` | 27.9 | |
| `handover.test.ts` | 18.4 | |
| `item-lead.test.ts` | 22.1 | |

## What to build

- **Routing on the record.** Delivery is asserted on the hub's recorded message (`to`, `stage`, `topic.history`), not on the harness's log. Lead sessions are T-686 fake-adapter sessions, and observers are T-687 in-process spokes or `dispatcherUi`.
- **Subtree authority.** The recheck after each await (launch, stop, `task.link` reparenting during merge preparation and landing) runs as a component fixture in the shape of `roles-session-refresh.test.ts`, with a gated roles read and fake git.
- **Verifier routing.** Pool affinity, fallback and verdict-header parsing become a T1 resolver test over presence and holds.
- **One process proof per family stays T3**, with a header:
  - `long idle and death climb …` (SIGKILL of a real pid);
  - `Lead launches and stops only sessions serving its live subtree`;
  - `Codex relaunch injects an early accepted clause`;
  - the mid-turn revocation in `handover.test.ts`.
- **Restarts.** Hub restarts that only reopen state use `projectHub` stop and serve.

## Acceptance criteria

- [ ] C1. The seven files' manifest seconds fall from 244.7 s (A-3877) to 115 s or less.
  - verified: rev-30 [reviewer] · run rev-20261017-701-cleanup-correction · 2026-10-17T06:51:23.978Z · commit 14f2d8e4ec7b6640767f0f6a0627da24bbea2c95
  - verified: rev-30 [reviewer] · run rev-20261017-701-allowance-merge · 2026-10-17T07:35:13.415Z · commit 4cafa46bf0f96e88ff1f1de0c1499f6c992293fa
  - verified: rev-30 [reviewer] · run rev-20261017-701-final · 2026-10-17T08:16:35.377Z · commit 4cafa46bf0f96e88ff1f1de0c1499f6c992293fa
- [ ] C2. Their fake-binary call sites fall from 18 to 5 or less, `spawnSpoke` sites from 57 to 10 or less, and `startDaemon` sites from 23 to 4 or less.
  - verified: rev-30 [reviewer] · run rev-20261017-701-cleanup-correction · 2026-10-17T06:51:23.978Z · commit 14f2d8e4ec7b6640767f0f6a0627da24bbea2c95
  - verified: rev-30 [reviewer] · run rev-20261017-701-allowance-merge · 2026-10-17T07:35:13.415Z · commit 4cafa46bf0f96e88ff1f1de0c1499f6c992293fa
  - verified: rev-30 [reviewer] · run rev-20261017-701-final · 2026-10-17T08:16:35.377Z · commit 4cafa46bf0f96e88ff1f1de0c1499f6c992293fa
- [ ] C3. Routing assertions read the hub's recorded messages, and no test outside the kept T3 proofs reads a fake harness log, proved by a source check.
  - verified: rev-30 [reviewer] · run rev-20261017-701-cleanup-correction · 2026-10-17T06:51:23.978Z · commit 14f2d8e4ec7b6640767f0f6a0627da24bbea2c95
  - verified: rev-30 [reviewer] · run rev-20261017-701-allowance-merge · 2026-10-17T07:35:13.415Z · commit 4cafa46bf0f96e88ff1f1de0c1499f6c992293fa
  - verified: rev-30 [reviewer] · run rev-20261017-701-final · 2026-10-17T08:16:35.377Z · commit 4cafa46bf0f96e88ff1f1de0c1499f6c992293fa
- [ ] C4. An audit maps every moved or rewritten assertion to its new place, with no behaviour claim dropped.
  - verified: rev-30 [reviewer] · run rev-20261017-701-cleanup-correction · 2026-10-17T06:51:23.978Z · commit 14f2d8e4ec7b6640767f0f6a0627da24bbea2c95
  - verified: rev-30 [reviewer] · run rev-20261017-701-allowance-merge · 2026-10-17T07:35:13.415Z · commit 4cafa46bf0f96e88ff1f1de0c1499f6c992293fa
  - verified: rev-30 [reviewer] · run rev-20261017-701-final · 2026-10-17T08:16:35.377Z · commit 4cafa46bf0f96e88ff1f1de0c1499f6c992293fa
- [ ] C5. Each touched file passes 5/5 serially as a whole file on the Mac and once in the task's droplet verify.
  - verified: rev-30 [reviewer] · run rev-20261017-701-final · 2026-10-17T08:16:35.377Z · commit 4cafa46bf0f96e88ff1f1de0c1499f6c992293fa

## Blocked by

T-686 (in-process fake adapter), T-687 (in-process spoke).

## Comments

### impl-701 · 2026-10-17T06:44:23.457Z

Implementation pushed at 7fe8accba31455d97cab74b808213f13c50f8a80. Source assertion audit A-4325; Mac whole-file 5/5 receipts A-4324 (13 files, 65 passes; admitted load <15). Companion-inclusive timing 244.707s → 43.654s. Census: fake binaries 18→5, spawnSpoke 57→7, startDaemon 23→2 (31→2 dynamic boots). Seven originals tagged T2, verifier resolver T1, five retained lifecycle companions T3. No fake.log reads outside T3. Duration file baselines updated from measured medians; test identity baseline unchanged for task load gates. Twelve obsolete legacy allowances removed; remaining merge allowance shrunk 15.323→6.4s; extracted over-5s lifecycle keys have T-701-owned allowances expiring 2026-10-24. npm run typecheck and npm run test:tiers pass. Source review requested next; same-head droplet verify follows a clear source verdict.

### rev-30 · 2026-10-17T06:46:59.535Z

verdict: review
result: not clear
by: rev-30 [reviewer]
run: rev-20261017-701-source
commit: 7fe8accba31455d97cab74b808213f13c50f8a80
scope: full
findings: [{"severity":"medium","text":"M1: All three new lifecycle allowances use owner T-701. durationOwners reads the live authoritative tracker, and lintDurationManifest rejects closed owners. Closing T-701 on merge therefore invalidates these still-present allowances immediately, before their seven-day expiry, blocking later suite admission/lint. Assign an appropriate owner that remains open for the allowance lifetime (or retire the entries atomically); retain measured bounds and dates.","file":"hub/test/durations.json","line":5003},{"severity":"medium","text":"M2: barrier(t) releases only in native t.after, after the tempProject ownership cleanup registered earlier; it also never drains the launched/merging operation. If an assertion between entered and release fails, held spawn/Git/roles/stop continuations can resume after projectHub shutdown/store closure/root removal, or prevent teardown from completing. Release and settle/cancel each pending operation in an earlier bounded ownership cleanup phase before closing peers/hub/directories, and cover a pre-release failure path.","file":"hub/test/lead-permissions.test.ts","line":26}]
finding_counts: {"high":0,"medium":2,"low":0}

Full source review T-701 at 7fe8accba31455d97cab74b808213f13c50f8a80, fixed point caf9fc07. Read-only review; no Reviewer execution. The source tested at 00ffe1d1 is unchanged in the submitted head; intervening differences are tracker metadata and the duration manifest.

## Standards
Medium M2 — hub/test/lead-permissions.test.ts:26: the new generic barrier helper registers only late native t.after(release). tempProject registered its ownership cleanup first, which closes registered peers/hub and removes roots before that later hook. Gates hold real production adapter preparation/launch, Git callback results, roles reads and deferred stops. A failure in the asserted state between gate entry and release leaves operations live; releasing after cleanup can run them against closed stores/deleted worktrees, and release alone does not observe completion. Use an earlier bounded resource cleanup that releases/cancels and drains pending work before hub/directory teardown, retaining all concurrency and reauthorization assertions. Prove at least a controlled pre-release failure rather than relying on the successful path.

## Spec
Medium M1 — hub/test/durations.json:5003 (also :5010/:5017): three new allowances name owner T-701. The existing durationOwners() reads live root tracker state, and lintDurationManifest() rejects closed owners. The normal merge closes T-701, so these remaining entries invalidate verification immediately despite their 2026-10-24 expiry. Use the appropriate open parent/follow-up owner or an atomic retirement plan; no change to the lint's open-owner protection is requested.

Positive review evidence: the component routing replacements assert recorded recipients/stages and real in-process spoke frames. Pool affinity/fallback/copied verdict parsing use the production resolver and tracker at T1; the five headed T3 companions retain native lifecycle families and committed-handover crash recovery. The production-adapter preparation table retains post-await authorization calls with memory-only native edges. Native PID substitution checks remain in the retained relaunch process case.

Independent census over all originals plus companions agrees with the audit: fakeClaude/fakeCodex 18 -> 5, spawnSpoke 57 -> 7, startDaemon 23 -> 2. Manifest sums count all companions: 244.707154 -> 43.653542 s. Test timing identity baseline is byte-unchanged, so newly named cases still load-gate. No production source is changed. Audit A-4325 maps the original declarations and assertion families; A-4324 supplies 13 files x5 successful Mac whole-file receipts on unchanged test code. These successes remain valid positive evidence, but do not prove held-operation failure cleanup or post-merge owner validity.

Verdict not clear. C5 fails readiness for source corrections; existing Mac successes are not claimed to have failed. C1-C4 remain unverified pending corrected review and complete evidence. Fix M1/M2, refresh affected proof/audit as needed and request new-head source review before any task verification. QA policy none/after-stage.

Criteria: C5 failed (M1/M2: New allowances become invalid on task closure, and held-operation failure cleanup is not safe; source corrections and new-head evidence required.).

### rev-30 · 2026-10-17T06:51:23.978Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261017-701-cleanup-correction
commit: 14f2d8e4ec7b6640767f0f6a0627da24bbea2c95
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Corrected source review T-701 at 14f2d8e4ec7b6640767f0f6a0627da24bbea2c95, delta from 7fe8accba31455d97cab74b808213f13c50f8a80 (full review A-4328). Two files only, no dev merge; origin matches. Read-only review.

## Standards
M2 resolved. heldOperations registers onCleanup before any fixture setup in all four gated tests. It releases every registered gate and observes tracked launch, merge preparation/landing/recovery, production native-adapter preparation, roles-read launch and deferred-stop promises before peers/hub/directories close. A 30 s failure bound prevents an unreported infinite teardown wait; no literal synchronization sleep is added. Original pre-release concurrency and post-release authority assertions remain.

The new controlled-failure regression executes the real registered ownership callback after a pre-release assertion failure, observes the launch complete with root still present and peer/hub usable, then checks root removal. All five refreshed raw TAP files show the six cases passing, including that probe.

## Spec
M1 resolved. All three extracted lifecycle allowances now use open E-677 with unchanged 2026-10-17/24 dates and measured limits, exactly as primary Coordinator 9cb2d89d directs. The existing merge-case legacy allowance is 7.7 s against measured max 7.134558 s, still below its original 15.323038 s.

C1 verified: independent manifest sum over all thirteen originals/companions is 43.486571 s versus 244.707154 s, including the new failure probe. The thirteen-file comparison prevents merely moving cost outside the original seven paths.
C2 verified: source census remains fake binaries 18 -> 5, spawnSpoke 57 -> 7, startDaemon 23 -> 2; correction adds no native process sites.
C3 verified: routing/affinity/fallback assertions read production hub/core records and in-process spoke frames; fake.log reads remain in headed T3 native lifecycle companions.
C4 verified: revised audit A-4332 maps moved original declarations, both parameter variants, native PID/rollback and direct frame/record substitutions, plus the held-operation cleanup strengthening. Assertions retained across this correction. Original test timing identity baseline is byte-identical, so task load gates are preserved.

C5 partial: unchanged twelve files retain 5/5 Mac receipts from A-4324; affected permissions file is refreshed 5/5 in A-4331 on source 3d1de868, whose test source is identical to submitted head (only timing metadata follows). A-4324 also preserves a separately named failed diagnostic probe; that is not counted among the 65 passing evidence receipts. No task droplet receipt yet. Claimant reports current typecheck/tier lint/diff checks green.

Source clear; verify C1-C4. C5 remains unverified pending normal mode-free same-head droplet verification. No remaining findings.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified.

### rev-30 · 2026-10-17T07:33:15.292Z

verdict: review
result: not clear
by: rev-30 [reviewer]
run: rev-20261017-701-first-gate
commit: 14f2d8e4ec7b6640767f0f6a0627da24bbea2c95
scope: evidence
findings: [{"severity":"medium","text":"M3: The new native routing/death identity in lead-routing-process.test.ts takes 7.387010927 s in A-4357 and has no allowance, causing the sole hard five-second budget failure despite ordinary and 5/5 repetition passes. Add a measured, lifecycle-reasoned allowance with open owner and UTC dates or reduce cost without weakening proof, then obtain new-head source review before verification.","file":"hub/test/durations.json"}]
finding_counts: {"high":0,"medium":1,"low":0}

Evidence review T-701 at unchanged source-cleared 14f2d8e4ec7b6640767f0f6a0627da24bbea2c95, A-4333 / rev-20261017-701-cleanup-correction. Origin branch and hub record match. Mode-free droplet 83b8bc38-4d20-4cae-b7d1-ccbb5e860f7c / A-4357 exits one. Read-only audit, no Reviewer execution.

## Standards
Medium M3 — hub/test/durations.json: the newly introduced T3 identity hub/test/lead-routing-process.test.ts::long idle and death climb from item to epic to release; stopped Leads leave inherited routing has no allowance and takes 7.387010927 s, exceeding the existing hard five-second new-test budget. The durable log contains exactly this one hard duration-budget line (6941). The T3 tier-ten-second notices are separately report-only and do not waive this gate. Add a measured, reasoned allowance with an open owner and required UTC dates, or reduce the demonstrated cost while preserving the native death/routing assertions. Primary E-677 migration allowance disposition can supply an open parent owner; do not restore a task-owned allowance that becomes invalid on closure. A head change requires source review before verification.

## Spec
No functional or load-repetition finding. All thirteen touched test files execute successfully in Linux, including seven migrated routing files, five native lifecycle companions and the resolver file. All thirteen task-added load identities pass 5/5 (65/65), including the controlled pre-release failure cleanup case and this native death case. Its ordinary assertion passes; the failure is its duration budget, not a routing assertion or missing repeat. M1/M2 ownership/allowance corrections remain resolved and C1-C4 source verification remains current. Mac evidence A-4331/A-4332 remains applicable to unchanged source, but cannot make an exit-one task gate final clear.

Totals: 2079 tests, 2074 pass, zero functional failures/cancellations, five skips; free 54/54, machine 2020 pass/5 skip. The hub stops before Neovim smoke. Linux x64 c-8 lon1, two workers, suite wall 2378.77 s, peak one-minute load 10.56, lifetime 2447 s, cost $0.1699. Host typecheck completes with candidate-tree receipt 912580597026595476dabb97a0af080d0c0683ab reused remotely.

Final evidence not clear due M3. C5 remains failed/pending a qualifying corrected-head task gate; preserve this receipt as positive functional evidence and the exact allowance measurement, not a green run. Correct and request fresh source review before another verification.

Criteria: C5 failed (M3: Exact-head Linux exits one solely for the new lead-routing-process death case at 7.387 s exceeding its unallowed 5 s hard budget; Neovim smoke is not reached.).

### rev-30 · 2026-10-17T07:35:13.415Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261017-701-allowance-merge
commit: 4cafa46bf0f96e88ff1f1de0c1499f6c992293fa
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Delta source review T-701 at 4cafa46bf0f96e88ff1f1de0c1499f6c992293fa, following failed A-4357 / evidence verdict A-4358. Scope is the reasoned lead-routing allowance plus primary Coordinator ae616032-authorized merge of dev a1f26b988a982817d10471a5843ec71da3799b82. Origin matches; pre-merge authored commit d83c023a changes durations.json only. Read-only review; no Reviewer execution.

## Standards
M3 resolved in source. New allowance is 8.5 s for the exact extracted long-idle/death identity measured at 7.387010927 s in A-4357. Its reason identifies three native harness sessions, SIGKILL death observation, confirmed stops and inherited hierarchy routing. Owner is open parent E-677, added UTC 2026-10-17 and expires 2026-10-24, matching primary Coordinator 44457c1e and the stage migration allowance policy. No global budget, test timeout or identity baseline is changed by this correction. The old source's missing allowance is not recast as a shared flake.

The duration conflict resolution independently equals the structured three-way union: incoming dev content plus all prior T-701 additions/removals, and only this newly authorized allowance. All source/budget/file/test timing fields match that expected union. Every Claude Code allowance/file/test entry equals incoming dev exactly. tiers.json is also the expected union, retaining T-701 and T-691 entries. No unexplained resolution edits found.

## Spec
No findings. All thirteen T-701 test files are byte-identical to reviewed 14f2d8e4, so the source assertion audit, held-work failure cleanup correction and Mac receipts retain scope. Their combined manifest seconds remain independently 43.486571 (including the extracted native companions), below 115. C1-C4 source evidence is refreshed at this merged head. Imported T-691 composition/environment/native-session tests and docs equal incoming dev byte-for-byte and retain that task's accepted review; no production changes were imported or authored here. Claimant reports merged-head typecheck, tier lint and whitespace checks green.

A-4357 remains failed historical gate evidence despite all thirteen files and 65/65 owned load repetitions being functionally green. Source correction clear with no remaining findings. C5 remains unverified pending the fresh normal mode-free exact-head droplet receipt, including the Neovim smoke not reached in A-4357. Verification may proceed at this head.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified.

### rev-30 · 2026-10-17T08:16:35.377Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261017-701-final
commit: 4cafa46bf0f96e88ff1f1de0c1499f6c992293fa
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final evidence review T-701 at 4cafa46bf0f96e88ff1f1de0c1499f6c992293fa, unchanged from A-4360 / rev-20261017-701-allowance-merge. Origin and hub verification record match. Mode-free droplet b700f058-09aa-48e2-884c-3407f620ecbf / A-4394 exits zero, hub-only plus completed Neovim smoke. Read-only receipt audit; no Reviewer execution.

## Standards
No remaining findings. Prior M1/M2 source corrections and M3's measured E-677/seven-day allowance remain current. The previously over-budget native routing/death case passes ordinary in 7.274584007 s and 5/5; its 8.5 s reasoned allowance covers the measured lifecycle work without changing its assertion or timing baseline. No hard duration-budget or failing load gate appears. Other tier/legacy duration notices are report-only.

## Spec and criteria
C5 verified. All thirteen touched test files pass in this exact-head Linux run: seven original routing files, five retained native lifecycle companions and the pure resolver file. All thirteen task-added identities pass 5/5 fresh load repetitions (65/65), including native mid-turn revocation, committed-handover crash recovery, live-subtree process permissions, SIGKILL/inherited routing, early accepted Codex clause/queued verifier release, resolver affinity/fallback, and the controlled pre-release held-work cleanup proof. That cleanup control passes ordinarily in 0.255 s, retaining live-root/resource-before-close assertions. The successful concurrency/authority/publication assertions remain those checked in source.

Mac proof remains the accepted 5/5 serial whole-file set A-4324, updated permission-file receipts A-4331, and audit A-4332. The thirteen task files were independently confirmed byte-identical through the authorized dev/allowance merge, so those receipts retain scope. The explicitly preserved development-only diagnostic red was never counted among accepted green receipts. A-4357 remains failed parent-head evidence and the M3 measurement; it is not substituted for this new green.

C1-C4 source verification stands and is refreshed with the final pass: complete migration manifest sum 43.486571 (<115), including companions; five fake-binary, seven spoke and two daemon sites, with native behavior isolated in headed T3 proofs; routing assertions use hub records outside those native contracts; declaration/assertion audit retains all behavior claims. Authorized dev allowance/tier union remains as reviewed.

Totals independently sum to 2092 tests, 2087 pass, zero failures/cancellations, five skips: free 54/54; machine 2021 pass/5 skip; Neovim smoke 12/12. Host typecheck completes with candidate-tree receipt 343f1922208b3f2a6cd64def722ef38b61b7e4b3 reused remotely. Linux x64 c-8 lon1, Node 24.21.0/Neovim 0.12.5, two workers; suite wall 2353.35 s, peak one-minute load 12.45, lifetime 2427 s, cost $0.1685.

Final review clear, all C1-C5 verified at this exact head; no remaining findings.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified.
