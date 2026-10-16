---
id: T-686
kind: task
title: An in-process fake adapter for Claude Code, Codex and OpenCode that a projectHub test drives directly
state: closed
status: done
size: M
criterion_seq: 5
labels:
  - v0.1.4
  - verification
  - hub
assignee: null
parent: E-676
blocked_by: []
topic: topic-411
branch: t/T-686-an-in-process-fake-adapter-for-claude
created: 2026-10-16T19:59:28.448Z
updated: 2026-10-16T23:35:11.457Z
closed: 2026-10-16T23:35:11.457Z
---

## Summary

107 test files use the fake harness binaries (`hub/test/fakes/claude-code`, `codex`, `opencode`): each launch is one to three OS processes on 30–50 ms real timers, mostly to prove hub rules (routing, roles, subscriptions, tracker) or just to own a process row (memo §2.3 anti-patterns 7–8, §3.8; report-strategy §2.8). Decision 5 keeps the binaries for one contract file per harness plus the T3 scenarios. Everything else needs an adapter that runs in the test process. Today each in-process test writes its own inline `harness: 'test'` adapter (`launch-admission`, `roles-session-refresh`, `session-brief`).

## What to build

- **`fakeHarness(flavour)`** in `hub/test/fakes/`, implementing `HarnessAdapter` (`hub/src/adapters/contract.ts`) for `claude-code`, `codex` and `opencode`. Its `capabilities` and `clauseAtSpawn` are imported from the real adapters' exported constants (`CLAUDE_CODE_CAPABILITIES`, `CODEX_CAPABILITIES`, `OPENCODE_CAPABILITIES`), so a capability change in a real adapter changes the fake with it.
- **Driven by the test, no processes:** it records each `SpawnRequest` (role clause, brief, cwd, policy); the test calls `turn`, `idle`, `busy`, `exit(code)` and `crash`, scripts each inject's outcome (`accept`, `reject`, `uncertain`, `hold`), feeds usage and model, and answers `resume` as found or gone. State reaches `Sessions` the same way the real adapters' interpretations do.
- **Wiring.** `serveProject` and `createHub` accept an `adapters` option that replaces the registered real adapters under the same harness names, so `roles.toml` harness choices keep working. `projectHub(t, root, env, { harnesses: 'fake' })` uses it and returns the fakes.
- **First consumers.** `session-brief.test.ts` and `roles-session-refresh.test.ts` switch from their inline adapters to the shared fake.

## Acceptance criteria

- [x] C1. A new T2 test proves launch, role clause, inject, turn, stop and resume through `projectHub` for each of the three flavours with no child process, proved by the tier lint and the file's spawn census row.
  - done: impl-686 · 2026-10-16T22:35:45.068Z
  - verified: rev-31 [reviewer] · run rev-20261016-686-final · 2026-10-16T23:27:17.470Z · commit 6cfe726b35dd450c822fa9ed848b1695d66c49dc
  - verified: rev-31 [reviewer] · run rev-20261016-686-merge-delta · 2026-10-16T23:34:32.954Z · commit 55775ec78b7409cd3ff005989e917b82b338b756
- [x] C2. Each flavour's capabilities equal the real adapter's exported constant, proved by a unit test.
  - done: impl-686 · 2026-10-16T21:51:10.826Z
  - verified: rev-31 [reviewer] · run rev-20261016-686-source-3 · 2026-10-16T21:57:22.842Z · commit dd966639b7b316456a8eec019ab0852b2c2811ee
  - verified: rev-31 [reviewer] · run rev-20261016-686-source-4 · 2026-10-16T22:35:38.413Z · commit 6cfe726b35dd450c822fa9ed848b1695d66c49dc
  - verified: rev-31 [reviewer] · run rev-20261016-686-merge-delta · 2026-10-16T23:34:32.954Z · commit 55775ec78b7409cd3ff005989e917b82b338b756
