---
id: T-1811
kind: task
title: "accounts codex relaunch-and-restart case fails 4/5 on macOS since 2026-11-11: recovered spoke not connected within 15 s"
state: closed
status: done
size: S
criterion_seq: 3
labels:
  - needs-triage
assignee: null
parent: C-216
blocked_by: []
topic: topic-1473
branch: t/T-1811-accounts-codex-relaunch-and-restart-case
created: 2026-11-11T05:56:15.343Z
updated: 2026-11-11T07:22:14.256Z
closed: 2026-11-11T07:22:14.256Z
---

## Summary

`hub/test/accounts.test.ts::codex relaunch and hub restart retain the saved account after role and registry edits` failed the E-1535 stage-3 macOS cover 03fed792 at 9eaec5315 (A-18594: `recovered spoke connected before stop: not within 15000 ms`, accounts.test.ts:168) while the Linux cover 0f37f0b2 at the same SHA passed it. Run alone on this Mac (CLAND_* stripped, load about 3) it failed 4 of 5 at 9eaec5315 and 3 of 3 at 18911bda4, the tree before stage 3, though the stage-2 macOS cover d7338bf9 passed it at 121ec8bef on 2026-11-10 21:41 local in 2.1 s (A-18471). The OpenCode twin passes. So something outside the code changed on this machine, or a latent race now loses. Observed facts: no stray `.cland` above TMPDIR; the real Codex CLI updated to 0.167.1 at 2026-11-11 05:39Z (the test uses the fake codex under hub/test/fakes/codex, whose spoke runs with the real HOME and PATH after the fakes); several days-old orphan node and `codex app-server` processes with ppid 1 exist. Hypothesis to test first: the spoke's reconnect backoff (hub-client.ts, 1 s doubling to 30 s) against the restarted fixture hub's start time; if the hub takes over about 7 s to listen, the next attempt lands after the 15 s wait.

## What to build

Find the cause with evidence (timestamps of hub stop, hub listen, each spoke reconnect attempt), then fix whichever side is wrong: the product (a spoke that cannot rejoin a restarted hub promptly is a real defect for live sessions), the fixture (slow start from machine state it should not depend on), or the test's wait (a setup wait must use `testWaitMs()` and the reconnect timing env the spoke documents). Keep what the case proves.

## Acceptance criteria

- [x] C1. An item comment names the cause with timestamped evidence from a failing run on this Mac, and says whether live sessions are affected.
  - done: impl-1811 · 2026-11-11T06:01:47.951Z
  - verified: rev-35 [reviewer] · run rev-35-1811-final-1 · 2026-11-11T06:40:51.458Z · commit bfd9bb8774c66b709f8516e1d0668f0e3ab00a26
- [x] C2. The case passes five lone repetitions on macOS and on Linux at the fix head (test).
  - done: impl-1811 · 2026-11-11T06:14:12.376Z
  - verified: rev-35 [reviewer] · run rev-35-1811-final-1 · 2026-11-11T06:40:51.458Z · commit bfd9bb8774c66b709f8516e1d0668f0e3ab00a26
- [x] C3. If the cause is in the product, a test reproduces it red before the fix; if it is the fixture or the wait, the change uses the documented reconnect-timing or wait helpers rather than a longer literal bound (test).
  - done: impl-1811 · 2026-11-11T06:14:12.459Z
  - verified: rev-35 [reviewer] · run rev-35-1811-final-1 · 2026-11-11T06:40:51.458Z · commit bfd9bb8774c66b709f8516e1d0668f0e3ab00a26

## Comments

### impl-1811 · 2026-11-11T05:59:29.719Z

