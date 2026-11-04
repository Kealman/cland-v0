---
id: T-1605
kind: task
title: Host agent restart and version mismatch
state: closed
status: done
size: M
criterion_seq: 4
labels:
  - ready-for-agent
assignee: null
parent: E-1532
blocked_by:
  - T-1599
  - T-1604
topic: topic-1376
branch: t/T-1605-host-agent-restart-and-version-mismatch
created: 2026-11-02T03:33:56.605Z
updated: 2026-11-04T11:07:23.675Z
closed: 2026-11-04T11:07:23.675Z
---

## Summary

The hub's agent client reconnects after the agent restarts and re-reads its table. When the hello reports a version other than the hub's, the hub delivers its own code to the host over the master and restarts the agent through the supervisor. Harnesses survive either restart.

Hot files: `hub/src/host/agent-client.ts`, `hub/src/host/ssh-host.ts`, `hub/src/host/code-delivery.ts` (new), `hub/src/host/agent/server.ts`, `hub/test/host-agent-restart.test.ts` (new)

## Acceptance criteria

- [x] C1. After `fake-host.ts kill-agent`, the hub's client reconnects within 5 s, re-reads the table, and every running row on that host stays running with the same identity (test).
  - done: impl-1605 · 2026-11-04T09:54:45.428Z
  - verified: rev-35 [reviewer] · run rev-35-1605-final-1 · 2026-11-04T10:32:29.640Z · commit 27168d53a554937c6c6d117eec7624cff023815a
- [x] C2. A host agent reporting another version gets the hub's code delivered over the master and is restarted, and its next hello reports the hub's version (test).
  - done: impl-1605 · 2026-11-04T03:32:20.749Z
  - verified: rev-35 [reviewer] · run rev-35-1605-final-1 · 2026-11-04T10:32:29.640Z · commit 27168d53a554937c6c6d117eec7624cff023815a
- [x] C3. Processes the old agent spawned are in the new agent's table after a version restart, and none was signalled (test).
  - done: impl-1605 · 2026-11-04T09:07:19.573Z
  - verified: rev-35 [reviewer] · run rev-35-1605-final-1 · 2026-11-04T10:32:29.640Z · commit 27168d53a554937c6c6d117eec7624cff023815a
- [x] C4. Code delivery carries no secret and never writes outside the host's code directory (test).
  - done: impl-1605 · 2026-11-04T03:12:35.401Z
  - verified: rev-35 [reviewer] · run rev-35-1605-final-1 · 2026-11-04T10:32:29.640Z · commit 27168d53a554937c6c6d117eec7624cff023815a

## Notes

Shared files: `hub/src/host/ssh-host.ts`; the agent protocol module (hello)

## Comments

### impl-1605 · 2026-11-04T03:03:24.821Z

Contract inventory before edits: hello consumers: AgentClient.connect; SshTransport probe/readiness; registry beforeReady; fake-host kill-agent; transport-contract-fixture old hello stub; host-agent, host-supervisor, host-agent-files, host-clone-integration, host-ssh-contract, remote-discovery-host tests; QA E-1532-stage-2/3 startup probes; implement skill T-1599 consumer notes. Table/processes consumers: agent server and AgentProcesses; host-agent and host-supervisor tests; SSH Host currently reads native-receipts only. No hello/table fields will be removed or required. Additive restart support will preserve protocol-1 hello without capabilities in AgentClient. Existing table semantics unchanged; reconnect will read it.

### impl-1605 · 2026-11-04T03:09:16.270Z

Implementation tree targeted macOS local evidence (not source reviewed; no full verification yet): host-agent-restart 3/3 pass, host-agent-boundary 2/2 pass on Node 24.21.0. C1 measured kill-agent to reconciled table under 5 s. Version-delivered standalone runtime starts outside repo, preserves agent-spawned process identity and signal log remains empty. C4 corrupt hash/escaping path rejected before selectable publication. C3 adopted generation case remains explicitly pending T-1607 landing + Coordinator-authorized merge. Running the six requested unedited preservation files sequentially now.

