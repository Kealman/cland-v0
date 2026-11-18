---
id: T-1758
kind: task
title: suite-cancel detached-child reap assertion fails under load right after the cancelled result
state: closed
status: done
size: M
criterion_seq: 3
labels:
  - ready-for-agent
assignee: null
parent: E-1881
blocked_by:
  - T-1889
topic: topic-1632
branch: t/T-1758-suite-cancel-detached-child-reap
created: 2026-11-07T16:25:55.075Z
updated: 2026-11-18T23:22:34.133Z
closed: 2026-11-18T23:22:34.133Z
---

## Summary

`hub/test/suite-cancel.test.ts` "verify cancel reaps a detached fake child before removing the phase root, then admits the next run" failed once under load at line 90: `detached descendant is reaped before cancellation is reported` (`pidAlive(fake.pid)` true !== false). The assertion reads `pidAlive` immediately after the cancelled result appears. Under load the reaped detached child can still be visible for a moment, or the result is published before the kill is confirmed. One of the two is a test race and the other a product ordering defect; this item finds which.

## Evidence

- Failed: T-1738 native importer sweep, local macOS arm64, Node 24.21.0, five implementer lanes active, host 1-minute load about 11 (16:18Z, 2026-11-07). File result 7 pass / 1 fail, 87.8 s. T-1738 touches no process or cancel code.
- Solo rerun at T-1738 head e3c911e0, `CLAND_*` stripped, no concurrent tests from that session: 8/8 pass, 28.2 s.

## Acceptance criteria

- [x] C1. The cause is named: either the cancelled result can be published before the detached descendant is confirmed dead (product), or the probe runs before the kernel retires an already-killed pid (test).
  - done: impl-1758 · 2026-11-18T18:44:47.090Z
  - verified: rev-39 [reviewer] · run rev-20261118-1758-evidence-3 · 2026-11-18T19:14:50.511Z · commit bfc110ca367a2ad7c353d4f6a1918cff5013095f
  - verified: rev-39 [reviewer] · run rev-20261118-1758-criteria-7 · 2026-11-18T20:06:33.942Z · commit 500f78de47f5fca62e3b35929aa18a127603c9ec
  - verified: rev-39 [reviewer] · run rev-20261118-1758-final-8 · 2026-11-18T20:33:47.939Z · commit 500f78de47f5fca62e3b35929aa18a127603c9ec
  - verified: rev-39 [reviewer] · run rev-20261118-1758-final-10 · 2026-11-18T22:20:56.068Z · commit da3052c638bdb8da7fab7fe2f0a29cdb7779dd9a
- [x] C2. Product cause: the cancelled result follows confirmed death of every tracked descendant, with a regression that delays the reap. Test cause: the assertion waits through `eventually()` for the pid to vanish within the behaviour bound, keeping the ordering claim.
  - done: impl-1758 · 2026-11-18T20:05:53.964Z
  - verified: rev-39 [reviewer] · run rev-20261118-1758-criteria-7 · 2026-11-18T20:06:33.942Z · commit 500f78de47f5fca62e3b35929aa18a127603c9ec
  - verified: rev-39 [reviewer] · run rev-20261118-1758-final-8 · 2026-11-18T20:33:47.940Z · commit 500f78de47f5fca62e3b35929aa18a127603c9ec
  - verified: rev-39 [reviewer] · run rev-20261118-1758-final-10 · 2026-11-18T22:20:56.068Z · commit da3052c638bdb8da7fab7fe2f0a29cdb7779dd9a

## Comments

### coord · 2026-11-07T16:53:29.592Z

Dev check at cc23cc1f, local macOS arm64, Node 24.21.0, run alone under the preservation lock with CLAND_* stripped, 1-min load 2.2–3.0: hub/test/suite-cancel.test.ts 5/5 runs green (8/8 each). The failure needs load (about 11 at the T-1738 occurrence); C3's ≥10-load burner is the reproduction path.

### impl-1758 · 2026-11-18T17:45:41.419Z

Consumer map / planned seam: suite-cancel.test.ts detached cancellation cases -> LocalExecutor.cancel/release -> endProcess -> systemProcesses/processIdentitiesAsync. Suites.#inspect awaits local cancel/release before publishing suite:<id>; native identity parsing treats structured zombie/dead states as exited while kill(pid,0) can still succeed. Existing system-processes.test.ts already specifies this native-death/PID-retirement distinction. Preparing an injected macOS zombie descendant through systemProcessProbe in suite-cancel.test.ts, retaining production endProcess and synthetic native boundaries; no wire/result shape or policy changes planned. The first run will retain the original immediate pidAlive assertion for red evidence. Local tests held during cover. T-1689/refused-cancel case remains untouched.

### impl-1758 · 2026-11-18T18:13:18.480Z

Source candidate evidence (publication blocked by T-1981; Coordinator authorized comment/review-request summaries). Local macOS arm64, Node v24.21.0. npm run typecheck completed exit 0 on candidate source; git diff --check exit 0. npm run test:lint still running, so no lint-pass claim yet. No runtime tests or verification have run under cover quiet; deterministic red/green and C3 20/20 remain pending and criteria remain unmarked.

Source path: Suites awaits LocalExecutor.cancel/release before publishing; endProcess consumes native identity/death receipts independently of kill(pid,0). Candidate injected macOS native-Z descendant remains visible to kill(0) after endProcess confirms death. Green candidate then waits for explicitly injected retirement. Red recipe in file-specific guide restores the original false expectation at that boundary. Candidate CLI cases poll eventually for PID absence with timeoutMs:5000 and behaviour:'kernel retires the confirmed-dead detached descendant', then keep final PID absence, early-removal, raw-coverage, inode and next-run assertions. Production code unchanged. origin/dev merged once at d7050e7e2 before source review (tracker-only delta).

Artifact failure literal: 'Error: Evidence refused: publication outcome unknown; snapshot retained; reconcile session artifacts before retrying'; native exit 1. Reconciliation artifact.list in item topic returned {ok:true,artifacts:[]}. Retained private snapshot left untouched for T-1981; no retry or alternate publication.

### impl-1758 · 2026-11-18T18:13:51.889Z

Source review requested at clean pushed head 257ec569078d0439abfa7abbcc5821c5f7170c66. Static checks completed on candidate macOS arm64 / Node 24.21.0: npm run typecheck exit 0; full npm run test:lint exit 0, literal 'test lint refusals: 0' (report-only census 130 findings in 63 files, not a passing runtime receipt); git diff --check exit 0. Runtime red/green, C3 load repetitions and exact-head verify remain pending; criteria remain unmarked. Review request explicitly says source-only under Coordinator's quiet-period authorization and publication blocked by T-1981.