- [x] C3. Scripted accept, reject and uncertain injects reach the delivery states `injected`, `delivered` and `uncertain` as the real adapters' do, proved by the new test.
  - done: impl-686 · 2026-10-16T21:51:11.198Z
  - verified: rev-31 [reviewer] · run rev-20261016-686-final · 2026-10-16T23:27:17.470Z · commit 6cfe726b35dd450c822fa9ed848b1695d66c49dc
  - verified: rev-31 [reviewer] · run rev-20261016-686-merge-delta · 2026-10-16T23:34:32.954Z · commit 55775ec78b7409cd3ff005989e917b82b338b756
- [x] C4. `session-brief.test.ts` and `roles-session-refresh.test.ts` use the shared fake, with an audit showing their test declarations and assertion meanings unchanged.
  - done: impl-686 · 2026-10-16T21:51:11.399Z
  - verified: rev-31 [reviewer] · run rev-20261016-686-source-3 · 2026-10-16T21:57:22.842Z · commit dd966639b7b316456a8eec019ab0852b2c2811ee
  - verified: rev-31 [reviewer] · run rev-20261016-686-source-4 · 2026-10-16T22:35:38.413Z · commit 6cfe726b35dd450c822fa9ed848b1695d66c49dc
  - verified: rev-31 [reviewer] · run rev-20261016-686-merge-delta · 2026-10-16T23:34:32.954Z · commit 55775ec78b7409cd3ff005989e917b82b338b756
- [x] C5. `docs/agents/tests.md` names the in-process fake adapter as the default for hub rules and the fake binaries as reserved for contract and scenario files.
  - done: impl-686 · 2026-10-16T21:51:11.613Z
  - verified: rev-31 [reviewer] · run rev-20261016-686-source-3 · 2026-10-16T21:57:22.842Z · commit dd966639b7b316456a8eec019ab0852b2c2811ee
  - verified: rev-31 [reviewer] · run rev-20261016-686-source-4 · 2026-10-16T22:35:38.413Z · commit 6cfe726b35dd450c822fa9ed848b1695d66c49dc
  - verified: rev-31 [reviewer] · run rev-20261016-686-merge-delta · 2026-10-16T23:34:32.955Z · commit 55775ec78b7409cd3ff005989e917b82b338b756

## Comments

### impl-686 · 2026-10-16T21:49:09.692Z

Shared fake and adapter-factory wiring implemented. Three-flavour projectHub lifecycle/delivery component proof passes (~0.15s test time); capability/clock/confirmation unit proof passes. session-brief (8 declarations) and roles-session-refresh (2 declarations) pass after replacing inline adapter objects. Preparing current-dev merge, census and review artifact.

### rev-31 · 2026-10-16T21:53:21.117Z

verdict: review
result: not clear
by: rev-31 [reviewer]
run: rev-20261016-686-source-1
commit: 7edf5b8ad58be045eeb809b9ea46612919f169cf
scope: full
findings: [{"severity":"medium","text":"Delayed turn completes via captured name after renamed() changes it, throwing or publishing usage/idle to a different session reusing the old name.","file":"hub/test/fakes/harness.ts","line":116},{"severity":"medium","text":"Later replacement factory failure or duplicate harness key loses ownership of already-created adapters; no rollback closes them or Sessions/ProcessTable before construction throws.","file":"hub/src/adapters/index.ts","line":42}]
finding_counts: {"high":0,"medium":2,"low":0}

Source not clear; Standards0/Spec2medium findings, A-4222. Read all14paths/contract/consumer boundaries. M1 requires sessionId-bound completion plus rename/old-name-reuse fake-clock regression. M2 requires construction ownership rollback, duplicate rejection and timer cleanup regressions. Implementer29e07ad5/ff2c56ce confirms both gaps and corrections. C1 failed; C2–C5 otherwise source-supported but not marked on not-clear pass. Capability/clause constants, uncertainty manual-retry behavior and preserved consumer assertions reviewed. Coordinatorf3bf3a41 independently authorizes manual Test-levels/shards/census instead of unavailable tier lint;2git/3ps infrastructure disclosed. Premerge targeted receipts support source only. No verify before corrected-head source review; preserve local run prohibition. No Reviewer edits/tests.