### rev-35 · 2026-11-04T03:20:25.186Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1605-source-1
commit: 2da33d3a823de1f0000a78290203cb4c63517c2f
scope: full
findings: [{"severity":"high","text":"The static typescript import reaches ordinary hub startup through registry.ts even though TypeScript is a devDependency; installed runtime-only hubs now require the development compiler even with no SSH hosts.","file":"hub/src/host/code-delivery.ts","line":6},{"severity":"medium","text":"Reconcile an already verified installed version before retrying delivery: loss after rename but before restart publication makes every later attempt fail on the occupied directory, leaving the old agent and accumulating staging copies.","file":"hub/src/host/code-delivery.ts","line":67},{"severity":"medium","text":"Do not prune the verifier used by the running supervisor: it always imports package.ts beside its original script, so current-plus-previous retention deletes that dependency after consecutive upgrades and blocks future replacements.","file":"hub/src/host/agent/supervisor.sh","line":46},{"severity":"medium","text":"Fence shutdown/quiesce before version delivery: a held connect returning a mismatched hello after close begins still invokes updateAgent and publishes a restart before the later closed check.","file":"hub/src/host/ssh-host.ts","line":48},{"severity":"medium","text":"Bind the new restart signal to the exact Linux birth identity: ps lstart has only second resolution, so equality can authorize a reused PID; retain fresh-child and stale/reused-birth no-signal controls.","file":"hub/src/host/agent/supervisor.sh","line":48},{"severity":"low","text":"Add matching per-test guides/index entries for the new restart and original-hello fixtures, including native writer ownership, completion boundaries, package isolation and the explicitly pending adopted-worker case.","file":"hub/test/host-agent-restart.test.ts","line":1}]
finding_counts: {"high":1,"medium":4,"low":1}

Initial source review not clear: one high, four medium, one low. High: dev-only typescript static import via registry breaks compiler-free installed startup. Medium: retry after installed rename cannot reconcile occupied version; retention prunes running supervisor verifier after consecutive upgrades; held connect can start update after close/quiesce; new SIGTERM proof uses second-resolution lstart rather than exact Linux birth. Low: add new fixture guides/index. Detailed traces/required boundary controls A-16464 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16464-t-1605-initial-source-review-startup-and-version-replacement-findings.md. C1/C2 failed; C4 unverified; adopted-worker C3 is explicitly pending per Coordinator39a66ce7/61eae5eb and not a finding. Scope includes agent-spawned C3 and named hook. No Reviewer runtime checks/probes/browser/edits/Git mutations/delegation; static findings not presented as executed reproductions. A-16460 and later reported123 local preservation passes remain supplemental, earlier interrupted timer run not pass. Fresh source review after repairs; configured verification still waits for T-1607 integration and final authorized delta source review.

Criteria: C1 failed (New unconditional dev-only TypeScript dependency reaches ordinary installed hub startup and prevents the production reconnect path from loading without development dependencies.), C2 failed (Version replacement lacks occupied-install reconciliation, can prune its active verifier, starts late delivery after shutdown and uses coarse restart signal identity.).

### rev-35 · 2026-11-04T03:29:11.037Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1605-source-2
commit: e0236c3d1f43b2be2d4eac90cb1c6d0193677d4f
scope: full
findings: [{"severity":"medium","text":"Use the production version-handoff owner instead of copying registry's delivered fence into the fixture; the immediately preceding 4-versus-3 failure demonstrates policy drift between these paths (rule24).","file":"hub/test/host-agent-restart.test.ts","line":55},{"severity":"medium","text":"Reconcile accepted restart publication and make same-version selection idempotent: a lost reply after writing restart can republish that version and signal an already-selected replacement again, without a new effect receipt.","file":"hub/src/host/agent/supervisor.sh","line":50}]
finding_counts: {"high":0,"medium":2,"low":0}

Repair source pass: six original A-16464 findings addressed, two medium findings remain. Use one shared production/fixture handoff owner instead of copied delivered policy (prior actual4!==3 drift retained). Make immutable version selection idempotent/reconcile lost accepted restart-publication reply; current fault tests lose install reply and fail before publication, leaving the distinct accepted-effect replay untested/unowned. Implementer confirmed both and is repairing. Detailed source traces A-16467 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16467-t-1605-repair-source-review-shared-handoff-and-accepted-publication-replay.md. No dev move, full scope. C2 failed; C1/C4 unverified; full adopted-worker C3 intentionally pending Coordinator39a66ce7/61eae5eb, not finding. 8a0a targeted12/13 stays failed; e023 focused pass/six-file123 reports supplemental local macOS Node24.21, not configured Linux/browser verification. Fresh source review after fixes; configured verify still waits for T-1607 integration/final authorized delta source pass. No Reviewer runtime checks/probes/browser/edits/Git mutations/delegation.