### rev-39 · 2026-11-18T18:17:08.451Z

verdict: review
result: not clear
by: rev-39 [reviewer]
run: rev-20261118-1758-source-1
commit: 257ec569078d0439abfa7abbcc5821c5f7170c66
scope: full
findings: [{"severity":"medium","text":"The pending-observer assertion races eventually's asynchronous settlement: observed resolves inside the first predicate, so settled can still be false even if that observation prematurely completes retirement. rows=[] and the final assertion then conceal that error; require an independently observed pending boundary and a reap receipt checked at settlement.","file":"hub/test/suite-cancel.test.ts","line":47},{"severity":"medium","text":"The retained exact-root/raw removal observer still calls kill(pid,0) to identify a live writer. A confirmed-dead zombie intentionally allowed by this change therefore creates an early-removal failure; bind this observer to captured native identity/death and keep PID retirement as its separate assertion.","file":"hub/test/suite-cancel.test.ts","line":69}]
finding_counts: {"high":0,"medium":2,"low":0}

Source-only full review of dev...257ec569078d0439abfa7abbcc5821c5f7170c66 (one test commit, two changed files). Standards: two medium receipt/boundary findings under rules 9 and 26, confirmed by implementer message 56eec05b. Spec: C2 ordering proof remains incomplete for the accepted native-death versus kernel-retirement distinction. Static production trace supports the proposed cause: Suites awaits local cancel/release; endProcess accepts structured native exit independently of kill(pid,0). This is source reasoning, not confirmation of the historical loaded failure. C1 and C3 remain unverified; no criteria verified. No tests or probes run by Reviewer during quiet. Implementer reports macOS arm64 Node24.21.0 typecheck/lint exit0; runtime red/green, loaded20 and configured verify remain pending. Evidence publication blocked by T-1981; this item comment uses Coordinator exception 13ae3844, with no artifact retry or alternate publication. Corrected head needs fresh source review before verification.

Criteria: C2 failed (The delayed-retirement control has a vacuous pending assertion, and the retained removal-order observer still confuses zombie PID visibility with a live writer.).

### impl-1758 · 2026-11-18T18:20:30.462Z

Corrected both source findings and requested fresh source review at clean pushed head 0e581f5c393ff1a4c4fe5a946aac7b615f4f5a17. The synthetic observer now asserts independent reapReceipt at settlement, drains initial async chain before reap injection and joins its outcome in finally. Removal observer now uses production processAlive with child's captured native birth, positively controlled against live and native-Z / PID-visible states. Typecheck exit 0; full npm run test:lint exit 0 ('test lint refusals: 0'; report-only census 130/63); git diff --check exit 0 on local macOS arm64 / Node 24.21.0. Runtime red/green and loaded C3 remain unexecuted under quiet, all criteria unmarked. Publication blocked by T-1981; authorized comment evidence fallback used, retained snapshot untouched.

### rev-35 · 2026-11-18T18:25:06.571Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1758-source-2
commit: 0e581f5c393ff1a4c4fe5a946aac7b615f4f5a17
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source-only full review at 0e581f5c393ff1a4c4fe5a946aac7b615f4f5a17, tree f3032ada21499f1bed8c331f7bf26a0ea32d4830. Clean pushed head; fixed base d7050e7e2c210bed4210cd16d37eb576192a1f09. Reviewed the full base-to-head change and the correction from 257ec569078d0439abfa7abbcc5821c5f7170c66. Exactly two files change: suite-cancel.test.ts (61+/4-) and its guide (27+). No production, refused-cancel case, wire or configuration change; no later dev merge.

Standards: no findings. Spec: no findings within this source pass. Both previous medium findings in rev-20261118-1758-source-1 are resolved in source:
1. suite-cancel.test.ts:45–67 now asserts the independent reapReceipt at retirement settlement before setting settled. The outcome handler is attached immediately, the initial predicate's asynchronous return chain is drained through a native turn, and finally injects rows=[] / reapReceipt=true and joins the original outcome. Premature acceptance before injection records a rejected outcome even if settled is still false; final success requires the observed settlement and PID absence. The native turn is an event-loop ordering control, not a timed readiness claim.
2. The exact-root/raw removal observer now calls production processAlive with the child's own captured processIdentityAsync birth from its ready marker. The synthetic case positively checks a live writer, then structured native-Z death while production pidAlive still sees the PID. The observer's unknown native proof remains conservatively live through the production implementation; it no longer equates kill(0) visibility with a live writer.

C2 source behavior: both CLI cases use eventually with explicit timeoutMs 5000 and named behavior for kernel retirement after the cancelled receipt, then retain the final PID absence assertion. Exact-root early-removal, raw-coverage ENOENT, recreated-inode and next-run/lock assertions remain. The source distinguishes confirmed writer death before deletion/reporting from later kernel PID retirement. This does not weaken the writer-ordering claim to a later eventual-death check.

Read the existing until/observe implementation: predicate time shares one deadline, a defined result settles immediately through its promise chain, and timers are cleared in finally. Read the isolated systemProcessProbe owner: scratch roots are acquired/registered synchronously before yield, the native child runs in fixtureEnvironment, execFile settles after native close (including its 10s timeout), and root disposal follows it. Signal cleanup discovers/stops writers in still-owned roots before removal. The new test is explicitly T3; its production OS-observation boundaries are synthetic inside the isolated child, not a native macOS reproduction. No seam or child helper implementation was changed.

Static production trace remains LocalExecutor.cancel -> awaited endProcess, then LocalExecutor.release -> awaited native cleanup/recovery; Suites awaits local cancellation/release before collection/publication. processAlive uses the captured native identity and structured exited callback; an unreadable live identity stays conservative. Existing system-processes controls distinguish native Z/X from retained PID visibility. These source facts support the proposed test-cause explanation but do not confirm the historical loaded failure.

The updated guide names the generated delayed-retirement case, exact-root observer boundary, independent reap receipt, preserved final assertions, the explicit original-immediate-assertion red recipe, and fixed retirement behavior budget. It also retains the planned twenty serial affected-case macOS repetitions at load >=10 and <20 under a granted native slot after quiet over and T0 clear. No unchanged refusal identity is enrolled into that requested repetition claim.

Criteria: C1, C2 and C3 remain unverified. No runtime test has run; the deterministic original-assertion red/green proof and loaded 20/20 are still pending. The earlier C2 failed mark records the old source pass; its two source findings are now resolved, without fabricating runtime verification. This is preliminary source clearance, not final readiness or diagnosis evidence. The lead intentionally left implementation criteria unmarked pending those receipts; this pass verifies none.

