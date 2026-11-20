---
id: T-1875
kind: task
title: Cancellable FrameClient request and waitFor in the shared test client, so card-web's inner receipts can use the load-scaled waits
state: closed
status: done
size: S
criterion_seq: 2
labels: []
assignee: null
parent: E-1881
blocked_by:
  - T-1889
topic: topic-1667
branch: t/T-1875-cancellable-frameclient-request-and
created: 2026-11-15T19:47:41.913Z
updated: 2026-11-20T03:02:49.702Z
closed: 2026-11-20T03:02:49.702Z
---

## Summary

The shared FrameClient test API's `request` and `waitFor` can't be cancelled. So the Telegram card-web fixture's inner `web.link`, request and welcome waits keep a fixed real 1 s bound: making them longer would leave uncancellable timers running past the fixture's 2 s drain. This came out of T-1874's source review on 2026-11-15. T-1874 kept those 1 s bounds and moved only the outer setup observer to the shared load-scaled wait.

## What to build

Give FrameClient's `request` and `waitFor` an AbortSignal, or another cancellable owner, that the fixture's teardown can end. Then move card-web's inner prerequisite receipts onto the shared load-scaled waits with a named reason. Sweep FrameClient's other callers for the same fixed real bounds. Keep the helper's existing contract compatible for callers that pass no signal.

## Acceptance criteria

- [x] C1. FrameClient request and waitFor accept cancellation, and teardown ends every pending timer, shown by a test that fails on the uncancellable version (test).
  - done: impl-1875 · 2026-11-20T00:45:52.191Z
  - verified: rev-35 [reviewer] · run rev-35-1875-evidence-2 · 2026-11-20T01:49:24.110Z · commit a485c7c159b14814fe4be7a4a27058d11df02c1a
- [x] C2. card-web's inner receipts use the shared load-scaled wait, and the card-web tests pass 20 out of 20 runs at a 1-minute load of at least 8 with unchanged assertions (test).
  - done: impl-1875 · 2026-11-20T01:21:18.559Z
  - verified: rev-35 [reviewer] · run rev-35-1875-evidence-1 · 2026-11-20T01:24:02.550Z · commit a485c7c159b14814fe4be7a4a27058d11df02c1a
  - verified: rev-35 [reviewer] · run rev-35-1875-evidence-2 · 2026-11-20T01:49:24.110Z · commit a485c7c159b14814fe4be7a4a27058d11df02c1a

## Comments

### impl-1875 · 2026-11-20T00:15:40.049Z

C1 red on original helper: teardown ends every pending timer, 2 !== 0 (both fired). Green harness-framing covers fixture abort, wrapper forwarding, already-aborted owner, completed receipts and expired waiter cleanup. Caller sweep staged for scanned evidence publication. Full lint and typecheck passed locally on macOS arm64 / Node 24.21.0. C2 loaded 20/20 remains pending the Coordinator quiet window after source review.

### rev-36 · 2026-11-20T00:28:56.498Z

verdict: review
result: not clear
by: rev-36 [reviewer]
run: rev-36-1875-source-1
commit: da652499487ff945cec5e0571312dbc7eec483a7
scope: full
findings: [{"severity":"medium","text":"Spec P1: new abort cleanup removes live waiters while dispatch iterates a snapshot. A predicate can abort another waiter or itself; the stale entry is still evaluated and a match can splice(-1,1), deleting an unrelated live waiter. No purity/membership fence exists (lead b212684e). Guard membership before and after predicate evaluation; prove cancelled predicates are skipped and an unrelated waiter receives its exact later frame.","file":"hub/test/harness.ts","line":780},{"severity":"medium","text":"Spec P2: frames.find(predicate) can synchronously abort its owner after the initial signal check. A false result then registers a timer/listener after the abort event already fired; a true hit can resolve despite the abort. No post-scan check exists (lead92799347). Recheck before returning the hit or registering pending work; retain exact abort reason and zero remaining timer/listener/waiter controls.","file":"hub/test/harness.ts","line":818},{"severity":"medium","text":"Standards S1: both new callbacks (also42) use raw TestContext/ensureAccountFixture then global timer/method mocks, without pre-acquisition normal/signal whole-caller ownership, separately named setup bound or positively controlled native-launch guard. Worker directory cleanup/Node mock restoration do not join those complete callers. Lead821cb9a7 confirms no omitted owner or approved exception. Own original setup/body/cancellation before restoring mocks/guard, retaining all settled/timer/frame assertions.","file":"hub/test/harness-framing.test.ts","line":16},{"severity":"low","text":"Standards S2: current guide still requires one-second web.link/welcome limits because timers cannot be cancelled and describes T-1875 scaling as future work. Replace superseded guidance to match the new cancellable load-scaled prerequisites while retaining injected setup-clock/2s drain semantics (rule16); clarify the unqualified uncancellable-waiter comment in scenario-reply-owner.ts:6 as well.","file":"docs/agents/tests/hub-test-telegram-cards.test.ts.md","line":217}]
finding_counts: {"high":0,"medium":3,"low":1}

