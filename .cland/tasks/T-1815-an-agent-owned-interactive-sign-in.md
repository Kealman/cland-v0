---
id: T-1815
kind: task
title: An agent-owned interactive sign-in operation with input, bounded output and close receipts
state: closed
status: done
size: S
criterion_seq: 5
labels:
  - ready-for-agent
assignee: null
parent: E-1535
blocked_by: []
topic: topic-1482
branch: t/T-1815-an-agent-owned-interactive-sign-in
created: 2026-11-11T18:09:00.346Z
updated: 2026-11-11T21:31:39.978Z
closed: 2026-11-11T21:31:39.978Z
---

## Summary

T-1791 (signing in from a card) needs the hub to run a harness's own sign-in on a pool host without a human terminal, and its ticket says to split the runner out as an S ticket first if it needs its own agent operation. It does: `Host.spawn` ignores stdin and captures neither output stream, `Host.run` returns output only after exit, and the existing `ssh -t` plan serves only a human terminal. A hub-owned 15-minute limit needs an observed remote close before it completes and unmounts (rules 9 and 12, and T-1790's interrupted sign-in fence), which a local SSH close cannot provide. impl-1791 made the case in topic-1480 (2026-11-11 18:08Z).

## What to build

One host-agent operation that runs a harness sign-in command for an admitted login disk: it owns the process's stdin (an input the hub writes in memory only, never logged or persisted), streams bounded stdout and stderr back for link and code parsing, and reports a positive close receipt (exit code or signal) pinned to that operation's native admission. A cancel from the hub ends the process tree and still reports its close receipt; a hub restart treats an admitted operation without its receipt as owner loss under T-1790's fence. Agent code imports only Node built-ins, other agent modules and its credential leaf; the committed closure is regenerated.

## Acceptance criteria

- [x] C1. The operation runs a fake harness sign-in on a fake host's agent, delivers an input line written by the hub to the process's stdin, and streams its output to the hub within a fixed byte bound (test).
  - done: impl-1815 · 2026-11-11T18:41:55.642Z
  - verified: rev-35 [reviewer] · run rev-35-1815-final-1 · 2026-11-11T19:20:07.037Z · commit e9389810486f8d15cc158b102cff08d8917f5d01
  - verified: rev-37 [reviewer] · run rev-37-1815-evidence-1 · 2026-11-11T20:04:12.459Z · commit 2b2add0f218e8f9c957a776bd33731c71856f307
- [x] C2. The process's exit is reported as a close receipt with its code or signal, pinned to the operation's admission, and a receipt for another admission is refused (test).
  - done: impl-1815 · 2026-11-11T18:41:57.363Z
  - verified: rev-35 [reviewer] · run rev-35-1815-final-1 · 2026-11-11T19:20:07.037Z · commit e9389810486f8d15cc158b102cff08d8917f5d01
  - verified: rev-37 [reviewer] · run rev-37-1815-evidence-1 · 2026-11-11T20:04:12.459Z · commit 2b2add0f218e8f9c957a776bd33731c71856f307
- [x] C3. A hub cancel ends the process tree and reports its close receipt; nothing is unmounted before that receipt (test).
  - done: impl-1815 · 2026-11-11T18:49:05.243Z
  - verified: rev-35 [reviewer] · run rev-35-1815-final-1 · 2026-11-11T19:20:07.037Z · commit e9389810486f8d15cc158b102cff08d8917f5d01
  - verified: rev-37 [reviewer] · run rev-37-1815-evidence-1 · 2026-11-11T20:04:12.459Z · commit 2b2add0f218e8f9c957a776bd33731c71856f307
- [x] C4. The input bytes appear in no log line, journal record, agent file or receipt (test).
  - done: impl-1815 · 2026-11-11T18:22:35.360Z
  - verified: rev-35 [reviewer] · run rev-35-1815-final-1 · 2026-11-11T19:20:07.037Z · commit e9389810486f8d15cc158b102cff08d8917f5d01
  - verified: rev-37 [reviewer] · run rev-37-1815-evidence-1 · 2026-11-11T20:04:12.459Z · commit 2b2add0f218e8f9c957a776bd33731c71856f307
