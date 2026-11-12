---
id: T-1819
kind: task
title: The hub pushes host state to the workbenches
state: closed
status: done
size: M
criterion_seq: 6
labels:
  - ready-for-agent
assignee: null
parent: E-1537
blocked_by: []
topic: topic-1487
branch: t/T-1819-the-hub-pushes-host-state-to-the
created: 2026-11-12T10:07:19.308Z
updated: 2026-11-12T13:41:31.398Z
closed: 2026-11-12T13:41:31.398Z
---

## Summary

The hub pushes a `hosts.state` frame to the workbenches on connect and on every change. It carries one line per pool, with its hosts, slots and logins in use, and the pool's host list. The frame marks a pool alerted the moment a host's tunnel drops or its provider fails, so the Hosts row can turn red at once rather than at General's 3-minute line.

## What to build

A client-safe projection of the pool and host records, pushed as `remote.state` is: in the featured sessions snapshot, as a standalone frame on a non-snapshot connect, and on every change, at most one push a second. Per pool:
- name, provider and region;
- the live hosts against `max_hosts`, and the slots in use against the slots of those hosts, in weight;
- per harness, the logins in use and the logins the pool can use (its provider and region), with the signed-out ones counted apart (question 10);
- an alert, or none: an unreachable host with the start of its outage, or a provider failure (a refused create or a rate-limit pause) with its reason (question 8);
- the hosts: id, size, region, state, creation time, the sessions on it, the declared price per hour and today's spend.

Changes come from the provision records, the host-health outage start and end, sessions placed on or leaving a host, login binding and state changes, pool configuration reloads and the pool runtime's create results. Spend is re-pushed at most once a minute while a host is live (question 7). The frame never carries an address, an SSH identity, a volume id or a token. The 3-minute `unreachable` state and General's line are unchanged. Clients speaking the previous wire shape ignore the frame.

## Acceptance criteria

- [x] C1. A client receives `hosts.state` on connect and in the featured sessions snapshot, with per pool the live hosts against `max_hosts`, the slots in use against the total, and per harness the logins in use against the logins the pool can use (test).
  - verified: rev-36 [reviewer] · run rev-36-1819-final-1 · 2026-11-12T11:24:20.618Z · commit 1d606582e2f54b55db18d6012db80180efe4ea92
  - done: impl-1819 · 2026-11-12T12:17:37.337Z
  - verified: rev-36 [reviewer] · run rev-36-1819-final-2 · 2026-11-12T12:43:01.379Z · commit ac0f036fde7d580dc55a57c3955fc591bc88ff06
- [x] C2. Each host entry carries id, size, region, state, creation time, its sessions, the declared price per hour and today's spend, and the frame carries no address, SSH identity, volume id or token (test).
  - verified: rev-36 [reviewer] · run rev-36-1819-final-1 · 2026-11-12T11:24:20.618Z · commit 1d606582e2f54b55db18d6012db80180efe4ea92
  - done: impl-1819 · 2026-11-12T12:17:37.685Z
  - verified: rev-36 [reviewer] · run rev-36-1819-final-2 · 2026-11-12T12:43:01.379Z · commit ac0f036fde7d580dc55a57c3955fc591bc88ff06
- [x] C3. A session placed on a fake host, its exit, a login bound or signed out, and `cland config set hosts.<pool>.max_hosts` each push an updated frame within one second of hub-clock time, at most one push a second (test).
  - verified: rev-36 [reviewer] · run rev-36-1819-final-1 · 2026-11-12T11:24:20.618Z · commit 1d606582e2f54b55db18d6012db80180efe4ea92
  - done: impl-1819 · 2026-11-12T12:17:37.895Z
  - verified: rev-36 [reviewer] · run rev-36-1819-final-2 · 2026-11-12T12:43:01.379Z · commit ac0f036fde7d580dc55a57c3955fc591bc88ff06
- [x] C4. When a fake host's tunnel drops, the next frame marks its pool alerted with that host and the outage start, before the 3-minute `unreachable` state, and the alert clears when the tunnel returns (test).
  - verified: rev-36 [reviewer] · run rev-36-1819-final-1 · 2026-11-12T11:24:20.618Z · commit 1d606582e2f54b55db18d6012db80180efe4ea92
  - done: impl-1819 · 2026-11-12T12:17:38.246Z
  - verified: rev-36 [reviewer] · run rev-36-1819-final-2 · 2026-11-12T12:43:01.379Z · commit ac0f036fde7d580dc55a57c3955fc591bc88ff06