Source NOT CLEAR at da652499487ff945cec5e0571312dbc7eec483a7/tree760794ff93f632fc6aaa443dae6b3267642908dc, parent/basec352aade5, clean local/origin. A-21969 separates Standards1medium+1low from Spec2medium. Lead b212684e/92799347/821cb9a7 confirm all three code/validation gaps without reproduction. C1 failed; nothing verified. C2 shared scaled implementation is present but20/20 loaded campaign remains unchecked/unexecuted and unverified, not a passing count.

P1 dispatch snapshot lacks live-membership checks around user predicates after abort cleanup. P2 buffered scan lacks a post-predicate abort check before hit/pending registration. S1 new raw callbacks lack whole-caller/setup/guard ownership. LowS2 shared card-web guide still prescribes superseded one-second uncancellable inner waits and future T-1875 work. Preserve unrelated/unsignalled waiters, exact reasons, normal completion/timeout/write-error cleanup, prior frame/wire behavior and all original assertions.

Positive source checks: optional third signal, session wrapper forwarding, ordinary result/waiter timer/listener cleanup, cancellation-before-send and expired-waiter removal; cardWebOwner named testSetupWaitMs prerequisites use combined owner signal and welcome-before-hello, with existing native-original/HTTP/socket/drain ownership. No production wire/permission/config/gate/tier change. Other fixed setup waits are explicitly outside scope as T-2017 per Coordinator1d3b6458. Coordinator5121e090 requires source clear before stress window.

A-21962 is a conservative search inventory; additiveA-21967 retains143 generated pass lines+143/143 footer across four exact pinnedT2 files: harness-framing,telegram-cards,telegram-approvals,claude-code-schedule. New cancellation cases91/92 and previous-shape correlation/event/parse case101 visibly pass, without P1/P2 coverage. Full root lint/typecheck0 as retained;765report-only findings149files,0refusals,condition-wait growth report0,known advisory capability/site/build notices separate. Initial deliberately failing timer control reported2!==0/exit1; no separate raw red log retained. Exact final command/cwd hash/order/tool completions recorded; CWD hash independently matches. Binding is retrospective checks-after-final-edit/before-commit, not invocation tree/admission proof; native PID/signal/start/end/runner identity unknown. Local macOSarm64/Node24.21, no browser/configured/remote/T3/T4/loaded/QA proof.485tiered candidate rows found, four executed; others/helpers/docs are not execution coverage.

Hold released for consolidated corrections/required checks, then fresh exact-head source review before Coordinator's loaded campaign or configured window. No full run requested by Reviewer. Read-only task/history/Git/source/docs/manifest/evidence inspection only; no edits/tests/probes/scans/generators/native/browser/delegation.

Criteria: C1 failed (Reentrant dispatch can evaluate cancelled waiters/delete an unrelated waiter, buffered predicates can abort before listener registration leaving a timer pending, and the new validation callbacks lack required caller/setup/guard ownership.).

### impl-1875 · 2026-11-20T00:34:03.471Z

Consolidated review corrections committed/pushed as e4b754cd80a5b037810652179b58b0429d36395b. P1/P2 regressions shown red (3/3 failed on reviewed helper) then green; S1 caller ownership/positive guard and S2 stale guide corrected. Final staged tree a5d5f0bd8070e9a54ad6f7abc82f08f9901ae45b captured before full lint, typecheck and targeted run, matching commit tree. All exit 0; 146/146 T2 cases pass across four files. Additive evidence A-21972 retains original red and per-case outputs; prior not-clear verdict retained. C2 loaded campaign still pending source clear and Coordinator quiet window.

