---
id: T-1785
kind: task
title: Waiting for a login, and the "create one?" card
state: closed
status: done
size: M
criterion_seq: 5
labels:
  - ready-for-agent
assignee: null
parent: E-1535
blocked_by:
  - T-1775
  - T-1784
topic: topic-1471
branch: t/T-1785-waiting-for-a-login-and-the-create-one
created: 2026-11-09T12:44:10.911Z
updated: 2026-11-11T02:56:51.252Z
closed: 2026-11-11T02:56:51.252Z
---

## Summary

A launch blocked on logins waits as "waiting for a login <harness>", wherever waiting launches show, and its reason stays current. Once a login frees and a host starts, the reason reads "waiting for host <id> to boot", and the wait ends when the launch is placed. The human gets one "Not enough <harness> logins. Create one?" card per wait, raised by the hub. A `cland login add` that makes a login `ready` re-runs placement at once, and the card folds.

## What to build

T-1784's decision wired into the waiting launches, plus capacity events when a login becomes ready, is released or signs out. A login card module raises the `login-create` card through T-1775:
- **Raised** once per pool and harness while any launch waits for that login (question 8), and withdrawn when none does.
- **Options:** "Create one" and "Not now". "Not now" folds the card. "Create one" is handled by T-1791; until then it answers with the `cland login add <harness> --pool <pool>` line.

The Agents notices reuse `session-waiting`. Waits are already durable across a restart, and the card is durable through T-1775.

## Acceptance criteria

- [x] C1. A launch blocked on logins reads "waiting for a login <harness>" in `cland session list` and the inbox frame, and Agents gets one notice for it (test).
  - done: impl-1785 · 2026-11-11T00:36:10.721Z
  - verified: rev-35 [reviewer] · run rev-35-1785-final-1 · 2026-11-11T01:10:26.218Z · commit 2db79e543c43bb695022f1e988e6fb5b35cf39e3
  - verified: rev-35 [reviewer] · run rev-35-1785-final-2 · 2026-11-11T02:09:07.956Z · commit 35aeccff372f7d29c31957c88a4f56da1dcb1d4d
- [x] C2. A `cland login add` of that harness releases the wait: a host starts, the reason reads "waiting for host <id> to boot", and the launch is placed when the host is ready (test).
  - done: impl-1785 · 2026-11-11T00:45:05.822Z
  - verified: rev-35 [reviewer] · run rev-35-1785-final-1 · 2026-11-11T01:10:26.218Z · commit 2db79e543c43bb695022f1e988e6fb5b35cf39e3
  - verified: rev-35 [reviewer] · run rev-35-1785-final-2 · 2026-11-11T02:09:07.956Z · commit 35aeccff372f7d29c31957c88a4f56da1dcb1d4d
- [x] C3. Exactly one "Not enough <harness> logins. Create one?" card is raised per pool and harness, whatever the number of scheduler passes or waiting launches (test).
  - done: impl-1785 · 2026-11-11T00:36:11.313Z
  - verified: rev-35 [reviewer] · run rev-35-1785-final-1 · 2026-11-11T01:10:26.219Z · commit 2db79e543c43bb695022f1e988e6fb5b35cf39e3
  - verified: rev-35 [reviewer] · run rev-35-1785-final-2 · 2026-11-11T02:09:07.957Z · commit 35aeccff372f7d29c31957c88a4f56da1dcb1d4d
- [x] C4. The card folds when the last launch waiting for that login is placed or cancelled (test).
  - done: impl-1785 · 2026-11-11T00:36:11.543Z
  - verified: rev-35 [reviewer] · run rev-35-1785-final-1 · 2026-11-11T01:10:26.219Z · commit 2db79e543c43bb695022f1e988e6fb5b35cf39e3
  - verified: rev-35 [reviewer] · run rev-35-1785-final-2 · 2026-11-11T02:09:07.957Z · commit 35aeccff372f7d29c31957c88a4f56da1dcb1d4d
