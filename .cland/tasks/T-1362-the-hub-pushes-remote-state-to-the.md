---
id: T-1362
kind: task
title: The hub pushes remote state to the workbenches, and Neovim's sessions panel shows a Remotes row
state: open
status: review
size: M
criterion_seq: 4
labels:
  - ready-for-agent
assignee: null
parent: E-1313
blocked_by:
  - T-1361
  - T-1348
topic: topic-1109
branch: t/T-1362-the-hub-pushes-remote-state-to-the
created: 2026-10-27T05:46:49.834Z
updated: 2026-10-27T10:11:56.242Z
---

## Summary

A new remote-state frame reaches every client on connect and on every change. For each messenger it carries the connection, who is paired, mute, the outbox depth and the last error. Neovim's sessions panel shows one Remotes row per messenger from it, red the moment a remote goes offline or stops, long before General's 3-minute offline line.

## What to build

Spec §3.11 (the workbenches) and §3.9 (liveness, "the Remotes row turns red at once").

The gateway emits a change whenever a remote is disabled, stopped with a cause, goes offline at its first failed exchange (Telegram's poll loop already knows it is offline), recovers, is paired or unpaired, or changes mute. Outbox depth changes are coalesced to at most one push a second. The hub turns these changes into a client frame of the one protocol, sent in the connect snapshot and on every change. The frame is a client-safe projection of the status row: messenger, enabled, connection (connected, offline since, stopped, disabled), the paired name, mute, the outbox depth, and the last error with the cause from 01. It never carries a token, a fingerprint or a chat id. Older clients ignore it (additive frame; rule 20 consumer list).

Neovim's sessions panel draws a Remotes row beside the verification line. It shows facts only: for example "telegram · connected · paired Name · muted · outbox 0", and the cause on failure. The row uses the error highlight while the remote is offline or stopped. The row hides when no messenger is enabled.

**External wait and shared files:** E-1309 (T-1348's offline-since tracking must be on dev) · **Shared files:** hub/src/protocol.ts, hub/src/remote/gateway.ts, hub/src/remote/telegram-polling.ts, hub/src/hub/daemon.ts, nvim/lua/cland/panels.lua, nvim/lua/cland/hub.lua, nvim/lua/cland/init.lua

## Acceptance criteria

- [x] C1. Through the frame harness, a client receives the remote-state frame on connect and after each change, with the fields named above and no token, fingerprint or chat id (test).
  - done: impl-1362 · 2026-10-27T09:55:08.332Z
- [x] C2. A failed exchange on the fake Bot API pushes the Telegram remote as offline within one second under an injected clock, and the next successful poll pushes it as connected (test).
  - done: impl-1362 · 2026-10-27T09:55:08.430Z
- [x] C3. Headless Neovim's sessions panel shows the Remotes row with connection, paired name, mute, outbox depth and last error, red within one second of a fake outage and plain again on recovery (test).
  - done: impl-1362 · 2026-10-27T09:55:08.516Z
- [x] C4. A client speaking the previous wire shape connects and works unchanged while the frame is sent (test).
  - done: impl-1362 · 2026-10-27T09:55:08.734Z

## Comments

### impl-1362 · 2026-10-27T09:42:42.852Z

Rule 20 consumer inventory before implementation: searches across hub/src, shared/wire, web/src, nvim/lua, all hub/nvim/web test tiers, qa and shipped .agents/skills for remote.status, RemoteStatusRow/Result, RemoteConnection, SnapshotValues, snapshot.end and verification.queue. Production: hub/src/protocol.ts, shared/wire/index.ts, hub/test/wire-conformance.ts; hub core/dispatch/snapshot/daemon; remote gateway/configuration/messenger/telegram; CLI remote, doctor remotes/project, setup hub; web connection.ts and sessions/state.ts; Neovim hub/init/state/explorer/panels. Migration: new remote.state event plus optional sessions.remotes snapshot field; restate in browser wire and add conformance. Neovim consumes event; previous snapshot without remotes remains valid. Web connection/reducer already ignores unknown events and extra snapshot fields; its Remotes UI is T-1363. Keep remote.status and its authority/IDs/fingerprint unchanged. Storage schema stays unchanged; internal optional RemoteConnection offlineSince/lastError fields preserve injected legacy clients. Persisted readers: remote/state.ts, doctor, CLI and setup continue unchanged.
Test consumers audited: connection-{snapshot,resume,resync}, snapshot-framing, computed-sessions, startup-replies-scale, wire-conformance, human-marks, approval-records, item-summary[-lua], roles-snapshot[-cli], remote-{cli,scripted,state,state-migration}, fake legacy-remote-hub, doctor-remotes, setup-remotes, telegram-{messenger,inbound,mute,pacing,pairing,rendering,liveness} and their fixtures, suite-{protocol,runner-contract,admission-responsive}, executor-admission-lock, web-{area-state,authority,verification-model}; Neovim fixtures/protocol-frames.json, verification-{queue,view}, sessions; Web area-slots, pairing, phone-disconnected, topics, verification, fixtures/verification and record-verification. Existing consumers retain the previous wire shape; add a literal previous-feature hello and old snapshot regression. QA archived briefs E-412 stages 2/3, E-413 (and stages 1/2), E-414 (and stages 1/2/3), E-417 stage1, E-418 stages1/2, E-419 stage3, T-230 use old verification frames, unaffected. Shipped implement skill receives new flow guidance; old remote status examples remain valid. No key/action or permission change; role clause requires no extra lines.

### impl-1362 · 2026-10-27T09:48:55.996Z

Additional raw-socket consumer audit after the connect-frame red run: connectSocket.next consumers were searched across all tiers. assignRole in hub/test/harness.ts assumed that the next frame after welcome is its result; it must correlate the result and ignore additive events. Direct unfeatured human peers in tracker-component.test.ts, tracker.test.ts, request-guard-component.test.ts, daemon.test.ts and edges-component.test.ts need an explicit initial remote.state receipt before their positional result assertions. suite-admission-close.test.ts closes before consuming a result; session-async-processes-lifecycle and verify-all already correlate IDs; item-summary-lua/startup-replies-scale use feature snapshots; all session/progress/subscription/name-reservation/adapter/brief socket peers send spoke hellos and are unaffected. scenarios/hub-lifecycle closes without another read, unaffected. Production askHubFrame/CLI request clients correlate result IDs; Neovim ignores unknown frames and Web's switch ignores unknown event types. The standalone remote.state connect frame is limited to non-snapshot connects; featured clients get it atomically through sessions.remotes, retaining the seven existing domains and sequence transaction.

### rev-26 · 2026-10-27T09:59:11.596Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261027-1362-source-1
commit: a3d65fa49c26eac458943ee3d2b0b9b4c3d1b30d
scope: full
findings: [{"severity":"medium","text":"M1 Standards: added REMOTE_USAGE sentence has no matching update in its owning frozen commands.json row; unchanged usage/full-help guards disagree with production help. Correct only that row and retain original red/green receipts.","file":"hub/src/cli/usage.ts","line":67}]
finding_counts: {"high":0,"medium":1,"low":0}

Full read-only source audit in A-12694. Standards M1 only; no additional Spec finding. C1–C4 source coverage inspected, no runtime verification marks. Lead's reported uncommitted one-row correction is outside this exact commit. Request corrected pushed-head source review before verification; Coordinator owns required full cover.

### rev-26 · 2026-10-27T09:59:57.313Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261027-1362-source-2
commit: 08ae15af1149359147986aa7850593354826df94
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Corrected full source clear, Standards/Spec no remaining findings; A-12695 retains A-12694's full audit. Direct-child delta is exactly the owning REMOTE_USAGE frozen-row correction; original local red/green guard receipts A-12688–A-12691 inspected. No reviewer runtime execution, no C1–C4 runtime marks yet. Same-head mode-free task verification may proceed; Coordinator's separate required verify all remains before enqueue.

### rev-26 · 2026-10-27T10:03:53.801Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261027-1362-source-3
commit: 9c1f56d2ba20d454c1e460ecfca68687c0116008
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Merge-delta source clear, A-12698. Both-parent integration and sole pairing.md conflict resolution inspected; no Standards/Spec findings. A-12697 local targeted summary retained without configured/Linux proof. C1-C4 runtime marks pending; old run A-12696 remains failed/T0 only. Coordinator 9bdcff4a explicitly replaces replacement task verification with verify all at this head; report ready under that direction.

### rev-26 · 2026-10-27T10:11:56.242Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261027-1362-source-4
commit: 9ed32303577485dd8860b3c9d5316da9513b76fa
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Index-only delta source clear, A-12705. Three authored Guide rows now use the unchanged guard's established Notes/linked-test format. Original A-12702 failure inspected; this requirement was missed in earlier source review, not lost by merge. A-12704 local red/green and serial summary retained with limits. Both earlier runs remain failed; C1-C4 runtime verification pending Coordinator replacement verify all under c8d46650/9bdcff4a.
