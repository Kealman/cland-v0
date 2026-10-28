---
id: T-1402
kind: task
title: Zombie connections, reconnect requests and invalid sessions resume without an identify, with the offline and recovery lines
state: closed
status: done
size: M
criterion_seq: 4
labels:
  - ready-for-agent
assignee: null
parent: E-1312
blocked_by:
  - T-1400
  - T-1401
topic: topic-1146
branch: t/T-1402-zombie-connections-reconnect-requests
created: 2026-10-27T23:38:46.285Z
updated: 2026-10-28T13:33:15.321Z
closed: 2026-10-28T13:32:28.079Z
---

## Summary

A missing heartbeat acknowledgement terminates the socket and resumes, and so do an op 7, a resumable invalid session and a dropped connection. The replayed events are deduplicated. A remote offline for 3 minutes says so once in General, and once more on recovery.

## What to build

**Zombies and resumes.** When no ACK arrived between two heartbeats, the socket is terminated without a close frame (never 1000 or 1001). The remote reconnects to `resume_gateway_url` and sends RESUME with the session id and the last sequence.

**The cases.**
- An op 7, a drop without a close code, and the close codes that allow it all resume.
- An op 9 with `d: true` resumes.
- An op 9 with `d: false` identifies afresh after a random 1 to 5 seconds.
- Reconnects back off with jitter and a cap.

**Replays.** Replayed dispatches arrive in order and are deduplicated by message and interaction id against what was already handled. Handling a replayed click is ticket 17's.

**Liveness.** The remote shows connected only after a recent acknowledgement. After 3 minutes offline, the socket down past a resume or REST sends failing, General gets one line "Discord remote offline since HH:MM: <reason>". It gets one more line on recovery, and the status row turns offline at once.

**The fake gateway.** Its sessions buffer events and replay them on RESUME inside a window under the injected clock. Its control withholds acknowledgements, drops the socket, sends op 7 or op 9 and counts identifies and resumes.

Spec §3.8 (connection, resume), §3.9 (liveness, telling the human); research rules 9, 10 and 14.

## Acceptance criteria

- [x] C1. With the fake withholding heartbeat acknowledgements, the remote terminates the socket without code 1000 or 1001 and resumes, and a message the human typed meanwhile reaches General exactly once (test).
  - verified: rev-32 [reviewer] · run rev-20261028-1402-evidence1 · 2026-10-28T11:06:54.736Z · commit 664fe6d73d9ea5f255088042e5512805806cc673
  - done: impl-1402 · 2026-10-28T11:36:23.322Z
  - verified: rev-32 [reviewer] · run rev-20261028-1402-final2 · 2026-10-28T11:55:38.528Z · commit c88754f9ab96b1ebfd9ffb2b61db056994ca2ac7
- [x] C2. Ten forced drops, an op 7 and an op 9 with `d: true` each resume, and the fake counts no identify beyond the first (test).
  - verified: rev-32 [reviewer] · run rev-20261028-1402-evidence1 · 2026-10-28T11:06:54.736Z · commit 664fe6d73d9ea5f255088042e5512805806cc673
  - done: impl-1402 · 2026-10-28T11:36:23.468Z
  - verified: rev-32 [reviewer] · run rev-20261028-1402-final2 · 2026-10-28T11:55:38.528Z · commit c88754f9ab96b1ebfd9ffb2b61db056994ca2ac7
- [x] C3. An op 9 with `d: false` leads to one fresh identify after a wait of 1 to 5 seconds under the injected clock (test).
  - verified: rev-32 [reviewer] · run rev-20261028-1402-evidence1 · 2026-10-28T11:06:54.736Z · commit 664fe6d73d9ea5f255088042e5512805806cc673
  - done: impl-1402 · 2026-10-28T11:36:23.579Z
  - verified: rev-32 [reviewer] · run rev-20261028-1402-final2 · 2026-10-28T11:55:38.528Z · commit c88754f9ab96b1ebfd9ffb2b61db056994ca2ac7
- [x] C4. Three minutes without a working connection give one "Discord remote offline since" line in General and one recovery line, and the status row shows offline at once (test).
  - verified: rev-32 [reviewer] · run rev-20261028-1402-evidence1 · 2026-10-28T11:06:54.736Z · commit 664fe6d73d9ea5f255088042e5512805806cc673
  - done: impl-1402 · 2026-10-28T11:36:24.035Z
  - verified: rev-32 [reviewer] · run rev-20261028-1402-final2 · 2026-10-28T11:55:38.528Z · commit c88754f9ab96b1ebfd9ffb2b61db056994ca2ac7

## Notes

Shared files: discord-socket.ts, discord.ts; hub/test/fakes/discord/ (gateway sessions)

## Comments

### impl-1402 · 2026-10-28T09:17:11.148Z

