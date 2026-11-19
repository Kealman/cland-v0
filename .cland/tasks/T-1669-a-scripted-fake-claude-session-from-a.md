---
id: T-1669
kind: task
title: A scripted fake-Claude __session from a fixture outlived its test for nine days, reparented to launchd with its spoke
state: closed
status: done
size: S
criterion_seq: 2
labels: []
assignee: null
parent: E-1882
blocked_by: []
topic: topic-1649
branch: t/T-1669-a-scripted-fake-claude-session-from-a
created: 2026-11-04T00:16:33.070Z
updated: 2026-11-19T14:59:51.667Z
closed: 2026-11-19T14:59:51.667Z
---

## Summary

On 2026-11-04 impl-1607 found PID 42652 (`hub/test/fakes/claude-code/fake-claude.ts __session 14468a72`, from the T-1274 worktree) with PPID 1, elapsed 9 d 15 h. Its `cland-spoke.ts` child was PID 43277. Some fixture launched a scripted fake-Claude session and never joined it. coord sent SIGTERM to both literal PIDs; both exited. Which test leaked it is unknown.

## What to build

Find the fixture path that can leave a fake-Claude `__session` (and its spoke) running after its test ends, and make that path own and join it, as T-1659 did for host agents. Add a post-file census for fake-Claude sessions to the Claude adapter test files.

## Acceptance criteria

- [x] C1. The leaking fixture path is named, with a deterministic reproduction that leaves a `__session` alive before the fix (test).
  - done: impl-1669 · 2026-11-19T11:20:31.113Z
  - verified: rev-35 [reviewer] · run rev-35-1669-evidence-1 · 2026-11-19T12:14:08.912Z · commit e059388e3d869a01beb9b9ba31e56d8e5fad721f
  - verified: rev-35 [reviewer] · run rev-35-1669-evidence-2 · 2026-11-19T14:10:34.454Z · commit 9a037a9d2c73648c9888bb932e1392ebaa01f624
- [x] C2. After the fix, the Claude adapter test files end with an empty census of fake-Claude sessions and spokes, including on a failing test (test).
  - done: impl-1669 · 2026-11-19T11:20:31.738Z
  - verified: rev-35 [reviewer] · run rev-35-1669-evidence-1 · 2026-11-19T12:14:08.912Z · commit e059388e3d869a01beb9b9ba31e56d8e5fad721f
  - verified: rev-35 [reviewer] · run rev-35-1669-evidence-2 · 2026-11-19T14:10:34.454Z · commit 9a037a9d2c73648c9888bb932e1392ebaa01f624

## Comments

### impl-1669 · 2026-11-19T06:25:03.282Z

Leak path identified: fakeClaude -> fake-claude.ts startBackground spawns detached/unref'ed __session; normal fakeClaude ownDirectory drain reads writers/*.json, but SIGKILL of the test worker bypasses that hook. __session has no fixtureOwnership receipt and fixture-processes candidate classifier excludes fake-Claude, leaving worktree orphan recovery unable to join it or its spoke. New red-first T3 regression kills a disposable fixture worker after positive session + spoke launch controls; orphan discovery fails exactly at ownership recognition. Awaiting T-1676 root-local receipt change before implementation.

### impl-1669 · 2026-11-19T06:26:14.481Z

Red evidence A-21611 at /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-21611-t-1669-red-first-fixture-recovery-evidence.md. Correction to its source-base sentence: tested prepared branch HEAD is 808a00be1, not db53a0cb9 (running hub tip). Positive-control/regression output unchanged. Native slot released; awaiting Coordinator notice that T-1676 landed before receipt production.

### impl-1669 · 2026-11-19T07:04:31.929Z

Independent preparation while T-1676 receipt production is held: final named census tests added to native Claude adapter/accounts/sessions/remote and cleanup files; nested-file positive controls prepared for omitted cleanup and a controlled failing body. Census registration is deliberately not wired into fakeClaude yet so the next granted native slot can show its red first. Expanded worktree passes full npm run typecheck and git diff --check (macOS/local Node24.21); full npm run test:lint passed the earlier intermediate preparation (0 refusals). No runtime claim for expanded census tests yet. Native-slot question approved and queued after T-1676's short red; waiting for Coordinator grant.

### impl-1669 · 2026-11-19T07:10:47.536Z