- [x] C5. A refused create or a rate-limit pause on the fake provider marks the pool alerted with the reason until a create succeeds (test).
  - verified: rev-36 [reviewer] · run rev-36-1819-final-1 · 2026-11-12T11:24:20.618Z · commit 1d606582e2f54b55db18d6012db80180efe4ea92
  - done: impl-1819 · 2026-11-12T12:17:38.476Z
  - verified: rev-36 [reviewer] · run rev-36-1819-final-2 · 2026-11-12T12:43:01.379Z · commit ac0f036fde7d580dc55a57c3955fc591bc88ff06
- [x] C6. A client speaking the previous wire shape connects and works unchanged, and a project with no `[hosts.<pool>]` table pushes an empty pool list (test).
  - verified: rev-36 [reviewer] · run rev-36-1819-final-1 · 2026-11-12T11:24:20.618Z · commit 1d606582e2f54b55db18d6012db80180efe4ea92
  - done: impl-1819 · 2026-11-12T12:17:38.813Z
  - verified: rev-36 [reviewer] · run rev-36-1819-final-2 · 2026-11-12T12:43:01.379Z · commit ac0f036fde7d580dc55a57c3955fc591bc88ff06

## Blocked by

None (can start immediately)

## Notes

- Hot files: `hub/src/host/hosts-state.ts` (new), `hub/src/host/host-health.ts` (the outage-start signal), `hub/src/hub/core.ts`, `hub/src/hub/snapshot.ts`. Registration points: `hub/src/protocol.ts`, `shared/wire/index.ts` and its conformance, `hub/src/hub/dispatch.ts` (the connect frame).
- Tests: new `hub/test/hosts-state.test.ts` (T2, `projectHub`, the fake host provider and the fake transport, the hub clock).
- Serves epic C1.

## Comments

### impl-1819 · 2026-11-12T10:10:11.640Z

Rule-20 sweep before source edits: shared transitive graph reached 703 tests plus 15 unknowns (treated reached), captured in the consumer artifact. Explicit production consumers: protocol and shared/wire, HubCore event publication, composeSnapshot, dispatch hello, web store/reducer and Neovim session model; old clients ignore unknown events and optional snapshot fields. Existing host.status, provision persistence and login records retain their wire shapes. New hosts.state is additive. Explicit assertions include connection-snapshot legacy frame sequence; recorded Neovim fixtures/catalog consumers must refresh. Native host create-ready, destroy-native, restart, unreachable, stop and login-write-back are reached transitively; host-health behaviour needs the unreachable native file locally, other unchanged native behaviour is deferred to integrated occasions per evidence split. Sweep includes skills, QA briefs, docs and startup probes via explicit names; exact paths attached in artifact.

### rev-36 · 2026-11-12T10:25:58.908Z

verdict: review
result: not clear
by: rev-36 [reviewer]
run: rev-36-1819-source-1
commit: 406346d0176c1a31d61a1353a867e2105c3b3180
scope: full
findings: [{"severity":"medium","text":"Populate the production price source before projecting DigitalOcean hosts. The new healthProviders registry owns a fresh DigitalOceanHostProvider whose declarations start unavailable and are never refreshed here; refreshes by provisioning/scaling use different registries. Consequently real hosts permanently publish null priceHourly/spendToday despite a valid declaration. Add production-wired fake-DigitalOcean coverage.","file":"hub/src/hub/daemon.ts","line":728},{"severity":"medium","text":"Observe create failures at the shared create-result boundary. Only #scale writes the alert map, while manual host.create and login preparation call Dispatcher.#createPoolHost directly. Their refused creates/rate-limit pauses leave the pool unalerted. Cover manual/login creation through that owner, not only an injected scheduler callback.","file":"hub/src/host/pool-runtime.ts","line":194},{"severity":"medium","text":"Use confirmed machine lifetime for today's spend. currentInventory includes pre-acquisition rows and retained destroying rows after machineDeletionRead, but accrual falls back to provision creation and continues through the sample time. This charges before a machine exists and after confirmed deletion while other cleanup is retained. Preserve unknown/non-billable semantics and stop accrual at the positive deletion boundary; add receipt-based controls.","file":"hub/src/host/hosts-state.ts","line":56},{"severity":"medium","text":"Clear provider alerts only for a successful create. The ready listener deletes the alert for every ready transition, including unreachable→ready recovery of an existing host. That clears an unrelated create-refusal alert before any create succeeds, violating C5. Regress refused create followed by recovery of a different existing host.","file":"hub/src/host/pool-runtime.ts","line":73}]
finding_counts: {"high":0,"medium":4,"low":0}

