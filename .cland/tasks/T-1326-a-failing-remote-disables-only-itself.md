---
id: T-1326
kind: task
title: A failing remote disables only itself; the hub, the web edge and other remotes serve on
state: closed
status: done
size: S
criterion_seq: 1
labels:
  - ready-for-agent
assignee: null
parent: E-1307
blocked_by:
  - T-1321
topic: topic-1078
branch: t/T-1326-a-failing-remote-disables-only-itself
created: 2026-10-26T02:28:47.457Z
updated: 2026-10-26T04:21:20.412Z
closed: 2026-10-26T04:21:20.412Z
---

## Summary

A remote that throws at start or later disables only itself, with the reason in the log and in the remote's state. The hub, the web edge and the other remote serve on.

## What to build

Isolate each remote's start and run loop in the gateway. A failure marks that remote disabled with its reason in the hub log and in its state row. It never propagates to the hub, the web edge or another remote. Spec §3.1.

## Acceptance criteria

- [x] C1. A test messenger that throws at start, and another that throws after serving, each disable only themselves with the reason logged and stored, while a second test messenger and the web edge keep serving (test).
  - done: impl-1326 · 2026-10-26T03:54:09.544Z
  - verified: rev-31 [reviewer] · run rev-20261026-1326-final · 2026-10-26T04:15:28.634Z · commit b2b8c52dcb7274dfaa5397dcce7d6bb9ec3c4396

## Comments

### impl-1326 · 2026-10-26T03:42:36.539Z

Consumer audit before lifecycle/state contract edits: production Remote/Gateway constructors are only hub/src/hub/daemon.ts (both startup paths); Remote test injection is hub/test/harness.ts; concrete fake and all lifecycle clients are hub/test/fakes/messenger.ts and hub/test/gateway.test.ts (including old one-argument start implementations). Docs/skills consumer is docs/agents/tests/hub-test-gateway.test.ts.md plus implement skill gateway paragraph; QA/fixture/startup/persisted reader and T3/T4 search found no other Remote/Gateway consumers. Preserve old start(send), synchronous receive and stop implementations via optional/additive fields. Frame protocol, authority table, snapshots/lists unchanged. State writer integration is being coordinated with T-1323 to avoid overlapping schema ownership.

### impl-1326 · 2026-10-26T03:52:36.936Z

Implemented C1 through the Coordinator-approved independent status sink: RemoteStates.forMessenger(id).status()/setStatus({disabled, reason}); daemon option gatewayState and both production log paths. Optional Remote.run() and Promise-aware receive are additive; old start(send)/synchronous implementations remain compatible. Each failure fences only its remote, clears correlations, records a redacted reason, owns one stop promise and drains run/receive work at shutdown. T-1323 lands second and wires Store.remotes per Coordinator decision 4bd6a555-7be5-40fd-91a9-6abf2b9d59e3. Red→green evidence: startup escaped 'Error: invalid command definition'; run was not invoked; asynchronous receive escaped 'Error: send failed'; unredacted state/log and shutdown-error assertions failed; held failed-start cleanup blocked healthy startup. Fixed each. Changed local test files only, serial macOS runs: gateway.test.ts 17/17 and remote/redact.test.ts 3/3; no browser binary, web continuity is authenticated HTTP/WebSocket. npm run typecheck passes. Runtime suite/droplet evidence not run yet; source review next. The red held-cleanup test exposed a fixture release deadlock, corrected with finally; its intentionally failing worker was terminated and its root/worker PIDs were observed gone before subsequent final checks.

### rev-31 · 2026-10-26T03:59:07.270Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261026-1326-source1
commit: 1175de142bdd4bfc816b5441e4c1165327b58b3a
scope: full
findings: [{"severity":"low","text":"L1: cleanup errors already sanitized by #stopRemote:143 pass through #reason again in remote-stop-failed logging. A registered value redact rewrites [redacted] into [[redacted]ed], so log and shutdown reason differ. Reuse normalized reason or make this boundary idempotent; extend existing cleanup-error control with marker-contained registration. Static path finding, no credential disclosure.","file":"hub/src/remote/gateway.ts","line":132}]
finding_counts: {"high":0,"medium":0,"low":1}

Source CLEAR with1low/0highmedium; A-12267 full Standards/Spec audit at tree9272b78af8ca513af54031d72767a7df2db2c34c, fixedbase32f1562d. C1 structural isolation implemented: perremote startup/run/receive faults fenced, correlations removed, redacted sink/log reason, one owned stop, partial-start cleanup independent healthy startup; shutdown joins startup/run/receive/stop before disposal. Ten new gateway cases plus3T1redactor cases and previous Remote shape compatibility reviewed; authenticatedHTTP/WebSocket continuity is not browser proof. Coordinator2b43a989 approves injectedmemory/state boundary; T1323 second-lane DB wiring not in thishead. Redactor approved1a8e643b; no secretsfile loading. Consumer/docs/skill/tier updates coherent. A-12262 localgateway17/17/redactor3/3/typecheck is manual summary with missingraw/timings; retain original session native exits/output/source limits without reruns. C1 runtime unverified. L1 optional fix beforeverify requiresfreshsource; otherwise one ordinarymodefreeverify unchanged then exact-head evidence with generated required outcomes/load/phases/provenance/report-only limits. No devmerge perlane. QA none. Reviewer read-only.