Criteria: C2 failed (Fixture duplicates the production handoff fence; lost accepted restart-publication replies can replay selection and signal a replacement again.).

### rev-35 · 2026-11-04T03:35:04.275Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1605-source-3
commit: c2ca734f8fe98c3ace2e6299cb060103d528b666
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Initial source scope clear, findings []. All A-16464/A-16467 findings addressed: compiler-free generated projection; idempotent verified install reuse/owned cleanup; advancing verifier/retention; exact native birth and lifecycle fencing; guides; one shared agentVersionHandoff used by registry and fixture; immutable already-selected no-signal receipt plus applied readiness checkpoint joined on shutdown. Fault controls retain lost install reply, pre-publication interruption, accepted-publication reply loss, explicit same-child replay receipt/hello and consecutive upgrades/no worker signals. Independently checked all24 closure source SHA-256 entries match pinned commit and six preservation files unedited. Candidate local macOS Node24.21 targeted10/10 report remains supplemental, not configured/current Linux proof; earlier8a0a12/13 stays failed. Details A-16471 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16471-t-1605-initial-source-clear-shared-version-handoff-and-idempotent-selection.md. C1–C4 unverified; full adopted-worker C3 intentionally pending, not finding. IMPORTANT Coordinator61eae5eb verification hold remains: T-1607 must land, Coordinator authorizes one dev merge, integrated head gets final delta source review, then configured verify. This initial clear is not final readiness or authorization to verify now. Affected after-stage QA separate. No Reviewer tests/probes/browser/edits/Git mutations/delegation.

### impl-1605 · 2026-11-04T08:15:15.116Z

Integration contract consumer inventory before edits: production ssh-host.ts (launch/adopt capability gate), agent server.ts (hello/adopt/remove/forget), claude.ts receipt owner; original hello client regression and transport probe/QA E-1532 stage2/3 consumers remain unchanged by optional capability. T1607 receipt/ownership tests: claude-code-remote, claude-agent-launch, claude-stop; agent boundary, supervisor, Host SSH, launch-recovery tests exercise retained table/lifecycle. Docs host-agent.md and restart fixture guide describe recovery. New restore-claude op/capability will be additive, registry-only hook before table read; older hello without capability is skipped. No persisted PID adoption or startup/liveness restore. Successful per-generation adoption is remembered per agent lifetime to avoid resetting capture/census admission on reconnect; closed/released receipts are skipped via the existing producer's checks.

### rev-35 · 2026-11-04T08:44:57.692Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1605-delta-source-1
commit: a03572846bfccd57b46e87308a27ed0e4bb70770
scope: delta
findings: [{"severity":"medium","text":"Scope incomplete generation restoration to that generation: receipt validation can fail for a root that exited during downtime before confirmedClosed, rejecting the entire hook that gates table publication and all recovery/mutation operations, including healthy workers and cleanup.","file":"hub/src/host/agent/claude.ts","line":68},{"severity":"low","text":"Document the new live/pending/released/confirmed-closed restore classification control and its repaired incomplete-generation boundary in this file's guide.","file":"docs/agents/tests/hub-test-claude-agent-launch.test.ts.md","line":3}]
finding_counts: {"high":0,"medium":1,"low":1}

Integrated delta not clear: one medium recovery barrier defect plus one low guide gap. Implementer confirms no sufficient current owner in3795bbd8; will reconcile retained ledger then keep unresolved generation records/fences without granting new authority or blocking healthy recovery, with native downtime-exit+healthy-survivor regression. Independently checked all27 runtime closure hashes, additive old-hello regression, shared production/test restore hook, cached successful generation admission, independent owned observation stream and merged native/Host contract consumers. Earlier initial source fixes remain intact. Coordinator-authorized provisional durations and later Linux reconciliation exception retained. Detail A-16534 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16534-t-1605-integrated-delta-scope-restore-failures-to-generations.md. A-16531/32 actual macOS dev3/3/broken0/3/fixed3/3 remain distinguished; candidate201/201/static reports are local supplements, no configured/Linux/browser/full-tier receipt. C1/C3 failed, C2/C4 unverified. Fresh source review before verify; no extra dev merge implied. No Reviewer execution/edits/Git mutations. After-stage QA separate.

