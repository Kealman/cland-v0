---
id: T-1613
kind: task
title: A rebooted host ends its sessions
state: open
status: review
size: S
criterion_seq: 3
labels:
  - ready-for-agent
assignee: null
parent: E-1532
blocked_by:
  - T-1612
  - T-1666
topic: topic-1384
branch: t/T-1613-a-rebooted-host-ends-its-sessions
created: 2026-11-02T03:33:58.539Z
updated: 2026-11-05T04:26:12.341Z
---

## Summary

The agent's hello carries its boot id. When a host comes back with a boot id other than the one its rows were recorded under, the hub marks those sessions exited, vacates their roles as for an exited local session, and bootstraps the host's supervisor again. `fake-host.ts reboot` ends all of a fake host's processes, clears its run directory and writes a new boot id.

Hot files: `hub/src/adapters/sessions.ts`, `hub/src/host/ssh-host.ts`, `hub/test/fakes/fake-host.ts`, `hub/test/host-reboot.test.ts` (new)

## Acceptance criteria

- [x] C1. After `fake-host.ts reboot`, every session on that host reads `exited` and its role is vacated with the same notice as a local harness exit, while sessions on the other fake host are untouched (test).
  - done: impl-1613 · 2026-11-05T02:41:53.262Z
- [ ] C2. The hub restarts the rebooted host's supervisor and agent and the tunnel is `up` again (test).
  - failed: rev-36 [reviewer] · 2026-11-05T03:58:40.128Z · note 59a9a571 failed agent-SIGKILL push recovery: current head durable publication after interrupted push not within5000ms (test113).
- [x] C3. No stop or signal is sent for the exited rows to any host or to the hub's machine (test).
  - done: impl-1613 · 2026-11-05T02:41:53.884Z

## Notes

Shared files: `hub/src/adapters/sessions.ts` (exit and vacate), the fake-host control script (adds reboot)

## Comments

### impl-1613 · 2026-11-04T17:07:12.370Z

Rule 20 sweep before edits: readiness onTable consumers are host/registry.ts and host-agent-restart.test.ts (recording observers); onReady consumer is hub/daemon.ts; resumeHost consumers are daemon.ts, Sessions.resumeAll, and host-survival.test.ts. Callback additions retain prior rows argument and accept old one-argument observers. Boot evidence already persists in remote pidIdentity (process-host.ts and agent/native.ts). AgentHello remains unchanged, so AgentClient, protocol fixtures, raw socket readers, startup probes, and older agents retain their wire shape. Searches covered hub, docs, and shipped .agents skills for onTable, onReady, resumeHost, pendingHostResumes, bootId, and pidIdentity. Final reboot/retirement consumer sweep follows the landed T-1666 API; no verify submitted yet.

### impl-1613 · 2026-11-04T17:16:37.664Z

Dependency seam committed on T-1666 at 94ff42843ff83eb060701e729075fcfc95e0e5fe (not landed): Sessions.retainHostGeneration(process, {cause: "host-rebooted", bootId}) persists closure for all harnesses. PendingStop.hostRebooted is {bootId, launchGeneration?}; it preserves original pending resource undo and fences retries/continuations against native operations. Reboot flow must publish exit/vacate separately and bypass the normal pending-stop #exited branch only after durable proof admission. Shared hostBootChanged matches ad51d375a. Waiting for dependency landing and Coordinator merge instruction; no review or verification requested.

### impl-1613 · 2026-11-05T02:01:55.149Z

Rule 20 integration sweep: T-1666 API remains unchanged; no Host operation, schema/index/column, wire reply, or observer operation added. Readiness callback retains table as first argument; host-agent-restart recording callbacks remain compatible. New lifecycle consumers are Sessions host-readiness/startup and native reboot fixture; existing failed-launch/pending-stop/revoke/fence persistence readers remain unchanged and targeted host-revoke coverage will be rerun. Fake boot override now applies on Linux and fake-ssh passes the same CLAND_HOST_BOOT_ID_FILE consumed by agent/native; updated agent closure projection. Unknown-authority Claude obligations stay held on same boot and receive only changed-boot closure; pending undo remains retained.

### rev-36 · 2026-11-05T02:13:43.028Z