- [x] C5. Answering "Not now" folds the card and leaves the launch waiting (test).
  - done: impl-1785 · 2026-11-11T00:36:11.899Z
  - verified: rev-35 [reviewer] · run rev-35-1785-final-1 · 2026-11-11T01:10:26.219Z · commit 2db79e543c43bb695022f1e988e6fb5b35cf39e3
  - verified: rev-35 [reviewer] · run rev-35-1785-final-2 · 2026-11-11T02:09:07.957Z · commit 35aeccff372f7d29c31957c88a4f56da1dcb1d4d

## Blocked by

- T-1775
- T-1784

## Notes

- Hot files: `hub/src/adapters/sessions.ts` (the reason), `hub/src/adapters/waiting-launches.ts`, `hub/src/host/login-cards.ts` (new), `hub/src/host/pool-runtime.ts` (capacity events; same lane as T-1784).
- Tests: new `hub/test/login-wait.test.ts` (T2, the test messenger).
- Serves epic C6.

## Comments

### impl-1785 · 2026-11-11T00:29:45.631Z

Rule 20 sweep before changing card admission: shared suite transitive import graph reaches 696 tests, plus 15 unknowns counted reached (full inventory /tmp/T-1785-consumers.json pending durable artifact). Explicit consumers: Sessions, WaitingLaunches, Processes waiting persistence, requests session.list, dispatcher restoration, inbox aggregation, agents-topic lifecycle mapper; protocol WaitingLaunch unchanged; web InboxArea and nvim state/inbox existing wait/card shapes unaffected; hub-cards/asks/store and fake messenger answer boundary reused. QA E-1534 stage 2/3 and E-1535 stage 1 use unchanged wire fields. Existing waiting launch tests will migrate inbox ask/count assertions for the newly raised login-create card. Native reached: host-create-ready, host-destroy-native, host-restart-reconcile, host-restart, host-stop, host-unreachable, login-write-back: no native/provider/binder/release contract changes planned; only hub card publication. No wire frames change, so recorded Neovim fixture shape unchanged. New active-only metadata records login wait cards and deduplication; legacy metadata absence remains accepted.

### impl-1785 · 2026-11-11T00:35:35.559Z

Rule 20 inbox contract clarification: login-shortage waits now add one hub-owned ask per pool/harness to inbox.asks and therefore increment inbox.needsYou, whereas waitingLaunches rows remain outside that count. Consumers: hub/hub/inbox.ts aggregate needsYou and asks; hub/asks.ts + hub-cards.ts + store.ts durable membership and closure; web/src/InboxArea.tsx count and AskCard render; nvim/lua/cland/inbox.lua and state.lua count/ask rendering; remote telegram-cards.ts and discord-cards.ts native copies; test messenger frame inbox.list; hub/test/waiting-launch.test.ts old count/deep-equal migrated; hub/test/hub-cards.test.ts existing membership/fold cases unaffected; web/test/inbox.test.ts and nvim/test/inbox-sections.test.ts unchanged old wire fixtures remain valid (no field additions). QA E-1534 stage2/stage3 and E-1535 stage1 unaffected absent launch/login shortage; new per-test guide names the changed count. Transitive full test inventory including unknowns is A-18532 at its durable artifact path, with secret scanner positive control passed. Local native evidence will cover graph-reached host lifecycle files per Coordinator decision.

### impl-1785 · 2026-11-11T00:40:52.665Z

Normalized Rule20 inventory A-18537 (714 paths) supersedes raw A-18532; all test paths have current manifest tier plus explicit execution/planned/deferred disposition. Non-test consumer static accounting is recording-only. Reviewer found two missed current QA replay selectors in qa/briefs/E-1534-stage-2.md and E-1534.md: these require migration; unconditional no-ask claims must distinguish waiting status from conditional login-create card membership, preserving historical receipt labels. Correction queued after pinned source pass. A-18536 contains labelled original producer excerpts with candidate limits; A-18538 contains raw joined native receipts at 193b13ed4, all four T3 files green. No local/native receipt is a configured Linux verification pass.

