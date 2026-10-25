---
id: T-1154
kind: task
title: Droplet reservation waits ignore shutdown and can hold hub.stop for up to 60 s
state: open
status: ready
size: S
criterion_seq: 3
labels:
  - needs-triage
  - bug
assignee: null
parent: E-1284
blocked_by: []
topic: topic-1066
branch: t/T-1154-droplet-reservation-waits-ignore
created: 2026-10-22T19:53:59.804Z
updated: 2026-10-25T19:54:11.064Z
---

## Summary

Found by T-1151's reviewer, outside that item's held-create boundary. `DropletExecutor.#reserve` (hub/src/executor/droplet/droplet.ts around line 66) awaits `acquireLockWithRetry` before it checks for shutdown, and lock.ts allows a 60 s wait; `reserveSpend` has a similar wait. A hub stop that arrives while a run waits on the reservation lock can therefore still be held past the bounded shutdown T-1151 adds. This predates T-1151.

## What to build

Reservation and spend-ledger waits become cancellation-aware. On stop they stop waiting. A lock acquired after the stop began is released safely and never detached while still owned. No reservation is left counted against the daily cap or remote budget.

## Acceptance criteria

- [x] C1. A hub stop while a run waits on the reservation lock or the spend ledger exits within 3 s, and a lock acquired late is released and not left owned (test).
  - done: impl-1154 · 2026-10-25T19:33:45.495Z
  - verified: rev-31 [reviewer] · run rev-20261025-1154-final · 2026-10-25T19:54:10.917Z · commit 73ef11d299d2369601b8f1e5462e9767c156c695
- [x] C2. No spend reservation or remote slot stays counted after such a stop, as shown by the next hub's executor status (test).
  - done: impl-1154 · 2026-10-25T19:26:35.944Z
  - verified: rev-31 [reviewer] · run rev-20261025-1154-final · 2026-10-25T19:54:10.917Z · commit 73ef11d299d2369601b8f1e5462e9767c156c695
- [x] C3. Sharded close-run planning (reserveShardSpend and releaseShardSpend) honours the same shutdown cancellation: a hub stop during either wait exits within 3 s, and a shard reservation released late is still released durably, never left counted (test).
  - done: impl-1154 · 2026-10-25T19:26:36.021Z
  - verified: rev-31 [reviewer] · run rev-20261025-1154-final · 2026-10-25T19:54:10.917Z · commit 73ef11d299d2369601b8f1e5462e9767c156c695

## Comments

### impl-1154 · 2026-10-25T19:16:18.854Z

Inspected inherited worktree: clean. A-11669 confirms droplet.ts #reserve and spend.ts locked still wait without shutdown cancellation. Planned tests use existing T2 scratch-files/public lock and projectHub fake-provider seams (no new process): held budget and primary/legacy ledger waits, late lock ownership, restart executor.status zero spend/slots. Consumer inventory before optional cancellation extension: acquireLockWithRetry production callers are DropletExecutor.#reserve and spend.locked (load, retireLegacySpend, reserveSpend, settleSpend, rememberProject, sweepProjects, reserveShardSpend, releaseShardSpend); direct tests executor-admission-lock.test.ts and territory-lock.test.ts. reserveSpend callers: DropletExecutor.#acquire, executor-spend.test.ts, T3 executor-safety.test.ts child script. Existing callers retain no-signal semantics; no wire/list/schema/refusal-class or persisted record change planned. Continuing full inventory of acquireLockAsync if cancellation must reach its guard.

### impl-1154 · 2026-10-25T19:16:55.507Z

Completed acquireLockAsync consumer search (whole repo, production/tests/docs): production territory.withTerritoryLockAsync, suite-lock stale/reaper and acquisition guards, spend.locked legacy migration, acquireLockWithRetry. Tests orphan-sweep-lock, territory-lock, executor-admission-lock, executor-spend and executor-lock-liveness. Documentation hub/README.md describes existing fail-fast territory contract; QA/skills/startup probes/persisted readers have no direct helper call. Optional AbortSignal is additive; omitted signal preserves every existing caller, lock format and error semantics. No wire-shape change; previous call-shape regressions remain in existing territory-lock/admission tests.

### impl-1154 · 2026-10-25T19:21:56.592Z