Consumer inventory before changing reconnect/liveness policy: DiscordSocket is constructed only by discord.ts; DiscordRemote by messenger.ts and injected discord-messenger tests. Native dispatch consumers: DiscordCommands, DiscordInbound, outbox.observe and optional handlers. Fake gateway consumers: discord-messenger, discord-messages, discord-pairing and fake-discord tests/fixture helpers. Notice consumers: messengerFactory persistence callback, daemon remoteNotice, tests with distinct Discord/Telegram callbacks. Status readers across protocol/gateway, CLI, doctor, web and nvim remain unchanged (connected boolean/optional fields). Searched hub/web/nvim/qa/.agents/docs including all tiers, shipped skills, startup probes and persisted readers; no new wire shape, schema or refusal class. Preserve remote-cli previous-hub regressions. Resume state remains memory-only here; restart persistence and expired click reconciliation belong to T-1412/1413.

### impl-1402 · 2026-10-28T09:24:10.235Z

Socket-side implementation committed at dd63db42f. Local macOS Node v24.21.0: discord-messenger.test.ts 25/25 (4.141 s file), root typecheck pass; no Linux/full-suite/source verdict. Red controls: zombie and invalid-session exact receipt timeouts; forced-drop baseline disabled rather than disconnected; offline notice timeout before implementation. Evidence/scope A-13170, durable artifact in item topic. Coordinator holds first review until T-1404 lands and instructs dev integration; settled REST health hook remains pending on its paced layer. No criterion completion marks yet.

### impl-1402 · 2026-10-28T10:30:25.062Z

REST health contract inventory before additive subscription: DiscordApi production callers are discord.ts (application/test/replacement), discord-commands.ts (command registration/callback/editOriginal), discord-outbox.ts (createMessage), messenger.ts (factory); direct fixtures/tests are discord-api.test.ts, discord-messenger.test.ts, discord-messages.test.ts, discord-pairing.test.ts. Docs and shipped implement skill describe the existing fake seam; no QA brief/startup probe/native client uses the new subscription. Keep onError unchanged. New onExchange callback reports only validated numeric channel + boolean, after paced POST/PATCH message request settles including retries, and has unsubscribe. DiscordRemote alone consumes it, filtered to current pairing; prior callers/observers remain valid without subscribing. No persisted or public frame shape changes.

### rev-26 · 2026-10-28T10:37:31.449Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261028-1402-source-1
commit: 251fa4f112362ae8e8f6692cafed2a14b8c08335
scope: full
findings: [{"severity":"medium","text":"M1 Spec: all settled paired-channel PATCH errors emit health=false. A missing-message 404 therefore sets DiscordRemote.restFailedChannel, disconnects a healthy acknowledged remote and announces a REST outage after three minutes, violating the retained job-local missing-edit policy. Exclude job-local outcomes from connection-health failure and add a live-remote connected/no-transition control alongside real send-outage coverage.","file":"hub/src/remote/discord-api.ts","line":121},{"severity":"medium","text":"M2 Standards: injected Store closure is registered before the hub stop/drain barrier; early setup/receipt failure closes storage while the remote can still read/write it. The REST-health held observer is not caught/owned before clock.advance, and release/join exists only on the success path. Use one pre-registered fixture owner for bounded setup/observer and send/stop drainage, then Store/root cleanup, with omitted/aborted setup/held-receipt controls preserving semantic assertions.","file":"hub/test/discord-messenger.test.ts","line":281},{"severity":"medium","text":"M3 Standards: REST-health retry timing advances the fake clock from server POST counts rather than client refusal/backoff registration. Server request observation precedes response parsing and retry timer creation; advance() is explicitly not an I/O completion barrier. Observe the actual client retry boundary before each 1/2/4-second advance and retain connected-during-retry plus durable missed/outage/recovery assertions.","file":"hub/test/discord-messenger.test.ts","line":393}]
finding_counts: {"high":0,"medium":3,"low":0}

A-13207 consolidated full source1 audit: Standards M2 pre-owned observer/operation cleanup before Store/root closure, M3 actual client retry boundary before fake-time advance; Spec M1 job-local missing-edit 404 incorrectly marks remote offline. Three medium findings. C4 failed; C1–C3 runtime-unverified. Fix M1–M3 retaining all semantic assertions and actual red/green controls, then request fresh exact pushed-head source review before verification. Reviewer ran no tests; no full run requested; no dev merge absent Coordinator direction.

Criteria: C4 failed (An expected job-local missing-edit 404 marks an acknowledged healthy remote disconnected and can emit an offline notice.).

### impl-1402 · 2026-10-28T10:43:52.381Z

Source1 corrections: M1 reproduced by new acknowledged native 404-edit control (expected connected, got disconnected); missing-message PATCH404 now preserves onError/rejection but emits no failed health, and remains healthy past 180001ms with no outage/recovery. M2 adds pre-registered discordHubFixtureOwner built on existing exchange owner, joins hub/native/observers before injected Store closure, and covers omitted+aborted setup/held receipts with native closed/zero writer/handler/observer/timer and hub-stopped→store-closed order. M3 adds useful allowlisted route/numeric status/code discord-rest-refused diagnostic to existing log sink; exact client refusal ordinal is observed before each 1/2/4s advance. Reviewers confirmed FakeClock's pre-time-change setImmediate drains the rejection→pause registration microtasks; no new production test hook. Consumer inventory: existing DiscordRemoteOptions.log/messengerFactory redacted sink, daemon log, projectHub sink and CLI log readers retain arbitrary-event compatibility; no wire/schema/authority changes.