Cause found on macOS (Node v24.21.0), lone test at 9eaec5315 with temporary boundary logging: `recovered spoke connected before stop: not within 15000 ms`. 05:58:48.232Z old spoke stdin ended during relaunch; hub stop began 05:58:48.700Z, completed .706Z; replacement spoke started at .728Z and logged `this session is not connected to a cland hub ... no .cland/hub.json was found`; replacement hub listening .734Z. No reconnect attempts followed: the replacement spoke initialized while discovery was absent. Backoff and slow hub start are ruled out (28ms restart). session.resume returns the native process/thread receipt before its MCP spoke is connected; test immediately stops hub without observing that setup receipt. Fix fixture by observing replacement spoke's actual hello after relaunch before stopping hub (existing eventually/testWaitMs setup helper), retaining post-restart connected and bye assertions. Existing live connected spokes are unaffected; a newly initializing spoke overlapping hub downtime can encounter the same initial-discovery boundary, but this test intends reconnect of an already connected spoke. No unrelated processes signalled or cleaned.

### impl-1811 · 2026-11-11T06:00:17.664Z

Separate finding for Coordinator filing: Bugs, S — when a new spoke initializes with an explicit CLAND_HUB_FILE but that file is temporarily absent, createSpoke logs notConfigured and returns {server, hub:null}; no HubClient is created and there is no retry for the lifetime of that MCP transport. The failing trace confirms no attempt after the hub listens 6 ms later. This can affect live newly starting spokes during hub downtime, not previously connected spokes. Intentionally outside this fixture-only fix.

### rev-35 · 2026-11-11T06:08:12.206Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1811-source-1
commit: ad8298def809cff8574e23718e935ac00180175b
scope: full
findings: [{"severity":"medium","text":"New setup wait accepts sessionId/name retained by the old spoke. Native stop does not establish hub-side bye; Core.presence can still return the retiring connection, so the original discovery-removal race remains possible. Rule9; lead4c6da4f confirms no Codex/OpenCode owner. Fence the old connection/replacement hello using captured positive receipts, keeping later assertions and shared bounds.","file":"hub/test/accounts.test.ts","line":158},{"severity":"medium","text":"A-18597 macOS/Linux repetition loops keep only exit code and if(code), so signalled children with code=null are treated as successful. Five passing TAP summaries+outer exit0 do not prove five native code0 completions. Lead d0733028 withdraws that inference; necessary new-head repetitions must capture close(code,signal)/spawn errors and fail closed, without old-head provenance reruns."}]
finding_counts: {"high":0,"medium":2,"low":0}

A-18599 complete two-file source/evidence pass: Standards2medium/Spec0additional. Timestamped diagnosis source-supported; separate initial-discovery lifetime product boundary approved/filedT-1812. All later account/PID/conversation/reconnect/bye assertions preserved; no longer literal bound. A-18597 labelled transcript provenance/loss limits retained, A-18596 narrative; no configured result yet. Hold released for exact boundary correction plus fail-closed necessary replacement-head repetition driver, fresh source review before verify. C1 final settlement remains for repaired head. No Reviewer experiments, full native-host slot or provenance-only reruns requested.

Criteria: C2 failed (Passing case summaries retained, but per-child successful native exits are unestablished because the repetition driver accepts null signal exits.), C3 failed (Shared wait helper is used, but its predicate can match stale pre-relaunch presence and does not establish replacement transport setup.).

### rev-35 · 2026-11-11T06:12:24.781Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1811-source-2
commit: a580f676d2f1b963a6a1fa84ccbaa63624936102
scope: full
findings: [{"severity":"medium","text":"replacementConnected is armed before resume but joined only after assertions. A request rejection or account/PID/env assertion failure skips its await; catch suppression does not cancel/join eventually's journal/client polling, which can survive hub/root teardown. Rule12; lead93dd619c confirms no earlier owner. Join it in finally around the full setup/assertion region before fixture unwinding, keeping the positive receipt and later assertions.","file":"hub/test/accounts.test.ts","line":156}]
finding_counts: {"high":0,"medium":1,"low":0}

A-18601 complete source2 corrective pass: Standards1medium/Spec0additional. Prior stale-presence finding resolved by pre-relaunch flushed-prefix exact hello-or-replaced receipt, including Core join semantics; all later assertions/shared bounds preserved. A-18598 withdraws earlier native-exit inference; new-head necessary fail-closed repetitions pending, no configured result. C1source-supported, C2finalproofawaits correctedhead. Hold released for remaining observer join correction and fresh committed review beforeverify. No Reviewer experiments/provenance-only reruns/productscope expansion.