verdict: review
result: not clear
by: rev-36 [reviewer]
run: rev-36-1613-source-1
commit: 1feee4bd55549c3a2703d3df1ecb51872ea9ec85
scope: full
findings: [{"severity":"medium","text":"Reboot enumeration uses running-only activeOnHost plus pending stops; ordinary stopped old-boot rows never become exited as C1 requires. Cover current stopped generations or obtain an explicit live-only scope correction.","file":"hub/src/adapters/sessions.ts","line":1932},{"severity":"medium","text":"Separate reboot CLI starts after existing native owners, but cleanupOwnedProcesses excludes older-than-self processes; reboot can kill master then fail with writers remaining. In-process native test misses this boundary; preserve ownership safeguards and prove actual CLI.","file":"hub/test/fakes/fake-host.ts","line":64},{"severity":"low","text":"Boot override descriptions remain stale: old CLAND_FAKE_BOOT_ID_FILE here, Linux-always-/proc in host-agent guide:3, shared-kernel fake boot comment in fake-host.ts:77. Match the new explicit fake override on Linux/macOS.","file":"docs/agents/tests/hub-test-fake-ssh.test.ts.md","line":15}]
finding_counts: {"high":0,"medium":2,"low":1}

Full source not clear; A-16752. Spec2medium, Standards1low. Corrected SHA used; include premerge readiness work against authorized devd666. Authenticated additive boot flow/shared proof, durable retention before exit/vacate, pending undo and stale found-result fence reviewed positively; all32 closure hashes match. Fix running-only omission and separate CLI age/ownership mismatch without weakening native authority; update matching boot docs. C1/C2failed,C3runtime-unverified. A16749 local check/45+11 partial only; clean native/preservation/queued evidence absent, earlier setup/overlap invalid. Respect T1673 slot; fresh changed-head source review before verify. QA none per item; Reviewer read-only/no execution/edits/delegation.

Criteria: C1 failed (Ordinary stopped remote rows with old-boot identity and no pending stop are excluded from reboot enumeration and remain stopped.), C2 failed (Advertised separate fake-host reboot CLI cannot join older host workers through newerThanSelf-restricted cleanup; actual CLI recovery control is missing.).

### impl-1613 · 2026-11-05T02:19:01.752Z

Review-fix consumer sweep: activeOnHost still serves revoke and immediate running-row fences; new stoppedOnHost iterator is consumed only by per-host recovery, uses existing harness_processes_host(host,status,archived_at) index, adds no schema/index/column. Fake Control/MasterReceipt shape stays compatible; controlRequest callers are fake-ssh, fake-host and host-ssh-contract, retaining default3000ms, while reboot uses explicit15000ms. Reboot controller is fixture-only and grants no recovered PID authority to its client. Updated actual CLI coverage plus wrong-owner safety, stopped/archived regression and per-slice32 work bound. Corrected fake boot env docs/caller comments.

### rev-36 · 2026-11-05T02:22:51.719Z

verdict: review
result: not clear
by: rev-36 [reviewer]
run: rev-36-1613-source-2
commit: adf121636a7236765f2865b9376ee1843fce6b77
scope: full
findings: [{"severity":"medium","text":"Initial ownership publication can reject after listen succeeds, with no setup-failure cleanup. Caller registers controller cleanup only after success, leaking listener/socket on rejection.","file":"hub/test/fakes/fake-host.ts","line":78},{"severity":"medium","text":"closing is tested before awaited owner validation; close joins only already-assigned work. A held admission can start reboot after closing, escape that drain, and outlive socket timeout/metadata teardown. Track handlers and fence after await.","file":"hub/test/fakes/fake-host.ts","line":69}]
finding_counts: {"high":0,"medium":2,"low":0}

Full reworked-controller source not clear; A-16754. Prior stopped-row/CLI-age/docs findings resolved in source: indexed streamed32-slice stopped/archived recovery, actual authenticated CLI/wrong-token test, unchanged shared cleanup guards, corrected descriptions. Two medium lifecycle gaps remain in controller setup and held admission/close drainage (rule12). C1 source correction acknowledged, runtime unverified; C2failed,C3runtime-unverified. Local58/check/typecheck reports partial only; native/preservation/verify not complete. T1673 release does not clear this source. Fix and fresh exact-head review before verify; QA none per item. Reviewer read-only/no execution/edits/delegation.

Criteria: C2 failed (New reboot controller can leak acquired listener on setup rejection and admit work after close starts; positive setup/shutdown drain controls absent.).