Retained validation reports in the item/request: local macOS arm64, Node v24.21.0; full npm run typecheck exit0; full npm run test:lint exit0, literal 'test lint refusals: 0', report-only census130 findings/63files; git diff --check exit0. These are reported static-check completions, not a T1/T2/T3/T4, browser or configured-verification pass. Missing independently retained invocation-tree/native-signal/raw-capture hashes stay unknown.

Reviewer activity was static Git/file/helper/contract inspection only: no tests, linter, compiler, native probe, browser, source edit or evidence-helper retry. Quiet remains in force under Coordinator e4d70de2. Any later run still requires its explicit slot/window and T0 conditions; source clearance alone does not release quiet. A changed head needs fresh review and rule11 still forbids an unsolicited dev merge.

Evidence publication remains blocked by T-1981. Primary Coordinator13ae3844 authorizes item-comment/review-request summaries instead. The retained helper failure remains exit1, literal 'Evidence refused: publication outcome unknown; snapshot retained; reconcile session artifacts before retrying'. No artifact retry, alternate artifact publication or private-snapshot mutation is performed; this comment is the authorized record.

Clear source verdict; zero Standards and zero Spec findings. No criteria verified. Hold released.

### impl-1758 · 2026-11-18T18:48:01.237Z

Runtime evidence at reviewed 0e581f5c3, local macOS arm64 Node24.21.0, no browser. Deterministic original assertion red: literal 'AssertionError [ERR_ASSERTION]: detached descendant is reaped before cancellation is reported', 'true !== false', 0/1 native exit1; restored reviewed bytes, same identity green1/1 exit0. Full changed T3 suite-cancel.test.ts 9/9 exit0, file wall61.136s, startload6.13. C1 test-observation distinction confirmed by injected structured native-Z death while kill(0) stays visible; Coordinator accepted C1 evidence.

C3 failed attempt retained: repetition1 native exit1/0pass1fail, literal 'detached descendant kernel PID retirement after cancellation: not within 5000 ms'; startload10.790/end20.055, runner wall31.882s. No C3 pass. Burner PID77254 stopped with observed native close SIGKILL. Coordinator decision c43c793e: kernel PID retirement belongs to shared load-scaled setup headroom, because confirmed native death is the product boundary. Changing actual CLI wait to waitTimeoutMs(testWaitMs(5_000)), loadFactor1 (scale once), with matching guide. Typecheck exit0; full lint rerun pending before fresh review. T-1982 is not a dependency per Coordinator e519d312. No other source changes or dev merge; no verify submission. Publication still blocked by T-1981 under comment fallback.

### impl-1758 · 2026-11-18T19:14:38.601Z

C1 correction / product mechanism before product edit (supersedes earlier test-only diagnosis): loaded exact-head bfc110ca3 final native sample has cancelledReceipt suite:c462e426-20c2-4dd9-a9ec-7ab4cb752c43 while fake PID43443 retains native birth darwin:1795028546:450257, processAlive:true, kill0:true, state Ss, parent1; no Z/native-exit sample. Thus cancellation/report ordering fails with a live captured descendant. Original parent43410, runner43321, observer42091; live observed over18.712s, disappearance unobserved. Literal failure 'detached descendant kernel PID retirement after cancellation: not within 5548.095703125 ms', native exit1/0pass1fail, load10.096->12.268, sharedfactor1.109619140625, macOS arm64 Node24.21.0. All earlier failed loaded receipts retained; no C3 pass.

Exact source gap targeted by deterministic regression: fake spawn({detached:true}) creates a distinct session/group. endProcess's captured owned PID/native-birth map is per invocation. If cleanup becomes incomplete after TERM, that captured map is discarded; LocalExecutor.cancel can skip the now-dead worker; release's fresh endProcess walk accepts an absent leader, then only looks at rows whose group equals workerPID, omitting the live reparented own-group descendant. Loaded samples prove the live-orphan/report outcome; the exact reason its first termination attempt became incomplete was not captured and remains unknown. The deterministic seam forces incomplete native inspection after first TERM, then reparenting before retry's tree walk to prove this tracking-loss boundary. Product code still unchanged. Resize M reported to Coordinator.

Consumer inventory (rules20/41): searched full hub/src, hub/test (all tiers and frozen JSON/help fixtures), nvim, web, shared wire, shipped .agents/skills, QA briefs and docs by function/type/frame names and raw command wording. Planned additive owner callback in endProcess and LocalExecutor run-scoped retained captured births; no serialized lease/resource or wire shape change. LocalExecutor and system-processes migrate; suite-cancel regression/guide migrate. Every other listed reader keeps old optional-argument defaults and unchanged cancel reply/wire/result/resource fields, hence unaffected by shape; native signaling/recovery regressions still need targeted evidence. No CLI/help byte change planned; frozen CLI usage and tracker-snapshot consumers remain unchanged. Exact matched readers:
- docs/agents/host-agent.md
- docs/agents/tests/hub-test-measure-memory.test.ts.md
- docs/agents/tests/hub-test-suite-cancel.test.ts.md
- docs/agents/tests/hub-test-suite-persistence.test.ts.md
- docs/agents/tests/hub-test-system-processes.test.ts.md
- docs/brand/launch-claims-audit-T-783.md
- docs/hub/adapters-and-sessions.md
- docs/hub/artifacts.md
- docs/hub/coordinator-subscription-procedure.md
- docs/hub/declining-an-accepted-verifier-request-t-1494.md
- docs/hub/modules.md
- docs/hub/running.md
- docs/hub/web-edge.md
- hub/src/cli/suite.ts
- hub/src/cli/usage/suite.ts
- hub/src/executor/local.ts
- hub/src/fixture-processes.ts
- hub/src/host/local.ts
- hub/src/hub/dispatch.ts
- hub/src/hub/suite-isolation.ts
- hub/src/hub/suites.ts
- hub/src/hub/web-authority.ts
- hub/src/orphans.ts
- hub/src/protocol.ts
- hub/src/suite-command.ts
- hub/src/system-processes.ts
- hub/src/termination-owner.ts
- hub/test/claude-code-sessions-lifecycle.test.ts
- hub/test/durations.json
- hub/test/executor-liveness.test.ts
- hub/test/executor-prepare-retry.test.ts
- hub/test/executor-run.test.ts
- hub/test/executor-safety-component.test.ts
- hub/test/fixture-orphans.test.ts
- hub/test/fixtures/cli-usage/commands.json
- hub/test/fixtures/tracker-snapshot/items.json
- hub/test/host-boundary.test.ts
- hub/test/host-boundary.ts
- hub/test/measure-memory.test.ts
- hub/test/memory-producer.ts
- hub/test/merge-batches.test.ts
- hub/test/merge-queue.test.ts
- hub/test/remote-cleanup.ts
- hub/test/session-async-processes.test.ts
- hub/test/suite-accounting.test.ts
- hub/test/suite-admission-responsive.test.ts
- hub/test/suite-admission.test.ts
- hub/test/suite-cache.test.ts
- hub/test/suite-cancel.test.ts
- hub/test/suite-close-component.test.ts
- hub/test/suite-close-recovery.test.ts
- hub/test/suite-command.test.ts
- hub/test/suite-component-fixture.ts
- hub/test/suite-cover.test.ts
- hub/test/suite-human-component.test.ts
- hub/test/suite-hung-component.test.ts
- hub/test/suite-persistence.test.ts
- hub/test/suite-queue-policy.test.ts
- hub/test/suite-queue.test.ts
- hub/test/suite-recovery.test.ts
- hub/test/suite-remote-budget.test.ts
- hub/test/suite-selection-component.test.ts
- hub/test/suite-timeouts.test.ts
- hub/test/suite-unit-fixture.ts
- hub/test/suite.test.ts
- hub/test/system-process-probe.ts
- hub/test/system-processes.test.ts
- hub/test/task-card-component.test.ts
- hub/test/verify-all.test.ts
- hub/test/verify-submission.test.ts
- hub/test/web-authority-unit.test.ts
- nvim/README.md
- qa/briefs/E-1531-stage-3.md
- qa/briefs/E-1531.md
- qa/briefs/E-1534-stage-1.md
- qa/briefs/E-1534-stage-2.md
- qa/briefs/E-1534-stage-3.md
- qa/briefs/E-1534.md
- qa/briefs/E-1535-stage-1.md
- qa/briefs/E-423.md
- qa/briefs/E-468.md
- qa/briefs/T-230.md
- qa/briefs/T-271.md
- qa/briefs/T-273.md
- qa/briefs/T-386.md
- shared/wire/index.ts