### rev-35 · 2026-11-20T00:38:02.285Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1875-source-2
commit: e4b754cd80a5b037810652179b58b0429d36395b
scope: full
findings: [{"severity":"medium","text":"Spec P3: a later result callback calls cleanup before observeProcesses and resolve. A synchronous observer throw leaves the public request pending with correlation/timer/abort listener already removed, so teardown cannot settle it. No nonthrowing contract or exclusion exists (lead6071ea1b). Settle with the exact observer failure and retain stream callback/unread-suffix behavior; add later-result/zero-stranded-owner coverage.","file":"hub/test/harness.ts","line":810}]
finding_counts: {"high":0,"medium":1,"low":0}

Source2 full review not clear ate4b754cd80a5b037810652179b58b0429d36395b/treea5d5f0bd8070e9a54ad6f7abc82f08f9901ae45b. A-21974 records Standards/Spec and evidence scope.

Prior P1/P2/S1/S2 resolved: live waiter membership fences around predicates, post-buffer abort check, owned/named setup and cancellation with guard/mock retention, stale guide/comment updates. Exact reasons/unrelated waiter/previous unsignalled parser behavior retained. Card-web prerequisites use combined signal and shared scaled setup budgets; C2 loaded proof remains pending.

Residual medium P3 harness.ts:810–813: a later result observer throw occurs after cleanup removed timer/correlation/abort listener but before public resolve; the request becomes permanently pending. Lead6071ea1b confirms no alternate owner/nonthrowing contract/exclusion. Preserve exact thrown reason and existing receiving-callback/stream semantics while settling this path; deterministic later-result control required.

Marks: C1 failed, no verified marks. C2 unchecked/unverified until prescribed20/20 at1mload>=8 after clear source. A-21972 staged-tree-bound local146/146 fourT2 plus compiler/lint is useful scoped evidence, not P3/stress/configured proof. Prior rev-36 verdict/red rounds retained. No Reviewer runtime/edit/delegation. Correct and request fresh source review.

Criteria: C1 failed (A throwing result observer can leave request permanently pending after its cancellation listener and timer are removed; teardown cannot settle that owner.).

### impl-1875 · 2026-11-20T00:43:33.279Z

P3 observer failure correction committed/pushed as a485c7c159b14814fe4be7a4a27058d11df02c1a. Deliberate old-handler red: incomplete request settlement after observer failure. New handler rejects exact error and rethrows synchronously; retained unread-frame and zero timer/listener assertions pass. Framing 12/12 and final four-file T2 147/147; full lint and typecheck exit 0. Tree a75bec717f0975faac14d1f2f9f833882e049d79 recorded before each final check matches commit. Additive evidence A-21982; previous failed rounds/verdicts retained. C2 loaded campaign still pending fresh source clearance and Coordinator quiet window.

### rev-35 · 2026-11-20T00:45:43.078Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1875-source-3
commit: a485c7c159b14814fe4be7a4a27058d11df02c1a
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source3 clear ata485c7c159b14814fe4be7a4a27058d11df02c1a/treea75bec717f0975faac14d1f2f9f833882e049d79. A-21987 records the three-file correction and Standards/Spec pass; no findings.

P3 resolved: result observer throw now rejects the public request with that exact value and rethrows synchronously, retaining receiving callback and unread-suffix semantics after cleanup. Owned later-result control checks exact request rejection/error, exact subsequent frame, no timer/listener after teardown, and independent bounded read-only settlement that makes the old defect explicitly incomplete. Prior P1/P2/S1/S2 fixes remain.

A-21982 retains red0/1, framing12/12, four named T2 files147/147, full lint/typecheck0 with staged-tree binding and unknown metadata labelled. No configured/stress/remote/other-tier pass. Card-web scaled/cancellable implementation remains correct; other short bounds stay T-2017.

No new verified marks. C1 implementation/control is corrected, but initial tracker readback still failed/unchecked and needs the lead's done-mark reconciliation; request's done statement was stale. C2's20/20 at1mload>=8 remains unchecked/unexecuted. Prior source reds remain historical. No Reviewer runtime/edit/delegation. After reconciliation, source is clear for the Coordinator's campaign/window at this exact head.

### impl-1875 · 2026-11-20T01:22:52.604Z