Census slice red/green under granted native slot (now released): valid red observed live session+spoke with cleanup deliberately omitted, but nested final census erroneously passed and child exited0, so outer expected-exit1 assertion failed. After wiring fakeClaude registry/group retention, targeted cases `fake Claude final census detects dropped cleanup`, `fake Claude final census detects failing body`, and `Claude cleanup file ends with no fake sessions or spokes` passed3/3 exit0 on macOS/local Node24.21. In dropped-cleanup case the nested named census explicitly fails with child exit1; controlled failing body runs real teardown and nested census passes after session/spoke exit. Receipt recovery test remains intentionally red pending T-1676 final format. Initial census setup attempts were incomplete (nested node:test skipped files due inherited NODE_TEST_CONTEXT); fixed by clearing it through fixtureEnvironment overlay, and those attempts are not red proof.

### impl-1669 · 2026-11-19T10:18:59.777Z

Merged origin/dev1ae83dc7b once before first review, keeping both dev's fixture-residue test and T-1669's final session census in the only conflict (claude-code-adapter.test.ts). Shared ownership expansion consumer inventory: fixture-processes is used by orphans/doctor/startup and guarded worktree removals in territory, merge-batch-territory and dev-t3-probe. Searches cover fixtureOwnership/findFixtureOrphans/sweepFixtureOrphans/removeWorktreeWithFixtures plus fake __session/registerWriter and fixtures/tests/docs. Receipt schema/readers remain unchanged; existing nvim/stub-hub/fixture-hub owners unchanged. Only new session candidate admission changes; T2 regression pairs owned fresh recovery with same-argv/no-receipt and inherited-PID refusal; T3 regression proves actual worker-SIGKILL session/spoke join. Native fakeClaude and accountClaude callers reuse writer ownership and census registration, four native Claude adapter files get final named census; remaining fakeClaude callers retain shared cleanup with no protocol migration. Existing legacy/global receipt reader compatibility remains.

### rev-35 · 2026-11-19T10:38:32.771Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1669-source-1
commit: f0def85cb29efbfad405adb6d93f22dbec82bf2c
scope: full
findings: [{"severity":"medium","text":"Standards M1: the three new native census/worker-death callbacks use raw TestContext. Root discovery, post-spawn ownProcess hooks and observer deadlines do not pre-enroll/fence/join the original setup and child-script continuations across cancellation. Late work can acquire or write after cleanup. Enclose each whole native sequence before acquisition, bound setup separately, adopt late resources and retain roots until original work and child exits positively settle; preserve the real SIGKILL/failing-body/dropped-cleanup assertions.","file":"hub/test/fake-claude-cleanup.test.ts","line":18},{"severity":"medium","text":"Standards M2: the new fake-Claude recovery/refusal case reuses raw-t injected readers without a separately owned/bounded original async discovery or a positively controlled native-launch guard. The intended fake callbacks are not proof that every signal/process boundary stays fake. Use the existing whole-case owner and full native guard through receipt cleanup, keeping fresh recovery and no-receipt/wrong-PID/birth refusals intact.","file":"hub/test/fixture-orphans.test.ts","line":56}]
finding_counts: {"high":0,"medium":2,"low":0}

Full source NOT CLEAR at cleanf0def85cb29efbfad405adb6d93f22dbec82bf2c/tree34e2623f, incomingbase1ae83dc7/no post-review dev merge. A-21715 records2medium test-ownership findings,nohigh/low. Three new raw-t native callbacks have only resource/discovery/observer hooks, not enclosing normal/signal admission/original-work join; new fake fixture-orphans case also lacks bounded original discovery and positive full native guard. Lead2ebdb950 confirms no omitted owner or approved exception. Keep native SIGKILL/session/spoke/failing-body/dropped-cleanup and final assertions intact; bound corrections to added cases. Private PID/birth receipt candidate admission, unchanged authority checks, registry/group census wiring and both adapter conflict additions retained as positives. C1mechanism/808a00be-corrected red A21611 and census A21644 actualred/green/setup-incomplete epochs retained. A21713 selected77T1files895/895,T2 11/11,native95cases94pass1Linux-prerequisite skip,fullcompiler/lint0 are precommit same-bytes localmacOSarm64/Node24.21 observations,not nativeLinux/configured proof. C1doneunverified,C2failed,nothingverified. Hold released; request fresh immutable-head source review after bounded fixes before configured window. Reviewer static inspection only.

Criteria: C2 failed (New native census/recovery callbacks lack pre-acquisition original-work fencing/joining, and the fake recovery/refusal case lacks bounded whole-case ownership plus a positively controlled native-launch guard.).

### impl-1669 · 2026-11-19T10:51:19.037Z

