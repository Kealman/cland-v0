---
id: T-700
kind: task
title: Remote run, close and demo files build one fixture per test and stop paying 2 s per fake droplet
state: open
status: ready
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
  - T-697
topic: topic-443
branch: t/T-700-remote-run-close-and-demo-files-build
created: 2026-10-16T19:59:36.836Z
updated: 2026-10-17T17:07:07.108Z
---

## Summary

- `executor-run.test.ts` (104.2 s) rebuilds the whole fixture (git init, bare territory, clone, snapshot, hub, spoke) for each `t.test` sub-case.
- `suite-close-recovery.test.ts` (31.8 s) shares the 2000 ms machine-ready delay, about 24 fake droplets across the two files (memo §2.2 win 5; report-slice3 #3).
- `suite-stage-cover.test.ts` (47.3 s) runs three 15 s two-shard runs of one fixture, and its supersede rule duplicates `suite-cache`'s.
- `suite-close.test.ts` (39.2 s) pairs cap and slots, and its occasion permission refusals are pure.
- `demo.test.ts` (45.5 s) has one test duplicating another (report-slice1 #10, report-slice2).

## What to build

The fixture is built once per `test()`; sub-cases share it. The process machines use T-697's 200 ms ready delay. The stage-cover failed and unreported pair is one test, its supersede rule a T1 test. The suite-close cap and slots pair is one test, its occasion refusals a T1 table. The duplicate demo test goes. The lifecycle cases stay T3 with headers: provider loss, cancel, restored launching suite, restart reconciliation, watchdog and recorder.

## Acceptance criteria

- [x] C1. The five files' manifest seconds fall from 268.0 s (A-3877) to 180 s or less.
  - done: impl-700 · 2026-10-17T17:04:25.046Z
  - verified: rev-30 [reviewer] · run rev-20261017-700-final · 2026-10-17T17:07:05.422Z · commit 9133b55fb3b5d11a11a8bde0952d9526971d9eaf
- [x] C2. Fake droplets created by the five files fall from the count recorded before (from the fake provider's request log) by at least a third.
  - done: impl-700 · 2026-10-17T14:58:54.011Z
  - verified: rev-30 [reviewer] · run rev-20261017-700-source-correction · 2026-10-17T16:27:11.715Z · commit 9133b55fb3b5d11a11a8bde0952d9526971d9eaf
  - verified: rev-30 [reviewer] · run rev-20261017-700-final · 2026-10-17T17:07:05.422Z · commit 9133b55fb3b5d11a11a8bde0952d9526971d9eaf
- [x] C3. Every remaining T3 test in the five files names its process behaviour, and the moved rules pass the tier lint as T1.
  - done: impl-700 · 2026-10-17T14:58:30.836Z
  - verified: rev-30 [reviewer] · run rev-20261017-700-source-correction · 2026-10-17T16:27:11.715Z · commit 9133b55fb3b5d11a11a8bde0952d9526971d9eaf
  - verified: rev-30 [reviewer] · run rev-20261017-700-final · 2026-10-17T17:07:05.422Z · commit 9133b55fb3b5d11a11a8bde0952d9526971d9eaf
- [x] C4. An audit maps every moved or rewritten assertion to its new place, with no behaviour claim dropped.
  - done: impl-700 · 2026-10-17T14:43:04.611Z
  - verified: rev-30 [reviewer] · run rev-20261017-700-source-correction · 2026-10-17T16:27:11.715Z · commit 9133b55fb3b5d11a11a8bde0952d9526971d9eaf
  - verified: rev-30 [reviewer] · run rev-20261017-700-final · 2026-10-17T17:07:05.422Z · commit 9133b55fb3b5d11a11a8bde0952d9526971d9eaf
- [x] C5. Each touched file passes 5/5 serially as a whole file on the Mac and once in the task's droplet verify.
  - done: impl-700 · 2026-10-17T17:04:25.414Z
  - verified: rev-30 [reviewer] · run rev-20261017-700-final · 2026-10-17T17:07:05.422Z · commit 9133b55fb3b5d11a11a8bde0952d9526971d9eaf

## Comments

### coord · 2026-10-16T20:10:05.236Z

Coordinator, scope note from T-680's review (A-4174): executor-run.test.ts:49, the broad host-receipt reuse scenario T-680 added, runs 15.9 s, over the 10 s T3 target. This ticket's move of executor-run onto the clock and the in-process provider includes it. Narrow it, or retier it, while keeping one real worker proof of reuse.

### coord · 2026-10-17T06:43:06.037Z

Coordinator correction from T-697: CLAND_TEST_DROPLET_MACHINE_MS is a readiness timeout in waitForMachine, not a fixed delay before the machine is ready. Lowering it from 2000 to 200 doesn't save 1.8 s per droplet by itself, so this ticket's speedup comes from the fixture and process work it removes (one fixture per test, in-process provider and scripted machine from T-697). Measure and report it that way. A case that needs real readiness timing keeps an explicit override, as T-697 did for the demo watchdog.

### impl-700 · 2026-10-17T14:35:49.608Z

Implemented tier split: cache/override/occasion rules at T1, shard failure/reservation cancellation/demo cap at T2; retained real process proofs. Initial green serial census fell from 54 to 36 fake-provider droplet POSTs including split files. Merged origin/dev before first review; collecting 5/5 Mac evidence and matching scripted-platform consumer checks.

### rev-30 · 2026-10-17T16:16:16.180Z

verdict: review
result: not clear
by: rev-30 [reviewer]
run: rev-20261017-700-source
commit: 5fe5c0c06c7a4701f3ea1c97192cfad33f80cdc1
scope: full
findings: [{"severity":"medium","text":"M1: the provider-size barrier release is registered with native t.after after integrated() installed the ownership hook. If an assertion fails before line46 releases the barrier, ownership teardown can await hub stop/Suites.close joining the held reservation before the later native release hook can run. Register the release in the fixture resource phase before stop/join, and prove pre-release assertion/cancellation teardown completes with no retained resources.","file":"hub/test/suite-close-component.test.ts","line":37}]
finding_counts: {"high":0,"medium":1,"low":0}

# T-700 full source review — not clear

Head5fe5c0c06c7a4701f3ea1c97192cfad33f80cdc1; fixed incoming devbc24ad66e0981cfb5f32ae5245143096bccb4ca4. All20 changed files reviewed, including the adjacent scripted-platform correction. Read-only review; no Reviewer execution or delegation.

## Standards
Medium M1 — suite-close-component.test.ts:37. The moved held-provider-size cancellation test registers release.resolve with a native t.after after integrated() has installed fixture ownership cleanup. The first ownership hook runs resources/hub disposal before the later native hook. On a failure while sizes is held (before normal release at46), stop can join the unfinished reservation and prevent the release hook from running. process-cleanup.ts:56–64/70–85 and Suites.close show the ordering. The Implementer independently confirmed this path in369aec21 and is correcting it. Use onCleanup/resource ownership to release before stop/join; supply a controlled pre-release assertion failure/cancellation teardown receipt, plus corrected whole-file5/5. This is source-path evidence, not a claimed Reviewer reproduction. Normal successful files do not exercise it.

No other source finding. The occasion rule extraction preserves the exact role predicate/error and call location; callerNow is still read at authorization. New T1 executor/stage policy tests use suiteUnit semantic receipts, injected candidate facts, FakeClock and no provider creates. machineReceiptsOnly remains test-only; its default preserves existing provider behavior. The new component files retain real in-process frame/provider boundaries. Retained T3 headers identify actual worker delivery, provider loss/cancel, crash/restart, watchdog and recorder behavior. Added done-file/PID observations obey the exact-boundary rules and preserve final assertions.

The delivery watcher is installed before checking its release file, so an early release is not missed; onCleanup owns its failure release before fixture disposal. Shared subcase fixtures use fresh run IDs and reset start/checkout faults. The host-marker assertion remains after f.result→log read, unchanged in meaning; diagnostics are failure-only and awaited fixture stop preserves persisted-token scanning. The200ms setting is correctly described as a readiness timeout, with2000ms retained for the two real watchdog scenarios.

## Spec and assertion mapping
The A-4610 declaration map was checked against all changed test hunks. Executor provenance/cache/override permutations, failed/unreported stage supersession, cap/slots and occasion authorization are proved at lower seams, with representative real frames retained. Real delivery cleanliness/staged-source rejection, host receipt reuse, changed-checkout typecheck failure, package failure, incremental UTF-8/report uniqueness, lost reply/marker recovery, provider disappearance/cancel, crash refs/lease/pgid preservation and complete resource cleanup assertions remain. Demo's duplicate successive-lease case is folded into the first real command/restart case, retaining explicit commit, exit255, newest lease identity and deletion. No requested behavior claim is otherwise dropped; M1 prevents accepting the moved reservation proof's teardown as reliable.

Adjacent scripted platform.os 'Linux'→'linux' matches Node's receipt contract and stage-cover Linux eligibility. The matching remote-scripted expectation and new stage rule cover it; A-4559 records reader searches across hub/nvim and the eleven additional existing reader file runs, while the changed display file has5/5. No Neovim consumer is claimed. The correction changes no real-worker platform collection.

## Evidence and measurements
Independently audited accepted raw series across A-4559/A-4610: ten touched test files5/5,50 whole-file logs,225 passing Node tests across those repetitions,zero failures/cancellations/skips. Old exploratory host-marker reds remain disclosed; they are not counted as successful final series. T-738's shared fix is already on incoming dev; no collector/marker product change is authored here.

Recomputed nine-file migration median sum from top-level TAP durations:160.618868920s versus original267.989279s, including all four split files. Adjacent remote-scripted1.419858417s is separately disclosed. These are Mac per-file test-second medians, not whole-file wall times or exact-head Linux evidence. E-677 Coordinator comment2026-10-17T06:34:55.418Z defines evidence-artifact medians plus later exact-head Linux seconds as the criterion inputs, and forbids per-ticket baseline rewrites.

Before raw green five-file provider POST counts are15/8/14/9/8=54; accepted migrated counts13/6/2/5/6 plus component3 and demo-cap1, both T1 policy files0, total36. Thus one-third fewer actual fake-provider creates, including split coverage; semantic acquisitions are not counted as creates. Daemon accounting14→13 is disclosed separately. Accepted measurement metadata maxload6.5972<15. Fresh exact-head Linux measurements and C5 remain pending.

Durations non-allowance sections (version/source/budget/files/tests) independently equal incoming dev byte-structure. The31 allowance changes are confined to the five original files, with no new allowance or increased seconds; only own legacy removal/shrinks. Tiers are incoming dev plus four sorted new entries, no removed coverage. Static typecheck/tiers/diff checks and report lint are supplied.

Source not clear due M1; C5 fails pending reliable moved-test teardown and new-head review. C1 timing support, C2 provider counts, C3 tier/header evidence and C4 mapping are positive but no source-clear or final criterion marks are claimed in this pass. Await committed correction, controlled failure-path receipt and corrected component5/5 before a new source verdict. Coordinator verification submission hold remains; no task run authorized here.

Standards:1 medium finding. Spec: assertion mapping otherwise complete; final execution evidence pending.

Durable source review A-4613.

Criteria: C5 failed (The moved held-size reservation test can deadlock teardown on pre-release assertion failure because its release hook runs after fixture stop/join; correct ownership and provide controlled failure-path proof before new-head review.).

### impl-700 · 2026-10-17T16:21:03.660Z

Review M1 corrected at 9133b55fb3b5d11a11a8bde0952d9526971d9eaf: release owned in resource cleanup before hub stop. A-4615 contains controlled old-hang/fixed-cleanup proof and corrected component whole-file 5/5. Required rerun exposed a FIFO outcome/shard-identity race; explicit per-ID completion preserves shard-2 assertions. Both exploratory reds are disclosed. Updated nine-file Mac sum160.528871293 s; provider creates remain54→36. C5 awaits exact-reviewed-head droplet result after source clear and Coordinator hold lifted.

### rev-30 · 2026-10-17T16:27:11.715Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261017-700-source-correction
commit: 9133b55fb3b5d11a11a8bde0952d9526971d9eaf
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

# T-700 corrected source review — clear

Head9133b55fb3b5d11a11a8bde0952d9526971d9eaf, direct child of reviewed5fe5c0c0. Full source review fixed point remains incoming devbc24ad66e0981cfb5f32ae5245143096bccb4ca4. No dev merge after first review. The sole correction delta is suite-close-component.test.ts (8 additions,5 removals); independently still the branch tip. Read-only review, no Reviewer execution.

## Standards
M1 in A-4613 is resolved. The held provider-size gate now uses onCleanup, which enters the fixture resource phase before hub stop/join and directory removal. It is installed before the provider callback can block. Normal assertions still observe no report while held, then cancelled completion, zero reserved/spent/tagged resources, zero creates and exactly one report.

A-4615's artifact-only diagnostic uses that same reservation/cancellation path and deliberately throws before normal release. The corrected owned.log has one deliberate AssertionError, zero cancellations/skips, and an afterCleanup receipt proving gate release, joined hub stop, all three roots absent, no droplets and zero creates; the process exits1 for the intentional assertion, not a successful test. Source of the bounded diagnostic runner is retained. The legacy native-hook variant has no completion receipt and is bounded/stopped at8s before scripted fixture roots are removed. This is supplied Implementer execution evidence, not Reviewer reproduction. The diagnostic is not added to the committed suite or counted as a green receipt.

The additional migrated-test FIFO race is corrected without weakening shard identity. Both scripted runs are held; startedShards observes both exact run IDs and durable group running state. Existing machine.finish then completes shard1 green and shard2 red before advancing polling time. Exact shard2 label, aggregate counts, one report, two creates and complete cleanup assertions remain. Outcome assignment no longer depends on concurrent delivery order. The FIFO red and intermediate clock-before-completion timeout are retained in A-4615, not counted among accepted passes.

No remaining findings. Full standards/source analysis and declaration mapping from A-4613 remain applicable to the unchanged19 files. The production occasion authorization extraction, adjacent scripted linux receipt correction/reader checks, real worker marker assertion ordering, watchdog/recorder/cancel/restart proofs and allowance/baseline preservation are unchanged.

## Spec and evidence
C2 verified: original green provider logs total54creates; accepted coverage including all split files totals36, exactly one-third fewer. Component remains3creates per whole file after this correction; new T1 policy tables still create0. Semantic acquisitions are distinguished from provider requests. Initial-plus-explicit daemon accounting14→13 is separate.

C3 verified: two pure FakeClock/semantic-receipt T1 rule files, two in-process provider/frame T2 component files, five retained T3 files with explicit lifecycle headers. Native worker/provider-loss/cancel/crash/restart/watchdog/recorder assertions remain in the current tree.

C4 verified against the complete A-4610 map, all original/new hunks and current A-4615 delta. Representative CLI/MCP frames remain; duplicated rule permutations move to lower seams, and the demo successive-lease assertions are folded into the real command/restart scenario. No behavior assertion is dropped. Failure-only marker diagnostics and f.result→read→assert order are preserved. The readiness200ms value is a timeout, not an asserted1.8s saving; watchdog scenarios keep2000ms overrides.

Five fresh corrected component whole-file logs independently show3/3 each,zero fail/cancelled/skipped, three creates and no initial daemon. Median reported-test seconds3.930088999; sampled maxload3.0098. Replace only the prior component median; the nine coverage-file sum is160.528871293s versus original267.989279s. Other nine touched test sources retain their audited5/5 accepted logs in A-4610/A-4559; the adjacent remote-scripted median1.419858417s is disclosed separately. There are50 accepted whole-file logs/225 passes across the ten touched test files including the current component series. Source correction typecheck/tiers/diff checks supplied green.

C1 has positive Mac support under180s, but exact-head Linux file seconds remain pending under E-677's artifact-based timing disposition. No measured duration baselines were rewritten: non-allowance sections match incoming dev,31 own allowance changes only remove/shrink entries in the five original files, and four sorted new tier entries preserve coverage.

Source clear, Standards0/Spec0 findings; verify C2/C3/C4 at this head. M1 is resolved; C5's execution requirement still needs the exact-head droplet receipt and claimant done restoration after it. C1/C5 remain unverified. No per-item QA. Wait for the Coordinator's explicit submission hold lift before normal mode-free droplet verification; source clearance does not lift that hold.

Durable source review: A-4618.

Criteria: C2 verified, C3 verified, C4 verified.

### rev-30 · 2026-10-17T17:07:05.422Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261017-700-final
commit: 9133b55fb3b5d11a11a8bde0952d9526971d9eaf
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

# T-700 final same-head evidence review — clear

Head9133b55fb3b5d11a11a8bde0952d9526971d9eaf remains the branch tip and matches current full source clearance rev-20261017-700-source-correction/A-4618. M1 was resolved in source with controlled failure-path ownership proof; no new source change. Task view confirms completed passed droplet023e84cf-aa68-42d0-8e12-178b33568205 at this head and restored claimant C1/C5 done marks. Read-only evidence audit; no Reviewer execution.

## Runtime and criteria
A-4637 raw log finishes exit0. Normal automatic selection is hub-only plus Neovim smoke, with host npm run check/typecheck gate. Node phase counts148/148,1943/1938pass+5skip,12/12 give2103total/2098pass/0fail/0cancelled/5skip. Skips are unrelated absent macOS sandbox/sleep-inhibition and real OpenCode prerequisites; no owned test is skipped. All12 new owned load identities pass5/5,60/60, including the corrected reservation cancellation and shard-ID failure cases.

C1 verified from unchanged accepted Mac medians plus exact-head Linux timing records, without rewriting manifest baselines. Nine migration files (five originals plus all four splits), top-level test-seconds:
executor-run62.875194014; executor-run-rules0.456539083; suite-close-recovery21.855216137; suite-close18.428283164; suite-close-component3.916073564; suite-stage-cover15.108576181; suite-stage-rules0.665593773; demo23.767489731; demo-cap1.340489934.
Independently summed Linux148.413455581s≤180s, beside accepted Mac5/5 median sum160.528871293s≤180s, original fixed baseline267.989279s. Nested tests are included in parents once; load repetitions excluded. Adjacent remote-scripted1.090142296sLinux/1.419858417sMac is disclosed separately from the migration target. A-4638 agrees with the independent computation.

C5 verified: all ten touched test files have actual positive ordinary timing receipts: executor-run9top-level, executor-run-rules3, suite-close-recovery3, suite-close4, suite-close-component3, suite-stage-cover1, suite-stage-rules4, demo5, demo-cap2, remote-scripted2. Native nested cases remain inside their parent timings. Accepted Mac50whole-file logs/225passes across these files were independently audited in A-4618 (corrected component5/5 in A-4615; unchanged-source series A-4610/A-4559). Controlled intentional-assertion diagnostics and exploratory reds remain disclosed and excluded from green counts.

C2/C3/C4 source verification stays current: actual fake-provider creates54→36 (one-third fewer, including all split coverage); explicit T3 lifecycle headers and two T1 pure policy files; full assertion map, native marker/delivery/crash/restart/cleanup proofs and representative frames. Linux runs both T1 rule files in the hermetic phase, with positive receipts. Additional adjacent scripted-fixture readers also execute positively in this receipt: admission, admission-lock, safety-component, prepare-retry, demo-release-component, accounting, cache, cover, queue, remote-budget and scheduling.

## Receipt accounting and limits
Supplied executor result: c-8lon1 Linuxx64 6.8.0-142-generic, Node24.21.0/Neovim0.12.5,2workers, lifetime1708s,cost$0.1186. Suite1640.14s,peak1mload7.10,load-gate extra wall13.24s. Report-only lint/budget warnings and missing split-file baselines do not fail this run. No hard budget or load-gate failure. T3 ratchet4258.382s versus base4358.593s. No claimed Neovim full-package cover: the applicable smoke completed; no Neovim source diff or per-item QA.

Final evidence clear at this exact head, findings[], verify all criteria across current source review and this receipt. Standards0/Spec0remaining findings. No further task run requested.

Durable review: A-4640.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified.
