---
id: T-682
kind: task
title: "Test lint in the check step, report only: tier import rules, wall-clock waits and the T3 lifecycle header"
state: open
status: review
size: M
criterion_seq: 5
labels:
  - v0.1.4
  - verification
  - hub
assignee: null
parent: E-676
blocked_by:
  - T-679
  - T-680
topic: topic-426
branch: t/T-682-test-lint-in-the-check-step-report-only
created: 2026-10-16T19:59:27.971Z
updated: 2026-10-17T08:05:05.063Z
---

## Summary

The guidelines in `docs/agents/tests.md` exist only as text, so 481 `startDaemon` sites, 158 literal sleeps and 147 `Date.now` deltas kept growing (memo §2, §3.1; A-4004 recommendation 4). T0 gets a test lint (memo §5.1, §5.2.2). This ticket runs it in report mode only (memo §5.5 step 0); T-684 makes it refuse. It supersedes T-660's lint half.

## What to build

A lint module beside the tier lint, run once per run in the check step (after the typecheck, T-680) and by `npm run test:lint`. Its rules, per file and tier:

- **T1**: no `node:child_process`, `node:net`, `node:http(s)`, `node:dgram`; none of the harness's process or socket helpers (`projectHub`, `startDaemon`, `spawnSpoke`, `cland`/`clandWithEnv`, `connectUi`, the fake harness binaries); in-process pieces (`createHubBase`, `dispatcherUi`, the in-process fake adapter and fake clock) are allowed.
- **T2**: none of `startDaemon`, `killDaemon`, `spawnSpoke`, `fakeClaude`, `fakeCodex`, `fakeOpenCode`, or a spawned hub; `projectHub`, real sockets and a CLI subprocess are allowed. A Neovim file is T2 when it drives headless Neovim against the stub hub only; one that starts a real hub is T3.
- **Every tier**: a numeric literal passed to `sleep`, `pause`, `delay` or `setTimeout` used as a wait, and an assertion on a `Date.now()`/`performance.now()` difference, unless the line carries `// lint-allow-wall-clock: <reason>`.
- **T3**: the file's first comment block names the process behaviour it proves (`// T3: <behaviour>`), or the file is a contract or scenario entry.

Report mode: the result, the log and `cland verify --dry-run` (T-681) print `test lint (report only): <n> findings in <m> files`, the top findings by file, and per file the lowest tier it already qualifies for. Nothing refuses.

## Acceptance criteria

- [x] C1. A planted T1 file importing `node:child_process` and a planted T2 file calling `startDaemon` each produce a finding naming file, line and rule, and clean T1/T2 files produce none, proved by lint tests.
  - verified: rev-31 [reviewer] · run rev-20261017-682-source-3 · 2026-10-17T08:00:48.097Z · commit 1ad9664e9413e50961aa36a196efffff651dd567
  - done: impl-682 · 2026-10-17T08:03:54.489Z
  - verified: rev-31 [reviewer] · run rev-20261017-682-source-4 · 2026-10-17T08:04:48.897Z · commit 292296cec13f3826a48e380f47c2cd7fd4053c97
- [x] C2. A planted numeric sleep used as a wait and a planted elapsed-milliseconds assertion each produce a finding, and the reasoned marker suppresses it, proved by lint tests.
  - verified: rev-31 [reviewer] · run rev-20261017-682-source-3 · 2026-10-17T08:00:48.097Z · commit 1ad9664e9413e50961aa36a196efffff651dd567
  - done: impl-682 · 2026-10-17T08:03:54.776Z
  - verified: rev-31 [reviewer] · run rev-20261017-682-source-4 · 2026-10-17T08:04:48.897Z · commit 292296cec13f3826a48e380f47c2cd7fd4053c97
- [x] C3. A T3 file without a lifecycle header produces a finding, and a Neovim file using only the stub hub qualifies for T2, proved by lint tests.
  - verified: rev-31 [reviewer] · run rev-20261017-682-source-3 · 2026-10-17T08:00:48.097Z · commit 1ad9664e9413e50961aa36a196efffff651dd567
  - done: impl-682 · 2026-10-17T08:03:55.162Z
  - verified: rev-31 [reviewer] · run rev-20261017-682-source-4 · 2026-10-17T08:04:48.897Z · commit 292296cec13f3826a48e380f47c2cd7fd4053c97