C3 inventory before optional shard timing extension: reserveShardSpend callers are DropletExecutor.reserveShards plus executor-spend.test.ts and executor-lock-liveness.test.ts; releaseShardSpend callers are DropletExecutor.#finishShardRelease and executor-spend.test.ts. Suites.#planShards (reserve + failure release), #inspectJob (parent release) and suite-cover.test.ts semantic mocks consume those executor methods. Existing persisted shard-releases/*.json reader is #retryShardReleases via reconcile; unchanged JSON array shape, id/hash and retry behavior. Startup/sweep probes consume reconcile completion only; no direct shard ledger helper in shipped skills, QA briefs, nvim, web or T3/T4 tests. Plan: optional cancellation/wait controls preserve existing call shapes; deferred release retains existing intent format until a later hub settles it.

### rev-31 · 2026-10-25T19:28:48.438Z

verdict: review
result: not clear
by: rev-31 [reviewer]
run: rev-20261025-1154-source1
commit: 2f2817ef8135606f442ead6c64352e78d0ee3d20
scope: full
findings: [{"severity":"medium","text":"M1: HUB_USAGE changed hub-stop wording but frozen fixtures/cli-usage/commands.json retains old HUB_USAGE. Existing cli-usage-compatibility export equality and real top-level/hub CLI help byte guards fail. Update only intended frozen HUB_USAGE block, preserve composition/template/order/assertions, and reproduce existing guards red/green.","file":"hub/src/cli/usage.ts","line":25}]
finding_counts: {"high":0,"medium":1,"low":0}

Full source NOT CLEAR; A-12116 complete Standards1medium/Spec0-separate audit at tree5b0ab389d673cc8e06f9c8aa847ffe8b03fabc6d. Cancellation/retry/late-owned-token drainage and per-lease/spend/shard signal propagation source-sound; existing shard-release intent retained on closing and retried before next reconcile completion, no suites.ts/wire/record change. Tests retain holder bytes, positive wait/intent/lease receipts, unscaled3s projectHub stop bound and next-hub zero status; component proof not native daemon/provider latency. C3 authorized extension covered; legacy no-signal call shape retained. Fix M1 frozen HUB_USAGE only, existing compatibility+CLI-help red/green, pushed successor/fresh source before configured mode-free verify. Preserve original outputs/native timings/source/capture limits; no transcription reruns, dev merge, relaxed guards or runtime expansion. Local A-12115 summary9/9+11/11/typecheck not configured/Linux. C1–C3 runtime pending; restore affected claimant mark after correction. Reviewer read-only.

Criteria: C1 failed (Candidate changes hub-stop help without migrating frozen HUB_USAGE compatibility bytes, so existing CLI usage/help guards fail.).

### rev-31 · 2026-10-25T19:30:56.605Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261025-1154-source2
commit: a008ede0a9f13aa1323a1fa673619a8aeaeb8f1d
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Corrected full source CLEAR, Standards0/Spec0; A-12119 carries complete A-12116 audit at treec3fa1b1c50be2ea9c17ca62775329068f66ce029. Sole frozen HUB_USAGE line correction, decoded production/fixture bytes independently equal; all other command blocks/key order/composition/template/guards/runtime/assertions unchanged, no dev merge. M1 resolved. A-12117 original local Darwinarm64 correction captures: compatibility red0/1exit1→green1/1exit0; selected top-level/hub help red0/2exit1→full help green4/4exit0; native file/command timings/source/capture limits explicit. Additive cancellation/joined late ownership/restart spend+slot recovery/durable shard handoff remains source-sound. C1–C3 done; runtime verification pending. Submit one ordinary configured mode-free verify at unchangedea008ede0 (exact commit above), then final named-outcome/load/phase/provenance review. No transcription reruns, forcedall/dev merge/runtime expansion. QA none. Reviewer read-only.

### rev-31 · 2026-10-25T19:32:28.296Z

verdict: review
result: not clear
by: rev-31 [reviewer]
run: rev-20261025-1154-source2-admission
commit: a008ede0a9f13aa1323a1fa673619a8aeaeb8f1d
scope: full
findings: [{"severity":"medium","text":"M2: added process-cleanup.ts onCleanup import is resource-level2 in existing test-lint.ts classifier, so unchanged T1 file is refused by verify-tiers. Keep honest scratch-files/fake-process tests T1 via test-owned cleanup hook per Coordinator64bac1f0, preserving abort/unblock/release/drain before directory removal; do not promote whole file or weaken guard.","file":"hub/test/executor-lock-liveness.test.ts","line":14}]
finding_counts: {"high":0,"medium":1,"low":0}