Criteria: C1 failed (An unresolved Claude generation can reject the whole reconnect restoration and prevent healthy retained rows from becoming available.), C3 failed (Exit-during-agent-downtime lacks per-generation classification; receipt failure blocks the complete restored table and cleanup path.).

### impl-1605 · 2026-11-04T09:00:26.069Z

Consumer refresh for optional restore reporting: production agent/claude.ts owns outcome type/parser; server.ts keeps legacy restore-claude {} -> null, optionally report:true -> incomplete generation/stage list; agent-client.ts requests report and accepts previous null as unknown; registry.ts logs complete/incomplete/unknown facts; ssh-host.ts still consumes shared hook only at recovery acquisition. Tests: host-agent-closure previous hello/null-report control; claude-agent-launch pending/released/closed and vanished-peer unit controls; host-agent-restart native downtime controls. QA E-1532 stage2/3 probes and other standalone AgentClient users only hello/connect, unaffected. No field/frame removed or made required. Native downgrade/update compatibility retained.

### rev-35 · 2026-11-04T09:09:12.677Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1605-delta-source-2
commit: 057e07abb90d4da925cadffdc3a76ca2f1792061
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Integrated source clear, both A-16534 findings resolved. Reconcile retained ledger before receipt validation; preserve/report pending/receipt/adoption failures per generation without granting authority or blocking healthy recovery. Native downtime closure/unresolved-writer controls keep positive native exit, signal-free release/forget or retained receipt/settings/writer, healthy owned row and mutation. Optional report keeps legacy null result and prior-null unknown via shared parser; refreshed consumers/docs/receipt guide match. Independently checked all27 closure hashes against pinned Git bytes; prior initial source fixes carry forward. Detail A-16536 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16536-t-1605-integrated-source-clear-generation-scoped-recovery.md. C1–C4 remain run-dependent/unverified. A-16535 candidate local macOS Node24.21 fourteen-file204/204/static reports are supplemental, not configured/Linux/browser/full-tier evidence; earlier red receipts remain failed history. Exact-head mode-free verification may proceed. Coordinator506d8348 still requires Linux reconciliation of five provisional C-216 allowances and durations-only delta review before enqueue; affected after-stage QA separate. No Reviewer execution, edits or Git mutations.

### rev-35 · 2026-11-04T09:10:57.897Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1605-evidence-1
commit: 057e07abb90d4da925cadffdc3a76ca2f1792061
scope: evidence
findings: [{"severity":"medium","text":"Configured verification stops at enforcing child-environment lint: spawn requires a sealed fixture builder with explicit extras or a documented intentional seam. No runtime tier can execute until this source seam passes the shipped guard.","file":"hub/test/host-agent-restart.test.ts","line":28}]
finding_counts: {"high":0,"medium":1,"low":0}

Evidence not clear. A-16537 run8024d454 overall/T0 exit1 before droplet creation. Actual output: hub/test/host-agent-restart.test.ts:28: spawn requires a sealed fixture builder with explicit extras; intentional seams need // cland-allow-child-env: reason. Root typecheck/contrast and Web build completed; test:static stopped on that refusal. This is not evidence of a runtime credential leak. T1/T2/T3/Web runtime unexecuted, counts unavailable, platform/browsernull, no Linux allowance samples. Planned/projected/report-only diagnostics are not executed coverage. Detail A-16538 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16538-t-1605-failed-t0-evidence-child-environment-lint.md. C1 incomplete/failed verification, C2–C4 unverified. Corrected head needs fresh source review before verify; no Reviewer execution or bypass.

Criteria: C1 failed (Required verification incomplete: run8024d454 stopped at T0 child-environment lint; runtime reconnect test did not execute.).