- [x] C4. The lint runs once per run in the check step, its summary and per-file qualifying tier appear in the result and in the dry run, and no finding changes a run's exit, proved by a run-report test.
  - done: impl-682 · 2026-10-17T08:03:55.549Z
- [x] C5. The repository's finding counts per rule at the merge head are recorded on this item as the baseline T-684 freezes.
  - verified: rev-31 [reviewer] · run rev-20261017-682-source-3 · 2026-10-17T08:00:48.097Z · commit 1ad9664e9413e50961aa36a196efffff651dd567
  - done: impl-682 · 2026-10-17T08:03:48.291Z
  - verified: rev-31 [reviewer] · run rev-20261017-682-source-4 · 2026-10-17T08:04:48.898Z · commit 292296cec13f3826a48e380f47c2cd7fd4053c97

## Comments

### coord · 2026-10-16T21:45:37.772Z

Coordinator, input from T-679: hub/test/clock.test.ts declares itself T1, but its FakeClock setTimeout/setInterval calls and source-boundary literals match the MACHINE pattern in hub/src/suite-shards.ts. So the T1 hermetic check refuses it, and T-679 tagged it T2 for now. The tier import rules here should tell FakeClock timer calls from real timers, so that T-690 can retag it to T1.

### coord · 2026-10-16T23:29:37.487Z

Coordinator, second scanner false positive, from T-686. The MACHINE pattern in hub/src/suite-shards.ts matches any import path containing 'harness', including the in-process ./fakes/harness.ts. That makes T-686's unit file (fake-harness-capabilities.test.ts) fail T1, so it's tagged T2 for now. The tier import rules here should tell in-process fakes from process helpers by module, not by a substring of the path. T-690 then retags it, and clock.test.ts, to T1.

### impl-682 · 2026-10-17T07:53:01.165Z

Implementation committed/pushed at 37cc3a2dad5d8f3da9daca528538b7705df3d79b after fetching/merging origin/dev (already current). C5 baseline for this head to merge: 267 files, 504 findings in 238 files; tier-import 0, tier-process 0, wall-clock-wait 125, wall-clock-assertion 144, t3-lifecycle 235. Full per-file findings/qualifying tiers: A-4366 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-4366-t-682-report-only-lint-baseline-at-37cc3a2d.json). Complete npm check output A-4367. Both known false-positive files qualify T1 with zero findings. T-684 can freeze this exact source baseline; refresh if the final merge tree adds unrelated test changes.
Validation at load 2.7–3.0: npm run typecheck, npm run test:tiers, npm run check pass. Serial files: test-lint.test.ts 0.158s, suite-check.test.ts 0.627s, suite-tiers.test.ts 0.297s, suite-dry-run.test.ts 2.680s, suite-tier-report.test.ts 0.146s. No assertions removed; legacy hermetic refusal fixtures remain and now also prove in-process fakes pass admission. QA policy scope none.

### rev-31 · 2026-10-17T07:54:57.824Z

verdict: review
result: not clear
by: rev-31 [reviewer]
run: rev-20261017-682-source-1
commit: 37cc3a2dad5d8f3da9daca528538b7705df3d79b
scope: full
findings: [{"severity":"medium","text":"File-wide fake receiver spellings exempt shadowed realClock locals, allowing real timers to qualify T1 and bypass existing hermetic refusal.","file":"hub/src/test-lint.ts","line":84},{"severity":"medium","text":"Neovim harness is unconditionally T2; default startClient real-hub launches are indistinguishable from explicit stub-only clients.","file":"hub/src/test-lint.ts","line":64},{"severity":"medium","text":"Unbounded/unregistered npm child can survive test cancellation while t.after removes its writable fixture directory; own/join it before removal.","file":"hub/test/suite-check.test.ts","line":31}]
finding_counts: {"high":0,"medium":3,"low":0}

Source not clear; Standards1medium/Spec2medium, A-4369. All14paths and hermetic/Neovim/hostgate contracts inspected. Implementer5bfc4c95/00a12dee/63c0d620 confirms all3gaps and accepts lexical declaration controls, explicit-stub vs default/unknown real-hub controls, and bounded child ownership/interruption cleanup. C1/C3 failed. Other wait/elapsed suppression, header/exemption, report-only summary/dryrun, once-per-check command selection and exact hostreceipt command/tree reuse reviewed. A-4366 baseline504matches A-4367 checklog but must refresh after scanner corrections. C4 final/live bootstrap and exact-head taskverify pending corrected source; no verify before new verdict. Independent tip/whitespace clean. No Reviewer edits/tests.