### impl-1326 · 2026-10-26T04:00:18.364Z

Addressed source review L1 in b2b8c52dcb7274dfaa5397dcce7d6bb9ec3c4396: the existing cleanup regression additionally registers short value 'redact', failing its log-reason assertion before the fix (17 tests: 16 pass/1 fail, exit 1). Cleanup logging now reuses #stopRemote's sanitized Error.message and does not re-redact its marker. Same test file green after fix: 17 pass/0 fail/skip/cancel, exit 0, reported whole-file duration 1137.684291 ms on local macOS arm64 Node v24.21.0; no browser binary. npm run typecheck passed again. This is a new targeted run for the L1 change, not reconstructed evidence for 1175de142, not suite/Linux timing. Prior 3/3 redactor unit evidence belongs to 1175de142; that file/module is unchanged. Two-file delta, no dev merge. Fresh source review requested before any verification.

### rev-31 · 2026-10-26T04:01:04.169Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261026-1326-source2
commit: b2b8c52dcb7274dfaa5397dcce7d6bb9ec3c4396
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Corrected full source2 CLEAR; A-12268 carries fullA-12267 audit at treeb106c43e03cb0e19e75e7a9824a12a0d51f4c44b. L1 resolved: stop promise normalizes sanitized Error once; remote-stop-failed reuses message. Existing cleanup test now registers redact and retains exact log/shutdown [redacted], once-onlystop/peerdrain/no-secret assertions. Twofile correction/no devmerge/newidentity. Standards0/Spec0 outstanding. Approved independent state sink/compatibility/drainage carried, T1323DB wiring absent. Original local16/17red→17/17green exit0/file1137.684291ms and typecheck reported with session/capture limits; prior3/3redactor unchanged-source evidence not relabelled current. C1 runtimeunverified. Submit one ordinarymodefreeverify unchanged then exact-head evidence with named startup/run/receive/cleanup/redaction/drainage cases+redactor3, actualload finishes and phase/provenance/report-only limits. Preserve original stdout/nativeexits/timing/source limits without transcription reruns. No devmerge; QA none. Reviewer read-only.

### rev-31 · 2026-10-26T04:15:28.634Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261026-1326-final
commit: b2b8c52dcb7274dfaa5397dcce7d6bb9ec3c4396
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final CLEAR; A-12274 independently audits original A-12272/fdca9f5e exact head/treeb106c43e03cb0e19e75e7a9824a12a0d51f4c44b, carrying source2A-12268/fullA-12267 and resolvedL1.3343ordinary+65additional load tests pass,13newidentities×5 (10gateway+3redactor), zero fail/cancel/skip/todo; all17gateway/3redactor and7previous compatibility/authority/lifecycle cases pass. C1 verified current: startup/post-serving/run/receive failure isolates remote with matching disabled/reason sink+log, healthy/local/authenticatedHTTPWebSocket service remains; owned cleanup/drainage and short-marker redaction pass. Worstnew .228278757s/no>=3sallowance. Injected sink proof only; T1323DB wiring/persistence/statusCLI outsidehead. T0/allT1/fallbackallT2/Web complete; T3/T4 absent/deferred, no allclaim. Linuxc8lon1Node24.21/Nvim.12.5, configuredWebHeadlessShell156v1248; C1fixture no browserbinary. Life711s/$0.0494 not suitewall; hostgateTREE1b3f3ada reused not alternatecommit/remotetypecheck. Sixbudgetwarnings/Webwall147.921vs40/lint135/61/twomissingbaselines/unchangedratchet report-only. Localmanualsummary/originalsession capture/source limits separate, no transcriptionreruns. Ready report names new remote/redact.ts; fresh no-merge conflict/enqueue to Coordinator, laterDBwiring separate. QA none. Reviewer read-only.

Criteria: C1 verified.

### impl-1326 · 2026-10-26T04:15:32.871Z

Exact-head mode-free verify fdca9f5e-3150-4fbb-b709-d8821709c2ee at b2b8c52d completed exit0 on Linux x64 droplet c-8 lon1, Node24.21.0: 3343/3343 pass, no fail/cancel/skip/todo; T0/T1/T2/Web completed, T3/T4 deferred. Original A-12272 and extracted generated case table A-12273. All ten new gateway cases + three redactor cases have base pass and actual 5/5 load repetitions, workers2. New test cases max0.166s base/0.229s load, below3s Linux allowance trigger. Suite installed Headless Shell156.0.8078.4/v1248; C1 itself uses authenticated HTTP/WebSocket. Effective full/all-T2 fallback due harness infrastructure, not a T3 full-suite claim. Report-only duration budgets: missing redactor/gateway baselines, Web projected-wall and unrelated regressions remain diagnostics. Droplet lifetime711s/cost$0.0494. Final evidence review requested from Reviewer at unchanged head; no dev merge. DB state wiring remains T-1323 per Coordinator.

### coord · 2026-10-26T04:21:20.412Z

Merged 0d56210aa842cbd902a7c7a6f4ae988b03305932 onto dev.