### rev-39 · 2026-11-18T19:14:48.343Z

verdict: review
result: not clear
by: rev-39 [reviewer]
run: rev-20261118-1758-evidence-3
commit: bfc110ca367a2ad7c353d4f6a1918cff5013095f
scope: evidence
findings: [{"severity":"high","text":"Cancellation is reported while the exact captured detached descendant is still live: the final sample carries suite:c462e426-20c2-4dd9-a9ec-7ab4cb752c43 alongside PID43443 with matching darwin:1795028546:450257 birth, state Ss,parent1,processAlive=true. The proposed already-dead/zombie explanation does not satisfy C2; fix the product ownership/termination ordering before release.","file":"hub/test/suite-cancel.test.ts","line":184}]
finding_counts: {"high":1,"medium":0,"low":0}

Delayed formal record after Coordinator1f02a4a0 'hub responsive'. Reconciled task.view once: no pending bfc110ca3 verdict and no holds; acquired verifier hold before this write. Evidence scope at exact bfc110ca367a2ad7c353d4f6a1918cff5013095f. Source-only diagnostic audits at54cc683f7,d66a9e4b2,bfc110ca3 found no seam issues; none granted runtime/criterion clearance. This failed receipt supersedes pending source-only settlement.

Actual failure: 'detached descendant kernel PID retirement after cancellation: not within 5548.095703125 ms'. Selected generated case: 'verify cancel reaps a detached fake child before removing the phase root, then admits the next run'. Local macOS arm64 Node24.21.0 native execution, one diagnostic attempt at bfc110ca3; exit1,0pass1fail,0skip0cancel. Startload10.09619140625/end12.267578125, shared setup factor1.109619140625. No configured verify, browser or full-suite pass; no 20/20 C3 evidence.

Independently read retained receipts and extracted all33 samples. All sampled native identities equal captured darwin:1795028546:450257 for PID43443; states only Ss/Rs, never Z, and no native exit receipt. Final sample started1795028565299/finished1795028565463 contains cancelledReceipt suite:c462e426-20c2-4dd9-a9ec-7ab4cb752c43, identity matching capture, stateSs,parent1,processAlive=true,kill0Alive=true,nativeExited=false. This establishes report-before-confirmed-death (C1 product branch) and fails C2. It does not establish the precise code path losing ownership, nor a PID-retirement duration: disappearance was not observed. Earlier failed rounds remain failed, including the report-wait timeout with no emitted samples; no cause was inferred from that incomplete round. Coordinatore2054dab keeps the product branch in this item; implementer is tracing ownership before a fix.

C2 failed. C3 remains incomplete/unverified. C1 product-branch cause established and will be marked separately with this run. No Reviewer tests/probes/edits performed. Publication remains blockedT-1981; this item comment is the authorized evidence-summary fallback under Coordinator13ae3844, with no helper retry or alternate publication. Implementer reports burner native close confirmed and native slot released.

Criteria: C2 failed (At bfc110ca3 the exact cancelled report was observed while the captured descendant retained its live native birth and processAlive=true; confirmed death does not precede reporting.).

### impl-1758 · 2026-11-18T19:26:43.995Z

Product regression red/green (working candidate atop bfc110ca3; no load), native slot granted0f67f10a then released. Command: node --test --test-name-pattern='cancel retry retains a detached native identity reparented before the next tree walk' hub/test/suite-cancel.test.ts. On original product: native exit1,0pass1fail, literal 'cancellation retry confirms death of the previously captured detached identity', actual live PID420101/parent1/group420101 versus expected[]. This proves the captured-ownership retry gap without load. After scoped product fix: same identity exit0,1pass0fail. Local macOS arm64 Node24.21.0, startload8.34/7.88, no browser. These are selected synthetic T3 receipts, not configured verification or C3.

Candidate implementation: endProcess synchronously notifies initial verified captures and newly discovered descendants; LocalExecutor retains native birth receipts in a live per-lease WeakMap across incomplete attempts. cancel retries drain that map even when the worker is gone; release drains before root recovery/reporting. Dropping a capture requires native exited, ESRCH/PID absence or changed native birth, not an absent ps row. No serialized resource/wire field added; copied leases inherit no live capture map. Existing independent restart/cwd/birth fences unchanged. Callback omitted by all existing other callers retains prior semantics. Four additional synthetic receipt/authority controls prepared; typecheck exit0, full lint running, targeted native slot queued. C2 and C3 remain incomplete; source review and load20 still required.

### impl-1758 · 2026-11-18T19:29:30.977Z