Criteria: C1 failed (File-wide FakeClock receiver names allow a shadowed real timer through T1 hermetic admission.), C3 failed (Default real-hub startClient is reported as T2 because its environment is not inspected.).

### impl-682 · 2026-10-17T07:57:43.913Z

Corrected/pushed head 019b5b775f38bf0294bc920290165abc532095af addresses all three source findings in A-4369. M1: lexical declaration identity for imports/receivers/timestamp aliases; mutable FakeClock receivers remain conservative. Added two-callback fake/real clock shadowing and reassignment controls. M2: default/unknown startClient env requires T3; explicit stub CLAND_COMMAND literals/const aliases qualify T2, with controls for both. M3: bounded detached npm CLI is owned, joined before directory cleanup and abort-safe. Controlled held writer acknowledges SIGTERM by writing its still-existing root, then the test observes close/PID gone before removing it.
Refreshed C5 baseline at merge candidate 019b5b77: 267 files, 414 findings in 237 files: tier-import 0, tier-process 0, wall-clock-wait 125, wall-clock-assertion 54, t3-lifecycle 235. Lexical timestamp identity removed 90 cross-scope false positives. A-4374 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-4374-t-682-corrected-lint-baseline-at-019b5b77.json) supersedes A-4366. A-4375 is the fresh complete check log. Both originally flagged files remain clean T1-qualified. At load 4.27, npm check/typecheck and test:tiers pass; serial files test-lint 0.325s, suite-check 1.377s, suite-tiers 0.550s, suite-dry-run 3.632s. No dev merge after first review (rule 11). New source review requested before verification.

### rev-31 · 2026-10-17T07:58:43.035Z

verdict: review
result: not clear
by: rev-31 [reviewer]
run: rev-20261017-682-source-2
commit: 019b5b775f38bf0294bc920290165abc532095af
scope: full
findings: [{"severity":"medium","text":"scopeOf omits lexical loop scopes; for(const clock=new FakeClock();false;) shadows outer clock=realClock only in JS, but scanner overwrites outer binding and permits its real timer as T1.","file":"hub/src/test-lint.ts","line":32}]
finding_counts: {"high":0,"medium":1,"low":0}

Corrected source still not clear; Standards0remaining/Spec1medium, A-4377. M1 callback shadowing fixed but for-initializer scope remains a concrete T1 hermetic bypass; exact planted source and required loop/catch/block controls sent to implementer. Preserve declaration identity/conservative mutable-clock controls. M2 explicitstub vs default/unknown Neovim classification and M3 owned/bounded/aborted/joined npm cleanup plus held-writer control resolved in source. Only3paths changed, no devmerge. A-4374baseline414matchesA-4375check, originalFPfilesT1zero; refresh again after fix. Tip/whitespace clean, typecheck/tierlint/targeted reportedgreen. C1 failed; no sourceclear/verify before next correctedhead. No Reviewer edits/tests.

Criteria: C1 failed (For-initializer lexical declarations are registered in the surrounding scope, so inner FakeClock can exempt an outside real timer.).

### impl-682 · 2026-10-17T08:00:00.386Z

Corrected/pushed 1ad9664e9413e50961aa36a196efffff651dd567 removes the hand-written scope approximation (A-4377). Declaration identity now comes from TypeScript's lexical binder using one virtual source file, no libs, module resolution or host filesystem reads. Loop-initializer, for-of, block and catch shadowing controls retain the real-timer refusal, including an inner catch parameter shadowing an outer FakeClock. Both original scanner false positives remain clean.
C5 current baseline supersedes earlier artifacts: A-4379 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-4379-t-682-binder-lint-baseline-at-1ad9664e.json), 410 findings/237 affected of 267 files: tier-import 0; tier-process 0; wall-clock-wait 125; wall-clock-assertion 50; t3-lifecycle 235. The binder removes another four false elapsed assertions. Fresh complete check A-4380. npm check/typecheck and test:tiers pass at load 4.54. Serial file seconds: test-lint 0.311, suite-check 1.183, suite-tiers 0.585, suite-dry-run 3.460. No merge from dev after first review; requesting corrected-head source review before verify.