### rev-36 · 2026-11-05T02:35:44.779Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1613-source-3
commit: 42286ab71fc4542fbff095b3a50874d6ca27e947
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Corrected source clear; A-16756, no findings. All prior gaps resolved: stopped/archived indexed32-slice retirement, actual CLI/older live owner, unchanged signal guards, boot docs; setup atomic-publication cleanup and tracked/fenced admissions with independent writer drain now covered by4boundedT2controls. Forced-kill rawsleep diagnostic assessed: transient child after fixture SIGKILL does not establish product supervisor bug. Additional post-owner2s positive census retains original final assertion/root gate; unchanged supervisor/shared cleanup. Direct Coordinator34ce0bac/c6c3ff54 checked;12s single new allowance honestly labels earlyMac4.578s/T1666-ratio Linux projection, no Linux/currenthead execution claim. C1–C3runtime-unverified; prior failed marks need lead implementation/evidence restoration when ready. EarlyMac1/1diagnostic/local62/T0partial only; exacthead native+required unedited preservation still needed, then mode-free verify/final receipts. Current slot/load rules apply; any changedhead source rereview. QA none per item; Reviewer read-only/no execution/edits/delegation.

### rev-36 · 2026-11-05T03:07:35.755Z

verdict: review
result: not clear
by: rev-36 [reviewer]
run: rev-36-1613-evidence-1
commit: 42286ab71fc4542fbff095b3a50874d6ca27e947
scope: evidence
findings: [{"severity":"medium","text":"Required Linux restart and killed-producer cases (also136) fail with native push identity unknown. Producer/boot identity integration remains unresolved; preserve assertions/fences and diagnose before retry.","file":"hub/test/host-push-on-ref-move.test.ts","line":91}]
finding_counts: {"high":0,"medium":1,"low":0}

Evidence not clear; A-16762 records quoted native errors before classification. A16761 exact42286: T0/T1/T2exit0, selectedT3exit1 (49pass/2fail), T4/Webunexecuted. Uncached Linuxx64c8sfo2 Node24.21/Nvim.12.5 capturetree2b01d79e,browsernull; advisoriesreport-only. Root cause unclassified, not flaky/budget. Own boot/controller/reboot cases pass including native6.977556431s within12s; local203 summary not substitute. C2failed,C1/C3unverified; source-clear3unchanged. Lead diagnoses/retries; changedhead needs source rereview before verify. No Reviewer execution/edits/delegation.

Criteria: C2 failed (6380ee28 selected T3 agent-restart/native-producer preservation failed two host-push-on-ref-move cases with native push identity unknown.).

### impl-1613 · 2026-11-05T03:29:02.042Z

Coordinator9237e21d authorized diagnostic-only delta after Linux failure6380ee28. Rule20 consumers: agent/ref-push and watch; server; AgentClient/SSH Host; protocol ref-moved/ref-watch-status; host-flush, host-settlement, host-ref-watch-recovery, host-push-on-ref-move, host-ref-watch-compat and transport-status tests; docs/agents/host-agent.md and compatibility/recovery guides. Searches covered field/frame/function names plus hub/shared/web/nvim/docs/qa/shipped skills; no additional startup probe/QA/skill parser found. PushObservation cause was already optional; frames/rows and persistence shape unchanged. Existing watchers forward optional cause and retain legacy generic fallback. Tests add every bare-unknown cause plus computed live-without-ledger unknown, PID/identity/boot field labels, unchanged running shape and zero stop calls. Canonical birth boot parsing shared with unchanged reboot admission to avoid duplicate policy; no Linux boot reader or settlement/fence logic change. Original Linux root cause remains unclassified pending diagnostic verification.

### rev-36 · 2026-11-05T03:33:49.810Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1613-delta-source-1
commit: d6d8c791d049efebafec170921245c591ab64c10
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Diagnostic-only source delta clear; A-16770, no findings. Direct Coordinator9237e21d checked. Every bare/computed unknown now names its branch; mismatch names pid/identity/boot without raw values. Predicates/order/running+gone outcomes/authority/fences/stop/original native assertions and Linux boot readers unchanged. Shared canonical parser preserves declared reboot policy;32 closure hashes match. Optional-cause relays/persistence/compat consumers checked; explicit previous-shape generic fallback and zero-stop/unchanged-running controls retained. A16766 local30/T0partial only; current-head push5/5/configured receipts pending. Prior6380ee28 remains failed/root unclassified; C2failed evidence unresolved, C1–C3unverified. This clears Coordinator's diagnostic mode-free run, not final readiness/fix claim; if green, obtain explicitly required second fresh verify before intermittent classification. Changedhead needs source rereview. Reviewer read-only/no execution/edits/delegation.