C2 completed at unchanged reviewed a485c7c159b14814fe4be7a4a27058d11df02c1a: scanned A-22009 has 20/20 loaded macOS rounds, each 135 case passes/code0/signal null/no spawn error, start loads 8.2470703125–11.30908203125. Sampled peak 14.0908203125 in round20 explicitly retained; start-band proof only. Nine in-process burners exited code0 and joined before native slot release. C2 marked implementation-done; reviewer verification pending. After quiet closed, 17 conservative T1 source-consumer files passed 314/314/native exit0; retained A-22010. Reviewer C2 evidence hold active; configured verify window queued, no submission yet.

### rev-35 · 2026-11-20T01:24:02.550Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1875-evidence-1
commit: a485c7c159b14814fe4be7a4a27058d11df02c1a
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

C2 clear at the source3 head; A-22011 audits A-22009's20 round logs against summary and script. Each has identical135 distinct passing generated identities, TAP135/135/0fail/0cancel/0skip, native0/null/no spawnError; four required card-web behavior/setup/HTTP-abort/WS-abort identities pass each round.20distinct captured runner PIDs; nine owned CPU workers exit0/no forced/error and are joined after native completion. Start-load8.2470703125–11.30908203125 meets primary Coordinator b7a3c5ec/e2dfa7b8 start-band decision; round20 later peaks14.0908203125, so no continuous8–12 claim. Local macOS arm64 Node24.21, browser none;2700 executions of135 identities, not distinct-test count. C2 verified only. C1 remains done/unverified; configured same-head verification pending. A-22010 T1 check remains separate and not used for C2. No findings; no Reviewer runtime work. Hold released; this is no run-window grant.

Criteria: C2 verified.

### impl-1875 · 2026-11-20T01:48:19.369Z

Configured reviewed-head run d749f9b4-39a6-4ccb-9e7d-b0dfb5ca8a89 passed; A-22028. Head a485c7c159b14814fe4be7a4a27058d11df02c1a, uncached runtime tree daf41307d7b8525f107ac83cc70eff99e1b692fd (Git tree a75bec717f0975faac14d1f2f9f833882e049d79). Hub aggregate 7065 pass, zero fail/cancel/skip/todo. T0/all T1 234 files/fallback all T2 441/Web 55 exit0; T3 deferred to queue batch, T4 unexecuted. All 12 framing ordinary cases and five load passes per new six controls observed as structured pass receipts. Linux x64 6.8.0-149-generic droplet c-8 ams3, Node24.21/Nvim0.12.5, workers2, lifetime1198462ms cost$0.08322652777777778 (accounting, not suite wall). Browser HeadlessShell1248 Chrome for Testing156.0.8078.4, exact path in A-22028 provenance. Advisory timing/lint budgets report-only. C2 separately verified by evidence-1/A-22011 from A-22009; C1/final same-head reviewer settlement pending, source clean/unchanged.

### rev-35 · 2026-11-20T01:49:24.110Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1875-evidence-2
commit: a485c7c159b14814fe4be7a4a27058d11df02c1a
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final clear at reviewed a485c7c159b14814fe4be7a4a27058d11df02c1a; A-22030 audits d749f9b4/A-22028. Producer receipts pair uniquely:7065 ordinary passes/0fail/0skip/0cancel,730 file passes;30 separate repetition passes+30 envelopes. All12 framing cases pass, all6 new cancellation/reentrancy/observer identities have5 distinct passing repeats, and previous-wire parsing/correlation remains green. Four card-web behavior/setup-abort identities pass. C1 original uncancellable red and observer-red epochs remain qualified separately. C2 same-head macOS20/20 loaded campaign stays verified through A-22011, including start-band versus14.09 in-run excursion. All234T1/441T2/55Web complete plus T0;272T3 deferred to batch,18T4 unexecuted. Linux x64 c-8 ams3 Node24.21/Nvim0.12.5, HeadlessShell1248/Chrome156.0.8078.4, cache:null; canonical treedaf41307 differs in kind from Git treea75bec71. Accounting/phase/case times stay separate; advisories report-only. Verify C1/C2, no findings; no Reviewer runtime/source changes.

Criteria: C1 verified, C2 verified.

### coord · 2026-11-20T03:02:49.702Z

Merged 3284e79ca6df19ee9a146f20223f89ca72ed1c8a onto dev.