Product head2e48d0b1e980f5cb14d2ce3ee2243954304ddf92 committed/pushed; no dev merge after first review. Final candidate static checks: full npm run typecheck exit0; full npm run test:lint exit0 ('test lint refusals:0', report-only130/63), diffcheck0. Serial unloaded T3 evidence on candidate macOS arm64 Node24.21.0: original product reparent-retry regression red exit1/0pass1fail, retained live PID420101 parent1/group420101; product fix same identity green1/1 exit0. Four ownership-receipt controls4/4 exit0 (reused,zombie,unlisted-live,copied metadata), startload5.07. Entire system-processes.test.ts59/59 exit0,14.524s file wall,startload4.67; Linux cases are synthetic boundary controls, not a Linux run. Native slot released and no generator remains. No whole changed suite-cancel file at this product head yet; configured verification will run it after review. C1 product branch verified; C2 implementation done with deterministic proof; C3 load20 still pending source review and fresh slot. Old failed loaded rounds remain failed. Publication T-1981 fallback still applies.

### rev-39 · 2026-11-18T19:31:05.909Z

verdict: review
result: not clear
by: rev-39 [reviewer]
run: rev-20261118-1758-source-4
commit: 2e48d0b1e980f5cb14d2ce3ee2243954304ddf92
scope: full
findings: [{"severity":"high","text":"pidAlive(false) is treated as positive PID absence, but project.pidAlive also returns false for unexpected kill(0) errors such as EIO. With an omitted ps row and unreadable native identity, #end returns true and this condition deletes a potentially live retained descendant, allowing cleanup/reporting without a death receipt. Reuse the shared ESRCH-only absence policy and retain unknown outcomes.","file":"hub/src/executor/local.ts","line":185}]
finding_counts: {"high":1,"medium":0,"low":0}

Full product source review at2e48d0b1e980f5cb14d2ce3ee2243954304ddf92, no dev merge since original base d7050e7e2. One high Standards/Spec finding under rules9/25/39, independently confirmed from project.pidAlive lines179-185 and #drainCaptured; implementer self-review2c060d11 identified the same issue before settlement. branchAbsenceFailure already distinguishes ESRCH from unknown errors and is the appropriate shared-policy owner. Add a deterministic EIO/unreadable/omitted-row control alongside native exited/absence/reused-birth controls.

Reviewed additive synchronous onCaptured emission before termination and for verified newly discovered descendants; LocalExecutor per-lease WeakMap retention across incomplete attempts; cancel/release drain before root recovery; positive native-birth fencing; optional-consumer inventory and matching README/running/file guidance. Serialized lease/resource and wire/help shapes remain unchanged. The reparent-before-retry regression addresses the concrete per-call capture-loss mechanism, while exact historical first-attempt abort remains unknown. No additional source finding identified in this pass. Source-only diagnostics remain valid evidence seams, not product completion.

Reported candidate checks on local macOS arm64 Node24.21.0: same synthetic retry regression original-product red then fixed green1/1; four synthetic ownership controls4/4; system-processes59/59 (Linux cases synthetic, not native Linux); lint/typecheck exit0 with report-only130/63 retained. No full changed suite-cancel execution, C3 loaded20 or configured verify on this head. Prior loaded failures remain failed. C2 failed; C1 historical product diagnosis remains established but no new criteria verified; C3 pending. Reviewer ran no tests/probes/edits. Publication T-1981 authorized item-comment/request fallback continues, no helper retry or alternate publication. Source pin released for the bounded shared absence-policy correction; new head needs fresh source review before verification.

Criteria: C2 failed (Retained capture can be deleted on EIO/unknown kill(0) failure with missing native identity/table row, allowing report-before-confirmed-death.).

### impl-1758 · 2026-11-18T19:33:31.557Z

Self-review/Reviewer source4 positive-absence finding corrected in working candidate after EIO regression red/green. Original2e48d0b1e product: 'cancel retained descendant requires a positive unreadable native receipt' fails with literal 'Missing expected rejection', expected /captured descendant exit receipt/, native exit1/0pass1fail. Strict reuse of exported system-processes.branchAbsenceFailure (ESRCH-only) applied; same identity green1/1 exit0. Missing native/table proof plus EIO now retains capture. Same shared policy already used inside endProcess; search for branchAbsenceFailure finds only system-processes and LocalExecutor, no additional consumer to migrate. All other wire/resource/CLI bytes unchanged. Local macOS arm64 Node24.21.0, no load, start4.42/4.36; slot released. Typecheck0, full lint rerun pending before corrected-head source review. Prior4 ownership controls/59 process regressions remain receipts on prior candidate, not rerun at this delta. C3 and configured verify still pending; all prior loaded failures retained.

### impl-1758 · 2026-11-18T19:36:02.396Z

Corrected product head2617b37ae17603fc669a1793204d75f283a731ab committed/pushed; source review requested after sole high EIO/unknown-absence finding at2e48d0b1e. Strict shared branchAbsenceFailure(pid,[]) now supplies ESRCH-only absence proof; unknown liveness errors retain captured ownership. No new serialized/wire field. EIO regression red on2e48d0b1e 'Missing expected rejection', exit1/0pass1fail; corrected source green1/1 exit0. Full current typecheck/lint exit0 ('test lint refusals:0', report-only130/63), diffcheck0; local macOS arm64 Node24.21.0 unloaded start4.42/4.36. Old red/green/4controls/59process receipts retained on prior candidate; C3 and configured verification still pending. Native slot released. PublicationT-1981 authorized fallback continues.

### rev-39 · 2026-11-18T19:38:29.863Z

verdict: review
result: not clear
by: rev-39 [reviewer]
run: rev-20261118-1758-source-5
commit: 2617b37ae17603fc669a1793204d75f283a731ab
scope: full
findings: [{"severity":"high","text":"Initial validation can return leader=null for a later unreadable child before onCaptured publishes the already verified leader/children. Those verified identities vanish with this endProcess call; if worker exits and detached children reparent before retry, LocalExecutor has no retained map to drain and can report cancellation while they remain live. Preserve the verified subset at the incomplete boundary after self/ancestor safety checks, without granting unknown identities signalling authority.","file":"hub/src/system-processes.ts","line":145}]
finding_counts: {"high":1,"medium":0,"low":0}

Full source re-review at2617b37ae17603fc669a1793204d75f283a731ab. Prior source4 high EIO finding is resolved: retained drain now imports unchanged shared branchAbsenceFailure(pid,[]) and accepts only ESRCH absence when native exit/different birth is unavailable. Authored unreadable/EIO control retains the capture and confirms later observation recovery; implementer reports red on2e48d0b1e then same-case green on candidate, local macOS arm64 Node24.21.0, native exit1 then0. Full lint/typecheck exit0 reported; earlier ownership4/4/process59/59 remain earlier-candidate receipts, not rerun evidence.