### rev-32 · 2026-10-28T10:50:34.596Z

verdict: review
result: clear
by: rev-32 [reviewer]
run: rev-20261028-1402-source2
commit: 664fe6d73d9ea5f255088042e5512805806cc673
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Full source2 clear at 664fe6d73; A-13220 records the complete successor audit and resolution of A-13207 M1–M3. Missing-edit PATCH404 preserves acknowledged health/no transitions; pre-owned fixture joins hub/native/observers before injected Store closure, with omitted/aborted setup/held controls; exact sanitized client-refusal ordinals plus the pre-time-change FakeClock yield establish retry registration without intervening I/O. Original General, durable settlement, replay/resume and secret assertions retained; docs/skill/consumer inventory aligned. No findings. C1–C4 remain runtime-unverified; no reviewer tests/browser/probes. Claimant local Darwin evidence is labelled separately. Mode-free configured verification may now run at this exact head; Coordinator's subsequent verify-all requirement remains.

### rev-32 · 2026-10-28T11:06:54.736Z

verdict: review
result: clear
by: rev-32 [reviewer]
run: rev-20261028-1402-evidence1
commit: 664fe6d73d9ea5f255088042e5512805806cc673
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Configured evidence clear only; final readiness remains contingent on Coordinator full24a4be42 still pending. A-13230 independently audits original45efac9e/A-13229 at exact unchanged source2 head:3885 ordinary test passes/497 files plus80 separate load passes,zero nonpassing outcomes/unmatched starts. C1–C4 identities each ordinary+5/5 load; REST outage,acknowledged missing-edit404,four owner-failure controls and legacy API subscription also ordinary+5/5,55 task-specific load passes total. Retained exact close/replay/Identify,General,secret,durable settlement and Store-after-writer-drain assertions confirmed; max own observation1.096468244s. Host T0 candidatee258be1 reused separately; Linux c-8nyc1 T1/allT2fallback/Web complete,isolated HeadlessShell156/1248,budgets/lint report-only. No T3/T4 selected. C1–C4 verified from this configured receipt, no full-cover/ready/enqueue claim. Required same-head full run must receive original-record review when it lands.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified.

### rev-32 · 2026-10-28T11:36:14.341Z

verdict: review
result: clear
by: rev-32 [reviewer]
run: rev-20261028-1402-delta1
commit: c88754f9ab96b1ebfd9ffb2b61db056994ca2ac7
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-13251 authorized integration delta clear: parent664fe6d7+dev4c8f16189. One manual persistence type resolution retains Discord transition? and Telegram maxUploadMb; combined daemon/factory passes both correctly. Own Discord runtime/tests/fakes/guides byte-identical; incoming media/speech/Items/help/durations match dev. Skills/CHANGES/README unions intact,no new contract/assertion/allowance. C1–C4 remain stale/runtime-unverified at new head; old A-13229 belongs only to664fe6d7. Local Darwin typecheck claim not Linux proof. Submit authorized mode-free verify at unchangedc88754f9 then original-record evidence review. Coordinator retains pending full24a4be42 old-head T3/T4 gate only if usable green receipt arrives; no pass inferred from running state.

### rev-32 · 2026-10-28T11:55:38.528Z

verdict: review
result: clear
by: rev-32 [reviewer]
run: rev-20261028-1402-final2
commit: c88754f9ab96b1ebfd9ffb2b61db056994ca2ac7
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-13271 independently audits original new-head b86939bc/A-13268 and retained old-head full24a4be42/A-13258. Current configured:3910 ordinary passes/497 files+80 separate load passes,zero nonpassing outcomes/unfinished starts; all11 task identities ordinary+5/5,C1–C4 retained semantic/General/durable/secret/cleanup assertions confirmed,max own1.350376262s. Host candidate24c6118 reused separately; Linux c-8nyc1 T1/allT2fallback/Web complete,HeadlessShell156/1248,report-only budgets/lint,no current T3/T4. Prior full at664fe6d7:5289pass/8skip/695files,zero failures; actual T0–T3/Web exit0,no separate T4 tier; eight skips not passes. Coordinator95a6ed43 explicitly retains that scope for mechanical c88754f9 integration and requires current configured green→final→ready; head attribution remains separate. C1–C4 verified atc88754f9. No reviewer execution/edits; Coordinator owns queue/landing and printed batch follow-up blocker.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified.

### coord · 2026-10-28T13:32:28.079Z

Merged a528baa459d471d25892a49e7ad289e21532ab6e onto dev.