Pre-admission follow-up NOT CLEAR; A-12121 carries A-12116/A-12119. Exact refusal verify-tiers:T1 test touches machine resources:executor-lock-liveness.test.ts; no runtime run/pass. Independent classifier read confirms process-cleanup import resourcelevel2→touchesMachineResources, missed in earlier source audit. Coordinator64bac1f0 authorizes narrow test-owned cleanup/dropimport preserving T1 and assertions; no override/reclassification/unchanged retry. Preserve registration/drain before roots removed; targeted tier/file validation then pushed successor/fresh source before new mode-free run. C1–C3 runtime missing; no new Spec defect. Reviewer read-only.

Criteria: C1 failed (Required verify refused before execution because new process-cleanup import makes existing T1 liveness file fail tier admission.).

### rev-31 · 2026-10-25T19:34:42.095Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261025-1154-source3
commit: 7f5ba52c7dd7c40a412439bb43db380a56ab55af
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Corrected full source3 CLEAR, Standards0/Spec0. A-12123 carries complete A-12116/A-12119/A-12121 audit at treebbe266f79a6c92d6acc731a43aa50b418d2571ef. M2 resolved under Coordinator64bac1f0: direct process-cleanup import removed, early test-owned t.after before scratchMachine retains abort/unblock/lockrelease/acquisitiondrain/faultrestore before directories. All9 T1 identities/assertions retained, no classifier/tier/production/dev-merge change. M1 help remains fixed. A-12122 original local corrected-source9/9 pass/file526.141292ms plus actual lint-tiers0(150free/390machine) accepted as targeted/static, not suite. Prior refused input no runtime receipt. C1–C3 done/runtime pending; submit one ordinary configured mode-free verify at unchanged7f5ba52c, then final exact-case/load/phase/provenance review. No additional local repeats/transcription reruns/forcedall/dev merge/guard weakening. QA none. Reviewer read-only.

### rev-31 · 2026-10-25T19:40:34.631Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261025-1154-source4
commit: 73ef11d299d2369601b8f1e5462e9767c156c695
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Corrected full source4 CLEAR, Standards0/Spec0; A-12127 carries full A-12116/A-12119/A-12123 and failed priorhead evidence A-12125 at tree1e40ed2653ee742f17eb6d479d312951df0aad86. Sole clause-line correction resolves M3: exact guarded startDaemon phrase restored, reservation-stop projectHub guidance/link retained. No runtime/assertion/manifest/classifier/devmerge change. Existing wording+byte-reserve guard unchanged; A-12126 original local corrected-source39/39/nativefile128.147541ms real.15s accepted with invocation/source limits. Prior7f5 run015acfff/A-12124 remains red:994ordinarypass/1fail plus15T1loadpasses; T2/Web/T3/T4 absent, not green. C1–C3 done/runtime pending. Submit one ordinary configured mode-free verify at unchanged73ef11d2; final needs7new named cases/load outcomes and phase/provenance limits. No transcription repeats, forcedall/devmerge/runtime expansion/guard relaxation. Reviewer read-only.

### rev-31 · 2026-10-25T19:54:10.917Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261025-1154-final
commit: 73ef11d299d2369601b8f1e5462e9767c156c695
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final evidence CLEAR; C1–C3 verified. A-12135 carries full source chain/A-12127 and independent raw A-12132 audit. Exact-head mode-free269ad3fc exit0:3266ordinarypass plus35additional loadpasses(7newidentities×5), nofail/cancel/skip/TODO. Named injected/clock/late-lock and shardreserve/shardrelease/spend/budget-stop cases all ordinary+5/5, worstnew1.091583917s; independent unscaled3s component stop bound and next-hub durable lease/status recovery assertions retained. Durable shard intent keeps uncertain reservations counted until next-hub settlement; no native daemon/provider latency claim. Frozenhelp/top-level+hubCLI/rolewording+bytereserve pass at currenthead. HostT0/allT1/fallbackallhub+NeovimT2/Web complete; T3/T4 absent/deferred, no all/stageQA claim. Linuxc8lon1 Node24.21/Nvim0.12.5/HeadlessShell156v1248 forWeb, life678s/$0.0471 distinctfromwall. HostgateTREEa7f97d79 reused. Report-onlylint133/60/sixbudgetwarnings/Web144.56>40s/ratchet2232.554same retained; no enforcement pass. Prior pre-admission refusal and red015acfff remain historical; original local capture/source limits explicit. No additional task rerun needed. QA none; Coordinator owns enqueue/separate pre-merge checks. Reviewer read-only.

Criteria: C1 verified, C2 verified, C3 verified.