Full source review not clear. Standards 0 findings; Spec 4 medium findings, detailed in A-18994 with pinned base/head and author confirmations. C2 and C5 failed; other criteria remain unverified pending repaired-source review and same-head configured evidence. No tests/probes executed by reviewer. Fresh committed source review is required before verification; catalog/full T3/T4 and affected after-stage QA retain their separate occasion scope.

Criteria: C2 failed (Production DigitalOcean prices remain unavailable and spend accrues outside confirmed machine lifetime.), C5 failed (Manual/login creates bypass alerts and unrelated host recovery clears a failed-create alert before create success.).

### impl-1819 · 2026-11-12T10:29:13.716Z

Review-fix consumer sweep before adding host billing checkpoint: host-leases.ts LeaseOptions.priceHourly already flows from provision-host.ts and host-restart.ts, watchdog/host lease file readers keep HostLease unchanged. Additive SQLite host_lease_billing table is read by id only; no host list/status/result or mirror field changes. Current transitive sweep already reached lease importers via core/store (A-18980, unknowns included); affected explicit files add host-leases.ts, status.ts and new live-accrual.ts; native lease/create/restart/stop/destruction readers retain wire fields. Runtime/manual/login callers share recordCreateResult; admission refusals remain non-provider outcomes. Local native rerun will include create-ready, stop, unreachable and host-restart because arm captures rates for legacy rows.

### rev-36 · 2026-11-12T10:35:05.680Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1819-source-2
commit: c01dab3d71f480e2671b1d9af4c8b429f902204e
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Repaired source clear: Standards 0/Spec 0. A-19000 records source disposition of all four prior findings, indexed admitted-rate checkpoint, shared create-result alert ownership, unrelated-ready retention and shared confirmed-lifetime live accrual. No reviewer execution. C1–C6 remain pending configured same-head Linux evidence; no verified marks appended. Final assessment requires named receipts, original producer linkage and conservative prior/current/explicit consumer union; full T3/T4 and affected after-stage QA remain separate.

### impl-1819 · 2026-11-12T10:37:04.609Z

Final rule-20 reconciliation at c01dab3d: conservative union retains all 703 prior reached and 15 prior unknown test paths, plus 754 current reached and 14 current unknown (768 unique test paths), and unions prior/current explicit production, tests, fixture, docs, skill and QA paths. New graph seeds include host-leases.ts, pools.ts, status.ts, live-accrual.ts and hosts-state.ts. Unknowns remain reached. Wire field additions preserve old client shapes; lease billing is an additive SQLite checkpoint with unchanged HostLease/mirror/list fields. Consumer union and original revised native completion/source-linkage artifacts posted in item topic; configured exact-head verification 44bf2e78-b3cb-41aa-a727-60deb64ac9ee now queued. No source changes after clear review.

### rev-36 · 2026-11-12T10:51:58.274Z

verdict: review
result: not clear
by: rev-36 [reviewer]
run: rev-36-1819-evidence-1
commit: c01dab3d71f480e2671b1d9af4c8b429f902204e
scope: evidence
findings: [{"severity":"medium","text":"Migrate the remaining additive-frame consumers while preserving their controls. The configured run fails this fixed [1,2] sequence expectation with [2,3]; edges-component:27 and request-guard-component:94 read the added connect frame as a reply, and tracker-component:292/309 explicitly receive hosts.state where a result is expected. Consume the additive connect projection/correlate replies and derive sequence baselines without dropping framing, burst-sharing, resumption or subscription assertions.","file":"hub/test/connection-resync.test.ts","line":143}]
finding_counts: {"high":0,"medium":1,"low":0}

Configured evidence not clear: A-19008 records actual five assertion failures in A-19007/44bf2e78, exact head/provenance and unexecuted later phases. One medium remaining consumer-migration finding; C6 failed, other final criteria unverified. Production fixes in A-19000 remain source-addressed. Preserve framing/replay/burst/subscription controls when consuming the additive connect frame and deriving sequence baselines; fresh source review and configured evidence at the corrected head are required. No reviewer execution.

Criteria: C6 failed (Configured verification fails five legacy/wire consumer cases on additive hosts.state and shifted sequence assumptions.).