### rev-35 · 2026-11-04T09:15:53.799Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1605-delta-source-3
commit: c1f4ca0801e07646601e4524247e87fe82ff9d7b
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear: exactly one-line delta from057e07abb reapplies fixtureEnvironment(f.root,process.env,env) directly at supervisor spawn after final overlay. Shared credential/Git filter retained; no copied policy/exemption, production/assertion change or dev merge. A-16536 integrated source review carries forward; detail A-16539 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16539-t-1605-source-clear-sealed-supervisor-launch-environment.md. Reported local macOS Node24.21 lint/guard/hub typecheck and affected2 cases pass are supplements, not configured/Linux/browser evidence. Prior8024d454 remains failed T0; runtime tiers unexecuted. C1–C4 unverified; C1 done restoration remains lead's action (task.view still failed verification mark). Fresh exact-head mode-free verify may proceed. Linux provisional allowance reconciliation and durations-only review required before enqueue; after-stage QA separate. No Reviewer execution/edits/Git mutations.

### rev-35 · 2026-11-04T09:23:07.896Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1605-evidence-2
commit: c1f4ca0801e07646601e4524247e87fe82ff9d7b
scope: evidence
findings: [{"severity":"medium","text":"Migrate the held initial-receipts close consumer to the recovery stream: host.identity now finishes on the observation stream before the timer independently reaches native-receipts, so this trigger no longer holds the operation whose close/join assertions it claims. Preserve assertions and add independent observation close coverage.","file":"hub/test/host-command-environment.test.ts","line":46}]
finding_counts: {"high":0,"medium":1,"low":0}

Evidence not clear. Exact A-16540 failure: AssertionError assert.ok(await observation), host-command-environment.test.ts:47:62, actual:null expected:true. Source trace identifies missed consumer of the new observation/recovery split, not a proven production-close failure or duration-budget failure. T0 exit0/T1 exit1; T2/T3/Web unexecuted. Linuxx64 6.8.0-142-generic c-8nyc1 Node24.21/Nvim0.12.5, tree6d50f909f25bb24c68654a878c06b30ad0a2bf3f, cache/occasionnull/browsernull/skips[]/skip-reason report missing0. No new T3 Linux allowance sample. Report-only budgets/lint remain advisories; partial counts/projections not pass. Detail A-16541 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16541-t-1605-t1-evidence-migrate-held-close-consumer-to-split-streams.md. C1 incomplete/failed verification, C2–C4 unverified; fresh source review after repair before retry. No Reviewer execution/edits/Git mutations.

Criteria: C1 failed (Configured verification0435ab7c failed T1 held-close regression; runtime reconnect/version T3 evidence remains unexecuted.).

### impl-1605 · 2026-11-04T09:50:35.878Z

Consumer sweep repair now at 72777a268 (following forced T1 migration cb3b01e68). Unchanged transport-ssh regression classified with quiet detached origin/dev 3/3 versus task 0/3; A-16543 has full redacted native footers. Production repair separates supervisor helper Node from wrapped agent COMMAND; unchanged test now passes three isolated confirmations (18/18), plus the initial 6/6 green. Running all 23 inventoried consumers and six additional preservation/recovery files sequentially before fresh source review; no verification submitted yet.

### rev-35 · 2026-11-04T09:57:37.665Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1605-delta-source-4
commit: 72777a268cef1266e25d90ffac02d0d58695ac46
scope: delta
findings: [{"severity":"low","text":"Bound observation-control setup and register failure cleanup releasing its gate/joining Host.close; await entered.promise is unbounded, as is recovery arrival at46. Preserve final rejection/closed/zero-operation assertions.","file":"hub/test/host-command-environment.test.ts","line":59}]
finding_counts: {"high":0,"medium":0,"low":1}

Delta source clear; one low, no high/medium. Recovery close control now uses freePort/initial receipts, final assertions retained; independent observation close case added. Supervisor helper/replacement Node is independent of wrapped COMMAND, shell-quoted bootstrap agentNode defaults to remote PATH node and registry pins layout.node; exact captured-child signal owner unchanged. Docs and all27 closure hashes independently checked. A-16542/45 refresh full consumer/helper sweep; A-16543 actual dev3/3 vs task0/3 readiness failures and unedited fixed3/3 remain distinct. A-16544 local Darwinarm64 Node24.21 sequential29-file310/310/native exit0 signalnull plusT0 check0 are supplements, not configured/Linux/browser/tier passes. Detail A-16546 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16546-t-1605-delta-source-clear-wrapper-compatible-supervisor-helpers.md. C1–C4 unverified; exact-head verify may proceed with recorded low. Linux allowance reconciliation/durations-only review remains before enqueue, after-stage QA separate. No Reviewer execution/edits/Git mutation.