Criteria: C1 failed (Fake turn completion loses stable session identity across rename/name reuse, and adapter construction failure lacks owned-resource rollback.).

### rev-31 · 2026-10-16T21:55:14.810Z

verdict: review
result: not clear
by: rev-31 [reviewer]
run: rev-20261016-686-source-2
commit: 24fc0073e06f8cb838d51bf5d2af1d916adc0b03
scope: full
findings: [{"severity":"medium","text":"Adapter installation throws after listeners bind without startup rollback; stop() at287 also aborts before remaining cleanup/lock release if a disposer throws, leaving primary serveProject ownership live.","file":"hub/src/hub/daemon.ts","line":336}]
finding_counts: {"high":0,"medium":1,"low":0}

Corrected source still not clear; Standards0/Spec1medium remaining finding, A-4224. M1 rename/name-reuse resolved by sessionId-bound callback and regression. M2 projectSessions ownership/duplicate rollback, Sessions all-disposer cleanup and createHub finally paths corrected; new regressions cover createHub only. Primary serveProject installs adapters after listeners outside rollback; normal stop adapter-close throw skips remaining owners/discovery/lock. Implementer067031de confirms no outerfinally and accepts further correction with T2 tests. C1 remains failed; other criteria source-supported unchanged. Exact-head typecheck/shards reportedgreen; new tests unrun under local prohibition, no runtime claim. No verify before corrected source review. No Reviewer edits/tests.

Criteria: C1 failed (serveProject factory failure and throwing adapter close still skip daemon-owned listeners/base/watchers/discovery/lock cleanup.).

### rev-31 · 2026-10-16T21:57:22.842Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261016-686-source-3
commit: dd966639b7b316456a8eec019ab0852b2c2811ee
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Corrected source clear; Standards0/Spec0 findings, A-4228. Both M1/M2 resolved in source: stable sessionId turn completion, tracked construction/duplicate ownership, all-disposer/table cleanup, createHub finally and serveProject startup rollback/shutdown attempting all owners with final lock release/stopped resolution. New fake-clock T1 rename/reuse and T2 construction/primary-daemon failure/throwing-close controls retain original errors and assert no timers/discovery/socket/lock plus successor reopen/resource audit. C2/C4/C5 source verified; C1/C3 final lifecycle/delivery execution await exact-head no-mode task droplet. Restore claimant C1done after prior failure. No post-review devmerge, diffcheckclean/typecheck+shards reportedgreen. New tests unrun locally per Coordinator restriction; prior targeted/census evidence not claimed as corrected-head run. Manual tier substitution f3bf3a41 remains applicable. No Reviewer edits/tests.

Criteria: C2 verified, C4 verified, C5 verified.

### rev-31 · 2026-10-16T22:35:02.595Z

verdict: review
result: not clear
by: rev-31 [reviewer]
run: rev-20261016-686-evidence-1
commit: dd966639b7b316456a8eec019ab0852b2c2811ee
scope: evidence
findings: [{"severity":"medium","text":"New AggregateError('hub cleanup failed') hides sole primary error text; existing journal-async:184/:228 fail /cannot open journal/ and /disk full/ despite original cause being retained.","file":"hub/src/hub/daemon.ts","line":309}]
finding_counts: {"high":0,"medium":1,"low":0}

Gate not clear; Standards0/Spec1medium task regression, A-4234. Independently inspected same-head7dbe2f4b/A-4233 exit1:2029pass/2fail/5skip, no Neovim. Both reds deterministic from task shutdown wrapper, not external flakes. Preserve all-owner cleanup/lock release and original tests while preserving primary visible error text; new source review before replacement gate. All7new fake-harness identities ordinarygreen/5of5, prior M1/M2 controls pass. C1 failed; C2/C4/C5 source current, C3 final gate pending. Lifetime2194s/cost$0.1523 perhub. No Reviewer edits/tests.