One remaining high initial-validation capture-loss finding, confirmed by implementerfecbdda6. No omitted owner or intentional exclusion. Source trace: owned receives verified leader/children, later unknown live child returns null at133, null returns false at145, onCaptured at146 is skipped; retry after worker exit has no retained verified identities. C2 failed. Historical product diagnosis remains; no criterion verified in this pass; C3 loaded20/full changed file/configured verify remain pending. Reviewer ran no tests/probes/edits.

Coordinator412d4ef0 defines the final-round bar: every descendant verified during the run must reach native exit/ESRCH or keep cleanup incomplete across reparenting/retries/partial validation, and missing identity grants no signalling authority. This gap is inside that bar; next source review is the last correction round. Any newly found edge outside the bar will be reported for follow-up, not added to this head. Preserve existing safety refusal and add deterministic initial-validation red/green. Source pin released for this bounded correction; new head requires fresh review. T-1981 authorized item-comment/request fallback continues without publication retries.

Criteria: C2 failed (Initial partial validation can discard already verified descendants before onCaptured; reparent-before-retry then bypasses retained cleanup.).

### impl-1758 · 2026-11-18T19:42:16.248Z

Final-round partial-validation regression proof (candidate atop2617b37ae), native slot444155a6 released. Both unreadable-sibling snapshot orders red on original product: 'verified partial capture drains after reparenting; unknown sibling stays untouched', actual known420101+unknown420102 versus unknown420102 only; exit1/0pass2fail. Correction scans eligible verified siblings across the incomplete snapshot and publishes the verified subset under the same self/ancestor guard before returning incomplete; no signal authority for unreadable sibling. Both variants green2/2 exit0. Targeted system-processes initial-validation/authority controls23/23 exit0,3.991s file wall, startloads7.23/5.77/5.08, local macOSarm64 Node24.21.0 (Linux controls synthetic, no native Linux run). Current typecheck0; T1 until.test.ts7/7 exit0,startload4.23. Full lint running before final source review per cap412d4ef0. No outside-bar additions. Native slot released; C3 still pending source clear/new slot.

### impl-1758 · 2026-11-18T19:50:51.905Z

Final capped correction includes initial validation AND grace discovery partial capture, per Coordinator412d4ef0/3f8a8d00. Both initial sibling orders red against2617b37ae product (verified420101 lost beside unknown420102), corrected2/2 green. Grace unknown-first red against current pre-correction product: 'verified grace discovery survives partial failure and reparenting', actual [420102,420101] vs[420102]; unknown-last already passed, so original2-case native exit1/1pass1fail. After approved collect-all-verified-before-incomplete correction, both grace orders green2/2 exit0. Missing identities gain no authority; self/ancestor fence applies before initial partial receipt. Targeted shared initial-validation/authority controls23/23 exit0 on initial corrected candidate; no whole-project pass claim. Local macOSarm64 Node24.21.0, unloaded native slots444155a6/407e32d6 released, no active generator/process. Current typecheck0, T1 until7/7 retained, full lint running before LAST source review. No more self-audit additions; further edges follow up under cap. C3 and configured verify still pending.

### impl-1758 · 2026-11-18T19:53:48.558Z

Final capped source head500f78de47f5fca62e3b35929aa18a127603c9ec pushed/requested review. Initial and grace partial-validation sibling-order regressions red/green retained; correction collects every eligible verified sibling before incomplete return/throw, same self/ancestor fence, unknown sibling unsignalled. Current typecheck0, full lint0 ('test lint refusals:0'; report-only130/63), diffcheck0. T1 until7/7; initial corrected candidate targeted process23/23; current grace2/2. Prior red/green/process controls keep original candidate scope. Native slots released. C3 and configured verification pending source clear/window; no prior failure counted as proof. Per cap, further edges follow up only; review request contains one unproven reservation-boundary fault-injection follow-up (Tech debtS), no head addition.

### rev-39 · 2026-11-18T19:55:31.823Z

verdict: review
result: clear
by: rev-39 [reviewer]
run: rev-20261118-1758-source-6
commit: 500f78de47f5fca62e3b35929aa18a127603c9ec
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final capped source review at500f78de47f5fca62e3b35929aa18a127603c9ec, base d7050e7e2 with no later dev merge. Standards0 findings; Spec0 findings within Coordinator412d4ef0/81c8a20a's approved scope. Source5 partial-validation high finding is resolved: initial validation collects eligible verified siblings independently of unreadable-sibling order, invokes the shared self/ancestor fence before publishing the verified subset at the incomplete boundary, and still refuses the incomplete tree. Grace discovery likewise defers unreadable-child refusal until eligible verified siblings have been retained/notified. Unknown identities remain unsignalled. Both first/last sibling orders have authored deterministic controls retaining the known child across parent exit/reparenting. Earlier strict ESRCH-only absence, native-exit/reused-birth checks, per-lease live captures, copied-metadata isolation and drain-before-recovery/reporting remain intact. No product dependency on opt-in diagnostics or serialized capture authority.

Explicit deferred case/limit: a non-HubLocked reservation-acquisition rejection can occur after a grace child's native identity is observed but before owner.capture completes and owned.set/onCaptured runs. That fault-injection path has NOT been reproduced or covered by these receipts. Coordinator81c8a20a explicitly defers it, together with the reservation notification-ordering test, to a separate follow-up under the final-round cap. It is not a claim of complete coverage over every acquisition failure. Proposed follow-up category Tech debt, sizeS; source locations system-processes.ts grace extend and termination-owner.ts capture. This deferral is traceable to the named decision; no extra head expansion is requested.

Reported local macOS arm64 Node24.21.0 evidence: initial partial-validation two-order red at2617 then corrected2/2 green; grace original unknown-first red/unknown-last green (1pass1fail), corrected2/2 green; targeted existing process23/23 on the initial corrected candidate before final grace delta; current grace2/2; T1until7/7. Prior reparent/EIO red-green,4ownership controls and59process cases retain their earlier candidate scope. Full final-source typecheck/lint exit0 ('test lint refusals:0', report-only130/63), diffcheck0. These selected synthetic/native-boundary receipts are not a full current-head changed-file or Linux run. No C3 loaded20 or configured verification yet; all earlier loaded failures remain failures. No browser runtime.

No criteria verified at this source-only pass. C1 historical product diagnosis remains established but stale to earlier head; C2 source finding resolved but implementation done must be restored after the failed mark; C3 remains incomplete. After source clear, request Coordinator's fresh native slot/T0clear for C3 and mode-free configured window at this exact head. Any changed head requires source review. Reviewer performed reads only, no tests/probes/edits. PublicationT-1981 authorized item-comment/request fallback remains; no helper retry, alternate publication or retained-snapshot change. Source clear is not final readiness.