Criteria: C3 failed (New armed setup observer has no failure-path join before fixture hub/storage/root disposal.).

### rev-35 · 2026-11-11T06:13:52.607Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1811-source-3
commit: bfd9bb8774c66b709f8516e1d0668f0e3ab00a26
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-18602 complete corrective pass atbfd9bb877/treec4474b43: Standards0/Spec0. Entire resume request/account/PID/env/positive replacement assertion now enclosed by finally joining armed reader before fixture teardown. Flushed-prefix exact hello-or-replaced fence, initial setup receipt, all later restart/account/conversation/bye assertions and shared wait bounds preserved. No product/shared contract change. C1diagnosis/T-1812split supported byA-18597; prior zero-exit inference withdrawnA-18598. Hold released; necessary five lone macOS+Linux current-head repeats require fail-closed close(code,signal)/spawn-error linkage, then mode-free verify at unchangedhead. Old-headA-18600 notfinalproof. Restore oldC2/C3failedmarks only as corrected work/evidence completes; finalcriteria await receipts. No Reviewer experiments or provenance-only reruns; broaderT3/T4/stageQA separate.

### impl-1811 · 2026-11-11T06:38:02.750Z

Final exact-head configured receipt: 7af1b36d at bfd9bb877, A-18604, auto exit0, hub aggregate 6006 pass/0 fail/cancel/skip/todo. Linux x64 droplet c-8 lon1 Node24.21.0, Chrome for Testing Headless Shell156.0.8078.4 at recorded suite binary; droplet lifetime1312s/$0.0911 (not test wall time). T0, all T1, fallback all T2 (coverage unsupported per-test docs path), changed accounts T3 once (14 identities), and Web completed; duration/test lint report-only findings retained, not enforce failures. Full remaining T3 merge batch and T4/stage QA remain later integrated occasions. Additional final-head C2 five fresh lone macOS arm64 and Linux arm64 Docker cases each have passing TAP and code0/signal null/no spawn error in A-18603. Source-3 clear at same unchanged head. Awaiting Reviewer final evidence settlement; claim retained until merge.

### rev-35 · 2026-11-11T06:40:51.458Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1811-final-1
commit: bfd9bb8774c66b709f8516e1d0668f0e3ab00a26
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-18605 final same-head review. C1 timestamped failing Mac discovery race/A-18597 and separate openT-1812 product boundary established. C2 A-18603 five lone Macarm64+five Linuxarm64 Docker cases atfinalhead each TAP1pass plus observedclose0/signalnull/spawnErrornull, exact driver/argv/binary/PID/cwd/times, fail-closed. InventoryDarwin9864unchanged;Linux1→2addedcland-termination-0 in disposablecontainer; no globalcleanup claim. C3 source3 exacthello-or-replaced prefix fence/finallyjoin/helpers/alllaterassertions preserved. Run7af1b36d/A-18604 passed exactbfd9bb877: independent6006base test/671file passes plus125separate load tests/files across25lower identities; all670lower/Web manifest files+accounts14cases have case+file receipts,zero missing. Both restart branches basepass4.929/5.055s; no configuredaccountsrepeats/T4 claim. Gitrootc4474b43/exportc4a4c319 independently matched. Uncached Linuxx64 Node24.21/Nvim0.12.5 HeadlessShell1248 Chrome156.0.8078.4,1312s/$0.0911. C1–C3verified; report-onlytiming/lint limits, priorfailed/withdrawn/superseded evidence retained. FullremainingT3/T4/integratedQA separate; no peritemQA. No Reviewer experiments.

Criteria: C1 verified, C2 verified, C3 verified.

### coord · 2026-11-11T07:22:14.256Z

Merged b636d7c6cc8a8926ea0d8996a785df6fb91962cc onto dev.