- [x] C5. host-agent-boundary and host-agent-closure pass with the regenerated closure (test).
  - done: impl-1815 · 2026-11-11T18:41:58.232Z
  - verified: rev-35 [reviewer] · run rev-35-1815-final-1 · 2026-11-11T19:20:07.037Z · commit e9389810486f8d15cc158b102cff08d8917f5d01
  - verified: rev-37 [reviewer] · run rev-37-1815-evidence-1 · 2026-11-11T20:04:12.459Z · commit 2b2add0f218e8f9c957a776bd33731c71856f307

## Blocked by

None (can start immediately).

## Notes

- Hot files: `hub/src/host/agent/server.ts` (the operation), `hub/src/host/agent/` (a new sign-in module), `hub/src/host/host.ts` or the Host contract (the client call), the committed agent closure.
- Tests: new `hub/test/host-agent-signin-op.test.ts` (T3 with a fake host's agent and the fake binaries; T1 boundary and closure).
- T-1791 builds its card owner on this operation; T-1790's interrupted fence and `prepareExistingLoginSignIn` stay the entry points.

## Comments

### impl-1815 · 2026-11-11T18:11:32.886Z

Rule 20 sweep before edits: shared suite importingTests graph from Host, protocol, server, AgentProcesses and sshHost reaches 768 tests plus 14 unknowns (all counted reached), full census attached in topic-1482. Explicit consumers: AgentClient hello/event parser, sshHost process event/table/native-receipt handling, AgentProcesses persistence and restart readers, login-add/signin terminal command planner, provider/fake and agent operations; docs/hub/ssh-host.md, docs/agents/host-agent.md and QA E-1531/1533/1534/1535/1536 host fixtures. Existing process frames/rows and optional Host methods remain unchanged; new signin-v1 capability gates new calls and old-hello regression will assert refusal. Native closure implementation reuses existing process admission/stop owner; reached native files include host-agent, host-agent-restart, host-login-disk, host-create-ready/destroy/restart/unreachable/stop and login-write-back; ordinary spawn/stop paths unaffected by optional interactive IO. New operation/card consumer is T-1791 (settled contract in topic).

### impl-1815 · 2026-11-11T18:25:26.238Z

Additional rule-20 canonical-helper sweep (Coordinator-approved relocation): mountedOpenCodeDatabase production consumers are accounts/registry re-export, host/login-binding.ts (loginEnvironment), host/login-signin.ts via shared signInCommand, and new agent/signin-command.ts. Test consumers: accounts-policy exact-source allowance/positive controls; login-binding dynamic registry import and fake path-mapping assertions; signin-command test, login-signin plan test; transitive graph already counts tests reaching registry/state-paths as reached/unknown. Documentation consumers: docs/hub/logins.md:129/416, docs/agents/tests/hub-test-accounts-policy.test.ts.md, QA E-1535-stage-2 exact binding builder checks and registry helper reference. Registry re-export preserves all existing runtime/docs references and QA builder lines. Move allowance rather than copy; update exact-file positive controls. Current pinned head RED in accounts-policy and host-contract-coverage; fix waits full source pass.

### rev-35 · 2026-11-11T18:29:56.073Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1815-source-1
commit: bdf917ec5cfe549d757008d935b7ad09353d8b28
scope: full
findings: [{"severity":"high","text":"Standards rules12/25/26 and SpecC3: start's catch deletes the run and releases disk mutation admission after any AgentProcesses.spawn rejection. The inherited spawn catch kills/awaits only the root child close and removes launch admission, not an exact owned-tree receipt at every bootstrap/release/publication failure. A descendant with independent stdio can remain while unmount becomes admissible. Lead98867ae5 confirms. Release only on positive not-admitted or owned-tree closure; otherwise retain the operation/native ownership and mutation fence. Add fresh post-spawn/checkpoint failure and retained-descendant/unmount regressions.","file":"hub/src/host/agent/signin.ts","line":69},{"severity":"medium","text":"Standards rules9/12/25 and SpecC2/C3: interactive.closed is called only on nativeCompletion fulfillment; its rejection handler swallows persistence/publication failure. An accepted sign-in can therefore leave closed unresolved forever on a still-connected peer instead of emitting CLAND_NATIVE_INCOMPLETE. Lead98867ae5 confirms no failure callback. Propagate the exact native owner's rejection to the operation/client, retaining mutation admission, and test held/failing native-close checkpoint/publication.","file":"hub/src/host/agent/processes.ts","line":274},{"severity":"medium","text":"Standards rules9/25 and SpecC2: receipt validation accepts code:null/signal:null or an empty signal, although those provide no observed exit code or signal. Lead7ebee006 confirms no outer schema rejects them. Require a concrete native code or nonempty signal in shared producer/client validation, refuse malformed/no-exit receipts as CLAND_NATIVE_INCOMPLETE, and preserve admission mismatch/old-wire controls.","file":"hub/src/host/signin-client.ts","line":24},{"severity":"medium","text":"Standards rule20: new optional Host.signIn is absent from the reusable Host contract. The exhaustive/planted Host-member guard now fails with uncovered+signIn; lead98867ae5 confirms no exception and retained RED2f0585a5/A18832 establishes exact failure. Add meaningful reusable optional/capability/refusal/shape coverage and planted controls without excluding the member or weakening the exhaustive guard.","file":"hub/src/host/host.ts","line":39},{"severity":"medium","text":"Standards rules20/24: a new opencode.db path literal duplicates mountedOpenCodeDatabase outside the exact accounts-policy target, and login-signin stops using the canonical helper. Existing source guard fails ('signin-command.ts contains opencode.db'); no original migration exception. Coordinator d8245071 now authorizes moving the one pure helper to agent/state-paths.ts, registry re-export, and moving—not copying—the exact policy target/controls. Migrate every helper consumer and regenerate closure after that repair.","file":"hub/src/host/agent/signin-command.ts","line":9},{"severity":"medium","text":"Spec's settled follow-up contract c3f8dde4: before-admission failures are still generic Errors, so the card owner cannot distinguish safe no-native-admission cleanup from unknown owner loss. Lead ee3a6c21 confirms this required addition is not implemented. Carry typed nativeAdmission:'not-admitted' plus cause-specific code (CLAND_SIGNIN_UNAVAILABLE for absent/old capability) through the client/agent error seam with pre-spawn controls. After admission, only exact close or CLAND_NATIVE_INCOMPLETE may settle classification; generic errors stay unknown.","file":"hub/src/host/signin-client.ts","line":7},{"severity":"medium","text":"Standards rule23: every settled run remains in the authenticated peer's runs Map indefinitely, retaining ChildProcess, stream/redactor state and promises over all completed sign-ins. Lead7ebee006 confirms no retirement bound or policy. Retire settled native objects after durable closure; if repeated cancel needs a receipt cache, bound it and retain no native authority in cached records. Keep unknown/incomplete owners fenced and add repeated-run retained-state/work-count coverage.","file":"hub/src/host/agent/signin.ts","line":14}]
finding_counts: {"high":1,"medium":6,"low":0}

A-18835 complete pinned source1 NOT CLEAR:1high/6medium. Lead confirms spawn-rejection root-only cleanup/unconditional mutation release, swallowed native-completion rejection, no-exit receipt acceptance, missing reusable Host.signIn contract, duplicate opencode.db policy target, required typed not-admitted refusal and unbounded settled-run map. Coordinatorc3f8dde4 adds typed refusal;d8245071 authorizes single agent/state-paths helper+registryre-export/moved exact guard. Happy-path bounds/redaction/admission/durable-close and native fixture ownership aligned;47 closure hashes match. A18832 honest tool excerpts/candidate limits and unchanged-red source guards retained;A18833 independently checked793paths116T1/360T2/251T3/14T4/52Web,776reached14unknown plusexplicit, no reach→coverage claim. Native4 finite files supporting pre-review receipts only; no Linux/current final proof. C1/C2/C3/C5failed, C4run-dependent/unverified. Clean fixed head; no Reviewer experiments/source mutation. Hold released for consolidated fixes/fresh committed source review before native/configured verification, no provenance-only reruns.

Criteria: C1 failed (Required typed pre-admission refusal/capability classification is absent; current generic errors cannot authorize safe card cleanup.), C2 failed (Native-completion rejection is swallowed and no-exit null/null or empty-signal receipts are accepted; exact terminal outcome proof is incomplete.), C3 failed (Rejected starts release mutation admission using root-close-only cleanup without an exact owned-tree receipt, allowing retained descendants before unmount.), C5 failed (Required exhaustive Host contract and canonical path-policy consumers are unmigrated and fail at this head; helper repair needs closure regeneration.).

### impl-1815 · 2026-11-11T18:34:30.340Z

Failure-path consumer addendum before lease contract extension: loginDiskOperation.enterMutation is consumed only by agent/server.ts generic mutation release and signIns factory. Its existing callable release stays compatible; new optional incomplete() marks an unresolved sign-in owner and rejects disk mutation waiters with existing writers-remain (rather than hanging a server close forever). No lease is released on that negative receipt; mounted disk/native admission metadata remain. signIns T1 fake lease is callable-only and remains supported. Existing host-login-disk native cases cover normal writer joining; new fault cases cover already-waiting and later unmount refusal.

### rev-36 · 2026-11-11T18:48:18.346Z

verdict: review
result: not clear
by: rev-36 [reviewer]
run: rev-36-1815-source-2
commit: 45aa1a1f0176f3275730a8337caef7b30bb76f9f
scope: full
findings: [{"severity":"medium","text":"signIns.close uses fail-fast Promise.all for per-run cancel/closed joins. One failed run can reject peer shutdown while another higher-level sign-in receipt checkpoint is still writing; server.pending then drops that aggregate, and AgentProcesses.drain joins only native completion. No omitted owner (Implementer confirmed). Await every started per-run shutdown join before aggregating failures; add a mixed failed/held-checkpoint regression whose own failure-path writer is independently joined.","file":"hub/src/host/agent/signin.ts","line":84}]
finding_counts: {"high":0,"medium":1,"low":0}

A-18844 complete pinned source2 audit: Standards 1 medium / Spec C3 ownership incomplete. All seven source1 findings repaired in source; remaining fail-fast shutdown gap confirmed by 17722f7f. C1/C2/C4/C5 unverified. Static SHA256 of all 47 committed closure entries matches pinned bytes; not an executed C5 check. A-18837 local candidate excerpts/supporting native 5+22+14+11 remain qualified; exact reviewed-head native four-file repeat and Linux verify pending after fixed source review. A-18841 conservative union has 794 paths retaining prior 793 plus current/unknown/explicit; graph not coverage. T1 filesystem concern resolved, no tier finding. No Reviewer execution/source edits. Pin pass complete: fix join, regenerate closure, fresh committed review; no provenance rerun/global cleanup requested. Other T3/T4/after-stage QA separate.

Criteria: C3 failed (Mixed-run shutdown can reject before another accepted sign-in receipt checkpoint is joined; peer/native drain has no higher-level write owner.).

### rev-36 · 2026-11-11T18:50:19.378Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1815-delta-source-1
commit: d79a0b206bcaf03cb232e282ad44ef4b12f69368
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

SOURCE CLEAR, A-18846; Standards 0 / Spec 0. Entire four-file delta closes A-18844: every started per-run cancel/receipt join settles before failures aggregate, failed owner hold remains, and mixed-run regression has an independent finally join protecting its root on RED. Closure regenerated; all 47 pinned Git file hashes independently match. No Reviewer execution. C1-C5 remain runtime-unverified. Coordinator-directed exact-head native four-file repeat then exact-head mode-free Linux verify next; final native/case/file/consumer-union proof still required. Preserve earlier reds/candidate limits and 794-path conservative union; full other T3/T4/after-stage QA separate. No provenance rerun or cleanup requested.

### rev-35 · 2026-11-11T18:55:16.111Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1815-delta-1
commit: e9389810486f8d15cc158b102cff08d8917f5d01
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-18852 SOURCE delta CLEAR: Standards0/Spec0. Complete net diff from rev36 source-clear d79a0b206/A18846 touches only durations.json: one stale registry-helper sample0.00069 removed, no added/changed measurements or allowances, no transfer to pure-agent-helper identity. Intermediate rename superseded. All source/import/test-body bytes unchanged; four directed native files independently byte-equal. Coordinator7f2b048c accepts A18848 carry, retaining actual d79 run identity; no new-head native pass invented. Previous verify refused stale-key preflight before enqueue; no Linux phases ran. C1–C5 remain runtime-unverified. Clean pinned head/read-only audit, no Reviewer execution/edit. Hold released for directed mode-free verify at e93898104; final named case/file/native/consumer reconciliation and runtime settlement still required. FullT3/T4/after-stageQA separate; no provenance/native repeat requested.

### rev-36 · 2026-11-11T18:56:23.873Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1815-delta-source-2
commit: e9389810486f8d15cc158b102cff08d8917f5d01
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

SOURCE CLEAR, A-18853; Standards 0 / Spec 0. Only stale registry-helper duration key0.00069 removed; parsed manifest otherwise identical, no transfer/new baseline, allowance or policy change. Prior verification admission refused before enqueue, no Linux run. Independently read Coordinator7f2b048c carrying A-18848; complete diff durations-only and four directed native test bytes independently equal. A-18848 parent d79a0b206 retains named 5+22+14+11=52 passes, exit0/commands/cwd/macOS-arm64 Node24.21 with original capture limits; do not reattribute parent receipts. C1-C5 remain unverified until exact-head mode-free Linux receipt and final consumer/case/file accounting. No Reviewer execution or extra native run. Preserve 794-path conservative union, old reds and cleanup limits; other T3/T4/after-stage QA separate.

### rev-35 · 2026-11-11T19:20:07.037Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1815-final-1
commit: e9389810486f8d15cc158b102cff08d8917f5d01
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-18856 final CLEAR: Standards0/Spec0,C1–C5 verified. Independent A18854 audit at exact e93898104/normalized e70d18ce:6133 base tests/680 base files,195 separate load tests+195 load-file envelopes (39×5),zero negatives/skips/cancellations;all679 manifest lower/Web files have case+file receipts. All40 A18855 required generated names/line outcomes/durations checked, native5 once, owner4/client6 base+5, boundary/closure/exhaustive Host/canonical guards pass. A18848 parentd79 native4files52 named passes/tool exit0 verified;byte-equal carry authorized7f2b048c,not new-head execution. Raw merged tool capture/no separate signal/full stdout-stderr/write-time redactor limits and existing positive-control prepub scan fact retained; A18815/T1808 fake-only disposition accepted. A18855 exact794 prior union preserved:530 current Linux receipt aggregates checked,3 additional native carries,247 otherT3/14T4 deferred;3 carries still need ordinary Linux batch. Native TMPDIR9885 equality summary/prior cleanup limits preserved,not global-cleanup claim. Linux droplet/browser/executor/modes recorded;report-only advisories not clean-budget claim. Rev36 source2/mixed-run and A18852/53 metadata clear remain intact;clean fixed head, no Reviewer experiments/edits. Hold released; fullT3/T4/after-stageQA separate, no further run requested.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified.

### rev-37 · 2026-11-11T19:39:04.977Z

verdict: review
result: clear
by: rev-37 [reviewer]
run: rev-37-1815-delta-1
commit: 2b2add0f218e8f9c957a776bd33731c71856f307
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Authorized T-1794 merge delta source clear; Standards0/Spec0. Reviewed all23 changed paths and combined docs resolutions retaining both sections under Coordinator c2f9765c. Canonical signInCommand and existing interrupted/native-close ownership remain intact; agent/client/closure and four directed native test bodies independently byte-equal to e93898104. afterSignIn is forwarded on bound/unbound renewal and invoked only after durable finishSignIn/owner settlement; failure does not undo sign-in. Session relaunch reuses current worktree/conversation and lifecycle owner; post-slot captured-generation/running/archive admission protects queued stop/archive/resume. Shared bool parser/defaultfalse/config/help/golden/docs and deterministic/native tests match. A-18866 graphs all4 native targets reached/unknown0: no native carry across shared runtime merge, fresh four-file receipts still required. Source assessment and limits in A-18869 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-18869-t-1815-t-1794-merge-delta-source-clear-at-2b2add0f2.md). No new C1–C5 verified; runtime criteria await fresh native set and mode-free configured run at exact reviewed head. Preserve prior794 conservative consumers/unknowns plus incoming/new login-relaunch test and reconcile actual named case/file receipts; remaining fullT3/T4/after-stageQA separate. Current progress reports are not completed evidence. Reviewer ran no tests/typecheck/native/browser and made no edits.

