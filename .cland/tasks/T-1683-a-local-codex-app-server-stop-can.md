---
id: T-1683
kind: task
title: A local Codex app-server stop can resolve before its child is reaped (T-1673 pattern)
state: closed
status: done
size: S
criterion_seq: 3
labels:
  - ready-for-agent
assignee: null
parent: E-1532
blocked_by: []
topic: topic-1387
branch: t/T-1683-a-local-codex-app-server-stop-can
created: 2026-11-05T02:01:43.900Z
updated: 2026-11-05T04:33:00.468Z
closed: 2026-11-05T04:33:00.468Z
---

## Summary

A local Codex app-server launch reads `child.exited` only during startup and drops the child-exit receipt after a successful launch. Its stop then joins only `Host.stop`, so a stop can resolve while the server is an unreaped zombie. This is the same gap T-1673 found and fixed for OpenCode.

## What to build

Apply T-1673's pattern to the local Codex app-server:
- keep the successful launch's child-exit receipt;
- after `Host.stop`, join that receipt within the same bounded settlement deadline;
- when the deadline passes, report the stop as `cleanup-incomplete`, never settled;
- recovered or adopted servers without a captured receipt keep their current confirmation path.

Found by impl-1673 during T-1673 (2026-11-05).

## Acceptance criteria

- [x] C1. With the child-exit receipt held, stopping a local Codex session does not resolve until the receipt arrives, and the server pid is dead when it does (test, held receipt).
  - done: impl-1683 · 2026-11-05T03:32:17.055Z
  - verified: rev-35 [reviewer] · run rev-35-1683-final-1 · 2026-11-05T03:58:01.895Z · commit 060b0383930ca320dfc92638899f87af6771a917
- [x] C2. A held receipt past the settlement deadline ends the stop as cleanup-incomplete and never as settled; a late exit allows a retry (test, fake timers).
  - done: impl-1683 · 2026-11-05T03:27:27.348Z
  - verified: rev-35 [reviewer] · run rev-35-1683-final-1 · 2026-11-05T03:58:01.895Z · commit 060b0383930ca320dfc92638899f87af6771a917
- [x] C3. A recovered or adopted Codex server without a captured receipt stops through its existing confirmation path unchanged (test).
  - done: impl-1683 · 2026-11-05T03:27:27.728Z
  - verified: rev-35 [reviewer] · run rev-35-1683-final-1 · 2026-11-05T03:58:01.895Z · commit 060b0383930ca320dfc92638899f87af6771a917

## Comments

### impl-1683 · 2026-11-05T03:24:43.754Z

Consumer sweep before implementation: searched hub/test and nvim/test for CodexAdapter, HostStopOptions, hostForProcess/hostForLaunch, stop calls and exited observers; searched production Codex startup/stop/gone, launch-settlement and LaunchFiles. No Host/wire contract change: receipt retained privately in Codex only. Affected recording seams: codex-host (new held-receipt tests), codex-sandbox-host already resolves exited on stop. Remote Codex fixtures codex-remote, codex-remote-cleanup and codex-remote-agent keep their remote path. Codex adapter/native/delivery/workspace and adapter-native-boundary use native child receipts or no successful local launch. Other harness Host fakes and nvim observers are unaffected because Host and adapter public shapes stay unchanged. Named preservation files will run unedited. Existing boundedSettlement reused without modifications.

### rev-35 · 2026-11-05T03:31:45.892Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1683-source-1
commit: f03bf1005052764ba1dcc00be1c79f281f384d73
scope: full
findings: [{"severity":"low","text":"Use beforeDirectories for held receipt release+adapter drain, registered before spawn. Raw t.after after tempProject does not establish producer-before-root cleanup on accepted setup/assertion failure; preserve the assertions and release every gate before close.","file":"hub/test/codex-host.test.ts","line":387}]
finding_counts: {"high":0,"medium":0,"low":1}

Full source not clear:one low fixture-order finding,confirmed9dfbe756,no product source finding. A-16767 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16767-t-1683-source-review-held-receipt-fixture-must-drain-before-root-removal.md. Localreceiptretention atspawn/relaunch/sharedboundedSettlement,explicitstopjoinbeforeended,terminalretryowner,lateexit/recoveredpaths/identityguards inspected;privateinternalresultonly,nosharedHostwire/schema/role/dependency,OpenCode/helpertouchednot. NewT2held/deadline/watch/retrycontrolsmeaningful/docsaligned. A16765reportedMacNode24.21red/22green/types/lint0refusals/boundary18supplements;nativepreservationongoing,no configuredLinux/Web/QAclaim. Holdpinthroughbatch,fixfixture+rerunaffectedT2/freshsourcebeforeverify. C1failed,othersunverified. No Reviewer execution/probes/browser/edits/Git mutation/delegation.

Criteria: C1 failed (Held-receipt regression fixture can remove its root before releasing/joining adapter work on setup or assertion failure.).

### rev-35 · 2026-11-05T03:32:58.107Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1683-source-2
commit: 060b0383930ca320dfc92638899f87af6771a917
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Full repaired source clear, no findings. A-16767 is resolved: beforeDirectories now releases the held receipt and drains the adapter before root removal, registered before spawn; guide updated, assertions/deadlines unchanged. A-16769 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16769-t-1683-full-repaired-source-clear-ordered-local-child-receipt-fixture.md. Complete delta is fixture/docs only; hub/src is identical to reviewed f03bf1005. Prior full review of launch/relaunch retention, explicit/terminal bounded joins, retry and recovered/no-handle behavior carries. Final-tree T2 22/22 is reported green; A-16768 preservation 219/13 and prior static receipts remain predecessor evidence with identical product source, not current-head runs. C1–C3 remain unverified pending exact-head configured verification, which may proceed now. No Reviewer execution, probes, browser, edits, Git mutation or delegation.

### rev-35 · 2026-11-05T03:58:01.896Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1683-final-1
commit: 060b0383930ca320dfc92638899f87af6771a917
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final evidence clear; C1–C3 verified. A-16778 records independently inspected A-16775 named base outcomes and all three new cases' five load repetitions, configured run 0cb84610 exit 0 / 5118 passed / zero fail, cancel, skip or todo, and exact candidate-tree projection. T0, all T1, fallback all T2 and Web completed on Linux x64 droplet Node 24.21.0 / isolated Headless Shell 1248, Chrome for Testing 156.0.8078.4; remaining T3 deferred to merge batch, T4 unexecuted, no QA claim. A-16768/A-16776 retain the original macOS predecessor serial producer's 219/219 outcomes across 13 unedited files and propagated native exit 0; independent Git checks confirm identical product source and Codex blob at predecessor/final heads. Original deterministic red is retained separately. Source clear A-16769 stands; no findings or reviewer rerun. Report-only budget/lint/ratchet notices remain diagnostic.

Criteria: C1 verified, C2 verified, C3 verified.

### coord · 2026-11-05T04:33:00.468Z

Merged b5e38fabb9f12256c8c0813364b9dc7ed95196c1 onto dev.