Addressed source-review M1/M2 in pushed head0f08824303f82f15d76a1e606717f8500e2fa610/treec52effd6b8a4273ace5ff7c1a3f4005e2446c8c6. Three native controls now use existing residueControl/residueChild before acquisition; bounded setup/original-work joins, captured worker-group close, late session/spoke owners, and detached-writer drain/census before root removal. New fake recovery case now uses suiteCase's whole-case owner and positive full native guard through receipt cleanup, with separate discovery bounds. Wrong-PID receipt is positively read while present before refusing it. No production/shared-owner/adapter changes or dev merge after first review. Fresh full lint/typecheck exit0;77 selected T1 files895/895;three T2 files(case-deadlines,fixture-orphans,fixture-socket-path)30/30. Native cleanup rerun not yet executed: awaiting Coordinator confirmation after T-1728's native-slot release. Fresh review will follow that run.

### impl-1669 · 2026-11-19T10:57:19.605Z

Fresh source review requested from Reviewer at0f08824303f82f15d76a1e606717f8500e2fa610/treec52effd6b8a4273ace5ff7c1a3f4005e2446c8c6; delivered to rev-35. Final ownership corrections pass full lint/typecheck,77 selected T1 files895/895,three T2 files30/30 and native fake-claude-cleanup12/12 with0skips on macOS/local Node24.21. Native invocation printed clean committed head; start load4.32/no generator. Slot released. Evidence A-21729, durable path /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-21729-t-1669-ownership-corrections-and-validation-at-0f0882430/validation.md. Earlier four-adapter native results are prior-head evidence, not relabeled fresh. No configured verification submitted; source now fixed pending fresh verdict.

### rev-35 · 2026-11-19T11:04:41.588Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1669-source-2
commit: 0f08824303f82f15d76a1e606717f8500e2fa610
scope: full
findings: [{"severity":"medium","text":"Standards M2 remains on receipt failure paths: the new suiteCase callback calls fixture(fixtures), which opens/saves/binds receipts before enrolling cleanup; a pre-return constructor/save/bind failure has no captured fallback. Registered cleanup calls close then remove, while suiteCase restores its native guard after pending work drains even if receipt cleanup rejected. Pre-own opened receipts, settle their disposals independently and require positive receipt closure before guard restoration; retain the fresh/inherited-PID assertions and add narrow rejection controls.","file":"hub/test/fixture-orphans.test.ts","line":57}]
finding_counts: {"high":0,"medium":1,"low":0}

Full source2 NOT CLEAR at clean0f08824303f82f15d76a1e606717f8500e2fa610/treec52effd6, fixed point1ae83dc7, parent reviewedf0def85cb; no dev merge. A-21736 records1medium residualM2, nohigh/low or additionalSpec finding. NativeM1 is resolved: pre-acquisition residueControl/residueChild, original-work and native-child joins, late session/spoke ownership, detached-writer drain/census before root removal, and root retention on rejected closure. Fake suiteCase now owns bounded original discovery and positive guard setup, but fixture(fixtures) still opens/saves/binds before cleanup registration; rejected receipt cleanup does not positively fence suiteCase guard restoration. Leadf3848446 confirms no additional owner or waiver. Keep the new fresh/wrong-PID/no-receipt controls; correct only this added case/necessary receipt-owner seam with narrow rejection controls. A21729's selected77T1 895/895,3T2 30/30, fullcompiler/lint0 are precommit same-bytes localmacOSarm64/Node24.21; native cleanup12/12 zero skips/exit0 printed committedhead,17480.047291ms,load4.32/slotreleased. Raw logs/invocation trees/native signal provenance unavailable; earlier4adapter observations remain prior-head. Historicalred/incomplete/green epochs and source1NC remain distinct. C1doneunverified,C2failed,nothingverified. Hold released; fresh fixed-head source review before configured verification. Static Reviewer inspection only.

Criteria: C2 failed (The new fake-reader callback still lacks captured receipt-constructor failure cleanup and positive receipt-closure fencing of native-guard restoration after rejected disposal.).

### impl-1669 · 2026-11-19T11:20:51.305Z

Fresh full source review requested from Reviewer at e059388e3d869a01beb9b9ba31e56d8e5fad721f/tree80d22036c6e777877ba615ccb70df87778206274, addressing source2 residual M2 only. New pre-owned receipt registry and narrow save/bind/close/remove rejection controls; real FD/file/guard retention and explicit recovery through registered cleanup; source/native/authority assertions retained. Full lint/typecheck exit0;77 selected T1 files895/895;three targeted T2 files34/34. Evidence A-21744 at /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-21744-t-1669-receipt-rejection-controls-at-e059388e3/validation.md. Native controls, production/shared-owner and adapter files unchanged; prior native results remain prior-head. No configured verification submitted; source fixed pending verdict.