### impl-1758 · 2026-11-18T19:58:35.581Z

C3 failed on source-clear500f78de47f5fca62e3b35929aa18a127603c9ec, product-attempt1/run1. Literal error 'cancelled result after complete tree cleanup: not within 21154.541015625 ms'; native exit1/0pass1fail, no skip/cancel. macOSarm64 Node24.21.0, exported factor1.410302734375, startload13.10302734375/end17.49169921875. Observed runner interval41.727s excludes burner warmup/acquisition and early launch/identity-registration; no speed comparison or configured-pass claim. Diagnostic opt-in disabled for C3, so current cause/native child state unknown; this does not establish another report-before-death receipt. BurnerPID80007 stopped/nativeSIGKILL close confirmed; native slot released. All failed rounds retained separately; no C3 success, no head change/rerun under cap, decision requested before proceeding.

### rev-39 · 2026-11-18T20:06:33.942Z

verdict: review
result: clear
by: rev-39 [reviewer]
run: rev-20261118-1758-criteria-7
commit: 500f78de47f5fca62e3b35929aa18a127603c9ec
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Criterion evidence pass at unchanged500f78de47f5fca62e3b35929aa18a127603c9ec under Coordinatorc6b4fc99. task.view now contains only C1/C2; C3 is explicitly split to T-1986 with its failed round and3/3 instrumented diagnostics. Source remains clear under rev-20261118-1758-source-6 and Coordinator412d4ef0/81c8a20a's approved scope/explicit reservation-fault deferral. No findings in that scope. This is pre-configured criterion settlement, not a configured-verification/final-ready claim.

C1 verified: earlier exact cancelled-report receipt suite:c462e426-20c2-4dd9-a9ec-7ab4cb752c43 coexisted with captured live native identity darwin:1795028546:450257, stateSs,parent1,processAlive=true. This establishes the product branch, not a zombie/PID-retirement-only race. The exact historical abort reason remains unknown. Deterministic retry/partial-initial/grace controls reproduce the concrete per-call ownership-loss mechanism before correction and retain/drain verified identities afterward.

C2 verified against reviewed source and recorded red/green receipts: original reparent-before-retry control red0/1 then corrected1/1; initial partial sibling orders red0/2 then corrected2/2; grace unknown-first red/unknown-last green, corrected2/2 at final source. EIO missing-proof red 'Missing expected rejection' then corrected1/1; strict shared ESRCH policy retains unknown outcomes. Reused/native-exit/unlisted/copied-metadata controls remain scoped to their recorded earlier candidates, not relabelled whole final-head execution. Current source preserves those paths and publishes eligible partial captures under self/ancestor checks before incomplete returns; unknown identities gain no signal authority. Native cancellation/release drain before root recovery/reporting. Recorded regression literals and candidate identities are retained in prior item comments under T-1981 publication fallback.

Read same-head product-diagnostic-1 receipts/logs: three selected local macOSarm64 Node24.21.0 native attempts each exit0/1pass0fail0skip0cancel. They include external pass-through observation I/O and do NOT prove20/20 or whole-interval load compliance (third endload21.009). Current failed noninstrumented C3 run remains failed: 'cancelled result after complete tree cleanup: not within 21154.541015625 ms', native exit1; its native cause is unknown because no samples were emitted. Coordinator moved this follow-up evidence to T-1986 rather than treating failure as a pass.

No browser/configured suite/full changed-file proof exists yet at this head. C1/C2 verified now at Coordinator's explicit instruction; configured mode-free result remains required before final-ready/merge. Wait for the Coordinator's window; no verification submitted by Reviewer. Deferred non-HubLocked reservation-acquisition rejection path remains unreproduced/uncovered, explicitly deferred by81c8a20a and not silently waived by these marks. Reviewer read source/task/retained receipts only, no tests/probes/edits. PublicationT-1981 authorized comment/request fallback continues.

Criteria: C1 verified, C2 verified.

### impl-1758 · 2026-11-18T20:11:06.448Z

C3 moved to T-1986 by Coordinator c6b4fc99; T-1758 scope is C1/C2, current-head verified in rev-20261118-1758-criteria-7. Final evidence published through mandated positive-control scanner/helper as A-21402, durable path /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-21402-t-1758-product-proof-and-retained-loaded-diagnostics (README entry). Initial final scan refused private absolute TAP locations; export paths redacted to source-location IDs, rescanned/published successfully; original T-1981 private snapshot untouched. All capture writers/native burners closed before export; staging removed and tracked/untracked worktree clean at500f78de47f5fca62e3b35929aa18a127603c9ec.

Configured mode-free verify submitted once/admitted run fc7b395b-12e2-46fc-93dc-36079f5d25b4, CLI exit0/admission receipt, T0 local host check currently running. No configured runtime pass claimed. Window release awaits exact T0 exit0/delivery receipt; Reviewer receives same-head result. Earlier tracker ready event preceded this run and is not a verification receipt.

### rev-39 · 2026-11-18T20:33:47.940Z

verdict: review
result: clear
by: rev-39 [reviewer]
run: rev-20261118-1758-final-8
commit: 500f78de47f5fca62e3b35929aa18a127603c9ec
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final configured evidence clear at unchanged clean500f78de47f5fca62e3b35929aa18a127603c9ec. Source6 and criteria7 remain applicable under Coordinator412d4ef0/81c8a20a/c6b4fc99 scope decisions. Configured mode-free runfc7b395b-12e2-46fc-93dc-36079f5d25b4 reports passed at this exact head; durable native log A-21409. No findings within approved scope. C1/C2 verified with this final run.

Independently audited all19 generated suite-cancel identities in suite timing records, each outcome pass in one changed-T3-file execution. Required identities include initial partial validation unreadable sibling first/last, grace discovery first/last, detached reparent-before-retry, reused/zombie/unlisted/unreadable native receipts, copied capture metadata, delayed kernel-retirement distinction, both real detached cancellation/root variants and unchanged public refusal/restart cleanup controls. These receipts supplement recorded deterministic pre-fix red/corrected green and the source ownership/strict absence audit. They are not five-repetition T3 coverage or a20/20 macOS load proof.

Actual completed phases: T0exit0, all selected T1/T2 exit0, changed T3 suite-cancel19/19 once exit0, Webexit0. Aggregate6868/6868,0fail/cancel/skip/todo. Remaining T3 belongs to the merge batch; T4 unexecuted. Linuxx64 c-8ams3 droplet, Node24.21.0, configured workers2. Actual browser metadata at A-21409 line36712 names Chrome Headless Shell binary chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell, version Google Chrome for Testing156.0.8078.4. Duration/budget/ratchet growth/lint diagnostics are explicitly report-only; native run exits0, no enforcing failure hidden by those advisories.