### impl-1819 · 2026-11-12T10:53:21.574Z

Production admission and unknown-frame audit after 44bf2e78: remote.state and hosts.state use identical adjacent guards in dispatch.ts isClientHello: !hostId && !features.includes(snapshot) && !frame.resume. This includes local CLI/script client hellos and gateway human hellos, not spoke Hello, and not forwarded host clients. Featured sessions snapshots carry both optional projections; only subscribed/numbered-delta peers get ongoing replacements. CLI shared/socket-client.ts exchange parses each line and resolves only result with the captured random id, ignoring other frames; cli/hook and login-terminal likewise correlate ids. Spoke HubClient uses isHubFrame then a typed switch/pending-id map; unknown rejected frames are logged then ignored, and spoke Hello is outside admission. Neovim hub.lua _frame correlates result ids and falls through for unknown event types. Web connection.ts correlates commands by id, applies known model branches and ignores unknown types while advancing numbered cursors. Gateway.ts correlates results and forwards events; Telegram receive/inbound and Discord commands/cards/inbound check known types/id and ignore unknown events. No positional production reader found. Existing hosts-state previous-shape literal hello/request and connection-snapshot legacy regressions passed at c01dab3d; unchanged CLI/remote/MCP production paths were exercised in T2, while Web/T4 and integrated native client/catalog receipts remain unexecuted/deferred. Nvim/web source fallback is not claimed as runtime coverage. Hence the four failure files are stale positional/baseline consumers; keep current Remotes-matching source admission and migrate their tests without weakening framing/replay/burst/subscription assertions.

### rev-36 · 2026-11-12T10:56:21.175Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1819-source-3
commit: 1d606582e2f54b55db18d6012db80180efe4ea92
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear after A-19008 consumer migration correction. A-19012 records every changed test/doc and preserved framing, burst, replay and subscription control; independently verified identical hub/src tree 69694965013ea50b1a44501907c5ec666938690e across heads. Standards/Spec zero findings. Prior configured A-19007 remains red; fresh mode-free same-head verification required before final C1–C6 settlement. Qualified native evidence retains its unchanged-source linkage; no reviewer execution or provenance rerun. Remaining T3/T4 and after-stage QA separate.

### rev-36 · 2026-11-12T11:24:20.618Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1819-final-1
commit: 1d606582e2f54b55db18d6012db80180efe4ea92
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final same-head evidence clear; C1–C6 verified. A-19021/A-19019 reconcile green ce71f6ef/A-19018: 6193 base tests/685 files plus separate 45 load outcomes; all nine hosts-state identities base+5 pass and all five previous wire failures now pass. Conservative 768-file union=513 positive configured files+255 deferred T3/T4, no missing lower/Web. Exact Linux/browser provenance and production-source-linked local 37 native outcomes retained with A-19002/A-19020 capture limits and A-18999 T-1806 deltas. Prior A-19007 stays red; report-only advisories preserved. No reviewer execution or further task run. Full remaining T3/catalog, broader T4 and affected after-stage QA separate.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified, C6 verified.

### impl-1819 · 2026-11-12T12:13:20.816Z

All-tier positional-reader audit for batch ec150310, before T3 migration: exact git grep for quoted remote.state spans hub/test, nvim/test and web/test. T3 daemon.test.ts has two positional readers and tracker.test.ts one; migrate by asserting/draining hosts.state after remote.state, preserving auth/edge/write-race assertions. T2 edges-component, request-guard-component and tracker-component already drain both projections; hosts-state explicitly tests legacy connect and correlated request; connection-snapshot asserts both initial projections; remote-workbench waits by frame.type/boundary; web-area-state injects frames into reducer (no socket position). Neovim sessions.test.ts emits remote.state through a control helper; web/remotes.test.ts routes/filter remote.state and waits DOM/frame predicates, including old-hub remotes omission, never reads by position. Broader remote.state regex import hits audited too: harness.ts loops to result/error and checks assign id; fakes/messenger.ts uses frameClient correlated replies, outbox-messenger has no hub-socket reader, fakes/discord/hub uses connectUi/frameClient, telegram-pacing-fixture only reads RemoteStore outbox and clock receipts. Additional manifest-wide T4 source scan found no remote.state, awaited socket.next or welcome-position reads. Production client/admission audit from prior comment still applies unchanged. All prior reached/unknown/explicit union paths retained; A-19030 red native outcomes are actual undefined vs true at daemon:344/:509 and tracker:97, not classified as a shared defect.

