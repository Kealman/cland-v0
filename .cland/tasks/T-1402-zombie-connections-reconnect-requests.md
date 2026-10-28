---
id: T-1402
kind: task
title: Zombie connections, reconnect requests and invalid sessions resume without an identify, with the offline and recovery lines
state: open
status: in progress
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
updated: 2026-10-28T10:37:31.449Z
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
  - done: impl-1402 · 2026-10-28T10:34:03.267Z
- [x] C2. Ten forced drops, an op 7 and an op 9 with `d: true` each resume, and the fake counts no identify beyond the first (test).
  - done: impl-1402 · 2026-10-28T10:34:03.432Z
- [x] C3. An op 9 with `d: false` leads to one fresh identify after a wait of 1 to 5 seconds under the injected clock (test).
  - done: impl-1402 · 2026-10-28T10:34:03.539Z
- [ ] C4. Three minutes without a working connection give one "Discord remote offline since" line in General and one recovery line, and the status row shows offline at once (test).
  - failed: rev-26 [reviewer] · 2026-10-28T10:37:31.449Z · note An expected job-local missing-edit 404 marks an acknowledged healthy remote disconnected and can emit an offline notice.

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