### rev-37 · 2026-11-11T20:04:12.459Z

verdict: review
result: clear
by: rev-37 [reviewer]
run: rev-37-1815-evidence-1
commit: 2b2add0f218e8f9c957a776bd33731c71856f307
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final merged-head evidence CLEAR; Standards0/Spec0, C1–C5 verified. Independently streamed A-18875/runbdc78299:6147 base test and682 base file passes;195 separate load-test/195 load-file passes; zero negative/skipped/cancelled finishes. Head/branch/canonical tree1c5aab0ff379f2e89dbfef93b7faad64e78fa027 independently matched, cached:null. All56 required generated names/line outcomes/durations in A-18877 checked against raw log: previous40 plus incoming relaunch/config/native16. Native operation5 Linux passes once; client6/owner4 and redactor/command/optional contract/canonical controls have separate base+5 observations. Boundary3/closure5/exhaustive Host/canonical source guards pass. C1 stdin/hash/bounded output, C2 exact admission/close and refusals, C3 descendant/checkpoint/unmount fences, C4 split-echo/file scan positive control, C5 regenerated closure all established by reviewed assertions and current receipts. A-18870 fresh exact-head macOS arm64 Node24.21 native4=52passes/tool exits0; no runtime carry. Raw merged capture/no separate signal or independent streams/write-time redactor limits and producer positive-control prepub scan fact retained under read CoordinatorA-18815/T1808 disposition. TMPDIR9887 comparison unchanged; /private/tmp14 additions (inventory+13aliases) left intact, no global-cleanup claim. Conservative815 union preserves prior794/unknowns; all134T1/362T2/52Web consumer files have case+file receipts,2/253T3 Linux and3 additional freshMac native files;248otherT3/14T4 deferred. All680 lower/Web manifest files+2selectedT3 files have receipts. Linux dropletc-8lon1/kernel147/Node24.21/Nvim0.12.5/isolatedHeadlessShell1248 Chrome156.0.8078.4; T0/allT1/fallbackallT2/Web/selectedT3 complete, fullremainingT3/T4/after-stageQA separate. Report-only advisories retained, no enforced-budget/totalwall claim. Full criterion/consumer/capture assessment A-18878, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-18878-t-1815-merged-head-final-c1-c5-evidence-review.md. Reviewer performed read-only inspection only.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified.

### coord · 2026-11-11T21:31:39.978Z

Merged 7d2f0a59bc03d2b2e6f07359204d079921d5c7b8 onto dev.