### impl-1819 · 2026-11-12T12:17:37.132Z

All-tier rule-20 reader checklist at ac0f036fde7d580dc55a57c3955fc591bc88ff06 (no prior reached/unknown path dropped):
hub/test/connection-snapshot.test.ts — safe: featured snapshots/type predicates; literal previous-shape connect assertions already migrated and run.
hub/test/daemon.test.ts — positional: two raw Unix clients migrated; whole native file red 16/18, green 18/18.
hub/test/edges-component.test.ts — positional migrated earlier: both connect drains plus unchanged framing/close assertions; run green locally and in ce71f6ef.
hub/test/hosts-state.test.ts — safe: explicit literal legacy frame assertions followed by correlated request, plus type/boundary observers; nine base+5 receipts in ce71f6ef.
hub/test/remote-workbench.test.ts — safe: waitFor frame.type and recorded-frame boundaries; no positional result reads.
hub/test/request-guard-component.test.ts — positional migrated earlier: explicit connect drain; exact 500 correlated ids and replay total retained; ce71f6ef green.
hub/test/tracker-component.test.ts — positional migrated earlier: explicit connect drains; task/subscription/final facts retained; ce71f6ef green.
hub/test/tracker.test.ts — positional: one pre-opened Unix client migrated; whole native file red 4/5, green 5/5, conflict/final bytes assertions retained.
hub/test/web-area-state.test.ts — safe: reducer input injection by frame type, no socket position.
nvim/test/sessions.test.ts — safe: control emits frame types and observes rendered facts; no socket position.
web/test/remotes.test.ts — safe: websocket route branches on frame.type and DOM/frame predicates; prior-hub remotes omission stays tested, hosts frame ignored by unchanged client; ce71f6ef Web green.
Broader import-pattern candidates also checked: hub/test/harness.ts loops to result/error and checks assign id; hub/test/fakes/messenger.ts uses correlated frameClient; hub/test/fakes/outbox-messenger.ts has no hub-socket reader; hub/test/fakes/discord/hub.ts uses connectUi/frameClient; hub/test/telegram-pacing-fixture.ts reads RemoteStore outbox and clock receipts, no frame position.
Exact quoted remote.state git-grep over hub/test,nvim/test,web/test yields the eleven test files above. Broader regex includes the helper/import cases above. Manifest-wide T4 scan found no remote.state, awaited socket.next or welcome-position reads. Production Remotes-matching admission and unknown-frame safety audit remains unchanged. hub/src tree remains 69694965013ea50b1a44501907c5ec666938690e. The new head changes only the two native test consumers and their guides; no dev merge. Native exact invocations, red/green stdout/completions/capture limits are in A-19034, prefix inventories A-19035.

### rev-36 · 2026-11-12T12:18:29.335Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1819-source-4
commit: ac0f036fde7d580dc55a57c3955fc591bc88ff06
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear for the T3 positional-consumer follow-up. A-19036 records exact three added handshake assertions, preserved daemon auth/edge and tracker conflict/final-byte controls, and independently confirmed identical hub/src tree across heads. Standards/Spec zero findings. Prior task green and batch reds retain their original scopes; no current-head Linux pass is claimed. Fresh configured mode-free verification must execute changed daemon/tracker T3 once before final current-head C1–C6 settlement. Full remaining T3/catalog, broader T4 and after-stage QA separate. No reviewer execution.

### rev-36 · 2026-11-12T12:43:01.379Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1819-final-2
commit: ac0f036fde7d580dc55a57c3955fc591bc88ff06
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final current-head evidence clear; C1–C6 verified at ac0f036f. A-19042/A-19041 independently reconcile A-19040/9c76e87a: 6216 positive base cases/687 files, separate 45 load outcomes; all nine hosts-state identities base+5 and changed daemon18/tracker5 T3 pass once, including three repaired positional cases. Conservative 768-file union=515 current positive files+253 explicit T3/T4 deferrals; no missing lower/Web. Exact Linux/Neovim/browser provenance and A-19034/A-19035 local capture/inventory limits preserved; prior task/batch reds remain red. No findings or reviewer execution. Full remaining T3/catalog, broader T4 and affected after-stage QA stay separate; no further task run requested.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified, C6 verified.

### coord · 2026-11-12T13:41:31.398Z

Merged 8d130765452c941fc780dac905da249bbbed9a29 onto dev.
