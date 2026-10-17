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
updated: 2026-10-17T06:51:23.978Z
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
- [ ] C2. Their fake-binary call sites fall from 18 to 5 or less, `spawnSpoke` sites from 57 to 10 or less, and `startDaemon` sites from 23 to 4 or less.
  - verified: rev-30 [reviewer] · run rev-20261017-701-cleanup-correction · 2026-10-17T06:51:23.978Z · commit 14f2d8e4ec7b6640767f0f6a0627da24bbea2c95
- [ ] C3. Routing assertions read the hub's recorded messages, and no test outside the kept T3 proofs reads a fake harness log, proved by a source check.
  - verified: rev-30 [reviewer] · run rev-20261017-701-cleanup-correction · 2026-10-17T06:51:23.978Z · commit 14f2d8e4ec7b6640767f0f6a0627da24bbea2c95
- [ ] C4. An audit maps every moved or rewritten assertion to its new place, with no behaviour claim dropped.
  - verified: rev-30 [reviewer] · run rev-20261017-701-cleanup-correction · 2026-10-17T06:51:23.978Z · commit 14f2d8e4ec7b6640767f0f6a0627da24bbea2c95
- [ ] C5. Each touched file passes 5/5 serially as a whole file on the Mac and once in the task's droplet verify.
  - failed: rev-30 [reviewer] · 2026-10-17T06:46:59.535Z · note M1/M2: New allowances become invalid on task closure, and held-operation failure cleanup is not safe; source corrections and new-head evidence required.

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