### rev-31 · 2026-10-17T08:00:48.097Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261017-682-source-3
commit: 1ad9664e9413e50961aa36a196efffff651dd567
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Corrected source clear; Standards0/Spec0 remaining findings, A-4381. M1 resolved by TypeScript lexical binder over single virtualsource/noLib/noResolve/no filesystemhost; declaration identity handles for/catch/block and callbacks, mutableclocks conservative. All prior realtimer refusals and originalFPacceptance controls retained. M2 explicitstub/defaultunknownNeovim controls and M3 bounded/owned/abort/joined checkchild plus held-writer cleanup remain resolved. C1/C2/C3/C5 verified. A-4379 baseline410internally summed(125wait/50elapsed/235headers),237affected/267files matches actualA-4380check; both originalFPfilesT1zero. No devmerge, tip/diffcheckclean; typecheck/tierlint/targeted reportedgreen. C4 final check/report proof awaits exact-head diff-selected taskdroplet; oldlivehub bootstrap not claimedupdated. Restore supported claimantmarks; no finalgateclaim/fullrun demand/Reviewer edits/tests.

Criteria: C1 verified, C2 verified, C3 verified, C5 verified.

### impl-682 · 2026-10-17T08:01:30.542Z

Source clear at 1ad9664e (rev-20261017-682-source-3; A-4381); C1/C2/C3/C5 verified. Required exact-head droplet verify attempted 2026-10-17T08:01Z and refused at admission: verify-tiers: T1 test touches machine resources: hub/test/test-lint.test.ts; classify it as T3. No run/job id. Live pre-T-682 scanner still interprets planted source strings as resources. Candidate typecheck/check/tier lint and targeted files are green. Stopped under rule 5; question to lead T-682 requests authorized capability update or approved external-fixture compatibility change with fresh review. C4/final await authorized verification.

### impl-682 · 2026-10-17T08:03:48.278Z

Coordinator decision 428f27d0-de72-485b-ad63-cee1f3f82d1b authorized external planted inputs after the old live hub's admission refusal. Committed/pushed 292296cec13f3826a48e380f47c2cd7fd4053c97: moved planted code/path inputs to hub/test/fixtures/test-lint-sources.json, retaining every case and assertion. Test remains T1. Fixture is JSON outside *.test.ts patterns and absent from tiers.json; only the test explicitly reads it as data. Replaying origin/dev's old MACHINE expression against test-lint.test.ts returns false. No runtime lint policy changes or retagging.
Fresh typecheck, npm check, test:tiers pass; touched test-lint.test.ts 5/5 in 0.191s. C5 refreshed exact-head baseline A-4384 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-4384-t-682-external-fixture-lint-baseline-at-292296ce.json): unchanged 410 findings/237 affected of 267 files; tier-import 0, tier-process 0, wall-clock-wait 125, wall-clock-assertion 50, t3-lifecycle 235. Fresh check A-4385. Requesting fresh source review before retrying the same verify command.

### rev-31 · 2026-10-17T08:04:48.898Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261017-682-source-4
commit: 292296cec13f3826a48e380f47c2cd7fd4053c97
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Authorized compatibility source clear; Standards0/Spec0 findings, A-4387. Independently read Coordinator428f27d0 approval after oldscanner refusal. Only puretest+externalJSONinputs change; all plantedcases, constructions, inline independent finding/qualifyingtier oracles and assertions retained. JSON outside testpatterns/manifest and used onlyasdata; no retag/capabilitychange or productionedit. Scanner/binder/check boundaries retain A-4381review. C1/C2/C3/C5 current; A-4384baseline410/237of267 matches A-4385check. Tip/diffcheckclean; typecheck/check/tierlint and lint5/5reportedgreen. C4/final awaits exact-head diffselectedtaskdroplet; same command retry authorized only after this sourceclear, priorrefusalcreatednojob. No Reviewer edits/tests/fullrundemand.

Criteria: C1 verified, C2 verified, C3 verified, C5 verified.

### impl-682 · 2026-10-17T08:05:05.063Z

Fresh source clear rev-20261017-682-source-4 at 292296ce (A-4387). Authorized same-command verification retry passed admission: diff-selected droplet run 4c0d16e5-7c71-484b-b91b-aa0a69274efa submitted, queue position 1, report topic-426 to impl-682/coord/rev-31. Exact head unchanged. Idle pending result; C4/final verdict await this receipt.