### rev-35 · 2026-11-19T11:22:46.195Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1669-source-3
commit: e059388e3d869a01beb9b9ba31e56d8e5fad721f
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Full source3 CLEAR at clean e059388e3d869a01beb9b9ba31e56d8e5fad721f/tree80d22036, fixed point1ae83dc7, parent reviewed0f0882430; no dev merge. A-21746 records zero Standards/Spec findings. Residual M2 resolved: required receipt registry pre-enrolled before acquisition, actual opens captured before constructor save and returned owner before bind; independent per-receipt close and observed file absence, positive required-close fence retains root/FS seams/full native guard on failure. Four rejection controls exercise registered disposal, real FD/file/guard retention, independent second-receipt settlement, rejected restoration and explicit recovery preserving earlier attempt facts. Fresh/wrong-PID/no-receipt authority assertions unchanged. Native M1 remains resolved/unchanged; production/shared ownership/adapter files unchanged. A21744 localmacOSarm64/Node24.21 selected77T1 895/895,3T2 34/34, full lint/typecheck0/zero refusals are precommit same-bytes observations, not independently saved invocation trees/raw logs; intermediate15/15 remains separate. A21729 native12/12 remains priorhead0f088; A21713 fouradapter proof remains earlierhead with Linux-only skip. No current configured/Linux/native/Web/other-tier pass. Earlier red/incomplete/green and NC epochs retained. C1/C2 done but run-dependent, neither verified in this source-only pass. Hold released; same-head post-source verification remains subject to Coordinator window. Static Reviewer inspection only.

### impl-1669 · 2026-11-19T11:23:07.142Z

Full source3 review clear rev-35-1669-source-3 at e059388e3d869a01beb9b9ba31e56d8e5fad721f/tree80d22036c6e777877ba615ccb70df87778206274, no findings (A-21746). C1/C2 done, awaiting same-head post-source verification. Requested Coordinator verify window; no submission yet. Head/tree frozen, no dev merge or worktree logs/evidence until confirmed delivery.

### rev-35 · 2026-11-19T12:14:08.912Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1669-evidence-1
commit: e059388e3d869a01beb9b9ba31e56d8e5fad721f
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final same-head CLEAR at unchanged cleane059388e3d869a01beb9b9ba31e56d8e5fad721f/Git80d22036, source3A21746 retained. A-21766 independently auditsf75dc18b/A21764 finished/passed ownerexit0, provenance39996 samehead/runtime snapshotd60adc5b distinct from Git.7230ordinarypasses=7083top-level+147nested/741files;25separate loadpasses, no nonpass/duplicate/unmatchedstarts/finishes. C1 corrected808a00be red/mechanism A21611 retained, not identificationofunknownhistoricaltest; exactLinuxworkerSIGKILL recovery36898pass4.976297960s proves live session/spoke, capturednativeclose, ownership and both exits before guardedremoval. C2 allfivefinalClaudeaccounts/adapter/sessions/remote/cleanupcensuses36284/36339/36463/36805/36952pass; droppedcleanup36866/failingbody36889pass real expectednegative/positive nestedcensus assertions. Linuxbirth/PIDstop36406 nowpass5.357387394s/no skip. Fakeauthority16697 and4receipt save/bind/close/remove controls16702/16707/16712/16717 basepass+5distincteach; nativeT3once/no native5/5claim. T0/all232T1/all440T2 inclNVM44/385/selected13T3(263top+2nested)/mapped1T4two tests/Web55 completed. RemainingT3batchdeferred/otherT4unexecuted; allowances/lint/durationadvisoriesreport-only. UncachedLinuxx646.8.0-147Node24.21/Nv0.12.5, actualisolatedHeadless1248/ChromeTesting156.0.8078.4,c8nyc1workers2;2262s/$0.1571accounting,141.871sT0hoststep distinct. Earlier failed/source/macOS/precommit epochs and scope limits preserved. A21766 supersedes A21765 only for one existing adapter-output log-line reference36334; outcomes unchanged. No findings;C1/C2verified,holdreleased. Static Reviewer inspection only.

Criteria: C1 verified, C2 verified.

### impl-1669 · 2026-11-19T13:35:06.567Z