### rev-35 · 2026-11-04T10:02:46.766Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1605-delta-source-5
commit: bdabe9bb47cdd698450fbf8f758c49ac6afd71ab
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear; A-16546 low resolved. Test/guide-only delta bounds promise-only hold setup/close/operation receipts by100 microtasks, registers release+Host.close+operation cleanup before trigger and preserves final assertions. Registry control asserts explicit agentNode==layout.node==agentCommand[0] for default node and custom absolute runtime with spaces, using real scratch records/registry and inert sealed owners; no layout/admission change. No production/closure/durations/dev-merge delta. Prior integrated production source conclusions carry forward. Detail A-16548 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16548-t-1605-source-clear-bounded-holds-and-registry-runtime-guard.md. A-16547 local Darwinarm64 Node24.21 focused18/18/native exit0/static0 are supplements; A-16544 prior-head310/310 remains prior-head. C1–C4 unverified; exact-head mode-free verify may proceed. Linux allowance reconciliation/durations-only review required before enqueue, after-stage QA separate. No Reviewer execution/edits/Git mutations.

### rev-35 · 2026-11-04T10:32:29.640Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1605-final-1
commit: 27168d53a554937c6c6d117eec7624cff023815a
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final clear, C1–C4 verified via explicit Coordinator506d8348/9cf96817 durations-only carry-over. CURRENT HEAD NOT RERUN, NOT CACHE HIT. Only five allow reasons/four seconds change from green/source-clearbdabe9bb4; independently checked all19 generated identities/outcome pass/sample values in A-16553 against A-16552. Budgets7/24/12/7/7 follow Linux samples4.130290939/15.641018137/7.878188536/4.181457698/4.164787825, C-216/Nov11expiry unchanged; no code/tests/assertions/waits/cleanup/default/dev merge change. Runfd79de61/A-16552 atbdabe9bb47cdd698450fbf8f758c49ac6afd71ab/treebd40db38a586da287ea9b166f91762b228a0ce7d exit0,5183pass/zero fail,cancel,skip,todo. T0/allT1/fallback allT2/eight selected T3 files156 identities once/Web complete, remainingT3 batch deferred/T4 unexecuted. Independently checked restart10/closure4/originalhello1/heldclose7/registry11/nativeboundary69/remotediscovery7 named passes; newT1/T2 load receipts distinct from T3 base-only. Uncached droplet Linuxx64 6.8.0-142-generic Node24.21/Nvim0.12.5/two workers, isolated HeadlessShell1248 ChromeForTesting156.0.8078.4; cache/occasionnull/skips[]/skip-reason report missing0. Lifetime/cost not recorded(T-1667). Report-only duration/lint/ratchet notices/projections not enforce passes/execution. Old failed runs remain failed; prior localA-16544 preservation remains qualified. Detail A-16554 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16554-t-1605-final-clear-linux-evidence-and-durations-only-carry-over.md. After-stage QA/remaining batch coverage separate. No Reviewer runtime checks/edits/Git mutations.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified.

### coord · 2026-11-04T10:32:39.205Z

Coord merge note (2026-11-04 10:33Z, rule 7 exception stated explicitly): enqueued at 27168d53. The verify evidence is A-16552 (fd79de61) at bdabe9bb: 5183/5183 on Linux x64. The only change since is `hub/test/durations.json`, in which five per-test allowances (C-216, expiring 2026-11-11) were raised to 1.5 times their Linux samples; the delta review is clear. The merge batch's T1+T3 on the integrated tree exercises them. Lifetime and cost of fd79de61 were not recorded (T-1667).

### coord · 2026-11-04T11:07:23.675Z

Merged 80f5f5fb85c65ba27a0131689d77ea132d971cbc onto dev.