Limits retained: C3 was removed from this item and split to T-1986. Its prior failed loaded attempts remain failed; the3/3 instrumented diagnostic round is not uninstrumented load20 compliance, and the third ended above20. No such claim is made by final clearance. The unreproduced non-HubLocked reservation-acquisition rejection before grace owned.set/onCaptured remains explicitly deferred by Coordinator81c8a20a, with its reservation fault-injection follow-up; it is not covered by this pass. Historical initial abort cause remains unknown even though the concrete retention-loss mechanism has deterministic red/green evidence.

Reviewer ran no tests/probes/edits/browser, only task/source/log reads. Final scanned implementer evidence A-21402 and configured log A-21409 are durable. This comment continues the authorized review-summary fallback, with no original failed-snapshot/helper retry. Final review clear for current C1/C2; ordinary queued merge-batch gate remains.

Criteria: C1 verified, C2 verified.

### impl-1758 · 2026-11-18T21:46:25.288Z

Batch compatibility finding attributed by Coordinator dcd2bb9a (run30dfc993/batch a45b872f, not T-1807): measure-memory's replaced-lease case pins /could not verify/, while the new capture-owner throw replaced that primary refusal. This reader was in the86-consumer inventory but was incorrectly classified shape/outcome-unaffected. Literal local red at500f78de4: 'The input did not match the regular expression /could not verify/', actual 'Error: suite capture owner changed during cleanup', native exit1/0pass1fail.

Narrow correction keeps each existing caller-specific refusal in one shared constant map; #end receives that primary and appends owner change only as a secondary diagnostic. No tracking, signal authorization or wire/resource shape change. Existing replaced-lease assertion retained/strengthened to check compatible cancellation prefix and secondary detail. Exact case green1/1; full measure-memory.test.ts58/58 exit0 (38.924s file); affected cancellation controls10/10 exit0 (5.137s file), serial/unloaded macOSarm64 Node24.21.0. Native slot released. Current typecheck0/diffcheck0; full lint running before fresh narrow review/new configured window. Prior configured green belongs to500f78de4 only; no new-head pass claimed. Search of old/new refusal wording across production, all test tiers, nvim/web/shared, skills/QA/docs confirms direct pins in measure-memory and suite-cancel; help/frozen CLI usage bytes unchanged.

### impl-1758 · 2026-11-18T21:49:24.120Z

Narrow batch correction committed/pushed at da3052c638bdb8da7fab7fe2f0a29cdb7779dd9a; worktree clean, no dev merge. Primary caller-specific could-not-verify refusal preserved through shared constants; owner change is secondary detail. Existing replaced-lease consumer test strengthened rather than migrated to a new refusal. Local red/green + full measure-memory58/58 + affected controls10/10, full typecheck/lint0/diffcheck0 retained in scanned A-21435 at durable path /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-21435-t-1758-refusal-compatibility-evidence-at-da3052c63.md. Native slot released. Fresh narrow source review requested; old batch failures and500f78de4 configured receipt retain their old scope. New exact-head configured verification pending review/window. C3T-1986/deferred reservation limits unchanged.

### rev-39 · 2026-11-18T21:50:10.872Z

verdict: review
result: clear
by: rev-39 [reviewer]
run: rev-20261118-1758-source-9
commit: da3052c638bdb8da7fab7fe2f0a29cdb7779dd9a
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Corrective source clear atda3052c638bdb8da7fab7fe2f0a29cdb7779dd9a. Three-file delta from500f78de4; no dev merge. Shared cleanupRefusal constants preserve all four existing caller primary strings and supply both #end's owner-change error prefix and the false-return refusal. Owner change appends secondary detail; capture/authority/signal/wire/resource/help behavior unchanged. Existing replaced-lease test keeps /could not verify/, adds stale-lease primary-prefix/secondary checks and preserves foreign-signal expectations. Matching guide/consumer wording pins reviewed. Standards0/Spec0 findings. Report A-21436 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-21436-t-1758-refusal-compatibility-source-at-da3052c63-clear.md).

A-21435 retains exact old red versus compatible new same-case green1/1, full measure-memory58/58 and selected cancellation10/10; local macOSarm64 Node24.21.0/unloaded. Final lint/typecheck exit0 reported, report-only130/63 unchanged. Old batch30dfc993/rerunf7b1c0b9 remain failures; old configured6868/6868 remains500f78de4 evidence only. No criteria reverified at new head until configured result. C3T-1986 and Coordinator-deferred reservation-fault limit remain. Reviewer tests/probes/edits:none. Request fresh Coordinator window/mode-free verification at unchanged corrected head; this source pass is not final readiness.

### rev-39 · 2026-11-18T22:20:56.068Z

verdict: review
result: clear
by: rev-39 [reviewer]
run: rev-20261118-1758-final-10
commit: da3052c638bdb8da7fab7fe2f0a29cdb7779dd9a
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final corrected-head evidence clear atda3052c638bdb8da7fab7fe2f0a29cdb7779dd9a. Source9/A-21436 plus configured295b5e96-1e21-4053-a20e-ddd55815e4dd/A-21442, exact head verified by task.view and Git. Aggregate6926/6926,0fail/cancel/skip. Audited all19 suite-cancel and57 measure-memory unique passing timing identities (76total) in one base execution of both changed T3 files. The formerly failing replaced-lease primary/secondary refusal control passes, alongside replaced-during-cancel/foreign-signal and all captured ownership controls. C1/C2 verified; no findings within approved scope. Full audit A-21443 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-21443-t-1758-corrected-head-final-evidence-clear.md).

T0/T1/T2/Web and changed T3 exit0; remainingT3 merge-batch deferred, T4 unexecuted. Linuxx64 c-8ams3 droplet Node24.21.0 workers2; actual Chrome Headless Shell1248/Google Chrome for Testing156.0.8078.4 metadata recorded. Duration/budget/ratchet/lint diagnostics report-only. This is corrected-head evidence, not reuse of500f78de4's older6868receipt or prepared-head selected58/58; old batch/rerun failures remain retained.

C3T-1986 and all failed/instrumented load evidence keep their separate scope; no20/20 claim. Non-HubLocked reservation-acquisition rejection remains unreproduced/uncovered and explicitly deferred by Coordinator81c8a20a under final-round scope. Reviewer ran no tests/probes/edits/browser. Final clear for C1/C2 at current head; normal merge-batch gate remains applicable.

Criteria: C1 verified, C2 verified.

### coord · 2026-11-18T23:22:34.133Z

Merged d589cd4015420d50280e94a32b1f9b68c7e4f79c onto dev.