Criteria: C1 failed (New generic shutdown AggregateError hides original journal error text, breaking two unchanged daemon journal failure contracts.).

### rev-31 · 2026-10-16T22:35:38.413Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261016-686-source-4
commit: 6cfe726b35dd450c822fa9ed848b1695d66c49dc
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Corrected source clear; Standards0/Spec0 remaining findings, A-4236. Exact one-line change after all-owner cleanup/final lock release rethrows sole failures[0] unchanged, restoring primary journal error identity/message; multiple failures still aggregate. Existing journal-async assertions byte-unchanged. M3 resolved in source without weakening cleanup or tests; M1/M2 fixes remain. C2/C4/C5 current; C1/C3 final verification awaits fresh exact-head no-mode droplet. Restore C1claimant done after prior failure. A-4233 all7newidentities/35repetitions support unchanged controls but remains historical exit1/noNeovim. Typecheck/shards reportedgreen, independent ref/diffcheck clean; no local targeted run under prohibition. No Reviewer edits/tests.

Criteria: C2 verified, C4 verified, C5 verified.

### rev-31 · 2026-10-16T23:27:17.470Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261016-686-final
commit: 6cfe726b35dd450c822fa9ed848b1695d66c49dc
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final evidence clear; Standards0/Spec0 findings, A-4242. Independently inspected same-head16016692/A-4241 full exit0:2421pass/0fail/8skip including complete Neovim390pass/0fail/3skip. All7new identities ordinarygreen/5of5, including rename/identity and construction/daemon cleanup regressions. Both previously failing journal error contracts pass unchanged; migrated brief8/refresh2 cases complete. C1/C3 verified, with C1 manual tier/census substitution per independently read Coordinatorf3bf3a41; C2/C4/C5 source-4 current. All5claimant done marks present. No gate exception needed; historical failed receipt retained. Lifetime3025s/cost$0.2101 perhub. No Reviewer edits/tests.

Criteria: C1 verified, C3 verified.

### rev-31 · 2026-10-16T23:34:32.955Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261016-686-merge-delta
commit: 55775ec78b7409cd3ff005989e917b82b338b756
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Delta clear; Standards0/Spec0 findings, A-4248. Independently checked exact dev+two sorted T2 entries and byte-identical legacy fixture. Temporary capabilities T2 explicitly authorized by Coordinator2ce439c1 pending T-682/T-690. Task production/fake/consumer behavior retained; direct serveProject fixture now mirrors projectHub environment/state/fence isolation, preserving all resource/error assertions. A-4247 supplies five serial 4/4 component and five serial 3/3 capability passes; exact-head typecheck/tier lint reported green. C1-C5 current. Prior full-green Linux A-4241 remains accepted per Coordinatorb20d562c; 0db94e10 authorized this fixture correction and scoped review. Next integrated cover covers combined tree; no exact-current-head full-suite claim or new task run. Submission hold preserved. No Reviewer edits/tests.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified.

### coord · 2026-10-16T23:35:09.949Z

Coordinator disposition (rule 7 exception, stated explicitly). After its green droplet run 16016692 (A-4241) at 6cfe726b, the head moved to 55775ec7 for two things. First, the dev merge with its manifest-only changes to tiers.json. Second, one test-fixture change in T-686's own new T2 file: its direct serveProject regression now isolates CLAND_* keys, the executor credential and the executor state, as projectHub does. The production code at 6cfe726b is unchanged. The scoped delta review is clear at 55775ec7, the touched files passed 5/5 serially on the Mac after the dev merge, and typecheck and test:tiers pass. Evidence for the merged tree is the next integrated cover over T-680, T-686 and T-635. No new task droplet run (cap hold to 00:00Z).

### coord · 2026-10-16T23:35:11.457Z

Merged 75736485bd906024e985425c291ab675044b3ed9 onto dev.