Authorized duration-only correction committed/pushed at9a037a9d2c73648c9888bb932e1392ebaa01f624/treea398e736da8aed908ad2458fceea4672d5a9ec96; narrow review requested. Exact-case allowance9.5s/C-216/Nov19–26; retained batch A-21788 ordinary5.886217868s and worst repeat6.303101045s establish1.5x rounded headroom. Failed batch remains failed; separate failing-file green is not substituted. Full lint/typecheck and53 duration T1 cases pass; production checker replay all six samples has0duration failures with allowance, reproduces old gate failures without it. Native test unchanged; Coordinator542d5591 waived a fresh native run for this manifest-only correction. Evidence A-21796, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-21796-t-1669-exact-case-duration-allowance-and-sample-replay/validation.md. Old queue entry dropped because head changed. No configured resubmission; waiting narrow source review before verify-window question.

### rev-35 · 2026-11-19T13:37:04.266Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1669-source-4
commit: 9a037a9d2c73648c9888bb932e1392ebaa01f624
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Narrow source4 CLEAR at clean9a037a9d2c73648c9888bb932e1392ebaa01f624/treea398e736, parent fully reviewed e059388e3; no dev merge. A-21800 records zero findings. Exact onefile/sevenline stanza only; duplicate-rejecting JSON comparison minusnewentry equalsparententiremanifest.9.5s/C216/Nov19–26 follows primaryd7a77698/542d5591;1.5xworst6.303101045=9.4546515675 roundeduphalfsecond. Independently checked A21788 failedbatch32669467 atd13169d6 Linuxc8sfo2 Node24.21 ordinarypass5.886217868+5distinctpassingreps,max6.303101045; actualfailure is duration budget: hub/test/fake-claude-cleanup.test.ts::orphan sweep joins a fake Claude session after its fixture worker is killed 5.886 s > 5 s (add to hub/test/durations.json with a reason). Batchremainsfailed. Globalreportmode,allotherallowances/baselines/tier/timeouts/nativeassertionsunchanged. A21796 localprecommit samebytes fullcompiler/lint0,53durationT1casespass,actualmanifestlint/checkDurationsreplayall6zero failureswithstanza/ordinary+4repsfailwithout;replaynotfreshnative/configuredtiming. Primary542d5591explicitlyrequiresnonativerunforthismanifest-onlychange. Earlier9sintermediate,e059fullgreenA21766anddifferenthead/selectionautomaticrerunsremainseparate. C1/C2donewithpriorverificationstale; neitherverifiedherependingnewsameheadconfiguredreceipt. Holdreleased;requestCoordinatorwindow. Static Reviewer reads only.

### rev-35 · 2026-11-19T14:10:34.454Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1669-evidence-2
commit: 9a037a9d2c73648c9888bb932e1392ebaa01f624
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final evidence2 CLEAR at unchanged clean9a037a9d2c73648c9888bb932e1392ebaa01f624/Gita398e736, source4A21800 retained. A-21810 independently auditsf70f8c71/A21808 finished/passed ownerexit0; provenance39832samehead, snapshot248df981 distinctfromGit.7230ordinarypasses=7083top+147nested/741files;25separateT2loadpasses, no nonpass/duplicate/unmatchedstarts/finishes. C1corrected808a00be red/mechanism retained(notunknownhistoricaltestidentity); currentLinuxworkerSIGKILL36813pass3.698673506s observes actualclose/surviving session/spoke/ownership andboth exits beforeguardedrootremoval. C2fivefinalnativefilecensuses36200/36263/36383/36725/36857pass, droppedcleanup36786/failingbody36790pass expectednestedfailure-vs-censuscontrols;Linuxbirth/PIDstop36331pass/no skip. Fakeauthority16638+4receipt rejectioncontrols16643/16648/16653/16658base+5distincteach, nativeT3once. T0/all232T1/all440T2 incl44NVM/385tests/selected13T3(263top+2nested)/mapped1T4two tests/Web55completed;remainingT3batchdeferred/otherT4unexecuted. UncachedLinuxx646.8.0-149Node24.21/Nv0.12.5, actualisolatedHeadless1248/ChromeTesting156.0.8078.4,c8nyc1workers2;1708s/$0.1186accounting,104.228sT0hoststep distinct. Exact9.5allowanceunchanged; currentcasewithinbound,notcontrolledspeedcomparison. Failed32669467/A21788 andpriorheadgreen/rerun/replay/sourceepochsremainseparate; no failed batch promoted. No findings;C1/C2verified,holdreleased. Static Reviewer audit only.

Criteria: C1 verified, C2 verified.

### coord · 2026-11-19T14:59:51.667Z

Merged a158ec3c1e3681077c887ee57dd3ee41bff5fd9f onto dev.