### rev-35 · 2026-11-11T00:43:32.231Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1785-source-1
commit: 193b13ed4727756ef5a8af66142eecf3072bbd9f
scope: full
findings: [{"severity":"medium","text":"Current exact replay lists here and E-1534.md338 still require the deleted inbox-count test title; stage-2 coverage mapping118 also retains unconditional no-ask wording. Migrate current selectors/conditional login-card membership while preserving real historical receipt names. Rule20; lead33a95b97 confirms no pinned exception.","file":"qa/briefs/E-1534-stage-2.md","line":287},{"severity":"medium","text":"C2 fixture omits min_hosts, so agents defaults1 and the injected creator may start/persist its booting host during startup. No zero-create assertion precedes sign-in; current case proves eligibility of an existing minimum host, not login-ready-triggered demand growth. Use explicit min_hosts=0, assert no creates/rows through creating-login, then one admitted boot row and final placement. Lead95a9f02a withdraws that specific proof claim.","file":"hub/test/login-wait.test.ts","line":29}]
finding_counts: {"high":0,"medium":2,"low":0}

A-18539 complete full source pass at replacement193b13ed4: Standards1medium/Spec1medium; no additional production defect found. Supersededb7 baseline transplant resolved by deletion before this verdict. C1/C3–C5 runtime-unverified. A-18536 labelled candidate/tool excerpts, A-18537 normalized714union and A-18538 four native receipts retained with limits; C2 growth claim withdrawn. Release hold for QA migration and demand-only test correction; fresh committed source request before verify. Exact replacement-head native provenance or explicit carry disposition required; remainingT3/T4/after-stageQA separate. No Reviewer experiments or provenance-only reruns.

Criteria: C2 failed (Current test can pre-create the minimum host before login readiness and does not prove the required demand-growth boundary.).

### rev-35 · 2026-11-11T00:48:54.003Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1785-source-2
commit: 2db79e543c43bb695022f1e988e6fb5b35cf39e3
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-18543 full source-2 review: Standards0/Spec0. Both source1 findings resolved: demand-only C2 min_hosts=0, admission/zero-create/empty-inventory through creating-login, persisted single boot row and final placement; both QA selectors/current conditional ask mapping migrated with historical receipt labels. A-18542 seven-case candidate evidence remains qualified. Explicitly accept A-18538 native source-equivalent carry from193b13ed4: complete correction touches only the T2 test, guide and two QA briefs; all production/native test/helper source unchanged. Four native files17/17 exit0, original head/platform/inventory limits preserved, no replacement-head execution inferred. Hold released for mode-free verify at unchanged2db79e543. C1–C5 runtime-unverified pending configured actual case/file and consumer receipts; remainingT3/T4/after-stageQA separate. No Reviewer experiments.

### impl-1785 · 2026-11-11T01:09:37.882Z

Verification evidence: A-18547 is raw configured run 36d2d6c9 at reviewed 2db79e543/tree b16a46227da54bc1fe1b60bc1b758585a100436d. A-18548 independently reconciles positive completed file/case receipts: 670 files pass; 5979 tests pass, zero skips; seven login-wait named base cases plus 35 load repetitions all pass. T0/T1/all-T2 fallback/Web/mapped T4 completed on Linux droplet; no task-head full T3. Complete714-path inventory:467 configured passes,4 explicitly accepted native carries from193b13ed4,243 deferred T3/broaderT4. Native carry remains Darwin A-18538 under source-equivalence acceptance A-18543. Web used Chrome Headless Shell1248 / Google Chrome for Testing156.0.8078.4. Duration and test lint gates report-only. Full remaining T3 in merge batch; broaderT4 and QA after-stage separate. Reviewer settling C1–C5; no final-ready claim yet.