### rev-36 · 2026-11-05T03:58:40.128Z

verdict: review
result: not clear
by: rev-36 [reviewer]
run: rev-36-1613-evidence-2
commit: d6d8c791d049efebafec170921245c591ab64c10
scope: evidence
findings: [{"severity":"medium","text":"Required interrupted-push recovery did not observe exact current-head territory publication within5000ms. Failure differs from prior generic identity rejection; root remains unclassified, bound/fences must stay pending producer facts.","file":"hub/test/host-push-on-ref-move.test.ts","line":113}]
finding_counts: {"high":0,"medium":1,"low":0}

Evidence not clear; A16779 quotes actualA16777 failure. Exactd6d8: T0/T1/T2pass; selectedT3exit1 (50pass/1fail), T4/Webunexecuted. Other3pushcases and ownreboot5.447715417s pass, not overall coverage. Uncached Linuxx64c8lon1 Node24.21/Nvim.12.5 capture1a841324,browsernull; report-onlyadvisories notcause. Prior6380ee28 remains failed/unclassified; no new unknown cause reported here, no intermittent/fixed/timeout-bump inference. C2failed,C1/C3unverified. Lead diagnoses watch/pending/producer/native receipts; changedhead needs source review before retry. Reviewer read-only/no execution.

Criteria: C2 failed (59a9a571 failed agent-SIGKILL push recovery: current head durable publication after interrupted push not within5000ms (test113).).

### impl-1613 · 2026-11-05T04:11:32.978Z

After second Linux failure59a9a571 (publication wait timeout, not identity rejection), Coordinator71a8e199 authorized failure-only boot/native receipts. Existing5s wait/final assertions remain; catch captures before/after hello, current agent and supervisor receipt, fake/kernel boot, watch/pending/fences and selected native/producer/birth/closed facts, then rethrows original. Direct-agent test has no hub/Sessions/registry; reboot retirement explicitly not wired. No product minter/observer/fence change. New private test helper consumed only by host-push native test and T2 synthetic snapshot control, matching guides/index/tiers updated. JSON reads64KiB/boot256B, strings512chars, bounded targets/generations with truncation counts, final output16Kchars; declared fields only, redaction before clipping, no plans/HOME/environment reads or native signals. Missing/oversized receipts and null observed head explicit, watcher byte-identical after capture. Root cause remains unclassified; next reviewed-head configured run must supply these facts if red.

### rev-36 · 2026-11-05T04:21:10.365Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1613-delta-source-2
commit: e5feb68606d51219762fc2b69cf2e057eff8e04b
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Failure-snapshot source delta clear; A16781, no findings. Direct Coordinator71a8e199/bba54e2a checked. Original5s bound/exact-head+pending assertions unchanged; failure-only bounded declared watch/ledger/producer/native/boot facts then original error rethrown. Shared redactor before clipping/printing; positive long-secret/whitelist/immutable-watch controls; capped8readonly identity RPCs/1s, explicit missing/oversized/unknown. Direct fixture reboot retirement labelled notwired honestly. No production/closure/authority/reader/allowance change. A16780 local18/T0partial only; native/configured receipts pending. Prior6380ee28/59a9a571 remainfailed/rootunclassified,C2failed evidenceopen,C1–C3unverified. Exacthead diagnostic verify permitted per Coordinator workflow; changedhead rereview. Directc19d4efd supersedes blanket second-task-run instruction; mergebatch separate. Reviewer read-only/no execution/edits/delegation.

### rev-36 · 2026-11-05T04:26:12.341Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1613-delta-source-3
commit: 7be0b051f18ebfb10cfeaefc1ac98746309b251a
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Tiny observer-boot diagnostic source clear; A16783, no findings. Current authenticated agent PID prioritized first inside unchanged8-PID cap; captured native second. Read-only1s RPC caller unchanged. Existing parser derives capturedNativeBootId and live-reply recoveredObserverBootId independently of cached hello; T2 deliberate hello mismatch/nullunknown controls retained. Previous redaction/bounds/whitelist/immutable facts checks apply. Only helper/test/guide changed; no production/closure/duration/nativewait/assertions. Olde5Mac5/5 not currenthead evidence; targeted/static pending and no queuedrun yet. Complete required checks/receipts then exact7be diagnostic verify. Priorfailed6380/59a9 rootunclassified,C2failed evidenceopen,C1–C3unverified. Changedhead rereview; Reviewer read-only/no execution/edits/delegation.