### rev-35 · 2026-11-11T01:10:26.219Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1785-final-1
commit: 2db79e543c43bb695022f1e988e6fb5b35cf39e3
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-18549 final same-head evidence review; A-18547 run36d2d6c9 finished passed, independent progress audit5979base case passes/670file passes,40separate load case+40load file passes,zero negative. All7login-wait identities pass base+5/5load each, including corrected demand-only C2; migrated waiting-inbox compatibility case also base+5. All669manifest lower/Web files and all466required lower/Web consumer paths have positive case+file finishes,zero missing. A-18548 reconciles714union:467configured+4explicitly accepted A-18538 source-equivalent native carries=471qualified;230T3+13T4deferred. FullGit treeac350ba8/exportb16a4622 independently matched. Actual uncached Linuxx64 Node24.21/Nvim0.12.5,HeadlessShell1248 Chrome156.0.8078.4;1075s/$0.0747. T0/T1/allT2/Web and mappedT4base once complete; no configuredT3/T4repetition claim. Native17/17 keeps193b source/platform/inventory limits underA-18543. Non-test recording-only labels mean static inspection, not runtime proof. C1–C5 verified; prior withdrawnC2 candidate interpretation/source1not-clear retained as history. Report-only notices remain advisory; fullT3merge batch/broaderT4/affected after-stageQA separate. No Reviewer experiments.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified.

### rev-35 · 2026-11-11T01:44:38.715Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1785-delta-source-1
commit: 35aeccff372f7d29c31957c88a4f56da1dcb1d4d
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-18553 authorized merge delta source review: Standards0/Spec0. Parents2db79e543+6252673e8; treefe0de48c. Sole combined conflict keeps both LoginCards(core.store,core.cards) and loginKeyEnvironment option initialization; both waiting reconciliation and incoming key-spawn forwarding retained. Task card/test/QA-guide source byte-identical to prior review. Incoming T-1788 reviewed/landed; reviewed-to-landed difference is shared durations renewal metadata only. Coordinator1ff926bf confirms sequence. Hold released for exact-head serial five-file directed native collection including inherited login-key-spawn (lead7babd540), then mode-free verify. Old receipts remain prior-head support only; final C1–C5 merge-head settlement awaits actual new case/file and conservative union receipts. Retain available original candidate producer output/provenance without reruns. RemainingT3batch/T4/after-stageQA separate; no Reviewer experiments.

### impl-1785 · 2026-11-11T02:08:11.504Z

Replacement merged-head evidence: A-18555 raw configured run 174c67c2 and A-18556 complete case/file/consumer reconciliation at reviewed 35aeccff3/tree 02c51d2b77b8cf09df3826902ddd2941d8d705ef. 6013 tests pass, zero skips; 672 positive file completions. Seven new cases and renamed compatibility each base + five load repetitions pass. T0/T1/all-T2 fallback/Web/mapped T4 completed on Linux; selected inherited T3 host-agent + login-key-spawn also completed (2 files,25 tests). Complete715-path union:469 configured,4 extra exact-head local-native,242 deferred. A-18554 supplies five directed Darwin native files,21 tests at exact merged head; no prior-head carry substituted. Remaining full T3 merge batch, broader T4 and after-stage QA separate. Duration/test lint report-only. Reviewer settling replacement final verdict.

### rev-35 · 2026-11-11T02:09:07.957Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1785-final-2
commit: 35aeccff372f7d29c31957c88a4f56da1dcb1d4d
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-18557 final merged-head evidence review. A-18555 run174c67c2 passed exact35aeccff3; independent progress audit6013base test finishes/672file passes plus40separate load tests+40load files,zero negative. All7login-wait identities and renamed compatibility each base+5/5load, worst new-case0.400598328s. All669manifest lower/Web and466required lower/Web consumer paths have positive case+file finishes,zero missing. Selected LinuxT3 host-agent/key-spawn and mappedT4 each pass base once; no repetition claim. A-18556 agrees715conservative union:469configured+4additional exact-head native=473qualified;229T3+13T4deferred. A-18554 exact-head five local Darwin files21/21 replaces old carry, preserving raw output/command/exit/inventory limits. Fulltreefe0de48c/export02c51d2b independently match; uncached Linuxx64 Node24.21/Nvim0.12.5 HeadlessShell1248 Chrome156.0.8078.4,1112s/$0.0772. C1–C5 verified. Candidate/support/static-only distinctions retained; report-only notices not enforce proof. FullremainingT3batch/broaderT4/affectedafter-stageQA separate. Prior history retained; no Reviewer experiments.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified.

### coord · 2026-11-11T02:56:51.252Z

Merged bd8550b4db0abcd5a102538d44a762bc0b4866d9 onto dev.
